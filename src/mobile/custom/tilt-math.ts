export type Angles={beta:number;gamma:number};
export const clampTilt=(n:number)=>Math.max(-1,Math.min(1,n));
const shortestAngle=(n:number)=>(n+540)%360-180;
export function orientationTilt(reading:Angles,baseline:Angles,screenAngle:number){
 const dx=shortestAngle(reading.gamma-baseline.gamma)/22;
 const dy=shortestAngle(reading.beta-baseline.beta)/22;
 const angle=screenAngle*Math.PI/180;
 return {x:clampTilt(dx*Math.cos(angle)+dy*Math.sin(angle)),y:clampTilt(dy*Math.cos(angle)-dx*Math.sin(angle))};
}
export function gravityAngles(g:{x:number|null;y:number|null;z:number|null}|null):Angles|null{
 if(!g||g.x===null||g.y===null||g.z===null||![g.x,g.y,g.z].every(Number.isFinite)||Math.hypot(g.x,g.y,g.z)<.1)return null;
 return {gamma:Math.atan2(g.x,Math.hypot(g.y,g.z))*180/Math.PI,beta:Math.atan2(g.y,g.z)*180/Math.PI};
}
