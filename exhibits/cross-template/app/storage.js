export function createStore(id,{readonly=false,storage=(window.VG_MANAGER_STORAGE||globalThis.localStorage)}={}) {
  if(!/^[a-z0-9][a-z0-9-]{1,47}$/.test(id))throw Error('展廳 ID 格式不正確');
  const prefix='vg-template:v1:'+id+':';
  return {databaseName:'vg-template-v1-'+id,prefix,
    get(key){if(readonly)return null;try{return storage.getItem(prefix+key)}catch{return null}},
    set(key,value){if(readonly)return;try{storage.setItem(prefix+key,String(value))}catch{}},
  };
}
