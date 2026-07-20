import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { clampHomeWorldCamera, getZoomedHomeWorldCamera, HOME_WORLD_ZOOM_LEVELS } from './homeWorldCamera.js';
import { exceedsSpatialPointerDragThreshold, finalizeSpatialPointer } from './spatialWorldCamera.js';
import './homeWorld.css';

const clamp = (value, minimum, maximum) => Math.max(minimum, Math.min(maximum, value));

export default function HomeWorldSurface({ camera, geometry, world, locations = [], gridVisible, theme, visible, onCameraChange, onMoveKeeper, onOpenContextMenu, narrowGestureRef }) {
  const surfaceRef = useRef(null);
  const dragRef = useRef(null);
  const mapDragRef = useRef(null);
  const touchPointersRef = useRef(new Map());
  const pinchRef = useRef(null);
  const spaceHeldRef = useRef(false);
  const zoomWheelRef = useRef(0);
  const [spaceHeld, setSpaceHeld] = useState(false);
  const narrow = geometry.narrow;
  const zoom = narrow ? 1 : camera.zoom;
  const worldTheme = { ...theme, '--module-accent': theme?.['--os-accent'] || '#e87945' };

  const handlePointerDown = (event) => {
    if (event.pointerType !== 'mouse') {
      touchPointersRef.current.set(event.pointerId, { x: event.clientX, y: event.clientY });
      if (narrow && narrowGestureRef?.current) {
        narrowGestureRef.current.activePointers.add(event.pointerId);
        if (narrowGestureRef.current.activePointers.size > 1) narrowGestureRef.current.multiTouch = true;
      }
      if (!narrow && touchPointersRef.current.size === 2) {
        const [first, second] = [...touchPointersRef.current.values()];
        pinchRef.current = { distance: Math.hypot(second.x-first.x,second.y-first.y), camera };
        dragRef.current = null;
        event.preventDefault(); event.currentTarget.setPointerCapture?.(event.pointerId);
        return;
      }
      if (narrow && touchPointersRef.current.size > 1) {
        if (dragRef.current) dragRef.current.multiTouch = true;
        return;
      }
    }
    const panButton = event.pointerType !== 'mouse' || event.button === 0 || (!narrow && event.button === 1);
    if (narrow && event.isPrimary === false) return;
    if (!panButton || event.target.closest?.('button,.spatial-index')) return;
    dragRef.current = {
      pointerId: event.pointerId,
      originPointer: { x: event.clientX, y: event.clientY },
      originCamera: camera,
      moved: false,
      panning: !narrow && (event.button === 1 || spaceHeldRef.current),
      multiTouch: false
    };
    if (narrow) return;
    event.preventDefault();
    event.currentTarget.setPointerCapture?.(event.pointerId);
  };

  const handlePointerMove = (event) => {
    if (event.pointerType !== 'mouse' && touchPointersRef.current.has(event.pointerId)) {
      touchPointersRef.current.set(event.pointerId, { x: event.clientX, y: event.clientY });
      if (pinchRef.current && touchPointersRef.current.size >= 2) {
        const [first, second] = [...touchPointersRef.current.values()];
        const distance = Math.hypot(second.x-first.x,second.y-first.y);
        const ratio = pinchRef.current.distance > 0 ? distance / pinchRef.current.distance : 1;
        const requested = pinchRef.current.camera.zoom * ratio;
        const nextZoom = HOME_WORLD_ZOOM_LEVELS.reduce((nearest, candidate) => Math.abs(candidate-requested)<Math.abs(nearest-requested)?candidate:nearest, pinchRef.current.camera.zoom);
        const anchor = { x: (first.x+second.x)/2, y: (first.y+second.y)/2 };
        event.preventDefault();
        onCameraChange(getZoomedHomeWorldCamera(pinchRef.current.camera,nextZoom,anchor,world));
        return;
      }
    }
    const drag = dragRef.current;
    if (!drag || drag.pointerId !== event.pointerId) return;
    const dx=event.clientX-drag.originPointer.x;const dy=event.clientY-drag.originPointer.y;
    drag.moved ||= exceedsSpatialPointerDragThreshold(drag.originPointer, { x: event.clientX, y: event.clientY });
    if (!drag.moved || narrow) return;
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

  useEffect(() => {
    const surface = surfaceRef.current;
    if (!surface || narrow) return undefined;
    surface.addEventListener('wheel', handleWheel, { passive: false });
    return () => surface.removeEventListener('wheel', handleWheel);
  }, [camera, narrow, world]);

  useEffect(()=>{
    if(narrow)return undefined;
    const keydown=(event)=>{
      if(event.target.closest?.('input,textarea,select,[contenteditable="true"]'))return;
      if(event.code==='Space'){event.preventDefault();spaceHeldRef.current=true;setSpaceHeld(true);return;}
      const arrow = {ArrowLeft:{x:-80,y:0},ArrowRight:{x:80,y:0},ArrowUp:{x:0,y:-80},ArrowDown:{x:0,y:80}}[event.key];
      if(arrow){event.preventDefault();onCameraChange(clampHomeWorldCamera({...camera,x:camera.x+arrow.x/camera.zoom,y:camera.y+arrow.y/camera.zoom},world));return;}
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
    touchPointersRef.current.delete(event.pointerId);
    const sharedGesture = narrow ? narrowGestureRef?.current : null;
    if (touchPointersRef.current.size < 2) pinchRef.current = null;
    const result = finalizeSpatialPointer({
      pointerId: event.pointerId,
      pointerType: event.pointerType,
      drag: dragRef.current,
      sharedGesture,
      cancelled
    });
    dragRef.current = result.drag;
    if (result.shouldActivate) onMoveKeeper?.(event.clientX, event.clientY);
  };

  const root = typeof document === 'undefined' ? null : document.querySelector('.application-root');
  const surface = <section
    ref={surfaceRef}
    className="home-world-surface"
    data-desktop-canvas
    data-pannable={!narrow || undefined}
    data-space-held={spaceHeld || undefined}
    data-visible={visible || undefined}
    aria-label="Spatial home world"
    style={worldTheme}
    onPointerDown={handlePointerDown}
    onPointerMove={handlePointerMove}
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
