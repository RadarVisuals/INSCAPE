import { useCallback, useEffect, useRef, useState } from 'react';
import './gridToWorldPrototype.css';

const ASSET_URL='/assets/prototype/gridmountains.webp';
const LANDSCAPE_REPEATS=3;
const clamp=(value,min=0,max=1)=>Math.max(min,Math.min(max,value));
const mix=(from,to,amount)=>from+(to-from)*amount;
const smooth=(from,to,value)=>{const amount=clamp((value-from)/(to-from));return amount*amount*(3-2*amount)};
const modulo=(value,size)=>((value%size)+size)%size;

function extractSkyline(image,size=520){
  const canvas=document.createElement('canvas');canvas.width=size;canvas.height=size;
  const context=canvas.getContext('2d',{willReadFrequently:true});context.clearRect(0,0,size,size);context.drawImage(image,0,0,size,size);
  const pixels=context.getImageData(0,0,size,size).data;const skyline=new Float32Array(size);
  for(let x=0;x<size;x+=1){let top=size-1;for(let y=0;y<size;y+=1){if(pixels[(y*size+x)*4+3]>24){top=y;break}}skyline[x]=top/(size-1)}
  return skyline;
}

function TransitionCanvas({progress,snapStrength,gridOpacity,moving,scrollSpeed,onReady}){
  const canvasRef=useRef(null);const imageRef=useRef(null);const skylineRef=useRef(null);const drawRef=useRef(null);const onReadyRef=useRef(onReady);const offsetRef=useRef(0);const progressRef=useRef(progress);onReadyRef.current=onReady;progressRef.current=progress;
  const draw=useCallback(()=>{
    const canvas=canvasRef.current;const image=imageRef.current;const skyline=skylineRef.current;if(!canvas||!image||!skyline)return;
    const rect=canvas.getBoundingClientRect();const ratio=Math.min(2,window.devicePixelRatio||1);const width=Math.max(1,Math.round(rect.width));const height=Math.max(1,Math.round(rect.height));
    if(canvas.width!==Math.round(width*ratio)||canvas.height!==Math.round(height*ratio)){canvas.width=Math.round(width*ratio);canvas.height=Math.round(height*ratio)}
    const context=canvas.getContext('2d');context.setTransform(ratio,0,0,ratio,0,0);context.clearRect(0,0,width,height);context.fillStyle='#050606';context.fillRect(0,0,width,height);
    const eased=smooth(0,1,progress);const seam=mix(width*.72,0,smooth(.08,1,eased));const panelWidth=width;const trackWidth=panelWidth*LANDSCAPE_REPEATS;const travel=offsetRef.current;
    const skylineAt=(x)=>{const worldX=modulo(x-seam+travel,trackWidth);const panel=Math.min(LANDSCAPE_REPEATS-1,Math.floor(worldX/panelWidth));let local=(worldX-panel*panelWidth)/panelWidth;if(panel%2===1)local=1-local;const index=Math.min(skyline.length-1,Math.round(local*(skyline.length-1)));return skyline[index]*height};
    const drawLandscape=()=>{const trackX=seam-modulo(travel,trackWidth);for(let cycle=-1;cycle<=1;cycle+=1){for(let panel=0;panel<LANDSCAPE_REPEATS;panel+=1){const x=trackX+cycle*trackWidth+panel*panelWidth;if(x>=width||x+panelWidth<=0)continue;if(panel%2===1){context.save();context.translate(x+panelWidth,0);context.scale(-1,1);context.drawImage(image,0,0,panelWidth,height);context.restore()}else context.drawImage(image,x,0,panelWidth,height)}}};

    const gridPresence=1-smooth(.7,1,eased);context.lineWidth=1;context.strokeStyle=`rgba(225,229,224,${gridOpacity*gridPresence})`;
    for(let x=0;x<=width;x+=40){context.beginPath();context.moveTo(x,0);context.lineTo(x,height);context.stroke()}
    for(let y=0;y<=height;y+=40){
      const terrainAmount=clamp(y/height);context.beginPath();
      for(let x=0;x<=width;x+=7){const across=clamp((x-seam)/Math.max(1,width-seam));const wave=smooth(across*.72,Math.min(1,across*.72+.32),eased);const target=skylineAt(x)+terrainAmount*(height-skylineAt(x));const influence=wave*snapStrength*smooth(seam,seam+150,x);const nextY=mix(y,target,influence);if(x===0)context.moveTo(x,nextY);else context.lineTo(x,nextY)}
      context.globalAlpha=gridPresence*(1-smooth(.58,1,eased)*clamp((y-height*.12)/(height*.88)));context.stroke();context.globalAlpha=1;
    }

    if(progress>.12){const reveal=smooth(.12,.9,progress);const revealLeft=Math.max(0,seam-2);const revealRight=mix(Math.max(0,seam),width,reveal);context.save();context.beginPath();context.rect(revealLeft,0,Math.max(0,revealRight-revealLeft),height);context.clip();context.globalAlpha=smooth(.2,.78,progress);context.shadowColor='rgba(158,92,255,.58)';context.shadowBlur=9*(1-smooth(.7,1,progress));drawLandscape();context.restore()}

    context.strokeStyle=`rgba(238,235,223,${.16*(1-smooth(.6,1,progress))})`;context.lineWidth=1;context.strokeRect(.5,.5,width-1,height-1);
  },[gridOpacity,progress,snapStrength]);
  drawRef.current=draw;

  useEffect(()=>{const image=new Image();image.decoding='async';image.onload=()=>{imageRef.current=image;skylineRef.current=extractSkyline(image);onReadyRef.current?.();drawRef.current?.()};image.src=ASSET_URL;return()=>{image.onload=null}},[]);
  useEffect(()=>{const observer=new ResizeObserver(()=>drawRef.current?.());if(canvasRef.current)observer.observe(canvasRef.current);return()=>observer.disconnect()},[]);
  useEffect(()=>{draw()},[draw]);
  useEffect(()=>{if(progress<=.001){offsetRef.current=0;drawRef.current?.()}},[progress]);
  useEffect(()=>{if(!moving)return undefined;let frame=0;let previous=performance.now();const tick=(now)=>{const delta=Math.min(40,now-previous);previous=now;if(progressRef.current>=.999)offsetRef.current+=delta/1000*scrollSpeed;drawRef.current?.();frame=requestAnimationFrame(tick)};frame=requestAnimationFrame(tick);return()=>cancelAnimationFrame(frame)},[moving,scrollSpeed]);
  return <canvas ref={canvasRef} className="grid-world-study__canvas" aria-label="Grid resolving into mountain line art"/>;
}

export default function GridToWorldPrototype(){
  const [progress,setProgress]=useState(()=>{const requested=Number(new URLSearchParams(window.location.search).get('progress'));return Number.isFinite(requested)?clamp(requested):0});const [playing,setPlaying]=useState(false);const [direction,setDirection]=useState(1);const [duration,setDuration]=useState(2600);const [snapStrength,setSnapStrength]=useState(.92);const [gridOpacity,setGridOpacity]=useState(.17);const [scrollSpeed,setScrollSpeed]=useState(140);const [worldMoving,setWorldMoving]=useState(false);const [ready,setReady]=useState(false);const frameRef=useRef(0);const progressRef=useRef(progress);const enterButtonRef=useRef(null);const returnButtonRef=useRef(null);const enterActionRef=useRef(null);const returnActionRef=useRef(null);progressRef.current=progress;
  const enterWorld=()=>{if(progress>=.999){setWorldMoving((value)=>!value);return}setDirection(1);setWorldMoving(true);setPlaying(true)};
  const returnToGrid=()=>{setDirection(-1);setWorldMoving(false);setPlaying(true)};
  enterActionRef.current=enterWorld;returnActionRef.current=returnToGrid;
  useEffect(()=>{const enter=enterButtonRef.current;const back=returnButtonRef.current;const enterPointer=()=>enterActionRef.current?.();const backPointer=()=>returnActionRef.current?.();const keyboardClick=(action)=>(event)=>{if(event.detail===0)action.current?.()};const enterKey=keyboardClick(enterActionRef);const backKey=keyboardClick(returnActionRef);enter?.addEventListener('pointerdown',enterPointer);back?.addEventListener('pointerdown',backPointer);enter?.addEventListener('click',enterKey);back?.addEventListener('click',backKey);return()=>{enter?.removeEventListener('pointerdown',enterPointer);back?.removeEventListener('pointerdown',backPointer);enter?.removeEventListener('click',enterKey);back?.removeEventListener('click',backKey)}},[]);
  useEffect(()=>{if(!playing)return undefined;let previous=performance.now();const step=(now)=>{const delta=(now-previous)/duration*direction;previous=now;const next=clamp(progressRef.current+delta);progressRef.current=next;setProgress(next);if(next===0||next===1){setPlaying(false);return}frameRef.current=requestAnimationFrame(step)};frameRef.current=requestAnimationFrame(step);return()=>cancelAnimationFrame(frameRef.current)},[direction,duration,playing]);
  const eased=smooth(0,1,progress);const keeperLeft=`${mix(65,24,smooth(.18,1,eased))}%`;
  const style={'--study-progress':progress,'--study-keeper-left':keeperLeft};
  return <main className="grid-world-study" style={style}>
    <TransitionCanvas progress={progress} snapStrength={snapStrength} gridOpacity={gridOpacity} moving={worldMoving} scrollSpeed={scrollSpeed} onReady={()=>setReady(true)}/>
    <div className="grid-world-study__keeper-proxy" aria-hidden="true"><span/></div>
    <header className="grid-world-study__header"><strong>GRID / WORLD THRESHOLD</strong><span>{ready?'ALPHA FIELD ACQUIRED':'READING LINE ART'}</span></header>
    <button className="grid-world-study__exit" type="button" onClick={()=>window.history.back()}>[ EXIT STUDY ]</button>
    <section className="grid-world-study__controls" aria-label="Transition controls">
      <header><strong>TRANSITION FIELD</strong><output>{Math.round(progress*100)}%</output></header>
      <input aria-label="Transition progress" type="range" min="0" max="1" step="0.001" value={progress} onChange={(event)=>{const next=Number(event.target.value);setPlaying(false);setWorldMoving(false);setProgress(next)}}/>
      <div className="grid-world-study__actions"><button ref={enterButtonRef} type="button" disabled={!ready||playing}>{progress>=.999?(worldMoving?'PAUSE TRAVEL':'MOVE RIGHT'):'ENTER WORLD'}</button><button ref={returnButtonRef} type="button" disabled={!ready||playing||progress===0}>RETURN TO GRID</button></div>
      <label><span>SNAP</span><output>{Math.round(snapStrength*100)}%</output><input type="range" min="0" max="1" step=".01" value={snapStrength} onChange={(event)=>setSnapStrength(Number(event.target.value))}/></label>
      <label><span>DURATION</span><output>{duration}ms</output><input type="range" min="800" max="5000" step="100" value={duration} onChange={(event)=>setDuration(Number(event.target.value))}/></label>
      <label><span>TRAVEL</span><output>{scrollSpeed}px/s</output><input type="range" min="30" max="360" step="5" value={scrollSpeed} onChange={(event)=>setScrollSpeed(Number(event.target.value))}/></label>
      <label><span>GRID</span><output>{Math.round(gridOpacity*100)}%</output><input type="range" min=".04" max=".35" step=".01" value={gridOpacity} onChange={(event)=>setGridOpacity(Number(event.target.value))}/></label>
    </section>
    <footer className="grid-world-study__legend"><span>INTERIOR / VERTICAL GRID</span><i/><span>EXTERIOR / FORWARD RIGHT</span></footer>
  </main>
}
