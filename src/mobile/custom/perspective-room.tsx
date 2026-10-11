"use client";
import {useEffect,useRef,type RefObject} from 'react';
import type {HeadPose} from './head-pose';
import {roomCamera} from './room-camera';
type Pose={x:number;y:number};
type Point=[number,number,number];

/** A fixed window plane with an off-axis camera and a gridded room. */
export function PerspectiveRoom({active,pose,light=false,head,depthRatio=.70,backWallGrid=true,advance}:{active:boolean;pose:RefObject<Pose>;light?:boolean;head?:RefObject<HeadPose>;depthRatio?:number;backWallGrid?:boolean;advance?:RefObject<number>}){
 const canvasRef=useRef<HTMLCanvasElement>(null);
 useEffect(()=>{
  const canvas=canvasRef.current;
  if(!canvas||!active)return;
  const ctx=canvas.getContext('2d');if(!ctx)return;
  const host=canvas.closest('.intro');if(!host)return;
  let frame=0;
  const draw=()=>{
   frame=0;
   // Render at layout resolution even while a parent is flying through the eye.
   const w=canvas.clientWidth,h=canvas.clientHeight;if(w<1||h<1)return;
   const dpr=Math.min(window.devicePixelRatio||1,2);
   if(canvas.width!==Math.round(w*dpr)||canvas.height!==Math.round(h*dpr)){canvas.width=Math.round(w*dpr);canvas.height=Math.round(h*dpr)}
   ctx.setTransform(dpr,0,0,dpr,0,0);ctx.clearRect(0,0,w,h);
   const {f,project,halfW,halfH,nearZ}=roomCamera(w,h,pose.current,head?.current,advance?.current??0),depth=f*depthRatio;
   const line=(points:Point[],alpha=.2,width=.75)=>{
    ctx.beginPath();
    if(!advance?.current)points.forEach((p,i)=>{const s=project(p);if(i)ctx.lineTo(s.x,s.y);else ctx.moveTo(s.x,s.y)});
    else for(let i=1;i<points.length;i++){
     let a=points[i-1],b=points[i];if(a[2]<nearZ&&b[2]<nearZ)continue;
     const clip=(p:Point,q:Point):Point=>{const t=(nearZ-p[2])/(q[2]-p[2]);return [p[0]+(q[0]-p[0])*t,p[1]+(q[1]-p[1])*t,nearZ]};
     if(a[2]<nearZ)a=clip(a,b);if(b[2]<nearZ)b=clip(b,a);
     const start=project(a),end=project(b);ctx.moveTo(start.x,start.y);ctx.lineTo(end.x,end.y);
    }
    ctx.strokeStyle=`rgba(${light?'52,57,52':'208,212,199'},${alpha})`;ctx.lineWidth=width;ctx.stroke();
   };
   // Depth ribs on all four walls, close to the supplied one-point grid.
   for(let i=0;i<=10;i++){
    const z=depth*i/10;
    line([[-halfW,-halfH,z],[halfW,-halfH,z],[halfW,halfH,z],[-halfW,halfH,z],[-halfW,-halfH,z]],i===10?.32:.18);
   }
   for(let i=0;i<=10;i++){
    const x=-halfW+2*halfW*i/10;
    if(backWallGrid)line([[x,-halfH,0],[x,-halfH,depth],[x,halfH,depth],[x,halfH,0]],.19);
    else {line([[x,-halfH,0],[x,-halfH,depth]],.19);line([[x,halfH,depth],[x,halfH,0]],.19)}
   }
   for(let i=0;i<=10;i++){
    const y=-halfH+2*halfH*i/10;
    if(backWallGrid)line([[-halfW,y,0],[-halfW,y,depth],[halfW,y,depth],[halfW,y,0]],.19);
    else {line([[-halfW,y,0],[-halfW,y,depth]],.19);line([[halfW,y,depth],[halfW,y,0]],.19)}
   }
  };
  const schedule=()=>{if(!frame)frame=requestAnimationFrame(draw)};
  const observer=new ResizeObserver(schedule);observer.observe(canvas);
  host.addEventListener('inscape-tilt',schedule);if(advance)host.addEventListener('inscape-room-view',schedule);schedule();
  return()=>{cancelAnimationFrame(frame);observer.disconnect();host.removeEventListener('inscape-tilt',schedule);host.removeEventListener('inscape-room-view',schedule)};
 },[active,pose,light,head,depthRatio,backWallGrid,advance]);
 return <canvas ref={canvasRef} className="intro-grid" aria-hidden="true"/>;
}
