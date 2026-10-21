/* Independent full-frame WebP playback for the HexWall pool; no video chroma key. */
(function(g){'use strict';if(g.HexElectronicAnimation)return;
const code=(u,o)=>String.fromCharCode(...u.subarray(o,o+4)),u24=(u,o)=>u[o]+u[o+1]*256+u[o+2]*65536;
function parse(buffer){
 const u=new Uint8Array(buffer),v=new DataView(u.buffer,u.byteOffset,u.byteLength);if(u.length<30||code(u,0)!=='RIFF'||code(u,8)!=='WEBP')throw Error('不是有效 WebP 動畫');
 const end=v.getUint32(4,true)+8;if(end>u.length)throw Error('動畫資料不完整');let width=0,height=0,total=0;const frames=[];
 for(let o=12;o+8<=end;){const size=v.getUint32(o+4,true),at=o+8,next=at+size+(size&1);if(next>end)throw Error('動畫區塊不完整');const tag=code(u,o);
  if(tag==='VP8X'){if(size<10)throw Error('缺少動畫尺寸');width=u24(u,at+4)+1;height=u24(u,at+7)+1;}
  if(tag==='ANMF'){
   if(size<24)throw Error('動畫影格不完整');const x=u24(u,at)*2,y=u24(u,at+3)*2,w=u24(u,at+6)+1,h=u24(u,at+9)+1,ms=Math.max(1,u24(u,at+12));
   if(x||y||w!==width||h!==height||!(u[at+15]&2))throw Error('此動畫需使用完整獨立影格');
   const payload=u.subarray(at+16,at+size);let alpha=false,bitstream=false;for(let z=0;z+8<=payload.length;){const n=new DataView(payload.buffer,payload.byteOffset+z+4,4).getUint32(0,true);if(z+8+n+(n&1)>payload.length)throw Error('影格資料不完整');const t=code(payload,z);alpha=alpha||t==='ALPH';bitstream=bitstream||t==='VP8 '||t==='VP8L';z+=8+n+(n&1);}if(!bitstream)throw Error('缺少影格影像');
   frames.push({payload,alpha,start:total,duration:ms});total+=ms;
  }o=next;
 }
 if(!frames.length||!width||!height)throw Error('缺少動畫影格');return {width,height,frames,duration:total};
}
function still(anim,index){const f=anim.frames[index],extra=f.alpha?18:0,u=new Uint8Array(12+extra+f.payload.length),v=new DataView(u.buffer);const put=(o,s)=>{for(let i=0;i<s.length;i++)u[o+i]=s.charCodeAt(i)};put(0,'RIFF');v.setUint32(4,u.length-8,true);put(8,'WEBP');if(extra){put(12,'VP8X');v.setUint32(16,10,true);u[20]=16;for(let i=0;i<3;i++){u[24+i]=((anim.width-1)>>(8*i))&255;u[27+i]=((anim.height-1)>>(8*i))&255;}}u.set(f.payload,12+extra);return new Blob([u],{type:'image/webp'});}
function frameAt(anim,time){const t=((time%anim.duration)+anim.duration)%anim.duration;let lo=0,hi=anim.frames.length-1;while(lo<hi){const m=(lo+hi+1)>>1;if(anim.frames[m].start<=t)lo=m;else hi=m-1;}return lo;}
function angleAtFrame(work,index){if((work.electronicRotation??'center')!=='center')return 0;const turns=Math.max(0,Math.min(6,Number(work.electronicTurns??3))),count=Math.max(1,work.frameCount||240);return -Math.PI*2*turns*(Math.max(0,index)%count)/count;}
const outlineCanvases=new WeakMap();
function outlinedImage(ctx,image,x,y,w,h,enabled){if(enabled){let c=outlineCanvases.get(ctx);if(!c){c=document.createElement('canvas');outlineCanvases.set(ctx,c);}const iw=image.width||320,ih=image.height||283;if(c.width!==iw)c.width=iw;if(c.height!==ih)c.height=ih;const g=c.getContext('2d');g.clearRect(0,0,iw,ih);g.globalCompositeOperation='source-over';g.drawImage(image,0,0,iw,ih);g.globalCompositeOperation='source-in';g.fillStyle='#ff9d33';g.fillRect(0,0,iw,ih);g.globalCompositeOperation='source-over';for(const [dx,dy]of [[-1.4,0],[1.4,0],[0,-1.4],[0,1.4],[-1,-1],[-1,1],[1,-1],[1,1]])ctx.drawImage(c,x+dx,y+dy,w,h);}ctx.drawImage(image,x,y,w,h);}
function paint(ctx,image,mode,options={}){const w=ctx.canvas.width,h=ctx.canvas.height;ctx.clearRect(0,0,w,h);ctx.save();if(mode==='round'){const r=Math.min(w,h)/2-1;ctx.beginPath();ctx.arc(w/2,h/2,r,0,Math.PI*2);ctx.fillStyle='#000';ctx.fill();if(options.outline){ctx.strokeStyle='#ff9d33';ctx.lineWidth=1.5;ctx.stroke();}ctx.clip();const s=(2*r-4)/Math.hypot(w,h),dw=w*s,dh=h*s;outlinedImage(ctx,image,(w-dw)/2,(h-dh)/2,dw,dh,options.outline);}else{if(mode==='framed'){ctx.fillStyle='#000';ctx.fillRect(0,0,w,h);}outlinedImage(ctx,image,0,0,w,h,options.outline);}ctx.restore();}
async function bitmap(blob){if(g.createImageBitmap)try{return await g.createImageBitmap(blob)}catch{}return new Promise((ok,no)=>{const img=new Image(),url=URL.createObjectURL(blob);img.onload=()=>{URL.revokeObjectURL(url);ok(img)};img.onerror=()=>{URL.revokeObjectURL(url);no(Error('動畫影格無法解碼'))};img.src=url;});}
class Player{
 constructor(url,onFrame,onError){this.onFrame=onFrame;this.onError=onError;this.cache=new Map();this.pending=new Map();this.controller=new AbortController();this.dead=false;this.last=-1;this.wanted=0;this.ready=this.load(url);}
 async load(url){try{const r=await fetch(url,{signal:this.controller.signal});if(!r.ok)throw Error('動畫讀取失敗 '+r.status);const data=await r.arrayBuffer();if(this.dead)return;this.anim=parse(data);this.epoch=performance.now();await this.decode(0);if(!this.dead){this.prefetch(0);this.tick(this.epoch);}}catch(e){if(!this.dead){this.failed=true;this.onError?.(e);}}}
 decode(i){if(this.dead)return Promise.resolve(null);if(this.cache.has(i))return Promise.resolve(this.cache.get(i));if(this.pending.has(i))return this.pending.get(i);const p=bitmap(still(this.anim,i)).then(img=>{if(this.dead){img.close?.();return null;}this.cache.set(i,img);return img;}).catch(e=>{if(!this.dead){this.failed=true;this.onError?.(e);}return null;}).finally(()=>this.pending.delete(i));this.pending.set(i,p);return p;}
 prefetch(i){if(!this.anim||this.dead||this.failed)return;const keep=new Set();for(let k=0;k<6;k++)keep.add((i+k)%this.anim.frames.length);for(const [key,img]of this.cache)if(!keep.has(key)){img.close?.();this.cache.delete(key);}for(const k of keep)if(this.pending.size<4)this.decode(k);}
 tick(now){if(!this.anim||this.dead||this.failed)return;const i=frameAt(this.anim,now-this.epoch);this.wanted=i;const image=this.cache.get(i);if(image&&this.last!==i){this.onFrame(image);this.last=i;}this.prefetch(i);}
 invalidate(){this.last=-1;}
 destroy(){this.dead=true;this.controller.abort();for(const img of this.cache.values())img.close?.();this.cache.clear();this.anim=null;this.onFrame=null;}
}
g.HexElectronicAnimation={parse,still,frameAt,paint,angleAtFrame,Player};
})(typeof window==='undefined'?globalThis:window);
