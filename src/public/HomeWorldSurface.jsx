import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { clampHomeWorldCamera, getZoomedHomeWorldCamera, HOME_WORLD_ZOOM_LEVELS } from './homeWorldCamera.js';
import './homeWorld.css';

const clamp = (value, minimum, maximum) => Math.max(minimum, Math.min(maximum, value));

export default function HomeWorldSurface({ camera, geometry, world, locations = [], gridVisible, theme, visible, onCameraChange, onMoveKeeper, onOpenContextMenu }) {
  const dragRef = useRef(null);
  const mapDragRef = useRef(null);
  const spaceHeldRef = useRef(false);
  const zoomWheelRef = useRef(0);
  const [spaceHeld, setSpaceHeld] = useState(false);
  const narrow = geometry.narrow;
  const zoom = narrow ? 1 : camera.zoom;
  const worldTheme = { ...theme, '--module-accent': theme?.['--os-accent'] || '#e87945' };

  const handlePointerDown = (event) => {
    const panButton = event.pointerType !== 'mouse' || event.button === 0 || event.button === 1;
    if (narrow || !panButton || event.target.closest?.('button,.spatial-index')) return;
    dragRef.current = {
      pointerId: event.pointerId,
      originPointer: { x: event.clientX, y: event.clientY },
      originCamera: camera,
      moved: false,
      panning: event.button === 1 || spaceHeldRef.current
    };
    event.preventDefault();
    event.currentTarget.setPointerCapture?.(event.pointerId);
  };

  const handlePointerMove = (event) => {
    const drag = dragRef.current;
    if (!drag || drag.pointerId !== event.pointerId) return;
    const dx=event.clientX-drag.originPointer.x;const dy=event.clientY-drag.originPointer.y;
    drag.moved ||= Math.hypot(dx,dy) > 5;
    if (!drag.moved) return;
    onCameraChange(clampHomeWorldCamera({...drag.originCamera,x:drag.originCamera.x-dx/zoom,y:drag.originCamera.y-dy/zoom},world));
  };

  const changeZoom=(nextZoom,anchor={x:world.viewportWidth/2,y:world.viewportHeight/2})=>onCameraChange(getZoomedHomeWorldCamera(camera,nextZoom,anchor,world));
  const moveFromMap=(event)=>{const rect=event.currentTarget.getBoundingClientRect();const x=((event.clientX-rect.left)/rect.width)*world.width;const y=((event.clientY-rect.top)/rect.height)*world.height;onCameraChange(clampHomeWorldCamera({x:x-world.viewportWidth/(2*zoom),y:y-world.viewportHeight/(2*zoom),zoom},world));};
  const startMapDrag=(event)=>{if(event.pointerType==='mouse'&&event.button!==0)return;event.preventDefault();event.stopPropagation();mapDragRef.current=event.pointerId;event.currentTarget.setPointerCapture?.(event.pointerId);moveFromMap(event);};
  const moveMapDrag=(event)=>{if(mapDragRef.current!==event.pointerId)return;event.preventDefault();moveFromMap(event);};
  const finishMapDrag=(event)=>{if(mapDragRef.current===event.pointerId)mapDragRef.current=null;};

  const handleWheel=(event)=>{
    if(narrow)return;
    if(event.ctrlKey){
      event.preventDefault();
      const now=performance.now();if(now-zoomWheelRef.current<80)return;zoomWheelRef.current=now;
      const index=HOME_WORLD_ZOOM_LEVELS.indexOf(zoom);const nextIndex=clamp(index+(event.deltaY<0?1:-1),0,HOME_WORLD_ZOOM_LEVELS.length-1);
      if(nextIndex!==index)changeZoom(HOME_WORLD_ZOOM_LEVELS[nextIndex],{x:event.clientX,y:event.clientY});
      return;
    }
    event.preventDefault();
    const horizontal=event.shiftKey?event.deltaY:event.deltaX;
    const vertical=event.shiftKey?0:event.deltaY;
    onCameraChange(clampHomeWorldCamera({...camera,x:camera.x+horizontal/zoom,y:camera.y+vertical/zoom},world));
  };

  useEffect(()=>{
    if(narrow)return undefined;
    const keydown=(event)=>{
      if(event.target.closest?.('input,textarea,select,[contenteditable="true"]'))return;
      if(event.code==='Space'){event.preventDefault();spaceHeldRef.current=true;setSpaceHeld(true);return;}
      if(!event.ctrlKey)return;
      const index=HOME_WORLD_ZOOM_LEVELS.indexOf(camera.zoom);
      if(event.key==='0'){event.preventDefault();changeZoom(1);}
      else if(event.key==='+'||event.key==='='){event.preventDefault();changeZoom(HOME_WORLD_ZOOM_LEVELS[Math.min(HOME_WORLD_ZOOM_LEVELS.length-1,index+1)]);}
      else if(event.key==='-'||event.key==='_'){event.preventDefault();changeZoom(HOME_WORLD_ZOOM_LEVELS[Math.max(0,index-1)]);}
    };
    const keyup=(event)=>{if(event.code==='Space'){spaceHeldRef.current=false;setSpaceHeld(false);}};
    const blur=()=>{spaceHeldRef.current=false;setSpaceHeld(false);};
    window.addEventListener('keydown',keydown);window.addEventListener('keyup',keyup);window.addEventListener('blur',blur);
    return()=>{window.removeEventListener('keydown',keydown);window.removeEventListener('keyup',keyup);window.removeEventListener('blur',blur);};
  },[camera,narrow,world]);

  const finishPointer = (event, cancelled = false) => {
    const drag = dragRef.current;
    if (!drag || drag.pointerId !== event.pointerId) return;
    dragRef.current = null;
    if (!cancelled && !drag.moved && !drag.panning) onMoveKeeper?.(event.clientX, event.clientY);
  };

  const root = typeof document === 'undefined' ? null : document.querySelector('.application-root');
  const surface = <section
    className="home-world-surface"
    data-desktop-canvas
    data-pannable={!narrow || undefined}
    data-space-held={spaceHeld || undefined}
    data-visible={visible || undefined}
    aria-label="Spatial home world"
    style={worldTheme}
    onPointerDown={handlePointerDown}
    onPointerMove={handlePointerMove}
    onWheel={handleWheel}
    onPointerUp={finishPointer}
    onPointerCancel={(event) => finishPointer(event, true)}
    onLostPointerCapture={(event) => finishPointer(event, true)}
    onContextMenu={(event) => { event.preventDefault(); event.stopPropagation(); onOpenContextMenu?.(event); }}
  >
    <div className="home-world-surface__world" style={{width:world.width,height:world.height,transform:`translate3d(${-camera.x*zoom}px,${-camera.y*zoom}px,0) scale(${zoom})`}}>
      {gridVisible && <div className="home-world-surface__grid" aria-hidden="true" />}
      <div className="home-world-surface__sectors" aria-hidden="true">{Array.from({length:9},(_,index)=>{const column=index%3;const row=Math.floor(index/3);return <span key={index} style={{left:(column+.5)*world.viewportWidth,top:(row+.5)*world.viewportHeight}}>{String.fromCharCode(65+column)}{row+1}</span>;})}</div>
      <i className="home-world-surface__origin" aria-hidden="true" style={{left:world.viewportWidth,top:world.viewportHeight}}/>
    </div>
    {!narrow && <aside className="spatial-index" aria-label="Navigator"><header><strong>NAVIGATOR</strong><span>{Math.round(zoom*100)}%</span></header><svg viewBox={`0 0 ${world.width} ${world.height}`} preserveAspectRatio="none" onPointerDown={startMapDrag} onPointerMove={moveMapDrag} onPointerUp={finishMapDrag} onPointerCancel={finishMapDrag} onLostPointerCapture={finishMapDrag} aria-label="Navigate world map"><path d={`M ${world.viewportWidth} 0 V ${world.height} M ${world.viewportWidth*2} 0 V ${world.height} M 0 ${world.viewportHeight} H ${world.width} M 0 ${world.viewportHeight*2} H ${world.width}`}/>{locations.map((location)=><circle key={location.id} data-kind={location.kind} cx={location.x} cy={location.y} r="24"><title>{location.label}</title></circle>)}<rect className="spatial-index__viewport" x={camera.x} y={camera.y} width={world.viewportWidth/zoom} height={world.viewportHeight/zoom}/></svg><footer><button type="button" disabled={zoom===HOME_WORLD_ZOOM_LEVELS[0]} onClick={()=>changeZoom(HOME_WORLD_ZOOM_LEVELS[Math.max(0,HOME_WORLD_ZOOM_LEVELS.indexOf(zoom)-1)])}>−</button><button type="button" onClick={()=>changeZoom(1)}>{Math.round(zoom*100)}%</button><button type="button" disabled={zoom===HOME_WORLD_ZOOM_LEVELS.at(-1)} onClick={()=>changeZoom(HOME_WORLD_ZOOM_LEVELS[Math.min(HOME_WORLD_ZOOM_LEVELS.length-1,HOME_WORLD_ZOOM_LEVELS.indexOf(zoom)+1)])}>+</button></footer></aside>}
  </section>;

  return root ? createPortal(surface, root) : surface;
}
