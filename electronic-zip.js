const CRC_T=(()=>{const t=new Uint32Array(256);for(let n=0;n<256;n++){let c=n;for(let k=0;k<8;k++)c=c&1?0xEDB88320^(c>>>1):c>>>1;t[n]=c>>>0;}return t;})();
function crc32(u8){let c=0xFFFFFFFF;for(let i=0;i<u8.length;i++)c=CRC_T[(c^u8[i])&255]^(c>>>8);return (c^0xFFFFFFFF)>>>0;}

async function electronicZip(files){
 const enc=new TextEncoder(),local=[],central=[];let offset=0;
 const put=(dv,p,v,n)=>n===2?dv.setUint16(p,v,true):dv.setUint32(p,v,true);
 for(const [name,data] of files){const bytes=typeof data==='string'?enc.encode(data):new Uint8Array(await data.arrayBuffer()),n=enc.encode(name),crc=crc32(bytes);
  const h=new Uint8Array(30+n.length),dv=new DataView(h.buffer);put(dv,0,0x04034b50,4);put(dv,4,20,2);put(dv,6,0x800,2);put(dv,12,33,2);put(dv,14,crc,4);put(dv,18,bytes.length,4);put(dv,22,bytes.length,4);put(dv,26,n.length,2);h.set(n,30);local.push(h,bytes);
  const c=new Uint8Array(46+n.length),cd=new DataView(c.buffer);put(cd,0,0x02014b50,4);put(cd,4,20,2);put(cd,6,20,2);put(cd,8,0x800,2);put(cd,14,33,2);put(cd,16,crc,4);put(cd,20,bytes.length,4);put(cd,24,bytes.length,4);put(cd,28,n.length,2);put(cd,42,offset,4);c.set(n,46);central.push(c);offset+=h.length+bytes.length;
 }
 const len=central.reduce((a,b)=>a+b.length,0),end=new Uint8Array(22),dv=new DataView(end.buffer);put(dv,0,0x06054b50,4);put(dv,8,files.length,2);put(dv,10,files.length,2);put(dv,12,len,4);put(dv,16,offset,4);return new Blob([...local,...central,end],{type:'application/zip'});
}
