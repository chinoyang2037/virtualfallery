(function(g){'use strict';
function reconcile(entries,ids){const known=new Map(entries.map(e=>[e.id,e]));const out=[];for(const id of ids||[]){if(known.has(id)){out.push(known.get(id));known.delete(id)}}return out.concat([...known.values()])}
function move(ids,from,to,after=false){if(from===to||!ids.includes(from)||!ids.includes(to))return ids.slice();const next=ids.filter(id=>id!==from),i=next.indexOf(to);next.splice(i+(after?1:0),0,from);return next}
g.GalleryOrder={reconcile,move};
})(window);
