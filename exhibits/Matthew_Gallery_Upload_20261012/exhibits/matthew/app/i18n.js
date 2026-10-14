(() => {
 'use strict';
 const dictionary={
 "馬太福音展覽館": "Matthew Gallery",
 "馬太福音展覽館・試用版": "Matthew Gallery · Preview",
 "看畫・讀經・蜂鳥飛行": "Art · Scripture · Hummingbird flight",
 "28 章・每章兩幅畫・中文和合本": "28 chapters · Two paintings per chapter · Chinese Union Version",
 "56 幅經文水彩畫；真人英文朗讀・中文字幕": "56 scripture watercolors · English narration · Chinese subtitles",
 "佈展平面圖": "Gallery floor plan",
 "進入展廳": "Enter gallery",
 "自動導覽": "Auto tour",
 "蜂鳥讀經": "Fly and listen",
 "分享檔（欣賞版）": "Export viewing copy",
 "分享檔（直接飛行）": "Export flight copy",
 "匯入作品目錄": "Import artwork folder",
 "匯入 56 幅畫": "Import 56 paintings",
 "還原預設": "Restore defaults",
 "記憶": "Saved collections",
 "窗外／門外": "Outdoor panorama",
 "音樂": "Music",
 "Excel 匯出": "Export Excel",
 "Excel 匯入": "Import Excel",
 "點畫面": "Click scene",
 "滑鼠控制視角": "Mouse look",
 "釋放滑鼠": "Release mouse",
 "滾輪": "Mouse wheel",
 "前進／後退": "Move forward / back",
 "拖曳": "Drag",
 "轉視角": "Look around",
 "走路": "Walk",
 "快走": "Walk faster",
 "點畫／E": "Click painting / E",
 "觀賞": "View",
 "右鍵": "Right click",
 "關閉面板": "Close panel",
 "導覽": "Tour",
 "停止導覽": "Stop tour",
 "蜂鳥飛行": "Hummingbird flight",
 "停止蜂鳥": "Stop flight",
 "隨機／逐步": "Random / In order",
 "窗外環景": "Outdoor panorama",
 "飄雪": "Snow",
 "控制台": "Controls",
 "平面圖": "Floor plan",
 "場景拍照": "Take photo",
 "後退": "Back",
 "小狗看畫": "Dog tour",
 "燈光": "Lighting",
 "回到入口": "Return to entrance",
 "載入中…": "Loading…",
 "關閉": "Close",
 "佈展物件": "Gallery objects",
 "木桌": "Wooden table",
 "長椅": "Bench",
 "單椅": "Chair",
 "電纜桌": "Cable spool table",
 "木箱": "Crate",
 "窗戶": "Window",
 "天窗": "Skylight",
 "取消放置": "Cancel placement",
 "點選物件可移動、調整尺寸": "Select an object to move or resize",
 "X 位置（m）": "X position (m)",
 "Z 位置（m）": "Z position (m)",
 "寬度（m）": "Width (m)",
 "深度（m）": "Depth (m)",
 "高度（m）": "Height (m)",
 "旋轉（°）": "Rotation (°)",
 "窗台高度（m）": "Window sill height (m)",
 "刪除": "Delete",
 "復原": "Undo",
 "重做": "Redo",
 "匯出分享檔（含佈展配置）": "Export with gallery layout",
 "選擇畫作": "Select painting",
 "前往觀看": "Go to painting",
 "查看作品": "View artwork",
 "瀏覽": "Explore",
 "◀ 上一幅": "◀ Previous painting",
 "下一幅 ▶": "Next painting ▶",
 "小狗看畫模式": "Dog tour mode",
 "汪（叫一聲）": "Bark",
 "搭樓梯 上／下樓": "Ride stairs up / down",
 "跨出樓梯（停下）": "Step off stairs (stop)",
 "首頁": "Home",
 "保留最近 3 張；點選縮圖指定分享封面。": "Keeps the last 3 photos; select a thumbnail for the cover.",
 "下載這張 JPG": "Download this JPG",
 "改用自動封面": "Use automatic cover",
 "以選定封面匯出分享檔": "Export with selected cover",
 "環境": "Environment",
 "展廳外觀": "Gallery appearance",
 "恢復預設桌椅": "Restore furniture",
 "畫作投射燈": "Artwork spotlights",
 "亮度": "Brightness",
 "白光": "White",
 "黃光": "Yellow",
 "藍光": "Blue",
 "紅光": "Red",
 "天窗／牆角／柱子投射燈": "Skylight / corner / pillar lights",
 "強度": "Intensity",
 "環景 ▲": "Panorama ▲",
 "環景 ▼": "Panorama ▼",
 "新增窗外環景…": "Add panorama…",
 "下一首": "Next track",
 "音量 −": "Volume −",
 "音量 ＋": "Volume ＋",
 "新增音樂（MP3）…": "Add music (MP3)…",
 "作品": "Artwork",
 "匯入作品目錄…": "Import artwork folder…",
 "匯入 56 幅畫…": "Import 56 paintings…",
 "Excel 匯入…": "Import Excel…",
 "分享": "Share",
 "操作": "How to use",
 "走路／飛行・": "Walk / fly ·",
 "快": "Faster",
 "滑鼠": "Mouse",
 "轉視角・": "Look ·",
 "前後・": "Forward / back ·",
 "釋放": "Release",
 "觀賞準星對到的畫・": "View the painting under the crosshair ·",
 "關面板": "Close panel",
 "飛行中": "While flying",
 "升": "Up",
 "降": "Down",
 "樓梯：走上去或": "Stairs: walk onto them or",
 "點樓梯": "Click stairs",
 "自動搭乘・": "Auto ride ·",
 "換方向・": "Reverse ·",
 "跨出": "Step off",
 "空白鍵": "Space",
 "放下・": "Put down ·",
 "暫時自己走": "Walk temporarily",
 "工業風展廳": "Industrial gallery",
 "畫作說明": "Artwork description",
 "畫作資料與編輯": "Artwork details and editing",
 "作品名稱": "Title",
 "作者": "Artist",
 "年份": "Year",
 "說明": "Description",
 "畫框": "Frame",
 "黑": "Black",
 "原木": "Natural wood",
 "金": "Gold",
 "白": "White",
 "無": "None",
 "更換圖片": "Replace image",
 "回到展廳": "Back to gallery",
 "放開以匯入圖片": "Drop to import images",
 "MP3目錄": "MP3 library",
 "內建鋼琴（即時演奏）": "Built-in piano (live performance)",
 "內建鋼琴": "Built-in piano",
 "選畫讀經": "Choose scripture painting",
 "章節": "Chapter",
 "畫作": "Painting",
 "▶ 真人朗讀": "▶ Narration",
 "❚❚ 暫停／繼續": "❚❚ Pause / Resume",
 "← 上一幅": "← Previous painting",
 "下一幅 →": "Next painting →",
 "停止": "Stop",
 "圖片與經文": "Painting and scripture",
 "邊聽邊飛": "Fly while listening",
 "顯示字幕": "Show subtitles",
 "選擇畫作後，按真人朗讀": "Select a painting, then press Narration",
 "▶ 真人": "▶ Narration",
 "隱藏字幕": "Hide subtitles",
 "全文": "Full text",
 "下一節": "Next verse",
 "←畫": "← Painting",
 "收起全文": "Close full text",
 "收起設定": "Close settings",
 "逐章連續朗讀（讀完接下一章）": "Continuous reading (continue to next chapter)",
 "抵達畫前自動朗讀": "Read automatically on arrival",
 "錄音語速": "Narration speed",
 "慢速": "Slow",
 "舒緩": "Relaxed",
 "正常": "Normal",
 "快速": "Fast",
 "停止朗讀": "Stop narration",
 "音量": "Volume",
 "顯示英文字幕": "Show English subtitles",
 "錄音來源": "Recording source",
 "按播放即可聆聽": "Press play to listen",
 "▶ 真人英文・中文字幕": "▶ English narration · Chinese subtitles",
 "本段朗讀完畢・可看下一幅": "Reading finished · Continue to next painting",
 "字幕已暫停": "Subtitles paused",
 "字幕繼續": "Subtitles resumed",
 "錄音已暫停": "Narration paused",
 "真人錄音繼續": "Narration resumed",
 "請按 ▶ 重新播放": "Press ▶ to play again",
 "共用 360° 環景": "Shared 360° panoramas",
 "選用時載入，所有展廳共用": "Loaded when selected; shared by all galleries",
 "載入環景…": "Loading panorama…",
 "看畫讀經字幕": "Scripture subtitles",
 "目前經文": "Current verse",
 "選擇章節": "Select chapter",
 "播放真人英文經文": "Play English narration",
 "暫停或繼續朗讀": "Pause or resume narration",
 "看下一幅畫": "View next painting",
 "下一節經文": "Next verse",
 "上一幅畫": "Previous painting",
 "讀經章節": "Reading chapter",
 "選擇讀經畫作": "Select scripture painting",
 "顯示／隱藏控制台": "Show / hide controls",
 "所選畫作預覽": "Selected painting preview",
 "向左微調": "Nudge left",
 "向上微調": "Nudge up",
 "向下微調": "Nudge down",
 "向右微調": "Nudge right",
 "展廳平面配置與畫作位置": "Gallery layout and painting locations",
 "保留目前經文，邊聽邊在展館飛行看畫": "Keep listening while flying around the gallery",
 "播放／暫停": "Play / pause",
 "開啟／關閉屋頂玻璃天窗（Q）": "Open / close roof skylight (Q)",
 "點一下畫面：以滑鼠控制視角・滾輪前進後退・Esc 釋放": "Click scene: mouse look · Scroll to move · Esc to release",
 "滑鼠轉視角・滾輪前進・W A S D 走路・點畫觀賞・窗外／門外可切換環景": "Mouse look · Scroll to move · W A S D to walk · Click paintings · Switch outdoor panoramas",
 "拖入平面圖；手機可先點物件，再點位置。窗戶自動靠牆。": "Drag onto the plan. On mobile, tap an object then a location. Windows snap to walls.",
 "吸附 0.25 m 格線與物件中心線": "Snap to the 0.25 m grid and object centers",
 "綠色可以放置；紅色請調整位置。天窗沿用 Q 鍵開關。": "Green: valid placement. Red: adjust position. Press Q to toggle skylights.",
 "方向鍵移動 0.25 m；Shift＋方向鍵微調 0.05 m。": "Arrow keys move 0.25 m; Shift + arrows move 0.05 m.",
 "金色編號：畫作位置　藍色箭頭：目前位置與方向": "Gold numbers: paintings · Blue arrow: your position and direction",
 "點選編號查看畫作，或按「前往觀看」沿展廳動線前往。手機可左右滑動平面圖；選取物件後可用方向鍵微調。": "Select a number to view a painting or choose Go to painting. Swipe the plan on mobile; use arrows to adjust selected objects.",
 "中文和合本字幕・英文 WEB 真人錄音：David Williams（公眾領域）。字幕時間由錄音辨識對齊，可能有少許誤差。": "Chinese Union Version subtitles · English WEB narration by David Williams (public domain). Subtitle timing is aligned from the recording and may vary slightly.",
 "像蜂鳥一樣在畫與畫之間穿梭、懸停；W A S D／滑鼠隨時接手自由飛": "Fly and hover between paintings; take over with W A S D or the mouse",
 "自動擷取封面，輸出帶封面的 HTML 與 JPG；包含目前畫作、標籤與佈展配置": "Capture a cover and export HTML and JPG with artworks, labels and layout",
 "同欣賞版，打開後直接開始蜂鳥飛行": "Export a viewing copy that starts in flight mode",
 "選一個放著畫作圖片（與 Excel）的資料夾，或把資料夾拖到這個頁面；匯入後存進記憶組": "Select or drop an artwork folder with images and Excel; save as a collection",
 "一次選多張圖；檔名「01_名稱」會放到第 1 幅，其餘依序": "Select multiple images; filenames starting with 01_ go into position 1",
 "清除自訂圖片與文字，回到預設 56 幅（記憶組保留）": "Restore the default 56 paintings and text; keep saved collections",
 "新增一組窗外／門外環景：選一張風景圖（360° 2:1 最佳）": "Add an outdoor panorama; 360° images with a 2:1 ratio work best",
 "調整環景的地平線高度": "Adjust panorama horizon height",
 "環景往上移": "Move panorama up",
 "環景往下移": "Move panorama down",
 "新增音樂：選 MP3（可一次選多首），存進這台瀏覽器": "Select one or more MP3 files to save in this browser",
 "匯出 56 幅的編號、位置、檔名、作者、年代、畫框、說明": "Export numbers, positions, filenames, artists, years, frames and descriptions",
 "依編號或檔名套用標題、作者、年代、說明、畫框": "Apply artwork details by number or filename",
 "隨機：56 幅洗牌後逐一看；逐步：1→30 依序，看完到圓頂下再從頭": "Random: shuffle paintings; In order: visit paintings sequentially and repeat",
 "蜂鳥飛行：上一幅": "Flight: previous painting",
 "蜂鳥飛行：下一幅": "Flight: next painting",
 "用小狗的高度逛展廳；走到畫前叫兩聲，會有人把你抱起來看畫": "Explore at dog height; bark twice near a painting to be lifted up",
 "小狗模式：叫一聲（在畫前連叫兩聲＝請人抱起來）": "Dog mode: bark (bark twice near a painting to be lifted)",
 "小狗模式：開（J 關）": "Dog mode: On (J to stop)",
 "像搭手扶梯：自動走到樓梯、沿螺旋上／下樓；途中滑鼠自由看": "Ride the spiral stairs up or down; use the mouse to look around",
 "場景照片與封面": "Scene photos and cover",
 "擷取目前 3D 場景，保留最近 3 張；後退請用向下方向鍵": "Capture the 3D scene; keep the last 3 photos. Use the down arrow to move back",
 "選擇分享封面": "Choose cover",
 "開場全亮：關": "Initial lights: Off",
 "畫作投射燈亮度": "Artwork spotlight brightness",
 "畫作投射燈顏色": "Artwork spotlight color",
 "環境投射燈強度": "Environment light intensity",
 "環境投射燈顏色": "Environment light color",
 "窗外飄雪：關 → 小雪 → 大雪（圓頂玻璃上也看得到雪落下）": "Snow: Off → Light → Heavy (also visible through the dome)",
 "窗外環景往上移": "Move outdoor panorama up",
 "窗外環景往下移": "Move outdoor panorama down",
 "小狗：自己逛、畫前叫兩聲被抱起・": "Dog: explore and bark twice near a painting to be lifted ·",
 "關閉圖片與經文": "Close painting and scripture",
 "這幅畫對應的經文": "Scripture for this painting",
 "錄音分段資料未能載入，請重新整理": "Narration timing could not load; refresh the page",
 "正在準備錄音起點…": "Preparing narration start…",
 "載入真人錄音…": "Loading narration…",
 "瀏覽器限制自動播放，請再按 ▶": "Autoplay blocked; press ▶ again",
 "馬太福音28章朗讀完畢": "Finished reading Matthew chapter 28",
 "錄音載入失敗，請按 ▶ 重試": "Narration failed to load; press ▶ to retry",
 "錄音已停止": "Narration stopped",
 "共用清單讀不到，請確認 360view 已上傳": "Panorama catalog unavailable; check that 360view was uploaded"
};
 const key='virtual-gallery-ui-language';
 let language='zh-Hant';try{if(localStorage.getItem(key)==='en')language='en'}catch{}
 const sources=new WeakMap(),attributes=new WeakMap(),originals=new Map();
 const protectedSelector='script,style,kbd,textarea,[contenteditable],.language-switch,#v-reading-title,#v-scripture,#bible-line,#bible-verses,#plan-work-title,#plan-work-meta,#painting-title-name,#painting-description-text,.dir-slot span';
 function translate(value){
  const trimmed=value.trim();let result=dictionary[trimmed];
  if(result===undefined){
   const modes={'隨機':'Random','逐步':'In order','顯示':'Shown','隱藏':'Hidden','純白':'White','工業灰':'Industrial gray','開啟':'Open','關閉':'Closed','日照':'Daylight','黃昏':'Dusk','夜訪':'Night','開':'On','關':'Off','小雪':'Light snow','大雪':'Heavy snow'};
   const labels={'蜂鳥順序':'Flight order','閒置10秒自動蜂鳥':'Auto flight after 10 idle seconds','天花板':'Ceiling','牆面':'Walls','投射燈架':'Light rig','天窗':'Skylight','燈光':'Lighting','持續全亮':'Keep all lights on','窗外飄雪':'Snow'};
   let m=trimmed.match(/^(.+)：([^：]+)$/);
   if(m&&labels[m[1]]&&modes[m[2]])result=labels[m[1]]+': '+modes[m[2]];
   else if((m=trimmed.match(/^第(\d+)章$/)))result='Chapter '+m[1];
   else if((m=trimmed.match(/^第(\d+)幅・(.*)$/)))result='Painting '+m[1]+' · '+m[2];
   else if((m=trimmed.match(/^馬太福音 (.+)｜第(\d+)幅｜真人英文$/)))result='Matthew '+m[1]+' | Painting '+m[2]+' | English narration';
   else if((m=trimmed.match(/^音量 ([−＋-])\s*(\d+)%$/)))result='Volume '+m[1]+' '+m[2]+'%';
   else if((m=trimmed.match(/^真人英文 (.*)$/)))result='English narration '+m[1];
   else if((m=trimmed.match(/^音樂：(.*)$/)))result='Music: '+m[1].replace('內建鋼琴','Built-in piano').replace('（停）',' (stopped)');
   else if((m=trimmed.match(/^窗外／門外：(.*)$/)))result='Panorama: '+m[1];
   else if((m=trimmed.match(/^錄音未能播放（(.+)），請按 ▶ 重試$/)))result='Narration could not play ('+m[1]+'); press ▶ to retry';
   else if(trimmed==='開場全亮：關（持續全亮中）')result='Initial lights: Off (always-on enabled)';
   else if(trimmed==='開場全亮：開（移動後 2 秒熄燈）')result='Initial lights: On (off 2 seconds after moving)';
   else if(trimmed==='開場全亮：關（靠近感應）')result='Initial lights: Off (proximity sensor)';
  }
  return result===undefined?value:value.replace(trimmed,result);
 }
 function renderText(node){
  if(!node.parentElement||node.parentElement.closest(protectedSelector))return;
  let record=sources.get(node);
  if(!record||node.data!==record.rendered)record={source:originals.get(node.data)||node.data,rendered:node.data};
  const next=language==='en'?translate(record.source):record.source;
  if(next!==record.source)originals.set(next,record.source);record.rendered=next;sources.set(node,record);if(node.data!==next)node.data=next;
 }
 function renderElement(el){
  if(el.closest(protectedSelector))return;
  let cache=attributes.get(el);if(!cache){cache={};attributes.set(el,cache)}
  for(const attr of ['title','placeholder','aria-label','alt']){
   const current=el.getAttribute(attr);if(current===null)continue;
   let record=cache[attr];if(!record||current!==record.rendered)record={source:current,rendered:current};
   const next=language==='en'?translate(record.source):record.source;
   record.rendered=next;cache[attr]=record;if(current!==next)el.setAttribute(attr,next);
  }
 }
 function render(root){
  if(root.nodeType===3){renderText(root);return}
  if(root.nodeType!==1||root.closest(protectedSelector))return;renderElement(root);
  for(const child of root.childNodes)render(child);
 }
 const switches=[];
 function mount(parent){
  if(!parent)return;const box=document.createElement('div');box.className='language-switch';box.setAttribute('role','group');box.setAttribute('aria-label','Interface language');
  for(const [code,label] of [['zh-Hant','中文'],['en','English']]){
   const button=document.createElement('button');button.type='button';button.textContent=label;button.dataset.language=code;button.onclick=()=>setLanguage(code);box.append(button);switches.push(button);
  }parent.prepend(box);
 }
 function setLanguage(code){
  language=code==='en'?'en':'zh-Hant';try{localStorage.setItem(key,language)}catch{}
  document.documentElement.lang=language;document.title=language==='en'?'Matthew Gallery':'馬太福音展覽館';render(document.body);
  for(const button of switches)button.setAttribute('aria-pressed',String(button.dataset.language===language));
 }
 mount(document.querySelector('#cover .card'));mount(document.getElementById('p-body'));
 setLanguage(language);
 new MutationObserver(records=>{for(const record of records){if(record.type==='childList'){for(const node of record.addedNodes)render(node)}else if(record.type==='characterData')renderText(record.target);else renderElement(record.target)}}).observe(document.body,{subtree:true,childList:true,characterData:true,attributes:true,attributeFilter:['title','placeholder','aria-label','alt']});
 window.GalleryLanguage={set:setLanguage,get current(){return language},translate};
})();
