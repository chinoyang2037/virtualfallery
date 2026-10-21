(function(g){'use strict';
const BASE=new URL('/pool/paintings/',document.currentScript?.src||g.location.href).href;
let pending;
function catalog(){return pending||(pending=fetch(BASE+'catalog.json?v=watercolor18names-20261021').then(r=>{if(!r.ok)throw Error('圖畫Pool載入失敗');return r.json();}).then(data=>({...data,items:data.items.map(a=>({...a,poolBase:BASE}))})).catch(e=>{pending=null;throw e}));}
function install(project,data){const p=g.GeneratorCore.clone(project);p.resources=p.resources||{};p.pool=p.pool||[];let added=0;
const absolute=url=>{try{return new URL(url,BASE).href}catch{return ''}};
for(const item of data.items){
 const itemBase=item.poolBase||(/^watercolor-\d+$/.test(data.id||'')?new URL(data.id+'/',BASE).href:BASE);
 const url=new URL(item.image,itemBase).href;
 const sharedPath=new URL(url).pathname;
 let key=Object.keys(p.resources).find(k=>{const existing=p.resources[k].url;if(!existing)return false;const resolved=absolute(existing);return resolved===url||(/^\/(?:assets|pool\/paintings)\//.test(sharedPath)&&new URL(resolved).pathname===sharedPath);});
 if(!key){key='watercolor-'+item.id;p.resources[key]={url,path:new URL(url).pathname.replace(/^\//,''),kind:'site',category:'watercolor'};}
 const image='asset:'+key,known=p.pool.find(a=>a.canonicalId===item.id||a.watercolorId===item.id||a.image===image);
 if(known){known.canonicalId=item.id;known.collections=item.collections;known.category='watercolor';}
 else{p.pool.push({...item,canonicalId:item.id,watercolorId:item.id,image,category:'watercolor'});added++;}
}
p.watercolorPoolVersion='20261021-238';return {project:p,added,total:data.items.length};}
g.WatercolorArtPool={catalog,install,base:BASE};
})(typeof window!=='undefined'?window:globalThis);
