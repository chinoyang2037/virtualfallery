import {loadProject,getJSON} from './config.js';
import {createProjectBundle} from './export.js';
const root=new URL('../',import.meta.url),$=id=>document.getElementById(id);let downloadURL='';
if(location.protocol==='file:'){$('status').textContent='請使用桌機預覽工具或 GitHub 網址開啟，勿直接雙擊 HTML。';$('build').disabled=true}else{
 getJSON(new URL('360view/catalog.json',root)).then(d=>{for(const p of d.items||[]){if([...$('panorama').options].some(o=>o.value===p.id))continue;$('panorama').add(new Option(p.name,p.id))}}).catch(()=>{$('status').textContent='環景清單暫時讀不到，仍可使用原有背景。'});
 $('new-project').addEventListener('submit',async e=>{e.preventDefault();$('build').disabled=true;$('retry-download').hidden=true;try{
  const data=await loadProject(new URL('projects/cross-demo/gallery.json',root));
  const id=$('id').value.trim();if(['cross-demo','chino-demo'].includes(id))throw Error('請使用新的展廳 ID，避免覆蓋範例');
  data.config={...data.config,id,title:$('title').value.trim(),subtitle:$('subtitle').value.trim(),light:Number($('light').value),panorama:$('panorama').value,architecture:{...data.config.architecture,white:$('wall').value.startsWith('white'),ceiling:$('wall').value.endsWith('roof')}};
  if($('artist').value.trim())data.artworks=data.artworks.map(w=>({...w,artist:$('artist').value.trim()}));
  const zip=await createProjectBundle(root,data,t=>$('status').textContent=t);
  if(downloadURL)URL.revokeObjectURL(downloadURL);downloadURL=URL.createObjectURL(zip);const a=$('retry-download');a.href=downloadURL;a.download=id+'-展廳模板.zip';a.hidden=false;a.click();$('status').textContent='已建立 '+id+'。請完整解壓縮 ZIP，再以本機預覽開啟。';
 }catch(e){$('status').textContent='無法建立：'+e.message}finally{$('build').disabled=false}})
}
