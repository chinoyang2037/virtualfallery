(function(g){'use strict';
const self=g.VG_SHARE_SOURCE||document.currentScript?.src||new URL('shared/gallery-share.js',location.href).href;
const root=new URL('../',self).href;
const ids=['share-view','share-fly','b-sv','b-sf','layout-export','scene-photo-export'];
let busy=false,links=[];
function show(){for(const id of ids){const el=document.getElementById(id);if(!el)continue;el.classList.remove('edit-only');el.hidden=false;el.style.removeProperty('display');if(id==='share-view'||id==='share-fly'){const row=el.parentElement;row.classList.remove('edit-only');row.hidden=false;}}const result=document.getElementById('share-results');if(result)result.classList.remove('edit-only');}
function status(text,error=false){let el=document.getElementById('vg-share-status');if(!el){el=document.createElement('div');el.id='vg-share-status';el.setAttribute('role','status');el.style.cssText='position:fixed;bottom:16px;left:16px;right:16px;z-index:100000;background:#17242c;color:white;padding:16px;border:1px solid #c9a253;max-height:40vh;overflow:auto;font:15px/1.6 system-ui';document.body.append(el);}el.replaceChildren();const msg=document.createElement('div');msg.textContent=text;el.append(msg);if(error)el.style.borderColor='#f88';for(const x of links){const a=document.createElement('a');a.href=x.url;a.download=x.name;a.textContent='下載 '+x.name;a.style.cssText='display:block;color:#ffe3a3';el.append(a);}const close=document.createElement('button');close.textContent='關閉';close.onclick=()=>el.remove();el.append(close);}
async function get(url,type='text'){const r=await fetch(url);if(!r.ok)throw Error('資源載入失敗 '+r.status+'：'+url);return type==='blob'?r.blob():r.text();}
function asData(blob){return new Promise((ok,no)=>{const r=new FileReader();r.onload=()=>ok(r.result);r.onerror=()=>no(Error('讀取圖片失敗'));r.readAsDataURL(blob);});}
async function embed(url){return /^data:/i.test(url)?url:asData(await get(new URL(url,location.href).href,'blob'));}
function safe(o){return JSON.stringify(o).replace(/</g,'\\u003c').replace(/\u2028/g,'\\u2028').replace(/\u2029/g,'\\u2029');}
function script(code){return '<script>'+code.replace(/<\/script/gi,'<\\/script')+'<'+ '/script>';}
function keep(blob,name,click=true){const url=URL.createObjectURL(blob);links.push({url,name});if(click){const a=document.createElement('a');a.href=url;a.download=name;document.body.append(a);a.click();a.remove();}}
async function exportProject(kind='view'){
 if(busy)return;if(!g.GeneratorRuntime?.snapshot){status('展廳仍在載入，請稍後再按分享。',true);return;}
 busy=true;links.forEach(x=>URL.revokeObjectURL(x.url));links=[];status('正在製作分享 HTML…');
 try{const project=await g.GeneratorRuntime.snapshot();project.readonly=true;project.openEditor=false;project.runtime={...project.runtime,mode:kind};
 project.siteRoot=new URL(project.siteRoot||root,location.href).href;
 if(g.GeneratorRuntime.capture){const cover=g.GeneratorRuntime.capture();if(cover?.data)project.cover=cover.data;}
 let i=0;for(const res of Object.values(project.resources||{})){if(!res.data&&res.url){status('正在內嵌畫作 '+(++i)+'…');res.data=await embed(res.url);}if(res.data)delete res.url;}
 if(project.cover)project.cover=await embed(project.cover);
 for(const key of ['pano','music']){const r=project.runtime[key];if(r?.src)r.src=await embed(r.src);}
 // Animation references remain absolute so online animation does not depend on the download folder.
 for(const a of project.artworks||[])for(const key of ['animation','video'])if(a[key]&&!/^data:/i.test(a[key]))a[key]=new URL(a[key],project.siteRoot).href;
 for(const t of project.config.musicTracks||[])if(t.src&&!/^data:/i.test(t.src))t.src=new URL(t.src,new URL('exhibits/cross-template/',project.siteRoot)).href;
 const base=new URL('shared/gallery-viewer/',root).href;
 const names=['native-core.js','native-bootstrap.js','three.min.js','native-panorama.js','native-engine.js','native-language.js'];
 const results=await Promise.all([get(base+'native.css'),get(base+'native-shell.json'),...names.map(n=>get(base+n)),get(self)]);
 const shell=JSON.parse(results[1]);const init='window.VG_SHARE_SOURCE='+safe(self)+';window.GENERATOR_PROJECT='+safe(project)+';';
 const html='<!doctype html><html lang="zh-Hant"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>'+String(project.config.title||'Gallery').replace(/[<&>]/g,' ')+'</title><style>'+results[0]+'</style></head><body class="oncover share">'+shell+script(init)+names.map((_,n)=>script(results[n+2])).join('')+script(results.at(-1))+'</body></html>';
 const stem=String(project.config.title||'gallery').replace(/[\\/:*?"<>|]/g,'-').slice(0,65)+'-'+kind;
 keep(new Blob([html],{type:'text/html;charset=utf-8'}),stem+'.html');
 if(project.cover){keep(await (await fetch(project.cover)).blob(),stem+'-cover.jpg',false);}
 status('分享 HTML 已產生。若未自動下載，請點下方連結。封面 JPG 可另外下載。畫作、3D 程式與已選環景已內嵌；動畫影片及額外音樂選項仍需連網。');return html;
 }catch(e){status('分享匯出失敗：'+(e.message||e)+'。請確認完整網站資源已上傳，並使用網站網址或本機預覽。',true);throw e;}finally{busy=false;}
}
g.VGShare={export:exportProject,show};show();
document.addEventListener('click',e=>{const el=e.target.closest?.('button');if(!el||!ids.includes(el.id)||!g.GeneratorRuntime)return;e.preventDefault();e.stopImmediatePropagation();exportProject(['share-fly','b-sf'].includes(el.id)?'fly':'view').catch(()=>{});},true);
document.addEventListener('keydown',e=>{if(e.ctrlKey||e.metaKey||e.altKey||e.key.toLowerCase()!=='v'||/^(INPUT|TEXTAREA|SELECT)$/.test(e.target.tagName)||e.target.isContentEditable)return;const el=document.getElementById(e.shiftKey?'share-fly':'share-view');if(!el)return;e.preventDefault();e.stopImmediatePropagation();if(g.GeneratorRuntime)exportProject(e.shiftKey?'fly':'view').catch(()=>{});else el.click();},true);
})(window);
