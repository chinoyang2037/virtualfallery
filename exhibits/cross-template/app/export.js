import {makeZip} from './zip.js';
import {getJSON,validate} from './config.js';
export async function collect(root,overrides={},progress=()=>{}){
 const manifest=await getJSON(new URL('template-manifest.json',root));
 if(manifest.version!==1||!Array.isArray(manifest.files))throw Error('模板檔案清單不正確');
 const files=[...new Set([...manifest.files,...Object.keys(overrides)])];
 for(const name of files)if(typeof name!=='string'||name.startsWith('/')||name.includes('\\')||name.split('/').some(p=>!p||p==='.'||p==='..'))throw Error('模板路徑不正確');
 /* 以 6 路並行抓檔（保持原順序），打包速度明顯快於逐一下載 */
 const entries=new Array(files.length);let done=0,next=0;
 const worker=async()=>{for(;;){const i=next++;if(i>=files.length)return;const name=files[i];let data;if(Object.hasOwn(overrides,name))data=overrides[name];else{const r=await fetch(new URL(name,root));if(!r.ok)throw Error('打包時找不到 '+name);data=await r.arrayBuffer()}entries[i]={name,data};progress('打包檔案 '+(++done)+' / '+files.length+'：'+name)}};
 await Promise.all(Array.from({length:Math.min(6,files.length)},worker));
 return entries;
}
const safeJSON=value=>JSON.stringify(value).replace(/</g,'\\u003c').replace(/\u2028/g,'\\u2028').replace(/\u2029/g,'\\u2029');
export function sharePage(payload){return '<!doctype html><html lang="zh-Hant"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>線上展廳</title></head><body style="margin:0;background:#15191d;color:#fff"><p id="boot-status" style="padding:32px">正在開啟展示…</p><script>window.VG_TEMPLATE_SHARE='+safeJSON(payload)+';</script><script type="module" src="app/boot.js"></script></body></html>'}
export async function exportBundle(root,payload,cover,progress){validate(payload.config,payload.layout,payload.artworks);const html=sharePage(payload),entries=await collect(root,{'index.html':html,'gallery.html':html,[payload.config.id+'.jpg']:await cover.arrayBuffer()},progress);return makeZip(entries)}
export async function createProjectBundle(root,data,progress){validate(data.config,data.layout,data.artworks);const dir='projects/'+data.config.id+'/',manifest=await getJSON(new URL('template-manifest.json',root));const files=[dir+'gallery.json',dir+'layout.json',dir+'artworks.json'];const overrides={[files[0]]:JSON.stringify(data.config,null,2),[files[1]]:JSON.stringify(data.layout,null,2),[files[2]]:JSON.stringify({version:1,items:data.artworks},null,2),'template-manifest.json':JSON.stringify({...manifest,files:[...new Set([...manifest.files,...files])]},null,2)};
 const url='gallery.html?project='+dir+'gallery.json';overrides['index.html']='<!doctype html><html lang="zh-Hant"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>新展廳</title><body style="font-family:Arial,Microsoft JhengHei,sans-serif;padding:40px"><h1 id="name"></h1><p>請透過啟動模板或桌機預覽工具開啟。</p><p><a href="'+url+'">進入新展廳</a></p><p><a href="workbench.html">模板工作台</a></p><script>document.getElementById("name").textContent='+safeJSON(data.config.title)+'</script></body></html>';
 return makeZip(await collect(root,overrides,progress));
}
