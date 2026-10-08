/* Shared panorama library. Image bytes are requested only after selection. */
(function () {
 'use strict';
 const base = new URL('./', document.currentScript.src);
 let catalog=[], state=null, mesh=null, current='', ticket=0, select=null, status=null;
 const api = window.VG360 = {
  ready: fetch(new URL('catalog.json',base)).then(r=>{if(!r.ok)throw Error('環景清單讀不到');return r.json();}).then(data=>{
   if(!Array.isArray(data.items))throw Error('環景清單格式不正確');
   catalog=data.items.filter(e=>e&&typeof e.id==='string'&&typeof e.name==='string'&&typeof e.file==='string').map(e=>({...e,src:new URL(e.file,base).href}));return catalog;
  }).catch(e=>{console.warn(e.message);return [];}),
  isShared(id){return catalog.some(e=>e.id===id);},
  sync(id){if(select)select.value=api.isShared(id)?id:'';},
  hide(){ticket++;if(mesh){mesh.visible=false;if(mesh.material.map){mesh.material.map.dispose();mesh.material.map=null;mesh.material.needsUpdate=true;}}if(state&&state.windowMaterials)for(const m of state.windowMaterials){if(m.userData.vg360Original){m.map=m.userData.vg360Original.map;m.onBeforeCompile=m.userData.vg360Original.compile;m.customProgramCacheKey=m.userData.vg360Original.cache;m.color.copy(m.userData.vg360Original.color);m.needsUpdate=true;}}current='';},
  async show(id){
   const entry=catalog.find(e=>e.id===id);if(!entry||!state)throw Error('沒有這張共用環景');
   const request=++ticket, {THREE,renderer,scene}=state;
   const img=await new Promise((resolve,reject)=>{const i=new Image();i.decoding='async';i.onload=()=>resolve(i);i.onerror=()=>reject(Error('圖片載入失敗，請確認 360view 已完整上傳'));i.src=entry.src;});
   if(request!==ticket)return false;
   let source=img;const limit=Math.min(('ontouchstart' in window)?2048:4096,renderer.capabilities.maxTextureSize);
   if(img.width>limit){source=document.createElement('canvas');source.width=limit;source.height=Math.round(img.height*limit/img.width);source.getContext('2d').drawImage(img,0,0,source.width,source.height);}
   const texture=new THREE.Texture(source);texture.colorSpace=THREE.SRGBColorSpace;texture.needsUpdate=true;texture.wrapS=THREE.RepeatWrapping;texture.minFilter=THREE.LinearMipmapLinearFilter;
   if(!mesh){mesh=new THREE.Mesh(new THREE.SphereGeometry(80,64,32),new THREE.MeshBasicMaterial({side:THREE.BackSide,fog:false,toneMapped:false,depthWrite:false}));mesh.name='Shared 360 panorama';mesh.frustumCulled=false;mesh.renderOrder=-0.5;scene.add(mesh);}
   if(mesh.material.map)mesh.material.map.dispose();mesh.material.map=texture;mesh.material.needsUpdate=true;mesh.rotation.y=(entry.rotation||0)*Math.PI/180;mesh.visible=true;
   // Project the same view across La Galerie's opaque window and skylight surfaces.
   if(state.windowMaterials)for(const m of state.windowMaterials){
    if(!m.userData.vg360Original)m.userData.vg360Original={map:m.map,compile:m.onBeforeCompile,cache:m.customProgramCacheKey,color:m.color.clone()};
    m.map=texture;m.color.set(0xffffff);m.customProgramCacheKey=()=> 'shared360-v1';
    m.onBeforeCompile=shader=>{
     shader.uniforms.vgMap={value:texture};shader.uniforms.vgAngle={value:(entry.rotation||0)*Math.PI/180};
     shader.vertexShader='varying vec3 vgWorld;\n'+shader.vertexShader.replace('#include <begin_vertex>','#include <begin_vertex>\nvgWorld=(modelMatrix*vec4(transformed,1.0)).xyz;');
     shader.fragmentShader='varying vec3 vgWorld; uniform sampler2D vgMap; uniform float vgAngle;\n'+shader.fragmentShader.replace('#include <map_fragment>',`vec3 vgD=normalize(vgWorld-cameraPosition); float vgU=atan(vgD.z,-vgD.x)/6.28318530718-vgAngle/6.28318530718; float vgV=asin(clamp(vgD.y,-1.0,1.0))/3.14159265359+0.5; diffuseColor*=texture2D(vgMap,vec2(vgU,vgV));`);
    };m.needsUpdate=true;
   }
   current=id;api.sync(id);return true;
  },
  async install(options){
   state=options;const entries=await api.ready;
   if(options.entries)for(const entry of entries)if(!options.entries.some(p=>p.id===entry.id))options.entries.push({...entry});
   const container=document.createElement('div');container.id='shared-360-control';container.style.cssText='padding:8px 0;';
   const label=document.createElement('label');label.textContent='共用 360° 環景';label.htmlFor='shared-360-select';label.style.cssText='display:block;font-size:12px;margin-bottom:6px;';
   select=document.createElement('select');select.id='shared-360-select';select.style.cssText='width:100%;max-width:280px;padding:8px;background:#252525;color:#fff;border:1px solid #888;border-radius:4px;';
   select.append(new Option('原有環景／背景',''));for(const e of entries)select.append(new Option(e.name,e.id));
   status=document.createElement('div');status.setAttribute('role','status');status.style.cssText='font-size:11px;line-height:1.5;margin-top:4px;';status.textContent=entries.length?'選用時載入，所有展廳共用':'共用清單讀不到，請確認 360view 已上傳';
   select.addEventListener('keydown',e=>e.stopPropagation());select.addEventListener('pointerdown',e=>e.stopPropagation());
   select.addEventListener('change',async()=>{const previous=current;select.disabled=true;status.textContent='載入環景…';try{if(options.activate)await options.activate(select.value);else if(select.value)await api.show(select.value);else api.hide();status.textContent='';}catch(e){api.sync(previous);status.textContent=e.message;}finally{select.disabled=false;}});
   container.append(label,select,status);const panel=options.panel||document.body;
   if(panel===document.body)container.style.cssText+='position:fixed;right:12px;bottom:12px;z-index:200;background:#171717dd;color:#fff;padding:12px;border-radius:8px;';
   panel.prepend(container);return entries;
  }
 };
})();
