(()=>{
 'use strict';
 const music=window.MatthewMusic;if(!music)return;
 const choices=[
  {id:'piano',label:'內建鋼琴（即時演奏）'},
  {id:'mixkit-classical-6-713',label:'mixkit-classical-6-713.mp3'},
  {id:'mixkit-classical-2-709',label:'mixkit-classical-2-709.mp3'},
  {id:'mixkit-beautiful-dream-493',label:'mixkit-beautiful-dream-493.mp3'},
  {id:'mixkit-skyline-601',label:'mixkit-skyline-601.mp3'}
 ];
 const box=document.createElement('details');box.id='music-library';box.className='music-compact';
 const heading=document.createElement('summary');heading.textContent='MP3 目錄';box.append(heading);
 const list=document.createElement('div');list.id='music-five-list';box.append(list);
 document.getElementById('b-musadd').after(box);
 function render(){
  list.replaceChildren(...choices.map(t=>{
   const b=document.createElement('button');b.type='button';b.textContent=t.label;
   b.className='music-choice'+(music.active===t.id?' on':'');
   b.setAttribute('aria-current',music.active===t.id?'true':'false');
   b.onclick=()=>music.play(t.id);return b;
  }));
 }
 for(const type of ['pointerdown','pointerup','click','keydown','keyup','wheel'])box.addEventListener(type,e=>e.stopPropagation());
 music.changed=render;window.MatthewMusicLibrary={render};render();
})();
