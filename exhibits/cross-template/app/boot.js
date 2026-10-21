import {getJSON,validate,loadProject,resolveImage} from './config.js';
import {createStore} from './storage.js';
import {createSlots,PLAN} from './geometry-cross.js';
import {exportBundle} from './export.js';
const root=new URL('../',import.meta.url),asset=path=>new URL(path,root).href;
function script(path){return new Promise((ok,no)=>{const s=document.createElement('script');s.src=asset(path);s.onload=ok;s.onerror=()=>no(Error('讀不到共用程式 '+path));document.body.append(s)})}
try{
 if(location.protocol==='file:')throw Error('請使用「啟動模板.bat」或桌機預覽工具開啟，勿直接雙擊 HTML。');
 const seed=window.VG_TEMPLATE_SHARE;
 const projectUrl=new URL(seed?.project||new URLSearchParams(location.search).get('project')||'projects/cross-demo/gallery.json',root);
 if(projectUrl.origin!==root.origin||!projectUrl.href.startsWith(root.href))throw Error('設定檔需位於模板資料夾內');
 const data=seed?validate(seed.config,seed.layout,seed.artworks):await loadProject(projectUrl);
 createSlots({custom:data.layout.slots});
 const link=document.createElement('link');link.rel='stylesheet';link.href=asset('app/gallery.css');document.head.append(link);
 const r=await fetch(asset('app/shell.html'));if(!r.ok)throw Error('讀不到展廳操作介面');document.body.innerHTML=await r.text();document.body.className='oncover';document.body.removeAttribute('style');
 document.title=data.config.title+'｜'+data.config.subtitle;
 for(const selector of ['.card h1','.brand strong'])document.querySelector(selector).textContent=data.config.title;
 for(const selector of ['.card h2','.brand span'])document.querySelector(selector).textContent=data.config.subtitle;
 document.getElementById('floor').textContent=data.config.subtitle;
 const home=document.createElement('a');home.href=asset('workbench.html');home.textContent='返回模板工作台';home.style.cssText='display:block;color:#d8bc7e;margin-top:16px';document.querySelector('.card').append(home);
 window.GALLERY_EMBED=seed?.embed||Object.fromEntries(data.artworks.map(w=>[w.id,resolveImage(w.image,projectUrl)]));
 window.GALLERY_META=seed?.meta||Object.fromEntries(data.artworks.map(w=>[w.id,w]));window.GALLERY_SHARE=seed?.share||null;
 window.GALLERY_COVER=seed?.cover||null;
 if(seed)window.GALLERY_LAYOUT={version:1,footprint:data.layout.footprint,objects:data.layout.objects};
 window.ROTONDE_PANO=[{id:'ice',name:'冰湖暮色',hz:.47,src:asset('assets/317ed098b5f1489cdb8e.webp')}];
 window.VGTemplate={...data,plan:PLAN,asset,createSlots,project:projectUrl.href,store:createStore(data.config.id,{readonly:!!seed}),exportBundle:(payload,cover,progress)=>exportBundle(root,{...payload,project:projectUrl.pathname.slice(root.pathname.length)},cover,progress)};
 await script('assets/code-40e095ec567a52c0.js');await new Promise((ok,no)=>{const p=document.createElement('script');p.src=(root.pathname.includes('/exhibits/cross-template/')?new URL('../../360view/gallery360.js',root):new URL('360view/gallery360.js',root)).href;p.onload=ok;p.onerror=()=>no(Error('共用環景模組載入失敗'));document.head.append(p)});await script('app/engine-cross.js');
}catch(e){console.error(e);const p=document.getElementById('boot-status')||document.getElementById('load-msg');if(p)p.textContent='無法開啟：'+e.message;else document.body.textContent='無法開啟：'+e.message}
