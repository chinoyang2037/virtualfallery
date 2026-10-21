(function(g){'use strict';
const ROOT='/pool/opto-art/',BASE=document.currentScript?.src||g.location.href;let catalogPromise;
async function catalog(){if(!catalogPromise)catalogPromise=fetch(new URL(ROOT+'catalog.json?v=opto-v9',BASE)).then(r=>{if(!r.ok)throw Error('光電藝術 Pool 讀取失敗');return r.json();}).catch(e=>{catalogPromise=null;throw e});return catalogPromise;}
function hydrate(q,data){q.resources=q.resources||{};q.pool=q.pool||[];const list=data.artworks.map(a=>{
 const animated=!!a.animation,key=animated?'electronic-'+a.id:'optical-art-'+a.id,image='asset:'+key;
 q.resources[key]={url:new URL('/'+a.cover.replace(/^\//,''),BASE).href,path:a.cover,kind:'site'};
 const art={...a,id:a.id,image,fileName:a.animation||a.filename,optoArt:true,frame:animated?'none':a.frame||'none',electronicMode:'transparent',electronicGlow:1,electronicRotation:'center',electronicTurns:3,electronicOpacity:.7,electronicOutline:true,desc:a.description||a.desc};
 if(animated){art.electronicId=a.id;art.animation=new URL('/'+a.animation,BASE).href;if(a.video)art.video=new URL('/'+a.video,BASE).href;}else{art.opticalId=a.id;delete art.animation;delete art.video;}
 const found=q.pool.find(x=>x.image===image||x.electronicId===a.id||x.opticalId===a.id);if(found)Object.assign(found,art);else q.pool.push({...art});return art;
 });return list;}
function install(project,data,limit=60){
 const C=g.GeneratorCore;if(!C)throw Error('展廳掛畫工具尚未載入');
 const q=C.clone(project);q.resources=q.resources||{};q.pool=q.pool||[];
 const existing=C.arrange(q).slots;
 for(const a of q.assignments){const s=existing.find(s=>s.artId===a.artId);Object.assign(a,{manualU:s.u,manualWidth:s.imageW,manualY:s.hangY});}
 const artList=hydrate(q,data);
 const scope=q.assignmentScope;q.assignmentScope='all';const report=C.capacity(q,1);
 const options=[];
 for(const f of report.faces.filter(f=>f.used===0&&f.free>0)){
  const w=q.walls.find(w=>w.id===f.wallId);
  f.positions.slice().sort((a,b)=>Math.abs(a-.5)-Math.abs(b-.5)).forEach((u,rank)=>options.push({wallId:f.wallId,side:f.side,u,rank,w}));
 }
 options.sort((a,b)=>a.rank-b.rank||a.wallId.localeCompare(b.wallId)||a.side.localeCompare(b.side));
 const used=new Set(q.artworks.map(a=>a.electronicId||a.opticalId||a.id));let count=0;
 for(const art of artList){if(used.has(art.id))continue;if(count>=Math.min(limit,options.length))break;
  const target=options[count],w=target.w,fw=.05,L=Math.hypot(w.x2-w.x1,w.z2-w.z1),imageW=Math.min(.9,(w.h-.6)*art.aspect,Math.max(.2,L*.8-2*fw));
  const y=Math.max(imageW/art.aspect/2+.3,Math.min(w.centerHeight,w.h-imageW/art.aspect/2-.2));
  q.artworks.push({...art});q.assignments.push({artId:art.id,wallId:w.id,side:target.side,manualU:target.u,manualWidth:imageW,manualY:y});count++;
 }
 q.assignmentScope=scope||'all';C.arrange(q);
 q.electronicPoolVersion='opto-art-160-v1';return {project:q,added:count,poolCount:artList.length,remaining:artList.filter(a=>!q.artworks.some(w=>(w.electronicId||w.opticalId||w.id)===a.id)).length};
}
g.ElectronicArtPool=g.OptoArtPool={catalog,hydrate,install,root:ROOT};
})(window);
