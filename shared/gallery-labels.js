(function(g){'use strict';
const cache=new Map();
function target(e){return !!e}
function project(html){const doc=new DOMParser().parseFromString(html,'text/html'),el=doc.getElementById('generator-project')||doc.getElementById('gallery-data');return el?JSON.parse(el.textContent):null}
function count(p){
 if(!Array.isArray(p?.artworks))return null;
 let slots=p.slots;
 if(g.GeneratorCore&&Array.isArray(p.assignments)&&Array.isArray(p.walls))slots=g.GeneratorCore.arrange(p).slots;
 const works=new Map(p.artworks.map(a=>[a.id,a]));
 const hung=Array.isArray(slots)?slots.map(s=>works.get(s.artId)).filter(Boolean):Array.isArray(p.assignments)?p.assignments.filter(a=>!Array.isArray(p.walls)||p.walls.some(w=>w.id===a.wallId)).map(a=>works.get(a.artId)).filter(Boolean):p.artworks;
 let original=0,opto=0;for(const a of hung){const res=p.resources?.[String(a.image||'').replace(/^asset:/,'')];if(a.electronicId||a.opticalId||/optical|electronic|opto/i.test([a.category,a.image,res?.category,res?.url].filter(Boolean).join(' ')))opto++;else original++}
 return {original,opto,total:original+opto};
}
function legacyCounts(html){
 const marker=/window\.GALLERY_EMBED\s*=\s*/.exec(html);if(!marker)return null;
 const rest=html.slice(marker.index+marker[0].length);let depth=0,quoted=false,escaped=false,end=-1;
 for(let i=0;i<rest.length;i++){const ch=rest[i];if(quoted){if(escaped)escaped=false;else if(ch==='\\')escaped=true;else if(ch==='"')quoted=false;continue}if(ch==='"'){quoted=true;continue}if(ch==='{')depth++;if(ch==='}'&&--depth===0){end=i+1;break}}
 if(end<0)return null;const embed=JSON.parse(rest.slice(0,end));return {original:Object.keys(embed).length,opto:0,total:Object.keys(embed).length};
}
function htmlCounts(html){const p=project(html);return p?count(p):legacyCounts(html)}
function mergeDefault(saved,published){return saved.added||saved.randomized?saved:{...published,...(saved.customName?{customName:saved.customName}: {}),...(typeof saved.hidden==='boolean'?{hidden:saved.hidden}: {})}}
function base(e){const n=e.galleryOriginalName||e.name||'';if(e.customName)return e.customName;if(e.galleryBaseName)return e.galleryBaseName;
 if(/luminous/i.test(n)||e.id==='luminous-constellations')return 'Luminous Constellations｜光之星群';
 if(/hex\s*18\b/i.test(n))return 'Hex 光影展廳';
 if(/hex.*v1\.6/i.test(n))return 'Hex 星空展廳';
 if(/hex.*(?:掛畫與燈光|v1\.5)/i.test(n))return 'Hex 六角展廳';
 if(e.id==='hex-electronic-hosted')return 'Hex 原畫與光電展廳';
 return /^hex/i.test(n)?'Hex 六角展廳':n;
}
function visibleEntries(entries){return entries.filter(e=>e.hidden!==true)}
function title(e){const c=e.artworkCounts;if(!c)return e.name;const parts=[];if(c.original)parts.push(c.original+' 幅原畫');if(c.opto)parts.push(c.opto+' 件光電藝術');return base(e)+'｜'+(parts.join('＋')||'0 件作品')}
async function prepare(entries){await Promise.all(entries.filter(target).map(async e=>{try{
 let counts;if(e.html||e.editorHtml)counts=htmlCounts(e.editorHtml||e.html)||e.artworkCounts;
 else if(e.artworkCounts)counts=e.artworkCounts;
 else if(e.id==='luminous-constellations')counts={original:0,opto:60,total:60};
 else {const url=new URL(e.href,location.href);if(url.origin!==location.origin)return;if(!cache.has(url.href))cache.set(url.href,fetch(url.href).then(r=>{if(!r.ok)throw Error('展廳讀取失敗');return r.text()}).then(htmlCounts).catch(error=>{cache.delete(url.href);throw error}));counts=await cache.get(url.href)}
 if(!counts)return;e.galleryOriginalName=e.galleryOriginalName||e.name;e.galleryBaseName=base(e);e.artworkCounts=counts;e.name=title(e);
 }catch(error){console.warn('展廳件數暫時無法讀取',e.id,error)}}));return entries}
g.GalleryLabels={prepare,count,project,title,base,target,legacyCounts,htmlCounts,mergeDefault,visibleEntries};
})(window);
