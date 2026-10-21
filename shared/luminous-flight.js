/* Deterministic hummingbird itinerary, shared by the exhibition and route checks. */
(function(g){'use strict';
const lerp=(a,b,t)=>a.map((v,i)=>v+(b[i]-v)*t),ease=t=>t*t*(3-2*t);
const RADIUS=32,ART_WIDTH=3.6,VIEW_DISTANCE=6.5;
function placement(i){const group=Math.floor(i/5),y=1-2*(i+.5)/60,a=i*Math.PI*(3-Math.sqrt(5)),r=Math.sqrt(1-y*y),position=[Math.sin(a)*r*RADIUS,y*RADIUS,Math.cos(a)*r*RADIUS];return {position,normal:position.map(v=>-v/RADIUS),yaw:a+Math.PI,group};}
function viewpoint(i){const p=placement(i);return {position:p.position.map((v,k)=>v+p.normal[k]*VIEW_DISTANCE),look:p.position.slice()};}
const overview={position:[0,0,0],look:[0,0,32]};
class Navigation{
 constructor(){this.position=[0,0,0];this.yaw=0;this.pitch=0;this.velocity=0;}
 adopt(pose){this.position=pose.position.slice();const d=pose.look.map((v,i)=>v-this.position[i]),length=Math.hypot(...d)||1;this.yaw=Math.atan2(-d[0],-d[2]);this.pitch=Math.asin(Math.max(-1,Math.min(1,d[1]/length)));this.velocity=0;this.contain();return this.pose();}
 contain(){const length=Math.hypot(...this.position),limit=RADIUS-2;if(length>limit)this.position=this.position.map(v=>v*limit/length);}
 drag(dx,dy){this.yaw-=dx*.004;this.pitch=Math.max(-1.48,Math.min(1.48,this.pitch-dy*.004));}
 wheel(delta){this.velocity=Math.max(-24,Math.min(24,this.velocity+delta));}
 pose(){const cp=Math.cos(this.pitch),forward=[-Math.sin(this.yaw)*cp,Math.sin(this.pitch),-Math.cos(this.yaw)*cp];return {position:this.position.slice(),look:this.position.map((v,i)=>v+forward[i]*5)};}
 tick(dt,keys={}){dt=Math.max(0,Math.min(.1,dt));const cp=Math.cos(this.pitch),forward=[-Math.sin(this.yaw)*cp,Math.sin(this.pitch),-Math.cos(this.yaw)*cp],right=[Math.cos(this.yaw),0,-Math.sin(this.yaw)],f=(keys.KeyW?1:0)-(keys.KeyS?1:0),r=(keys.KeyD?1:0)-(keys.KeyA?1:0),up=(keys.KeyR?1:0)-(keys.KeyF?1:0),n=Math.max(1,Math.hypot(f,r,up));
 for(let i=0;i<3;i++)this.position[i]+=((forward[i]*f+right[i]*r+(i===1?up:0))*8/n+forward[i]*this.velocity)*dt;
 this.velocity*=Math.exp(-4*dt);this.contain();return this.pose();}
}
class Tour{
 constructor(count=60){this.count=count;this.order='step';this.bag=[];this.visited=0;this.index=0;this.paused=true;this.phase='overview';this.elapsed=0;this.pose={position:overview.position.slice(),look:overview.look.slice()};}
 setOrder(order){this.order=order;this.bag=[];this.visited=0;}
 nextRandom(){if(!this.bag.length){this.bag=Array.from({length:this.count},(_,i)=>i);for(let i=this.bag.length-1;i>0;i--){const j=Math.floor(Math.random()*(i+1));[this.bag[i],this.bag[j]]=[this.bag[j],this.bag[i]];}if(this.count>1&&this.bag[this.bag.length-1]===this.index)[this.bag[0],this.bag[this.bag.length-1]]=[this.bag[this.bag.length-1],this.bag[0]];}this.visited++;return this.bag.pop();}
 start(){this.paused=false;if(this.phase==='overview')this.go(this.order==='random'?this.nextRandom():this.index);}
 go(index){this.index=(index%this.count+this.count)%this.count;this.from={position:this.pose.position.slice(),look:this.pose.look.slice()};this.to=viewpoint(this.index);this.elapsed=0;this.phase='flight';}
 overview(){this.from={position:this.pose.position.slice(),look:this.pose.look.slice()};this.to=overview;this.elapsed=0;this.phase='return';}
 tick(dt){if(this.paused)return this.pose;dt=Math.max(0,Math.min(dt,.1));this.elapsed+=dt;
  if(this.phase==='flight'||this.phase==='return'){const t=Math.min(1,this.elapsed/3),u=ease(t);this.pose.position=lerp(this.from.position,this.to.position,u);this.pose.position[1]+=Math.sin(Math.PI*t)*.65;this.pose.look=lerp(this.from.look,this.to.look,u);if(t===1){this.phase=this.phase==='return'?'overview':'view';this.elapsed=0;}}
  else if(this.phase==='view'){const v=viewpoint(this.index),t=this.elapsed,fade=Math.min(1,t/.8),p=placement(this.index);this.pose.position=v.position.map((x,k)=>x+(k===0?Math.cos(p.yaw)*Math.sin(t*.5)*.10*fade:k===1?Math.sin(t*.8)*.045*fade:-Math.sin(p.yaw)*Math.sin(t*.5)*.10*fade));this.pose.look=v.look;if(t>=12){if(this.order==='random'){if(this.visited>=this.count){this.visited=0;this.overview();}else this.go(this.nextRandom());}else if(this.index===this.count-1){this.index=0;this.overview();}else this.go(this.index+1);}}
  else if(this.phase==='overview'&&this.elapsed>=4)this.go(this.order==='random'?this.nextRandom():this.index);
  return this.pose;
 }
}
g.LuminousFlight={placement,viewpoint,overview,Tour,Navigation,RADIUS,ART_WIDTH,VIEW_DISTANCE};
})(typeof window==='undefined'?globalThis:window);
