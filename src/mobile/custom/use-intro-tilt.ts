"use client";
import {useCallback,useEffect,useRef,useState,type PointerEvent,type RefObject} from 'react';
import {clampTilt,orientationTilt,gravityAngles,type Angles} from './tilt-math';

type PermissionSensor={requestPermission?:()=>Promise<'granted'|'denied'>};
type MotionStatus='idle'|'requesting'|'waiting'|'active'|'denied'|'unavailable'|'unsupported'|'insecure';
const messages:Record<MotionStatus,string>={
 idle:'',requesting:'Allow motion access when your browser asks.',waiting:'Move your phone slightly to connect tilt.',active:'Tilt your phone. Dragging also works.',
 denied:'Motion access was not allowed. Open this page in Safari and enable phone tilt there. You can still drag the artwork.',
 unavailable:'No phone motion received. If you’re viewing inside an app, open this page directly in Safari and enable phone tilt. Dragging still works.',
 unsupported:'This browser does not provide phone motion here. Open this page directly in Safari, or drag the artwork.',
 insecure:'Phone tilt requires a secure HTTPS connection. This preview uses HTTP. Dragging still works.'
};

export function useIntroTilt(active:boolean,interactionSurface?:RefObject<HTMLElement|null>){
 const ref=useRef<HTMLElement>(null);
 const target=useRef({x:0,y:0});
 const current=useRef({x:0,y:0});
 const frame=useRef(0);
 const baseline=useRef<Angles|null>(null);
 const reduced=useRef(false);
 const activeRef=useRef(active);
 const sensorSeen=useRef(false);
 const requestPending=useRef(false);
 const requestId=useRef(0);
 const dragging=useRef(false);
 const [motion,setMotion]=useState(false);
 const [canUseMotion,setCanUseMotion]=useState(false);
 const [status,setStatus]=useState<MotionStatus>('idle');
 activeRef.current=active;
 const paint=useCallback(()=>{
  if(!ref.current)return;
  const {x,y}=current.current;
  ref.current.style.setProperty('--tilt-x',x.toFixed(4));
  ref.current.style.setProperty('--tilt-y',y.toFixed(4));
  ref.current.dispatchEvent(new Event('inscape-tilt'));
 },[]);
 const stop=useCallback(()=>{cancelAnimationFrame(frame.current);frame.current=0;target.current={x:0,y:0};current.current={x:0,y:0};paint()},[paint]);
 const aim=useCallback((x:number,y:number)=>{
  if(reduced.current||!activeRef.current)return;
  target.current={x:clampTilt(x),y:clampTilt(y)};
  if(frame.current)return;
  const tick=()=>{
   const c=current.current,t=target.current;
   c.x+=(t.x-c.x)*.12;c.y+=(t.y-c.y)*.12;paint();
   if(Math.abs(t.x-c.x)+Math.abs(t.y-c.y)>.001)frame.current=requestAnimationFrame(tick);
   else {current.current={...t};paint();frame.current=0;}
  };
  frame.current=requestAnimationFrame(tick);
 },[paint]);
 useEffect(()=>{
  const preference=matchMedia('(prefers-reduced-motion: reduce)');
  const sync=()=>{reduced.current=preference.matches;setCanUseMotion(!preference.matches&&(navigator.maxTouchPoints>0||matchMedia('(any-pointer: coarse)').matches));if(preference.matches){requestId.current++;requestPending.current=false;stop();setMotion(false);setStatus('idle')}};
  sync();preference.addEventListener('change',sync);
  return()=>{preference.removeEventListener('change',sync);requestId.current++;stop()};
 },[stop]);
 useEffect(()=>{baseline.current=null;dragging.current=false;if(!active){requestId.current++;requestPending.current=false;setStatus(s=>s==='requesting'?'idle':s);stop()}return stop},[active,stop]);
 useEffect(()=>{
  if(!active||!motion)return;
  sensorSeen.current=false;baseline.current=null;setStatus('waiting');
  let sensorSource='';let lastOrientation=0;
  const apply=(angles:Angles,source:string)=>{
   if(document.hidden||dragging.current)return;
   if(!sensorSeen.current){sensorSeen.current=true;setStatus('active')}
   if(source!==sensorSource){baseline.current=null;sensorSource=source}
   if(!baseline.current)baseline.current=angles;
   const legacy=(window as Window & {orientation?:number}).orientation;
   const screenAngle=screen.orientation?.angle??(typeof legacy==='number'?legacy:0);
   const next=orientationTilt(angles,baseline.current,screenAngle);
   aim(next.x,next.y);
  };
  const orientation=(e:DeviceOrientationEvent)=>{
   if(e.beta===null||e.gamma===null||!Number.isFinite(e.beta)||!Number.isFinite(e.gamma))return;
   lastOrientation=Date.now();apply({beta:e.beta,gamma:e.gamma},'orientation');
  };
  const gravity=(e:DeviceMotionEvent)=>{
   if(Date.now()-lastOrientation<1200)return;
   const angles=gravityAngles(e.accelerationIncludingGravity);
   if(angles)apply(angles,'gravity');
  };
  const reset=()=>{baseline.current=null;stop()};
  // Some mobile browsers delay their first reading after the permission prompt.
  const unavailable=setTimeout(()=>{if(!sensorSeen.current){setMotion(false);setStatus('unavailable')}},12000);
  window.addEventListener('deviceorientation',orientation);window.addEventListener('devicemotion',gravity);window.addEventListener('orientationchange',reset);document.addEventListener('visibilitychange',reset);
  return()=>{clearTimeout(unavailable);window.removeEventListener('deviceorientation',orientation);window.removeEventListener('devicemotion',gravity);window.removeEventListener('orientationchange',reset);document.removeEventListener('visibilitychange',reset);stop()};
 },[active,motion,aim,stop]);
 async function toggleMotion(){
  if(requestPending.current)return;
  if(motion){setMotion(false);setStatus('idle');stop();return;}
  if(reduced.current)return;
  const orientation=window.DeviceOrientationEvent as PermissionSensor|undefined;
  const gravity=window.DeviceMotionEvent as PermissionSensor|undefined;
  const available=[orientation,gravity].filter((s):s is PermissionSensor=>!!s);
  if(!window.isSecureContext){setStatus('insecure');return}
  if(available.length===0){setStatus('unsupported');return}
  requestPending.current=true;const id=++requestId.current;setStatus('requesting');
  try{
   // Invoke both native requests within this tap, before awaiting either one.
   // A denial is respected; only browser-approved sensor events are consumed.
   const requests=available.map(sensor=>{try{return sensor.requestPermission?sensor.requestPermission():Promise.resolve('granted' as const)}catch(e){return Promise.reject(e)}});
   const results=await Promise.allSettled(requests);
   if(id!==requestId.current||!activeRef.current||reduced.current)return;
   if(!results.some(r=>r.status==='fulfilled'&&r.value==='granted')){setStatus(results.some(r=>r.status==='fulfilled'&&r.value==='denied')?'denied':'unavailable');return}
   baseline.current=null;setStatus('waiting');setMotion(true);
  }finally{if(id===requestId.current)requestPending.current=false}
 }
 const pointerMove=useCallback((e:PointerEvent<HTMLElement>|globalThis.PointerEvent)=>{
  if(reduced.current||!active)return;
  if(e.pointerType!=='mouse'&&e.target instanceof Element&&e.target.closest('button,a'))return;
  if(motion&&e.pointerType==='mouse')return;
  dragging.current=e.pointerType!=='mouse';
  const surface=interactionSurface?.current??e.currentTarget as HTMLElement;
  const r=surface.getBoundingClientRect();
  if(r.width<=0||r.height<=0)return;
  aim((e.clientX-r.left)/r.width*2-1,(e.clientY-r.top)/r.height*2-1);
 },[active,motion,aim,interactionSurface]);
 // The stationary card receives input on both faces, including during rotation.
 // The artwork remains the render host; its transformed bounds never drive tilt.
 useEffect(()=>{
  const surface=interactionSurface?.current;
  if(!active||!surface)return;
  const releasePointer=()=>{dragging.current=false};
  surface.addEventListener('pointermove',pointerMove);
  surface.addEventListener('pointerup',releasePointer);
  surface.addEventListener('pointercancel',releasePointer);
  surface.addEventListener('pointerleave',releasePointer);
  return()=>{
   surface.removeEventListener('pointermove',pointerMove);
   surface.removeEventListener('pointerup',releasePointer);
   surface.removeEventListener('pointercancel',releasePointer);
   surface.removeEventListener('pointerleave',releasePointer);
   releasePointer();
  };
 },[active,interactionSurface,pointerMove]);
 function release(preservePose=false){dragging.current=false;if(preservePose)return;if(motion)baseline.current=null;aim(0,0)}
 const buttonLabel=status==='requesting'?'Allow motion access':status==='waiting'?'Connecting phone tilt…':status==='active'?'Phone tilt on':status==='idle'?'Enable phone tilt':'Try phone tilt again';
 return {ref,pose:current,motion,canUseMotion,hint:messages[status],status,buttonLabel,toggleMotion,pointerMove,release};
}
