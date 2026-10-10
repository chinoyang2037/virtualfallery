export async function getJSON(url){const c=new AbortController(),t=setTimeout(()=>c.abort(),15000);try{const r=await fetch(url,{signal:c.signal,cache:'no-store'});if(!r.ok)throw Error('讀不到 '+new URL(url,location.href).pathname+'（'+r.status+'）');return await r.json()}finally{clearTimeout(t)}}
export function validate(config,layout,artworks){
 const fail=s=>{throw Error(s)};
 if(config.version!==1||config.template!=='cross-v1')fail('不支援此展廳模板版本');
 if(!/^[a-z0-9][a-z0-9-]{1,47}$/.test(config.id||'')||/^(con|prn|aux|nul|com[1-9]|lpt[1-9])$/i.test(config.id))fail('展廳 ID 請使用 2 至 48 個英文小寫、數字或連字號');
 for(const k of ['title','subtitle'])if(typeof config[k]!=='string'||!config[k].trim()||config[k].length>100)fail('請填寫展名與副標（最多 100 字）');
 if(![0,1,2].includes(config.light)||!Number.isFinite(config.snow)||config.snow<0||config.snow>100)fail('燈光或雪花預設不正確');
 if(typeof config.panorama!=='string'||!config.panorama)fail('請指定預設環景');
 if(!config.architecture||['ceiling','white','rig'].some(k=>typeof config.architecture[k]!=='boolean'))fail('空間外觀設定不完整');
 if(!config.quality||['standardDpr','highDpr','touchHighDpr'].some(k=>!Number.isFinite(config.quality[k])||config.quality[k]<.5||config.quality[k]>2))fail('畫質倍率需介於 0.5 與 2');
 for(const k of ['artLight','envLight'])if(!config[k]||!Number.isFinite(config[k].brightness)||config[k].brightness<0||config[k].brightness>2||!['white','yellow','red','blue','green'].includes(config[k].color))fail('投射燈設定不正確');
 if(layout.version!==1||layout.template!=='cross-v1'||layout.footprint!=='wall-step-cross-v1'||!Array.isArray(layout.slots)||!Array.isArray(layout.objects))fail('佈展設定不正確');
 if(!Array.isArray(artworks)||artworks.length!==30)fail('第一版需提供 30 筆作品資料');
 const ids=new Set();for(let i=0;i<30;i++){const w=artworks[i];if(!w||w.id!==String(i+1).padStart(2,'0')||ids.has(w.id))fail('作品編號需依序為 01 至 30');ids.add(w.id);for(const k of ['title','artist','year','desc'])if(typeof w[k]!=='string')fail('作品 '+w.id+' 缺少 '+k);if(typeof w.image!=='string')fail('作品 '+w.id+' 缺少圖片路徑');if(!['black','oak','gold','silver','white','none'].includes(w.frame))fail('作品畫框不正確')}
 const objIds=new Set();for(const o of layout.objects){if(!o||objIds.has(o.id)||typeof o.id!=='string'||!['table','bench','chair','spool','crate','window','skylight'].includes(o.type)||![o.x,o.z,o.w,o.d,o.h,o.angle||0].every(Number.isFinite)||o.w<.4||o.w>5||o.d<(o.type==='window'?.1:.4)||o.d>5||o.h<.25||o.h>4)fail('物件設定不正確');objIds.add(o.id)}
 return {config,layout,artworks};
}
export function resolveImage(path,base){if(!path)return '';if(/^data:image\/(jpeg|png|webp);base64,/.test(path))return path;const u=new URL(path,base);if(u.origin!==new URL(base).origin||!['http:','https:'].includes(u.protocol))throw Error('圖片需放在同一網站內');return u.href}
export async function loadProject(url){const config=await getJSON(url);const [layout,works]=await Promise.all([getJSON(new URL(config.layout,url)),getJSON(new URL(config.artworks,url))]);return validate(config,layout,works.items)}
