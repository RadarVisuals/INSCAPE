export type FaceSample={x:number;y:number;span:number};
export type HeadPose={x:number;y:number;distance:number;tracked:boolean};
const clamp=(n:number,a:number,b:number)=>Math.max(a,Math.min(b,n));
// Eye separation provides relative distance; webcam x is opposite the viewer's x.
// Values are screen-width fractions, using an approximate 32 cm laptop display.
export function estimateHeadPose(face:FaceSample,base:FaceSample):HeadPose{
 const span=Math.max(.025,face.span);
 return {x:clamp(-(face.x-base.x)/span*.063/.32,-.55,.55),y:clamp((face.y-base.y)/span*.063/.32,-.4,.4),distance:clamp(base.span/span,.6,1.7),tracked:true};
}
