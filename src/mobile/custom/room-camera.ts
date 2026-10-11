import type {HeadPose} from './head-pose';
export type RoomPoint=[number,number,number];
// Shared off-axis projection for the canvas room and DOM artwork planes.
export function roomCamera(w:number,h:number,pose:{x:number;y:number},head?:HeadPose,advance=0){
 const f=Math.max(w*.85,280),cy=h*.46;
 const cameraDistance=f*(head?.tracked?head.distance:1);
 const eye=head?.tracked?{x:head.x*w,y:head.y*w}:{x:-pose.x*w*.28,y:-pose.y*h*.16};
 const project=([x,y,z]:RoomPoint)=>{
  const scale=cameraDistance/(cameraDistance+z-f*advance);
  return {x:w/2+eye.x+(x-eye.x)*scale,y:cy+eye.y+(y-eye.y)*scale,scale};
 };
 return {f,project,halfW:w*.54,halfH:h*.56,nearZ:f*advance-cameraDistance*.95};
}
