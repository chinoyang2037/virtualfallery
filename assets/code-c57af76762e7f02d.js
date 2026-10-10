/* Source segments: "cio" "hn"; build 20261010-v1 */

    /* =====================================================================
       我的展廳 v9（優化版）
       - 聚光燈改為固定燈池（不再 30 盞 → 每新增一盞就全部重編 shader）
       - 靜態建築／畫框依材質合併（1,600+ mesh → 約 270）
       - 陰影改為靜態烘一次；解析度依效能自動調整
       - 每幀零配置（不再 new Vector3 / Color / Raycaster）
       - 修正：換圖比例、iPad 多指放開停走、點畫重複開啟、資源外洩等
       ===================================================================== */
    const PRISTINE_HTML = "<!DOCTYPE html>\n" + document.documentElement.outerHTML;   // 匯出用的原始檔
    const AUTOFLY = !!window.GALLERY_AUTOFLY;     // v32：分享檔開啟後自動進入果蠅飛行
    const VIEWONLY = !!window.GALLERY_VIEWONLY;   // 欣賞版：全部編輯與寫入一律短路
    const GID = typeof window.GALLERY_ID === "string" ? window.GALLERY_ID : "";       // 分享檔各自獨立的儲存 ID
    const META_KEY = "my-hall-meta-v1" + (GID ? ":" + GID : "");
    const imgKey = (id) => (GID ? GID + ":" : "") + id;
    const WALL_KEY = "my-hall-wall-v2" + (GID ? ":" + GID : "");
    const LIGHT_KEY = "my-hall-light-v2" + (GID ? ":" + GID : "");
    /* ================= 展廳參數（可由 Excel「展廳參數」工作表修改） ================= */
    const HALL_KEY = "my-hall-hall-v1" + (GID ? ":" + GID : "");
    const WALL_NAMES = ["大理石", "藍色", "叢林", "石材", "古典紅", "白牆"];
    const DECOR_NAMES = ["古典", "高第", "極簡", "現代", "窗景"];   /* v29 室內建築 */
    const DECOR_KEY = "my-hall-decor-v3" + (GID ? ":" + GID : "");
    const DECOR = { mode: 0, meshes: [] };        /* meshes：只在部分建築出現的合併網格 */
    const DM = { classic: 1, gaudi: 2, minimal: 4, modern: 8, window: 16, all: 31 };   /* 位元遮罩：這個網格在哪些建築顯示 */
    const LIGHT_NAMES = ["日照", "聚光", "黃昏", "夜訪"];
    /* now：true＝匯入後立即生效；false＝影響整體配置，存檔後重新載入 */
    const HALL_PARAMS = [
      { key: "name", label: "展廳名稱", type: "text", def: "我的展廳", now: false, note: "開始畫面標題、左上名稱、匯出檔名" },
      { key: "hallName", label: "主廳名稱", type: "text", def: "主展間", now: false, note: "左下房間名稱" },
      { key: "westName", label: "西廳名稱", type: "text", def: "西廳", now: false, note: "左下房間名稱、門上名牌" },
      { key: "eastName", label: "東廳名稱", type: "text", def: "東廳", now: false, note: "左下房間名稱、門上名牌" },
      { key: "west2Name", label: "西二廳名稱", type: "text", def: "西二廳", now: false, note: "左下房間名稱、門上名牌（北面整排窗）" },
      { key: "east2Name", label: "東二廳名稱", type: "text", def: "東二廳", now: false, note: "左下房間名稱、門上名牌（北面整排窗）" },
      { key: "wall", label: "牆面", type: "enum", opts: WALL_NAMES, def: 5, now: true, note: "開啟時的牆面" },
      { key: "light", label: "燈光", type: "enum", opts: LIGHT_NAMES, def: 0, now: true, note: "開啟時的燈光" },
      { key: "decor", label: "建築", type: "enum", opts: DECOR_NAMES, def: 4, now: true, note: "開啟時的室內建築：古典／高第（懸鏈線磚拱）／極簡／現代（白色曲線夾層＋木格柵天花）／窗景（天窗、對外窗與休憩桌椅）" },
      { key: "pitch", label: "畫距", unit: "m", type: "num", def: 4.0, min: 3.4, max: 4.3, now: false, note: "同一面牆相鄰兩幅畫的中心距；東西廳牆長限制最多 4.0" },
      { key: "hangY", label: "畫作中心高度", unit: "m", type: "num", def: 2.15, min: 1.8, max: 2.6, now: false, note: "畫作中心離地" },
      { key: "labelY", label: "標籤高度", unit: "m", type: "num", def: 1.5, min: 0.9, max: 2.0, now: false, note: "標籤中心離地，所有標籤同一條水平線" },
      { key: "labelGap", label: "標籤與畫框距離", unit: "m", type: "num", def: 0.15, min: 0.05, max: 0.4, now: false, note: "標籤與自己畫框外緣的距離" },
      { key: "matW", label: "卡紙寬度", unit: "m", type: "num", def: 0.16, min: 0.04, max: 0.4, now: false, note: "每邊寬度；邊框選「無」的畫不受影響" },
      { key: "eyeH", label: "眼睛高度", unit: "m", type: "num", def: 1.64, min: 1.2, max: 1.9, now: true, note: "參觀者視線高度" },
      { key: "speed", label: "走路速度", unit: "m/s", type: "num", def: 7.4, min: 2, max: 15, now: true, note: "按住 Shift 為 1.55 倍" }
    ];
    function clampParam(p, v) {
      if (p.type === "num") { const n = +v; return isFinite(n) ? Math.min(p.max, Math.max(p.min, n)) : p.def; }
      if (p.type === "enum") { const n = parseInt(v, 10); return n >= 0 && n < p.opts.length ? n : p.def; }
      return String(v).slice(0, 20) || p.def;
    }
    /* 讀取順序：預設 → 分享檔內建（GALLERY_HALL）→ 本機修改 */
    function loadHall() {
      const h = {};
      HALL_PARAMS.forEach((p) => { h[p.key] = p.def; });
      const layers = [window.GALLERY_HALL || {}];
      try { layers.push(JSON.parse(localStorage.getItem(HALL_KEY) || "{}")); } catch {}
      layers.forEach((l) => HALL_PARAMS.forEach((p) => {
        if (l[p.key] !== undefined && l[p.key] !== null && l[p.key] !== "") h[p.key] = clampParam(p, l[p.key]);
      }));
      return h;
    }
    const HALL = loadHall();
    function saveHall() {
      if (VIEWONLY) return false;
      try { localStorage.setItem(HALL_KEY, JSON.stringify(HALL)); return true; } catch { return false; }
    }

    const $ = (id) => document.getElementById(id);
    const PLAYER = { h: HALL.eyeH, speed: HALL.speed, run: HALL.speed * 1.55 };
    const DOOR_W = 4.1;
    const DOOR_H = 3.8;
    const WALL_T = 0.3;
    const LAYOUT = [
      { id: "hall", name: "主展間", w: 28, d: 19, h: 7.2, cx: 0, cz: 0, doors: ["east", "west"] },
      { id: "west", name: "西廳", w: 22, d: 19, h: 7.2, cx: -25, cz: 0, doors: ["east", "west"], skip: ["east"] },
      { id: "east", name: "東廳", w: 22, d: 19, h: 7.2, cx: 25, cz: 0, doors: ["west", "east"], skip: ["west"] },
      /* v68 兩個邊廳：各 10 幅（南北牆各 5），最遠端整面落地玻璃窗 */
      { id: "west2", name: "西二廳", w: 26, d: 19, h: 7.2, cx: -49, cz: 0, doors: ["east"], skip: ["east"], glass: ["west"] },
      { id: "east2", name: "東二廳", w: 26, d: 19, h: 7.2, cx: 49, cz: 0, doors: ["west"], skip: ["west"], glass: ["east"] }
    ];
    /* 五廳沿 x 軸一字排開；DOOR_XS[k] 是 ROOM_ORDER[k] 與 ROOM_ORDER[k+1] 之間的門 */
    const ROOM_ORDER = ["west2", "west", "hall", "east", "east2"];
    const DOOR_XS = [-36, -14, 14, 36];
    /* from → to 依序要穿過的門（x 座標）與行進方向 */
    function doorsBetween(from, to) {
      const i0 = ROOM_ORDER.indexOf(from), i1 = ROOM_ORDER.indexOf(to);
      if (i0 < 0 || i1 < 0 || i0 === i1) return [];
      const dir = i1 > i0 ? 1 : -1, out = [];
      for (let i = i0; i !== i1; i += dir) out.push({ x: DOOR_XS[Math.min(i, i + dir)], dir });
      return out;
    }
    const nearDoor = (x, tol) => DOOR_XS.some((d) => Math.abs(x - d) <= tol);
    /* ================= v77 建築外型：直線／弧形 =================
       所有邏輯（走路、碰撞、導覽、寵物、掛畫位置…）仍在「直線座標」運作；
       只有畫面把世界彎成一段圓弧：x → 沿弧的角度 θ＝x／R，z → 半徑 r＝R－z（北側在外圈）。
       靜態幾何在合併時逐頂點彎曲；畫作、門牌、燈用整體平移＋旋轉；相機只在繪圖與點選時暫時換到彎曲座標 */
    const SHAPE_KEY = "my-hall-shape-v1" + (GID ? ":" + GID : "");
    const ARC = { on: false, deg: 120, R: 1e9, step: 0.8 };
    (function arcLoad() {
      try {
        const o = JSON.parse(localStorage.getItem(SHAPE_KEY) || "null");
        if (o) { ARC.on = !!o.arc; ARC.deg = Math.max(20, Math.min(270, +o.deg || 120)); }
      } catch {}
      let x0 = 1e9, x1 = -1e9;
      LAYOUT.forEach((r) => { x0 = Math.min(x0, r.cx - r.w / 2); x1 = Math.max(x1, r.cx + r.w / 2); });
      ARC.R = (x1 - x0) / (ARC.deg * Math.PI / 180);
    })();
    function bendXZ(x, z) {                              /* 直線座標 → 彎曲座標 [X, Z] */
      if (!ARC.on) return [x, z];
      const th = x / ARC.R, r = ARC.R - z;
      return [r * Math.sin(th), ARC.R - r * Math.cos(th)];
    }
    function bendV(v) { if (ARC.on) { const [X, Z] = bendXZ(v.x, v.z); v.x = X; v.z = Z; } return v; }
    /* 物件（畫作群組、門牌）：位置彎過去，再轉 －θ 對齊弧的切線 */
    function bendObj(o) { if (!ARC.on) return o; const th = o.position.x / ARC.R; bendV(o.position); o.rotation.y -= th; return o; }
    /* 幾何：先把 x 方向太長的三角形切細（沿弧才彎得圓），再逐頂點彎曲、法線跟著轉 */
    function bendGeo(geo) {
      if (!ARC.on) return geo;
      const pa = geo.attributes.position.array, na = geo.attributes.normal.array, ua = geo.attributes.uv ? geo.attributes.uv.array : null;
      const ix = geo.index ? geo.index.array : null, nTri = (ix ? ix.length : pa.length / 3) / 3;
      const P = [], N = [], U = [], step = ARC.step;
      const vtx = (i) => [pa[i * 3], pa[i * 3 + 1], pa[i * 3 + 2], na[i * 3], na[i * 3 + 1], na[i * 3 + 2], ua ? ua[i * 2] : 0, ua ? ua[i * 2 + 1] : 0];
      const mid = (a, b) => a.map((v, k) => (v + b[k]) / 2);
      const emit = (v) => {
        const th = v[0] / ARC.R, r = ARC.R - v[2], c = Math.cos(th), sn = Math.sin(th);
        P.push(r * sn, v[1], ARC.R - r * c);
        N.push(v[3] * c - v[5] * sn, v[4], v[3] * sn + v[5] * c);
        U.push(v[6], v[7]);
      };
      const tri = (a, b, c, d) => {
        const dab = Math.abs(a[0] - b[0]), dbc = Math.abs(b[0] - c[0]), dca = Math.abs(c[0] - a[0]), m = Math.max(dab, dbc, dca);
        if (m <= step || d > 14) { emit(a); emit(b); emit(c); return; }
        if (m === dab) { const q = mid(a, b); tri(a, q, c, d + 1); tri(q, b, c, d + 1); }
        else if (m === dbc) { const q = mid(b, c); tri(a, b, q, d + 1); tri(a, q, c, d + 1); }
        else { const q = mid(c, a); tri(a, b, q, d + 1); tri(q, b, c, d + 1); }
      };
      for (let t = 0; t < nTri; t++) {
        const i0 = ix ? ix[t * 3] : t * 3, i1 = ix ? ix[t * 3 + 1] : t * 3 + 1, i2 = ix ? ix[t * 3 + 2] : t * 3 + 2;
        tri(vtx(i0), vtx(i1), vtx(i2), 0);
      }
      const out = new THREE.BufferGeometry();
      out.setAttribute("position", new THREE.Float32BufferAttribute(P, 3));
      out.setAttribute("normal", new THREE.Float32BufferAttribute(N, 3));
      out.setAttribute("uv", new THREE.Float32BufferAttribute(U, 2));
      out.computeBoundingSphere(); out.computeBoundingBox();
      geo.dispose();
      return out;
    }
    /* 相機：繪圖／點選時暫時搬到彎曲座標，結束後還原（其餘程式看到的永遠是直線座標） */
    const ARC_CAM = { depth: 0, p: null, q: null, qy: null, up: null };
    function camBend() {
      if (!ARC.on || !camera) return;
      if (ARC_CAM.depth++) return;
      if (!ARC_CAM.p) { ARC_CAM.p = new THREE.Vector3(); ARC_CAM.q = new THREE.Quaternion(); ARC_CAM.qy = new THREE.Quaternion(); ARC_CAM.up = new THREE.Vector3(0, 1, 0); }
      ARC_CAM.p.copy(camera.position); ARC_CAM.q.copy(camera.quaternion);
      const th = camera.position.x / ARC.R;
      bendV(camera.position);
      ARC_CAM.qy.setFromAxisAngle(ARC_CAM.up, -th);
      camera.quaternion.premultiply(ARC_CAM.qy);
      camera.updateMatrixWorld(true);
    }
    function camUnbend() {
      if (!ARC.on || !camera || !ARC_CAM.depth) return;
      if (--ARC_CAM.depth) return;
      camera.position.copy(ARC_CAM.p); camera.quaternion.copy(ARC_CAM.q);
      camera.updateMatrixWorld(true);
    }
    const TOUCH = ("ontouchstart" in window) && (
      window.matchMedia("(pointer: coarse)").matches ||
      navigator.maxTouchPoints > 1 ||
      /iPad|iPhone|iPod/.test(navigator.userAgent) ||
      (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1)
    );
    /* 品質設定：平板較保守 */
    const DPR = Math.min(window.devicePixelRatio || 1, 2);
    const Q = {
      spotPool: TOUCH ? 5 : 8,          // 同時點亮的畫作聚光燈數
      shadowSize: TOUCH ? 1024 : 2048,
      texMax: TOUCH ? 1024 : 2048,      // 送進 GPU 的貼圖最長邊
      uploadMax: 2048,                  // 使用者換圖存檔最長邊
      aniso: TOUCH ? 4 : 8,
      dprStart: Math.min(DPR, TOUCH ? 1.5 : 2),
      dprMin: 1
    };

    let walkables = [];
    let wallMeshes = [];
    const WALLS = { mode: 1, mats: [] };
    const FRAME_PALETTES = {
      white: { o: "#f3eee4", m: "#ffffff", l: "#d4cfc4", metal: 0.12, rough: 0.48, map: false },
      black: { o: "#171717", m: "#2c2c2c", l: "#080808", metal: 0.38, rough: 0.38, map: false },
      gold: { o: "#b8893a", m: "#e8d39a", l: "#8a5e22", metal: 0.78, rough: 0.26, map: true },
      silver: { o: "#b8bcc2", m: "#e8eaed", l: "#7c8188", metal: 0.84, rough: 0.2, map: true }
    };

    let scene, camera, renderer, clock;
    let exploring = false, locked = false;
    let yaw = 0, pitch = 0, wheelBoost = 0;
    let move = { f: 0, b: 0, l: 0, r: 0, run: 0 };
    let artworks = [];
    let pickTargets = [];
    let lookTarget = null;
    let editing = null;
    let goldTex;
    let SHARED = null;
    let stick = { x: 0, y: 0 };
    let dragLook = false, dragMoved = 0;
    let curRoomName = "", curRoomId = "hall";
    let lastLookText = "", lastLookOn = false;
    let hungAll = false;
    const LIGHT_MODES = [
      { id: "day", label: "日照", hemi: 0.95, ambient: 0.48, sun: 1.35, exposure: 1.14, fog: 0.006, torch: 0, spotBase: 6.2, spotFocus: 9, flicker: 0, bg: "#2a241c", hemiSky: 0xf3ead8, hemiGnd: 0x3a3228, sunCol: 0xfff3dc, torchCol: 0xffe6c4, sunY: 26 },
      { id: "spot", label: "聚光", hemi: 0.28, ambient: 0.12, sun: 0.28, exposure: 1.02, fog: 0.014, torch: 1.4, spotBase: 1.5, spotFocus: 15, flicker: 0, bg: "#14110e", hemiSky: 0xc9b89a, hemiGnd: 0x1a1612, sunCol: 0xffe2b0, torchCol: 0xffe6c4, sunY: 26 },
      { id: "dusk", label: "黃昏", hemi: 0.35, ambient: 0.18, sun: 0.85, exposure: 1.08, fog: 0.016, torch: 0.6, spotBase: 3.2, spotFocus: 11, flicker: 0.25, bg: "#2a1810", hemiSky: 0xffb080, hemiGnd: 0x3a1810, sunCol: 0xff7a3a, torchCol: 0xffc090, sunY: 16 },
      { id: "night", label: "夜訪", hemi: 0.08, ambient: 0.04, sun: 0.05, exposure: 0.88, fog: 0.022, torch: 8.5, spotBase: 0.2, spotFocus: 16, flicker: 1, bg: "#07080e", hemiSky: 0x6a7aaa, hemiGnd: 0x0a0c14, sunCol: 0x8899cc, torchCol: 0xffc27a, sunY: 18 }
    ];
    /* v72 窗外（照片、高窗天空、天窗）跟著燈光模式變色：乘上一層色調，黃昏偏橘、夜訪偏暗藍 */
    const WIN_TINT = [];
    const WIN_TINTS = {
      day:   { c: "#ffffff", sheen: 0.75, em: 1, star: 0 },
      spot:  { c: "#d6d1c7", sheen: 0.6, em: 0.8, star: 0 },
      dusk:  { c: "#f09a62", sheen: 0.55, em: 0.6, star: 0.12, sky: "#e0865a" },
      night: { c: "#243150", sheen: 0.06, em: 0.1, star: 1, sky: "#0b1226" }
    };
    const EMIS = [];
    const STAR_MATS = [];
    const SKY_TINT = [];        /* 純天空（高窗、天窗）：夜裡壓得更暗，星星才看得清楚 */
    const SKY_C = new THREE.Color();       /* v73 星空銀河：夜訪全亮、黃昏淡淡一點、白天看不到 */            /* 自發光的淺色材質（圓凳、窗框、天花…）：夜裡跟著變暗，不會自己發亮 */
    const WIN_C = new THREE.Color();
    const LIGHTS = { mode: 1, hemi: null, ambient: null, sun: null, torch: null, torchTarget: null };
    const SPOTS = [];          // 聚光燈池 { light, art }
    let spotTimer = 0;

    /* ---- 每幀重用的暫存物件（避免 GC 卡頓） ---- */
    const TMP = {
      fwd: null, right: null, dir: null, up: null, v: null,
      ray: null, center: null, mouse: null
    };
    function initTmp() {
      TMP.fwd = new THREE.Vector3(); TMP.right = new THREE.Vector3();
      TMP.dir = new THREE.Vector3(); TMP.up = new THREE.Vector3(0, 1, 0);
      TMP.v = new THREE.Vector3();
      TMP.ray = new THREE.Raycaster(); TMP.center = new THREE.Vector2(0, 0); TMP.mouse = new THREE.Vector2();
      LIGHT_MODES.forEach((m) => {
        m.c = {
          hemiSky: new THREE.Color(m.hemiSky), hemiGnd: new THREE.Color(m.hemiGnd),
          sun: new THREE.Color(m.sunCol), torch: new THREE.Color(m.torchCol), bg: new THREE.Color(m.bg)
        };
      });
    }

    function uiBlocked() {
      return $("inspector").classList.contains("open") || !$("blocker").classList.contains("hidden") || $("plan").classList.contains("open");
    }

    /* ================= 資料存取 ================= */
    function loadMeta() {
      try { return JSON.parse(localStorage.getItem(META_KEY) || "{}"); } catch { return {}; }
    }
    function saveMeta(map) {
      if (VIEWONLY) return false;
      try { localStorage.setItem(META_KEY, JSON.stringify(map)); return true; } catch { return false; }
    }
    function lsGet(k) { try { return localStorage.getItem(k); } catch { return null; } }
    /* ================= v31 首頁中／英切換 ================= */
    const I18N = { en: {"crest": "G", "sub": "Five salons, fifty paintings", "hint": "A private gallery in five salons. Open this file in any browser; on iPad, use Safari. Click a painting to change its image or caption.", "hintView": "A private gallery in five salons. Walk in and click any painting to see it up close, with its story.", "enter": "Enter the gallery", "import": "Import 50 paintings", "import.t": "Select several images at once, or drag them onto this page", "dir": "Import folder", "dir.t": "Pick a folder holding the paintings and its Excel sheet, or drag the folder onto this page. It is saved to a memory slot.", "slots": "Saved folders", "slotEmpty": "Empty", "slotX": "Clear this slot", "kHome": "Back to cover", "export": "Export share file", "export.t": "Creates one HTML file with every image and caption, ready to send", "shareView": "Export view-only copy", "shareView.t": "Creates a view-only copy: visitors can look but cannot change images or text", "xlsOut": "Export to Excel", "xlsOut.t": "Exports title, artist, year, frame, shape, mat and caption for all 50 works", "xlsIn": "Import from Excel", "xlsIn.t": "Fills titles, artists and captions by file name", "tour": "Preview tour (G)", "tour.t": "The camera walks through the salons on its own", "rec": "Record tour (R)", "rec.t": "Runs the tour and saves it as a video file", "recMp4.t": "Record the tour straight to an MP4 video (with music)", "recWebp.t": "Record the tour as an animated WebP image (12 fps, half resolution)", "hArch": "Architecture", "lInterior": "Interior", "lShape": "Layout", "shLine": "Straight", "shArc": "Arc", "shDeg": "Curve", "lView": "Window view", "viewTip": "Pick a wing, then a view · drop an image or double-click a slot to replace · ＋ adds a slot · W/E tags show which wing uses it", "dClassic": "Classique", "dClassic.t": "Gilded cornices, coffered ceiling and painted medallions", "dGaudi": "Gaudí", "dGaudi.t": "Catenary brick vaults after Gaudí's attic at La Pedrera, with hexagonal paving", "dMin": "Minimal", "dMin.t": "Plain white ceiling, skylight and a thin line of light", "dMod": "Modern", "dMod.t": "Curved white mezzanine, timber-slat soffit, terrazzo floor and concrete columns", "dWin": "Windows", "dWin.t": "Leaf-shaped skylights, windows onto a garden and simple seating", "hTour": "Tour and recording", "lSalon": "Salon", "sAll": "All", "sHall": "Main salon", "sWest": "West salon", "sEast": "East salon", "sWest2": "West wing", "sEast2": "East wing", "lAspect": "Aspect", "lLen": "Length", "len30": "30 s", "len45": "45 s", "len60": "60 s", "len90": "90 s", "len120": "120 s", "len180": "180 s", "lPick": "Paintings", "pSome": "Highlights", "pSome.t": "Picks 6 to 16 works to fit the length", "pAll": "Every work", "pAll.t": "Stops at every work; the route sets the length (about 2 to 3 minutes)", "lCap": "Titles", "cOn": "Show", "cOn.t": "Fades each title in at the bottom while the camera pauses", "cOff": "Hide", "lFmt": "Format", "fVid": "Video", "fVid.t": "MP4 (or WebM), suited to Facebook", "fWebp": "Animated WebP", "fWebp.t": "Animated WebP: frame by frame, 12 fps, half resolution; plays as an animated image", "hPano": "360° panorama", "lPfmt": "Format", "pJpg.t": "JPEG with GPano tags; Facebook and Google Photos show it as a 360 photo", "pWebp.t": "WebP is smaller (about 60–70% of JPG) and also carries GPano; use JPG for Facebook", "pano": "Export 360° panorama", "pano.t": "Renders a 360 image from the centre of the salon chosen above", "loading": "Hanging the paintings…", "kWalk": "Walk", "kScroll": "Scroll", "kFwd": "Move forward", "kDrag": "Drag", "kLook": "Look around", "kStick": "Left stick", "kPad": "Walk on iPad", "kClick": "Click a painting", "kEdit": "View or edit", "kEditView": "View it up close", "kWalls": "Walls", "kLight": "Lighting", "kArch": "Architecture", "kMenu": "Show or hide menu", "kDrone": "Drone view", "howto": "<b>Changing paintings and sharing</b>\n        <ol>\n          <li>Walk in, click a painting, choose 更換圖片 (replace image), edit the title and caption, then press 儲存 (save).</li>\n          <li>Image files: main salon <code>works/01.jpg</code>–<code>10.jpg</code>, west salon <code>11</code>–<code>20</code>, east salon <code>21</code>–<code>30</code>. Overwrite a file with the same name to replace it.</li>\n          <li>To replace everything at once, use Import 50 paintings and select several images; on a computer you can also drag them onto this page. File names become titles. Start a name with <code>01_</code>–<code>30_</code> to choose its position; the rest fill in by name.</li>\n          <li>Captions in Excel: Export to Excel gives you all 30 entries. Edit and save, then use Import from Excel. Frame, shape and mat columns have drop-down lists. The second sheet, 展廳參數, sets salon names, walls, lighting, architecture, spacing, heights and mat width.</li>\n          <li>Sharing: Export share file creates one HTML with every image and caption; the recipient simply opens it in a browser. Export Fly copy makes a view-only file that starts flying on its own. Inside the gallery, 首頁 (Home) brings you back here.</li>\n        </ol>", "howtoView": "<b>How to visit</b><ol>\n          <li>Press Enter the gallery. Walk with <code>W/A/D＋↓</code> or the scroll wheel and drag to look around; on iPad use the stick at lower left and 前進 at lower right, and swipe to look.</li>\n          <li>Walk up to any painting; its frame lights up. Click to see it large, with the artist and caption.</li>\n          <li>Keys <code>1 2 3</code> change the walls, <code>4 5 6 7</code> the lighting and <code>B</code> the architecture. <code>H</code> hides the menu.</li>\n          <li>Inside the gallery, 首頁 (Home) brings you back here.</li>\n          <li>This is a view-only copy; images and text are fixed.</li></ol>", "progHang": "Hanging the paintings… {done} of {total}", "progReady": "{n} works ready", "flyIn": "Fly in (F)", "flyIn.t": "Enter the gallery in Fly mode: the camera glides on its own and stops in front of paintings", "shareFly": "Export Fly copy", "shareFly.t": "Creates a view-only copy that starts flying as soon as the paintings are hung", "hMusic": "Music", "lTrack": "Track", "mOff": "Off", "mAmb": "Ambient", "mAmb.t": "Soft bells over slow pad chords, generated live in the browser: no file, no copyright to worry about", "mFile": "My music", "mFile.t": "Plays an MP3 or M4A you choose, on a loop", "pickMusic": "Choose file…", "pickMusic.t": "The file is kept on this device and packed into share files (up to 20 MB)", "musicLib": "Free music · YouTube", "musicLibNote": "Want different music? Open “Free music · YouTube” (sign in to YouTube), download an MP3, then drag it onto “My music”. Tracks marked CC need the artist credited if you share publicly.", "musicLib.t": "Opens the YouTube Audio Library in a new tab: free music you may download. Drag the downloaded MP3 onto “My music”.", "lVol": "Volume", "noMusic": "No file chosen", "kMusic": "Music on or off", "musicNeedFile": "Choose a music file first.", "musicBig": "This file is over 20 MB; it will play here but won't be packed into share files.", "musicBad": "This file can't be played. Try an MP3 or M4A.", "musicTap": "Tap for music", "mFree": "Free flow", "mFree.t": "Unhurried pad chords with scattered bells; no fixed beat", "mFrench": "French café", "mFrench.t": "A gentle musette waltz: accordion melody, oom-pah-pah bass and chords", "mBossa": "Japanese", "mBossa.t": "Soft Japanese-style bossa nova: nylon-guitar comping, brushed shaker and a hummed melody", "seenClear": "Clear red dots ({n})", "seenClear.t": "A red dot appears on a painting's label once you've opened it. This clears them on this device.", "seenDone": "Red dots cleared.", "plan": "Route map (P)", "plan.t": "A floor plan of the five salons showing where you have walked and which paintings you've viewed", "planTitle": "Your route", "planClose": "Close", "planClear": "Clear route", "planSave": "Save image", "planStats": "{dist} m travelled, {time} in the gallery, {seen} of {total} paintings viewed", "planHint": "Click a painting on the plan to go straight to it.", "planEmpty": "No route yet. Enter the gallery and look around.", "planCleared": "Route cleared.", "lgWalk": "Walking", "lgFly": "Fly", "lgDrone": "Drone", "lgTour": "Tour", "lgSeen": "Viewed", "lgUnseen": "Not yet", "lgYou": "You", "kPlan": "Route map", "min": "{m} min", "mCarmen": "Carmen", "mCarmen.t": "Spanish habanera in the manner of Bizet's Carmen: D minor, habanera bass, guitar, castanets and sultry chromatic lines", "mOpera": "Opera", "mOpera.t": "A slow romantic aria: string section, harp arpeggios and a soprano line that rises to a climax", "birdIn": "Hummingbird (N)", "birdIn.t": "Enter as a gentle hummingbird: it drifts slowly between paintings on every wall and hovers at least 2 m away", "kBird": "Hummingbird", "lgBird": "Hummingbird", "dogIn": "Puppy (J)", "dogIn.t": "See the gallery at puppy height: it trots from painting to painting, sits 2 m away and looks up with a tilted head", "kDog": "Puppy", "lgDog": "Puppy", "animals": "Walk as an animal", "elIn": "Elephant (Y)", "elIn.t": "See the gallery from 3 m up: it lumbers slowly between paintings, swings its trunk and sometimes trumpets before looking", "catIn": "Kitten (U)", "catIn.t": "See the gallery from a kitten's eye line: soft-pawed trots, sudden little dashes, a glance around and a meow or two", "kEl": "Elephant", "kCat": "Kitten", "lgEl": "Elephant", "lgCat": "Kitten", "parIn": "Parrot (O)", "parIn.t": "A chatty parrot flies from painting to painting, perches 2 m away and talks, sometimes calling out the title", "kPar": "Parrot", "lgPar": "Parrot", "mOcean": "Ocean waves", "mOcean.t": "Slow breaking waves with foam, a soft pad underneath and the odd wind chime"}, zh: {"crest": "廳", "sub": "五間展廳，五十幅畫", "hint": "五間展廳、五十幅畫。電腦可雙擊開啟；iPad 請用 Safari 開啟。點畫即可改圖、改說明。", "hintView": "五間展廳、五十幅畫。電腦可雙擊開啟；iPad 請用 Safari 開啟。點畫即可看大圖與說明。", "enter": "進入展廳", "import": "匯入五十幅畫", "import.t": "一次選多張圖，也可以直接拖曳到這個畫面", "dir": "匯入作品目錄", "dir.t": "選一個放了畫作與 Excel 表格的資料夾（也可以把整個資料夾拖進來），匯入後自動存進記憶組", "slots": "記憶目錄", "slotEmpty": "空", "slotX": "清除這一組", "kHome": "回到首頁", "export": "匯出分享檔", "export.t": "產生一個包含目前所有圖片與文字的 HTML，可以傳給別人", "shareView": "分享檔（欣賞版）", "shareView.t": "產生唯讀的欣賞版：對方只能看，不能改圖也不能改文字", "xlsOut": "Excel 匯出", "xlsOut.t": "匯出目前 50 幅的標題、作者、年代、畫框、形狀、邊框、說明", "xlsIn": "Excel 匯入", "xlsIn.t": "依檔名自動填入標題、作者、說明", "tour": "導覽預覽 · G", "tour.t": "相機自動走完五間展廳，可先預覽運鏡", "rec": "導覽錄影 · R", "rec.t": "自動導覽並直接錄成影片檔，適合貼到 FB", "recMp4.t": "導覽錄影，直接存成 MP4 影片（含配樂）", "recWebp.t": "導覽錄影，存成動態 WebP 圖（12 fps、半解析度）", "hArch": "室內建築", "lInterior": "建築", "lShape": "外型", "shLine": "直線", "shArc": "弧形", "shDeg": "弧度", "lView": "窗外景色", "viewTip": "先選要設定的廳，再點景色・圖片拖到格子上或雙擊可更換・＋ 新增格子・格子上的「西／東」表示哪一廳在用", "dClassic": "古典", "dClassic.t": "金色線腳、藻井與彩繪圓頂", "dGaudi": "高第", "dGaudi.t": "仿米拉之家閣樓的懸鏈線磚拱與六角地磚", "dMin": "極簡", "dMin.t": "白色平頂、天窗與燈帶", "dMod": "現代", "dMod.t": "白色曲線夾層、木格柵天花、水磨石地坪與清水混凝土柱", "dWin": "窗景", "dWin.t": "葉形天窗、牆面對外窗與高窗、休憩圓凳桌椅", "hTour": "導覽／錄影設定", "lSalon": "展廳", "sAll": "全部", "sHall": "主展間", "sWest": "西廳", "sEast": "東廳", "sWest2": "西二廳", "sEast2": "東二廳", "lAspect": "比例", "lLen": "長度", "len30": "30 秒", "len45": "45 秒", "len60": "60 秒", "len90": "90 秒", "len120": "120 秒", "len180": "180 秒", "lPick": "取樣", "pSome": "精選", "pSome.t": "依長度抽選 6～16 幅代表作", "pAll": "全部", "pAll.t": "每一幅都走到並停留，長度改由實際路線決定（約 2～3 分鐘）", "lCap": "畫名", "cOn": "顯示", "cOn.t": "停留看畫時，畫面下方淡入淡出顯示畫名", "cOff": "不顯示", "lFmt": "錄影格式", "fVid": "影片", "fVid.t": "MP4（或 WebM），適合貼到 FB", "fWebp": "動態 WebP", "fWebp.t": "動態 WebP：逐格輸出、12 fps、半解析度，不會漏格；可當動圖使用，FB 不會當影片", "hPano": "360 全景", "lPfmt": "格式", "pJpg.t": "JPEG＋GPano 標記，FB／Google 相簿可辨識為 360 照片", "pWebp.t": "WebP 檔案較小（約 JPG 的 6～7 成），同樣寫入 GPano；FB 上傳 360 建議仍用 JPG", "pano": "360 全景輸出", "pano.t": "從展廳中央算出 360 環景圖（依上方「展廳」選擇），含 GPano 標記", "loading": "正在掛畫…", "kWalk": "走動", "kScroll": "滾輪", "kFwd": "前進", "kDrag": "滑鼠／滑動", "kLook": "轉頭", "kStick": "左下搖桿", "kPad": "平板走動", "kClick": "點畫", "kEdit": "看／改", "kEditView": "看大圖", "kWalls": "牆面", "kLight": "燈光", "kArch": "建築", "kMenu": "顯示／隱藏選單", "kDrone": "無人機 FPV", "howto": "<b>如何換畫與分享</b>\n        <ol>\n          <li>走進展廳，點一幅畫 →「更換圖片」選檔，改標題與說明後按「儲存」。</li>\n          <li>主廳圖：<code>works/01.jpg</code>…<code>10.jpg</code>；西廳：<code>11</code>…<code>20</code>；東廳：<code>21</code>…<code>30</code>。覆蓋同名檔即可。</li>\n          <li>一次換全部：按「匯入五十幅畫」多選圖片（電腦也可直接拖曳進來），檔名就是標題。檔名開頭加 <code>01_</code>～<code>30_</code> 可指定掛在第幾幅，其餘依檔名順序補位。</li>\n          <li>Excel 填標籤：按「Excel 匯出」取得目前 30 幅的資訊，在 Excel 修改後存檔，再按「Excel 匯入」套用。畫框、形狀、邊框欄都有下拉選單；第二張工作表「展廳參數」可改展廳名稱、牆面、燈光、建築、畫距、高度、卡紙寬度等。</li>\n          <li>分享：按「匯出分享檔」會產生一個包含目前所有圖片與文字的 HTML，傳給對方用瀏覽器開啟即可。「分享檔（直接飛行）」會產生開啟後自動飛行的欣賞版。展廳裡按右上「首頁」可回到這個畫面。</li>\n        </ol>", "howtoView": "<b>怎麼逛</b><ol>\n          <li>按「進入展廳」，用 <code>W/A/D＋↓</code> 或滾輪走動，滑鼠拖曳轉頭；iPad 用左下搖桿與右下「前進」，滑動畫面轉頭。</li>\n          <li>走近任一幅畫，畫框會亮起來，點一下即可看大圖、作者與說明。</li>\n          <li>鍵盤 <code>1 2 3</code> 換牆面、<code>4 5 6 7</code> 換燈光、<code>B</code> 換建築，或用右上選單切換；<code>H</code> 可隱藏選單專心欣賞。</li>\n          <li>展廳裡按右上「首頁」可回到這個畫面。</li>\n          <li>這是欣賞版，圖片與文字都已固定，不會被更動。</li></ol>", "progHang": "正在掛畫… {done} / {total}", "progReady": "{n} 幅作品已就緒", "flyIn": "直接飛行 · F", "flyIn.t": "進入展廳並立即啟動果蠅模式：自動飛行、停在畫前；按 F、Esc 或 W/A/D＋↓ 接手", "shareFly": "分享檔（直接飛行）", "shareFly.t": "產生唯讀欣賞版，對方開啟、畫掛好後就自動進入果蠅飛行", "hMusic": "配樂", "lTrack": "曲目", "mOff": "關閉", "mAmb": "內建輕音樂", "mAmb.t": "瀏覽器即時合成的柔和鐘琴與鋪底和弦：不需檔案，也沒有版權問題", "mFile": "自選音樂", "mFile.t": "循環播放你選的 MP3／M4A", "pickMusic": "選擇音樂檔…", "pickMusic.t": "檔案會存在這台裝置，匯出分享檔時一併打包（20 MB 以內）", "musicLib": "免費音樂庫 · YouTube", "musicLibNote": "想換配樂？點「免費音樂庫 · YouTube」（需登入 YouTube）下載 MP3，拖到「自選」即可播放。標示 CC 的曲子公開分享時請註明作者。", "musicLib.t": "在新分頁開啟 YouTube 音效庫（需登入）：可合法下載的免費音樂。下載 MP3 後拖到「自選」即可播放；標示 CC 的曲子公開分享時需註明作者。", "lVol": "音量", "noMusic": "尚未選擇檔案", "kMusic": "配樂開關", "musicNeedFile": "請先選擇音樂檔。", "musicBig": "檔案超過 20 MB：這台可以播放，但匯出分享檔時不會打包。", "musicBad": "這個檔案無法播放，請改用 MP3 或 M4A。", "musicTap": "點一下播放配樂", "mFree": "自由風", "mFree.t": "無固定節拍的鋪底和弦與零星鐘琴，最放鬆", "mFrench": "法式風", "mFrench.t": "巴黎咖啡館的慢速手風琴華爾滋：oom-pah-pah 低音與和弦", "mBossa": "日式", "mBossa.t": "日式的輕柔 Bossa Nova：尼龍吉他切分和弦、沙鈴，加上哼唱般的旋律", "seenClear": "清除紅點（{n}）", "seenClear.t": "點開看過的畫，白色標籤右下角會貼上小紅點；這裡可清除本機的紅點紀錄", "seenDone": "已清除紅點。", "plan": "觀看路線 · P", "plan.t": "五間展廳的平面圖：畫出你走過的路線，以及看過哪些畫", "planTitle": "觀看路線", "planClose": "關閉", "planClear": "清除路線", "planSave": "存成圖片", "planStats": "移動 {dist} 公尺、停留 {time}、已看 {seen} / {total} 幅", "planHint": "點平面圖上的畫，可直接走到它面前。", "planEmpty": "還沒有路線紀錄，進入展廳走走看吧。", "planCleared": "已清除路線。", "lgWalk": "步行", "lgFly": "果蠅飛行", "lgDrone": "無人機", "lgTour": "導覽", "lgSeen": "已看", "lgUnseen": "未看", "lgYou": "目前位置", "kPlan": "路線平面圖", "min": "{m} 分鐘", "mCarmen": "卡門風", "mCarmen.t": "比才《卡門》式的西班牙哈巴涅拉：d 小調、哈巴涅拉低音、吉他、響板與半音下行旋律", "mOpera": "歌劇風", "mOpera.t": "浪漫慢板詠嘆調：弦樂鋪底、豎琴琶音，女高音旋律逐步推向高潮", "birdIn": "蜂鳥 · N", "birdIn.t": "化身溫和的蜂鳥：在四面牆的畫之間慢慢飛、隨意挑畫，停在畫前 2 公尺外懸停；按 N、Esc 或 W/A/D＋↓ 接手", "kBird": "蜂鳥", "lgBird": "蜂鳥", "dogIn": "小狗 · J", "dogIn.t": "用小狗的高度逛展廳：小跑步到畫前 2 公尺外坐下、歪頭抬頭看畫；按 J、Esc 或 W/A/D＋↓ 接手", "kDog": "小狗", "lgDog": "小狗", "animals": "動物視角", "elIn": "大象 · Y", "elIn.t": "用 3 公尺高的大象視角：慢慢晃步到畫前、偶爾甩鼻子，看畫前可能長鳴一聲；按 Y、Esc 或 W/A/D＋↓ 接手", "catIn": "小貓 · U", "catIn.t": "用小貓的低視角：輕巧小跑、偶爾衝刺、東張西望，看畫前可能喵幾聲；按 U、Esc 或 W/A/D＋↓ 接手", "kEl": "大象", "kCat": "小貓", "lgEl": "大象", "lgCat": "小貓", "parIn": "鸚鵡 · O", "parIn.t": "話很多的鸚鵡：飛到畫前 2 公尺外停下，隨機說話，有時會喊出畫名；按 O、Esc 或 W/A/D＋↓ 接手", "kPar": "鸚鵡", "lgPar": "鸚鵡", "mOcean": "海浪", "mOcean.t": "緩慢拍岸的海浪與浪花聲，底下襯著柔和和弦，偶爾有風鈴"} };
    const LANG_KEY = "gallery-lang";
    let LANG = (lsGet(LANG_KEY) === "zh") ? "zh" : "en";
    let progState = null;                      /* 目前 load-progress 顯示的是哪一句（語言切換時可重寫） */
    function T(key, vars) {
      let str = (I18N[LANG] && I18N[LANG][key]) || I18N.en[key] || key;
      if (vars) str = str.replace(/\{(\w+)\}/g, (m, k) => (vars[k] !== undefined ? vars[k] : m));
      return str;
    }
    function setProg(key, vars) {
      progState = { key, vars };
      const el = document.getElementById("load-progress");
      if (el) { el.textContent = T(key, vars); el.classList.remove("warn"); }
    }
    function coverTitle() {
      const custom = HALL.name && HALL.name !== "我的展廳";
      return custom ? HALL.name : (LANG === "zh" ? "我的展廳" : "La Galerie");
    }
    function applyLang(l) {
      LANG = l === "zh" ? "zh" : "en";
      lsSet(LANG_KEY, LANG);
      document.documentElement.lang = LANG === "zh" ? "zh-Hant" : "en";
      document.querySelectorAll("[data-i18n]").forEach((el) => {
        const v = T(el.dataset.i18n);
        if (/<[a-z]/i.test(v)) el.innerHTML = v; else el.textContent = v;
      });
      document.querySelectorAll("[data-i18n-title]").forEach((el) => { el.title = T(el.dataset.i18nTitle); });
      const t = coverTitle();
      document.querySelectorAll("#blocker h2, #loader h1").forEach((el) => { el.textContent = t; });
      if (progState) setProg(progState.key, progState.vars);
      if (typeof seenUI === "function") seenUI();
      if (typeof renderSlots === "function") { try { renderSlots(); } catch {} }
      if (document.getElementById("plan") && document.getElementById("plan").classList.contains("open")) planDraw();
      document.querySelectorAll("#lang-switch [data-lang]").forEach((b) => {
        const on = b.dataset.lang === LANG;
        b.classList.toggle("on", on);
        b.setAttribute("aria-pressed", on ? "true" : "false");
      });
    }
    function lsSet(k, v) { try { localStorage.setItem(k, v); } catch {} }   /* 牆面／燈光是觀看偏好，欣賞版仍可記住 */
    function applySavedText() {
      const layers = [window.GALLERY_META || {}, loadMeta()];   // 分享檔內建文字 → 本機修改
      GALLERY.rooms.forEach((room) => {
        room.works.forEach((w) => {
          layers.forEach((meta) => {
            const m = meta[w.id];
            if (!m) return;
            if (m.title) w.title = m.title;
            ["artist", "year", "description"].forEach((k) => { if (typeof m[k] === "string") w[k] = m[k]; });
            if (m.frame) w.frame = m.frame;
            if (m.file) w.fileName = m.file;
            if (m.shape) w.shape = m.shape;
            if (m.matte) w.matte = m.matte;
          });
        });
      });
    }

    let dbPromise = null;
    function openDB() {
      if (dbPromise) return dbPromise;
      dbPromise = new Promise((resolve, reject) => {
        const req = indexedDB.open("my-hall-images", 1);
        req.onupgradeneeded = () => req.result.createObjectStore("img");
        req.onsuccess = () => resolve(req.result);
        req.onerror = () => { dbPromise = null; reject(req.error); };
      });
      return dbPromise;
    }
    async function idbGet(id) {
      try {
        const db = await openDB();
        return await new Promise((resolve) => {
          const q = db.transaction("img").objectStore("img").get(id);
          q.onsuccess = () => resolve(q.result || null);
          q.onerror = () => resolve(null);
        });
      } catch { return null; }
    }
    async function idbPut(id, blob) {
      if (VIEWONLY) throw new Error("VIEWONLY");
      const db = await openDB();
      return new Promise((resolve, reject) => {
        const q = db.transaction("img", "readwrite").objectStore("img").put(blob, id);
        q.onsuccess = () => resolve();
        q.onerror = () => reject(q.error);
      });
    }

    async function idbDel(id) {
      if (VIEWONLY) return;
      try {
        const db = await openDB();
        await new Promise((resolve) => {
          const q = db.transaction("img", "readwrite").objectStore("img").delete(id);
          q.onsuccess = () => resolve(); q.onerror = () => resolve();
        });
      } catch {}
    }

    /* ================= 貼圖 ================= */
    function loadImage(url) {
      return new Promise((resolve, reject) => {
        const img = new Image();
        img.onload = () => resolve(img);
        img.onerror = reject;
        img.src = url;
      });
    }
    function scaleToCanvas(img, max) {
      const w = img.naturalWidth || img.width, h = img.naturalHeight || img.height;
      const s = Math.min(1, max / Math.max(w, h));
      const c = document.createElement("canvas");
      c.width = Math.max(1, Math.round(w * s)); c.height = Math.max(1, Math.round(h * s));
      c.getContext("2d").drawImage(img, 0, 0, c.width, c.height);
      return c;
    }
    function colorTex(src) {
      const t = new THREE.Texture(src);
      if (THREE.SRGBColorSpace) t.colorSpace = THREE.SRGBColorSpace;
      t.anisotropy = Math.min(Q.aniso, renderer.capabilities.getMaxAnisotropy());
      t.needsUpdate = true;
      return t;
    }
    /* 圖 → { tex, url, aspect }；過大的圖先縮小再上 GPU */
    function texFromImage(img, url) {
      const w = img.naturalWidth || img.width, h = img.naturalHeight || img.height;
      const src = Math.max(w, h) > Q.texMax ? scaleToCanvas(img, Q.texMax) : img;
      return { tex: colorTex(src), url, aspect: w && h ? w / h : 0.75 };
    }

    function placeholderCanvas(work) {
      const c = document.createElement("canvas");
      c.width = 768; c.height = 1024;
      const ctx = c.getContext("2d");
      ctx.fillStyle = "#2a241c"; ctx.fillRect(0, 0, 768, 1024);
      ctx.strokeStyle = "#c6a15b"; ctx.strokeRect(28, 28, 712, 968);
      ctx.fillStyle = "#e8d5a3"; ctx.textAlign = "center";
      ctx.font = "600 42px Microsoft JhengHei, PingFang TC, sans-serif";
      ctx.fillText(work.title, 384, 480);
      ctx.fillStyle = "#8a7d68"; ctx.font = "24px Microsoft JhengHei, PingFang TC, sans-serif";
      ctx.fillText("點擊後可更換圖片", 384, 540);
      return c;
    }

    async function texFor(work) {
      const blob = await idbGet(imgKey(work.id));
      if (blob) {
        const url = URL.createObjectURL(blob);
        try { return { ...texFromImage(await loadImage(url), url), blob }; } catch { URL.revokeObjectURL(url); }
      }
      try { return texFromImage(await loadImage(work.file), work.file); } catch {}
      const c = placeholderCanvas(work);
      return { tex: colorTex(c), url: null, aspect: 0.75, placeholder: c };
    }

    function makeGoldTex() {
      const c = document.createElement("canvas");
      c.width = c.height = 256;
      const ctx = c.getContext("2d");
      const g = ctx.createLinearGradient(0, 0, 256, 256);
      g.addColorStop(0, "#e8d5a3"); g.addColorStop(0.5, "#9a7b3c"); g.addColorStop(1, "#6a5124");
      ctx.fillStyle = g; ctx.fillRect(0, 0, 256, 256);
      for (let i = 0; i < 80; i++) {
        ctx.fillStyle = "rgba(255,240,200,0.08)";
        ctx.fillRect(Math.random() * 256, Math.random() * 256, 8, 1);
      }
      const t = new THREE.Texture(c); t.needsUpdate = true; t.wrapS = t.wrapT = THREE.RepeatWrapping;
      return t;
    }

    /* 大理石：repX/repY 為「每公尺幾次」（配合世界座標 UV） */
    function makeMarble(repX, repY) {
      const c = document.createElement("canvas");
      c.width = c.height = 512;
      const ctx = c.getContext("2d");
      ctx.fillStyle = "#d9cbb3"; ctx.fillRect(0, 0, 512, 512);
      ctx.strokeStyle = "rgba(90,70,48,0.18)";
      for (let i = 0; i < 18; i++) {
        ctx.beginPath();
        ctx.moveTo(Math.random() * 512, Math.random() * 512);
        ctx.bezierCurveTo(Math.random()*512, Math.random()*512, Math.random()*512, Math.random()*512, Math.random()*512, Math.random()*512);
        ctx.stroke();
      }
      const t = new THREE.Texture(c); t.needsUpdate = true; t.wrapS = t.wrapT = THREE.RepeatWrapping; t.repeat.set(repX, repY);
      return t;
    }

    function makeJungleTex() {
      const c = document.createElement("canvas");
      c.width = c.height = 512;
      const ctx = c.getContext("2d");
      ctx.fillStyle = "#102414";
      ctx.fillRect(0, 0, 512, 512);
      const greens = ["#1c4e24", "#2e7a36", "#0c3314", "#4a9a42", "#245c28", "#173d1c"];
      for (let i = 0; i < 90; i++) {
        ctx.fillStyle = greens[i % greens.length];
        ctx.beginPath();
        ctx.ellipse(Math.random() * 512, Math.random() * 512, 18 + Math.random() * 48, 7 + Math.random() * 16, Math.random() * Math.PI, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.strokeStyle = "rgba(12,70,24,0.55)";
      ctx.lineWidth = 3;
      for (let i = 0; i < 10; i++) {
        ctx.beginPath();
        ctx.moveTo(Math.random() * 512, 0);
        ctx.bezierCurveTo(Math.random() * 512, 160, Math.random() * 512, 320, Math.random() * 512, 512);
        ctx.stroke();
      }
      const t = new THREE.Texture(c); t.needsUpdate = true; t.wrapS = t.wrapT = THREE.RepeatWrapping;
      t.repeat.set(1 / 5.6, 1 / 2.4);   // 一塊圖案 ≈ 5.6 m × 2.4 m（原主廳北牆比例）
      if (THREE.SRGBColorSpace) t.colorSpace = THREE.SRGBColorSpace;
      return t;
    }

    function makeFresco() {
      const c = document.createElement("canvas");
      c.width = c.height = 512;
      const ctx = c.getContext("2d");
      const g = ctx.createRadialGradient(256, 220, 40, 256, 256, 320);
      g.addColorStop(0, "#f0d9a8");
      g.addColorStop(0.35, "#d4a56a");
      g.addColorStop(0.7, "#8f5a3a");
      g.addColorStop(1, "#5c3a28");
      ctx.fillStyle = g;
      ctx.fillRect(0, 0, 512, 512);
      ctx.strokeStyle = "rgba(198,161,91,0.55)";
      ctx.lineWidth = 8;
      ctx.beginPath(); ctx.arc(256, 256, 180, 0, Math.PI * 2); ctx.stroke();
      ctx.lineWidth = 3;
      ctx.beginPath(); ctx.arc(256, 256, 120, 0, Math.PI * 2); ctx.stroke();
      ctx.fillStyle = "rgba(232,213,168,0.25)";
      for (let i = 0; i < 8; i++) {
        const a = i * Math.PI / 4;
        ctx.beginPath();
        ctx.ellipse(256 + Math.cos(a) * 90, 256 + Math.sin(a) * 90, 36, 16, a, 0, Math.PI * 2);
        ctx.fill();
      }
      const t = new THREE.Texture(c); t.needsUpdate = true;
      if (THREE.SRGBColorSpace) t.colorSpace = THREE.SRGBColorSpace;
      return t;
    }

    /* ================= 幾何合併 ================= */
    function mergeGeos(list) {
      let vCount = 0, iCount = 0;
      for (const g of list) {
        vCount += g.attributes.position.count;
        iCount += g.index ? g.index.count : g.attributes.position.count;
      }
      const pos = new Float32Array(vCount * 3), nor = new Float32Array(vCount * 3), uv = new Float32Array(vCount * 2);
      const idx = vCount > 65535 ? new Uint32Array(iCount) : new Uint16Array(iCount);
      let vo = 0, io = 0;
      for (const g of list) {
        const n = g.attributes.position.count;
        pos.set(g.attributes.position.array, vo * 3);
        nor.set(g.attributes.normal.array, vo * 3);
        if (g.attributes.uv) uv.set(g.attributes.uv.array, vo * 2);
        if (g.index) { const a = g.index.array; for (let i = 0; i < a.length; i++) idx[io++] = a[i] + vo; }
        else for (let i = 0; i < n; i++) idx[io++] = vo + i;
        vo += n;
        g.dispose();
      }
      const out = new THREE.BufferGeometry();
      out.setAttribute("position", new THREE.BufferAttribute(pos, 3));
      out.setAttribute("normal", new THREE.BufferAttribute(nor, 3));
      out.setAttribute("uv", new THREE.BufferAttribute(uv, 2));
      out.setIndex(new THREE.BufferAttribute(idx, 1));
      out.computeBoundingSphere();
      out.computeBoundingBox();
      return out;
    }

    /* BoxGeometry 改用世界座標 UV（公尺），長牆短牆紋理比例一致、相鄰牆面接續 */
    function worldUVBox(geo) {
      const p = geo.attributes.position, uv = geo.attributes.uv;
      for (let i = 0; i < p.count; i++) {
        const face = Math.floor(i / 4);          // px, nx, py, ny, pz, nz
        const x = p.getX(i), y = p.getY(i), z = p.getZ(i);
        if (face < 2) uv.setXY(i, face === 0 ? -z : z, y);
        else if (face < 4) uv.setXY(i, x, z);
        else uv.setXY(i, face === 4 ? x : -x, y);
      }
      uv.needsUpdate = true;
      return geo;
    }

    /* 靜態批次：依（房間, 材質, 陰影旗標, 是否為牆）分組，最後一次合併 */
    const BATCH = new Map();
    let batchRoom = "misc";
    let batchMask = 31;             /* v29：目前排入的幾何屬於哪些建築（DM 位元） */
    function queue(geo, mat, opt = {}) {
      const cast = !!opt.cast, recv = !!opt.recv, wall = !!opt.wall;
      const key = batchRoom + "|" + mat.uuid + "|" + (cast ? 1 : 0) + (recv ? 1 : 0) + (wall ? 1 : 0) + "|" + batchMask;
      let b = BATCH.get(key);
      if (!b) { b = { mat, cast, recv, wall, mask: batchMask, room: batchRoom, geos: [] }; BATCH.set(key, b); }
      b.geos.push(geo);
    }
    function flushBatches() {
      BATCH.forEach((b) => {
        const mesh = new THREE.Mesh(bendGeo(mergeGeos(b.geos)), b.mat);
        mesh.castShadow = b.cast;
        mesh.receiveShadow = b.recv;
        mesh.matrixAutoUpdate = false;
        mesh.updateMatrix();
        scene.add(mesh);
        if (b.wall) { mesh.userData.room = b.room; wallMeshes.push(mesh); }
        mesh.userData.decor = b.mask;
        if (b.mask !== DM.all) DECOR.meshes.push(mesh);
      });
      BATCH.clear();
    }
    function addBox(geo, mat, x, y, z, asWall) {
      geo.translate(x, y, z);
      if (asWall) worldUVBox(geo);
      queue(geo, mat, { cast: true, recv: true, wall: asWall });
    }

    /* 掛畫與標籤配置（公尺）
       SLOT_PITCH：同一面牆相鄰兩幅畫的中心距（原本主廳 3.63、東西廳 3.16 → 標籤會撞到隔壁畫框）
       LABEL_GAP ：標籤與「自己的」畫框外緣距離（原本 0.07）
       LABEL_Y   ：標籤中心離地高度，所有標籤同一條水平線（原本 2.23，要抬頭看） */
    /* 以下數值的預設與範圍改在 HALL_PARAMS 設定，也可用 Excel「展廳參數」工作表修改 */
    const SLOT_PITCH = HALL.pitch;
    const FRAME_EDGE = 0.19;        // 畫框外緣（含角飾）超出畫布邊的距離
    const LABEL_GAP = HALL.labelGap;
    const LABEL_HALF_W = 0.16;
    const LABEL_Y = HALL.labelY;
    const HANG_Y = HALL.hangY;      // 畫作中心高度

    function slots10(rec) {
      const { w, d, cx, cz } = rec;
      const n = (count, wall) => {
        const a = [];
        const span = Math.min(w - 2, SLOT_PITCH * (count + 1));   // 南北牆：畫與畫中心固定間距
        for (let i = 0; i < count; i++) {
          const t = (i + 1) / (count + 1);
          if (wall === "n") a.push({ x: cx + (t - 0.5) * span, z: cz - d / 2 + 0.28, rot: 0 });
          if (wall === "s") a.push({ x: cx + (0.5 - t) * span, z: cz + d / 2 - 0.28, rot: Math.PI });
          if (wall === "w") a.push({ x: cx - w / 2 + 0.28, z: cz + (t - 0.5) * (d - 5.2), rot: Math.PI / 2 });
          if (wall === "e") a.push({ x: cx + w / 2 - 0.28, z: cz + (0.5 - t) * (d - 5.2), rot: -Math.PI / 2 });
        }
        return a;
      };
      /* 側牆指定位置（相對房間中心的 z）；門洞兩側用 ±5.7 */
      const side = (wall, zs) => zs.map((z) => wall === "w"
        ? { x: cx - w / 2 + 0.28, z: cz + z, rot: Math.PI / 2 }
        : { x: cx + w / 2 - 0.28, z: cz - z, rot: -Math.PI / 2 });
      if (rec.id === "hall") return [...n(5, "n"), ...n(5, "s")];
      if (rec.id === "west" || rec.id === "east") {        /* v66：遠端牆開門通往邊廳 → 兩幅移到門的兩側 */
        return [...n(4, "n"), ...n(4, "s"), ...side(rec.id === "west" ? "w" : "e", [-5.7, 5.7])];
      }
      /* 邊廳：最遠端是玻璃窗；南北牆各 5 幅小畫 */
      return [...n(5, "n"), ...n(5, "s")].map((o) => ({ ...o, small: true }));
    }

    /* ================= 畫作 ================= */
    function wrapText(ctx, text, maxW, maxLines) {
      const lines = [];
      let cur = "";
      for (const ch of String(text || "")) {
        if (ctx.measureText(cur + ch).width > maxW && cur) {
          lines.push(cur); cur = ch;
          if (lines.length === maxLines) break;
        } else cur += ch;
      }
      if (lines.length < maxLines && cur) lines.push(cur);
      else if (lines.length === maxLines && cur) {
        let last = lines[maxLines - 1];
        while (last && ctx.measureText(last + "…").width > maxW) last = last.slice(0, -1);
        lines[maxLines - 1] = last + "…";
      }
      return lines;
    }

    /* ================= v36 紅點：點開看過的畫，白色標籤右下角貼一顆小紅點 ================= */
    const SEEN_KEY = "my-hall-seen-v1" + (GID ? ":" + GID : "");
    const SEEN = new Set((() => { try { return JSON.parse(lsGet(SEEN_KEY) || "[]"); } catch { return []; } })());
    const DOT_ANIM = [];
    function makeDotTex() {
      const c = document.createElement("canvas");
      c.width = c.height = 64;
      const ctx = c.getContext("2d");
      const g = ctx.createRadialGradient(24, 22, 2, 32, 32, 32);
      g.addColorStop(0, "#ff6a60"); g.addColorStop(0.45, "#d8222c"); g.addColorStop(1, "#a0141c");
      ctx.fillStyle = g; ctx.fillRect(0, 0, 64, 64);
      const t = new THREE.Texture(c); t.needsUpdate = true;
      if (THREE.SRGBColorSpace) t.colorSpace = THREE.SRGBColorSpace;
      return t;
    }
    function makeDot(labelX, labelY) {
      const d = new THREE.Group();
      d.add(new THREE.Mesh(SHARED.dotGeo, SHARED.dotM), new THREE.Mesh(SHARED.dotRimGeo, SHARED.dotRimM));
      d.position.set(labelX + 0.14 - 0.036, labelY - 0.175 + 0.036, 0.043);   /* 標籤 0.28×0.35 的右下角 */
      return d;
    }
    function seenSave() { lsSet(SEEN_KEY, JSON.stringify([...SEEN])); seenUI(); }
    function markSeen(art) {
      if (!art || !art.dot) return;
      if (!SEEN.has(art.id)) {
        SEEN.add(art.id);
        seenSave();
        art.dot.visible = true;
        art.dot.scale.setScalar(0.001);
        DOT_ANIM.push({ obj: art.dot, t: 0 });        /* 回到展廳時「啪」一下貼上 */
      } else art.dot.visible = true;
    }
    function dotTick(dt) {
      for (let i = DOT_ANIM.length - 1; i >= 0; i--) {
        const a = DOT_ANIM[i];
        a.t += dt;
        const u = Math.min(1, a.t / 0.38);
        const k = u < 1 ? 1 + 2.2 * Math.pow(u - 1, 3) + 1.2 * Math.pow(u - 1, 2) : 1;   /* 回彈 */
        a.obj.scale.setScalar(Math.max(0.001, k));
        if (u >= 1) DOT_ANIM.splice(i, 1);
      }
    }
    function seenClear() {
      SEEN.clear();
      seenSave();
      artworks.forEach((a) => { if (a.dot) a.dot.visible = false; });
      toast(T("seenDone"));
    }
    function seenUI() {
      const b = document.getElementById("seen-clear");
      if (!b) return;
      b.textContent = T("seenClear", { n: SEEN.size });
      b.disabled = SEEN.size === 0;
      b.style.opacity = SEEN.size ? "" : "0.45";
    }

    function plaque(work) {
      const c = document.createElement("canvas");
      c.width = 256; c.height = 320;
      const ctx = c.getContext("2d");
      ctx.fillStyle = "#f4f1ea";
      ctx.fillRect(0, 0, 256, 320);
      ctx.fillStyle = "#1b1b1b";
      ctx.textAlign = "left";
      ctx.font = "600 26px Microsoft JhengHei, PingFang TC, sans-serif";
      const tl = wrapText(ctx, work.title, 212, 2);
      tl.forEach((ln, i) => ctx.fillText(ln, 22, 58 + i * 34));
      const y0 = 58 + tl.length * 34 + 8;
      ctx.fillStyle = "#333";
      ctx.font = "18px Microsoft JhengHei, PingFang TC, sans-serif";
      ctx.fillText(work.artist || "", 22, y0);
      ctx.fillText(work.year || "", 22, y0 + 30);
      const tex = new THREE.Texture(c); tex.needsUpdate = true;
      if (THREE.SRGBColorSpace) tex.colorSpace = THREE.SRGBColorSpace;
      return new THREE.Mesh(SHARED.plaqueGeo, new THREE.MeshBasicMaterial({ map: tex }));
    }

    function frameMat(hex, metal, rough, useMap) {
      return new THREE.MeshStandardMaterial({ map: useMap ? goldTex : null, color: hex, metalness: metal, roughness: rough });
    }

    /* 雕花畫框：同材質零件合併成一個 mesh（每框 5 個 draw call，原本 22 個） */
    function addSculptedFrame(g, pw, ph, colorId) {
      const p = FRAME_PALETTES[colorId] || FRAME_PALETTES.gold;
      const outerM = frameMat(p.o, p.metal, p.rough, p.map);
      const midM = frameMat(p.m, p.metal * 0.85, p.rough + 0.06, p.map);
      const lipM = frameMat(p.l, p.metal, Math.max(0.18, p.rough - 0.04), p.map);
      const parts = { outer: [], mid: [], lip: [], board: [], liner: [] };
      const box = (list, w, h, d, x, y, z) => list.push(new THREE.BoxGeometry(w, h, d).translate(x, y, z));

      box(parts.board, pw + 0.06, ph + 0.06, 0.04, 0, 0, -0.155);
      const ow = 0.18, od = 0.16;
      box(parts.outer, pw + ow * 2, ow, od, 0, ph / 2 + ow / 2, -0.06);
      box(parts.outer, pw + ow * 2, ow, od, 0, -ph / 2 - ow / 2, -0.06);
      box(parts.outer, ow, ph, od, -pw / 2 - ow / 2, 0, -0.06);
      box(parts.outer, ow, ph, od, pw / 2 + ow / 2, 0, -0.06);
      const mw = 0.085, md = 0.11;
      box(parts.mid, pw + mw * 2, mw, md, 0, ph / 2 + mw / 2, 0.02);
      box(parts.mid, pw + mw * 2, mw, md, 0, -ph / 2 - mw / 2, 0.02);
      box(parts.mid, mw, ph, md, -pw / 2 - mw / 2, 0, 0.02);
      box(parts.mid, mw, ph, md, pw / 2 + mw / 2, 0, 0.02);
      const lw = 0.04, ld = 0.07;
      box(parts.lip, pw + lw * 2, lw, ld, 0, ph / 2 + lw / 2, 0.055);
      box(parts.lip, pw + lw * 2, lw, ld, 0, -ph / 2 - lw / 2, 0.055);
      box(parts.lip, lw, ph, ld, -pw / 2 - lw / 2, 0, 0.055);
      box(parts.lip, lw, ph, ld, pw / 2 + lw / 2, 0, 0.055);
      box(parts.liner, pw + 0.05, ph + 0.05, 0.025, 0, 0, 0.03);
      [[-1, -1], [1, -1], [-1, 1], [1, 1]].forEach(([sx, sy]) => {
        const x = sx * (pw / 2 + ow * 0.45), y = sy * (ph / 2 + ow * 0.45);
        box(parts.outer, 0.22, 0.22, 0.18, x, y, -0.04);
        parts.mid.push(new THREE.SphereGeometry(0.035, 12, 10).translate(x, y, 0.07));
      });
      const add = (list, mat, cast) => {
        const m = new THREE.Mesh(mergeGeos(list), mat);
        m.castShadow = cast;
        g.add(m);
      };
      add(parts.board, SHARED.backM, true);
      add(parts.outer, outerM, true);
      add(parts.mid, midM, true);
      add(parts.lip, lipM, true);
      add(parts.liner, SHARED.linerM, false);
      return { outerM, midM, lipM };
    }

    /* 畫框形狀：auto 依圖片比例；port 直幅 2.44×3.05；land 橫幅＝同寬、高為直幅一半 */
    const FRAME_SHAPES = { port: { pw: 2.44, ph: 3.05 }, land: { pw: 2.44, ph: 1.525 } };
    /* 邊框（卡紙）：畫框外尺寸不變，卡紙每邊佔 MAT_W，圖片縮在卡紙開口內 */
    const MAT_W = HALL.matW;
    const MATTES = {
      cream:  { label: "淺白", c: "#ede7da", bevel: "#d6cdbb" },
      peach:  { label: "淺橘", c: "#efcfae", bevel: "#fbf3e8" },
      gray:   { label: "灰",   c: "#8d8a84", bevel: "#f2eee6" },
      white:  { label: "白",   c: "#f8f7f3", bevel: "#dcd8cf" },
      black:  { label: "黑",   c: "#171615", bevel: "#ece7dc" },
      gold:   { label: "金",   c: "#c9a55e", bevel: "#f3e6c4", metal: 0.55, rough: 0.35, map: true },
      silver: { label: "銀",   c: "#c6c9cd", bevel: "#f4f5f6", metal: 0.6, rough: 0.3, map: true },
      none: null
    };
    const MATTE_DEFAULT = "cream";
    const matteOf = (w) => (w && Object.prototype.hasOwnProperty.call(MATTES, w.matte) ? w.matte : MATTE_DEFAULT);
    /* auto：讓「卡紙開口」符合圖片比例（不變形），外框再加上兩倍卡紙寬 */
    /* k：尺寸倍率（邊廳小畫 0.5 ＝ 長寬各一半、面積 1/4） */
    function frameSize(shape, aspect, m, k = 1) {
      if (FRAME_SHAPES[shape]) return { pw: FRAME_SHAPES[shape].pw * k, ph: FRAME_SHAPES[shape].ph * k };
      const a = aspect || 0.75, mm = m || 0;
      let iw = 2.45 * k - 2 * mm, ih = iw / a;
      if (ih > 3.05 * k - 2 * mm) { ih = 3.05 * k - 2 * mm; iw = ih * a; }
      return { pw: iw + 2 * mm, ph: ih + 2 * mm };
    }
    const SMALL_ROOMS = ["west2", "east2"];
    const SMALL_K = 0.5;
    /* 固定形狀時置中裁切（不變形）；auto 時還原完整圖 */
    function cropTexture(tex, imgAspect, frameAspect, crop) {
      tex.repeat.set(1, 1); tex.offset.set(0, 0);
      if (!crop || !imgAspect) return;
      if (imgAspect > frameAspect) { tex.repeat.x = frameAspect / imgAspect; tex.offset.x = (1 - tex.repeat.x) / 2; }
      else { tex.repeat.y = imgAspect / frameAspect; tex.offset.y = (1 - tex.repeat.y) / 2; }
    }
    function buildArt(work, slot, loaded) {
      const { tex, aspect } = loaded;
      const matteId = matteOf(work);
      const mt = MATTES[matteId];
      const k = slot.small ? SMALL_K : 1;
      const m = mt ? MAT_W * k : 0;
      const { pw, ph } = frameSize(work.shape, aspect, m, k);
      const iw = pw - 2 * m, ih = ph - 2 * m;
      cropTexture(tex, aspect, iw / ih, !!FRAME_SHAPES[work.shape]);
      const g = new THREE.Group();
      g.position.set(slot.x, HANG_Y, slot.z);
      g.rotation.y = slot.rot;
      const frameColor = work.frame || "gold";
      const frameMats = addSculptedFrame(g, pw, ph, frameColor);
      const mat = new THREE.MeshStandardMaterial({ map: tex, roughness: 0.5, metalness: 0.02, emissive: 0xfff1d2, emissiveIntensity: 0.04, emissiveMap: tex });
      const canvas = new THREE.Mesh(new THREE.PlaneGeometry(iw, ih), mat);
      canvas.position.z = 0.064;
      canvas.castShadow = true;
      g.add(canvas);
      const matteMeshes = [];
      if (mt) {
        const board = new THREE.Mesh(new THREE.PlaneGeometry(pw, ph), new THREE.MeshStandardMaterial({
          color: mt.c, roughness: mt.rough || 0.92, metalness: mt.metal || 0, map: mt.map ? goldTex : null }));
        board.position.z = 0.058;
        board.receiveShadow = true;
        const bevel = new THREE.Mesh(new THREE.PlaneGeometry(iw + 0.026, ih + 0.026),
          new THREE.MeshStandardMaterial({ color: mt.bevel, roughness: 0.8 }));   // 卡紙開口的斜切白邊
        bevel.position.z = 0.061;
        g.add(board, bevel);
        matteMeshes.push(board, bevel);
      }
      const labelX = pw / 2 + FRAME_EDGE + LABEL_GAP + LABEL_HALF_W;
      const labelY = LABEL_Y - HANG_Y;
      const plBack = new THREE.Mesh(SHARED.plaqueBackGeo, SHARED.plaqueBackM);
      plBack.position.set(labelX, labelY, 0.02);
      g.add(plBack);
      const pl = plaque(work);
      pl.position.set(labelX, labelY, 0.04);
      g.add(pl);
      const dot = makeDot(labelX, labelY);            /* v36：看過的畫 → 標籤右下角小紅點 */
      dot.visible = SEEN.has(work.id);
      g.add(dot);
      bendObj(g);
      scene.add(g);
      return { g, canvas, mat, pl, dot, frameMats, frameColor, matteMeshes, matteId, pw, ph, matW: m };
    }

    function hang(work, slot, loaded, roomId) {
      const b = buildArt(work, slot, loaded);
      const inward = new THREE.Vector3(0, 0, 1).applyAxisAngle(new THREE.Vector3(0, 1, 0), slot.rot);
      const lookAt = new THREE.Vector3(slot.x, HANG_Y, slot.z);          /* 直線座標（群組本身可能已彎到弧上） */
      const spotPos = lookAt.clone().addScaledVector(inward, 2.2); spotPos.y = 6.5;
      const stand = lookAt.clone().addScaledVector(inward, 3.6); stand.y = PLAYER.h;
      const rec = {
        ...work, room: roomId, mesh: b.canvas, mat: b.mat, group: b.g, plaque: b.pl, dot: b.dot,
        matteMeshes: b.matteMeshes, matte: b.matteId, pw: b.pw, ph: b.ph, matW: b.matW,
        lookAt, spotPos, stand, slot, frame: b.frameColor, frameMats: b.frameMats,
        srcURL: loaded.url, placeholder: loaded.placeholder || null, srcBlob: loaded.blob || null, imgAspect: loaded.aspect,
        borrowed: !!loaded.borrowed
      };
      b.canvas.userData.art = rec;
      b.matteMeshes.forEach((mm) => { mm.userData.art = rec; });
      artworks.push(rec);
      return rec;
    }

    /* 釋放 GPU 資源（共用材質／金箔貼圖不動） */
    function disposeObject(obj, keepTex) {
      obj.traverse((o) => {
        if (!o.isMesh) return;
        if (o.geometry && !o.geometry.userData.shared) o.geometry.dispose();
        const m = o.material;
        if (m && !m.userData.shared) {
          if (m.map && m.map !== goldTex && m.map !== keepTex) m.map.dispose();
          m.dispose();
        }
      });
    }

    /* 換圖後依新比例重建畫框（原版會把橫幅圖硬塞進直幅框而變形） */
    function rehang(rec, loaded) {
      const oldTex = rec.mat.map;
      const oldGroup = rec.group;
      const b = buildArt(rec, rec.slot, loaded);
      scene.remove(oldGroup);
      disposeObject(oldGroup, loaded.tex);          // 只改形狀時沿用同一張貼圖，不釋放
      if (oldTex && oldTex !== loaded.tex) oldTex.dispose();
      if (rec.srcURL && rec.srcURL.startsWith("blob:") && rec.srcURL !== loaded.url) URL.revokeObjectURL(rec.srcURL);
      Object.assign(rec, {
        mesh: b.canvas, mat: b.mat, group: b.g, plaque: b.pl, dot: b.dot, frameMats: b.frameMats,
        matteMeshes: b.matteMeshes, matte: b.matteId, pw: b.pw, ph: b.ph, matW: b.matW,
        srcURL: loaded.url, placeholder: loaded.placeholder || null, srcBlob: loaded.blob || null, imgAspect: loaded.aspect,
        borrowed: !!loaded.borrowed
      });
      b.canvas.userData.art = rec;
      b.matteMeshes.forEach((mm) => { mm.userData.art = rec; });
      setFrameColor(rec, rec.frame);
      rebuildPickTargets();
      reassignSpots(true);
      markShadow();
    }

    /* 用同一張貼圖重建畫框（改形狀／邊框時） */
    function rebuildArt(rec) {
      rehang(rec, { tex: rec.mat.map, url: rec.srcURL, aspect: rec.imgAspect, blob: rec.srcBlob, placeholder: rec.placeholder, borrowed: rec.borrowed });
    }
    function setFrameShape(rec, shape) {
      if (!rec || !rec.mat) return;
      rec.shape = FRAME_SHAPES[shape] ? shape : "auto";
      rebuildArt(rec);
      syncShapeUI(rec);
    }
    function setMatte(rec, id) {
      if (!rec || !rec.mat) return;
      rec.matte = Object.prototype.hasOwnProperty.call(MATTES, id) ? id : MATTE_DEFAULT;
      rebuildArt(rec);
      syncMatteUI(rec);
    }
    function syncMatteUI(rec) {
      const id = matteOf(rec);
      document.querySelectorAll("#iv-matte [data-matte]").forEach((b) => b.classList.toggle("on", b.dataset.matte === id));
      syncPreview(rec);
    }
    /* 檢視器預覽：依實際畫框比例畫出卡紙、斜邊與畫框顏色 */
    function syncPreview(rec) {
      if (!rec || editing !== rec) return;
      const mount = $("iv-mount"), img = $("iv-img");
      const pw = rec.pw || 2.44, ph = rec.ph || 3.05, m = rec.matW || 0;
      const mt = MATTES[matteOf(rec)];
      const fp = FRAME_PALETTES[rec.frame] || FRAME_PALETTES.gold;
      mount.style.aspectRatio = `${pw} / ${ph}`;
      mount.style.width = `min(100%, ${(62 * pw / ph).toFixed(2)}vh)`;
      mount.style.background = mt ? mt.c : "#0c0a08";
      mount.style.boxShadow = `0 0 0 10px ${fp.o}, 0 0 0 11px rgba(0,0,0,0.55)`;
      img.style.left = (m / pw * 100).toFixed(3) + "%";
      img.style.top = (m / ph * 100).toFixed(3) + "%";
      img.style.width = ((1 - 2 * m / pw) * 100).toFixed(3) + "%";
      img.style.height = ((1 - 2 * m / ph) * 100).toFixed(3) + "%";
      img.style.boxShadow = mt ? `0 0 0 3px ${mt.bevel}` : "none";
    }
    function syncShapeUI(rec) {
      const sh = FRAME_SHAPES[rec.shape] ? rec.shape : "auto";
      document.querySelectorAll("#iv-shape [data-shape]").forEach((b) => b.classList.toggle("on", b.dataset.shape === sh));
      syncPreview(rec);
    }

    function refreshPlaque(rec) {
      const neu = plaque(rec);
      neu.position.copy(rec.plaque.position);
      rec.group.remove(rec.plaque);
      disposeObject(rec.plaque, null);
      rec.group.add(neu);
      rec.plaque = neu;
    }

    /* 使用者上傳：過大圖片先縮到 2048 再存 IndexedDB（載入更快、iPad 不爆記憶體） */
    async function normalizeUpload(file) {
      const url = URL.createObjectURL(file);
      const img = await loadImage(url);
      const w = img.naturalWidth, h = img.naturalHeight;
      if (Math.max(w, h) <= Q.uploadMax && file.size < 3e6) return { blob: file, img, url };
      const c = scaleToCanvas(img, Q.uploadMax);
      URL.revokeObjectURL(url);
      const blob = await new Promise((r) => c.toBlob(r, "image/jpeg", 0.9));
      if (!blob) throw new Error("toBlob failed");
      const url2 = URL.createObjectURL(blob);
      return { blob, img: await loadImage(url2), url: url2 };
    }

    async function replaceTexture(rec, file) {
      if (VIEWONLY) return null;
      setStatus("處理圖片中…");
      let up;
      try { up = await normalizeUpload(file); }
      catch { setStatus("這個檔案無法讀取，請改用 JPG 或 PNG。", true); return null; }
      let saved = true;
      try { await idbPut(imgKey(rec.id), up.blob); } catch { saved = false; }
      rehang(rec, { ...texFromImage(up.img, up.url), blob: up.blob });
      rec.fileName = file.name;
      const fm = loadMeta(); fm[rec.id] = { ...(fm[rec.id] || {}), file: file.name }; saveMeta(fm);
      $("iv-img").src = up.url;
      if (LENS.on) lensOpen();
      setStatus(saved ? "已換圖並記住。" : "已換圖，但這個瀏覽器不允許存檔（例如私密瀏覽），重開後會還原。", !saved);
      return saved;
    }

    /* ================= 批次匯入 ================= */
    const IMG_EXT = /\.(jpe?g|png|webp|gif|bmp|avif|heic|heif)$/i;
    let importing = false;
    function setProgress(text, warn) {
      const el = $("load-progress");
      if (!el) return;
      el.textContent = text;
      progState = null;
      el.classList.toggle("warn", !!warn);
    }
    /* 檔名 → 標題：只去掉副檔名；開頭若是 01_～30_ 則當作位置編號並去掉 */
    function planImport(files) {
      const imgs = files.filter((f) => /^image\//.test(f.type) || IMG_EXT.test(f.name));
      imgs.sort((a, b) => a.name.localeCompare(b.name, "zh-Hant", { numeric: true }));
      const byId = new Map(artworks.map((a) => [a.id, a]));
      const used = new Set(), plan = [], rest = [];
      for (const f of imgs) {
        const base = f.name.replace(/\.[^.]+$/, "").trim();
        const m = base.match(/^(\d{1,2})[\s._\-]+(.+)$/);
        const id = m ? String(+m[1]).padStart(2, "0") : "";
        if (m && byId.has(id) && !used.has(id)) { used.add(id); plan.push({ art: byId.get(id), file: f, title: m[2].trim() }); }
        else rest.push({ file: f, title: base });
      }
      const free = artworks.slice().sort((a, b) => a.id.localeCompare(b.id)).filter((a) => !used.has(a.id));
      rest.forEach((r, i) => { if (i < free.length) plan.push({ art: free[i], file: r.file, title: r.title }); });
      plan.sort((a, b) => a.art.id.localeCompare(b.art.id));
      return { plan, extra: imgs.length - plan.length, notImg: files.length - imgs.length };
    }
    async function importBatch(fileList, opts = {}) {
      if (VIEWONLY || importing || exporting) return 0;
      if (!hungAll) { setProgress("展廳還在掛畫，請稍候再匯入。", true); return 0; }
      const { plan, extra, notImg } = planImport(Array.from(fileList || []));
      if (!plan.length) { setProgress("沒有可匯入的圖片，請選 JPG、PNG 或 WebP。", true); return 0; }
      if (!opts.quiet && !confirm(`將替換 ${plan.length} 幅畫的圖片與標題（作者、年代、說明保留）。確定匯入？`)) return 0;
      importing = true;
      setBusy(true);
      const meta = loadMeta();
      let ok = 0, fail = 0, unsaved = 0;
      for (let i = 0; i < plan.length; i++) {
        const { art, file, title } = plan[i];
        setProgress(`匯入中… ${i + 1} / ${plan.length}`);
        try {
          const up = await normalizeUpload(file);          // 逐張處理：iPad 不會一次解碼 30 張大圖
          try { await idbPut(imgKey(art.id), up.blob); } catch { unsaved++; }
          if (title) art.title = title;
          art.fileName = file.name;
          rehang(art, { ...texFromImage(up.img, up.url), blob: up.blob });
          meta[art.id] = { ...(meta[art.id] || {}), title: art.title, artist: art.artist, year: art.year, description: art.description, frame: art.frame || "gold", file: art.fileName };
          ok++;
        } catch { fail++; }
        await new Promise((r) => setTimeout(r, 0));
      }
      const textSaved = saveMeta(meta);
      importing = false;
      setBusy(false);
      const notes = [];
      if (fail) notes.push(`${fail} 張無法讀取`);
      if (extra) notes.push(`多出 ${extra} 張未使用`);
      if (notImg) notes.push(`${notImg} 個非圖片檔略過`);
      if (unsaved || !textSaved) notes.push("瀏覽器不允許存檔，重開後會還原");
      setProgress(`已匯入 ${ok} 幅` + (notes.length ? "（" + notes.join("、") + "）" : "，可以進入展廳了"), notes.length > 0);
      return ok;
    }

    /* ================= 拖放換圖（v19） =================
       單張圖拖到某幅畫上 → 只換那幅（標題不動）
       多張圖或沒對準畫   → 走原本的 importBatch（檔名 01_ 對位）
       xlsx/csv/tsv       → importLabels                         */
    let dragging = false, dropArt = null, dragTimer = 0;

    function toast(text, warn) {
      const el = $("toast");
      if (!el) return;
      el.textContent = text;
      el.classList.toggle("warn", !!warn);
      el.classList.add("show");
      clearTimeout(toast._t);
      toast._t = setTimeout(() => el.classList.remove("show"), warn ? 4200 : 2600);
    }
    function dragHasFiles(e) {
      const t = e.dataTransfer && e.dataTransfer.types;
      return !!t && Array.prototype.indexOf.call(t, "Files") >= 0;
    }
    function onBlockerScreen() { return !$("blocker").classList.contains("hidden"); }
    function inspectorOpen() { return $("inspector").classList.contains("open"); }

    function dzShow(on) {
      if (dragging === on) return;
      dragging = on;
      $("dropzone").classList.toggle("on", on);
      if (!on) {
        clearTimeout(dragTimer);
        $("blocker").classList.remove("dragging");
        $("dz-tip").textContent = "";
        musicDropHot(false);
        dropArt = null;
        setLook(null);
      }
    }
    function dzTip(text) {
      const el = $("dz-tip");
      if (el.textContent !== text) el.textContent = text;
    }
    /* 每次 dragover 都重新瞄準；滑出視窗沒收到 dragleave 時靠 watchdog 收尾 */
    /* v59：拖到配樂列／自選鈕 → 設為自選配樂 */
    const AUDIO_EXT = /\.(mp3|m4a|aac|ogg|oga|wav|flac)$/i;
    const isAudio = (f) => !!f && (/^audio\//.test(f.type) || AUDIO_EXT.test(f.name));
    function musicDropHot(on) {
      document.querySelectorAll('[data-music="file"], #music-file-btn').forEach((b) => b.classList.toggle("drop-hot", on));
    }
    function dragAim(e) {
      clearTimeout(dragTimer);
      dragTimer = setTimeout(() => dzShow(false), 500);
      const mz = e.target && e.target.closest && e.target.closest('#music-bar, [data-music], #music-file-btn, #music-btn');
      musicDropHot(!!mz);
      if (mz) {
        if (dropArt) { dropArt = null; setLook(null); }
        dzTip("放開以設為「自選」配樂（MP3／M4A）");
        return;
      }
      if (e.target && e.target.closest && e.target.closest("#console")) {
        if (dropArt) { dropArt = null; setLook(null); }
        dzTip("MP3 拖到「配樂」列的「♪ 自選」即可換配樂");
        return;
      }
      if (onBlockerScreen()) {
        $("blocker").classList.add("dragging");
        dzTip("放開以匯入：整個資料夾＝作品目錄（存進記憶組）、圖片批次上牆、Excel 套用標籤");
        return;
      }
      if (inspectorOpen()) {
        dzTip(editing ? "放開以換上這張圖 · " + editing.title : "放開以匯入圖片");
        return;
      }
      const art = artAtXY(e.clientX, e.clientY);
      if (art !== dropArt) {
        dropArt = art;
        setLook(art, "放開以換上這張圖 · ");
      }
      dzTip(art ? "" : "放開以批次匯入（檔名開頭 01_～30_ 可指定位置）");
    }

    async function dropOnArt(art, file) {
      if (importing || exporting) { toast("正在忙，請稍候再換圖。", true); return; }
      if (!hungAll) { toast("展廳還在掛畫，請稍候再換圖。", true); return; }
      toast("處理圖片中…");
      const ok = await replaceTexture(art, file);   // null = 讀不到；false = 換了但存不住；true = 完成
      if (ok === null) toast("這個檔案無法讀取，請改用 JPG 或 PNG。", true);
      else if (!ok) toast("已換上「" + art.title + "」的新圖，但瀏覽器不允許存檔，重開後會還原。", true);
      else toast("已換上「" + art.title + "」的新圖。");
    }

    async function handleDrop(e) {
      if (VIEWONLY) { toast("這是欣賞版，不能更換圖片。", true); return; }
      const entries = dropEntries(e);                 // 必須在第一個 await 之前取得，事件結束後就讀不到
      const files = Array.from((e.dataTransfer && e.dataTransfer.files) || []);
      const art = dropArt, onBlocker = onBlockerScreen(), insp = inspectorOpen();
      dzShow(false);
      const dir = entries.find((en) => en.isDirectory);
      if (dir) {                                      // v58：拖進資料夾＝匯入作品目錄
        const all = [];
        for (const en of entries) await walkEntry(en, all, 0);
        if (!onBlocker) goHomeAll();
        await importFolder(all, dir.name);
        return;
      }
      if (!files.length) { toast("沒有讀到檔案；資料夾請先打開再拖，或改用「選圖匯入」。", true); return; }
      const aud = files.find(isAudio);                 // v59：音樂檔（拖到哪裡都可以）→ 自選配樂
      if (aud && !files.some((f) => /^image\//.test(f.type) || IMG_EXT.test(f.name) || /\.(xlsx|csv|tsv)$/i.test(f.name))) {
        await musicPick(aud);
        toast(`♪ 自選配樂：「${aud.name.replace(/\.[^.]+$/, "")}」`);
        return;
      }
      const sheet = files.find((f) => /\.(xlsx|csv|tsv)$/i.test(f.name));
      if (sheet) { await importLabels(sheet); return; }
      const imgs = files.filter((f) => /^image\//.test(f.type) || IMG_EXT.test(f.name));
      if (!imgs.length) { toast("沒有可用的圖片，請拖 JPG、PNG 或 WebP。", true); return; }
      if (insp && editing) { await replaceTexture(editing, imgs[0]); return; }
      if (!onBlocker && art && imgs.length === 1) { await dropOnArt(art, imgs[0]); return; }
      await importBatch(files);
    }

    function bindDrop() {
      addEventListener("dragenter", (e) => {
        if (VIEWONLY || !dragHasFiles(e)) return;
        e.preventDefault();
        if (document.pointerLockElement) { document.exitPointerLock(); locked = false; }
        dzShow(true);
      });
      addEventListener("dragover", (e) => {
        e.preventDefault();                      // 一律擋掉，瀏覽器才不會直接開圖
        if (VIEWONLY || !dragHasFiles(e)) return;
        e.dataTransfer.dropEffect = "copy";
        dzShow(true);
        dragAim(e);
      });
      addEventListener("dragleave", (e) => {
        if (e.relatedTarget === null || e.clientX <= 0 || e.clientY <= 0) dzShow(false);
      });
      addEventListener("drop", (e) => {
        e.preventDefault();
        handleDrop(e);
      });
    }

    /* ================= 匯出分享檔 ================= */
    /* 把目前 30 幅圖（含本機換過的）與文字寫回一份獨立 HTML；新檔有自己的儲存 ID，不會被收件者本機舊資料蓋掉 */
    let exporting = false;
    function blobToDataURL(blob) {
      return new Promise((resolve, reject) => {
        const r = new FileReader();
        r.onload = () => resolve(r.result);
        r.onerror = () => reject(r.error);
        r.readAsDataURL(blob);
      });
    }
    /* 分享用：超過 600 KB 的圖縮到 1600 px / JPEG 0.85，控制檔案大小（方便 LINE、Email） */
    async function shrinkForShare(blob) {
      if (blob.size <= 600 * 1024) return blob;
      const url = URL.createObjectURL(blob);
      try {
        const c = scaleToCanvas(await loadImage(url), 1600);
        const out = await new Promise((r) => c.toBlob(r, "image/jpeg", 0.85));
        return out && out.size < blob.size ? out : blob;
      } catch { return blob; }
      finally { URL.revokeObjectURL(url); }
    }
    function mmdd() {
      const d = new Date();
      return String(d.getMonth() + 1).padStart(2, "0") + String(d.getDate()).padStart(2, "0");
    }
    function fmtSize(n) {
      return n >= 1048576 ? (n / 1048576).toFixed(1) + " MB" : Math.max(1, Math.round(n / 1024)) + " KB";
    }
    /* 匯出前詢問是否含自選音樂，並列出兩種檔案大小；回傳 "with" / "without" / null(取消) */
    function askExportMusic(musicName, sizeWith, sizeWithout) {
      return new Promise((resolve) => {
        const old = $("exp-ask"); if (old) old.remove();
        const zh = LANG === "zh";
        const esc = (s) => String(s || "").replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
        const box = document.createElement("div");
        box.id = "exp-ask";
        box.setAttribute("role", "dialog");
        box.setAttribute("aria-modal", "true");
        box.innerHTML =
          '<div class="ea-card">' +
          "<h3>" + (zh ? "匯出分享檔" : "Export share file") + "</h3>" +
          '<p class="ea-note">' + (zh ? "自選音樂：" : "My music: ") + "♪ " + esc(musicName || (zh ? "（未命名）" : "(untitled)")) +
          "（" + fmtSize(sizeWith - sizeWithout) + "）</p>" +
          '<button type="button" class="btn solid ea-opt" data-v="with"><span>' + (zh ? "含自選音樂" : "Include my music") + "</span><b>" + fmtSize(sizeWith) + "</b></button>" +
          '<button type="button" class="btn ea-opt" data-v="without"><span>' + (zh ? "不含自選音樂（改用內建配樂）" : "Without my music (built-in music)") + "</span><b>" + fmtSize(sizeWithout) + "</b></button>" +
          '<button type="button" class="btn ea-cancel" data-v="">' + (zh ? "取消" : "Cancel") + "</button>" +
          "</div>";
        const done = (v) => { document.removeEventListener("keydown", onKey, true); box.remove(); resolve(v || null); };
        const onKey = (e) => { if (e.key === "Escape") { e.preventDefault(); e.stopPropagation(); done(null); } };
        box.addEventListener("click", (e) => {
          const b = e.target.closest("button[data-v]");
          if (b) done(b.dataset.v);
          else if (e.target === box) done(null);
        });
        document.addEventListener("keydown", onKey, true);
        document.body.appendChild(box);
        const first = box.querySelector("button[data-v='with']"); if (first) first.focus();
      });
    }
    let folderJob = false;                        // v58：匯入作品目錄整段期間保持忙碌
    function setBusy(on) {
      on = on || folderJob;
      ["dir-btn", "dir-row", "import-btn", "export-btn", "share-view-btn", "share-fly-btn", "fly-in-btn", "bird-in-btn", "dog-in-btn", "el-in-btn", "cat-in-btn", "par-in-btn", "excel-btn"].forEach((id) => { const el = $(id); if (el) el.classList.toggle("busy", on); });
    }
    async function exportShare(viewOnly, autoFly) {
      if (VIEWONLY || exporting || importing) return;
      if (!hungAll) { setProgress("展廳還在掛畫，請稍候再匯出。", true); return; }
      const at = PRISTINE_HTML.indexOf("window.GALLERY_EMBED");
      const s0 = at < 0 ? -1 : PRISTINE_HTML.lastIndexOf("<script>", at);
      const s1 = at < 0 ? -1 : PRISTINE_HTML.indexOf("</" + "script>", at);
      if (s0 < 0 || s1 < 0) { setProgress("找不到內嵌圖片區塊，這個檔案無法匯出。", true); return; }
      exporting = true;
      setBusy(true);
      try {
        const embed = {}, meta = {};
        const list = artworks.slice().sort((a, b) => a.id.localeCompare(b.id));
        for (let i = 0; i < list.length; i++) {
          const a = list[i];
          setProgress(`打包中… ${i + 1} / ${list.length}`);
          if (a.borrowed) { /* 暫借的圖不帶進分享檔，對方開啟時會自己再隨機借 */ }
          else if (a.srcBlob) embed[a.id] = await blobToDataURL(await shrinkForShare(a.srcBlob));
          else if (a.srcURL && a.srcURL.startsWith("data:")) embed[a.id] = a.srcURL;
          meta[a.id] = { title: a.title, artist: a.artist, year: a.year, description: a.description, frame: a.frame || "gold", file: a.fileName, shape: a.shape || "auto", matte: matteOf(a) };
          await new Promise((r) => setTimeout(r, 0));
        }
        if (!SHOTS.selected) scenePhoto();
        if (!SHOTS.selected) throw new Error("無法取得封面，請先使用場景拍照。");
        const musicEmb = await musicEmbedForShare();
        const gid = "g" + Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
        const safe = (o) => JSON.stringify(o).replace(/</g, "\\u003c");
        const makeBlob = (withMusic) => {
          /* 不含自選音樂時：原本選「自選音樂」的改回內建配樂，其他模式照舊 */
          const mode = !withMusic && MUSIC.mode === "file" ? "free" : MUSIC.mode;
          const block = "<script>\nwindow.GALLERY_ID = " + JSON.stringify(gid) +
            ";\nwindow.GALLERY_VIEWONLY = " + (viewOnly ? 1 : 0) +
            ";\nwindow.GALLERY_AUTOFLY = " + (autoFly ? 1 : 0) +
            ";\nwindow.GALLERY_COVER = " + safe(SHOTS.selected) +
            ";\nwindow.GALLERY_PHOTOS = " + safe(SHOTS.photos) +
            ";\nwindow.GALLERY_OBJECTS = " + safe(placedObjects) +
            ";\nwindow.GALLERY_META = " + safe(meta) +
            ";\nwindow.GALLERY_HALL = " + safe(hallCurrent()) +
            ";\nwindow.GALLERY_MUSIC_MODE = " + JSON.stringify(mode) +
            ";\nwindow.GALLERY_MUSIC = " + safe(withMusic ? musicEmb : null) +
            ";\nwindow.GALLERY_EMBED = " + safe(embed) + ";\n";
          return new Blob([PRISTINE_HTML.slice(0, s0), block, PRISTINE_HTML.slice(s1)], { type: "text/html" });
        };
        let blob = makeBlob(true);
        if (musicEmb) {
          const blobNo = makeBlob(false);
          setProgress("請選擇是否包含自選音樂…");
          const pick = await askExportMusic(musicEmb.name, blob.size, blobNo.size);
          if (!pick) { setProgress("已取消匯出。"); return; }
          if (pick === "without") blob = blobNo;
        }
        const name = `${fileSafe(HALL.name)}-${autoFly ? "飛行" : viewOnly ? "欣賞" : "分享"}-${mmdd()}.html`;
        const mb = fmtSize(blob.size);
        let shared = false;
        if (TOUCH && typeof File === "function" && navigator.canShare) {
          const file = new File([blob], name, { type: "text/html" });
          if (navigator.canShare({ files: [file] })) {
            try { await navigator.share({ files: [file], title: name }); shared = true; }
            catch (e) { if (e && e.name === "AbortError") { setProgress("已取消分享。"); return; } }
          }
        }
        if (!shared) {
          const url = URL.createObjectURL(blob);
          const a = document.createElement("a");
          a.href = url; a.download = name;
          document.body.appendChild(a); a.click(); a.remove();
          setTimeout(() => URL.revokeObjectURL(url), 60000);
        }
        downloadCover(name);
        setProgress(autoFly
          ? `已匯出飛行版「${name}」（${mb}）。對方開啟後畫一掛好就自動飛行，按 F／Esc／W/A/D＋↓ 可接手自己走。`
          : viewOnly
          ? `已匯出欣賞版「${name}」（${mb}）。對方用瀏覽器開啟可自由走動觀賞，但不能改圖、改文字，也不能再產生分享檔。`
          : `已匯出「${name}」（${mb}），對方用瀏覽器開啟即可看到同樣的展廳。`);
      } catch (e) {
        setProgress("匯出失敗：" + ((e && e.message) || e), true);
      } finally {
        exporting = false;
        setBusy(false);
      }
    }

    /* ================= 欣賞版 UI（v20） ================= */
    function applyViewOnly() {
      if (!VIEWONLY) { applyLang(LANG); return; }
      document.body.classList.add("viewonly");
      const hint = $("home-hint"); if (hint) hint.dataset.i18n = "hintView";
      const ke = $("key-edit"); if (ke) ke.dataset.i18n = "kEditView";
      const how = $("howto"); if (how) how.dataset.i18n = "howtoView";
      applyLang(LANG);
      const tip = document.querySelector(".touch-tip");
      if (tip) tip.textContent = "按住右下「前進」走動 · 拖曳畫面轉頭 · 點畫看大圖";
    }

    function goHome() {
      if (document.pointerLockElement) document.exitPointerLock();
      exploring = false;
      move = { f: 0, b: 0, l: 0, r: 0, run: 0 };
      $("resume").classList.remove("show");
      $("blocker").classList.remove("hidden");
    }
    /* v58：回到首頁快捷鍵（T／Home）：先結束飛行、無人機、動物、導覽，再回封面 */
    function goHomeAll() {
      if (onBlockerScreen()) return;
      try {
        if (DRONE.on) droneStop();
        if (HB.on) hbStop();
        if (DOG.on) dogStop();
        if (FLY.on) flyStop();
        if (TOUR.on) tourStop();
        if (inspectorOpen()) closeArt();
        planClose();
      } catch (err) { console.warn(err); }
      goHome();
    }

    /* ================= v58 作品目錄與三組記憶 =================
       匯入作品目錄：一個資料夾內的畫（檔名 01_～30_ 對位）＋ Excel（展廳標籤／展廳參數）
       匯入完成後把「目前 30 幅的圖＋文字」整份快照存進 IndexedDB 的記憶組 1～3；
       點記憶組即可切換，不必再選資料夾。                                    */
    const SLOT_N = 3;                             // 固定的基本記憶組（1～3 清除後保留空位）
    const SLOT_MAX = 12;                          // v59：「+」可增加到 12 組；4 以後的組清除即移除
    const SLOT_KEY = "my-hall-slots-v1" + (GID ? ":" + GID : "");
    const slotDbKey = (n) => imgKey("__slot" + n);
    let pendingSlot = 0;                          // 點了空的記憶組 → 下一次匯入存到這組
    const SHEET_EXT = /\.(xlsx|csv|tsv)$/i;
    function slotIdx() {
      try {
        const o = JSON.parse(lsGet(SLOT_KEY) || "{}");
        const list = Array.isArray(o.list) ? o.list.slice(0, SLOT_MAX) : [];
        while (list.length < SLOT_N) list.push(null);
        return { list, active: +o.active || 0 };
      } catch { return { list: Array(SLOT_N).fill(null), active: 0 }; }
    }
    function slotSaveIdx(ix) { lsSet(SLOT_KEY, JSON.stringify(ix)); }
    function slotDate(t) { const d = new Date(t || Date.now()); return `${d.getMonth() + 1}/${d.getDate()}`; }
    /* v59：依記憶組數量動態產生按鈕，「+」永遠排在最後 */
    function buildSlotEls(len) {
      const row = $("dir-row"), add = $("dir-add");
      row.querySelectorAll(".dir-slot").forEach((el) => { if (+el.dataset.slot > len) el.remove(); });
      for (let n = 1; n <= len; n++) {
        if (row.querySelector(`.dir-slot[data-slot="${n}"]`)) continue;
        const el = document.createElement("div");
        el.className = "dir-slot empty" + (n > SLOT_N ? " extra" : "");
        el.dataset.slot = n;
        el.innerHTML = `<button class="btn dir-main" type="button"><i>${n}</i><span class="dir-name"></span></button><button class="dir-x" type="button" aria-label="Clear">×</button>`;
        el.querySelector(".dir-main").onclick = (e) => {
          e.currentTarget.blur();
          if (e.shiftKey) { saveCurrentToSlot(n); return; }
          if (slotIdx().list[n - 1]) { restoreSlot(n); return; }
          pendingSlot = n;                                  // 空的 → 選資料夾，匯入後存進這組
          $("dir-files").click();
        };
        el.querySelector(".dir-x").onclick = (e) => { e.stopPropagation(); clearSlot(n); };
        row.insertBefore(el, add);
      }
    }
    function renderSlots() {
      const ix = slotIdx(), zh = LANG === "zh";
      buildSlotEls(ix.list.length);
      const add = $("dir-add");
      add.hidden = ix.list.length >= SLOT_MAX;
      add.title = zh ? `新增記憶 ${ix.list.length + 1}：選資料夾匯入後存進新的一組\nShift＋點：把目前展廳存進新的一組`
                     : `Add slot ${ix.list.length + 1}: pick a folder and save it there\nShift-click: save the current gallery as a new slot`;
      document.querySelectorAll("#dir-row .dir-slot").forEach((el) => {
        const n = +el.dataset.slot, s = ix.list[n - 1];
        el.classList.toggle("empty", !s);
        el.classList.toggle("on", !!s && ix.active === n);
        const nm = el.querySelector(".dir-name"), btn = el.querySelector(".dir-main");
        nm.textContent = s ? s.name : T("slotEmpty");
        btn.title = s
          ? (zh ? `切換到「${s.name}」（${s.count} 幅，${slotDate(s.at)} 存）\nShift＋點：把目前展廳存進這一組`
                : `Switch to "${s.name}" (${s.count} works, saved ${slotDate(s.at)})\nShift-click: save the current gallery here`)
          : (zh ? `空的：點一下選資料夾，匯入後存進記憶 ${n}\nShift＋點：把目前展廳存進這一組`
                : `Empty: click to pick a folder and save it as slot ${n}\nShift-click: save the current gallery here`);
        btn.setAttribute("aria-pressed", ix.active === n ? "true" : "false");
        el.querySelector(".dir-x").title = n > SLOT_N ? (zh ? "移除這一組記憶" : "Remove this slot") : (zh ? "清除這一組記憶" : "Clear this slot");
      });
    }
    /* v67 邊廳（西二／東二）還沒放圖的作品：先隨機挑一組「記憶」的畫暫時掛上；
       沒有任何記憶組時，改從前 30 幅隨機借。只是展示，不寫進作品資料；換圖後就是自己的圖 */
    function shuffleArr(a) { for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; }
    const DEFAULT_TITLE = /^作品[一二三四五六七八九十]+$/;
    function borrowMeta(work, m) {
      const w = { ...work };
      if (!m || !DEFAULT_TITLE.test(work.title || "")) return w;   /* 使用者改過文字就保留 */
      ["title", "artist", "year", "description"].forEach((k) => { if (typeof m[k] === "string" && m[k]) w[k] = m[k]; });
      return w;
    }
    async function wingFill(all) {
      const need = all.filter((j) => SMALL_ROOMS.includes(j.room) && j.loaded.placeholder);
      if (!need.length) return;
      let pool = [], from = "";
      try {
        const ix = slotIdx();
        const ns = shuffleArr(ix.list.map((x, i) => (x ? i + 1 : 0)).filter(Boolean));
        for (const n of ns) {
          const snap = await idbGet(slotDbKey(n));
          const items = snap && snap.items ? Object.values(snap.items).filter((it) => it && it.blob) : [];
          if (items.length) { pool = shuffleArr(items); from = snap.name || `記憶 ${n}`; break; }
        }
      } catch {}
      let k = 0;
      if (pool.length) {
        for (const j of need) {
          const it = pool[k++ % pool.length];
          const url = URL.createObjectURL(it.blob);
          try {
            const img = await loadImage(url);
            j.loaded = { ...texFromImage(img, url), borrowed: true };
            j.work = borrowMeta(j.work, it.meta);
          } catch { URL.revokeObjectURL(url); }
        }
      } else {
        const others = shuffleArr(all.filter((j) => !SMALL_ROOMS.includes(j.room) && !j.loaded.placeholder));
        if (!others.length) return;
        need.forEach((j, i) => {
          const o = others[i % others.length];
          j.loaded = { tex: colorTex(o.loaded.tex.image), url: o.loaded.url, aspect: o.loaded.aspect, borrowed: true };
          j.work = borrowMeta(j.work, o.work);
        });
        from = "前 30 幅";
      }
      console.info(`邊廳 ${need.length} 幅暫借自「${from}」`);
    }
    async function artBlob(a) {
      if (a.borrowed) return null;                  /* 邊廳暫借的圖不存進記憶組 */
      if (a.srcBlob) return a.srcBlob;
      if (a.srcURL && !a.placeholder) {
        try { const r = await fetch(a.srcURL); if (r.ok) return await r.blob(); } catch {}
      }
      return null;
    }
    function artMeta(a) {
      return { title: a.title, artist: a.artist, year: a.year, description: a.description, frame: a.frame || "gold", file: a.fileName, shape: a.shape || "auto", matte: matteOf(a) };
    }
    /* 目前展廳 → 記憶組 n */
    async function snapshotSlot(n, name) {
      const items = {};
      let count = 0;
      for (const a of artworks) {
        const blob = await artBlob(a);
        if (blob) count++;
        items[a.id] = { blob, meta: artMeta(a) };
      }
      const at = Date.now();
      await idbPut(slotDbKey(n), { name, at, items });
      const ix = slotIdx();
      ix.list[n - 1] = { name, at, count };
      ix.active = n;
      slotSaveIdx(ix);
      renderSlots();
      return count;
    }
    /* 記憶組 n → 展廳 */
    async function restoreSlot(n) {
      if (VIEWONLY || importing || exporting) return;
      if (!hungAll) { setProgress("展廳還在掛畫，請稍候再切換。", true); return; }
      const ix = slotIdx(), info = ix.list[n - 1];
      const snap = await idbGet(slotDbKey(n));
      if (!snap || !snap.items) {
        ix.list[n - 1] = null; if (ix.active === n) ix.active = 0; slotSaveIdx(ix); renderSlots();
        setProgress(`記憶 ${n} 的資料已不在這台裝置的瀏覽器裡（可能被清除），請重新匯入作品目錄。`, true);
        return;
      }
      importing = true;
      setBusy(true);
      const meta = loadMeta();
      const list = artworks.slice().sort((a, b) => a.id.localeCompare(b.id));
      let ok = 0, fail = 0, unsaved = 0;
      for (let i = 0; i < list.length; i++) {
        const a = list[i], it = snap.items[a.id];
        if (!it) continue;
        setProgress(`切換到「${snap.name}」… ${i + 1} / ${list.length}`);
        const m = it.meta || {};
        ["title", "artist", "year", "description"].forEach((k) => { if (typeof m[k] === "string") a[k] = m[k]; });
        if (m.file) a.fileName = m.file;
        if (m.shape) a.shape = m.shape;
        if (m.matte) a.matte = m.matte;
        if (m.frame) a.frame = m.frame;
        try {
          if (it.blob) {
            const url = URL.createObjectURL(it.blob);
            let img;
            try { img = await loadImage(url); } catch (err) { URL.revokeObjectURL(url); throw err; }
            try { await idbPut(imgKey(a.id), it.blob); } catch { unsaved++; }
            rehang(a, { ...texFromImage(img, url), blob: it.blob });
          } else rebuildArt(a);
          ok++;
        } catch { fail++; }
        meta[a.id] = { ...(meta[a.id] || {}), ...artMeta(a) };
        await new Promise((r) => setTimeout(r, 0));
      }
      const textSaved = saveMeta(meta);
      ix.active = n;
      slotSaveIdx(ix);
      importing = false;
      setBusy(false);
      renderSlots();
      const notes = [];
      if (fail) notes.push(`${fail} 幅讀不到`);
      if (unsaved || !textSaved) notes.push("瀏覽器不允許存檔，重開後會還原");
      setProgress(`已切換到記憶 ${n}「${(info && info.name) || snap.name}」，${ok} 幅` + (notes.length ? "（" + notes.join("、") + "）" : "，可以進入展廳了"), notes.length > 0);
    }
    async function clearSlot(n) {
      if (importing || exporting) return;
      const ix = slotIdx(), s = ix.list[n - 1];
      if (!s && n <= SLOT_N) return;
      if (s && !confirm(`${n > SLOT_N ? "移除" : "清除"}記憶 ${n}「${s.name}」？\n展廳裡目前掛的畫不會改變。`)) return;
      await idbDel(slotDbKey(n));
      if (n <= SLOT_N) {
        ix.list[n - 1] = null;
        if (ix.active === n) ix.active = 0;
        slotSaveIdx(ix); renderSlots();
        setProgress(`已清除記憶 ${n}。`);
        return;
      }
      /* 4 以後：整組移除，後面的組往前遞補編號 */
      for (let k = n + 1; k <= ix.list.length; k++) {
        const snap = ix.list[k - 1] ? await idbGet(slotDbKey(k)) : null;
        if (snap) await idbPut(slotDbKey(k - 1), snap); else await idbDel(slotDbKey(k - 1));
        await idbDel(slotDbKey(k));
      }
      ix.list.splice(n - 1, 1);
      if (ix.active === n) ix.active = 0; else if (ix.active > n) ix.active--;
      slotSaveIdx(ix);
      $("dir-row").querySelectorAll(".dir-slot").forEach((el) => { if (+el.dataset.slot >= n) el.remove(); });
      renderSlots();
      setProgress(s ? `已移除記憶 ${n}。` : `已移除空白的記憶 ${n}。`);
    }
    /* v59「+」：新增一組記憶 */
    function addSlot(e) {
      if (VIEWONLY || importing || exporting) return;
      const ix = slotIdx();
      if (ix.list.length >= SLOT_MAX) { setProgress(`記憶組最多 ${SLOT_MAX} 組。`, true); return; }
      ix.list.push(null);
      slotSaveIdx(ix);
      renderSlots();
      const n = ix.list.length;
      if (e && e.shiftKey) { justAdded = n; saveCurrentToSlot(n).finally(dropJustAdded); return; }
      pendingSlot = n; justAdded = n;
      $("dir-files").click();
    }
    let justAdded = 0;                            // 「+」剛加的組：取消選資料夾就收回
    function dropJustAdded() {
      const n = justAdded; justAdded = 0;
      const ix = slotIdx();
      if (n > SLOT_N && n === ix.list.length && !ix.list[n - 1]) {
        ix.list.pop(); slotSaveIdx(ix);
        $("dir-row").querySelectorAll(".dir-slot").forEach((el) => { if (+el.dataset.slot >= n) el.remove(); });
        renderSlots();
      }
    }
    async function saveCurrentToSlot(n) {
      if (VIEWONLY || importing || exporting) return;
      if (!hungAll) { setProgress("展廳還在掛畫，請稍候。", true); return; }
      const ix = slotIdx(), old = ix.list[n - 1];
      const name = prompt(`把目前展廳存進記憶 ${n}${old ? `（會覆蓋「${old.name}」）` : ""}。名稱：`, old ? old.name : `${HALL.name || "我的展廳"} ${slotDate()}`);
      if (name === null) return;
      importing = true; setBusy(true);
      setProgress(`存進記憶 ${n}…`);
      try {
        const c = await snapshotSlot(n, (name.trim() || `目錄 ${n}`).slice(0, 40));
        setProgress(`已把目前展廳存進記憶 ${n}（${c} 幅）。`);
      } catch (err) {
        setProgress("存不進記憶組：瀏覽器空間不足或不允許存檔（" + ((err && err.message) || err) + "）", true);
      } finally { importing = false; setBusy(false); }
    }
    /* 拖放資料夾：webkitGetAsEntry 逐層讀出檔案 */
    function dropEntries(e) {
      const items = e.dataTransfer && e.dataTransfer.items, out = [];
      if (!items) return out;
      for (const it of Array.from(items)) {
        if (it.kind !== "file" || typeof it.webkitGetAsEntry !== "function") continue;
        const en = it.webkitGetAsEntry();
        if (en) out.push(en);
      }
      return out;
    }
    function readDirAll(dirEntry) {
      return new Promise((resolve) => {
        const reader = dirEntry.createReader(), acc = [];
        const step = () => reader.readEntries((batch) => {
          if (!batch.length) resolve(acc); else { acc.push(...batch); step(); }
        }, () => resolve(acc));
        step();
      });
    }
    async function walkEntry(entry, out, depth) {
      if (entry.isFile) {
        const f = await new Promise((r) => entry.file(r, () => r(null)));
        if (f) out.push(f);
      } else if (entry.isDirectory && depth < 3) {
        for (const child of await readDirAll(entry)) await walkEntry(child, out, depth + 1);
      }
    }
    function pickSheet(files) {
      const sheets = files.filter((f) => SHEET_EXT.test(f.name) && !/^~\$/.test(f.name));
      return sheets.find((f) => /\.xlsx$/i.test(f.name)) || sheets[0] || null;
    }
    /* 匯入作品目錄 → 圖片＋Excel → 存進記憶組 */
    async function importFolder(files, name, target) {
      if (VIEWONLY || importing || exporting) return;
      if (!hungAll) { setProgress("展廳還在掛畫，請稍候再匯入。", true); return; }
      files = Array.from(files || []).filter((f) => !/^\./.test(f.name));
      const imgs = files.filter((f) => /^image\//.test(f.type) || IMG_EXT.test(f.name));
      const sheet = pickSheet(files);
      if (!imgs.length && !sheet) { setProgress("這個資料夾裡沒有圖片或 Excel，請確認選對了資料夾。", true); return; }
      const ix = slotIdx();
      const empty = ix.list.findIndex((x) => !x) + 1;
      const n = target || pendingSlot || empty || ix.active || 1;
      pendingSlot = 0;
      const old = ix.list[n - 1];
      name = (name || `目錄 ${n}`).slice(0, 40);
      const lines = [
        `匯入作品目錄「${name}」`,
        `・圖片 ${imgs.length} 張${imgs.length > artworks.length ? `（只用前 ${artworks.length} 張）` : ""}`,
        sheet ? `・Excel「${sheet.name}」：套用作者、年代、說明、畫框等` : "・沒有 Excel：標題取自檔名",
        `・完成後存進記憶 ${n}${old ? `（覆蓋「${old.name}」）` : ""}`,
        "",
        "會替換展廳目前的圖片與標籤，確定匯入？"
      ];
      if (!confirm(lines.join("\n"))) return;
      folderJob = true;
      setBusy(true);
      try { await importFolderRun(imgs, sheet, n, name); }
      finally { folderJob = false; setBusy(false); }
    }
    async function importFolderRun(imgs, sheet, n, name) {
      let ok = 0;
      if (imgs.length) ok = await importBatch(imgs, { quiet: true });
      if (imgs.length && !ok) return;                    // 圖片全部失敗：不存記憶組
      const imgMsg = imgs.length ? $("load-progress").textContent : "";
      let lab = true;
      if (sheet) {
        lab = await importLabels(sheet, {
          quiet: true,
          flashPrefix: `記憶 ${n}「${name}」已存；`,
          beforeReload: () => snapshotSlot(n, name)
        });
        if (lab === "reload") return;
      }
      const labMsg = sheet ? $("load-progress").textContent : "";
      try {
        importing = true;
        setProgress(`存進記憶 ${n}…`);
        await snapshotSlot(n, name);
        const warn = /無法|略過|沒對到|看不懂|不允許|找不到|失敗|讀不了/.test(imgMsg + labMsg) || (sheet && lab !== true);
        setProgress(`已匯入作品目錄「${name}」並存進記憶 ${n}。` + [imgMsg, labMsg].filter(Boolean).join("；"), warn);
      } catch (err) {
        setProgress(`已匯入「${name}」，但存不進記憶組（瀏覽器空間不足或不允許存檔）。`, true);
      } finally { importing = false; }
    }
    function bindSlots() {
      renderSlots();
      $("dir-btn").addEventListener("click", (e) => { if (e.isTrusted) pendingSlot = 0; });
      $("dir-files").addEventListener("cancel", () => { pendingSlot = 0; dropJustAdded(); });
      $("dir-files").onchange = async (e) => {
        const files = Array.from(e.target.files || []);
        e.target.value = "";
        if (!files.length) { pendingSlot = 0; dropJustAdded(); return; }
        const rel = files[0].webkitRelativePath || "";
        const name = rel.includes("/") ? rel.split("/")[0] : "";
        await importFolder(files, name);
        dropJustAdded();                                  // 匯入被取消時收回空組；成功則已有資料不會移除
      };
      $("dir-add").onclick = (e) => { e.currentTarget.blur(); addSlot(e); };
    }

    /* ================= Excel 標籤匯入 ================= */
    /* .xlsx 本身是 zip：用瀏覽器內建 DecompressionStream 解壓，不必內嵌 SheetJS（省約 900 KB） */
    const u16 = (b, o) => b[o] | (b[o + 1] << 8);
    const u32 = (b, o) => (b[o] | (b[o + 1] << 8) | (b[o + 2] << 16) | (b[o + 3] << 24)) >>> 0;
    async function inflateRaw(data) {
      if (typeof DecompressionStream !== "function") throw new Error("NO_INFLATE");
      const ds = new DecompressionStream("deflate-raw");
      return new Uint8Array(await new Response(new Blob([data]).stream().pipeThrough(ds)).arrayBuffer());
    }
    async function unzip(buf) {
      const b = new Uint8Array(buf);
      let e = -1;
      for (let i = b.length - 22; i >= Math.max(0, b.length - 65557); i--) if (u32(b, i) === 0x06054b50) { e = i; break; }
      if (e < 0) throw new Error("NOT_ZIP");
      const n = u16(b, e + 10);
      let p = u32(b, e + 16);
      const files = {}, dec = new TextDecoder();
      for (let k = 0; k < n && u32(b, p) === 0x02014b50; k++) {
        const method = u16(b, p + 10), csize = u32(b, p + 20), nl = u16(b, p + 28), xl = u16(b, p + 30), cl = u16(b, p + 32), lo = u32(b, p + 42);
        const name = dec.decode(b.subarray(p + 46, p + 46 + nl));
        const start = lo + 30 + u16(b, lo + 26) + u16(b, lo + 28);
        files[name] = { method, data: b.subarray(start, start + csize) };
        p += 46 + nl + xl + cl;
      }
      return {
        text: async (name) => {
          const f = files[name];
          if (!f) return null;
          return dec.decode(f.method === 8 ? await inflateRaw(f.data) : f.data);
        }
      };
    }
    const xmlDoc = (t) => new DOMParser().parseFromString(t, "application/xml");
    const byTag = (el, tag) => Array.from(el.getElementsByTagNameNS("*", tag));
    function colIndex(ref) {
      let n = 0;
      for (const ch of ref.replace(/[^A-Z]/gi, "").toUpperCase()) n = n * 26 + (ch.charCodeAt(0) - 64);
      return n - 1;
    }
    /* 儲存格文字：合併 rich text 各段，略過日文注音 rPh */
    const textOf = (el) => byTag(el, "t").filter((t) => !t.parentNode || t.parentNode.localName !== "rPh").map((t) => t.textContent).join("");
    /* CSV：有 BOM 當 UTF-8；否則先試 UTF-8，失敗改 Big5（繁中 Excel 預設另存的編碼） */
    function decodeText(buf) {
      const b = new Uint8Array(buf);
      if (b[0] === 0xef && b[1] === 0xbb && b[2] === 0xbf) return new TextDecoder().decode(b.subarray(3));
      try { return new TextDecoder("utf-8", { fatal: true }).decode(b); }
      catch { try { return new TextDecoder("big5").decode(b); } catch { return new TextDecoder().decode(b); } }
    }
    function parseCSV(text) {
      const line0 = text.split("\n")[0];
      const sep = (line0.match(/\t/g) || []).length > (line0.match(/,/g) || []).length ? "\t" : ",";
      const rows = [];
      let row = [], cell = "", q = false;
      for (let i = 0; i < text.length; i++) {
        const ch = text[i];
        if (q) {
          if (ch === '"') { if (text[i + 1] === '"') { cell += '"'; i++; } else q = false; }
          else cell += ch;
        } else if (ch === '"') q = true;
        else if (ch === sep) { row.push(cell); cell = ""; }
        else if (ch === "\n" || ch === "\r") {
          if (ch === "\r" && text[i + 1] === "\n") i++;
          row.push(cell); rows.push(row); row = []; cell = "";
        } else cell += ch;
      }
      if (cell || row.length) { row.push(cell); rows.push(row); }
      return rows;
    }

    const HEAD = {
      no: /^(編號|序號|位置|no\.?|#|id)$/i,
      file: /^(檔名|檔案|檔案名稱|文件名|圖檔|標題|名稱|作品|作品名稱|file|filename|name|title)$/i,
      artist: /^(作者|畫家|作者姓名|artist|author)$/i,
      year: /^(年代|年份|年|year)$/i,
      desc: /^(說明|描述|介紹|備註|內容|description|desc|note)$/i,
      shape: /^(形狀|畫框形狀|框型|版型|方向|shape|orientation)$/i,
      matte: /^(邊框|卡紙|襯紙|襯框|邊框顏色|mat|matte)$/i,
      frame: /^(畫框|畫框顏色|框色|frame|frame ?color)$/i
    };
    const FRAME_LABEL = { white: "白", black: "黑", gold: "金", silver: "銀" };
    function parseFrame(v) {
      const t = String(v == null ? "" : v).normalize("NFKC").trim().toLowerCase();
      if (!t) return "";
      const table = { white: /^(白|白色|white)$/, black: /^(黑|黑色|black)$/, gold: /^(金|金色|gold)$/, silver: /^(銀|銀色|silver)$/ };
      return Object.keys(table).find((k) => table[k].test(t)) || null;
    }
    const MATTE_WORDS = {
      cream: /^(淺白|米白|米色|象牙白?|cream|off-?white|ivory)$/, peach: /^(淺橘|淺橙|橘|橙|peach|orange)$/,
      gray: /^(灰|灰色|gray|grey)$/, white: /^(白|白色|white)$/, black: /^(黑|黑色|black)$/,
      gold: /^(金|金色|gold)$/, silver: /^(銀|銀色|silver)$/, none: /^(無|沒有|不要|無邊框|none|no)$/
    };
    function parseMatte(v) {
      const t = String(v == null ? "" : v).normalize("NFKC").trim().toLowerCase();
      if (!t) return "";
      return Object.keys(MATTE_WORDS).find((k) => MATTE_WORDS[k].test(t)) || null;
    }
    const SHAPE_LABEL = { auto: "依圖片", port: "直幅", land: "橫幅" };
    /* 形狀欄：空白＝不改；認不得回傳 null（會列在結果訊息） */
    function parseShape(v) {
      const t = String(v == null ? "" : v).normalize("NFKC").trim().toLowerCase();
      if (!t) return "";
      if (/^(依圖片|依圖|自動|原比例|原圖|auto)$/.test(t)) return "auto";
      if (/^(直幅|直|縱|直式|portrait|port|p)$/.test(t)) return "port";
      if (/^(橫幅|橫|橫式|landscape|land|l)$/.test(t)) return "land";
      return null;
    }
    /* 前 5 列內找標題列；找不到就當作 A=檔名、B=作者、C=說明 */
    function mapColumns(rows) {
      for (let r = 0; r < Math.min(rows.length, 5); r++) {
        const m = {};
        rows[r].forEach((h, i) => {
          const k = Object.keys(HEAD).find((key) => HEAD[key].test(String(h).trim()));
          if (k && m[k] == null) m[k] = i;
        });
        if ((m.file != null || m.no != null) && (m.artist != null || m.desc != null || m.year != null || m.shape != null || m.matte != null || m.frame != null)) return { map: m, start: r + 1 };
      }
      return { map: { file: 0, artist: 1, desc: 2 }, start: 0 };
    }
    const stripName = (s) => String(s == null ? "" : s).normalize("NFKC").trim().replace(IMG_EXT, "").trim();
    const keyOf = (s) => stripName(s).toLowerCase().replace(/\s+/g, " ");
    const keyNoPrefix = (s) => keyOf(s).replace(/^\d{1,2}[\s._\-]+/, "");
    function planLabels(rows) {
      const { map, start } = mapColumns(rows);
      const idx = new Map();
      const add = (k, a) => { if (k && !idx.has(k)) idx.set(k, a); };
      artworks.forEach((a) => {
        add(keyOf(a.title), a);
        if (a.fileName) { add(keyOf(a.fileName), a); add(keyNoPrefix(a.fileName), a); }
      });
      const byId = new Map(artworks.map((a) => [a.id, a]));
      const plan = [], miss = [], seen = new Set();
      for (let r = start; r < rows.length; r++) {
        const row = rows[r];
        const cell = (k) => (map[k] != null ? String(row[map[k]] == null ? "" : row[map[k]]).trim() : "");
        const file = cell("file"), no = cell("no");
        if (!file && !no && !cell("artist") && !cell("desc") && !cell("shape") && !cell("matte") && !cell("frame")) continue;
        let art = null;
        const n = parseInt(no, 10);
        if (map.no != null && n >= 1 && n <= artworks.length) art = byId.get(String(n).padStart(2, "0"));
        if (!art && file) art = idx.get(keyOf(file)) || idx.get(keyNoPrefix(file));
        if (!art || seen.has(art.id)) { if (file || no) miss.push(file || no); continue; }
        seen.add(art.id);
        plan.push({
          art,
          title: file ? stripName(file).replace(/^\d{1,2}[\s._\-]+(?=\S)/, "") : "",
          artist: cell("artist"), year: cell("year"), desc: cell("desc"),
          shape: parseShape(cell("shape")), shapeRaw: cell("shape"),
          matte: parseMatte(cell("matte")), matteRaw: cell("matte"),
          frame: parseFrame(cell("frame")), frameRaw: cell("frame")
        });
      }
      return { plan, miss };
    }
    /* 讀整本活頁簿：回傳 [{ name, rows }]，依工作表順序 */
    async function readXlsxBook(buf) {
      const z = await unzip(buf);
      const ssText = await z.text("xl/sharedStrings.xml");
      const ss = ssText ? byTag(xmlDoc(ssText), "si").map(textOf) : [];
      const list = [];
      const wb = await z.text("xl/workbook.xml"), rels = await z.text("xl/_rels/workbook.xml.rels");
      if (wb && rels) {
        const relList = byTag(xmlDoc(rels), "Relationship");
        for (const sh of byTag(xmlDoc(wb), "sheet")) {
          const rid = sh.getAttribute("r:id") || sh.getAttributeNS("http://schemas.openxmlformats.org/officeDocument/2006/relationships", "id");
          const rel = relList.find((r) => r.getAttribute("Id") === rid);
          if (!rel) continue;
          const t = rel.getAttribute("Target");
          list.push({ name: sh.getAttribute("name") || "", path: t.startsWith("/") ? t.slice(1) : "xl/" + t.replace(/^\.\//, "") });
        }
      }
      if (!list.length) list.push({ name: "", path: "xl/worksheets/sheet1.xml" });
      const book = [];
      for (const s of list) {
        const xml = await z.text(s.path);
        if (!xml) continue;
        const rows = [];
        for (const r of byTag(xmlDoc(xml), "row")) {
          const row = [];
          byTag(r, "c").forEach((c, i) => {
            const ref = c.getAttribute("r");
            const t = c.getAttribute("t");
            const v = byTag(c, "v")[0];
            let val = "";
            if (t === "s") val = v ? ss[+v.textContent] || "" : "";
            else if (t === "inlineStr") { const is = byTag(c, "is")[0]; val = is ? textOf(is) : ""; }
            else val = v ? v.textContent : "";
            row[ref ? colIndex(ref) : i] = val;
          });
          rows.push(Array.from(row, (x) => (x == null ? "" : String(x))));
        }
        book.push({ name: s.name, rows });
      }
      if (!book.length) throw new Error("NO_SHEET");
      return book;
    }

    /* ---- 展廳參數工作表 ---- */
    const HALL_SHEET_RE = /展廳參數|展廳設定|參數|設定|settings|parameters/i;
    const normKey = (s) => String(s == null ? "" : s).normalize("NFKC").replace(/[(（].*?[)）]/g, "").replace(/\s+/g, "").toLowerCase();
    const hallLabel = (p) => p.label + (p.unit ? ` (${p.unit})` : "");
    const hallShow = (p, v) => (p.type === "enum" ? p.opts[v] || p.opts[p.def] : v);
    const hallRange = (p) => (p.type === "num" ? `${p.min} ～ ${p.max}` : p.type === "enum" ? p.opts.join("、") : "文字，最多 20 字");
    function hallCurrent() {
      const h = { ...HALL };
      if (hungAll) { h.wall = WALLS.mode; h.light = LIGHTS.mode; h.decor = DECOR.mode; }
      return h;
    }
    function hallSheetXml(NS) {
      const h = hallCurrent();
      const cell = (ref, v) => (typeof v === "number"
        ? `<c r="${ref}"><v>${v}</v></c>`
        : `<c r="${ref}" t="inlineStr"><is><t xml:space="preserve">${xesc(v)}</t></is></c>`);
      const rows = [["參數", "值", "預設", "範圍／選項", "說明"]].concat(
        HALL_PARAMS.map((p) => [hallLabel(p), hallShow(p, h[p.key]), hallShow(p, p.def), hallRange(p), p.note || ""]));
      const body = rows.map((r, ri) => `<row r="${ri + 1}">` + r.map((v, ci) => cell(String.fromCharCode(65 + ci) + (ri + 1), v)).join("") + "</row>").join("");
      const dv = HALL_PARAMS.map((p, i) => {
        const ref = `B${i + 2}`;
        if (p.type === "enum") return `<dataValidation type="list" allowBlank="1" showErrorMessage="1" sqref="${ref}"><formula1>"${p.opts.join(",")}"</formula1></dataValidation>`;
        if (p.type === "num") return `<dataValidation type="decimal" operator="between" allowBlank="1" showErrorMessage="1" errorTitle="${xesc(p.label)}" error="請輸入 ${p.min} 到 ${p.max}" sqref="${ref}"><formula1>${p.min}</formula1><formula2>${p.max}</formula2></dataValidation>`;
        return "";
      }).filter(Boolean);
      return `<worksheet ${NS}><sheetViews><sheetView workbookViewId="0"><pane ySplit="1" topLeftCell="A2" activePane="bottomLeft" state="frozen"/></sheetView></sheetViews>` +
        `<cols><col min="1" max="1" width="20" customWidth="1"/><col min="2" max="2" width="14" customWidth="1"/><col min="3" max="3" width="10" customWidth="1"/><col min="4" max="4" width="22" customWidth="1"/><col min="5" max="5" width="48" customWidth="1"/></cols>` +
        `<sheetData>${body}</sheetData><dataValidations count="${dv.length}">${dv.join("")}</dataValidations></worksheet>`;
    }
    function planHall(rows) {
      let start = 0, kc = 0, vc = 1;
      for (let r = 0; r < Math.min(rows.length, 5); r++) {
        const ki = rows[r].findIndex((h) => /^(參數|項目|parameter|key)$/i.test(String(h).trim()));
        const vi = rows[r].findIndex((h) => /^(值|數值|設定值|value)$/i.test(String(h).trim()));
        if (ki >= 0 && vi >= 0) { kc = ki; vc = vi; start = r + 1; break; }
      }
      const byName = new Map();
      HALL_PARAMS.forEach((p) => { byName.set(normKey(p.label), p); byName.set(normKey(p.key), p); });
      const cur = hallCurrent();
      const changes = [], bad = [];
      for (let r = start; r < rows.length; r++) {
        const p = byName.get(normKey(rows[r][kc]));
        if (!p) continue;
        const raw = String(rows[r][vc] == null ? "" : rows[r][vc]).normalize("NFKC").trim();
        if (!raw) continue;
        let v;
        if (p.type === "text") v = raw.slice(0, 20);
        else if (p.type === "enum") {
          const i = p.opts.indexOf(raw);
          v = i >= 0 ? i : (/^\d$/.test(raw) && +raw >= 1 && +raw <= p.opts.length ? +raw - 1 : null);
        } else {
          const n = parseFloat(raw);
          if (!isFinite(n)) v = null;
          else {
            v = Math.round(Math.min(p.max, Math.max(p.min, n)) * 1000) / 1000;
            if (v !== n) bad.push(`${p.label} ${raw} 超出範圍，改用 ${v}`);
          }
        }
        if (v === null) { bad.push(`${p.label}「${raw}」看不懂`); continue; }
        if (v !== cur[p.key]) changes.push({ p, v });
      }
      /* 標籤與隔壁畫框的最小間隙（東西廳畫距最多 4.0；畫框最寬 2.45＋兩側外緣 0.38） */
      const nv = { ...cur };
      changes.forEach(({ p, v }) => { nv[p.key] = v; });
      const clear = Math.min(nv.pitch, 4.0) - (2.45 + 2 * FRAME_EDGE) - nv.labelGap - 2 * LABEL_HALF_W;
      if (clear < 0.05) bad.push(`畫距 ${nv.pitch} 搭配標籤距離 ${nv.labelGap}，標籤離隔壁畫框只剩 ${Math.max(0, clear).toFixed(2)} m，建議加大畫距或縮小標籤距離`);
      return { changes, bad };
    }
    function applyHall(changes) {
      let reload = false;
      for (const { p, v } of changes) {
        HALL[p.key] = v;
        if (p.key === "wall") setWallStyle(v);
        else if (p.key === "light") setLightMode(v);
        else if (p.key === "decor") setDecor(v);
        else if (p.key === "eyeH") PLAYER.h = v;
        else if (p.key === "speed") { PLAYER.speed = v; PLAYER.run = v * 1.55; }
        if (!p.now) reload = true;
      }
      return { saved: saveHall(), reload };
    }
    function applyHallNames() {
      const map = { hall: HALL.hallName, west: HALL.westName, east: HALL.eastName, west2: HALL.west2Name, east2: HALL.east2Name };
      LAYOUT.forEach((r) => { if (map[r.id]) r.name = map[r.id]; });
      GALLERY.rooms.forEach((r) => { if (map[r.id]) r.name = map[r.id]; });
      document.title = HALL.name + "（iPad）";
      const set = (sel, t) => { const el = document.querySelector(sel); if (el) el.textContent = t; };
      set(".brand strong", HALL.name);
      set("#blocker h2", coverTitle());
      set("#loader h1", coverTitle());
      set("#room-chip-name", map.hall);
    }
    const fileSafe = (s) => String(s || "").replace(/[\\/:*?"<>|\u0000-\u001f]/g, "").trim() || "我的展廳";
    const FLASH_KEY = "my-hall-flash";

    /* ================= v51 網站 Excel 自動套用 =================
       展廳掛畫完成後自動讀取 works/labels.xlsx（原 Excel 復原）。
       ・欣賞版（網站，GALLERY_VIEWONLY）：每次載入都套用到記憶體，不寫入瀏覽器；
         展廳參數只套即時項目（牆面、燈光、建築、視高、速度），不觸發重新載入。
       ・可編輯版：同一份 Excel 只套用一次（記指紋），本機草稿優先；
         網站換新 Excel 自動重套；網址加 ?excel=1 可強制復原到 Excel。
       讀不到檔案時靜默略過。 */
    const AUTO_XLS_KEY = "my-hall-autoxls-v1" + (GID ? ":" + GID : "");
    async function autoLabels() {
      if (location.protocol === "file:") return;
      let buf;
      try {
        const r = await fetch("works/labels.xlsx", { cache: "no-store" });
        if (!r.ok) return;
        buf = await r.arrayBuffer();
      } catch { return; }
      if (!VIEWONLY) {
        let sig = "n" + buf.byteLength;
        try { const b = new Uint8Array(buf); let h = 0; for (let i = 0; i < b.length; i++) h = (Math.imul(h, 31) + b[i]) >>> 0; sig = h + ":" + buf.byteLength; } catch {}
        if (!/[?&]excel=/.test(location.search) && lsGet(AUTO_XLS_KEY) === sig) return;   // 已套用過這份：草稿優先
        try { localStorage.setItem(AUTO_XLS_KEY, sig); } catch {}                          // 先記指紋，避免重載後重複套用
        try { await importLabels({ name: "labels.xlsx", arrayBuffer: async () => buf }, { quiet: true, flashPrefix: "網站 Excel：" }); }
        catch (e) { console.warn("自動套用 works/labels.xlsx 失敗：", e); }
        return;
      }
      try {                                            /* 欣賞版：直接套用到記憶體 */
        const book = await readXlsxBook(buf);
        const hallSheet = book.find((sh) => sh.name && HALL_SHEET_RE.test(sh.name));
        const labelSheet = book.find((sh) => sh !== hallSheet);
        const { plan } = labelSheet ? planLabels(labelSheet.rows) : { plan: [] };
        let n = 0;
        for (const p of plan) {
          const a = p.art;
          const touched = p.title || p.artist || p.year || p.desc || p.shape || p.matte || p.frame;
          if (!touched) continue;
          if (p.title) a.title = p.title;
          if (p.artist) a.artist = p.artist;
          if (p.year) a.year = p.year;
          if (p.desc) a.description = p.desc;
          const newShape = p.shape && p.shape !== (a.shape || "auto");
          const newMatte = p.matte && p.matte !== matteOf(a);
          if (newShape) a.shape = p.shape;
          if (newMatte) a.matte = p.matte;
          if (newShape || newMatte) rebuildArt(a); else refreshPlaque(a);
          if (p.frame && p.frame !== (a.frame || "gold")) setFrameColor(a, p.frame);
          n++;
          await new Promise((r) => setTimeout(r, 0));
        }
        if (hallSheet) {
          const live = planHall(hallSheet.rows).changes.filter((c) => c.p.now);
          if (live.length) applyHall(live);
        }
        if (n) console.info("網站 Excel：已套用 " + n + " 幅作品資訊（works/labels.xlsx）");
      } catch (e) { console.warn("套用 works/labels.xlsx 失敗：", e); }
    }

    async function importLabels(file, opts = {}) {
      if (VIEWONLY) return false;
      if (importing || exporting) return false;
      if (!hungAll) { setProgress("展廳還在掛畫，請稍候再匯入。", true); return false; }
      let book;
      try {
        const buf = await file.arrayBuffer();
        book = /\.(csv|tsv|txt)$/i.test(file.name) ? [{ name: "", rows: parseCSV(decodeText(buf)) }] : await readXlsxBook(buf);
      } catch (e) {
        const m = e && e.message;
        setProgress(
          m === "NO_INFLATE" ? "這台裝置的瀏覽器太舊，讀不了 .xlsx。請在 Excel「另存新檔」選 CSV 再匯入。"
          : m === "NOT_ZIP" ? "讀不了這個檔案。請選 .xlsx 或 .csv；舊版 .xls 請先另存為 .xlsx。"
          : "讀取 Excel 失敗：" + (m || e), true);
        return;
      }
      const hallSheet = book.find((s) => s.name && HALL_SHEET_RE.test(s.name));
      const labelSheet = book.find((s) => s !== hallSheet);
      const { plan, miss } = labelSheet ? planLabels(labelSheet.rows) : { plan: [], miss: [] };
      const hp = hallSheet ? planHall(hallSheet.rows) : { changes: [], bad: [] };
      if (!plan.length && !hp.changes.length) {
        setProgress(hallSheet && !hp.bad.length
          ? "Excel 的畫作與展廳參數都和目前相同，沒有需要更新的項目。"
          : `Excel 裡沒有對得上的檔名${miss.length ? "（例如「" + miss[0] + "」）" : ""}${hp.bad.length ? "；" + hp.bad[0] : ""}。請確認第一欄是檔名，或加上「檔名、作者、說明」標題列。`, true);
        return;
      }
      const willReload = hp.changes.some((c) => !c.p.now);
      const parts = [];
      if (plan.length) parts.push(`對到 ${plan.length} 幅畫${miss.length ? `（另有 ${miss.length} 列找不到對應）` : ""}，空白欄位保留原內容`);
      if (hp.changes.length) parts.push(`展廳參數更新 ${hp.changes.length} 項：${hp.changes.map((c) => c.p.label).join("、")}${willReload ? "\n（配置或名稱有變，套用後會自動重新載入）" : ""}`);
      if (!opts.quiet && !confirm(`Excel ${parts.join("；\n")}\n確定套用？`)) return false;

      const meta = loadMeta();
      let shaped = 0;
      const badShape = [];
      for (const p of plan) {
        const a = p.art;
        if (p.title) a.title = p.title;
        if (p.artist) a.artist = p.artist;
        if (p.year) a.year = p.year;
        if (p.desc) a.description = p.desc;
        if (p.shape === null) badShape.push(`${a.id}「${p.shapeRaw}」`);
        if (p.matte === null) badShape.push(`${a.id}「${p.matteRaw}」`);
        if (p.frame === null) badShape.push(`${a.id}「${p.frameRaw}」`);
        const newShape = p.shape && p.shape !== (a.shape || "auto");
        const newMatte = p.matte && p.matte !== matteOf(a);
        const newFrame = p.frame && p.frame !== (a.frame || "gold");
        if (!willReload) {                            // 要重新載入就不必逐幅重建，存檔即可
          if (newShape || newMatte) {
            if (newShape) a.shape = p.shape;
            if (newMatte) a.matte = p.matte;
            rebuildArt(a);
          } else refreshPlaque(a);
          if (newFrame) setFrameColor(a, p.frame);
        } else {
          if (newShape) a.shape = p.shape;
          if (newMatte) a.matte = p.matte;
          if (newFrame) a.frame = p.frame;
        }
        if (newShape || newMatte || newFrame) shaped++;
        meta[a.id] = { ...(meta[a.id] || {}), title: a.title, artist: a.artist, year: a.year, description: a.description, frame: a.frame || "gold", shape: a.shape || "auto", matte: matteOf(a) };
        if (!willReload) await new Promise((r) => setTimeout(r, 0));
      }
      const ok = plan.length ? saveMeta(meta) : true;
      const hr = hp.changes.length ? applyHall(hp.changes) : { saved: true, reload: false };

      const msg = [];
      if (plan.length) {
        msg.push(`已從 Excel 更新 ${plan.length} 幅${shaped ? `，其中 ${shaped} 幅改了畫框樣式` : ""}`);
        if (miss.length) msg.push(`${miss.length} 列沒對到：${miss.slice(0, 3).join("、")}${miss.length > 3 ? "…" : ""}`);
        if (badShape.length) msg.push(`畫框／形狀／邊框看不懂、未更改：${badShape.slice(0, 3).join("、")}${badShape.length > 3 ? "…" : ""}`);
      }
      if (hp.changes.length) msg.push(`展廳參數已更新 ${hp.changes.length} 項（${hp.changes.map((c) => `${c.p.label} ${hallShow(c.p, c.v)}`).join("、")}）`);
      hp.bad.forEach((b) => msg.push(b));
      if (!ok || !hr.saved) msg.push("瀏覽器不允許存檔，重開後會還原");
      const text = msg.join("；");
      const warn = miss.length > 0 || badShape.length > 0 || hp.bad.length > 0 || !ok || !hr.saved;
      if (hr.reload && hr.saved && ok) {
        try { sessionStorage.setItem(FLASH_KEY, JSON.stringify({ text: (opts.flashPrefix || "") + text, warn })); } catch {}
        setProgress("套用中，重新載入展廳…");
        if (opts.beforeReload) { try { await opts.beforeReload(); } catch {} }
        setTimeout(() => location.reload(), 300);
        return "reload";
      }
      setProgress(text, warn);
      return true;
    }

    /* ---- 範本：產生真正的 .xlsx（zip 不壓縮 + CRC32），預填目前 30 幅 ---- */
    const CRC_T = (() => {
      const t = new Uint32Array(256);
      for (let n = 0; n < 256; n++) { let c = n; for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1; t[n] = c >>> 0; }
      return t;
    })();
    function crc32(b) { let c = 0xffffffff; for (let i = 0; i < b.length; i++) c = CRC_T[(c ^ b[i]) & 255] ^ (c >>> 8); return (c ^ 0xffffffff) >>> 0; }
    function zipStore(entries) {
      const enc = new TextEncoder();
      const parts = [], central = [];
      let off = 0;
      for (const e of entries) {
        const name = enc.encode(e.name), data = enc.encode(e.text), crc = crc32(data);
        const h = new DataView(new ArrayBuffer(30));
        h.setUint32(0, 0x04034b50, true); h.setUint16(4, 20, true); h.setUint16(6, 0x0800, true);
        h.setUint16(12, 0x21, true); h.setUint32(14, crc, true); h.setUint32(18, data.length, true); h.setUint32(22, data.length, true);
        h.setUint16(26, name.length, true);
        parts.push(new Uint8Array(h.buffer), name, data);
        const c = new DataView(new ArrayBuffer(46));
        c.setUint32(0, 0x02014b50, true); c.setUint16(4, 20, true); c.setUint16(6, 20, true); c.setUint16(8, 0x0800, true);
        c.setUint16(14, 0x21, true); c.setUint32(16, crc, true); c.setUint32(20, data.length, true); c.setUint32(24, data.length, true);
        c.setUint16(28, name.length, true); c.setUint32(42, off, true);
        central.push(new Uint8Array(c.buffer), name);
        off += 30 + name.length + data.length;
      }
      const csize = central.reduce((s, x) => s + x.length, 0);
      const end = new DataView(new ArrayBuffer(22));
      end.setUint32(0, 0x06054b50, true); end.setUint16(8, entries.length, true); end.setUint16(10, entries.length, true);
      end.setUint32(12, csize, true); end.setUint32(16, off, true);
      return new Blob([...parts, ...central, new Uint8Array(end.buffer)], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" });
    }
    const xesc = (s) => String(s == null ? "" : s)
      .replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F]/g, "")
      .replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
    function downloadLabelTemplate() {
      const list = hungAll
        ? artworks.slice().sort((a, b) => a.id.localeCompare(b.id))
        : GALLERY.rooms.flatMap((r) => r.works);
      const rows = [["編號", "檔名", "作者", "年代", "畫框", "形狀", "邊框", "說明"]].concat(
        list.map((a) => { const mt = MATTES[matteOf(a)];
          return [a.id, a.fileName ? stripName(a.fileName) : a.title, a.artist, a.year, FRAME_LABEL[a.frame] || FRAME_LABEL.gold,
            SHAPE_LABEL[a.shape] || SHAPE_LABEL.auto, mt ? mt.label : "無", a.description]; }));
      const sheetRows = rows.map((r, ri) => `<row r="${ri + 1}">` + r.map((v, ci) =>
        `<c r="${String.fromCharCode(65 + ci)}${ri + 1}" t="inlineStr"><is><t xml:space="preserve">${xesc(v)}</t></is></c>`).join("") + "</row>").join("");
      const NS = 'xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"';
      const RNS = 'xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"';
      const X = '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\n';
      const blob = zipStore([
        { name: "[Content_Types].xml", text: X + '<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/><Override PartName="/xl/worksheets/sheet1.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/><Override PartName="/xl/worksheets/sheet2.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/></Types>' },
        { name: "_rels/.rels", text: X + '<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/></Relationships>' },
        { name: "xl/workbook.xml", text: X + `<workbook ${NS} ${RNS}><sheets><sheet name="展廳標籤" sheetId="1" r:id="rId1"/><sheet name="展廳參數" sheetId="2" r:id="rId2"/></sheets></workbook>` },
        { name: "xl/_rels/workbook.xml.rels", text: X + '<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet1.xml"/><Relationship Id="rId2" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet2.xml"/></Relationships>' },
        { name: "xl/worksheets/sheet1.xml", text: X + `<worksheet ${NS}><sheetViews><sheetView workbookViewId="0"><pane ySplit="1" topLeftCell="A2" activePane="bottomLeft" state="frozen"/></sheetView></sheetViews><cols><col min="1" max="1" width="7" customWidth="1"/><col min="2" max="2" width="42" customWidth="1"/><col min="3" max="3" width="16" customWidth="1"/><col min="4" max="4" width="8" customWidth="1"/><col min="5" max="5" width="8" customWidth="1"/><col min="6" max="6" width="10" customWidth="1"/><col min="7" max="7" width="8" customWidth="1"/><col min="8" max="8" width="60" customWidth="1"/></cols><sheetData>${sheetRows}</sheetData><dataValidations count="3"><dataValidation type="list" allowBlank="1" showErrorMessage="1" errorTitle="畫框" error="請從清單選：白、黑、金、銀" sqref="E2:E${rows.length}"><formula1>"白,黑,金,銀"</formula1></dataValidation><dataValidation type="list" allowBlank="1" showErrorMessage="1" errorTitle="形狀" error="請從清單選：依圖片、直幅、橫幅" sqref="F2:F${rows.length}"><formula1>"依圖片,直幅,橫幅"</formula1></dataValidation><dataValidation type="list" allowBlank="1" showErrorMessage="1" errorTitle="邊框" error="請從清單選：淺白、淺橘、灰、白、黑、金、銀、無" sqref="G2:G${rows.length}"><formula1>"淺白,淺橘,灰,白,黑,金,銀,無"</formula1></dataValidation></dataValidations></worksheet>` },
        { name: "xl/worksheets/sheet2.xml", text: X + hallSheetXml(NS) }
      ]);
      const name = `${fileSafe(HALL.name)}-資訊-${mmdd()}.xlsx`;
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url; a.download = name;
      document.body.appendChild(a); a.click(); a.remove();
      setTimeout(() => URL.revokeObjectURL(url), 60000);
      setProgress(`已匯出「${name}」：第一張是各幅畫、第二張是展廳參數；在 Excel 修改後存檔，再按「Excel 匯入」選這個檔即可套用。`);
    }

    function setStatus(text, warn) {
      const el = $("iv-status");
      if (!el) return;
      el.textContent = text;
      el.style.color = warn ? "#e0a070" : "";
    }

    /* ================= 建築 ================= */
    function addDoorWall(axis, centerA, centerB, length, h, plaster, rail, nb, inn) {
      const gap = DOOR_W;
      const side = (length - gap) / 2;
      if (nb) {
        /* v74：兩廳共用的門牆拆成兩片各半厚，各屬自己的廳 → 每廳牆面可以不同 */
        const half = WALL_T / 2, own = batchRoom;
        const slab = (room, s) => {
          batchRoom = room;
          if (axis === "z") {
            const z = centerB + s * half / 2;
            addBox(new THREE.BoxGeometry(side, h, half), plaster, centerA - gap / 2 - side / 2, h / 2, z, true);
            addBox(new THREE.BoxGeometry(side, h, half), plaster, centerA + gap / 2 + side / 2, h / 2, z, true);
            addBox(new THREE.BoxGeometry(gap, h - DOOR_H, half), plaster, centerA, DOOR_H + (h - DOOR_H) / 2, z, true);
          } else {
            const x = centerA + s * half / 2;
            addBox(new THREE.BoxGeometry(half, h, side), plaster, x, h / 2, centerB - gap / 2 - side / 2, true);
            addBox(new THREE.BoxGeometry(half, h, side), plaster, x, h / 2, centerB + gap / 2 + side / 2, true);
            addBox(new THREE.BoxGeometry(half, h - DOOR_H, gap), plaster, x, DOOR_H + (h - DOOR_H) / 2, centerB, true);
          }
        };
        slab(own, inn); slab(nb, -inn);
        batchRoom = own;
        plaster = null;                              /* 牆已蓋好，下面只做門框 */
      }
      const t = WALL_T;
      const wallBox = (...a) => { if (plaster) addBox(...a); };
      if (axis === "z") {
        const z = centerB;
        wallBox(new THREE.BoxGeometry(side, h, t), plaster, centerA - gap / 2 - side / 2, h / 2, z, true);
        wallBox(new THREE.BoxGeometry(side, h, t), plaster, centerA + gap / 2 + side / 2, h / 2, z, true);
        wallBox(new THREE.BoxGeometry(gap, h - DOOR_H, t), plaster, centerA, DOOR_H + (h - DOOR_H) / 2, z, true);
        addBox(new THREE.BoxGeometry(gap, 0.12, 0.18), rail, centerA, DOOR_H + 0.06, z);
        addBox(new THREE.BoxGeometry(0.22, DOOR_H, 0.16), rail, centerA - gap / 2, DOOR_H / 2, z + (z < 0 ? 0.12 : -0.12));
        addBox(new THREE.BoxGeometry(0.22, DOOR_H, 0.16), rail, centerA + gap / 2, DOOR_H / 2, z + (z < 0 ? 0.12 : -0.12));
        addBox(new THREE.BoxGeometry(gap + 0.5, 0.22, 0.22), rail, centerA, DOOR_H + 0.2, z);
      } else {
        const x = centerA;
        wallBox(new THREE.BoxGeometry(t, h, side), plaster, x, h / 2, centerB - gap / 2 - side / 2, true);
        wallBox(new THREE.BoxGeometry(t, h, side), plaster, x, h / 2, centerB + gap / 2 + side / 2, true);
        wallBox(new THREE.BoxGeometry(t, h - DOOR_H, gap), plaster, x, DOOR_H + (h - DOOR_H) / 2, centerB, true);
        addBox(new THREE.BoxGeometry(0.18, 0.12, gap), rail, x, DOOR_H + 0.06, centerB);
        addBox(new THREE.BoxGeometry(0.16, DOOR_H, 0.22), rail, x + (x < 0 ? 0.12 : -0.12), DOOR_H / 2, centerB - gap / 2);
        addBox(new THREE.BoxGeometry(0.16, DOOR_H, 0.22), rail, x + (x < 0 ? 0.12 : -0.12), DOOR_H / 2, centerB + gap / 2);
        addBox(new THREE.BoxGeometry(0.22, 0.22, gap + 0.5), rail, x, DOOR_H + 0.2, centerB);
      }
    }

    function dressBaroque(rec, gold, cream, frescoMat) {
      const { w, d, h, cx, cz, doors = [], skip = [] } = rec;
      const inset = 0.2;
      const faces = [
        { id: "north", axis: "z", a: cx, b: cz - d / 2, len: w, inn: 1 },
        { id: "south", axis: "z", a: cx, b: cz + d / 2, len: w, inn: -1 },
        { id: "west", axis: "x", a: cx - w / 2, b: cz, len: d, inn: 1 },
        { id: "east", axis: "x", a: cx + w / 2, b: cz, len: d, inn: -1 }
      ];
      faces.forEach((f) => {
        if (skip.includes(f.id)) return;
        const yTop = h - 0.14;
        const n = Math.max(8, Math.floor(f.len / 0.34));
        if (f.axis === "z") {
          const z = f.b + f.inn * inset;
          addBox(new THREE.BoxGeometry(f.len - 0.15, 0.18, 0.28), gold, f.a, yTop, z);
          addBox(new THREE.BoxGeometry(f.len - 0.15, 0.11, 0.4), cream, f.a, yTop - 0.16, z + f.inn * 0.05);
          addBox(new THREE.BoxGeometry(f.len - 0.15, 0.08, 0.22), gold, f.a, yTop - 0.28, z + f.inn * 0.02);
          for (let i = 1; i < n; i++) {
            if (doors.includes(f.id) && Math.abs(i / n - 0.5) < 0.12) continue;
            addBox(new THREE.BoxGeometry(0.11, 0.09, 0.11), gold, f.a - f.len / 2 + (i * f.len) / n, yTop - 0.38, z + f.inn * 0.1);
          }
        } else {
          const x = f.a + f.inn * inset;
          addBox(new THREE.BoxGeometry(0.28, 0.18, f.len - 0.15), gold, x, yTop, f.b);
          addBox(new THREE.BoxGeometry(0.4, 0.11, f.len - 0.15), cream, x + f.inn * 0.05, yTop - 0.16, f.b);
          addBox(new THREE.BoxGeometry(0.22, 0.08, f.len - 0.15), gold, x + f.inn * 0.02, yTop - 0.28, f.b);
          for (let i = 1; i < n; i++) {
            if (doors.includes(f.id) && Math.abs(i / n - 0.5) < 0.12) continue;
            addBox(new THREE.BoxGeometry(0.11, 0.09, 0.11), gold, x + f.inn * 0.1, yTop - 0.38, f.b - f.len / 2 + (i * f.len) / n);
          }
        }
      });

      const nx = rec.id === "hall" ? 5 : 4;
      const nz = 3;
      const margin = 1.35;
      const cw = (w - margin * 2) / nx;
      const cd = (d - margin * 2) / nz;
      const yBeam = h - 0.14;
      for (let i = 0; i <= nx; i++) addBox(new THREE.BoxGeometry(0.2, 0.24, d - 1.5), gold, cx - w / 2 + margin + i * cw, yBeam, cz);
      for (let j = 0; j <= nz; j++) addBox(new THREE.BoxGeometry(w - 1.5, 0.24, 0.2), gold, cx, yBeam, cz - d / 2 + margin + j * cd);
      for (let i = 0; i < nx; i++) {
        for (let j = 0; j < nz; j++) {
          const x = cx - w / 2 + margin + cw * (i + 0.5);
          const z = cz - d / 2 + margin + cd * (j + 0.5);
          const isCenter = rec.id === "hall" && i === 2 && j === 1;
          addBox(new THREE.BoxGeometry(cw * 0.78, 0.07, 0.07), gold, x, h - 0.08, z - cd * 0.34);
          addBox(new THREE.BoxGeometry(cw * 0.78, 0.07, 0.07), gold, x, h - 0.08, z + cd * 0.34);
          addBox(new THREE.BoxGeometry(0.07, 0.07, cd * 0.78), gold, x - cw * 0.34, h - 0.08, z);
          addBox(new THREE.BoxGeometry(0.07, 0.07, cd * 0.78), gold, x + cw * 0.34, h - 0.08, z);
          if (isCenter) continue;
          queue(new THREE.PlaneGeometry(cw * 0.62, cd * 0.62).rotateX(Math.PI / 2).translate(x, h - 0.03, z), frescoMat);
        }
      }

      queue(new THREE.TorusGeometry(1.35, 0.08, 10, 36).rotateX(Math.PI / 2).translate(cx, h - 0.18, cz), gold);
      queue(new THREE.TorusGeometry(0.85, 0.05, 8, 28).rotateX(Math.PI / 2).translate(cx, h - 0.2, cz), gold);
      queue(new THREE.CircleGeometry(0.72, 28).rotateX(-Math.PI / 2).translate(cx, h - 0.05, cz), frescoMat);
      queue(new THREE.SphereGeometry(0.16, 16, 12).translate(cx, h - 0.28, cz), gold);

      [[-1, -1], [1, -1], [-1, 1], [1, 1]].forEach(([sx, sz]) => {
        const x = cx + sx * (w / 2 - 0.55);
        const z = cz + sz * (d / 2 - 0.55);
        addBox(new THREE.BoxGeometry(0.55, 0.28, 0.55), gold, x, h - 0.22, z);
        queue(new THREE.SphereGeometry(0.14, 12, 10).translate(x, h - 0.42, z), gold);
      });
    }

    function doorLabel(text, x, y, z, rotY) {
      const c = document.createElement("canvas");
      c.width = 512; c.height = 128;
      const ctx = c.getContext("2d");
      ctx.fillStyle = "#e8d5a3";
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      let fs = 52;                                   // 廳名較長時自動縮字
      ctx.font = `600 ${fs}px Microsoft JhengHei, PingFang TC, sans-serif`;
      while (fs > 20 && ctx.measureText(text).width > 480) { fs -= 2; ctx.font = `600 ${fs}px Microsoft JhengHei, PingFang TC, sans-serif`; }
      ctx.fillText(text, 256, 64);
      const tex = new THREE.Texture(c); tex.needsUpdate = true;
      if (THREE.SRGBColorSpace) tex.colorSpace = THREE.SRGBColorSpace;
      const mesh = new THREE.Mesh(new THREE.PlaneGeometry(2.6, 0.55), new THREE.MeshBasicMaterial({ map: tex, transparent: true }));
      mesh.position.set(x, y, z);
      mesh.rotation.y = rotY;
      bendObj(mesh);
      scene.add(mesh);
    }

    /* ================= v29 高第（米拉之家閣樓）與極簡建築 ================= */
    /* 磚：薄磚（tabique）錯縫，暖黃褐 */
    function makeBrickTex() {
      const c = document.createElement("canvas");
      c.width = c.height = 512;
      const ctx = c.getContext("2d");
      ctx.fillStyle = "#b99a78"; ctx.fillRect(0, 0, 512, 512);          /* 灰縫 */
      const rows = 12, bw = 128, bh = 512 / rows;
      const tones = ["#d8b58c", "#cfa87c", "#e0bf98", "#c99f74", "#d4ae86"];
      for (let r = 0; r < rows; r++) {
        const off = r % 2 ? bw / 2 : 0;
        for (let k = -1; k < 5; k++) {
          ctx.fillStyle = tones[(r * 7 + k * 3 + 10) % tones.length];
          ctx.fillRect(k * bw + off + 3, r * bh + 3, bw - 6, bh - 6);
          ctx.fillStyle = "rgba(120,80,40,0.07)";
          for (let s = 0; s < 14; s++) ctx.fillRect(k * bw + off + 3 + Math.random() * (bw - 8), r * bh + 3 + Math.random() * (bh - 8), 2, 2);
        }
      }
      const t = new THREE.Texture(c); t.needsUpdate = true; t.wrapS = t.wrapT = THREE.RepeatWrapping;
      if (THREE.SRGBColorSpace) t.colorSpace = THREE.SRGBColorSpace;
      return t;
    }
    /* 高第六角地磚（panot）：灰綠底、每塊一個菊石漩渦＋海藻弧線；尖頂六角可無縫重複 */
    function makeHexTex() {
      const s = 97, W = 168, H = 291;                  /* √3·97 ≈ 168，3·97 = 291 → 週期剛好 */
      const k = 2, c = document.createElement("canvas");
      c.width = W * k; c.height = H * k;
      const ctx = c.getContext("2d");
      ctx.scale(k, k);
      ctx.fillStyle = "#6f8580"; ctx.fillRect(0, 0, W, H);
      const hex = (cx, cy) => {
        ctx.beginPath();
        for (let i = 0; i < 6; i++) { const a = Math.PI / 6 + i * Math.PI / 3; ctx.lineTo(cx + Math.cos(a) * s, cy + Math.sin(a) * s); }
        ctx.closePath();
      };
      for (let r = -1; r <= 3; r++) {
        for (let q = -1; q <= 2; q++) {
          const cx = q * W + (r % 2 ? W / 2 : 0), cy = r * 1.5 * s;
          hex(cx, cy);
          ctx.fillStyle = (r + q) % 2 ? "#7a908a" : "#728983"; ctx.fill();
          ctx.lineWidth = 3; ctx.strokeStyle = "#4d605b"; ctx.stroke();
          ctx.lineWidth = 1.5; ctx.strokeStyle = "rgba(220,235,228,0.35)"; ctx.stroke();
          ctx.save(); ctx.translate(cx, cy);
          ctx.strokeStyle = "rgba(40,58,54,0.65)"; ctx.lineWidth = 4;     /* 菊石漩渦 */
          ctx.beginPath();
          for (let t = 0; t < 16; t += 0.2) { const rr = 3 + t * 2.4; ctx.lineTo(Math.cos(t) * rr, Math.sin(t) * rr); }
          ctx.stroke();
          ctx.strokeStyle = "rgba(210,228,220,0.35)"; ctx.lineWidth = 2;  /* 高光 */
          ctx.beginPath();
          for (let t = 0; t < 16; t += 0.2) { const rr = 3 + t * 2.4; ctx.lineTo(Math.cos(t) * rr - 1.5, Math.sin(t) * rr - 1.5); }
          ctx.stroke();
          ctx.strokeStyle = "rgba(40,58,54,0.5)"; ctx.lineWidth = 3;      /* 海藻三弧 */
          for (let i = 0; i < 3; i++) {
            ctx.rotate(Math.PI * 2 / 3);
            ctx.beginPath(); ctx.moveTo(44, 0);
            ctx.bezierCurveTo(60, -22, 72, 10, 86, -6);
            ctx.stroke();
          }
          ctx.restore();
        }
      }
      const t = new THREE.Texture(c); t.needsUpdate = true; t.wrapS = t.wrapT = THREE.RepeatWrapping;
      t.repeat.set(1 / 0.52, 1 / 0.9);                 /* 一塊六角約 0.6 m 寬 */
      t.anisotropy = Q.aniso;
      if (THREE.SRGBColorSpace) t.colorSpace = THREE.SRGBColorSpace;
      return t;
    }
    /* 石材牆：米拉之家立面的石灰岩，帶起伏層理 */
    /* 古典紅：美術館常見的酒紅錦緞壁布（半錯位排列的對稱花紋，花紋略帶光澤） */
    function makeDamaskTex() {
      const S = 512, c = document.createElement("canvas");
      c.width = c.height = S;
      const ctx = c.getContext("2d");
      const bg = ctx.createLinearGradient(0, 0, 0, S);
      bg.addColorStop(0, "#7c1622"); bg.addColorStop(0.5, "#741420"); bg.addColorStop(1, "#7c1622");
      ctx.fillStyle = bg; ctx.fillRect(0, 0, S, S);
      for (let i = 0; i < 1800; i++) {                   /* 織紋 */
        ctx.fillStyle = Math.random() < 0.5 ? "rgba(0,0,0,0.05)" : "rgba(255,200,200,0.035)";
        ctx.fillRect(Math.random() * S, Math.random() * S, 3, 1);
      }
      const half = (sx) => {                              /* 花紋的一半（再左右鏡射） */
        ctx.beginPath();
        ctx.moveTo(0, -120);
        ctx.bezierCurveTo(sx * 30, -100, sx * 20, -70, sx * 46, -58);
        ctx.bezierCurveTo(sx * 80, -44, sx * 70, -8, sx * 46, -14);
        ctx.bezierCurveTo(sx * 30, -18, sx * 36, 6, sx * 58, 12);
        ctx.bezierCurveTo(sx * 92, 22, sx * 78, 70, sx * 44, 62);
        ctx.bezierCurveTo(sx * 24, 58, sx * 22, 92, 0, 120);
        ctx.closePath();
        ctx.fill();
        ctx.beginPath();                                  /* 捲葉 */
        ctx.arc(sx * 70, -40, 9, 0, Math.PI * 2);
        ctx.arc(sx * 74, 44, 7, 0, Math.PI * 2);
        ctx.fill();
      };
      const motif = (x, y, k) => {
        ctx.save(); ctx.translate(x, y); ctx.scale(k, k);
        ctx.fillStyle = "rgba(170,40,52,0.55)";
        half(1); half(-1);
        ctx.fillStyle = "rgba(90,8,18,0.55)";              /* 中心的花苞 */
        ctx.beginPath(); ctx.ellipse(0, 0, 14, 34, 0, 0, Math.PI * 2); ctx.fill();
        ctx.strokeStyle = "rgba(230,150,120,0.22)"; ctx.lineWidth = 2;
        ctx.beginPath(); ctx.ellipse(0, 0, 22, 46, 0, 0, Math.PI * 2); ctx.stroke();
        ctx.restore();
      };
      /* 主花在中心與四角，小花半錯位 → 可無縫重複 */
      [[S / 2, S / 2], [0, 0], [S, 0], [0, S], [S, S]].forEach(([x, y]) => motif(x, y, 1));
      [[0, S / 2], [S, S / 2], [S / 2, 0], [S / 2, S]].forEach(([x, y]) => motif(x, y, 0.55));
      const t = new THREE.Texture(c); t.needsUpdate = true; t.wrapS = t.wrapT = THREE.RepeatWrapping;
      t.repeat.set(1 / 1.1, 1 / 1.1);                     /* 一組花紋約 1.1 m */
      t.anisotropy = Q.aniso;
      if (THREE.SRGBColorSpace) t.colorSpace = THREE.SRGBColorSpace;
      return t;
    }
    function makeStoneTex() {
      const c = document.createElement("canvas");
      c.width = c.height = 512;
      const ctx = c.getContext("2d");
      ctx.fillStyle = "#d8c9ae"; ctx.fillRect(0, 0, 512, 512);
      for (let i = 0; i < 2600; i++) {
        ctx.fillStyle = `rgba(${90 + Math.random() * 60},${70 + Math.random() * 40},${40 + Math.random() * 30},${0.05 + Math.random() * 0.08})`;
        ctx.fillRect(Math.random() * 512, Math.random() * 512, 1 + Math.random() * 3, 1 + Math.random() * 3);
      }
      for (let b = 0; b < 6; b++) {                     /* 週期性波紋（左右接得起來） */
        const y0 = b * 512 / 6 + 30;
        ctx.strokeStyle = "rgba(120,96,64,0.28)"; ctx.lineWidth = 3;
        ctx.beginPath();
        for (let x = 0; x <= 512; x += 8) ctx.lineTo(x, y0 + Math.sin(x / 512 * Math.PI * 2 * 2 + b) * 14);
        ctx.stroke();
        ctx.strokeStyle = "rgba(255,248,232,0.35)"; ctx.lineWidth = 2;
        ctx.beginPath();
        for (let x = 0; x <= 512; x += 8) ctx.lineTo(x, y0 + 4 + Math.sin(x / 512 * Math.PI * 2 * 2 + b) * 14);
        ctx.stroke();
      }
      const t = new THREE.Texture(c); t.needsUpdate = true; t.wrapS = t.wrapT = THREE.RepeatWrapping;
      t.repeat.set(1 / 4, 1 / 4);
      if (THREE.SRGBColorSpace) t.colorSpace = THREE.SRGBColorSpace;
      return t;
    }

    /* 懸鏈線（倒掛鏈條）：v∈[-1,1]，兩端 0、中央 1 */
    const CAT_A = 2.2;
    function catF(v) { const ca = Math.cosh(CAT_A); return (ca - Math.cosh(CAT_A * v)) / (ca - 1); }
    const GAUDI_SPRING = 4.9;                          /* 起拱高度：高於畫框、門楣與門牌 */
    function gaudiRise(rec, x) { return 5.0 + 0.85 * Math.sin((x - rec.cx) * 0.42 + rec.cx * 0.13); }   /* 拱高沿長向起伏，像閣樓的「鯨魚肋骨」 */
    function gaudiSpan(rec) { return rec.d / 2 - 0.16; }

    /* 沿路徑掃出矩形斷面（肋拱、波浪線腳） */
    function sweepRect(pts, sideAt, depthAt, w, dep) {
      const pos = [], uv = [];
      let L = 0;
      const corner = (i, k, out) => {
        const p = pts[i], A = sideAt(i), B = depthAt(i);
        const sa = k === 0 || k === 3 ? -w / 2 : w / 2;
        const sb = k >= 2 ? dep : -0.03;
        out.set(p.x + A.x * sa + B.x * sb, p.y + A.y * sa + B.y * sb, p.z + A.z * sa + B.z * sb);
        return out;
      };
      const c = [new THREE.Vector3(), new THREE.Vector3(), new THREE.Vector3(), new THREE.Vector3()];
      for (let i = 0; i < pts.length - 1; i++) {
        const seg = pts[i].distanceTo(pts[i + 1]);
        for (let f = 0; f < 4; f++) {
          const ka = f, kb = (f + 1) % 4;
          corner(i, ka, c[0]); corner(i, kb, c[1]); corner(i + 1, kb, c[2]); corner(i + 1, ka, c[3]);
          pos.push(c[0].x, c[0].y, c[0].z, c[1].x, c[1].y, c[1].z, c[2].x, c[2].y, c[2].z,
                   c[0].x, c[0].y, c[0].z, c[2].x, c[2].y, c[2].z, c[3].x, c[3].y, c[3].z);
          const u0 = L * 0.9, u1 = (L + seg) * 0.9, v0 = 0, v1 = 0.3;
          uv.push(u0, v0, u0, v1, u1, v1, u0, v0, u1, v1, u1, v0);
        }
        L += seg;
      }
      const g = new THREE.BufferGeometry();
      g.setAttribute("position", new THREE.Float32BufferAttribute(pos, 3));
      g.setAttribute("uv", new THREE.Float32BufferAttribute(uv, 2));
      g.computeVertexNormals();
      return g;
    }

    function dressGaudi(rec, M) {
      const { w, cx, cz } = rec;
      const yS = GAUDI_SPRING, s = gaudiSpan(rec);
      const x0 = cx - w / 2 + 0.15, x1 = cx + w / 2 - 0.15;
      /* 1. 拱殼：沿長向的懸鏈線筒拱，拱高隨 x 起伏 */
      const NX = Math.ceil((x1 - x0) / 0.35), NV = 40;
      const pos = [], uv = [], idx = [];
      for (let i = 0; i <= NX; i++) {
        const x = x0 + (x1 - x0) * i / NX, R = gaudiRise(rec, x);
        let arc = 0, py = 0, pz = 0;
        for (let j = 0; j <= NV; j++) {
          const v = -1 + 2 * j / NV, y = yS + R * catF(v), z = cz + v * s;
          if (j) arc += Math.hypot(y - py, z - pz);
          py = y; pz = z;
          pos.push(x, y, z); uv.push(x * 0.9, arc * 0.9);
        }
      }
      for (let i = 0; i < NX; i++) for (let j = 0; j < NV; j++) {
        const a = i * (NV + 1) + j, b = a + NV + 1;
        idx.push(a, b, a + 1, b, b + 1, a + 1);
      }
      const shell = new THREE.BufferGeometry();
      shell.setAttribute("position", new THREE.Float32BufferAttribute(pos, 3));
      shell.setAttribute("uv", new THREE.Float32BufferAttribute(uv, 2));
      shell.setIndex(idx);
      shell.computeVertexNormals();
      queue(shell, M.vault);
      /* 2. 肋拱：每 1.15 m 一道，貼著拱殼向內凸出 */
      const side = new THREE.Vector3(1, 0, 0);
      for (let x = x0 + 0.55; x < x1 - 0.3; x += 1.15) {
        const R = gaudiRise(rec, x), pts = [], nrm = [];
        const N = 32;
        for (let j = 0; j <= N; j++) {
          const v = -1 + 2 * j / N;
          pts.push(new THREE.Vector3(x, yS + R * catF(v), cz + v * s));
        }
        for (let j = 0; j <= N; j++) {
          const a = pts[Math.max(0, j - 1)], b = pts[Math.min(N, j + 1)];
          const dz = b.z - a.z, dy = b.y - a.y, l = Math.hypot(dz, dy) || 1;
          nrm.push(new THREE.Vector3(0, -dz / l, dy / l));     /* 指向室內（往下、往中央） */
        }
        queue(sweepRect(pts, () => side, (j) => nrm[j], 0.26, 0.34), M.rib);
      }
      /* 3. 起拱處的波浪線腳（長牆兩側） */
      [-1, 1].forEach((sz) => {
        const pts = [], N = Math.ceil((x1 - x0) / 0.2);
        for (let i = 0; i <= N; i++) {
          const x = x0 + (x1 - x0) * i / N;
          pts.push(new THREE.Vector3(x, yS - 0.08 + 0.12 * Math.sin(x * 1.6), cz + sz * (s + 0.01)));
        }
        const up = new THREE.Vector3(0, 1, 0), inn = new THREE.Vector3(0, 0, -sz);
        queue(sweepRect(pts, () => up, () => inn, 0.3, 0.16), M.rib);
      });
      /* 4. 兩端山牆：補滿牆頂到拱殼之間，中央開一個橢圓窗光 */
      [[x0 + 0.02, 1], [x1 - 0.02, -1]].forEach(([xe, inward]) => {
        const R = gaudiRise(rec, xe);
        const shape = new THREE.Shape();
        shape.moveTo(-s, yS - 0.35);
        for (let j = 0; j <= 40; j++) { const v = -1 + 2 * j / 40; shape.lineTo(v * s, yS + R * catF(v)); }
        shape.lineTo(s, yS - 0.35);
        const g = new THREE.ShapeGeometry(shape, 1);
        g.rotateY(Math.PI / 2); g.translate(xe, 0, cz);
        queue(g, M.gable);
        const eye = new THREE.CircleGeometry(1, 36);
        eye.scale(0.75, 1.05, 1);
        eye.rotateY(inward > 0 ? Math.PI / 2 : -Math.PI / 2);
        eye.translate(xe + inward * 0.03, yS + R * 0.52, cz);
        queue(eye, M.eye);
      });
    }

    function dressMinimal(rec, led) {
      const { w, d, h, cx, cz, skip = [] } = rec;
      const y = h - 0.32, t = 0.03, off = WALL_T / 2 + 0.03;
      [
        { id: "north", geo: () => new THREE.BoxGeometry(w - 0.6, t, t), x: cx, z: cz - d / 2 + off },
        { id: "south", geo: () => new THREE.BoxGeometry(w - 0.6, t, t), x: cx, z: cz + d / 2 - off },
        { id: "west", geo: () => new THREE.BoxGeometry(t, t, d - 0.6), x: cx - w / 2 + off, z: cz },
        { id: "east", geo: () => new THREE.BoxGeometry(t, t, d - 0.6), x: cx + w / 2 - off, z: cz }
      ].forEach((f) => {
        const g = f.geo(); g.translate(f.x, y, f.z);
        queue(g, led);
      });
    }


    /* ================= v61 現代：依參考照片 =================
       白色曲線夾層（橢圓開口＋直條欄杆）、夾層底木格柵（沿曲線的同心鰭片）、
       暖色燈槽、嵌燈、清水混凝土圓柱、水磨石地坪、上層白色天花與天窗 */
    const MOD_Y = 5.2;            /* 木格柵底面高度：高於畫作、門楣（3.8）與門牌（4.15） */
    const MOD_FASCIA = 0.74;      /* 夾層白色邊帶高度 */
    const MOD_COLS = [];          /* 柱子碰撞 { x, z, r } */
    function canvasTex(size, draw, repX, repY) {
      const c = document.createElement("canvas");
      c.width = c.height = size;
      draw(c.getContext("2d"), size);
      const t = new THREE.Texture(c);
      if (THREE.SRGBColorSpace) t.colorSpace = THREE.SRGBColorSpace;
      t.wrapS = t.wrapT = THREE.RepeatWrapping; t.repeat.set(repX, repY); t.needsUpdate = true;
      return t;
    }
    function makeTerrazzoTex() {       /* 世界座標 UV：每 2.4 m 重複一次 */
      return canvasTex(1024, (ctx, S) => {
        ctx.fillStyle = "#cfccc6"; ctx.fillRect(0, 0, S, S);
        for (let i = 0; i < 1400; i++) {
          const g = 200 + Math.random() * 30;
          ctx.fillStyle = `rgba(${g},${g - 3},${g - 8},0.22)`;
          ctx.beginPath(); ctx.arc(Math.random() * S, Math.random() * S, 6 + Math.random() * 26, 0, Math.PI * 2); ctx.fill();
        }
        const cols = ["#8d8a84", "#6f6a63", "#e9e6e0", "#a8a39a", "#b9a58c", "#5d5a56", "#f4f2ee"];
        for (let i = 0; i < 9000; i++) {
          ctx.fillStyle = cols[(Math.random() * cols.length) | 0];
          ctx.globalAlpha = 0.55 + Math.random() * 0.4;
          const x = Math.random() * S, y = Math.random() * S, r = 0.6 + Math.random() * Math.random() * 3.4;
          ctx.beginPath(); ctx.ellipse(x, y, r, r * (0.6 + Math.random() * 0.4), Math.random() * 3, 0, Math.PI * 2); ctx.fill();
        }
        ctx.globalAlpha = 1;
      }, 1 / 2.4, 1 / 2.4);
    }
    function makeWoodTex() {
      return canvasTex(512, (ctx, S) => {
        ctx.fillStyle = "#b08559"; ctx.fillRect(0, 0, S, S);
        for (let i = 0; i < 120; i++) {
          const y = Math.random() * S, a = 0.05 + Math.random() * 0.12;
          ctx.strokeStyle = Math.random() < 0.5 ? `rgba(90,52,24,${a})` : `rgba(240,196,140,${a})`;
          ctx.lineWidth = 1 + Math.random() * 3;
          ctx.beginPath(); ctx.moveTo(0, y);
          for (let x = 0; x <= S; x += 32) ctx.lineTo(x, y + Math.sin(x * 0.02 + i) * 3);
          ctx.stroke();
        }
      }, 1, 1);
    }
    function makeConcreteTex() {
      return canvasTex(512, (ctx, S) => {
        ctx.fillStyle = "#9c9993"; ctx.fillRect(0, 0, S, S);
        for (let i = 0; i < 6000; i++) {
          const g = 120 + Math.random() * 70;
          ctx.fillStyle = `rgba(${g},${g},${g - 4},0.18)`;
          ctx.fillRect(Math.random() * S, Math.random() * S, 1 + Math.random() * 3, 1 + Math.random() * 3);
        }
        for (let i = 0; i < 14; i++) {        /* 模板接縫的淡淡水平線 */
          ctx.fillStyle = "rgba(70,68,64,0.10)";
          ctx.fillRect(0, (i / 14) * S, S, 2);
        }
      }, 2, 2);
    }
    function modEll(rec) { return { a: rec.w / 2 - 3.4, b: rec.d / 2 - 3.2 }; }
    /* 橢圓的平行曲線：離橢圓邊 off 公尺（正值往外） */
    function ellAt(a, b, th, off) {
      const c = Math.cos(th), s = Math.sin(th);
      let nx = c / a, nz = s / b; const l = Math.hypot(nx, nz); nx /= l; nz /= l;
      return [a * c + nx * off, b * s + nz * off];
    }
    function geoBuild() {
      const P = [], U = [], I = [];
      return {
        quad(p0, p1, p2, p3, u0, u1, v0, v1) {
          const k = P.length / 3;
          P.push(...p0, ...p1, ...p2, ...p3);
          U.push(u0, v0, u1, v0, u1, v1, u0, v1);
          I.push(k, k + 1, k + 2, k, k + 2, k + 3);
        },
        geo() {
          const g = new THREE.BufferGeometry();
          g.setAttribute("position", new THREE.Float32BufferAttribute(P, 3));
          g.setAttribute("uv", new THREE.Float32BufferAttribute(U, 2));
          g.setIndex(I); g.computeVertexNormals();
          return g;
        },
        empty() { return !P.length; }
      };
    }
    function dressModern(rec, M) {
      const { w, d, h, cx, cz } = rec;
      const { a, b } = modEll(rec);
      const hx = w / 2 - WALL_T / 2 - 0.01, hz = d / 2 - WALL_T / 2 - 0.01;
      const yTop = MOD_Y + MOD_FASCIA, N = 220;
      const inRect = (x, z, m) => Math.abs(x) <= hx - m && Math.abs(z) <= hz - m;
      /* 1. 夾層樓板：矩形扣掉橢圓開口；底面深色（格柵縫隙），頂面白色 */
      const slab = (y, up, mat) => {
        const sh = new THREE.Shape();
        sh.moveTo(-hx, -hz); sh.lineTo(hx, -hz); sh.lineTo(hx, hz); sh.lineTo(-hx, hz); sh.lineTo(-hx, -hz);
        const hole = new THREE.Path(); hole.absellipse(0, 0, a, b, 0, Math.PI * 2, true, 0);
        sh.holes.push(hole);
        const g = new THREE.ShapeGeometry(sh, 96);
        g.rotateX(up ? -Math.PI / 2 : Math.PI / 2);
        g.translate(cx, y, cz);
        queue(g, mat);
      };
      slab(MOD_Y + 0.02, false, M.soffit);
      slab(yTop, true, M.white);
      /* 2. 木格柵：沿曲線的同心鰭片，每 0.14 m 一道，超出牆的段落剪掉 */
      const fins = geoBuild(), pitch = 0.14, finH = 0.12;
      const maxOff = Math.hypot(hx, hz);
      for (let off = 0.1; off < maxOff; off += pitch) {
        let arc = 0, prev = ellAt(a, b, 0, off);
        for (let i = 1; i <= N; i++) {
          const cur = ellAt(a, b, (i / N) * Math.PI * 2, off);
          const segL = Math.hypot(cur[0] - prev[0], cur[1] - prev[1]);
          if (inRect(prev[0], prev[1], 0.02) && inRect(cur[0], cur[1], 0.02)) {
            fins.quad([cx + prev[0], MOD_Y, cz + prev[1]], [cx + cur[0], MOD_Y, cz + cur[1]],
              [cx + cur[0], MOD_Y - finH, cz + cur[1]], [cx + prev[0], MOD_Y - finH, cz + prev[1]],
              arc / 2.2, (arc + segL) / 2.2, off * 0.37, off * 0.37 + 0.06);
          }
          arc += segL; prev = cur;
        }
      }
      if (!fins.empty()) queue(fins.geo(), M.fin);
      /* 3. 白色曲線邊帶（內外兩面＋底邊）與暖色燈槽 */
      const band = geoBuild(), rail = geoBuild(), cove = geoBuild();
      let arc = 0;
      for (let i = 0; i < N; i++) {
        const t0 = (i / N) * Math.PI * 2, t1 = ((i + 1) / N) * Math.PI * 2;
        const p0 = ellAt(a, b, t0, 0), p1 = ellAt(a, b, t1, 0);
        const q0 = ellAt(a, b, t0, 0.3), q1 = ellAt(a, b, t1, 0.3);
        const L = Math.hypot(p1[0] - p0[0], p1[1] - p0[1]);
        const P = (p, y) => [cx + p[0], y, cz + p[1]];
        band.quad(P(p0, MOD_Y - finH), P(p1, MOD_Y - finH), P(p1, yTop), P(p0, yTop), arc, arc + L, 0, 1);
        band.quad(P(p0, MOD_Y - finH), P(p1, MOD_Y - finH), P(q1, MOD_Y - finH), P(q0, MOD_Y - finH), arc, arc + L, 0, 1);
        /* 欄杆扶手：開口邊往外 0.12 m、高 1.05 m */
        const r0 = ellAt(a, b, t0, 0.12), r1 = ellAt(a, b, t1, 0.12), s0 = ellAt(a, b, t0, 0.2), s1 = ellAt(a, b, t1, 0.2);
        rail.quad(P(r0, yTop + 1.05), P(r1, yTop + 1.05), P(s1, yTop + 1.05), P(s0, yTop + 1.05), 0, 1, 0, 1);
        rail.quad(P(r0, yTop + 0.98), P(r1, yTop + 0.98), P(r1, yTop + 1.05), P(r0, yTop + 1.05), 0, 1, 0, 1);
        /* 燈槽：邊帶內側底緣一條暖光 */
        const c0 = ellAt(a, b, t0, 0.4), c1 = ellAt(a, b, t1, 0.4);
        cove.quad(P(q0, MOD_Y - finH - 0.001), P(q1, MOD_Y - finH - 0.001), P(c1, MOD_Y - finH - 0.001), P(c0, MOD_Y - finH - 0.001), 0, 1, 0, 1);
        arc += L;
      }
      queue(band.geo(), M.white);
      queue(rail.geo(), M.white);
      queue(cove.geo(), M.cove);
      /* 直條欄杆：每 0.13 m 一支 */
      let acc = 0, prev = ellAt(a, b, 0, 0.16);
      for (let i = 1; i <= N * 4; i++) {
        const th = (i / (N * 4)) * Math.PI * 2, cur = ellAt(a, b, th, 0.16);
        acc += Math.hypot(cur[0] - prev[0], cur[1] - prev[1]);
        if (acc >= 0.13) {
          acc = 0;
          const g = new THREE.BoxGeometry(0.03, 0.98, 0.07);
          g.rotateY(-Math.atan2(cur[1] - prev[1], cur[0] - prev[0]));
          g.translate(cx + cur[0], yTop + 0.49, cz + cur[1]);
          queue(g, M.white);
        }
        prev = cur;
      }
      /* 4. 牆頂燈槽：夾層下緣沿四面牆一條暖光（照亮牆面上緣） */
      const y = MOD_Y - 0.03, t = 0.05;
      [[w - 0.6, t, 0, -hz + 0.04], [w - 0.6, t, 0, hz - 0.04]].forEach(([lx, lz, x, z]) => {
        const g = new THREE.BoxGeometry(lx, 0.04, lz); g.translate(cx + x, y, cz + z); queue(g, M.cove);
      });
      [[-hx + 0.04], [hx - 0.04]].forEach(([x]) => {
        const g = new THREE.BoxGeometry(t, 0.04, d - 0.6); g.translate(cx + x, y, cz); queue(g, M.cove);
      });
      /* 5. 嵌燈：格柵底下的小圓燈，約 2.4 m 一顆 */
      for (let x = -hx + 1.2; x < hx - 0.6; x += 2.4) {
        for (let z = -hz + 1.2; z < hz - 0.6; z += 2.4) {
          if ((x / (a + 0.7)) ** 2 + (z / (b + 0.7)) ** 2 < 1) continue;
          const g = new THREE.CircleGeometry(0.075, 16);
          g.rotateX(Math.PI / 2); g.translate(cx + x, MOD_Y - finH - 0.004, cz + z);
          queue(g, M.down);
        }
      }
      /* 6. 清水混凝土圓柱：開口四個斜角外側，撐住夾層 */
      [0.72, Math.PI - 0.72, Math.PI + 0.72, -0.72].forEach((th) => {
        const p = ellAt(a, b, th, 1.25);
        if (!inRect(p[0], p[1], 1.2)) return;
        const g = new THREE.CylinderGeometry(0.36, 0.36, MOD_Y - finH, 32, 1, true);
        g.translate(cx + p[0], (MOD_Y - finH) / 2, cz + p[1]);
        queue(g, M.concrete, { cast: true, recv: true });
        MOD_COLS.push({ x: cx + p[0], z: cz + p[1], r: 0.36 + 0.45, mode: 3 });
      });
      /* 7. 上層：白色天花，開口正上方一片柔光天窗 */
      queue(new THREE.PlaneGeometry(w, d).rotateX(Math.PI / 2).translate(cx, h, cz), M.white);
      const sky = new THREE.CircleGeometry(1, 64);
      sky.scale(a * 0.72, b * 0.72, 1); sky.rotateX(Math.PI / 2); sky.translate(cx, h - 0.02, cz);
      queue(sky, M.sky);
    }

    /* ================= v62 窗景：依參考照片 =================
       米色平頂上的葉形天窗（光井＋斜向窗框＋天空）、牆面對外落地窗（避開畫作）、
       畫作上方的水平高窗、休憩圓凳與小圓桌；地坪沿用水磨石 */
    function makeSkyTex() {
      return canvasTex(1024, (ctx, S) => {
        const g = ctx.createLinearGradient(0, 0, S, S);
        g.addColorStop(0, "#9cc4e8"); g.addColorStop(0.55, "#cfe3f3"); g.addColorStop(1, "#eef5fb");
        ctx.fillStyle = g; ctx.fillRect(0, 0, S, S);
        for (let i = 0; i < 26; i++) {
          const x = Math.random() * S, y = Math.random() * S, r = 40 + Math.random() * 110;
          const cg = ctx.createRadialGradient(x, y, 0, x, y, r);
          cg.addColorStop(0, "rgba(255,255,255,0.75)"); cg.addColorStop(1, "rgba(255,255,255,0)");
          ctx.fillStyle = cg; ctx.fillRect(x - r, y - r, r * 2, r * 2);
        }
        ctx.fillStyle = "rgba(170,190,205,0.35)";      /* 鄰棟大樓的倒影 */
        ctx.fillRect(S * 0.08, S * 0.1, S * 0.18, S * 0.55);
        ctx.fillRect(S * 0.3, S * 0.02, S * 0.1, S * 0.4);
      }, 0.18, 0.18);
    }
    /* 窗外全景：u 每 1 ＝ 36 m 寬，v 0→1 ＝ 離地 0→8 m；地平線約 1.3 m */
    function makeViewTex() {
      const t = canvasTex(2048, (ctx, S) => {
        const W = S, H = S, hy = H * (1 - 1.3 / 8);
        const sky = ctx.createLinearGradient(0, 0, 0, hy);
        sky.addColorStop(0, "#7fb2e0"); sky.addColorStop(0.7, "#c6def0"); sky.addColorStop(1, "#e9f1f5");
        ctx.fillStyle = sky; ctx.fillRect(0, 0, W, hy);
        for (let i = 0; i < 40; i++) {
          const x = Math.random() * W, y = Math.random() * hy * 0.6, r = 30 + Math.random() * 90;
          const cg = ctx.createRadialGradient(x, y, 0, x, y, r);
          cg.addColorStop(0, "rgba(255,255,255,0.8)"); cg.addColorStop(1, "rgba(255,255,255,0)");
          ctx.save(); ctx.scale(1, 0.45); ctx.fillStyle = cg; ctx.fillRect(x - r, y / 0.45 - r, r * 2, r * 2); ctx.restore();
        }
        for (let x = 0; x < W; ) {                     /* 遠處建築 */
          const bw = 40 + Math.random() * 120, bh = 60 + Math.random() * 260;
          const c = 175 + Math.random() * 40;
          ctx.fillStyle = `rgb(${c - 10},${c},${c + 12})`;
          ctx.fillRect(x, hy - bh, bw, bh);
          ctx.fillStyle = "rgba(90,110,130,0.18)";
          for (let yy = hy - bh + 8; yy < hy - 6; yy += 14) ctx.fillRect(x + 4, yy, bw - 8, 5);
          x += bw + Math.random() * 60;
        }
        const gr = ctx.createLinearGradient(0, hy, 0, H);   /* 草坪＋步道 */
        gr.addColorStop(0, "#9bb77a"); gr.addColorStop(1, "#6f9153");
        ctx.fillStyle = gr; ctx.fillRect(0, hy, W, H - hy);
        ctx.fillStyle = "#d8d4cb"; ctx.fillRect(0, hy + (H - hy) * 0.55, W, (H - hy) * 0.18);
        for (let i = 0; i < 70; i++) {                 /* 樹 */
          const x = Math.random() * W, base = hy + Math.random() * (H - hy) * 0.35, th = 120 + Math.random() * 300;
          ctx.strokeStyle = "#6b5a48"; ctx.lineWidth = 4 + Math.random() * 4;
          ctx.beginPath(); ctx.moveTo(x, base); ctx.lineTo(x + (Math.random() - 0.5) * 10, base - th * 0.6); ctx.stroke();
          for (let k = 0; k < 7; k++) {
            const r = th * (0.12 + Math.random() * 0.14);
            const gx = x + (Math.random() - 0.5) * th * 0.35, gy = base - th * (0.55 + Math.random() * 0.35);
            const G = 110 + Math.random() * 60;
            ctx.fillStyle = `rgba(${G - 50},${G + 20},${G - 60},0.85)`;
            ctx.beginPath(); ctx.arc(gx, gy, r, 0, Math.PI * 2); ctx.fill();
          }
        }
        for (let i = 0; i < 90; i++) {                 /* 灌木 */
          const x = Math.random() * W, y = hy + (H - hy) * (0.3 + Math.random() * 0.2), r = 14 + Math.random() * 26;
          ctx.fillStyle = `rgba(${70 + Math.random() * 30},${120 + Math.random() * 40},${60 + Math.random() * 20},0.9)`;
          ctx.beginPath(); ctx.arc(x, y, r, 0, Math.PI * 2); ctx.fill();
        }
      }, 1, 1);
      t.wrapT = THREE.ClampToEdgeWrapping;
      return t;
    }
    /* 高窗天空：上深下淺的漸層＋淡雲；v 對應離地 4.75～6.55 m */
    function makeClereSky(top) {
      const c = new THREE.Color(top), hi = c.clone().lerp(new THREE.Color("#ffffff"), 0.62);
      const t = canvasTex(256, (ctx, S) => {
        const g = ctx.createLinearGradient(0, 0, 0, S);
        g.addColorStop(0, "#" + c.getHexString()); g.addColorStop(1, "#" + hi.getHexString());
        ctx.fillStyle = g; ctx.fillRect(0, 0, S, S);
        for (let i = 0; i < 10; i++) {
          const x = Math.random() * S, y = S * (0.35 + Math.random() * 0.55), r = 20 + Math.random() * 40;
          ctx.save(); ctx.translate(x, y); ctx.scale(2.6, 0.5);
          const cg = ctx.createRadialGradient(0, 0, 0, 0, 0, r);
          cg.addColorStop(0, "rgba(255,255,255,0.45)"); cg.addColorStop(1, "rgba(255,255,255,0)");
          ctx.fillStyle = cg; ctx.fillRect(-r, -r, r * 2, r * 2); ctx.restore();
        }
      }, 1, 1);
      t.wrapT = THREE.ClampToEdgeWrapping;
      t.repeat.set(36 / 7, 8 / 1.8); t.offset.set(0, -4.75 / 1.8);
      return t;
    }
    /* 從照片最上方一帶取天空平均色；太暗或太灰就退回預設藍 */
    function skyColorOf(img) {
      try {
        const c = document.createElement("canvas"); c.width = 32; c.height = 32;
        const x = c.getContext("2d"); x.drawImage(img, 0, 0, 32, 32);
        const d = x.getImageData(0, 0, 32, 5).data;
        let r = 0, g = 0, b = 0; const n = d.length / 4;
        for (let i = 0; i < d.length; i += 4) { r += d[i]; g += d[i + 1]; b += d[i + 2]; }
        const col = new THREE.Color(r / n / 255, g / n / 255, b / n / 255);
        const hsl = {}; col.getHSL(hsl);
        if (hsl.l < 0.25) return "#8fbbe3";
        return "#" + col.getHexString();
      } catch { return "#8fbbe3"; }
    }
    function makeFabricTex() {
      return canvasTex(256, (ctx, S) => {
        ctx.fillStyle = "#d6d4cf"; ctx.fillRect(0, 0, S, S);
        for (let i = 0; i < 5000; i++) {
          const g = 190 + Math.random() * 50;
          ctx.fillStyle = `rgba(${g},${g},${g - 3},0.35)`;
          ctx.fillRect(Math.random() * S, Math.random() * S, 1, 1);
        }
      }, 3, 3);
    }
    /* 牆面窗：face＝north/south/west/east，c＝沿牆中心（相對房間中心），寬 wd，y0→y1 */
    function winFace(rec, face) {
      const { w, d, cx, cz } = rec, t = WALL_T / 2 + 0.005;
      if (face === "north") return { ang: 0, at: (c) => [cx + c, cz - d / 2 + t] };
      if (face === "south") return { ang: Math.PI, at: (c) => [cx + c, cz + d / 2 - t] };
      if (face === "west") return { ang: Math.PI / 2, at: (c) => [cx - w / 2 + t, cz + c] };
      return { ang: -Math.PI / 2, at: (c) => [cx + w / 2 - t, cz + c] };
    }
    function addWindow(rec, M, face, c, wd, y0, y1, mullPitch, u0, glassMat) {
      const F = winFace(rec, face), [px, pz] = F.at(c);
      const place = (g) => { g.rotateY(F.ang); g.translate(px, 0, pz); return g; };
      const glass = new THREE.PlaneGeometry(wd, y1 - y0);
      const uv = glass.attributes.uv;
      for (let i = 0; i < uv.count; i++) uv.setXY(i, u0 + uv.getX(i) * wd / 36, (y0 + uv.getY(i) * (y1 - y0)) / 8);
      glass.translate(0, (y0 + y1) / 2, 0.01);
      queue(place(glass), glassMat || M.view);
      if (glassMat && M.stars) {                          /* 高窗：夜裡看得到星空 */
        const st = new THREE.PlaneGeometry(wd, y1 - y0), su = st.attributes.uv;
        for (let i = 0; i < su.count; i++) su.setXY(i, u0 * 3 + su.getX(i) * wd / 16, (y0 + su.getY(i) * (y1 - y0)) / 16);
        st.translate(0, (y0 + y1) / 2, 0.015);
        queue(place(st), M.stars);
      }
      glassPane(wd, y0, y1, 0.03, mullPitch).forEach(([g, m]) => queue(place(g), m));   /* v70 玻璃質感 */
      const bar = (bw, bh, x, y, dep, m) => queue(place(new THREE.BoxGeometry(bw, bh, dep).translate(x, y, dep / 2)), m);
      /* 外框（白色窗框）＋內部細窗櫺 */
      bar(wd + 0.24, 0.12, 0, y1 + 0.06, 0.16, M.frame);
      bar(wd + 0.24, 0.12, 0, y0 - 0.06, 0.2, M.frame);
      bar(0.12, y1 - y0, -wd / 2 - 0.06, (y0 + y1) / 2, 0.16, M.frame);
      bar(0.12, y1 - y0, wd / 2 + 0.06, (y0 + y1) / 2, 0.16, M.frame);
      const n = Math.max(1, Math.round(wd / mullPitch));
      for (let i = 1; i < n; i++) bar(0.05, y1 - y0, -wd / 2 + (wd * i) / n, (y0 + y1) / 2, 0.07, M.mull);
      if (y1 - y0 > 2.4) bar(wd, 0.05, 0, y0 + (y1 - y0) * 0.72, 0.07, M.mull);
    }
    function leafPts(L, Wd, ang, n) {
      const out = [], ca = Math.cos(ang), sa = Math.sin(ang);
      for (let i = 0; i < n; i++) {                   /* 繞一圈：上緣 → 下緣 */
        const t = (i / n) * 2;
        const u = t <= 1 ? -1 + 2 * t : 1 - 2 * (t - 1);
        const v = (t <= 1 ? 1 : -1) * (Wd / 2) * Math.pow(Math.max(0, 1 - u * u), 0.85);
        const x = u * L / 2, y = v;
        out.push([x * ca - y * sa, x * sa + y * ca]);
      }
      return out;
    }
    function dressWindow(rec, M) {
      const { w, d, h, cx, cz, id } = rec;
      const wellH = 0.9;
      /* 1. 天花：矩形扣掉葉形開口 */
      const leaves = id === "hall"
        ? [[-7.4, -2.7, 9.8, 3.9, 0.34], [7.4, 2.7, 9.8, 3.9, 0.34], [0.1, -0.1, 5.6, 2.3, -0.62]]   /* v73 天窗放大約 1.3 倍 */
        : [[-3.9, 1.5, 8.6, 3.5, 0.4], [5.2, -2.6, 5.6, 2.3, -0.45]];
      const sh = new THREE.Shape();
      sh.moveTo(-w / 2, -d / 2); sh.lineTo(w / 2, -d / 2); sh.lineTo(w / 2, d / 2); sh.lineTo(-w / 2, d / 2); sh.lineTo(-w / 2, -d / 2);
      leaves.forEach(([lx, lz, L, Wd, ang]) => {
        const pts = leafPts(L, Wd, ang, 72);
        const hole = new THREE.Path();
        pts.forEach(([x, z], i) => (i ? hole.lineTo(lx + x, lz + z) : hole.moveTo(lx + x, lz + z)));
        sh.holes.push(hole);
      });
      const cg = new THREE.ShapeGeometry(sh, 32);
      cg.rotateX(Math.PI / 2); cg.translate(cx, h, cz);    /* rotateX +90°：shape y → world +z，面朝下 */
      queue(cg, M.ceil);
      leaves.forEach(([lx, lz, L, Wd, ang]) => {
        const pts = leafPts(L, Wd, ang, 72);
        /* 2. 光井：白色內壁，下緣往下凸 0.12 m 形成斜切白邊 */
        const well = geoBuild(), glow = geoBuild();
        for (let i = 0; i < pts.length; i++) {
          const a = pts[i], b = pts[(i + 1) % pts.length];
          const A = (y) => [cx + lx + a[0], y, cz + lz + a[1]], B = (y) => [cx + lx + b[0], y, cz + lz + b[1]];
          well.quad(A(h - 0.12), B(h - 0.12), B(h + wellH), A(h + wellH), 0, 1, 0, 1);
          glow.quad(A(h - 0.125), B(h - 0.125), B(h - 0.11), A(h - 0.11), 0, 1, 0, 1);
        }
        queue(well.geo(), M.well);
        queue(glow.geo(), M.glow);
        /* 3. 玻璃（天空）＋斜向窗框 */
        const gs = new THREE.Shape();
        pts.forEach(([x, z], i) => (i ? gs.lineTo(x, z) : gs.moveTo(x, z)));
        const gg = new THREE.ShapeGeometry(gs, 1);
        const up = gg.attributes.uv;
        for (let i = 0; i < up.count; i++) up.setXY(i, up.getX(i) + lx, up.getY(i) + lz);
        gg.rotateX(Math.PI / 2); gg.translate(cx + lx, h + wellH, cz + lz);
        queue(gg, M.sky);
        const sg = new THREE.ShapeGeometry(gs, 1);           /* 夜裡的星空（世界座標 UV，跨天窗連續） */
        const su = sg.attributes.uv;
        for (let i = 0; i < su.count; i++) su.setXY(i, (su.getX(i) + lx + cx) / 16, (su.getY(i) + lz + cz) / 16);
        sg.rotateX(Math.PI / 2); sg.translate(cx + lx, h + wellH - 0.012, cz + lz);
        queue(sg, M.stars);
        const ca = Math.cos(ang), sa = Math.sin(ang);
        for (let k = -3; k <= 3; k++) {              /* 橫跨短向的窗框 */
          const u = k / 4, half = (Wd / 2) * Math.pow(1 - u * u, 0.85);
          const g = new THREE.BoxGeometry(0.04, 0.05, half * 2);
          g.rotateY(-ang); g.translate(cx + lx + u * L / 2 * ca, h + wellH - 0.05, cz + lz + u * L / 2 * sa);
          queue(g, M.mull);
        }
        const spine = new THREE.BoxGeometry(L * 0.96, 0.06, 0.05);
        spine.rotateY(-ang); spine.translate(cx + lx, h + wellH - 0.06, cz + lz);
        queue(spine, M.mull);
      });
      /* 4. 牆面落地窗：只放在沒有畫的牆段；v64 轉角兩側各留 ≥ 2.4 m 實牆，不開窗 */
      const CORNER = 2.4;
      const tall = (face, c, wd, u0) => addWindow(rec, M, face, c, wd, 0.25, 3.7, 1.25, u0);
      /* v66：西／東廳遠端牆改開門通往邊廳，不再開落地窗；邊廳北面已是整排玻璃 */
      /* 5. 畫作上方的水平高窗（兩端同樣避開轉角） */
      const clere = (face, len, u0) => addWindow(rec, M, face, 0, len, 4.75, 6.55, 1.6, u0, M.clere);   /* 高窗只看到天空 */
      const glassF = rec.glass || [];
      if (!glassF.includes("north")) clere("north", w - 2 * CORNER - WALL_T, 0.3);
      clere("south", w - 2 * CORNER - WALL_T, 0.6);

      /* 6. 休憩區：小圓桌＋四張圓凳 */
      const seats = id === "hall" ? [[-6.4, 0.2, 0.3], [6.4, -0.2, -0.4]]
        : (id === "west2" || id === "east2") ? [[(id === "west2" ? -1 : 1) * (w / 2 - 3.4), -3.6, 0.2], [(id === "west2" ? -1 : 1) * (w / 2 - 3.4), 3.6, -0.5]]   /* 靠窗看景 */
        : [[id === "west" ? -2.5 : 2.5, 0, 0.6]];
      const lathe = new THREE.LatheGeometry([
        new THREE.Vector2(0, 0), new THREE.Vector2(0.36, 0), new THREE.Vector2(0.43, 0.05), new THREE.Vector2(0.46, 0.16),
        new THREE.Vector2(0.45, 0.28), new THREE.Vector2(0.4, 0.37), new THREE.Vector2(0.28, 0.42), new THREE.Vector2(0, 0.43)
      ], 28);
      seats.forEach(([sx, sz, rot]) => {
        const X = cx + sx, Z = cz + sz;
        queue(new THREE.CylinderGeometry(0.34, 0.34, 0.03, 36).translate(X, 0.53, Z), M.table, { cast: true, recv: true });
        queue(new THREE.CylinderGeometry(0.025, 0.025, 0.5, 12).translate(X, 0.26, Z), M.table, { cast: true });
        queue(new THREE.CylinderGeometry(0.2, 0.22, 0.02, 28).translate(X, 0.01, Z), M.table, { recv: true });
        const poufs = [];
        [0, 1, 2, 3].forEach((k) => {
          const a = rot + k * Math.PI / 2 + (k % 2 ? 0.25 : -0.1), r = 0.95 + (k % 2) * 0.18, s = 0.9 + (k % 3) * 0.1;
          const g = lathe.clone(); g.scale(s, 1, s);
          g.translate(X + Math.cos(a) * r, 0, Z + Math.sin(a) * r);
          queue(g, M.pouf, { cast: true, recv: true });
          poufs.push([X + Math.cos(a) * r, Z + Math.sin(a) * r]);
        });
        /* 邊廳：坐下時面向落地窗；其他廳：背對桌子看向展牆 */
        const face = id === "west2" ? [-1, 0] : id === "east2" ? [1, 0] : null;
        MOD_COLS.push({ x: X, z: Z, r: 1.75, mode: 4, seat: true, poufs, face });
      });
      lathe.dispose();
    }


    /* ================= v63 窗外景色 =================
       首頁選窗外照片：預設 3 格（島嶼／漁港／雪景），可拖入圖片或雙擊更換、＋ 增加格子（最多 8 格）；
       自選的圖存在本機 IndexedDB，選擇記在 localStorage。
       貼圖對應：照片高 ＝ 離地 0.2～6.8 m，寬依照片比例，左右以鏡射接續；落地窗看到下半部、高窗看到上半部 */
    const VIEW_DEFAULTS = [
      { name: "島嶼", src: "assets/523a4e7f7aa90bf1551c.webp" },
      { name: "漁港", src: "data:image/jpeg;base64,/9j/4AAQSkZJRgABAQAAAQABAAD/2wBDAAYEBAUEBAYFBQUGBgYHCQ4JCQgICRINDQoOFRIWFhUSFBQXGiEcFxgfGRQUHScdHyIjJSUlFhwpLCgkKyEkJST/2wBDAQYGBgkICREJCREkGBQYJCQkJCQkJCQkJCQkJCQkJCQkJCQkJCQkJCQkJCQkJCQkJCQkJCQkJCQkJCQkJCQkJCT/wAARCAMoBKgDASIAAhEBAxEB/8QAHAAAAAcBAQAAAAAAAAAAAAAAAAECAwQFBgcI/8QAWRAAAgEDAwIEBAMGAggCBQIXAQIDAAQRBRIhBjETQVFhFCJxgQcykRUjQqGxwVLRFiQzYnKC4fBDkggXU6KywvElNERjc9KT4iY2VFVkdKOzw0WDhJTTtP/EABsBAAMBAQEBAQAAAAAAAAAAAAABAgMEBQYH/8QANxEAAgICAgEDAgUCBAcBAAMAAAECEQMhEjEEE0FRBSIUMmFxkRVCUoGhwSMzU7HR4fBDBlTx/9oADAMBAAIRAxEAPwByixR0K9Q8gTihR4oYoALFEaViixSsAqFHiipgFigaOhikAnmhilYoqAE5xQzRlaLBzQMOhRlaLFAg+KLij20WKCgDvQNHRZoAFChQxQAKFDFCgAUVHQoAKio8UMUAFihR0MUAFQxQo/KgAqFHihQAWKIg0rFFQAmhjNKIzRYxSYBYoqViht96QCce1ACl4oYoATihilYoYoATihilYoiKAG8UKURRYoASRRbaXRMOKAGZOBTIGT2qQRk4xQEeOe9ADeM8UBGM04ExSgtADZiFBYvangtDGPKgBKpikSLTtEVzQMilSaMAU6VxRBMGgBrYKSYTUkJ7UNtAEZLYZzS/CCin1XilFfaigIuM03IhqZspDx5FAELwc0pIsGpHhkUapmlQxsLSglObKMLRQWMEUkjNPlM0NgpUPkRivtQ8PNSfDFGEooVkUp7UeypBQelEUAooLGBHnmgyjHAp7GKIrTER9me9ICc9ql7M+VI2+1FARytJ8KpBjpSRcc0qAi7CKMJz3qU0VJEdA0xllyMU34R7CpfhE0XhkGkMimEj1ovD45qYUzRCHJ9qYiKF5parT/g0oQ0DsaSPmnPDwKcCYFKC0CGTGKSVIqRsoFAadBZH4pWzNO7BQC4oCxrw6IxnFPEUNtKgsYAxQNOlPOkFcUDsRRjFDBotpoAWB6UYGRSVBpY48qZIAMUqgOaVjFABYoiKVihinYCSKLB9KXiioATj2oYpVFikAWKI0rFDFOwE4oUrGKLFIKCocUKPFABUKPFDFABYosc0rFF2NAAoiKVQoATihijoUAERRYpWKGKAE0KPbRUAChQoUAEaKlUWKABQoUKACxR4oUdABYoYo6FABGipVFigAqOhihigAYoqVRUAFQxR4oYoATihSsUKB0XeKGKVigRWhmIoUrFFtpDE+dHR4oAUAFiix7UqhQFCQPahj2pQoYoASBQx7UrFFQAWKI96URRYoGFRUrFDFACaGKVtobaAE0MClbaLFABYFFSsUKACoYFCjxQAkihijoUAEBRUqhigBOKGKUKFACaGKUKGKQCaFKxREUAFQxSsUMUAJxRYpRFFigAqKlYoUgCoUeKGKACoUeKGKACNFRkUPKgBD0VLYUWKACxmiI4NLAoFaAGgvNLC8UoLijxQAjbQ248qVR0AJAoiKVjmgaBiMUdKxRbaAEFc0ABS8cUMUAJwKILS8UNtACSKBFHihigBOKIil0kjNADTdqKOlMuaUq4pUAMZoYo8UMUwCxQxSsUMUAJxQxR0KAE4pJWnKSRSAbK80eyl4o8UAN7aIpjmncUkjNACMD0o9vFK20eKAG2XNJC09ii2igBvPtRYPnT20UWKAG9vtSsGl4oYoARto8YpWKBFACdtHj2pWKFACMe1DbSvOjoARihSsUMUAJoqVtosUAFSDHzmnMUMUANGPFGI6cxQxQA3sxR4pWKIigAgMUfNAClCgBFClYoYoALFFil+VFigBOKFKxRYoATQpWKGKAE4oYo6FABYFFR4o8UAJo6FCgAUMChQoALFCjoiKACoqVQoATQo8UVAAoiKOhQAmgaViixQAVCjxQoAKhQNDFAAoUKFAAoUKFAwUKFDFAAoUMUMUgBQoGioAOhQxQxQAKFHihQBeUMZpsvjtQ8UAedaWRQujxTDSE9qNZc96VjodIosUkNmlA0wDwKKgTzSCfSgBZoqCk4pWKAE0VLxRYoAKhijxQxQAWKGKPFFQAMURo6PFACaFGaGKACxQwKPFDFACcCjxR+VDFACcChgUrFDFACcChjmlYoYpAJIFFil4osUAJIxQpVCkAkigKVQoARQpWKGKAE0MUeOaPGKAE4oYFHijAoATihijIoYoALFAijxQxQFCcUMUrFFQMLFFS8ZoqAEijxR0KAE4zQxilUKAEUKXiiIoATihijxRigBOKBo6FACaGKMjmgBQAVCjIoYoALFDFHiioAIgUVKoUAIIGaGKVihigBOKGKUBQIoATihijxQxQARAosUrFACgBNFSyKLFIBOKFLosUAJoUdHigBOKGKMijxQAnFFS8UMUAJxQxSsURHNABYoYo9poYoALFDFKxQxQAmhSsUWKACoYoUYoATiipeKLFACaGKVQxQAnFDFKoUAJxQxSjRYoALAoiKVihigBIFHgUdCgBOKKlUdACKFKxQxQAmhilYojQAWKGBQxQoAIgUWKVQoASaKlEUWKACxQxR4oqB0DFFR0KAoKhQxR9qAoLFDFDFCgKCIosUqhSsKE4oqXRYosBNCjIoYoAKhR4oqACoUdHigBNFSjQoATQpRosUAChRmgKACoxQo8UAERRBaVihQMLFDFHiioCgUKFCgKLVlNNkEVJcZpoxmrZI3mhzSyuKTjmkMMZFLWQDg0mgKAY8Bmk4zRqaUBmmSEF9aOjxij8qYCaGKVihigBOKGKVihigBB4osUbUFB70gCxR4xR4oYpgJxRgUeKGKAE4oYpWKB4pAJxQxSqFMBNFSsUMUgCAoqVihikAmhSgDQxQAnFDFHg0MGgYWKI0rFDFACaFKxRUAFihSsedFQAWKFHQoALFDFHQNABYoqPFCgAgKGBR0MUAERiipVCgBOKGKVjFCgBOKBpVEaAE4oUrFDFACcUMUqiNACcUeMUeKGDQAk0WKURmhjFACcUKVRYoATQxSiKGKAE4oqWQaG2gBFClYoYoATQxSqFACcUKM80AMUgCxQo6GKACNJxS8UVACcUKVQoAIUVKosUAFihShRYoAKhR0KACoUdDFABUWKVihQAVCjoUAFRUdCgAqGKOhigAsUMUdCgAsCipVCgBJFDFKoUAJxRUuioATQpdEaAEYoYo8UMUACixR0KBhUKOhQAVFijoUAFRYpVEaAEmhSsUWKACoYo8UWKACNFilUKQCTRUuipgJoYpVCkAmhijwaBBoALFEKXjyosYoGJo8UeKMCgEhOKBUbc07sGM0lgKQ6GsUWKXiipiE4oUqhQAk0VLoUAJxQxSqFAUIowKVRGgKCxQFKoYxQOgqBFDzoGgEEeKKjoqBgzQo6FAi9K8UkrTpFERirIGTGTSTHT/lSCcGkA34dF4Zp48ikZoHYnGOKWtFjNHmgQqjFJFLpgDFFR0KYqCoUdCkFCcUMUqhTGJxQxSqI0AFiipWKGKQqCxQIo8UMUDE4oYpWKFACcUMUqixSAICipWKGKAE0KVihigBNClAUMUAJxQxSsUMUAJxRYo8GhigAscUWKVihigBOKApWKGKAE4oqXRYoATQpWKLFABUKMUeKAE0MUeDQxQAmhSsUMUAJJxSQ9LZcikCM57UAKoUfFCgAqGKOgBQAWKFDFDFABURpWKIiiwE0eKPFHikAkCipWKBFACaFHihigAsUMUKOgdCaLFKoUwoTihilUCKQhOKBpXlRYoAKipWKLFA6CxQxR4oYoCgsUKPFDFAUEaKlUMUAJoUrFCgBNCjoUAFQxR0CKACxQxR4oYoALFFjFKoqACxQo6BFABYoYo6FABYosUqhQAnFDFKosUAFQpQFFQAVCjIoqACxQNHQoATihijoYoALFEKMigKACosUrFCkAnFAijIoUAFQo8UWKLAI0VKIoYoATQxRkUMUAJNClYosUAFQo8UMUDoKhS9tFtoHQnFCjxQxSsAsUeKNULqzp8yoAWZQWCg8AnHYVrtE6EGsac063qeIT8jxgPGwx60nJLsqMG+jIEntRshFbK16BiCM9xfSMyHa6wwk7SewOT386rL7pi7gsWvY43khQ4YY+ZAexYf/PU80U8ckjOEYNFS2GWNJxVmYWKFKxQxQCE4oqURQxTGFihilbaIikAWKGKFCmAVCjoUrFYPKio6BosLE4osUqhRYWF2oUdCiwsvzREZozRorSOERSzHsB3NaWQI2+9Ey4qwTSbjwzJMY7aMSNEXnJRQ4GSpPrimZbW1WzuW/a9mt3HtaOEEnfzyDkccVDnFGixyfsRVRnbYis58goz/AEq1s+nJmuTDqMNzbZi8RQqgufquc9sn3xVto/XCXBt4hb+GyQ5mSBgmSO+0ccDGfpSem9evLzVLm2S1nng8UzSXFxksoyMkjy47Y86xeb4N44F7lTrej2mkSosOqQ3IZgh4KlSc4J9uO/kaqypBwQQfQ1petesdN1mYabb2800e4iRsnJcfw7Tx689x+tZ3T7S5vbOa7hguGtoX2+K6Yypzg/yIOPSqhkt0yMuJLcRGKMChj70eK2OcGKGKMUKYBYoYpVCkAWKLFKoUwE4oYoyKAoATQpRFFikAVCjxQxQAVFilYoYoATihilYoYoATihilYoUAJxQxSiKGOKAE4oYo6FABYoYo6FABUWKVQoATihilUVACaFKxQxQAnFFilUdACcUWKUaBoATxQo8UMUDCosUqixQILFDFHR+VAxNCjoUANt3xRrSiM0AMUAFihR+dAigBNCjwaBGBSAKhijoUAFiipVFQAVCjoUAFRYpQoqAE4o8UeKFACcUMUqhigBOKFKosZoATQpWKGKAE4oUeKPFACcUMUdCgAsUMUYoUAJxQxR0KACosUqhQAnFDFKoedACcUKVQwKAE0KPFEaACoYo/KhQAWKBo6I0ADFDFAUdABYoYo6FIBNCjNDyoAKhihQoABpJFKojQAVCjxQoAKhQxQNABUMUflQoAKhijoUAFiixilUKBicUMUdCgQmhSiKLFA6CosUrFCgKE0CKPFCgaCxR7TQoSSpFG0jsFQDJNJjDxRDk4Hc9hVj01pkfUhEsF1CLdSBL8+JFyMj5SPStxpnTFlpqGWLZJMGykkq5Az2Bx5VDmXHG2YLTdMbUb57NporV0j8V/HJXCZxnHnV5edFtaRRmBv2jI77GUfJGq4OSec/pW8aKE3sPiRxNcYIQHG4D+LBPNZ7X+ntVa9nK65s0ufLXFuYwJI0x/4bgj/pnz7VDmbLEkR+jtAvtAtZba1h0HxopAs6JFJGXU8gt3BODwcYPrU2bTL60u3udBfwHmmMtxbzMQNwxnZgeYxx54pOm2t9FapcWutxXf7oxCa4h5kXJ2FyMEMp4Pke/FWFrqmrae8EWqack7OARc2jFozyRtxjIPbvxyeayZokN6nq95pehTzi1K3MsgBmQbomz5r5gY9az/AEH1DM0k9vP4nxqzMZraRNhnjJ+V0DEZ744znz8q2Gu6M170/d2cNxdJJOC6l5OUbyXI8qodCEmiaXaTau6q9qNgklkErbyCD8xHAJJxz54pj9yDrvS+mX2oSJYXqQ30i+OLd/lDqTjgHkc8H0PkKxd5Zy2F1Ja3ChZYmKsoIOD9RXShJpXXtlb3dpNEl9aNvt7goHMZOQVI8x6jyPuKxN5qEVxNNZzwW1vfKhEks1oQJnzgMGR9qgrzu8+fOmstdmc8N7RS0KckhaFyjYJHmDkEeoPmKRiuhP3ORpoKhR4oUwCou9HQpAJxQoxRN3pgFQoChSAFFR0RoGChQoUAFmhRMwXLMcKOSfQUKLSCjZyaHcSM3wRF4oJBCDa6kdwUPINWei9NveRW9xHFPb3yM2Y7xCo9iAO5HoTVJpn4h2V9BbyrOuk3g2/EuIV2SDgAn1HuMEeh710rT9RsL2JbiG9278LtlIAY/T38iO9ZObao6YY4p2RdO0i6h0wWtzN40ausciXA3qV/MSM/m5PBPIx3rNdTdHXTSLNpx/MNrB1+bOcZLcnnzzXRQwZfDnXepORk08FR+dg757VnRqYXp78NfhNl7NdvFO0TKY9oJicggkEdx6VYahDdWWiXGm6XYS/umMTO0rBpl2gllcflPJ4PGRWvWoj6cInlnhUytISXhd8o/GMc9qAOY6hq02jaclrb2lrMknMpugjylyxySynJIGBnzyfSqmCeSa3lMUrWEzSbYQDtt8Ekuh+vyn7Vservw7hcPe6JbIjEZkt1/qn9xWL0rTbv9qQ+EMShiio/+LHG4Ht9TSAaibxIlfAG4A8Uqnryym028ntJ4fBkjbJQjGM/15zTRAxXZB2jgmqbQVCgKFUSCjxQox2oFQWKG2joUBQWKBGKOhQFCcUMUrFDFAUJxQpWKBGaAoTQxSsUMUBQmhRkUMCgKCosUZowKAoKhRkChigKE4osc0oihigYWKGKVihigBG2hilUYoARihilYosUAJoUeKBoALFFijoUAFihijoUWARFCgaSXVSAzqu44GTjJpWAqhSQ6lmUMCy8MAeR9aVRYBYoYo6HlQARFIIxTlFgUAEBQxR4oYoASRihSsCgQKAE0KPFDFACcUMUrFFQAWKGMUdCgBOKGKVihigBNFilEUMCgBNDFHihigAsUKPFDFABYoYoUKACoUdCgAqFHihigAsUWKPzo8UAJxQ5ozQoALGaLFK8qGKAE4oYpWKGKAC20WKVQxSGIoUogUABQFCaGKPFA0BQWKGKFCgKCxRYpVDFAUJxQpWKLFAUFQo8UMUDoKhR4oqBUCixR0KB0FiipVFQFBUMUeKGKAoKhijoqABihihQoGFigBR0KACNFilUMUAJxQxSsUMUCE4oUrFA9qBiaLFKxRUAFihijpi9vIdPtXup2IjjGTgZJ9h70gHJHWKNnkbaijJPtWH1rU01OWSaS7MItstDbouf+Zj/AIj5CrKWR+prtHVCLOAnam4Hef8AewflPkPvVZq9le20cl1aaZBE5fxJmifxGAHkMjjy7VnJ2aRVGw/DW50eS+NreeHbXU0YOGBjEp9ME967PpmnwQ2KGzijEkakIW9fc154sbvUzfQS3dkCh/fQuEDneMHae2MgYxXW/wAP+qUurk2I0e8skdS6tJGRGcHkAn7e/NQbQfsaWKa6stQe6uY7iW3eTCxGMHw3xglDkHbjPkfaplxrOn2McHjyRpDO5iQschm9Of6VNkNvdxsriORQQwRwCMgZ496ptZt49ZhayutGiv7NjmQM+GhPqABkHzGPftWezYpepekYL+Xx9Pup3tJ1WOexgvBCCMkq0fluB7KcA+tF0zZ3fS0KLJrDT2TgqyXq/voz5AMGxxjkY71aWHSkek3Us6yARgqIIxuZUVeRwxOGznkY7niqrXNSlGuRxR20V2IF3TQSLjcGBxtJGD25Bx/Kj9RM2VnOklmVedXAwdx4Iz5HyrJ3T2WqC50221l7DVYJcxrMgJGAeCp/2iMM/wDYoaVq0fw1rDY2kVpJtLyWKHZmMtw6544J5HPt7p6w0Wy6mtoZmM9nPBue3v7flonXOY2AGffB9e/lUuVjoxdreTaZq1zqVjZ2dnrUIUXsSyYtbxTlhKnPG4fcfarCci2uYbi5QPol8wHg27kP4TAlVdgewY4x5+tZODqaC0ltYZWMWtW4MUN1EuyG+h3f7NgADz3DHkEYrWWej6Xf2tyLr4821mk3iQrMpKn5QGjA4245I8gRWbQ0V08a3ESmxPjWEQZvFdSjwZbiMkgAjOQuPQiohHHPFNahf6Vp9/fWiNe28BjzEETKxMRyQS3Yg7vXvUHT+p7HV7kWsK7ZFiDBgTiYDgtg8g+orpwz9mc2aH9yLKhihnNHW5ziaGKPFDFACaBGaUQKSaACxQo6I0AJNFR0DQAVETijpEkiRRtLK21EBZmPkB3osDP9a6t8Dpvw0bYkuAQSp5Uf9aFYXWdRfVdRmu3GN7fKPRR2H6UK55StnTGKSOp2/T1pcOYtFu3abnNtKTFIy45C5JVvsc+xq10bW77Qbn4eV5rO7tjsjW74icEf7N8/lz/C44B7981RtFu7MN4ONp86sIL7UbXT5jdacNU0fO2aKb5hCT5q4+aMn9KAO29N9VWuuxiIxmG6Rf3tvIhUqfbP/wA3pmryKP4eMkzOwyWyzZ4rzZB1PJZvFDps08SwsGh8RwZYlz+XcBg8cdh7g10/p38TrXU7V9N1XFveH5IJ15jnz+XOB8pP/eKZalejpkcmcHPcZBFVU2q3DSAQtk73XCsGztBJGO5JwR7EU8bp4hArKmSAGweBTXwUBuRcRx+HKuCWUYDc5/X3qe1Zb06KTWupdWgtbWdGisTLMyqkg8QzJwY2THfP60vS9ch6nuVtdW0UW926kqCGVtu3JZWwD38qc60if9g3fw1sXwVCqfm8JD+YqD2OfPuKwl7oOv6Jpy67aXNxLAXBiLE+NEh5yTzgd/OkA9q8E13qd9OplcWxEbCZi0qruOM57/8AzVWVYaHqcmpSXV3LO8MiiON/EB/eL5NuHcZUg+eO1Rp7d9rXKwhIC5VSr7gPQZ79vWtsM/7TmzQv7kMUeKHehXQcwKFCjxQAKGKGKOgAsUVKojxQARIFImnjt9vikrv4X5T830rNdU6nfNqNno2mTmC4uMu0qsMgYPy+x4+9TdAE9zaJD8W091buyLuVt5CnAYZ457EHmsp5a6NcePl2ay30c3WmQXkV1bCSYnbA0gDHBP2B9jiok1pcW3M0EkYPYsvB+h86pdb0jV9Lu7S5u3hgi/PKI5hvUkgruUcgZxnjHNXenazJbXIs7W7ZLOciGWO6VGSI55GOMd/MZ9zULN8mjwp9DPfmhU7VdLl0u48N3ikR8lJI87WGfKoOK3TtWc7TTpgxQxR0KYgsUVHQxQAKKjoYoAFDFCjoATQo8UMUAFQFChQAWKI0qiIosAqLHOPOkXE8VrC880gjiQZZj2Arn951RPrmqotsZ4be3DOqKxUuR5nH9KmUqKjGzoWQTjIyfLzoYrmy3d1ctDeSTzm8t+HywGAPI4+nOe9dGtp0u7eKeM/LKgcfepjPkOUOIvFEBntSqqtZ1+10mN13GS6C5SFRk5xxn0FWSN9Sa4uiWJkUB7mQEQxkZ3H1+lZbVI7xNN+L1O5uJZZl+VJY18MHIxtxypAz6VHtdP1LqO/Nwd0t0TlgRsCgjjHPYeVHrEVxpVsdJu70ygZcRR/OEkPYFj3+3FZSZrGKJOh61eftmA3N1FBGUjidJF2mUD5R5dxxya33Pn3rnOp6M0Gi2GpyxSPOXMcm8fLtxlN3nnn+Vb7TJmudOtppMb3iVjj1xTgyciJFDFHijA4rQzE0RFLwKGBQAjFDFKxRGgAsUKOhigAqFHihigAqLFH50CKACxRYxSqGKAE0MUdDFABYosUqhigYmhRkUMUCCxREUqhigYVFilYou1AhOOaMijxQoHQnFDFKxQxQOhOKGKOipWFBUKPFDFFhQVChQosQKGKFCgKBiio6GKBhGixR0KACxQxR0KB0JNADNKxQoChOKFHiioAKgaPFAigAhQxQoUADFDFChQAMUWKOhQARosUrFDFACcUMUrFEaACxQpRFJxQAKFDFA0ACixR4oCgAsUKPFDvQAjNKxQ2UdABYoYo8UMUgCoqURRY+9FgJLBFLMQFAySewFYnqzVIX1GIv49zaIAPDhk2qW5Ofc/5UnrLVb6SWe1XfFp8biNmQZMjeh9B/XFZqWGT4eKeGfMIPyRsSVB4Bx69/51nOXsaQj7slaZrzWtzNFD+5tpzuKxDD59ie1WGpa4mg3yrYiKXKfvlYlgWPkef+zVLeaVHY2xe+kkgu3fCxYBG3/Ef7Cn9P0+G4cT3weGEjbFLJjAA8yPTFZ2aV7lr071E1zrKnVbiWSywWkSSURqPT7ZxXUND61ilnmi07wJNhEiKGJ2eXl3rjnxuiTSTo2nSzbhmOTfgo30HccVa6D1bb6bNGqxogI2yzMoDs3l9qdiOlxdT32n9VRa1MDPEq+HcRp2ckEBsY4I8/OtfbfiBaySMhtPhd+MzJhyv1U9xXPLCSG8vDKC8UsgySi4WVCPP1HmKtJIFiXcBk4wT50qRXNm7n640to5FjeZpADt/d8Z8qw3VHW0ur6dLLZWnwdzEmy5jujjavfcCDzzyMeRrI9Q3twupfDWt3IjLF4jIsZft6bec1F0zWvir/AObUTJGu3dHJlTtPBVw3YjPl3FOkHNkKC/i1W1XWY7ubT7nTxt3QrhSO/Cg8evFbS2/F7WEjt0k8J3lRSy7RiTI74YcZ458/tWE6qS86YulbTLn/AOhdydyQhQ0QP+H0I9M0VlJFrejTtKyxzwrtgEQCkDvtH+VTQWxzrXULvUbgTnahHzQBowDE3dozjt7A8VK6f/EyW0nhk1Swt5oyPBleFdkmzAXn1IxkHv3qs0vqS0urb4fUIy12owtyx547HJ43DyzwRxUPXUjaTM0aRSsq/vYUwJM+ZB/7yKVIakxzrTXLe+urePTo5YYIk2MCwy5Jzk488HH0xUfozUDZazEGjV1nPgk4+Zc9iPvjNVskJNoHAaTa2DJg57djUeKQwFXQsHHb296I6dhLaO0DPnR1mekeqDq+60uyBcLzGx7yr5/cVpsV0p3s5mqdAxQxRijxQITiiIpeKIigBBFERSjSTSsBJFEaUaLFAxOKzPXOsmwsFsoseLdZ3eyD/rWmlkSCGSaQ7UjUsx9AK5N1Dq7azqUt2VKp+SJT/Cg7VE3SLhG2VxOeKFKyBFs8MNIxyGzyB6YoVkbnVt0dwgdc5zyo8ven52t47ZSkk63DfKwONjL7H19iKiwW7xkRBCrISmCckH0NPwSrIkke1SMlSp57UEkWfS7ScbZ0eGTgCWIYKnyJHmDSNK0nW73wl0x4726ikJigik/fpgZ3YPkMc4JqfLfXb2cNg0rPaxEhFdQWjB/hDdwPYkj0xVt+HN7bab1daXVw6orLIgbGeShA4HfJxVewJbHdQ6s6l02+gutau5rdoVaA4CuTjBPy/lkClgfJvm4NaLp3r3XNPtt17ANW00NkahYDxfCXvh17j6NyPesv+JFzbzwiYxLPCt7OrHlWQlIvMduQRg+lY3RdRvun78ahpF60Nwki8Dgn2I7MvkaUehydSPSOjdcaB1BII9P1GB5Su7wjlGx58N6efpVvd2Xjrt8SWI5U5jfGSDkZHY1yDQOudKvNYlfWdL0rT70QuEvYkIjdiuCjqPI+vetL0/8AiJbWstno+rRXGnzSxK8LySGaKUMeNrnLY9M596oakbHqK0utSsFtbSK1VP40cYBHltI7c1R/sa+trOZ0sINjnDWvDFfVlI7g+laC01e2vrcXFlPHdxE43xMGFSo5PETcCp4/lU8SrOS6hYS2kvMLxoeQDkgffzqIDxXX5oIJovBmiSVDn5ZBu/rVRP0Zo9wcratCT/7NyB+hzW0Z62c88W7RzkdqMdq20v4e23Pg3syf8Shv8qjSfh9Oq/u7+Nj6NGR/er5oz9KRkndIkaSV0RF7sxAAoaJLbdQ6l8Bp91HM6ozyNGciMD1Hn58iq/qjobq6K8Ek1jDqVmjho/hMsY/qhIz+h9qy+lXGodO6u+pSWM6LFIrS4UrJEVOeCeeeQfrSlP4HGFP7jpuo6F8Eu+G8t7rKhwIz8zL5kDzA86y/UerjRNMe5Xa0xISJT2LH+1arW9diu9atNW00TW14YhlZRtEgxyVI78EcefFMdRaLa6vY211edPfGDJb4oF42bnk7QRwfpj3zWSzezNXgTdo5/wBC6Udb1d9e1OYGS2lC+C+VEj4OAWAIUY4wcZ9RW7tdAsTeXEkTNPIqBxawgNtY5IyTyR5Z8iOfInSaLBphtLa2i8MbiqrDa2wEbJnlSP8AF9yR3pV7osOkfC6hFEv7pS+24UiWLLYOGX+E+4IyOayk7ZtGNKjPXOhC/lxPpKfE3A3JF4jKI48D+I8ZyDgdjwar73S5NBnnRtKd0ulEUkNypZghO0sCOMdiGHat9e6PJrFrG8Ns2MhXiEu1lXuH3keXBwPWqQ2FjDe27abqNxfSKpiu/EZis8Xftk+mOxpUUVt/Zt0+qK9349vdxeJPbxuuEkB42oeQcYyR35qvXJAbGNwz3zUi/fStS1JLeza80+2t/wB54MwLNC5J/Lny45APl503M9uZ3W2aQonA3gA++MeVa4ZU6OfNG1YjFFil0WK6jlCAoUdDFABEUMGjoUWAWM0WKVQxRYCcUMUrFDFIBNEaURgUVACar9Z1q20a3Ek7fO5xGn+I/wBh71I1LULfSrOS7un2xRjy7sfIAetc31Nby/mkv72Yyw3AwgjYnbnsox2xUtlJWSeotYmvYkaWYSwOQHgjOFQYznHmfrT3TOnxs0EljIpkut5WKSLG0jgruJ5GB/OntQ6SuU6Oh1a0UXFscR3BMZVoyp4PuDnuKPpvThJrNjO8straRkvHtO4xjkkc8Z44+tYzdm8ItDl9paQu7TCOym3tHLa7TuGD2XvkYPmau7fWLTTNKs0uZoxO0I2RbwC+OO/l9TTHUlzJqlxJJsCRrJuULGFwOwzj24oJoEfUWg2T2syxXNjJIj7kByMg/fGR9iaUJUVOFlBqPUGty3KtDIERMx7oGDIHbJUZ8zgYxUK6128uYVglkSFPFMoFuCpGcfy4PHrmtGnRFk1uYje28dzFJ4niLkoQo/iXPqe9Q9a0jRdMtt8t5NcySBkjjgx4MUnc48wvninbJpIc0nqaeHSpdOuZI7h528VZpR/syMHlu/l+uKJTpepaW93qDxvd3QMQWKLAUpyH2g8E/wB6ysxR55THsiT+ADOPpTK5juASDtC557d6LGauDXbyfRzpMmnfFwzLsEiuSq4wVIP+IHGc8+VaHQLyH4K3smmU3ESFSoB5Ax2+mRWcuJF034eSFykDRLKyg7ULADsv2q82aVb6/a3VtqSSPcJjwyw43Lnv659fUVUXTJkrL2hQwKOtjEKhRkUMUBQVCjxQxQAnFDFKxQxQCE4osGlUKAoTg0WKXRYoChOKFKxQxQFCaFHihikwoTihijoUAFQo6LzoGChR4oYoATQxR0KACxREGlUKAEYoYpWKKgAqFHiioAI0MUoCioALFCjoUAFQo8UMUAJxRUvFFigBNClEURoAKgaFCgAqGKPFCgAqFHiioAFCjxQxQAk0MUZoUAFiixzSqGKQCSKGKVQxQAmhijxR4osBOKGKMihRYCaOhihRYAxRYpVFRYBUKPFDFABUKPFDFIAqFGaGKACoYoEgKSSABySfIVnT13pZu/hrdZZ+du9MYP0z3oboaTZoZGWIZdgozisZ1T1ZeWsj2kVrNbwsMC4PDt6kD0/nVzdM8kq3WmRpLIR+9xgFh5DJ7EHuKzur6kl5FPZ6lH4bI+3YjDLHHbd5Dt74qHK+i1EzUqo9u0093NOHfsjEgehbNSbi9jg0q2SzlkBk3o8X5gDnk8jIPbin45xqUTaW7+DGiAwyFgQoBzzjg/apWk2MNssks1jNc4P+0DbFf0HOOOPKoSLbGrC5s9kkF58EJkIKfELnAzzt/wB7zqvvtHv5bV71lkWGTDxq7BixwB5cD6VZG2t7rxJr5UmlKkxW8LDZDn/EcYH60pyVsJFvpoZIkB8GySXcST3JK8UAZtEkgKsjpE7qQMnGR60/pWmve30UQSOZ9wZgXGCO9JgeCeCMS/EXDr8qRqcLGuewJ+9dL6Y/DUoIb+URQJOpMcfxGfFAGc717dvKkkNstoNE2IwidYoX2sYlXHhkc4Ujy9qejmnAUyqQjZBycjHr7UV5MsEUMk1ldpaTt4UcxGUz/hJ/hNVtvcNG2+1uTLsbbcQuBkjGd36dyKsmheqWun3LvmTbKF3EqcFfQ5Hb61hrwSCUvK0khI8KYzIACB2DsOQff1xXQh8LduWTbGzqYpGABD8fl9x51gOr9EkXVNuDJKUygGdzIo5z6kDHPnSYIPTtVM9udH1a3Fzp7HaJSfnhOeN3+faq+60++0fUpIYZTKseJYx5Sx+RB9hUyya2vgvwzxJqcCB4ZmyDKo/Mr+9TBaQamlrvfwLdlfkZ3wHuMf7uc8VJRlr+SGK9W9t42eIkO0chBz/0NXmqGz6ptY7qyQ2/gYaRGOdoPccfSm5dDaW6HjpBcPMpUTRuBHJ22sCOxI9ap5I7jRrsiKN1Rhh42b/L6UDJcyBzcHxEEMq/IqnAfHY8VSyyAnITaDztBz/OpspDP4+0omc4HlS7q1gFmtzayKwfDMjMNyH2x3B9DSYIhRXLxSJcQkxyJyGTjBHnXT9C6os9Ts4jcXEcV3t/eI3AJ7bh7Vy2IMzkDgHJpaDA3iUoykf8X2pxlQpR5HbQvHHb1oba5RaajeRjYsz26bCPG8UgE+RH+VStO6r1qyOxyZmZtoLH+g860WQy9NnTttEVrO2fV6NGHuWA8tpQhifPHrU5eqNPltpZY3dZERmVJUK7iPSq5Jk8WWJBosVmz1m8V2tvNaozlQ2EJG5cckZ9D5Vo7aaK8t1ngcOjDPHl7Uk7HVBEUAMmlshJ45zWN1zr+CylntbCMTTRgr4pPyhvYefnQ3QJX0S+rL4XMJ0uCRkVzi4lVSQAP4Ae2TWRey05bcJceLHJCDghxtdTzkZH8qpV1i+jLGO5kUt3IJpq5v7i7YNI4yO21QKyc0bKDRYzWVoxzaX6uD/4cikN/Lg0KrDcuzCR8FhxkDBx9qFTaKpnp/Xfw7udBvjqfT9sLy2Ul2s2OWQ/7v8AiHt3HvVbZ9HX3U2oSyXVu2kS7BI0hg2LK2e/h8dx3xjnBromjdZ6Rrqs8UrQmNgsiTDaVJ7D37eVM6z1fp2nM6LJHdTJ/wCCkyq2PXk44x271VIbMLefhvrdrJtijt79GGN8UmxvUZDf51WaZ0B1Pb38Mr2AEcEiTFnlUcBgT9+K6DF+IGlvBBc3UUtm0kbSKjkHKg44PmfYVXXf4q6RFfx2ssI+FnfwzdbvlAK5GRjPfIo0Iy/U1tc2S65LJYeLbXOp7g7plWQg4IYduTiuc3Vh8Lel4HaIKNyBudrenpXofRZbWXQbtxDayw3LSlIZ3CrIcAhTn19fLiucdTaAdMSa5k0+KezvSCG3ES2TkH5Djjv2JBDAcUo6Q5K9lLo9vDeRXGofA293b/L8dZ8iWEeckb5yFPPPYHg8Uie4jS5jgt9Zgu7KKPFrDqUJYKrHJjYjOxh6g49CM1Bax1fpyOz16BJ47OUrtuoXyEbOMZH5CfQ1P1XVY9eHi3UFpDcthReW8W1Jx/8AXFHAceoHOO1OyBWi65cdOXUl/ovj2dsSElilJmj3HIJjccccEAkHHma6doHW8EkaWt7qS294Y0jjluFG26bAO9cHBB5HHOfeuNSpf6dDJBbuyiRgsiA43jy9mB96jQ6nFbXn77T4HgWTc8TbsY8wADwfQ96aHZ6eklW6iDhxDIE+VlbIJ/v/AFpMmpi3aOF3BkK8DPDEDtnyJH64rnfR+tR6ppjiK5aW2jkd4sSlpINoyA2QCePr386k6vrcfxFnBe38Nx8wntLiIGOaYJ/4bjBDHn1GRniqHyOhpcbipDDGM+2fSl+KGbAxXKunvxFt59UuknuZklVnPgcMrBfND555+X2rTaN1zpepXk1uLpFkRn7nbhVxyc9s54ooXI2Q5Oapup+kdK6rtTDqCyK/8M0LbXH19R7Gpi3olAKng80sMSctmgq0YxfwzktdNFnFqfxIt1PwrzJhk5/KccY8ge9K/Y87acq3lvrS3ll+7gaCRSiY/iHbg1tQQPKkPIAKlwsfKig0ufUEspJowlt8MiOIzEqM8rHG9t2Tzzz+lVetapqE8DS3IuWYYCXCSGIRucEMACMgD9fOr/Ur9IkxIHZWO0gAt+tYvV3guLhWuUmCldqIjAfN5Aij0xPJ8Fo/Uc40xbO6vozeRum2e3fYWAOS5wcZ7AjzpmcWElx+2LqGO3nLjCQt8s5P8RXy9wO/pVTaWgQTo7JhcMcN8qc+uOTTlldxfFJcwN48it8rtwqEenqafpoz9Rl1d2l4bj9tzGSZkUJGIhiOQFSBg90PPAYHBqjfSX0vKTQ3MKqiyhWjBbLE/mOPKthaS3MEave3Ph7xuyzbQBjOT6Cp2tQ6nq2mBba7RHeIxsu4YIIzuzn6frUuHHaNE+SpnPduOMUWKCQzW+6CdSksRKMh7jHrSsV0xlatHHKLi6YkChilUWKYqCAoYo8UdAUJxQxR4oAUBQWDQxSqLFAUJqFq2q2mjWpubuTYnZQBksfQVNdkiRpHYKiglmPAAHc1zrqC4l6llhuI93gfMkMQ5IXzbHmx9KTZSRB13XJtcv8AeJDDCi5ghxlsnyPlk10PpXoXVT01Hdz2zM8U3jLbq4VnXHJUNxnPrUboT8N7bUR8Zqi+DbIok5fPin0Y/wAOCBxmuja31FP07p8Uktn4fiJiEyfMBxyMgY7eROexrGUjeEPkzVx1/puq21xpNv8AFI8MZIhWMYkX+JW8hxkEf0rPQaA8mowwaZP8Uro0iIoI8Lj+fAH3zRXupQSvcak8Edvd+EC7QxhVkOMYYev8jVnB1DeJpzaXbrvhndpJLlkxJMMAHjy8vOsWzainvLae3gjDruSUZ5OA4Dc4x37du4IqNp11bWkd7ZxzrC93zEZycRHaykhgO+D6c4q2vpp9RgEczrI1um1XAG7Hln1qDZ9NDqKLUAHKXEUIeMqcDOQCMedEWTIr1Q3t+LuKWG3kuVIjmUErLLsC9j55/qc+RpTaWl/BPdXk8731rK2bCeBkDyFc7Vx2PBbjgg00/ReowaGupW6yXD2c+1oY27gkHcPfyOOa0sF5pZ+Ak0eznj1VlyI70lmK4LBiw81HAOOxFaWQcyulAgikESkkMG3Duc+32pQtZTp1tdA70YOdnmuD3+h/tVvqhkeJbS9t1DQk4lTIcnk4b3571D1Ox+AZLJSN0LEOoOQuTkDP0PNIRB1iS6e1tnkcSRENsJOSRkjH2/vT67r6ztdPdoZyYmEUmSrwkAnwyTxnP14IpD2jXNuyMhWONwWlOSEHYA49e2aZhmQXj3RitxGUIETHjtjOB/FTsDpehXcd/pFtNHvwECNu5II4INT65t07qLWN7byoWb59jJuO1gxxn610ojk81tB2jGSpgxQxR0KsQWKLFKoUAJxQxSqKgBOKGKVihQAnFFilYoYosBNCjIosUgBRYo8UKAEY5owDSqFACSKLFLojQAmhR4oYoAKhR4oqACxQxR0KACxQo6KgAsUMUdCgBNFSsUMUAJoUeMUKACoUeKFABE4pOaURkUnBoAPvQxSscUMUAJxRYNKoUAFiiIpVFigAsUVKxRYpWAVCjxQxRYBGhR4oqABRYo6FABUMUdCkAVCjoYoAKhQxQxQAKFCjxQAVCjxRUAFijoUKACxQo6FABVB1bV7XRrU3F3JtUnaoAyWbHYVOxWD6z6mX49bBIIp4bd8yhx8xbHIB58jSk6RUVbLu06qtNTtWuFLxQR48ViARz3GO/wBxUXVNI0C7g+Pitwzgb1eElFPoSVrEXVizTn9k/EXNoQHdE7xd8qT5+fNT9LvdM0mJv9enuI5lIaxcYVfq2e/0rK7NeJMu7q2ispJIJntnLDxrYP8APJ5BlYcPn+fnzTBtppNPjmsJEdgxI8QgTLgfl55I49+1Sh0q7OLuB0jc4lgt2xIkZPk2OcfTtVtN05DdF7ySIi+kVQ+JMIrj+Ifzp0JuikhuJ7yw+UW0NxB+8LyWwjYrnyH186zl1qN9K6rc3MkscTkKpbAH2qRf/FWFzPmd2uJJGSQv3YAjuD60u2sfisOZXmYjDxiMt5fmzz/OkykQLu/nvQiyuEiQbUjXgY+lJ2wRuju0kkbLkqQM/T2qwjtLa5VLWz8e4vGJDqTsVcZzjvmrqLpiKGzN7cXFoqx/kRcvHu9SSfmPt2qaHaI/SnT8WqAXUxihhiY7R4nMrAZAxg/r2rp+g9SQ2QM+o3k98sVu0CAxqqBDxjjgenFcm0tpJzLOryLGj7QI1GU3dzgeVbHTNMsxYSxvfRRXB/eSyxPwG/h48u/Iq4kyNNp/VtnYzSWGl/DXFrej97Y6kxKR5HcHGCp47/asPrPUAseq3ihsYba1hAiaONg4EYGCFkAyV54P2qLeWl9DbyS3cEJC8xsv/i8/mG3Bwf5VGnuFv7aSeI5dItkyTABkGfJgBn71LHejRi9gsmWOOdSk2JbaYYyp/oRjvU3UHmvbNZoIoHvoHGQ4xjyIHmMislZSzxQpHeWkl1axx+MAE24Hmfb1z9eK0NlqKSxwRlcJctsRiVBUgcZwT5cfaq7JMPeMv7UuHMskc6uQFEexj5Y9M4/WrnUtWFsINU0i5PhNII5EKjhgDkEeRwab6p8Szu4priEOoQJKxTBfuAwPrj+1J6dt4LeS53TF7SYgw+IuC+RjB+oyM1IwafcW5spYFV3t5Tuwj/7J88Aj9cY9arnid4/Ca5jZlJbeW+bjIxj6GnriymNxIsLFo7Ybdq4DgZyPrj1xTKTNeymczEPEeSiY3c/mYD9DQNDy6h8FbtDbrDcRSKI2MkQOzI5APcc1QSK0DshGAfL0FWl/btaBSeY5M5xyBzxS9EjgvpnhnjaR9oEWw8g5pDTKZMu2FGfPirOy0W71XAjXsxVSwwBjuCfLvWmh6KtyZHeSeKTdgFcDHrj61d2NhHp0JjjZ3ycs0hySaaiJz+DPR9FJBGsiy+LOOfDf/Z59/Mipj6BFdwLLexql0By0JICgdsVfDtSO7Y86ujNszZ0SW4ZHnkWWLb2lRvlHtk5BqPqivNdXJUjZt2jB4HHcfpWnklRG2s2DgtgnyFZ6/eS4aV4WRlJ4KA8jB4zQ0NMobeYbbe6Yh2iXwiWBOc+Z5/nV5IshuRd2t5JFtAKyRNwGA/Kw9O9V3TPgxrdWd7JGFYFREVyefPPpTmoPHo+n3JtZVVg4jVSeSD27+nlUp0imtl7dddY0kH4eVrp9yGWAArH6Nj19q5zKUd5ArBwxzvfgjnP60yGbnLtg+9DOcbQVzxnNRKVlxjQAilwpbaCeSfKidQpyDlckA+tETjg96I/Mc8VBQpWUE5UOCOxJGKFJAxQoA6/NNLnY7tKm0fmPPHnU3Ubm51e0huJzGZld18faFkcYBCtgYI7896hvGBG3Jbnjgce1Ka4W1Twg4Iccw9wD5Y9P+tWSNLfSSh4r2VmMK7I/EfKouc7RUkpYNZRB45blXjKsm/G0/wALKfbzB9KhPCHgZniySecDOB71HtibN5HhEcu6No2R+dp9ceR96Yi40TqCL9kDR7yWa3WO4JgmQ+Ii7sBlkU8lccgjt9K3XT8z6NocF9rMSX+ll2tneGVZCFbBRSM5wDvG30Yelcj0yN5wzzv4YV9iygcq5HA9fKtXonUs3Tqyi/tEvNNuisF7Eufyg/nC/wCIdwRSj0UzoMvTun2+656auYG0+8iPj6bO2Yp1J5Vcn8w5IBPHkRXNOo+lbzpTVVjMVy1hNtYfLtOxj+XzAbv3z2q/nuNFeSK40u9gsrsZG6cGdJAc7JFZeVPHYrkVNaTXtU0q802XUNN1aykj2mN7rbPCQQQwDAEnP8qYijvOkbtdIGoSO01kMG3LDaVAYhon/wDZP7HgnODWVvNPiN4Hjkke2ckRzOuCMDPI9Qe4rp3Tdv1hp8IupYrW8syG+IDjfuTGDHLjJBAA7g+xqg6o02x1ASrpuh3Fvc7t2Ypw1vKpHOC2GRgc44NUkxNowNhqSaLq8bq9wuCVY2rgHkYBGQQfoe/arzrma+uzYy2spbT1X924+ULKODkd1bjFZ+76c1K3lQPptysZfau/sR7sOPvWkvbC+TpvwNVRSRPHsZXyx8snHmP51aRk2UNrdXUMFwZHUO0waWJ4hksf4gCO4+3er2HqLTHmmj1exRZvDCSXNvnxFcHuoJAIxwwzz5HiqlOn9QleS5WIrBE4aTxgVJUc7vfIpq/Hx99JdCzeNLhmMCRxkhz5Y9PWhgjqOl9aXVilhptvfPdSNG0s8lxB4ZhABPhsByTxnJNbvpfqGz1axFxDMzneUYMpG1vMDPcVxHToNVtIkn+IYXqBpgNuSgAwAx8278Cuq9BrPNo13dPHZy3AmWQNHIxdkOCylHxtb38/Wky07NtJOijPYe9UWv8AUkGjWb3Mx+UYA48z2pu+1gXpaOxlhQwXBgmjmBDHAzgD1PfPpT2pWEeo6ZLbLCrLImAsnb9apA2QUubTU49puRvfJIHJBHcfaqHqHW7X4h47UQyzIo3FTgjvg/y9azytrGia9KF+HiUxNH4yrvdSe5BHAPbvQuIZrhvFkky7nLt5n7/2pksaaUyh3WVuOWZT960en6hZwaYl34xu7+Y7tpi2hPbA7/WqnTdPWeZbeBFVc5baQAB549612n6XZ20pEAe4JP8AtJB2pCSJGlXV3fRGWdViRjkRg549DUptSmsGa8+HlljhjAeOJSWYbudo88VDluotLcwLMZHl/JDnndnyOf5VA16TWkk/dagLe3IZ/wB3GcrgZwT6n+1DK6D6tWye9S8WSVN8QlSUocOPNCMZzgg+eKqu4zWo0+zt7e0ttSnZp7j4cK0902C4PYHB2kj3Hn3pnVNCE7xyW0aW+RgjJZG/3g3P/frSh9oZFy2Z2hUm/wBOudNlEdzHtLDKsDlWHqDUatrMXoFChR0AAUKAFHigAhRMQoLEgADJJ7CimmitomlnkWKNOWdjgCsbr+t3Opyva2oAtR5H/wAT3b0X286QhrqrqNbsiztmcwclvl/2ox5/7v8AWrDoDpbU72KbWZrdT8O8aKjxkMFP8UYxgd/PvTWm9KhCmo6okotZ+Yd3a5PovzcAYzXSBq9xomjXCpZLA2xPgbZhwyfxM5889s/SsZzo2xQvbBbbrKzQ2spnt9Q/23xABO3Hn58fTistMNX1NbfQLu9hZS37lywbaCSFDFfX6efpSOlupLW91WS5nQqsYZJ4XYA4ZcDnzI/nUvS4jp17IqXYlkgR44JUjLnftwDjIOB6+RFYt2bpFff6fd6Kxt5IlM+QjHCyqcnHB7EZ4NTdPTVdbhSKG2meO3RmWGJRlE7YHmw/U1pOkdDkmluZtaUzeJCobJzuyRyfLnvVlqtjpml3ASXUJvjt26OWbhdq/wAHHAz6jnNAznM2bad0lIglxt8PBJbj+VKTU4+nI9QmacAzeDbxyBcgMzBicewHlV9fy2XWOt/Dm4McqnZbSP8A+MT3VjjIPfGe+MedZfWtB1eGSKGBGE6XPiKAo3ZjUncM/WhCZptJ1HT7OWY+FPZ3V8/iSwRqTHKPy+ImR8xHfjGP1rmTi51fWlaGaaXwSYWuPDYlou4JC+g8vt5Vb3HV+p65ZxQww/DssxeRrUsPE3Agnb/Dkk5x39K0em6FJo7rDealLBcLGty1rbOGLgZUc44+UnjzIqzMYt+l7W+thFFdC5uw7SXUCSgEhRkPH9Bj5TWWv2W91WRyEZnk8Ri42sWx6f8AfnWq0eaTRNSh32cos9Ub92UYnwXB5IA7Fgwbse/Y1bxaDp+r6nBeW1x/9MKY51aMKxbnDL/hbIzzigDBap01faXZJNI4+FuuXjiYMVCsD8xHfGfLzrJC2NtdzRRgyp8yq2D2PZsD2rrnUNjFp2hz2jyidRdOuCxR/wAuPzcgD29TWX6mh1PS9OstS0+xjtITGiTPGFbc+P4h3HnQBUaTZQ6fHpd9HcLLuuPDmgcAMjA4yB6YPnXRcHPrXJNOaCNmuZhhX+QoHw+T2cHGOD611LSJ5bnTLeWfJl27ZM99w4J/lWsGZzJWKGKOhWlmYWKGKOhRYBGipWKGKAE0KPFDFACaFHihQAg96A70qhigAqLFKxRUAERRYpVCgBNCjxRYoAFChihQAmhSqKgAqBo8UMUAJoUeKFABURpWKKgAqFHRYpACio6GKABSaXihigBNFSqFABUKOhSATiiwaXQoARihS6SRQAVDyo6GKACoUeKLFABGhijoUAFiiIpVCgBIoUeKGKAE0KOhQFBUKPvQoCgqFHihQOgqFChQFAoUKFABGjAzTN1dQWMD3FzKsUSclmP9PU1mNa68itliTS0EzSgnxCPyYP8Ah70nJIajZeazq0Wm28qqxe52FljQZYD/ABc8AD3rlWq3tpdysbeKRGBLGR5NxkJ7k8d612mTW99avNdavLHcOxBcvuVs+ZQ5AH8qhnpm3uriR1+GnkQEsLRlO/8A5GIxn1HFRLZpGkVPTWoSW0Fzbw29qVlwJ5JpSpKZxgcj+VVV/GLe5ci2SKKQlo8NuBU5AwfMe9SNTsBpdxkQ3CqwO2O6iwfpnscd81M0+Yapb/Du0NtLHEfBl7ZPmCDxg+Z8u9ZlGt6U0yOCwiuGkjlmA4ZHDBFx2yP51e4zxXN9L1e86edceP8AClt8ieGPnbswB8gDW4tNYN6ieHbkOSpkBPCK3n9fb3rWL0ZyRIm061lDl4Isv+Z9oz+v2rKatBdaNcTXWkyzxowX5BCSsmefzCtXHqMU8LmFGmZGKFEGSSOKQlvbapZeDPBH4QPMQfdtI8sj+dNqxJ0ZG3u3u5n+G0pkvbphuRPlLr5lv8Iz5+dQ+ppp447fTfF8SRXZpBH/ALPccDavsP61p9R1Gz0CORraKKBI8oBGn5mI9fbNYK81G4upGMjAM3LEYyR6Ej+lZy1o0jvYSsdPnYpIVKHCkEHDep86atL9rG5SUf6wqPvKsSA31HnUdneQksxJPcmgVFRZbRqptRj1y2faI1dBuaNX27CfNc+npmqxGC3McE3iht652HesiZ5Zf096qYyVfgsD6A4z7VaWCKJSCnyYL4C7jt8wD5U7E0ajUtSitfhb22Lqu4qi4ySoP8WfM+mKcuI7e+/1jT1Xw2yzQoCCGH+EevY49Kj3Pw+s21xb+JJGWCOgcbhnscP68jP0qv0VpdD1FrSa5TaxD48sjsQffzxVIhmqWOy1XSpY2Pjxxj5hnIPr9CPaqS40ldK8OO0M1xA2UkhZuNpPDKQe1XlzP8BdQSrFEkNwcsuMrnH5lPkfbzqAkED3kci5lj3FggG4KO+ceY8v0piEz2yzQFpLYzTwusalydyexI5xj1rL3UIVy0ELwL4mBGSQynsCfQN+la296kdHngNtIJFBcgNwBj+LH9KoLzW2FwtvEzOJNoAkUBShH5c9yPr2oY0M3enXqxxJtkaKZSuSnO4dh9fL9KrdPuP2RrVvLNGUSKQB0YYwPOpesQ3lpLFItxKVUgor5G0+Xf0qdqMfxstrd3lsvw7RgbgcCQkevke9TRVm3OHG4EHIyMelNstVnTGofF6d4DK6vbHwwHOWK+RP24+1WNw/hqW2lx6CrRmMB5XkBiaPwgcOCCT9qEqCdPl/MhyMkjFIeFN5l3OXxnZnk+wpi9mECRyfEzQgn5QI9w7djTAXcRvPDLC58MtkI6t3/wC/SsxaJeaVO1nfKvgSf7OSMYUNnvx2rQvLBelWDyHZgsgypz5NimLuSLTFlmllmkG3KqwBCgeYpMaMlqNhJDqaGDeomYKCnr7VX605W7WCfDzwLskdTkFv71e6rMZtPmluFxIihlZeATny/WsiPmyTnJOcnuazkzSIZwe1JBbBUEgHuKVtosYrMsI+VChQPFAAoUeaFAHZmzvfcBjHGeQwqI8STSCQKA+0DaKnRQb2IVQeOfOmDDHb3W5gUB4PkKskG7YjSFAePmHliq64tSo8RQUk/Kr+2O1XETxoHBXeCOR3yDUVoQFEWcqCCMnk+1AFTZWRuxcSSSKiqVU5APzYHl38qfX4gWkUaXBBVmAQN34PbNI0391dXnzMAjY2g8YwP51IO9LcRgHIcHJPI9DRHoJPZEtrlvhIZfFaKeGTxBJGMMCPI0LnUZWu0ubhvjeMLOV+cr22t6gUiF444Zmm+UR9wvOaqLi6SU/ugRv/ADZHOaqibLm36nvOnCkujX89uzZ8SJCShUjsQeDSYOudZgn3y3Hjo2B8yDge3vUXSOnp9Ungjci3jl58SVtuR7A9/atvN0f0/pdnNLLDI6qu4M0nzqP93tVpENlfpHUR6rludPupYbVMBoCud5IORweOK0GoSx2FpKt3eW9vHIrIsjjadx88edHZWum+DDcQW8QVogqsQN2w84JrCdUaTqFtevfXkaXNu78FWOBnt7ir6RPZdr1VpekaSLWO7+OnhTbuKHax/wC/6VUarqd/1FKbiziKWNqiszKQmMjnJ9aqZHs7i5W6htxa2yKFlQ/MGb0GfUc4paaixiWxnuLu3sx3WJM7vfHGc1NjLnUL6HU9As5IcWptXH7tSM98bh/1rX6d1fqWg6Fp2rteyahZTNJbTRABzbkAfN7HOCPqRXMrm0utKmVXieNefDMiYLqfMjzrV9A3UKRXME11gswKxySDaeCOF8/+lHbC6L+160k/b8WoaoQtsjKcwwclCvDHPHceXNaTVOs5tXhU2ZEFs4ypU5Zh9fKsRbaFJJdi7u55kj3PG8UpB8RQTtx5Ae3tWt/D6LR55r7T7+zgLJckbixBfOMHOck8gU+gW9FWpLsT3z68ZqdYaPd6mNkcEjg8O38K/euhW/TGi6bdb1h2iQZEMpBCY9M81dXESiPakaoPJVGKVlqBzvSfw+Fi4muLl22/kXdkr9K0wtGCLHDGqRjAJJ5xVr4W4fMMY4xTG51nSLwyYgDlvemmFFHLp8yTKbO4iMqMWlSYbsp6DHIHnmnLfUzJcm2BCShk3rICSM+nt7+VT9T06J2W4iiU3akFZUUb1HsT/Q1WXnTdteLbai11qFveQ8jwZynzYI5A4zz5UATrmW+W4EMNktxbswAcSgGMeeVI5+1TbSIwKyo5lCnaXwFGc+3nUHSri5jieO8D5LfnZgwYepx+Wn3v7SJykc2Gc5wDyT2oAXfJb6nZyW10wIDDa6p88Z9/WsZe6VPaXEsKZnWLvIikDH3rZTTqwTxVTCkMCe+R50j9r6XHIJbi8tw69yzg/wAhQmJpMwnHkc0O1aS7srTqC6MOjW/hyBt0txMjIhyewGPm+2KuINEsNDg8G9SGcOD+8dMscDkD388U+dErE30YQVQ6v1faabefAxwy3VyR2j/Kp9z/AJVo/wAQum761txPpDTSWm0+NEn+0UnsTjnbisnoHSlkkyXXUEzW1uAJBGqHxZl77UHp703LVk8WnQ3pmk6n+IeqS27O4s4e6xglUPsO5Pufeuhab0NpXSXgJJYteXUrjajkElvR27AUZ6yj0jTo9O0a2s4RKuyEqNmcjkuCee/fnkUSNBpes6ZPqOp3N5fQqvjm0BYSA8qOOCo7eflWMp2bxxpdiurLYXkVpf317HLAsTFbfT4TgqD3yRtG3zzVak91K8DXmrRXlpHmMC3A3KNo+YjABz6iiNpqNpIGguAtrcTuY0+VtgdiSGXupwSKYlsDZMkLNA2SUxG25Rjzz/2axezQzMuj2ml9XzQQXhltr6B5eY9rRENwOTjvWt6cu30u9kdL1I5JonVn/wADDkHkYPb+dZa7gaPrCTGHC2e3I/iyccfpVxBGYpFwBukh2n1BHGf0ptgkSetuvdRTp3YLlhczS94xtXZnIAHl2Oae1nWL7qnpy3+LeMyQv46qYyplXtuU+3mKr+vtf0i86angj0hbV/lCyI2SXz5jyHeoPTWpX8+lRW0tw/hRD5UY8KGGOPTP96b6D3ob1ONlgEqyFpFVSjINuMdwfp/UVYaTb6jqNha3GmRvNf2NwZW43Eq6YJOfpRrFER4EpLruJXaRgL5j2OQK0n4VwBLm/i3bd0Q/kf8ArSTBo5l0/FJpd5fW8kLLdkssbSSFAmed+P4gMcj+VP8AUU+qwaZm4uzJdW0jRiaNVZZIDxw45PzA8GrrqqwnHVFtp94sVuFlwJTHjO7ODu81OQPbFU9hpt1+y7zSVzG7kktJECoY/mTzIBGOfIr71ZDRAvtQ1e+0/TriK4mje3C2c4VhjIJCv381ZR9q6LaafJaaxbxfE28ckbLmBm2uvmAR5nJzn3rl0dhqmlXS6fIcLfDw2iRgRt3Yz6Dvmt5p9rqNre21pK4ju0AhkeVu/kee+cfcUpaCJs9Z0Kz17TLyKVDY3EqYmwfzc4DY8sHH/eKxh6Wv9ctbnTJrx0lW3MRjOdm9cryPXcoOc/xVa9Vi9jvYdQssSz6ckqagmd6yRZ57ctg459qkaPrIv9SsbiKC4mZ4irmIDMiHOCw89oP14o5FOJw9bS8svFsXGyeGUgxOABuHrn6Y59a6H0zezXFmbeeHw5YCVYjgZznGPLGcfarfrfS9E6pt557WUWmswBt8RTBuNgO5fUkYOD7edZ/QNPSXRbDVbK7jaRpCs8L/AJ9y9wuPXcO/eqUqZm42qNFgUMClyI0bFWUqy9we4pOK6Ec4nFDFKoUwE4oYpVAUAJoqVigRQAnFFijoUAJNClEUVABUWKPFCgAjRUZoYoAKhijxRUAFQo6FACaFKoqACxQoYoUrALFDFHQosBJohS6FACDQpRFFSAKhQzQoAFChQoAGKGKFCgAjQFHQoAKhR0RNA6BRNR0KAoRzR0Z45pO4UBQdDFFuGaUOe1AUAAUWKMnHek7xQFB0DQDA0fegKE0KVihigBOKGKViiIoATgUMClYoYpAJxRUrFERQAmhSiKQ7rFG0jkKqjJJ8hQMP286rdY16DSYmcKJWGRy4VQ3kPrWa1T8QZHMsenwbIV48dnAcnHkPLmsnbajatK0uo20l8zcbTOVySSSxP9Khy+ClD5JmvdQXOqPDLPcFJFLI0cWCijOcj1qniuGtrhJ42Xej7gSv8yKlmwFxFcSRSLHbwguozu5PAXPrUW7spLWG3lfIE6llB4PBweKzZqkhq6klmmU+Hs8RRgLxu9/vipY1DUJoo4hM0awkfMq7duO2SBml6ZPb2TQ3NwHJhYvt7BgRge9XcfVlh8HLa6hYJKsp3AQDjngcnnP9KYg59U0y/tIra8uzeXL43zr8qoPcEDP9aRZdFXst/HPG8QtkZWDMxYMvt/kaf6U0nRLq/eZXlldf9nBMoO36+v1OK2bi5iZREsAgDAbcYKr51cUQ2VEVibgT6c9hNDZ27ZikL4Mp8xj0qVbafO80011jZMCfBGMAn1wO4HFO2usw3wMltHI8fieGr7eG9T9BUn4yFUmkkYpHCdrOwwOw/wA6qibKnT9Ckt7FoJp2iZmZ9tucYyfXueKjavrcel2AtEmxdSEKzjA8EH+I+WcVfzuVheaNS7hMgDzH0rBR6pZahq6g6bKQ5O+QLveQgEYA7AdqTdDWyr1nVFv/AAnjkn3oCp3n5X/3gMcZqpC5I5x6k+VX2oWunIX+OmdrhATi19M8AluMj0FUs0sLsBDCY0HHLbifrWTNY9DZXHbtnv60DkHHvS9mVFOQ200/MUZfjspBNIoYIx84PPbjvVvpt1bS2/w/hBSxzI5yTgcn+nlVQ6BWweCO4PlUq1t8je8s0KSjarxjKsf8Lc8ZoEy40J5L+5a1tVk3bGEYRyAv9+Djk5qbaTwygx6jLHJLHwVZB4inPIJ+vbHFQ9KgubBBd2uSzw7X8RD8rAj5Qw/rV1FpVvrKI8kZgvgclfyhvbNaIzZNguoJAumTwusUhzEzZU7xyfofOotuJbTV5VmmaRJFKxSBcBs89vXH9KtYbZLCzjmS1bYOJofzfMON31+lUWsGTVEEcC7WjbeIW4OcHO0/zBpiIGpahLpV6Lcl2l3Ab3wTIh8zxUC6kywhkjQsMouIwwC5znA+uKv9Q0iG8tYYpLh2vI4wyyOcMB3yfv5VTtZTWlvdzvKLfZt+UqGLMeOD5e9IpMsLHxJoxBqcaNlThCeceR47ev60d/rSSJFBHAJLZAV8LGCpHYg9vtVWu6SePYsroSI2ff8ANjuMH2/pUv4Z5Vflrb5thTIbLDsxzzigQ7bXMWjXTG3ZhHKnyqw5X3z9au7XV47iBRIUU/lfLfzFZK5mkVEN20P7s7DtO48ZBA9frSGa2W9ETzSSJKcEomSo9MH19aLCjT6nLGqCN5JWyePDH5vp6Gqi7nmE6x2e54/lJIcljjzPPGPTzqw0t/FhlteJJYiSjSL685Ppmp1uILoMkkUPjkDxFxnFUyRu2uLa5LKJAzyr2OPynyH+VQr2RmkXTxbeJBs2ibGQMfTtRX+msNQBt4+W+YuRkR/8OeKrNR1C60m2FqGJuMFpH2kLszxj3pDXZT6862uyyilkdMch+49PtVORgVIv7yTULt55TliABz2AqOzVi3ZtFUFk0RNAHJozjIz2qRhBTjdxjPegRnn0pcTQLMpkVjHn5sd8e1WYazjzbva7FlIMRdiWXPYnkDFOhNlRnPahVpJpaNtMshjbsWRQyD64OR+lCnQWdViZEG6Gb95FyyEEZHqKXOxa7LPyxGQwFE6LE5kQgMCfmI71HuXkWcEYOcAH0FMA2jeIHgYHOAMd/SmNm91bJxkfapPiuM5OSfKoOoXaWS74/wAzHIFArGYFxe3zIyhQysQ30/6U3FNdavfx2unxr4pbhw2OB5n2qwW2i1D8P9T1ScMLq11COOJlx+V0OQfUZFZxNVn06yMNo7W0zsRLKv5mHcAHuBTh0KZfal0XHYup1HXYIRMeB4TFmPsKz9ncQaJdSTtbi7mhfEW44jGP4sdyaZuNTvdRWNbu5kmESkIZDkjPfn7VCYBF4rQgn6nrd7q1ytzK6rIF2r4a7do9KiySTyFRM8kgRcKHYkKPbNNRtsU47k0bSYJBzSsDZaT1jbafp/wws44pI1wOCwlx6nyNaeW0Gp6NsuN8qzqGGw7GAPIGe2R/OuYCF52CwxvKxx8qDJrp+iTytpMZmga32DaqONu1R5nmriQzO9Z6fHb6fapa2gAMhMjKuSSFwM+v1qsbTtZNg1zcPOTBseFSCzbu2B7YrdW88N3IxgJuChwxXgL9zwftmnb6+gs3CCKVzjcdi8KPUntToLMpZdKajqlukmr3kgYEsi53YB5Pft9K0Ftp2l6IkIjgh8eT5Vcj5mPc/Sp63G6HxSjKuMgAZJqmn06PXzFc3sBgmhc+CokDZHlkDjy7UUImXVzDOywy7iwfOzsMDzJxgCq7SNctNO1/UHu4XMcsK7FhhZlkK+RPf+3FN61eT6dpqT2twZ4CwTe5yB6hvbjFRP8ASqCZXgkmF1DIAvgpERLyOQDnGPekylo7pot0NQ0q2uZRL4dzHlQyH93xnDen3q0S4zCG371A4I/irm2jyRdOabby2tjrVr8bBuV/iBIv5eN0fGRmp9t1pCsLxwRiQs22NUY7U4Ge/uTxSRo3Ru3u4sAH8x8qbO58BPOqzQEmliEkiMzHkyOMD7e1N6v1fp+nM0UBa5mXg7eFB+tOhNlhcXEUAXcy72O0ZOAT6VQXnU0UKsjsm4Ejg8D09zWX1fqG71OYMxWFV/KiH+dVqne24gsTzk1VEORoJuqZZHH7oMgPY+f6dqqrrX51l3NPFBntzg1TazrcejW4kfLu5wiLjmsJLrsl6svxNuslw/5ZwcOpzx9qTdBtnULfVE1VgG1i2YlAyiWfaME4AqRcfsfSbgwa1qVpBIoDMuWJ5GQAQOT7VxYyNucyMkRI/MR3HpT+oX8F0lr+7ZZootrhfytz3+tRyKo7A34l9M6dCWsb26eT8gTw2UfU58qo/wD1vywySTafpUjO/wCdprhn3f7wUDiucsj24R541UjDKHGVbzH1FaPovU5BfPayoJYJhh4I0BEinggjz8qlspG2svxGOtzJJasfEQL4iL8rYA52tzwfQ+lSf9Io7/Px9oY1jAe3kslzu8iGDenGcZrnGlWc3T/V01pskEeWRGZNhAPIyD27YxWpgjvRfXMplVbeRVk/eLlVONrDjtzg/esJNm0UdKZLjSdLg11L/T7qxEIEcckBXws53BMdzknvXOrabUWne+ks3EQncxTRmSPahbO08gcY7V0PXbOGb8O2jYWl0kDKXEblwiHHJHBDAHJFUNvALjSvhrSR7a3gRJ5YGVysw4ww3fMAd3bHHvim3rQVsxup9c3KdZl5IfCtbgruRQoYhu/zEdgc1u9N0y2vHtiL2CJJuVckkZxyDjt9e1Zrqvp/Tr/Rb62tYJ4bqyT42AzLvdEP54ww/MndgeCMdqV0frP7RtLK0VoSAhQfuwuCo5y3n96AqjWavo9na6haXEAdg8TROZk2kYbuMcH2NVLR+HIJGIcK+CD6Grue1lNpFPIrMu/G4t/LFQHi2q4ZMljxQwRS9cXkF3p8VrqCmONrhSTbxrudu3n24o9MtlubtxpdvPsfaIoXO9sgc/l8qrOqjG2o6TFKxjj8Qs2wZ7EY+taDQ+ppNGa7s7W3RUmOd6jDqP8ACG9KfsT7g1S0ay1F1kiaNieUIAKt5jA9K1XQZZ9bkZYAUkg2kooGzt3+pFZceLdzfvcyhW3Aluceea1XR+qwaO1y9xIYrRgqySMRtjYnCn155Bpe5Re9RdO2fUdncWN3GDnmOTHzRN5MD/asrax2dtpghuIkkvo5vg7mReW8UDCsfMAqAa38ssZEsoyFAwx79j3Ht51yTq6S50fq3WrmKWRLdrH4hk/hkYqEH860QprRQay63V1JBZcahbchFTLSRsCGwcemDVlY3txcPPA101zFHAkxIODwFGT/AL68c+eDWN6fM+p3CafPIBdOfh7eaT5dpJ7M3fyGK1Uy3UWpyx3sLW96o8OcDjxGAwWwPXgn1qZkwNX0nLDZdRwyRCaYSllkl/hZjnJ9+O4NINsOnnuLix2G4gvHVYI+0Sk9l/3Tk8eX2qDo9ygvbaWQbRHOm4pwSAR9vKrbq6+aPW7pRGpRu3GCc4JPuRwQfes7NUjF9STalok0fUklq4neZDES3MTA/lYjggqCP51F0ZobzVNVhgtltoLiYzwRxuGRGHDdvLv+taO+iinsdRg1Nnmt5LMXEZjA3hUk2kD3G7v6VmdE0eHp3qEaeZ2ntJxHNBcMhVZImGc/rkd/Kqu0RWzTQ3tzc3rW9z4UltEheaVEHiR8YDBiRkevr9aMiJ2/1eZZ0JIVlBG7Hfg8/wDeav10PSrVTHqkE8U9vMyeJEoYFD8y5GCGBGcZ9MVA6k0QtfwT6YYYrWBmkEYbw40dsfPg/lOAM4P2q45XHsU8SkVuKGKnSSWWoJJcG4sNPljYK0W8+HJkfmU8/ccYqDuU5KSRyKCRuQ5U/euiM1Lo5ZQcewqFHQNWSFRGjxQoATigRSqBoARQxRkUMUAFiixR0KACxRYpVFigAqLFKoqQBEUVKoUAJoYpVEaACxRUqipAFiiNKPFF3oHQWKFKoGgKE0WKVRUAJK5oYo6In0oAGKKhu9aSGyeKAFUROKJ5NnJpk3YJ5HFAEgc0eKZWdW7cU6GB86ADxRYpVFQACOKLFAkYpO8etFgHRFBigJAexpLPtyaAE4ApDTEcL+tE8u4ZpsZNIYoux7mnF7U0OBRh6Qx8dqG8imC5JpQc4oBjvirRrKG7VGY5oByvaiwokl8GlZHrUXxy1Gj80ASRQOKbEoAoy28YosKFZzSc0QOO1Q7/AFrTdK2m9vIoS3YE5J+wosKJvJOOK5p1h1XJqszWNvujtInIbB5lI8z7e1WPUnXcN1aS2mlSEbyUaQqdxXzx6CsHyBWcpFxj8kyGylvVc2sKEwAM5LDnJ784qPJA9uypcRmIk53MD2/vSGR3YCMFiR2UHNOTOQkcUzMfDY4wDgDz+4PepLHEs54W8P5QXi8XBPG3v+vFW+n3MnUngaVduCISGimZgCi45Ucc5/tUCy0k70vLk7dMB3SShgcj/AADncfStf0rBoN3fC40lJ42tYyrrKnLE9nz6jtTXYm9EXW+irm4mjW3P+rxoWaR2Bd2C9gB5cfzqotE0CWZAst0t0wCgwRAqD24Vu/vW81Bb9IrR7Z2L+KBNhRuKeg8h5ZrEdW6Kml6lFKA8Ns8gkZlUfKx5JXn+XaraJi2wrm6XpG8ax0+X4mZoyJZQMMHLcDjPYeVXnTDapqWhXvi3btcMzKolPKcf51idRvxPcubbxBBvLJuxvb3Y+ZrYaGYrMQXsUkDS3C+EqRZwnG5s+p4+2MUkwki5j08adFZlrgI1tAQ0bHgnH5vfmoOsX880tvCsBmjUCSRFXKybvyg+3v9Kp7nU7y3hsmuX3XdwNwZ8jEZY4BHv/TFDTdRS61G5uZvBgjSA/lcY4OQPuQOPam2TQ1rutTQG8jDM6FgrMGIBbHl7DJ/lWai1KaFXVON5+Z1JBx5j6GjupElSMAAPlixAIzz5+9MspQhWQq2M88ZBrNs0SDkd3JJC88jHpSDhSKINg8/pSvFYMCMD7ZIpFE6TTLkaet8UVYGOASwyT9O+KilXkZjsUF88DgfakNI78FsrndjyyaI87Se2aADc5OSS57bj3xRo/hgbXYDvgeVEE4+9EQAc0DNRoOvW108FlqaARxqFiKfKBj1x38611jZWty3ixh4yhJUZyH54Y+hrlsEkkMqywOVkByD6GtHHrF5YXcM4nWbxV4ikB+f1yTjAz2PNXFmckbe7Fwyq6yBJU5kYdmH/f3qhv4ZpiLtfHV4XBMcZ3q+OTtHkaOPVrdr6CWNplXYXa2VCc+oHuPv51bTyFPnjDqrAsHByDx/2PvVkFBekLN8fH+Rv9osjflHnn045qiv0aO6azVm8Fzh1H5XHcYz24xVgJUurWWQZIkbw2XP5Bztz+uDTt7pNs2mRfGuvxEeMyqxCr6Ajy4qWMgG68JXVNoWIHbGGI7H+dR9T1UJtVcLJnOQT347g03qVutndQXFreCQnhARjHHr9/Olma306xubd1ae5k4dpPIe3ekVQxDfJOZTJDE0mB86/KCB348z24q40HXLaa9Wynt4x/7KQ8ndjsazsAkM6Spbo4YBsMCRkLk/0qysdIngv7a8AAgZklEh5C7jwMfWkhs2gtY1lMoUBm7n1qNqVrPcRM1rMYZSNpI7sPrTsdw4kaGcKrAkqQchh/n7U8XABOc474rQzKbT7q5trkadckyTbdwl3Ha3PbJqP1NdTQ208b7cGMkbUJx9SeKtL1pZLZ2tlJmCkxHGCDj+Vc6vLi63vDJLIM8SKxPP1qZOioK3ZDUEfeg3vRggHtikt3xWJuGZMqqgKAvnjk0QDMcAZPpRAGj7c8fekApVQMDuLY5IAxipfwtsLcmOQSSP+VTywP8ATH1qCjESArknHl61Y6ZZRXd1FbpMEZxlmZc4Pt5VSJZZaDZi8lQS2kiJB/42/ufT3oVprO2S1t1hRt2By3qfWhXRGCo5pTtmkZwsZVu58yPOo0mHYlRkjnGKs5QpiZWA248zVHe6rDYoFxufHb0rnR0vRKdwGU7gFI7+lZXUZ/iLxsMSAxA9KVcanc3ACu+FHGF4qIPlbJPNaJUZtmn0/VLSL8PNYsXuEW6fULeSOMnlgoOT/OsdLuLlyeGJJ96n21pPfSPDawPNJkZVFzj61OXo/W9reJYNheSAwyfYc0oJ0Ob2Ucfys+PSiPKZPA8q0lt0TqN74jmP4Ig4CzHO4e2K02kdDWFj4dxODcyqAcSH5FP08/vV0RZzuDSr+cI8NnO6uQFbYcH71rdI/D0Z8bVCS57QI3A9yR3rWahfR6XEZJZreFV7b+OPQf8ASsXq3Xd1dRyQ2m2FSQDIo+cj79qqkhGhJ0To22O9trSHOF+Z2x5fSqptZt9Tunae7DWpwWikG1UXvzhgXP61jJ7lXA8OEBlO4yOxdnPvnipNlJcy3skqSBJWU8BPzcdgAKVjo32k9QW4uzYWcCC2jAO8EksD55JPYdz7VdvqNokixG5iDu+xUDZJb0wKyHRuh3dsk2pyfDyYjMaJI5O3n5s+lXlwsEGr/Gy2iRnIjE6pktuHn6Dnv3qkQy3kVZFZGAKtwVPINZrqWPUNNaG801WEUIwYIBx/xMPOtDkjtg+9VVpfBIGimmSOVHMZy3IbyB/lTEjC32oz3MeyYndIuWQjCg57/U+dQVuZEVlUKisfzBBn9fSnLrLTMywsmOCW7s3mfXk1KsNHe5jkaeSO38NPE2uCWI+grI1LfpvWtdmKRWsbTwoNrPcElUGfI+X0FdC0i4tNKc3TwGaWTBLHzP1rCaF1hDb+Fa3aLsxt8VFxtHlken0rVR3cEwWaGYOobBAPfj0q4kNl9qXUmoXkWzxWhiI/InH86o2JNFcXe5PlkGc89sU3DJ4kbMT+U7ScYxirJbCO0SgMBnvk+VNpdQTozpJmNVLMynnAqFcakZblYhNHbRZ/2jjPi+w596pte1eK2iltLGZxEG2zOi7QxPcggjNJsEjPaheG9aaeR0jQuQgwWOPYVEYxRkLAPFUHO9h+b7eX0oXk1ux3W2VXtgryT6nk0wzorIE3BQMnccjPtWTNUKuA7tly270PlRReG0oMhPCY+XzpbIWBCqS3cAUSSouQ8ZfzLH+EY8qQxe5o4QVDhlPfdn9PSrbpbw5tVVQ83jAFhzjcftVOCWxu+RGHn5mrPQ7Vn1GIo+1yoCscqODwecUmNGkvbDLWV/HcqiM3gOjt84YZIYjvwSRzVta/F3Wn6SVhinF1IscqsDwxIHPr5GqeWHVZby4W/j8OEssxdpQVRjyCee55rS6TYXFvZNp884ViY542wwELHBwcjj1rCejeGzoGhW92/Rk8Wnwx/FRyHDXChRMgPmfPHIyfpWKTx7SFbLUNNdIGkKKLdsJE7YJEbN28yUJx6Vq9dS5sZtL1a3ula2uANNvUf8jI2B4gB7YOD+vrUK96Z1W+huAJXurmJpUEbW/BC443ZAyQQVPtwaG9UVWxu5tfHh8Oa8Wd5LcQh7MlGkjAIxIue4zj3rnPRbXPT2qXVvewy7IXKsmOUcHBOPXGf0rpVhP/AKO31zDJbtbXpCNHvfxdkefmxlSWXHpz+lReurOC9La3BG0D3CgXIVVkiduMSK3f5h5jsRyOaSegkrLTxfGVNnzKyg53Zz9qZmlwrMFHPoOM1A6PnSV/ndfhkXcGT+MjOcY/rVpKgSE8YO4nHlzVp2Q9GT16SMdT2BuNOWS0WOSNkiGD+U5Yn/EM559Kb0+KIxpPHdRMWLAxnIZcefoc1I1/Xmn6ntIJ2SERQMxmUbfDzwGx2PHGD3zR2FnY6VYI9zHMCWZluLZgwZCBjKMcjGc8+XFNkpEyKZAV+Vg2MMT2+3/flS9QNrLpskIcfFeIvGfzR4IPH1xRQ3Nsk9uoaSe2AyuAF5I5z7H0zVVMxl1828ZQJHbncVPcluP6VJR0DoLWVfSIrGeTMsXiRgHuyArgj6bgKg/irpEF5ozTzX6WIChHZ1yJFB3BfY57VBsdM1iz1jTtQtI0mtGspklidsGNi3Devkv6Gth1DYWut6I9tfooikjw3P5T5MD9eRWq6Ezz3pE8FnZySXFy0Ya6jaFgm8h1JPK54BDd/aukanejUhLPEbi7guGT4aaUgG2YkFlJ9Pmx396znVXQU2i9NzyWzPJHFcs8pkT8o+UAqe/OR7fL61I6VupZYI7VJTD45ChO7eIvYEf1zUzFAtLKAvP8OcxyK2x95yoPqCOCP8qseo5lOoGZCJY5IlaNu204BbH0Oe9OXVqPimmkj2SSvuMGwp354BHrnGKu+otAttN023uYTJuEIRzjiTIH/f2rJmsSo0uwfWLm3gE6jCPGFZsApICGAPrjnHsKx4gk07VtG0zVLz4f4KeW1lMg3IgJypA/wkk5x5VpdPlW0uYrmMq6xklo3JAOByPuDVlqXRlr1X0zDeWyk3cEbxqjHBYg/KCfVQQAfMYFEWE17kzqmC9vdKikW4jh1eGIePbxnG5RyCPUA4+x9qqtP06yv4orKeCaO5YI4MhOAGU/Kwz/AIuM9+RzVh0ffS6n09JZ3lsbu/tSbUi4UkkYLAA9/Pt7GqeG1Gq3V3DqVyyyApvXxCOB3+/9DTY0rFXnSg0/978N4O8Mp+MdWiYgc4PBB9POq+z1y2WJLC8sbeFFLH4mIN4ind374P09O1Trj4GymuLG43TQCdkCZJYrzhxzt4P9aTrFlp80aro9vGse7b4x3bmcgfJzwPX3oUmtoHFNUxV/YrYzGIXlpcNwf3UoLYIyCV79iKin2qhlsZbe4hu7WIw3FpKCxKcqw/hKnuPY1e2urWmp3F0l1LDZKpLWs5h2JOB3RgCdriumGa9M5Z4a2gUKUVKkgjBHlRYrazCgsUVKxRGixBYoYoYoUWMIiixSqFIBNFRkGhg0AFQxR4oYoATQxR0CKAE4oUeKGKACosUrFCgBJGaGKPFCgAsUVKxQxQAnFDFKosUAIYU07kDgVIxSSueKAIDMx5zRI7ZqY0IweKbWDHlQAzIcio+Knm2zRfCCkBAJKng07G7etSTZijFqFHFACVkYGliQE80fhc0zKNpyKAFtgedR3ck4FILknuaMUDD3HHelBtw70hhSQ2KAFNw1DcBRqNwoFMigQGcYpIfmiZCDSMUqHY7vFHuyKZpQNA7FE0k5oZo8N6GgBJoBiKj3GpWttdxWjyDx5DgRjuB6n0FV56t0nE+2V3ki/gVQTJ7rzStBTLxWNKlnitYzLPKkUY7u7YArC6v167RvFYW0tu3/ALWTuB9PWs+J3v3ZdQuLkqV3YwXO7y48qTkUkbLVupb7WY57PpyBpVxsa6U4P/Lnj71QwdMX/iRJfx3C+IwEaRjegPm7nOAaootSvbJljt7udVRsg5KAHz4zVyOudTt4DEJllJcfPJGCxXHPbg8/0qLsumVWp266fdTx21wLlAdryeHtC4Pl9/SoJcyAljnJzVvcapLrUClyyvGGErkosb8cDGBgj71T4MbYIBI8ieKTGh2CYRBj4mwuNhxn5QfPip1qkctpcWssk11KF3W6RDKK3ctuPbt2qrlUKzYwBxjFKtru5tH3W88sQyC3huVzQMmO1zcaJCqRotrBKdxRcZY/xN6+lJ0/V7jS5leEsEOTJGHwH4Pen01veskUUJVXOFWZ9wUHvz5ke9RLi4WRTawFJfEcO8zLtLNj+QFAqNN0pq0UJAvZ598sm5ZQ42xvjGD68Y9q0Wt6Y2q6Z8FfTwxTk5jkI/iH8gCKw0F1d2ti1nHOkZ/N8hQhh5847/etBqGsWtx0nbLI87XO7ZE5OWDrzuJ8x5Vd6Ia3oz50U6ZIZbn4a8jC/lhnBwe3OPMelaW1mlsNNj1K30hFiVyIbdGySWwMk8+eawW4SGTPBYkkeprSWuuSydOPaw3UsTwDj5Py8gABvuTSTG0V/VHxralK99EwLndGxBwFx+UZHYc1WGci1SEE7S25h6ny/vUy/wBWv763SzvLhpxG5Id+W+x9KiXBh2bET95vzvHbbjGMfXNS+yorQiIlWBH2zzQklcsoY7mA2jPkBSELL780phuOaRQAoZs9iO9Bl5pSnYwbAbHkexoSOrnKxrGO+AT/AHoAT+VvtijfsBR5DHGMe9BwAQM5xQAvHJxSHXtR+XBoicjFACUbYwbng574q3hhTULiNbl5DkgygkA89tp8qpm7486Nd652kgnvQiWjXR6totnqSy21nNFco3hhXfManGM/U+tLXqGW1EljsZm5cIcEFT258setZoXMCW7wCBJC6ghiTlW9v+/KndNg+PjaJGiFxCNwZ+2B/WqTFReXEqwRSXuBFA67mjABZZPUDy9fvUdN8rXdnO7yRzR+JHu8wf68Y/SkaJNKJJ7e4WMiPLsxG7aOxXt25qXqUiwNbqFKiNsqV5BQDkZ/XiqJ96MqYJvHW23fOGwAxxg+lXdpb/FzyQ3I2yk+GQPmAGcAgj9Oai6rbyz3BuY0XEg8VQDkt6mm55Uhu5VhLxEgZEZ/N6/XPH6VJVl7baO1hHqDQyq0mxo1Uru2j/d9Kk6ZZWup6MICsyg9wWwUI9KJHneyWeGGZxcbULZ+YL/iFW9tCYAiBVChO54Jb3q0iGxmJY2hCQBwME/Op4x65p9RsA7bvMjzpUhdFBTawzkhj/SiAyoOMZHb0qiSJqETGE4mlCqCx2dzjn9K5rfXj6jdSXL8M2Bx7DFbHq7W306NLW3wJZwdzEZwvb9axscUbgKZBETyNwJB/SsZu9GuNasYfgClNyDT8dukwffNHEVGVV85c+lImjMMjISpwcZU5BqDSxofl7nPpQcLwFJPHP1pSxO5wqsxzj5R/Kr7SOlGvES5uZPDhYblVPzMP7U4xbFKSWyrs1t5onj8MrNjPjE/Io9CP71Z6ZbC2R2gd0VJRJ47KQFULyfvntWrt9NtLWJoooEjRl2naOSPc1HluIdPnt7NIJ2DDG8fkT0ye1bLHRi8lj8FzDJbLcghImGct8v9aFV2taxb2cgtrqJZVZCWXbwPQE0KrkkQoNmmXXLhWjlttPnuYEUkv4ZwccAjiqp9J1zWpHuF065YOSwLjBOfUnvXXF+QYXCgdgvApJPlmhY6Kc7OX2PQWs3RXx447VD3MjZP6CtLp3QOm2Mqy3DveOB+WThM/Qd61BxSTyapRRNlDpkUcHUGqRxxxoBHHjaoHHPFXJUsOBUTR9KurvWdavIo1MNtFH4pLcjPYgedTk4BJKgDnPpUw6KmRL28tdNhea7mEaIAWwuSM9qyup9YS3jJb6Sd7uSCsY3SgD2xgfrR9T6xoU7G4kmubzwjtW1XcIWf3P8A1quY3kWmrqjeFp0E4JEVmu2aX/D35C/ShsSRSa/puoWxa71NLhWmk+TxXVifY4PH6VDR5p4Phre1TDNk+GmWY/XuPpTfjSSSmR3eVsfMzknPsa13Slhcu0eoNaq8LKxWTIGP+Xz9B9zSqyjGGNo5NsispU/MpGCDWs6TSyueoI/AhmYiE7m3fKjY/MMf0NVnUt5YXEnxEEciXcjt43zgrn2x2/XmrfpzUrDTLeK4EUlq7qVcscCV8cEc9h70qA0UMC6HYJBqN18aXlALmMLtz5sfP6mpt3PcrKixx98naezcevlWBPUcstxLNLHHKWOPmJCkZ54zkcY9uKv36viWNNiEh1BODkJ6/MM/zAqkyWiZqWuyadYvPLavFKD8qSkYYeZyueKhveyavFFFDp4W7k+eYSjesScZBPv/AIeKhQWnx7u1zPsQD5N8xaRie4yO64PlVnoN7Y6az6cqiOFD4nxDH5ZO38R7ny+1OxJEd+hEuppbmWXwMgCOKIcIAO5J/XFQIraxfTbq3sZRPOH4mZimOeMt681I6u1kXEgtorpjCU3YiO3cfr/nWe0G6uLe6NugVoXPMbZKscHvjyxUurK3RKtOmdRupoo5USBU/jBBL+ZPvWsN0bOJ4pPESMD5XEbPs8st/kKg2ayNaTwx2s1wFYYVlKZB7kN3FVmoXH7CeGWznKhVLmGeR2BJ8h/nVIT2W07XZiMwtg1khG5UJ3uO+4Ajt2qHqGqvqs6pC0qWmQF8Mj5288juR/lTC69Lf2klzcK9tGYzEAj55Pt5+3n3pGl3C9Pad8fMsHiHJgj7SScYJobFRL6g1J7C4S0+LljuHjBkK/lA8go4wT61kLq4nu3RpAzRp8rbONzf0zU3Vr9NSvG1GSNWZ2BWIyHkAeYA4/Wi026t5LVraa++CLHj0Y+WRjGPrUN2WkRPgxFKnhwLceKA6RCQFj9dvnRwG2R3iu9PmTOQxEhDAj1BwKXLBEsxivd/ixsWKxMOc+a8ffFOXOpPjwUuWugRgfFxqSR5cgn+dIoRdzWUiYjREI5HLHI9znFQniCRqwuIiJBgxKTuGO3lT6zgE7YGQlT+QggfrnP0qPKqON4m3u3ZQp/rxSYIEoC4b5gwGQpHarKfM+kwFzKJowVfcvCgNkYPuD/Kqt4ZGRtq8geZxke1StDvmtZykq+JFMNjKScj/eXHmP50hltplhDD40cMwuEuFGTjkMvPb64x9a6bpmuzy6dYnUEi/cJ8H8RuG5ivIV1JyOOxwK51NpkumvPIkjGJJIZImVSodWwM/wAu3ka0JhV1Mb3XjOY0dfEJLkLgH5vPGfXtWMzaDo6HMqr09caZOpKSgSxhhvKZYhnIGDtwffGKR+2L1dLtrv8AaczWiKI5MvjY8bANGTjO44BBPkaq4mZtMhl3B38ICQjuCO+T3FM22tiDQr61lcCL5PiQ0YfxULKu5cc7gDj7Cs0asvdUnivY0n+C+CuLtvFtLr4nIJ7bFJ4GPTI+lVMdnL4WpWzgmJY0uHRCVVZlA5xnvwe31FQ9C6kv4LWfQJ71Ghtifh3aFZCIiCUI4z7VYaTft+y7mxu5Io4nQbJSBvyrZK/fI96bBDGiRwQ/EzyW5aN4pArI43IfM54yMZqxW/8AE0+CUgbyoBBIKny4qJNNbLIEt3kjthH8pL5JB75x+mDUnR47K+XwXbwSFJE8n5T64AHPNEW7FKNoyHWWm3FvrsFzMoS3lt0IOeDuP9M8fWrjomOx1G0uVv2eFbA4kjhXc7ISfm59OM+3lTGu6W8Gq+C80c0LW6yLtbIXdnP9M1E6XsoV6oaO7keO0uVXxHXujn5f5nFamXuaK/j0yIwx6TPcTwxxgbpVxjkn+9M6fpETape6neeLDYiCMGVE3FmDflz9Dk1a6z08NFswYrlnty5WRJFMTscZHGSCPp61V3yPd6DPp0kpjiuJEZCknzB1IyuPIlScZ71K7KJskWq63qpSZLq20u42MCjgCOJR3BHfPH6mttdafbanpdxYl3eCSLwyAQcAjggnzHB+1c3g6tnltZNGsreUFLYxKpB3o6EYA9OB6dya0I1efp3olb28kN94xUwBcNkOMkMw8s7hWiJDuNKWLovVVvLy51C7SFhk/vGixjO0enY+uKo7zXVn0awlsIUWRYVlkuCqvMrcZUuRnsQR/wBKi9G6k2oXmoNb3DxpJFNtV5trF9rY4PB4OOfIVR2oiTT5rUF0bcjnaxxIoyCpHtkH7Gpkxo3thr7atFA17K731qyyRNgfvlH8H1xnHvxXQX1Ky1PTmYt+6dcqrfxqe3H14rkOlBIoYZ97SBCN6hOQM43A57jitddzpptrBfbDJbnKFM7tjH8ykY/Kc5FRZa2J1XQ4ZIhcwGOIyJkBF+WQDuW/wnuMe1QNOv8AU9N0yX4M4ktnN2AeRJGRh1Pl5Ag+xqZpeuxETRSht5Y4z/EnmufUYBHvn1qx6aNkbmMMomgZ2iDLkEBs4BHpnP60l2U9kF9KivopNd0+WRxeRql2iqo2SK35iuRk+WB9RVda6ZZeJdW9zKXuLfciuOCzDkcHnkcYqzvt+nalJpN0Z0gZy8kj4WOUYGJTgDyG04qJqlvbadAt1CJXvoJEBmIO2ZSOHAPcGiQIWNNSfRIJHniZoxiFWOGXnDKT37Y7+earEuLCwdYriyjmiZmWUNkkcFcEefqPMVor24g1H4pLC4UPPsmYLjbuK8hvTkis1eGS53XFxJC8gKEqBk9sZz68cj6GpbGJ1fSLOxgku/i5p4M4WRG3tGNvAkz9cY78H0qiltIrmzCLFlM4Lr3DYPNWlu1zPPcYlRS5LMH4VweDn9amXGmCyg3RldnC7wwKyEDk5+tS37jRU6M8j6bCJmLyR5jZu+4g4z+mKm4pOi31taW93b6h4aoxLKpJ3JJ2BXHHPGc8U+0H7hLmKaGeB8gPE4bBHkR3B+td2LIpKjhy43F2NGixSjRVqYiaGKM0VABYoUdCgAqFGaKgAsUDR0KAE4oUqhgUAIoUvFERQAmhilURFABYotvvSqKiwCxQo6GKLATihilUKLATRYo80W4eopAHjNNmRQcYOaNmwRikhO5oGF46g9iKL4lM45puRQDTbHHFAEsOG7GjqIjkHg0v4gqwyODwaAJB7U1KoIpxGDjNGQPSgZXyRHOcU3tbPFWLoCDTSwe1ADAiOKS0Z9Km7OMUXhCgCIgIIGKf2gCnPCGc4FHtAoFQz4YY9qJoVUZbAHqeBTWp6nb6XAHldA8h2xqzY3H6+QrM3XU3iXRtLkxNKuRtRidvHlgY7c5xSbGkXsl9FHdCKSJ0ifhJ8gqx8x3yKg3XU2j2zSI12GaMElUBJIH0qouZbFLRrPT1kvjJ80sTOVYDzIY4A+mOay15pVxp87xXEUwYHegQALsx5sOD9B51DkWom0fq+xn0+ZrOVFuo1VyjKXIU+YHnj+VUOo61e2FxFLPNJcySAbpbeXC7R5Lx8reZzmskrMJAkLNjd8oBoYdRk7sEkZ8s1PIpRLDUtYutUuBNdShtuQgAA2j04qEneMRq6yZ8uc+mBSorK4uY2kjjbwlO1pTwin0J7Cp+iwtFcrduyxJEfkmeMld+eAPf0zSK6L9uhbhSl5Jfxxgxh8yKFMTeWR2wKgX0FhpOoFdMvzKlxEYpJc5Ab0yPXvT2o9WXtxJslCRsrMil4wY5fJlJHlx9jVRd9O3VpZi/iaJ7J8OGR8leOxXvkU2SiuldyFiftFlQPTmmgwZCHZ/lGEA559PbzqULMzxeItzG8zE5jclWPuCeG/rTUUcKTFbwyxIDhtqfMD9DUlAtbuW08TwSFLqULEAnae4Ge2abZ2dFVmJCDC89hRHG4gHjPFKWNpSERSWJwoA7k+VADeSR2oY9eKt9Z0+w0lVt1uJLi9AHi7cCOI+YHqar7dY5Jwsj4UkDHrmigsX+zrtYIrxYC8UjlU2jdkjuMCo+8JK0jxDk8qARj6Vu7bqc6NeCzuLWJiu1QYGVht8skeYFV3VNxp85tGlhc7JGLNG6EyA8kZU8e1XSJt3szax2zktFK5iGC6thGH/D3zUvTZUvyba7nlC7CkW1AzBvLHpUiC00iR1ihtprxSu5pNxjMY3c5GDkgfamtR6evNLuZJREy22cxTj5kI8uamhtlUF+Y4zgDHbtVpJay2WjI3jODLLmaAodvH5efXvxR3+nTabb+MnxMVtcgcMuFlPcEe315qHPqVzPbpbSyfuk+YIBgZPmfU/WgER5Dvk3gAA+Q8qIjLE9uKPOKVDctAzSRkqSpXPoD3pDGlGOPvSqCgtuYYwPLt+lL2j17c0DEjmhighHJo29qACA+YhsDgnJOKShB5/rSju5Hr7UlRg80AOAZNIII5FOKMAmkM2M+VADZVVORR7+cj6UZQlc5GKQU9TQAh2A7ZBHoacXfBGkyyBN+VIU849/ag0jeGIQQV74IpdtPJasWRY2YgrlxkfzoEW/TV9FaXMqyFvnjwwCg7uf78UWoXNyyrbKW/cy4U7T8m4cCmNLguwkcykFVJ2RqMyN6kY5wKlG+nsbe6sfAO64lw7MOQccY96sl9lxDZyJaCKRFuI4o98Ww/MAe4+oIquWJdXuLYFApiBGUXBHmqk9uf609BdXl49u9qu25VWiuMjPiFMH9SP1qNbK+nX1wYZ5FikYEnaRuHfj3Xvj0zQI1OmIUgjAkmG0Y8OTBxSTc/O0NwmCxyCy4+gpqXVLNY9kiv8AL5N5n1H9aal1hbeONhEJYDnJDbmWrIJUDTSXLqUAi/hIOSp9KekVo/yYJ44NRfiHgtiGjMgABjPqD70iwv0vYjLGxwoOQ3cEZoAxHVN6LvWZmjclIwIx9u/86r4ori9+WP5/CXO0kDjPlnvTczb5Wc5yWJP1pLR4PIHPPBzXOzddCzDJIzqVIdeCpHJ+1XenWF7eWUdrKgFvKx2M0Z3RkDOQfSqm3mlsnWZUPiRsCrMuRmpuo67ez3cc6XE2I9rbCSoDY54q40tsTTekbWysYLCARQoqjO4nvzUgAAAAAAeQrM2vWIkngjljQAr+8djtG70FIterp3kkMtuSoOF2jC/c+X1rZTic7xyZopZTDHcPOoEKLuByDuGMms4/VcsiyXJsSbXIVMtyDTWt9ULdWptYYoyHX5mJLY9u1UXxObZYCAEDlsr3zUTn8GkMfyTLiSTWLiN/FDNJnBZcAYGSM88ChUe1uJC5di2dhxjGSAMHHkKFZmqPTWcUhiKNvMU2wIUnsB5muo5g80WaY8QjJ447nIpasTkcbvIGiwI2jazd2Wva1YAQtDeWse44O4YPGP1qq6kurw3EUdtdrbJH88p8kHbLHsPYYzmlCaODqe6E5OWtgCyHAUZ5P6VE1TVoYNPuV0+RAoXxGk4Y7ieFAPngZ9sVnH3LluhjUtHj1S6spcXU1s4yZCwVScd8Hhf0yazHUeql9Qa205/kj43REsznHOW7n7cVb6jrTaX0/aWxke8a9SRnM4IYKeAf1pHS+j3OnyxXDW7meZf3ZL+H4Y8zgjkUCHukelGVWudRR0WRQFiBILg4PPt5YNXFxpsNhdCSNnWNpAY4FACmTHHA/hAz/Opc13+68C3mQNNkJKOcADlgPP74FVF5eXtjZQSQSQXN1O4itPHQI5U9228YqhEPWLXTeoHltLbeLm0DM9wkWEGP4T9ewqjuLSWT4c+FI9iRtii8UbgSO2Dz39q0Z0640Tphre5uI4nu5dskipkIzHkk+nlWZu7J7a0TVJrzxrsztE3zZI2cDB86ljQwbfUdck8SK3E0kaiNlSIIigeWew+9SrfpXXRJhbR4277lcAD75qdaaxrF2yJYWkFvDbnMjpGAhG3neD34Gf6Vbw9cR30REcKRJFHulkJ2ox9FzzS0PZTaq950nZ29tH8M804bxl4YK2OwHf7+9UE13NdonjT5Eagxp/CPbHlVpOtxr2qS3ZhtgqjcZpm2oEz3PqcYqZpnSkd5Obu83Q2MkhWKNFO6Xk4x6LjnPpRQWN6JobR2o1W/KSQKC8aSMQpYeZ9fpUK3tppN9z4VvKkZK/m2hyCTgepxV31TqbXKWllbAhVYOiouQqgfKM+pHJqgu9UA04wFDHIGPzxnBJ89w8/SgB8dZXENqYLeNFVey7cBefMVDtLu/vZpZri2W4ibmQyoSsY82HoadstOXW9pjWWJlX97O2ArN6YHb0zU7VILfSNHNmjyvJPhtytlVXP5f1p7Fob0+5sbqCS1uRhfG8RTuC4UDtt/l6VWajdw3k6mJVghjXYiDLbRTE16Ph0Ekak5OCDjcPQ49DTZy53lQm7kDyqC6JC21rt3m4H/AAlSD9uCP51HbwopFy6Op+bhQ5HsQakW4ZkKIY8d2EsgCn7H/OrjR9EuL+VmiS0XAP5QSF98g8ffNNCeiCbJ5bXdb2J8AfmaZSrRn1U5xj0pNmlltaB7RMyrnfLITsIHkV8jWwtrXX4gtldypDb7WKyxSDAPkDnk1VPpUAu9l2LC3ic7jcRzsT7D0P1quJNlLLa2tqqsuoSiVsM6bTsPpgj+9M3ErqPCknkjz2EiYPtz6enGeana3pt3p7CGWcNEw3oQSFxn+4qidhHvRZAQD8zbc1DKQMP+9lEhcRjkc+fFTorNG05LzxSlwkoYJtwCnbg575pm0UXKtaEIrS/lkbsoHJ/tVpDAk2ho1tcQGWOPLwscM3POB51LZaRd6bIbm5uLMLKY5pRIEkfdtAxxnGMZH9KuvgxDeW3yuALeUgAd+VB/rUSzjAnsWZCizxl9p8htz/lVklyouYbt1fYIpkxg4aRCGwPXIB7VjI3iW2kzKxmhYhSVDDcwyPI/esf1ZqTJplwbaRljnkMIwcKfmDZx9q0dsUbUXZo3+aJpMr3+YDH6c1Ua9p8GiWEcV/pxuNN1CV3juOS8JA/h2nvk9jUx7HL8pI0FDqWlWWsSzlp0ja1fawBKjBU47nzzmre0ma2njkEjyKCf3TD5TkeYqB0qkunW37BLTFuZo98QCSRvjGeTz27duan3dhPpl68EzS28iMULRc8jgj/5qUuwj8lpLaWk7SNabIsIGePnaSO5U/2NIFw9vPE0sTm2t02sseBwfP6frVf0leWpuGh1hZ1dGcO0LgvgklDg9+BzW7m6c0vULPxbLVC7267ZtsZyATxle44Pl6UuLLTQ1c9K2/UXT0GoWTIbu2V1UEY3p32NjswHY1i9NsbS4sLn4qCRLuCTczoCWjXnDqRx8pGCp7jkEYrpun6bJ0pYfEx3AmiJ/wBYAyQw5wR6ceVYHXZLW31qe50UzJvDBg5IO4kHjnt/ma3WkZS7GXu9Q1Pcbm7muIlC53NlAcbcgeXr96kaxoN0lhpdxDHG0O83Ep8TBIRzjPPPH6VS/GFFLnEb7RJKirk47dvrVvq2tPadNwMg3mIzRR553ZG7GPMe1SuxexjYtbn067ih05lgeHcJZ1wXlJOe/PHPat608GsdA3V0Lea4I2LLb7+A6jGRjsCOeOxrmyC3uJ3ulHhjLHwsEnB7YPt7+VaTpqxme11R2nSGI2xdGLkFHGGVseY9+1W2JFX0uRHcI6qH3SEBSf4WGMc/U1OntZ9Od4p4CsyAZRuKqxdQJeXF5ZwyC1LFirICVbHPy+hJPFWsGoHU9JthkStENiSefh44X7eX1qGNFnZavPGWt7fTo7xXjYspQlkGB84x6e2Ks7DWpYLOSCdPFhkUHa67sEdjz5Vl5rm6sbZHs5ZYZEKvmJip478/TNXNhb3zo1xcxBIzxvdsDOM7j/fy5qXsqJaeHvkkXbvtyobxU5Me7tuPseOan6LeSaLeTsmx4tqyhEPdgeSPqKpnMrWjMxImjfdnbt3Ifpx3qZYzwsy+MP3TYDsg+ZRny/78qi9mtHTNUu7aXTVuiBJbzAcEZzny/Wufafr/AMXY6jb3NvDGLJx4KxBijRk7gCSe47496vbCdm0C9s7efxLi0YXMWH4lQEHGT2yO/wBa57qNxN051PHrOns8mm3Nu5nABKcEgjGCDyQR9a2/MjJ2maibSZbDUxew2whs5UVtnlFn19R/Yiqy/gM+pyyQIYfiWAMJfhWz5+3fBq0TxpbO2nklV4FIjYM2ArAEpn/dIGCPao12Fkh8SONldXyh5JQFj8h8sg9vrWLNTO3d3b2t3Haylg75Kttyp+9W9pOkCm1nSQwyyLl1wQgPkCRxmla1pUd2rXdqixBMq6o2Qcjkj29hSLLUTJpq6e0EUu+QFJMYdSOAM+dIAr3p2aJgI4nuFnTdlFyuOcHPr61n/g30+4tbqPw5SFWUMFJR853I3b3GM+WRWy1rUpNGvIbOwkkVoJNkrs2RI5XBAHbHFZ+7u/Hu/CRHYTyBJAcARt5Edhgk/wA6addCcbJji3mQXFlN41uxxkjDRt/hYeR/rTWKYka50qR1t8oJF2S5fCu2fPP9KOwvY9TjkkgQo0X+2hP5oic9/Ucd67MWXkqZxZcXHaHsUCKOks6qMmtjIFFTLXHoKLbI4yWI9qLEP5HrRFwPOmOVHc5pDMSMsKLAlBlPmKPFRF45HNL+IKdxxRY6H8UMU0blDjFJFwwPcEUWFD9CmRcgjtQM+BmgB6hTQuFI5ozOvkaQCyKSeKbNx5gcUk3AYHigA5ZynamluiD8x4pmeUHimWbIzQBZfER/4qUJEP8AEKqwQRR+KMcZoCyyBVuxFMyOFJzzUOOVl8zzSjK0nBoAkCVcdsUDIDjBqMFYnvSvBYdjn1oAU5PJpg7s9jTvCgZNGCGYAdqAGcsPI0Rc+eamLCG8qBtQaBkeO5dDg1JSfd5U09oW5o44ypxQBI3DFGCKQTxQU45oAXij7DNFvVVLsQqjkk1m73rSzNwbOwlV5c7WlI+VD/8APxSbCjRSSJEpeR1jUdyxAqm1HquytRLHbEXlxGASsbDaue25uwqvisGkdbq9uZbuaRCpUr+7HnwPKsFfzyaDqtzbQPKsG7mMEAsDzg5Bz3qXIpIl9Q9S39/fxvKVt5Eyir3RAf4s+f1pD217Op/ZoubiRImEksTAh488YxyTnyPlxS7PUtFuLWaK5tL67k25BLZ2DHJH0qiDTxziOF2hLN8qbiuQfMnPFQWSbW8k02TE1u3iRfljfjBx3ZT3HOeavm0266mgSRZoRMw3CKOQFcAYwVHO6q2CK+s7C4kkmyJGRJ2YbmVQcgqfMeuOKuo9UZLOSSzjW1d4Q4mCqiMQfn249Rk49aAZR3XTWoWvhSNA00cvyK0I3bW9CMZ/WrXpnpW8vWKaklxFp0bnMRyN8nbgdx7mrPp/Ub+a7EEUmBEpaWe4c/JH6kZwx59OKvm6jtIZIYobmO8QnM0qvuKAjg488/oKaSJtlVfaFpF6sdppxjguMmJUZjswpy7EYwzY9apoNFgstQkGpavHNB4gSWJCWZeflPsRxzUbUtVvb/ULuC0Rd6ysViQ7ncEYwCvcY781TT7r2FxsS3uY8lo+VyB5YP8AF/YUWOmWd9psHxkka3trKl0xlguI2KIr55U+maZtNQuImezUxrcGTEivxvx3wfU/1qreSV7WNGJMaNtX5j374x/emZXLPuYlmIIYnnJqbGkah9Q1S/sIrCUtJdl9iFoPnC5wQ3HPrmnr/UtThMttqWhR3UscXhieSNhujHBPH696q4eqdYEAS2vpwyYG0tux5cZHb70q/wBVma6m+MvdQuF8P5EdTGGb+IEeQznt3qrCiv09LISG6vYy9urY8GN8MSe3fy7/AKVfa+UaytDZvHNHdKViiaBUMWO7DB/n7VHktpdf0+KSzhXZEyRSsq7I0z5Aei+Z881OtdStNMguY5bGC6v2JRNx3BgMjIABwpGD75ooRm7Sy3vJcsAbSL87ucBj5AepJqxGqaXY2MUENjaXcu0q75cMWb0bHYDH3pvWNWS7uI4pYiIo1CsEjEZ/3go7AZ8+9VMwQuWiQIhJ2JnJAqWUtiPDlilKPGUK/wAIOcUNxWFkVVCsQd2OQceRq26esrF542v1dvGfw4IlJAkbzBxyBkir5ujrO48WNLqG1uixaGNJC8W3OP8ApRxE5JGOtY57iWO1tmbfMfDCBsBs+Vabp6z1PVb6GxmkuYrG2PiNGWOAVOMenerTS9D03T9Rf9oanb3N9AFKxsNqq2OG98UjqDX77ToovhtRsCZX3P8ADpkA+fPOe4zVpUJuw+qby4ur0aHd2kCxzMGtZyxHsMgfcfesbq+nHS9QazlmjPIy6g4XPlzycVbdS63HJqVrfWl7FeOkW1sx8BgT3B+1QNY1L9sPb3MjDxRH84VcANngZpN2NKiJcW4iZzHIs0SnaJVBAbjPY81GbgYqRLc+JbpBtAEWdrDjv3z600Qu9dx2jPJPOBUFEie0e2SF3x+9QPwwPfywKjkc0uYIFiCSK3y5ICkbTSWfKBdoyGzu8/p9KAED5SaPvRlS5Cjgn3pKkANkE+ntQMMtk0GVlVZGUhTwDjvQiZQ435K+YBwT7UbfMXZNihsjb7UABWoHGeaQM/ajNABg02TyRSgeOfKkHB5oANXYBlGMNg9uaNl2jLOu7zUHJH1qVNeW50uK0ig8OYMWklwMyD0+1RNqbE2OzSHO5NuAPTmgC/0W7gs9OkkZr1LlhsjMbHwwPViO3JoormWysJVfw2IYqWJJ8UgjB9iMduMimbTVtR0OGWzggh5X9620MTnsc/epujWFtrRKGWWKEFTMzMAZXx5DsORVohkzRmjttULQRu1rcfONoz4bY5B9O/8ASiv0WWCRdPgN54M3jKP8Ocgp/X7VDv8AUrNJpXhVy6fuxNG2EYD8pPrxkfatZp0UMUAlggjiEoDnb55FNIhspodHvLqCIXCxxxPg+EGYNHjy5/T9KW2h3Cq8IlBgclsA4ZP93tyKvZNxU7eD5VUX0eqW0iy2RFwHIEkTcYHtzToVjelaYEt9lzKJnRiMK2Rt8gRU8W0aRSLEiqzg9hjJxS4II4tzKgVm/NTGrajFpNk9267scKn+I+VMRy50IZgwwQSD9aTyOe9OyyeJJIzKAWYtgdh9KZDFG3A1zs6R25dnIkabfv5K+hpnllyTzQLHBAxjOe1JLGgEGAzcbdwGM4pwcmTa3hJk/KSSPpTRIIBDNu8x5CpswWKxt0faZXYybR/hPbP86EDIYU7S23K04yxvGpR3MgHzK2AB6Ypt12nGCDRI2DjuKAHUWIQSl8+NwEGOMedCmiM5P8qFFgd9i6+hlfaNK1DvgkxnGPXtUa8v7bql7mxtpLpW8MmFkkIEhAyVKn6AVsyyklQV3eag8gfSoyQW08viGEZVsh2jwQR7muqmcxy1LvUNMn8aSC1keVfDeFkG4Ed8r5H/AHjWi0LVb64kxJcraQjGFmDPIV/3R3x7mtclpbSSvcy2EaSgj944UsQOxyKRMbe6R1BClgNzhRnA9T6UkgsyE0MGu63eLOxgjigBaaSNhjBAJUe/vUiO26c0kJ4104WBgUWQtu3t5sMc5GBjyFWF9ZXcU8eo222SK5ikt4wZvzGMoWPfv83GeDVbc2tprkl4kunbZEdUNzAPEP8AynOCQP6dqmPbLl0hn9k6e4m1S9Z7yWFsJA35AP4UAHc9uKv4pBBtL2EsskiEySKAqj/dyTVHFpMWlxBrLUXhFqx2LeqAu7gsPUfaqy41fV9U1GO0dVlNuzMj2u4RSNjgt649Kok0sWrG0una9TT7WNVA3mUl0HkvI5OOeKVFf6Xe35kJgublANojUP4a5/xY7n0FZCXTdd1izeP4HwYYZQxhcDxXbzbJ5Iz/AFrWxCPQtMtRDaK8xIDpEoZifPcfLnufKmhDHU+nXN1cLFbsJDdQvGIpWwgxyNo/xe5qqvel9L0LQXm1PdcXmNw2yEbWPYAelS7nXrvRtZ8MxPfS3K52tLhUOeyjyHH8s1jtc1a81S6mll/2Tt+ZVO047DPnUsaId3qMtxK7IXLOPmLHJPtx5Vf9KdJfGOs2oCSCEMditkM5HPHt/Wn+nuiImSO91iTZHIAY4OQzfWtNPq0hvxp+kWSXE8ShXmZv3cS9/wBaEhsqNV+Hg1BLi4Ec62o2W9jHnBOflLD1/rVnbwvHC1xqV2Y7m/BDnO1YIwMlVHYHHnUTU7F9OjuLky/Ha1MpIwMrAnmQPLjzNZSWYXUIWW7uGK4Tay/Ko4OFGf8A58UMBXUV/He6i8lkzxwxARRAZU4Axn71XafYyaxqEdkp3K7bnJ/gUdzmiffMypEu6RyFCqDk/wDWrv4N+n7Ke3aPN/dxHc4bHhr/AIf8zSGyTqWoW4kg0XSYwYj+YoD8x8s4/rU7qWztLnSFugxZbXKkQgEE+YP3qt6UsLeQwrAX8d3Bdpo85Uf4R5D1JrW6npEcmjTadbxRhiNyjyBz5HnFUlaIZyi50ueIRzSMixSpvDodwX2OOx9qfgEstvulKEE7RuIHHnk+VW1/01dWbShWECkcJuwHI7gE9/OqUW7GXw1haZycBVPc/UVm1RpdouIbXRApk+MnztJEYQFTgdiT7+1a/pvUNBnSHT0mSx3YBkkAIJx5tnn/AK1zpIpIiFKurMcAZIX6GtVJfQWsltNooSD4Bd0wlVXjZ/M7M8jHHammKi/sNOXUdY+Fl6i09bhJtqwO/LJ5g5HPHpT+sdJSro11Ho8tvfJpsmZYzG671OclTnkDH0qjvOuGvreMX1lYJJGF2PBavGYwP4cg55Hn5VpemvxP0uO4jWaFRsKx27JgbEJ+beWb6575zVWHExsjQalZKLu0vobwAhGTb4Ug5JIz/Y1QLpkk1pcSRzeLFbRmQf7pJxgjt+ma6zrHVfTjM1jP09aPp/jbC6Tsiqz/AMYIAAB9eD6is/fdNXlit1J0+EtJZR4sUXxyEyDG1o0DDLkd+/ccVm2UonPrdsyI7q0Z3Ft4XjOBj7f51I0PT5DrYtt2WXcFKAnxODgD61Yala6v4ZuZtPkVLqJZt0MJCO6jBOBxnj5h7E1MhaNNc01DEnhzhTvIOJMA9sdjzjjyIqWWi4llljt4nk8W3eKAjByGiAYd/t61b2zzysJbyZpZQcsgk524yMDHbv2qHdX7XN6kE1rbzK++2YtuLBMZznPl5Va6XYxzTNKD88Z2IG7KAuKwk6Vm0FboZkuFg1G6niTwWS2V0jZsg8njB5xzWlkgsep+mZdGvXjtJIV+Js5hnMb+efY5xVJqUaSROqwxifw1Cy4yeD5n04qVeX0+mxXM1sVLFGCiMAsxYAcZHby+9RGezWcNUMaNrFhdwKyQNb3qoYWM3zQsynBwO65wDQ1a/fU5nmuLgiV9sYkcYJIAwxH2rMdSXVslst9YXbxyQzh7q22MPD3ZDYfsVz5dx51IglZ7h3uC5UxqwJ53nnGP1FaNGSfsN6bqt/4UuojfaSQMyJKRlVkXtnjzJ4zWo0Pr2xuNGN3rVnHZzx83Zs1aF9xPDsc5xn2Ix+lVGYvhLyBkyrASbMZyfP61Fe/t7q0ghZnaCcG18Rj+YlfynzB4496mx0dX0q78K3XZqKXsVzEfCgEoYlTgD5l/hPqcY/lWU1uOeKMzRoZ4rYCIlAQw55L5HPbv2rn/AEzqC6U62U63zG3d4VmVj+67FdwHdGUn6EV0npzqeVdVinu1R0lxDJj+NM9yCOeD6c1XTFdoz/wgKuUQ+JKBGMdxjPH86h9TPOvwGnpO0f5nBXykI+UeuTjitprdhZnW5rrSLxTDCgmltfRScbwDyuO58q5l1bdxtrhzO8S+Cu+RcMe+VI9MZ8vSqRD0h3SrVmWad/C32yljEzYY/Ng8eeMc+lSptVu0Mtx4hMjx/DtHjhoyQNuPbyp2WE2V9DqUF7EHm/2zbslHP5jjnchJJBHkcHkVN1Gw0/UdOWOycC+SdVmaLPgGMn85J/Ljt6ciqYistIvBjZgy/vN2QR2IP6dqRpIW3a9s8EpE3iR8fwMMj9DkVKvNNk0sPDMUkUfMssL70dcjJU9u2f0p6yt7Wx12OKe5320gKrcIO654bn0zyPrUsaBvaVQASodDhvQj1qR09eJbSzWbvMip8uI2BOG8wD3GDj9DUhtIvIbloY/DmaNn/JIpBAzuxzzwc1DutCntEfUnnhgMCxl1Z/zqchSCM/8AYqSl2bGxjzd+BNIVtHbwg4/K+SCCfbzx7mo6pKm1WW28LLqJYQR+VjkkH+3lio8N49zZ26mFYzEoDMv/AImOc/zqdp8bzwyxReGzlhJGC20qfPGeMHtjv2rNmyJvSa51kQth1lBQgNj5T3IPpjPFN2lppy6bY9OaqAsLT3FioL55BJwfqOc00rPpd8yCNlkjcY4wyVF6s0PV2juZ1gikeSVLq3ZP4tpwfPuQR274NaY37EZF7j2kxLb2fwMtwTIXe0uE4yHRiEbHoRj9astPuro28tqlsJ54SEnjcfNLGuQCPUr559AfrRzmyBW4sjl7lvGuck5STsQPuD+lXFrb3GnajHPbneSgkSUZ2gn1PoTxz61D7oqO0W2nWb6ZNa2l4qLH4+7dKO4ZeP5gg1kdTMFpcyz2kckbRzviIZ+TB8j+tbyK4s+o4Pn3+M6hZIFcK0e08lD7enuao9SsLHTb+aeCV5AMCaEtl1PYMPRvrVSWgMmXjXDPK6xSMFDE5OT2PvzTsIa0umhvFimsHhKHC5IyfzL5ZPv2opbZtV1RUjLBWcqIoVyS2MpgfatAvS+HdFnIeKNW8OUZw+3JQeXHp71mkNmc1CGxjtv3CvK64DpIuBtPYjnkY7+hrM69qE8DJdWcscMiLsxHHsbHlvPZskf/ADVd3LtFqEawNE8U8JcqudwfPIAx2A8vpVF1FaRNpHjYyUY7W8Vfy47be/B860h2ZT6LTQ9bj1iwhkaaFbpl/exhgGDefHfFT2j++PWuTXSCyl8e2l3hSPDYxg84BI544zUxOqdVsLqG7kvJLkKvhsjHKN549M48/autTORxOmEhFyQM0pZARjtUSO6S7t4rqI/u5UDrn0IzSTJzWhnRKccZFR3bPHnRmc7cdqaLZ70AKDEUGJNErDzpRZDwM0AIwfKjXNLQEdgTSXbjgUAHuxzmktJkZFJBYntTojAFAxguaAfzPYU/4Q9aoOsbm5s9PhW1njhaeXwmLd8YPY0MSRYRa5p0s4hjvIWZuBhuCfTPbNTSrHOP5Vzq9triws7ZH8JDksR5rn+Ej+4zU/TOor6yTduEsSjlH7H7/wBKjkXxNkbdicnNJ8E+nFNab1BaaiEjJNvM/ASQ43HHkfOrUReo5q07JqivEeDginUhjJ7GpDwnHFRHcrke9Ah2RI0HFN5TvtpvDt5GjQc4NAUSoyki4AINHJDgE5/SlooAGBSpO1AUQzCcZIookwc08zeVBYj3oAUhXOKdxTYXB7U8oz3oGJxRFc05j1pJwKQ6G2Wmp5YbaJpriRIolGSzHAFPk1guutbt5bkWbRiVLZhw3Yydzx54H96TdDSsevOtYLq5PgRM0UUTMCTgk5xgeRP/AHmhZ6pp+oRKEtRazMwYnZGdp9cZ8+eaw1yX3BbZ3d5TsSPb5ZwAoqUJpoEms5dLECugUq+QVbHDZGO/Pfis+TL4o2Ems35lljtLa3mUEKjPdAswP8W0Ht9O1S7KGLVvEe+trZ5FzG2EB2/Rjg9qw1rrEumzI9qIbN0GDFLEGEo9mxn+lauHrHTxCoZ4E3cu20gqTxkAefvTTRLiU+q3z6Nd/C3WkWc9hHmNGaDB2kZxu7Z881AfT+n73Tnmt7wW16AT4cjkh8eQFaf4RdRuoodUjL28ifJ4wOG/4WzyfrUGX8NED+LaXJmRmwI5Pl2j1Lef2FFDsxtnqT28EiPuYsPkwfyfQ+nt509Ld2V0S80DoyphFjb5WPuP4R9P0qz1fSINOuPDu4FtlibZIEuBJKU8mVPIVNteibDV41l06+urdXBZVuoeXAPdTkZpUx2jOw6mYYUSGFY2Q/MdxPiD0IqXbzacQha7d7i7cpM4UoturcZx2arXU+hIdHtYpLrVR4ss8caYTaME8/yqo6jWx/aUkemlTb2yrEMgAkjOT6n60thpkW9eC3uf9TSSB4WK+Ism7cBwGHoT+lWekR6ZrGy21S4linV9y3fGAnmrZ/kapEBl2qkRLDvgEk07HYXV0fDhtpnblsKh7AZNA6H9VtpNOvHt3IMYk3qm7PB7EkeoxUaZGvJnkht/DQYDbfyL9Se2aS8k8jqj72ZQFVSOceQrR9K63FpbSQ3a74s//S6xAtI3Oc/T3o9w6Q7Z6do2jWFlPq7yi6lPxAjVcq6Dsmfc1T3t5aarrFxdXc08EDuWUKgYgemM8cVG1CRbrU5prSHbCZGdI15CqPYeVHCTqWorJMYyJXG/JCrn/LimJF3rt7ZQ6LYwaat1FA5Zgk2Bvwe7Ad/aqvRtUk0C7+JEO+V1xl17KfLn+1RLrVLyS53yynfC/wAg4whB8h7YpmS4M0jyyuzuxyxY5JNKx0W+o3+k6q007pdW90wXaUClGPnkDmq9bKRpzHERK5GY2Rhhv17H2pqJFkkGWEak4LN2XPmceVaqeHR7LS400x4b28jImlBwS47YB7efA/WjsHopYL6DTrf/AFZZk1HsZWx+675x7kY58uajWd7dxO0du4Rpsh5MEuF8+ecDz4qTqdlqN0sOqNbSNbzLw6r8wA4+bH9eKrVbwysiuCSCDjPy0WIe1OKNZGaJ52Bwd0y4fP18x71Gw6hQ24JjIyOD5EirGK2nurcXV3KyWMZ25BDMPouc4qbLe2GqRRabYaZMSjHw5JJRvJbyPGMdqBlWLC4u4bZYLV8NIUGF/MePPzpuJ7iwlkQYBRhkEZGQeKs7nRdXWWZzNF41oPmjSddyYHkv0pvV7GKzto0luQ16wV5IthBQEZwT2JFFBZWySvL8znLMSx+tGzLIqB2C4BwQvb60dpbyX14lvDt8R+F3MFBPpk0iWKS2uGhlQpJGSrKw7EHmkMI5AGc8dqU7o6KqxLHtzyCSW+uaKZi7Fz3JyfKmg7dsedAw8Zz70eMUR9aGc0ADzz70kZzk0sjJwvbGaSgJI5Xv5nAoAWRtUNkYb0PNJxS8RsX8Quj+QABFJCYQNuByTlfMUAJIzRFc8ZA9zTiAMwUuqAnG49h70mRApYbwcdivIagBLLtOMg+4p62jnM8McGPEcgZU+Z7AmmdpCjIIzyPetp0HYo9vLeOGJVyqDPyjjk49femlbJk6RTjp+6tplg1GcWavwrIQVJ9+aXa67ZWdhcWRtRcSsTsIHy9sZ9vtV31jHZM0BuLqVJcEJEmDnzyfT61j4dOuLxpJbRWYRjc7EhVA9iTzTenolb7J0Mtmbm5QQPPbKi5GfyDjOPTkmt3Zwi3t44lYsqrhSfTy/lWU0lx4EVzH8LbDJSVeNrL24z/EcVsIigiUIu1MDaPQelXEiQDzSDwac4NIbzq6IEnmsX1xds95DaAnZGm9hnuT/wBK2fA5PYc1y/V799Rv5rh8fM2BjtgcCs5uka41sgONxPtRBR3oE5NEScYrA2DGDSCtKUpht2c442+vvTjlnhV2IIHyjkZx9KBiLeATOVaRIwASWcnH04pdvC1zcrGil8/0pvjGQVGDnHrQLZkPhAru4AzTQmWep6f4MMHw8buZMs7Idw48uKrmWJYyQGPON2OM1O0vW7nSFlWLB3DaN3ZPUgUem6dc6w7xJtxkuXbIAPpVdi67IHhbBliVkzlBn+dCpdvpxSee3mgLupCbyD8hz+bA79qFKg5Ho9QEjEcJkmHO6TcCSfQn/KmbbTZYTKzThA54SPOMD3JJz78VTnVrO1nistMtrqadmaKF2DLGrDuSx79vSruygvliJvbvxGPbCBf6d66jnHLqSC1h8S4mRI05y7Y7f1qluJYdWkiNtezmPxADsQ7c/TjP3zVR1pFDmKGXfI6s0hmZ2O1CxyMds9gKqQ1lDb3Nw95cReFgpZqWIQ/wpuzyfMjFJsKNX1gNH0FrCxnuI5wolncKGWbEgXapUHnDKex+tVmn6dpYEMljZlBKTKhvJGVlP8TAZzx7nzrBR6trStearb20tzDvW3NwFBMDd8c/lJPY1a6Nf6vqetRQLY3cWo3ibUYxKRIvrj047iuVZVG7OmWJy6NvrMOlWMBvFhW4uEj2qm9mTGQO2SB2x71XLq2o6pObS3VNNtrfBuJlcd8ZEanHf1qys+jOo7KUS32iJcxpk+JFKi7cD8xBIBwPpikXF1pmjxGW9hSARyMsSk72J75A5BJ9a1hkjPoynjlDsn21vcXgAvIGtkRvkCy5YrjzI/Wsh1NrdtBCdJ0QxxxId084k+YnPYHuTnua0Gq6tJqcMVjY7YxcRqzSSv4ZKnsq+vvisnddLw6HMZdRvI3k3fuIIYy/iH3BxwK0ZCHrWGLRdIhnuWV5L0s5lccpxjjBy3HlxV70lpSQxtcJDstG5i8UMHf/AHiuSBTkPS9u9vbTyIs11FGWiinY+HnP8Q7+nHYGnr2w1jUNNaG6vIbUlgzSxkqEUH8o+3nQkFme1PVZ9V1qaVZWtbGBzB4wGDgenvn+VOaXJqk9s02no9jp9uDt2LvaX3A/ibzyfWrKEaZo9uryKdQuZSyRwxISPfAPl6se9WsrXF5p3gzW/wAEJx4agPlo/wDD29/IUUBA8e107SWKkiS6k8N5pnyznzZiOcD0rn18US5mdAyxl22gnnHlmtVremGyijnvruWW58QeFGBg4A4B8h6msbfyPNKxY5ZiXJ9amRURyBVSze4LMLmRlSFVcDjPoece9P30senSR25mllcfLcFxj5+c4OftUSZiwigaOJI4+zYw4JHYn0pi9WM3L7SNo9DkHjvSsdGi0/qSbRtMFvbRW8AlJdZ1+diORg++f/mq40TqW51PFtdNEisCpcZVm47qPI/0rCzm2WYi1dzAApO4YI4GR+tNi5I+eN5AQSoz3xQpUJxs3OvWcN5bxHTbuP8AdZjkZ5Ce58z7kc1jndUIdGw3IO0cL9D505HqF5bQR+HK4iyFU8beDn9fr3pFy1vK+YEdVIBIdgfm88Y8qJOwiqEMzFCu5gvfGaahdojlTgn3705KNo4Hl2pv5WXbyCRUFF9o6SSRXkly7XMckDIoh+ZvEx8owfvzUJItKmsrZpIbm2uWnKNIp3RlcdwD558s0xc3N9LbW9uTiHJCFQMsR6kc+dP6hPJJpum25jTFvvDYPLHIPI8uKAOgQrYTaCYNTMF0spVI7u3HhzMDwGaNmUOVP6A9zVPJpkd3cPagQRXkc5cwSSfMxB5ZQ3ODjtk96tOk+qprfSZLH9iWN0lqpd1Z8OqknnJPJxg49u1Qup9aluNTtNSktzJLaqpAaY7pY2BHnnBBGOBjntzUtmiM5It7ayXsFxBcQISs4WcFWjbJ5A+uR7irnYir4cpMps2jKn/COCD9cOR9qelkt7jUry+tbZo4rMGdsTs4KFCQgzzxkilFFkiiZNr/ABAiRuPIZKkeh7VLY6LC3G/UbaWVtp8MxswHBYeePWtFYm1jClGbxnTM3HCnOftVRpsYee2SUKSx3ZIyQduf7VMty8PUM2c7Xxggd8gd/wBa58jvR041WyVOybCI8tuTBwOTS5tPF9cww2zeDJKdvlx8vfnjjGaleEss/wC7DRjxd2R9O30qu15ZvDRY08QbyuGP5s9ufL/pWUO0az6Zg7djYyz211his/gzKJPEXxD3OfQmrOLx7FpXJAjjQIisedvcf0xWa1V203VpJGVhbXgVnDHPzDuR7hhVjd3t5dWvj7edyhiPIf5c12VZxJ0Ws2uCK8ktwAF2ElgearNSRItMiuYzkC6inAHZmBIP9BVcVMl2viNnnn/zVYxQLLplzbysSI3c4B9ORSqh3fZaXFta3Uki7Z4GuE2LcwqSd4JxkDnA+lO9Oa6+qwGKWVEvbUkbzleAecff+oqHZXU19psF1C6Qz29wQTu5Ax/elRQw6R1CmtTxKbK5EkUz5+WJ3wMkeXbOfeolpFx7NpeatHe2qxPb/wAShZpCPETjB5H51I4wfrWG6u051u2Z0UKQD4gYhmG4gDH6c1qW8KGziLKZYo0LZXg4A7/ypWrS2eqWMefhfDuYUQyR8+GT2fB5GDyfTk0YpOx5YUjK6Zq1xbata2xWO3kkikiWccK2ORu8ieP1qxt45p5QhYxOXCMU4DjPYj0PenOq+lLlLWC9tVPxNuVYjIVOPzEe3vUcBiASxDAAkHggitpqjCLLS4srqxuzZ3sJhbYCFIx3qC8YWRI3b5kkyMfxDt/lTttI99ax3Ek5aTA5ZiSf+80zcQn9oCQSYBUkKe5IOP71mWSrVZ4oVCPlY2zjsR7/AM6fljjZUUxqInyrJkkcjGee/NN2zHa4GCCfPyqTM4dV28YIOf8Av6UmykSNGkmt1aycySrwseWySvkCTzxzV9pl1DasxkjLsCMDnke/8/1rPurq4YE89yBVos7Swly2WB29v0P/AH6Vm2aokQsZLjMj5BPLSEn9at9TnvpdAfS7mC5h8NGa3uIxksmN3BH+7mqJEExRewb5TWx0zUre31SaG+k2W8ZHg7j8oPCkH0H19fenB7CatHNulHgngIzJGhMhRpTkhhzjP6j71s9D1dPANpcrnYh8E+qN5Y8+azsmm6bpl7q0MLtK1tcBtqOCpR8lGHtzj9KesWLyRKqktwAO3OfKienYsa1Rc3ckFrqBjtS1ufEEiED8rY4PP6UmW8XVS17KVt7zdslXBG/ng/pULUIm27mLMZMlSTyuO4+lOWpg1WRYpUC3iAGMsOJsKflOB37HP1pKVlONCbEGHXYpYmDqGBBOQSM/1BrXXOqG1F1b3ceNq+IgOFlK+vPfHc+ePpVN07dpft4Uj+FcYWMHYPkIPv8Abv61d6gINU1O53RRODYDbLIuVZ9w8vLBzmrj0SzEx2lvcxeIZoY2hywkwWOf8OfU8is2mmPdX6afJLm0MvjMisPl88k9gccYNae+lK+PEqlmyArK2QwH8JxgEcd/UVRanpBuYoJ4UkMlw7W2xW2iVsZXBzwc/wBqIaZM1o55qtz8Xe3EF14AyWdZY0CqzDgH0GcAccVWapb3UM4F5aBDEgj3KmwNxw2exOP1rR2+lXepWNy2nxubm2VC6sAcqSdy89yCB/P1qkvtUOr3UEcoCvhYwxPy4HHPv5V0nKaj8PNUa7tJdLmIY24DRHzKk8j9f61rHgUEVy3S9Sn0jWhqKQiOB2+dYx8uzsRx/wB9q6tEyTRJNG4eNwGVh5g9q1izOSGTCGHbFIWFVJz9alNtUEkgADJJ8hWA17rpdRWXTtPQxwzKYzcuOW8sKPIe9NuhJFzqfVui6c0iNc+LLH/DEu7P0Pas3Nrz9Vzpp0Q+DjdhtO75mYdssOwrKTogUptYOBwPI4pu3llhdJYnZWU5yO9RyKUUaaax1fSF+LlubhXiII/eHOP8vqKvui+rp9Xu20/UQrTNuaKQKFzjkqR9Oc1Sz2VtdaS98t2fju7Qs43E+bZPdT/h7g1TWtyFVniJhmU7t0LAFMfxDzx9DS5Do7LsT0xSSAD2zVL0r1IdbWW2uUC3luAWI4WVT/EBV/sHpWtmbQgouMkgVyHq/WbjqLU28DJs4CUhwMAj/F9TW16v6om06STTra3JLRZebPHzeQ9xWc6W0+1mEkt0cwwKGZVPznnGc+lRJlRRA0/UWaWGK5t2khC+CBIS49j9R7VarptvFKP3BQf+yMm5D58MDkfQ1O1DTruwW3xcWd7bl98QjX52A9RjHl/Wk3U1pdWSXlt4UXgkxsviDJz8w9wcn9KzLJ1ppCXNtJJ8OJLWSUI8UzAmEY4IA5BB5yD2q60nUBbytpN3Ixmgbw45WB2zLjIwT3OCPrWf0DV44ZQJNm5gUILYDD0yOM1p5Uh1TT5bNg09uygBSAskX0PqDjFUnQmrJ5HNNm3Ums7011FH4p0a8mZrmBmjSVxjxADwD6HH61p60shoa8IYxTXwwD7hUsCixzRYhtVwKJl706QKGBiiwGPCFLRccUZXHelL2oGFtowKOotzdBPlWgBU86wr359KhCWRixBplpHmcscnFORuwB+XFFCsgdSazNo+iTXUePG4SPd2BPGftXLX8SWNmC3EyjDzyg5O4/8AWtL+IWpymaLT0/KmJX47k/l/lmqfQ7qaysLy8tnKiGWIkHHbPNZTezWHRURSbJY5i0oC4wwPIPqPStBD1HqOq3FjYRXE8m7EPhb2xyewwf8AvmqG7mErkIAI2kZwMeRNTun7R01BL3PhQwE75c/kODioZaHtWYTahqTXkUiK0hWPnYUccA7cc8Dnz96gDS5LoFYLhJWUf7JVOcYyWOewFaz/AEV/a8EuoR6zpQEfLpLKVdSfMjBHPsTVHDoU19rS6ZbXEN33Z5YGO3Hfvjtz70IbIumarPp3iRzXMmxCNsH5gT6j0HuO/Famy6wshYG1n1O+DTK2Z1jBaFj2A/zrL6ybRl8C2t4YfhnMQdN26UerE+9U+AuMY4/nVWRVnaLY6MTahDDeXDRhUlZd7txkktVbr1zFu065cXNhfbyoYRgssYOCD6A8YrCaV1I1jYi2e2ZgCdu1yhGe/b+9T9Xm1Pqaygns7aeW3gUq4yCQRyAf8WB2NWpEcadm6j0S21CyRzctdsS0sUshyqsRj5R5Y4rKt+Husag5k1LUIEl3fKzfOWz354/SlXvUOoWVvZ2ypGtiyKGVmVXkyPJRyo9POlaxqS3VvPp2kXSSmLOIJEfxVPGW3ngkdhnFGgpl7Joi6bpNrBYPKVgcNIbZB4k5XyJz9e9UeqdeavYXJjn05YELHEUisr7PL5u2ftWen6r1e3u9sK/s87QHgQEAuByxB8z3qS/V19qmmz6fqdyAxU7SIAzN59/L7UnJD4sqL69bU9Tku3UI0r7iBk4q1vzaX+pCO002e3WOEqWjQs0nynaxXy+ves+spjYOhIzxn60SyuGJDsP+Y81JVBxSNGwZGKsOxU4Io1gMrNjccAs2PIeZ+lPpYNJpsl4kluBHjKNIBIf+EeYokiuYHVGka2WVeZHRgpUjt25H60hkcRk/KOST50D+UjgEUbhVnaMOJAvZ1GAffnmlLOkLpI8aSqrD923Ab2OKBkuz0e5uNPlvzCwtogAx5XIIOGHrg96nWVjrem6S16ng2tpMgBJZQ8i+oBq0m6itm6ekslvXtJd4CQRREFIz3ByfOq7V72AWga3ht3gZ/C8QSb5MhRjuMIO/A71VIi2KtLmC6uRLFZag7yHEdtC/7vkdyT2z7cU1rFjM9xc3F5LawGMqTFGQSB2wNo2lvvnjmmrafVdWnggsvFhRx4LeG52EjzwTxxVjrmjWenWEKnWoJxFuXwlXOSexAB4Pqc+lAjO38thKyLY208CgfOZZN2/ng4xxUnpyGCfU08QbijiTaDjcFySB7njioJlkZhKzlmwAM+QHAFTp7+CC6S5so1cxkM7mLZ8xH+EcA59KXuXWjfwXuisVu9vi3d0PC8TYN0+ByP7fWub300MlyrQRyxYXDCR9xJ8//mp+9j8S7kls45GhLgpIm48nn7HmivNK1C3m23FnOjlTJ84x8o7k027JiqIKAhy3Y54x5U/dv410826Rw+PmkOWOB500OM8giiV9w+lSWKwGyrHGBkcdz6Ugg0snJJ9aInPBoASDgZoJIV5XGcEcgGjIAHfNEsZ28cnPagAgxCFMDnz86IA0sIzZ2jP2ouxNAhIHy+/enpIDDFG5aM+ICQFYEj6jypsc8UDnzoGJJ4os4Bp2Od4VkVNuHGDlQTj2z2p/TdNn1W4+HtlJbaWY+mKErFYmx06fUrhYIAu9gWyxwAo7nPpWgt+pbWEDSxEI9OSMo0oOHZh/FkdgTTurw2/TugQ28cIF5dqPGcg7gvGRn+WKpJhHp1lGEkRbuUF3TZkqM8Lz24yauqI7IjSvDc+NJukPP5uWII9/Y+dXGkz3iW7LBLaRwyuQ4nQZAxwT6jHpVfaWV5rMoSAZkAC4IIyv+Inyq1mt7qE2+mymcz2hL+KI94wfIY5xSSBtD1pZSXPi6fbwrNGkwM07ARpnGcBRWsiR44lWTbu89pOAfbPlUG1eLSrOO1BaW45Y+pJ5ycdqk2txNcbjJD4aj8rZPzfYjI+9aozY6aLzo3YICzEKo7k8AVkOpOqyQLbTJWBB+eZePsP86G0gSbHurtf+DjNhauDPIP3jg/kHp9TWInk8ZQ7MDISQwC9/fNOPI8krSSMXduSWOSTTDEZrnlKzeMaQQpLc0pVZlLAEqDjj1pIR5JAiqSx4x5mkWJJwKUhUg5GT5YomGOG4I70SqSx4Kgd+O1IAy235ePm45ouxqZF8IkbiaHdLswhVuCfU1GeGVYhIU/d527vLNMCZa2S3SgjsASxPYHy/nWm0231SG2SDwreaBwXE6thlby/nVR0+WlCR2sQeVfmYMcBj5Aelaoanb2lqjOUjjRcOFydrcfL7/WtoRVGGSTb0Z/qWbw7QW8k8bXIcGR0GC/t9hQqi1KeO/wBQmmjBRZGJJJ/pQrJy2axjo7nd9fabZStDa273DMd24PhGPsT2qDY6nfXOrPf6myrbwAmMhg2AewGOPvmsIdvxjNcl/Cg4VnjALDGeMEip9xrRuLgNBPeuqAMFMg3KeP4eVx9q5JfUfdI64/T/AJkaqV1ubmPU2FsXvGUvE+TlEOVGewzjkVRahpc9zrCSToQt1KWi8MhpJMnhsccD1PpTWkafr8H+saVLqMJncoAY8hj37f5CtPDqnUVjchdU0+0lniTD8Dx9vnhCQT9hVYvqEZfmROTwJR/I7I/TKzWnT/WOnGRfjIZYbjei9isg5x2PNTektZ1DUOrtI+OuPHKybVJRV2g5JHArNDW7JdT1WcX95ajUBtlRIgwPOdpz27eVWdnYX+hra9RWF3C6xyCeMyxZUwgd2AOc5/Sudzi5N2bqEopKj0E8Ylgkj/xIyn7g1wyDoVtUcXGtXjyypwkcJwoQcbcnmt1ov4h3WpR+PE2nSxE4woYNtI9Mmq2a+sLKQCS/j3ZxhFLY8+cdvvXX42XFu5Iw8rFkdVFlBd6JZabOr6ZYtNfGHw4oyxMaAfxsT2pFn0nsmW+1eaS9uhk4ycKT5D2rQXd9ZRAP8TF4UgBV0cZPsPPPtUGa7uJ5laR1itGyVG/w5CR659a7otNWjz2mtMfNk890ss8pMaYMcK8AH1J8/pSb+H4xGSXeiA4UL3Pq39hTcl7O8qxQW54YCUs4zEPI8ZooYtty7QvLJKwG+SRsqPPgffypiCOj2FnbsIYXjyMMYnw2PMlic1GutegiLLBh5oUDAOSBj38845qL1Hqs1ho5SRZJbidvBj/dlcHPfzz5VkY7rUrF7i0vnnS4nTHhjG4HvknuPpSbGtlj1Jdx3kSxLEvhq5aJ+3ydjj1yT3rNQWySutxJ4bh22JDn5mHrgdqlarKm6GRpHmkMZDA54Pb9PaqsKJHVi+xADgkZxUNlDcszTTYYs20bSSeTSLpDbbRyWYbhkcU8qHHpzk01MpZhny7VLKIyASbcjsaUzHI28cc08Itq5xyaSqcljSAdSMi1aZvy7h5UW4MBjHn24/WnIruOC1liZZHEgC8NhQAc8+tRo5RuyfTb9KYD7dsse3lTW5Rg96Vv7gnA9T50JtgIC9iO9IBUEHxLxJ8QquZAq+ISFUev+dXcmgyx2DpLc22wXSxs8cwZU7jOO/rWeDFSmO/IBFX8pUaTbWiN4q3s6NIzcbWBxtBHpQ3Q0iZbWt/YdR3qGKW2CPviWUFS5IABBPcEfyq31zRr6LqPTNQvjI1vNEVt5dwJkI5IOO3eqSRV1DqO5tZpn8Hx0KFGyqonfHvgYq6ujIqw73mndWEkLscbAeGyvmCDj2IrNmkUV+mWzR3M8SZ8NpGicjuQO39au4bAqYvDQJtlHnjtzj9Kroot16qIHJDFsZ7nZj+oH61Z2Vz4yTCQMCCpHtntSYy1tbhFgE64T59nJ5U4qXdMy3lsE2FplU98cioKQp4FvAyHY0uWycchT/erc2hkuUJjwoGcsOT8vP8AeueXZ0weh+O7PwhYkDxXKBQASOcZNVutMsbOiv4aRqmSp4zn++KvLeKFR+7ikG3aPlz71U3UXxcU8eXmIlCNvAHYA/1rOOmay6Oe9YxQG3LqdyRgvuz2zwQP5GmNKjuEg8V7jxEK4CE4DKR5+4q76hhEW60u7X91PHxIuDszx29jWVshLb2yQOSNhKtn1B/v6V2Rejhlpjk7PDI8jhSq4BPIPfNS7G7DxzeJGVafJXLZH5fOmLiWJo7gbSIxhjlh6YP86ah1O0hTxApdUUJIhXgehpiTLbQ3TcLWYhd+CyHuSPT1rYW8dtcwSWlxEksD5Vo28xiubx3AumfwSAwcPGG7KQcjP6VsbPWxIqlYpbYhcyRuVfafPDYziplG0VF0yyg0QW0ciJqEklsoHhwlCXxzldw7jGOCOaXFor394dNtWjhkfE9m7rnY2DlSPQ9qhC/JXxBMY0DYJzjHPr5Vc6Nrkiy6dcfCRvYxMdkvh7SzZ+ZCw9O4rOOpGj2qL3pW5/aGnizvIY1nty0MqFs7SD+XnnHp7CqLXOjW05Z72KGQRCRtw44XHDDH8OOMY4IrXRRQnWbo+Ei3kux4ZTwlzF3C+m7GcHz/AFAup9LS/tHtrhdyyKVDkEEDzUjy44rs1JHNVM47axrDaptGPlU4+wqZcRrL4DBSsm45bPGMen2oX+nTdNXh0+8RjFgm3kyOUzx58kdj6cUiEtNGTHh8NuAz5VzyVM1TFQgJE2PJySKdMSyKSrAPjjJxux6U/wCClxb3EltGIVQgHc4yxxjIBqLZAqu1juIHGPL5aktEmC5Z1LI/huMqTjODU62YtEnp/Wq+C3H7yVshC+Cf97HapMvjQ2xNsyB07LIMgjOT/LNZs0RawFeMrkg+tO6oztqt2WGws+1lJ3KR5fbHlUe2l3orkqxGBgHGft6VbdTQ2yX7S2y7ElVXx5cgGpfRdbMfbXOmp1be211a/BC8s1VJUYuqyqTjGewI79+wq5gzaSeE0iOP4SjAgg9yP0FUXVNgk19pF7DCyyRS+FIyDO7d5n+mKtLSfxroRRJHIVi8QMmcSKM5P2xVTd7Ijq0aR7H460jc7jJPyrHgKc4IP9aqhFLpepxi4jeN4nBZR+b7farzpidrgS2eSwH72Ik8K3PBz5EcGk9VIlxLHqUSFHY+HNGe8brxilWrLvdFXNMLPUVvYyfDkbY2w4Z1zuEgHY/9SK1sRt5PiH0xkubwweHM8hKCVW/izzz35H0rNaTDBfQywS3GyZNxidkyCrd8nt3qNeLd6b06Lq3nLOshSVFYjIByQGHIxgEfQ+tXFkNFdNBe2V/JIX8XT5V2ieNtyPIO+30ONv6VJeO50uWzmkRLiHepZWAKAtnBBzwSPPyIqU3USW/TMECQwy+NKRcFGztYjKuePzEZz25HvVRfajHOitOLV4GVY3jI5dVBUH2J9fXmmlTslvRV6xb3XRt26adP8RZ37+NDMSC65U7lYnjPGf8Aex61zSTZd3BaRvDlLfIVQBZDkd/TPr6107QZo9T0m4sJ5FuhBcYVrjn5Mfu/oMgAn1HvXOXdLafxLlQ6+PuaAgjI82B8vQV0JnM0MTyNE1xZzQmIk9iMfOvGT6Z88Vs+gNdE8H7HnJEsKl4yx/MueQPpWUvGhu7+ea2c7FG8LLwxPpkefvTmowXugajAxVLe+g2vhOwPlj1yO57GqToho33V1+NM6dvpw+1zH4Sf8Tcf51xzeDDyTlSMZrS9edSDWvgI4yUVYfEkjz+WQnGP5cfWs0sTSW5ZRnByQKpuyUiX8Obq2MgIjZCA4bsB5YqRZ6RA7mO4vUgOMhyQVI/z5qPpavPG3gsTMO6AZLL5n7CrK2hW5spobCLDPzIJCD7jae9SUQNQt3t5PBIMiRjKsTwyn0FFutZTudWEoAIweD9aGo6bc2DqJzvdUBO0k7M+R/6VGiS3nBXxdrKcqT5j0oAvdP1WXSL63nguWcRYDEJhfDY8qfv7ehrpyXUywHaUuZdm6MIQGk4yMDgHy7VxmCdLZ/ESNZFJKMrea+mPI+nvVvp2uT6XFFaOUuNPd/EjcgkhfTPBBBzx5GmmJqy3tzLcxzjV7QftJpN0itiPwx/jDDnt5e3NWOkxx2iX0jW8l3FsMb/DSDD+/GPLA98VP0bqC01ffb6m8dwGGYbhxgADyJPIqZc2lraXkdzFObC5UmNRjKP2Jz5EEUhmSXQrsWqusalI2BCpNieMf4dp4z/2KMtaNfwrNE1ygG2FY/klI7AMPXyrcR6ZHfXDXCLBCxHzQkBlkPHKt5r7H+VZ+66du7iQLcW8UsTyGQzWpVZYyPr3Hb5c0gIT6XDeM8unTvblODA5+ZG9CCMn6Gm4dXfSVRLmN3+bnwjhfcEd1/oakeBpaMpuZ5Y9RPzLOMpuPvzjP3oXGpWt1L8DqbqjgAjYniGUEjz8jgfX60AWV5pukdV2jGJHhu4hvV14bHr/ALy1SWXW1zo0nwGo28lzHCwjMwBDqP8AeB707eaVPpEcdzp5vmgyxztKtCM9x6H2xg1GvJp+oYvioIjOYyRdeGgV3A8/rj+EccU7Bo3dpeQXsKzW8ySowyCp/r6U+K5Tp9rf6Rby6nZSuixPlWY7R4ecYYdmHrjtXSNJ1RNSt1Y7BNtDMqNuUg+anzH8x51alZDROoUKPFUIIjNECucZpWKjzAplgM0ALlfYtQZHBP5c0J5nk4JIxTAkweRQIVsKdhQMgXgiiaZqrbvWIILlbRCZrtiB4SKTtBPc47UXQ1s551ndSXHUN2ztkRsET2UAcVCtmX4NYPF2+NJlwOdwHYEfX+tdRvfwvEc08hW2uLhiZHR5SUbPOeeR6VXWH4ZarfWmoRnTo4mVvEiDuV8vyqOQQfXisWtmy6OcXdoLe6KrvCM2F3D5qtXX9lWkqPHujmIaTjOMDj+tbVPwu1zWdAR7q4kgu7YnbHPwXUjkD0II+9YO4WewtWtj87FiHIbdznkH6GpoZN026jvoU0+6v4rS0cYM4gDYOcjcR82Pp+lC21S20a6lW3urrEg2iaJhHx69iSP0qhkkCONihCRgjOcfrTDEyScDGBimDZZy3dlDLIlqZjE3/iyAGRj5nHYVb6f1Pp+nzi2g0W2ltgMK74EzHHcsePtWTYc9+1E4JK/KaBUXtzrNte3sl9dQrcSvx4CKFRAO2T5/arLTutoNM06W0t9KjaOQksFZlYZ7k48vvWSLFcEdql2mo3FtBLDbyPEZTgspwSPQ+op2KkOT69e3LGUGONgCo8NAMA+Xbv796grJJJKXdmZ2OSzHJJ+tKe2kMAuCyFWYrw3II9RSUjx2Ix60hhTTNNMZHLGU8s5YkvTYDt2yyrz9K3Oh9IaNcQJf3WppcxFc+EuEOfQ85z7VQag/T808nwcV3aKHVVUncGH8RIPIPtToVlUq5YD05o7dEMv713VM8kDOPSrFP2bHcLDG+6CQ4ee4QgBOPyqOQe4zUrqLU9MvRBb6TZtbWsG45bvIT5kfb1oHZEuNJtobcS/tOwaQ42xRb2Pf6Ypq6jAYhmaV9uSEBAB9qiLJ4cgORuByOMj9KmftA/Em6zsuAwdNigJke3+VIBsxTKvgPEysDuwU+bkfrjFM3VrNaxK8yModiBlhxg47d6tF6mvVu5byPYLqc4aRvmG30wc/rVZcl7qVpJnaR5G3Ox5J96ABdSG8nLtNI4PG+TvgDzpr5ogq88ckZ4PoabztdkBLLnaCeCRmntu4YAwR6mgB22vrm0SXwWMa3A2sQe9NHcxJPb2pONpRWAp8Llc4FAUIAzwKTJKywtEGIWQhmUdjjtTuSpwO/amSQ05GTgDHFAy26X1CSz1KAJfPa2xfdKN3ykAc5Hv2rTdT67bzIxdbjwJogEaLAEoxlQ5IyPoKxUMXxbrHbLsmICxxgZ8Vs+ZzxSri7ubsD4hySg8MKeygcYA8qaZLjYd5dC6Ee23gh2JtAiGM8nknzPvUSMA5PbHH1pZXbkDy4qQTanTYPDR1ukc+I2OGUnIOfUdqQxkxujFWUg9sEefpRyxiPCknxBwy47H61Nee2TT3ge3kN88m8zO3Cjvx9fOnxpIXSDdARzeKA+9ZRujUE5G3uSadBZUbc5pxZvBG2Mkbhhm8/p7UkDPGM+Y9aQDhgcZAPY+dICRb3nw6gnbIAcCJ1ypz3PfvTdxJDLM7QReFEzZWPuVHpmm2AkcsFWMEkhR2HsKBHNADs0Ua7XidipHZsZB8+3lTJ5oyDx9M0oxuqq7I4VvykqcH6GgYUMMk8qxRIXkY4Cjua2vQ0sMGnXDeCcqxMkxHJ9voKoenP9We7vt6K0ERSIFdxaR8gDH61N0bUWs/iZNQs5nEUQEUSkqqjzAHbnvVR0zOeybLBLr1zf3Vxe/6pbvtt4u4LYGDj/vvUm16Rt7q3ll1QSvc3PJJbmL7+tL0vVbTXLy2kt41t5ImZ5YuPnypwQfMVonUOrKeQe/NaJJmcm0MQ20cKqiAAKAucc4FL43A45FBFKKFZtxAwT60Zq6J2QrnTYLiYTsAHAx2yO/cjzNHqF/Bp9s1xcvtRfLzJ9BT88scETSyuERBlifIVzvqXWjq90Cm5bePiNW4z/vEVEnRcY2w9b6puNVDxQkwW+cbB+Zh7n+1UTOWwMn70gt83FAnmsG7N0qElt3bypdvZS3CySLE8kcQ3Ntppjj2qbZapcWCtFAQPF4ZtuSB7UkDIaXkiOGjwMDGMUk3E00mc/Mx4Cipmo6dJbulwceDKN4Pnnz49astM1XSbCMPHZF7jZ/tG5w3t6VSQN6tE/Ruklj8O5vwTNnd4WeB9fWpjW2kak0kiSQoWJilG4DdjgZ9/epel6hFqtr/ALRXcriTAI7+lVvU2n2NroTJDEkWx1I2+Z9/XitqVaOe23TIy9K2b2jC3n8Z1flz/Fj+HjtT41C30yzjDaPJbQyttwQD83vWc0nUbjTbmJ4XLhm+aLPDVstTluF0i4lWBRcGMnaWDbPfPqBUxaasqSp0zNapCmh3sMtjcFpZPmZVwdvt981F1nUbicxpKgjwgBjHr61V28rCUZbODnPrTtyrTO0oACnsAaxcjdRoTbyKqPGEQ7yDuYZ249KFNoDjtihUWXRs57gWkUXiPv8AGyxQYKkDjkVJguLdUdHtliSYgl0HYY8qf1fpCbRTsnv7bMgDxbm25XPPPr7UnRdIuL28L34aztY/zSg8EeQ+prw5U1aPbi37hC6v9Oi36fq1w/OVCSsjAD+IDPH0rQN+JOoXtraW/Umn2eqQqQ5maPw5x771IOaivo66fOZra80yZSMOPE2N7dxg8ennTFxbvYsltfwmPwyzKxUK3PkG/iB9D60llcdB6als20PXHQ15ItrdabeTWygAJdxo4X28QAOB7kmqLrGDpe4sml6X1K4t8MC2lO5dOeS6nP045qFYdPdOapCrv1LPZMDhbeSzMjAegKNyB9K0mn/gydTU3Nh1HpV1CrDLqjAj2Izx966FKc1SSZg1CDt2jCWD20Fqr6hFcgqWAER2kE9j3GBV1p97p9wl1LFZPdSTxiJCZQHjcdiAe+c4qy60/CzWdBtTfvdrfWEfLCINujHuD5c+9YGFXgiaRS8eGG47yMH3ArCeNwf3qmbQmpL7WbvTdH1wRKbGdXmiIykoVthz2yM45yO1TG1a/wBOuH/bGnzbkU5lgbfFn6Y96zmjXusXFs+qJJHJFCwB3na2O4Of4ufWnbfVb+8vjdpqUMU127eNIp/dA9u3l5feiGVxf2Ohyx89T2a211KzfiKSLbINzmR1+Y+p55+nlRX+sFbSX4WGaV0Yq6xkA8Y7H09xWf6el1fTL2S61LTY9VsCC1xbpEPpuUjlT25BpqC817V9Tc6YHigXJW1uXVx24GSBn6H9a9TF9RVJT2zzM30/dw0TpbmXWLlY5Emim8IgSZDJH67AO7cYHNV1/cWNjPLE6/FTxjJmkYFx6DPPzDzqqu73UdPjeyu7drS4tXLyQCMoxbyyPMffFNyanHqtqss1sUuCMyOzknPkAMceVdK8vG1Zz/g8l0Vt6DLcsScsxyT7etMPtPAOQowfc1bR6fLM8RCiFc8MM7cn6U/qy6mfCjuNJha5X5WeKMxl8dmxgZH1GfesvxkbNPwcl7lKxChfEDHnnb3+1FeSRSPmFGRAAAGIJz59qvtC0SbXLmC3itIJLt3z8PI+x2AHOM4FRNc6c1XS76RL3TprUKxAVlwB7A4wftW8csZK7MZ4ZRdUVPdBmmnYKVGQQfKngCBtOd3p6U3IVO07TuGcn1rRGQ26gJnB9aZ37u3BPNPnJG31qOiksCOw70gHGJbDE0tlG1MH5gBSGC55Zwp9Bnnyp5x4bLvKHPPysD/SgBvY5xlTz2OO5rSaRugbULQ4nS1jEobbyrBl5/n/ACqPbW8clokoIkm4IX6HJqLZ3JtH1Lw23eJGyjP8WT2+tJlInacGsjcXLt4jk71J/K25xz9xmtDcapJJFcTRklo08MDHCkgYOfvWXje3MLwTu0SMipuQ5ChV4JH1/qanGRFsYpBKzDw13Oufm5xye/bHeoaLTNRqOmPBJBc28jGRGCtjjcBjJ/rTOkwfE39yyZeJThGzgEEnFQrrWHgEHjqzo+bdgrYLZByR6HsferPQHb9mNtYKvhb14x2FJlWX8Mf5VzkJ82M/erezufHn8R1wG4GPLiqWG6jtLO3uZQG3ohIBweQKs7N1R+UKKeM9++a5pnRjJ9tLMunJIgBk2sx98kj+lQ5riCGwmm2hQ0pY+vkKcufDtrWFBLgRfmx589qo7u4Dbo0TxEGDknsfT9ahRNXL2Mzqc80l/Os8wYRqFUkd1OSOPWqm8iKxk7dyOM5HPPlVlqcQm1OKJwygpuz64OCPtkUm5ijWNkAYBRxnnFdcTjl2UN3pkl1p63WQ62gAOWGcH0H25qmsoYZjMZ7hoI3BIRV3Fz5DGRWpW13xyQbygdv4T8rHHb+tVd5pM9jK8NxC8U6YDRsuCAasga0uxkD7kGSjLuGM5B/61rbnSL7S/CuLtfhjIhH7xwMqexYDJGPcVU6RC9rZuUeRJ5h+73qDsXBHc85we4p2G1Z4y75KsucsSSTnzNJgifp8ngW8gN2rMWyZMcAseMn68VZWLwzQGC3PhTtvDLj8jZ7/AEyahRWm8XMeRsmT9D5VL0olr9JQW2hFEijsCw7/AKr/ADrKRpE3Wj6yLzTbfSNat0KlfDSfOPCk8h7KT5+Rx9tZb3nwtqGkeaV4yI5YH/2iAd27cnz4/MB61y/UbqWJEcRb4mO10Hcc84I862XTF/Fq8NsLmWS5vrIAWz7wjXUBP5WB4LD+fkQarHJoc0i56t6YtepNMUPIF8I+LFIozjjGc+hrkmoWF1pl/cpbHbsmMThgVSXgYI/wmuw6Zr6KqxXMbYlLeE6g/vNvBAHcNx+XvmmdV6espLIzadaxTw3pBkYPwB/iGe2Oe3b0q5b2SlRyiyvHaR7eaNoZPynPKse4wad04OvhhyrOHZPlAHA4GfU1Z6xpOnaRFJcXmpF0OFjRYjvdwTgd+BxyaoJdQtLS8WJJllThyysMEsMnBFRVjui3h5uJFl5H8PPepDxNLJGqKWY+SjJP2pNt1FHGGQ29s1rJEUcNEMk4/MGPOQferuHX7vp7TbaSxvbaWa4UOYnhyQnIDK3GcHuP61nxNLIBsri0cRPBNG4AO1kIOP8A5qtLnfcRW4lDJiAcsuO3v51U6j1JcarOZ7p/Dmxt4bjZ/wBP6GpNjeyOjQuvjHafD5zs9cVLRSkWOi2lrf3RsrsfJOoMZBwVkByhB8jkUWr9LXulm4eO3ncITKbzcNrK3fIHY5JyO1WkWhE6cJLFopblo0uUfkMoz8yjnuDirK6uINY0+G4kuZopTGYJFjm2ZHmWHYjP9aqK+2mJvdmR064uDKvhPtn4AJ4B9Kt7gxahKvi7kmkhIbB/MPU+uCAP/mqhJjt7iWPxPFVDhJI+xPr9MVaRSSm1SVdgKsTG/cjtuX9Of1rO/Y0Q1pVjHeTra5KXO4MMjuoPOB6+3tR3SfBwtDaTSXMVnIsu5lAYANlkx5jFC4iDSAkeHP3K54APIIIpemXcGn3oldPFSVMSBhyo5BBHn/eqiyZIi6lMB08yBFnN3ckgwYBZF/JxzyM+WMdqx0Ukt8500zLGRnHiYHlyMnzGOBW01XQQlxJPpUfxFu+WKByFtpCPLyIO4EfSuearHdaJcrdTQDfJuWIHkOM4LfrxW0VbMJhahY3PSqfHXIS5s7nMQntnz2PBB7DOOxFZ+eZtdkVNQw00COIrh3Cl/MK3l2/+eumWVtpvVmi4LbYXQwMsbElcYI/N5jA5rK9UdDpoulxXMDi58B8nKn94vJ5A8xx+ldHE57M/JoT3FhBN8kc8kQCjsGwSpyTwG8vtUfUJ3ub2K3vraVJrW2SORQpBUDzx9wc1dajqpt9PaRr0SWl1lzZoMKMnJwcZB9v7Gs3qNoZ54FiuUuSP3aNuIIXuA2frikBWXto82HQBivBA7sPUipKWkpt1NvDJsUdypwx9z5VbJcaba2QtbpzdGORnjeBdpVSBnOeWGfKmpXeDT5JHAmS5GIn38hR3BANAjNgeDdfIxQj7YNW2gSvBqEcnheOGOwKcnJyMHj3quuoohIxhLNG35WYcqfQ1LidXsxJG/gzo2HAHdfIg9waALbWdDa6MtxLK8TLzmXhSCeO5yMkHvWce3i+RGCCRjwyvwPY+VdB0BbTUtOkuokkN0Yyr+P8AMjsCCcH0Pbz5HvWT1W3SC6SR7RVhYAqG+Xd9cefHlTQite3NuUAPiK2cFO+ff9KtDC0zeOssJXYH8PGFB/wkDzqJfMyw+EYZlQHIVjkLnzBpFmjSS20MmUXfhW28j60DOi9G6lp91YXFu1jGL2FSTGqDMwA8s92AOPvVlDrey4+FvdJdbMEIsxydgPrxwB5+lc9u7HVLV4b6GFLPIaWJoshlAPJ+npnmtVZ3cPU9tDcS3LRXXEckauyvvxyUPmG7bcedOwLaz0XVNCmujDcR3Vkfnt4QwDN6gcYB/kafW/h1Wxe7jecrFkuF4kQgEEMB3I9DVFbN1DoUsTxWU9/YzquxJDnwmHlxyv8A3mmrxfA1GXU9MZ47uTBmt0Q4b14H8QzyPuPSkAwdLs/CF1aO1xbyvlM/lhbuNy4zn18uakJoJlk8e4aMRBd0dxGdxjOPykDPA8vMU709qFpeT3DmSO3LxKniK2IiwJwfLB+tN2Wi65b38t3FE8LurbgkuFbnhh/vfUUgLG1v7uKJ7a5SO5s1Td48EuGjwOR/l271S61aQJMt01wRHOh8OWPIaUAZGdvY9+4rQx6jBcaWtldTRicArJsUJ8w75HkazUyMtwjTXESRrwoMmCfLafQ80AU8WtfFRw2chlhh3L8sh+VWzzIBj0zwftUW8FxYBjbXLfBW85S3ljVlDZ5JX3+vpVlfdNwS2r6hFdrIOSQkgJDBgO3BAIPpUO21mTRr2MiFngBAe2nc7D6f50DN10X1JN1FaSm4TEsLAbx2cEf1GK0n1rntn1BJIzSK7pYxNllgUADKABUXjgEEZrRaL1RaXlybMXDPvwbd5FA8QYyVHqRVqRDRfNu/hpmcOVB5p3xB5gilFk2kkjirJK5lJ7g0hYCT2NTZLiBVzkVEutVt7aF5WO1UBZmNAFV1DqcWgadLdS5MnKxLju3+QrC6fqU66hbfAysbh33PcAg5bvyMZ/8AmqZrFzcdUyzSPGvw0YKlBJloV/x/fzqq0a1t4tV2B5bNWJhYlg8kYYdyMdvcVjJ2awVHTm6tsYZJLs3cjoxZZECfKx24L4HIBOM1DsfxOFnLG+y4SNPkVEkLrIp7HnsRg1k9d0qXp029zayXUckZ5LKVjn3f4CPzep9qhWupsNSWd7G1trmTAL3UREb+YAQDCn3qSrO1x9ZQXMFte7bmGC4zGqNGG3t6/b60etdMaZq6eKBHDczfNkJt8fjkEH19DXK06ov9MmldrZY45XIKIMREH80Y8xk8+WKm2XWt04PgQWkEnbaY3dox5YZiSME9gMVKdMtpNUVnUnQFrays9lL4bZKi2znc3oPSsXNp9zauzyRgKpwSrg7T9jU/W9YvLzUJLm5nleYt8khOOfXAxUVNYv1k8edFn38eJLHndj386u7MyDI5kYsxJ8uTRHIl78AVYwT3F27vJ8FsRD80qIDjvgep9Kbs9Pj1O8RFlgt4yBvZ5Aiofv8A2oAhYyuMe9S7CwtZtj3129rE5ID7N3I9fPFae26b0gubez1e2l1FGO3x0DROP933981D1TozX7ZTOY1u97AEwHcT9sdqKCzMToiSuIpQ6biFYjG4eRxQbcijnJI9KOSJo5GSRDGynayt3BqXZtHayQXcskLCOUFoGGWKg9+RgigZEAlChuQvqKMLnk557+taiX8RtRYFIrKxjTsoKE44798VU2X7O1B7qXVL6S3mZcxEJuUt/vED+Qp0K37lfjLYGcD1PNOW8XxdwkCvGjMcbpG2qv1NJlURuUWRZB/jXOCPvzTUnyjG0H3pDL6XT9B0qNQ97JqN2U3DweIVbyBPciqZwC+cADyx5U0qyOURUJZsKAB3NPNYXMLEMm1gxUqWGQR34oALCsAoA+tEu6N8nBHoaXHaTzQyyrs2xgFssAefQedMCCQZCgnzz6UAG0bSuzO2WPJo47c7T8xB8iKJAeScljTgVselACVUFcSfMw9OMU5JA8IT51KuMjac49j6H2pbywmaIx2+FRRvByd58yTUqz1OK1nlf4GGaGUYMUmSq8+Xnkc0CIDKQoAbLg557YpuNHBLkD7VZ3EcV9PNc20cNlFztjd+O2eP+/Oodp4TyosrMkZYB2C5IXPJxTCxCsYQJCnI5BZeKZLksWP8TZyPXPpXSJ9R0afpiS2sZEljVhCkcijcCTxwf61S6V0xp+pLaoqTbzFJLL82MDsg/XP6U+JKkZq3eFrmMXGRCW/ebTzjzpd8sIuC1vG0UDLviVm3ED0JpE9obO5ls7x/BePjIXdz6GlWi2/jBrxn8OPG5EPzsPQeVSUCzuFt5oJDBHL4bbisnZvQHntU3UJLq4ZbloraETDcpiCjH27r2qLey280xa0tjBBgKATkt7k+tMq5UEDzpgIIwTuY5NFx6/rSzg9+KHhEcHHIzwc0hiF+tA96k3iWqSILSQyKUUsSCMN5gZ8qYTYMlgSewAOKAHbSaGBi81slyPJXcgD9KXNei4ihjS3jtljJOULHP1yTUYAYzkEnjGacBRYNmwFyc7sngemKYi7Oj2VxZP8ABXyS3bkPtRsgIO+c4OQc/aqddQuY7Y2qsEjOQ2wYL/U+Y4p3SJJItThaIxK5JQNL+UZ4Oamaros9qYZrmPw0+aPuChC52gEeoFH7E+5O6M0S++Oi1E7oLcKeSP8AaA8Yx6e9bYxp4nidmIxnPeudRa/qty4IuzbwKwKqpHyL2wB3I9q1FpdalLcBYYcxiRR4gBIdezHk8HzrWDM5p3svSCKS7qiszEAKMknyFKlkWE5c7U/xGst1h1FBDayadbOWmk+WTKkBV/zqm6RKVuii6n6l/asgitwVt42O1s8ufX6VQyXDz8uxfAxk+WKWY2eMsqAKoAJFNNtjU1zt2zpSoQxA586JPmyScU25OeacVGKZyMVJQmQDNKguXtXMkTEOw2mksCT9KSXJGA3yjtxQIm3Gpy30QjmwFXJGBkk+tNQXEYtJ7dwAOHUrGCSc+Z8hUfcNuMgn0pUBly0SShPEG1skAEehp2FEu2uYRJl91soH5rcHcfQHmntU11tRsoLXw2jSPklmyXPqar2hCuY3kRSvlmm3dANoyT60OQlFXY/ZBoZEuxjbEQRk4yR5VJ1jqG4v1KL+4hf86Ak7j/l7VVlmWMEMTg8L6UE+Zi8gDsfNqnlqiuO7Cjjxln49qUFJO1yV3eZ8h60TvngU5GAxGSeBUlDf+ykZVkVlBwG7A0KcYLGRJjz4zQoA2uppa3Lw2+oor2cbeKkkR/esW82J74q0sOpri/iazmktjbzHwgzx+Ht8gxK8A8Cmeq9PgsWmWFFVLht+Adypnnj25+1UVrlYiqKp88jsffFeHdx0e1VSLq4s9PgmEVxrschJyscaM2MehAwfvUX46R4/Ca4eaGFjsDnhPSoTwbJIZTGJHjffsJPOD/SrSzvIbo3XiWsI+KiVEdQcxYOTjHmfU1DSaKTd0O/C2Bnia2uLhbgkOwaPaF45IwSfWnrDWNQs9UWS3+HuJd4RHDfnzwOfMdu9Vl2NhWG3x8qjbMrn5h6HNSLU3IVfFYI1tGGVowNw5yCPXmo4tO7Lu9Gi1vrvV9Rin0rU7mZgriMo6x4hYEZIwAc8H2rNT2T26S3UhlGZMryFDD14p5bi3hllkKzXjFi5ff3YnJJBqx1fWbfVPmgsEtAQCY05B48+3P0FVKbe2xRivgmWa9N3OnRmPWprK+aPDGZSYwc/lYjy471W6mmpWt2kto1lOpH7yW3AIbBHfHbvz65oaTaWGpRss0BtnUDbKWwTzxn/ALNaGysbzpESazeaVb6tZIdq3EV5GSBwF+Xls+WP8qMf3OkTK41bIVvBdRCWTSZ3tQFZpJROMRkDJ3AnlcZ7isjD1BNdvJbTl5JkYiGdJPyc+Qz2P1rUahqWk6p1FcXkcawWhX5/EKukTEDjg8rnz/lWe1LS7Ww1WSOLwJ42YOk9sxwR3wuQDge/pWkFFdkzlJ9Gj6f6r0S9sW0jqJNU1O8YlYASGKuTwFY4dT5YJK/SoyaPFeXV1DpKXw8PLGO7gEbBQeec9xxweTVJN03cPFDfidZkmBcKRhlwe+fT3re9AXt62nT2s18ssEBdhC0ZYo3uxGOckYz511xnGSpHPxknbMzDc32llo03Q3KDCN+Ur74P0prUr8zQGWa+mkmLn5Q5xjHJ/pXYtY0bRtT0h5JEjufh42ZGt5Qz25BJKqRz59jmsFZWHRmti5sF07U/i0Qlbonbg+rgHv7EUPGl2xqdro5hLcsJI2ZpWZCXVw2CKtdP6zvYJVjN9cRxtyTJK8kePTYcin9Q6L1u1uw76fI0ezbiH95uAJ5AXPHvWRmJ/aDRyKyhTyGGDnzGKTheiXka2bwappeq3iiVrW2L8lthVWP9qcPRbXyS3NhMssKcnwzvA+uBwKycUVsBtimEgbGSy8r9K1/RnS2u6lNNP01qjWs0YBbExiLD1/3h7c1lilOMqhJlT4zV5IoorrQL+BC/gM6jzTk/pUP4KaxwlxbyRnhsOpBwfrWn610Hrm0ubm81CKY20u1pvBTdCSO7KR+UHzAwMk1Yv1h09qmk6fa6npW6/jjSIuuQAg7YbP8AIg/UV3/iZxVTRyLxoyf2GHkga7cyIoxjAwKjSRBXYZ7YrSC0gkZvgbuHaCdqu20/TnvVJqFrcW91tljfxGXcBt7j1Fb4c8cnRlm8eWPsnWN7JbQouzxN6bee2M0m8szaQrI4PhyTMwKnIyPIGiTm0t0cCJVYh3PG3NS7hBdIyTBYxHFlVjbILcZOf++9bHOQEuUa8zEowAW2sO5xz7dq2vTFzpL2UqalbNc25tjiInaUfsGUg5wec5GO1YjQEN5rAtgqncGVcjhTj81arS40u7ZYoImKRTmA8ZIUdufrSZSJE9jDd2sQjIh+FYyrGzbmKgYwT9KsdCu2j0oKULotsF3AZByDz+lQbWVoHndUiZnBCpLnHfjgfwn9ak2lw6acbeCLBjeNXA7IuQSfpUso0MEEM1lAkjbymFUY8h2z9sVIa62XCbQSGIOPQiquWcGRSkhZl/wt64pyKfbqFpG5donZssTznvWMkbQY5q8jNpksr7gxdXBz6MKW1sSHCnO87mPpnt/SlamqNpnh5fDFuT/3605fQyW1t4gOH8Pv5cetZWa1bZkNXaT9o2M+0Mgd4m2e4OP5ip8lgk8ZZc4xnJ8xTU1h8fZxIkmwliVK/mVvI/rUu3W9W1X4q2IYAbjGQVJ8yPuCa2bMEr2ZnV0u9MdrhoTJbH50PbOB8wHuDzWku+p9eu9J0+5tLtjaCJYZZBCi9vyjd3Py44pu+0+G9lii+KSJzwUb3FOz21vYkwyD/VxIocKwUbSAM+g8+avkTx9yNpfUuoW6MLiw0u5ibKFJbRQchjyCuCOKDsLlZpY7WO1DncIUJKpn0zk1MvDoQRhYWOoRlBvDySq4c+YIwMfYmlm2EcTADbnuScj1ochJDdsg2jgdsGn7G0NvcTEd2HI/3RyP70uBAuNwIB9aO6ll07ULSQsFhaVYZMEEEMDg/Y4/WsmzSKosJNiweIpHhhg2QN3GO+Kj6KYrRtNkuHLH4iRYAn5lyMjOcDg+h9KEEgigbdGXEMjwuQceGB/0xUC7g0+C4aZmvEvInjEM6sAoHkduOfc59KcGOa9zpbdUWGs2gstShe3uDNtRwMbJO6tkdie/P9xVhpuqxWGox6dJMPnbdIDg4J7E8cA+fv8AcVza86kkXUFur2CGaV1W3lMCYBzyHHoc8FSCDzV9ptncXWmpeQEXLwbhCz/KJEb3Hp2x6j7VTYkW3XHTpurS9tbmzkazd0limgwZdxOOBnyyM/3rhGt6Pq3TM0lhewSRBm+R2QgOAcgqT2r0FaXl9qNpLa3JuILuKNUCxEEyoR6NxuB5z5iq3VtFt9cgFhq1yJRDbYCz5VwRyxYgHB7EH+tNSoUoWjz+L+5jcbZWI9CeKsIdbv7xYbVWkeVPkQryxPkKn9VdJjQpi8W6aEc4LjKDyGR+b6iqmBWWCXULW6ihmgdXWFQd4GfzA+gOP1rZJPZzu1o002l9Q/EJBtWVShctGwJRtudreYPA4rWaFpt5OkTahGLdIoyqRCTJLeTEjt6/b3rmml9VatZ3Utwl6WaVxLJuGRIR5HA4yOK6dpetHWbe2vLLw/hpCUlSRsSRN5fU+3vmqUYvsXJk/TOoYfhbm1jeaPUbRyFK5/eRZIJx6djmrLSbqS922qOsj3hEeCowQQQ2c/b+VZ/VIb6yePU9LZfibcMxjK8Sr/Ev1Pce9Q7XXbWK8truOWKCyvyCgHBim9fYZ4I9/asZ4q2jaGb2ZbDQrzSkjtLhSZsNyDlWwT2OB2x2pz4s2MMcjf7In5nHPhj/ABfrV3rNxftK2pQhpbR4C0sasMQcbS457g5+1Z5JomtHimAKEcgeYI5rlmqZ1Rei3kiSOaI4kMiD5kAwXHfj7U/IqTW8a3MiRvLkxS4BSRT/AAn0I/zp+0S31LTliRgl1axKYW3ZLKPIn+n2qLZSJJDPp9wyxrOf3TsuVR/X296Y3sO11K10S5mhulG+fau0vuikGeMf09qb1W96a1vUJtPuxG9xD865BAUMMcE+eD5fX6U+u2y5m0y5jcByoVsfNG3ng+YP+RrLXVzaw6jDcJKZ5dPURyJKNrzJ5jt+YMWIzziujGznyI3FrDaQRLa2YTwrfhUQ8Co15L4jBGCz2swAdQctk4HA8vOqAapo2n9SKbB5lkuLfaUE++PdkEfmPPGcfpSbDq+3uNTGyLFwOJlmVUGwA/MrDz9j966eRy0ZbqTRB0tfzQFRLY3GZYmPLK/p/wB/zxUUaQLe1iZofjI7mMSJ4RBK/wC72wSD/lxWv64ki1nQEaz8KSKSXcsi8ggccHybPlWGg1jUYFSC6fwvBPhqmANrrzyfcY59PpUgRrbQb2+VYYLack5LDwiCBnBxnGcccVCuNOubCdrSaCVZBkBXXbuAOM1oupNQvYHQzyySzTZIaC6zCseBxtHmPPNZ1EEufEuBnaxQFskn0xSGW+i2cGoh7Kwnw5QO0Mqgc+qnBziqKbTbuwuCxVBk7W5BAGfMVM0oyJctPHJJHLCpdGjGeR3B9jWgubeDXLYvPbQ2upqn+y3ApKp8wRz+lMQ90hqunWDC0lVR+YlmGQXJA4xxjFSesdHt5rcalapH+4YiQjsV8yPLNY1LS4tJ1t1jaGWQNsaZtocY7c9j6Vo9A1Kc6U9riJ5OWUSsQeBnHofoaLAzKxMkJneLfG42uWO5nUnv7EevFRpY2jlVVYnBG1yOQM+dWiQS2uqEpIYTcchA4CSAjyPYexqHMwtrgN+8jljJyu0IUPqR2ye/HFIDo1hfWuu6WtnczyyO6GKQMPmUgc8j7YrGxW1x0tqn+vK3wpbasn5g6Z/kR6U109rs3T2puJfngkI8RfY+Y/rWh6ze3v8ATySJYyoEsM/5oWB5zn/F5UwNJpWprp9ukEsjSWjZaC5U7gVJ7Hz/AMu1M3GpTWkyTWMkBNxlgqL+fHfI7+vIzWR6O1yC3lWxvkCxSnCSkD925/sf61p7/SfhXZpIhPE4CEMRkE+Y9DnzFAFNctbzjxobeysZAW8eF5VCkk/mwQcg/wAqkxdTNGvw01w8qxgKJYiD4Rx2OPzYx/32qLrGn2VppyFIhMBljNJtGw/7x5yapNJe2EUpaY248PCxNgkjyYcc4I7fp6UgNFBcXV60ki3cImVMRlyNkwOcnj+x4qmSa8t7b4O4sp2uNxLvjcHQnzI7gHzpMouk0+b9n3EcqBhcCOB/njOTuOMcj1qLBc3Ekb3kU9zGEOEnUfNHnsGxxg0DES6RdOs9zdyMpUmNWjG+MjHYnOR5eVR5vE1CGSdbeBliVUZUJDxAYAZvUVpdHtoOqNF/ZvjQxXsMhkjwdpkzyR25Bx9qjt0xdaWIr5rOS3whWZZWGyb247UCImhsurQHRp2a3jB8S3y2FR+5BJ8mx9jSLzRbjT7mO4iga0SJlaKXcHSVwScjz9BxVzp2mWGo6ylo8TRXKxMWt5FypHfKuO/kapdRsr+2do43lnEDM0cRYttA7kDsPp3oA2un9XWepwphJIZ3H5JBgEjg4Pnzmje8ZycscGudeO8tpa2yPNHtDyREAt+8PJrRdLXk9xYmO5JMkbcNnJYH/rmtIP2ZE1WzRCTdWd6zv2W1TTkiZ2uBuJBxgAjgepq1uNQt7NVa4mSMMdq7j+Y+gqp07p0dQdQ3C3UsgWUglhMu2Ne4I+b5semD9qJySQY4tuzM6Nr+odOzKYFkSDd+8+QbjxjB9u/FOXd3cXkEuovbQwRCVUW4jUgt/u49MVveoehppruI2VpLdXQysktvhVnUKMFl4Kj+44rn9/p14IZrWPTLiEiT5fmOAvmuDwWz24zWK2bO0zadOdQw3ugvo2o2lrqPgMGtoyp3YIPIPIyM9hyay+sXoOtFxYxzRXAUhjk+eCQcAjseDUKxtpNK/wBZh8SaDCqztGT8Pk8liO3PFWSanZLCXuZQphJij2IQZhnkq2MDHfmpdlaKpN0fxcquJYHKyDcPmJPBVvbBq6t9LudWZb7TQjeAuyfwnUuEx3ZM8/WtH0etyhkvriFrWz8ExRxOFXxMn8zD6etOax1RaR2L2enTwWryg5SOPaXXByoIGA2PWqUfklz+CD0/+G+m6jC17d6lBfRu5WPwXICeZU5wd3tSetrXQo7aHTJpXjlTm2WFPy8YyR/h4qr0HrvTtMhksxZTQQbty7DuZj5lsnv9KresNfstauLOewDfuUO4uNpBJ/L/ACq9IjZEk6Xgk3eDq0DxRcGR43A3Z/KMAn/rVPPbXLybljOHbw1ZUKqx7YHlVtpesWdg8h231zE4P+pl9sZPmWIPP6VXy6jcx3TzQbraNyWWOMnYo9hzS0VsXc9OarZyLG9oxfxPDAjIb5vTA5rU6Lqmm9OL8NqU16lwrlWMcrMhAOPy5458qpNDmvJ7szQ2ck7BSfEaXaqNjG8sf86clt5765luPiun4X8Mo+6YMX47nOctx3o6Jey91Hqfp+8vY7loILkK2zBiO5lI5P1GKptR6TWeY3OlXNvNbSKZEiDjfH57cZz7VVHTDevLcQT2FsowGD3KjLeZX64pqfRvhLaO4lvrKR3OVhik3sR55I7frRY0vgK20fULw5htZJVH5tv8P19Kds9H1HVpGtbW0ZpI+HwNgX/iJqwTrHVYLVYbea3iiiQINq4PP1JOfem7bq/qEQyw288km5gzShN7jPA5o0PZa2/4c3hiLXV5awtjhS35fcnzqDP01axxmO31i3upYgzzYG1UUe/nzVfeaxq2onbfXcz7T+RzgA/QUm1AYPC85jV+QMfKW8s+1FoVMa8NMkE7lHG4cURceWOKcYRrt8JnY4+bcoGD7e1CQqW+UEDA780ihM8qyBBHH4aqoHqWPmTTTNIqHY+3dwR7UvHNIZNzBs8DigBKptx249O1LGfWgQAcUfFABqyx7S285zwPKpmiaVHqt+LeS6W2TaWLNyfoB61Bxn6UarE8kSTyusRcbmRQSPpQJmwv9N6W0vxI/Be/njT508YqcDucjgfSs9PqtoHjlsLIwOjBlaR92APLtiqr4cuzMZC2SRnHf3oGF8DEhJHqKbYlEutc6gh12OI/s6G3uEGXmTuT6D2+tQbHVdQsGHwly8WMHgZBA8j6ioO2Q/wg0lt3G9njPsOKVjolXdxLfSPJcfvJZG3NIe+KjrHz3HFOYeIp8rbWGQSO49qMY/MO55oALBJ+U4Udh5UbH9aWo8/WgyAnIoGNn0zR7SBQ2nu3P0pWaAEEHBwP0oMxdl3geQHGMinPGZeF2ocFSw4JB9aNUkijmBMTqMKQWBPfuv8A0oAakcOF2xqmBg7SeffmiAx2FGqEkL/F2xV5B0vd28ct3qSG3toFDn5d5c+QGPL1p0JuhjSfAhs57trNb2dXVI4yeFzn5iB3HlWn6e1iTWpLrS7y1hiSJMBIlxg+f6VUWw0u4vI9RudQjgbb8sNsCrKVHl6Ctho9nbW0bG3aR2mIldpBhjkcZrSKMpMzlv0ZdTavJLqBX4dTkNHx4v0H8Pqa1gRIYtqKAFXAFUOo/tLWb2eOwlC2sYCrIjkfN558iPpUq5kt+ltM+Vprh2+WNJHLb2x5Z7Cq6Jdsg6z1XFojNFMfFvMf7FPyJ5jJ+lc/vb+XUbmSeVy8khLEn09KF8009zLJc7vGdiZA3cH0qOG2EnyIIrCUrZtCNBtIMgEdqEqOVDmNgnkccGm8ADGKJnITBZiB2XPFSaUNzMqucEngU/FHvQydlqJ3bmp8RzEEPbFIBhxk8cCmnBUcdqfkBVCFpjJ25NABKcHtihnPNAnPNJJGe2aBjgmwcBR/nUvTII7i5CyRmbjKqG27j6UzFBuIUsAucnjNPKBDMzReICex88UrCh260y2Vy8Uyf7y5zt9qh3NqyR7kUlF/M3pThaONj4mfm/w0i4fKkZ3+WSe1JuwSoiqu7vQ8RlbKnGKca4eSUF2BAAUYGMCmZMhjk5NAwNI0mNxyKFDsOaFAHTdQnkmldboOLZF+QgfNGPUf4h7UxcJDFDC8Cq5OeUYHIzxx6VZN1JNp2orItpCU2+GySjKsB9uPOmNUt7fYk9uqQ70Eiwj8uCew+1eBG7PdlQVrbyzSbom2y+EQmE3bsDJFRNG6ZkdrmQvdgpg74wCnPt51OsZvGBRYghCnB9T5/epdzhtPMdvfiK6J3kSRn5vYY/rUz+10hpXsrm0NJEkLyCRzgqQNpPP+H19s1F1PTNR061NwsoIkPyKp7KPUf996bur6aG6hjubnMZILbjyx9fbHlV7Jr2n21kzAm6/giUSDO0jnOaiXOO1sacWqejH2njm6Wch5Gcks0eA6NjjHkR6j+dWbX7RsI5xE2DkkHAxjJ59qmQ28Dt8bDHPaSBQeGymeeQO9P6vYRvDbXcaB5pFzI+zKq3mQPMVfqxk6aIUHFWmRtNmn1CeV7e3lMaLggglQPrTtxcPaSljGG3HZNFIqlNp8yP7jkVpem+sLHpiKCwuLWyvGcl/jLQ8NnP58qDkfTgVB6qSx1a48fTQ8FwwLvG6HDN24I4x3IocVH7osrlyVSRnB0vqhDXUVxDcQHu0bAbR5ZB8q0OgdI6pqGkjVLa1SWWJvmWQqC/lhR649ar9M0m9vv3U08MbFOFD43Y8seZqctreabdFtKvLlbpJMPtRg24dgQfzfeo9Rt1LY4wr8pcNe6jcNFbR2Uiy2ylY4kTZOoxjP+8COe3lVNpmu3Ggi8mjuZIJmdVYMgHzg5OV7eQ4PFM/tKXVstc/tE6jGD4Zydo9flwCDnJqpa4kF6s90BDMxBYyx/mPqR5mtI2mKStGzP4kXUDxTDRraBJXL3SxRYEo753eRpvqrqa5vrSa5h0mz2XEfzNCm55F9WPHNUtvo8upQmewjSeWQuxtY3w0W08jB4PqB35qJpOq2812pkvHtJvyJKQcxjPIbHOPsa6I5pGMsUehjTuo7vUi8moLcrKoEe6JypRAMKMDy7dqRqNnpMqPeNdXctxgEbl3PnzySPp65qx1m6+GkdhJZmPZ/9MIPzd8huBzms/pV7Nd2RYSBjDIArHA5+nmOeaptu5EcUqRK0K1tIdWtpJoviLLeviKVBIzx2PDDPl7V6B0TXYBpUdpBqFrq9wOE+FjSLC44+XPl7VxPqrS9PiayudIll+MA/wBYdsBJyR5Lngjy9qz2gx6tZQT/AA1ym9yVIyw2MPfHBq8GXgrTM8uLk6aPQnVHX9j0qPBe2lu7rZgwREDYPdjx9q89dSSRajqc1ylimnRu2RCjE+Gc8gE+WcnHlWhaO5uIJJGiDNOB4jF8lj59+c55rW9GdHaX1CHjubFyUX5rh51c5PrGwwR9O1OWd5Z8RrCsceRx2ORY5D87BSfzKea02l6skUCQS7ZSpP8AtGGMegrWz/gS/wC0Zv2ZrdlLZq3d2y6H/CwXjINRNQ/CC90aJ7641fSvBTkq0pQn6FhjPtSyePLtCh5CumR7Ow0DXbOaOXUF06YAyMsjFlGBjK459OOagarp8ngQGyubS4hVnDBG2tzgE4POOKpZIYo7xzIy4PKshzuHr6c0q105ppZJA6/IvzOCcgd8gf8AeaUPJyx1Y5eNjluibpVr+zbyVmDRzxxTBw3DA7eKudAkVun7hlLrIZM5H2B/lVbokl5cPK8ywTIyhXDrmQjtnJ5x37VdNZyWkKWNpC0cWfFUlSgBOTjLdxiuiHmxepGM/Cl3AQI13TqCIzGyRjecYA7DP3qLp9zLBqJ/fMit8gVv4sjGD96j398TNJKoYxHa444zULUb6Ke6V0LeGSHYdiGFdkZxkrizjlCUXUka7S42QurHJD5BA4bHB5+1Wtq5lvYJZV8NVUkA+R55IrJWOsqLS3LvggAZPrVnY6pHPdXSSOGJiCYPbGOfv3pTWiouns2TwLPZ2pjI8JpQzP5FSc5prUL1W0u5uJQFU5VVHY+lJeZ10mysrdVaFIv3rN7L5fyqALoXO1Au5Au1F9R5muZI6ZMKCAxwptTtyfY+dTJWeNRIEBGR5/rUiygMUO1lCnuFzTsaxSxlcqHBOQTz2q2Zow/VFyh1608ENmJ/DIXuQeRg/ery5tmLz2kpRpWj2fKwYHjI5HGf6GoGrQfD6uLwJBMY/D8SOUcbDlS32OKsrC3KL4qozIMMSi52qex4rT2M13RGhvmuDBb3Nyksjj4d3I2+KV4wffgf9anRmeVfBcQDw1OzEYBb2OMZrMxAR65dafvVVnmEsWRyp25DD3BA4rXWkou7dZSiq5BDgc4cHnHtjke1RJlxQUKqQnjDbgjds5IHsPOl3djDqMLwIW2OMglcHIOQceXNSBECNrYA8qdSMJj3G01Fl0Q7CS3s/i7q7Q3BZWFxbCL5gwGwkg8Z4BxnyqmujLY2cE8ZZw48NVL54HIBOO/fFOaMktpql8yuXweUl+ZXbzOPMEqeKkWEv7Qu5Ib1Ig0UjkxBdsZTPYDyHaqTJaIsdm1tDE9xcQSwSlQrRTHxEOMqTkZH17cVs9A/+h8k97ZR/DI0ckr2sUvjQSRgd8dw2RyuAecisvHqEUGpSwvY7Ghm3WzAndGu7Ozjhl8u3atVNBajVbm80mExXMRiu44DzGUZQTtAHGM8/WrslRLFtWgu7m0uIZWRAninw3P7jBwVY9wo8ie2fSpGtW+o3twngWy3BcYeQ/L4kZGNsi+eRwGXPPf1qPc21jc6U2uaZZS2zAMJI4TjwJAck480bkGndKuJTpNvuuDs3sLaZU3C24yOf8OflII4A9qF8DKrVugm1aO2uJ9wFiAFsw5cxMrfKinuUIORn7Vmp7OW/eSOPRbOznt7gq4uYxl0/wAS7e+fMGumvBezSR34ie2vrbJuIEbdHOpGNyY78c44rJass+s6gssECzXFqz5uohtR0H5s57nk8/T0rWEuOjLJj5bMzqXSCzLHcWd2bfUojlblECB/RWVeMe9Zez1HUdE16ae5t5VkR9+oW6rlHTylT3Gc8f8AzdFPhXkTR7g6Nw20/wCVQdW003aJcxRxftC3+aEk9/8AcJ9DzXTRylnDcpd2qz2sqSRyLuRgeGFZPqrSY5LN5bZ/BEshmMbqQN3AfB7DsG+xqf0/BDAnxGk5S0mdvHs5G/2EgPzbPTnuvb0q5v7SO/tXt5fytzkd1PrTewKDpnrm70XS2srsR3EsKmSIP8xeMqdyZ884BH0NVP8ApvNb3Uciwq9mBiFiv51B8/cZx9KqdS0q70ac2su2Pa2+CdCcMO4XPr6ZqLrFjJGIdWgwNPuiBIqgL4UuOcjtg+RFYuJopM6n03qwuNP/AGhb+G0UbgSQt32ny918v0q7uYT41xIp/dsVmgfHBQngj6dj7iuI6Brk+hXyTRqJoScvE+SrCuy6PrVlq3T1vdwkuqzFXhbugI+YZH2I+tc2SFbOrFk5aZNnhTUYjICq3Ea/KGHDf7v0Pl+lVhaw1fTrrTmtoReqy3MZCAC5xgYJ9fL64q4i0aaXL20jPC2RG4IyOM7WHkfT6VB1vR1It75VaCTcEkYHAViMcnyVvvTxjyrRxbWXmEUlpPCkUlqWC74+QGPKn1IwCKrpNSWexgtpY1MqElZgMFx6Fh39s/5Vu+qNBlvrtr63G3AIuEHJjcY+Yr3+v6isTqujC0t1kgnjlVTsdVPMbeYx6ehroOMnWNxe6bpk9oLaVrSVg8siLuaDtyCD5j/OmNXFrqeXjfxGUgGdj80wI4OP905qHb30tuU2zTqoIKvE+3BHcH2xn6VpZ9T6dtrc2sENwiSsAyeOZI8N/Eo7BgQOaYjK/GF447a4jQLGpXxQDuIzwc+WKUNNBUMJrVRgGNvEA3e2PI59eKtNXt7e4aS6tlkAt2VJMDAyQMkenPfyz9arLmO1tZHguIDKwThidrwt7DsQfQ+tAxm1u5NOvo54iQ8b7hg8HB5H37VotfnXTodPvrSWZIwfFiZeSIyeV+q5/lWTVcDBO4L+U+1WVhLa3Ihsb2QInibo3diAB/EvtuH86EJmh1jUdN1CNZpmtUvo4hJFIRy4PkRjGT6VSdPXsEV+UuY/EtpzseNiBgg5BHoQexpu9l0oWdxp8MchkgcvGz4wBnlQe5FV2YpbP5Yylynzbif9oM84+lMDZato+kXMfhWAlS6jkaJFlYbS+SfCIPYnJwexNVt90yH0omyJa4hjDSxGMgnk7gfQjy58sU3Jqt1qd/bXkcSrISm9h2kkUD8w7Z4H1+tbW71ezezW+kt5QzxmOWEISUBwWBXzx3x5jtQByuKKS4kjRfnl/IB5sfIVoun7lbtbjRrrNpbXWdiu5xE3pjHmaqNQtItMvmS3lMkDkSRSgECRPJh7inriWa+YSoNwmywCPllbsRnyJpAL6k6bm6d8D4i4R2YnwwvPyDzJxW16b1+21C3hsr+RfHWJT85/2h459jyPrSdL1B9RsYbPU1ZUZAYrkDO8A/Mp/wALjj/rTHUNjIl1HeW1m0sq4X9woI2+hXGPv9KaAtNT6dhnaZo8gEcx9gGzyfr71kL/AKantpRFp00YmLh0SUEEHzAb+ePMGtvpWsJcWyO8b9vmZh8w5xhvcVW9SWMSRCe03LLJubcDw4HJBHYEcdsUMZkdJuFmv3uLgp+0o0kDbxiN2xgHORgntnsc8+tCwuLOKSCS5fxEIK3dsud0YzzlSOQP7VN6dt7PUEnkvdu6JG5VcHa3B3Dz9seYxVRe2kHxgltLuRUClDctGw8QnsDjn2pCLC5ns9K1GHUdPmu0ZpcpFMoIRMcNnzHPH0INb6912dNKW6tIPjWdO0QJCuBk7h3ArA9MX0MsVzpGqxJNbLGTEWAPgEE5YHvj2H6VpdM1WaeKI6IqxG2kCyW2eGU8F8+YxjvTQDGtGTS411aT5LqQ70iQDAzx+buBjBqHp/WEt6rfGRNPbO+PEVRvjUDPzYxkf2qw600CfqFjJZmLxIHAl2nO1DzkisnaOLS6WyDC3WQ+HdPIw8JXGSGB44PbBNJjL/X9FFxNbTWhTc0ZkiMClQxHOfb1z7VRzdT3mpGB4oY4nhkUOsIxv+3vzWssepYNM00LHZ4S2QBHYkllB5wO+PTy5qqt9YsoNQV/2bDFPMGkCoQGjB8nJ7GmIoeoLoXOrQLIEdFcRpCWxgnG7I8+/wDKpen2Vst0/jTyQW1y+ROoAManjcMHnms/qty+qzz3ZmhSVpCSFUKyjyX3+tSNEv8AVWbwNMXEsjNliFKnjBwCD/Kokm2XBpKjeWusaj0pZSRy6ja6vpRlVTcQyElsDsw/MMjgjtxWc1/WdLviE03VrmOMENACpzEc8KxPJxk857EelOaP0tqkV6DezraWvLSCKQqxOMYGf1q8fo3SDPFP4U8pQfLhgB9zTUBSnZzxbu/W7NpdS+OsxUSKsm7xB37+uefWtPF07banHaXNyqW1pbnw3aUbWJz+Uc429ue4OanpeWlnczR2dtbiRyVjMY/2p7jJ8z96lzB9QtP2fdwKhhXxGjnjxE49CfUd8g1SjRLdlF1Br0kNjJFpiLFaKWCTb97E557k4z71iJZ7hj4pVkYMCW24wT2NX3jqLyCzsrUSPuKukbB4ZexH1wfL+dbS+6Q0nUJvibuCTxmVdxEjALx2AzwKKbBNI5RJO91ctJcSNI7ZJY8En1pxnUkk5LHzroi/h7ojPvSS5Ck52iUEf0zTd5+HNjLzaXM8DeQfDgf3pcGPmjn0Xwqv++W4PvEwGP1FOXK2wA+DebY35kkIOMeeQBWiuPw+v4p2XxVePA2PGOW9eD2rOzWU9gwa5tZ12sPlmRlVvbP+VLiOyZY9P61rkDy2sMk8UZCcuAPoATUpugNcRkj+CyxGS6yqU+lS7WxjYQahYayIYwyu8NsjuY29ApOTWm1C46hntre5s1e4wS6bQ0DH2kTnP6iqSJbM9afhpqUsa/ET29ufMZLn+XFWU/4X25K+BqMqjb8wdA25vUdsCn7fre5sb42eu2Is2CBgVySPU+efoKf1bVb3VtWg0rSbsWg8EzSSH5Xb0XBqqiLYmDojQNHsmm1IC428vLISB34woNZDqPUtPvrqJdKgNtbRIU2gbdxznOP0rSarqGrdPSWYnZNSSJPEmXYxGewJY559Kxl9Kt1dzXUKy+G77suMkE+RNS6HEm6R8LcSQWdxApRpCWm37WC44GTwAO5p3qDT7TTtTNtZzCWMIhL5yAxHPIp2bRVs7WC+e8itZmAJhB3cEeQ+nlzk+lQbki18OaOdZ2mjJ3AYMfkQRSGS7HRoNUdY7bUrdZNoLCf93z/u+v8AWla70tf6JGLiVopLcsEDoeckZ7VROwVeR29q0/TPU1np8Esd6kjCRdrrt3iTyA5OBgfrQg2ZtmwMetHkKAKfvHtpbyR7WE29tnKoWzimGmhMUiuG8Q4KOGwB6gjHNIYDzRYzSZWiChYpHkJALMw24PmMeYpKMw/KTn2oGTLGwm1CcQwbS5BJ3HAAHck+lRgjvKE2Bj2AU9z5VLiMkcF29tdfDhYhvikYB5snkLgfeq92mRsNs+XHIIIAoAekBhcoWUkeanINEjZ+XzPapFjpl5fRtPHaXNxGDhjbrnBpEKz2xkbDROuAQyHPfP27UCES20qTOu4Bo+GUn+nrTbbgM4bHnkVMfTbuFDO8MgTaJC23gA9iT2qWdEnGiyapO6RQDhAR8zknH2FOgsqwVxk9jxTeNh4OR51Z2PTOq38MssEBYRYwpIG4kZwM+eDV7Y9DTfunuJGijMO6RhywbvtA9qOLFyRlBkLUrTdJudXlljtyN0ab+e59ABR3doLWa4AIQRybfCbO7Bzgmrjp/SrlLGTVIbU3E/K265xsPm3v7UJA3RnCrqSj5BUkEehpxEtjE5lllSUflCoCp+pzxU2+s7jSUktruDbLLtk8YseR3I9CeaLTNEvtYYm2jBRSAztwq5/rRTDkMH9mnT1wtz8bzuIwE78fyqdomhjWoGWG2kWSM/NOZflyRwAuP71L6h0Gx0i2RIfFebu8hbhR5DHvUWPXYtM8BNHUxqFIllkXLOxxkgZxx5VVfJLd9FhadP2HT0yXev3ER5/cwplskedTNa1mLXNCiEDSxLcytEQGAwRz83tUbqy3jk6dsbu8lCXqgcPw0gPcY9R3rF3epfEOAseyNRhEznH/AFobrQJXstZbLS4lQ/GyXrABnWCPGM+WSK3mjQzW2hgOEtHlU+GkkhYx5HAJJ/pXPdD1I2F4kws0nlRcRDdgBie7Ueva58fI/jTG4uhgeInyxRgfwqPP6mhSSBxbZdN1g+krJaQ/66yEKsjYVFx3wo5x9aodU128v3WediZCfldT8q48lHliqmEF5gxdkz6DJNSdT3I8UZVUULxGDkr9feoc2y1FIY3tM5LMTnnJNLaLaqOzoA44AOSPrTLDilCZfC2NHkg5DZ7D0xUlAlKI2A4YZxkedMOwZ+OwoOTg+ppA+Uc0hhA5YVKVtqHNQwfmp0ZLBaAHRIN4z2NCba2TjGO1IoshhgZJ+lADZ5OOaftbUyyKO5z2qRbadLKQxYIvm7dl+tSjNZW1u4i8RpcjafI+uPSkOyP4DK5VVL4447Ud3GilIld2cfm4wQfQUw93cOyxoGRuwjGeKlp4mmMhEu67AOeN3h/5mmAiFreMSRXFszNjgg4bPvmo0xVtxVQoJyVHlTxkeVnmdSzseWPJzSRGiRPO7I2Tgq+cjPmPpSAgbDvAUfNngUjeW/N3qV4yuQiDAH5eM5NHqdvIPDu/C2RzDtjG1hwRSoLIjtuGPShRAYNCgZ2jXoJ+opor+3SG24RXEbbxk8ZJ7/rVVeWcMEhtBdPlVBXeOMnuOM48/wCVZyzurqFiLbxF2EBwDkEehFa221i0vbM+JYRSTjaRMjMpUjuD644rwYxcXR7zkpbK9E+DlSOV/k2k7s4zz5VdHS21mzjltYt00HLrnsAe5xyPPntSLjQLe8UTQTrdu4yzWqt8pHkQRgHFV8lveWdsi3K6hbRxORHIYSACfIEetRkq9jirWgtQ6Uupgs0QVpCMSA4IC48uaz7aVdqWeUxCHbktnhT/AE8q00M9zbNFLvWdZhu74AJ4xz6/WpZitb/SprmRBC5lKyQHLBcevsfI1GOc7pvQsmOMjL2ckKWZdLh9xH5RzuHtVrp6TNCc7zEQdqE4OKrWtBbRCIs429lHYg9h3qTGzZCK54P5Tx9810vFGW0ZQbjokGMvCokQMMja8f8ADn1xz9ak2vVC6ZIkF5AskY8zuw3seex9u1JguAI/CO1xkHkAkn60+NKsb1ssrxhlI3KwIU59PrWM0o/mRsm30xGp9Q6Za3y3Vham1srglkSFi4U+jZ8/Opv+k2mutvcyPN44IInUkMccYI8/rUIW8VvZpYTXEMkMjlMBc7Me3n9jUPUYreEwiW3EchOC8QCqcH/D6/pWTcZOyraVG0t9T0l4blp4pJDcxhi7KfEHIwRnv51kdTRtTdba7aK4igISC7KfMo5IDZ7j2ppZ5naNI7iWeE/MinKlBnkD0GautQt4L5FSVo7aQ4DHxACfqDScnFqmNR5IE8c2kwy3cdpEsSFN4V2TxGKj5wCc5I7jGM9jVJfXFlIj3YiCneA6IBls859vrVsNJaGZLu7W3u7X8hDszDGMEDng8+lQHjtGnEUKR3VsH2kBPCn2jyPOM+tODV2S7RDuUtbrTWDlUinAXB5K/wDfvVTpFqz2v7OmsmkuS7iEDAUjGAcjvzWuuOlr4WEV3p1lcXliSdzRIWMLg/lcdxx59iKojcxzalNHbQPCVUKWI2gc+WffzrrTajVaZjJJu/cXf6W0cKt4S+I5Kje2WYqOceQpKvOumM8JbeDypGPapDqyzuZpFkcRbxjLLkjA5+tJhkjjh+WVmdkAYHkKxOTj9DULobYWgP4Kx/tAssEkgUyAkheCfLzOAPvUjWOqoTGba1thZxRsWjnll2MR2xnPI49ftUWR2gt13hFjWQyBl7E7ewHrVDe3tt1HC4nla2SDB3N8uCfbzrTGre1oynKlV7LGf8UNR0+yis9HmFs0Tbmkt4QpmOc5Zu5xVLqmtXmtXTX2o3DG4uv3jBeFx5YHYVVzLZJKsNp4ku7AyTx75qSYXnu47cRb3VM4HAVRXff20jiS3Y6ksVu6EylVc43PyAKvLexujDDcS+FJFKudyna23PfB78VSzWKSJLEycqviD0otOu5beER3VwyeGMIATkeeBXNKCkrR0Qm4umWzbJFMkTFBGRjj8w7Vf6ffslgFjkklCv8AMlw25Ppz29ves/YyC72qC+R+UjALH/OrBJZLWWSGRELY7uPzefeuPLH2O2Er2jRQ6xDfys0kEbqyhJd6fKCOwx5VTXmjxXJuHieG3kh+fBbh19vpTCiPxCzBSCdzc7T9sd6cjvUgiaB0YQP+VnAYqPY9xWeOcscrgypxjNVNFPdS3FrEg2nAYduRn61I03Wmgv0kLKwIKkMMAhhg/WrNtOi1RAsPhQfIE2ISBIR/Fz51mtS057KYbWZ4fy7iOx9DXt+N5ccv2vs8fyPFlj+9dHQpeqTHBLBG2R4SoB2IJXJOf0o9D6ns5HmYsNyfLjIAX6VztJ51hkVW3FvLuaZ02/ls7gAOynJz5d66vTRzeozrln1DHJePFO6NJJ82SPzAEdqv/Es5GMmFIYYIz5etcaOqBpBLIG/4l4ZG/wAQP9atLXqy6hkKSEMSOGHAYfT1pPH8DWT5L/q2wX4y2eGVTGY2jIzk98/errp65tv2daQvHkuuMowAYjuR9e9c51bX5Jp4JAOFyCB50/Za9CltZR7zHLDIDvHmQc/oRmhw1QKW7Nrq2ntNeQXPhqj+IFbBxxkjv5VJW5bTdaYMwaGUotxgghJT+V+OMMMg+9RdP16HUnED/vlL5wvZhnsPStCuqWM/xNlpelCziu0AlaSQyu204xz29eKyars2TvonYUgZx7ZoxnGe5piB9gHiDcpyOaKPxdzxHBC4Kt/iU9vuMYrI1F4sdMhFy1vvZ7hi85kIeFfzY2gYIJ86i3NmU1KPUEVWVj86gZyD3J9QeKurOwS+QS3F3axxg4cTShWwPapeo3nSNnBBBpziaXPhKniM20+pOMH6E1aXuSUjx2t5qUT3EEkcTcGZOEBBJXsDs8hnOMZp4WlxqsLPbGNJrCJY5YV4MqZPzr647ECp19qjT6fdxWlxa2NqrKJ4fE2mft2HOftRWlpGLUyXTOsqxrKfBmKywLk4bIyH4IJHFADWj9Q3eiyu1siHIG+Fj8si/wBj70iC+t9TsFh068UfHHdLaSEp8PMGIIyOwJGOO+fKq65ia2nY48R08423AqeQQR5f50UVvFBuuLUW3jsVcsG/eAA+YHODx39KlSG42aR7e4gu4PDnuLWW3wFUyFmIA5jB7MM/lbzxtJBwanNrxjtbmObwZL+zmzHLBGBvgbALFfPv8y98VXtrtrJ8PeNGk80hKzwS9vF8pVP8JOASOORSrnQl6jvIZTtsb+Lm5tIn8MXCE/mU+R+v2PNaKVkNGXuoBDrMl1bzzJZxKfFgR9ywq3Zxjkpnz8vPvTes61caXdW7eEk1jMjAOgy/iAZAHOMEZP8AKnRZ6t0PeNHPAto4nZI5yomEkLtxk4G/z4NK1TTNP1HRJFkeGzkjYAhsrHMp7EAflcE8MvcHkGtceWvtZjkw/wB0RFrbrbXLarDdqbW6hDyR7SAzj+Mc8EgVKOr272k13BMHihzvCjdjHJ4+lZ3pPdd6de6FfhR8K+1CjEMUPIYH69iKsdJ0V9FlldJlk8YBZBt2h8Zw/HZsHnyNdSd7RzNezJ+prbX2kTO37yIRmRWQBjjuCKzzn9nwb0MN/o00YM0DnspPcfc960mnottAIFRUEXCgflb6f5Vn9QsW0rU4YbONfAui0iDGdrAZZOePmz/0NJggf6EaLqls11pU80KScKoORGR3BB57+War+ltTuemtXW2a4gls5ZfCmYElUJOAxx2q00q4e0mae0jCxxkJc26Ljv8Axbc5DD08x2Jo9W0+0tIbq7TYz3oXbJjgheefr/aplFNFRk07OqaCPgL24t/FRskBXzlCfLn0J/SpV9awXlvJLHHtOTHNbu3AJ8j7eh8qwf4a9SNeW0ukXiFlRdxA5faDww9xkfY1srwSwyLNFIjShRnHInT+5/78q5vy6Oy+WzmvUdpq1jrXx1nK7PBKImiPDMhPBPkRzg5/vULWNMh1KU6jaRFJ1Gy6tAoVsZwSPXH+RrqGr6PHfWjXIiBugAcHnxUPcHy7VjNU0KbMd5pbhLiFvERG7SA94yT5enoa3g7ObJGmcimtkhuZoGTKA4KZ5HuKj3GPCRRnKghs9ifI10fUdGGs2i6lYAxXkeZHhbCyLt4bB/xLjBHbFYe9tpLOYSHBgmyVYj5X8yMeRHpVNGYzbX15ZRRrBKzoFKyqg/hPfcfMEcH6VcMsXUkaJdbbRxlLOdhlSB/4Tt547gnnGRVMs09hPHc20gjlT5gVOcj0xV3Z3VlrOmXUMIitZ9vxC22SEeRRjI81b6cHHljlAVd3p95pk/wd5ZK0yEMVznxFI4II7jvyKqbhUuRlOAuGUgfyNXUNzca5bwWN3MyPGpS3uXYgx+e0+eP86q2iks5Fkm5VjnI7MfagZGMpSRZlk3Pg5BGdoHofOn4nSGEiQh4blCAwHMbjt/370yUt45WieN1VxuiYeR9xTtzbtFalgxcSEGREX5Yjng+2f86BD+l6hNH48Hzt46FAUHIPGMDz7YwfWrLpbqGfTr5rWRvn3BXt34WVfQZ7MMnjz7VnxJLECFyjovlxnnnPvTpt7a/LS3Es8cvH70fPuYnzzQBsNfsbHU7eSWwk221sd3ynJtnB5+QD8vvVBYTGzk+EngjzcMCXAwd+PI9sEY9qlaN8dpOoW8kJkMjKfGKfOsiDnd/vDHcD386TrsVoLW4ubKEJDNIio/iZEbYyUK+R9D5g0AbXS5oLmCO1kkWWaKQMGQgHnO1zjz42t7j3qzvGkASJ7bxwVO5OCXX/AHT6j0NYzpvV3ha3vpAzPGmAQ2A5Pysp9iRn0yRW8mhh1a0SVHADYdG7lff9e4qkBU2mp6RFneH23QMW/ZgEjspHk39aptYsruzf4cRifTZSrkx5aQAH25HGeasLmdtPvvAvbKC5S5YLNJ+VXA7Njt/cU1elbDTj4G6SAOdshbJiB7qT+mPWkwKm+0FNEuPiQzm2mDCBo1/2gPO127Ak+v8ALFWFyH6k0aK1uRDBO5H7wLjdnjDcdxxz/Sqa61jUE097UyRfDSSLgSpuC/72cYIPmPvU2wtpdIZmk8Xx1AHgBdyuPPafPj38hSAg2Dwpe/sm7gjg1LARLqVAQ+OyuO2T5MKbtdTk6furu3ktiyEsIx28J/TtnFW9+jyytItq95bjBKugLIRyCvPbzwaTENRvbmGNhEZjhVMiZZV5I57Zzx9KLGPaFfzRM96izFxxKWbaJgRyGHbcvcGq69m0+2MrjwzbTSK7QyKH2kZ5VT74Navpbpue+vpodWtGvEiJkfwQUGPUFiBx54rRS9LyXBdWjtJAzkxsiq2xR2Xkcg9z27nFJSsrgci1bV7sLItqwkaQYGDggH0U/wBqrdNspJneOaaSGVxlWVBIc/1ziuuato2j6bq1r8RCkcW3cJEk2/NjsBjkHHbIp+PQLG+syYEaAmTxI5rc/I3bBPrTJo5K3SC21zB4948kTEn5Y8kj2OO/1q7urTS9ONn4RklNqxdI8hQCe5wMZrUaz0zdNcxGC9uy24KwVBtY/QDz/SqrqTT47KyFrBayR4TMjSLg49yPv25pipmb1PXr+8njtgFBGcqR8qkggbj5YrQdNPqNzZvBqbwy4yAY352+hHf3zVPbSWyLY2tzGHeYM8YQbS48t2R3+tSIbyKHUvFmMFt4ILBH3FyMAd+1NEsnrHpGkXdxLaxN8Wh27S57nyXPFKOoxybraeCXwvys7HapJHIBzk1R28A1SOOd4bgW/ivJ4hblmzwefLFL1VJrxTbWunW8luyqzTyNtOR7D83HpTGaPR4rC1t4oLGARwbS6ODuByfU85pE+qxXE3gWYa4lDBXRVIC/8TYwKqhcfsR4Y7soZFUBWjyEC4wAMnJ9xg4qe1+XtrZt8kO8tv8AhxtA2jOcsM496LFQSXps2Vr3arPnIXO1PPBPrUu11E3EzExGK3A/PIcNn6diD6g1mtRvzr1nHb6fK1vJnc6Ip3kg8EHHPnU7xY9Gtglzdm6mVgQhOGbI4Xn+vlTTFRaXdrd3M7va6kIY3T5VWJWwfXJ8vahHYzXdr4OqyR3BxgmLcqt9R2pVpfrcIWkjFv2I3AgkH1qYtMQx4lnp7W1oiJH4xKRoiccDJ+1U3UPVdxpGqQWFraR3DSoD8zEfMTgfarq9lngjD29qLmTO1V3Bce5J8q5drWoy65cT3E22OeL5BFGC21RnLZ9BUydFRVnUrq2tr2P4e7t4nlkiwwxkgefPcc/0rnWq9NX/AE7qIurUy3CZ8RJhGWaMjyPf9aldK9XRae622o3kjwsuF3Dds54BPfH+dbu0v4L2ETW8u9CSAx4z/ejTDcWYbUevjqWmTWy2rwzTJ4Z+YFfc+oNZPACMuWGCOPI1petdBfT719QiUfDTn5gB+R/8jWX96h9mi6LOO9iXS/CulkuZFJW3DSHZCPPgedV3kDkc0t55DCsZ/ICSMep7/wBBSE+Qg8fLzz50gFNbyLN4Txv4g42Y5zUnTIbF5XOp3MtrGp2qY495J+nkKhlpHdViJ3MwVcd8+1Kmi5CtuDKMMD5GgY5ILJbpxH8RJbZ+XJCsRnk9qbvBaPOzWUc6Q+QmYM38qCwFvOhtwcYAx6UANxwlmCoNzE4p/wCCuE8MzQsqOCxO0/KM4yfQUSBVYM4zg9s4q0SHVNSilcsGXZ83iOMhBzxnkgUCJll0bBqgkay1N5DGdrf6ucKcZ7k1A1nRY9Ekjha6iup3XDqq8R/elw9T3cMItYZDbweGRstwF3OR3Ld/vUfTdMuNUuGEaTOigs7Ku8jjzqiSxtbiLSdJ+M064EV1nw3JX82RyF/4Rjn3qb0zpt9r0T/EXswsfyuitzIc8g+1RbTTxqBBjgk8GJCkETggyv8AxMx/hA7n2GKeaO6abTtA0+6CMF33DQNxuJySSO+BimhNlpLbSXEfwc9z4GixzeDGp5kkYHhc/wCHP9K0clpa3VtHA8KvBGVKoRwCvbilpBHFEkSqNqflBHb3+tKrRJGbYUcSRRlEQKuSce570U4keF/CYJIVIVsZ2n1xS+aLdTA51Npl+ZrjS5IfHuidySIR83OS7E8nvW30W0nsNNgt5yhaJAoKkn9c1JS1hS4kuVRfFkUKz+ZA7CnDzSSobdjE9ja3MviTQJKxXad4zx6U7GiQoERQqgYAHGKVkDk9vWqzT9ettTupILeKc+Hn94yYQ496YhvWNG/bU0CzlVt4WLkqfmc47Yxx9aqNbuun+lo1jXT4Zrvh0jIyfZix8q0OrapbaRZtdXTYQcADux9B71yPXdXl1vUJb2Vdu7hV/wAKjsKzm0ui4KxOq6vdaxePd3chZjwFH5VHoB5VFgj8WdFZtqk8t6Clw23jKMI7ySHaijzNTdVtU0uBbIENcnDTkdl9FH96yr3Nf0Gb288VXit41W1Vsr8uGPlkmnNE0xb+7AnOIV5b1b0A+tQGkaYxqeyjaP1q2XU20xNtkBDMoAZ2O5yceXkKAaIt1ZvbXEgRHVFbALjaR7YqPMzOQXfcQMfQUdxPLdYZ3d27kuc/pTe3HJ9KTGETgZNN7iec0bksMCkE8Uhh8Z5NIf2oyM96Uqj8zcDyoASkRLCpJCQL8xy2O1NhWKlh6cYoCFO7Ek+9Kx0NfNITgedS7OGLJEsgz3OATikE4UKMYqw0PSZdWuAVj226sN7/AOIf4RQlbpCbSVshz3bHOwbkzgjPFSNKsoLt3+JmaMcBdmCS3kMVJ1myikvzbWNuixQcEoD388k03cXNvb24tLGMYx+9nb8zn2PkKqqYrtaENt09pVSYyTuNruRwvsPf3qIzt3BwfXzpcQVnVWYKoP2pue5SRsKCADgYwOKlspCWmcRqPmwOck4qw03RpNUj3sfDj9M5LfT0qAifESCJGAQclpDwnvV7Z3cumxGzif4kBxtESYOO55PeqgleyZtpaHv9E7OK3bY7tNkbXY/lx9Kl6xBBLphilYImNpcfwkDv7/Shf6n8LGjsrDcQACOQPfyzVdNfxXuq2sbODCG3HHOWxxWz4pUjBcntmXntprSQRTxtG2MjIxketCtxqmmRashjlyrD8snmtCoeJp6NY5U1stNDs2fRmjn8K4uGlMaxuBvgGMhvI4PIqDcX1poV7BFqunapapNH4kSJKvzHOC3btkfWnp7WE3HiadfW07RONrEt83urMO3sarOp9U1DWpYv2tHFPLZAxRSRnYVXOfLuPevnsc1N/ce9OMor7TadL9b6Faa9Dbs1zayyRfCvLgMkpcY57jOCBniru6ml0Znsbu5e4sLshoXmXxFGCQVPn6edcXTRbrUJGNmAJMbtpfufIg+tdCuuq4ta6Xt9Nu3WO7typWRQxXcBg5B9R5jzpeTjg0uLDx5zv7i+gt9CuMJLp8ULRKWY25KiUn13Z+wrLz+JBPsE4mWQnKxoUMbZ4Hl7VEhurxwYWjFwiLjhsNt9iOanWbXy5MQiuV3jfFcBfERvTnkg8YIrnhA6ZSGZZlnCRzxEBSF+vvUVNoLDad2cAnzqfeqPEj+eS23AttwSM555ptFd2Z2QnwsBD2+bFdMZUZSViIoxPG6ldoBGTjnPpUJkk0y8gnlnLQFyjQxylH5Hc8Ed6ureW1u5FWaS3tpEbIV2IErf2otT0SW9nkxOFtxh32bZAq+uP8qHlS7JeO+gX5t5QkUT210kQSUPb7hJGMYw68+wyP5UjWNOv42FzFELmGREZhnOxQByAOah2VnLbFrkTRMeTHJC+w7RxyR9qu0ku7TVEv4LqdmeMeHC3zRg47isJ8VtFRcmtke0hgN2g+USxxlgYzlSvcfNypHP2xTyxtNIWnkjZpSFiZ0OAfc9qbm227xNAiiMAqYdxOwnk4B8jSpIElJMAeKUKWVmXgH3FZSgm1KJrCTSpkKxgvtNkuGhnDjP8EnAOf8ACe9WZnku547mW2S8QDxHnRSGTjBD8DOKqoIryI3P7StS8OVUljwF75H6VY2em6ZH/rVleyNEhzhMndny9/eok67HGpLQ3NYSm0meNZGkUggh9oK54I7YPtVdDb2eo6gqXT3FrAsRZpihOGzwuKt7y8t9LvGFndC4jkiBeIjAV+cqR/cVFvLiz1cQuUlt3ABLEHcB5jjuAc1pjySXZE4r2KPd4F1cRWt0k1sAEYkkKfmGOPX3p69ia3iMcaMysd3hoRnPPGfvU2GyGlxvJEY7mIfNgLlnJ7ZB9CaXrVobmGNpnS3ZkV1lGF2/xEY/pXSppvRk40itRPE0hhPFNBKjAbom5jH0Oc59azWrXiiUW7QKEAALKu0ye59a2TxXMM+IJopUMSkgFirA+efX19DVJqmnC9nZbwCO6Vd+1VIOO/A9x51WKaUnZnmi3HRTQ21sb1Jo2EchwAvcdvOm9ZiuUumuWUZmG1hGcH+XapPT9nDfa0iZVkDAlz5EEcfem5Hjt9Sba3jSNu3KTkKPQj1rrun8nLVxKu2F3LOkZdiU5BLf3q+ureGKSGX4j4j4gZYquQhI4XPr60yZYo7nCITuTK/3/wDnpzUN4lQvEPDQ5yvGSPXyqZScmtUOKpMc0i6Ww1aNbhfEtkByrLhsntz7GrK+1F7xQ6W374sflBycdqrYbqy1FxFFLIJ3zkdwCfejtrC70/Y0ku5Q/wAuePEx3ArHIk3ctM2xyaVLaLP4ZmAR22NjJjcEHPng+tIinkVw5UEZIHnkDv37ipMljJPGbgyeIGyrM75OeDj680oaXcRxJJdwyCJAD+7YZGfMVzPizpSYzHLbTSoqSCBSMEseBntz5Ve6R06L2K7hvrlMqVC7CGSRSM5DA4JHpWV1O0IlWaHeLfOEcDBxnzxUlEeK4tJElMkMhxIudqsPUj+/tWmOKTuzObfVEjVOjr+yLz2n+sxxxiVmX5WjU+oP9qztzaQ4M6z72LYwRgsMZzXS7XU5Y3MM8yykoBE7L8rIBwpx9eRWJ1ezhD3fwiH4dZSUfkYHkMGvV8byeX2y7PN8jxuC5R6K2PBXFEcquDnA4B9KagkJyPOrOzSNl2uoOQTk12nGlZXO/iALnDqe1FHGGV0XII5B9DSrhCGDAYK03BL4cxI/KfOgCVYX1zahJIpDG6N39DXS9C1K5vbFdYgKyxKDHMADugkJyARjsfI+9cwQ7JG9DzUvR5J/2glpFefDIzhjLvKFAPMY8/aplBS7KjNxOxad1dpdtuSeKC9ztbIJ4PmpHHII5586et9TS5eRkIiiViY41YkRg4OBn61iLzSkv4/jrTXUuUO1C7W+3PBIZiO7cYyaVYwa5FdW1lPg+LxEm8Hd55AHNZSxa0axyu9nQnmMqhT4f7sfKQoB596jujSB44obbepGSi/Nz3J571nLTVri3jT4u1mhDHG6RSoJx2yao+rrg+NJqNs8tvemHaWiYjLLj09vrWXpuzb1FRttXtbiJvh8Q55Y5XcWYcjkGl6Xrc0c7vA7280QJGOVOeDx5jnkVB0mW4ms1eWV3XasoyRlRgH+9L8Y2mGdUWMSFsyZAZf05zzUvTopbVljo+pXlreNcXNugvH/ACnPyk+fA7gjIx9Kkx6fbyxG+ggnFxvZQ0ZBVUByEx34yftUrRNHu72N9Qa1At4dxSUksgI8+eQPpWg0zS7S0skvZpcxyxuzQJNsjPOA6sDj7Z4oURlBoUEF/dQR3cQSIPjZsPzx/wCMN6A5HqDWjfp2SO+hu7EXT2gbw8DBKxsPL/EnI9xz7VXxdWaRY6pGZdPe3lCGLxpyXki57EZwQcnmtFBrM3jLFfWsSoQDBeW+ShB4VseQ7A+nnxzWkFGjOTZX9XaJPJpEWnNKkgWRpIZJWAPAyEBPAPJ4yOKy99A+m6JBdTQQJLHEY54TGsgYnOcscYA7c+2DXSJdQhKTI1zDKWOPBkXKg/4fXB5xnzqvltIL+yD6eI7mHYVa2LZ8NuRgk8gdxgiqlBN6Em1o5tbWcllbKXXbIEDTIVIMZ9Poe49qKWRn4VseuakXljp2lXMjWVlcC3ugC0LsQ4iAw6KOxKsAQfar286abUdNe/0u0aNYlBVWwPEXAzkAnGPXz+oq8OSvtZnmx39yMrA8gYbnZiOOacmlLjMkInjVgSu3lSPMU2YLu3wt5EIZhyVAIGPv/WlxvtPy+fpXTdnKMXGn2s0puYD/AKxt+V/ML6H/ABD2PbyqLIiXttNbfOWB/eQOcEnyZD6+h8/PnmrRgnBHygeY8qZkgjK/Ou9R2Kjk/SgDL6DLe9OdQW18oeVIiUk8IkHYRghh3U4PY8V1/QtXS/t/iYpkubJ3zHKODG/nlf4efL61z25s1uGW6t5NtxH/ALKY+YH8DjzU/qKrun+pX0bXZ1v4jbW8mRPDGBtkQ9iMdyD5jy9xWWSF9GuPJWmdzuklktkurZVEkXyvEOx/6e4rKatEsFwbpVkiikw0kQXLRk9nGO6+tWemazbkwNFdjEib7aZT8s0R9R2DA5BH/SntVjO8TSqU43FhztPqp81Pp+tZRlR0SjaMlqGlGWTx4dsd4nI5+SQEYIPqCPPuKxV/YxR2tzGYmeDxMSW0pw0beYB8m7EHsR9a6hc2kb2zSRK6mPllTnKnncvt7VR3NnbTXIlfwWldDG4P5bhPQg+fp6fSuhbVnI006OO3OmzYee0DXNuhysgGCQfJh5NQ0f4OW9tXlAZN43x/l3AHOGP98fWtTqvT91oNw+o6MztbqcSwlvmj88H1H/fNZjVbdJ5JtRsYwY2BeWIfw57nvQBC1O6hn1Ke4t4DbbpG3RA5C8+XpUvSrm1zNBqC+NbSjBQfnRvJ0PYEdj6g1XyIsv7+JSAcDuT9jSSriHAJEfOCRwGHce+PSkA5fWMlk81qWilUAOhbhiuf5HuCPIg1JmPh6StyisJ0ARhuyrIeVfPseOaXaQPeLBbPFHIiyCR5VJ3ImQG+3/z0+mm3ME11anEKxkr+bKkE8Y9QRigRAghW9ga8hdXkO55oezJg91HmMU2LQFHeIZUHJjYAhR28ueKVqOly6deLJAzSuuQwX5iD6g+YI7fpTNvdPp9wrqWkQr8zdw2fb6dx7UAQ7S6ls7vHjPEVbchjPCsOxFaW2u1ntbqeNC9rdbUulztSGQ/lfH+H+hz7VnbnT4h4pUnxC+UwOAvr9KsNEmNut0hQhkTbcRHBDp5+2e2KAG57ObTnFu8yrGsrRkKd23t39jxyK3f4f3072+oq3iPB4wKIF4BI5I/vWJl8YmKBkIjbhGk4LL9SPTH6VutOvhY3enyXEMIhu0CxzxfL4cg42P5c8/emgL7VrKK8jeOfwzFMu3DjgP8Awmse95c6I8lvOFQrhAJMOJE7c4488/T3rfSqskTrIPkYfNn0rmOtajbX8n7NtnheOF/3c0r8LjggHuwz60MEO3JjiaS1toppYydwjjA2x9iGH/fINS7OC9ZbWW4eZ/BJWElztjPfDA8gD6c8VA0nRdRW4iYNEdxyoSQ73Ud37cgVttHtZZ3uLCK58WSRN7ysgYgeRJY4H25qGy0rMtqeqsPi5pIW8HADGM48R88sR5LjHpmrDQo7i51m2limkknUhIkXBBXHc89z5ZxxV7e/h1FMif6r8aqsR8TCywsozzvz+fz9atbXSNJ0CcS6XaXD3FqSEvbhztA/wkrxjyGRQ030NJJ7NDbaELESTSqJ52IYRqwQMNuPnHn9KivJPbX1naiNWjnYl2Rv9nx27fSktqGqxLFKps3gbJnfxSHQ+vIwRyKnaXqmj30z2tvI8tzHlXZ4yAx88HGDSSrRbdkLV4rHV45LVWilmhJKrn5sqOQDjGRVLGNWja3i0618aOSQs7CSNZFGO+3gd8479qvb23+BuIolmjUuzMYmG4zZ9PPnsTnAoWqyQXEU4Zpli35YQlOck7Tx5Z+9OxJFTe6J1NNcePZXllaQxqHE8+RKjbeVIGVIPme1ZlNG1iS6i1O71E3jBmV4JZAVNuP4sA8kHngV0LUY7DVtJCBwZZMDa4GYyR2I9cZxVVNYWen2strHcyLEWUBycLCO3ysBjPlgmgTM9caVZ24a4t7XxvHB+HugwYAY/wAWc4/Tzqgh6Zk02XxTEkokydqRMUJwSc47/X25q71vUR0/LGI5NRaIFUdEsfEh8PPzNuHIOO/9Kv20+DVYkli+Ja0EDFJFkxKoBzwCC2Pp5YppsTic/wBQN5cbYngZLeYABET5ZMf4WB+v6VWww32lxJaPfR23jjcguwWBx/CcHg1sLGfRNMSe4Wa8aWNtssAjYNGx9iOP+vNVdp0/adUzS6kZTHKp8S3LtsaRdx/KCSufbyPlzTv5I4lGmiaeuqRXeo3ERunUbohJlT552nnG0YxUi9sh8LAsWoyNHdgxwRMCi49AB6etCTo99PmZ7m6tXlZivjTypuYA42sN3y48+eRSWku0key8fxbuIMWltY/GC4GRjaMgEeYz2qnJC4szVtZzdO3u9Ayu7ldm/IK+z4AzV/p/hx276hcSuu5iyoRtGQf8Q4K8Yqk02ye2vIrqedZUEv5l3NKrf4MEDGc+fFXOqatc3Gt26W0ckEFqcTu6DCZxkHtjyzzSTBotIljurQXTxPIsr71TOCGxz37j3qZaXMgfw2WJY1TdhDlgPp6e+BUCwWaS/kntpEa32HG/PyvkngH19fSm7CWe6n3XV5NDKDkQPGOy8Z5GcHPtVpkNGid2MeYyM4yueze1c61+GbQLSeITQGXUXLeFFGcxKT8wDehOBWs054rUeBDKZAXYklCF5Pbn+1L1m8lsI0kt7JbuWRtiR4+Ynv39gDQ1YLRS6b0fYaZpcWoX0fiXEamYjPyqcZA+3H61npeppYL+4mtPFX5SIQrZCyHAJI8+OPattFdalqLF49MS2yDGZbls7R54QHmndK6dttNlecsZJWYsMAKi/RRxSr4HyKttQtrrQGg1yOSHZDjxJWw8reRC/m7+1c9UcY8/OunavoCXqam5Qu9yiuCpwylRwvvk81XdO9F20FqlxqcLS3LDJhblUHbBHmaTVspOkZ+RtP1SwitrHTHiuIB+9uXkAUe7H0qnMQV8Fg+M8j8v2roHUnT1xdW0Nho9lHDAhDMQ6opPuO5NV9v+H1wttLJNcxG6Cnwo1/Jn/eJH9qTiwUkY5GMUqyLwysCvsQadnmkvbyWUr+8lcvtQdyTnAFaeD8Pr+Z0nv76EFsGREUlvpntV1ofSUOjXEk7S+OxGEyuNo/7wKFFj5I5/cRPaSmJyN64Bwc4NMt9eTVz1Rpt3DrU6rDJKGwysgLEg9s+9O6P0XqGpES3X+pwejjLn7eVKmO1VlGME+Eo3sTxwcn6Crmx6P1q+Ad0W3TvmRsEj+tbjSundN0bm2twZMcyvyx+/lVlksODxVqBDmZzpzpJdMxNeFJJVzsQcqhPc+5rRJHFACscaRgksQoAyT50M44zQPP8A1q0qIbDJGNuAQe49azGh2ZuNW1K4lmQTrMo2xx42qDkYJ8j27eVaRmOxivfHGaOP/Zq3GSO9FCsUT50XvSJJ4Yo/EklREP8AEzACoyataSyiKCUzknaTEhZVPuRwKYEsmiqDca1Z207Q3EywlV3Fn4X6D1pvTOoLDV5ZI7SRpDH+Y7SB+tFgWQNQdT1qy0nwzdymMSttUgE/rUw1D1PSbLV4VhvIvEVTlSCQQfqKA17lDJ1nps2phWvLmK3jGAFUbJj7nvV3catZ6dpou5mWGHHyqMZY+gHnUBNG0LpiB794R+6O4SSfMwPkFz51z3qHXJ9dvWuJSQo4iiB4QVm5V2Wo29CuodfuuoLsysri3TiOIchR6/WoXw6AIpl35GX29hRRs1jvDhS7KRs74B8/rTuj6c+o3WG4hjG6Vj5LWXbNdJF5olqNNsptVuCPEZCtug7/APEBVJZ2VzrlyEDtJIxJZm5+4pOqag+oXACZESDw4kXyX0p1Rc6G8UgaWKR03jy4PlTb9iUn2M3VqIZHAG2OL5CWOcmkM7Qx+KpjDMMAZywH0qPLcF8A5ABJAz2z3pdlaSX8qxIe5wM1JYgb9u4g8+dKCNKyxrjJPHNWWuWyaUyWKOXkChpTnjcfID6VUZC/m7+9DVAnYcqhWIJBwfI8Gm+C3C4HpRhlY/MeKJnwflA+44pDACue9Jf5zTYOPOlZ4qbKHFZsbU+9LUYyzHJpkE54zToBHft3NADgw3l/1q7g6klsrNba2hjiYDllGefXFUHisWwvakNkdzzTUmuhOKfZLkuXkkdmlZmc7mye/wBqLG0dxioakqc9z706ZAw+cn7UgBI5YEY49aX8POIhM8DLExwHI4J+tR2l44p2O8cReEWbZ3254oGLUKmdo5IwfalpcM1ys8rPKy/4mOT96QNrduMd/aimkhU4jBGfU55oBj93etNMGVViXsEHYVJ021tZAl2btITG/wAySEHP0qC1xbrBtEG6Q93c9voKjo7uwVQD7VV/IqNpY6vb3k4gjDtzjceAKFVegx3HxccczPCsY3qhXBf2PtQrqg21bOScUnokxWT6W8iS38lk/bEgKrJx6jgipSwi5iXekbErhZUOVYD69q1Ora5bweHZSgBYcfNtBePI4DeTLjzFUkVgmozPJYrAhVWd4TwhUHJK+Q+9eLlww7XZ7WGcu30Rj0/fRpFdacvxKBsuI22tD/f+VMya94QdLu0bxO7mTncM9xxUr4i3d2ME/BILKygfbvT9zeQqWgvNPguInU7DIdskbeWGx/8AEDXLOCbqcbN1KtxdCnh0zUrJWstSHxJAPhS7Qp9QMcg+lVwe7XdFLA0jqcDg5A9j/nRWWjaLqu42cktldlSrQy4KFvYj8v8ASpVjfX+kTmFbyRGhGCkjHH2YeX1rKVL8prBSe2PpdXVrarJIHMCjjxBnb6j/AKVJhkikX5pPB+TeVDcnPqD7U/DrkF2rpfRMkk6HLKFOV8zkDv8AUVV2em2t/K6Wk4uLgcjb8w+nqP0ojNpXJFSjekWselyQslza3EM4HzKHXJ+4zxVdOL+zvjJLCLVnyVCPtBHqM96e8STTrwRTAXsUeFcBipHn39qn3+oaffKojlKyCMp4cgxtz6ZGP0rFNTka/lQxBKkAa1e3hTfld9vIGj55Jpdw1y9pLgrJJaqsluY22yEA/OrjuQBzxmqmMPFDCoCiNiwUqQckeo8vvUqCCO4Vv36+MvYEkE+wNbSi0Zp2Sr2G7jtIZ2m+JR1DBwNwJPcA8E4pXxscVujzygfxkJIQwHlxTMdxHGiRs0qv3Uk5H6VP01oDIyTJ4iFCp2kKW9vrz/KqSVVQmmnaZJMeotZLd2HjTR3AI7q+5fMkd+PQiqyyls4r6P42E2DqxVpLXKHOBglex5x+tN6vA9gUW3u7mAE52eIOOPbtxTNrcPIj+Jj92Q2893P1oUIx6FbfZK1AePPJHNE6XDjEjNyc570mazlltFtYi4QnIILLg+oYZx5cUu/1eO4XwooTGwC/NuzyKKK9jjVw0gLbhgknOalxrovvsgNcT6fIVuJG+IDKxaTB2leM44yDxnHpTt2017YyXUSQyLJIxZFYgKx80744zUzUh8RAjLPllYbT3pMTiDT3AjUsW3MFAx7nPlU8uO2TwfyHo7S3emNaPPEttApiSJQBJ4m0kPkfm57mqDWIr+0vIZbxIboMP9rgltucYI9qtxfLDFFENrBDlGQeWORntULU5f2i80YjVCMMCHGMcZPPaljnylbWiJL7K9yJ8FDY3z3toQshUMAoOAx7YPuPKqPwn+MeVoAJpBvIZexz/Sry2O2NnMvhqgCd+M5yOR61Js3gu5yxRnDAnKsMsAOeD9e3FdUJ12ZShy9iqguY4o/9YEck2Sd0YAIx2FJvbi3huJbm+jcxbAFjB/M2OTipbrbWrySqWkScA/MgXZz5/aqnV9Y065nYSQmRSSPlPln61pjim7RnOXFbK9MR6jBdWsgVJJQRs7xnNW02p/tPUkido1RZdnycAnPfHrVbC+mQXsStHcLGBuyDkj0q+gsYImjmsreWSGc+ISrgAY8+a0yuqTM8Te6L+G3uIJnJAaLxNzI3Oc8VWHUpjPM1v4iyRglcr5+f8qkX+pNHpkfiF1DRiQbXXO089/WoEOqafe26KBceO35QWGWJ7c4rzo45NuUkdrypaQ7c3TMkGFVZNnzEDAJ880/ffsxPCaC78cEZGwcIMD5SD9xkVKfR57yIJdafOqqu4Osg49uwo7fpiRpAY7AMSxQeJKR28+2D9qbii02FcRx3cipHP4JUblU5747VIivZbOwaOUwzybVOWiVywPPzg9+Kc13QTZXiCZrWWJ0Vl8Jye/cYzwc0BZeHbST29nbsobw2G4FiwHH04zUqS6sdP4KvWNH0uaOO/wBLYxMQBNbkEAN/iTPO3+9Qo4DAdyIxwOcjzzUyPULuFxEYTErnA3x4VCfepOpPeIWt3kUEDeAmDyOP7134fLaqGQ4svjJpzgZuWCaUu3hkZ/lUcWcm7aTjPPapMhuIZGR5HOPeq66RllDg9/evVXR5fuWSQxhcOwBHfJp2NkV8QtmRgVG3g8jnB8jVbBJvOAMcc07IcAH0Pf0piNDbTGz6CbCsdmrBecBsmLIJ9sjtUjo+7WDrTSnS68YmVVWRcgrkHKkH3qOW8X8Pbotk7NWiz7gwtTHRGU6p0ZlMeDdoCBySM8Zz2qPZmnuhodTax8VNP+0bhZpGIc5/MPQjsRxTh6kmnhngvIbd90TAMMINx88YIz9MVVXaYupUj3O+9h98+lB42UYkVgcchhiqRBs9M6rtIba1TxJWbwtkiuoAGBgYIOTWkt7v9s6jZwJLGfHUqvivhE8+54FciBZTuAOV5571pOnBq2o+I9hBI5tQJGbblUUcn+QrOWNdmkcjWmdw6m6tv9KtIrDTZ4I7WEJGZocMMgc5Pb0yPQ1UDqWWJjJDAf3vzgJKzeET3I9R7HNY6fqdNblmhjEUZnYLhflTtzjPC/Q09p+pzWwihjSIO0ixoScZ5wQD2Pl29axlGRvGaL+4eLUbxvEvlhBUKZHUAHI4J2/oTirDpfWNf0i3ezKxXFlaSKHUgmQB8/lcHsQCP0p6w0PU4L02b7pRp6G4ZEdWQMwyMNtyM9iDnGDVzo+u31jpHxTaPHBErKsu2AiKQjPzKcd885PFKKaKdModWurqK6a4hW4to5HxH4rb3UA9+wJHpnPGQc0/aasYroWqXzLMuCZotyiQE9mDAEHGPsO9W191tpuoJFBd6Sl1aFQQ27Bi/wB3PcMPT0xUW2uunLrW4hJAArR7IJlJyp/hDDJGPQ8Y8xU3T7HX6Fi1vPp7Q3F5fWmqWzSfPv8AzQkHuG8scjng+fNW+nG6sdQbwZENplt0O8H5PJ0/xLz589+9UmqX2i/tlkv/ABo2c+FJcWz7AGwAC8fqOORwasItMt7Gw3RyzmK2IK3luAfEXORux+mR960TEyw1jpyx1GGNXBQn5FmXnYO4H/D7dua5r1LBL0veyW95bTvCMtDNGvyyqPMZIwfYmum2l5e3E+4COS1IK+EFwxIx8ynj7ikyw2utbp4TFMEJglWRclWH8JB7EZ7Ec1tGddGEsdnKbDW7LUHKRO6OoBKyLtOD/KppRlXMZQc9mBxjz7VrbvoHp2+uF328llMnzK8TFA588eh47VS6h+Fsgdp4Naa3AyFYE9s5G7HHHuK2U0YPG0Uksc6/NCm08twc7v071X61p6X1puiwDjIwMjPn7g1b6j051TpU+97ODUbMAFpLTlwMeQz2NU1r1HYTSeG0j29y5OYZVIbIOMHHFO0yaoHRnVA09l0jUY0udPjYkhuGiB7sCO39K7Ba6isN5DYXJSWzuYsQy8FXU9hn1x+ua5BfaPDdt8babUuUO4svBB9D9f8AvFWvTXUsdhC2lT77iJmB+HkwrRHvmMnt64+orGcPdG+PJWmdRstN/Zc0lpOSbaQ5hk/wnPb2qr13p+Jml4ZGbkY8/cehBq50e4luLKN/GW6gbsx7+mGHkfX9afldZW8GUbQewcfMh9PcU4ukVJWcpuTNbXZWQx+OE2rIBgXCDuCPIj9RWU1zTrOJ5buAm3uCCVUDCTjPKkeTfTj2866b1ForO8jIuDuzgDDKfJh/n9jWKv7BzbFbvDpL8pPb5gePp7ehBB4quRg40YI6S11ZXFxaFI5bYgvAxwXU+YHqDTqWml6m4srW7uId8YlRpV+VZgPmUgdwe2e496lajZNp0+wsMMCq3C5wynyI9R5iqGZWt5yd5WVSDuBxz65/vTFRJ0+4NldCe3d0KbVaKQ43gjDDPmO/2Ipm8aOzuLyJJpim0Ybb82R2z6eQ+1SNb1BpYrYqEEL/ADFQigrIfzEEdwccfWm1sVvrBLiOULcR5SSMk5mGe4PbPP8AKgVC7bUfCtQ87NIrptcOTyvqCfMVFn064ia4kQ4QAMpYbt4bt/33FTYen+oPBlij03UmDthFMTFQD6VeaJoGrupsdT0x44WQwuzkKwUA4P1Bx5UWOmY+2spj4bRIlwCCTGG/MAeR9eP6VZyWiLbW7WsyuGUtbyMBuC/xRP6kdx9DWh078ORmSW/1GCz2NmOQTBmP/L51YWfR9hax3EMEy3sZcM0Zm2sCcbWTj1PlmlY+LMVJdssE9pMk8sRQCMhg5RxxlfPHbgVb6F8QLKWxlL3BOyeIkAqnsQeR2GR7VvbjS9H0KWK3sLWFp2z4rKhKc9iS2ST7ZqDpssGraxc2MQCSW8eN/CiRvJR/OmFexT3mo6hrLPawIiwxqBOWzsB9fUj24FSHg0vRbV2jZZ3kG4ycfmAyVAzgVYyCKHVx05PZH4SUn96d26Rh3C48xnz71ktW6c1qLV/hra0nvIuZFKLwsedoO09mHOe/epbGos0Wg6nZQXFqbW3S5ubpiQ0cgLEEj5GXB210DRumNNtIJXTS5rR2/PE0h3HnP5gfy+3aue6XpOqaJA1xPpscIYZjV/lWcdiuM8Dz5xnFIveu9Rsr2O1aDxbeUEsqP4Mf/LjPPvUR32W2lo6e9rJKGhkkSK0C/LFATu98ny+1Vup2Xg/DhJHjt4snbuGWOeBg9xn+VYb/AE01hrQfB6T4drjc3wsrmUAdzn+oq81DqbR2jt762mllle38STwn2yK3AIYcHB8/pVPJWgULLVdYh1OOVLZEa4gUjCKSeDjAIwB74NXGmQzPbyQXcKQqxyqO/Lg9xzyPoKw95pV7rcyXPTMltHG8eWe7iMTZBzzzhsE9yOfes/f3/XOjX7Wbmznubj5otxUhlA7DkYx6EVHK9l1R0y86FtVt5AtxqpRmEmGumZUI7AZOe3A5+tQBqV/a212NPvHDRybIYZ1LRg+hOM57c5xzVH01qGv/ALSjn1G8tobcpiVJrgCN8jG0R7iRxnntV9dfsnSJLW9XSZLrTbmMsJ4VeYJwAMg+2Rn0FCd9AyPYa5c3N5JZm3QXbIZdsdxvIIGCcOc9/Q47VGuroPo1xaXsj2kEqExG7kCruz5kHg7hyD61O1Wx0LV3h1VU8Y+GVUxgKzY7Adj9R7UmDT7fVtSjjE5WSG2O1GkDDDHjI+n0NOxUUVharPpsy6hfSz3EbsLSOKQxMMYO3eMgDnzzmr/SLw3ClrzTYreYIUYTXIyccDsM8+vrntSbPp1f2zPaS3kW2NQY2QAN24bcMHIHHJINR7O96isNUuLFrEXtzEuUuVXKSIPMntz5gYNaJGbZjuszJa2glN1BpzLuzD4hk3N2wxX2waz2mX2s6Je6da6gt6dOwESRZMwXCNzgMRtKkDt3rUdYaTbXEU9zd6WkMhAkcC4IC5/iGT29hWT1PQ+qTZWdvFZXcumhhcQIsgKc8F8Z+XPoe1KSFFm20iTWb67c3PSllNau6m1R2EbwqCcfy+39Kha1DNaXM009k8UyXGQ0UwkmiLg84jC5U45GRz/PIQS69oeq3jO0sIkTb4XigiRMcDAJ58/XirPQ+qNKubqCC+fwb2M74rmCDxI5jjhsMQ6Nx5HHHapLNBoOrWOkva2YS6mv3kCytdJkvGCcK+XB8xg4yKvrnQ9OvtRZxC0tzIhZod/gJuPkGIycc96pNd1+9g1MmBXCKPGNyGIZnOMMqsMHvgg8YqveO/0zWIbuPVNUtXWT4mZLi3RB4Z7kNuX5c8cHA8qaYmjXTmLTrE2kFlbxXkTKkrIMeGueOW/OfXOOKOPR7C81L4KTUp7W+hQSPHbr/tMj8yR4O9Dz3JINYzUmgu76a7lvIr6EgXASSQtI3zYChxwWAxg+frmug9La5p01utq6ySTxqI2jbiZTnsBgcEeY9KdsVE+Ho3S7K1NuskjszFg0rbn/AO/byom6PsL+ESW90IDj8wwQ31HlViunWGn209zpG1TIdpdZN+WBxg7ie38qKwkmHxKTLbgyYy8b+IA3lkeXvVcqEoJmSvukdV078sImiJ4eM5z9qzuu3lxoMavNp9zKS2GWNMlR5mul6L1VYzXU9lFqdtc3MYIkhDBecc4HlzVsdLt9Yg3SQ5Ldyyjg1XMn0zi9nrUOp7Gs4pZIm7yspUD9e/2qyDBeT9zV03S+uS9Rz2h02zh0mFiFuPEzI644wAe/1FU/VGl6TbX9tot5qiQSynxQjkp+XkAn3/tTUiHFoIPjPI5oBvOpy6DPIA0UkMqkcGNgc1RTatY22otpr3KfFqxVox/CQM8mqsVMnseMUh5FjRnchVUZJPlUc6nYhC5vINqjJPiDgfrR2d7DqFslxBlonztLLjPPpRYqFW118QXkRHWPsCwKlvfB8qdBzn+ZoZJwe49TSicCmAkcn6Uo48u3nSA6hiAwJHcelMRCZbl3lcleQgAwFHqaBEnA70RGQQfMYpm4nuEBFvbiVscbnwKIXYiEMdzsW4k42qTgn2zTsB/O2PCgZAwBTKERoXlCoVGSic4+nFHK0niKqoxUjkhgAD/WmXtZDOZYpfBDDnCgkn6nt+lAGN1sx3XUixaq0rqYh4UVkpbeOfI9jUy/6nstGs444YmO87GtWOx4VHmw9T9a0iaahLPct8W2cq0yLlPYYAqLqfTtnqt1BLPBFiHkFR8zD0PtUUyrXuYxrO/6uvkuIbEW0XG+SUnDeWfQ8eQFbovY6PAse0RgDCpGmS30AFSJLiC2ARnRAq5CDyH0oS3cNvbm5mkEUQG4s3y4FNKhN2HBOLiESqjxhhkCVdpH1HlUc6hGI3kWRPDQZeZuI1+/nWF6k6muLq5l+ClmexUgNg7Vb29cGqi76k1G9hRLiRTaRniBQFX2yPP71LnRSgWHVvVh1gm1tTmzQg7tvLkefsKyhY9/OnZ7g3Ers21AxyQgwP0pCoCeSaxbs1SoctrYyTJF83iyHAAHatRdJ+ybI6fAVjTAM9yRy2fIeppGl28Wj6bJqN0I/Ff8jEbiMeQFUWq6xNqUq+IxKJ+UH+Zq9RRO5P8AQTb/AAbTl7ieeOPJwUALe1MXlwrzHYZCnZTIcsR70wWLeuKetrVpT4jEYHBzUWXQLW2Ez5lLLH3PFS0uhaSbrY4PqQKfu1jgsFVUG9mwX9hz9qq2YUdASZ7+SSQyPh3JyWYedNkeIpc/Nk4zim/mdAVx3xtx5etE52J+bnPYdqlspIZcAsVB4pJUngAfWk5y2acRtvNKxiQhpSxlu3elLtYZPFIZiPy8CgBfyoDz81JUl+5x702qlm5pbDbkZ7UALLhBhcE+tN5LHJoxgihkDjPJoCxOPXiiwc8UcjcgCjHAoAMoD8vnSOBwvlSs/KfImiwBQBIjkYQGPaoBOcnvTJZVPzUPEwPpTLZY5oAUz7jx2pUaszAIGLeQA5pAGPYmrjSbmWzt5WjihRwpxI4+Y/ShCYu11x7CDlGlm5A3nAX+9CoL24bMk06s7csM8ihV82uieCfZrupLKex1aa1uvmVhiNs8lR2/SrHR9PhWwL7fFztI2Ly4GcjP6e1WN/DZdRW0cVzby21wP3kcm3K89xnvg+VSNE0a66e0fVGllS7toXilhYN80RDYYFDzkhvocV5Msyybh2evDE4akZ46hp0t263lq0ESsI1uoowrL671x82PUUnWnt9OeK3hmkmljk5ctmKSLHBx3471c6pokesx2+swSowRtjwkhTk9ifL65/WszHJBaXvw8qlJoG+WG4iUlwfQjgn28xVRfPRnNcNlWmomDVHdAhYk/Mp4+3PIq+/0ie6i8O/gjeQ8qyLsfAHkex+9UN7F4V346W0Xhtl8IQVXnnjy+h7U4mpyySiRwGjH5RngfT0rPLjV7ReLJrssLO8sBOjSSSxDd+ZlyCPQ4pBtWs7hry0ilwTkiE7iF8yDVVOvjggqRuOQRzilWcksLERTHB+U4zxUca6L9S3tG50nqrRxasl/a/ESt/sZJNyvGR3zjgr7GoMx0fVLvakkcBmYKSHJUZPcZ7VWn54kVkWRmVgGI7Y86p4bbFyFUmNhkqwOcGlHFH20XLI/iy8XS5UuJkS5YJG5XCkndjsf0pa+LbRoPDlVyM525LVE0u7m0+5CzyHcvMbouApPkw/WrR9cbUpDJdfN4eFVsYIA4HPcU5cgg4/sIdGtpYHljc9mXIJFW+nb2Q3CA7h+Yt3x5nHnQ8e4e3j2t48QDBd3Cn9foaq77ULlAWhLoFXnDcH2+lSnyNK4qzTwaJBriubdkEo3N4LnHl3BPes7e6Zc6fMDIhaI8ZByoI7j61FsOtp7KV4r+PwnjGMoSrEH3qw0jVbbWJoYTLJGpnVQ7MDw7YJYef8AKlwnF7WiecJe+yHOvyW/BDOGkLeXcgUzFKWIJyxz8oq+vtOt1vZNPV0YJIIgyeYyc8eVVd3biySNosMrHO4ny8qtNdBT7FxSjw5GKsG/LtH9aXAy7TApIHfIPBpuBTdJhdqOBu7d+aEMcnxCgABcZP6ZJpSigTaBNYqYZdpPiyHhP4e4pMmj6ZdWxEkzfEyDazgEbMdvrS5btVUICVwOM+4qPHcPMQgQ9t2fUCoUX2NuPwQbu2bT1TwT8SvEabxhn554HHrSLTVIrW5jvxDtIYgY53ev3q4jRbjDbd+MYH+E+tRLrTLaxupJVgKx8sFZvlT1OPI1WnpmbTTtDEd9ZyWztJmTILlCuAfb61RJp1nfKLh3cGQ7isfIXjz9KsjLdXHheEY4kmLhnYDA8u396iS2Up0j4WK0nhZHIaYg7QPUY75rTHHj0zOb5doi3lnaXRjMU0izBNpJAKnaMAGpGn3oiSKwu5mjiAzE6k7Qx9h61J0HQre9iZzOxmSQoQCNvYc+poazoBsgzqjghg8eOVI8+fL/AK1fOLfptkcJJc0iSmmQ3iz2z3CI4Tw4mZRg5z35+U8cd+9V2mWD6H1BFLqLySW9qy+HMFLIwHY5HkM0nTJn1hUh3wx3EXIMgI38+o710L8OLWK2j1W2uI8yizeR47j8mdykFVI9CeeaG3jtdiSWSn0aXqG1isul7fW5rxXuuDBLu2h0cjgr2bj2zWJhmNrfGNb+SGaR98a5VI8tjJU+uOOKevrmTX+mxp+nCWeexkMiRMADEFPIGeMY9KLRr7SZhbw9QQRpd28iyQzZO7cMHJBHbgcEdq45tpWv/Z1xS6YxqcVzfZKFdxLHexbc2D5HGKsunru8+Hi+IuhBufJQ4GcD5WJ8vOo2piQ3RvbGDxg7NKz7s7s9xjtjjsPaoNhPDeO8I8SFsHAc5Iz3rFr4NY97LXVNSubKYS3UEM8rNhHdR4bZ9vPjipkU+lS26xeGqiRVVd3Kg5+ZSe49jWauYdQtpjBMZmtZCELY3KVxkEH1FP2cCeAFkiWWMqFj28BueTn2odNIE3ZZX/SOy1luIU8WOPLAs3DqP+lZG61dGha0j0vT44wwO4Rln4/3ic1uZLfUbfwmsnimjA2GBW3JIvZg3+H61idX01I7l3sxMYR3SQcxt5jPYj3r1fA8m/8Ahzf7Hm+d4/8AfFFR4riQkYTJ7KOBUq0MKvmbcRtP5RnJ+9R3QMDSx8hXH8xzXqWebRqI0U/h5f7Gf5dTgPK9wY3A/pVT0exg6s0fw8ZN5EAT7sODVnb3Ek/QmpxO5ZYb62ZQfL5ZKrullCdU6O57fGw5/wDOKj2ZfvEb1AHTtauXhZJGSZ2Q84PzH/5qQ+u3d26zOY9w+UBl3Y5zjPf+dL1gj9uanCP4LuUr/wCc8VXADL5BywyMetWuiX2TILWXU7hURArNy8meFGe5rRaTbatPBMmnQ3Nlp+/YZI2Jy3ILH1HrirXoe1+D0m4u5tOikZ2AzI3JTH07ZqRrHWun2bG3tigNug/dDgY7FVxwf1rSq7M23egHorQTZKo1SUXpXeJo3yrH12elL6W6f03Q9ZtbrUdbhvYoSJoIYxky4Pcj0Ht6Vnr/AKk0a+08R2qSW0g5DFTvU+uR5VL6QvNabT5Lu1totSa1LIgfkgE5IGGyCe/ajQW0dv03rPSChFpqGyKQmTCSgnLeeTk07Nq+p3MzpZanpdxaztkxXiuGA9mU4P6CvOGsahcR6lJLLYvpMqtgJHGVA9ec/wDz05Z6rqqw/G27PGiZ3SCRiuf8WM4U9h71LinotTaOoXWoW1nqZh1rR3hjSUnIiLRv5DY4wffsa1eh9KwzWi6pJfWmXxJC0QPgADyb+L+n0ri46i1XUtOX/wDCGaObPzW4lALAeY7eeO3cVP0z8S9e0iCSyuL7e7NuCyDKkYwUceYPn79qxeGJrHO/c6DqkbSa4ivaRGUMqIfiPF3gcAEEE/8AQVrtFafRpxYRWzAzcs0w/dRv5gYzgN6HAzXPIertBvEgkjuWkePCrEsbAjdyBuxnCnI/N6YrWx9WnVunLq4tQLp4XNu6sdyvwMjLAc8+f61hGDi9nQ5prRM1WS4tLu9tRYvCZIwSsZZo9pP5yo7EeRH0yab0W3uLRWvUvZru7LqjxM/ZfMPnuQO26oXR3Vlqrtp+p27xSwgwmV2JeD/632yVznnkD6VtrbRrSK8kuEkm/egZjaTcikeajy+naqjBydi5JaDWcbtrqAAMh8/KT6HzH9KZeXc4maNH2nAlRsYXzBx/1pvVZ10rLy72QsF3xclRz+Zc5x9AT7Go8Rikl2IUUyLhygwG9yKtv2J4+5DudLvbbUBeaRPbMjoQyhcM3oSoOGx6YBqgvI7TqJZ7bWOnI3ljb/aWrFGBPY45wfqa1E95FYOfGCpMZAAwbliR8pz29uR96K71Kz1OKaGUJHdoP8TRsTjOCV59fXv2prXuJqzl8vRl0J/C6e1a5HhyFfhb/ajKfMA5zjB8qavejtbupVtdQtoGuGOEdJlEijnsc84rpAn024lEKWSSzbQWR8JKTjg84Zh/vLntUJbKSG/WGxu47XdtdoJY5WOcjOGLAf8AfatFJmLgis6Y07qrpphMsKPghZUM/M3vjsD/AFrWS61qV7IPitNgjBGPEhmBK45DHJHn6VYpc2rzvbb7eSaMDeuckHHmPKmLOW6heQXVraxxg/u3ikJOP94ECm0NaVDCvI5EshlLBT8uzK8/TPFQLrQLG93PcI+1hkhTtwatphJK4drsBR/4eAqkn3pUYRFV5FmjWQfK2FkDe+Qe1LRVWZTUuktKhgZ10yC5U/NIZpSoAH8R/wClUKSaGryG107RpYQu0SpEXxJjgDcOR7j9K3Il1lfFDRWFwmSVitjiQpnhvm4P0qXHYxTRyw3FlbIkwHiBU8N2488d/wBalu+gUKMhoOj6PcI7Jo1qrjckwjAb+Hnknt7Y9qu4NG063S3kttOtoEQbSjw4Zu3IwcD7im7noeCGNDot5Pp86FgCGLqwP8JBPA+lSY4riIRwTHf8o3HOVPvnA/tSVrsen0Ma6dSuovDtDJ4Pbw1wu4Dy71XRXZ08tEsFuz+EngrIpKAknKlhnnI9T3qa8NxJcne0YtkXdGO0iMeCcjyx5014CTFreTUElt2IdFkfBRgcghsZ9fXtQ5WCjRWz9S2s8yWd5phVYBmQqiRopHuRnAPoag9TdTj4dxphOolgNgaNYyWPO1TjOM859qzHWF3YR6uywRo0EClkKXBZWkPcjPn71D0HRZNSxdByoeUllXJVVx29jitIxrsxnO9I1unfDz2UJuJl+JmcJsJJWMnyyMZPp61Ml0I21zvWWSRE3LvAVmiBOckk4GPIk5GayjXM8LSaTpl7p9pY3EgaSY/I0ZzjBYkc59f5Vc6PpSJOsEsd3eSsCJbm5hDxE58lViQMe/pxUzl7FY4+5fXHTlhqTRupkTwVLRTXMglUsR8zHH+fPpU7RdAtrmyLXUiahbo5EKyRlQGHcg9yKdbSY7SESGQsjjaypEq9xjJB9KsYbuNbVVgUYjUosYTYTj0FNK9jbrSKHq7RL/V44IbO4t7dPyuXBbjjgKB7d8ispqX4R2lzZvcF5hdI2MWZ+R/oH7fTNdImkBgZ3AWPbubeCSB5jAqCbyG+AS3a4mM0g2MkLL4S8c+hHB796cq9iUvk5lF0isSHwDcrcM/hLHPCMDBwQ5Xvg/rkd66TpWkfs9RYz6XFEAiKLxQAkrH+IKOefQ1Jaza2czr487M+fBcAqikAbQOcHgHNTLK/zOoks3EuB8jKA0aeZznt27VnRoilvukzI2x83BZNrLNIULEdiFHykcVk9S/Cq/1G5uoFtrMWzKgjme7djCe5AUZ5+vH0roOtaXa6q0bSyXCPv8QRpdMi7h2OAfMeQqFcxWFkogtkCybWaOITMiyHHJPOSfPNNRQNnNB+G+m6XdR297q13OzZVltLfIPzDhiAcA1q9P1CS1nTT4bFbW0iaRT8Ccj7KRkt7Dmq49MalGPF13TGOFYCaxvGVRHnguWJPbnGCOKFp0/qsti0ljA0EULbhOL0SPuxjKkZGc+RPryDQyUizij0nRLq5N3NiMgSO9wrEsSP4ExweMnHHH1qpk6i+Nb4G1trFrPxQhVBgz5OQB2wPbOaptP1Im7bTrq3uLvYdojlgEjSSgZ4ZgWw38vWpMyaxp6wz2umWFglu423O2QHJHZ8nPtnBORSsCTf3suha5e/EyNNam2EaQIjeMBjgBsdue+KnaR1BPa2QENhdW8TIFVbmZie3mCBmodrqutXkNqNbh8a6lYghYGG1c92PoQPTyqRfavp26SBb2yZ1+bas43ceXFbIybZmusdWv5ni0600+AXJHiFtgLEA5GMnv7YpjT+ptau9May1GOK4Ecyu7SLKrrznBKDcOfLAFa9enundZWKa9067ln3l4csyyMe+AQfXtk+VaMQ20emSXc7yssQKDxGdSUPcHe+WI9fbioltlR0jkerXkUD3K2qS27KVkUxMsqOpPOcDk+YB9e3nVgz3Udt+1bT4pbO6B8UTW6SQyE4B8NcfI3ngke2a1uo6VbWjwTi6awsQpcn4qMFiwxnYVYcnzwRWEvtJtLi6kiMV/pxG4rLAS0T7T/FtU5z3z5cHGKQx19Vi0qNYtO1CylltE8WN762IJHmibcj796trDrC6vtQih11NNuo3DAru45UbGRj+XPYrwCRzWV1y3s4IYfhL6/mtxH++mi2zsH44IwrKPLNSdFmtNX05o7m9NzDBwIpLMLcQ+QKsjZ/5T386VjNloPTkMPgXqvocsxicQfDKyFck4yB3bOQVP2p28fqdHMrWOkp4i7ZJQ4JZkONrBj3HBHf9axNneTaeIrPT9RjvrqHLxGZjAyEEfI2D7nv9K2N9bdSTX1nqohitLeYRo7JMx4I49eM/wAOe+KEwos/w91W76lkb42G2ggtGKrDAmwNj+Jj5njsa28thai7WdrZCe0cu0Er9/SqaHRGt7a3Hx1xI3K+Md24gk903Yx7kGpkF5Fk6eI53gjiwLh+Eyvdc91b+VXEGx64tQJfEijHzHnaACfc8UfxouLZ7Xx3MXGWjJUqPdhUWSwgjZ7mLduf/aqHbL+wyflpGnrbtFJHbQmEhyXTcCc+pwTVEXRdwXlpKGPib3jwM5JH3qLqVqJhJezxxzBV+UKgZsAeWaobm41WxvA5aGGyDhV2YYycefHGMeXrU6HWpZ4PGCI9rL+ViSSRnGR2waLrQ++x6zmt5pDstlBYBTsUZGR51nOquiU1KfJtdOm3HccxjcWHqcVbvZnp+6F3aQXNzazHdcmN2aRAB328jA596maLqmldSQtNZTeNCmRkggjJx2P9KrkTxOdQfhhaxkf/AELsiC23IXf3Pf6VZz9JXdoPDQR7F4Crxj27VLn1e/trkNdarDbW29hM1xGI5IUz8qBvNjxk4+9WTa3ZskCW9ykiSA/OM8Y45JqkyOJl20a6TC7Mn0FZjUuporLVE06JRcTFthSM85Pv2rY67Pql7e/BaVfWy28ibJQigzKT3yT247Y9KVo/ScfTthDDaojXjFg8pt9zu3qWJ4+lTyHwKWSKW3iJS3+fvsBxz581R6x1Bc2ytDYWhmlAy07kCFPue9dSsLO40+FZNSQtckbFkWEuuT6gZB/75rJX2m6rdtdQ6lpWjPBKGEc4C7o/MMqkZ7eVDkLgZPT+rrOKBIry4kllUfPKsfylj5D2wf5VOh1fSrrUAE/25XMcjrwy+e0+tIbpxtN/cXMluI9rRs1uCzOdwKnaewPPI8qp7m1TTZ0e3t55TKPnSJPmdQe3HI/kaItg0jYFsZyw+h4xULVNcsdHiEl1MBnsi8sftUHT7ifUoWgm/wBSY/MkanewT3JzzS5NP0K0jWRobV9ik7nKlmA+v9qu9EURbvrvT4IFeGOW4dxu2KMYHue1QD1HqGqRfEmaHSbHkCabDM59FHn9uKYtupenoGZmivi3iF9jquDn29KiXXUOiatqAl1Kw8K3iBVGDEnHl8oI5/WpbKr9Cyi6l0bTBm0f4y5P+0uJdwYge+P5VS6vqza0xu9RneC0Vv3Nug+eT6D+pNQLrqGyg1Bp9M0u3MYQKnxK7tp/xAZ/lVPeXtzfzNPcytJIfM/09hUORaiO3V6Zh4Sjw4FJKRKeFz/U+9RGbyFJwaVGndieBzz51BpQ9GkcW15Bv9gacgEGGnuAG5/Jux+lRyASZO2T2pBYnNIKJuo6rNqLKHO2JBhIh2Qf9+dV4GTSgMinEQHuadglQET2pbPtGAT9jQeQLwvNMklWyTyaVgLEvGwnjcCc0lgqSEbtyZpLMM/UUXccmpsZIm1CZ7UQDEcKndsUcE+tQi5ajkf5cA0oCN0Xbu387s/yxQMI8EAmge3H2o9nrRouOaAE/wBaNQSaVsB5JwKJnAGFzmnQAkbb8vc+1NDnk0YJFAgtQAQ5PtRspFDlOxxSgzMOVz70gCCnPBAoEHOWPHtR4wcedHtwM+dAA7jIwDTRJzRu3lSKAF5oqIZoE+lAEi3mW3YOEV5ByA4yo+1OT3j3EolPEpGDtGAaiLyRTg70WFCg3bOQR3JoUUsoLqFAVfRe1CgDtEdrpoA8GdJhGzbBG3iRy9+3oPY4p+F57ay1HVFinjhmhSHBT/Zyb1zj2K8g/UVmLLW4NNv7l5mhnwNzBBtVieOceWTWitOrtN1HQItIEIWSaQGRULbQoPHfz5P8q8BLg7PecuSoi6EbTU5b27vBJFbA+FGkPyCdhyfm7fb+dXa9HaP1HZXNlbafbSXfhMIHkO2RXI+X5j7471Q6ZaHQ2ktjG7WrThzEzEhfof6/WrwX9tJciZLo2ksRLRTKSTEAc4JHccim/IqafsR6Vwox130prcMnwXU2mvYPbjEV9KhEcg9GK8E+hzVRrHTE+h7ZlMMsD871PysD5g+f27V2ef8AEewv9LEMlvBcxn5L5rmUbC/+EKe58xx5VgtdtrG/E82gfDpBIczW0eSB77e6/UZxXrvhNaZ5VSh2jnMrT2wExUNC5wrA/wAj5g1q+kbXRZNNl1a9WLUJ4p1jfS5pDEZI2HDqynPB7jtVRcaHdm4mczC1VQNwuJFyM5wVI4ZeO4xTFukLShrRjHKoG6MdmbzKn+dYTx8TbHk5M6NF0FqXVEgvdH0pdOtJNwSCaU5UZ55I5GMc/Sq3W/wm6m0nfdDTGu7dVP7y0bftHuvc/pVxpn4jav0mlna6i89/BLbxvJ4hzKgIH5SfLBHf0rQ9edXr1J0jFPot1bLZxygzF7nwbmFx224OCpz/ACpRjj4uXuaylPko+xxv4WdHEm8ADhwT836Y8qctxFcPIIZSigj/AGgwR6k/erHUZtW1tRcXF78QRgLPKFDnPHLAc/U1AGnyAJ8VKiBpcNJCQ7KB5lMjNYqVmrVFhLqUkttb2AACwIyBk4DksTk+/YVOUWfxElvdSeA6cDMW5M+e7zxVTdwW8NwqxXCXsSkZkWNkyD7HkGhczyXMkkhDfO+cgHBqJQ1RpGYrXNGTUZXuUvrCS4wABGSFA8sZFF0tpqw6naSSsqyw3CMhc7N7hl49/wC9SLaW3tHMs8Mjq424jfbk48xUzSbe1udUtZLiSSX9+jrFKoDbsjkEZFJZZRXEmWKMnyHNUuY5OpNTimieS6+PcREPgAbmyBnyqtz4axrHMxXb2xkeuRV5NaHQurNTnuIvHtLm4lV9xKlcuckDHBAzj1qHrN/bXJ2WsIiW3xFvAwWUcAn0OMUck2NRaQiCKaSN1hKNJtUrtOO/cEH708223sQzxt4kqbVf/Dzz9e1P28YjtZrpvl3GKEYizhCpycjzxUbW7vS0cRW87ufzIoBxjzJ5ovZXRFa0Eu1vEUMQcZ+hoQRgLMyKgCRYZDwRjAqfpk0PxEZaR4wg+ZQec4OOPvR21m5t7qGL4lHkQ/MckNkg5OPYUKSfQNV2QbDdDHvZtoPlnnP1pm423dnPul8Fdwbfu4xzkHPkasrDTJruOaRTKVgAJI4Bz/aoWpxJDBKUjeT5s+CxBDeXb0qWyWnRkrppJxCI4kVFJ8Tafy85x/w1epfapbKy28/yMnzAoMDPnioUen3SSYjj5Y4weBj0oPOz3SW+ySKdMLsyCD7HFaSalWjmi5Rex1FubdnNvfSb5OZdi4wT9Kde8udkccsRkK8KT5DzpuCBmufC8SMMTh88FW9KsWWMctnzwCvIxS0bJtma1m2MeoR3tsPBdGQNsPY1pOjdelu9R1n4lPFA0qciN+4xgkj9Kp9SmWO6VRZE7iCSPl58jWn6V061e9vLqEMGOmXSNuHOTETg479q0U1SjJGfB23EVa31kl4l5pc3gE4E1uxx4gH8Qz/SpM1/BqbGAXEE8srYWORdwdsYGPQgVziKG4aG6k8Q7FkV/hwcMQfMfYVp9B1GC8vbj9l2toky2wciWI/u9uNxz5n/ADrGXiJPlZpHyW/taHJNO1HSYrm2Czi234UP2Bzyf1qLZ2t5bXjiZhJHjfuQ5OKs7m+vrawM8E7ESyYlU/NsGeQAc4Bpi+vIXs0urJZbacDDZOV+1Jyv2stL5Jdp1BNdRGzFzJCSDtLdgai3N9fwx7XjhaEFS6KmAD68cg1BsLq3v5UiuHIuCCytt25x55p+9t5rSEmWUFDk7/8ArWXCMZV0ac3JWS31C7CNdWby2xVfyqwZH8+30qVpwbV9OZUeQXMX7whgPnA5OEXvwTWbMoFvKsUgkQjnI+U1bdIaw9gJLZYFY7C3iopLJnjJPkKJw1ceyYy3T6KzUrezESvHne24qdmFI8gPQ+uar54nRELKVZVB5OcjHlT+r6hPeuFmEW+3ZiGVdrNn+Rxjy9TTEF1NcRgOc7eMbR29K7ceWcalJ2cOXHB2kaHSWH+gmvsx+YXNmftmSq/QJ/C1XTZI5EdhPG2Ce5Ei4FORtIvT2rKlwkas1uxgI/2vzNyP+HP86qbS4uxcq9pGsTAghoxuwQc7s+Xauqea42jCOP7kT+pG29RalICFb4uXcuc87z2NHomkjX9Rht1mEO85JxnGBnkelENPvtW1OWVIWvJJJv3r+rMe5I7ZrbdPaB+x9RPhzqQkeXUNuYE847AYwO9deN2kzmnptEm76bv4unhbWN0yBAzyKIw3iDH5VHcH0rHWHTen3V5PbvqM1wvwU1yrJCVaJ0AOGB78ZyBzXQNW1ZrGyS8ghSeKVDvC/MrYPBz+tU+hasNX1ixhP71na4zIkZSTZ4LYBYe+O9aZmktE4VbpmRstDs7hLaWK9kmEkyo0Bh8JyuRu5Ld9pyOKLXrAdNX08VncakhSd48sgThTjuCc/XzrV3+qQzWrXVqLmS9UC4jUuGywwvK47duB3qD1ncWsXVd/KL+cMG3SQOrMCh5x5fLz5eVZJtypmjiuNmVj1uS5CQTsnh5z86Bsn15BOParADS55ZFuZvALLgPBwgbHcgDt6ikXs9vLG0caW88EoyPDDRmFvLk8VSGCfeECtuPCr/1rUyL2wtrS1gI1C38a2uVIhljxlWHv3H/fBoWbqL/fM63hIIjEgLGM/fj+WKqoNUu4bd7aRA0Oc+HJHkA+x7ikrPc3kqK0+4gABs4wB7mgZe6PbyvNdBbwxY7xEYjOeyscgjPrVjpvU19p8V3ZaRGI45IyJrZ3O5vUgjuf5EeVVVtb3tufixsuWA2FPEBfB4zkHIPpxQ1SH4mMyQzXMgiQB1mlRnTHbIwpxSBGk0f8QJdK1PfeCJWkjVBcLCytjHHHOR2z6+tdR0v8QZdSjjslaF3YAQTQF4CD5EB8Bvse1ee7DUnnkS2faWHERY8q3cYOOOfXirjRdSu/2itskEspUlw3ieG8bDsysTgfbFS4WXHI4npPStet9Vsy2pRFhaMubjaWjDeR3Dy9+R71Ot5NO1ICTTb61lkQ5CxyDd9K4rpfX+lwXjftKyv9MnIwsq3DIrt5tgfL35q8068mur8Xulw2N/cy/K6vMtvNt7g4DbX8/I96zcWuzVZEzfalZnWYsWFxFbXaliytHyxx+U+v/ZxWZ1Cy1GytpUEQkJAVonLHkeQYc9hj3rTX6xpYrMU8GW4VUkfefERvIls9weM0fx+nX0506aTxL2JQSXyjHjyPmR54rOUfk2Tvo59fajfadJDHHcObSNhKI5lDFCeynvznyq1uut7bUIo7TUIUhZW7rnCqRwykAkY75zVtqWjwzfNJbyXPjP4RlhAzHjkbx74/MDWUGhPNPJNZzh7mLcBCBztz5Z+/fvUptCona1bz2enwy2MT3cUg3GSG4P7k8fP5HHrkVf8ATXWljcRmx1Cd4LuJSQLpgqyY9H/i8vLzrAiyayuTdESoWyQjRscHsV54wcZxjzp9tQtNQSC1vjqFsYnAzsWVCwHfB7Z9A1NTaE42dOTUNLvslpntWiPhusM6yJICM4Kjg/oD71Dl1sdPWSWxuoBFGPkJjONvPcE5FYbTtMuJtp0yf4rxixmjt5AjHaMfvIz83f0ODjvVjbmDVLu501769sXgUG5MNwsquAMDKknbj68elWp2TxL6LrawZC9xdwwAHaH5aJyew3YHNC16zt5Li3hkuYpjOpO23hbAOcc5OR+lZC96esZJEvVvpjbPlUZUBR3Ucq/JzxyMDHPetV0+Lcaak9pE94dgV3BHHplS3OPaqTZLRpd0jOqiZ0H5ido59Rk0qS1ncYV0cealQQftWYvNMlv7mOMPfXIcFXjiuFhEQxkNsJyT3FQb3QdZs7WZdL1K9mDYASU4MRU7u+efTjy/Wq5fIjcJboka70hGMjJTkc54Ofesp1raTXUa2en6YWQ8vcRqBg98D+9Ym5m1S4mumv5bmRGZcrC0oZPUFQO3Hl6UxaapJb3M6QtJpaDDsw8RWZvNsHIJb0x68CmppexLTYV70+FAP7O8Ro/Ijgefv6Z+1Z3Sp9esLu62MrtKWDhFZcZ88j2/rWkfqa5ndZmvJbiOGTdHIkW4klcEZAzgccEedQNV1Vo7iO+sYoULNskdhlgcfn558+3anyTIUaLSw6fhea2WSER3JVpI3xljntktnP0IzzWvs4ounVOoas0Ud1OAVhgGC/GPm9cY8/5Vz3Sb3VRf21zcWP7XeFz4VxFMQUyv8Q7H1yRW7ubC06l0SK3kvSzhtwMiiTII4CnaP19uaSqxvSK+bra21a/TTH1OG2UHlEb5/oxHb+QqXbXsQ1m1NvcSXEKnwWXxVKxZ8945DfXg1zzqXpeTT9Skae6tl8QYaDbgp6cgYJP14pemdPXYgE2l3UQUIrPtd2Vl/wB4jnv9+O1VJih+p1y/ku/ilS3nuztIbxBFmPbzuGRwfv6CrLTJ3u1kt2tXtGQEly+4tzxkeWe4rmelLqun31tPayX5uWBDIjl7djxj8wJX74796vhqmvae7SXWnNfCWMiTwJsFm8vlOBnv9fKpRdmvFrdrGUiu4lbGPmBYe54x/wBKE1uk37qZQ8RGxy3dh6DFZO26z0+zKW15EgkccJ4gUgEZ2lSc5+v61Y393pmutbLJePBCPmOWGCMdnHp7+RpuSBFxYadp1tOtsLa3EkindHI25tmcgckkc1JaztZ7wTvBGHi+WNvJf8jVTPovi3VtLbbJrMvmR85YJ3ATAx3xzU/V7Rp7GR4nkEhI8VhtBGPqP51ETSSM51Hr2igS6Hq8SXsocFIII2yOeMk+fsOKoLmAwaQY9KgMG5hNLDI2xZFJPCujAqceWD2rYjp55Ly2JhilgjB3GXLS9uwYn18seVVOodOQ22pPcxxpAo/eKIyQwcHhsDkA9se5+tDslI59BKZdTli1HRr020nzpEbTxpZBnsGyAxOPzDB70z1YkWvwww9M2ItIIkMjMZnj/KPyujnG4c4wCeKsOqupOodMgcaHo8umQmUqAyliCeGKg+pwTjtmmbrqIJcQWvUKq3ixCOdoUIIYDgjzZjn1pJ0xNaM9o13qdpbzW97sN5dfLC7SFiyBTnJGS3tVza9P6ELe2u7RLtJAqxzNK6jc579+4P61lLRIjqe1pIkQOxEscZeSH/CuCeARx3NWVl1BY2otGS9e6dV2PDcWh8OI+uC3LfStEjO7N9oviaPqEeoNpl1dW0ihTLu3KhGcEgn374q/66uxqHT0cqQW0+QCyyxiUop4JHIAqo0Pqqe/hh+Ft7uWTGWiS1DoR64XBX6fzqPNqf7ctTvs72G0ikInR7YFH4JIG47l/nRzT6HxZX9NST6dZkWOhjZO7QPOtulwNp7AqrZX25IprqLQpNRtYp7Zrm2mtiFlt5JjERjs4ReQM5Hlx51N0nqvp+z1eKw26jF8jFJVUxqpyflZU79vzH1q+tL7Vb25t5EtbDW2RSlwI3EU8ZB+UbmwCo4yM8mpKSTOfaTrWuWSX0cVw6RvExnScKWJzz5biDng47+1ImjuLpI5otJQhEMjG6mCRzA9mU4XB47Z8vKtf1hq2pRwCafSJ7O/kWTeYMyRmMcAEqeGJz2z9RWVFysGms91IbeCQIivbu1zhMZAeJgRtz7gjFFCDh0ewUpdLpV5HLJC06qrMyuQcsu7uD3wcH71cya62raZPot5bJEzyRNGknzsi7c78x43H3ABFVb9ePe2f7OnWG8hSNVgeeP4eTfg4bklcZA9O1UK6hNFFLA8rW2EBkSVPEV5hxuUqMcg8HPIoA6n0vZ/saNYv2pNqG4mNU/eLkHknLDLexOKTresz6TMI9O0m9vxMoEp8b5FXPIBbzx2rM9O65qWozHSrwW9wtsuxXhlYG4C/NwG4Ddu5GeRWi1bVBa3tjbanZ3JtboDxBcSx+Hll4BQ/MD9DTWxEuW6lvLtUuLm60hbggRoJI2e5X13AHaRzxTWmdNvpEty6313LDcHdtViWJ895xyPpjvUjULqXTrBG063tfnhYJCs+QoBwu1iOceYz96p7zUNXksiwt47VwVUospmBXPzDCgEEd+KpIlk2ePVZbuaOQ20tuGCiFjvYKO3lgceZ5oQvcWwjtjLczQ42tiMKoye/HI/pR3ce6JG1F5RLEBtIjKlvQgEgk+3NP6dbz3dzPOVkgtJI9kklxIqmR8HkKcjGPen0CVuiwtdXj0rTGuZpJGiZT4iuR+UA5znt7c5P3rmGnX9+Op7wdGwTRWbuStwJGMZQjldv1z3rpcqabaeDpb2huorpssmVZJsdnfgD+oqJrN9o9nd/Dx31rYEISYoWRVx59uKmK3bKm/ZFHadCw26LNc3CyTFs75SCS3fGKhajpOpNcJFHC8sO8AEZHOOM5GcfStH09rmjW9pIpuW1B0wySEqxAznGeATyfWrBnSSc3aWSzoqmYSpKDsIHC4xkEjPFVyJ4me05tRsbm3KaQfC2/M7EIEOTkpuOdoq+utSvLOwu5hp7Qwwr4kbfKSc9wGyck96qtcN1Pta+uNPieRCUjbeJE4/KSD29yBTlhqbxRzW11Np9z4ihYjA+1nIGQxA/T7UkDInT/VuoPeC0ukkVUVpTPLKGUDyJ4z59uKkanrVlqlql8xvo5mbwwYLc7XIPGcjBHHnjFU8moPHcsmJVjB8V7gt8uPMZxyPYGqHVruWW9+Jl1D4i33bRE28DB7cDz586pCchzUr67Z/GdooNhKKxlWMOme2AMn1qql6iht7XwhKkrM2XMbbAcn9apdXmtJrl3eOdyUWONnJBVhwR7/Ws7JBJmdzG7iE7D6ZotrolKzoOkX1lbMji0mBeNmXaDIRzyCRWY1LRdb1+8kvbiz+FjAwzzHw1AH1qohvNT00+FHNc2hIB2rlCQeabudSnmBSWeaUnk73JGfvQ5X2NRom6nCtlaxRTX9pPNENqRwqSwB9W7YqiclmyaX3OT3ou3eobLQjFA96GCTRkbfPvSGE3FKCtszg4zRYLtkdqWThduaAEGiwCRRkZpcSKSSWAwCeT39qAAdpcnGAKT4m0Z5xTbtnC5xS2UBAM9qTY0gjJk+lJOPWi4Y4BptuDxSGLwDmklqMHgUW3JoAAGacwAAPOgqe4o3bzxQAAoPJpRORikA5HHelSnYvPc9qYCHbPyjt50gk0Z4xQAyOaLAGcjmjGMjNF34oFSx4BpAKdkJ4UmjRgGCt5+VEiiNxn5j7UtyEOQAfrQAJWVTwuKZeQmlMS/zUjtQAjNCge9DHFABgUDgUAM0NvPNABg+dOAFxntSThB6/WgJKACYYPJoUlznmhQBuLq9t7p2EfhpdqULBl+VmGCam3mppf3Ed49uYLmOIKWUYVgD3+o7Uy3TllPdeKlxIjeeYzggeZqdDcqIHhuEzHwvix8457n0rwHki1UT3FF9yLA9SX9xBGVlkdIkIEbLkPnnB/wA6K9mZ79Ft1bwwqth2GRkAnB4yKrryBtNsjfg77f8AK0sR/eL6Hb5VHtLtnjKTXEsscudjOuG/XyrF4+S5JGnKnTLb4e11C7kWTY8m8HG/ncB7eeKjtb2+hQzRzvPFeJKHtrhW+Uqe4K+mDUjSjbwx8xRpOowH/wAZH96r9Wimu2NwsxilUBjkHHpzV4pOOiMiXwQNSPxOlSBLRbyAsVScOcxuDngeQPfHaqjTpFt7lo5YwpZdqljgDz71aXF7qNlaeDJ8xZtzYHt61Guzb6lHHJeRtHMq7d23OR5Z/wA69COZyVSOJ44p3EvOrCouYoQniFY05QkAKEXOfTmrPpb8Oh1hoM15ZzrayxyEKJ0Zy3qRtGMfSqi4ebUBJKqxy2SgEtEMyQKBjJXgn+lS+metdS6Qlex0q4s7uzm/ebpI2UHj8wAIIPqKrDw/uHl5X9pYa3+GPUOgWhCrFqbqAWawJcxoPMqQM5rL7JrVyJBtLYBEh2kfY1u9Q/FfUb/TkMCpp99MQkskQ3KwHmufynjPnVG/VWrX1pHFfXkc0IkLbp41dyMYPcEkHPalPhf2jxqbX3FAWaJWZgrLv7k8k1Nhln8FjCwjcnBTZxim4huvitoY3jDsc8KuSBnAPGcVJTSJ5r0yi5Pw0h+RWOCv386wk/Y3ivgMafHeQZmB8T/COxpenWclnqlhHAWIFwm4Z7fMKRK89qoj2FFLctnIYVN0S8WbUrLxI1GyZMEcdmFRTNLQjXb916g1SGf/AFiD4yVkEuXC/OeAfKqwpYzEqlxLE4zw4BHJ5rTdQ6HDc3V5eNC9tCl/J48gbaxBbvzx3rGahbtZXLRRT+JEWIhZmySM0RjslvRbQ3ckcL2qyrMmcjggcBsYPl3qPcLcXWZktoVkYrlUGQV5yO/HYVB0953kkMbMApJEYzllxndj0GP1q1i1BpR4rMN8q5c7MdqbtDi0x2HSblLSO+l2pG+VAJwc+XHnTVpd6tLOsKI93FBgBGT5QM57jkfrTV1dSwT5QAYUFkYcEn6+VLsdTNk3hNHboZU2uzjgE84zjI+tKrFKro0mmdTvpokdtLWO9KsqsHwoB8tpHf3zVRdahBNsdoipjJI3c7fX6im7plEebW8DIo/eIfm2nzwfOmBOJ43MWSFONxHYepo432NOuh+e1NxbrcEEoBuVlPFVLaIviLMu+G6DblfbwR6EelHI5hm+HYISh3BwvByKfOoXSW6RJt2qDjA/L/lTVomVS7G7e/S8vUEluluFcjavckHkjPl3q41CyRIElG1tq7ck4bvmn+mo9O1eVbW+kljmZiUKqvzccjJ8/b3pfUNrqWmR+CLMtGgUI/BJTLHOexOCBjyxSa+ATrsqb6PLQh9oJXDYBH0wTU/pW2MesSIs8il7KchDwMiNqgi93Qhp4wx24DN5egpPR2pXcvUMsd3jwzDMiMw4AKHiqSkKTXRT9R2CRWpuFkiS6Gwoc4DqM9vQ1XxXojBmUPG80QUyxjDFs85/75q1uLYalPDG0gTwMNsK5U/fyqH1PpzKyrApSEAYljYEKT5EfetsbVcZGGWLTckOSahBqCoZp3WdVA3gY3fUVYWumy3Nsu4DwnGAY2yF57n0qm0qKCQRiVf3ifMMedWcNxJA0jxyJFCxJ2sPmYHyArmyWtRLxu9yK7UdLW0vLWXxmCqwDgj5QucH3qRqepRi0EdtLcLxg5xtJB8/OiS3bUF2qT8p+cscAL/eqnXEjicIjkMvGPI81rBc2lLtETfBNx6ZLsrySS22H5cscufMf51Mj1GayK3VrMyOmCm5c5I8j9aorCNnWJ3LAvII1+bj71Y63HNpFzcWcyoLiBzG2DkbgccVbx/dSEpvjsjXV0s6zPlRKzbmAG3B9h5U7bZWPerhnxwoqpmmNw+ZU2t6+tXOn2c8sQVI/kP8Q4p5FxiZQuTss7KfGj6nbyQtKHWJlYSBShDjkKe/2piDSb+3x8p3SjcoQ4JU+bAUhUVJSJiUXkbgm4jjtinItTmmVjmQyNwWXggAenoazU3VI2hFWmzXaJe2OkajC2ovBE0a4CorARt6v7+54qv1/qCz/actzpTyY2bXIxsQ5+mCD9aqhZSNaSXMzFvEPBJ3E8eVUbReHuWMPtflg3OCPIH0rsxeRceJy5vHcZcn7m9t+u7e6tbZWaWCaIMC/hjw2yP5Cj/CzTm1XqvxoNSKSW+ZODt8TJ7A9xWAQfMrbQmRzjz+1X/SpkuNftIpZmRZ7iJAsZw5BkGefL9ac816ZOKFO0Tb7VNTOvLZarfvfSwuEI3KwGDk8jyz6edSOstSth1D4kyOUlt7eQFDh+YlOfcVQW9szdRGNUbBuXUOq47E/wCVW3VEFve/sqR5TG7aZbOhK/mAUqR/7tdC/Pr4Ikrg7+Ssu72UlW+KVrdzkIUU9v8AEB/lVXMQ7s4liXPICFgPtmtdqVloQjjiVlt3ks4ZI024XeVGTu7gnzzWVuoLaI4jkct5qRgj2rc5wRalcW6EJIsgPBBGaHx6TA+NYwlvJgu0j9DUbb82WHPvSgnn5e1Ax6ZYZYhJHcpG44ERBJPvRWtxPlpGmkMpGCQfL0PrT1rPaQ71ktVdZMAtu+ZQO+PLmrix0Bri1e6gWe3gbK+I65Uev/fFAiDZ6r4Ew8YSNG3LAqud3kRkd6lpqf73xFfZHI22aKMbHY5/Ng8UzN0/MhWS4uxJFkYkQ7sqfMf0piS5judlrJNIwjO3xQm4sM45+lAdmuZ4b+2e1S5t3wu9Y7kBl/5c42tn0IqPo2kWt3KFS12XsTFhGJWCHHmpJP6VmYNSudDuGEDxTRZztdMq3vg8jirzStZ+GbxHthDC3ynYrLjPnnOOft2p2I2P+kt7Javpd89zEY+N8cmfcZz3H/fFK07ri7DmLVbdL74ZseNDhXkjIwD9RkcfTjzrPS3WEjtYY8wKxyJF2FQezK3n9xUh7OK7l+GLiK8C5gulYr4ns47EHtu/WhxUuwUnHo1ml/iBDYSeHb3DNFGwLO6bJIwTjayHuPpWusdTsOo4zLaXEKXW3hGA2sSc4Yjz9+x9M1xVI5orq4iuoFe4XG9AQGJ9QP8Av701E2padKz2U8jAnOzO0/THtWLwr2NlnfudiRZNKe6hLMHYkvbq3yNnHIB8/MYofAxG3iubQWrDePEWZWI355fHbJ4yB+lYDTeuLnw47aV3lCIQRt3bufQ9j5eY7Yq50rryw1C7t45A1ortskySFPuecZx9KzeNo1jliyQur6fZ6y8MsbxPvZWKI8ZGDglSMFTnPHY0xFZQyahb3T3ht84VPCx4hJP8bZJ4/wB4YNTdTvdLvlMjeJAyMTBcMAct6HB5Bx3pNxZabcxJDsSa5HzoxG1ynfAz+cZycd8cZqGmi00yfo3S0DSXE93LJdrJcMHjnUgLnywpwD27Yq5h00ae7JayXiWCZDG3n3iE98MuMgDyPPc5qkWzsbOxilgv2tjIP3kEjOPnx5MBkev0pen9RyzSLBqUIkV2UrfQEo4PIBYjnK8dvInIpqQ3EuNQSe8V7vTjHrMjbR4IkRGhTH50ONyn1/tTuk3wG63eGSG6ijXcviGfbyQA2Occ96qNQ1gXN5Hq1nCr3kAEWfD/AHhwOX3A4Bx3VgKu9V6nSLSzJEZNzssT3S2wlijJHc4bt5d8irUkQ0Il1y3trx4r+1WKa0TLSrKPkRj3BIUkfrVbqlxNd65BFBcWkqzI8cal3BdSAe4OOD5nHFXtvq9rqFptv7KWSRQBuW03JJ7gHNOC10h5FgjtSqoS4C7ljHOe2duftVUSYe86QuyiKptdNmjJZZUgeWSYeYwOe3uahw/h5Jqapdx3MCNIvzssEikD/hIOPvXQptClnjaSzvCqk/KkqiSNT57cEFf1NQbXQ7rM803iwzuPn+DlzGW5+bDefbPb706JoxsfRer2svx3gQhG5bZcFVGOCSff0ParuCw1nSZzPKtrdwsCqqIRbPCD6MDtYfUVapdeDZltSjuLOWBvCMsCZjmHk20bgfofOnReC4iLJarfWjDaYkicOrepBGP1p2LiV91PfhY4LbSmu0IxIyyxsV+vl/32qkaa0tpJbSPTjalyS07u0XJ/hBXnORV0Wltr55bbSRYtKceJCTLsUDlim0DJ47E55pWh67ZazbzNeWb2wbMZDxYB8vykZGe9Fi4lFaot9bGTQ9ctC0jkGK5Yn95jkFQQc8Yp9Lrq+1t44UtrKSKM7ZJg7K4HnguMVN1P8O7DUZDJpkqWpZRvKKRkg53E+f0NFPo+t2ryyWMsykIuYQylAB3xnOT/ANaYqK290+XqYNDf2MMFzsb8jfJNgeeRjnjBHnVbdfhpLahW0tZx4u0y28UyExN7bjz9OfbFaiP9ryoFu9JjS53hGmtzlHBH5hgDBHGaqdUu7awmY6is8RlOFLpxuHnkEgjjzyQfaoaKRN6Us9Q0qxWCKKYN4hE2PnST2wM7eK31nLI8A3QBRtXCscYH3rF6GZ9BtRNcJIqBf3jeZPGDwMA49KvrPqDx7uKMiDwnH5mOfLOO3f2ohrZb+CTrGozWChYlieSRgDEHG7H08/tVNrnS1p1hbxx63FIgHERt3ZSv35B++e1aeZ7ORTOFBKc8D/pVTeyzXUTtaSvEJGycqec+XHI9jVtWS2c1uvw61qx1Vhaahe3FhACUS6f5iQP/AAyMj04ODx51Euehtd6xlgW/uL5IQTIRdSJhPqFO7JwK3Qu49Cl+LnXVXWVcETTeImV89ueCfUVf2mq6fqcYWNmDsMlGG1x+tCSslqzicnQhASySzlgUEsrwruyScZYg/oKK9/DXULB0lhS5vfHUKz26bZYx5koc58/OuzyWiQzKBOu9fnUNwSPtVVA/VVreyi6t7W5QsWheF2UMvkpHPNW6M0jmWgdBytN8TJeXdpBAcEOHVpDnPCnBznHqK6Tb6Jo0UkUkOnsZgQ29JCMuO2cEDNS9RgTUoIJPBeGZjtbaMtGD96i2mhXDWsjG6MV+VwJxHkKR9/p3NCikDYz1RDolisF9LaKt3bFpUWUOySZHzK2MjHPbmq/pLqeG/wBOvdQ0fRFSVdrsGl8OJlB525HDAeXFS1PVcUTWV/bWuoWz/KzxOqsR/iwTwe3HPas9D0hr2lNI2mW6yG5kyxmlUBFIOcovDfzpSj7opMn2XVFjqhWK40zQ2mnZkVUZTLGh8j2GfMgGq/qjTrvQraIaVJa3kcxXAtIQCijk/lPuRznv2q3s5pQ8tlra3moOPmHwtsoRAONm/AwOOx4q2sNGi0uQvbaHaRRv828yqHy3JyBgD2INSrHowOo3EwskOoaJJ4CqzOlzpzRyByeCZFDAj9M07Nb6edGdLCfUHu4XQybbaTwpGA8gePr9O1XRudL029uEuYrawmkdvGLXk0u8ZJAXzz29qp9autMR47tdfuYrgyePGqQb2DBcAkt7eRGfpRQWTOlpZ5ummB1ZRqFzMJI4549yKob+EAZU5OMEj6U1e6dJ1Cqpq8MktwmUdMkhnz8hA3ADv5CszbdQ6bCXlvHvLiORxMCWVA0gPmq9seWc1bH8S9N08+PFbBZZWxGrhl2L5liM8+mKqibNDaaI1lbyR3TadKFRY47dpvCHi4JXcxBOT24qJo95dePcRWNmtrNCUV7hJxNGH/i2nGCMcHJyMVQ61+IkOqRRx2loboRYcS3DMrqw4yCvc8nk1SwdamFLiNb23j0/uLRV2yMe/fPPPrQgkb/QLZv2mpcSXKqW3TEELnGRyx5HpV91eupw6VAmnNHMZ5AGhkhXCjHJG44J9vSuKQfiFfWxEslyWbdkeGuMDzB5+lPj8TLtnYmeSZZSQY5n+XHvkd/pQ0JM2PVHV2vW2hw240+3NsjKWuVnywHOVKgADPl3rKapqEG+W7OpowkG4RlNrwP5cYIIxkcYrLajrOo6rbLZCaZ40cuIYwSqeuOTUVBaSxYeeZHRf8H5j9aVDsuYup7myLSJcMBOuJExtUgfTj2+1S7P8Qb7S2Dx3EkjHlo2ORnGOT/lVBLpDpaxzG6WSLv4Y3E+/lioRs2klRUMYVu2O/fzFLiPlZs168sL6MvqFrL8UnzpLGSxY+jfMMj65qkk6mhFxHPZ2cdvOCSZI2bLZ9QSRnmqaW0uLdsNGzAZA2cg1KW0ksES5uokRX4VGPzH3xVITHb/AFq8c5e8lkDjJVySF9h5U2/UN09v4fiYJ8xwTVZcS+I7FRgE52+lKimjgKPtWRxztYZUf50rChc+p3M48OSUmMdge6/506ZLZrUELOJhgL83yj1b/pTNxcfGT+K0MMPqIV2qftTcjlhhPyjzp2AmWZm/M5du2SeQKa86MoAeTSSw8qVjoUqM5wozSPPmjVtoJ86Tux27UgAeexo0RpHVACxPYUYMlxIAAWdsAe9SXzY5jRlMxGHYfw+wpgIvFhhcQ27b9o+d/Vvb2FMqobuxomIX8v60gMWyM4NIBbssY75poOW5P2pGPm9aUAeTU2OgEZ+tFgmjV9tJLbmoGKChOQcmkHGSaXtJHei47UAJySPSlR/rRHIHtRAkUAP4A7d6LGaIHjORmjB4oAMDzPam7h97D0FLLYUims5NACRSgS3FK2ZFEuQaAAQQTgUpWKr70RY+VJLHzoAMNg5oFixzSSaBOQPKgA9+3t2pLMfSgRQ254oAILnk8Ue33pQGDiicgCgAu3ApwYUZIppfWjI3UAB33HjtSewo8DtQPYUAEoJoUFJBoUAdxtLDpKSQWVxe30bhjFvY7RuA8yMjBoouldPN5tsL2cRNuD7owwYc9xkBhj05qm0u5tMNPqFxKY1YFhDPnPHnx5Vc6ZNCWkuLe/gvYIkYoLokNjvggdj74r5l2mfRaID6abW5n2PFMYCFK4IDA9i2e2f0p6LobqK4tYr2DRHu4ApZhAVcgEk8hSSOMeVVBR7qeaSJSVQ5HhyMoK99vHP/AM1aM/HmG0bRNTmVWULK8bCNoyBjB28ke/t2rSCiu2Zybf5SPqulwab05ol+LKa2nuZp0n3bmbaNu3I7Dg+nYiqqUW1/YRiFRFdQAgsFw8gPbPkR/OtDO19N+GWlMHeSSPUJyxU5bjHHPOcf2rOz2t7plnHcCDxI5GJVk5B78Yq8kd/aZwkn2FJYm8tFETYuLdclSMrj0OfOorW8s2ltMYiUGVZZP4WxnHHPqQabfU5LWVZ7YMMnBQkkBj5HPNPza2JCIV09LZgp8QsS/iMf4sNwPbFZ48c729Gk5RrSM3BfTaVcLKPFVhlQ0bcqMd6dttVjuFlE1vBJn5i4AVgPX6/SpVwYbkyRIxhlP5T3Vj/aq1tOuLdmcopR0xkHHPp/Ku6DX7M5Jp9do1r6I8FtLCIT4c6p4ccrqHG4ZyDnBOPQ+dRppbvRLON7dAzGNlVJIlbgn/eHoKbkZrPQ9LMd1IhkLSEbuQoICjH64PvUG41W+urHY6RXMUbZZX77QeOM8/Uc1UabsHaVCNGmeEySSxQmTIkBKgAk5zx5Yq9h1J2VZFYyYG4Y/h571SWiRyI4gdnhlAOyb86EHkZqxbFjHBAuGdlLNnnAzjH6VE423Zpjk6LG7ZrmHxyF4Q5THJJPfP60nSZTHcQW8EyCRypfcuQoyOR71Gmhb9lRXAdiHfkg+QB8qVpdu/jr+9Te0kcKFQSBkg/9/WojHRrJ7NJ1D1PbNFqmnS2Szxu8kRcttUDefmz3JJxWdt+m9FubKJ7DqdDIV+e2ntX4Yd/mXcuM+dQep2uLXUbq1vbUzt40g4yADuPzGo9rc3VnYQ29ljezggbB3HlVxjRjJ2xj4S/gvmjRSApIHhtxj9atYrcMi8Yc8EZ5zVhpumi98SW9lUXEa7pGQ8qPLjzFFZIthI90XWdIWDqo5JAdScg+1ZyfwbQWrI8lpY6tqE6TXb2siybfF/Mhxxgr38u4/SqvUdElS6kto5orho8eG0UmVb0Izj17VadUpc297cCBFjCylfEZVADHkAt96l6fPpWodJXUmrRlbiyyQ8Q8PMhHyqpH5iSKcbrRnKr2UNuStvPGyhZw/Azwwxg5Hlgj+dO2FxPbxsMFPU9qcs7m68NEiiW2ubjAKud8QycYOee3f3pGpWGrwQRTSITCO7QfOBjuKqn7iUl7BqqSOAk35/meNhzn2NMwxyR6gI4AA8gClSM96VNqunW8qRKjvNwAwPJH0q90e3EN2L5pERUG7OcupxnGD3GKn7l7Fpxl0zL3MqGX4cs8MqOSMMRyO3FXOla1epYtE3iXTEMuA+4qPo39qd1PUNJ1ENJcQPb3aMd0qYG704qqjj2N4BlHzyfIQeHH9vKtI8ZKmZtOL0WcdzpuqxR20sENi8Y2ncpQsceZ5/tUGKDwbhAGHyMMhTk4PHeqvVJbkSvEZBNGvzKH4KDzwe4pu0leK4Rlw+7ja7DkfWrjgraZm896a2W1paiCR5WOUUgLkZ3HOKrLu5Z98R3R7lO5cZyc8Yqc93FAhdlYDHy4bOB6e/aqS4vF8eO4dgUVcAGlxCc1Q3ODasXiL5XaMdhjzpcF27GRpH2jzAHelBFuY1GfmeTcR5kUmWxaBl2qxVmKrkfzptJrZir9iVY/NdB41LEYHtVVq8j3krXLxhwD+dTgn3Iq6tLYJenOQEZDKP8AFng8f99qq7aF7id3iVGAOGGcZXJGSKcEk7Lmm1xE6VKRdQJtziRDtYZPernruORustWPhqCbp/lBxxn1qPpdvIrLMERmidSOD/i7e9XvW9rGnVOpySAAyXLttXt37Cpc6lYo43xMjEqoy/ERjuSrY7/pVmL3ZbSIAyRg8t/0qP8ACMl2rRl3Qhi6f4fWnoA13A4dcLnIyPzdxxVSVlY24jVtfKbiPeCVweSP50qKd3mZ4I1l2k528Mo+lIuYCuJUTMS7fkB549KEM8a4MCv4gbK8cj61m410ON3suI7W4uLVQ0skMQJJyuDg+R8qr7qONrklOVXI3DgD7VdQpd6jZmN3XdvGV7cbe+f5VB1G2WzthHFDlxyzBcZH+VYqWzbJHlEqplXKKpAyo7HIPPP3q56Wtppdf0raoGy8hHytgnLj+9VC4xtYY3Dz8q1PS+nomsaXPHcF0S6hySMYbeMj3rZM54K2I07UIrHWrm0eFmaa5kMrM2MhdxwB2HnzQ6q05pLTp6S2UoDZNEkUjguAsr4zjvjIpOsQva9T3CbSELzlpgDjsxprU5Y5Olen3UY8KS5iDZ7YdSOPvXbjk0rZhOK3FELqsyC8sJARhrC2DY/gbwx+lM2lok8kVzOEkCkB484D47DP0qw1BNOnW3MUrmU20aSqV+RSB5H1FRUvRZsiJAC68ljyHHHlV+ra0RHEluQfUd5DqF3E0FitssUQiwGLZx7mqQuUOAp5q/ur62aD5rdAzA55zn6Z7VUx3UrvsEAVD6jtW6lfZjKFdCY4fEj3naOew7j61Y2d9PpKGS01OeFm+UKgwD9faocl00TtaraiRXHfsQPY1ENrcEnEeOcYLVVkV7FqdZdoihCEv80ihcKx9cDjPvTyRrqrhIWnkuZAP3agbz9/Ooum6G88oSeVFAGdqsNx9gTxn61d6P0ZZX92rx62gjjbLxFNk6Y8u5H3FUk2K0iq+Hs5D8NI3hTJyGcbWb2OcAmr2SOB7G1jsrGKJ875ctlJCPIBv17+ZqPrbTWOotbakJJEjciOeRd/iIe3J7nHvT4ERtVTdAYly8ZLgKvsG7jP+EigkW9rcw2SXMEaMjyFPB7qSBk7f8JwQfvTFpdScsqSvDyssbNuEZPZl54B5zVrKXh6RtHYAgX0gbhWwDEnPaqi2SW0HjRsqB12gHDIwHBIznP/AAn9aBlvJdGeAW9yEmKgCG635kg92wckAf8AZqth1Nxepa3BBcBgrOABKc4DA+f1H6VEnvLS0uNkSBXcEeIQQgz/ALpzjn0NSb6OHTJoIdU8GSOSNJ1ABxh1yNp/gb+RxzRYqD1NTJtnkk2HadpZeHGcY9QahtaeLCWBeN4+EMZ3Bl88+Yqzu444LWO5hneWxPyeIcE5/wAMi+TD1HeoKqQFNtI0Ujk7Sp/MR7/50wKya/vrDKxu2xxlh5MB2x6VcWXV99Iir4jSNGwaNS/CELwRkfyzUW+t1mjje4MZk4JK5BUeZwRUGLw/9lHBGZcFfGLHDKTwSPUVDii1Jmzl/EKO8lYmyezO7e4Lh0zjnuOxxjjHerXp3rXTQ/xUqQWzLnZGgL5yDlge+7nGK5vIjWoy0kYyONvOT71G8QvFthiR8nls9vtnioeJM0WWS7PQugXtprlm5g8GK7BzHGsxIfAySF8vPtUvQ5Gtry6kv9Pjgu3Uh3jG5mHkCONwx59688xaxeWksUlrNJDcQgiOQNkN7fz4radOfiLqdvbf/RKF7tISJWeF9jceRU8Gp9Kui1lXudYuuobfQYj8TpF4LNEEgu4cSKfbIwQPTNWmm9Q2GoTJHZ3ELy7PEMRI8TGefTnntXPNN/EjSNQj+FvljA4ZElX5ZBjs48vTIzz3qHqkWnRX1lcRzt/tWuBDChBZW4KxkZBI96KkvYOSZ1WC5nu2cvDJavHIwQyAcr5MMcc+lGgkEplF1MJCCpjODGPtgVlulk0O3Hj6Pe3tv4q5eCa4WQDHqh/KefWrjX+qbfR4oJPh7i9aV9gEODjjknyxTTD9i5W6ROXjZGJ7gcUFuQ87I27ah4diMNnyHOePeoVpcR3tqJocyK/Pht8jj7Gl30lvFafEzNGiQ/M7v2jI7NinYEwbfGGFIJHfnafb0zVLqvT0mpyJIbu5GGxjeVIGf4WTBXj1/SpGk67Y6lAZre9gmRX2u0bFdp+h7U7czNKhjtbtrVjz4nhh/wCR4otBQxHoSWtq0EQVyzliZWODn/FjufcYqLPYahG8MVuxAQMwjU5Q4PY5wfP6VbWsx+HQTTJLKowzoMZPrjy+lLeUMgJZpF7lQASPoKPYRn5rq9sYo/iIpGcORiONgHyM49Pbv5VVm9fVLB7MQW1rOqNsgmlyF9Ay4I5znj71sY4riS5zHcqYtgVoDHtYHPDbvp5U1qUKKwlNvuP5RII1dh70ITRltF1T4SG4W+SUSxtiWUuWj3DjjJAAGK0cGoW0lsJJiHDDOQm/cMe1ZzqfQdK1fxJ5oLk5AR4IpmjV8eq5wcVzy+6qudNuJLWSSfR5YsJHJhpI3HAwwI5GO3p5GqojlR2qO6gnlVYJ1RI/leNSMNkZ5yMj7Uaw2cQUI+91Jwznew+/HH9K5BP1DrU1mpRVJA+Z2QgSn7f3FOWvUur+JtVS8LDkoQdp7Hz8jVKIPIjrtz8NLEzXMUU0aAkYTeO2OMf0rNarb3d7YSL0+dOhuWQpG5Vomj3eY9eM84rJjUr9Ii0bz7RkspJ/7NZ+66suJDO0OpXMZjIJjntmKA+gJHBp8SeZudC6Ym0ySG3veqJbq9UFxbmYlmT33Ht9qtOptXXRIo5bSaSQq+1ofEIB3e/kK5zpvVVwyCW9kheRWKiZQNwHv7fSnZtWt9TjkLIJWBID8Ej9e1EYUhPJZv7frG3vNPWaQiOQryjMCAwzxu/vUC362kmSRPFt0MZIbB3n/L+ua5xP1NpmkKYy8ihPl8NEPzfqcZ96qbj8QbWZCg0wn1LvnI+gxinoVs6+OuEADMJHdQQQowpHrTX+nUjudhiD4AB3At9K4tedaPNFGimZflGUXaEVvbzqvh6lvYGEqzhZE/Kc9vpxRyQUzq9/+IUiXRiRj4zk/LD+cN6EeVZ3VfxQ13Tx4aEFs4HisHZf0/vWBGqupLCVN7NuLYy2fbjvUSSd5m8RndmJJJJzUuVjSZdS9Ua3dNcs08jLcEmVduVyTnj0+1P6bq9nK0n7Wlnd4oyEJZsscdu/96zytO5H5y3cAL6UUkUitvnDqzcgspGfelZVFtcajpsw3ql3EyjASMjj7nmoiatPIPBkkZ4jyVYcnHbJqE0hGBuA/wCHBoAEAtjv2NDYqJKzl25Qhd3OGOTSYTbCf522r6nJx9fWiQzOVEUTOV5IUE0mSxnR9silGY9mBFIY89xG8ux28TIwrgbcfYVZ6fPp9rcxSSGGaJuJEKByef8ACaqk0m7LMrIUVRuZip4H071LfS47CzivGfxfEOERhwcd889u1NCZoNR6iazRBpJsxHKGVkEYDqvlx5cVmLxiW3u4YyAkjnipmr3c13Il0YBHFsARY02rGP8ADkDmlmVZ4ohdBY+QcFNxKnuR6UxJFQpkjT5SGU+ZH5amQJLcOu6TxGOACG5UVLiW2imUw2jXhwNsZJ2sfUgUq4lKI91cG0t5WfHgQoMgevtj60qHYV0z2CLbrfMkpG5kReVz/CTVVPNcXBAd5HI4AJzSGffN8jOxY/c0/C3wzHLKu7gllJ20MaK88exoKCzetSJQrjDDPPccUj5VHbNSAYwBjikuw+nsKG4fSkFh6UDEv/ug/ekk5NGzZ7cUjdxQAGNBUZyFVSzHsB3o4onuJAiAkn+VPrGbZ2G87hxxxmgA4WEKnapWTzYnt7CmmfcdxOKN24IAwDUZyTxRYxTMCeKSTRUMZ4GakYa8qcDnPencoi4bk0hRsHPNETuPvQAkjceBQ2YpY3Bc44pBNMAHtSfOj3UYwTzQAktnAoUP4sUrFIAthxwcU5FycE0hiRSlhZ135UAeRODQAUmQCPPPH0pCk5qa+nO2nPeh12RyJGUJyTuDHP0+WoYGKAF7hjyot3tST3wKdt4XuJUijQszHGB/WgBHfypLjFba2/DmC5tluU6ksyjjIxbynHqCQMZFRdZ6DNhZfE2mqxX20/OiwOhUY7896BWZIY9a2Gnfh+b/APD3VesXv1jSwnjgFv4ZJkLED82eP0NQNB1a00W6+HksYbtJk8Od5o1bAP8AgyOMeveut9O67YaZ0PfaPYRrcQX8sUsbEIwg2eRUjBz6mgdpdnBSFAzkfrRbgfMV2z9pzqP9nZ5//U4f/tKL9rT/AOG2H0toh/8AJp0Ty+DieV77hx70hsHgGu3ftu6UELIiqfJYkH9qpeo9Ih6niDyuFvIxhJeBx6HHlQ0HJHLQPk+9GO4qReWNxp8721zEY5EPIP8AX6VHzg0igqBIIoGioAKhSgBQoA6LqOkzgAWmzY+PkVuHGPU+dNdOaDrc+p/slVt5HuMuGlXIQAHIDjkGtMugJMZXi2o6jdmR+eO+RVNqs/hMDBKpUEMFhX5e2CCM8Hz7187jza4vZ708S7Rd9S9N6p01p4v47m3kiZlSTw5SJEb0z5j61XaPPLN419DMq3fcJFIC/HqPSs+l6rJtltmBLcsjfKfse1M3OmAyxXNg0h8UZwRkgjuOO5/Sr9JNa0RzcXvZ1jTY0k/D3F5DMCmotzuO5Q0RP1xx+lZqaS8RZGhl+QDxEQNkRsMc57/r696ven9RkuPw6unlkluvB1GKNj2fb4ZHY+Y7faqq91zRYrK0MVvvKRlmmGN7Z7q3PIqMtpocK2ZXWdVvbuZbibUoZ5DkDsGH/EPOpGlw6ZdxyPqNzdWkyDKNb26yxt7EFhj7U1e6ToV8lxeQzTWk2wSwxvFmN/UZHKn0qiaWa0kj2uJUXuQeB9RWsN9EStd9Eu7tw98Q8hbYw24GOPp5j71HnviPEiZiqOQORwBS4ZWkkGxUYJ8wTPn7H+1PTQ6dqNuVl+KtryP5kIIKSexU/wBQa1T3sh9aCj3XEMcO95EQHbuOSo9vapQ0mZykrNH8PlRucYBA7j9af0PTkZZXjCSQWsRkmL5Ge2FOCMZJx7UnXYtHnCXOkfH2xkC+LaXHzojDvskzkg+4qu9Jh1toctIpLN9wSN2Xk7TkH3HtR3m8RwzSRqjxpwv+IFiQR/OmhK6JZtIHibaCwI7jy/vUu7KyXEO11YMiKCuflyNw+9TdGlfBN1bZFBaW8Tblz+8fHGQBwCPfdTduYrb4eZtzosgkK9wSMDn9KehiWWwMLXZMcczIynHynvz+lJtTGkTRIsbw+LhZiSNv29KzvRp7k3WOq9N1p57T4cbVYkHuwY+eccfTtWW1PQpVtWnhLeIsuAYpMqy+WMfepdnpbySz3CxrauXdd5fKSYOC1WdrLa3Gn7p7qaC6DFUSNAAw9QMYA8+4ql9r0RVrY1ZPDNpgiJ8GbkMfyhvY05pOnzJeoj3ZihlRt7KcYXHJ5pduq7glwhlhQHd8uCff+9ICupzCdw7d8/apZaWiB1JqsWoz3ck0cZi3s0fOHMe7jK+wx/nWZsrdbSadArzFAZotzYCEDP5fPv3rYXkFleujFYlnb5XGdpB/yNQ9U0m4kQrDHE4ztWXOD9D61pCSWjHJj5bH9LmgvJ/FvCI1RGcxhgWlkKggD0BP+VbLpmwkv4vAI2IAssUYH5cnByO3n5VzTROmLsT3VxPeSQhF4XGfFOT8vt2+1WZvNZ6Ysk1HTJLiNJHMRkZt4Zu+0g5zyOCO9XKKbpMzi6VtDv4n2tvpfU1jbadbpD+7xO/hgiQlv4vt6U18LeSXUM8UtxOCygOAWOMgDI9hwfalX5vLma2nvtRZNVvZ1aWzRQflx3b/AAY74rT2WjPJoqyQpJeYQSI0c/hvGynnLe3Hak5dJlRXbRlLmC1lWSGa3kgkC73Lj5X5/MM81WT3UFxPCLPEc0Qx4beYzWn6h0iFUkuXaSK8uUDRMX3+KzckH0JwR6Vz2a9FzuVbOFNjEiTcAwHmMHvWkIJ9MieRqrRsdWs7q6aR/gwzMN7qgHHyjjHtWNuJJYISwTaoOCffPYVqodZtoy7kmO9typd5HO2VCijHHmDWZvNaS5vrtgqoJG/NjKn14/vVQ5JtGeZxasLxyYUaNyxVSShPA+lQ4LpJt0e1ioPzHH5akx/DSQiKLcsmT2/LiojRSQPtD7pDyxxgU41uzB2WmnW4BLRvkr5DnA9avr+AzW9oAMKFJz/vDms/YSSCcS5ySpBxwDgcZ961BB8CLxHLNCquM4HfjmspKmdOJLiQraBLHV1nlRnilkbxAfMAZAH3NRrSaOW6aZbIW3iYfYQSAMEjB/zqTfYN2MDejN8hHYjH9sVFtL6GaRkmkkaFYn+UHAIK9v51SWgvZN0mdXVgpdELKACMgYcfNVz1rG0Ov3aShMNcStkj3zVPZlIrLcZFfxZo1UA5O3cP58Ve9dpLN1nqS3LDCSYXA4KkcffFZtWaJmdmt/3xAKlljJ4GM5/7NCztZDGttkAIDnPoe/PtxVhf2ZFy8TMGdo12qhIIHHJ9ftStUSX9nSyW0sfij5vlGc+v2xVJ2DSWypntUAK27iQJywJAIPkB/wB4penTwvAZXeMkH+JQefSqi71Ge6SPxoVhkX8zjkOKcsoomZorWVcPyQG8v+/KlKOiY5N6NEbp54GCoVYMpDE59eMennUG7IRm8RBI3J5f5cj1qPNrSWlisVt4Lz+Irt8pUg4IORVeLqW4j3PHks+FXjB+mKyWN9+xcsqqkNq8j3TFyMMDgEcCtd0nL/rlihC4S4iYMAMg71rMyxh3RfmWXOGI5C/X/KtTobPFcWpHhnY6kKG/L8wqpSXaFijbZodTLzdQ3m5EkUPIgXHuw5qo6h2/saK0ht1heG4eTaFGPmVR/wDJqfqE/wDrl6zGRd8rYwCcZbk/SocjG5lWIopUHBz/AF/pUPyJ1RsvHhdlSbMiMqUOSpOc98LVLJaTzTC4MnzKQGGOxP8AD9q19/mOOdkCh1OACBwMY/nVdbpHiWYoTlvE3Y4z5DFSpyqxyxxegnt1vlRVtYQqgKzkFefUj0NQV0z986eMow23CjNS7Zrj4nwdu6SVuERfzHyAAq+1Xpuz0Szh/aDStqczq7QWr48FPPeexPbiu/HkbijhyQSZAsel0u2kXxGc7Rk45A9azMmv6PaaktsxkkiSRkm8RSSuDjK4q/mm1DTyDDeO9u/CSqcZ/wB0jyPtVaNMj8bx0t4Vlzu8QAbs+ua1UpW+TMJ8PZbL49M29xZpcLh1kzIDkjjGR9OKiyaNLHMstpDsTGT4bnPHrnnPoaii7voFCPO+w8ZzxQc3Z+bxnOfMN3qoZZLsmcIPoRZ6laajNcwSXMEMsKHw45/mE7EhSFBBGeSc8djUQTT2MrxtGskL4XKkED0+g+tTel+jbbU+qIJbzW7bTIIv3m6dc78clQeAPvW2HQVlqkr3nR+t2WrKV+YBgskWD344J+uK3hkvsyljdXEzlxHFcdHWZiIjzqcoVHk4/wBknCny+1UkEjW+CWmUpwCFBB9j659aueqdNv7LpSOHUbQwXJ1eWRleMx7gYV5A+3lkVmBqMcQWK2RkRecs3Of7VryRlTLPUobe9SG4t9kExQ+IkKkqcd8gnH6VoB03HrU6LJI6iPQ45EIPDMEbb9MY7VkptQhjChipjUbmQH5j9D2qz6Y1nVOodajs7OJkC6ZNaAR95AscmwsfI5b6VlLKqs0WN3QL3TX6asIZDLFLHcDY0ZjzHIf8LL5+xHNQ7SCZ5Jraygn3KpcwyOAVAHO09zjjg+VdX6N/CiexhOp6vcrfart3Qi5JaGFvL5R3+tVfUmjWeo3TW3VVouh6uRiLVbYH4ec+W8eX1/mKyj5P6a+TV+K672c7jupGmCu2Wb5HLj8p9sHmq+6t/BmeKQCPywCcZ8jV9rXSepdOyAzRRgEYzEN0Vwn+OM+uOSv3FIZIikZlRVyu3Lc7/cGt+ae0ZLHLafsZ6MSJ864bccFGPf605ZpBL48iXUUEi42RScBz7Ht+tS7q0SN2YbljA529x78f5VTCPxGIQcjyqyCwmSRJ0L/uvI7RlQQPM+vvUiC5kYJEBNlztEhbGfof86rIbwojRShiuOCpwQam2moRxhB40uQ35Tzuz60CJUqRX9w4kudsaJtUOP0HHqac0zWdQ0tPhkaOWHzt5SCDx3FV8jIJd6SCNA25XOSB7e1TLZbGZiziUTHGSGxjJ/MuO9MKJtvd3d/cQ3EDPGZHbwpkOdn+4R/h8vep51/XNFjjimeV1t2zuT5QPTtyKqIrhoYXiRviIovlUovzAd/IZ/rUm11VrqzhYTPuT5DuI3KCcf8AMD6eVAujZW34i6jPZpLY30IlyFEcynPHcZHkRRXfWq6nDMbm1hllTBfydQPJSO5z5VkPHs7pmeH/AFe4XG/ZlSRz3Hb+lV/7KvrO+QkF43O9DIDtf15XsaKC38m6set9VtPFawSGeOYA/DNKA4HsPIkf9PSodz+Kmo217hor+KJch0kIPh5PBGBz+tQWiswqmK48CaMBWC5YY+pHbNLku721u8mPxoWQJ48aglD7jzzS4IfNkmT8WdWt75WtLq1lilwSkq4I9cn1rQ6X+Ks9xcZlt5BGFyGCfM/HIznjmslPGtxCDcWtpduSSf3ao59P+xVfPY3QhjaK7W3Iyoi7Z/yH6U+Ic2dHT8TI5ZY2WzJaNt26T5WHkCD58VMi/ElmgICSQE8qWBdRn18x71zNC0Fm0Oq22/zhmRgSB68Ht70VjdvBC5tnNyg7o5zj3z/nRQc2b1/xCllSWKVElZG+UoxCsfT2+/61lZ9e0zqBjbXb3QIkLKtyhXB9AV4I+tVLXLEtJNatAM/mUbwwP+ICp9mbNyspmRpB84OSAvHb3ppEtkC9F1p6q2l6s7Rs+PCTJVT75NRNS1DWoTHLqWmiRVyVntnIdf8AmXv96uXtGjmM8UsEkoORvVTkH3HNQYtdnt7sAQPFITtkWKI49j6Ee1AkS7LqiWRYvh7sXRdcNE/ySqfpjDfanLrq6yaQw3kEkVwV27LiIEA+fvVNqukWlzIw2S2ciDc0nw/Dn2weM9+ajST6rbxC1cQ6hEy5CSkTAj281NFjpGgS50ye1jmt9UW38ypjXG7058qq3s7PUJT4GtQx3Lg/u0RsH/lx/eqZRpt1GNqmxlzzwTGfqw5/kaQ+j38BZ0iS7j/9pCdwPuMc5pNjotX062sJzazahHLJgDhNuPXJPlUmOTQYoZnWwFxGpCh3wzKfPuefaqqK8j8OKO5iJHKNI7cgZ47+Y+lKurCEYS2kKuD8rSkJGf5UWFE+Gx6b1F23XbQbmGYRGBz7eY+1SP2H0f4hiW5uC6HJG8jz7c1nbjTZ4IkV4HL5J3Iyspz/AGqXa6HdQwi+BjEkf5oGwM/qcc0f5BRbXml6FEzz22oQwIg5gKlyw9/PzqrTTItST4bT2tpJk3OXeLYCvrnPl9Ks9JutS1C0nuLZcFV2EEKe3kCaKLS9WieRj4cbzYzJyvJ8s+X2ooSIll4cDSQTlkuH+TxzIqxhe2QDz+lQ3co63DXQvoo8Ays/zoM8AZq2HTWt2l14iwrNJg7ZAUYg++aTqGmXunxRCTTVmlYF5pmiDrk+Xby9RQOwXerxBWH7Ht4nG1klaIP9zgYqml1FZ7iSSVY5XQEIpUKmPYedTTpt5qcIcWnh2ydlA2Ej2AqDJoytOIIxNAzMFUSqcnJ8j54pOxqgrLUo45VhiaVIHGWRwBtb2I5xVzY6zpfwskepKb51JaLexba3sx7VHk6S+DZ0mlluEAyojjKsT96btraaJbp47RRIuMPIoEkZ9gR/PvQrDQNY1p0t2to4fA8fDElf3mMcAtnkVTvJ4iomHLY+TDbVX1wKmXGg6gyiaRT84yMDc/6ZzUdY2sl3T20oBOP3kXCn1ByKNgqGFVY32yP4qk5ZMkEj0o5Gt/GAhWQR45SR+foDRIY5XZmQFN35znP8s4q0tLCyeUSfDSMp/wDDGTk+oBwaAIovAF2w2bIzKEBEjHn1BPrTHgXElylvO6iQ5wW5P3q0067t9PlnuWSMvEP3Ma/lZ/LIz5VXzXUkssk2Vt2kOXCjkk9/cfSkwQ7ZzQRwyxlIVdQczHJP/Lj+/rUW6vRcRhXBkYE/vGwMfQD+9RWPr5UhmB8yKVlUGz57UhmpJk25wabZvWkMWXApBfJyKIAEH3oECgAtxJpSoSaVHHnmnWQhN4/L5nyB9KADjdoAQjFc98edNTTMSSWLEnOTzzTZLMSc4pPYj1pWOgMzN3NJxR8tnntR/Kq4zyKVjEGlxo3fJHt60AMDcRn2pe4ke9ABNg8eYoBkjGWBJ9KJYjIrsP4O9NnJY0APST71AFMjzpzw/l3EgCkcZwDmgAthBzR4o8nHNJJ8vWgAvMmnAKJYWA3Hil8igBLLk0ayGF1ZcbkOQcZoE4GaSBnk0AXiXsl503qjyRW6sbq3LGNAhPDjsOKonUqcVdWCK3TGssc5SW2I/VxVYttNLGGCZ98ipT2PsZRSxAUDcSAMmpzAoGsbPJY/7edf4v8AdX2/rUc2Fyf/AA/5irbSlW1t2E5VGzkZPlSk9aHBb2ab8M7edupLTS1EEltJy8U+4oRj0BBz9xXSOubrR+hrJbl9F0q4kmJWJESQEn3zJ2HnXOOhtYsdJ6tsr+6uEjtUUq8ncL+lWn4u65pPUl1Z3OnapBcICkHhrG4ZBuyWJIAPPkKw+7l3o3fFR0tnOOoL46lfT3SWFnYBmB8G1DBF+mSTT+j9RXOh3EbAhoHH7yM/1FaP8Quh4emZ7YWd6LmO7Uthk2+GRgYz5/2rHzWEzouCucY71spWYuJ2vSdBj1vS4NTXVrO1gn/KsscpOeeMhCPI+dSbbo62vWPgdSadKMAkxQXDYHkeEqh07UrfXvwwi6V0+RZNajlRktnfwvEw5J2MSATg9s5q+/B/pzWumbvUm1fT3tEnijEZaQMGILZHc4PNZvNNI0WKDaQ8/wCH0CkK3UFpuPdfhbjd+mylD8PolODrSkj/AA2Fwcf+7WkXSLteuptXa3PwM9nbQiXPHiK5JGPpWlljCsccHLCs35GQ1/D4zi/WPR2jR2OdT1vwcAiGY2Mwy2Mhc47GuMyW5QnncAeCPOu3/i1rVlf26aJZTx3N1HN4xCHKrwRtz2yc9q4xeTqpEMsU0UicMrLg1riySkvuMckIxdRIp2gZpP5yAAfap97qNrc6fY20dt4UlsrLJIAMy5OQTUe3uooHVvDLgEEhv4hntW1mVDfhkHBIzQp6e+gkJMdts5yBntQosDq9t1PfcK8cfyZAOSQw9veol7aW9zE88kJhYfNznB+mP6UjTdOWWxV/gJhNnAMcvf3HlU7TRq8N3LHp1xJCzrh4XwSVx7n+dfO+jT0fQeqmtlNNawW9oAY1kj7/ACygHH3HNM2+lhQ9xpskkMa87XJcZPGfbzqzuku0Dw6pbXRDY8Jiv5T5DtTsPgC1gitrlZX3ZMbDaxGOBn24pqU49C4xkanp9bu46A1OO6WNZIr+1ZnjOd3JGTj61mNK6asLi0mJvYZZ9wKJtYZx5eh9a1fRyOnRvUED2+zFxalk/MCu8A9vrWWaYpdMkRknhI2NtQkLjIyP0NPNycVTojHGPJ2V80s8aPBNaxTxtkpkZCkeQIqolmtAPBAlj43FGUHaT558xVzPYSwXBGmSvdow4UxndzVbcQ3txmW7s/zZVio7EehFPGnQ5kWPp91VZraRJ0JO4ocFOD3BqLBcxi4WG+je5tRjLxsAy4+tXOjyEPDEjbQXyynkqPMEehqg1K1uLCZsbTucjaPr3NdMHemc81StG81Dqq2PTkVjBEZ1eNYpLt4VjmbBJG7B7jyOTnArJW0hdJBGGC5wCRjcO3NRZ9Qmt7OONigzy6gc58hVl0zPFqF6kNs3hAESO8xGBjkgn0qnfYo8bSLPUjJJeGOVBiILGQB2woH9iahtqksk0Mk0cY8OOJWyfzlFAB/pSruKQahd3DOZFuZDJjOOCc5AP1pqec2kj3d5bJIpPMQGO2B5fSo7NHrZPmjmhuLxnmyrgSkAADORyR38zU3TEkk0m68aJfDEqK0jNjaG9OOTkfpVTbXEGo3IvImlP5yI3OScLwCfOrZnnuNNgijiiwFDyLG2SWH+IfU/zqZKi4/JA1mKKzcKmooHUAKW3Ejj6Dio8GpObVolDPGXHO35s+f1HnR2zRXUwidApLhcE4A9qZT4e91O2slmt7dyxjQSuEQAZPLe/qauMb0RKVbJ/wAaHbeYztPODxkVYNHPsjMMbZZAX2gnPviqULOng7WRg7ceY71eftaRZooFVGMS7A6ncCx86mUaNIvQ2sULOxv4soV3iUDnd6j39qcXVYxCEyWXbxvUEgeWcUjxGUC2CxmEBneJzt38dwO/6U3c2LMLe0Kj5UaQqjghVLZA3eeAfOs0gcht7pkBey8WR2GWic7T9u/ApuCLUTZTeO88UdmTKqKOxxkEA8H7VCt9OvZ9bhjvZ0R2bCvkDH2zir4adeQ2E9nHCVV2BzHKJF285A58/wC9EtLQoJSeyvg1e0iimuX0+YXswDJcStgsDyGZSPTIznsak6BeyaRcXE9pKgt7hVEsEnAVs43KASO3GQazt3d20BurbUEnd05i8BlJjHYKc/rxU7p6602/ka2F1cMVizG0g2+G2OeAeR7Vbi6bRCaUqZa61fXWvxnTm+fDkwmKPHKngA+/9qzEv4fapZxSzapalQRvTEiGTJ7ZUtmtS2msscUpb4yFsxJIFUfOewPHrRQ6vOLbx/i3tJoJSlxbTAFWC5GN2CR2ox+TwVULLg5O2zHX2hag91NcRLst5/m3Y3YQY54qpudIIm2MUAI3B1PH3FbHV+q5LmQzWN5sgZNogRVAiPmAcdj61nJfFluBMZC5IC/OS2fTB/77VtDLN7Zz5McLqIuDSbo2/iFI40UfnXHNMzW3i2+2JTJnIJC/zq3s0Ox1CRu7DlCc7iP0phLu7ilDNIIDE+V8JeB6io5ysp441siWNo2mq6zLKizoGAI+UkdjVrbu1wRC+50ZM4TyAwf+/Sp9j1VcXkE1tNeRtuYPtKL849sYxjHYcUJJpjqTyyCIqyJloU2goxHPuSKFN75otRVLiyvs18RDE+BLFOFGzkqCp7+3Hao0UlotpPJPD4bRrjxo+c52ggj64rXydK2EqKWnnhMvzbZwN6849s/981W3PR9zDaFLOKWeSSNXVYxklc5JI9sDNNZovVg8Ulsr9OV/hbbxkjffMroUHcZwDVz1c0lx1RqhkZiFncNkdwG459u1V2mGa31+0jnj8JUiTaCvDMMH6etTOsgT1dqkhm2J4w7YAOecn9aoSH7lUtCrJjaIuZMBsE8YB+hqj6ie4tI7eeOU+EgVpEQgefn696t1QXKm3SPKMy/M3mu3kj+RrC67fWl3dOgleIwqEUPyjYwMYxweKeONsWaXFEi81231BQIFEZOAYn7HnvkdqZt7eMSmQxMSDlSrZ48xmqyISkqVQqjHAZRzVpYLCWaKS4bJPH7vOD74rWUa6OeMnJ2x6RLdJXadDv44Zxg+2fKptjeo2JRG+3P5Cvb/ACqpOlk3ZBLTZYZPbOa0FrbR2ETCWMktyFjBd1H17CsJ0b407GpJprido5YWSMc7UGF+pNWmlSQGdGK5LbUGRwCDnH8qp7q4kTKFGVc7ufWmrLWGsJ1meLbbqwO5+zj0A9e9ZqDZo58Xs1t9Ms91OVQqgdmUnjGDUa2uEklMh8RSynbwfzE9h/OqO/6lmmklaABYyM8D8xwcfyxTH7SuJo5WtbgnwwO44Xdjt9CDT9BjedFrql1HATbtLcGd5C7MuNq4HAOOwz3pvT5X1q7GnWEUs8shHhxxAHt3JPp79hUTRdOvurbl7G0EhfHLAErkkcsfuf6V2bS9D0b8L9IC+IrX8iEy3DjLfKCWOB2AAPH961WKKWzN5W+iBpfT8XRsZmMgudYdSNzAGO3B54HrWP6p1i600PNHbG5mZPEZ3yxdtwB7exzVxedc6JMGlF+GQnO4IxyT9qOC6iv4jNAxZNzLkjHIODXRjhXZy5cl9Ge0W5uNTtnnlt1i3hQ8RU4cFckEH3o5rNocyQbmjH5oyctGPb/EPerm+vIbBBJOWCk7RgZ5xn+1QTqlvcw+PHHdYABVxHiqnromC5dkJXWRc8Mp/SmzG1ucxgtGfL0p2IR35MlqPBm3YKNwkpwDn/dPP0NBJDkqwZZFOGUjBU+9SJqhAVZFyCTkcio0WmW9reC6tbm6025HK3No5VlPuPSrGGK33PJK0oIHypEPzn3J7VI1DUIrx1jt7YW1tGMRxkAv7lmA+Y5zSe0Xjnwdo0kHV+u2PSSy9Q2Vt1ZafGGBgEAkEXhht3bBbOe4+9c+66u+j76GG96Ya7gnlJFxZTIQsePMH/In7VpLy1kn6DZIJpIW/aZAKHt+5rP6N0daJcabd67rlhBbTz7ZE3tuiHq4xwDxz25pqcor7ma5PTyP/hxozOm2kN8ba0jbw5JzhmIwO/BGa9K9CdEWPRGlxo22S6dfEmkx547Dj+VcY10WWl6zB8Bf6Zbx2cm9J7RmBkAOB64P0wPStv8Ahf1fcatqMqXs7u6q0qtMWIX0G4n5iSTyRxisOVvY0lHS7OtQy+NErhWUMMhWGDj6Ui+sLXVLZrW9t47iF+6OM/f2PvQhmWdQY5I2yM4VgfrShG/jKzyYA7AZGfrzXSn8EMwepdJ3/TkEq6Wv7Y0RiTNpk/zGMeew9x9v0NYW66ZtdRR20JnlXDFtPlAEsPH8Priu8XFsJd7RuY5CMbhWP1/pa01u+WRZGsb1EDCa34IcEgMcY/X3rKdxdx0aQSkqkcMls5dOd96kMDt2twR7EVXXFjHIiPCdtxk7k7Z+vvXU9XtoLy5Sy6phUOWKR6tbjO/HYMBw3171zzqDRZdJ1C5hN2k4t1WQSx8IVbGD/PFdeHPz17nHmwcN+xn2YliHXDDg4pCsykHPI5zUosAxEqbgexU5x9/Oo7xkcjkeVdBgO+KWA2HbkZIPY09E6Id0kvgsw4LA4I9qgk5796HOMUCJcdy8UjPDcNE5PykHC4/tShcTi4VrlpmRuDtP5vcHzqJtAYFhwcZI9KXJLlfDichc55FFhRvNDljlAcXO2cpzE7Ekr6nP9AaLVoLae8jmDXCyKg2mE7efUkeR+lY2wuJZpY4mu2jXOcjGR9K0dnpl1E/j/tJ3hbn5lPf6HHH0qlK9EONFBd3MsF+224uFwSCJDkgn+oq2t5yqicy+DcEDOGO1x58HintR6avdRdZYZLaQDjG0o2PXmmG03V7JALlHbwxsVlAbC/1o2DoXd3sdy5MsPhyqciWI7gP+JfP9KpbvU7i4Ys02VHyZUAHHvVssxgwz27E8ncMjHHv/ANarL+WF/wAsUplA7SIDge5xSY0P/tppYlhuCJDwA6sUZP8Ap7VJ0me0WQiaR5HyeF2jPHn/AJiqFYGlVSIXGf4h2NG9rNAomUnA5BIKn7Ukx0X99NF4niw3DoQONrEHPl50I3nRpEuF3BwNzSD9efL+lUQuwwVZoVZgPlYjkmrayvtNuB4l+0ihACdvPP09KdiofntoRhIbtkRyQctyPoaULLVNMhjkhlmfeRlx5enBNSb9rOVElS6ha2wFVUCngDjI71V28yagss8F1eARYUsc7gPqKAoeV9UuLjZN4k4GWywOFIHcmkvPa3MB+Kgfx0XGQcbvPINRdXS60q4MKSYZ41YFXLbgwDc/YikWlw8UTMwIxgcqcN96QEW5t2tvDkiZ2hkJxkYx6jPrVhYTqltNPBcXEJ7MxbgntQuL1RbSQNArWzsCwHB3Dzz5Gqz9xDMWjE+wAcbhuFAyRcRHd4t1IZUPdo2BP1NJlm8VVWKVNkQyCTtY/anbXxjcv8JcRbjHkrJGAfdcdjTd7Y3cYM7RQ7PMxMMA/TypAOx63cI4EF5PbB++SGUUoX17bqrC5bDk/vllDLn1x5VUMwPDjFORSmIEKAwPkeAf0osdF8moarFE8nxUEttnDzRgKN2M4yMc4FIt9TuFZLiRpJoXk2M3ikZ/5fMijtv/AMUJ7pY1Eq6hHEMcfK0bHGfTIqXeutp0vZT7IXke7kRjk8gRxnv9zwf70uQ+JKE0epTn4G5u4Z2xmBZWQMfPuO9T7i4s0YfEXGpRuDsKljyfXPnWCmv7gzs4lZAeyqcDH2p5Nd1COIwrdzlD6tmq5k8DVPfxSNm2S4llRcboSysVz5rjPFRrjqGKCWJZo7vManY7khj5emfvVLB1Bf20wuElcSgY3cHI+lL1DXL3UVFxLcIMDCqq4P6UchcSTedQrcBEWa7KjJYvhmB9MjBIFJ0/VRFcK2I5Hf8AM0mQCuexqqbULlNpL8eYx3pQ1a5jBThQxzyO1LkVxNd+3TGxSziRCzYVUJAJ+vY/armK7SRZY5o4DJHy3AdQCO/lmsPY391Omz4mBHXAQMDu+ox2qbb6tqD26RG9t7dgSpc5Ysc+Y8qpSI4j13bvLcyXdlLBHPt2GIKoEh9l/vUC5sNSvUdZposgZaIYQAfXjmim1JYpAZJAZEwGkiTGfqDTdx1W/hGO2hgBP5pTCu8/T0pNjSGJ/AtnEcMLzGP5gdgCg+YPGT96rp5JZGLujFicn5TRyapct/4g/wDKP8qZ/aNz/wC0/wDdFSWkJKysf9k//lNIME7do2/SljULnnErD6DFD4y7Y83DgfWkMQLKdu6EU4um3RGfAkP2pBmlJ/2rk/8AFSfGlY43sR7mgB4aZeP+WE4pUel3DNjag5xzIo/vTDEKcH5mq10nTSziR0y/kD/B7n3qW6KSGv2U8EbtcMRsGSsYDkD1ODSY5tOW0kjaS4aRmDKTENowCO27+da2G1SGPC8seSSeSapdV0JCTNbLhu7Rjsfp/lU2x0V/TttHc3NylxHG1v4ROXIG1/IjJqK1vYAkNPebvPEK/wD21H8LnyNAW4HcUkOhIisBn57xhj/Ao/vUY24yG8VACf4gc/0rQdOWFveakYZ4t6fDzsB/vLExH8wKr1gQrhhnNFhRXlBn/bRH9f8AKlR2zSSLHEVkkbsqkkk+wxUy20Oe9vY7a2VpXmbagAySfSt7oPRV9pSFhpl5NcMpEkngSZUei/LxSnkSRUMfIzFv0VqP7OmeNoZppEDfDoT4gAbJ8sHj0rNm2KHLSRZ9N44rs7dK64soFvpOobgwKOIJAQRg5HFZzqbQbLVbqaDUk/ZGsR/mlaJkVz/9cUjuf8Q/nWcMsvdGksSrRzponfu8R+jiiFs/k0f/AJxWisOg7u6EyyXlnDLGc7d28snkwI4wakf+ru77/H2xHrtaqn5GODqTo0w+BnzR5Y42jLG2cfxJ/wCYUQt375Q4/wB8V1fROkNITo7UdK1G7gN5cSb45hBkx4AwMkZwcc1l2/DmUtg6nDj1WIn+9YrzcXuzd/SPJ1xjZBvNGvtVXTTYW73ci6crOsQ3FQrMCcDy4qqi0m6ubW7uYjEUtFVpRvAOGbaMDz5NaXX9BvNM02ymtbhpPgoWjd4wUKjezbuDnHzYql0i8U6RrviL4hWGJg2cHPirzmtoZYzjcWcmbxp4Z8MipkGXSbyO3WeSLZGTgbmAP6U18FMQCq7s8YBzTsuqz6jIElGEBHb2/rW06Q6W1LXiI7O1jjXaWE8vCjHkPWryTUejLHjcuyj0jRJkikW6lZIZdpeFTw5XkZ+masrjTbaZQI4/BYcBk/uPOpesdP6tpF4jzwSoig7xg8D1I/v2qGLj5lGe/vWcZWOUHErns7iOYQlPEYkKrJzk+Q9qkT9O6pHA8sunTLEuNxZRitb0TrWlaBrvx2qQ+PbmNt8W0NvPHGDxRa5rVx1XqUl3Mq21uTmOCIbVUDgHaOAcdyO9Fseq2Zyx/D5tTgFxaX1tEf4wpYNH9Rgj79qWfw11NZk3a1bOgkUlTHJ5HPpVzaq0NxCLQvHKzhFKDzJxV1baqk5a3n221wpK57I/l5/lP8vp2qZyl7DgkyZ1FY2fUfTi2buX1iC6aQXLo3yQk/k28Z8ucGsZ/oBcgDN6mfTwT/nWqk8WEMWikPljYTSHkuGK5hmIPA/dtx71lzkvY0cUzKS9C3qKPh7qKSbPCMfD/mTjP1xV90rrnVGkaqttcv8AtaGOMhrU3is0ajksOT2HrUl/iGPFtOx/xGMke/lUy2fULmMxSaddzAQyQxsIWzEHGDg4yRwODRzb7BRro2l31DPJ0vdahaH4adI1lgSdPmG1/wDD58Vg+ovxD1jWi9hp1xcWliy4eVwFeT1xgDANYp+ndYspPCks9SZkcDc5YZJ8sHnBqVe6ZrOi2qveafNaROeC/Yk0XFdGijJku2sbWBcHDNnOTzk+tN6npNjqkRWdQW/hccMv3qmbVJrXIQtlj6Z5qOvUd3G5d5GJHcHtj6VSk/Yh4/lj9t+F+oXkMlzDqOmxWyP4e+6m8Ik4z6VPh/BPXbgI0eo6IyuMhluwePXtSLPqvUZbeSCF5PhXZS6KPlJ8j9akz9XzzaU2kWtnYCV3/e3SwrvC+S7seXP61cZzZEoQijN690Pc6FK8DXtreTRfNKto2/Yvrzgn3xQqxgtvCbxBI5m7mTd82fWhWysyLazmvrNzE6MFTO2SF2UZ+/Y1atbXx04Xl1cmUK+5EWQLIB6bgO/NL0i/bVbD4W6RIkI/O6glR6k1WdV9MPYS7RdwSmcg/KSB27+leQmmz1mqiWsHUGoOqRQ3Zu7cZ/dTL84B7jPt60qb9jXzF5tP+Gc8kwNsP6dv5VlbK3fT7f8AeHAJ2xsp4IPnxVhLM29IxEzBRjI/hz7+lU0hK6OgdJxsvS/Ui2U8jnbAy+IQcESDA+lYia/m0fV5BJaYDyMuI8ruOTkgmtt0Sxi6a6gh37mSzSZgO4+fPOPYA1mNV1pTPcQ3zJLB4rAAgd8nBz96UoRcVY4tqToVoktqJWuPDNvcxv8AuwG/h8+PX6UxqYRNXlKXktxBcAyMQpUo/ooxVdeyCGWOWyBljVPyMucfXHlVvoWpm8kMVzZFWVcAOfIH3rCEXCV+xtOSlHj7lQ8QtLtLhCPEWVBIrDDADGT/AHqBqqCbVri3cxKjSMwbHCDJOf05q+1CBWl2Sw5QuSzBslAcc59aRfaVB8Q7CQ/vcgtM2MBSRx5HOK3cosw4yMrM0NwjB1RFztQbeSv/AH50505psPxrKs5C5yCP4h6Grqy6Ktr29Au9Ue0gddysF3+GfIlc8/QU5JpdnZnZp13JcSwSjdLPCbbz9CTkEjzojLTpicPuVocMJnuJEfcrOCqbwO/HFQepY5pLKwhPiqLVcZXtl2LffOauLmAztPIzHwxHv+UgFW8h+uBVZdeJ40bNukLH+PO04/xfSlHs0l0MLFDb2WYvmK2x/wBimSzmXaBjyOBwaRbaujyD4iWQq3LSbcuvPbHGewp2e+XRreTWvELyyILfT4yNobb/AOKR7c496hyE6pY/tVUVLhcC+jXgbuwmA9D2b0PPnXZHAmrkcOTyGnUBT3Mb3JkLs8RYEnHJ58xWdOly/tIXbyI23IAVftVpn3NIYnt83862jBR6MJZJS0ydpl+1pDskV5CqsFI7898/rT8OqJBIkixPx5ZzWY1tpoLMOhdCWAG0mqcG+aJJfFmKvwCH70vRhLZazTiqN8uphbiW4MTuZAy5JzhfTnt9qOHWMTRIQYv4DJuIABPmO1YbTrPUNVv4bC2E8tzM4RIwxySa9Hp+FGiR9LHo+BweqbWAX7yuP9qzDlAT3wB9qmWGFUOOab2ZG0sRdQbJ5beaSEApK64IHlhh/lVnbpDbR3D+EBO4+XaQeRnHvWX0jUJ7WQabcRMLqFyq7jhiMYKn6Yq3iSJwJJWWKQYJQ8Z7815OaEotpnrYZxkk0UNxY2Hw91NqFmqzA7omRuc+YI8/p3qo0i3tbez1C5iYSsxAKqPnQZOTg+1bV4bOe2R52Y3SuxCKwCMvlkDmsT1SlxYxzBxH88nJgIxxjGPbv+ta+PNy+xmXkQS+9EzT+oTcWq6fO01vCCuyaGPc0YU/ncDnjPep+oaBb3TywvfxXMM55vy7BHkPbIxkH1zWItNRbxMo/wAMxXaWRTgj3q76oawFnAbLXLm+kmjzLEsG1FPpny/nXS/Fk39hzR8qKj9+ym1LS7vQLiW0lRAWGwsjZViDnINOWbtLHsVl8RQT85ADfSpGka38JbSW9/aJewupVYrpdwQ/4lOQQfoauNN0mOa0jkmtGmiJ8NcPg89sY98GnldKpdkY4qT+0h/ETTQwyXGSiF1VFIBB4zn68Uz4k+5t0YMZ7Dy/nVjNZXMFnC5iJDMTvIB9OM1GvkUoDLM8QKk7VHofOsTZx1Q7DJpLRCRpG0+8Q4SRISUHqMiru0lkjU28LwXkfhrhY5488duCcisRcahKkiLbIQAu8EjDcetQR1TfKzNHIv7z85aNSftxWi8eUl2ZryOHsdSe91LKNLpyrbR9/m3HHnj1OR61XtrGp6XcLC0j2yGLYZdpyoOMrz2wRWS0zrPULOLDRxyp25XBH6VYx/ibqAheCS3guIiCmJF5wf6eVZrx8ie0bfiMbXZaHqOO8liaa0iSaLI+IQA8+pwPvVjq2pWF/q10XhQyjdJkj5WGATg/b0rJN1Lpt88cfw0li3EZaNgU2/7wPfB8609zZGVLzX7eKHUbb5h4FtJmSIN/iA8uM1Tio6kqJUnLadkSLVIbeOd7aKOWeOMnwmk/dsBg/wBPSsfe3Vtf3HjJEsJlO97aUYCZ81b0NOJfWWlXS3aW8wmZ2wrkEgEYBwRin9dNzAxt7gWszSkTLJsw6jn5ciuiEFHaOfLPlogWqb9ojcqr8YI4U+1WllYmIk3FsDx+dR+YVEgjkiKM7iNd2QPX6/arlbrJcoqbABhhk/yrPI2aYoLskwL8Jb5EYe53AeJ/ujtUOXx5YpGyu+TgsSQcmhLdtsBiRtowBz51He4nhxtBO8YY5wqe9ZKLNm0RZY5NMRwzeO3fcxyB6UwIDMPHvA+1clYiflBp+WWOYqheFycbpNvAx9O9KvtSldkgeQSR99wGB71tHRi0iFqMry3hMDD5gJNqLjbxS9FkOMMzBGILsoy2PTnvUjSzG2p78/u/DKEHu3FWp0y3Wx3W4UPgnjzq55ElROPG39x1T8MOoOmrVJ7axtLiOGCPaHZBuaY/xtg+n6Uzr98bzWIlnO1HguFwT3zA4rJfhlE7z30K5+YI3Hnwa20qARK80ClVOMsuSD5nNZ+5p7HGYIki04RuwBLbcDtW86b+XSz/APZ5ef8AmNae3tYDeFxHEIlG7G0fpUu80cXWZlcR5H5QtbxlZz5IUYnXm8a3iUcFZgSfsarob6BdNAUv+QblAPfHpWusLNbvWLK3kj3rLMqFc4zz61ZPFb2WotFBbsN3GcFtpz2Pp2FEpNdijFS6MR09pF1dWEyxxSZaQOMqR/Cvr7g1ro+gtS6pikaH4KxvI0CoRucyH3AGMcefbNXMYOPEcjc3OB2AxxWg6HkJ1ZlBw21sD/lP+VLlbGopIyqfgXrQH7zqG1HqBbUo/gXqRILdRw/a1FdZTUVkXcfysPl2jPbz+lPQyGWLdg8nzGKpRv3HSXscvH4Q3o0Y6YdeQsLkXIlFuP8ABsxiuPde28/R/Utz0/LeJfAwL85iCA7hnBx6V6udf3jcfwj+pry9+PKLH+I1yQgMzW0Gw9weDnP/AH5UOPyTLrSMBcam0xWPwXi8Pg4fK/z7Vs/w21vUrfX7KO3u2it7iXY6xHG/g4z9zWCFv4p2BnCkB22DIBz/AGrVdARyWnWWjqkoaM3cYbcOME4xWc4xrREeVndfwntZZOnI9Sut8s90OZpH3u3Jzz5DJ7VtJiwBKHgfy+9cU/DPr2LRTd2uraiFtLSI/DwIgwWLHIzjvW0tPxI0vqPUhbQX0Nvp9oplvJZcATeSpH5nnvgUozpUb6ZuIp5kHiPCSuM/Icn9Kyes6uqancSwsiArDEzZ7EsckZ/74rS/tRJVAUeHExCxMwxvH9vvWX1RtvUPgDanjKk22QgDOWX0+je+O9GZ6RpiWyq6zK3fSF7YWNtILhEBjL4LH5xyAPbn71xFbq6trDV43ALrBEG3A5z4q/516K12wa70WdLeW4tl2/M+7BJ3A5DDtzWEuelptQW7tdXijvYJIVBvoV8O54YHnyfHfnBOK18e6MPI42cmW9065srWGFbqDUC378y4aBh5FSOVPlzkU31Rbz6D1BfaYMgW0pRdxBJXuCccZwRWk1f8OeodNmiXS0vb7Tyf3TBMZBIJyPsD74odY9J9Qal1DqM40LcnjsxnhGzeCe5yceYre2c3FUYc38x8kH2pL3sx5yv6VoR+G/U7AlNJlbacHleD+tOab+GfUeoXsFs9l8KJpBEJZjhQx7A455+lXbJpCupNEj0f9mPGWxd2Mc7ZOQH5Dj9R/OqkMVwxBxn6ZrffibFCupx6NHA8c1ixVc8qVZI2wP8AmDfY1i7q0ZXWNFbCjGMU1JPQuLqyKmG+Zdq49TzVlDr89vAsaPKSO/zcCrDR5LzXn07QL2OMWcbsEcQKsi/KcDeBuIzjg1C6ltoLeezFpbmJGsYGfCEbnK8t96fKnQuGrHv9Lr6LLRtFuJztYbv5+VTbDqQSrs1KSeQOeHQfN9MZ5ArJxyJE4Z4w4B7HinrnUTMPDSOKNc5AQYP61XIniayaL46JpLDU5d0ZLKrArwPIj1/lUSC5he8ggkjL3DSYVVjyP58k5odJpNFqdhKkiyB7iNX3Nyg3D/vNP3100NzKlm0yGJztJGCuD/DTsXEl3ep/s57hBa3EYdgo3Lhh68YGD9KEsaagiTx6o/Kj9xj/AGg9wcZpzp7UHv8AqXT2vJ7ua5kmx4tzJubGxuOef7VnpGax2XBuwyrKGEZh2sQfTzxSUrdA40rL/S7a0mszFdwxqynYPEhBjHPfnn9DWS1EJaX7+HbxFYyQflIRvcZrSwTWmrKJreKPxAuWJY8ex9DUa4SG8txDeW04OcKxfOPfAPaqEjPma4smWQxRbbhMqCoKkVaaeslja+Ilv8PuwJHST5TjtkHPFT/2Fpe+JZvHkXbhJQ3C/UelSZbGK5DDfbyRhduD8hwPMf8AzUUDZI6hjhm1mIyzpHJLZwPEVHytmJeO39KrGnMUqWhfwVg4lk/Nn+mP0q36gt4UvbJGtJXZdLgKly24/LjGRxmqZL8JdZlsyYQMZdsmknYNUyzlESzJvlVfH7EIpDDHvnH60xqAtEfhYYmwNxYKdwxwf+lRL4ZbZFcLZAndtMfl7jvUhrV5lKQuq4XLBhujf6Z7fSqbEkUl1DHISyXBMhb5RIi7R7HGcUu006SWdWlhi8NuArjw930P96Vc6HdNHvMUALsSqpKO30qtu7ueIgW4LiFdrY9u447iobopKyXqmniyuhHIrwqx48RQw/UcUzLpU4aSRVRkA+XYcD68+VVD6y8spkaFdx5Izx/OnjrsRTb+zoQ4/wDEVyD/ACqeSK4s0Vlpvh9PXc0kKySC6iQKXONpV+cA4J470d9beD0fZkJsb9ozAjnP+yj9ahdL6hcXQ1svlpZbZTEq88gnt7/51VSdT3cumJp0kMTRxzNPubJbcyhSP/drO9mlUg9xzhhz9KB+T5j2NNWF2tzMYpisRb8pxx9KtZoLUKCtw8jgYKtx+laIhkaG1e4QNb73Pmu2kGNVIEpaM52kgfl+1OSMbFCreLGxOQA9EEW/Ys0uHwDljnfimFBOg3EJL4uAPmYYBppism3cSdvA88U/bQiSRoDOqoe2Vo3iiiOHcTswHIyNh9KQgtNuY7S73SjMZPJ27iKt7nWrFYpVjsY2hOCrMo358+earY9J8RSWkEQzjLDPJ7CqvUJZra4eCeJ0cYyN2QR6j1FHNdBxvZcW2n2GsxN8PfyW94sc0z27wZTCKWG1wecgeYFUewqRk9+2TTuna0dMnknSESF4ZISCccOpXP2zUm9urX/R7S0RkkuoxJ4pB5UFjgY9POp5bL4kIx8d8/SgFwvNMi6wMbT+tJE5ZsHIH1p2Kh8lQKSXGMUMgEZ5BowFznGPrRYUJUHOTx9aPcV4BFBsFvaknApWMcjlaGQTcFh6jI/Stc1zHpdnBJgbZCN7tnjPOc1lrGya8kO4lYl/M39h71s4NLd7ZXmUNG6bFiJyAmccj14+tRKVFJDR13TfK6T+dQtT6hto7VjaTLJNkbVKk+dRrzoq9S4b4cD4dopJVeTyCKWKk+uBx61nAPPmknaGdg0W4/Dt7aWbqiNIL15cqIvF2shA5wM48x9qnW19+EMmp/DGJfBYBY5WEwG8tj5s8AY5zXE2d2/MzHHqc0ase1Q8d+5XP9D0H0vp3S131Brtm2g2lvFpWQk8UzsZELbCTzjBB8qlaN070rqHUOp6ZJ0/pwSzUujozljiTbzk+nNc2/D/APExtA0+40LU0WSxmiZIZ1QeJAx5AJ7smfLy716DiuFuIhPbrb4mUN4kKr84POdwHIrOS4mqpnP+uLbReiYtOv8ASdDtBcNKyhl3qy/L3BBzWPu/xD1m/mMhknghMbL4UbPtHp3aun9fQwv0hqTzrEZI4t0TyFRsPmRu88ehBrzdJqUssoiSclM+QxV437k5F7I28XUmtanCvi3tyqqTtUSMuf59qi3RluWaS8kaVe3JJY/7uT3H1qpsdVaSIoSGbO38+DU47wTHkjwssMnJYnzqnk2SsdomWUT27/E4CyEcjyA/w1eJMs0Ssi/X2rL2N1POrq+S7nC+5pzR9Tuo5ZVkdijtsYYOCP8AMVyeRjWWOuz1Pp3ly8XJT/K+/wDyaMuFPyjg9xRF2BGQcUzJPCGEZnjzgHv5HzoNdoWz4+/Ax2Jx7V5Ppy+D638Rie+S/kkMFlGxx8rLgg8gisRe9Ly6ZBrgtE3209ujR4/gImTKmtesqOAf3hPqI2/ypUyg2komS5SJl+fMLgAfXFdGCWTG+nR5/wBQx+P5OOuS5LraMZ07pmjabbNe6kjXV0BxbSIRHnBx2PzfqPvWzT8SbtXhEIWG3hjCLCkQVOeMgZx58Vipn3zzKHzGmArr/F6cVCinmndzHG+IxhuO9ei6m7Plv+Xo7/0DeQdWaWbrUozcJbOVzIMYJwQoA8vP7VRdazdO9I6lbRR9P6fdwzr4jlocOo7ebYz5j6c+tc30XqvXtItkt9Purm3hUmQxoQBuIwT9cUqPX7/UpJri/wDEudhwFZwzAnvjPf6CnGDJnJVZa61NBPfWzQR2MEcltHITartRyc8kE8H2qFrunajFGk0Bu2wyr+5UkMCM+X2qIvU9mQAItg9Sq1uNI/EW06W6d1y2t7+W31WUK9oqxZ+fw/lPbHc1rfExrk9lNpDo1/bDklZUzknPDCpurWqpqF0pXIWZx7gbjUSK/t4OmdM1q8ObqXD3DqMuWLHyFNar1lo93d3MkUkhWR2Zf3Z8zSbbdhFUd8dbWPQcQloEtokICyOoA2g4+UjilWkELaFcSl52w0h3+LISNpI4y2fL71zy2/GDpNNLFjczalKGiRZClsOSAMjk1adJdf8ATXUeqyaVYz31sk0RVIbgrGsjFsnaBxk5PFQb6L2W508aVeRSGeRnEmJcv8pVc4GWznnPfmqnoXqS3uLe9klidrOJY1a5cMqplAeQzHHJ71cdQQQ6ZpbxWxl8KZsyRFA2c8AjA47d6r+jtMsZbi8tbZFWMxwvOkkbLtPOB374x9sVl/dSLSVbOY9S9Rz33UM6Q2k80iyYLZLDC8jH0GTVRqlhqtwEEtu6kHauZAf1ye1W+tahcWfVuoWFu6LBEZQqAZC/uzjBPPnWeluJwlykkzs4XnLEY55qDREiz6G6g1abwbW1hD43/vZVX5R59+3NK1b8Ldc0u2lvNUu9NsYlRvD33i5k9gBVfBqd3aWs80F6YmQgAK5XAby/lUZ7K91QmfULmScKpYZJatoP3Zlkv2IdpLjSTpsbSF2kL+KvKgEAYx68dwarryPUbS3eLYjW5GC8a/8AZBrRpbi2KptwT5UdrdQXkjJC4LpgMB5Z7V0LW0cjv3MiutakhBEkbqPJkoV0Z/wxlvV+IuLaa3XYZHkjiKnaBk9/lJ/ShR6qK9OQmfQ30zUr7ajTwQlljeCQlJPmwM44zg81Jt7YSWUtpd2xnaT5lSQfkXzOfJqjMmo6XfFpriO4mV3A8H/Zoc4wPb61by3WIHLho7yVhywwrHHOD27GvEcmmezCKaKyGzgZU3RMsauAFznHfv8AoKWVWWYPECqqMMw457VKlsPg4iFhG/d+YYPlkj+ZzTNrAbtvAMR2Ro0z7R3P8P2ziq5N7KpI0fRDR/szqhbfxC76aWJbkEj0qk1nSI77VpG8JVZ5flDLkcfcD+VaT8PbN5dN6ilhWa4zp0qygD8hKkgD9DWXNxANVZJrhraRWWSTPzKSQDlSaqTkoJmMa9RoKbSGiMkSRzW9wpDK5XCsp4AyPL61I0iwFvFM6PMwcFpo5n3Y9Cue3PeoXUeo3TzpcWryW/hrsEjMDlD2HpnPnTNlr2ourx+EZriNQheJQHIbuPQ1jCMpK7NXKKfRfXlss8I+HtlCKS/iJ22k9mx75/lUfVLBZJVMoiAUP/Djedx7fanCtzLYweD49usmGlKISzoM547jkmpl9bXAWG8tJVhZzwhcEspzzg+dTNUqGtmehtwYW2/MQx4OP1/pTdxHPPEsUrOGz65A9B/X9aeuLmazMqXNqkc2780Zxn6r2x7ihNdmEQylX8RnEbqMd+3cenrTw43Ely9mQr+NoFeV7shScD5SAo9Mef8AnTSXctz4yXF1ssIBvu5V4LL5IM/xNUrUrk73tYx4zNKVhjPff6k+g75rJa3fLc7NFsnLW8LFpJB3nm82+npXpeLj5fdJHD5OSvtQq4u5eodSN5KmyJQEhiAwI0HYAVb2Ur6fMs0SrkcFSMq6ngqR5giqe5tLzT5dyPCloTkM0qqcY7d85qXBewXW1I7hX5Aba/I5Fd/ZwD2p2EdqY7i13Gxnz4ZPJjbzjb3Hl6jFRAoO04PfnAqRYy3lqZY9RWOTT5vllCSqXU5+V1AP5h3+nFWlporW8ht7oxHecxSA/LMPLHpkcj34rOcuKsuEOTojavpKT2NtKu1Qz5V2GV3ZGAQP+80i10G2uAGjgaFRG29D8ybiDuI/QH2zV3b6d8TZPYGIkncyAgZRgTgjPcZH86dthc21rHLIsnhTF3nDnHhyBQMj/dPeuB5H7M74wXujd/gt0DbabAnVl9BEJtgjswwwCfOTnzra9SaNcXUEGs6e4j1rT2M0Dbv9oo5KN6g09ofhXPSWlxJNGJJLeKSNGOT27gVB6Oa7k1O/t9QaZirq8KzBh8mzB258s+ldSWkmc7ezDfib0wut6NZ/iFokDW3jKGu41GPDdTgt9jWI0jUTf29087BrpmQYPr6jjgHPlV1+Ld3daV1Xe2FldTW9lLDFvtonKxnKjOVHHJGa5/BcPbTCaJsMPQnkelLLi5x/UMWb05fodK063s7q6hlMyAqp3CRgFQ/TzNVfXH7Gi0hm00q0sV0EugFGw5B7D6jyrMz3c15bm4aXw44PmVA+SfrVVb38uo7o55DbyOdyOv8AE3v9a8+ONxdnfLIpKiFNHpAn3bJlVjg7HGB9q1mk6TLJaSjS7+CJWj5jkcLkfQ8E0fTtvoFxOJddjE5RMbWX5XP1HOac1PRLLwkuLe3nt4A+6OVFaREQ5+VwOx962eZrpmaxKnyRWH8PdYsJ0nmgeRGO/IYMGB+lbbwbMNp0draxIsdvbSSvEdj7t2Hb68DvWasb67sdQiaK9jurB1C4aUEo2Oc9iOex9q2FzqWm2lnp0dxGPAlsDM6xkAvJvcBvc4XGfeolOUu9lRhGOo6KTX9NSDo+z2u5l+OuYXBHI2sQOccdqy2maWt46o6KwUfMTnjOM/oK6dqqafPZW8M1yZLc6nNMIgBlQ6K/JH/EKotS0+zBeHTrfbKHwdzcONuTz5YFRLLT4otYrVsw2pW8S2pQRMXU4zjvzjOfpj9TWUuLS3EzRoGYg92b+VdK1h7XQ7cGS1ge4ukEdukgyB6tjz+tY19RgsJnSbT4TKfmLbP6e1d3jt1Zw+QldFTYqbdgWCyRH8yqeQKuo+mszwyysfAkfnPBKlcg/Wm5ep0kIIs0VuwKKFA/TFCTqK5gcxyqjOBydmf71vTZgnSqiCNEvXaZVj25PysTjIqy0ez1TSphLHfmEjyiJ5qM3U8xPMan6J/1oh1JKG5hBB9v+tW0mqZK5J2i314T69dRXeoS+LLCgRGVFUkA5G7A5PvU14Yb2GMzqJNo+UnuKzTdQzMPlgA+9dZ6N0jpu56csb3UNP1ea5kRhIgmREHoy5HINZyljxrekbY8GXNJ8VbMLNpcEpBDyLhdoGcjFOLaKo2kI3GOR3rszdDaMkKSnpa7CMgkDSanAnykZyc1G1Hpfp7SzFHedJ3cZkBdCuqLyO3dVrOeTElcjbH42dvjHv8AyOPy2blT4YA89objNQ723uJIlhazKqvJMI/Mffmuw/s3pZBkdLSn/i1R/wCy1ff6FdOQ29nLPpOlW3xoTwFm1Kcli2No4Tvk1GOeGf5HZebx/JxJPIqs813kMlmgxHKpc5OQeBSYUlu7iO3iikmkIyqopZjn2HNegtU0XR9Lv5bKTpbTmePGT8ZOQcgH1HrTNi2iabrGmS/6MaXbNNcrALiKaffFkHkHd7fzpficV8L2W/A8hQ9Rx1+6ONWnT2pphzp14q98mB/P7VPs1aFUjkV1+VgPlPGa9I69mxspZ5VYp8iYXLcZYc+eO3PlXDhE1tcGYrhkc9zkAA85rOc97DHFdoLpPVL3SEaK2tLaMqwLvLASTgHAzkfpUnUOt9XsYAskNkY5FZgfhskD3596urSHTbrTdZEpnOoxTQsrKcIFZScH34qDr0VsbmbwzGEgspcbvUbc0KXsJxM4PxH1NWkZZLdPIgW6jvUl/wARdW04xvd3cyJcRCVCltGylckefbkViLthIki+AGBZTlcjOKs+oPDuNO0aGZZULWWFGOceI1bKJi3ejo/TfU02r67pMt2saeHcogKoF3cjngD1FXOtPMfGvbNlOG3DOd2A3zA+vFYDpZv9bsgBIcXUYHh/mz8vIrdrFKkjxTIH8bPA4XJ79/PtxUzfsEY1sXHeb4ZJEZiIz3I/Mcc4++R9qv8Aou/Ca1boCvizkoD/AIRsfP8AastDLHJYw2kW0M4x4efmJXv9BkHNXvQRjt+qLKJYDLuDuNykkNsPIJ+p7Uk9jaRdQ/iFBbXRsoNNcpb3KWbqJMbXOcE8c9s1t7i/8HS5b/wh+7hMuwnA4XOK5avTOrQ6xeyrp12TPrEdzuCEr4Y4JzXTtTR30SWJY2Z2gKhB3J29q2xuW7JklaKTR+rW1e6UNaxRxuiMjxzbwysGOeQPSuTfijczaZ+IRvoo4pFks4xskiWRXXJ7g+nFaroiw1TTo0ttWspIpLYEB84+UbtrY9BuwftWQ/F2UzdSxyQvulFpGzKuPXvXPkyNo2xwSZR6Rpes9STarfW95bQPYwRxPD4aoJ0Z/wAgA9Mnj04qz0j8M+oun9b0rVr+xZ7VLuItJDIGWMbxywHYU50NulZ7iQAs95GikjsoUHj25r0XpjxC0aKRHwyYJCEg5966ceFSgnZyzyNTao8X6x09LZarewPcwy4YsERtxk+bsMDuPf0rS/hzaRT9QwLcR3Be3w8aLGTjnseRgd6uNU0y9lOoNo9tFbJbSsbi4UBpOZCF2g9ue+OeatPw66W1J9cJuZpWjtV8ZlwwRzjgk9s+xrkcm3RtwS2jYa51toGly3lpNDKjQPskVAr7jjzG7n71S6Xq1peapBPJxAIYtkcid8s5XzyBjHGfKovUX4JSa91NqOqwapbQw3kviLH4LZj9c471I6csLrTL+GwupPFVMCMxZZlWLxE4zz3588VeRPReJmwSe5upY7R7KWK3lJVLiM4Xt2GR/Wm9Y0G50+AzQtBcKCoCyIY27jPzLwcZz2qyt75bUxTPNIkQY/n4LHHv/lTOt9RD4Zr2CB7k28Lt4Y3Ddhk7cc4BquMHuTJblVIgyRyvMyw+FJJsibEabWxtP5jjk8d6xydNa0kXVkc+mY/atwJrbEiENgqeeePy+dM6X1HqfVEV7daHJHYSQTRxyNKviYXY+cA+farbVusms72a2/Y73DpKqLiX8/yg8AfrW8ckEqs5pYpt3Q5o/Td7ZW87sIg1zO85i3qDHu8iScE+4zSbkXUFrFdzra2slvOkpSW5QlQCecqee+eKnpr8fwQlksLeK4EgQxi4LCEH+IknDfQY+tZHr7p3qHW7iJLa1sjAEMcjAkDaT3DE7h7jke5raWRRjowWOTezCjqH9pdSzTyom6aQ5XxCyqAPzbj9KTeWstxNuVm27hz5H6U7b/hZ1TBKDBYQ7A3EjSrwM99pPf61qIui9cijES6czeGRjc6kHjkn6nHnXJHLxlZ2+m5RplB09Klt1FpYYoDNcqiFv4jmh1vaS2WpWdtL+7lhsYEdSexAPmKvYfwx12W/0m8+HiWO2uFllPiLlQGB4HrVh+Iv4e6nr3UbX1lcW8ts0UY/eOFYkdwBWsMlSUpdGMoacV2cyeeWE+E8SyAcDcM/zo0VJC6+BGNo5+Ud61E/4aa4rKTPaJk5G6U/L9eKdtPwv1dy8q6npzvn5gC2QfQ8Vv8AiMfyY+hP4KHSbZob+zmYRZ8ZG+Ucj5hVZrEklvrN0GjGwyv2+tdAsfwv1WObxhe2bhP3gWMElsHtWE6jNymsXUOxVKTNxjyJNLHk5S0VPHxjstuhpIbrqnTHZ/3onVQG7sCCP71UXCWqCSNrnmIldjDzH9Kk9FrPF1dojuo2/Fp2HvU/WejbmNdQ1eSQS2brLLG0X/hybuFbPcYzyK1X5jFr7TLw3MsMx8HcrY5K8Ut9VuxF8O0rmMZO01HS3upfmVhnt2qSNPmEal9rd92RT5CSsSurTMiws2N3JK8E0FvpI8BWL4BC+ZGcf5VCeGQXOVYbdpBxTsMCoVfxZMjnAUYFT6i6NV482uSjo2v4jXhs7/SfDYR50yEHPA4Zx/asrDclJA+fmBPzg8j6Voesr1NVt+ntQmhUtLZuGAHClZpB/wB/Ws45eUflDY5AAwf5VCzKOma/g5TXKOxF4DdXDyyz7h6seT9qUdSmMIjSVjj8qFu3+Yqtvot6pIpfchwVZcEUnxIN3hyMwfgZAyDUzytPRlHEq+4uJbqa6CWsYXxDy7Jn5fYVLbSrlIIFtiEcPuk57r6VEl1NIZzNZWRihKqoWR8nIUAnPoTk496tJL6RooWhKEvgMG7e+DVKXLsTjx6KPqDp4ws11armMn5lH8PvWdxXTB81lfz/ACt8PamcLjgYdV+b2wx7VlNU0NZIYbu225nG7aucZ9s0rCikt55bdiYpXjJGCUYj+lIYMWLEls85Pc1br0vqpx/qMuT2B4p+Po/Wn4Fg/wBN6/50ckh0ygK1JguTwrk7s4Bq6HRGtntYn/7on+dEehtdPAsHP/MKFNCcWQryZi6mXucD7U1CYmbBZ1OSBjsak3uh6jZZF5F4bAfleUZx9KghAO+B960TsmiYWFuwbOXA4Oadt2e+R4shGJ+eU/wr/wBajQW5u5hFHgse3t71cxWngWsuz5ViUsCRyzAdzUykFFlYWhKo7qQijEanuPc+9J1jRotUg2NhZEyY5PNT6H2qo03VLq5tLp3nbfGF2kjGKtNRuJFsI3jkZWLLkqecY5rnadmhibq0msrh7e4jMcid1NNhfTtW1j0odQaFDJLJi7UMEkPHY/lJ9P6VnTo2oiRk/Z8+5eCME1pHImDi/YrdjUfhtVoNE1T/APN8wP8AwGl/6N61/wDm67wfSFv8qrlH5J4P4K6A7Th+3rTuwE9+Knr0nrkw40y+Pp+7YUm46d1Ozt2lubYwxqDzKdv2+vtTU4/I3B/BAYKDwc/WpGn6e+oSMEB2INzvjhR/nUaJomwgyzHgDGKttKsrrxFC5VdwbaDnNOUklZMYtukXemx2+n24uJbf5IvyR+fPmfU1fwzxy2FncRgqsqu2GUc/OeOKqL20vbm3aNdqqwxtIyQag6zc6xpWiaOsIX5ROH/d7h/tMj6cGsFNSZs8bSNJpWpwXfUK6c8TKTHMpYLlTmFuO9YrU9GNl+9igEsB4+XJKH0Pt6GrDojWPi+r7OW5jZJG3j5MFT+7YfWtf+Gtxp+t9V6en7m5V9yPGwBJG0+RpvTbQkrSTOZC2J5+Ec/VWpRtT5WL/o1evH6b0ccjTLHH/wCrr/lSF0HS1YY06y//AMdP8qn1H8GnpL5PI4tG7Cwfn61vfw6651Xpm7jsruC+n0ghlMSqX8DJHzgd8D0r0DHpNgD8lhaf8sKf5VnfxDu/9H+nReWZezZZ0UvbKFYg5448s4pObfsCgo7sifiQ7N+HGuSZLJJboVyhXPzg15st7K4B+IWwcojAEkGuvD8TZ+qHtenbe3ma4vW8IyyH5TjnJUZ9Kxms6vb2c1xDLYGWa2Zo2LKuNwyCcH3oTaVA6ezOG3mUqXgSPH6iri0naQfMWYLyxIqTqehvY2elXzhTFqEAnChMEf8AeaTalVQL8wicZGRjHf8AyqJs1xr4JFrKPiYccgOp4OOMjzp2YgSOVXALEd85596j28ai5hz5ODx9RUm4cPdSRqvzRSMpz/Ec+lQuy5bR3P8AC2Tx+krdpY0co7xZJAwgPC/bJrXGJAMiEfQNXPPw4WW/6JngUclpkCrxklR51D/CXpfqDp67lbWrK4hR7UpmSUON28EDufKutS6VHK1+p00AEkeEo/5qzPWfU79OwOJIrNoZIXO1pMuuB+bb5jyOMkVWfixo2pazpFj+z8xpBdCSaQSGPZHtILZB5x3xXJ+qHv7LQNN0jqCztLyONc2eowzl/l35AYqSPv3qckq0EV7mDe9ml1Se8lR1MjEqgPC05G0Uau4bAlXaSCSE59PPioU154ksqW0TGJSeWfJPPrT9pNIu4tlUxt+bgCsTW/Zk8m2KN/rNvLGh2iS3zub2wQKttH06MojzBdq/7OIMDt9z6n3qvsbKHAuONm3EYP8AWrSK4Ju1XfamLwlKiEAENjnNbxVUc8pW7I+u6DFdB7i2ZFn7spIAf/rVR1FuTVSGBD+DBww5B8Nama0J5dXtGhVyispYr2HPOa3+maHBrvUdtGrwx3E1skaStEsgzsGFKsrDuO+OKJIcWcl8R9pUSMFPdd3FIyE7k4r0sn4PyA83ennHYGxgPl/9i9ayvWf4SzaVcW2p2kM15cGRNwtIUEaoOGOwJjufMfrSba7RXFPpnGEnXAGR9c05HMUkEkUhV1OQynBBru+i9E3F7qSWslnq9lA8ZAvJUgCZA4JVUyM+h7Vp4/wpVWUjWrwYwSA2B7jgDvSjclaQ9LtnMum/xZ/aGmDR+oUS4nDxCK5dcq4DrxJ5AgZw3b1redKLc6fqF5qC6eYojAkhSM8sq4ywHmRzx6ds8Va/+qlWHz69qGcBc7z69+/2qt1DUP8AQ60uLcprN3bRpJGbq4dWADDAVWPOOOx7Vnki47aNYPloyN5DpvWevy/sy4hS5aZgly6EGSNkK7CB6Me5Hasr1foNz09cj42W2bxyVfwiSIXR2UgkjjJGR7Gj6C1eJOqYnjzHD4rEiQjgDPf9K3totv1VqGrxRtmwn1EvPcyAMGzGMqq/08vOsqrs0Uvg5Ba2sV18Ys6F1EBk4IG8qwwR9jUuyubfTIBLczloSc7W7AGtjqnTlt0v1ZcWGi2tnHafBzMFuI2dizW5Y7vb5Tj3rlUFv409u0inwpWLJEWyPl5PHlmrjFNGcptO6NzZLFrcy3IdEtk52hvnfzznyFQmsxp107xR/ufEH7wDvzkAmqDUOqnyiQWMdmuAc28hw4+/H1qS/wCIhksHs5NOVgygZ8TsQe/bvVwjNfsZzlCX7nojSuqNH6s0+TT7W7uFEMA8YupXaCCuRmhXnfTPxAbTbHVbVLFx+0LY2+9J9pTnOex49uPrQrRx30Spr3Zr9ctpLa+u4NDOmiFZiqyz3iW6sMnGFYgn61PfS9VsLSwkkuLKV74KXS3mScLhsHlSRniujfi5o1r+JGjQadpt/pHioDPDJJfopMnbGPNSD9jWT6a/CfqXRtOtoHtoLiVSXd4rlGXdxjHPpmuTL46jDStnXhzuU/udIyH7SksbhCymdiW2hs+GWyeSvtjt71YTdXTz9MSQT2sMSQyb0uLZQjPu8iBjI/8Am7VrLH8KuoluVWSNLKF8K0kjq6J3ySQSfQfek9Tfh7ew6UmmQ6bNc3Ej7UkitigbYd2RycjbkVkoyS2jblFvTIP4UdTSLNqFnbPbyQ3VtKZd4yybI2P881Sag1hPcPDKcuYYioIAfBQH5T2Jp/8ADzRpNL6tvoZ4HtrgafPFPEy42ZRuD78Cs9qwX4mBtiSqba1Ax+bJjA705wTVNkwk+TfuSpi0Mq27LFIigrsdOQgHOardPtTc3RS3aeySTJUhvlLDyzjt9aHUF1stniRCdgwA35l+h8wazkXVs0Dpgp+7G0Bu3/fvWK8adNwKyZoJ/cb+11mbSre8s4I3adtoImxuiGOTz3+1WVle/GWS2wtIXCsZViJ2SoP15+1YK26gtJ41m1N0Hy7DsOXC+RH09qrrzqu3icpZwmfb+WSX5Sh9Rg1MfHnJ1Q35MUrb0brU2l5hk3zRxsW3FQJIwfI571S6x1Np1olvAZTMY2DN4eCR57TWOutd1XU42t7q8lZXPyrv4J9D68VUZA+vbvXdi8NJfccuTzL/ACl5e9Uzyz3ctvGIzONgkb86J6D3PmaoUmkilWVW+ZDkUoEds/zpD7e4xXdGKiqRxNuTtml/dajbLIV8SN/I+R86rp9HeJ/Fs5GRl7Kf86V0zLJJctZqrP4oLKFGcMBz/KtGmj3srlRbuPqO1S5JAlZT6TqEs9wbS8jCSAZDYxn7VutJtr2VG04shEIE1u5PCnvt+hH6GoFp0vdwzws1urOHDAkZ4/yq6isbiCMhlYCIlM5xuA/+euXJ5Cv9Dqx+PremOj4y9/8AqKVZU5R2QnHIJzgdwRg+3NPjT72C31EPaTSSfJ4UezIl+fGc/TGfpW//AAt6gstP02HS7yO73eM4Esyb0O4AgZGcY/oa2y28ceuiFYo5bcoZVO0EISDkZ8hkZx71n6Se0a837nI7PqXqexfT7VdPBFtF4Qle1G8Y7ANjnvVzZdZ9UBL+W4lnluoo1NrE0GdwL4bjGcds+mRXRblh4pRbVHmb8kYUcE559sDn71ndRg1K16z0Y3dzamCZJkSO3QhoxheHPnk47VTjJe4rTOO9V2fUHVeoHUrvT743RGx/3IVdo/LgD71Tjo7XWXK6Tdv9Ex/WvU6pHBIERVGV3FiOfSniDlSPP2rojyo55RTZ5K07T9RS/ks1tY/EDrHLBK6Kyknj8xFP3qxWmLk2kBnIysUkIGT6r5Z47VP6n0qGbrq6urk3KtHqIKPt3BgJMAc84GMVTXfTaXUM0tvdOZmkd1VnIA5PHauPJKMpXdHXihJRrsn6fqdrp96sjWUUzjPjwEtCSD5ZUkYz5ECtXYrbXSOb66k0kSoW8WwdiAP8LDGCPpXP4INV022a4aztGkZfCZxINxHuM+1OaX1LbQYjlMtmF3K0qsDt/wCXzH3rKUZXcdouMl09G0h6A0fWJnex1OOVGwU8G7XxFOPNTg4P0prqLpbZpmlLFIZ3t7Z49jqdshErn2IPPGRULS7nQusNORpXxNAzKTHEQwH+Lg59KmahqVxp2mafbWbvc2qyPEsrjllDZ4P5hzxUOT6SpmiS7bslXUOpTaJpsUywKd3yQbdpRhEFOTnJ4X+QrR/htokeo3mo2l/a283iwhxmRhjHBAx6g/yrMx6mJrWK2PhePbXfir4ku92Rlb5QcenmfWqjpT8cItA1tppdDmZQjxMq3ABz+ntXd48YyX3rZx+Q5Rdxejs0n4TaDqN6gl0i1dvNmmkJwPTnis5+KvRXRXROgtqt509Fc3EjeBbqtxIMtg9+ewqJZf8ApMactzvHT1z+U97lf8qxX4wfizF+I9tptta2Mlklqzu4eVX3E4AIx966WoJaMYNuWzlUiqxxjAzkD0pOASSc/WplramedUwuWIAy3enZbH4abbID4UgyGwcp9az5I3UL2Q4LcShyB28z2oNbHw1YD8vc9qtWsmisRbGNlkmcngcjHAH3qGIpbu5g0+EEsSI+3dv+napUrKcEhdlpNxqEtvaWsRluLlwsar3bNd7TpSDS+jtMuxdSl1i8KRSuAZV7gdj6+XlVN+Gd/wBOdMWOoOZorjV/F+Egi8FmZm2fKqsOMbic/rWr17pf9haRYRPfTTvEBuhY/KjsgyR9O3/Ma5vISlilKX+R1+FklHyIwh79/sabXIvF6eQo24/s9PlIBB/d1U9bK/haMVCE/DNkdvMfX1qDa9Za5bwR28d8RGi7FBjQ8AYHl6VkesertUu9d0W1u5mnSVnZiVA4A/LgYrGfkw8iKwxW2dmPwp+Hkfk5Gmlf77LJnbkGJx9MGtd1FDNfaV0qbWCaZoJLR5PDjLFFWRck47cZ/Ssg1ta3kXzWiNkecNdb6R060i6b06SOyiVzDgsLcZ7nzrfwvDeJt32cf1Pz4+TFRUaowfWc8Ca/dzPNEkZEZ3swA/ItY7VOptFj+FdbxJprW4SdUjywyue5HlzWT/GKNj+IGtbnfCTBVTsFG0cAeQrEpaGTKiRwT25rH8HH1XNv3NpfUp+isKjqqO56n+My6ha3ED2i7ZlwGVPPy7t71gYtfuchRFExwVwQSCD3yKxMQKHbluDjvWg0ZPDYu8YfC+Yz3rbJxjtnHiTlpF3b9SXNu158if64savnPy7AQMc8cUuHXJmma4li8XnaQy5Xmp2h26S3EMRiU7iAeB5nitZplsj3XgCFNysR+UeVcM/KUX0d0fEbXZlrTXLc7TLpiEqjRhUYjOcfNjHtV1p56S126ifqXTrjZFb+DEVVyIzuyPykZ7mtr0/bwzTYkVEj3AN8uKt7HTY5Lx0mRQMnaD584pf1CnSiZvw0t2Z3TtO6HtbW7ls3hd41DW7sXVoSAO4PPeqO8uIY7aKaSRn+XcpGOPTHrWh1kRRxX7BOEik+XsOFauMzvIZWilE7RIF27ZMBRgdhW+LyPVd0Y5MPCJtk1TUL2JPhrW1V3yxYxhsBQoJIzznv9zXSOlNOVLfRdQ2lry5d1klwERQFbChc9q4gNaFm1kY7QRJBIpZ9xLBDw5PrkHOPat7oHXU8txZ6DdwwILCbcJ4yx8QE4PH0IIrohKuzCUb6O3LEysS0hb28h9KTOodCoOG7jnzrnmp3t9caddypdvHAtvlZYhtbdnBz38ufKnhewx2v7ueUSrgCOcEscdzzjvXT66+DH02WFxfrBdojSB5W8VTnBKDAOCPMGuL9VwS6x1PsQ75lgEabuPEXJK98chSBz3xWvtdR16PqSS2mlsW8XaYgoUsYjwSQDk+Q9RWL6uhnn6iuPhiT8YVVMAgsQAOMj2HPvXM9mydFr+HvTfUWs6L8Xp9i0iMd8cqMGEco8sbsgeRHlXaNIn17TYIIL6aA3LxKZhHjMfHnzmuGdDftLSy0FrqN3ao2EEUUhCoSwGM55NdB64Dz9WQBdR+HNlqVs8gG754VjVTGxHfLc4rbHNRiZTi5Ss01haWK2stt4MQWR2DpuyQS2SPXnv8AepEGl2VjbFLa2SMMc8E5J9zXJ9VX4GWdBNKDJqsoLkncoVRtA9qpdV1JrjVrrZeTrEyoCm8hTtPP0yfT0rnl5KTqjohgcl2d3NpCgAVEPIO5n/IfUHuPtXK9L/aV/wDiFqQhmQeFAxjLttUI7kltw/KOT+tRbG9hboyZWkYGewnTeBllJBwce2BUTo+R4tJe/uF3XV5bJEyYH8JXBJ8vyt+oonmTVoUcbTo6UlvDZNbItwkt0CVXLAogK8kDPA9zk1JUwRXtoj30UKLDIHIPIJK+ZJxz9KwllETcbxgsylCNvAXntRiz1J53ZLWNxPCLchZV7Z3A9wfWsF5Kvo29Bv3Lj8QEsOlI5Lq1sV/1kxtKiHwxIctzx5kVWX2sWEmo3kRSGBy6puc5LHYOfrg4zUWS0upYZ9L1BLmNwFmgR38TIzg7RnkA9/qKzPUkyS63cJp7Frm4IJfPEKlQCfqcfat8M1kl9phmXprZE1+7fUDdWOmuFtoyzzSoMbiOcVrvw26pfUbIaXrAMTB/ChlkPB9Fb0B9aprGwg061EQ5OOfMmnIitzEzeD4fPAIwa9B49HnRyO7OlPYRrI5MTqwO1sHv7EU4LeMxEK7bu5OeTVT0n1D+0FTS711W8jGIZT/46/4T/venrV3N+bcoI29wPKsHjSOlZGyGF8DBEjL6leD9ao7u0vmv3Mly0ls+WLMvO89l48vPNaGWIk4AOc4FRgSqtFMy4J4OMCs5wTVMuM2nY3p0sYg8O5wZU4O8fnA8xUhrSwcll2hhzlR2FQ2jEcnybQAMZ/w/Sn7cs4GJMkZB4xzTSS0Jtkq1ijszhdqq/II7VkuuuibXXh+0bRVW8RSGHAV/r/n5frWrckghjkEUIUfC5QYxjvnirWuiZK+zlOk9AavpesaTfXsQgiS4jcDeMn5h6nn7ZrQWluerLHVdC0a3mn8NJFM5UrFHJ6Ficc88AfWpev8AQVvedQWGspJNB8NIrkJ82/B+UYJ4GeM1VdfdVvYvDomlwPp9im5/CtX2fMCSS2O5yM1qstGTxe5zbUFu9B1J9PubOZbyM7SkgKAfr3+1V099qEszRn5SBu2KOAK6NY9Yf6Q6cra1Y/tZYhtiunUePEfQ+TD+dUfV40WPSnnso547y5kVAQ+EUY5wBz5djUylL4KjS2mZ2WC8JkaJ12qgk49KieLe8n4iHPbG4VXo98DgSXAK5HBPHqKWp1BhgSXRB92pxxr3Kfkz9mzZyWN7rGj9NxW7tJJ4d0GWEFmcLKTwB37/AGrH3E7mZgd0EynGS2SPvRRjU0dTGb0MuSpXcCCe+PSk/A6g3Pwt23v4bH+1Pg77F6y41x38km807UrZYLm/t8RXKkxSbtwcD78Hmq9LRpGJ3qoU+Z5p9NJ1JzhbG9OfSF/8qdGgau3I0vUGHqLd8f0o4L5IlNv2Jt3aWYeLxb1WRVUFV4ZjgcY7AZ862OkdH3V70pda1KkcdrZMY1IfJY5A4GOwz3zzWDXpjXJeF0bU2B9Ld/8AKt7oq6ppXQ99YvHNYTySqbs3TskrxhCVVYz2XIyW+1T+Wti/NeiHodst7+2LaRiFaxZfl4JG9D/apWmWUFpdadajawWeNU39ydwpjpp0t4Ly4MhYTWkqBz5nacVHjuvGlt7hWU+HOhK+hzwfpTnNbCEG6PQiix8OW5e0iO2U7U2/MRwP6mrKKztnB22gVgcEKRxWI1S4jsNN1HVLj94YZXhiYHuwHzY9gfT0rR9G67+2knU+AWRI5SUdm4cbl5KjPHnWcHbpm0lRaiyjB/8Apd8f8tD4ZQf9i/6LS9WuW07Tri8WRUECGQ5GRgAk58/0qo6V6n/0juLpFmikWCOKQeHGy5DruB+b2rRxinxIt1Zwv8d4iOt8lkRWto8LIcevasXoHT2oa/qcdpp1t8fJ+Zo4QWwvqeOK7p13+GZ6567Fxc3fw1hbW0SSBMGSRjk4HkBjzNbDSukendI0d9JtLeCCzkGJFEu1nPqzA5J980pZ1BcV2JYXJ2+jzNd2tnp9xJb3cC288bbXSRWVkPoR3FOQajYRqULxuDwAQ2O9d06k6JhuIv37W+uWiLhFluFS+tx/uTHhwP8AC9cs6j6QEGlX9/oN2t/DaoXlTZ4dza4/9pGfL/eGR9KUcyl2E8DW47Ro/wAJB0/NNqst6mnhIoUYPdINifMRn5hjzFZjqS20y21yazsr+0vljkB8S3xtORngA488VfdAWQutC123mVG36au4Ou4E+Ih7VkIrKK26g1GJI0VY3UAKMAcCk3VsFFSqL7L2CCIW5AUAY7AcV2/RI4m6f06RyBm1j7f8IrisIBixXbNCiL9K6YQM/wCqp2GfKubs6EqRFvNWgsmdBGrsqk88eWc0uC9kuY3UKviDPI7dga51pOka3F1jFDqGoTX1pc20qDaHEaNu4BJPeuj6do675RuPhyOTs74AOB/SocWtFKSZDhvbm8lntmYiNADuUYPPb+YNZDWejD1xFqdrPJsudOk8OGQE7ASMtvBHPPp2HbNS+rNMv7bqG4ltBeMpkgJaLIXbkZ4HHmc/eqz8VdRh0/SINQJmWK6upSkkPdslsHuOMCjGmpFSdxOPxacbXWJ9OvIYo3t+5iPEgzjIbzB9a0W+OxhTwIARkD5e9QpirWqzXb4TACPt+cZ5/wDnFStMkYW6u/OThWxXdJ8oWcSXGeixs7j4m/CeCxVwTv8AIe1aS10U66bKwhWHxZJpEXxOF/Kp71Q6SxEcsp7O5KgjGPWr7RdYfSbu0vli8U290W2Zxn5FrCjZvZNH4cJ0tJBqV7p8M1yl7HCJI5duxWHDD5ctnLA5qv8Aw/6c6d1vXIkh0mXT2RWdZYbtt4I44IAI+xrfS69/pb0trNzcW6QtZFJITGxPzJ84JoaH0XYdKajbXdrd3UhZihEoXGGBPkPah3a2Vr4F9Xda/wChdxZ2S2QvFkhBEktwVbjjBODuPGe9WmmdQG8j1KS7hjtksHCs4kyCu3dk5AxQ1vpXTepJ1fUVuJPDGxFSVkUe+Ae/J5rl34i6jctfyaHp9vc2WmTFZriSUnddlflGB5Lxj3xmtEm2ZydbIfUH4iX+v6xJJYXM1npUZIQRyGN5fItkfTispq+vdUWTKW17U5rWQ5ilM7Yb2PPDD0/tTGvWqJHCkO5FRGwoq6McMtoI54zNbSopljBAbOOGX0YeR+x4rbgkY+o2ZBdV1FbsXiXs6XKtvWYNhw3rnvmoOs6rqEqySSXEkkkjZdz5+pNbv/1X6xIiz2llHc2soDQzfGKpdT2ypGQfUeRpub8K9fmUxtou5SOwvU/ypJr3HT9jF9MWPUHV2sWmk2F1dSSN8qkuSsKeZ9gK7hrfQulHp2DS9NvoXazXwn1FH3PDck8ifBPyMeAf4TjyNQvwY0mbpDqG7tb3TjF8XBhXSRZSjKedxH5Rzj61vemY10afXJNSTMF7cu0ceCxdDnOQeD3+lNtPoIquzzXqK6ppN9NZXbT29zCxR0bgqan6NrMcqpZ37Isi5ENy3v8AwufMehPbPp26Jr34M9R6zcPdTatb3UyRBLZGQgtGCdilj5gYGTVD/wCorrFuPhrQfW4H+VDV+wJtdG//AA/6nTQumQt0hgBuGwrp83pj68GtzF1BHcWJunikgwSFWRhlvcY9a5ZpGg9R9EW0D9SwwXdtETHZRpcAnxSMhGBHzDAOPSi6u/EjX7TSWvYtIt7dLeTG4/My+WOf8qweScXxRuoRkrZo/wAQ/wAQItL6fvEtLgQalGAwjfs6ntjdjPfkDmuB3nUl7q5NygFleEEO1qvhJMD33AcGonUPXmt9VxR22oXQeJWDBMDG4cbu3oarLRJpJkjbPB4IrRJ1cuzJtXS6Lm08GGFGFuhMpGQucLR6youZZIYUlhAC8KMgmrHSYWWCaM4UoMB+Cee/6cUmS4jsVEUyyyzkBiImGAfTJH/ea5292jppcaK63uLm1SGzKrsC8sTg1YwTjcCrCo98BLfvLNts1kX5FMhbYNvGSardKMkd0yu5YAHHHGc1145WlZxTjTpGugfcQTg5rc9MO0fVegliG3xwEYHby/tWAtM8Vs+k7rx+qNB75iMcf6Mf86qyaO++Iqv87AefJrkn4nPcXnxcC6dfXiRsDL+zLvah7FXKYbaSDg8DOO57VqPxN1C1h6fJN3AssdwrbPHCNxnI79/avOup6rMXa4js7kR3cTxpNMrIcbs4DA4cD3HnUZ5PpGuOrPSPQ2rQQ6baaTNbzWl6IwxglkMjnjk9yQo4ALEZ8hWsWRBgF1Uk4AOa8/fhr1nd6HpcGn2dlkTuWkmLp+fyDMf9mmO5OT6V1WLT+n9TaDqHUbpLq5gKFLm3kYxhl/w47gEnvRiyuqHOG7NgxYHjFYfr/R7u70W5Onq01xIwwnYD7edbVJEmXfG5ZT2J7VnestSg0rQjqErKYo3TcW4ABbHP61pmSlHZOJtS0cS6Q/DPqSC5mvr+xWBYfnTxHwXJONoHnw3c1YaH0t1yLuY3QFgjAz7WwqyMqgbBg+YGCa1b/iNo2oxC1gmtmmm2rHtkJ3MSOO3tUaD8V9MS2kjlg2lScCPJKEjny9f61xucJdnRGEl0QptF1/qANFeaXDYOplQ3LyqfkZNqoMckAn9K5t1naXnR4uNIlhtvHuArKVKSFU8trDlex9K6NqX4mM9tFHbWmWwjNJ27HJGPr51z/rjV7PqDUIr6Owhs5BEd/huWMjZ/MSfPFEZRvRUoy9zFwWMs8DwsAWU7o+fPzH3pT6M8YDNgBhkDtirO2iheUsrHKjOQOxGO9dFutF0n4mBmtLLEtrBL8/y8tGCTj3NVPPw2PF4vqukclOmp4AflW25NCusfsfS2DsbOwKkgbTyc98j2oVl+OXwbv6XL5NTL1d+IkDWlzLDpOowgstxaT2ieJGeSOVXOD61t9A66inHi6hpi2VvImV22mQhHcHack9/IVD+EgtbsXb2u2W4UIs4POPQj1z6VGt1+L1GEQXOFikVp4wMMVzg5HpUR8/l0ZPxOL2W/WnUml3OgtawQR3LSyweGrQlI3JkQ4LZ4z61ZjqfQp9SsGS6tEMZkt5FxIpifH5SO3cYyOe3kaz/4jeBbdLXsRj8WJfAYxg7cqJU4yO1Z78RGk0+fSr7ToyiSHfcIM7T8oCsfcDIrql5DW2YRw3pEpLmB/wARdR2vEY5fGwVOQ42cc+nNc9vkhW7tkjjADRwKvHpnj+VbGE3kPUek3bpC8Fy6RrLIu0g7TkHHH0qpv+nbmSSG4s4po7eN/ClUkOMAt9/P0rgnlS2dsMezEa8UTxVfYH+Zdvrg8VgWh+JZsIO+d3YCuq9XdGalNIbyzIuBHEziNB84PbseT38vSsXofRPUOq3MkNrpN1czBfEdVX8gzgd67fFzRcezj8vHLnooY9LVl5YyHuAvCj7/AOVaeHpfTzamQxrlYzIQTjngYyfrT2t9HdRdNQRy6rpc9tFMSsbPj5iBkqMHvirrTdkttEAADt5LDOQQPWtpvRhBNMobWwspbpYm06L92ASZRkN3+np3p6/t9LisJ7+DTNPuArIp8MHhmzkjk+laOfdMVUy7vDx3UYGB24x60ek6dCbm5gFvGI3RZGKHGwjOGA9ckcfWog7LnHdmQvXhsbOzmi0SznNypba8fzDHlgYpdiLO/RDJa2VtK67hCsQzjt5/StfqlhLLC1qLkQXUZBDbWfDYHOcd/fiqqw0WWKQI0O9guPFCnk4JJyRmrM6b6L38NdIsW6uRZbW2cXMZik3xD8pKg48gfeu6NpvT1rdQWfwFgss24Rx+EMtgZNcW/DhJYusbEzRNGpcDLD/eFeg3eABZAY92MB/Y+nrS4plQbRlNMtlvNXvbcWNnEluqbC0QycqT83/YrLdXXt9pGpSW1v4cIgCOUSNeAc88gk1sbOJtPvLzVIrlZkvhGREy48IoMHHPINYvrdZ7zqMyWkLyMsCKpPKk5PBPn3/nXJnilG/c68TfI0vQskt5ocq306v4sszmTAV2IwBwAOKkarqN1p+oWAiEUcbRPtlk43YUHbgY75/pULomaGLp+SORSl5DOzPDLwELDjBPA5prWIH1nUbWP41YBj9yNhYxuTnIIyP4SOfUVSf2a7E19zL/AKRvZdYs2v5/3NxOT4ig5CEcfJ9gM5qr69uWsda0dlJCrHKzMZMADdHnn/vyrSaBpaaDa/BPJFI25nzGhRcFvQ1kvxKUyT2UcdsJ3eKaNY24RvyHaxyMduOa3nrHvsyjuRW/tjWG1OVU1u3hRrq6hRDKSdqxbkAIU5IPJHkK0HS895c6tOl3rC3qrbQMsaFsqxTLMcgDk8iqDTentSlMVzBpGnmF7mSfxZDggPDtzy/5t2VPtWn6f0vU7PVC93aWcUDQRIrwBd7FVwwOD29M0sfVhPujzh+I2panZda6zBbaldxxC6fCJJgLk54qp0DpvqTrTUBBp7Xt1IdqvK0h2RgcDc3kAK6vffhda9Q9d6tquu6ra6fpZun2RmZVlnwcHAJ4GfOumaXc9KdP2SWOm3WnWtun8EUi8+5I7mr+2jOpN9nMm/CbTenNG26zHq2qvMuJ9QtX3CyI7bYzyw9SawnUX4f3eh6W13pdpaa9pTEn42As0kYx2dAcr3r0j/pPog//AJnb/bJ/tWd1a06dDzaxpGsfse6T/azQwuYJM+Uibcc+vvWbpOzRWeX7GAFCI5zAGbdsXI59j/bzrb2uvGLTun4lUXLzC4i3FMt+bPbPfzrUdR6N0tqt7Db6sttoWqXKCeG7txmzu1JID4xlMkHy+tU6dPvYz2+lyDxnsHuXM8ZDKpVA6hGByAQfpzWeTi9svGmuiRbSSLLqTRwWN1FbSQlllhJDsBgqT3/SrTpP8LundS6ztr91uomnZrkQo6+HExXdgBgeAfI5rGW895LfvYWEjHxrZzNKHIxKy5zntjO0Cut/h6GXX9KD/m8Bt3OefDrp8aJz55exr4fw202SWRo9Q2qAPle3tuDn1EdYTWLfWtH/ABHh0Cw060u9HBQz376aj7FKlmBcKFHb0rstnFZRXcjtFslZRhkTluexIHNc06vttVj676j1WC+VLG20t1itPigh8cptVjGSMcn8x862yRSRMOzlul9bdUax1DaWSaHpS29zdLEGOkxZVGfGdxXjg5pz8UtUkl1eXRpdPtbW1W6ZbaZLNInICgZYhRkHJ5+hq+6Gg1t+pNKGoXW+3iUzTB71H/LEDyoY8bsc+VZTqjU5bm0nurm4a6k8d4kkkfxNmWGFB5+Uc48q5cr4nVhfJlCsV46W88aGWe2tlUAfwyMSN3vgZp3SumdStre4u1h2XUreDA7kDwV/jlP2yBV705ahrwLcQrNCgkkZQeWcn5U4+masdSnNrbmCTZ3zKy8DA7KPYf1rCL0bz7oa/B/SBrPXUUUcLrZaQvHiDkueCx9zya2Or6yOpbzU7xXD26zGKEDsFVsf2pjo7Z0f+H/UnU7ARy3BkWA+ZJyq/wCdVmkRJBpU0cSsq+KHCN3AYq396y+oaxqKOr6OrzSk/wD7ZfQ9GapLaR3aW0QidBIrNOo+UjOe9c7/ABZ0HUtPl0WTbCPHMixOkwZSQFPcH0I/Wu/21zeDpO0No9kqCxGRMrE52+xHFcR/F1lmvOjg/wD+TYdSCBnanlV4fDhBxmuyPK+p5cnPFJKjAWia1LYXt2kqiKxiEsoMjA4LBeBnk5IrrfRGr3c/SWml2Q/uz3BP8R9TWA01oZumeozH8oNmSSD5rMnlWv8Aw/IHSdj8+4Yc/T5zxWHnZZRTSfTX/Y6PpWOM5JzV2v8AcwPXEstz1LqkkhUuZecDA7Cs+UmVo2BIGM/yq/6xkjHUeohjj95n+QqnmuYxFCqbmIBz8prfFJ8Ezh8iKWSSXyyJAreHv75f9K3Om2ZGlqyhd7EAnPlWT03a0TqyPtzkfLWgtpmgEZhilc4wQ3asvJt6Rr4tLZp9Aj2COcg7UI3YHoeK2/S8aR63PuJOM4z9DzWV6bu4YdOaKaORSnzYCZx8wxWi0qeQaibuK3nlUkFzjHHPP868bK227PWj+U1egRxXF08sY3q5DED+E1oRaD42RkTLxfMAO35hWX6X1ZEF1bRwushyQRgHzq70/Wm8UvNFIJZEERKjI3A980Y1HkuRz5b3RRarAbddSllXKfDySEfY1yebUtBlAtriFfFRQzl1Kk5UYAYGus6rfTXC6oj2z7BA6ZHrtJriGs6dFrkXwttCttep4SbmO34kHHn2yAO1eh4tL/U5M90/8i0boxry1Z7e8KKyE7ZPnHPoR/lVjpXSc0Opm5M5MQAjGzO5eBzz9D3rMW8V9oyPHE1y9xHlVijPynHmPI1O07qO6u7e7MmoXFlcpEJEg8TbvfHow5Ndbp9HLtM3rWl5YafcospbxpFLiQnO3jtjsf5VM1a11eTUbl4L6C3hRzGIhCW3A9znPf3rlmmdZaxf3tpE+p3DhmQSpMeH+fnBHGNv9KV1v1X1BbdSaktpqN5ErXrxpGhyRljhcfUcfWtVBMzc/c690Z0y769Jqj3ZV4oAgRYzjGcDHp51b6t0O+t3y6suqPH4LMqf6oG2Hg8+o4H1zXnzSfxG6mtrCTUY9TvP9XmQOhYguuexI7DiuxdNaxd3+otLNrJsI5YGa2kmeRo1LBcA4P1wfatkq1Rlyt3Zd6L0G1peRXs91KzzSozQmELGW3g7sZ47cfWm9Y6Tgv8A8TY5ZJb26R7R7os8e2ONhL8qjHcjPnnip+labe6HfW+q6l1FbapaQbi4gnd3fvtO0k+v8qx8kutSsxe6tvCZt0fhO/AJ45z6VTi1FLj7gpK3s3Op9Aaff3bXUlxcq3xDzDYyrgsAPMeQFFadFaToluYoroqSdxed0OfrxWL6p1G4hurmyB/Jc3NxK4TeFgDrnv8AxcnH0qnnnVx+zmmeSSZZNr7Eyc9lH9a55zSe4m0E2tSOqPYaRsMc95pskbIUZCyqGXHPY1FFh0zaxQRWjaX+64RROHx6jnOa5pYWyw28213URRq3JAkCgH5cY/nUO98W3Rbi2uZYXZdwbfkEjHoeO5qXmvXFFLH+p0G81bRrC6mivYY4iDuH7hWGw8jBFI0rWtAuLCzFwlrLMyZJFtw7Dv8A/MK5/wBSyX84jnMc06tZLFIXf5gST+Xnt7jNYvTp9T0iNrUxCWe3Cys3jFlSM8g8HIYZIOO1TGUn1Q5RitOzefiHrCNr9pcaRcxNHDbmCKODIyWIJ3HzAwKz0U0WhbTdiWee4+ZpFIAJJ9zR9OFtSMt7J4TpvxGyg9gPL2pXUhEd1akRNLgHKL37969GMaVo86Um5Uyfpmr2+pvPHDG0bQEK4Yg8+nH0qTd3HwltJOVZxGNxUdzVP06Ea91DajR/NzkEEnJ596tNTX/6HXIyf9mapO0ZtUynXrGxlkt/CDrJLJsiIkGd4xn9K6z051INbhkt7squpQrk/wD19R/GB6+v6155WyuIZdPJtGxHeytuUHABCkH710hRKtxb3ME7xTQlWWRe4qZI0g9nTJcEhUOWHPemdu786hh5jNaiPpZpnxNcxSMoXkQkZP8A5qkf6HW/G5gSPRBUelJmvNGMDICUMbc8E44FRTObeXY4YDyOOAa3p6QtTxyP+GNf86H+iNjjDGYj08NaPQkP1EYkXqPkfNgcU4LxMfKDjtwPKtqOldNByRLj3iX/AO1pY6c0xRgGUD/gUf8AyafoSF6iMP8AFpIwVjt9c9x/0rIdb9KPqKpf2TbjGhV41XO4c/Nn15P1+tdpGgaWBgNJ+q/5VjvxGuhoWmsmm+I+5dsiK4yFI/MQB2zxSlicVbBTUtI47pGntpts0AAdWOcbcEDHpTGp6TDdRy/uhkA4IGecVL/bV3DamS0klhUkh179sefvmpkc0uVe5Ztjeci7S1LtBWzYfhbctr3TLC/lknuba4aMyO53FMAqP6j7VtP2XaY/2PP/ABN/nXNvwavETVtc0tH34bxU/wCVsf0YV1lUyKhKzSzP63Ctlb2z20ZVmuY0cqSflOc1yOXqn8Q50uFtZpd4f5M2QACgkYyVrvojIqMX1FtRESWsXwQXLTmY7y3oEA7e5NJ496GpGT6J+N1GxjbWojJc/CQs+9NoEm5w2P0FWp6cB16LUhMBbRwNEbPadhY/x5z3rQtHSfDIzmn6aQnKyD8FbKrMLaHgZ/KK83dSrdv1HrUDpcC1W+di5dvCUBiBkegzxXpyRAsbDPcHtXmTraCY9a6t4cYcC7kOXJ2gZ9POs8mqGlaD0/esPwsM0cu+KRdyjCvlT2+ueBVPaSmB5oGHyjIYnuOfTvUm3vJIL2JkYDY4kSVF4DA+n1FCZpbjU3u7lEzOxLbQADlsnA9eaE9FNdUd40F47zT1F5FmzhVQimPhiQeM/wAR57+/NanR9K0/TE8WxtY7csixNszkqgwo+w4rntj+IfT1nbQ2tnZXywx4fZwTkcBSxPbt5VZ2v4qCWIj9kDIPy4uQBj34q4TjHsmUGzeXEcd5A8E0fiRSDayt2YeYI9KZ07RtP0pnexsbe1LqquY127gowoP0HArDS/iVqDHEOm2Sf8Uzsf5YqN/6yNXHAjsFB44Rj/Vq09aFkenI2TabZ3Ou3rS20UrqsJUsuSp2sOM1G120MM4S2Ywr8FcyfIB+ZdhXuPc1g4+v9RUs8GoQKrRqDJ4QySo7Zbzzmg3VutanJGTfh5NjRrtVRgNgMDge1cOWUXbZ14ouLRs+kon1jpW4F9tuJpTLGXdRkjbx5e9cg68uFsbzRtPDLHJDpUKyDOCd244Pr3q+h6k1nTS9nBc3McaSbWSJ/wCIjjy+lVxmW7mM92u+bhd7jc2R5HPoKnHJRSTNPIXqTlKOk2MdPam1hHeOLhYo5rTY3Aw2CvH8qgMtq97LOkUTPI+S+SMjyzVrOfh87kBQAH5V4+bNPJEZVTll3ENuVc5X2HnV+r8mXpe6GLq0y8ptkCSR5LRBhtfA7rk8HHl+npXVOnuptLsOm9IjnvbaOYRRxyRs/wAyd85A9K5ddE2m5pZ1Fu3ygqATGxPy7vQHn9KIrPZ2pu5g/gGMjcWAbdkZ57cfp7002ukLivdnROpOrdLhKy6depNKZY3HhqxXG4bs8emTU7/T3pu3TbDdyyMoIGyBuf1ArkywSFVuNwI/KRIB8p8+M1DlRUnJh8SIswLKmdvHqtLkwpHV9Q/EHSHj8RbS/kFxCyHG1eASP8XBzWZ6l1np3qLSrKwuenJ5rSzAWFHuwm3AIH5Tnz86y8/U9lZ6ZYW2qtDHdhGmkfloyPFcbQBySR+lU2m9aaGl94t2l6sGGyiRq4z5EAkVShkfSJc8a7Zca1f6JY2aleiYp7eMZ5vJXxj1AYVSL+JGgJF4cfRen7fRpZSP5tS06u0xZZFjnuJCX/dsYtpK+6+tSv8A1e3HUtlJfQ6fNbuxJSVk8PcP+A8t9ua1i3HWRGTSlvGyIPxWtYV22/R+ixjuMhz/AFam3/GG4VHEfT+jwbgRuSIgrkY4OfSs/J0rdRrslhKzK+xlJwy++084qUfw41qVQIVilLSbBiQDyznnyrXliXZHHKS7P8UtVtdPu9Otbe0htb0bZQUD54x5+1PN+MvUbRpCslsBH+XEKg9sd8ZrLat0zq+gZ+PtXi2sRnGV49xxVcpUqd4w3litIxhLoylKcdM6Zo34t9aa3efBxXaRMVLmVY92wDzI9Kb1rSOouobpb/VOpJpZAoTKoEwo8sDFc1DmNiUZlJGCVOCRShLNj/bS4/4zVqCXRDm32dChsF0+VQHllPYtLIXJ/WpA1DfKIRGAc7c7u1c4t4nuX2m48MDuzyEAVJL2dr8sDSXUoP55Dhc+w86pkr9T1/0hmLpfTVCoCIeyLtHc1Jg6gtXkVQWyzhANp77mXHb1VhXjo6xqagJ8fdxqOyLKygfQZpJ1W+bIa+uz9Zm/zqKZpzR3G86mvNP6unnsEhxJJJFmccEFu/t2rY9IXN11DBdHUzE62u3wvA4DKwz3/SvK2+WeQKrSPI5wMMSSa6d0Z+DnVGpIl1qV/c6FZOAdrO3jyL/uxg8fU4qcjjFcpOkPHyekrO/6Vq+nayhnsLjckJ2sxB8sHGCBT8Gu2N48Kwvnxl3IcEAjaGzz7EVm+n+kNH6YtDDplvIJWXa93NIWnf6N/D9ql3NhLyXAugVZN+RHKFK48vlbjHcA+9cK+q4uVf6nZ+CnVmb/APSAlntOiobq1YpNBfQujDyIzzXnyfrrqm5hkgk1GSSGQHehjUgj9K9J/iNFP1D0pHY6VCZr5Jo2a2mQeJsUEMwU8MR7E1xDUOjI7lXM80lrd2p5iWAjfz3Yfwn6V0yz47vtGKwTa1o500NxcPuaKQknnCYq0sYwyhAkjy4+XKnj60/cTWwvmUW5L7tp2YAOO5wex9q0fwNqus3zJD4DLcPFsAyMEkYI8gRTnkVXREINMhaTCsa3Jki8JTErZLZGScdqqNU1a7tAYLZ2G4k+Io7/APfpWzutDgS2uXazMMcSsRtkzub+FRz/AEBqqsbXS9cQN+90+45EYVywmHp/xe1YwlFuzeSlVIx8FzFgPO7vMe+8k1c2EsEjKWYAKM9vOp2r9MX2lrHc3EHxFmxAEyqSFz2DZ7E/SoukpYzTMqMiH8vhscH7e9bucXG4nPHG1L7i4tL2ARZLN3wPlPen5eorfTZYTBcSW90MEOoOQc9wfLim59MvTab4lWWGNuSjA47Dy+oqjWzC6nYSXO3wjOomDc7Ru5yPSohPtm2SPSRadQdbyzWk9jJNHd20jsWik3DxATnIOODmqoa0r2MOl3B1KGzX97DbSTB0jcg/MoK9j7Yq0/EvTIXvLZ9JthIm1i4to8gDI2khfas7bWrJC4uYT4qhdm/0PbvV81OKkZcHGVFpo1z8PbfDz2KStMQVE85jhPoWHGfua9G9Lait905beDNZzxRoiP8ACIpSNgMlfzYryyCQQrMp2jsPm3feun/hV1jcbrm31XV47fToowscBdVAbOeFAyeM1mk07K5ro7NqvWtno6xRzR3B8Ug7kQYHlzz24rMdaa9Za50jdaW8N2DKikYCnd+8z6+386zOtdbSX8lxbaVZGeJlUI8oI8Jud2PUE4IziqJeqdRtQEuLyCR0x+6jhDEe2ewpOWXd6RoljtVtlPe6PaaB1ZpEQ0u4td5t5RM7krvwN4/82ai2+kzLpi3eHhLyEPlSMfMe/rUzqLqLUuooraC5ISO1LtDsHzrubccn61K089U9TBrS0s2vARh3EQ492bsP1FZSm2qRrHDTtlbb37rBDFlfEQnDoARk+ZB/nQiJa8Mm6KY43EkY2t9POtVb9C2Fh8+v6oZZ/wD8l01Q7D2Mh+UfbNVPXFvYWculvptkbKKSFiU8QuXKuRlifPFJSTdLs0liko8pLRQPa3A1Br62QGyc7HCgDkjHY8961en3z3ul2rXgbfFGsTKpBYoowDzzWcjviyeLEwWQtwq9s+fl604LyG0igLyM7Ab3OdpXk5x60TXJUxYpcHcTU2c+myO6SG5MaMTvBXLDy4P3oVmkdmha4cujqhwCvAbOBu54/wClCuf0kdX4qZ3e21uz1GJt8hZLhQVB7jz+2DS0tba/WS7t7wGfP507EjgZHf61yTTNeuYdRkivriNBcjb48asoGBwfMZyKsLbqW4mu/HC20irlJTHclW2DueVA71xPxpofrRNr1zcTjo+98UnJ8JSr+X71e1Srq/tb9I7ecwtIkIVEDYG3sSeO4xXPNd6iuLnQrqNorgRy7Nu6UMg/eKfv9q0l11RpkssG5N06q0ImcbTkYJHHHn51tJy9OmTFLnouEsZb2cxQzYVVBiaI5KY4z7Y/oavtPsjHpk1tPLEZguVlIHc+orIdO6hFNqG/TpJoivEgADDPPI9RWvuZVvbhpRKEOArLGRwcdzmsjVkSSKeKREuII5Ldl2FAwKg+Tds1SLp9rb3AupLi6ikikyuyTDR9sEY8jntiruVL0WrNcuHSNiUyuNwHv5GqiG8luUkUxrFLKyjw5TkZ5Od30HBpJ0FDXUOjW2qNY3d7qEk1sgYL453KrEnkqCMn3qjvOjbHTbOWWQSLGjKglgYlfm9ucD3zWtXSpLNFQh5UbEu9nBZcnH5T5VTsl/BJewh4ooQpdlBADkZx34GRnitoeRNaszlhg9szh0FFiS7kd0V848TIDYOM7uxPtVfeabGAJob5kQZDMZcFsd61tiXggEbgH4b5wDlvL8uMY9alWtvYyz/H3VjGYYSfEGzK+5IxkHOKtZ5J7FLDFqqJlpqmjtZ6ebi7tmnEEYw4+fGwY57ntS5tYs1keW2uIZFizuBTJB9OBnz9KfGrLbWo+CmkSJc+FFI5ZAM/wnvj2NSrrVr+UQw2MmnBiGJyjHbx54Ycfauj8VBnP6EkVg6ktyAjK8DD5ixhYj7EDj71obe/tWgjlhSeZmUfP4EhHPvj+lRdAk6xutStUvb/AKea03q06DxBIy5PCAkDsRjvV1LpvW8uSNa0KCPJ2KLCRiFzxzv54rsx/crRyzXF0yguCbp2mjgvrh8ZZVtnIBHrx396amvWso1FxYXwJGPDW2ZeD55NaMdPdZSbd3VGkFc5YR6YAWH13U1qmg60tzLJH1G0NuTuSJLCN9g+p7juamWGS2NZF0Ukcct1KbV7SeCeViqNLFtYoV7jPl7fWmr20vItUhgdEikVX/eKxVXxjB9cgg1KudA1lLYT2/Uct+LaXxA0dvGNo4yowP0HHpUDqCcr1LpAtNS8eSc3HhSuoEaB1HynH5eSBz6D3rJwa7NOSfRprTqZFKWM9xEbvDgXDHCSjA8vJhkcdvT0qLrIiPVulFZjIVhmZ23ZV2+XAHvn0oaT05ZTSQKk53wxeKUZF37lbAz7ZB58+Ki3TWydQWTkMxt7OZghAJVi2AT9hWr5NfcQkr0avQ0SG3khlkGUlcnJxuJOf71IN1HJdyKjqzKAowfy+pqltbdHkmNxJIzSKk5KnCoORx/5aeNoioiWplYFt8jAbiQ307VvFukjKS3ZB6Usr646i1aO/wBEtLvSZLqRre/IUujDG5WHcgntWwl0zSLWN5XsrKJEG5naNQFHqTWV6D6kMuq6roE0KxG3uZWhYZBcZGQc/Wuefjx+I9xoHU9po0sEV7p3hrcPbzAmN2PADhSCQOTjnk+dbRSjHaMW27o67aa30tc4NreaRKGbYDEUbJ+1ZLVYY30jrBIdvhtcl1CdiMIcj9K886b1FYwancdQ6j0vZXem3sskKxQSGNImAVsJjsceoHehp+sO9hNHpV5rvxk8oa3topfEieHuUYHJ3DywOcVlk+5UEJ0aX8Vkuous7NFimFrY2NvA8gU4Hyljz5cmmNOt5rhbLwVdbZJp2N4FD7A0QJz7eRqnbrC+1bTLq2urt5ppGXcbn85x5Z9R710vpC10+ToPU7a2nE01zEjL8pG2TYd6/bPfzrly42pJvo68WRNNe5ymxljuNchRLw2ltG6tG8xO2XbjvzwTyBXaehbqGPqGxlRZ3gEcih1iZhwmPIVxjVeiI9GigdL+d7vb4hV4dqKQQeDnB7Gp2i6xeaZrVhqqySTm2dZHjt5hsIUg/lzwSOO1dGKaS+05skW5bPSkf4jaYHkXSRFqhHEqqxQxYPHcfX9KpdQ0/SOqF1y91C8eyutX8KBrZI98iRoQcA8ZyaZ/D28sNUu9e6oniih0+7YSKAOEJYjbj15HtzV1oXUVr1Fq2o6a9o1jawRnbLu2SEgkE+2O/t3q+TlVjS49FDpf4cdOdMePJFrzKt1aSQCaW3CiJCB64PIGK5m2gWF1O9tsaSAyboiPlyQO5A4x/lRa9HqcHUeqLHrsraaobwZ7pcyMAQDx3IzkVqbLRNPtkuLYarfXGowbJHVYUS3YMuVTJO4Bj3+1Y5Jck9G8I8WjPwWtpZzySRxmKcGRbYI+SScbpCD+g+lVs9pJdXa29sE8COQRcnczntn2Gf51n5uvBZ614txciWBJMlAN3AGdv9s+1aj8Kb8dZ9dRiIXCQRASyK6KATnjt7n+VZxg5SSrRUsiUW29m96+sYLLpfSemWVTH4fjzhiRz5Z/Q1Z6BP0akVppUunFtQW1jllie1kO5SMKxJ4IPrWD/EDqvQdZ6rvo5dZ1CJ4X8JYrdo0ACjHBbOaldN9V2ul3TamI9QvfBtUtS9zOjMyg/LyqjkV0uNu2rOeORwVRezudpY2lnbpDBEscaKAqKpwvtjNZrrK+0LRrrTn1Lp5dQkvZRDDILdHZZPQ7uwx5+1c3m/E++HywLfsvrNetn/3cVX3fXl9fy2zXFusnw0wni8SeRtrD2Jx/KtOT6oltValbO3afo2ky2qTJotrbLIP9mbWPOPfFc1/E64Tp/Wma2sd0e2JRFEBGBuHfHaqK/wDxH1G6culnbxk853uy/ZcgVVXnVupagSs8VmwOASYQTgduTmsM+H1UotKrOjxfL9BuUW7r/Up/xc6fttB1y32yTtc3UfjzCQLsUHgbSO/Y96ytnZpNdQosYmZlOE8Tbk/XBro+o9Z6pqcgkuY7CWVUEazPaozhR5AkGoH7e1QkYugnl8kSL/RaPw6TVdGUvJlK3Ltknqbo2y6Z0bRZILWc3moRmaRvFLqBtGV27ff18qr9GsLmSL/6Xm4yRlDU+Xq3XWgFt+07gRKNoUEDA9j3quk1PUJMb7+7b6zMf71ln8JZenRpg8x4l1ZrdLhQveW6KQ21SSR6YrRaZeLFHMFVmxGyHaK5YJ51k8RZpVkPdg5BP3q10vqnVNKVo43jmRxhlmXP8+9eVn+kZO4Oz0Mf1XG9TVHTNJihLSMkuwtHt3AYPv8Aetda6f8A/Q6AlFjwm0BFx9CfeuRaB1xDayv+0LWQpK2d8BBxznsf866ZZfiF05fxRxx6nHAAANlwDGxP1PGPvR4vhzjJrItD8jyscknjeyp1G3eCDUnk4DRuef8AhNcXvNd0bT9TFrdfvFjVFfw8q+BzgN9MV3TWpoJrW4lgkjmUxt/s3DbhjyxXm/rDRL+41e51O0tM207rja4LKdvCkd81vDBCLUZP5M3mm4tpfBLv+rdAtkmS0jmuHfJSXG0qcjGeeQBVHd9QabNpjWs9q8kBl3g7FDrxjhveoT9P3kcUjXEEsRHI+TIx50UdkpgNuYx4gAYAnPn2rqjixpaZzSyZHpoutFubGe20eKC1kSRL10jncDLfkO1j54yaY6qvZm65uZI7hUj/AGp46uV7t4gwTVrolpF+xrGLwSpTVyQRyFOxD/aqrW9LvtT6hnks7C4mT4kt4qRMwznPGBWsWuRnJPjszuqRXFhq+oWhlb5J5I2CnAJDny9M0mLUL62VVivp4kzjakhAFdnX8I7bqvR7vWo/HstXk1N3uoppFUCE5PCnkHtj60WsfhHocvTU9xotnqqaos8BjguJFLBT/tOGwCoxkHvziuqtWzl3ZG/CR7pNI6o6g1CaSY2mms0Ehfd8xU45+pFc9tuttdTUbaWa/mkQSLujyFVhkZ4XFd2i6Gsum+gtbsrbVBdnV5IIpXWMQtCWIynJxnCmuT6v+Gd30zY+LextqF1e7H09LQl/DXfl5HwPLbtx55qZOPTKSl2jp+sXATW9fkYjw1iba0+FjBaVeM+5NUEF9LLLPFJDHbyMMFoIueR3yeD24xRdYHXdOuurL4Wk0tqJ7YQrKv7sqTuc/wAqzEnXOmXdvi4t50kb8yhPIeWQRkV5+bHNv7FaO/FOCX3OjTSMtvFHEI7u6KNtmmvCfyZ4247io15qFvozT2fjQh5T4oZVJKEgYDD/ACP2rNnrq0+CS0eW8ZUUIjLEN4APHJNRbjrnTiVzptxIU8zKE3H1I5qPw+T4K/EYl7nQPjobuzijhuhMxhVNhwrbQPL3HeqmWayjnI+JiGIw7b2UcZxjnuaxDdfQRFhDokAyeC0zEjI8ves/batbWyODpkcx3EoZZXJQHy4IzXTi8Zr8zOfL5Kb+065pBtALj4SSORDJljGRtBx7VNeGGVgZI0cjtuXOKyn4f363ljdOLeGALKBtiBA/L7k1dXGqXcd3LBBaxSCNPELMxBxjJrsX2x2cUrlIsUiijJMaImf8K4o3wy4IBHmDVDZ9S3F3cW8bWsUaytjIJJHNXZO7mmnfQnFrsbnhgEEmIYx8p7KKJQyrGQ3dV7+goTkeE45/KaRjxbVMPg7Rj6ilPoqHZ6IsZDM8Um/EQgR8DzPPNT4JDIC57E8D0FUGlSSXVrFheHtI5OOCCc4H1/yqktfxFDdUT9KJaut7bRGQuQNjgAHvn3qllUVs04N9G+JHrRVhulOvrzqPVrS0ks44Yp7UXWQcnnjb/LvW3dwilip4FXDIpq0Q1QqizUHUNQMFg8yNh8Er6gVh7f8AEqO9l0oQ6hCFv3mQLtZi/h5DbTgY7eYpTyqPY4wbOjc+hqp1DSl1K4klSZoZo1UJIBuUjnKsPMZ+9Vv4fdSTdV6L+1JWOyc5RAchRkjgkA84z96vkZVuJkDYUKpA9Cc5p2poW4s5p1R0DFdOzOX0y4b8s8TsbWQ+4BGwn7feubdQdCXuiJLHc3MvxBjLq4ZmK8jleeR3/nXpS4IeCVThlKEEHseK886g983hFpleGP5FyS7bf8JHkOT+teZ5qjiqvc7/ABW8l37DGkSXFjf20weMz2aRSRzRSMyzZOCGB7g98du1dHbVNRWRozcQgKTjMKiuTHX4tL1FI7iza2dBhdy4V+cj7AjzzWyt+t9OvYF3HbMxHzEfI2fPcOBz61zY8yX5jbJibf2l/cazqsRA8eMZGf8AZLUi21TUXUmS5AHBB2qKpz1Dp93IN++2G0BWlwFY9sA5xViwEltEyglT2OR/nW8cil+VmEoOPaBq/UMmlaXdX9zqDJBbp4kjBdxC/QCs9o/4k2vUNw8WnarcXDLGXI8FlwBj1Aqz1SOxm06W0vYllt7zFuY2ON2T248uKqNN6W0fR5i+k2MdrcY2nDEkp3OM/anOWv1FFbLmTUrufB+JfnAySwFco1pbi71a8uXkZtzuDu7FufvXQLm4ktkxJtZBL6cnjsMVj5ZrS3uLiFi8mZHcOBkjJJwB9q5eTOlJFXb2qJHNbTCUOyKokDflOc9qiSLAksCtI0k/iZK4J4C+nvn+VXFrKLlJJ44xtR8l2wR275pF3cfBOZ7NJF8TEbu4GQMH8vp3qoy3Q5R0RJZUkcvFCVwSTAPQcjJ+tVlxeXy3E5jcRJFwuB38/wC9W1hCkxVWZsNkE+ufWoW03VxcTQx7jGcgHz5x5eXFbwa9zKabSKv/AEm1aznzBdkOi8fJzjzrQdMydYdaXogsEhbD4lnkhASH3Lf2qx6b/DNrlH1XXJPg9P7s3/iXAIzhQfKtVNqsVvpS6VosK6dpijaVXh5Dxks3f7VWXNjgvy7F4/iZcr09CH1DpXT7e20LXLu4ju2XnUtn+rBwSgHH8PHfHGe9VGvdLzaGyzNF41tIAYr2EeJG/wBGHY/Wt/cWdvddM3kUw0yW0a2l2xMqCQMSDxxnGd3aubWMmv8ARQdun7gXemMcyaVdHdGQRztz2z7foawm4aUtNnTjwZJRcse0ir1LqS9ZTZSWYckAfEpMUBx24B7/AMqNrq7thGAnxEBnGZfEV2CHBw4ByDuz61p7I9MdcnZparpuqD/a6VdkKSfPw27N/wB9qqb3phdGupBHDLYXIOGjkztfPsf7Uq4aZkk5MXfWgE1rctLNhWCLtRuxHYjPJzUu81a20y8trS6t7Z8oZA+9huHYeXHPFRTeOlrClxCxER2uVO8Mc8Ng8g+VPuz3du8ukR2V9cn5PBuJcM6+agd8eeKyTsvjqx3UbI2K+LbJcTF/yKuN0Tnjb5bxzxntUNYtWhtoHnMfjqrARuDsfIwTuA4yP4TxxUfWbrUYLRJlWC4vtv7213E+CuMEkd8jyI5486xWpT6rdyPHNfEI2CYlchO3Hmf+zXRihKfuYZZxh7Wa3W+r9Kt9KFvDIslyZN81skeFEmMM4P2H1xWOueqdRnge3ikEETNk7SS/0DHkD2FQ7bR726uorZERTI20PI+EHuT5V1jpL8ELe6j+K1LUIroRttkW2fKKw7qT3P8AKu2GPHDvbOOU8k+tI5HZ6fe6lcCG2hluZ252oCzV0Lpr8ENb1YJLqDiziPdQNzY+vYfzrtWkdJaLoMIisdNibjgsoA/7+tWbJKcgQsg8gj4A/nVubZKxpdmS0H8PNB6Rmsxb6el5cSOVknZ+Yxj82T/bFXOsaFpWsSK09s8TRj5JI2+YEenNWSadLISZJpU5yuXzj2oNpUm8Mt1yO2QCP6VnRoYjUumdbivPh44IdW09oSxkueJEP+AHv/M1k9W0ySIGC3up9JkDf7C7TdGfpIoyBn1Fdka0uCObqMr7xZx+mKZuNMW6UR3JtJ1XyeJv5HPFQ8cfgtTkebOptC6qjtzJq16xsWO4NCHlg9slQf51lPg7L/8AOtufpE5/tXp296FSORptIvjp7t3RSxRvqMY/UGsL1N+HkFwxbVtCiik7nUNOcQg+pdSNvHfPFaRycdUZSx8t2cYMNouQL6M+/hvz/KkiK2872P8A+5t/lVj1d07B01qItodSjvAw3YAw6Dy3eXPsaoua2Ur2ZuFE0pajH+txnBzjw2/yqbFrAhguYI7myRLiMRMfhvmUA5+U4yD7+lJtOk9Vv7Vrm0hS5jQAu0UinYD23DORRWXSmo6jYXF3aJFM9u4R7ZGzMQc/MF8wMYPnzU84/I/TfwRy0UvL34fHA3BjgfpU7QtN07VNZtbK91mCytpnCvcGNmCfbFV8FnMLa5YwSboWCSfL+Qn19KZs/wB3eQnPaRe31FNSvoPTrs9IaTY9G/hzdva6ZYTXt7FgSX8yhnDeYXPCfYferf8A9YtmGLDT7lifNnXNZ7XliOu35YPgzMfyn0HtWs0yz0CPS9M8WysTNPbmRmnXliGIzz37V4ssEvJyNN9Hvt4fGxRk49kT/wBY1uT8umzHHrIP8qI/iKDgLpTfeb/pVBr8Vnaa7fQRBI40mbaqggKOOBURZLYk5YHNccsEU6o7oY4SipfJp5evPHUo+kRMmeVeTI/pTR1fTdQgu73X9J+I06EQxxeG5ae3clssJCMhMDsSfaqRXtVBfcvGPKn5Lq2h6Z1KZ7loY45rZy6HBX5iPPg9+3nW/jR4S0c/l4oem2Yy7TpnqO5vVsvBiVCWUpKMznyLDb3H9ad1zQoW6ols4Y7uRryTe03iqqocdsDnGDWV1i7sLGW3WK4mxcqLmSeEqrTIxPHHYjHlWz1zX+nptdh8ZZbW5sWVY7vYQDlQdpPnnIrveDKtpOjyPXxN02kygvNBuIuobW2lWFLBmKuVnDFgvqvBJH0q/wBK0Lp66Rp10qBbyHJEkOR4mOxAB4PbvVV1Zd3sT/tPSgZkRdrSKh3Enyzjgim9F62liuIYBJK8/h+G0cUQL++WYcD/ADrN+pVotendMlR6a17Hf2UF48fhyFxbyoPqecZK59jis7NDp+nSRyaxaiUs+C1upAZf8XYEEfzrVf6K3GpTo0Y1qAPnLSupEa5zhDzn71Eu4da04fATzS3Qt1ztjVmkYHnB4yeKzjJp/uaSgpIh6ZdaH1BfXOl2Mxt4yfG+Jk+UntuwDxnioNxoZW4vIoL6O6tkAdHVeQfUkHGR6VE0q1tNSe7aUQ2MQDH/AFmPk5OD3PGPXmlWumpa6nctoLSSW8CKHcyjw2bHkckMM11xutOjll3tWX+ma7PbzROuoRSfu/3git/D57bWAbkeefWn9Z1DT+pFjW4hvFMIKPJGwJxkHgMe1Vd0bbSLVdUm02GW4AYyQxzYC57Fdpzx75qoj6000P4qWE1uzIQVS5OM5Pbz9Kz9Octo19TGlTF6joVtPcoljBM4UFC0rpHg+XdvSqC70rWNFfdLHJCh5EkTBlxn/EOK0H+kmnavmzm0m5vXldY1UXONxJ4IJXINa6TStNsJHsWsI4WjDx7JL1juKqGweO53CtVOWPUkYuEcm4nL11a8ZQnxtyVx28U4/TNIWUPjEkhLH/Ga6HcaBoVrPCf2PpsvjOqN/rT5XcW7rjyx2p95On4Yyr6fo0SQttABbcrZUHJAyMbj3/w1q8y9okLC1/cc28U55eXA7/OatLXV7+z094Yb+7iiB3iJJ2Ck+4z3rdi20u+RH+B0eYojuq+JISwCb++foPvUAHTLq0mubPSdJkKMFKLJL/hyPPz4FL1U/wC0fpP5M+s+pXL6PGl3c+NqIkJd5mwNrEDGD2rTX/R9tBa2M6LFO0qS+L8ZPJhSrD5hhhxzzk05aDTH6b0fVtQ0+G2WZnjjMDyM1twzKSd3Aba33BpyTTdHOnWktxqcxV0Ryon4XxBnzHbIFYSk27jo6IqKhUtsjHo8Pp1rJbtBtEsu5VLY3ZAGASTj0+nvTF/oT2piMSQzxSpiVWIAQg5xz59/0qVq1tomnNhNRk2iJJUIuCA43sp7Y5G3+lVGpyaRCwle7LRyxh1jWQlSdqswHPnmp4yb7BSilotBLbWrszQvcLIwdDCysrkHtg9x2oVmepdT0m3sdum28cc9vcmNOdwdATz3/wCGhR+GvYfieOjf6jpGl6bpkuwOjS5Me+PKlgfykDPp51baP0709bRMZraJ/Gi7SE8Z8xk8DmrfpWwt3SR7q6WOOUnZcyLkKg7AJV7L+GWj3MXiXGtFJgpaOcqBjdzkrnB9PpXPDx55Fo6J5oQeznfUdjZ2HT9xb21jKUQgLKozGuJF43YrRWfSejalp13cTy+FciR5EMbEBDyNxB71Fu+n59O6E1q3s7y0u1iDPK7AqZI945XyyPrVoOkr+40+aVVt5InjWQlJWU4ZuRzxn6e9NYJOFJe5LyxUrbM9p+jwrd7x4kKICDIZfzNjGVI8j35Bq1UQ34s3iuHjklJ8TKk78cYGO3I9KhroWqWdu6xWgltFLISsucyYGOVJPY/TIp6S2h8Bbdna3u+NjnuMdwfPk+dcs8TT+5HUpJrRdSa6NOMjyStPBu2bAOFPA5yPTPFUGka9BdancxQsRAk358nz5GP0Ip9JnhBt7x3KNmQOQCu7tzngj18x3qvaP50VtkEokZmiHO8E4U49sGlGKaA2japp97E6NLsUH5SW7Y8+fI1RKul/EJJJGbiF2PzliQ4B458+D29qiLI0GmO9xYCGXe8LkrsffjjgeX386qLeeXwU074iQTIwkVz8yqT5c8r3NVFWS9F2bmzmYRWlw8UjllVklzhhz2Pfjypi3ivokkaHVEBUhikkZAfPkfT6VE07SZILaSSSRhJIhZXVj8m4jGfTgEUzc3hkSbTwZDB+73DHCcc4OMjmqoC0tpZJpopHlfaswxsHyhj55HYU7bXiDWrks2R/4TwgjP1qsM/h6YLBGSPks0kmdrkHjFHYXslrGgZEcOnM4TBBxxj0wfWlQ0zbaddNqU8TeDbuJEyyFcMqjjIYEH7Yqxsb3VNPOwXTsmduY32hfTg5rE6RdSLMUHiyvHDkMvIcjyI/rWh0zUAIILSSdTdzAlMk43DnHsBUc5J2mS4JqqLtdfvmL+HqJkmVyuJo1PPoDxWduOp9bW+EAe5hklbhY5h2HPA7Dz/SrqC53TQoI0+IYlnRU7Y88j3prStSF/fXIutJltJ4GdE3MCzAef38qv1ptdkLHFPopv8ASS7leWcalcxXQw+3aM/823GSTWUHV8mmalKxKyTTRsRhvysw749cY5rZSWSLlpbIotwACVfJBznj3z5Vmuq+irC/eCXRPCtrpXBdWOG8PscU45G39zKcF/ah/Sutri7uYZHa+L+GUHgzdsnPbIzznihb3TC5uDcTzFpEEcsk7leQAcZb3J488Vn7bo66trkW095AHcfMZXwVOeOPf+9aa36ZYrIs0iqr7QixynAYcYHuKcppasFD3D1TrC20mOaG2VrpHWNfFilIEWw5wT6Hce2apbD8UY52kjGn6gshBLlrkqp9+1Ws3SwvUe3ubd44A5ZjCcO5BwCBzx51H/0GW4ulTYCkeRsLADB4zj+tWsyfZm8TXRIi/F9rK7ji+FlSQAtuN4G2/wAjmon+m2ndSzyya7p+nXlxNIEgMkKTfLjGNxTj+VQrz8Kpo5hDb+GEfkBXXemR2GQMjNOW34Z6haAn4ZJoYQWZmGGB4zjH9PatVmVaZn6Xyi7PTlraXFk9pp2nWMNpObvEcZCO5XaQy5IIIA/QVQ2fQdpf9R3FjOht5JIzdJJbjlTu7DIAHfyoaNNqGiRvHAwv4BmXwGwzoc8/mwR9BV9p3UF3HfJqVzp9/GhRoyBbtgKSCOefSl6sn7i9OPsqOc/it0BpfSFxpF8t7evFfyMtwQFLBVAyRwBnnzo9Ke06Zv1fROp7q8spbcSTQvZmMuhxlcFsH6j0rpvU0fS/XENtaaw1zbxW2542AIBzjJPPHbzqiEH4W9N7ruTWGn8AiNhtMpTzCgcgds4rvw5VKNdnFmxNT5dEXXLa4ksJXg0+7W0baES4w7src8gegH1rC3Gjz211E1pavb+JyMfw/YnP2rsPT2qDq+B73RYIhbozeE2oEowTOA5Rc55DeY7VnPxJ0TqbTNJh1CHqNmiMrLMsEAjRcIWGPM9sd65JTxxnwumdWNZJRurNP0tZy2P4Z6ijzNC8MTbvlEYz4TnJ9K87WfVGsWGpNJDeTy5JUosrOrKe4+9ejNGZ9a/CXXFvJhOz27o8qrgkqjYJA8yVA+9cx6Z6Qvteu3i0nTWkigBkk8JQOAynaCfM5OBXZKVJaMsfjudtuqY4epNb6klv7mDT4dOj1BWjjW4G/CHZucsfIHHl6U3rni3Wm9O6zFqNztigEDru/O8UiEFvXKsvf/DStUzbTQaer7ZiEN4pQj4dlMWIV55AGM+pJ9KTo/h3XR+r2xYu9vJBeQ7hyF+RHA/VT9qyU29HR+GjGm9lTrmhadpes3/g2yndIZUZueHQuCP5GupfhjCug9M651IyqrRRyxx+XIZwo/ma55q9tJc2Gm3qtue7ha2998fiJj64210jr5o+mPw50/RUJWS83zSKe5GxsZ+/NVB0pT+CsyT44ku3/wBjjeqaJY6nqd3LIrrJJKxDKfVn/wAlpq00K6sdOvP2fqMqFnjAySAOV/X84qyU/wCtse+ZP/ln/Optku7SL1sfla3P/vQVkskl7m+Tx8cvYzMGtdTWcYaWOO7jx3K8nhT5c/xL+tSYOvo4yFvtPmhY+a8gfY4NS7fi3j9tp/8Adh/yormGJ4zvjRh4RPIB7K/+VbR8l+6Oaf02L/Kyba9T6ReECO8jVj2WT5T/ADqyRlcbkIYeqnIrI3fT2n3Elw3geGdz48M4xjxvL/kX9Kh/6N3FszNYahLEdxAXcRn5seXFbLPF9nJP6flj1s3X0oh37Vi49T6lscbmS8XC4DKDnIXj1/iH61Ih67MZAvtOkjJ/iQ/2NaKafTOWWKcfzI1tFiqi06t0i7wBdCJj/DKCv8+1W8UsU6boZEkHqjA/0qiAAClKOaAHtShx5UCABg0TZNJmuIraF555FjjT8zE4Aptr232JJ4q7JF3o3kyjzHtxS0CQtGeJi0TvG3qhIP8AKnLK5lsbgTRhJP8AFHIu5H8vmHniopv7UQeOZl8LO3f5Z9KKbULOBgj3C7iquAvzAg9uRUtRfZpFyXRp7XqiwiKLL09a+CAVaOJ22kH0DE4/WkT6/oJt2t7bpu3twy7fE2LlPmBBHGfXzrOS3sEHMrMo8iVOD9D96jNrWnryzvj/AITUOEOlotZJ3vZudQ15rjQZ4rKys4ojIFadcYYlTxjHcimdP6v1q0tI7SKSyFvHGAm+M8jsCBn1rLLrtp+yJrfY5R5o5M7Dn8rgf1qINchjUlWuFAGBlM8fesZYpJ3GRvHNF6lE30WqahcAXMcskkkki3EwQKI3xt+XnPYA8ZrZah0XrnUl7PqGnTu9jcRxi3zfFPDG1e6jlexrisXWCpGQiS4AwCihcHOc48+5rq+m39xYfiBY6DYTzrFPD40uG4QDOeR2PH86FBtcZX/IOdbVfwX3UXSbaR0hBpEtytxNNeLM4Zjll2kNtJ/w5zz3rL6hHqmmx29polpCNOhsGhw8wDpJk7W3HOfU/Wug9f6tqHTmiQahp1k+oXU7rE67VZljAOWGePTmvPut6l11q+uuP9FtUnlkt2jDTqSxibv+UhMDywK0yQgpEQnLjf8AsdNuZUv7zVdG1eS2mWe4TapwwSIRKSJccquTwfU4864f+LENvofWt3p2lW62trAkQVFGMkry33Nd9s7Sx/aN3Z32lamg1CKF5ruHaynESqVZSBwPY/as31/0d05edO31+LG7v5LaE7buSQgxbRgZA5HtnvTi6eiZRtHnCSe4c/M7D7U5bQyTMuDuOR5d6t30nSy6ILy7ZSuS5RRj9Kct7LT7Z1lVrgSJ67cNWnJGSizPXJHjSFSQNxHAxUdQWPBY1fTWOnuXZviGdiSNrAD78U0unWCKCEnLH/fxj+VOLE07NV+GY3WF4DnIlHmQfy1sbS23XmpShpGMdg/BbjkYrnOl60+hRyR6dGqJIQXEh3nIGM5qxtvxB1a2lyfCKOCkiquN6HuKctqgWnY5o8Wqre6bJOsjKjsGLcY54zW4ecp+dGX9DUXTdXtNWtfHtmBHIZDwyn0NV93LPKd24gqwAI8xUt8VopJyey1ku4WVkLgNg8NxTMZSaBAr5ZAPynscVXCXY8jFhg9vc1Lhkikt0VokdwmckYrP1L7NPTp6PQvTcR+Gj37kb4ZF+Y5YBcjP18q5jYWdzB+NN3dfDzC2mt2Uy+GwTIjAxnt5VqtB6ksbcXUTT3wkjgUYJLCNg0h28/UfapsOutPoVi0T3pmkQs4lC4b5CecH1xUTyRrZrGDszn4f2txa9U6Vvt5kjGmrHuZCBuyxxk+ddXvZHhidthZQOQPL3qnutXl2xyGPcEy+NwAztqvkvnGsXAeSVQScEZIwYgfL6GnHPGCpE+g2TbsiZ0i8NyVhbaB/4hIAX+ZP6Vz3S/wg1OwvenpheW8g0qe5lmADDd4pJwB2yM/etHBeSRdaRlbsCNdOGBIwVcsSc59eP51sra5twF8Pwgvm/jAg/wCdaY3HLbZM04UU3QPSkvRuhppEk4uEiHySBdu7JYnjJx3q9X/6bm/4E/8AlU4by1C5+JgwB/jFVZ6j0mKXxbjULWDxIoyA0ozyWxXSqiqRi7bssJgTG4zjg156LyXDB0aCVoGYfI2G4Pn9K7eOr+nrhpYotZs3eNWZ1V8lAO5PpjivLmpTytfTva3DBklc8diMnH2ry/qWOOXirPQ8FuPJm6vtLj6htgt8k0c0B2RTbAWU5zsYeY9DWG1K0utI1trH4SVGG2LxU3bZwTnIFP6V1dcxr8PJc3SyDgKWBRwOec81oI/xDe90sPfaOtxbDGTGD4kZU+3f+9efjxZMentHXKcZdaZntSgN3bBUaEzW8hc2rMwI9SAePLsP0qw6b65mt5EjtryO2cnbLayoSjgeh8j9KleDpnUjtq9lJ4Ul25wkoBXP0HJGc+1QLjpa81S7UXkFjHEEZRJE4PiMAcEbfmHuDxV66eiZJ9rZquoZpNcFvcxXskVvARIIYUJZm+uc4x7VF0/qjSP2w9taW88bKioyjbHtxkknPOaGg2AsbVbKF7hQY/E2SOCS+Bnv271D1w2PjRNM0cd02THIFKtJ6qWHHtzUwyybcXscsUaT6JGt6op3+HHhSAcsMnjt28+Ko7W+nk/feCrykb224/ioT6vaDTQskgmeUeDHsXaysW4PPBxzyPSnLvSk0+WFVjmcMpdCON+OGzyOxxxWi6I1ehXxPg2eDGkaJIdy8jcR/T/5qrptQiupTDkgMdxIIx5eoHpVvfSZjiiQFhtycZOfTP6VV6iiNA4CeY5I3Ef5Uk9lPods5oBJExePxF5Ik498Cnunbqz069ujeRQsrTKVDBiM984A5GTVPJbzXD+Kbcqq/mK8E/WhDql1aGOK3e5I3fmIXCf1zV2/Yn9zf391d69qMoM8bCAcCQ4EYBA48qYaxb4iGGcNGzkgt7Z8vtVBZ9aTaWrktp94kpPih12uSe/fgdvKrW06ghupvHgxbQIdxt3JK5AycZ+1YOLbtnbj8jjHgjbt0dpXjW9m+q3Ab4qWzhKW2Qzj5znn5cZPJ9Kybp3GQdr4yfPyrW6FrS9T6nZXa7dqX8t0YwVDBfDCk/Ngn/l5rO3NiVEjwGOaLdw0LbivP8Q7j7iq8qEWk4I0+neRK5RyMqj01YazqNg9xFiYzx7ZU+Vh83rWo14fEtNYyb5Y7WXwkZ3LuAuO5PPpVHZXIjvbMscIJY8/Zhzn2qu6nvdXGsXsRk3qbhxmNu+DwT+goxcnGmT9Q4+opfoXsmn28ARUwGUh3DkD5T37+tUutafpkV4f3UagYaOWFtro3mOKx1/YdQXUqieyuY8s2CG/OPLzrP3ttfQweHfRyW8oZRmbOCD5++K3XjWuzzZeRXSOim2jtr1Lx7lVlIIPjvlZM/4s+fnWXub+NtQm3xoxkmJ3RnKjLY/SqXXumzpWmw6mNQguoWcJsU4dTjvjzHvUvp4Rvp0Z2qfmOD966/HwKP3XZyZ87l9tUWd2sM2mSSpGFYdj2OQfX7V2f8KLn4zpQSg7iJ2UnGCflU8+p571xPeraY6kZALD77jXZPwbPg9JyJKcH4t9ueNw2rW04pbM8cm9M3MalWyRilKG8RRg4PNJSeE/+KhOO2aUb22jmSIzKJGUso8yBjP9aizSjOTfiV0zbu6SXkwaN9jAW7nDccdvcUWp/iR0/pN1PbXVzOksD7XAgZsH7Us9F9KPO4+ChMso3tmQgt796ofxG0zQFsLlvg5JdUmeMboVZ2yTkduwIUis7n3Zf2l1d9f6LaSxQObySWWNJlWO3Zsq4yp49jVvYX8OqWiXkCyrHICAsqFXGDjkHt2ri4suq7Szj1BrnU7a0RxbkvIoZANoQbe+O9dC/DzUbt+n3N18Zeuk8iBwoYjB8+3rU+pumCjZqGUjOD51Rda9Qw9MdMX97c/MDGYo4843uwIAH9ftVu9+WO0WN7k84MYz/WuV/j7fbtB0y2MVxCz3TSBZFxkBCPX3FUqbol6VmRkGh3mi2sdrLbXRQ7pkkw0nI+Y8/MSDz9jWJ6iWyhvQlham3VUAZck5b15NVLMVfgnjtz2o/Hlnf97IzlRwWOTit44+LuzCWTkqOp/hG6WtrcTPIib5RuJYLsUL3JPGPrWxudZ0LEpWWwuOMtCCAzYPzYPGePf6VyDp25R9Jurd1Rg0o3bv8OO30q8uYo9V09LOzicys2YYVJcow/gH+6e9cWeH3tnZhl9tG5tk0zVIri904745EKSgZHiL2IdT3IHn7Vkrv8OdN1Hde6ReG02nIt5VJUkY5yTkDv61GsbTXej13+DKFu12eGVGFk8u/BHvU09XarY2RSfT0a4JOSoChcnsRn0rKKlF3Fmrakqkjo2qTw3eoyzwSnw52XblcclRkH71Z2N71FaxQWENxbhEO2FHMLHcT2GcnvXN9P6qNvd7J7a2t4Hx4v7zIBx+YGr6DXrFbsfC6paohO/eGJIPGCD2HPnUKEoycrOh+TcFBpMvbnSdWvr+ee52tNIwLkkZz68Dion7KvnkSKGGfxdjyOXRgo2sBtGAecHP2pzT/wAQ7u0e5NxqsNzG2WeUAFm4ABAxnOB6mmr38QNH1y3ki1bU7uOExvFK1smwMrDg/l4OOO/FUsUG+xvzcqWkMre6VFI63WqWjMpVBCkhYs+cYOBnGfTmlWcN/fdHXiC1j+Kd4ykF1gBts2fmBwCNmDVVol5+H3S15Dd6ZLq8skbgSRXDKxMXfcvBHfv5/SqnV9VU9TGLTQ2naPvWSNpLk5YF1LsMDkEZwD2zWkccYbRhk8jJkVNaJmr9OX2sCzEcttpcUUGyaIJBIkpDHgbcEAg/b60j8QtA0g3tte611MtlavIm2KOJ5MFUXgFfynA8/WqfWuoIL3VJhBrrw2Mi7QVc7sbeV9uc80/1X1T0xqMcNpeSJcmPw3UMhxgR47+vNb488oO0ck8MZ9k+56w6UIeOy1+6isipSRGtHlklOT8+RgA4rPalqFo0MCdPaxdX9y7+FG76YFCjb821wST5ZBFYLVPhrjUJ57WSG3gZyEiQMBjtUrT+odQ0y3mtbW4t2hLq/MXOQP4cjitXj5fe9tmayOP2LSXwb3p7WdU0a5kHUT3FwnYxmdozt4wylQQR/WtDJ1n0vpkmbfRTcMvIkF4/H8ga56nU+sNpqXyG2GZVhJMYZsnIB2n6VenqCzvVguzdNCkkTtLHthZlYA4UEr54PB9a55Q3tHRCSqkyVrfX9hqVkYLfo21dySyST3PiD3ODzn+dRlt9Bv7GHUb6aDTruRjiHT2ZEjHbDDJwT9KinU7aLULuwk1ExgS+FbHwIsSHJGT8vrQvbyO2tJmh1AgpIisrQxkHKvnuO4ZMfQ0q1pBfu2Wt/q+l28MMNt8FdxjMUniqxkBGcH6EYz7islFZ29w1wl3aRyDwz8PLGQNrnJwfX82P+Wr+5v4FSFYtWAdwhG6CIbgd+fLyKj/zU1e601pIkSay3xDsUG5IwFIeRf8ADx+VD9zTgnHoUqb2VFhp1lo9zaXdoi3F9bz71SZ9qNjOD/Tira4F91BfJdS6C9xOoy0q3RGW4GWzwMgAU1Z6/caXcGbVr5NQSWE+HBBhSSSV3BlHJU+XnzS7r8RHvbm10/TLGRXEaoW3FWeTPzbueR7Gm+Td0EeKVAmgsNS1oNqenXlreT3AklnNyGVFAx4hIHljnjtmpT9OdJETk6gJSfFVyl2R4uNxBHHYlV/X2pWuaAbW7u4Umtpdhimj3Lhirrn18jUcaLYxxNcSwp4u/wANgGAH55Bk/eP/AN6lyvaK4/KHRouh6XL8da3jFlVmhZrjKcEIVxjvgg05bw9P28bKyQlmws8byhfE2tnIwPLg/f2plNItGdlaYBWVmKEjkgxefl/tc/ambrSYYb5EjjiIldUDl8bchSRjPP5v5GhqxJ0TdX1HS9LEOlw2EOrWcqqyrHeFYxhmwhXHGCSR/wARqjuOoYEncjpJUiwsaobhiR6YPmPQc4q4t9OtN4d7zwpJnGSBkFiEPY/8TfpUOKzu/wBv2dtlRbtA28uobgKWJA9eDimq6B2y5uo+lo54o5f2PEsaRshfxSRuUMwOG4w2Rj2z51X3C9PTQ5S20F8gyFQ8wAYDgd+CaTNa3V1PZw2VvpwkuQy3C3VuN0ZU9zkZAxg596rrWLULuR41sNEIX5drQ+4Hf7ipUENy/Qnz3WhW3gubfQG8RC7lGkYqwDEAjdycgD70KjW0UcxhiNhoPivJHE37oAoWzgnj2H60KukTbOr2i2UljFI0c1qxVZFt8BlI4O9j7+3an7nUN94LaVTJGYiYnlGY2b82Aw5XzFU2lXcen+IYZpJXvIwAjv8AkUfwjPbk8UVy8i2zTRQlZlIlQYyVbPII/X9a8v1WnR6Kxpq2M9Sy3q9I3rXSLG23OLdztIJUjPtj1zWgsLy7mkks1dmhliKl9xwhCkgEDyrJdQXkTdJ6myidZHiUDc+7PfOPQdv0FaXSXaF41hlVWjYNIPZlx/n+lbJ1D/Mzq51+gSF7RfiLeYweFMshYAlWPA7D6VorTUrzU5GuJ5La4jiywWaBSGfz9OP71kZ43iuNgkYKDuVSxwx86trKeC6R8zpBuGFSb5lJ8zjsOfKsucl0zWUU/YfstbtrobbuytrhVcoZFXag9QQDjH19KrNVaxF9cNLYxx7FfwTbSsPlLcDng47j9PKmpbHU5rwoZQ0Yl+UZwMEdh7U0EjtLeWOeKf5GJ25IYkP5Ht9B5045GyeC7NB1PJo95ZeLa3178SFy4GQO2ACpA7euaopgmn2spQW7T7NoLKqliOwPqP507FAtv0815LAWZkLKG+Zimc7vt51EuLmGf91bmIFcu1vngFu2D9PTinOalTr+BRjXuN6ldzSWsF0o2tcEbF5UKgXHl75o50eOWWJsRhFAEbqcnj8x9fOpF4wvZpIeVwzKqFdo4PKgjuPOq65S5jCtOrGQZUueSwxjIxRZaQi1dbmN4nyqhDIDIuAxz2BPril2cDXq+FLGmSo5lk2qpJ4B9KkR3Edtp4MtqsqKFGSPy5z5/pTFrYrcSyLvEcjfMc5xEOOSfSh17gW1jcQWeqxq8Xw5XgSJnBxwTknBFaGPWdFmdjOGeWNiI2tcH6kA+Y86orbQEmQbbm1uJHyrETAnIHoe39aYlspYbyCWO9gtVBxPG6p++X7+eKzVXYpX7GptLuzErSbtsR4gMpCNL/y+X/fFRLrqLTY5nF/cT20pIUEDy8mHrVEdSWPUmS1s4RZsh8RMBgzf4h5r9qlRXeg6pfSxraF7kAxBZI22KPM5P9QPOocd/oO9GsiiEaRTx3L3EMmflzhSMeQzwao9Y0+0m1C1vLlpAU48VTtb3JP04IpV1b3GnWssNtFMsIUMoAGD67ePlP1pzT7q2mWATXrRrIgLGSMk7T23AZ5pO30O62I/Y7yP8T8QsoU/I21SVXPcMPPHkRSZ9IeB5poJpJUkwxs3IBQjs6kHvSI9Q0q2vzZRagQ0YyGK/uyM4A5qbdS20AZxDNGU7vHgxsD58UuLXY7sr5LC6sZLa6lQyxpgMyufFTceDtHBHr51Lt9mt3zTx6gLXxGJEe3lsee1sFfPIqVpF9tiEsBknU/MC3IA8xn1+tN3Wq23jfGSW8bKBlZZRnafPJHIo0InalL+y7Se5mvGkjj+dHVQWBHp6jypFtcDWrWO9tLyS1DOHZd3yygdwR5e9QJHtbi6iupXlMGC0YTDxlu+Qf7GjuunrTU5kuCxEkTeJGI5So57/L5A96QHM/xC/EDR4NalXR3N3MDtmg8PMQcZBKk42n1xwaq7D8TOro4Xs9OsLO0jmIUtdAyYyeODwOSPLzqu6wi2fibqSGFIiSuVVQBkxnJ44570EO66jI83T/4o/wDOvWjGMEqXsc+PG8t2/chXVvqWt3BuNY1eedpNuVT5FwTHwAMDtJ6eVSYtMtLDRbMoilppDMUbB7CMA/ruo0YbEY+if0grR2Gt6mlnB0tGtrJA+xQXhUsGKhj8xBIwc/pVKTero1eGGPaVlr0p1HFoOr3OkpcxW6PZR2njudggk5cn+bAe5Faz8Q+oodW3dHWtvOLu6jjMbqQyKXDHn/ynmuU74L2SVLi1LykE+L4hUtkupHYg/wDzV2TonpTTdb0Sz1uee4tLkQtZsUkXlFZscsM5+bv6VyZcUPV5yJWT7aXZa/hvcwWSzWDuEso0V92fkOw/OT5fWsjc/izbaJHdWnT+iWK20l4SJZNwLsSvz8H/AHh5/pWx06wtNN07XtOjtGttPgjlgiYFgssbR72Yk8E9xkeVcU1yystLvInsbuO70+V1lg2ncVyYl2E+ZGO4r0cmR8U0cni44Sk4y2VjTXckrXTRmaUus1wRk4LGH+uR+tPdHXATX4LGZJTbXW+ylJXAUyR7VJPoGCml9Mnx9RitnfaLuEw5x/EY4tv/ALwFAa2LYiWzs47aRF+YqpZ5HCtk7jn/AAny4rGLpps7MsW00i7/AA50DVtcv7XT9QtJoY7LUvHUvEyq6sHVgCe+GUVP/GPW/juqZraBz8PaosA4yPlEinH/ADA10Xpy81Iyanr81xPc2FrbieygLkgF1JIwTjIPArh2sXUl7qV1O7KxeZhkefzuM/zzW2V8Y8fk5fGi55HNvogpIvxGd2PmX/41/wA6sdMkVtC1Ehgf/pX/AOKCq6I7rhOO7J/8UX+dWWlsBoOojHJ+F/rDXMz0iqiZRbr8w/h/+BP8v5Uuf8snPZHH/uzf5UnYEg5HZM/+5/0pVwi4lG1e0nl7XFMPcWR883/E/wDWcf3o4+ZAD23j/wCNf86OWKMTSDaPmdh/78n+dJjiBlHJ/Mvn/vxf51IxC/mhPb/Z/wBLekvCklqodQw8IE5Ge0Y/ypSRAJCctyI/P/dgoNGRCPnbHgnjP+43+VUgaK+80Kwm8Q+AAQHwU+Xt4p/+SP0qLJ0qbedzZXssJViF5P8AiceX/CP1q8kiO5xvb/xB/wD9FObWMhO8/wC0Pl/9cb/OqWWS9zGfj459xKfpy/1p+oYdIku1nV8A+L2wVyOcZ86399YjSLZ7q/uLOGJF3FmLnJ9ABjJrmtrqEWj9ZxXs7OI4kjY7FBY/uxwBUPqvq/UOqLwGZ8RR/LHEnCqPX3PvWsllnJcXSo4YfhsUJc43K9DfUvUs2sz7FAjhXhI0Jxn1OSeaTpd/NbmEzAukThgufeodtaqqZcfOT3qSFwMEVu3WjkhjvbLWS8E13NPGq+HMzMEH5cE5xRo72r+LbkujAhl81qtjleD5UAK+YqcjeKquhAPYe9LsW4sk/tMyW7QvOzRlgy5XzpCuzABTvAOcDvTDRDJbkH/Djv8ASmkeVmAQDd6edTwXsVzfubDo7q+96Ph1O9sYoGlIjjcTxB12knyPnXR/w/8AxM1fqfUXg1G10f4cFEwtuqMNx/MD7ennXK9MzN091DG5+ZYbZhu7g+MAf60OnNb1HpxZTDbQvFIQWWRchsdsEHIpxkl2KUW9I7n+KvUGs9C3tl+zV0e5trkEeHJZDxI8Hueec5/lUvpS6k1/rrU9WcR+Ba2kdvDtQKSWYnJHr5VU9Lf+kDFfCOHW9OiibhfFZcpntyQCR9xXVdH6i03VlUwW0kQkA2v4QMb/AEdcg1tjcW+zOaaXRgP/AEg2u5tC0bSLMbprmcnhtvAXsT6HNc6HR/Udj0W1jYO95JHMt5f+BclmgUAqsSAckc5b6duK7p1x17oHRMUZ1hvFnkGYYFhDsee/sK53afjZpP7afUZbYR2yxMirbRHI7n5u2cnH0qcyjf3DxuVfacw/EDVNRj1/bb6pqEKGztW8OO4dV5gTPAPBrJyajdSqVk1O/fxAUdXnb5lPcHnkVp/xTmOodXNehPB+Js7afw1/h3Rg4rKqkagHcGbzBHBFZ8ki3BvYkwxquFJAx78U2Snh4ZwCD8pxnd96dE8UbfNuxnA9qQ5gUkJ8yn8647D1FJu9hHWho+G6ZyAR6DNJMA25UAueQAeaEqJDuKjI8iDxTxVJbbxllTxU7DODQm0DS9yIsJYkKcU2yEMQwwR3p5JlAG8Zzw2PX1pUkuIgrqGA7ODk1ryMuIVldzWkweCRkPY4OMj0rc63d9O3mkaXNod1fR6jJlb21mJYIw7MreYPpWAYY58vI0uKd7dw0bfN5N5ihq0CdMuJ7i4lJEc0gKt2DfrUq1vJhIx3PgZAIPGKgW19HOpjC4lzntyalLFLgqEZeCQCprFqns3UtWjYW2mdXeFeG0OoxPcLBcI2SN8RUqT35GcfrVx05o3XVrqkS3hu5kW3fwobiTKFthCKVJ4GRiuidOqGselZy3M1j4DD1wquM/dTV7eQKdVtXPJAHP8Azf8AWsp400zWORqjAG4/EZbbxD09pMUWMFjgjjv/AB0xq/VmsaXd+Eyae15hFZZEMafMOTvzyo5G7jHauh2W600a9sHuEnV2eUOeCuckL/as/wBWW+j3lhZwXF9b22oN4vwm7DF9pJKkc5HsfPmsp+PjSTLjlk9FFoOoahd69eO8EcJhitwUbGUOGyRjdlSOefIg1rr/AEyPWNOmTC73XK7+ykg4/L+vFYDpSS8NgVtpYYZsptkeQsvhqDlT5leeBxg1sdG1W4tYnDzWjDIAHOEIHzHucjOcVhDyseGVPo1yYJZFfuWem6RNbaLb2rzMkqQIjFeQCFAJGfKqvTLSRZDvfP8AqVvgsAfySd/rVlH1RErxh2gJkycZ5x5UykkMu8RO4Zodi4Q4/Nn09/5V0rzcEnxizmfi5Y7aMdHaTL+IHUMCorGaK44PHeEGsRcaPNFmSe2ZHbABhO7GB6ef0rdXMF7/AOsDU53tZvhZ4nRZtvyuTDgfqaqNL6Z6hDsnwF46xkfPG2P71z+VNP8AKdPjRaVMxdx0qtyy3VsUeVTnawKkfanorx9OiWBLY23h8+IQWB9QVPlW5tJbSSaWCdmE6tjw5VDD6E0rUbewkdY5Y0xxko/+dcfr5F3tHQsUe0cjmvxBeyPpcXhTuCyhcbQB3x+prTad1bavpyrd20jokBkFxC3zK3bHqQfLNWuodKRSq8tl4crDJX5hk+XYjH86pIOkLqC4dlsLu28RXJdF+Viqk4wOCTit1mhlX3Iy9OcHaZaaRcePpz3DT+MrnlJCPEjyff2xmmdWsrW/t7Zbq3cx7hiSMY3jHmc/94pi200Qq73Ed2vGS7YBH1yP6Vc+GnhpdHVpLPLJEi7V2PgZGV88VMUuTaZcnapmX1yxsW01ILCdXfeNolJX1PJPORk1otR1fTpOl7ISanFJNFhvH8MnBHmAP8WMU9caZaXkhuntLeNkLCGWBvEDFeSGAzwfQ+vFZbVNJl6p0S2m0OKJktAqyBG2btueDkDsSTW8JX29GU4dtE/R7468XuLO6htc/MyTPtAJ88nyqxuunNZElk90sFubgExKXUCcDPOSeeQOawdjrl5oubSW1kDbyyuo7+RPHetdbX0U01nPqkyTQ+CzGIMQYhnAG7yB7/WrlFR6IhJvTGhp93bMY7q0G2VwvicFQ3fBop9BMb3MkcksHgru2HGG9TjPan4b34vVILS4t4ba0uFdg00ucqBwpU4A586dcWVmZ31V1g8JiEnhBY7cYBJHlmsbdm2qMwvgQxTNcQfExhidzHDDPb7fapCX8d9D4cKnc4VtufyDOMew7VdiaxS0/aUlxaAzrlBJuw5HBIbGCfY4rQW8dg1st3YWunzbthnjVljkVexJUeYJ5olOvYIq+mZVZpU6fgljlcyxX0qqyk7lyiHGa1PT/WEcMBW/KKWUhHlHhljjj5+364+tFrHT89vptymkGCVxcx3GwqRu3Jzjn1XOKpH6ri6YsjDq8McoRi0avgiQnkhF5+X6003JpwVi6T5Oi5vL+WR2to7qOe7VdgEhHz5Bz8w4zjHPvTN7rcllcOZ7PZIkvLbQQwPfHHIz51zGT8Q5I5pzp+lWdlBK5bYi849CfT2pxvxHu3EIaEBYjnaBlW+ozyK6vws+0c34uHTO36X1LpV58NDeQSwtCNx+Tdv54Jasv1ar6vqLwjTbae22kKs0T4XLNjkdj9Kw3/rUkkjML2EHgsvKJHsOc5zkHPpXSvw41XV+tbkz2uiiC0GwTXk0zrENoIOB/Efp96pYMvuS8+M59fdBamsf7zR1jQMELeLKwA5BJGDxxUB7K50GQ2Xw6QFJWQwySEunb27HPH0r0NqdvLp1rc3EEcN5YzJtW7hlJCHkHI5xz9q88ate30+rTT3iMkm8hGljJIX0DeY9KtZJRdMh4Yy2h3TtYh0/UNmrWYmsJSVeJeHQf4gR2Oea6n0xf2Oh6Jdw2epSzWDyNNbzBhtQFRw3uGHeubdFdOr1Hr0sD3ngM1vJObgLv2bR6H1qy6LQNrFxYOTHbXkckOMZMaheH9Oc5rKeZOTSe0XHC4pclpnV4+sHgh3z2N5M+3gwZkV/POQwx98VV3X4i2VzdQb9J1eOWB2R82z4AIweRIOM4865P+JttfaD1HNLbXIe31AAokDscKqhcNjjdkZ4qHoWsNPpazSXNzLqGnuzmBmZvHQsgCkeeF3n1FWoyatMXKN8aOuv15pUmpJdzaXqE8SoYxugkY557h2bjkdu/NRdV6z027vLe8sdCvrfY6mQi32PtAYEAef5h6dq57NrcUN+jfsrU/g5yilpoXAPzufPvlWTt6Clwz2HiOJNL1I7rcIN8LgeICM4z3OM9vSlUh3A3PUPU9trNhDbw2WpLMk4mZpIiisQB6A+nI96jaV1SNHsGt7jp6W8V55HDiVk2Zx3A8uK5rZ6zY2en2DS2sk8ishuC6k/wOCOfLJQ0m+1K1jN2x0cyWbTymCdc42+IjY+gG5f+ej05N7F6kaOn2fWMk981x/ouEhZRGim8fAweWDA4zVN1pZt1vf23+rNYRW6tHsFzvBY85Bb9K5skWm+NHMss0cRheVSR8qyAHaox3521a6tqMsZD31kbe8lEE6+EcKy7SGOFbA3HFU4yT0xcoNfciQfw9VYkkZLpicAqs0Wc57UX/q+RjmJZl5IYSXEYOPT60dz1PpMUxSPT55bYXBfeSWWQAswU5PqV/SmDe6M1osklqVnu5GIZ1J8JPG4GfMbCR59qpep7slrH7IXD07d6a0q2kcADjBE13EdwH3FQ5tT1DTJlkhkihnRs7kcA5Axx9uKZv7ZdQSS5sbFgWn3eHGN6hQAMj0ydx5qrEKW+owW946QlSqu35guc5J/UVcYqX5tmcpNfl0a3TPxA6glhktJIbe+hCbpAzEkAnGc54wWHNTkvLW/v3uZ7Wzimt2SG43F8pIcKOM4IDH9AawdpaXk0Mps2YfI3ibWxlQf5iit99tcok3ieFcBRKTnDc5xn61LxR/tLjll7nQrrRTHZyXm3TWMe9mhbxCxCZJ/i9MH71HgjkiktVhsbL/XVV0ZHcAKwGCRn1YCk3nTTW0MF1F+73oVEoMm8hht2EEc+n0NV9jpGsXM72wlV5o0WJYnY4QKR8uMZH5RzWKpo2baZYPKNOnknjXTlntmUsEidmXKF14zzkDv71A1LrHUT4r2/gPHbsAzNaKoXJIHf1wKel0+ytr9mv8ARdVlbnxWimbII4GD2Kj7VC63/ZkFvpkOkWTwTykySGeJhMx8sknDD/KqgoOS0RKUq0ydo3UT2oki1RLOPxYGmt5Y0QbDt4B4xz5VeQdXWdtFcW1vqJdoUd4mWNG5/eYHCdvljP3NZzo/RbLfqjakzS2yQoIGVdxL+IoH7sHJHJrV28PQsQe4l0UbrNv3tk0TqZXYbNu3d+bnOMjkUOEG2NZJpJFRL1jYukzpqoMiKxQ/DRjccf8AB5n+tS73WbVhElvq04nltnuFVoY+CIyQMbeMkVR2Nn0fFeNItlqtx4L7nhaBCqjdjaw358wPWtKvS3Rd1cW019f3PxE9pvjtj4kM0pDNuZjgjkArjPlQ1FCUmyn1LqfAvktNZulNqsjEqilXHiL4fO3g7S36VhJ9Wu5Z3IuXw2SSD3ya6hL07+HnUcFrJZXU+kqu6ERx2zyGZuDnd3bHNcy6h0+103WZbSyuPibdGxHKARvGe+DyPpW+NrZhkd0za6z01BB1XZWkHiLZS2vjyqHwAyKd5GeO4DY5xms31rpEen6xbw2LIyPZQPvT8rkxjcwz3BOa2Ot6hM95razOoSx08m35wUNxHCrA/Xn+dUPWFtFJbdMXCks8+lIHDE4GzIHb2rDDJ8kjfLFcXRjxa3iIJmjZlY7VJPY/501ItwCwdZM5y2c9/U1bmKGHZIbVSwTxM7z/AHqbc6zb3bM95au8igDjHbOK7adnFaozey4MfjfNsXA3+npRx289yC24nJ7se9X63GnpO8dxaBh/CzRf5Gkm7sVnytqWjAwVUbeTwDTaYJk7ovTs3t1HHdK7Pp0gJOQYHyCSB57cA8etXur2dvF19qeoWZ+Jk+HaZVjQ8XTLsPA7Ddub2FQ+nXg03VbtH094J7ewumYykEGRQ3Ix9B29KfjnabQH1tpkhvb3VEuWgQYLQ/Mo2+2/P61w5G+TO7GlSX+ZA/EK5urbqsMlwdz2NvEzI2f/AAlDAfcVmZNUnn/dTXUjc5+ZzknJP9Sf1rafiXbRJH07eqmHutOhMhPmQuB/KqbT7jFjbr8PuCKTnA559638eKnBHP5EnGTKOS9mZ/mmueOx3kjy/wAh+lKi1CWJ7dpmkmiMgmKlzyR6ny4qTqepoN0Qhj3bgxKqBj24qveZXi3NjsAoBrX00ZqbLgappZnQvFfMkcjkN42CyE/Lkf4lHGc84qX03eqesLSSOe5voSWXJXDFNhHYnvzWUDHOfY1ddEyiLq3Q3Izi6QY+px/es5wSi2XDI21Zoer7e+0qPTNXaRZLlrX4K6YHILquEf2LJgfVTWcs+pEtLnx0tWjJJEkccrBHBHf1DBsHOe4rSW1zaale6j0xsdopIGS2JYk/ERFmjby7gsuPeufyHa+cYPpUYlyVSNMsuLtFnYy2aXMZuZS6OpDsckqcYB4PcUKqy7Mc7sewFCtfTv3Mo5a9j1Z/pppk9msD6TCBGghFwkQaVcccbgQfTNV2sT9PS6W7bNRlufyMflXAI4JIPH371V6eoe1likvNKV0w0okvUQoQPc5P86Xe6mllMYmg06eQoEMsNwrZ3f4tpzj0+1eH6maW8kdHsqMFqD2UWtXdoentRWzeWSKSEOobA8MHIK+/zDPHrWg064gtb4QIkxeSJBxhwWAJHfkHnyrOa9bouiauDbjDwBx8uXQqx7n0wfSriJLm21Zb2NmWGOOJjuJfG5MZHHrita+wi6yf5E97+C0lna/ifwpJXbMS8oOR2+2c03ctGiwgHwmQcD7jz+nlUSS5CqskxxE6KzyMMqG2NnOe2TiqO/6os7tYpdPMyPwpNwQNjZy38u1QsLn0i3ljDcmaS4vZbX/WrZl2q4csX5A7Ej+tP/tXwtQsZt4mjaaRml77wAD/AGrnVtqM63Evi3asZDkBm4ODn+YqXa9Sw2UaxCFflySRJ+Zic5/mar8JkS6J/F42+zrV/e2F/pv7Ng3JPBAxj5OSMYJPkQT3FZ9ntZtCur557OMJtik8SPwyzquDgH6HFZCL8QDZlzFboWfcGLNng+XasrqN5d6sscdzfO0cZPhxgcKCc49+fWrw+HN/nM8vlwX5dm7l636at5IJI72Sbaikosb8NjGe1Kvev+l2giiW82uCGOIXzyOcnHOK5odNt1CnxXbd5Acg+hoCztR3d/oTXZ+Cx/JzfjZ/Bvbrr/p2ZH/1uRmIA/8Apdv5elPDrrph7YotxIZPlGBbu2RnLZ9eAK558NaA8pIfvTyRWSAOizpIM8q+BR+Cx/qL8bk/Q3o686XWdBBdTW6KAeIHKk5+manxfjDpKSMGupWjYgkm03g/ZhkVy829rnPhsQf97tQ8G1HHgn/zUl4ONdNg/Mm+0jrkv4r9Fzus3gBpU5UpZtGO3t/1pB/GXpu6X4eZb1Ywp2TiMs6cY44rk6w2oGPA/wDeNL8G2AJS3UgDONxyab8PG+2xLy5rqjrifi90tA0ey8v5l8JklR7ZsNkedVN/+KWhHVbCSwuryGzxi4WS1LFAMY2g9/bniuSXsT5M1qCYj5A5xRafqaxP4VxCjg+bDkUl9PxfqD87Idg1n8YOnvDhNjbTXjiVt/jW+zahHBB9af078Zem7exEbQX6ysdzbIexI58+RXM/GhVQFt4SO+4Ck/EuG+UIB6BRS/A4h/jchvdJ/F61sNUkkeG5ayLEqqW3zN/P+tT7n8atL+GkkXRbx5S2DG8YRWU98kZ5+1cy+LmyfmH6Ul7iV1Kl+/tmmvDxfBL8vIbyx/GmxsTHbW/T9xBZByWVJQWHnxwP0NWUv409OzhWfTtUVueVjUFfoQ1cekVojzzTZYmqfg4n7C/GZF7l91F1La6p1jPrVvBd/DybAFlxvGF284ppOooEkjf4e4O0qcYHkU/+0P61TZAGQOaAye54rdYIUl8Ew8vJG6Zd2Ospc3EFutvLklVycYGBHz/7hqy0TqBp7u+1AQuGtreWYnIwSVKAD7uP0rOWDeGZ5l48KJiPqflH9astMja36Yvpl3eLeXMVpFtGSduXIH320niii/xmV+51n8ModM6n6fS4ug0A08NFMjOVG0fMJGPptPOPMGswn4k3mm61d6508rWllayhLaKVt6yDsSQT/EMZ+vFN9TO34f8ARsPTcbkazq6Lcai+eYoTysXtnuR6fWsjqBlhsLHTlJaXIbaBzk9h+p/lVOPsYKbu/k9dWPVUHW3R0sjx/C3M1uweBj3JiydvqMH7V5q1q5toujdFu7PT3zZym3mJk/MzMHBweADsPb3ru/QNpGdKHjACW2niGD3DMqJ9vMVyzqbTLK50GPS7KSNnktZomRfK5hYyofclVlT249ajN93Fs1wTcbcTmMPU0ts0LxWjB4sEEP5gKB/8NXmr6ikeutFDblbd8SQkt+aOVGI/TxCPtWNAGCe48vet30boM3U9/oc4geSGKUWs5xnDKSyD2yOPtVelEX4vLd2dQ6m1u56E/DLT0MLyNczLMxzkAKSSmf8Ai2/auN9Qaw+n63eQJZhohOXjbf8AmRjvU/8Alauo/ipdR6nLrHTEbF10qwSW3BPJeFt0h488OR/yVyLX83Nho+pdzLbfDyH/AH4jt/8AhKU5Y4y2ycefJDpjMfUcqOj/AAYO0qcGTvjYf/kfzq40XVbqfQNaljtgotYoGcbgdw3oo/morJHOcVrumYy3Q/VzoCWC2mcDsvi81LxR+DVeXl+SmbqOZoygsxypH+09iP7/AMqEnUkzl/8AUk+fd3k7Z8T/AP2fyqsxRHin6Ufgn8Xl+S3bqad5N/waZLZ/2nuT/c0E6kuUZW+DjyNp/P3wUP8A/D/nVUO1Hnij0ofA/wAZm/xFl/pHchFT4SP5Aoz4nfCoPT/cFE3Ul0y7fg4h8pX857EMP/lfyqtBoYo9KPwL8Xl/xFm3U9yzsfgouSx/OfPxP/8AYf0pS9R3gAY2kPLbvzn/ABZqrC4pwLkZ8qPSh8B+Lzf4iLexz38zTuAHIVSVPkAAP5Ckw6cYT3VuO+am5x7VcdN9Jav1VcGPT7cmFTiS5fiOL6mr0lRhbbv3KSK3mklWKOMO7HAC8mtwPwg139k/FTmGC+lHiQ2LsBK8fmceR9q69+Gv4VWOlKt1bRu9wGw+oXMXJ9RCp8v96tD1L0b1Db3i6noWpmfw02G0uIw6OuckMP4j7ggis3FtWkbRyNds8l3llcWFwYLmF4ZV7o4wabhmaBtw7eY8q9AarFo3Vc/7P6n09dJveUUucBmOMeHKePX5X5571zzrj8Lb/QlhfTbWS4iigzcMoO4ks2CR9MDjjipTNW1JVIr+m7npm5tL060l00wQfC+ECAH/AN7H/fNOK3SrTBjDKuP48uc/XFUdvHFZa8GnspHs1QeJCjbdxKA8+nNKunh1G5VLa0h0+MkKPCYkjnuzH/Kt4TpVSOLJjt2pNfsdc6R6C6R6ttZE0u+u5JbiICaLDqMqQTjK+RAqo6t6V6N6V3ac9zqn7QVlLW8iuAo/xH5QcY7EZq9/C+4vuiriH4kw3cMasA1q29/DbluOM+tXvX/4Z9QfiDqseuftXSPCKrBEsbM2FySMkDvzk+h4q7X+ENv3f8nH7VtAa5jitbe5EpcbcytgtnjvXqXpewWwsdOtBHs8OJSy5zhsZP8AM1yrRP8A0etb07V7K7u9RsJoIJVkdQxyQPTK126zs3hn8R9u0DgA9q0W91RmouP9zf7nBf8A0lxJca7pwidN8UG0g9+STXH7OW+Vpw3w0iiJvlBJ/pXpL8UPwq1nrrVxd2V3Z28KgD96TlhtAwcA+9cp6o/C266WZtPv+oNHguZ4fESPe6ZXPrtwM4xzWE4ptuSNoykvysznXk00l3pk7W/gsdMtF2y8M2IwMjHcHHFZSXx2OdqKp7YeurdQ9OXvVfQ/SOrWi24vo7WWExySBVeOMDCrnu3c9/Oub6bYXGrTTQRzxBoreS4IIwCEUsQPfAqVGPsNykVMks7YUrnHb5s0548xjA8JPl7HOCKu9G6P13XnX4CxldH4EjLtQfc/2rpugfgG6Itz1BfLDFxxnw1P3PzH7AVnPNCOls1x4MktvS/U4xFFPPIIYrVpnfsiEkn6AVtOnfwf6l6gOTZCyQ85kJZ8f8K5P64rtulaH0z07C0ej6WLuRSVZ8eGm4ev8TfrTHUcGpdR2ptPi57G3JX9xAQkRHnkKAf51zT8i+tf/fwdcPFjH8zv/T/2cY1b8J+otJllU2XxIUf+Cckj3U4NZOa2ksZDDLHJEwPzRyIVP6Gu6LZdb9NxIlhqzajaDjwLsC5RckDAD/OP+U0a9YWFy8S9SdMSQSrgiexImCEjv4UmHH2JqVmfzf8AoaPxovaX+5wbMZQ7VJ9UHn9Peie1YsGhjkdT/uHI+or0fZnTtcyOnNdsJpM7vhnRUmX22OA36ZqSbS/sXK3dzewyAE7fAAHt7/yqX5c4dxBeDCfUzzUNMvdwaK0uznnIibI/lWm0/VtZtYt1xpeSvDXM8DjC9uSK7lbG4k3quvXjf7TG3Zxhhg9vSsLq+vdT3kDW51GKaBgUlgl24fn6fepflLLpxB+I8O+T/gzfT3UbalqMVxd6hFDaq5Vo0LAFSpBwP4e/f1qbqKzX2rgaVrouYkQHwhc/M7A88Z48qixdJWTwsJLK1BYAAJKy4PnzST0DpUUkUiRSwEHLKsxYH+VZuMX0x3L3ReWdzcmFxM0kci8eE5LYx9aq9WdJpEknggn2sBnYCR/PirDR7abS5jPPcT3kZUoY5QpAB98ZqsvbF5HZrdQYwcBIgFI5zyS1YejJSs1U1RM0jW7nSvFjtg0byNtUEBti45Cg+VOQdUarDHD4uo3EcaAARCBNpGeB+XP3puHS9wWTO5wgG19vyn6qc1PSyTuIpOOwVzx7diap403sObIh6r1ie9M8WpSo7HdECoIAz2GBzjj3qcPxD1yOOeGfV5N5jZIio2+G/k3fkd6hxaXHb3KXUdtdHY+WidiVk+vyA4qG+gQPOpNhfPKclQrqCw78cc4FV6aXQcn7oPUde1i6jE02qXICBQGidgQPPJ86jWfV19a2N1bPqOpbmeMgi4bJOTnBHbyzTzWGfERLPUlV8qF8VQD78ioUeixRMzLY6g4zgrJMmD79u9WooTYmXXIQrTtOwLsdxblvr704mu291GhT5jjBk24JzTc+k2zqFexvB82AfHX5s8k/lpFroMMY3R2VyFD4bNwvp5fLQ8UWheq7L6y1m3dQRdLuJ2qgH5sVYaV1FFfTQ/IWjEjN4pOxRhWyM9v1qlttBRzGRZlSnzKDN5/p/epXg2kMfw2DGF3boQjMC3uPvWHoJOzT1LRfWupW9zOy2skchPzfu51YAfSkapaPDC7LZyOrsrAowByAQSR2x2rKXdvbaBGlwlvKwYb0ViUKc+YzuAPP6VFudet5BBP4kpMsZBkDuwRs47Z7irh4sX+UylnkvzFxDLbXWZd72z42sGjAz7ZBppf2fp5C2s0tlI5P+wcoH+x4qNbXN9c2TfCyi4dRubKnPHnioktz1fdqUiNoMdykRYj/AM3FEfDmnqRP4qFW0WLWWm6iJUurgLcghVaUKpYE+bKPm+vvULX9LslTMLpLN4kchTPy4HdeB5+vaoGn9JXc8rz3zvI8n53Kj5T7KO1TW6LiKlGlvVz/AISe30rqWKMa2YPNKV1Es7STS9RSSC+ZV8YYXx25U5/+btVEei4ZJTp6ap4SSA75VkYRAZ7cnJ8qrJOkdZjunaOR1QcDdLy/uMD+VS9P0fU0dWmkuMBvmwf++Kr0o/2zJ9aT7gbmCOwvNOTpuG2t5jaQKWW1bccgjjJwPm+tYuTpG7tL2e5e6kEKrlNhOcnsCO4+tSFu59OM19qV6tlaI2FRiDJJjsffPtWO6l61uNXZoLJGtbXzy2ZJP+I+ntTx+O2/zEz8he8S91frZNEtzZ6XdzXNyWV5JHbKowBB5/yrCXt9c6jctc3czzTMcl3OTTAHFHXdjxRgtHJPLKb2FgelOQW8tzKsUMbSSOdqogySfQCrzpLojWutL4WulWrOAf3kzcRxD/eP9q7Rpmk9LfhDBiBE1nqMqd0rflhOO3+6PYcn2pzyKKuRWDx55pcIK2Z/or8F7TS7Rde68mW1tl+aOwz87+eGxz/yj71ddVddzavYrpGkRtpOkbCixQ/I7KCByR2HsKz+sa7qGu3zXOo3LSyYcKOyIMdlXyphCpZF9FYf0Nebl8uUnUdI+s8L6Pjwrlk2/wDQg9P9TdT/AIe3Hj6RcG4sGO6S0ly0bAkjkfwn3Fb/AEy/6a/FBlfS706HrIRvE0yc5hmJGMqDxwfT9KxbjaVxzwB/75qouNBjuCs1uzW1wm1ldSRzn25H1FPH5CepmPlfSP78H8GumttR6NuRFqS29hdTQPDNsCoJUOQceuaidPahp+gCSSxvbWCIKF8OSYOSB6ZOR9M1J0D8Vri0hj0Pr+wGq6efljvCgaaIds5/iHv3+tW3U/SV7fWUOsdEXljqWklSzKsMblP+JSMj3x+laPEnfHdniycoOp6aMT+IeqTz2GkvBriT+FK8ngwyDEUm5iHAB4OMDPtVH0as0+tS3CzSiWGKeRZI5Sjo2wneCOTg/MfbNI1/SP2bpcRaKxMhlwZYWJkHB+U+WK1H4a2FtPbNefDPJNAk8TYHyndCwAJzkE4IH1q5VHHoyinKey21eK+vL/StR/0isrXS3WCZbS41BgsuzhyiZI27kOO2M4qLp8+p6b44uer9MuYZpbho8X/i+EXRghIOCACR+X1p6G+suo/w3Fmwh+I0+dYBK64KBhuRuOwO1gfcmor2nTcVg9vZ21skkkTRvKZsvyO+MGoU1VMtwd2jL2XTllMDcajq1nKVYnwVuAu4BlwcZ8/m+wqq11I421A2l3KlmZpIYIopAyMu4dxnscZz7Cpmox2VtpMVnDdwyrB4i5Rh4jB2U8/Qr/OqOO3NxcLa25Mm9/DjU9yScD710Qfuc0lujSaDZ6ZaaDEmt3zQRanIs0PhQGSUCNiMcnAUsfvj2p/8SLJJ+qbxbC3to1WQglWSPPYjK54I5586puo545NcisoWBt9ORbSMjz2Z3H7sSam/iHKf9KtTgaRiPifFGD23ItRBNzT+TSbSjS9iD8JIvSjWZe3Fwb/xQhmQEp4eM9/UUV7ZzXGjaPCJIDLBFMrr4yZTdKWHn6HNVD+G8KRl2BUk7sU9LfLJbwQEAeCX+cDBYMc8/TFdDRzpmn6PvG0W2vLe7a2WORSUIkUnJ+h+hrJa0AdUlbcjbsEFWyDx61M0jVH0fUodQgRZJITkLIMq3GORUHULhbq9kuBEsYkJbYCSFz9aiMKk5FudxUTQxTXVl0tp15GqRxCa4i8SFsSuCqblYHgrgjH3q2vbWHWeltJtUlga4+G8S3BBErbWZShOcE4BI8/KlalL+xvw90O4tUBMkspkD8hhJHtYf+6P0qjbV9S6et7a28FDFNbh4/EXkBvNT5ex9a5196tfJu3w0/hG40rrFdY6Strm+kRrmzmjtrppGP8ACPkk+6jBPqvvUDWr/TdUv7if9p4kaZvDkyTsTcSCeOePL3qGkqaHrCapJ4IhuoIzqEKkOGilAZLhRwCQ2CRjhgfI1X3fWev9O61dxyNaeOr5JMAZHzyGA9CCCKSxJvRUsvFbNNpd503pmsC8F8yKkYUsikRucckjmqnWtQstf65m1Q3a/s+0WKGOcqSAzAAHHfgljgelZXVuqtR1m5a4urjG8bfDiGxMeyipTXsek6LHYGLN3MFui/mjMeAf+T/4qp4uH7slZeX7IsejLfwZ+p0YPGBp7spwQcCVCGHn75rS9TaxoV/Gt1byiK8S5iM7vbsPiFUg+IGxw4xgg9+/eq1dchtNMlkRv9dvbJ7XxFyGjJA7e2RWI1C61NblkvZJjKDkrK5OfQ89/rVxi3JmUpJRVG16cvNIXqHVrm8vCbS6Lvm3iZ3bEquo7cZxjPlVx1nrWma3erLZyHw4oyEf4Z1LEyMSrDb5gg59c+tcwtdbv7JXW3uDEJFKNsAGR6Uv9vajtwbuUg+9aKDTtEOaceLNLpVzp2k6hbTyXEcKRzq5AhcDuM+XNZvXpLeW/je2nWRNvLKDxyfIio8mpXMihZJmdc5Ac5GaRHm6mhOV/OFP3OM4rWUrWzOMaejptig1leoILmBEm1S2jtY23btsscPiJg+efD+xOKqeplK6D0bK8xEJtJo8+GcpzQ6kuP8ARS20aO1nAu4byad28iyMEHH0zxR9dsJui+mLgSA7nuPmRdqjLZwB5Y7favPhqUWvd/7Ud+T8sk/j/cjXOnWE2J7e4nNntWASPA3mBkgY5Oc1R6jYWwe6aPUQxbIUGFl3c59OKqlE8uFRbhx5YBOal22l6jcZEdjducf+zbiu9z+ThUfglXNvaFY5Xvdh8FQECEnP6etRkECyOrSvGksIG9hko4IOcDuMirY9O6ndWkbrp8/i5CkEYx+tRJej+oS/zafJj13L/nUrLFlvG0SbDVJrm6YS6g0l1OktuEKkqBJnJH1J/nUvVYs9Vado8UqKkSQ2kb4woI4Lf+fNPaH0dqVlqVtfOIIxAysY5mBy49ceVaXUOn9Cnufi7uZ4ZSqhglwCoK8g/wB65pv779qN4fk32NdfaJfXei9LIEjVo7XwZd5wUdDyP61z06zLFYLbRlPkyDxyOa6pd9SaJPaW0L3VuZbWXxYpGPiHdnO7nsfbzrnVz0zp0905s9Ulk3kkD4Y8k9wOcVXjcoKmT5HGT5IzBLE8c0BkHJ4xWkj6bJZkKXbFfWIKPryabfpS6BJVlXAJKuygiunmjn4soFcjmrLpuQx9QaY205S5jbPp8wqfbaTdSW/iJHasoHPzDP6Zo4tG1OQiWOHcfVGXiolJNU2XGLu0guoHvdL6xup43BniumkRx6q/B/lTfVMFlc6vdXNgxWCZRPGpXhXYZZPbByM1Mk6f1y7YPJaPM3bJcE/1pD9H64QQ1hcAemAQP0NSklTvoqTbvRmmtnHZoyO/DChWiPSOpqPmt40AGfmB/wAqFV6kfkjhL4Oq6np+m6jBc3NzZxTpncGTCMPvis9FozMGeCK6tdmBETKCzJ5YwO4qRp2oG7uUmtLiOOGRXjK3Qbw+D3OAe33x61oenrR767j02a5sdoIZJ7aQlCfrj+WBXhRhOCpM9tuEt0UFwZtM0rVbaA3U7TWrFy2OARz9fOr5b1Le4WOTfIr28TAxk/MpReG8sg091JY31jpup2o2GKOKVXYsAxUodpAwCwJ4z3FUGtamItPtLS3dRcy2il5M/LbxbRlj7+ldMMcpR4v5MJzjGXL9CH1V1PYX9mUgEosYGBmY8G4cflQVl7O/HUMEkCrHBqSA+GFGFuI++z6jyqm1jUVvZVhgUpaQfLEnr6sfc1BjkeKRZI3KOpDKw7qR2NepixLHGkeZlyvJLky/jlLIM5BHBXzGPI1ImmM4DMAGUBQR5j3omlTW7ZtStkAvYlHxkCj/AGg/9oo/rTMUodQytkGm0JMVRdwe9A980RPpSHY4HRCDndn8ynzpiVPEXG4g+R9KXu8jSTxQIbSQt8r/AJhTlJaMEhj5UFfOQPLvTYDyqDGzBhkfwnzHrSAwAoqH8/agBbDbRAnvnmkhjnaftSgSpxQBHnt2EheGQoG/MB2+tRZ9OIzIGLkc49asyx8+ajm5jU4ZsHyBp2Aq2kVohsJK+/lUgVXXKPBmWM/I/wCYf3p61eZcLLg/4WHmKTQErzoZxQPIzRdhSARLEJUAxz5VXtGyuUAyQe1WhHGaj3EO9SRw39apMTIJGO5yaIUrZtJLct6eVEMntwPM1RJoukum26kS6tIdS02xmJQg30/hBwM8A4NdJ6O6Wg0LR4dY1VIbu00QTT+FAwkFzdu2ERSO+AoJ+tcl0DRpdd1e2023IRp3Cl24CL5sT5ACuo/iLp+rZ0/pfpuylOh6SoAmjZQLmYj5pO/2BpNMtNHPr+/vepuq5rzUWZ7iRzLNu4xjnbjyHYYqTYvELq91242N8GNtpE5/28wIHA8wuSx+lT9M6Q6gMk81xayLNO+3fI6naPU8884/8tTtK6V1A6qJbm3NrbWSiO0R2XB55ZueSe5+tJp0JNNnaehdRWz6Ha7uRhp7i2xk8lj4Z/zrK6f+HZ1TqXXLj434Z7TU5bq32x5y6M3DZ/hIyOPWn0vIZenriye4WOe3lWaBVyRIVA9O3arHqn8RYujdZ1mN9HeWMSPM0kcoVm3CPJxjy8QfpWfkJ8Y0a+O027PPXVWlrpOv3lqg/cB/Fh94nAZD/wCUiurfgbKnT+n3msX7Ktj4q43dhKqsyn+WPvWE1nSJdTtNHu1uY7rbI2nvJGcqUX54znz+RiOexQiuz6PHadD9B6Is8cby6jeRrIHUHwl5LNnyOCB96tPRm+9HNLWWc9bHVtVngiUGX4qMHe7pKpDjA/4jjOOwqm6qj6W0/p2DTtG1m71Kdbn4g+NbiMR5Taw4J9F/SqzqfRzo+v6tp7uuY5GwDnJAOR/Lms9yx7UR6HLsGcitX07cyw9EdVJG5VZBaIw9QZDWVPArS6GN3RfU2P8AHZ//ALxqokzXsKA96UeaPZjmgAsik0rlj2pSrjnGaYglXzJwPWlbdxwvajwT3pe3tSASBgUaqzkKoLEngAcmrjp/pfUupbnwbGAmNeZJm4RB6k13H8PvwjhshHPbr4kwYCS/nTjHOREv6c1Le6RSVnPuifwhuNWaO71tJo4W/wBnYxj9/N9f8I9zXe+mugrbS4IoriCKOFAGSyhGUQ/7x/jP14rSaVo9ppELJbKS5/NK5y7n1JqW5AmRec7Sf6VpHF7yHyrUSFpGrQ6tbNNBbXcCAlAtxCYjxxwD5VPCkHPvUe6tmuZyouZ4F8PcfCbaSc984qqukuLBHmF5qt1HHaeK0cTq0hbPcZHOAO1aXRFErXul9K6ktmh1C1STK434Gfv6/esFf9MdRdIIh0vGq6bCCPh5id8fJPyP3U4OMHK05F+LmhN4JefqFh4OJAIwP3nHP9ak2n4waLb3E22HWZoZACplVWKt5jk9u36VlKEZFKbXuc81bpDQeup5pLQnTdUAy0DYR/8AmTsR/vJkeormHUnSOp9L3Jhu4AyHlZozlGHrXdepOoujuood50nUYLpSWSaIKpU5JBB3cH3FWfT/AETqes6YL6+mgvI7uDZE88I8UJk4344b68H3zWShJMtyi9nnjpm6uLeW7khlnBS0lkQgkBHUZDAZ78VuenfxZjsZbVbpL9iIx411GQkqSZ7qBw64xw3PvW0u/wAEraw1iKZdqpeRywPAGIGWQgMD6AkHH9a491p0zedEaudJubm2upAgZ2iVgFY+RLefnVqLItI9GdMde6nrdr4+mS2HUNop2sVbwLiL2dT5/bHvW+027N/bhntZIGH5o5cEg/VSQa4h+BjW+iaTFbXDFZ9SPjI7n64X7jmuz2FlDcGVp494BAAYnA9a2gmlsltMwP4mfiHqnTaSWGn29pb37uot2dTIZEz8zgDAXHuea5HrF/qeo3AivYZb++uUVY57ogLMdw+Td/CPpj0rt3UWm6hB1JpogvZYNNgEzyoDhZMnIQ+uMnn0xUA9RQLbRJBE0pkguG3ztu/2ef4ex59a582SnTZvhwufSM1ALY9DaL8RsWwEkscyIp+XLKoZfTaT29Cak6H+HfSvTV098YpXuJFkVV2hsgocgH8oBGewqRrqj/1fWcmoXSb/ABWi8TYEV2LblJxwPygVI6OmurzTFsdQtbiKIqUtrqSM7JVIOAG7ZHP1H0rNw5x0aRl6c6YodSrB4aabawWcZKAPjdJtZc/mPb7VTz6hNdMJJ5XkdkiJZ2JOd9NXds+lXfwc/DwtCGPrwcEVGWVVCg9xAhH/AN0rwcmSduMj6XFhgkpRL7Q//qgnP+2f+pqecZ7cfSq/p7MnxgHO2ZiatfCLdsV2YE3jR5fk6ysr7+Tw4Af/AK4v/wAQqIngXccK3EMcwBiwHUHHcU/rgaKFQe3iL/UVWW90FWJcc/uj/wC+RXJ5DqZ3+JDliId70Xo2qDAUxEIpUEbwv7w9s8jv5GkxWnV+ggQ6Xq8tzaorn4a5IuYhhsAbJOV4/wAJqxhu9kO4AYCMP0kqVDdeIJWPBxN/UUoeRKPTLyeMn2in/wBMI4ZXi1/pl4XVipuNMfnj1ik5/wDK1IGidL6++zRteSC7Zs/DXLGGUnvjZLjP2ar+5uIp2ljmiSZNzcSKCPyD1qr1bSNCv4X8aMRJ+bnDKP3XfDdvsRWsfIg+1/BjLx5+zv8Acyd7+H/VGmanGLmaSSyOfEaPKPjyG0nt7qSaytxBdaeZTNo97dsZWdfiS6Oi8/KSDg848vWuidN2uqLd/CdM9RkRBQ7QiYTQhdv8UT7gOeODVnqGuXOnpHD1Do2najE6r++0uQxnk4/2cmUJz6EV1R6tPX6nHOKvj0/0OTWem3NzbMt5Ytb3LRsyyxzqoRwMIO5yOcntVRDoHU8ERkiljllVseHHPxIpB3ck8V2T9m9HaywS11U6Zcv+WC9Btmb2G75G+xqJrP4daxYxia0gguoiAAXfbn3BAII+/NNZHH+3RDxcupHLYY9cgskje0DTKjnDyHOM5AVlbnPPHt3p+e61RtTkf9myraO0ZEcd5+U7cEqSe2eTn0rR6zY3mhwak01pABYqjKXZlSdGHJQkdwTytZ/U+qYbNz4Wnq8LKmJGiIA3c4OT39CM5qo/d0iJLj2xMP7QeXwpJtTjXwJC378nEwY4CHOGXGDz359qZWbXVi8S4jluJIWVA63RRyT/ABY81A4OOas9P1uymtpZbhoLdrZQDKCHWQkMflAI8gOPKp0c2nTxiNrkWc+wShJ4SVWMnhyyk4Xz5FJyr2BRtaZW2V7LLql7bu+oW1ihmNrL8Qp2vtyFbOPkJ7Y5zTC3F3Hdi0KvLaCMStcbiZN7R/lIzyA/3rSxS20VzHbRyWjNMpxt+bGP4wpzlT/TP0pqwuLO7u006eG5tGfeTcIM7W7Y5OMHuBj70ua+B8H8mSh07XZ7Y3N3LNbTRSq8cKD5HUjBO4nj6Y5BNP6bbX+mq7GS0uI5mjLtMG2xtn5kVhnAzgA+9aVtVhttFkiZZRqCsyhNuVBLHkvjkEYx6VG0bXNUttHube7EdzNKzKIg/wC7kTbgbsjBAK5x75zmmpt+wuCVbGnuC66nHZm3jMSl49oZng/xA7j2xnH1HNXWl20Vtb2lrqD23jSovzyAFGwAw3MO24HIJ75I8qwejXmo6tr15cz2tvYkxeA3hQnkYKnHOOR3PbgVqJrQ3VpFa3F3C8EOcRvDtCjOcceWanJCi8eS0ST1HdWEstvLo00i3Mx2SIwfbCcA++QQOD28qobfUTF4tjpe74i3uCU8R2KykkZ7/wC7nj2zVrM86TMxvVc4yxMjhjn0waEb3MM5eO5Zjt4CSEE+nlQmqqiWm3dinaUXNxJHLJFPDlGYHA2AjcFHmQSPTNUl5rtymqPpviyxJCdq3BLYYHucjOB9a0cF0sUhbAMko+Z9yliSM8/L9P0p2PWIlfcot1YMeT4YOT38vOmml7EuEvkonui08Qe+e2lkP7rMvy4GM8jvjPbFFBc38qeHNKb1VZ/mWQJsw2Ac+Q9R71epIkhIjsYJAoLbYvDYj17A8YJpH7Zs4D4nhopCgsQmTyO/5fSlz/QOH6mV0u9ubuK+ur5JI4re5QBWUcJn5gWHpx2B75qHqHUbaU11FeSx3MmPCt4IWwgjOfmY9wRkcVubfVIrOFLa2t3hgILbVi4G7zAI88/zphZ9MnlAihhldjuKNAoJbzPbvitY5Yp7RnLFKqUjj93d3mqEzS73SPCjap2RDyHHapOoaXFbaTpN3F4rS3iStIDyBtfaMV2BLuJosW0CW0Z4xGuwt9QD/WmfAtFl2QrcgegIPJPYCtX5ddIzXh32zi620xBPgy4Hc7Diuo9CfgndahbDW+qpf2To6DxNsh2ySj7/AJQf19BV7EbWwuYLhPiA65Ybo43BIODnjyz51N1XW59Zhijv5/iYFXcisq7Rn0Cnv/Oj8Za6HHw0pLk9D2qdbW1jZfsTo61Gm6dGChnRdskvHcemfU81kpoxsc4JYljyeTwOauhDaRShysEeBk7VBHI+pH60t7bS4mMbDew/wSbg3HqB6VxTlObtn0PjeX42CPHHGv8AczjqxlzjHDf/AAinIzhgQMnB4/5RVwp0oSSBrYgxkBQZM7s8eXap9hLYRTFRYwh4+BuHJPY4z34qeLNpfVYVUUZd3zjkcMf/AI6Wrqhx/ujH/mNbCHUdPkuFjWzijZuDGEBK+/6g/pQ1PX7SykeD4KIMu4g+AHyAf+vapr2HH6jy1GBi7yOKe38OZVZSozn/AIjUTRrjXejb9tQ6ZvHj+Y+JbHlJRuxgr5/1rTXGoCOL57OxkDIdw8DbtORn0/xCq0zlnM6KkTrkr4Q24IYEEe9aY8sodFZMMPKx/fEu5LrpX8YLUWFwV6Z6mDFgCv7i4ft/35/Wm+mOl9a6Fkv9O1e0ETPKjRTA7o5R4cwypH/z80x0lo1n1F1fZLqELTvN4jM4/MW+bn3Oa0Wg9T30pvOmZ9Tg1C0S4EcLXC/vo13Ecc5PHrXXKcZ42z53P4z8fNwu9HIujL641K26g01W2zXti00QXt4kREg/kHH/ADVkHupmfeXLHzrqPTGiWGl6ta6nZyoz20gMoQsVKZ+ZTz5jIqr178KJ7HUr2K2uS8UczBPlxlM5GD9MVcM+NN2cc8E2lRglnDEB8j3rWaDaLpsyapJKkgs7Nr1kHOxzlY1PuTg1DsujmN06Xs5gjilClnwAyfxdz/SrLVbC+vNA32NrufVrprllQgbYIvljXk+uT9qrJljKop9ix43G5NGTt333YZ8ljuJPvV7+IcwPWN8fMrCf/wBklUtpZS2swkuY2RQCNw5G7B4OK3HUdvo911KDPdxWkxtrcu7qdgzChGef5iqlPjNV8Exjyg1+pzwyAdiT9qJH3NkKzfRa2N7Jo8zx23j2lxmQJ48YYKi+bHPcfpUXUINKi1lksr23bw5NjyEk2zoAMFSfmz7H9apZv0JeJL3M27yQjc0TrngblxT8elXd3t2LGoI7tIMVqrw6eNOuI9un3pYoVmhuCJVA7qVPcfSqe3ksHdoVkFsSSQ3juFUHuoOMkH0NHqtroHjSdWWnVVxNB0v07pkwRI/DMrkHncHkUjPIxij1ya11fpyzg+b4uyWJbUgAGWJl+dCfMqwBHsxprqXWLC+tdMiila7jtIjHKDncxLFgCfPGeDWfmvYXlgaSKWWBVx4TyEZx6kVljg6X+ZrOatr9i/lsb3WdG050tws+lq9pcFm7xk703D05cfaqLUAtyIfFu5C8MYiAZd2xQeFznkDyqTYdR3dnPnSx8GSApCOW3egOc5qHqFreWsgkvYZEab5w5X5Xz6EcVtCMk99GU2n0M2lrD8ZD8RcL4AcFyAe1Sb6Zr25luGxmRiQPQeQ+wwKgrvB4U58uKs9K0TUdVkEFpBLM6jxGSFC7hR3OKtrdszvVCtNuFXVLaS5dvCDANjy8q2d5o1r1dK5FxBbC3gLLcTHGNp9fMHNY+aCK3kaIpLvQkFZRsZfqKHxE4jMImZUHZQcgVMocnaZUZ0qY/d9F3lmjPPe6eiBtoYTjkc847/8Az1WXumR2knhC9t7hh3aA7lH3pTxeI2XJJz3FBkUHgAcdqtJrtktr4GYooo8l4xMfLceB+lTLa9S1ZHjsbMMnZnTcT78mmQgZcZAPvxREZVQAQap0xF+evdVMckUy2M0UpzIJLdWLHOc5I4OeeKdb8Qbsqii1s1iT8qhMhfXA7DNZUMpb5hgDtz3pSlpDsjj3FsAADJqHjiPnL5NjH13A65YGJTnhE5B8qnnqnTwkEpvly4+bh8xn39qoNP6F1nUcG1sw425JZlAH1yal6n0rqPTunzTXFzpZFwixtHvG5BnOQPM8eVc08cW6TOiGSSVtFzBrKXm+RtUsyQc7RJsZx7bv701PJDNA+/VjDyMAgHBPvWRi6fu7wYins48qSrvLtDY7gcVc2HRusanBc3tzJa7UjAYF+eMAdhjHvUvCo7stZ3L2DvdPhigaNNUkmCHsZQMfTmkQQWMtqXnuoSEQZVJATu5xnP8A2KY1Xpm6sIEgl1TTXhlcKpTLYbzG7GOPOrvpHo20trn4m41O3d42z4BjyrjtjJ4ptJRuyU7lVFPAmnW9zummiRSwACOpAH/fnV1HqmnWe6YeDOoGP9opVM9iQCc1rLvpzog+HO+mkhiWGUY8/bgj0qPqPRA6kKygafYWscwJCwYfwx2IK4PPnmoeVPtlrE10jIz9YWhtJmGEncqFYd0/7/SnrrrzT9VWOCdGEY/MEGC/puPmK0XU/TXSerRGwt3tLK6hIZpgwQY9MnvkeRrDv0FNLqbQ6ZPFPbqVIkllRHPHzAYJyB7U4+nJbYpKcXpWX2l6lp0k081pKoWGMySKZAAM8cCl23VlrOzrHdwASkfIVwfQjJH9Kq7r8OLaSJ7uz1XbbEAKAu8KT/ibjAzVtpn4V2bxg3eoTN8u8eEuFK45O49sVDx4nts0WTItJDKavo8dwbZwkDjO6QOpAP09PpTQ6st4xtSWORMgbt+AaZu/wxttVuX/ANHrp7iGJd0u5Thh/uNwGPt/OsrNplpBcyW9oZrtlbarBSrKT/C48iDWkcUH0zKWSa7RtbbqPT7ozFLtbfYMgNKwJ+nODQrM6/0rHo9laySTPJNP+UL/ABN/hFCqWNPpkvI1+ZEqLVBbRSRL4kCqx8NY35U+2f0qdYX0ulxZS4eGafmMJEMtnu2SK2HVnVen6LcTaDPFK+w7n8NUIwRwDuBJ+xFV9742nWa3c+jK6Kqu0m/cuxgCAM/xeXFcc5XFSUTriqk05GeTUL2MT2F3cXNzcSKFiLMTnIwe/bGfvVHruo+FGdNhmMpG0XM2f9owGAo/3RirbqjqB3ke6eCKG+uECosYGYY/Vsd2PrWNP869Dx4UrfZwZp8nS6BQoUK6DEfsL6fTbuO6tm2yIfsw8wR5g1fzRwSwrqliMWsrYmhHe3k8x9PQ1mam6TqsmlXJcJ40Eo2TQntIvp9fQ0mhlrncOO1AjAB9adnt4rYRTW7mWxn5hl8x/un0Ips49T+lQ0NMIgA8UROaMkD1NESDnApDBnjFNsuPmHfzpwEAcCi3e1MAlII/tR0hjt+YAUoS5X8q8+1AAxu4oBiDhvLz9aTk+VDJIwaAHcgimpUWYEOoJ9cUQkIOxu/kfWlbiKAGXiuSPDDxsuPMc01bSSWcnw8/5W5V88Cn3ukVtrsVI7A0zLKtxHkDdGe+O6+9MROyeKOoNndCTMTNll7H1qT4g8j2pNDHRRMKQGz50M0UAzcwBl3A4IqMoIOOPqan5z3rRfh/0enVPUKi5YRaXaKbm+lPZIl5Iz6mmmKi00y0HQXQs+u3I2atriNbaejDDJD/ABy48uOAaw1te37bkjurgjaQBvOSTwKt+t+ov9Kuo57m3DpZRfurSFiSIoV4Ufyz96HTkE1xFNePKixWroIkKjEkxPyjA7gdyfahsEkh7XLi80Gyi0pJ28a4jSSRgxLRqOy5z3JyT9quvw51O0eGXT9QE7DxoxJcP86oXYKoPmDWO1a9a61G4vC5fL7EZjy2ON1W／↓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" },
      { name: "雪景", src: "data:image/jpeg;base64,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／↓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" }
    ];
    const VIEW_MAX = 8;
    const VIEW_KEY = "my-hall-view-v2" + (GID ? ":" + GID : "");
    /* v76：兩個邊廳各自選窗景；預設 西二廳＝漁港、東二廳＝雪景 */
    const VIEW_HALLS = [{ id: "west2", name: "西二廳", tag: "西" }, { id: "east2", name: "東二廳", tag: "東" }];
    const VIEW_DEF_SEL = { west2: 1, east2: 2 };
    const VIEW = { selBy: { ...VIEW_DEF_SEL }, target: "west2", n: 3, names: {}, mat: null, garden: null, texs: [], wides: {}, urls: {}, token: 0, bound: false };
    function viewLoad() {
      try {
        const o = JSON.parse(lsGet(VIEW_KEY) || "{}");
        VIEW.n = Math.min(VIEW_MAX, Math.max(VIEW_DEFAULTS.length, o.n | 0));
        VIEW.names = o.names && typeof o.names === "object" ? o.names : {};
        const sb = o.selBy && typeof o.selBy === "object" ? o.selBy : VIEW_DEF_SEL;
        VIEW_HALLS.forEach(({ id }) => { const v = sb[id] | 0; VIEW.selBy[id] = Number.isInteger(sb[id]) ? Math.min(VIEW.n - 1, Math.max(0, v)) : VIEW_DEF_SEL[id]; });
        if (VIEW_HALLS.some((h) => h.id === o.target)) VIEW.target = o.target;
      } catch {}
    }
    function viewSave() { lsSet(VIEW_KEY, JSON.stringify({ selBy: VIEW.selBy, target: VIEW.target, n: VIEW.n, names: VIEW.names })); }
    const viewId = (i) => imgKey("view:" + i);
    async function viewSrc(i) {
      const blob = await idbGet(viewId(i));
      if (blob) {
        if (VIEW.urls[i]) URL.revokeObjectURL(VIEW.urls[i]);
        return (VIEW.urls[i] = URL.createObjectURL(blob));
      }
      if (VIEW.urls[i]) { URL.revokeObjectURL(VIEW.urls[i]); delete VIEW.urls[i]; }
      return i < VIEW_DEFAULTS.length ? VIEW_DEFAULTS[i].src : null;
    }
    /* 縮圖一律轉成 data URL：file:// 開啟時 Chrome 不讓 CSS 背景讀 blob: 網址 */
    const VIEW_THUMBS = {};
    async function viewThumb(i, src) {
      if (src.startsWith("data:")) return src;
      const k = i + "|" + src;
      if (VIEW_THUMBS[k]) return VIEW_THUMBS[k];
      try {
        const img = await loadImage(src), c = scaleToCanvas(img, 240);
        return (VIEW_THUMBS[k] = c.toDataURL("image/jpeg", 0.8));
      } catch { return null; }
    }
    function viewName(i) { return VIEW.names[i] || (i < VIEW_DEFAULTS.length ? VIEW_DEFAULTS[i].name : ""); }
    const CURTAIN = { w: 18.7 + 6, h: 7.2 + 4.5 };   /* 窗外照片板（比窗大一圈） */
    /* 整排玻璃：照片等比放大填滿 18.7 × 7.2 m，多出的上下（或左右）裁掉；垂直取偏下方（地景為主） */
    function wideTex(src, aspect) {
      const t = src.clone();
      t.wrapS = t.wrapT = THREE.ClampToEdgeWrapping;
      const wallA = CURTAIN.w / CURTAIN.h;
      if (aspect < wallA) {
        const f = wallA / aspect;                          /* 只看得到照片高度的 1/f */
        t.repeat.set(1, 1 / f);
        t.offset.set(0, Math.max(0, Math.min(1 - 1 / f, 0.4 - 0.5 / f)));
      } else {
        const f = aspect / wallA;
        t.repeat.set(1 / f, 1);
        t.offset.set((1 - 1 / f) / 2, 0);
      }
      t.needsUpdate = true;
      return t;
    }
    /* 讀第 i 格的照片成貼圖；空格子回傳 null（用內建花園） */
    async function viewLoadTex(i) {
      const src = await viewSrc(i);
      if (!src) return null;
      try {
        const img = await loadImage(src);
        const w = img.naturalWidth || img.width, h = img.naturalHeight || img.height;
        const tex = colorTex(Math.max(w, h) > Q.texMax ? scaleToCanvas(img, Q.texMax) : img);
        const aspect = w && h ? w / h : 1.6, H = 6.6;
        tex.wrapS = THREE.MirroredRepeatWrapping; tex.wrapT = THREE.ClampToEdgeWrapping;
        tex.repeat.set(36 / (H * aspect), 8 / H);
        tex.offset.set(0, -0.2 / H);
        tex.needsUpdate = true;
        tex.userData = { sky: skyColorOf(img), aspect };
        return tex;
      } catch { return null; }
    }
    function gardenWide() {
      const g = VIEW.garden.clone(); g.repeat.set(CURTAIN.w / 36, CURTAIN.h / 8); g.offset.set(0.2, 0); g.needsUpdate = true; return g;
    }
    async function viewApply() {
      if (!VIEW.mat) return;
      const token = ++VIEW.token;
      const need = [...new Set(VIEW_HALLS.map((h) => VIEW.selBy[h.id]))];
      const loaded = {};
      for (const i of need) loaded[i] = await viewLoadTex(i);
      if (token !== VIEW.token) { Object.values(loaded).forEach((t) => t && t.dispose()); return; }
      VIEW.texs.forEach((t) => t && t.dispose());
      VIEW.texs = Object.values(loaded);
      VIEW_HALLS.forEach(({ id }) => {                /* 各邊廳的整面落地窗 */
        const m = VIEW.wides[id];
        if (!m) return;
        const tex = loaded[VIEW.selBy[id]], old = m.map;
        m.map = tex ? wideTex(tex, tex.userData.aspect) : gardenWide();
        m.needsUpdate = true;
        if (old) old.dispose();
      });
      const cur = loaded[VIEW.selBy[VIEW.target]];     /* 其他窗與高窗天色：跟著目前設定的那一廳 */
      VIEW.mat.map = cur || VIEW.garden;
      VIEW.mat.needsUpdate = true;
      if (VIEW.clere) {
        const old = VIEW.clere.map;
        VIEW.clere.map = makeClereSky(cur ? cur.userData.sky : "#8fbbe3");
        VIEW.clere.needsUpdate = true;
        if (old) old.dispose();
      }
    }
    async function viewRender() {
      const row = $("cover-view");
      if (!row) return;
      row.textContent = "";
      for (let i = 0; i < VIEW.n; i++) {
        const b = document.createElement("div");
        b.className = "view-slot"; b.tabIndex = 0; b.dataset.view = i;
        b.setAttribute("role", "button");
        const src = await viewSrc(i);
        const th = src ? await viewThumb(i, src) : null;
        if (th) b.style.backgroundImage = `url("${th}")`; else if (!src) b.classList.add("empty");
        b.classList.toggle("on", i === VIEW.selBy[VIEW.target]);
        const custom = !!VIEW.names[i] || i >= VIEW_DEFAULTS.length;
        b.title = src ? `${viewName(i)}（雙擊或拖入圖片可更換）` : "點一下選圖，或把圖片拖到這裡";
        b.innerHTML = `<span class="vs-n">${i + 1}</span><span class="vs-name"></span>` + (custom ? `<button type="button" class="vs-x" title="${i < VIEW_DEFAULTS.length ? "還原預設圖" : "刪除這一格"}">×</button>` : "");
        b.querySelector(".vs-name").textContent = src ? viewName(i) : "拖入圖片";
        const tags = VIEW_HALLS.filter((h) => VIEW.selBy[h.id] === i);
        if (tags.length) {                              /* 哪一廳用這張 */
          const t = document.createElement("span"); t.className = "vs-tags";
          tags.forEach((h) => { const e = document.createElement("em"); e.textContent = h.tag; e.title = h.name; if (h.id === VIEW.target) e.className = "cur"; t.appendChild(e); });
          b.appendChild(t);
        }
        row.appendChild(b);
      }
      const add = document.createElement("button");
      add.type = "button"; add.className = "view-add"; add.textContent = "＋"; add.title = "新增一格窗外景色";
      add.hidden = VIEWONLY || VIEW.n >= VIEW_MAX;
      row.appendChild(add);
      document.querySelectorAll("#view-target [data-vt]").forEach((el) => el.classList.toggle("on", el.dataset.vt === VIEW.target));
    }
    function viewSelect(i) {
      VIEW.selBy[VIEW.target] = i; viewSave();
      viewRender();
      viewApply();                                   /* 邊廳的整排玻璃在任何建築風格都看得到 */
    }
    let viewPickFor = -1;
    function viewPick(i) {
      if (VIEWONLY) return;
      viewPickFor = i;
      const inp = $("view-file"); inp.value = ""; inp.click();
    }
    async function viewSet(i, file) {
      if (VIEWONLY) { toast("這是欣賞版，不能更換圖片。", true); return; }
      if (!file || !(/^image\//.test(file.type) || IMG_EXT.test(file.name))) { toast("請拖 JPG、PNG 或 WebP 圖片。", true); return; }
      try {
        const { blob, url } = await normalizeUpload(file);
        URL.revokeObjectURL(url);
        await idbPut(viewId(i), blob);
        VIEW.names[i] = file.name.replace(/\.[^.]+$/, "").slice(0, 24);
        await viewRender();
        viewSelect(i);
        toast(`${(VIEW_HALLS.find((h) => h.id === VIEW.target) || {}).name || ""}窗外景色 ${i + 1}：「${VIEW.names[i]}」`);
      } catch (err) { toast("圖片讀取失敗，請換一張試試。", true); }
    }
    async function viewClear(i) {
      await idbDel(viewId(i));
      delete VIEW.names[i];
      if (i >= VIEW_DEFAULTS.length) {                /* 新增的格子：刪掉後面的往前補 */
        for (let k = i + 1; k < VIEW.n; k++) {
          const b = await idbGet(viewId(k));
          if (b) await idbPut(viewId(k - 1), b); else await idbDel(viewId(k - 1));
          if (VIEW.names[k]) VIEW.names[k - 1] = VIEW.names[k]; else delete VIEW.names[k - 1];
        }
        await idbDel(viewId(VIEW.n - 1)); delete VIEW.names[VIEW.n - 1];
        VIEW.n--;
        VIEW_HALLS.forEach(({ id }) => {
          if (VIEW.selBy[id] === i) VIEW.selBy[id] = VIEW_DEF_SEL[id]; else if (VIEW.selBy[id] > i) VIEW.selBy[id]--;
        });
      }
      viewSave();
      await viewRender();
      viewApply();
    }
    function viewBind() {
      if (VIEW.bound) return;
      VIEW.bound = true;
      const row = $("cover-view"), inp = $("view-file");
      if (!row) return;
      const slotOf = (e) => e.target.closest(".view-slot");
      const vt = $("view-target");
      if (vt) vt.addEventListener("click", (e) => {
        const b = e.target.closest("[data-vt]");
        if (!b) return;
        e.stopPropagation();
        VIEW.target = b.dataset.vt; viewSave(); viewRender(); viewApply();
      });
      row.addEventListener("click", (e) => {
        e.stopPropagation();
        if (e.target.closest(".view-add")) {
          if (VIEW.n >= VIEW_MAX) return;
          VIEW.n++; viewSave();
          viewRender().then(() => viewPick(VIEW.n - 1));
          return;
        }
        const s = slotOf(e);
        if (!s) return;
        const i = +s.dataset.view;
        if (e.target.closest(".vs-x")) { viewClear(i); return; }
        if (s.classList.contains("empty")) viewPick(i); else viewSelect(i);
      });
      row.addEventListener("dblclick", (e) => { const s = slotOf(e); if (s) { e.stopPropagation(); viewPick(+s.dataset.view); } });
      row.addEventListener("keydown", (e) => {
        const s = slotOf(e);
        if (s && (e.key === "Enter" || e.key === " ")) { e.preventDefault(); s.click(); }
      });
      row.addEventListener("dragover", (e) => {
        const s = slotOf(e);
        if (!s || VIEWONLY) return;
        e.preventDefault(); e.stopPropagation();
        e.dataTransfer.dropEffect = "copy";
        row.querySelectorAll(".hot").forEach((el) => el !== s && el.classList.remove("hot"));
        s.classList.add("hot");
        dzTip(`放開 → 設為窗外景色 ${+s.dataset.view + 1}`);
      });
      row.addEventListener("dragleave", (e) => { const s = slotOf(e); if (s && !s.contains(e.relatedTarget)) s.classList.remove("hot"); });
      row.addEventListener("drop", (e) => {
        const s = slotOf(e);
        if (!s) return;                                  /* 沒落在格子上 → 交給原本的拖放（匯入畫作） */
        e.preventDefault(); e.stopPropagation();
        s.classList.remove("hot");
        dzShow(false);
        const f = Array.from((e.dataTransfer && e.dataTransfer.files) || []).find((x) => /^image\//.test(x.type) || IMG_EXT.test(x.name));
        viewSet(+s.dataset.view, f);
      });
      inp.addEventListener("change", () => {
        const f = inp.files && inp.files[0];
        if (f && viewPickFor >= 0) viewSet(viewPickFor, f);
        else if (!f && viewPickFor >= VIEW_DEFAULTS.length && !VIEW.names[viewPickFor]) viewRender();
      });
    }
    /* 首頁「外型」：切換或調弧度 → 記住並重新載入（建築要重新搭） */
    function shapeUI() {
      const seg = $("cover-shape"), rng = $("arc-deg"), val = $("arc-deg-v"), wrap = $("arc-deg-wrap");
      if (!seg || seg.dataset.bound) return;
      seg.dataset.bound = "1";
      const sync = () => {
        seg.querySelectorAll("[data-shape]").forEach((b) => b.classList.toggle("on", (b.dataset.shape === "arc") === ARC.on));
        rng.value = ARC.deg; val.textContent = ARC.deg + "°";
        wrap.classList.toggle("off", !ARC.on);
      };
      const apply = (arc, deg) => {
        if (arc === ARC.on && deg === ARC.deg) return;
        lsSet(SHAPE_KEY, JSON.stringify({ arc, deg }));
        setProgress(arc ? `改成弧形（${deg}°），重新搭建展廳…` : "改回直線，重新搭建展廳…");
        setTimeout(() => location.reload(), 120);
      };
      seg.addEventListener("click", (e) => {
        const b = e.target.closest("[data-shape]");
        if (!b) return;
        e.stopPropagation();
        apply(b.dataset.shape === "arc", ARC.deg);
      });
      rng.addEventListener("click", (e) => e.stopPropagation());
      rng.addEventListener("input", () => { val.textContent = rng.value + "°"; });
      rng.addEventListener("change", () => apply(true, +rng.value));
      sync();
    }
    function viewInit() {
      shapeUI();
      viewLoad();
      viewBind();
      viewRender();
      viewApply();
    }

    /* v73 星空＋銀河貼圖（加色混合，黑色＝透明）；fade：下半部漸隱，用在落地窗照片上緣 */
    function makeStarTex(fade) {
      const W = 2048, H = 1024;
      const c = document.createElement("canvas"); c.width = W; c.height = H;
      const x = c.getContext("2d");
      x.fillStyle = "#000"; x.fillRect(0, 0, W, H);
      const rnd = Math.random, gauss = () => (rnd() + rnd() + rnd() - 1.5) / 1.5;
      /* 銀河：一條斜向光帶，中心偏暖、外圍偏藍紫 */
      const P = (t) => [t * W, H * (0.78 - 0.55 * t) + Math.sin(t * 5) * 40];
      x.globalCompositeOperation = "lighter";
      for (let i = 0; i < 900; i++) {
        const t = rnd(), [px, py] = P(t), off = gauss() * 110, r = 30 + rnd() * 90;
        const cx = px + off * 0.45, cy = py + off;
        const warm = Math.abs(off) < 45 && rnd() < 0.5;
        const g = x.createRadialGradient(cx, cy, 0, cx, cy, r);
        g.addColorStop(0, warm ? "rgba(255,214,170,0.09)" : "rgba(150,165,235,0.08)");
        g.addColorStop(1, "rgba(0,0,0,0)");
        x.fillStyle = g; x.fillRect(cx - r, cy - r, r * 2, r * 2);
      }
      for (let i = 0; i < 9000; i++) {            /* 光帶裡密密的小星 */
        const t = rnd(), [px, py] = P(t), off = gauss() * 120;
        const a = 0.25 + rnd() * 0.6;
        x.fillStyle = `rgba(255,255,255,${a})`;
        x.fillRect(px + off * 0.45, py + off, rnd() < 0.9 ? 1 : 1.6, rnd() < 0.9 ? 1 : 1.6);
      }
      x.globalCompositeOperation = "source-over";   /* 暗色塵埃帶 */
      for (let i = 0; i < 260; i++) {
        const t = rnd(), [px, py] = P(t), r = 12 + rnd() * 34, cx = px + gauss() * 14, cy = py + gauss() * 22 - 6;
        const g = x.createRadialGradient(cx, cy, 0, cx, cy, r);
        g.addColorStop(0, "rgba(0,0,0,0.35)"); g.addColorStop(1, "rgba(0,0,0,0)");
        x.fillStyle = g; x.fillRect(cx - r, cy - r, r * 2, r * 2);
      }
      x.globalCompositeOperation = "lighter";
      for (let i = 0; i < 2600; i++) {             /* 滿天散星 */
        const a = 0.2 + rnd() * rnd() * 0.8, sz = rnd() < 0.95 ? 1 : 2;
        const tint = rnd();
        x.fillStyle = tint < 0.1 ? `rgba(255,210,170,${a})` : tint < 0.2 ? `rgba(180,200,255,${a})` : `rgba(255,255,255,${a})`;
        x.fillRect(rnd() * W, rnd() * H, sz, sz);
      }
      for (let i = 0; i < 70; i++) {               /* 亮星：帶光暈 */
        const cx = rnd() * W, cy = rnd() * H, r = 5 + rnd() * 9;
        const g = x.createRadialGradient(cx, cy, 0, cx, cy, r);
        g.addColorStop(0, "rgba(255,255,255,0.95)"); g.addColorStop(0.25, "rgba(220,230,255,0.35)"); g.addColorStop(1, "rgba(0,0,0,0)");
        x.fillStyle = g; x.fillRect(cx - r, cy - r, r * 2, r * 2);
      }
      if (fade) {                                   /* 只留上方：越往下越淡（地平線附近沒有星） */
        x.globalCompositeOperation = "destination-in";
        const g = x.createLinearGradient(0, 0, 0, H);
        g.addColorStop(0, "rgba(0,0,0,1)"); g.addColorStop(0.3, "rgba(0,0,0,0.9)"); g.addColorStop(0.55, "rgba(0,0,0,0)"); g.addColorStop(1, "rgba(0,0,0,0)");
        x.fillStyle = g; x.fillRect(0, 0, W, H);
      }
      const t = new THREE.Texture(c);
      if (THREE.SRGBColorSpace) t.colorSpace = THREE.SRGBColorSpace;
      t.wrapS = t.wrapT = THREE.RepeatWrapping; t.needsUpdate = true;
      return t;
    }
    function starMat(fade) {
      const m = new THREE.MeshBasicMaterial({ map: makeStarTex(fade), transparent: true, opacity: 0, blending: THREE.AdditiveBlending,
        depthWrite: false, fog: false, side: THREE.DoubleSide, toneMapped: false });
      m.visible = false;
      STAR_MATS.push(m);
      return m;
    }

    /* v70 玻璃質感：淡青綠色透明層＋每片玻璃各自的斜向反光（加色混合，不擋視線） */
    let GLASS = null;
    function glassMats() {
      if (GLASS) return GLASS;
      const sheen = canvasTex(512, (ctx, S) => {
        ctx.clearRect(0, 0, S, S);
        const v = ctx.createLinearGradient(0, 0, 0, S);      /* 上亮下暗：天光反射 */
        v.addColorStop(0, "rgba(255,255,255,0.22)"); v.addColorStop(0.45, "rgba(255,255,255,0.05)"); v.addColorStop(1, "rgba(255,255,255,0.02)");
        ctx.fillStyle = v; ctx.fillRect(0, 0, S, S);
        const band = (x0, w, a) => {                          /* 斜向反光帶 */
          ctx.save(); ctx.translate(x0, 0); ctx.transform(1, 0, -0.55, 1, 0, 0);
          const g = ctx.createLinearGradient(0, 0, w, 0);
          g.addColorStop(0, "rgba(255,255,255,0)"); g.addColorStop(0.5, `rgba(255,255,255,${a})`); g.addColorStop(1, "rgba(255,255,255,0)");
          ctx.fillStyle = g; ctx.fillRect(0, -S, w, S * 3); ctx.restore();
        };
        band(S * 0.28, S * 0.2, 0.34); band(S * 0.55, S * 0.07, 0.26); band(S * 0.86, S * 0.12, 0.14);
        ctx.fillStyle = "rgba(255,255,255,0.35)"; ctx.fillRect(0, 0, S, 3); ctx.fillRect(0, 0, 3, S);   /* 玻璃邊緣亮線 */
      }, 1, 1);
      if (THREE.NoColorSpace) sheen.colorSpace = THREE.NoColorSpace;
      GLASS = {
        tint: new THREE.MeshBasicMaterial({ color: "#d4ecef", transparent: true, opacity: 0.16, depthWrite: false, fog: false }),
        sheen: new THREE.MeshBasicMaterial({ map: sheen, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, opacity: 0.75, fog: false })
      };
      return GLASS;
    }
    /* 一整面玻璃（本地座標：寬 len、高 y0→y1，面朝 +z）；每片玻璃寬 pane，反光各自一組 */
    function glassPane(len, y0, y1, z, pane) {
      const G = glassMats(), out = [];
      const tint = new THREE.PlaneGeometry(len, y1 - y0).translate(0, (y0 + y1) / 2, z);
      const sh = new THREE.PlaneGeometry(len, y1 - y0);
      const uv = sh.attributes.uv, n = Math.max(1, len / pane);
      for (let i = 0; i < uv.count; i++) uv.setXY(i, uv.getX(i) * n, uv.getY(i));
      sh.translate(0, (y0 + y1) / 2, z + 0.004);
      out.push([tint, G.tint], [sh, G.sheen]);
      return out;
    }
    /* v66 落地玻璃帷幕（參考照片：黑色細框、上方一道橫料）；所有建築風格都有，窗外沿用「窗外景色」 */
    function addCurtain(rec, face, M) {
      const { w, d, h, cx, cz } = rec;
      const horiz = face === "north" || face === "south";
      const len = horiz ? w : d;
      const F = winFace(rec, face);
      const [px, pz] = F.at(0);
      const back = WALL_T / 2 + 0.005;                   /* 玻璃放在牆中線，框料往室內凸 */
      const place = (g) => { g.rotateY(F.ang); g.translate(px, 0, pz); return g; };
      /* v70：照片放在玻璃外 1.8 m、比窗大一圈 → 走動時有前後景深；UV 0→1 */
      const OUT = 1.8, EX = 3, EB = 2.5, ET = 2;
      const glass = new THREE.PlaneGeometry(len + 2 * EX, h + EB + ET);
      glass.translate(0, (h + ET - EB) / 2, -back - OUT);
      queue(place(glass), M.views[rec.id]);
      /* 外面這 1.8 m 的兩側與上方：用淺色側板收邊，斜看時不會看到黑洞 */
      const jamb = (x) => queue(place(new THREE.BoxGeometry(0.05, h + EB + ET, OUT).translate(x, (h + ET - EB) / 2, -back - OUT / 2)), M.jamb);
      jamb(-len / 2 - EX); jamb(len / 2 + EX);
      /* v75 上下也收邊：走近窗、視野變大往上下看時不會看到空洞 */
      const lid = (y) => queue(place(new THREE.BoxGeometry(len + 2 * EX, 0.05, OUT).translate(0, y, -back - OUT / 2)), M.jamb);
      lid(-EB); lid(h + ET);
      const bays0 = Math.round(len / 2.6);
      glassPane(len, 0, h, -back + 0.02, len / bays0).forEach(([g, m]) => queue(place(g), m));
      const bar = (bw, bh, bd, x, y) => queue(place(new THREE.BoxGeometry(bw, bh, bd).translate(x, y, -back + bd / 2 - 0.04)), M.mull, { cast: true });
      const bays = Math.round(len / 2.6);
      for (let i = 0; i <= bays; i++) bar(i === 0 || i === bays ? 0.16 : 0.09, h, 0.24, -len / 2 + (len * i) / bays, h / 2);
      bar(len, 0.22, 0.26, 0, 0.11);                     /* 地檻 */
      bar(len, 0.1, 0.2, 0, h * 0.82);                   /* 上方橫料 */
      bar(len, 0.26, 0.26, 0, h - 0.13);                 /* 頂框 */
    }

    /* ================= v71 坐下休息 =================
       走進桌椅區被擋住 → 問「要坐下休息一下嗎？」；Enter／Y／點「請坐下」坐到最近的圓凳，
       Esc／N／點「不用」取消（離開這組桌椅前不再問）。坐著時可轉頭看，按任一方向鍵站起來 */
    const SIT_EYE = 1.18;
    const SIT = { on: false, ask: null, nope: null, x: 0, z: 0 };
    function sitAskEl() {
      let el = $("sit-ask");
      if (el) return el;
      el = document.createElement("div");
      el.id = "sit-ask";
      el.innerHTML = `<span>🪑 要坐下休息一下嗎？</span><button type="button" data-sit="yes">請坐下 <i>Enter</i></button><button type="button" data-sit="no">不用 <i>Esc</i></button>`;
      el.addEventListener("click", (e) => {
        const b = e.target.closest("[data-sit]");
        if (!b) return;
        e.stopPropagation();
        if (b.dataset.sit === "yes") sitDown(); else sitCancel();
      });
      document.body.appendChild(el);
      return el;
    }
    function sitAsk(c) {
      if (SIT.on || SIT.ask === c || SIT.nope === c) return;
      SIT.ask = c;
      sitAskEl().classList.add("show");
    }
    function sitHide() { SIT.ask = null; const el = $("sit-ask"); if (el) el.classList.remove("show"); }
    function sitCancel() { SIT.nope = SIT.ask; sitHide(); }
    function sitDown() {
      const c = SIT.ask;
      sitHide();
      if (!c) return;
      const p = camera.position;
      let best = c.poufs[0], bd = 1e9;
      c.poufs.forEach((q) => { const d = (q[0] - p.x) ** 2 + (q[1] - p.z) ** 2; if (d < bd) { bd = d; best = q; } });
      SIT.on = true; SIT.x = best[0]; SIT.z = best[1];
      move = { f: 0, b: 0, l: 0, r: 0, run: 0 }; wheelBoost = 0;
      let dx, dz;
      if (c.face) { dx = c.face[0]; dz = c.face[1]; }
      else { dx = best[0] - c.x; dz = best[1] - c.z; const l = Math.hypot(dx, dz) || 1; dx /= l; dz /= l; }
      setCamAngles(Math.atan2(-dx, -dz), 0.02);
      toast("已坐下 · 可以轉頭看看，按任一方向鍵站起來");
    }
    function sitStand() {
      if (!SIT.on) return;
      SIT.on = false;
      /* 站起來後這組桌椅先不再問，走開再回來才問 */
      SIT.nope = MOD_COLS.find((c) => c.seat && Math.hypot(c.x - SIT.x, c.z - SIT.z) < 1.6) || null;
    }
    document.addEventListener("keydown", (e) => {
      if (!SIT.ask) return;
      if (e.code === "Enter" || e.code === "NumpadEnter" || e.code === "KeyY") { e.preventDefault(); e.stopImmediatePropagation(); sitDown(); }
      else if (e.code === "Escape" || e.code === "KeyN") { e.stopImmediatePropagation(); sitCancel(); }
    }, true);
    function modBlocked(x, z) { return objectBlocked(x,z) || !!modHit(x, z); }
    function modHit(x, z) {
      if (objectBlocked(x,z)) return { seat: false };
      const o = camera.position;          /* 已在障礙內（例如跳轉後）時只擋往內走，不會卡住 */
      for (const c of MOD_COLS) {
        if (c.mode !== DECOR.mode) continue;
        const dn = (x - c.x) ** 2 + (z - c.z) ** 2;
        if (dn < c.r * c.r && dn < (o.x - c.x) ** 2 + (o.z - c.z) ** 2) return c;
      }
      return null;
    }
    function spotHeight(art) { return DECOR.mode === 3 ? MOD_Y - 0.3 : art.spotPos.y; }

    function setDecor(i, user) {
      DECOR.mode = ((i % DECOR_NAMES.length) + DECOR_NAMES.length) % DECOR_NAMES.length;
      const bit = 1 << DECOR.mode;
      DECOR.meshes.forEach((m) => { m.visible = !!(m.userData.decor & bit); });
      lsSet(DECOR_KEY, String(DECOR.mode));
      const rail = WALLS.rail;          /* 門框：現代用淺橡木，其餘維持金色 */
      if (rail) {
        const mod = DECOR.mode >= 3;
        rail.map = mod ? null : goldTex;
        rail.color.set(DECOR.mode === 4 ? "#eceae6" : mod ? "#d8bf98" : "#b8944a");
        rail.metalness = mod ? 0 : 0.55; rail.roughness = mod ? 0.6 : 0.35;
        rail.needsUpdate = true;
      }
      SPOTS.forEach((s) => { if (s.art) s.light.position.y = spotHeight(s.art); });
      if (user && DECOR.mode >= 3) { setWallStyle(5); setLightMode(0); }   /* 照片的樣子：白牆＋日照 */
      document.querySelectorAll("[data-decor]").forEach((b) => b.classList.toggle("on", +b.dataset.decor === DECOR.mode));
      markShadow();
    }

    function buildRoom() {
      const marbleTex = makeMarble(0.5, 0.526);   // 地板：一塊 ≈ 2 m（同原主廳 14×10）
      const marble = new THREE.MeshStandardMaterial({ map: marbleTex, color: "#cfc0a6", roughness: 0.32 });
      const rail = new THREE.MeshStandardMaterial({ map: goldTex, color: "#b8944a", metalness: 0.55, roughness: 0.35 });
      const gold = new THREE.MeshStandardMaterial({ map: goldTex, color: "#c4a35a", metalness: 0.72, roughness: 0.28 });
      const cream = new THREE.MeshStandardMaterial({ color: "#e8dcc8", roughness: 0.78 });
      const ceilM = new THREE.MeshStandardMaterial({ color: "#e8dfd0", roughness: 0.9 });
      const skyM = new THREE.MeshBasicMaterial({ color: "#b9c8dc" });
      const frescoMat = new THREE.MeshStandardMaterial({ map: makeFresco(), roughness: 0.7, metalness: 0.05, emissive: 0xc9a56a, emissiveIntensity: 0.08 });
      WALLS.mats = [
        new THREE.MeshStandardMaterial({ map: makeMarble(1 / 7, 1 / 3), color: "#efe6d8", roughness: 0.4, metalness: 0.08 }),
        new THREE.MeshStandardMaterial({ color: "#1c5ed0", roughness: 0.88 }),
        new THREE.MeshStandardMaterial({ map: makeJungleTex(), color: "#c5d4b8", roughness: 0.76 }),
        new THREE.MeshStandardMaterial({ map: makeStoneTex(), color: "#f2e8d6", roughness: 0.86 }),
        new THREE.MeshStandardMaterial({ map: makeDamaskTex(), color: "#ffffff", roughness: 0.62, metalness: 0.04 }),
        new THREE.MeshStandardMaterial({ color: "#f3f1ec", roughness: 0.93 })
      ];
      WALLS.rail = rail;
      const brick = makeBrickTex();
      const GM = {
        vault: new THREE.MeshStandardMaterial({ map: brick, color: "#e8d2b4", roughness: 0.92, side: THREE.DoubleSide, emissive: 0x3a2a18, emissiveIntensity: 0.35 }),
        rib: new THREE.MeshStandardMaterial({ map: brick, color: "#f4e6d0", roughness: 0.85, side: THREE.DoubleSide, emissive: 0x2a1e10, emissiveIntensity: 0.3 }),
        gable: new THREE.MeshStandardMaterial({ map: brick, color: "#e2cba9", roughness: 0.92, side: THREE.DoubleSide, emissive: 0x3a2a18, emissiveIntensity: 0.3 }),
        eye: new THREE.MeshBasicMaterial({ color: "#fbe7c2", side: THREE.DoubleSide }),
        floor: new THREE.MeshStandardMaterial({ map: makeHexTex(), color: "#dfe8e3", roughness: 0.5 })
      };
      const ledM = new THREE.MeshBasicMaterial({ color: "#fff3dc" });
      const woodTex = makeWoodTex();
      const MM = {
        floor: new THREE.MeshStandardMaterial({ map: makeTerrazzoTex(), color: "#ffffff", roughness: 0.26, metalness: 0.02 }),
        white: new THREE.MeshStandardMaterial({ color: "#f6f4f0", roughness: 0.85, side: THREE.DoubleSide, emissive: 0xf2eee6, emissiveIntensity: 0.22 }),
        soffit: new THREE.MeshStandardMaterial({ color: "#4a3522", roughness: 0.9, emissive: 0x24180e, emissiveIntensity: 0.5, side: THREE.DoubleSide }),
        fin: new THREE.MeshStandardMaterial({ map: woodTex, color: "#c4a07a", roughness: 0.62, side: THREE.DoubleSide, emissive: 0x5a4028, emissiveIntensity: 0.3 }),
        concrete: new THREE.MeshStandardMaterial({ map: makeConcreteTex(), color: "#ffffff", roughness: 0.88 }),
        cove: new THREE.MeshBasicMaterial({ color: "#ffcf8c" }),
        down: new THREE.MeshBasicMaterial({ color: "#fff6e6", side: THREE.DoubleSide }),
        sky: new THREE.MeshBasicMaterial({ color: "#f4f7fa", side: THREE.DoubleSide })
      };
      const WM = {
        ceil: new THREE.MeshStandardMaterial({ color: "#eee4d4", roughness: 0.9, side: THREE.DoubleSide, emissive: 0xeee4d4, emissiveIntensity: 0.32 }),
        well: new THREE.MeshStandardMaterial({ color: "#fbfaf7", roughness: 0.8, side: THREE.DoubleSide, emissive: 0xf4f2ee, emissiveIntensity: 0.45 }),
        sky: new THREE.MeshBasicMaterial({ map: makeSkyTex(), side: THREE.DoubleSide, fog: false }),
        view: new THREE.MeshBasicMaterial({ map: makeViewTex(), fog: false }),
        clere: new THREE.MeshBasicMaterial({ map: makeClereSky("#8fbbe3"), fog: false }),
        mull: new THREE.MeshStandardMaterial({ color: "#8e959c", roughness: 0.45, metalness: 0.35, emissive: 0x6a7076, emissiveIntensity: 0.3 }),
        frame: new THREE.MeshStandardMaterial({ color: "#eceae6", roughness: 0.5, metalness: 0.15 }),
        pouf: new THREE.MeshStandardMaterial({ map: makeFabricTex(), color: "#f2f0ec", roughness: 1, emissive: 0xd8d6d0, emissiveIntensity: 0.18 }),
        table: new THREE.MeshStandardMaterial({ color: "#f4f3f0", roughness: 0.35 }),
        glow: new THREE.MeshBasicMaterial({ color: "#fff7ea", side: THREE.DoubleSide }),
        stars: starMat(false)
      };
      VIEW.mat = WM.view; VIEW.garden = WM.view.map; VIEW.clere = WM.clere;
      const CW = {
        mull: new THREE.MeshStandardMaterial({ color: "#eceae5", roughness: 0.35, metalness: 0.25, emissive: 0xd8d6d0, emissiveIntensity: 0.12 }),
        views: {},
        jamb: new THREE.MeshBasicMaterial({ color: "#cfd6da", fog: false })
      };
      LAYOUT.filter((r) => r.glass).forEach((r) => { CW.views[r.id] = new THREE.MeshBasicMaterial({ fog: false }); });
      VIEW.wides = CW.views;
      WIN_TINT.push(WM.view, CW.jamb, ...Object.values(CW.views));
      SKY_TINT.push(WM.clere, WM.sky);
      [WM.pouf, WM.ceil, WM.well, WM.mull, CW.mull, MM.white, MM.fin].forEach((mt) => { mt.userData.em0 = mt.emissiveIntensity; EMIS.push(mt); });
      const plaster = WALLS.mats[1];
      LAYOUT.forEach((rec) => {
        batchRoom = rec.id;
        const { w, d, h, cx, cz, doors = [], skip = [] } = rec;
        const fg = new THREE.PlaneGeometry(w, d).rotateX(-Math.PI / 2).translate(cx, 0, cz);
        const fp = fg.attributes.position, fu = fg.attributes.uv;
        for (let i = 0; i < fp.count; i++) fu.setXY(i, fp.getX(i), -fp.getZ(i));
        const fgHex = fg.clone();
        batchMask = DM.classic | DM.minimal;
        queue(fg, marble, { recv: true });
        queue(new THREE.PlaneGeometry(w, d).rotateX(Math.PI / 2).translate(cx, h, cz), ceilM);
        queue(new THREE.PlaneGeometry(w * 0.36, d * 0.3).rotateX(Math.PI / 2).translate(cx, h - 0.03, cz), skyM);
        batchMask = DM.gaudi;
        queue(fgHex, GM.floor, { recv: true });
        batchMask = DM.all;

        const faces = [
          { id: "north", axis: "z", a: cx, b: cz - d / 2, len: w },
          { id: "south", axis: "z", a: cx, b: cz + d / 2, len: w },
          { id: "west", axis: "x", a: cx - w / 2, b: cz, len: d },
          { id: "east", axis: "x", a: cx + w / 2, b: cz, len: d }
        ];
        faces.forEach((f) => {
          if (skip.includes(f.id)) return;
          if ((rec.glass || []).includes(f.id)) { addCurtain(rec, f.id, CW); return; }
          if (doors.includes(f.id)) {
            const inn = f.id === "west" || f.id === "north" ? 1 : -1;       /* 本廳在牆的哪一側 */
            const px = f.axis === "x" ? f.a - inn : f.a, pz = f.axis === "z" ? f.b - inn : f.b;
            const nbr = LAYOUT.find((r) => r !== rec && Math.abs(px - r.cx) < r.w / 2 && Math.abs(pz - r.cz) < r.d / 2);
            addDoorWall(f.axis, f.a, f.b, f.len, h, plaster, rail, nbr ? nbr.id : null, inn);
          }
          else if (f.axis === "z") addBox(new THREE.BoxGeometry(f.len, h, WALL_T), plaster, f.a, h / 2, f.b, true);
          else addBox(new THREE.BoxGeometry(WALL_T, h, f.len), plaster, f.a, h / 2, f.b, true);
        });

        const pad = 0.5;
        walkables.push({
          minX: cx - w / 2 + pad, maxX: cx + w / 2 - pad,
          minZ: cz - d / 2 + pad, maxZ: cz + d / 2 - pad,
          name: rec.name, id: rec.id
        });
        batchMask = DM.classic;
        dressBaroque(rec, gold, cream, frescoMat);
        batchMask = DM.gaudi;
        dressGaudi(rec, GM);
        batchMask = DM.minimal;
        dressMinimal(rec, ledM);
        batchMask = DM.modern | DM.window;
        queue(fg.clone(), MM.floor, { recv: true });
        batchMask = DM.modern;
        dressModern(rec, MM);
        batchMask = DM.window;
        dressWindow(rec, WM);
        batchMask = DM.all;
      });
      batchRoom = "hall";
      batchMask = DM.classic;
      queue(new THREE.CircleGeometry(3.4, 64).rotateX(-Math.PI / 2).translate(0, 0.012, 0),
        new THREE.MeshStandardMaterial({ color: "#8a7350", metalness: 0.18, roughness: 0.38 }));
      batchMask = DM.all;
      flushBatches();

      walkables.push({ minX: -15.2, maxX: -13.0, minZ: -DOOR_W / 2 + 0.15, maxZ: DOOR_W / 2 - 0.15, name: "西門", id: null });
      walkables.push({ minX: 13.0, maxX: 15.2, minZ: -DOOR_W / 2 + 0.15, maxZ: DOOR_W / 2 - 0.15, name: "東門", id: null });
      walkables.push({ minX: -37.2, maxX: -34.8, minZ: -DOOR_W / 2 + 0.15, maxZ: DOOR_W / 2 - 0.15, name: "西二門", id: null });
      walkables.push({ minX: 34.8, maxX: 37.2, minZ: -DOOR_W / 2 + 0.15, maxZ: DOOR_W / 2 - 0.15, name: "東二門", id: null });

      const hemi = new THREE.HemisphereLight(0xf3ead8, 0x3a3228, 0.55);
      const ambient = new THREE.AmbientLight(0xe4d4b0, 0.22);
      const sun = new THREE.DirectionalLight(0xfff3dc, 0.8);
      sun.position.set(16, 26, 10); sun.castShadow = true;
      sun.shadow.mapSize.set(Q.shadowSize, Q.shadowSize);
      sun.shadow.camera.near = 2; sun.shadow.camera.far = 90;
      sun.shadow.camera.left = -40; sun.shadow.camera.right = 40;
      sun.shadow.camera.top = 22; sun.shadow.camera.bottom = -22;
      if (ARC.on) {                                     /* 弧形：整體範圍變大，陰影相機跟著放大 */
        sun.shadow.camera.left = -80; sun.shadow.camera.right = 80;
        sun.shadow.camera.top = 70; sun.shadow.camera.bottom = -70; sun.shadow.camera.far = 220;
      }
      scene.add(hemi, ambient, sun);
      LIGHTS.hemi = hemi; LIGHTS.ambient = ambient; LIGHTS.sun = sun;
      doorLabel(HALL.westName, -13.7, 4.15, 0, Math.PI / 2);
      doorLabel(HALL.eastName, 13.7, 4.15, 0, -Math.PI / 2);
      doorLabel(HALL.west2Name, -35.7, 4.15, 0, Math.PI / 2);
      doorLabel(HALL.east2Name, 35.7, 4.15, 0, -Math.PI / 2);
      const wallRaw = lsGet(WALL_KEY) || "";
      let wallMap = null;
      if (wallRaw.startsWith("r:")) { try { wallMap = JSON.parse(wallRaw.slice(2)); } catch {} }
      const savedWall = parseInt(wallRaw || String(HALL.wall), 10);
      setWallStyle(Number.isFinite(savedWall) ? savedWall : 5);
      if (wallMap) wallRandom(wallMap);
      viewInit();
      const savedDecor = parseInt(lsGet(DECOR_KEY) || String(HALL.decor), 10);
      setDecor(Number.isFinite(savedDecor) ? savedDecor : 4);
    }

    function markShadow() { if (renderer) renderer.shadowMap.needsUpdate = true; }

    /* v74 隨機：每個廳各抽一種牆面（盡量不重複），再按一次重抽；選擇會記住 */
    function wallRandom(map) {
      if (!WALLS.mats.length) return;
      if (!map) {
        const ids = ROOM_ORDER.slice(), pool = shuffleArr(WALLS.mats.map((_, i) => i));
        const prev = WALLS.rand || {};
        map = {};
        ids.forEach((id, i) => { map[id] = pool[i % pool.length]; });
        if (ids.every((id) => prev[id] === map[id])) return wallRandom();   /* 跟上一次完全一樣就重抽 */
      }
      WALLS.rand = map;
      wallMeshes.forEach((m) => { const k = map[m.userData.room]; m.material = WALLS.mats[Number.isInteger(k) ? k : WALLS.mode] || WALLS.mats[0]; });
      lsSet(WALL_KEY, "r:" + JSON.stringify(map));
      document.querySelectorAll("#wall-bar [data-wall]").forEach((b) => b.classList.toggle("on", b.dataset.wall === "rand"));
      const names = ROOM_ORDER.filter((id) => id in map).map((id) => (LAYOUT.find((r) => r.id === id) || {}).name + "：" + WALL_NAMES[map[id]]);
      if (hungAll) toast("隨機牆面　" + names.join("　"));
    }
    function setWallStyle(i) {
      if (!WALLS.mats.length) return;
      WALLS.rand = null;
      WALLS.mode = ((i % WALLS.mats.length) + WALLS.mats.length) % WALLS.mats.length;
      const mat = WALLS.mats[WALLS.mode];
      wallMeshes.forEach((m) => { m.material = mat; });
      lsSet(WALL_KEY, String(WALLS.mode));
      document.querySelectorAll("#wall-bar [data-wall]").forEach((b) => {
        b.classList.toggle("on", +b.dataset.wall === WALLS.mode);
      });
    }

    /* ================= v59 選單拖曳／縮放 =================
       拖曳：按住選單空白處（標籤、邊框、底列文字）移動
       縮放：滑鼠在選單上滾輪（60%～140%），或拖右下角；雙擊空白處恢復原位與原大小
       位置與比例記在本機                                                     */
    const CON = { x: null, y: null, s: 1, key: "gallery-console-v1" };
    function conApply() {
      const el = $("console");
      if (!el) return;
      el.style.transform = CON.s === 1 ? "" : `scale(${CON.s})`;
      if (CON.x === null) { el.classList.remove("free"); el.style.left = el.style.top = ""; return; }
      el.classList.add("free");
      const w = el.offsetWidth * CON.s, h = el.offsetHeight * CON.s;
      CON.x = Math.max(8 - w + 80, Math.min(innerWidth - 80, CON.x));     /* 至少留 80px 在畫面內，拖得回來 */
      CON.y = Math.max(0, Math.min(innerHeight - 40, CON.y));
      el.style.left = CON.x.toFixed(0) + "px";
      el.style.top = CON.y.toFixed(0) + "px";
    }
    function conSave() { lsSet(CON.key, JSON.stringify({ x: CON.x, y: CON.y, s: CON.s })); }
    function conZoomTip() {
      const el = $("console");
      $("con-zoom").textContent = Math.round(CON.s * 100) + "%";
      el.classList.add("zooming");
      clearTimeout(conZoomTip.t);
      conZoomTip.t = setTimeout(() => el.classList.remove("zooming"), 900);
    }
    function conFree() {                                /* 第一次拖曳：從排版位置轉成固定座標 */
      if (CON.x !== null) return;
      const r = $("console").getBoundingClientRect();
      CON.x = r.left; CON.y = r.top;
    }
    function conSetScale(ns, ax, ay) {                  /* 以 (ax, ay) 為錨點縮放 */
      ns = Math.max(0.6, Math.min(1.4, Math.round(ns * 100) / 100));
      if (ns === CON.s) return;
      conFree();
      CON.x = ax - (ax - CON.x) * ns / CON.s;
      CON.y = ay - (ay - CON.y) * ns / CON.s;
      CON.s = ns;
      conApply(); conZoomTip();
    }
    function bindConsoleMove() {
      const el = $("console");
      if (!el) return;
      try {
        const o = JSON.parse(lsGet(CON.key) || "null");
        if (o) { CON.s = Math.max(0.6, Math.min(1.4, +o.s || 1)); if (typeof o.x === "number" && typeof o.y === "number") { CON.x = o.x; CON.y = o.y; } }
      } catch {}
      requestAnimationFrame(conApply);
      const blank = (t) => !t.closest("button, input, label, select, a, .con-grip");
      let drag = null;
      el.addEventListener("pointerdown", (e) => {
        if (e.button !== 0) return;
        const grip = e.target.closest(".con-grip");
        if (!grip && !blank(e.target)) return;
        e.preventDefault(); e.stopPropagation();
        conFree();
        drag = { grip: !!grip, id: e.pointerId, sx: e.clientX, sy: e.clientY, x: CON.x, y: CON.y, s: CON.s, w: el.offsetWidth };
        el.setPointerCapture(e.pointerId);
        el.classList.add("dragging");
      });
      el.addEventListener("pointermove", (e) => {
        if (!drag || e.pointerId !== drag.id) return;
        const dx = e.clientX - drag.sx, dy = e.clientY - drag.sy;
        if (drag.grip) {
          const ns = Math.max(0.6, Math.min(1.4, (drag.w * drag.s + dx) / drag.w));
          CON.s = Math.round(ns * 100) / 100;
          CON.x = drag.x; CON.y = drag.y;
          conZoomTip();
        } else { CON.x = drag.x + dx; CON.y = drag.y + dy; }
        conApply();
      });
      const end = (e) => {
        if (!drag || e.pointerId !== drag.id) return;
        drag = null;
        el.classList.remove("dragging");
        conSave();
      };
      el.addEventListener("pointerup", end);
      el.addEventListener("pointercancel", end);
      el.addEventListener("wheel", (e) => {              /* 選單上的滾輪只縮放選單，不讓鏡頭前進後退 */
        e.preventDefault(); e.stopPropagation();
        let dy = e.deltaY; if (e.deltaMode === 1) dy *= 16;
        conSetScale(CON.s * Math.exp(-dy * 0.0015), e.clientX, e.clientY);
        clearTimeout(bindConsoleMove.t);
        bindConsoleMove.t = setTimeout(conSave, 300);
      }, { passive: false });
      el.addEventListener("dblclick", (e) => {
        if (!blank(e.target) && !e.target.closest(".con-grip")) return;
        CON.x = CON.y = null; CON.s = 1;
        conApply(); conZoomTip(); conSave();
      });
      addEventListener("resize", () => { if (CON.x !== null) conApply(); });
    }
    function toggleHud(force) {
      const off = force === true ? false : force === false ? true : !$("hud").classList.contains("chrome-off");
      $("hud").classList.toggle("chrome-off", off);
    }

    function setFrameColor(rec, colorId) {
      if (!rec || !rec.frameMats) return;
      const p = FRAME_PALETTES[colorId] || FRAME_PALETTES.gold;
      rec.frame = colorId;
      const apply = (mat, hex) => {
        const hadMap = !!mat.map;
        mat.color.set(hex);
        mat.map = p.map ? goldTex : null;
        mat.metalness = p.metal;
        mat.roughness = p.rough;
        if (hadMap !== !!mat.map) mat.needsUpdate = true;   // 只有 map 有無改變才需重編
      };
      apply(rec.frameMats.outerM, p.o);
      apply(rec.frameMats.midM, p.m);
      rec.frameMats.midM.metalness = p.metal * 0.85;
      rec.frameMats.midM.roughness = p.rough + 0.06;
      apply(rec.frameMats.lipM, p.l);
      rec.frameMats.lipM.roughness = Math.max(0.18, p.rough - 0.04);
      document.querySelectorAll("#iv-frame [data-frame]").forEach((b) => {
        b.classList.toggle("on", b.dataset.frame === rec.frame);
      });
      syncPreview(rec);
    }

    /* ================= 移動／拾取 ================= */
    function inside(x, z) {
      for (const b of walkables) if (x >= b.minX && x <= b.maxX && z >= b.minZ && z <= b.maxZ) return true;
      return false;
    }

    function detectRoom() {
      const p = camera.position;
      let name = "", id = null;
      for (const b of walkables) {
        if (b.id && p.x >= b.minX && p.x <= b.maxX && p.z >= b.minZ && p.z <= b.maxZ) { name = b.name; id = b.id; }
      }
      if (id) curRoomId = id;
      if (name && name !== curRoomName) {
        curRoomName = name;
        $("room-chip-name").textContent = name;
      }
    }

    /* v75 走近落地窗、面向窗外時，視野（FOV）慢慢張開；離開或轉身就收回 */
    const WFOV = { base: 68, add: 26 };
    const GLASS_N = { west: [-1, 0], east: [1, 0], north: [0, -1], south: [0, 1] };
    function windowFov(dt) {
      if (DRONE.on) return;                            /* 無人機自己管 FOV */
      let want = WFOV.base;
      if (exploring && !TOUR.on && !FLY.on && !HB.on && !DOG.on && !uiBlocked() && !REC.on) {
        const p = camera.position;
        camera.getWorldDirection(TMP.v);
        let best = 0;
        for (const r of LAYOUT) {
          if (!r.glass || Math.abs(p.x - r.cx) > r.w / 2 || Math.abs(p.z - r.cz) > r.d / 2) continue;
          for (const f of r.glass) {
            const n = GLASS_N[f];
            const gx = f === "west" ? r.cx - r.w / 2 : f === "east" ? r.cx + r.w / 2 : p.x;
            const gz = f === "north" ? r.cz - r.d / 2 : f === "south" ? r.cz + r.d / 2 : p.z;
            const dist = Math.abs((gx - p.x) * n[0] + (gz - p.z) * n[1]);
            const near = Math.min(1, Math.max(0, (7.5 - dist) / 6));         /* 7.5 m 開始，1.5 m 內最大 */
            const face = Math.min(1, Math.max(0, TMP.v.x * n[0] + TMP.v.z * n[1]) * 1.3);   /* 越正對窗越明顯 */
            best = Math.max(best, near * near * (3 - 2 * near) * face);
          }
        }
        want = WFOV.base + WFOV.add * best;
      }
      if (Math.abs(camera.fov - want) > 0.05) {
        camera.fov += (want - camera.fov) * (1 - Math.exp(-2.5 * dt));
        camera.updateProjectionMatrix();
      }
    }
    function movePlayer(dt) {
      if (!exploring || uiBlocked() || TOUR.on || FLY.on || DRONE.on || HB.on || DOG.on) return;
      const forward = TMP.fwd, right = TMP.right, dir = TMP.dir;
      if (!(aimFree() && aimDir(forward))) { camera.getWorldDirection(forward); forward.y = 0; forward.normalize(); }
      right.crossVectors(forward, TMP.up).normalize();
      dir.set(0, 0, 0);
      if (move.f) dir.add(forward);
      if (move.b) dir.sub(forward);
      if (move.r) dir.add(right);
      if (move.l) dir.sub(right);
      if (dir.lengthSq() > 0) dir.normalize().multiplyScalar((move.run ? PLAYER.run : PLAYER.speed) * dt);
      if (Math.abs(stick.x) > 0.08 || Math.abs(stick.y) > 0.08) {
        dir.addScaledVector(forward, -stick.y * PLAYER.speed * dt);
        dir.addScaledVector(right, stick.x * PLAYER.speed * dt);
      }
      if (Math.abs(wheelBoost) > 0.04) {
        dir.addScaledVector(forward, wheelBoost * dt);
        wheelBoost *= Math.exp(-6 * dt);
      }
      const nx = camera.position.x + dir.x, nz = camera.position.z + dir.z;
      if (SIT.on) {                                   /* v71 坐著：有任何移動輸入就站起來 */
        if (dir.lengthSq() > 1e-8) sitStand();
        else {
          const k = 1 - Math.exp(-5 * dt);
          camera.position.x += (SIT.x - camera.position.x) * k;
          camera.position.z += (SIT.z - camera.position.z) * k;
          camera.position.y += (SIT_EYE - camera.position.y) * k;
          return;
        }
      }
      const hitX = modHit(nx, camera.position.z), hitZ = modHit(camera.position.x, nz);
      if (inside(nx, camera.position.z) && !hitX) camera.position.x = nx;
      if (inside(camera.position.x, nz) && !hitZ) camera.position.z = nz;
      const hit = hitX || hitZ;
      if (hit && hit.seat) sitAsk(hit);
      if (SIT.ask && Math.hypot(camera.position.x - SIT.ask.x, camera.position.z - SIT.ask.z) > SIT.ask.r + 0.6) sitHide();   /* 走開就收起詢問 */
      if (SIT.nope && Math.hypot(camera.position.x - SIT.nope.x, camera.position.z - SIT.nope.z) > SIT.nope.r + 0.8) SIT.nope = null;
      camera.position.y += (PLAYER.h - camera.position.y) * Math.min(1, dt * 6);   /* 站起來時平順升高 */
    }

    function rebuildPickTargets() {
      pickTargets = artworks.flatMap((a) => [a.mesh, ...(a.matteMeshes || [])]).concat(wallMeshes);
    }

    /* 射線含牆面：不會隔牆點到隔壁廳的畫 */
    function castArt(ndc, maxDist) {
      camBend();
      TMP.ray.setFromCamera(ndc, camera);
      camUnbend();
      TMP.ray.far = maxDist;
      const hits = TMP.ray.intersectObjects(pickTargets, false);
      return hits.length && hits[0].object.userData.art ? hits[0].object.userData.art : null;
    }

    function setCamAngles(y, p) {
      yaw = y;
      pitch = Math.max(-1.2, Math.min(1.2, p));
      camera.rotation.set(pitch, yaw, 0, "YXZ");
    }

    function setLook(target, hint) {
      lookTarget = target;
      const on = !!target;
      const text = on ? (hint || (VIEWONLY ? "點一下看大圖 · " : "點一下查看／更換 · ")) + target.title : "";
      if (on !== lastLookOn) {
        $("look").classList.toggle("show", on);
        $("hair").classList.toggle("on", on);
        lastLookOn = on;
      }
      if (text && text !== lastLookText) { $("look").textContent = text; lastLookText = text; }
    }

    function pick() {
      if (dragging) return;                      // 拖放瞄準中：highlight 由 dragAim 決定
      if (DRONE.on) {
        if (!exploring || uiBlocked() || DRONE.mode === "dive") { if (lookTarget || lastLookOn) setLook(null); return; }
        const hv = DRONE.mIn ? artAtXY(DRONE.cx, DRONE.cy) : null;
        setLook(hv, "點一下進入畫中 · ");
        renderer.domElement.style.cursor = hv ? "pointer" : "crosshair";
        return;
      }
      if (!exploring || uiBlocked() || (!locked && !TOUCH && !hoverOn())) { if (lookTarget || lastLookOn) setLook(null); return; }
      if (aimFree()) {
        const r = renderer.domElement.getBoundingClientRect();
        TMP.mouse.set(((HOVER.cx - r.left) / r.width) * 2 - 1, -((HOVER.cy - r.top) / r.height) * 2 + 1);
        setLook(castArt(TMP.mouse, 6.5));
        return;
      }
      setLook(castArt(TMP.center, 6.5));
    }

    function artAtXY(clientX, clientY) {
      if (!renderer || !camera || !artworks.length) return null;
      const r = renderer.domElement.getBoundingClientRect();
      TMP.mouse.set(((clientX - r.left) / r.width) * 2 - 1, -((clientY - r.top) / r.height) * 2 + 1);
      return castArt(TMP.mouse, 10);
    }

    /* ================= 燈光 ================= */
    function lerp(a, b, t) { return a + (b - a) * t; }

    function setLightMode(i) {
      LIGHTS.mode = ((i % LIGHT_MODES.length) + LIGHT_MODES.length) % LIGHT_MODES.length;
      const m = LIGHT_MODES[LIGHTS.mode];
      if (LIGHTS.sun) { LIGHTS.sun.position.set(16, m.sunY, 10); markShadow(); }
      lsSet(LIGHT_KEY, String(LIGHTS.mode));
      document.querySelectorAll("#light-bar [data-light]").forEach((b) => {
        b.classList.toggle("on", +b.dataset.light === LIGHTS.mode);
      });
    }
    function cycleLightMode() { setLightMode(LIGHTS.mode + 1); }

    /* 聚光燈池：固定 N 盞，分配給「最近、面前、同一廳」的畫；換手時先淡出再移位 */
    function initSpots() {
      for (let i = 0; i < Q.spotPool; i++) {
        const s = new THREE.SpotLight(0xfff2d8, 0, 14, Math.PI / 8, 0.4, 1.2);
        scene.add(s); scene.add(s.target);
        SPOTS.push({ light: s, art: null, next: null });
      }
    }
    const _want = new Set();
    function reassignSpots(instant) {
      if (!artworks.length) return;
      const cp = camera.position;
      camera.getWorldDirection(TMP.v);
      for (const art of artworks) {
        const dx = art.lookAt.x - cp.x, dz = art.lookAt.z - cp.z;
        let sc = Math.hypot(dx, dz);
        if (TMP.v.x * dx + TMP.v.z * dz < 0) sc *= 2.2;     // 在背後
        if (art.room !== curRoomId) sc *= 2.5;               // 別的廳
        art._score = sc;
      }
      const ranked = artworks.slice().sort((a, b) => a._score - b._score).slice(0, SPOTS.length);
      _want.clear(); ranked.forEach((a) => _want.add(a));
      const served = new Set();
      SPOTS.forEach((s) => { s.next = null; if (s.art && _want.has(s.art)) served.add(s.art); });
      const pending = ranked.filter((a) => !served.has(a));
      for (const s of SPOTS) {
        if (s.art && _want.has(s.art)) continue;
        const a = pending.shift();
        if (!a) { s.next = null; continue; }
        if (!s.art || instant || s.light.intensity < 0.05) placeSpot(s, a, instant);
        else s.next = a;        // 等淡出後再搬
      }
    }
    function placeSpot(s, art, instant) {
      s.art = art; s.next = null;
      s.light.position.copy(art.spotPos);
      s.light.position.y = spotHeight(art);
      bendV(s.light.position);
      s.light.target.position.copy(art.lookAt);
      bendV(s.light.target.position);
      s.light.target.updateMatrixWorld();
      if (instant) s.light.intensity = 0.5;
    }

    function updateLights(dt) {
      if (!LIGHTS.hemi) return;
      const m = LIGHT_MODES[LIGHTS.mode];
      const k = 1 - Math.exp(-2.8 * dt);
      LIGHTS.hemi.intensity = lerp(LIGHTS.hemi.intensity, m.hemi, k);
      LIGHTS.ambient.intensity = lerp(LIGHTS.ambient.intensity, m.ambient, k);
      LIGHTS.sun.intensity = lerp(LIGHTS.sun.intensity, m.sun, k);
      LIGHTS.hemi.color.lerp(m.c.hemiSky, k);
      LIGHTS.hemi.groundColor.lerp(m.c.hemiGnd, k);
      LIGHTS.sun.color.lerp(m.c.sun, k);
      renderer.toneMappingExposure = lerp(renderer.toneMappingExposure, m.exposure, k);
      const wt = WIN_TINTS[m.id];
      if (wt && WIN_TINT.length) {
        WIN_C.set(wt.c);
        WIN_TINT.forEach((mt) => mt.color.lerp(WIN_C, k));
        SKY_C.set(wt.sky || wt.c);
        SKY_TINT.forEach((mt) => mt.color.lerp(SKY_C, k));
        if (GLASS) GLASS.sheen.opacity = lerp(GLASS.sheen.opacity, wt.sheen, k);
        EMIS.forEach((mt) => { mt.emissiveIntensity = lerp(mt.emissiveIntensity, mt.userData.em0 * wt.em, k); });
        STAR_MATS.forEach((mt) => { mt.opacity = lerp(mt.opacity, wt.star, k); mt.visible = mt.opacity > 0.005; });
      }
      scene.fog.density = lerp(scene.fog.density, m.fog, k);
      scene.fog.color.lerp(m.c.bg, k);
      scene.background.lerp(m.c.bg, k);
      const t = clock.elapsedTime;

      if (LIGHTS.torch) {
        camera.getWorldDirection(TMP.v);
        LIGHTS.torch.position.copy(camera.position);
        LIGHTS.torchTarget.position.copy(camera.position).addScaledVector(TMP.v, 10);
        if (ARC.on) {                                   /* 手電筒跟著彎曲後的相機 */
          const th = camera.position.x / ARC.R, c = Math.cos(th), sn = Math.sin(th), d = TMP.v;
          bendV(LIGHTS.torch.position);
          LIGHTS.torchTarget.position.set(LIGHTS.torch.position.x + (d.x * c - d.z * sn) * 10, LIGHTS.torch.position.y + d.y * 10, LIGHTS.torch.position.z + (d.x * sn + d.z * c) * 10);
        }
        let torchWant = exploring && !uiBlocked() ? m.torch : m.torch * 0.12;
        if (m.flicker) torchWant *= 0.86 + Math.sin(t * 11) * 0.07 * m.flicker + Math.sin(t * 23) * 0.05 * m.flicker;
        LIGHTS.torch.intensity = lerp(LIGHTS.torch.intensity, torchWant, 1 - Math.exp(-6 * dt));
        LIGHTS.torch.color.lerp(m.c.torch, k);
      }

      spotTimer -= dt;
      if (spotTimer <= 0) { spotTimer = 0.25; reassignSpots(false); }
      const player = camera.position;
      const ks = 1 - Math.exp(-4.5 * dt);
      for (const s of SPOTS) {
        const art = s.art;
        let want = 0;
        if (art && !s.next && _want.has(art)) {
          const look = lookTarget === art;
          const dist = player.distanceTo(art.lookAt);
          const near = Math.max(0, Math.min(1, 1 - (dist - 2.4) / 9));
          want = look ? m.spotFocus + near * 2 : m.spotBase + near * 2.4;
          if (m.flicker && look) want *= 0.9 + Math.sin(t * 13) * 0.1;
        }
        s.light.intensity = lerp(s.light.intensity, want, s.next ? 1 - Math.exp(-12 * dt) : ks);
        if (s.next && s.light.intensity < 0.05) placeSpot(s, s.next, false);
      }
      const ke = 1 - Math.exp(-4 * dt);
      for (const art of artworks) {
        const look = lookTarget === art;
        const emWant = look ? (m.id === "day" ? 0.1 : 0.32) : (m.id === "night" ? 0.015 : 0.04);
        art.mat.emissiveIntensity = lerp(art.mat.emissiveIntensity, emWant, ke);
      }
    }

    /* ================= 檢視器 ================= */
    function openArt(art) {
      if (!art || TOUR.on) return;
      editing = art;
      markSeen(art);
      $("iv-title").value = art.title;
      $("iv-artist").value = art.artist;
      $("iv-year").value = art.year;
      $("iv-desc").value = art.description;
      $("iv-img").src = art.srcURL || (art.placeholder ? art.placeholder.toDataURL("image/jpeg", 0.8) : "");
      if (VIEWONLY) {
        $("ivr-title").textContent = art.title || "";
        $("ivr-by").textContent = [art.artist, art.year].filter(Boolean).join(" · ");
        $("ivr-desc").textContent = art.description || "";
      }
      setStatus("");
      $("inspector").classList.add("open");
      document.querySelectorAll("#iv-frame [data-frame]").forEach((b) => {
        b.classList.toggle("on", b.dataset.frame === (art.frame || "gold"));
      });
      syncShapeUI(art);
      syncMatteUI(art);
      if (document.pointerLockElement) document.exitPointerLock();
      locked = false;
      setLook(null);
    }

    /* ================= v22 自動導覽 + 畫面錄影 ================= */
    const TOUR = { on: false, rec: false, t: 0, total: 0, tl: [], caps: [], len: 45, show: 45, ratio: "4:5", hall: "all", cap: true, pick: "some" };

    /* ================= v24 導覽字幕 =================
       錄影是 renderer.domElement.captureStream()，只抓 WebGL canvas，
       所以字幕不能用 HTML 疊層，必須掛在 camera 底下畫進 3D 場景。
       時間軸在 tourBuild() 一次算完，tourApply() 只用 t 算 alpha（可 seek、錄影不漂移）。 */
    const CAP_FONT = '"Microsoft JhengHei","PingFang TC","Noto Sans TC",sans-serif';   /* 與面板同一組字體 */
    const CAP = { mesh: null, tex: null, cv: null, ctx: null, cur: -1, dist: 1.2 };
    function capInit() {
      if (CAP.mesh || !camera) return;
      const cv = document.createElement("canvas");
      cv.width = 1024; cv.height = 256;
      const tex = new THREE.CanvasTexture(cv);
      if (THREE.SRGBColorSpace) tex.colorSpace = THREE.SRGBColorSpace;
      try { tex.anisotropy = Math.min(4, renderer.capabilities.getMaxAnisotropy()); } catch (e) {}
      const mat = new THREE.MeshBasicMaterial({ map: tex, transparent: true, opacity: 0, depthTest: false, depthWrite: false });
      mat.toneMapped = false;                       /* 不吃 ACES + exposure，白字才不會偏灰 */
      const mesh = new THREE.Mesh(new THREE.PlaneGeometry(1, 0.25), mat);
      mesh.renderOrder = 999;
      mesh.frustumCulled = false;
      mesh.visible = false;
      camera.add(mesh);
      if (!camera.parent) scene.add(camera);
      CAP.cv = cv; CAP.ctx = cv.getContext("2d"); CAP.tex = tex; CAP.mesh = mesh;
      capLayout();
    }
    function capLayout() {
      if (!CAP.mesh || !camera) return;
      const d = CAP.dist;
      const h = 2 * d * Math.tan(camera.fov * Math.PI / 360);
      const w = h * camera.aspect;
      const cw = Math.min(w * 0.88, h * 0.92);      /* 4:5 直式很窄：以短邊為準，字不會被切掉 */
      const ph = cw * (CAP.cv.height / CAP.cv.width);
      CAP.mesh.scale.set(cw, ph, 1);
      CAP.mesh.position.set(0, -h * 0.5 + h * 0.09 + ph * 0.5, -d);   /* 以字幕底邊對齊畫面下緣 9% */
    }
    function capDraw(art) {
      const ctx = CAP.ctx, cv = CAP.cv, W = cv.width, PAD = 60, TSZ = 152;
      const H = 260;
      if (cv.height !== H) { cv.height = H; capLayout(); }
      ctx.clearRect(0, 0, W, cv.height);
      ctx.textAlign = "center";
      ctx.textBaseline = "alphabetic";
      ctx.font = TSZ + "px " + CAP_FONT;                 /* 不加粗，與面板同樣的字重 */
      try { ctx.letterSpacing = Math.round(TSZ * 0.1) + "px"; } catch (e) {}   /* 面板的 0.1em 字距 */
      /* 只顯示標題，固定一行：太長就截字補省略號，不壓扁字形 */
      let t = String((art && art.title) || "");
      const maxW = W - PAD * 2;
      if (ctx.measureText(t).width > maxW) {
        while (t && ctx.measureText(t + "…").width > maxW) t = t.slice(0, -1);
        t += "…";
      }
      ctx.shadowColor = "rgba(0,0,0,0.85)"; ctx.shadowBlur = 34; ctx.shadowOffsetY = 4;
      ctx.fillStyle = "#f4ead7";                        /* var(--paper) */
      ctx.fillText(t, W / 2, 30 + TSZ);
      ctx.shadowBlur = 0; ctx.shadowOffsetY = 0;
      ctx.fillStyle = "rgba(198,161,91,0.75)";      /* var(--gold) 細線 */
      ctx.fillRect(W / 2 - 100, 30 + TSZ + 44, 200, 3);
      CAP.tex.needsUpdate = true;
    }
    function capApply(t) {
      if (!CAP.mesh) return;
      const caps = (TOUR.cap && TOUR.caps) || [];
      let cur = null, idx = -1;
      for (let i = 0; i < caps.length; i++) { if (t >= caps[i].t0 && t <= caps[i].t1) { cur = caps[i]; idx = i; break; } }
      if (!cur) { CAP.mesh.visible = false; CAP.mesh.material.opacity = 0; CAP.cur = -1; return; }
      if (idx !== CAP.cur) { capDraw(cur.art); CAP.cur = idx; }
      let a = 1;
      if (t < cur.tIn) a = (t - cur.t0) / Math.max(0.001, cur.tIn - cur.t0);
      else if (t > cur.tOut) a = 1 - (t - cur.tOut) / Math.max(0.001, cur.t1 - cur.tOut);
      a = Math.max(0, Math.min(1, a));
      CAP.mesh.visible = a > 0.003;
      CAP.mesh.material.opacity = a * a * (3 - 2 * a);   /* smoothstep：淡入淡出不生硬 */
    }
    function capOff() {
      if (!CAP.mesh) return;
      CAP.mesh.visible = false; CAP.mesh.material.opacity = 0; CAP.cur = -1;
    }
    const REC = { on: false, mr: null, chunks: [], ext: "webm", w: 0, h: 0,
      fmt: lsGet("gallery-rec-fmt") === "webp" ? "webp" : "video",
      webp: false, frames: [], busy: false, job: null, gcv: null, fps: 12, scale: 0.5 };
    let panoBusy = false;
    const PANO = { fmt: lsGet("gallery-pano-fmt") === "webp" ? "webp" : "jpg" };
    const REC_SIZES = { "4:5": [1080, 1350], "1:1": [1080, 1080], "16:9": [1920, 1080] };

    function tourAim(pos, target) {
      const dx = target.x - pos.x, dy = target.y - pos.y, dz = target.z - pos.z;
      const L = Math.hypot(dx, dy, dz) || 1;
      return { yaw: Math.atan2(-dx / L, -dz / L), pitch: Math.asin(Math.max(-1, Math.min(1, dy / L))) };
    }
    /* 依「西廳 → 主展間 → 東廳」取樣，每廳挑等距幾幅，長度越長挑越多 */
    function tourPicks() {
      const rooms = TOUR.hall === "all" ? ROOM_ORDER.slice() : [TOUR.hall];
      const groups = rooms
        .map((id) => artworks.filter((a) => a.room === id).sort((a, b) => String(a.id).localeCompare(String(b.id))))
        .filter((g) => g.length);
      if (!groups.length) return [];
      if (TOUR.pick === "all") { const all = []; groups.forEach((g) => g.forEach((a) => all.push(a))); return all; }
      const want = Math.max(6, Math.min(30, Math.round(TOUR.len / 3.4)));   /* 上限放寬到 30，長片才挑得更多幅 */
      const per = Math.max(1, Math.round(want / groups.length));
      const out = [];
      groups.forEach((g) => {
        const n = Math.min(per, g.length), step = g.length / n;
        for (let i = 0; i < n; i++) out.push(g[Math.min(g.length - 1, Math.floor(i * step + step / 2))]);
      });
      return out;
    }
    function tourBuild() {
      const picks = tourPicks();
      if (!picks.length) return false;
      const keys = [];
      let prevRoom = picks[0].room;
      picks.forEach((art, i) => {
        const inward = art.stand.clone().sub(art.lookAt); inward.y = 0; inward.normalize();
        const far = art.lookAt.clone().addScaledVector(inward, 3.9); far.y = PLAYER.h;
        const near = art.lookAt.clone().addScaledVector(inward, 2.15); near.y = PLAYER.h;
        if (i > 0 && art.room !== prevRoom) {
          /* 換廳：沿 z=0 穿過門洞，避免直線切牆 */
          doorsBetween(prevRoom, art.room).forEach(({ x, dir }) => {
            [x - dir * 3.5, x + dir * 0.1, x + dir * 3.5].forEach((gx) => keys.push({ p: new THREE.Vector3(gx, PLAYER.h, 0), look: null, hold: 0 }));
          });
        }
        keys.push({ p: far, look: art.lookAt, hold: 0 });
        keys.push({ p: near, look: art.lookAt, hold: 1, art: art });
        prevRoom = art.room;
      });
      /* 過門的視線朝行進方向 */
      keys.forEach((k, i) => {
        const look = k.look || (keys[i + 1] ? keys[i + 1].p : k.p.clone().add(new THREE.Vector3(0, 0, -1)));
        const a = tourAim(k.p, k.look ? look : new THREE.Vector3(look.x, PLAYER.h, look.z));
        k.yaw = a.yaw; k.pitch = k.look ? a.pitch : 0;
      });
      /* 依距離估時間，再整體縮放到指定長度 */
      const segs = [];
      const HOLD = TOUR.pick === "all" ? 3.0 : 1.6;     /* 每幅都看時停 3 秒，看得完也讀得完畫名 */
      let raw = 0;
      for (let i = 1; i < keys.length; i++) {
        const d = keys[i].p.distanceTo(keys[i - 1].p);
        const t = 0.45 + d * 0.26;
        segs.push({ type: "move", a: i - 1, b: i, dur: t });
        raw += t;
        if (keys[i].hold) { segs.push({ type: "hold", a: i, dur: HOLD }); raw += HOLD; }
      }
      if (keys[0].hold) { segs.unshift({ type: "hold", a: 0, dur: HOLD }); raw += HOLD; }
      const full = TOUR.pick === "all";                 /* 每幅都看：維持自然節奏，不壓縮 */
      const f = full ? 1 : (raw > 0 ? TOUR.len / raw : 1);
      let acc = 0;
      segs.forEach((sg) => { sg.dur *= f; sg.t0 = acc; acc += sg.dur; });
      TOUR.show = full ? Math.max(1, Math.round(acc)) : TOUR.len;
      TOUR.keys = keys; TOUR.tl = segs; TOUR.total = acc; TOUR.t = 0;
      /* 字幕：提前在前一段運鏡的尾端就浮出，鏡頭推近時字已經在了 */
      TOUR.caps = segs.filter((sg) => sg.type === "hold" && keys[sg.a] && keys[sg.a].art).map((sg) => {
        const inDur = Math.min(0.45, sg.dur * 0.45);
        const outDur = Math.min(0.35, sg.dur * 0.35);
        const lead = Math.min(0.55, sg.t0);
        const t0 = sg.t0 - lead;
        const tOut = sg.t0 + sg.dur - outDur * 0.4;
        return { art: keys[sg.a].art, t0: t0, tIn: t0 + inDur, tOut: tOut, t1: tOut + outDur };
      });
      return segs.length > 0;
    }
    function tourApply(t) {
      const tl = TOUR.tl, keys = TOUR.keys;
      if (!tl || !tl.length) return;
      let sg = tl[tl.length - 1];
      for (let i = 0; i < tl.length; i++) { if (t < tl[i].t0 + tl[i].dur) { sg = tl[i]; break; } }
      let p, yaw, pitch;
      if (sg.type === "hold") {
        const k = keys[sg.a];
        p = k.p; yaw = k.yaw; pitch = k.pitch;
      } else {
        const a = keys[sg.a], b = keys[sg.b];
        let u = sg.dur > 0 ? (t - sg.t0) / sg.dur : 1;
        u = Math.max(0, Math.min(1, u));
        const e = u * u * (3 - 2 * u);                    /* smoothstep：起步與煞車都平順 */
        p = a.p.clone().lerp(b.p, e);
        let dy = b.yaw - a.yaw;
        while (dy > Math.PI) dy -= Math.PI * 2;
        while (dy < -Math.PI) dy += Math.PI * 2;
        yaw = a.yaw + dy * e;
        pitch = a.pitch + (b.pitch - a.pitch) * e;
      }
      camera.position.copy(p);
      setCamAngles(yaw, pitch);
      const sec = Math.min(TOUR.show, Math.round(t));
      $("tour-time").textContent = sec + " / " + Math.round(TOUR.show) + "s";
      capApply(t);
    }
    function tourTick(dt) {
      TOUR.t += dt;
      tourApply(Math.min(TOUR.t, TOUR.total));
      if (TOUR.t >= TOUR.total) tourStop();
    }
    function tourStart(record) {
      if (TOUR.on) return;
      if (!artworks.length) { toast("展廳還在掛畫，請稍候。", true); return; }
      if (FLY.on) flyStop();
      if (HB.on) hbStop();
      if (DOG.on) dogStop();
      if (DRONE.on) droneStop();
      if (record && REC.fmt === "webp" && !webpEncodeOK()) {
        toast("這個瀏覽器無法產生 WebP，改用影片錄影。", true);
        REC.fmt = "video";
        document.querySelectorAll('#rec-fmt [data-vfmt]').forEach((b) => b.classList.toggle("on", b.dataset.vfmt === "video"));
      }
      if (record && REC.fmt !== "webp" && !recSupported()) { toast("這個瀏覽器不支援畫面錄影，請改用螢幕錄影。", true); record = false; }
      closeArt();
      if (!exploring) enter();
      if (document.pointerLockElement) document.exitPointerLock();
      move = { f: 0, b: 0, l: 0, r: 0, run: 0 };
      wheelBoost = 0;
      if (!tourBuild()) return;
      TOUR.on = true; TOUR.rec = !!record;
      document.body.classList.add("touring");
      $("tour-hud").classList.add("show");
      $("tour-hud").classList.toggle("rec", !!record);
      $("tour-state").textContent = record ? "錄影中" : "導覽中";
      capInit();
      capLayout();
      if (record) recStart();
      tourApply(0);
      markShadow();
    }
    function tourStop() {
      if (!TOUR.on) return;
      TOUR.on = false;
      document.body.classList.remove("touring");
      $("tour-hud").classList.remove("show", "rec");
      capOff();
      if (TOUR.rec) recStop();
      TOUR.rec = false;
    }
    function bindTour() {
      const segPick = (id, key, apply) => {
        const bar = $(id);
        if (!bar) return;
        bar.addEventListener("click", (e) => {
          const b = e.target.closest("button[data-" + key + "]");
          if (!b) return;
          apply(b.dataset[key]);
          bar.querySelectorAll("button").forEach((x) => x.classList.toggle("on", x === b));
        });
      };
      segPick("pick-hall", "hall", (v) => { TOUR.hall = v; });
      segPick("rec-ratio", "ratio", (v) => { TOUR.ratio = v; });
      segPick("rec-len", "len", (v) => { TOUR.len = parseInt(v, 10) || 45; });
      segPick("rec-pick", "pick", (v) => {
        TOUR.pick = v;
        if (v === "all") toast("每幅都看：每幅停 3 秒，長度由實際路線決定，全部三廳約 3 分鐘。", true);
      });
      segPick("rec-cap", "cap", (v) => { TOUR.cap = v === "1"; if (!TOUR.cap) capOff(); });
      document.querySelectorAll('#rec-pick [data-pick]').forEach((b) => b.classList.toggle("on", b.dataset.pick === TOUR.pick));
      document.querySelectorAll('#rec-cap [data-cap]').forEach((b) => b.classList.toggle("on", (b.dataset.cap === "1") === TOUR.cap));
      document.querySelectorAll('#rec-ratio [data-ratio]').forEach((b) => b.classList.toggle("on", b.dataset.ratio === TOUR.ratio));
      document.querySelectorAll('#rec-len [data-len]').forEach((b) => b.classList.toggle("on", +b.dataset.len === TOUR.len));
      document.querySelectorAll('#pick-hall [data-hall]').forEach((b) => b.classList.toggle("on", b.dataset.hall === TOUR.hall));
      segPick("rec-fmt", "vfmt", (v) => {
        REC.fmt = v === "webp" ? "webp" : "video"; lsSet("gallery-rec-fmt", REC.fmt);
        if (REC.fmt === "webp") toast("動態 WebP：逐格輸出（12 fps、半解析度），產生時間比實際長度久，檔案也比影片大，請耐心等候。", true);
      });
      document.querySelectorAll('#rec-fmt [data-vfmt]').forEach((b) => b.classList.toggle("on", b.dataset.vfmt === REC.fmt));
      segPick("pano-fmt", "fmt", (v) => { PANO.fmt = v === "webp" ? "webp" : "jpg"; lsSet("gallery-pano-fmt", PANO.fmt); });
      document.querySelectorAll('#pano-fmt [data-fmt]').forEach((b) => b.classList.toggle("on", b.dataset.fmt === PANO.fmt));
      if ($("pano-btn")) $("pano-btn").onclick = () => panoExport();
      if ($("tour-btn")) $("tour-btn").onclick = () => tourStart(false);
      if ($("rec-btn")) $("rec-btn").onclick = () => tourStart(true);
      /* v59：MP4／WebP 快速錄影鈕：切換格式後直接開始錄 */
      const recAs = (fmt) => {
        REC.fmt = fmt === "webp" ? "webp" : "video"; REC.wantMp4 = fmt === "mp4";
        lsSet("gallery-rec-fmt", REC.fmt);
        document.querySelectorAll('#rec-fmt [data-vfmt]').forEach((b) => b.classList.toggle("on", b.dataset.vfmt === REC.fmt));
        tourStart(true);
      };
      if ($("rec-mp4")) $("rec-mp4").onclick = (e) => { e.currentTarget.blur(); recAs("mp4"); };
      if ($("rec-webp")) $("rec-webp").onclick = (e) => { e.currentTarget.blur(); recAs("webp"); };
      if ($("tour-stop")) $("tour-stop").onclick = () => tourStop();
    }

    /* ---- 錄影：直接擷取 canvas，UI 不會入鏡 ---- */
    function recSupported() {
      return typeof MediaRecorder !== "undefined" && !!renderer && typeof renderer.domElement.captureStream === "function";
    }
    function recMime(audio) {
      const list = (audio ? ["video/mp4;codecs=avc1.42E01E,mp4a.40.2", "video/mp4;codecs=avc1,mp4a.40.2", "video/webm;codecs=vp9,opus", "video/webm;codecs=vp8,opus"] : []).concat(["video/mp4;codecs=avc1.42E01E", "video/mp4", "video/webm;codecs=vp9", "video/webm;codecs=vp8", "video/webm"]);
      for (const t of list) { try { if (MediaRecorder.isTypeSupported(t)) return t; } catch (e) {} }
      return "";
    }
    function recLayout() {
      if (!REC.on || !renderer) return;
      const c = renderer.domElement;
      const s = Math.min(innerWidth / REC.w, innerHeight / REC.h);
      c.style.position = "fixed";
      c.style.width = (REC.w * s).toFixed(0) + "px";
      c.style.height = (REC.h * s).toFixed(0) + "px";
      c.style.left = ((innerWidth - REC.w * s) / 2).toFixed(0) + "px";
      c.style.top = ((innerHeight - REC.h * s) / 2).toFixed(0) + "px";
    }
    function recSizeOn() {
      const sz = REC_SIZES[TOUR.ratio] || REC_SIZES["1:1"];
      REC.w = sz[0]; REC.h = sz[1];
      renderer.setPixelRatio(1);
      renderer.setSize(REC.w, REC.h, false);     /* 固定輸出解析度，不跟著視窗跑 */
      camera.aspect = REC.w / REC.h;
      camera.updateProjectionMatrix();
      capLayout();
      document.body.classList.add("recfit");
      recLayout();
      markShadow();
    }
    function recSizeOff() {
      document.body.classList.remove("recfit");
      const c = renderer.domElement;
      c.style.position = ""; c.style.left = ""; c.style.top = ""; c.style.width = ""; c.style.height = "";
      renderer.setPixelRatio(PERF.dpr);
      onResize();
      markShadow();
    }
    function recStart() {
      if (REC.fmt === "webp") {
        REC.on = true; REC.webp = true;
        recSizeOn();
        REC.frames = []; REC.busy = false; REC.job = null;
        REC.gcv = document.createElement("canvas");
        REC.gcv.width = Math.round(REC.w * REC.scale);
        REC.gcv.height = Math.round(REC.h * REC.scale);
        $("tour-state").textContent = "錄影中 · WebP";
        return;
      }
      try {
        REC.on = true;
        recSizeOn();
        const stream = renderer.domElement.captureStream(30);
        const aud = musicStream();                     /* v33：配樂一起錄 */
        const tracks = aud ? aud.getAudioTracks() : [];
        tracks.forEach((t) => stream.addTrack(t));
        let mime = recMime(tracks.length > 0);
        REC.chunks = [];
        try {
          REC.mr = new MediaRecorder(stream, mime ? { mimeType: mime, videoBitsPerSecond: 12000000, audioBitsPerSecond: 160000 } : {});
        } catch (err) {
          if (!tracks.length) throw err;
          tracks.forEach((t) => stream.removeTrack(t));   /* 瀏覽器不收音軌 → 只錄畫面 */
          mime = recMime(false);
          REC.mr = new MediaRecorder(stream, mime ? { mimeType: mime, videoBitsPerSecond: 12000000 } : {});
        }
        REC.ext = mime.indexOf("mp4") >= 0 ? "mp4" : "webm";
        if (REC.wantMp4 && REC.ext !== "mp4") toast("這個瀏覽器無法直接錄 MP4，改存 WebM（Chrome／Edge／Safari 可錄 MP4）。", true);
        REC.wantMp4 = false;
        REC.mr.ondataavailable = (e) => { if (e.data && e.data.size) REC.chunks.push(e.data); };
        REC.mr.onstop = recSave;
        REC.mr.start(400);
      } catch (e) {
        REC.on = false;
        recSizeOff();
        TOUR.rec = false;
        $("tour-hud").classList.remove("rec");
        $("tour-state").textContent = "導覽中";
        toast("錄影啟動失敗：" + ((e && e.message) || e), true);
      }
    }
    function recStop() {
      if (REC.webp) { if (REC.on) recSaveWebP(); return; }
      const mr = REC.mr;
      REC.mr = null;
      if (mr && mr.state !== "inactive") { try { mr.stop(); } catch (e) {} }
      else if (REC.on) { REC.on = false; recSizeOff(); }
    }
    async function recSave() {
      const blob = new Blob(REC.chunks, { type: REC.ext === "mp4" ? "video/mp4" : "video/webm" });
      REC.chunks = [];
      REC.on = false;
      recSizeOff();
      const name = `${fileSafe(HALL.name)}-導覽-${TOUR.ratio.replace(":", "x")}-${mmdd()}.${REC.ext}`;
      await recDeliver(blob, name);
    }
    async function recDeliver(blob, name, extra) {
      const mb = fmtSize(blob.size);
      let shared = false;
      if (TOUCH && typeof File === "function" && navigator.canShare) {
        try {
          const file = new File([blob], name, { type: blob.type });
          if (navigator.canShare({ files: [file] })) { await navigator.share({ files: [file], title: name }); shared = true; }
        } catch (e) {}
      }
      if (!shared) {
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url; a.download = name;
        document.body.appendChild(a); a.click(); a.remove();
        setTimeout(() => URL.revokeObjectURL(url), 60000);
      }
      toast(`已產生「${name}」（${mb}）${extra || ""}`);
    }

    /* ---- v26 動態 WebP：逐格固定步長算圖 → canvas 編 WebP → 自組 ANIM/ANMF ---- */
    let WEBP_OK = null;
    function webpEncodeOK() {
      if (WEBP_OK === null) {
        try { const c = document.createElement("canvas"); c.width = c.height = 1; WEBP_OK = c.toDataURL("image/webp").indexOf("data:image/webp") === 0; }
        catch (e) { WEBP_OK = false; }
      }
      return WEBP_OK;
    }
    function riffChunk(id, payload) {
      const pad = payload.length & 1;
      const c = new Uint8Array(8 + payload.length + pad);
      for (let i = 0; i < 4; i++) c[i] = id.charCodeAt(i);
      const n = payload.length;
      c[4] = n & 255; c[5] = (n >> 8) & 255; c[6] = (n >> 16) & 255; c[7] = (n >>> 24) & 255;
      c.set(payload, 8);
      return c;
    }
    function put24(a, o, v) { a[o] = v & 255; a[o + 1] = (v >> 8) & 255; a[o + 2] = (v >> 16) & 255; }
    /* 從單張 WebP 取出影像資料（ALPH / VP8 / VP8L） */
    function webpFrameData(buf) {
      const tag = (o) => String.fromCharCode(buf[o], buf[o + 1], buf[o + 2], buf[o + 3]);
      if (tag(0) !== "RIFF" || tag(8) !== "WEBP") return null;
      const keep = [];
      let alpha = false, len = 0;
      for (let o = 12; o + 8 <= buf.length;) {
        const sz = (buf[o + 4] | (buf[o + 5] << 8) | (buf[o + 6] << 16) | (buf[o + 7] << 24)) >>> 0;
        const end = Math.min(buf.length, o + 8 + sz + (sz & 1));
        const id = tag(o);
        if (id === "ALPH" || id === "VP8 " || id === "VP8L") {
          keep.push(buf.slice(o, end)); len += end - o;
          if (id === "ALPH" || id === "VP8L") alpha = alpha || id === "ALPH";
        }
        o = end;
      }
      if (!keep.length) return null;
      const data = new Uint8Array(len);
      let p = 0;
      keep.forEach((k) => { data.set(k, p); p += k.length; });
      return { data, alpha };
    }
    function buildAnimWebP(frames, W, H, fps) {
      const parts = [];
      const x = new Uint8Array(10);
      x[0] = 0x02 | (frames.some((f) => f.alpha) ? 0x10 : 0);
      put24(x, 4, W - 1); put24(x, 7, H - 1);
      parts.push(riffChunk("VP8X", x));
      parts.push(riffChunk("ANIM", new Uint8Array([0, 0, 0, 255, 0, 0])));   /* 背景黑、無限循環 */
      frames.forEach((f, i) => {
        const dur = Math.max(1, Math.round((i + 1) * 1000 / fps) - Math.round(i * 1000 / fps));
        const pl = new Uint8Array(16 + f.data.length);
        put24(pl, 0, 0); put24(pl, 3, 0);
        put24(pl, 6, W - 1); put24(pl, 9, H - 1);
        put24(pl, 12, dur);
        pl[15] = 0x02;                                  /* 不混合、不清除 */
        pl.set(f.data, 16);
        parts.push(riffChunk("ANMF", pl));
      });
      const total = 12 + parts.reduce((a, q) => a + q.length, 0);
      const out = new Uint8Array(total);
      out.set([82, 73, 70, 70], 0);
      const rs = total - 8;
      out[4] = rs & 255; out[5] = (rs >> 8) & 255; out[6] = (rs >> 16) & 255; out[7] = (rs >>> 24) & 255;
      out.set([87, 69, 66, 80], 8);
      let o = 12;
      parts.forEach((q) => { out.set(q, o); o += q.length; });
      return new Blob([out], { type: "image/webp" });
    }
    function recGrab() {
      const g = REC.gcv;
      if (!g) return;
      const ctx = g.getContext("2d");
      ctx.fillStyle = "#000";
      ctx.fillRect(0, 0, g.width, g.height);
      ctx.drawImage(renderer.domElement, 0, 0, g.width, g.height);   /* 同一個 frame 內讀，免 preserveDrawingBuffer */
      REC.busy = true;
      REC.job = new Promise((res) => {
        g.toBlob(async (b) => {
          try {
            if (b) {
              const f = webpFrameData(new Uint8Array(await b.arrayBuffer()));
              if (f) REC.frames.push(f);
            }
          } catch (e) {}
          REC.busy = false;
          res();
        }, "image/webp", 0.8);
      });
      $("tour-state").textContent = "錄影中 · WebP " + (REC.frames.length + 1) + " 格";
    }
    async function recSaveWebP() {
      REC.on = false;
      const g = REC.gcv;
      recSizeOff();
      try {
        toast("正在組合動態 WebP…");
        if (REC.job) await REC.job;
        const frames = REC.frames;
        REC.frames = []; REC.gcv = null; REC.job = null;
        if (!frames.length || !g) { toast("沒有錄到任何畫面。", true); return; }
        const blob = buildAnimWebP(frames, g.width, g.height, REC.fps);
        const name = `${fileSafe(HALL.name)}-導覽-${TOUR.ratio.replace(":", "x")}-${mmdd()}.webp`;
        await recDeliver(blob, name, ` · ${g.width}×${g.height} · ${frames.length} 格 · ${REC.fps} fps`);
      } catch (e) {
        toast("WebP 輸出失敗：" + ((e && e.message) || e), true);
      } finally {
        REC.webp = false; REC.busy = false;
      }
    }

    /* ================= v27 Fly 果蠅模式 =================
       狀態機：wander（房內隨機亂飛）→ approach（飛向某幅畫）→ perch（停在畫前 0.6 m 看 2～3.5 秒）
       轉向用「目標吸引 + 雜訊擺動」，碰牆反彈；跨廳走門洞中心點。任何 W/A/D＋↓／滾輪／點擊即交還控制。 */
    const FLY = { on: false, pos: null, vel: null, path: [], mode: "wander", hold: 0, art: null,
      t: 0, yaw: 0, pitch: 0, roll: 0, dash: 0, seen: [], exit: null };
    const FLY_SPEED = 1.6, FLY_DASH = 3.6;
    function flyRoomBox(id) {
      const r = LAYOUT.find((x) => x.id === id);
      const m = 0.45;
      return r ? { id: r.id, minX: r.cx - r.w / 2 + m, maxX: r.cx + r.w / 2 - m, minZ: r.cz - r.d / 2 + m, maxZ: r.cz + r.d / 2 - m,
        minY: 0.45, maxY: Math.min(r.h - 0.6, 5.2) } : null;
    }
    function flyRoomAt(p) {
      for (const r of LAYOUT) {
        if (Math.abs(p.x - r.cx) <= r.w / 2 && Math.abs(p.z - r.cz) <= r.d / 2) return r.id;
      }
      return null;
    }
    /* 允許的空間：三個房間（內縮）＋兩個門洞通道 */
    function flyFree(p) {
      for (const r of LAYOUT) {
        const b = flyRoomBox(r.id);
        if (p.x >= b.minX && p.x <= b.maxX && p.z >= b.minZ && p.z <= b.maxZ && p.y >= b.minY && p.y <= b.maxY) return true;
      }
      const hw = DOOR_W / 2 - 0.35;
      if (nearDoor(p.x, 0.9) && Math.abs(p.z) <= hw && p.y >= 0.45 && p.y <= DOOR_H - 0.4) return true;
      return false;
    }
    function flyRand(a, b) { return a + Math.random() * (b - a); }
    function flyWanderPoint(roomId) {
      const b = flyRoomBox(roomId) || flyRoomBox("hall");
      return new THREE.Vector3(flyRand(b.minX + 1, b.maxX - 1), flyRand(1.0, Math.min(b.maxY, 4.2)), flyRand(b.minZ + 1, b.maxZ - 1));
    }
    function flyDoorPath(from, to) {
      if (from === to || !from || !to) return [];
      const out = [];
      doorsBetween(from, to).forEach(({ x, dir }) => {
        out.push(new THREE.Vector3(x - dir * 2.2, 2.0, 0), new THREE.Vector3(x, 2.0, 0), new THREE.Vector3(x + dir * 2.2, 2.0, 0));
      });
      return out;
    }
    function flyPlan() {
      const here = flyRoomAt(FLY.pos) || curRoomId || "hall";
      const r = Math.random();
      FLY.path = [];
      if (r < 0.55 && artworks.length) {
        /* 挑一幅最近沒看過的畫；七成在同廳 */
        const pool0 = artworks.filter((a) => FLY.seen.indexOf(a) < 0);
        const pool = pool0.length ? pool0 : artworks;
        const same = pool.filter((a) => a.room === here);
        const list = (same.length && Math.random() < 0.7) ? same : pool;
        const art = list[Math.floor(Math.random() * list.length)];
        const inward = art.stand.clone().sub(art.lookAt); inward.y = 0; inward.normalize();
        const perch = art.lookAt.clone().addScaledVector(inward, flyRand(0.55, 0.85));
        perch.y = art.lookAt.y + flyRand(-0.25, 0.2);
        perch.x += inward.z * flyRand(-0.25, 0.25);
        perch.z -= inward.x * flyRand(-0.25, 0.25);
        const front = art.lookAt.clone().addScaledVector(inward, 2.2); front.y = perch.y + 0.3;
        FLY.path = flyDoorPath(here, art.room).concat([front, perch]);
        FLY.art = art;
        FLY.mode = "approach";
      } else if (r < 0.7) {
        const rooms = ROOM_ORDER.filter((x) => x !== here);
        const to = rooms[Math.floor(Math.random() * rooms.length)];
        FLY.path = flyDoorPath(here, to).concat([flyWanderPoint(to)]);
        FLY.art = null; FLY.mode = "wander";
      } else {
        const n = 1 + Math.floor(Math.random() * 3);
        for (let i = 0; i < n; i++) FLY.path.push(flyWanderPoint(here));
        FLY.art = null; FLY.mode = "wander";
        if (Math.random() < 0.35) FLY.dash = flyRand(0.4, 0.9);   /* 偶爾衝刺 */
      }
    }
    function flySetState(txt) { const el = $("fly-state"); if (el) el.textContent = txt; }
    function flyStart() {
      if (FLY.on) return;
      if (HB.on) hbStop();
      if (DOG.on) dogStop();
      if (!artworks.length) { toast("展廳還在掛畫，請稍候。", true); return; }
      if (TOUR.on) tourStop();
      if (DRONE.on) droneStop();
      if (HB.on) hbStop();
      if (DOG.on) dogStop();
      closeArt();
      if (!exploring) enter();
      if (document.pointerLockElement) document.exitPointerLock();
      move = { f: 0, b: 0, l: 0, r: 0, run: 0 };
      wheelBoost = 0;
      FLY.on = true;
      FLY.pos = camera.position.clone();
      FLY.pos.y = PLAYER.h;
      FLY.vel = new THREE.Vector3(-Math.sin(yaw), 0.3, -Math.cos(yaw)).multiplyScalar(FLY_SPEED * 0.6);
      FLY.yaw = yaw; FLY.pitch = pitch; FLY.roll = 0; FLY.t = 0; FLY.hold = 0; FLY.dash = 0; FLY.seen = [];
      flyPlan();
      document.body.classList.add("flying");
      $("fly-btn").classList.add("on");
      flySetState("飛行中 · F／Esc 結束");
      toast("🪰 果蠅起飛！按 F、Esc、W/A/D＋↓ 或點畫面即可接手。");
    }
    function flyStop() {
      if (!FLY.on) return;
      FLY.on = false;
      document.body.classList.remove("flying");
      $("fly-btn").classList.remove("on");
      flySetState("");
      /* 降落回人眼高度；若停在牆邊超出可走範圍，往房間中心退回 */
      const p = camera.position;
      p.y = PLAYER.h;
      const rid = flyRoomAt(p) || curRoomId || "hall";
      const r = LAYOUT.find((x) => x.id === rid);
      for (let i = 0; i < 60 && !inside(p.x, p.z); i++) {
        p.x += (r.cx - p.x) * 0.08;
        p.z += (r.cz - p.z) * 0.08;
      }
      setCamAngles(FLY.yaw, Math.max(-0.4, Math.min(0.4, FLY.pitch)));
    }
    function flyToggle() { if (FLY.on) flyStop(); else flyStart(); }
    function flyTick(dt) {
      if (!exploring) return;
      FLY.t += dt;
      const t = FLY.t, pos = FLY.pos, vel = FLY.vel;
      let lookYaw, lookPitch;
      if (FLY.mode === "perch") {
        /* 停在畫前：幾乎不動，只有細微抖動，視線對準畫 */
        FLY.hold -= dt;
        vel.multiplyScalar(Math.exp(-8 * dt));
        pos.addScaledVector(vel, dt);
        const a = tourAim(pos, FLY.art.lookAt);
        lookYaw = a.yaw + Math.sin(t * 1.7) * 0.05;
        lookPitch = a.pitch + Math.sin(t * 2.3) * 0.03;
        if (FLY.hold <= 0) {
          FLY.seen.push(FLY.art);
          if (FLY.seen.length > 12) FLY.seen.shift();
          /* 起飛：先往後彈開 */
          const back = FLY.art.stand.clone().sub(FLY.art.lookAt); back.y = 0; back.normalize();
          vel.copy(back).multiplyScalar(2.4); vel.y = 0.8;
          FLY.dash = 0.35;
          flyPlan();
          flySetState("飛行中 · F／Esc 結束");
        }
      } else {
        if (!FLY.path.length) flyPlan();
        const target = FLY.path[0];
        const to = TMP.dir.copy(target).sub(pos);
        const dist = to.length();
        const last = FLY.path.length === 1;
        let spd = FLY.dash > 0 ? FLY_DASH : FLY_SPEED;
        FLY.dash = Math.max(0, FLY.dash - dt);
        if (last && FLY.mode === "approach") spd *= Math.min(1, 0.25 + dist / 1.6);   /* 接近畫時減速 */
        const desired = to.normalize().multiplyScalar(spd);
        /* 果蠅式擺動：多頻率正弦疊加的側向與上下雜訊 */
        const wob = (FLY.mode === "approach" && last && dist < 1.2) ? 0.25 : 1;
        desired.x += (Math.sin(t * 3.1) + 0.6 * Math.sin(t * 7.3 + 1.3)) * 0.55 * wob;
        desired.z += (Math.cos(t * 2.7) + 0.6 * Math.sin(t * 6.1 + 0.4)) * 0.55 * wob;
        desired.y += (Math.sin(t * 4.3) + 0.5 * Math.cos(t * 9.7)) * 0.35 * wob;
        vel.lerp(desired, 1 - Math.exp(-3.2 * dt));
        /* 移動＋碰牆反彈（逐軸） */
        const nx = pos.x + vel.x * dt, ny = pos.y + vel.y * dt, nz = pos.z + vel.z * dt;
        TMP.fwd.set(nx, pos.y, pos.z);
        if (flyFree(TMP.fwd)) pos.x = nx; else vel.x *= -0.6;
        TMP.fwd.set(pos.x, ny, pos.z);
        if (flyFree(TMP.fwd)) pos.y = ny; else vel.y *= -0.6;
        TMP.fwd.set(pos.x, pos.y, nz);
        if (flyFree(TMP.fwd)) pos.z = nz; else vel.z *= -0.6;
        FLY.segT = (FLY.segT || 0) + dt;
        if (FLY.segT > 10 && !(last && FLY.mode === "approach" && dist < 0.9)) { FLY.segT = 0; flyPlan(); }   /* 卡住就換目標 */
        else if (dist < (last ? 0.18 : 0.6) || (last && FLY.mode === "approach" && FLY.segT > 10)) {
          FLY.segT = 0;
          FLY.path.shift();
          if (!FLY.path.length) {
            if (FLY.mode === "approach" && FLY.art) {
              FLY.mode = "perch";
              FLY.hold = flyRand(2.2, 3.6);
              flySetState("停在「" + (FLY.art.title || "畫作") + "」");
            } else flyPlan();
          }
        }
        /* 頭朝飛行方向；接近畫時提前轉向畫 */
        const hv = Math.hypot(vel.x, vel.z);
        if (FLY.mode === "approach" && last && dist < 2.6) {
          const a = tourAim(pos, FLY.art.lookAt);
          lookYaw = a.yaw; lookPitch = a.pitch;
        } else {
          lookYaw = hv > 0.05 ? Math.atan2(-vel.x, -vel.z) : FLY.yaw;
          lookPitch = Math.atan2(vel.y, Math.max(0.3, hv)) * 0.6;
        }
      }
      /* 平滑轉向 + 依轉彎角速度側傾 */
      let dy = lookYaw - FLY.yaw;
      while (dy > Math.PI) dy -= Math.PI * 2;
      while (dy < -Math.PI) dy += Math.PI * 2;
      const k = 1 - Math.exp(-3.5 * dt);
      FLY.yaw += dy * k;
      FLY.pitch += (Math.max(-1.1, Math.min(1.1, lookPitch)) - FLY.pitch) * k;
      const rollTarget = Math.max(-0.35, Math.min(0.35, -dy * 0.6)) + Math.sin(t * 11) * 0.012;
      FLY.roll += (rollTarget - FLY.roll) * (1 - Math.exp(-4 * dt));
      /* 翅膀震動造成的高頻微抖 */
      const buzz = FLY.mode === "perch" ? 0.002 : 0.006;
      camera.position.set(pos.x + Math.sin(t * 53) * buzz, pos.y + Math.sin(t * 61 + 1) * buzz, pos.z + Math.cos(t * 47) * buzz);
      yaw = FLY.yaw; pitch = FLY.pitch;
      camera.rotation.set(FLY.pitch, FLY.yaw, FLY.roll, "YXZ");
    }

    /* ================= v29 Drone FPV 無人機模式 =================
       滑鼠控制：游標推到畫面邊緣（中央 45% 為死區）→ 左右轉向／上下升降；滾輪＝油門。
       W／↓ 前後、A/D 橫移、Space/E 上升、C/Q 下降、Shift 加速。
       停手 0.5 秒 → 自動飛到最近一幅畫的正前方「賞畫距離」（畫框剛好填滿視野）並正對。
       點畫 → 俯衝進入畫中（FOV 收窄＋閃光）→ 開大圖；關閉大圖即退回賞畫位置。 */
    const DRONE = { on: false, pos: null, vel: null, yaw: 0, pitch: 0, roll: 0, thr: 0, ku: 0,
      cx: 0, cy: 0, mx: 0, my: 0, mIn: false, mode: "free", art: null, lock: null, idle: 0,
      dive: null, t: 0, fov: 68, osdT: 0 };
    const DRONE_MAX = 4.2;
    function droneInward(art) {
      const v = art.stand.clone().sub(art.lookAt); v.y = 0; return v.normalize();
    }
    function droneViewDist(art) {
      const vf = camera.fov * Math.PI / 360;
      const hf = Math.atan(Math.tan(vf) * camera.aspect);
      const w = (art.pw || 2.44) * 1.12, h = (art.ph || 3.05) * 1.12;
      return Math.max(1.2, Math.min(4.5, Math.max(h / 2 / Math.tan(vf), w / 2 / Math.tan(hf))));
    }
    function droneSpot(art) {
      const inward = droneInward(art);
      const p = art.lookAt.clone().addScaledVector(inward, droneViewDist(art));
      for (let i = 0; i < 40 && !flyFree(p); i++) p.addScaledVector(inward, -0.08);
      return { p, yaw: Math.atan2(inward.x, inward.z) };
    }
    function droneFindArt() {
      const D = DRONE, pos = D.pos, here = flyRoomAt(pos);
      const fx = -Math.sin(D.yaw), fz = -Math.cos(D.yaw);
      let best = null, bs = 1e9;
      for (const a of artworks) {
        if (here && a.room !== here) continue;
        const inw = droneInward(a);
        const rx = pos.x - a.lookAt.x, rz = pos.z - a.lookAt.z;
        if (rx * inw.x + rz * inw.z < 0.4) continue;          /* 必須在畫的正面 */
        const d = Math.hypot(rx, rz);
        if (d > 20) continue;
        const c = (-rx * fx - rz * fz) / (d || 1);             /* 與機頭方向夾角 */
        if (c < 0.6) continue;
        const sc = d + (1 - c) * 10;
        if (sc < bs) { bs = sc; best = a; }
      }
      return best;
    }
    function droneMode(m, art) {
      DRONE.mode = m;
      const t = art && art.title ? "「" + art.title + "」" : "";
      const txt = m === "align" ? "對正中 " + t : m === "lock" ? "已對正 " + t + " · 點畫進入" :
        m === "dive" ? "進入畫中…" : m === "inside" ? "畫中" : "手動飛行";
      $("d-mode").textContent = txt;
      flySetState(m === "free" ? "無人機 · V／Esc 結束" : txt);
      $("drone-osd").classList.toggle("lock", m === "lock");
    }
    function droneStart() {
      if (DRONE.on) return;
      if (TOUCH) { toast("Drone FPV 需要滑鼠操作，平板請用 Fly 模式。", true); return; }
      if (!artworks.length) { toast("展廳還在掛畫，請稍候。", true); return; }
      if (FLY.on) flyStop();
      if (HB.on) hbStop();
      if (DOG.on) dogStop();
      if (TOUR.on) tourStop();
      closeArt();
      if (!exploring) enter();
      if (document.pointerLockElement) document.exitPointerLock();
      move = { f: 0, b: 0, l: 0, r: 0, run: 0 };
      wheelBoost = 0;
      const D = DRONE;
      D.on = true;
      D.pos = camera.position.clone();
      D.vel = new THREE.Vector3(0, 0.6, 0);
      D.yaw = yaw; D.pitch = pitch; D.roll = 0; D.thr = 0; D.ku = 0; D.idle = 0; D.t = 0;
      D.art = null; D.lock = null; D.dive = null; D.mIn = false;
      D.fov = camera.fov;
      document.body.classList.add("droning");
      $("drone-btn").classList.add("on");
      droneMode("free");
      toast("🚁 Drone FPV：游標推到邊緣轉向／升降、滾輪前進；停手會自動正對畫，點畫進入畫中。");
    }
    function droneStop() {
      const D = DRONE;
      if (!D.on) return;
      D.on = false;
      D.mode = "free";
      camera.fov = D.fov; camera.updateProjectionMatrix();
      $("drone-flash").style.opacity = 0;
      document.body.classList.remove("droning");
      $("drone-btn").classList.remove("on");
      flySetState("");
      setLook(null);
      renderer.domElement.style.cursor = "";
      const p = camera.position;
      p.y = PLAYER.h;
      const rid = flyRoomAt(p) || curRoomId || "hall";
      const r = LAYOUT.find((x) => x.id === rid);
      for (let i = 0; i < 60 && !inside(p.x, p.z); i++) {
        p.x += (r.cx - p.x) * 0.08;
        p.z += (r.cz - p.z) * 0.08;
      }
      setCamAngles(D.yaw, Math.max(-0.4, Math.min(0.4, D.pitch)));
    }
    function droneToggle() { if (DRONE.on) droneStop(); else droneStart(); }
    function droneDive(art) {
      const D = DRONE;
      if (!art || D.mode === "dive" || D.mode === "inside") return;
      const spot = droneSpot(art);
      const p1 = art.lookAt.clone().addScaledVector(droneInward(art), 0.32);
      D.art = art;
      D.dive = { t: 0, dur: 1.15, p0: D.pos.clone(), c: spot.p, p1, y0: D.yaw, y1: spot.yaw, pi0: D.pitch };
      D.vel.set(0, 0, 0);
      droneMode("dive", art);
      setLook(null);
    }
    function droneBack() {
      const D = DRONE;
      camera.fov = D.fov; camera.updateProjectionMatrix();
      $("drone-flash").style.opacity = 0;
      if ($("inspector").classList.contains("open")) { $("inspector").classList.remove("open"); editing = null; }
      exploring = true;
      $("resume").classList.remove("show");
      D.vel.set(0, 0, 0); D.thr = 0; D.idle = 0;
      if (D.art) {
        D.lock = droneSpot(D.art);
        D.yaw = D.lock.yaw; D.pitch = 0;
        droneMode("align", D.art);                         /* 從畫裡往後退回賞畫位置 */
      } else droneMode("free");
    }
    function droneTick(dt) {
      if (!exploring) return;
      const D = DRONE, pos = D.pos, vel = D.vel;
      D.t += dt;
      if (D.mode === "inside") { droneBack(); return; }  /* 檢視器已關閉 */
      if (D.mode === "dive") {
        const v = D.dive;
        v.t += dt;
        const u = Math.min(1, v.t / v.dur);
        const e = u < 0.5 ? 2 * u * u : 1 - Math.pow(-2 * u + 2, 2) / 2;
        const a = 1 - e;
        pos.set(a * a * v.p0.x + 2 * a * e * v.c.x + e * e * v.p1.x,
                a * a * v.p0.y + 2 * a * e * v.c.y + e * e * v.p1.y,
                a * a * v.p0.z + 2 * a * e * v.c.z + e * e * v.p1.z);
        let dy = v.y1 - v.y0;
        while (dy > Math.PI) dy -= Math.PI * 2;
        while (dy < -Math.PI) dy += Math.PI * 2;
        D.yaw = v.y0 + dy * Math.min(1, e * 1.6);
        D.pitch = v.pi0 * (1 - Math.min(1, e * 1.6));
        D.roll *= Math.exp(-6 * dt);
        camera.fov = D.fov * (1 - 0.45 * e * e);
        camera.updateProjectionMatrix();
        $("drone-flash").style.opacity = u > 0.7 ? ((u - 0.7) / 0.3).toFixed(3) : 0;
        camera.position.copy(pos);
        yaw = D.yaw; pitch = D.pitch;
        camera.rotation.set(D.pitch, D.yaw, D.roll, "YXZ");
        if (u >= 1) {
          droneMode("inside", D.art);
          openArt(D.art);
          lensOpen();
          setTimeout(() => { $("drone-flash").style.opacity = 0; }, 60);
        }
        return;
      }
      /* ---- 輸入 ---- */
      let steerYaw = 0, steerUp = 0;
      if (D.mIn) {
        const ex = Math.abs(D.mx) - 0.45, ey = Math.abs(D.my) - 0.45;
        if (ex > 0) steerYaw = -Math.sign(D.mx) * Math.min(1, ex / 0.5);
        if (ey > 0) steerUp = Math.sign(D.my) * Math.min(1, ey / 0.5);
      }
      const kf = (move.f ? 1 : 0) - (move.b ? 1 : 0);
      const kx = (move.r ? 1 : 0) - (move.l ? 1 : 0);
      D.thr *= Math.exp(-1.3 * dt);
      if (Math.abs(D.thr) < 0.02) D.thr = 0;
      const active = steerYaw || steerUp || kf || kx || D.ku || Math.abs(D.thr) > 0.06;
      if (active) {
        D.idle = 0;
        if (D.mode !== "free") { D.lock = null; droneMode("free"); }
      } else {
        D.idle += dt;
        if (D.mode === "free" && D.idle > 0.5) {
          const art = droneFindArt();
          if (art) { D.art = art; D.lock = droneSpot(art); droneMode("align", art); }
        }
      }
      let pitchTarget;
      const boost = move.run ? 1.7 : 1;
      if (D.mode === "free") {
        D.yaw += steerYaw * 1.7 * dt;
        const fwd = Math.max(-1, Math.min(1, D.thr + kf)) * DRONE_MAX * boost;
        const sx = Math.cos(D.yaw), sz = -Math.sin(D.yaw);
        const fx = -Math.sin(D.yaw), fz = -Math.cos(D.yaw);
        const up = Math.max(-1, Math.min(1, steerUp + D.ku)) * 2.0 * boost;
        TMP.dir.set(fx * fwd + sx * kx * 2.4 * boost, up, fz * fwd + sz * kx * 2.4 * boost);
        vel.lerp(TMP.dir, 1 - Math.exp(-2.6 * dt));
        pitchTarget = steerUp * 0.32 - fwd * 0.012;
      } else {
        /* align / lock：飛到賞畫點並正對 */
        TMP.dir.copy(D.lock.p).sub(pos).multiplyScalar(2.4);
        if (TMP.dir.length() > 3.2) TMP.dir.setLength(3.2);
        vel.lerp(TMP.dir, 1 - Math.exp(-4 * dt));
        let dy = D.lock.yaw - D.yaw;
        while (dy > Math.PI) dy -= Math.PI * 2;
        while (dy < -Math.PI) dy += Math.PI * 2;
        D.yaw += dy * (1 - Math.exp(-3.2 * dt));
        pitchTarget = tourAim(D.lock.p, D.art.lookAt).pitch;
        if (D.mode === "align" && pos.distanceTo(D.lock.p) < 0.06 && Math.abs(dy) < 0.012) droneMode("lock", D.art);
      }
      /* ---- 移動 + 逐軸碰撞 ---- */
      const nx = pos.x + vel.x * dt, ny = pos.y + vel.y * dt, nz = pos.z + vel.z * dt;
      TMP.fwd.set(nx, pos.y, pos.z);
      if (flyFree(TMP.fwd)) pos.x = nx; else vel.x *= -0.3;
      TMP.fwd.set(pos.x, ny, pos.z);
      if (flyFree(TMP.fwd)) pos.y = ny; else vel.y *= -0.3;
      TMP.fwd.set(pos.x, pos.y, nz);
      if (flyFree(TMP.fwd)) pos.z = nz; else vel.z *= -0.3;
      /* ---- 姿態 ---- */
      D.pitch += (Math.max(-1.1, Math.min(1.1, pitchTarget)) - D.pitch) * (1 - Math.exp(-3 * dt));
      const rollT = Math.max(-0.4, Math.min(0.4, -steerYaw * 0.28 - kx * 0.12));
      D.roll += (rollT - D.roll) * (1 - Math.exp(-4 * dt));
      const hov = D.mode === "lock" ? 0.012 : 0.004;
      camera.position.set(pos.x + Math.sin(D.t * 37) * 0.0015, pos.y + Math.sin(D.t * 1.3) * hov, pos.z + Math.cos(D.t * 41) * 0.0015);
      yaw = D.yaw; pitch = D.pitch;
      camera.rotation.set(D.pitch, D.yaw, D.roll, "YXZ");
      /* ---- OSD ---- */
      D.osdT -= dt;
      if (D.osdT <= 0) {
        D.osdT = 0.12;
        $("d-alt").textContent = pos.y.toFixed(1);
        $("d-spd").textContent = vel.length().toFixed(1);
        $("d-thr").textContent = Math.round(D.thr * 100);
      }
    }

    /* ================= v33 配樂：內建輕音樂（WebAudio 即時合成）／自選音樂檔 =================
       · 瀏覽器規定要有使用者點擊才能出聲 → 任何點擊／按鍵都會嘗試啟動
       · 自選檔存在 IndexedDB；匯出分享檔時 20 MB 以內會打包進 HTML
       · 導覽錄影（影片格式）會把配樂一起錄進去 */
    const MUSIC_KEY = "gallery-music-v1" + (GID ? ":" + GID : "");
    const MUSIC_MAX = 20 * 1048576;
    const MUSIC = { mode: "off", last: "free", vol: 0.45, ctx: null, master: null, bus: null, el: null, elNode: null,
      src: "", blob: null, name: "", recDest: null, amb: null, pauseT: 0 };
    function musicSave() {
      lsSet(MUSIC_KEY, JSON.stringify({ mode: MUSIC.mode, last: MUSIC.last, vol: MUSIC.vol, name: MUSIC.name }));
    }
    const MUSIC_STYLES = ["free", "french", "bossa", "carmen", "opera", "ocean"];
    const musicNorm = (m) => (m === "ambient" ? "free" : m);   /* 舊版設定相容 */
    function musicWant() { return MUSIC_STYLES.includes(MUSIC.mode) || (MUSIC.mode === "file" && !!MUSIC.src); }
    function musicRunning() { return !!(MUSIC.ctx && MUSIC.ctx.state === "running"); }
    function musicEnsure() {
      if (MUSIC.ctx) return MUSIC.ctx;
      const AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) return null;
      const ctx = MUSIC.ctx = new AC();
      MUSIC.master = ctx.createGain();
      MUSIC.master.gain.value = 0;
      MUSIC.master.connect(ctx.destination);
      return ctx;
    }
    function musicKick() {
      if (!musicWant()) { if (musicRunning()) musicApply(); else musicUI(); return; }
      const ctx = musicEnsure();
      if (!ctx) return;
      if (ctx.state !== "running") ctx.resume().then(musicApply, () => {});
      else musicApply();
    }
    function musicApply() {
      const ctx = MUSIC.ctx;
      musicUI();
      if (!ctx || ctx.state !== "running") return;
      const want = musicWant();
      const g = MUSIC.master.gain;
      g.cancelScheduledValues(ctx.currentTime);
      g.setTargetAtTime(want ? MUSIC.vol * MUSIC.vol : 0, ctx.currentTime, want ? 0.6 : 0.25);   /* 平方：滑桿聽感較線性 */
      if (want && MUSIC_STYLES.includes(MUSIC.mode)) {
        if (MUSIC.amb && MUSIC.amb.style !== MUSIC.mode) ambStop();
        ambStart(MUSIC.mode);
      } else ambStop();
      clearTimeout(MUSIC.pauseT);
      if (want && MUSIC.mode === "file") {
        const el = musicEl();
        if (el.src !== MUSIC.src) el.src = MUSIC.src;
        el.play().catch(() => { toast(T("musicBad"), true); });
      } else if (MUSIC.el && !MUSIC.el.paused) {
        MUSIC.pauseT = setTimeout(() => { if (!(musicWant() && MUSIC.mode === "file")) MUSIC.el.pause(); }, 900);
      }
    }
    function musicEl() {
      if (MUSIC.el) return MUSIC.el;
      const el = MUSIC.el = new Audio();
      el.loop = true; el.preload = "auto"; el.crossOrigin = "anonymous";
      el.addEventListener("error", () => { if (MUSIC.mode === "file" && MUSIC.src) toast(T("musicBad"), true); });
      MUSIC.elNode = MUSIC.ctx.createMediaElementSource(el);
      MUSIC.elNode.connect(MUSIC.master);
      return el;
    }
    function setMusicMode(mode) {
      if (mode === "file" && !MUSIC.src) {
        toast(T("musicNeedFile"), true);
        if (!VIEWONLY) { const inp = $("music-file"); if (inp) inp.click(); }
        return;
      }
      mode = musicNorm(mode);
      MUSIC.mode = MUSIC_STYLES.includes(mode) || mode === "file" ? mode : "off";
      if (MUSIC.mode !== "off") MUSIC.last = MUSIC.mode;
      musicSave();
      musicKick();
      musicUI();
    }
    function musicToggle() {
      if (MUSIC.mode !== "off") setMusicMode("off");
      else setMusicMode(MUSIC.last === "file" && !MUSIC.src ? "free" : MUSIC.last);
    }
    function musicUI() {
      document.querySelectorAll("[data-music]").forEach((b) => b.classList.toggle("on", b.dataset.music === MUSIC.mode));
      const btn = $("music-btn");
      if (btn) btn.classList.toggle("on", MUSIC.mode !== "off");
      const vol = $("music-vol");
      if (vol && document.activeElement !== vol) vol.value = Math.round(MUSIC.vol * 100);
      const nm = $("music-name");
      if (nm) {
        if (MUSIC.name) { delete nm.dataset.i18n; nm.textContent = "♪ " + MUSIC.name; nm.title = MUSIC.name; }
        else { nm.dataset.i18n = "noMusic"; nm.textContent = T("noMusic"); nm.title = ""; }
      }
      musicTapUpdate();
    }
    function musicTapUpdate() {
      const tap = $("music-tap");
      if (!tap) return;
      const cover = !$("blocker").classList.contains("hidden");
      tap.classList.toggle("show", !cover && musicWant() && !musicRunning());
    }
    function musicSetBlob(blob, name) {
      if (MUSIC.src && MUSIC.src.startsWith("blob:")) URL.revokeObjectURL(MUSIC.src);
      MUSIC.blob = blob; MUSIC.name = name || "";
      MUSIC.src = blob ? URL.createObjectURL(blob) : "";
      if (MUSIC.el) MUSIC.el.src = MUSIC.src;
    }
    async function musicPick(file) {
      if (!file) return;
      if (!/^audio\//.test(file.type) && !/\.(mp3|m4a|aac|ogg|oga|wav|flac)$/i.test(file.name)) { toast(T("musicBad"), true); return; }
      musicSetBlob(file, file.name.replace(/\.[^.]+$/, ""));
      if (file.size > MUSIC_MAX) toast(T("musicBig"), true);
      if (!VIEWONLY) { try { await idbPut(imgKey("__music"), file); } catch (e) {} }
      setMusicMode("file");
    }
    async function musicInit() {
      let saved = null;
      try { saved = JSON.parse(lsGet(MUSIC_KEY) || "null"); } catch {}
      const emb = window.GALLERY_MUSIC || null;
      MUSIC.mode = musicNorm((saved && saved.mode) || window.GALLERY_MUSIC_MODE || "free");
      MUSIC.last = musicNorm((saved && saved.last) || (MUSIC.mode !== "off" ? MUSIC.mode : "free"));
      if (!MUSIC_STYLES.includes(MUSIC.mode) && MUSIC.mode !== "file") MUSIC.mode = "off";
      if (saved && isFinite(saved.vol)) MUSIC.vol = Math.max(0, Math.min(1, +saved.vol));
      let blob = VIEWONLY ? null : await idbGet(imgKey("__music"));
      let name = blob ? ((saved && saved.name) || "music") : "";
      if (!blob && emb && emb.data) {
        try { blob = await (await fetch(emb.data)).blob(); name = emb.name || "music"; } catch (e) {}
      }
      if (blob) musicSetBlob(blob, name);
      if (MUSIC.mode === "file" && !MUSIC.src) MUSIC.mode = "free";
      musicUI();
      if (musicRunning()) musicApply();
    }
    async function musicEmbedForShare() {
      if (!MUSIC.blob || MUSIC.blob.size > MUSIC_MAX) return null;
      return { name: MUSIC.name, data: await blobToDataURL(MUSIC.blob) };
    }
    /* 錄影用：把配樂接到 MediaStream（沒在播就不加音軌） */
    function musicStream() {
      if (!musicRunning() || !musicWant() || MUSIC.vol <= 0) return null;
      if (!MUSIC.recDest) {
        MUSIC.recDest = MUSIC.ctx.createMediaStreamDestination();
        MUSIC.master.connect(MUSIC.recDest);
      }
      return MUSIC.recDest.stream;
    }

    /* ---- 內建輕音樂：三種風格，全部即時合成、隨機生成旋律（不取樣、不重現任何既有曲目） ---- */
    const mtof = (m) => 440 * Math.pow(2, (m - 69) / 12);
    const rpick = (a) => a[Math.floor(Math.random() * a.length)];
    function ambImpulse(ctx, sec) {
      const n = Math.floor(ctx.sampleRate * sec), buf = ctx.createBuffer(2, n, ctx.sampleRate);
      for (let c = 0; c < 2; c++) {
        const d = buf.getChannelData(c);
        for (let i = 0; i < n; i++) d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / n, 3);
      }
      return buf;
    }
    let NOISE_BUF = null;
    function noiseBuf(ctx) {
      if (NOISE_BUF) return NOISE_BUF;
      const n = Math.floor(ctx.sampleRate * 0.5);
      NOISE_BUF = ctx.createBuffer(1, n, ctx.sampleRate);
      const d = NOISE_BUF.getChannelData(0);
      for (let i = 0; i < n; i++) d[i] = Math.random() * 2 - 1;
      return NOISE_BUF;
    }
    function envGain(ctx, t, a, peak, hold, rel) {
      const g = ctx.createGain();
      g.gain.setValueAtTime(0.0001, t);
      g.gain.linearRampToValueAtTime(peak, t + a);
      g.gain.setValueAtTime(peak, t + a + hold);
      g.gain.exponentialRampToValueAtTime(0.0001, t + a + hold + rel);
      return g;
    }
    function oscTo(ctx, type, freq, det, dest, t0, t1) {
      const o = ctx.createOscillator();
      o.type = type; o.frequency.value = freq; o.detune.value = det || 0;
      o.connect(dest); o.start(t0); o.stop(t1);
      return o;
    }

    /* ===== 音色 ===== */
    function vPad(A, t, m, dur, peak, cut) {
      const ctx = MUSIC.ctx;
      const lp = ctx.createBiquadFilter(); lp.type = "lowpass"; lp.frequency.value = cut; lp.Q.value = 0.3;
      const g = ctx.createGain();
      g.gain.setValueAtTime(0.0001, t);
      g.gain.linearRampToValueAtTime(peak, t + 2.6);
      g.gain.setValueAtTime(peak, t + dur - 0.6);
      g.gain.linearRampToValueAtTime(0.0001, t + dur + 2.4);
      lp.connect(g); g.connect(A.bus);
      oscTo(ctx, "sine", mtof(m), 0, lp, t, t + dur + 2.6);
      oscTo(ctx, "triangle", mtof(m), m % 2 ? 7 : -7, lp, t, t + dur + 2.6);
    }
    function vBell(A, t, m, vel) {
      const ctx = MUSIC.ctx;
      const g = ctx.createGain();
      g.gain.setValueAtTime(0.0001, t);
      g.gain.exponentialRampToValueAtTime(vel, t + 0.008);
      g.gain.exponentialRampToValueAtTime(0.0001, t + 2.8);
      g.connect(A.bus); g.connect(A.echo);
      [[1, 1], [2.01, 0.25], [3.98, 0.06]].forEach(([mul, amp]) => {
        const og = ctx.createGain(); og.gain.value = amp; og.connect(g);
        oscTo(ctx, "sine", mtof(m) * mul, 0, og, t, t + 3);
      });
    }
    /* 尼龍弦撥奏：三角波＋泛音，濾波器快速關閉 */
    function vPluck(A, t, m, vel, dur) {
      const ctx = MUSIC.ctx;
      const f = ctx.createBiquadFilter(); f.type = "lowpass"; f.Q.value = 1.2;
      f.frequency.setValueAtTime(3400, t); f.frequency.exponentialRampToValueAtTime(520, t + 0.45);
      const g = envGain(ctx, t, 0.004, vel, 0, dur);
      f.connect(g); g.connect(A.bus);
      oscTo(ctx, "triangle", mtof(m), 0, f, t, t + dur + 0.1);
      const h = ctx.createGain(); h.gain.value = 0.35; h.connect(f);
      oscTo(ctx, "sine", mtof(m) * 2, 3, h, t, t + dur + 0.1);
    }
    function vBass(A, t, m, vel, dur) {
      const ctx = MUSIC.ctx;
      const f = ctx.createBiquadFilter(); f.type = "lowpass"; f.frequency.value = 420;
      const g = envGain(ctx, t, 0.012, vel, dur * 0.25, dur);
      f.connect(g); g.connect(A.bus);
      oscTo(ctx, "sine", mtof(m), 0, f, t, t + dur * 1.3 + 0.1);
      const h = ctx.createGain(); h.gain.value = 0.35; h.connect(f);
      oscTo(ctx, "triangle", mtof(m), 0, h, t, t + dur * 1.3 + 0.1);
    }
    /* 手風琴（musette）：兩支鋸齒波一高一低微走音＋顫音 */
    function vReed(A, t, m, dur, vel, echo) {
      const ctx = MUSIC.ctx;
      const f = ctx.createBiquadFilter(); f.type = "lowpass"; f.frequency.value = 1700; f.Q.value = 0.6;
      const g = envGain(ctx, t, 0.05, vel, Math.max(0.02, dur - 0.05), 0.16);
      f.connect(g); g.connect(A.bus);
      if (echo) g.connect(A.echo);
      const end = t + dur + 0.3;
      const lfo = ctx.createOscillator(), lg = ctx.createGain();
      lfo.frequency.value = 5.4; lg.gain.value = 5;
      lfo.connect(lg); lfo.start(t); lfo.stop(end);
      [-9, 9].forEach((det) => { const o = oscTo(ctx, "sawtooth", mtof(m), det, f, t, end); lg.connect(o.detune); });
    }
    /* 輕聲哼唱：正弦＋少量三角波，延遲出現的顫音，柔和起音 */
    function vVoice(A, t, m, dur, vel) {
      const ctx = MUSIC.ctx;
      const f = ctx.createBiquadFilter(); f.type = "lowpass"; f.frequency.value = 1500;
      const g = envGain(ctx, t, 0.12, vel, Math.max(0.05, dur - 0.12), 0.45);
      f.connect(g); g.connect(A.bus); g.connect(A.echo);
      const end = t + dur + 0.6;
      const lfo = ctx.createOscillator(), lg = ctx.createGain();
      lfo.frequency.value = 5; lg.gain.setValueAtTime(0, t); lg.gain.linearRampToValueAtTime(9, t + Math.min(0.6, dur));
      lfo.connect(lg); lfo.start(t); lfo.stop(end);
      const o1 = oscTo(ctx, "sine", mtof(m), 0, f, t, end); lg.connect(o1.detune);
      const h = ctx.createGain(); h.gain.value = 0.22; h.connect(f);
      const o2 = oscTo(ctx, "triangle", mtof(m), 4, h, t, end); lg.connect(o2.detune);
    }
    function vShaker(A, t, vel) {
      const ctx = MUSIC.ctx;
      const src = ctx.createBufferSource(); src.buffer = noiseBuf(ctx);
      const f = ctx.createBiquadFilter(); f.type = "highpass"; f.frequency.value = 6000;
      const g = envGain(ctx, t, 0.006, vel, 0, 0.07);
      src.connect(f); f.connect(g); g.connect(A.bus);
      src.start(t, Math.random() * 0.3); src.stop(t + 0.1);
    }
    function vRim(A, t, vel) {
      const ctx = MUSIC.ctx;
      const g = envGain(ctx, t, 0.002, vel, 0, 0.05);
      g.connect(A.bus);
      oscTo(ctx, "sine", 1650, 0, g, t, t + 0.08);
      oscTo(ctx, "triangle", 820, 0, g, t, t + 0.08);
    }
    /* 旋律走法：偏向和弦內音、以級進為主 */
    function nextNote(prev, scale, chordPcs) {
      let i = scale.indexOf(prev);
      if (i < 0) i = Math.floor(scale.length / 2);
      const cands = [];
      for (let d = -3; d <= 3; d++) {
        const j = i + d;
        if (j < 0 || j >= scale.length || d === 0 && Math.random() < 0.7) continue;
        const w = (chordPcs.includes(scale[j] % 12) ? 3 : 1) * (Math.abs(d) <= 1 ? 3 : Math.abs(d) === 2 ? 2 : 1);
        for (let k = 0; k < w; k++) cands.push(scale[j]);
      }
      return rpick(cands);
    }

    /* ===== 自由風：無節拍，8 秒一個和弦 ===== */
    const FREE_CHORDS = [[50, 62, 66, 69, 73, 76], [47, 62, 66, 69, 71, 74], [43, 59, 62, 66, 69, 74], [45, 61, 64, 69, 71, 76]];
    const FREE_BELLS = [74, 76, 78, 81, 83, 86, 88, 90];
    function freeBar(A, t, len) {
      const chord = FREE_CHORDS[A.bar % FREE_CHORDS.length];
      chord.forEach((m, i) => vPad(A, t, m, len, i === 0 ? 0.075 : 0.032, i === 0 ? 600 : 1500));
      const n = 3 + Math.floor(Math.random() * 3);
      for (let k = 0; k < n; k++) {
        const at = t + 0.6 + (k / n) * (len - 1.4) + Math.random() * 0.5;
        const m = Math.random() < 0.5 ? chord[1 + Math.floor(Math.random() * (chord.length - 1))] + 12 : rpick(FREE_BELLS);
        vBell(A, at, m, 0.05 + Math.random() * 0.03);
      }
    }

    /* ===== 法式風：a 小調慢華爾滋（3/4），Am–Dm–E7–Am–F–Dm–E7–Am ===== */
    const FR_CHORDS = [
      { r: 45, c: [57, 60, 64] }, { r: 50, c: [57, 62, 65] }, { r: 40, c: [56, 59, 62, 64] }, { r: 45, c: [57, 60, 64] },
      { r: 41, c: [57, 60, 65] }, { r: 50, c: [57, 62, 65] }, { r: 40, c: [56, 59, 62, 64] }, { r: 45, c: [57, 60, 64] }
    ];
    const FR_SCALE = [69, 71, 72, 74, 76, 77, 80, 81, 83, 84, 86, 88];   /* a 和聲小音階 A4–E6 */
    const FR_RHYTHMS = [[1.5, 0.5, 1], [1, 1, 1], [2, 1], [0.5, 0.5, 1, 1], [1, 0.5, 0.5, 1]];
    function frenchBar(A, t, len, beat) {
      const k = A.bar % FR_CHORDS.length, ch = FR_CHORDS[k];
      vBass(A, t, (A.bar % 2) ? ch.r + 7 - 12 : ch.r, 0.11, beat * 0.9);
      [1, 2].forEach((b) => ch.c.forEach((m) => vReed(A, t + b * beat, m, beat * 0.42, 0.012)));
      const pcs = ch.c.map((m) => m % 12).concat([ch.r % 12]);
      if (k === 7) { vReed(A, t, 81, beat * 2.8, 0.045, true); A.mel = 81; return; }   /* 樂句收在 A */
      let pos = 0;
      const rh = k === 3 ? [2, 1] : rpick(FR_RHYTHMS);
      rh.forEach((d) => {
        if (Math.random() > 0.1) {
          A.mel = nextNote(A.mel || 76, FR_SCALE, pcs);
          vReed(A, t + pos * beat, A.mel, d * beat * 0.92, 0.045, true);
        }
        pos += d;
      });
    }

    /* ===== 日式：輕柔 Bossa Nova（4/4），D 大調 maj7／9／13 和弦 ===== */
    const BO_CHORDS = [
      { r: 50, c: [54, 57, 61, 64] }, { r: 43, c: [54, 57, 59, 62] }, { r: 42, c: [52, 57, 61, 64] }, { r: 47, c: [51, 57, 60, 63] },
      { r: 40, c: [50, 54, 55, 59] }, { r: 45, c: [49, 54, 55, 59] }, { r: 50, c: [54, 57, 61, 64] }, { r: 50, c: [54, 57, 59, 64] }
    ];
    const BO_SCALE = [62, 64, 66, 69, 71, 74, 76, 78, 81];   /* D 大調五聲 D4–A5 */
    const BO_COMP = [[0, 3, 6], [2, 4, 7]];                 /* 兩小節一組的切分和弦（以八分音符計） */
    const BO_CLAVE = [[0, 3, 6], [2, 4]];
    const BO_MEL = [[[0, 3], [3, 2], [6, 2]], [[1, 2], [4, 3]], [[0, 2], [2, 2], [5, 3]], [[3, 4]]];
    function bossaBar(A, t, len, beat) {
      const k = A.bar % BO_CHORDS.length, ch = BO_CHORDS[k], e = beat / 2;
      const low = ch.r > 45 ? ch.r - 12 : ch.r;
      vBass(A, t, low, 0.12, beat * 1.4);
      vBass(A, t + 2 * beat, low + 7, 0.1, beat * 1.2);
      vBass(A, t + 3.5 * e * 2 - e, low, 0.05, e * 0.8);
      BO_COMP[A.bar % 2].forEach((p) => ch.c.forEach((m, i) => vPluck(A, t + p * e + i * 0.011, m, 0.022, p === 0 ? 1.1 : 0.55)));
      for (let i = 0; i < 16; i++) vShaker(A, t + i * beat / 4 + (i % 2 ? 0.012 : 0), i % 4 === 0 ? 0.03 : i % 2 ? 0.011 : 0.018);
      BO_CLAVE[A.bar % 2].forEach((p) => vRim(A, t + p * e, 0.02));
      if (A.bar % 4 === 3) return;                          /* 每四小節留白換氣 */
      const pcs = ch.c.map((m) => m % 12);
      rpick(BO_MEL).forEach(([p, d]) => {
        A.mel = nextNote(A.mel || 69, BO_SCALE, pcs);
        vVoice(A, t + p * e, A.mel, d * e, 0.05);
      });
    }


    /* ===== v40 音色：弦樂、女高音、豎琴、響板 ===== */
    function vString(A, t, m, dur, vel, att) {
      const ctx = MUSIC.ctx;
      const f = ctx.createBiquadFilter(); f.type = "lowpass"; f.frequency.value = 1500; f.Q.value = 0.4;
      const g = envGain(ctx, t, att || 0.6, vel, Math.max(0.05, dur - (att || 0.6)), 0.9);
      f.connect(g); g.connect(A.bus);
      const end = t + dur + 1.1;
      const lfo = ctx.createOscillator(), lg = ctx.createGain();
      lfo.frequency.value = 5.1 + Math.random() * 0.6; lg.gain.value = 6;
      lfo.connect(lg); lfo.start(t); lfo.stop(end);
      [-11, 0, 11].forEach((det) => { const o = oscTo(ctx, "sawtooth", mtof(m), det, f, t, end); lg.connect(o.detune); });
    }
    /* 女高音：從上一個音滑過來（portamento）、延遲顫音、2.8 kHz「歌者共振峰」 */
    function vSoprano(A, t, m, dur, vel, from) {
      const ctx = MUSIC.ctx;
      const pk = ctx.createBiquadFilter(); pk.type = "peaking"; pk.frequency.value = 2800; pk.Q.value = 1.4; pk.gain.value = 7;
      const lp = ctx.createBiquadFilter(); lp.type = "lowpass"; lp.frequency.value = 3600;
      const g = envGain(ctx, t, 0.18, vel, Math.max(0.05, dur - 0.18), 0.5);
      pk.connect(lp); lp.connect(g); g.connect(A.bus); g.connect(A.echo);
      const end = t + dur + 0.7;
      const lfo = ctx.createOscillator(), lg = ctx.createGain();
      lfo.frequency.value = 5.7;
      lg.gain.setValueAtTime(0, t); lg.gain.linearRampToValueAtTime(22, t + Math.min(0.5, dur * 0.6));
      lfo.connect(lg); lfo.start(t); lfo.stop(end);
      [["sine", 1, 0], ["triangle", 0.35, 3], ["sine", 0.12, 1200]].forEach(([type, amp, det]) => {
        const og = ctx.createGain(); og.gain.value = amp; og.connect(pk);
        const o = ctx.createOscillator();
        o.type = type; o.detune.value = det;
        const f1 = mtof(m);
        if (from) { o.frequency.setValueAtTime(mtof(from), t); o.frequency.exponentialRampToValueAtTime(f1, t + 0.09); }
        else o.frequency.value = f1;
        o.connect(og); lg.connect(o.detune); o.start(t); o.stop(end);
      });
    }
    function vHarp(A, t, m, vel) {
      const ctx = MUSIC.ctx;
      const f = ctx.createBiquadFilter(); f.type = "lowpass"; f.frequency.value = 3200;
      const g = envGain(ctx, t, 0.003, vel, 0, 2.4);
      f.connect(g); g.connect(A.bus);
      oscTo(ctx, "triangle", mtof(m), 0, f, t, t + 2.5);
      const h = ctx.createGain(); h.gain.value = 0.4; h.connect(f);
      oscTo(ctx, "sine", mtof(m) * 2, 0, h, t, t + 1.2);
    }
    function vCast(A, t, vel) {
      const ctx = MUSIC.ctx;
      const src = ctx.createBufferSource(); src.buffer = noiseBuf(ctx);
      const f = ctx.createBiquadFilter(); f.type = "bandpass"; f.frequency.value = 3200; f.Q.value = 2.5;
      const g = envGain(ctx, t, 0.002, vel, 0, 0.035);
      src.connect(f); f.connect(g); g.connect(A.bus);
      src.start(t, Math.random() * 0.3); src.stop(t + 0.06);
      const c = envGain(ctx, t, 0.001, vel * 0.5, 0, 0.02);
      c.connect(A.bus);
      oscTo(ctx, "square", 2300, 0, c, t, t + 0.04);
    }
    /* 朝目標音移動的旋律（歌劇的樂句弧線） */
    function towardNote(prev, target, scale, pcs) {
      let i = scale.indexOf(prev);
      if (i < 0) i = scale.indexOf(target) >= 0 ? scale.indexOf(target) : Math.floor(scale.length / 2);
      const ti = scale.indexOf(target) >= 0 ? scale.indexOf(target) : i;
      const cands = [];
      for (let d = -2; d <= 3; d++) {
        const j = i + d;
        if (j < 0 || j >= scale.length) continue;
        let w = (pcs.includes(scale[j] % 12) ? 3 : 1) * (Math.abs(d) === 1 ? 3 : d === 0 ? 1 : 2);
        if (Math.abs(j - ti) < Math.abs(i - ti)) w *= 3;
        for (let k = 0; k < w; k++) cands.push(scale[j]);
      }
      return rpick(cands);
    }

    /* ===== 卡門風：d 小調哈巴涅拉（2/4），Dm–Dm–A7–A7–Gm–Dm–A7–Dm ===== */
    const CA_CHORDS = [
      { r: 38, c: [62, 65, 69] }, { r: 38, c: [62, 65, 69] }, { r: 33, c: [61, 64, 67] }, { r: 33, c: [61, 64, 67] },
      { r: 43, c: [62, 67, 70] }, { r: 38, c: [62, 65, 69] }, { r: 33, c: [61, 64, 67] }, { r: 38, c: [62, 65, 69] }
    ];
    const CA_SCALE = [62, 64, 65, 67, 69, 70, 73, 74, 76, 77];   /* d 和聲小音階 D4–F5 */
    const CA_RHY = [[0.75, 0.25, 0.5, 0.5], [0.5, 0.5, 0.5, 0.5], [1, 0.5, 0.5], [0.75, 0.25, 1]];
    function carmenBar(A, t, len, beat) {
      const k = A.bar % CA_CHORDS.length, ch = CA_CHORDS[k];
      /* 哈巴涅拉低音：附點八分＋十六分＋兩個八分 */
      [[0, ch.r, 0.13, 0.7], [0.75, ch.r, 0.08, 0.22], [1, ch.r + 7, 0.11, 0.45], [1.5, ch.r, 0.11, 0.45]]
        .forEach(([b, n, v, d]) => vBass(A, t + b * beat, n, v, d * beat));
      [0.5, 1.5].forEach((b) => ch.c.forEach((n, i) => vPluck(A, t + b * beat + i * 0.014, n, 0.02, 0.5)));
      [0, 0.75, 1, 1.5].forEach((b) => vCast(A, t + b * beat, b === 0 ? 0.05 : 0.03));
      if (k % 4 === 3) [1.5, 1.58, 1.66, 1.75].forEach((b, i) => vCast(A, t + b * beat, 0.02 + i * 0.008));   /* 響板滾奏 */
      const pcs = ch.c.map((n) => n % 12);
      let pos = 0, prev = A.mel || 74;
      if (k % 4 === 3) { const n = ch.c[Math.floor(Math.random() * ch.c.length)] + 12; vSoprano(A, t, n > 77 ? n - 12 : n, beat * 1.8, 0.05, prev); A.mel = n > 77 ? n - 12 : n; return; }
      const rh = rpick(CA_RHY);
      rh.forEach((d, idx) => {
        let n;
        if (k % 4 < 2) {                                         /* 半音下行，像《卡門》的誘惑線條 */
          n = (idx === 0 && k % 4 === 0) ? 74 : prev - 1;
          if (n < 64) n = 74;
        } else n = nextNote(prev, CA_SCALE, pcs);
        vSoprano(A, t + pos * beat, n, d * beat * 0.95, 0.05, prev);
        prev = n; pos += d;
      });
      A.mel = prev;
    }

    /* ===== 歌劇風：F 大調慢板詠嘆調（4/4），F–Dm–B♭–C7–F–Am–Gm7–C7，第 6 小節推到高潮 ===== */
    const OP_CHORDS = [
      { r: 41, c: [57, 60, 65, 69] }, { r: 38, c: [57, 62, 65, 69] }, { r: 34, c: [58, 62, 65, 70] }, { r: 36, c: [58, 60, 64, 67] },
      { r: 41, c: [57, 60, 65, 69] }, { r: 45, c: [57, 60, 64, 69] }, { r: 43, c: [58, 62, 65, 67] }, { r: 36, c: [58, 60, 64, 67] }
    ];
    const OP_SCALE = [65, 67, 69, 70, 72, 74, 76, 77, 79, 81];   /* F 大調 F4–A5 */
    const OP_TARGET = [69, 72, 74, 72, 76, 79, 77, 72];
    const OP_RHY = [[2, 1, 1], [1.5, 0.5, 2], [3, 1], [1, 1, 2]];
    function operaBar(A, t, len, beat) {
      const k = A.bar % OP_CHORDS.length, ch = OP_CHORDS[k];
      ch.c.forEach((n) => vString(A, t, n, len, 0.011, 0.7));
      vString(A, t, ch.r + 12, len, 0.012, 0.9);
      vBass(A, t, ch.r, 0.1, beat * 1.8);
      vBass(A, t + 2 * beat, ch.r + (k % 2 ? 7 : 12), 0.06, beat * 1.6);
      const arp = [ch.r + 12].concat(ch.c, ch.c.map((n) => n + 12)).slice(0, 8);
      arp.forEach((n, i) => vHarp(A, t + i * beat / 2, n, 0.028 - i * 0.0015));
      const pcs = ch.c.map((n) => n % 12);
      const target = OP_TARGET[k];
      let prev = A.mel || 69, pos = 0;
      const rh = k === 5 ? [1, 1, 2] : k === 7 ? [2, 2] : rpick(OP_RHY);
      rh.forEach((d, idx) => {
        const last = idx === rh.length - 1;
        const n = last ? target : towardNote(prev, target, OP_SCALE, pcs);
        vSoprano(A, t + pos * beat, n, d * beat * 0.97, k === 5 ? 0.06 : 0.048, prev);
        prev = n; pos += d;
      });
      A.mel = prev;
    }

    /* ===== v50 海浪：棕噪音經濾波，一道浪約 8 秒（湧起→拍岸→退去的沙沙聲），左右聲道隨機；底下是很輕的和弦與偶爾的風鈴 ===== */
    let BROWN_BUF = null;
    function brownBuf(ctx) {
      if (BROWN_BUF && BROWN_BUF.sampleRate === ctx.sampleRate) return BROWN_BUF;
      const n = Math.floor(ctx.sampleRate * 6);
      BROWN_BUF = ctx.createBuffer(2, n, ctx.sampleRate);
      for (let ch = 0; ch < 2; ch++) {
        const d = BROWN_BUF.getChannelData(ch);
        let last = 0;
        for (let i = 0; i < n; i++) { last = (last + 0.02 * (Math.random() * 2 - 1)) / 1.02; d[i] = last * 3.5; }
        for (let i = 0; i < 2000; i++) { const k = i / 2000; d[i] *= k; d[n - 1 - i] *= k; }   /* 頭尾淡入淡出，循環不跳 */
      }
      return BROWN_BUF;
    }
    const OC_CHORDS = [[50, 57, 62, 66], [47, 54, 59, 62], [43, 50, 55, 59], [45, 52, 57, 61]];
    function oceanWave(A, t, dur, big) {
      const ctx = MUSIC.ctx;
      const src = ctx.createBufferSource(); src.buffer = brownBuf(ctx); src.loop = true;
      const crest = dur * (0.34 + Math.random() * 0.1);
      const f = ctx.createBiquadFilter(); f.type = "lowpass"; f.Q.value = 0.4;
      f.frequency.setValueAtTime(260, t);
      f.frequency.linearRampToValueAtTime(big ? 2200 : 1500, t + crest);
      f.frequency.exponentialRampToValueAtTime(420, t + dur + 1.5);
      const g = ctx.createGain();
      const peak = (big ? 0.5 : 0.34) * (0.85 + Math.random() * 0.3);
      g.gain.setValueAtTime(0.0001, t);
      g.gain.linearRampToValueAtTime(peak * 0.35, t + crest * 0.6);
      g.gain.linearRampToValueAtTime(peak, t + crest);
      g.gain.exponentialRampToValueAtTime(peak * 0.25, t + crest + 1.8);
      g.gain.exponentialRampToValueAtTime(0.0001, t + dur + 1.8);
      const pan = ctx.createStereoPanner ? ctx.createStereoPanner() : null;
      src.connect(f); f.connect(g);
      if (pan) { pan.pan.value = (Math.random() - 0.5) * 0.8; g.connect(pan); pan.connect(A.bus); } else g.connect(A.bus);
      src.start(t, Math.random() * 5); src.stop(t + dur + 2);
      /* 浪花退去的沙沙聲 */
      const fo = ctx.createBufferSource(); fo.buffer = noiseBuf(ctx); fo.loop = true;
      const hp = ctx.createBiquadFilter(); hp.type = "highpass"; hp.frequency.value = 2600;
      const fg = ctx.createGain();
      const t1 = t + crest - 0.1;
      fg.gain.setValueAtTime(0.0001, t1);
      fg.gain.linearRampToValueAtTime(big ? 0.05 : 0.032, t1 + 0.35);
      fg.gain.exponentialRampToValueAtTime(0.0001, t1 + 2.6 + Math.random());
      fo.connect(hp); hp.connect(fg); fg.connect(pan || A.bus);
      fo.start(t1, Math.random() * 0.4); fo.stop(t1 + 3.8);
    }
    function oceanBar(A, t, len) {
      const off = Math.random() * 1.2;
      oceanWave(A, t + off, len - 0.4 + Math.random() * 1.2, Math.random() < 0.35);
      if (Math.random() < 0.3) oceanWave(A, t + len * 0.55 + Math.random(), 4 + Math.random() * 2, false);   /* 小浪 */
      const ch = OC_CHORDS[A.bar % OC_CHORDS.length];
      ch.forEach((m, i) => vPad(A, t, m, len, i === 0 ? 0.03 : 0.012, i === 0 ? 500 : 1100));
      if (Math.random() < 0.3) {
        const n = 2 + Math.floor(Math.random() * 3), at = t + 2 + Math.random() * 3;
        for (let k = 0; k < n; k++) vBell(A, at + k * (0.18 + Math.random() * 0.12), rpick([86, 88, 90, 93, 95]), 0.018);
      }
    }

    const AMB_STYLES = {
      free: { gain: 1, len: () => 8, echo: 0.35, wet: 0.55, play: freeBar },
      french: { gain: 2.0, bpm: 100, beats: 3, echo: 0.1, wet: 0.32, play: frenchBar },
      bossa: { gain: 1.6, bpm: 116, beats: 4, echo: 0.16, wet: 0.38, play: bossaBar },
      carmen: { gain: 1.2, bpm: 72, beats: 2, echo: 0.12, wet: 0.4, play: carmenBar },
      opera: { gain: 1.5, bpm: 63, beats: 4, echo: 0.1, wet: 0.7, play: operaBar },
      ocean: { gain: 1.8, len: () => 8, echo: 0.2, wet: 0.35, play: oceanBar }
    };
    function ambStart(style) {
      const ctx = MUSIC.ctx, S = AMB_STYLES[style];
      if (MUSIC.amb || !ctx || !S) return;
      const beat = S.bpm ? 60 / S.bpm : 1;
      const len = S.len ? S.len() : beat * S.beats;
      const A = MUSIC.amb = { style, next: ctx.currentTime + 0.2, bar: 0, timer: 0, nodes: [], mel: 0 };
      A.bus = ctx.createGain(); A.bus.gain.value = 0;
      A.bus.gain.setTargetAtTime(S.gain, ctx.currentTime, 0.6);   /* 各風格音量拉齊 */
      const dry = ctx.createGain(); dry.gain.value = 0.8;
      const rev = ctx.createConvolver(); rev.buffer = ambImpulse(ctx, style === "free" || style === "opera" ? 3.2 : 2.2);
      const wet = ctx.createGain(); wet.gain.value = S.wet;
      A.bus.connect(dry); dry.connect(MUSIC.master);
      A.bus.connect(rev); rev.connect(wet); wet.connect(MUSIC.master);
      A.echo = ctx.createDelay(1.5); A.echo.delayTime.value = style === "free" ? 0.48 : beat * 0.75;
      const fb = ctx.createGain(); fb.gain.value = 0.3;
      const echoOut = ctx.createGain(); echoOut.gain.value = S.echo;
      A.echo.connect(fb); fb.connect(A.echo); A.echo.connect(echoOut); echoOut.connect(A.bus);
      A.nodes.push(dry, rev, wet, fb, echoOut);
      const tick = () => {
        while (A.next < ctx.currentTime + 1.0) { S.play(A, A.next, len, beat); A.next += len; A.bar++; }
      };
      tick();
      A.timer = setInterval(tick, 250);
    }
    function ambStop() {
      const A = MUSIC.amb, ctx = MUSIC.ctx;
      if (!A) return;
      MUSIC.amb = null;
      clearInterval(A.timer);
      A.bus.gain.cancelScheduledValues(ctx.currentTime);
      A.bus.gain.setTargetAtTime(0, ctx.currentTime, 0.3);
      setTimeout(() => { try { A.bus.disconnect(); A.echo.disconnect(); A.nodes.forEach((x) => x.disconnect()); } catch (e) {} }, 4000);
    }
    function bindMusic() {
      const kick = () => musicKick();
      ["pointerdown", "keydown", "touchend"].forEach((ev) => addEventListener(ev, () => { if (!musicRunning()) kick(); }, true));
      $("music-mode").addEventListener("click", (e) => {
        const b = e.target.closest("[data-music]");
        if (b) setMusicMode(b.dataset.music);
      });
      $("music-bar").addEventListener("click", (e) => {
        e.stopPropagation();
        const b = e.target.closest("[data-music]");
        if (!b) return;
        if (document.pointerLockElement) document.exitPointerLock();
        setMusicMode(b.dataset.music);
      });
      $("music-file").onchange = async (e) => {
        const f = e.target.files && e.target.files[0];
        e.target.value = "";
        await musicPick(f);
      };
      $("music-vol").addEventListener("input", (e) => {
        MUSIC.vol = Math.max(0, Math.min(1, +e.target.value / 100));
        musicSave();
        if (musicRunning() && musicWant()) MUSIC.master.gain.setTargetAtTime(MUSIC.vol * MUSIC.vol, MUSIC.ctx.currentTime, 0.08);
      });
      $("music-btn").onclick = (e) => { e.stopPropagation(); e.currentTarget.blur(); musicToggle(); };
      $("music-tap").onclick = (e) => { e.stopPropagation(); musicKick(); };
      setInterval(musicTapUpdate, 1000);
      musicInit();
    }


    const SHOTS = { photos: window.GALLERY_PHOTOS || [], selected: window.GALLERY_COVER || "" };
    const OBJECT_KEY = "gallery-plan-objects:" + (GID || location.pathname);
    let placedObjects = window.GALLERY_OBJECTS || [];
    if (!VIEWONLY && !window.GALLERY_OBJECTS) { try { placedObjects = JSON.parse(lsGet(OBJECT_KEY) || "[]"); } catch {} }
    let objectGroup, selectedObject = -1, objectHits = [], planTransform;
    function photoUI() {
      const box = $("scene-photos"); box.replaceChildren();
      SHOTS.photos.forEach((src,i) => {
        const b = document.createElement("button"); b.type="button";
        b.style.cssText="padding:3px;width:100px;border:2px solid "+(src===SHOTS.selected?"#e6c878":"#666");
        const im=document.createElement("img"); im.src=src; im.alt="場景照片 "+(i+1); im.style.cssText="width:90px;height:54px;object-fit:cover";
        b.append(im,document.createTextNode(src===SHOTS.selected?"✓ 封面":"選作封面"));
        b.onclick=()=>{SHOTS.selected=src;photoUI();}; box.append(b);
      });
    }
    function scenePhoto() {
      if (!renderer || !camera || !hungAll) { toast("請等展廳載入完成。",true); return; }
      try {
        renderer.render(scene,camera);
        const src=renderer.domElement.toDataURL("image/jpeg",0.92);
        SHOTS.photos.unshift(src); SHOTS.photos=SHOTS.photos.slice(0,3);
        if (!SHOTS.photos.includes(SHOTS.selected)) SHOTS.selected=src;
        photoUI(); toast("已拍照；點縮圖選擇封面。");
      } catch(e) { toast("拍照失敗："+e.message,true); }
    }
    function downloadCover(name) {
      if (!SHOTS.selected) return;
      const a=document.createElement("a"); a.href=SHOTS.selected; a.download=name.replace(/\.html$/i,"-cover.jpg");
      document.body.append(a); a.click(); a.remove();
    }
    function saveObjects() { if (!VIEWONLY) lsSet(OBJECT_KEY,JSON.stringify(placedObjects)); }
    function rebuildObjects() {
      if (!scene) return;
      if (objectGroup) { scene.remove(objectGroup); objectGroup.traverse(o=>{if(o.geometry)o.geometry.dispose();if(o.material)o.material.dispose();}); }
      objectGroup=new THREE.Group(); scene.add(objectGroup);
      placedObjects.forEach(o=>{
        const g=new THREE.Group();
        const box=(w,h,d,x,y,z,col)=>{const m=new THREE.Mesh(new THREE.BoxGeometry(w,h,d),new THREE.MeshStandardMaterial({color:col}));m.position.set(x,y,z);m.castShadow=true;m.receiveShadow=true;g.add(m);};
        if(o.type==="bench") {box(2,.18,.75,0,.55,0,0x76624e);[-.8,.8].forEach(x=>box(.12,.5,.6,x,.25,0,0x333333));box(2,.6,.12,0,.95,-.33,0x76624e);}
        else if(o.type==="plant") {box(.6,.65,.6,0,.325,0,0xb6a080);const m=new THREE.Mesh(new THREE.SphereGeometry(.48,12,8),new THREE.MeshStandardMaterial({color:0x477552}));m.position.y=1;g.add(m);}
        else box(.9,1.1,.9,0,.55,0,0xc5c5c5);
        g.position.set(o.x,0,o.z);g.rotation.y=o.rot||0;bendObj(g);objectGroup.add(g);
      });markShadow();
    }
    function objectBlocked(x,z) {
      return placedObjects.some(o=>{const r=o.type==="bench"?1.25:.8;return Math.hypot(x-o.x,z-o.z)<r && Math.hypot(x-o.x,z-o.z)<Math.hypot(camera.position.x-o.x,camera.position.z-o.z);});
    }
    function planObjectsDraw(ctx,XY,sc) {
      objectHits=[];
      placedObjects.forEach((o,i)=>{const [x,y]=XY(o.x,o.z);ctx.save();ctx.translate(x,y);ctx.rotate(-(o.rot||0)+(ARC.on?o.x/ARC.R:0));ctx.fillStyle=i===selectedObject?"#ffc86e":"#76bca8";ctx.fillRect(-sc*(o.type==="bench"?1:.45),-sc*.4,sc*(o.type==="bench"?2:.9),sc*.8);ctx.restore();objectHits.push({x,y,r:Math.max(12,sc),i});});
    }
    function bindSceneTools() {
      if(window.GALLERY_COVER){const im=document.createElement("img");im.src=window.GALLERY_COVER;im.alt="展廳封面";im.style.cssText="display:block;width:100%;max-height:280px;object-fit:cover;border-radius:12px;margin:12px 0";$("plan-btn").parentElement.prepend(im);}
      photoUI();rebuildObjects();$("scene-shot").onclick=scenePhoto;
      addEventListener("keydown",e=>{
        if(e.code!=="KeyS"||e.ctrlKey||e.metaKey||e.altKey||e.target.closest('input,textarea,select,[contenteditable="true"]'))return;
        e.preventDefault();e.stopImmediatePropagation();if(!e.repeat)scenePhoto();
      },true);
      if(VIEWONLY){$("plan-object").disabled=true;$("object-rotate").disabled=true;$("object-delete").disabled=true;}
      const changed=()=>{saveObjects();rebuildObjects();planDraw();};
      $("object-rotate").onclick=()=>{if(!VIEWONLY&&placedObjects[selectedObject]){placedObjects[selectedObject].rot+=Math.PI/4;changed();}};
      $("object-delete").onclick=()=>{if(!VIEWONLY&&placedObjects[selectedObject]){placedObjects.splice(selectedObject,1);selectedObject=-1;changed();}};
      $("plan-cv").addEventListener("click",e=>{
        if(VIEWONLY)return;
        const r=e.currentTarget.getBoundingClientRect(),px=e.clientX-r.left,py=e.clientY-r.top;
        const mode=$("plan-object").value;
        const hit=objectHits.find(h=>Math.hypot(h.x-px,h.y-py)<h.r);
        if(!mode&&hit){e.stopImmediatePropagation();selectedObject=hit.i;$("object-status").textContent="已選取物件，可旋轉、刪除或切換移動。";planDraw();return;}
        if(!mode)return;
        e.stopImmediatePropagation();
        let X=(px/planTransform.sc)+planTransform.B.x0-2.2,Z=(py/planTransform.sc)+planTransform.B.z0-2.2;
        if(ARC.on){const dx=X,dz=ARC.R-Z;X=Math.atan2(dx,dz)*ARC.R;Z=ARC.R-Math.hypot(dx,dz);}
        const rr=mode==="bench"?1.4:1;
        if(!LAYOUT.some(r=>Math.abs(X-r.cx)<r.w/2-rr&&Math.abs(Z-r.cz)<r.d/2-rr)){toast("請放在展廳內，並與牆面保持距離。",true);return;}
        if(placedObjects.some((o,i)=>i!==selectedObject&&Math.hypot(o.x-X,o.z-Z)<2)){toast("此處太靠近其他物件。",true);return;}
        if(mode==="move"){if(!placedObjects[selectedObject]){toast("請先選取物件。",true);return;}Object.assign(placedObjects[selectedObject],{x:X,z:Z});}
        else{placedObjects.push({type:mode,x:X,z:Z,rot:0});selectedObject=placedObjects.length-1;}
        changed();
      },true);
    }

    /* ================= v37 觀看路線蹤跡＋平面圖 ================= */
    const TRAIL_KEY = "my-hall-trail-v1" + (GID ? ":" + GID : "");
    const TRAIL_MAX = 6000;
    const TRAIL_MODES = ["walk", "fly", "drone", "tour", "bird", "dog", "elephant", "cat", "parrot"];
    const TRAIL_COL = { walk: "#e6c878", fly: "#7fc6e8", drone: "#b596f0", tour: "#9aa3b5", bird: "#6fe0a0", dog: "#f0a36b", elephant: "#b9bdd6", cat: "#f59ac8", parrot: "#b6f04a" };
    const TRAIL = { pts: [], t: 0, acc: 0, dirty: false, saveT: 0, last: null, hit: [] };
    (() => {
      try {
        const d = JSON.parse(lsGet(TRAIL_KEY) || "null");
        if (d && Array.isArray(d.pts)) { TRAIL.pts = d.pts; TRAIL.t = +d.t || 0; }
      } catch {}
    })();
    function trailSave() {
      if (!TRAIL.dirty) return;
      TRAIL.dirty = false;
      lsSet(TRAIL_KEY, JSON.stringify({ pts: TRAIL.pts, t: Math.round(TRAIL.t) }));
    }
    addEventListener("pagehide", trailSave);
    function trailTick(dt) {
      if (!exploring || uiBlocked()) { TRAIL.last = null; return; }
      TRAIL.t += dt;
      TRAIL.acc += dt;
      TRAIL.saveT += dt;
      if (TRAIL.saveT > 4) { TRAIL.saveT = 0; trailSave(); }
      if (TRAIL.acc < 0.25) return;
      TRAIL.acc = 0;
      const p = camera.position;
      const mode = TOUR.on ? 3 : HB.on ? 4 : DOG.on ? 5 + Math.max(0, PET_ORDER.indexOf(DOG.kind)) : DRONE.on ? 2 : FLY.on ? 1 : 0;
      const x = Math.round(p.x * 10) / 10, z = Math.round(p.z * 10) / 10;
      const L = TRAIL.last;
      if (L && Math.hypot(x - L[0], z - L[1]) < 0.3 && L[2] === mode) return;
      const brk = !L || Math.hypot(x - L[0], z - L[1]) > 4 ? 1 : 0;      /* 跳躍（傳送、回首頁再進來）→ 斷開線段 */
      const pt = [x, z, mode, brk];
      TRAIL.pts.push(pt);
      if (TRAIL.pts.length > TRAIL_MAX) { TRAIL.pts.splice(0, TRAIL.pts.length - TRAIL_MAX); TRAIL.pts[0][3] = 1; }
      TRAIL.last = pt;
      TRAIL.dirty = true;
    }
    function trailDist() {
      let d = 0;
      for (let i = 1; i < TRAIL.pts.length; i++) {
        const a = TRAIL.pts[i - 1], b = TRAIL.pts[i];
        if (!b[3]) d += Math.hypot(b[0] - a[0], b[1] - a[1]);
      }
      return d;
    }

    /* 平面圖：弧形時同樣彎曲（房間沿 x 取樣成多邊形） */
    function planEdge(x0, z0, x1, z1) {
      const n = ARC.on ? Math.max(1, Math.ceil(Math.abs(x1 - x0) / 1.5)) : 1, out = [];
      for (let i = 0; i <= n; i++) out.push(bendXZ(x0 + (x1 - x0) * i / n, z0 + (z1 - z0) * i / n));
      return out;
    }
    function planRoomPoly(r) {
      const x0 = r.cx - r.w / 2, x1 = r.cx + r.w / 2, z0 = r.cz - r.d / 2, z1 = r.cz + r.d / 2;
      return [...planEdge(x0, z0, x1, z0), ...planEdge(x1, z0, x1, z1).slice(1), ...planEdge(x1, z1, x0, z1).slice(1), ...planEdge(x0, z1, x0, z0).slice(1)];
    }
    function planBounds() {
      let x0 = 1e9, x1 = -1e9, z0 = 1e9, z1 = -1e9;
      LAYOUT.forEach((r) => planRoomPoly(r).forEach(([x, z]) => { x0 = Math.min(x0, x); x1 = Math.max(x1, x); z0 = Math.min(z0, z); z1 = Math.max(z1, z); }));
      return { x0, x1, z0, z1 };
    }
    function planDraw() {
      const cv = $("plan-cv");
      const B = planBounds(), pad = 2.2;
      const cssW = cv.parentElement.clientWidth || 1000;
      const dpr = Math.min(2, window.devicePixelRatio || 1);
      const sc = cssW / (B.x1 - B.x0 + pad * 2);
      planTransform = { B, sc };
      const cssH = Math.round((B.z1 - B.z0 + pad * 2) * sc);
      cv.width = Math.round(cssW * dpr); cv.height = Math.round(cssH * dpr);
      cv.style.height = cssH + "px";
      const ctx = cv.getContext("2d");
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      const CX = (X) => (X - B.x0 + pad) * sc, CY = (Z) => (Z - B.z0 + pad) * sc;
      const XY = (x, z) => { const [X, Z] = bendXZ(x, z); return [CX(X), CY(Z)]; };
      const path = (pts, close) => { ctx.beginPath(); pts.forEach(([X, Z], i) => (i ? ctx.lineTo(CX(X), CY(Z)) : ctx.moveTo(CX(X), CY(Z)))); if (close) ctx.closePath(); };
      ctx.fillStyle = "#0b111e"; ctx.fillRect(0, 0, cssW, cssH);
      /* 地板與牆 */
      LAYOUT.forEach((r) => { ctx.fillStyle = r.id === curRoomId ? "#1a2540" : "#141d31"; path(planRoomPoly(r), true); ctx.fill(); });
      ctx.strokeStyle = "#c8a96b"; ctx.lineWidth = Math.max(2, WALL_T * sc); ctx.lineJoin = "miter";
      LAYOUT.forEach((r) => { path(planRoomPoly(r), true); ctx.stroke(); });
      ctx.save(); ctx.strokeStyle = "#8fd0ff"; ctx.lineWidth = Math.max(3, WALL_T * sc * 1.4);   /* 落地玻璃窗 */
      LAYOUT.forEach((r) => (r.glass || []).forEach((f) => {
        const x0 = r.cx - r.w / 2, x1 = r.cx + r.w / 2, z0 = r.cz - r.d / 2, z1 = r.cz + r.d / 2;
        const seg = { north: [x0, z0, x1, z0], south: [x0, z1, x1, z1], west: [x0, z0, x0, z1], east: [x1, z0, x1, z1] }[f];
        path(planEdge(...seg)); ctx.stroke();
      }));
      ctx.restore();
      ctx.save(); ctx.strokeStyle = "#141d31"; ctx.lineWidth = WALL_T * sc * 2.4; ctx.lineCap = "butt";   /* 門洞 */
      DOOR_XS.forEach((dx) => { path(planEdge(dx, -DOOR_W / 2, dx, DOOR_W / 2)); ctx.stroke(); });
      ctx.restore();
      /* 房名 */
      ctx.textAlign = "center"; ctx.textBaseline = "middle";
      ctx.font = `italic 500 ${Math.round(sc * 1.1)}px "Cormorant Garamond", Georgia, "Noto Serif TC", serif`;
      ctx.fillStyle = "rgba(230,207,152,0.35)";
      LAYOUT.forEach((r) => { const [px, py] = XY(r.cx, r.cz); ctx.fillText(r.name, px, py); });
      /* 路線 */
      const P = TRAIL.pts, n = P.length;
      ctx.lineCap = "round"; ctx.lineJoin = "round"; ctx.lineWidth = Math.max(2, sc * 0.12);
      for (let i = 1; i < n; i++) {
        const a = P[i - 1], b = P[i];
        if (b[3]) continue;
        ctx.globalAlpha = 0.25 + 0.75 * (i / n);                  /* 越舊越淡 */
        ctx.strokeStyle = TRAIL_COL[TRAIL_MODES[b[2]]] || TRAIL_COL.walk;
        ctx.beginPath(); ctx.moveTo(...XY(a[0], a[1])); ctx.lineTo(...XY(b[0], b[1])); ctx.stroke();
      }
      ctx.globalAlpha = 1;
      if (n) {                                                     /* 起點 */
        ctx.fillStyle = "#0b111e"; ctx.strokeStyle = "#e6c878"; ctx.lineWidth = 2;
        ctx.beginPath(); ctx.arc(...XY(P[0][0], P[0][1]), sc * 0.3, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
      }
      /* 畫作 */
      TRAIL.hit = [];
      ctx.font = `500 ${Math.max(9, Math.round(sc * 0.55))}px Jost, "Segoe UI", sans-serif`;
      artworks.forEach((a) => {
        const rot = a.slot.rot, tx = Math.cos(rot), tz = -Math.sin(rot);
        const ix = Math.sin(rot), iz = Math.cos(rot);
        const hx = a.lookAt.x, hz = a.lookAt.z, half = (a.pw || 2.4) / 2;
        const seen = SEEN.has(a.id);
        ctx.strokeStyle = seen ? "#d8222c" : "#e9e3d6"; ctx.lineWidth = Math.max(3, sc * 0.22);
        ctx.beginPath(); ctx.moveTo(...XY(hx - tx * half, hz - tz * half)); ctx.lineTo(...XY(hx + tx * half, hz + tz * half)); ctx.stroke();
        const [bx, by] = XY(hx + ix * 1.05, hz + iz * 1.05), rad = Math.max(8, sc * 0.5);
        ctx.fillStyle = seen ? "#d8222c" : "#e9e3d6";
        ctx.beginPath(); ctx.arc(bx, by, rad, 0, Math.PI * 2); ctx.fill();
        ctx.fillStyle = seen ? "#fff" : "#1b2033";
        ctx.fillText(String(+a.id), bx, by + 0.5);
        TRAIL.hit.push({ x: bx, y: by, r: rad + 6, art: a });
      });
      planObjectsDraw(ctx,XY,sc);
      /* 目前位置與朝向 */
      if (camera && hungAll) {
        const [cx, cy] = XY(camera.position.x, camera.position.z);
        const yb = yaw - (ARC.on ? camera.position.x / ARC.R : 0);     /* 弧形：朝向跟著弧轉 */
        const fx = -Math.sin(yb), fz = -Math.cos(yb);
        const g = ctx.createRadialGradient(cx, cy, 0, cx, cy, sc * 1.6);
        g.addColorStop(0, "rgba(255,255,255,0.35)"); g.addColorStop(1, "rgba(255,255,255,0)");
        ctx.fillStyle = g; ctx.beginPath(); ctx.arc(cx, cy, sc * 1.6, 0, Math.PI * 2); ctx.fill();
        ctx.fillStyle = "#fff";
        ctx.beginPath();
        ctx.moveTo(cx + fx * sc * 0.9, cy + fz * sc * 0.9);
        ctx.lineTo(cx - fz * sc * 0.4 - fx * sc * 0.3, cy + fx * sc * 0.4 - fz * sc * 0.3);
        ctx.lineTo(cx + fz * sc * 0.4 - fx * sc * 0.3, cy - fx * sc * 0.4 - fz * sc * 0.3);
        ctx.closePath(); ctx.fill();
      }
      const mins = Math.max(0, Math.round(TRAIL.t / 60));
      $("plan-stats").textContent = T("planStats", { dist: Math.round(trailDist()), time: T("min", { m: mins }), seen: SEEN.size, total: artworks.length || 50 });
      $("plan-hint").textContent = T(n ? "planHint" : "planEmpty");
    }
    let planPrevLock = false;
    function planOpen() {
      if (document.pointerLockElement) { document.exitPointerLock(); planPrevLock = true; }
      if (FLY.on) flyStop();
      if (HB.on) hbStop();
      if (DOG.on) dogStop();
      if (DRONE.on) droneStop();
      trailSave();
      $("plan").classList.add("open");
      requestAnimationFrame(planDraw);
      $("plan-close").focus();
    }
    function planClose() { $("plan").classList.remove("open"); }
    function planToggle() { if ($("plan").classList.contains("open")) planClose(); else planOpen(); }
    function planJump(art) {
      planClose();
      if (TOUR.on) tourStop();
      enter();
      camera.position.copy(art.stand);
      const a = tourAim(art.stand, art.lookAt);
      setCamAngles(a.yaw, a.pitch);
      TRAIL.last = null;
      reassignSpots(true);
    }
    function bindPlan() {
      $("plan-btn").onclick = planOpen;
      $("hud-plan").onclick = (e) => { e.stopPropagation(); planOpen(); };
      $("plan-close").onclick = planClose;
      $("plan").addEventListener("click", (e) => { if (e.target.id === "plan") planClose(); });
      $("plan-clear").onclick = () => { TRAIL.pts = []; TRAIL.t = 0; TRAIL.last = null; TRAIL.dirty = true; trailSave(); planDraw(); toast(T("planCleared")); };
      $("plan-save").onclick = () => {
        $("plan-cv").toBlob((blob) => {
          if (!blob) return;
          const url = URL.createObjectURL(blob), a = document.createElement("a");
          a.href = url; a.download = `${fileSafe(HALL.name)}-路線-${mmdd()}.png`;
          document.body.appendChild(a); a.click(); a.remove();
          setTimeout(() => URL.revokeObjectURL(url), 30000);
        }, "image/png");
      };
      const hitAt = (e) => {
        const r = $("plan-cv").getBoundingClientRect(), x = e.clientX - r.left, y = e.clientY - r.top;
        return TRAIL.hit.find((h) => Math.hypot(h.x - x, h.y - y) <= h.r);
      };
      $("plan-cv").addEventListener("click", (e) => { const h = hitAt(e); if (h) planJump(h.art); });
      $("plan-cv").addEventListener("mousemove", (e) => {
        const h = hitAt(e);
        $("plan-cv").style.cursor = h ? "pointer" : "crosshair";
        $("plan-cv").title = h ? (h.art.title || "") : "";
      });
      addEventListener("resize", () => { if ($("plan").classList.contains("open")) planDraw(); });
      addEventListener("keydown", (e) => {
        if (!$("plan").classList.contains("open")) return;
        if (e.code === "Escape" || e.code === "KeyP") { e.preventDefault(); e.stopImmediatePropagation(); planClose(); }
      }, true);
    }

    /* ================= v42 蜂鳥模式（溫和版） =================
       · 慢慢飛：最高約 2 m/s，臨界阻尼彈簧 → 平順起停、不過衝
       · 與畫保持 2 m 以上：懸停點 2.2～2.9 m，全程限制在「離牆 2 m」的範圍內（門洞通道除外）
       · 四面穿插自由選畫：隨機挑畫，下一幅盡量換一面牆，約四分之一機會飛到別的展廳
       · 無高頻震動，只有緩慢的上下飄浮
       · v43：飛行時有小聲的振翅音（隨速度微調），停在畫前看畫時淡出靜音 */
    const HB = { on: false, pos: null, vel: null, yaw: 0, pitch: 0, roll: 0, t: 0, path: [], art: null,
      phase: "drift", hold: 0, spot: null, seen: [], hum: null };
    /* 振翅音：低頻正弦＋三角波，經低通後很小聲；直接送到喇叭，不受配樂開關影響 */
    function hbHum(on) {
      const ctx = MUSIC.ctx;
      if (on) {
        if (HB.hum || !ctx || ctx.state !== "running") return;
        const g = ctx.createGain(); g.gain.value = 0;
        const lp = ctx.createBiquadFilter(); lp.type = "lowpass"; lp.frequency.value = 420; lp.Q.value = 0.5;
        const o1 = ctx.createOscillator(), o2 = ctx.createOscillator();
        o1.type = "sine"; o1.frequency.value = 96;
        o2.type = "triangle"; o2.frequency.value = 192;
        const g2 = ctx.createGain(); g2.gain.value = 0.35;
        const trem = ctx.createOscillator(), tg = ctx.createGain();      /* 輕微的翅膀拍動起伏 */
        trem.frequency.value = 11; tg.gain.value = 0.25;
        const am = ctx.createGain(); am.gain.value = 0.75;
        trem.connect(tg); tg.connect(am.gain);
        o1.connect(lp); o2.connect(g2); g2.connect(lp); lp.connect(am); am.connect(g); g.connect(ctx.destination);
        o1.start(); o2.start(); trem.start();
        HB.hum = { g, o1, o2, trem };
      } else if (HB.hum) {
        const h = HB.hum; HB.hum = null;
        h.g.gain.cancelScheduledValues(ctx.currentTime);
        h.g.gain.setTargetAtTime(0, ctx.currentTime, 0.15);
        setTimeout(() => { try { h.o1.stop(); h.o2.stop(); h.trem.stop(); h.g.disconnect(); } catch (e) {} }, 900);
      }
    }
    const HB_GAP = 2.0, HB_WALL = 2.3, HB_VMAX = 2.1;
    function hbWallKey(a) { return a.room + ":" + Math.round(((a.slot.rot % (Math.PI * 2)) + Math.PI * 2) % (Math.PI * 2) / (Math.PI / 2)); }
    function hbClamp(p) {
      const hw = DOOR_W / 2 - 0.9;
      if (nearDoor(p.x, 2.3) && Math.abs(p.z) <= hw) return p;       /* 門洞通道 */
      let best = null, bd = 1e9;
      for (const r of LAYOUT) {
        const x = Math.min(r.cx + r.w / 2 - HB_WALL, Math.max(r.cx - r.w / 2 + HB_WALL, p.x));   /* 牆中心內縮 2.3 m ≈ 離畫 2 m 以上 */
        const z = Math.min(r.cz + r.d / 2 - HB_WALL, Math.max(r.cz - r.d / 2 + HB_WALL, p.z));
        const d = Math.hypot(x - p.x, z - p.z);
        if (d < bd) { bd = d; best = [x, z]; }
      }
      p.x = best[0]; p.z = best[1];
      p.y = Math.min(4.2, Math.max(1.1, p.y));
      return p;
    }
    function hbSpot(art) {
      const inw = art.stand.clone().sub(art.lookAt); inw.y = 0; inw.normalize();
      const side = new THREE.Vector3(inw.z, 0, -inw.x);
      const p = art.lookAt.clone().addScaledVector(inw, 2.2 + Math.random() * 0.7)
        .addScaledVector(side, (Math.random() - 0.5) * 0.9);
      p.y = art.lookAt.y + (Math.random() - 0.45) * 0.6;
      return hbClamp(p);
    }
    function hbPlan() {
      const here = flyRoomAt(HB.pos) || curRoomId || "hall";
      const curWall = HB.art ? hbWallKey(HB.art) : "";
      let to = here;
      const leftHere = artworks.filter((a) => a.room === here && !HB.seen.includes(a)).length;
      if (leftHere === 0 || Math.random() < 0.25) {
        const rooms = ROOM_ORDER.filter((x) => x !== here);
        to = rooms[Math.floor(Math.random() * rooms.length)];
      }
      let pool = artworks.filter((a) => a.room === to && a !== HB.art && !HB.seen.includes(a));
      if (!pool.length) { HB.seen = HB.art ? [HB.art] : []; pool = artworks.filter((a) => a.room === to && a !== HB.art); }
      const other = pool.filter((a) => hbWallKey(a) !== curWall);            /* 換一面牆 */
      if (other.length && Math.random() < 0.85) pool = other;
      const art = pool[Math.floor(Math.random() * pool.length)];
      if (!art) return;
      HB.art = art;
      HB.seen.push(art);
      if (HB.seen.length > 24) HB.seen.shift();
      HB.spot = hbSpot(art);
      HB.path = (to !== here ? flyDoorPath(here, to).map((v) => hbClamp(v.clone())) : []).concat([HB.spot]);
      HB.phase = "drift";
      flySetState("蜂鳥飛往「" + (art.title || "") + "」");
    }
    function hbStart() {
      if (HB.on) return;
      if (!artworks.length) { toast("展廳還在掛畫，請稍候。", true); return; }
      if (TOUR.on) tourStop();
      if (FLY.on) flyStop();
      if (DRONE.on) droneStop();
      if (DOG.on) dogStop();
      closeArt();
      if (!exploring) enter();
      if (document.pointerLockElement) document.exitPointerLock();
      move = { f: 0, b: 0, l: 0, r: 0, run: 0 };
      wheelBoost = 0;
      HB.on = true;
      HB.pos = hbClamp(camera.position.clone());
      HB.vel = new THREE.Vector3(0, 0.3, 0);
      HB.yaw = yaw; HB.pitch = pitch; HB.roll = 0; HB.t = 0; HB.seen = []; HB.art = null;
      hbPlan();
      document.body.classList.add("birding");
      $("bird-btn").classList.add("on");
      musicEnsure();
      if (MUSIC.ctx && MUSIC.ctx.state !== "running") MUSIC.ctx.resume().then(() => { if (HB.on) hbHum(true); }, () => {});
      else hbHum(true);
      toast("🐦 蜂鳥慢慢起飛。按 N、Esc、W/A/D＋↓ 或點畫面即可接手。");
    }
    function hbStop() {
      if (!HB.on) return;
      HB.on = false;
      hbHum(false);
      document.body.classList.remove("birding");
      $("bird-btn").classList.remove("on");
      flySetState("");
      const p = camera.position;
      p.y = PLAYER.h;
      const rid = flyRoomAt(p) || curRoomId || "hall";
      const r = LAYOUT.find((x) => x.id === rid);
      for (let i = 0; i < 60 && !inside(p.x, p.z); i++) { p.x += (r.cx - p.x) * 0.08; p.z += (r.cz - p.z) * 0.08; }
      setCamAngles(HB.yaw, Math.max(-0.4, Math.min(0.4, HB.pitch)));
    }
    function hbToggle() { if (HB.on) hbStop(); else hbStart(); }
    const angWrap = (d) => { while (d > Math.PI) d -= Math.PI * 2; while (d < -Math.PI) d += Math.PI * 2; return d; };
    function hbTick(dt) {
      if (!exploring || !HB.art) return;
      const pos = HB.pos, vel = HB.vel, art = HB.art;
      HB.t += dt;
      let target = HB.path[0] || HB.spot;
      const dist = pos.distanceTo(target);
      if (HB.phase === "drift") {
        if (HB.path.length > 1 && dist < 0.8) HB.path.shift();
        else if (HB.path.length <= 1 && dist < 0.15 && vel.length() < 0.2) {
          HB.phase = "hover";
          HB.hold = 3.2 + Math.random() * 2.3;
          flySetState("蜂鳥停在「" + (art.title || "") + "」前");
        }
      } else {
        HB.hold -= dt;
        if (HB.hold <= 0) hbPlan();
      }
      target = HB.path[0] || HB.spot;
      TMP.dir.copy(target);
      if (HB.phase === "hover") {                        /* 緩慢飄浮，前後只動 ±0.1 m */
        const inw = TMP.v.copy(art.stand).sub(art.lookAt); inw.y = 0; inw.normalize();
        TMP.dir.addScaledVector(inw, Math.sin(HB.t * 0.7) * 0.1);
        TMP.dir.y += Math.sin(HB.t * 1.1) * 0.06;
      }
      /* 臨界阻尼彈簧＋速度上限 → 慢而平順 */
      const k = HB.phase === "hover" ? 4 : 2.2, c = 2 * Math.sqrt(k) * 1.05;
      TMP.fwd.copy(TMP.dir).sub(pos).multiplyScalar(k).addScaledVector(vel, -c);
      if (TMP.fwd.length() > 1.6) TMP.fwd.setLength(1.6);            /* 加速度上限 */
      vel.addScaledVector(TMP.fwd, dt);
      if (vel.length() > HB_VMAX) vel.setLength(HB_VMAX);
      pos.addScaledVector(vel, dt);
      const before = TMP.fwd.copy(pos);
      hbClamp(pos);
      if (before.distanceToSquared(pos) > 1e-8) vel.multiplyScalar(0.8);
      /* 與目標畫的距離保底 2 m */
      const inw2 = TMP.v.copy(art.stand).sub(art.lookAt); inw2.y = 0; inw2.normalize();
      const along = (pos.x - art.lookAt.x) * inw2.x + (pos.z - art.lookAt.z) * inw2.z;
      if (along < HB_GAP && Math.abs((pos.x - art.lookAt.x) * inw2.z - (pos.z - art.lookAt.z) * inw2.x) < 2) {
        pos.x += inw2.x * (HB_GAP - along); pos.z += inw2.z * (HB_GAP - along);
      }
      /* 朝向：穿門時看前進方向，其餘時間緩緩轉向要看的畫 */
      const sp = Math.hypot(vel.x, vel.z);
      let yT, pT;
      if (HB.path.length > 1 && sp > 0.6) { yT = Math.atan2(-vel.x, -vel.z); pT = 0; }
      else { const aim = tourAim(pos, art.lookAt); yT = aim.yaw; pT = aim.pitch; }
      const dy = angWrap(yT - HB.yaw);
      HB.yaw += dy * (1 - Math.exp(-1.6 * dt));
      HB.pitch += (pT - HB.pitch) * (1 - Math.exp(-1.6 * dt));
      const rollT = Math.max(-0.1, Math.min(0.1, -dy * 0.25));
      HB.roll += (rollT - HB.roll) * (1 - Math.exp(-2 * dt));
      camera.position.copy(pos);
      yaw = HB.yaw; pitch = HB.pitch;
      camera.rotation.set(HB.pitch, HB.yaw, HB.roll, "YXZ");
      /* 飛行中小聲振翅；看畫（懸停）時淡出 */
      if (!HB.hum && MUSIC.ctx && MUSIC.ctx.state === "running") hbHum(true);
      if (HB.hum) {
        const ctx = MUSIC.ctx, spd = vel.length();
        const flying = HB.phase === "drift" && spd > 0.15;
        const vol = flying ? 0.006 + Math.min(1, spd / HB_VMAX) * 0.008 : 0;
        HB.hum.g.gain.setTargetAtTime(vol, ctx.currentTime, flying ? 0.35 : 0.25);
        HB.hum.o1.frequency.setTargetAtTime(90 + spd * 6, ctx.currentTime, 0.3);
        HB.hum.o2.frequency.setTargetAtTime(180 + spd * 12, ctx.currentTime, 0.3);
      }
    }

    /* ================= v46 動物看畫模式：小狗／大象／小貓（共用同一套行為，參數不同） =================
       · 先轉身再走，每一步鏡頭依步態上下起伏；到畫前 2.2～2.9 m 停下
       · 停下後隨機發聲（汪／象鳴／喵），叫完才開始看畫；看畫時安靜，偶爾歪頭
       · 途中偶爾停下：小狗聞地板、大象甩鼻子、小貓東張西望
       · 選畫同蜂鳥：隨機、盡量換一面牆、有時穿門到別廳 */
    const PET_ORDER = ["dog", "elephant", "cat", "parrot"];
    const PETS = {
      dog: { name: "小狗", btn: "dog-btn", eye: 0.52, speed: 1.4, gait: 2.6, bob: 0.028, sway: 0.012, turn: 3.2, accel: 4,
        hold: [4, 6.5], tilt: [0.14, 0.22], pause: { p: 0.35, dur: [1.1, 1.7], pitch: -0.5, swing: 0, verb: "聞一聞" },
        voice: { p: 0.6, n: [1, 3], gap: [0.24, 0.4], nod: 0.06 }, verbs: ["跑向", "坐著看"] },
      elephant: { name: "大象", btn: "el-btn", eye: 3.0, speed: 0.8, gait: 1.1, bob: 0.05, sway: 0.035, turn: 1.3, accel: 1.4,
        hold: [5, 8], tilt: [0.03, 0.06], pause: { p: 0.35, dur: [2, 3], pitch: -0.28, swing: 0.28, verb: "甩鼻子" },
        voice: { p: 0.5, n: [1, 1], gap: [1, 1.3], nod: -0.12 }, verbs: ["慢慢走向", "站著看"] },
      cat: { name: "小貓", btn: "cat-btn", eye: 0.28, speed: 1.05, gait: 3.2, bob: 0.012, sway: 0.006, turn: 4.4, accel: 5,
        hold: [4, 7], tilt: [0.1, 0.18], pause: { p: 0.4, dur: [0.8, 1.6], pitch: 0.12, swing: 0.55, verb: "東張西望" },
        voice: { p: 0.5, n: [1, 2], gap: [0.65, 0.95], nod: 0.04 }, verbs: ["輕步走向", "坐著看"], dash: 0.3 },
      parrot: { name: "鸚鵡", btn: "par-btn", eye: 2.0, fly: { cruise: 2.7, perch: [1.8, 2.3], arc: 0.55 }, speed: 2.2, gait: 4.6, bob: 0.035, sway: 0.01,
        turn: 3.0, accel: 2.4, hold: [4.5, 7], tilt: [0.18, 0.3], pause: { p: 0.25, dur: [1, 1.6], pitch: 0.1, swing: 0.6, verb: "左顧右盼" },
        voice: { p: 0.9, n: [1, 3], gap: [2.0, 2.8], nod: 0.1 }, verbs: ["飛向", "停在"] }
    };
    const DOG = { on: false, kind: "dog", pos: null, yaw: 0, pitch: 0, roll: 0, t: 0, spd: 0, path: [], art: null, spot: null,
      seen: [], phase: "walk", hold: 0, step: 0, tilt: 0, tiltT: 0, sniffAt: -1, sniff: 0, sniffLen: 1, barks: 0, barkT: 0, nod: 0,
      legLen: 1, dash: 1, lift: 0, liftTo: 0, held: 0, purr: null, fy: 1.6, perchY: 2 };
    const LIFT_EYE = { dog: 1.5, cat: 1.55 };      /* 被抱起時的眼睛高度（大人胸口＋寵物頭） */
    const rnd = (a) => a[0] + Math.random() * (a[1] - a[0]);
    function petCtx() { const c = MUSIC.ctx; return c && c.state === "running" ? c : null; }
    function noiseHit(ctx, t, freq, q, peak, dur, dest) {
      const src = ctx.createBufferSource(); src.buffer = noiseBuf(ctx);
      const f = ctx.createBiquadFilter(); f.type = "bandpass"; f.frequency.value = freq; f.Q.value = q;
      const g = ctx.createGain();
      g.gain.setValueAtTime(0.0001, t);
      g.gain.exponentialRampToValueAtTime(peak, t + 0.004);
      g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
      src.connect(f); f.connect(g); g.connect(dest || ctx.destination);
      src.start(t, Math.random() * 0.3); src.stop(t + dur + 0.02);
    }
    function petStepSound(kind, side) {
      const ctx = petCtx();
      if (!ctx) return;
      const t = ctx.currentTime;
      if (kind === "parrot") { if (side) noiseHit(ctx, t, 520, 0.7, 0.014, 0.1); return; }   /* 拍翅 */
      if (kind === "elephant") {                         /* 沉重的咚 */
        const o = ctx.createOscillator(), g = ctx.createGain();
        o.type = "sine"; o.frequency.setValueAtTime(70, t); o.frequency.exponentialRampToValueAtTime(34, t + 0.28);
        g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(0.09, t + 0.015); g.gain.exponentialRampToValueAtTime(0.0001, t + 0.32);
        o.connect(g); g.connect(ctx.destination); o.start(t); o.stop(t + 0.35);
        noiseHit(ctx, t, 180, 0.8, 0.02, 0.18);
      } else if (kind === "cat") noiseHit(ctx, t, side ? 1500 : 1300, 1.4, 0.006, 0.04);
      else noiseHit(ctx, t, side ? 900 : 760, 1.2, 0.018, 0.06);
    }
    function petPauseSound(kind) {
      const ctx = petCtx();
      if (!ctx) return;
      if (kind === "parrot") parrotChirp();
      else if (kind === "dog") for (let i = 0; i < 3; i++) noiseHit(ctx, ctx.currentTime + i * 0.16, 1900, 0.9, 0.012, 0.12);
      else if (kind === "elephant") {                    /* 低沉的呼嚕 */
        const t = ctx.currentTime, o = ctx.createOscillator(), g = ctx.createGain(), f = ctx.createBiquadFilter();
        o.type = "sawtooth"; o.frequency.value = 42; f.type = "lowpass"; f.frequency.value = 160;
        g.gain.setValueAtTime(0.0001, t); g.gain.linearRampToValueAtTime(0.03, t + 0.3); g.gain.exponentialRampToValueAtTime(0.0001, t + 1.2);
        o.connect(f); f.connect(g); g.connect(ctx.destination); o.start(t); o.stop(t + 1.3);
      }
    }
    /* 小型犬「汪」 */
    function dogBark() {
      const ctx = petCtx();
      if (!ctx) return;
      const t = ctx.currentTime + 0.01;
      const base = 520 + Math.random() * 160, dur = 0.13 + Math.random() * 0.06;
      const out = ctx.createGain();
      out.gain.setValueAtTime(0.0001, t);
      out.gain.exponentialRampToValueAtTime(0.1, t + 0.008);
      out.gain.exponentialRampToValueAtTime(0.034, t + dur * 0.5);
      out.gain.exponentialRampToValueAtTime(0.0001, t + dur);
      const f1 = ctx.createBiquadFilter(); f1.type = "bandpass"; f1.frequency.value = 900; f1.Q.value = 2.2;
      const f2 = ctx.createBiquadFilter(); f2.type = "bandpass"; f2.frequency.value = 2300; f2.Q.value = 3;
      const g2 = ctx.createGain(); g2.gain.value = 0.5;
      f1.connect(out); f2.connect(g2); g2.connect(out); out.connect(ctx.destination);
      const o = ctx.createOscillator();
      o.type = "sawtooth";
      o.frequency.setValueAtTime(base * 1.35, t);
      o.frequency.exponentialRampToValueAtTime(base, t + 0.03);
      o.frequency.exponentialRampToValueAtTime(base * 0.6, t + dur);
      o.connect(f1); o.connect(f2);
      o.start(t); o.stop(t + dur + 0.02);
      noiseHit(ctx, t, 900, 2.2, 0.03, 0.05, out);
    }
    /* 小貓「喵」：音高先升後降，共振峰由 m→ee→ow 移動 */
    function catMeow() {
      const ctx = petCtx();
      if (!ctx) return;
      const t = ctx.currentTime + 0.01, dur = 0.45 + Math.random() * 0.25, p0 = 560 + Math.random() * 140;
      const out = ctx.createGain();
      out.gain.setValueAtTime(0.0001, t);
      out.gain.exponentialRampToValueAtTime(0.11, t + 0.06);
      out.gain.setValueAtTime(0.11, t + dur * 0.55);
      out.gain.exponentialRampToValueAtTime(0.0001, t + dur);
      const f1 = ctx.createBiquadFilter(); f1.type = "bandpass"; f1.Q.value = 3;
      f1.frequency.setValueAtTime(700, t); f1.frequency.linearRampToValueAtTime(1500, t + dur * 0.35); f1.frequency.linearRampToValueAtTime(850, t + dur);
      const f2 = ctx.createBiquadFilter(); f2.type = "bandpass"; f2.Q.value = 4;
      f2.frequency.setValueAtTime(2200, t); f2.frequency.linearRampToValueAtTime(3000, t + dur * 0.35); f2.frequency.linearRampToValueAtTime(1800, t + dur);
      const g2 = ctx.createGain(); g2.gain.value = 0.45;
      f1.connect(out); f2.connect(g2); g2.connect(out); out.connect(ctx.destination);
      const o = ctx.createOscillator();
      o.type = "sawtooth";
      o.frequency.setValueAtTime(p0, t);
      o.frequency.exponentialRampToValueAtTime(p0 * 1.45, t + dur * 0.35);
      o.frequency.exponentialRampToValueAtTime(p0 * 0.85, t + dur);
      const lfo = ctx.createOscillator(), lg = ctx.createGain();
      lfo.frequency.value = 6; lg.gain.value = 15; lfo.connect(lg); lg.connect(o.detune);
      o.connect(f1); o.connect(f2);
      o.start(t); o.stop(t + dur + 0.02); lfo.start(t); lfo.stop(t + dur + 0.02);
    }
    /* 大象長鳴：銅管般的鋸齒＋方波，音高上揚、顫音漸強，帶氣聲 */
    function elephantTrumpet() {
      const ctx = petCtx();
      if (!ctx) return;
      const t = ctx.currentTime + 0.01, dur = 0.9 + Math.random() * 0.4, p0 = 330 + Math.random() * 80;
      const out = ctx.createGain();
      out.gain.setValueAtTime(0.0001, t);
      out.gain.exponentialRampToValueAtTime(0.06, t + 0.12);
      out.gain.linearRampToValueAtTime(0.075, t + dur * 0.6);
      out.gain.exponentialRampToValueAtTime(0.0001, t + dur);
      const f1 = ctx.createBiquadFilter(); f1.type = "bandpass"; f1.frequency.value = 1100; f1.Q.value = 1.6;
      const f2 = ctx.createBiquadFilter(); f2.type = "bandpass"; f2.frequency.value = 2600; f2.Q.value = 2.5;
      const g2 = ctx.createGain(); g2.gain.value = 0.6;
      f1.connect(out); f2.connect(g2); g2.connect(out); out.connect(ctx.destination);
      const lfo = ctx.createOscillator(), lg = ctx.createGain();
      lfo.frequency.value = 7;
      lg.gain.setValueAtTime(0, t); lg.gain.linearRampToValueAtTime(45, t + dur);
      lfo.connect(lg);
      [["sawtooth", 1], ["square", 0.4]].forEach(([type, amp], i) => {
        const o = ctx.createOscillator(), og = ctx.createGain();
        o.type = type; og.gain.value = amp;
        o.frequency.setValueAtTime(p0 * (i ? 1.005 : 1), t);
        o.frequency.exponentialRampToValueAtTime(p0 * 1.6, t + dur * 0.4);
        o.frequency.exponentialRampToValueAtTime(p0 * 1.45, t + dur);
        lg.connect(o.detune);
        o.connect(og); og.connect(f1); og.connect(f2);
        o.start(t); o.stop(t + dur + 0.02);
      });
      lfo.start(t); lfo.stop(t + dur + 0.02);
      noiseHit(ctx, t, 1800, 0.7, 0.02, dur * 0.8, out);
    }

    /* ================= v48 鸚鵡說話：Web Speech 語音（高音調、快一點）＋畫面對話框 =================
       · 看畫時隨機說 1～3 句；約四成會喊出畫名，偶爾提到作者
       · 首頁語言為中文說中文，英文說英文；沒有語音引擎時仍會顯示對話框並叫一聲 */
    const PARROT_LINES = {
      zh: ["你好！", "好漂亮！", "哇～", "再看一次！", "嘎！好畫！", "我喜歡這幅！", "好多顏色！", "拍照拍照！", "畫得真好！", "嘎嘎！", "漂亮漂亮！", "看這邊！"],
      en: ["Hello!", "Pretty!", "Wow!", "Look, look!", "Squawk! Nice painting!", "I like this one!", "So colourful!", "Take a picture!", "Bravo!", "Hello, art lover!", "Pretty pretty!"]
    };
    const PARROT_TITLE = {
      zh: ["《{t}》！", "這幅叫《{t}》！", "{t}！{t}！", "嘎！《{t}》好看！", "《{t}》，好漂亮！"],
      en: ["{t}!", "This one is {t}!", "{t}! {t}!", "Squawk! {t}!", "{t}, pretty!"]
    };
    const PARROT_ARTIST = { zh: ["{a} 畫的！", "是 {a}！"], en: ["By {a}!", "{a} painted it!"] };
    let sayT = 0, lastLine = "";
    function parrotBubble(text) {
      const el = $("parrot-say");
      el.textContent = "🦜 " + text;
      el.classList.add("show");
      clearTimeout(sayT);
      sayT = setTimeout(() => el.classList.remove("show"), 2600);
    }
    function parrotSquawk() {
      const ctx = petCtx();
      if (!ctx) return;
      const t = ctx.currentTime + 0.01, dur = 0.16 + Math.random() * 0.08;
      const o = ctx.createOscillator(), g = ctx.createGain(), f = ctx.createBiquadFilter();
      o.type = "sawtooth";
      o.frequency.setValueAtTime(1300, t); o.frequency.exponentialRampToValueAtTime(1900, t + dur * 0.4); o.frequency.exponentialRampToValueAtTime(1100, t + dur);
      f.type = "bandpass"; f.frequency.value = 2400; f.Q.value = 2;
      g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(0.05, t + 0.01); g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
      o.connect(f); f.connect(g); g.connect(ctx.destination); o.start(t); o.stop(t + dur + 0.02);
      noiseHit(ctx, t, 2600, 1.5, 0.02, dur * 0.8);
    }
    function parrotChirp() {
      const ctx = petCtx();
      if (!ctx) return;
      [0, 0.14].forEach((d, i) => {
        const t = ctx.currentTime + 0.01 + d, o = ctx.createOscillator(), g = ctx.createGain();
        o.type = "sine";
        o.frequency.setValueAtTime(i ? 2600 : 1800, t); o.frequency.exponentialRampToValueAtTime(i ? 1900 : 2900, t + 0.1);
        g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(0.03, t + 0.01); g.gain.exponentialRampToValueAtTime(0.0001, t + 0.12);
        o.connect(g); g.connect(ctx.destination); o.start(t); o.stop(t + 0.14);
      });
    }
    function parrotVoiceFor(lang) {
      if (!window.speechSynthesis) return null;
      const vs = speechSynthesis.getVoices();
      const want = lang === "zh" ? /^zh/i : /^en/i;
      const pref = lang === "zh" ? /(TW|Hant|HK)/i : /(US|GB)/i;
      return vs.find((v) => want.test(v.lang) && pref.test(v.lang)) || vs.find((v) => want.test(v.lang)) || null;
    }
    function parrotSay(art) {
      const lang = LANG === "zh" ? "zh" : "en";
      let line;
      const r = Math.random(), title = art && art.title, artist = art && art.artist && art.artist !== "作者姓名" ? art.artist : "";
      if (title && r < 0.4) line = rpick(PARROT_TITLE[lang]).replace(/\{t\}/g, title);
      else if (artist && r < 0.5) line = rpick(PARROT_ARTIST[lang]).replace(/\{a\}/g, artist);
      else line = rpick(PARROT_LINES[lang]);
      if (line === lastLine) line = rpick(PARROT_LINES[lang].filter((x) => x !== lastLine));   /* 不連續說同一句 */
      lastLine = line;
      parrotBubble(line);
      const tts = window.speechSynthesis;
      const voice = parrotVoiceFor(/[\u3400-\u9fff]/.test(line) ? "zh" : "en");
      if (Math.random() < 0.35 || !tts || !voice) parrotSquawk();
      if (tts && voice) {
        try {
          const u = new SpeechSynthesisUtterance(line.replace(/[《》「」]/g, " "));
          u.voice = voice; u.lang = voice.lang;
          u.pitch = 1.8 + Math.random() * 0.2; u.rate = 1.15 + Math.random() * 0.2;
          u.volume = Math.max(0.35, Math.min(1, MUSIC.vol * 1.6));
          tts.cancel();
          setTimeout(() => { if (DOG.on && DOG.kind === "parrot") tts.speak(u); }, 180);
        } catch (e) {}
      }
    }
    if (window.speechSynthesis) { try { speechSynthesis.getVoices(); speechSynthesis.onvoiceschanged = () => speechSynthesis.getVoices(); } catch (e) {} }
    function petVoice(kind) { if (kind === "parrot") parrotSay(DOG.art); else if (kind === "elephant") elephantTrumpet(); else if (kind === "cat") catMeow(); else dogBark(); }


    /* ================= v47 抱起來看：小狗／小貓坐著看畫時，按空白鍵（或畫面按鈕）有人把牠抱高 =================
       · 1.2 秒緩緩升到約 1.5 m，抱著看約 6 秒（期間有抱人呼吸般的輕晃），再輕輕放下繼續逛
       · 再按一次可提早放下；小狗被抱起時開心輕吠一聲，小貓被抱著時小聲呼嚕 */
    function petLift() {
      if (!DOG.on) return;
      if (DOG.kind === "elephant") { toast("🐘 大象太重了，抱不動……牠本來就看得很清楚！"); return; }
      if (DOG.kind === "parrot") { toast("🦜 鸚鵡會自己飛到剛好的高度！"); return; }
      if (DOG.liftTo > 0) { petPutDown(); return; }
      if (DOG.phase !== "sit") { toast("等牠坐下看畫時再抱起來。"); return; }
      DOG.liftTo = 1;
      DOG.held = 6;
      DOG.barks = 0;
      DOG.tilt = 0;
      flySetState((DOG.kind === "cat" ? "小貓" : "小狗") + "被抱起來看「" + (DOG.art.title || "") + "」");
      if (DOG.kind === "dog") setTimeout(() => { if (DOG.on && DOG.liftTo) petYip(); }, 500);
      else petPurr(true);
      petLiftUI();
    }
    function petPutDown() {
      DOG.liftTo = 0;
      DOG.held = 0;
      petPurr(false);
      petLiftUI();
    }
    function petLiftUI() {
      const b = $("pet-lift");
      if (!b) return;
      const can = DOG.on && !!LIFT_EYE[DOG.kind] && (DOG.phase === "sit" || DOG.lift > 0.01) && exploring && !uiBlocked();
      const held = DOG.liftTo > 0;
      if (b.classList.contains("show") !== can) b.classList.toggle("show", can);
      if (b.classList.contains("held") !== held) {
        b.classList.toggle("held", held);
        b.textContent = held ? "🤲 放下 · 空白鍵" : "🤲 抱起來看 · 空白鍵";
      }
    }
    function petYip() {
      const ctx = petCtx();
      if (!ctx) return;
      const t = ctx.currentTime + 0.01;
      const o = ctx.createOscillator(), g = ctx.createGain(), f = ctx.createBiquadFilter();
      o.type = "triangle";
      o.frequency.setValueAtTime(820, t); o.frequency.exponentialRampToValueAtTime(1150, t + 0.07); o.frequency.exponentialRampToValueAtTime(760, t + 0.16);
      f.type = "bandpass"; f.frequency.value = 1300; f.Q.value = 1.5;
      g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(0.06, t + 0.02); g.gain.exponentialRampToValueAtTime(0.0001, t + 0.18);
      o.connect(f); f.connect(g); g.connect(ctx.destination); o.start(t); o.stop(t + 0.2);
    }
    function petPurr(on) {
      const ctx = petCtx();
      if (on) {
        if (DOG.purr || !ctx) return;
        const src = ctx.createBufferSource(); src.buffer = noiseBuf(ctx); src.loop = true;
        const f = ctx.createBiquadFilter(); f.type = "lowpass"; f.frequency.value = 260;
        const am = ctx.createGain(); am.gain.value = 0.5;
        const lfo = ctx.createOscillator(), lg = ctx.createGain();
        lfo.frequency.value = 26; lg.gain.value = 0.5; lfo.connect(lg); lg.connect(am.gain);
        const g = ctx.createGain(); g.gain.value = 0;
        g.gain.setTargetAtTime(0.05, ctx.currentTime, 0.4);
        src.connect(f); f.connect(am); am.connect(g); g.connect(ctx.destination);
        src.start(); lfo.start();
        DOG.purr = { src, lfo, g };
      } else if (DOG.purr) {
        const p = DOG.purr; DOG.purr = null;
        const c = MUSIC.ctx;
        p.g.gain.setTargetAtTime(0, c.currentTime, 0.25);
        setTimeout(() => { try { p.src.stop(); p.lfo.stop(); p.g.disconnect(); } catch (e) {} }, 1200);
      }
    }
    function dogPlan() {
      const P = PETS[DOG.kind];
      const saveHB = { pos: HB.pos, art: HB.art, seen: HB.seen, spot: HB.spot, path: HB.path, phase: HB.phase };
      HB.pos = DOG.pos; HB.art = DOG.art; HB.seen = DOG.seen;
      hbPlan();                                           /* 借用蜂鳥的選畫邏輯（四面穿插、偶爾換廳） */
      DOG.art = HB.art; DOG.seen = HB.seen;
      DOG.spot = HB.spot.clone(); DOG.spot.y = P.eye;
      DOG.path = HB.path.map((v) => { const c = v.clone(); c.y = P.eye; return c; });
      DOG.path[DOG.path.length - 1] = DOG.spot;
      Object.assign(HB, saveHB);
      DOG.phase = "walk";
      DOG.sniffAt = Math.random() < P.pause.p ? 0.35 + Math.random() * 0.3 : -1;
      DOG.legLen = Math.max(0.5, DOG.pos.distanceTo(DOG.path[0]));
      DOG.dash = P.dash && Math.random() < P.dash ? 1.8 : 1;
      flySetState(P.name + P.verbs[0] + "「" + (DOG.art.title || "") + "」");
    }
    function petUI() {
      PET_ORDER.forEach((k) => { const b = $(PETS[k].btn); if (b) b.classList.toggle("on", DOG.on && DOG.kind === k); });
      const hb = $("bird-btn"); if (hb) hb.classList.toggle("on", HB.on);
    }
    function dogStart(kind) {
      kind = PETS[kind] ? kind : "dog";
      if (DOG.on && DOG.kind === kind) return;
      if (DOG.on) dogStop();
      if (!artworks.length) { toast("展廳還在掛畫，請稍候。", true); return; }
      if (TOUR.on) tourStop();
      if (FLY.on) flyStop();
      if (DRONE.on) droneStop();
      if (HB.on) hbStop();
      closeArt();
      if (!exploring) enter();
      if (document.pointerLockElement) document.exitPointerLock();
      move = { f: 0, b: 0, l: 0, r: 0, run: 0 };
      wheelBoost = 0;
      const P = PETS[kind];
      DOG.on = true; DOG.kind = kind;
      DOG.pos = hbClamp(camera.position.clone());
      DOG.fy = P.fly ? camera.position.y : P.eye; DOG.pos.y = DOG.fy;
      DOG.yaw = yaw; DOG.pitch = 0; DOG.roll = 0; DOG.t = 0; DOG.spd = 0; DOG.seen = []; DOG.art = null; DOG.tilt = 0; DOG.barks = 0; DOG.nod = 0;
      dogPlan();
      DOG.lift = 0; DOG.liftTo = 0; DOG.held = 0;
      document.body.classList.add("dogging");
      petUI();
      musicEnsure();
      if (MUSIC.ctx && MUSIC.ctx.state !== "running") MUSIC.ctx.resume().catch(() => {});
      const key = { dog: "J", elephant: "Y", cat: "U", parrot: "O" }[kind];
      toast(`${{ dog: "🐶", elephant: "🐘", cat: "🐱", parrot: "🦜" }[kind]} ${P.name}出發！按 ${key}、Esc、W/A/D＋↓ 或點畫面即可接手。`);
    }
    function dogStop() {
      if (!DOG.on) return;
      DOG.on = false;
      DOG.lift = 0; DOG.liftTo = 0; DOG.held = 0;
      petPurr(false);
      if (window.speechSynthesis) { try { speechSynthesis.cancel(); } catch (e) {} }
      $("parrot-say").classList.remove("show");
      document.body.classList.remove("dogging");
      petUI();
      flySetState("");
      const p = camera.position;
      p.y = PLAYER.h;
      const rid = flyRoomAt(p) || curRoomId || "hall";
      const r = LAYOUT.find((x) => x.id === rid);
      for (let i = 0; i < 60 && !inside(p.x, p.z); i++) { p.x += (r.cx - p.x) * 0.08; p.z += (r.cz - p.z) * 0.08; }
      setCamAngles(DOG.yaw, 0);
    }
    function dogToggle(kind) {
      kind = PETS[kind] ? kind : "dog";
      if (DOG.on && DOG.kind === kind) dogStop(); else dogStart(kind);
    }
    function dogTick(dt) {
      if (!exploring || !DOG.art) return;
      const D = DOG, P = PETS[D.kind], pos = D.pos, art = D.art;
      D.t += dt;
      const target = D.path[0] || D.spot;
      const dx = target.x - pos.x, dz = target.z - pos.z, dist = Math.hypot(dx, dz);
      let yT = D.yaw, pT = D.kind === "elephant" ? -0.05 : 0.04, walkSpd = 0;
      if (D.phase === "walk") {
        if (D.path.length > 1 && dist < 0.5) { D.path.shift(); D.legLen = Math.max(0.5, pos.distanceTo(D.path[0])); }
        else if (D.path.length <= 1 && dist < 0.12) {
          D.phase = "sit"; D.hold = rnd(P.hold); D.tiltT = 1 + Math.random();
          if (P.fly) D.perchY = rnd(P.fly.perch);
          D.barks = Math.random() < P.voice.p ? Math.round(rnd(P.voice.n)) : 0;
          D.barkT = 0.35 + Math.random() * 0.3;
          flySetState(P.name + P.verbs[1] + "「" + (art.title || "") + "」");
        } else if (D.sniffAt > 0 && D.path.length <= 1 && dist / D.legLen < 1 - D.sniffAt) {
          D.phase = "sniff"; D.sniffLen = D.sniff = rnd(P.pause.dur); D.sniffAt = -1; D.sniffYaw = D.yaw;
          petPauseSound(D.kind);
          flySetState(P.name + P.pause.verb + "…");
        }
        yT = Math.atan2(-dx, -dz);
        const turn = Math.cos(Math.min(Math.PI / 2, Math.abs(angWrap(yT - D.yaw))));
        walkSpd = P.speed * D.dash * Math.max(0, turn) * Math.min(1, dist / 0.6 + 0.25);
      } else if (D.phase === "sniff") {
        D.sniff -= dt;
        pT = P.pause.pitch;
        const u = 1 - D.sniff / D.sniffLen;
        yT = D.sniffYaw + Math.sin(u * Math.PI * 2) * P.pause.swing;   /* 甩鼻子／東張西望 */
        if (D.sniff <= 0) { D.phase = "walk"; flySetState(P.name + P.verbs[0] + "「" + (art.title || "") + "」"); }
      } else {
        const eyeNow = P.fly ? D.fy : P.eye + ((LIFT_EYE[D.kind] || P.eye) - P.eye) * (D.lift * D.lift * (3 - 2 * D.lift));
        const aim = tourAim(TMP.dir.set(pos.x, eyeNow, pos.z), art.lookAt);
        yT = aim.yaw; pT = aim.pitch;
        if (D.liftTo > 0) {                                  /* 被抱著：不計看畫時間，抱夠了就放下 */
          D.held -= dt;
          if (D.held <= 0) petPutDown();
        } else if (D.lift > 0.01) {
          /* 正在放下，等落地 */
        } else if (D.barks > 0) {
          D.barkT -= dt;
          if (D.barkT <= 0) {
            petVoice(D.kind); D.nod = 1; D.barks--;
            D.barkT = D.barks ? rnd(P.voice.gap) : 0;
          }
        } else D.hold -= dt;                                 /* 叫完才開始計時看畫 */
        D.tiltT -= dt;
        if (D.tiltT <= 0 && !D.liftTo) { D.tilt = D.tilt ? 0 : (Math.random() < 0.5 ? -1 : 1) * rnd(P.tilt); D.tiltT = 1.2 + Math.random() * 1.4; }
        if (D.hold <= 0 && D.barks <= 0 && D.lift <= 0.01 && !D.liftTo) { D.tilt = 0; dogPlan(); }
      }
      D.spd += (walkSpd - D.spd) * (1 - Math.exp(-P.accel * dt));
      const dyaw = angWrap(yT - D.yaw);
      D.yaw += dyaw * (1 - Math.exp(-(D.phase === "walk" ? P.turn : P.turn * 0.7) * dt));
      pos.x += -Math.sin(D.yaw) * D.spd * dt;
      pos.z += -Math.cos(D.yaw) * D.spd * dt;
      hbClamp(pos);
      if (P.fly) {                                           /* 鸚鵡：飛行高度＋中段上揚的弧線，停下時降到棲息高度 */
        let yT2 = D.perchY;
        if (D.phase !== "sit") {
          const prog = D.path.length <= 1 ? Math.max(0, Math.min(1, 1 - Math.hypot(dx, dz) / D.legLen)) : 0.5;
          yT2 = P.fly.cruise + Math.sin(prog * Math.PI) * P.fly.arc;
          if (D.path.length > 1) yT2 = Math.min(yT2, 2.6);   /* 穿門時壓低 */
        }
        D.fy += (yT2 - D.fy) * (1 - Math.exp(-1.8 * dt));
        pos.y = D.fy;
      } else pos.y = P.eye;
      /* 與目標畫至少 2 m */
      const inw = TMP.v.copy(art.stand).sub(art.lookAt); inw.y = 0; inw.normalize();
      const along = (pos.x - art.lookAt.x) * inw.x + (pos.z - art.lookAt.z) * inw.z;
      if (along < HB_GAP && Math.abs((pos.x - art.lookAt.x) * inw.z - (pos.z - art.lookAt.z) * inw.x) < 2) {
        pos.x += inw.x * (HB_GAP - along); pos.z += inw.z * (HB_GAP - along);
      }
      D.nod *= Math.exp(-(D.kind === "elephant" ? 3 : 9) * dt);
      D.pitch += (pT - D.pitch) * (1 - Math.exp(-3 * dt));
      const rollT = D.phase === "sit" ? D.tilt : Math.max(-0.06, Math.min(0.06, -dyaw * 0.2));
      D.roll += (rollT - D.roll) * (1 - Math.exp(-5 * dt));
      /* 步態：每一步上下起伏、左右微晃＋腳步聲；停下時只有呼吸起伏 */
      let bob = 0, sway = 0;
      if (D.spd > 0.06) {
        const prev = D.step;
        D.step += D.spd / P.speed * P.gait * dt;
        bob = Math.abs(Math.sin(D.step * Math.PI)) * P.bob;
        sway = Math.sin(D.step * Math.PI) * P.sway;
        if (Math.floor(D.step) !== Math.floor(prev)) petStepSound(D.kind, Math.floor(D.step) % 2);
      } else if (D.phase === "sit") bob = Math.sin(D.t * (D.kind === "elephant" ? 0.9 : 2.2)) * (D.kind === "elephant" ? 0.012 : 0.006);
      if (D.kind === "elephant" && D.phase === "sit") D.roll += Math.sin(D.t * 1.7) * 0.0006;   /* 耳朵搧動般的輕晃 */
      const nodAmt = D.nod > 0.02 ? Math.sin((1 - D.nod) * Math.PI) * P.voice.nod : 0;
      /* 抱起／放下：1.2 秒平滑升降；抱著時有大人呼吸般的輕晃 */
      D.lift += Math.sign(D.liftTo - D.lift) * Math.min(Math.abs(D.liftTo - D.lift), dt / 1.2);
      const le = D.lift * D.lift * (3 - 2 * D.lift);
      const liftY = ((LIFT_EYE[D.kind] || P.eye) - P.eye) * le;
      let hx = 0, hz = 0, hr = 0;
      if (le > 0.01) {
        const sw = Math.sin(D.t * 1.3) * 0.018 * le;
        hx = Math.cos(D.yaw) * sw; hz = -Math.sin(D.yaw) * sw;
        hr = Math.sin(D.t * 1.3 + 0.6) * 0.02 * le;
        bob += Math.sin(D.t * 2.6) * 0.008 * le;
      }
      camera.position.set(pos.x + hx, pos.y + bob + liftY, pos.z + hz);
      yaw = D.yaw; pitch = D.pitch;
      camera.rotation.set(D.pitch - nodAmt, D.yaw, D.roll + sway + hr, "YXZ");
      petLiftUI();
    }

    /* ================= v23 360 全景輸出（C 路線） ================= */
    const PANO_VERT = "varying vec2 vUv;\nvoid main(){ vUv = uv; gl_Position = vec4(position.xy, 0.0, 1.0); }";
    const PANO_FRAG = [
      "uniform samplerCube envMap;",
      "varying vec2 vUv;",
      "const float PI = 3.141592653589793;",
      "vec3 l2s(vec3 c){ c = max(c, vec3(0.0)); return mix(pow(c, vec3(0.41666)) * 1.055 - vec3(0.055), c * 12.92, step(c, vec3(0.0031308))); }",
      "void main(){",
      "  float lon = (vUv.x - 0.5) * 2.0 * PI;",
      "  float lat = (vUv.y - 0.5) * PI;",
      "  vec3 dir = vec3(cos(lat) * sin(lon), sin(lat), -cos(lat) * cos(lon));",
      "  gl_FragColor = vec4(l2s(textureCube(envMap, dir).rgb), 1.0);",
      "}"
    ].join("\n");

    /* 把 GPano 標記塞進 JPEG 的 APP1，FB／Google 相簿才會當成 360 照片 */
    function panoXMP(W, H) {
      return '<?xpacket begin="\uFEFF" id="W5M0MpCehiHzreSzNTczkc9d"?>' +
          '<x:xmpmeta xmlns:x="adobe:ns:meta/"><rdf:RDF xmlns:rdf="http://www.w3.org/1999/02/22-rdf-syntax-ns#">' +
          '<rdf:Description rdf:about="" xmlns:GPano="http://ns.google.com/photos/1.0/panorama/"' +
          ' GPano:ProjectionType="equirectangular" GPano:UsePanoramaViewer="True"' +
          ' GPano:CroppedAreaImageWidthPixels="' + W + '" GPano:CroppedAreaImageHeightPixels="' + H + '"' +
          ' GPano:FullPanoWidthPixels="' + W + '" GPano:FullPanoHeightPixels="' + H + '"' +
          ' GPano:CroppedAreaLeftPixels="0" GPano:CroppedAreaTopPixels="0" GPano:PoseHeadingDegrees="0"/>' +
          '</rdf:RDF></x:xmpmeta><?xpacket end="w"?>';
    }
    async function panoTagJPEG(blob, W, H) {
      try {
        const buf = new Uint8Array(await blob.arrayBuffer());
        if (buf[0] !== 0xFF || buf[1] !== 0xD8) return blob;
        const xmp = panoXMP(W, H);
        const body = new TextEncoder().encode("http://ns.adobe.com/xap/1.0/\u0000" + xmp);
        const len = body.length + 2;
        if (len > 65533) return blob;
        const seg = new Uint8Array(body.length + 4);
        seg[0] = 0xFF; seg[1] = 0xE1; seg[2] = (len >> 8) & 255; seg[3] = len & 255;
        seg.set(body, 4);
        const out = new Uint8Array(buf.length + seg.length);
        out.set(buf.subarray(0, 2), 0);
        out.set(seg, 2);
        out.set(buf.subarray(2), 2 + seg.length);
        return new Blob([out], { type: "image/jpeg" });
      } catch (e) { return blob; }
    }

    /* v25：WebP 版 GPano —— 轉成 VP8X 延伸格式，加 XMP 旗標與「XMP 」chunk */
    async function panoTagWebP(blob, W, H) {
      try {
        const buf = new Uint8Array(await blob.arrayBuffer());
        const tag = (o) => String.fromCharCode(buf[o], buf[o + 1], buf[o + 2], buf[o + 3]);
        if (buf.length < 20 || tag(0) !== "RIFF" || tag(8) !== "WEBP") return blob;
        const u32 = (o) => (buf[o] | (buf[o + 1] << 8) | (buf[o + 2] << 16) | (buf[o + 3] << 24)) >>> 0;
        const chunks = [];
        for (let o = 12; o + 8 <= buf.length;) {
          const sz = u32(o + 4);
          const end = Math.min(buf.length, o + 8 + sz + (sz & 1));
          chunks.push({ id: tag(o), data: buf.subarray(o, end) });
          o = end;
        }
        if (chunks.some((c) => c.id === "XMP ")) return blob;
        const mk = (id, payload) => {
          const pad = payload.length & 1;
          const c = new Uint8Array(8 + payload.length + pad);
          for (let i = 0; i < 4; i++) c[i] = id.charCodeAt(i);
          const n = payload.length;
          c[4] = n & 255; c[5] = (n >> 8) & 255; c[6] = (n >> 16) & 255; c[7] = (n >>> 24) & 255;
          c.set(payload, 8);
          return c;
        };
        const parts = [];
        if (chunks[0].id === "VP8X") {
          const x = new Uint8Array(chunks[0].data);
          x[8] |= 0x04;                                   /* XMP 旗標 */
          parts.push(x);
          for (let i = 1; i < chunks.length; i++) parts.push(chunks[i].data);
        } else {
          const v = new Uint8Array(10);
          v[0] = 0x04;
          const w1 = W - 1, h1 = H - 1;
          v[4] = w1 & 255; v[5] = (w1 >> 8) & 255; v[6] = (w1 >> 16) & 255;
          v[7] = h1 & 255; v[8] = (h1 >> 8) & 255; v[9] = (h1 >> 16) & 255;
          parts.push(mk("VP8X", v));
          chunks.forEach((c) => parts.push(c.data));
        }
        parts.push(mk("XMP ", new TextEncoder().encode(panoXMP(W, H))));
        const total = 12 + parts.reduce((a, p) => a + p.length, 0);
        const out = new Uint8Array(total);
        out.set(buf.subarray(0, 12), 0);
        const rs = total - 8;
        out[4] = rs & 255; out[5] = (rs >> 8) & 255; out[6] = (rs >> 16) & 255; out[7] = (rs >>> 24) & 255;
        let o = 12;
        parts.forEach((p) => { out.set(p, o); o += p.length; });
        return new Blob([out], { type: "image/webp" });
      } catch (e) { return blob; }
    }

    async function panoOne(roomId) {
      const rec = LAYOUT.find((r) => r.id === roomId);
      if (!rec) return null;
      const face = TOUCH ? 768 : 1024;
      const W = face * 4, H = face * 2;
      const cubeRT = new THREE.WebGLCubeRenderTarget(face, { generateMipmaps: false, minFilter: THREE.LinearFilter, magFilter: THREE.LinearFilter });
      const cubeCam = new THREE.CubeCamera(0.08, 180, cubeRT);
      cubeCam.position.set(rec.cx, PLAYER.h, rec.cz);
      bendV(cubeCam.position);
      scene.add(cubeCam);
      renderer.shadowMap.needsUpdate = true;
      cubeCam.update(renderer, scene);
      scene.remove(cubeCam);

      const rt = new THREE.WebGLRenderTarget(W, H, { minFilter: THREE.LinearFilter, magFilter: THREE.LinearFilter, depthBuffer: false });
      const mat = new THREE.ShaderMaterial({
        uniforms: { envMap: { value: cubeRT.texture } },
        vertexShader: PANO_VERT, fragmentShader: PANO_FRAG,
        depthTest: false, depthWrite: false
      });
      const quad = new THREE.Mesh(new THREE.PlaneGeometry(2, 2), mat);
      const flat = new THREE.Scene(); flat.add(quad);
      const ortho = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);
      const prev = renderer.getRenderTarget();
      renderer.setRenderTarget(rt);
      renderer.render(flat, ortho);
      const px = new Uint8Array(W * H * 4);
      renderer.readRenderTargetPixels(rt, 0, 0, W, H, px);
      renderer.setRenderTarget(prev);

      const cv = document.createElement("canvas");
      cv.width = W; cv.height = H;
      const ctx = cv.getContext("2d");
      const img = ctx.createImageData(W, H);
      const row = W * 4;
      for (let y = 0; y < H; y++) {                    /* WebGL 由下往上，要翻回來 */
        img.data.set(px.subarray((H - 1 - y) * row, (H - y) * row), y * row);
      }
      ctx.putImageData(img, 0, 0);

      quad.geometry.dispose(); mat.dispose(); rt.dispose(); cubeRT.dispose();
      markShadow();

      let fmt = PANO.fmt, raw = null, fell = false;
      if (fmt === "webp") {
        raw = await new Promise((res) => cv.toBlob(res, "image/webp", 0.9));
        if (!raw || raw.type !== "image/webp") { fmt = "jpg"; raw = null; fell = true; }   /* 舊版 Safari 不支援 WebP 編碼 */
      }
      if (!raw) raw = await new Promise((res) => cv.toBlob(res, "image/jpeg", 0.9));
      cv.width = cv.height = 1;
      if (!raw) return null;
      const blob = fmt === "webp" ? await panoTagWebP(raw, W, H) : await panoTagJPEG(raw, W, H);
      return { blob, name: rec.name, w: W, h: H, fmt, fell };
    }

    async function panoExport() {
      if (exporting || importing || panoBusy) return;
      if (!artworks.length) { setProgress("展廳還在掛畫，請稍候再輸出。", true); return; }
      const ids = TOUR.hall === "all" ? ["hall", "west", "east", "west2", "east2"] : [TOUR.hall];
      panoBusy = true;
      setBusy(true);
      try {
        const done = [];
        let fellBack = false;
        for (let i = 0; i < ids.length; i++) {
          setProgress(`產生 360 全景（${PANO.fmt === "webp" ? "WebP" : "JPG"}）… ${i + 1} / ${ids.length}`);
          await new Promise((r) => setTimeout(r, 30));
          const out = await panoOne(ids[i]);
          if (!out) continue;
          if (out.fell) fellBack = true;
          const ext = out.fmt === "webp" ? "webp" : "jpg";
          const mime = out.fmt === "webp" ? "image/webp" : "image/jpeg";
          const name = `${fileSafe(HALL.name)}-${fileSafe(out.name)}-360-${mmdd()}.${ext}`;
          let shared = false;
          if (TOUCH && ids.length === 1 && typeof File === "function" && navigator.canShare) {
            try {
              const f = new File([out.blob], name, { type: mime });
              if (navigator.canShare({ files: [f] })) { await navigator.share({ files: [f], title: name }); shared = true; }
            } catch (e) {}
          }
          if (!shared) {
            const url = URL.createObjectURL(out.blob);
            const a = document.createElement("a");
            a.href = url; a.download = name;
            document.body.appendChild(a); a.click(); a.remove();
            setTimeout(() => URL.revokeObjectURL(url), 60000);
            await new Promise((r) => setTimeout(r, 400));   /* 連續下載留間隔，避免瀏覽器擋掉 */
          }
          done.push(`${out.name}（${ext.toUpperCase()} · ${(out.blob.size / 1048576).toFixed(1)} MB · ${out.w}×${out.h}）`);
        }
        setProgress(done.length
          ? `已輸出 360 全景：${done.join("、")}。` +
            (fellBack ? "此瀏覽器不支援 WebP 編碼，已自動改存 JPG。"
              : PANO.fmt === "webp" ? "WebP 已寫入 GPano 標記；FB 對 WebP 360 支援不穩，要發 360 貼文請改選 JPG。"
              : "上傳到 FB 時會自動辨識為 360 照片。")
          : "沒有可輸出的展廳。", !done.length);
      } catch (e) {
        setProgress("360 輸出失敗：" + ((e && e.message) || e), true);
      } finally {
        panoBusy = false;
        setBusy(false);
      }
    }

    /* ================= v21 觀圖（縮放 / 平移） ================= */
    const LENS = { on: false, s: 1, s0: 1, min: 1, max: 4, tx: 0, ty: 0, w: 0, h: 0, pinch: null, drag: null, lastTap: 0, tipT: 0 };

    function lensApply() {
      const img = $("lens-img");
      img.style.transform = "translate3d(" + LENS.tx.toFixed(1) + "px," + LENS.ty.toFixed(1) + "px,0) scale(" + LENS.s.toFixed(4) + ")";
      $("lens-pct").textContent = Math.round(LENS.s / (LENS.s0 || 1) * 100) + "%";
    }
    function lensClamp() {
      const st = $("lens-stage").getBoundingClientRect();
      const w = LENS.w * LENS.s, h = LENS.h * LENS.s;
      LENS.tx = w <= st.width ? (st.width - w) / 2 : Math.min(0, Math.max(st.width - w, LENS.tx));
      LENS.ty = h <= st.height ? (st.height - h) / 2 : Math.min(0, Math.max(st.height - h, LENS.ty));
    }
    function lensFit(keepScale) {
      if (!LENS.w || !LENS.h) return;
      const st = $("lens-stage").getBoundingClientRect();
      LENS.s0 = Math.min(st.width / LENS.w, st.height / LENS.h) * 0.94;
      LENS.min = LENS.s0 * 0.9;
      LENS.max = Math.min(Math.max(LENS.s0 * 10, 3), 8);   /* 最多放到原圖像素的 3～8 倍 */
      if (!keepScale) LENS.s = LENS.s0;
      LENS.s = Math.max(LENS.min, Math.min(LENS.max, LENS.s));
      lensClamp(); lensApply();
    }
    function lensZoomAt(k, px, py) {
      const st = $("lens-stage").getBoundingClientRect();
      const x = px - st.left, y = py - st.top;
      const ns = Math.max(LENS.min, Math.min(LENS.max, LENS.s * k));
      const r = ns / LENS.s;
      LENS.tx = x - (x - LENS.tx) * r;
      LENS.ty = y - (y - LENS.ty) * r;
      LENS.s = ns;
      lensClamp(); lensApply();
    }
    function lensToggleAt(px, py) {
      if (LENS.s > LENS.s0 * 1.05) lensFit(false);
      else lensZoomAt(3, px, py);
    }
    function lensOpen() {
      const src = $("iv-img").getAttribute("src");
      if (!src) return;
      const img = $("lens-img");
      LENS.on = true;
      LENS.pinch = null; LENS.drag = null;
      $("lens-title").textContent = editing ? [editing.title, editing.artist, editing.year].filter(Boolean).join(" · ") : "";
      $("lens").classList.add("open");
      $("lens-tip").classList.remove("gone");
      clearTimeout(LENS.tipT);
      LENS.tipT = setTimeout(() => $("lens-tip").classList.add("gone"), 3200);
      const ready = () => {
        LENS.w = img.naturalWidth || 1200;
        LENS.h = img.naturalHeight || 900;
        img.style.width = LENS.w + "px";
        img.style.height = LENS.h + "px";
        lensFit(false);
      };
      img.onload = ready;
      img.onerror = () => { LENS.w = 1200; LENS.h = 900; lensFit(false); };
      if (img.getAttribute("src") !== src) img.setAttribute("src", src);
      else if (img.complete) ready();
    }
    function lensClose() {
      if (!LENS.on) return;
      LENS.on = false;
      LENS.pinch = null; LENS.drag = null;
      $("lens").classList.remove("open", "grabbing");
      if (DRONE.on && DRONE.mode === "inside") closeArt();   /* 離開畫中 → 關檢視器，無人機退回 */
    }
    function bindLens() {
      const stage = $("lens-stage");
      $("iv-zoom").onclick = (e) => { e.stopPropagation(); lensOpen(); };
      $("iv-mount").addEventListener("click", (e) => { if (e.target.id !== "iv-zoom") lensOpen(); });
      $("lens-x").onclick = lensClose;
      $("lens-bar").addEventListener("click", (e) => {
        const b = e.target.closest("button[data-lens]");
        if (!b) return;
        const st = stage.getBoundingClientRect();
        const cx = st.left + st.width / 2, cy = st.top + st.height / 2;
        const k = b.dataset.lens;
        if (k === "in") lensZoomAt(1.4, cx, cy);
        else if (k === "out") lensZoomAt(1 / 1.4, cx, cy);
        else if (k === "fit") lensFit(false);
        else lensClose();
      });

      /* 滑鼠：滾輪縮放、拖曳平移、雙擊放大 */
      stage.addEventListener("wheel", (e) => {
        if (!LENS.on) return;
        e.preventDefault();
        let dy = e.deltaY;
        if (e.deltaMode === 1) dy *= 16;
        lensZoomAt(Math.exp(-dy * 0.0022), e.clientX, e.clientY);
      }, { passive: false });
      stage.addEventListener("dblclick", (e) => { if (LENS.on) lensToggleAt(e.clientX, e.clientY); });
      stage.addEventListener("mousedown", (e) => {
        if (!LENS.on || e.button !== 0) return;
        e.preventDefault();
        LENS.drag = { x: e.clientX, y: e.clientY, moved: 0 };
        $("lens").classList.add("grabbing");
      });
      addEventListener("mousemove", (e) => {
        if (!LENS.on || !LENS.drag) return;
        LENS.tx += e.clientX - LENS.drag.x;
        LENS.ty += e.clientY - LENS.drag.y;
        LENS.drag.x = e.clientX; LENS.drag.y = e.clientY;
        lensClamp(); lensApply();
      });
      addEventListener("mouseup", () => { LENS.drag = null; $("lens").classList.remove("grabbing"); });

      /* 觸控：單指平移、雙指縮放、連點兩下放大 */
      stage.addEventListener("touchstart", (e) => {
        if (!LENS.on) return;
        e.preventDefault(); e.stopPropagation();
        if (e.touches.length >= 2) {
          const a = e.touches[0], b = e.touches[1];
          LENS.pinch = { d: Math.hypot(a.clientX - b.clientX, a.clientY - b.clientY), x: (a.clientX + b.clientX) / 2, y: (a.clientY + b.clientY) / 2 };
          LENS.drag = null;
        } else {
          const t = e.touches[0];
          LENS.drag = { x: t.clientX, y: t.clientY, moved: 0 };
        }
      }, { passive: false });
      stage.addEventListener("touchmove", (e) => {
        if (!LENS.on) return;
        e.preventDefault(); e.stopPropagation();
        if (e.touches.length >= 2 && LENS.pinch) {
          const a = e.touches[0], b = e.touches[1];
          const d = Math.hypot(a.clientX - b.clientX, a.clientY - b.clientY);
          const mx = (a.clientX + b.clientX) / 2, my = (a.clientY + b.clientY) / 2;
          if (LENS.pinch.d > 0) lensZoomAt(d / LENS.pinch.d, mx, my);
          LENS.tx += mx - LENS.pinch.x;
          LENS.ty += my - LENS.pinch.y;
          LENS.pinch = { d: d, x: mx, y: my };
          lensClamp(); lensApply();
        } else if (LENS.drag && e.touches.length === 1) {
          const t = e.touches[0];
          const dx = t.clientX - LENS.drag.x, dy = t.clientY - LENS.drag.y;
          LENS.drag.moved += Math.abs(dx) + Math.abs(dy);
          LENS.tx += dx; LENS.ty += dy;
          LENS.drag.x = t.clientX; LENS.drag.y = t.clientY;
          lensClamp(); lensApply();
        }
      }, { passive: false });
      const lensTouchEnd = (e) => {
        if (!LENS.on) return;
        e.stopPropagation();
        if (e.touches.length < 2) LENS.pinch = null;
        if (e.touches.length === 0) {
          if (e.type === "touchend" && LENS.drag && LENS.drag.moved < 12) {
            const t = e.changedTouches[0], now = Date.now();
            if (now - LENS.lastTap < 330) { lensToggleAt(t.clientX, t.clientY); LENS.lastTap = 0; }
            else LENS.lastTap = now;
          }
          LENS.drag = null;
        }
      };
      stage.addEventListener("touchend", lensTouchEnd);
      stage.addEventListener("touchcancel", lensTouchEnd);
      addEventListener("resize", () => { if (LENS.on) lensFit(true); });
    }

    /* ================= v38 免按住轉向（游標未鎖定時） =================
       · 游標鎖定（點畫面後）：和以前一樣，滑鼠移動＝轉頭，沒有邊界
       · 未鎖定（按 Esc、關掉大圖／平面圖、瀏覽器不給鎖定時）：滑鼠左右移動直接轉向，
         游標推到畫面左右邊緣 18% 內會持續轉；按住拖曳時才一併調整上下 */
    const HOVER = { x: 0, in: false, cx: 0, cy: 0 };
    /* v69：未鎖定時以游標為準星 */
    function aimFree() { return !locked && HOVER.in && hoverOn() && !uiBlocked(); }
    function aimSync() {
      const on = aimFree(), h = $("hair");
      document.body.classList.toggle("aim-free", on);
      if (!h) return;
      if (on) { h.style.left = HOVER.cx + "px"; h.style.top = HOVER.cy + "px"; }
      else if (h.style.left) { h.style.left = ""; h.style.top = ""; }
    }
    /* 游標所指的水平方向（供前進用）；取不到時回傳 false */
    function aimDir(out) {
      const r = renderer.domElement.getBoundingClientRect();
      const nx = ((HOVER.cx - r.left) / r.width) * 2 - 1, ny = -((HOVER.cy - r.top) / r.height) * 2 + 1;
      out.set(nx, ny, 0.5).unproject(camera).sub(camera.position);
      out.y = 0;
      if (out.lengthSq() < 1e-6) return false;
      out.normalize();
      return true;
    }
    function hoverOn() { return exploring && !TOUCH && !FLY.on && !DRONE.on && !TOUR.on && !HB.on && !DOG.on; }
    function hoverTick(dt) {
      if (document.body.classList.contains("aim-free") !== aimFree()) aimSync();   /* 導覽／檢視器開關時同步 */
      if (locked || !HOVER.in || !hoverOn() || uiBlocked()) return;
      const ex = Math.abs(HOVER.x) - 0.82;
      if (ex <= 0) return;
      yaw -= Math.sign(HOVER.x) * Math.min(1, ex / 0.18) * 1.8 * dt;
      camera.rotation.set(pitch, yaw, 0, "YXZ");
    }
    let resumeT = 0;
    function showResume() {
      $("resume").classList.add("show");
      clearTimeout(resumeT);
      resumeT = setTimeout(() => $("resume").classList.remove("show"), 4000);
    }

    function closeArt() {
      if (LENS.on) { lensClose(); return; }          /* 觀圖開著時，Esc／關閉先收觀圖 */
      if (!$("inspector").classList.contains("open")) return;
      $("inspector").classList.remove("open");
      editing = null;
      exploring = true;
      if (!TOUCH) showResume();
    }

    function saveArt() {
      if (VIEWONLY || !editing) return;
      editing.title = $("iv-title").value.trim() || editing.title;
      editing.artist = $("iv-artist").value.trim();
      editing.year = $("iv-year").value.trim();
      editing.description = $("iv-desc").value;
      const meta = loadMeta();
      meta[editing.id] = { title: editing.title, artist: editing.artist, year: editing.year, description: editing.description, frame: editing.frame || "gold", file: editing.fileName, shape: editing.shape || "auto", matte: matteOf(editing) };
      if (!saveMeta(meta)) setStatus("文字無法存檔（瀏覽器禁止儲存），重開後會還原。", true);
      refreshPlaque(editing);
    }

    /* ================= 輸入 ================= */
    function bind() {
      const on = (e, v) => {
        if (e.code === "KeyW" || e.code === "ArrowUp") move.f = v;
        if (e.code === "ArrowDown") move.b = v;
        if (e.code === "KeyA" || e.code === "ArrowLeft") move.l = v;
        if (e.code === "KeyD" || e.code === "ArrowRight") move.r = v;
        if (e.code === "ShiftLeft" || e.code === "ShiftRight") move.run = v;
      };
      addEventListener("keydown", (e) => {
        if (e.target.tagName === "INPUT" || e.target.tagName === "TEXTAREA") {
          if (e.code === "Escape") closeArt();
          return;
        }
        if (FLY.on && /^(KeyW|KeyA|KeyS|KeyD|Arrow)/.test(e.code)) flyStop();
        if (HB.on && /^(KeyW|KeyA|KeyS|KeyD|Arrow)/.test(e.code)) hbStop();
        if (DOG.on && e.code === "Space") { e.preventDefault(); if (!e.repeat) petLift(); return; }
        if (DOG.on && /^(KeyW|KeyA|KeyS|KeyD|Arrow)/.test(e.code)) dogStop();
        if (DRONE.on) {
          if (e.code === "Space" || e.code === "KeyE") { DRONE.ku = 1; e.preventDefault(); }
          if (e.code === "KeyC" || e.code === "KeyQ") { DRONE.ku = -1; e.preventDefault(); }
        }
        on(e, 1);
        const map = { Digit1: () => setWallStyle(0), Digit2: () => setWallStyle(1), Digit3: () => setWallStyle(2),
          Digit4: () => setLightMode(0), Digit5: () => setLightMode(1), Digit6: () => setLightMode(2), Digit7: () => setLightMode(3),
          KeyL: cycleLightMode, KeyK: () => setWallStyle(WALLS.mode + 1), KeyH: () => toggleHud(), KeyB: () => setDecor(DECOR.mode + 1, true),
          KeyG: () => tourStart(false), KeyR: () => tourStart(true), KeyF: () => flyToggle(), KeyV: () => droneToggle(), KeyM: () => musicToggle(), KeyP: () => planToggle(), KeyN: () => hbToggle(), KeyJ: () => dogToggle("dog"), KeyY: () => dogToggle("elephant"), KeyU: () => dogToggle("cat"), KeyO: () => dogToggle("parrot"), KeyX: () => pupSwap(), KeyZ: () => pupHide(), KeyT: () => goHomeAll(), Home: () => goHomeAll(),
          Escape: () => { if (DRONE.on) droneStop(); else if (HB.on) hbStop(); else if (DOG.on) dogStop(); else if (FLY.on) flyStop(); else if (TOUR.on) tourStop(); else closeArt(); } };
        const code = e.code.replace("Numpad", "Digit");
        if (map[code]) { e.preventDefault(); map[code](); }
      });
      addEventListener("keyup", (e) => {
        on(e, 0);
        if (/^(Space|KeyE|KeyC|KeyQ)$/.test(e.code)) DRONE.ku = 0;
      });
      addEventListener("blur", () => { move = { f: 0, b: 0, l: 0, r: 0, run: 0 }; DRONE.ku = 0; DRONE.mIn = false; });
      /* v29：Drone 以游標位置控制 */
      addEventListener("mousemove", (e) => {
        if (!DRONE.on) return;
        const r = renderer.domElement.getBoundingClientRect();
        DRONE.cx = e.clientX; DRONE.cy = e.clientY;
        DRONE.mx = ((e.clientX - r.left) / r.width) * 2 - 1;
        DRONE.my = -(((e.clientY - r.top) / r.height) * 2 - 1);
        DRONE.mIn = e.target === renderer.domElement;
      });
      document.addEventListener("mouseout", (e) => { if (!e.relatedTarget) DRONE.mIn = false; });
      renderer.domElement.addEventListener("contextmenu", (e) => {
        if (!DRONE.on) return;
        e.preventDefault();
        droneStop();
      });
      addEventListener("wheel", (e) => {
        if (!exploring || uiBlocked()) return;
        e.preventDefault();
        let dy = e.deltaY;
        if (e.deltaMode === 1) dy *= 16;
        if (DRONE.on) { DRONE.thr = Math.max(-1, Math.min(1, DRONE.thr - dy * 0.0025)); return; }
        if (FLY.on) flyStop();
        if (HB.on) hbStop();
        if (DOG.on) dogStop();
        wheelBoost += -dy * 0.045;
        wheelBoost = Math.max(-16, Math.min(16, wheelBoost));
      }, { passive: false });
      addEventListener("mousemove", (e) => {
        HOVER.in = e.target === renderer.domElement;
        HOVER.x = (e.clientX / innerWidth) * 2 - 1;
        HOVER.cx = e.clientX; HOVER.cy = e.clientY;
        aimSync();
        if (uiBlocked()) return;
        if (locked) {
          yaw -= e.movementX * 0.0022;
          pitch -= e.movementY * 0.0022;
        } else if (hoverOn()) {
          /* v69：游標就是準星，移動滑鼠不再自己轉向（原本會讓游標和圓心錯開）；
             轉向＝游標推到左右邊緣，或按住拖曳（上下左右一起） */
          if (!HOVER.in || !dragLook) return;
          const mx = Math.max(-80, Math.min(80, e.movementX || 0));
          const my = Math.max(-80, Math.min(80, e.movementY || 0));
          dragMoved += Math.abs(mx) + Math.abs(my);
          yaw -= mx * 0.0034;
          pitch -= my * 0.003;
        } else if (dragLook && exploring) {
          dragMoved += Math.abs(e.movementX) + Math.abs(e.movementY);
          yaw -= e.movementX * 0.003;
          pitch -= e.movementY * 0.003;
        } else return;
        pitch = Math.max(-1.2, Math.min(1.2, pitch));
        camera.rotation.set(pitch, yaw, 0, "YXZ");
      });
      document.addEventListener("mouseleave", () => { HOVER.in = false; aimSync(); });
      addEventListener("blur", () => { HOVER.in = false; aimSync(); });
      renderer.domElement.addEventListener("mousedown", (e) => {
        if (e.button !== 0 || uiBlocked() || TOUCH) return;
        if (!exploring) { enter(); return; }
        if (DRONE.on) {
          e.preventDefault();
          const art = artAtXY(e.clientX, e.clientY);
          if (art) droneDive(art);
          return;
        }
        if (FLY.on) { flyStop(); return; }
        if (HB.on) { hbStop(); return; }
        if (DOG.on) { dogStop(); return; }
        dragLook = true;
        dragMoved = 0;
      });
      addEventListener("mouseup", (e) => {
        if (!dragLook) return;
        dragLook = false;
        if (uiBlocked() || !exploring) return;
        if (dragMoved < 10) {
          const art = locked ? lookTarget : (artAtXY(e.clientX, e.clientY) || (hoverOn() ? lookTarget : null));
          if (art) openArt(art);
          else if (!locked) renderer.domElement.requestPointerLock();
        }
      });
      renderer.domElement.addEventListener("click", () => {
        if (!exploring) enter();
        /* 觸控開畫只走 touchend，避免 touchend + click 重複開啟 */
      });
      document.addEventListener("pointerlockchange", () => {
        locked = document.pointerLockElement === renderer.domElement;
        aimSync();
        if (locked && uiBlocked()) { document.exitPointerLock(); return; }   /* v39：檢視器開著時不應鎖定游標 */
        if (exploring && !locked && !uiBlocked() && !TOUCH) showResume(); else $("resume").classList.remove("show");
      });
      $("enter").onclick = enter;
      $("enter").addEventListener("touchend", (e) => { e.preventDefault(); enter(); }, { passive: false });
      bindTour();
      bindConsoleMove();
      /* v59：分享檔 → 音樂庫連結改用公開網址（原檔連到擁有者自己的頻道後台），並顯示說明 */
      if (GID) {
        document.body.classList.add("shared");
        const ml = $("music-lib");
        if (ml) ml.href = "https://www.youtube.com/audiolibrary";
      }
      bindLens();
      $("iv-close").onclick = closeArt;
      $("iv-save").onclick = () => { saveArt(); closeArt(); };
      $("iv-file").onchange = async (e) => {
        const f = e.target.files && e.target.files[0];
        e.target.value = "";                         // 同一張圖可再選一次
        if (!f || !editing) return;
        await replaceTexture(editing, f);
      };
      /* v39：畫作檢視器／觀圖中按右鍵 → 直接關閉回展廳（輸入框內保留瀏覽器原生選單，方便複製貼上） */
      const rightClose = (e) => {
        if (e.target.closest("input, textarea")) return;
        e.preventDefault();
        if (LENS.on) lensClose();
        closeArt();
        if (!TOUCH && exploring && !uiBlocked() && !DRONE.on && !FLY.on && !HB.on && !DOG.on) {
          try { renderer.domElement.requestPointerLock(); } catch (err) {}
        }
      };
      addEventListener("contextmenu", (e) => {
        if (LENS.on || $("inspector").classList.contains("open")) rightClose(e);
      }, true);
      $("inspector").addEventListener("click", (e) => { if (e.target.id === "inspector") closeArt(); });
      $("light-bar").addEventListener("click", (e) => {
        e.stopPropagation();
        const b = e.target.closest("[data-light]");
        if (!b) return;
        if (document.pointerLockElement) document.exitPointerLock();
        setLightMode(+b.dataset.light);
      });
      $("wall-bar").addEventListener("click", (e) => {
        e.stopPropagation();
        const b = e.target.closest("[data-wall]");
        if (!b) return;
        if (document.pointerLockElement) document.exitPointerLock();
        if (b.dataset.wall === "rand") wallRandom(); else setWallStyle(+b.dataset.wall);
      });
      const decorPick = (e) => {
        e.stopPropagation();
        const b = e.target.closest("[data-decor]");
        if (!b) return;
        if (document.pointerLockElement) document.exitPointerLock();
        setDecor(+b.dataset.decor, true);
      };
      $("decor-bar").addEventListener("click", decorPick);
      $("cover-decor").addEventListener("click", decorPick);
      $("lang-switch").addEventListener("click", (e) => {
        const b = e.target.closest("[data-lang]");
        if (b) applyLang(b.dataset.lang);
      });
      bindMusic();
      bindPlan();
      bindSceneTools();
      $("seen-clear").onclick = seenClear;
      seenUI();
      $("hud-hide").onclick = () => toggleHud(false);
      $("fly-btn").onclick = (e) => { e.currentTarget.blur(); flyToggle(); };
      $("drone-btn").onclick = (e) => { e.currentTarget.blur(); droneToggle(); };
      $("hud-peek").onclick = () => toggleHud(true);
      $("room-chip").onclick = () => $("perf").classList.toggle("show");
      $("iv-matte").addEventListener("click", (e) => {
        const b = e.target.closest("[data-matte]");
        if (!b || !editing) return;
        setMatte(editing, b.dataset.matte);
        saveArt();
      });
      $("iv-shape").addEventListener("click", (e) => {
        const b = e.target.closest("[data-shape]");
        if (!b || !editing) return;
        setFrameShape(editing, b.dataset.shape);
        saveArt();
      });
      $("iv-frame").addEventListener("click", (e) => {
        const b = e.target.closest("[data-frame]");
        if (!b || !editing) return;
        setFrameColor(editing, b.dataset.frame);
        saveArt();
      });
      $("export-btn").onclick = () => exportShare(false);
      $("share-view-btn").onclick = () => exportShare(true);
      $("share-fly-btn").onclick = () => exportShare(true, true);
      $("pet-lift").onclick = (e) => { e.stopPropagation(); e.currentTarget.blur(); petLift(); };
      $("pet-lift").addEventListener("touchend", (e) => { e.preventDefault(); e.stopPropagation(); petLift(); }, { passive: false });
      [["dog", "dog"], ["el", "elephant"], ["cat", "cat"], ["par", "parrot"]].forEach(([id, kind]) => {
        $(id + "-in-btn").onclick = (e) => { e.currentTarget.blur(); dogStart(kind); };
        $(id + "-btn").onclick = (e) => { e.stopPropagation(); e.currentTarget.blur(); dogToggle(kind); };
      });
      $("bird-in-btn").onclick = (e) => { e.currentTarget.blur(); hbStart(); };
      $("bird-btn").onclick = (e) => { e.stopPropagation(); e.currentTarget.blur(); hbToggle(); };
      $("fly-in-btn").onclick = (e) => { e.currentTarget.blur(); flyStart(); };
      $("fly-in-btn").addEventListener("touchend", (e) => { e.preventDefault(); flyStart(); }, { passive: false });
      $("excel-file").onchange = async (e) => {
        const f = e.target.files && e.target.files[0];
        e.target.value = "";
        if (f) await importLabels(f);
      };
      $("excel-tpl").onclick = downloadLabelTemplate;
      $("hud-home").onclick = (e) => { e.stopPropagation(); goHomeAll(); };
      bindSlots();
      $("import-files").onchange = async (e) => {
        const files = Array.from(e.target.files || []);
        e.target.value = "";
        await importBatch(files);
      };
      bindDrop();
      bindTouch();
    }

    function enter() {
      exploring = true;
      $("blocker").classList.add("hidden");
      $("loader").classList.add("hidden");
      if (renderer && !TOUCH) {
        try { renderer.domElement.requestPointerLock(); } catch (err) {}
      }
    }

    function bindTouch() {
      if (!TOUCH) return;
      document.body.classList.add("touch");
      const stickEl = $("stick");
      const knob = $("knob");
      let stickId = null, lookId = null, lastX = 0, lastY = 0, moved = 0;

      function setStick(dx, dy) {
        const max = 46;
        const len = Math.hypot(dx, dy) || 1;
        const s = Math.min(1, len / max);
        const nx = (dx / len) * s;
        const ny = (dy / len) * s;
        stick.x = nx; stick.y = ny;
        knob.style.transform = `translate(${nx * max}px, ${ny * max}px)`;
      }

      stickEl.addEventListener("touchstart", (e) => {
        e.preventDefault();
        const t = e.changedTouches[0];
        stickId = t.identifier;
        const r = stickEl.getBoundingClientRect();
        setStick(t.clientX - (r.left + r.width / 2), t.clientY - (r.top + r.height / 2));
      }, { passive: false });

      /* 按住前進／後退：只認按下它的那根手指（原版任何手指放開都會停走） */
      function holdWalk(el, key) {
        if (!el) return;
        let pid = null;
        el.addEventListener("pointerdown", (e) => {
          e.preventDefault(); e.stopPropagation();
          pid = e.pointerId;
          try { el.setPointerCapture(pid); } catch {}
          move[key] = 1; if (key === "f") move._go = 1;
          el.classList.add("held");
        });
        const up = (e) => {
          if (e.pointerId !== pid) return;
          pid = null;
          move[key] = 0; if (key === "f") move._go = 0;
          el.classList.remove("held");
        };
        el.addEventListener("pointerup", up);
        el.addEventListener("pointercancel", up);
        el.addEventListener("lostpointercapture", up);
        el.addEventListener("touchstart", (e) => e.preventDefault(), { passive: false });
        el.addEventListener("contextmenu", (e) => e.preventDefault());
      }
      holdWalk($("go-btn"), "f");
      holdWalk($("back-btn"), "b");

      renderer.domElement.addEventListener("touchstart", (e) => {
        if (uiBlocked() || !exploring) return;
        if (e.touches.length >= 2) { move.f = 1; return; }
        const t = e.changedTouches[0];
        if (t.identifier === stickId) return;
        lookId = t.identifier; lastX = t.clientX; lastY = t.clientY; moved = 0;
      }, { passive: true });

      addEventListener("touchmove", (e) => {
        for (const t of e.changedTouches) {
          if (t.identifier === stickId) {
            e.preventDefault();
            const r = stickEl.getBoundingClientRect();
            setStick(t.clientX - (r.left + r.width / 2), t.clientY - (r.top + r.height / 2));
          } else if (t.identifier === lookId && exploring && !uiBlocked()) {
            const dx = t.clientX - lastX, dy = t.clientY - lastY;
            moved += Math.abs(dx) + Math.abs(dy);
            yaw -= dx * 0.0045;
            pitch -= dy * 0.0045;
            pitch = Math.max(-1.2, Math.min(1.2, pitch));
            camera.rotation.set(pitch, yaw, 0, "YXZ");
            lastX = t.clientX; lastY = t.clientY;
          }
        }
      }, { passive: false });

      const endTouch = (e) => {
        if (e.touches.length < 2 && !move._go) move.f = 0;
        for (const t of e.changedTouches) {
          if (t.identifier === stickId) {
            stickId = null; stick.x = 0; stick.y = 0;
            knob.style.transform = "translate(0,0)";
          }
          if (t.identifier === lookId) {
            lookId = null;
            if (e.type === "touchend" && moved < 14 && exploring && !uiBlocked()) {
              /* 以手指點的位置為準，沒點到才用準心 */
              const art = artAtXY(t.clientX, t.clientY) || lookTarget;
              if (art) openArt(art);
            }
          }
        }
      };
      addEventListener("touchend", endTouch);
      addEventListener("touchcancel", endTouch);
    }

    /* ================= 自動解析度 ================= */
    const PERF = { dpr: Q.dprStart, ceil: Q.dprStart, acc: 0, n: 0, bad: 0, good: 0, fps: 0 };
    function applyDpr(v) {
      PERF.dpr = v;
      renderer.setPixelRatio(v);
      renderer.setSize(innerWidth, innerHeight);
    }
    function perfTick(raw) {
      PERF.acc += raw; PERF.n++;
      if (PERF.n < 45) return;
      const avg = PERF.acc / PERF.n;
      PERF.acc = 0; PERF.n = 0;
      PERF.fps = Math.round(1 / avg);
      if (hungAll && exploring && !uiBlocked() && !document.hidden) {
        if (avg > 1 / 38) {                                   // < 38 fps 連兩次 → 降一級
          PERF.good = 0;
          if (++PERF.bad >= 2 && PERF.dpr > Q.dprMin) { PERF.bad = 0; PERF.ceil = Math.max(Q.dprMin, PERF.dpr - 0.25); applyDpr(PERF.ceil); }
        } else if (avg < 1 / 55) {
          PERF.bad = 0;
          if (++PERF.good >= 6 && PERF.dpr < PERF.ceil) { PERF.good = 0; applyDpr(Math.min(PERF.ceil, PERF.dpr + 0.25)); }
        } else { PERF.bad = 0; PERF.good = 0; }
      }
      const el = $("perf");
      if (el.classList.contains("show")) {
        el.textContent = `${PERF.fps} fps · 解析度 ×${PERF.dpr.toFixed(2)} · draw ${renderer.info.render.calls} · 燈 ${SPOTS.length + 4}`;
      }
    }

    /* ================= v53 展場小狗：自然走動（轉向、減速、彎路、聞一聞） ================= */
    const PUP = {
      el: null, sh: null, pos: null, dir: null, wp: [],
      wait: 1.8, spd: 0, yaw: Math.PI, cruise: 0.95,
      chk: 0, clear: true, on: false, h: 0.62,
      phase: "idle", sniff: 0, lookT: 0, lookOff: 0,
      greetCD: 4, flip: false, flipHold: 0,
      walkT: 0, sitFace: 0, ratio: 1.4, skin: "white",
      artQ: [], goArt: null, goSpot: null, viewing: false, lastArt: null, hidden: false
    };
    /* v54 展場狗換裝：白狗 ⇄ 哈士奇（X 鍵或 HUD「展場狗」），選擇記在本機 */
    const PUP_SKINS = {
      white: { name: "白狗", src: "", art: false, h: 0.62 },
      husky: { name: "哈士奇", src: "", art: true, h: 0.62 },
      cat: { name: "小貓", src: "", art: true, h: 0.42 }        /* v57 小貓：側面走路動畫，像哈士奇一樣巡畫 */
    };
    const PUP_CYCLE = ["white", "husky", "cat"];
    function pupSkin(name, quiet) {
      const el = PUP.el || $("corner-dog");
      if (!el || !PUP_SKINS[name]) return;
      if (!PUP_SKINS.white.src) PUP_SKINS.white.src = el.getAttribute("src");
      if (!PUP_SKINS.husky.src) { const t = $("pup-husky-src"); PUP_SKINS.husky.src = t ? t.textContent.trim() : ""; }
      if (!PUP_SKINS.cat.src) { const t = $("pup-cat-src"); PUP_SKINS.cat.src = t ? t.textContent.trim() : ""; }
      const url = PUP_SKINS[name].src;
      if (!url) return;
      PUP.skin = name;
      PUP.h = PUP_SKINS[name].h;
      const fit = () => { if (el.naturalWidth) PUP.ratio = el.naturalHeight / el.naturalWidth; };
      el.onload = fit;
      if (el.getAttribute("src") !== url) el.src = url; else fit();
      document.querySelectorAll("[data-pup]").forEach((b) => b.classList.toggle("on", b.dataset.pup === name));
      try { localStorage.setItem("gallery.pupSkin", name); } catch (e) {}
      if (!quiet && PUP.hidden) pupHide(false, true);
      if (!quiet) {
        PUP.artQ = []; PUP.goArt = null; PUP.goSpot = null; PUP.viewing = false; PUP._afterGreet = null;
        PUP.wp = []; PUP.phase = "idle"; PUP.wait = 0.4; PUP.sitFace = 0;
        toast((name === "cat" ? "🐈 " : "🐕 ") + "展場寵物換成" + PUP_SKINS[name].name + (PUP_SKINS[name].art ? "，牠會隨機一幅一幅去看畫" : ""));
      }
    }
    /* v56 隱藏展場狗：牠停止走動並從畫面消失，選擇記在本機 */
    function pupHide(force, quiet) {
      PUP.hidden = typeof force === "boolean" ? force : !PUP.hidden;
      const b = $("pup-hide-btn");
      if (b) {
        b.classList.toggle("on", PUP.hidden);
        b.lastChild.textContent = PUP.hidden ? "顯示" : "隱藏";
        b.title = PUP.hidden ? "讓寵物回到展場；再按一次或 Z 隱藏" : "隱藏展場裡走動的寵物；再按一次或 Z 顯示";
      }
      if (PUP.hidden && PUP.el) { PUP.el.classList.remove("show"); if (PUP.sh) PUP.sh.classList.remove("show"); }
      try { localStorage.setItem("gallery.pupHidden", PUP.hidden ? "1" : "0"); } catch (e) {}
      if (!quiet) toast(PUP.hidden ? "展場寵物已隱藏（Z 顯示）" : (PUP.skin === "cat" ? "🐈 " : "🐕 ") + PUP_SKINS[PUP.skin].name + "回到展場了");
    }
    function pupSwap() { pupSkin(PUP_CYCLE[(PUP_CYCLE.indexOf(PUP.skin) + 1) % PUP_CYCLE.length]); }
    const PUP_BOX = {
      west: { x: [-33.2, -17.2], z: [-7.4, 7.4] },
      hall: { x: [-12.2, 12.2], z: [-7.4, 7.4] },
      east: { x: [17.2, 33.2], z: [-7.4, 7.4] },
      west2: { x: [-59.2, -39.2], z: [-7.4, 7.4] },
      east2: { x: [39.2, 59.2], z: [-7.4, 7.4] }
    };
    const PUP_ORDER = ROOM_ORDER;
    function pupRoomOf(x) { return x < -36.4 ? "west2" : x < -14.4 ? "west" : x > 36.4 ? "east2" : x > 14.4 ? "east" : "hall"; }
    function pupAngWrap(a) { return Math.atan2(Math.sin(a), Math.cos(a)); }
    function pupClamp(p) {
      const x = p.x, z = p.z;
      const inDoor = DOOR_XS.some((d) => Math.abs(x - d) < 3.2) && Math.abs(z) < 1.35;
      if (inDoor) {
        p.z = Math.max(-1.15, Math.min(1.15, z));
        return p;
      }
      const b = PUP_BOX[pupRoomOf(x)];
      p.x = Math.max(b.x[0], Math.min(b.x[1], x));
      p.z = Math.max(b.z[0], Math.min(b.z[1], z));
      return p;
    }
    function pupRandIn(room) {
      const b = PUP_BOX[room];
      /* 偏中間走，少貼牆；偶爾靠近牆邊聞一聞 */
      const edge = Math.random() < 0.28;
      const mx = (b.x[0] + b.x[1]) * 0.5, mz = (b.z[0] + b.z[1]) * 0.5;
      const hx = (b.x[1] - b.x[0]) * 0.5, hz = (b.z[1] - b.z[0]) * 0.5;
      const rx = edge ? (Math.random() < 0.5 ? b.x[0] + 0.4 + Math.random() * 1.4 : b.x[1] - 0.4 - Math.random() * 1.4)
                      : mx + (Math.random() * 2 - 1) * hx * 0.72;
      const rz = edge ? (Math.random() < 0.5 ? b.z[0] + 0.5 + Math.random() * 1.6 : b.z[1] - 0.5 - Math.random() * 1.6)
                      : mz + (Math.random() * 2 - 1) * hz * 0.68;
      return new THREE.Vector3(rx, 0, rz);
    }
    function pupArtSpot(room) {
      if (!artworks || !artworks.length) return null;
      const pool = artworks.filter((a) => a.room === room || a.hall === room || a.salon === room);
      const list = pool.length ? pool : artworks;
      const art = list[Math.floor(Math.random() * list.length)];
      return pupSpotFor(art);
    }
    function pupSpotFor(art) {
      if (!art || !art.lookAt || !art.stand) return null;
      const p = art.stand.clone();
      p.y = 0;
      /* 站在畫作前方約 2.4 m，略偏一側，像停下來抬頭看 */
      const inw = TMP.v.set(art.stand.x - art.lookAt.x, 0, art.stand.z - art.lookAt.z);
      if (inw.lengthSq() < 0.01) return pupClamp(p);
      inw.normalize();
      const side = Math.random() < 0.5 ? -1 : 1;
      p.x = art.lookAt.x + inw.x * 2.45 + inw.z * side * (0.4 + Math.random() * 0.9);
      p.z = art.lookAt.z + inw.z * 2.45 - inw.x * side * (0.4 + Math.random() * 0.9);
      return pupClamp(p);
    }
    function pupBend(from, to) {
      const dx = to.x - from.x, dz = to.z - from.z;
      const d = Math.hypot(dx, dz);
      if (d < 2.4) return [to];
      const n = d > 8 ? 2 : 1;
      const out = [];
      for (let i = 1; i <= n; i++) {
        const t = i / (n + 1);
        const px = from.x + dx * t, pz = from.z + dz * t;
        const off = (Math.random() * 2 - 1) * Math.min(2.1, d * 0.18);
        const nx = -dz / d, nz = dx / d;
        const q = new THREE.Vector3(px + nx * off, 0, pz + nz * off);
        pupClamp(q);
        out.push(q);
      }
      out.push(to);
      return out;
    }
    function pupInit() {
      PUP.el = $("corner-dog"); PUP.sh = $("dog-shadow");
      if (!PUP.el) return;
      PUP.pos = new THREE.Vector3(-2.6, 0, 5.2);
      PUP.dir = new THREE.Vector3(0, 0, -1);
      PUP.yaw = Math.PI;
      PUP.ray = new THREE.Raycaster();
      PUP.on = true;
      PUP.phase = "idle";
      PUP.wait = 1.2 + Math.random() * 1.4;
      let saved = "white";
      try { saved = localStorage.getItem("gallery.pupSkin") || "white"; } catch (e) {}
      pupSkin(PUP_SKINS[saved] ? saved : "white", true);
      let hid = false;
      try { hid = localStorage.getItem("gallery.pupHidden") === "1"; } catch (e) {}
      pupHide(hid, true);
      const hb = $("pup-hide-btn");
      if (hb) hb.addEventListener("click", (e) => { e.stopPropagation(); if (document.pointerLockElement) document.exitPointerLock(); pupHide(); });
      const bar = $("pup-bar");
      if (bar) bar.addEventListener("click", (e) => {
        e.stopPropagation();
        const b = e.target.closest("[data-pup]");
        if (!b) return;
        if (document.pointerLockElement) document.exitPointerLock();
        pupSkin(b.dataset.pup);
      });
    }
    /* v55 哈士奇巡畫：把所有畫洗牌成一輪，逐幅走過去看，看完一輪再重新洗牌（不會連續看同一幅） */
    function pupNextArt() {
      PUP.artQ = PUP.artQ.filter((a) => artworks && artworks.includes(a) && a.stand && a.lookAt);
      if (!PUP.artQ.length && artworks && artworks.length) {
        const q = artworks.filter((a) => a.stand && a.lookAt);
        for (let i = q.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [q[i], q[j]] = [q[j], q[i]]; }
        if (q.length > 1 && q[0] === PUP.lastArt) q.push(q.shift());
        PUP.artQ = q;
      }
      return PUP.artQ[0] || null;
    }
    function pupPlan(preferAway) {
      let hArt = null, hDest = null;
      if (PUP_SKINS[PUP.skin] && PUP_SKINS[PUP.skin].art) {
        hArt = pupNextArt();
        hDest = hArt ? pupSpotFor(hArt) : null;
        if (!hDest) hArt = null;
      }
      PUP.goArt = hArt; PUP.goSpot = hDest; PUP.viewing = false;
      const here = pupRoomOf(PUP.pos.x);
      let to = here;
      const roll = Math.random();
      if (preferAway && camera) {
        const pr = pupRoomOf(camera.position.x);
        const opts = PUP_ORDER.filter((r) => r !== pr);
        to = opts[Math.floor(Math.random() * opts.length)] || here;
      } else if (roll < 0.22) to = PUP_ORDER[Math.floor(Math.random() * PUP_ORDER.length)];
      else if (roll < 0.38) {
        const i = PUP_ORDER.indexOf(here);
        to = PUP_ORDER[Math.max(0, Math.min(PUP_ORDER.length - 1, i + (Math.random() < 0.5 ? -1 : 1)))] || here;
      }
      if (hDest) to = pupRoomOf(hDest.x);
      const wp = [];
      const i0 = PUP_ORDER.indexOf(here), i1 = PUP_ORDER.indexOf(to);
      if (i0 !== i1) {
        const step = i1 > i0 ? 1 : -1;
        for (let i = i0; i !== i1; i += step) {
          const doorX = DOOR_XS[Math.min(i, i + step)];
          const z0 = (Math.random() - 0.5) * 0.7;
          wp.push(new THREE.Vector3(doorX - 2.6 * step, 0, z0));
          wp.push(new THREE.Vector3(doorX + 2.6 * step, 0, z0 + (Math.random() - 0.5) * 0.35));
        }
      }
      let dest;
      if (!hDest && Math.random() < 0.42) dest = pupArtSpot(to);
      if (!dest) dest = pupRandIn(to);
      if (hDest) dest = hDest;
      else if (preferAway && camera) {
        const dx = dest.x - camera.position.x, dz = dest.z - camera.position.z;
        if (Math.hypot(dx, dz) < 3.5) dest = pupRandIn(to);
      }
      const last = wp.length ? wp[wp.length - 1] : PUP.pos;
      wp.push.apply(wp, pupBend(last, dest));
      PUP.wp = wp;
      PUP.phase = "walk";
      PUP.walkT = 0;
      PUP.cruise = (Math.random() < 0.22 ? 1.35 : 0.82) + Math.random() * 0.18;   /* 偶爾小跑 */
      PUP.sitFace = 0;
    }
    function pupTick(dt) {
      if (!PUP.on || !PUP.el) return;
      if (DOG.on || !exploring || PUP.hidden) {
        PUP.el.classList.remove("show");
        if (PUP.sh) PUP.sh.classList.remove("show");
        return;
      }
      const pos = PUP.pos;
      PUP.greetCD = Math.max(0, PUP.greetCD - dt);

      /* 玩家靠近：先抬頭看你，再繞開，而不是原地凍結 */
      if (camera && PUP.greetCD <= 0) {
        const pdx = camera.position.x - pos.x, pdz = camera.position.z - pos.z;
        const pd = Math.hypot(pdx, pdz);
        if (pd < 2.15) {
          PUP.greetCD = 7 + Math.random() * 4;
          PUP.phase = "idle";
          PUP.wait = 0.7 + Math.random() * 0.6;
          PUP.sitFace = Math.atan2(pdx, pdz);
          PUP.viewing = false;
          PUP.wp = [];
          const away = Math.atan2(-pdx, -pdz);
          const side = (Math.random() < 0.5 ? 1 : -1) * (1.6 + Math.random() * 1.4);
          const hop = new THREE.Vector3(
            pos.x + Math.sin(away) * 2.8 + Math.cos(away) * side,
            0,
            pos.z + Math.cos(away) * 2.8 - Math.sin(away) * side
          );
          pupClamp(hop);
          PUP._afterGreet = hop;
        }
      }

      let wantYaw = PUP.yaw;
      let wantSpd = 0;

      if (PUP.phase === "idle" || PUP.wait > 0) {
        PUP.wait -= dt;
        PUP.lookT -= dt;
        if (PUP.lookT <= 0) {
          PUP.lookOff = (Math.random() * 2 - 1) * (PUP.viewing ? 0.18 : 0.55);
          PUP.lookT = 0.7 + Math.random() * 1.4;
        }
        wantYaw = (PUP.sitFace || PUP.yaw) + PUP.lookOff;
        wantSpd = 0;
        if (PUP.wait <= 0) {
          PUP.sitFace = 0;
          PUP.viewing = false;
          if (PUP._afterGreet) {
            PUP.wp = pupBend(pos, PUP._afterGreet);
            PUP._afterGreet = null;
            PUP.phase = "walk";
            PUP.cruise = 1.05;
            PUP.walkT = 0;
          } else pupPlan(false);
        }
      } else if (PUP.phase === "sniff") {
        PUP.sniff -= dt;
        wantSpd = 0;
        wantYaw = PUP.yaw + Math.sin((PUP.sniff) * 3.2) * 0.35;
        if (PUP.sniff <= 0) { PUP.phase = "walk"; PUP.walkT = 0; }
      } else if (PUP.wp.length) {
        const t = PUP.wp[0];
        const dx = t.x - pos.x, dz = t.z - pos.z;
        const d = Math.hypot(dx, dz);
        const last = PUP.wp.length === 1;
        if (d < (last ? 0.38 : 0.55)) {
          PUP.wp.shift();
          if (!PUP.wp.length) {
            PUP.phase = "idle";
            const g = PUP.goArt, sp = PUP.goSpot;
            if (g && sp && Math.hypot(pos.x - sp.x, pos.z - sp.z) < 0.9) {
              /* 到畫前：轉身面向畫，停下來看久一點 */
              PUP.sitFace = Math.atan2(g.lookAt.x - pos.x, g.lookAt.z - pos.z) || 1e-4;
              PUP.wait = 3.5 + Math.random() * 3.5;
              PUP.viewing = true;
              PUP.lookOff = 0; PUP.lookT = 1.2;
              if (PUP.artQ[0] === g) PUP.artQ.shift();
              PUP.lastArt = g;
              PUP.goArt = null; PUP.goSpot = null;
            } else {
              PUP.wait = 1.4 + Math.random() * 3.2;
              PUP.sitFace = PUP.yaw + (Math.random() * 2 - 1) * 0.4;
            }
          }
        } else {
          wantYaw = Math.atan2(dx, dz);
          const arrive = last ? Math.max(0.12, Math.min(1, d / 1.35)) : 1;
          wantSpd = PUP.cruise * arrive;
          PUP.walkT += dt;
          /* 走一段路後偶爾停下來聞地面 */
          if (PUP.walkT > 2.2 && d > 1.4 && Math.random() < dt * 0.18) {
            PUP.phase = "sniff";
            PUP.sniff = 0.7 + Math.random() * 1.1;
          }
        }
      } else pupPlan(false);

      const dyaw = pupAngWrap(wantYaw - PUP.yaw);
      const turnK = PUP.phase === "walk" ? 2.6 : 3.4;
      PUP.yaw += dyaw * (1 - Math.exp(-turnK * dt));
      /* 轉彎時自然減速，避免原地自旋滑步 */
      const turnSlow = Math.max(0.18, Math.cos(Math.min(1.2, Math.abs(dyaw))));
      const target = wantSpd * turnSlow;
      const k = target > PUP.spd ? 2.1 : 3.8;
      PUP.spd += (target - PUP.spd) * (1 - Math.exp(-k * dt));
      if (PUP.spd < 0.02) PUP.spd = 0;
      if (PUP.spd > 0) {
        pos.x += Math.sin(PUP.yaw) * PUP.spd * dt;
        pos.z += Math.cos(PUP.yaw) * PUP.spd * dt;
        pupClamp(pos);
      }
      PUP.dir.set(Math.sin(PUP.yaw), 0, Math.cos(PUP.yaw));

      PUP.chk -= dt;
      if (PUP.chk <= 0 && camera && PUP.ray) {
        PUP.chk = 0.12;
        const eye = pos.clone(); eye.y = PUP.h * 0.6;
        const v = eye.sub(camera.position);
        const dist = v.length();
        PUP.ray.set(camera.position, v.normalize());
        PUP.ray.far = dist;
        const hit = wallMeshes.length ? PUP.ray.intersectObjects(wallMeshes, false) : [];
        PUP.clear = !(hit.length && hit[0].distance < dist - 0.25);
      }
      pupDraw(dt);
    }
    function pupDraw(dt) {
      const el = PUP.el, sh = PUP.sh;
      if (!camera) return;
      const fwd = TMP.pupFwd || (TMP.pupFwd = new THREE.Vector3());
      const rel = TMP.pupRel || (TMP.pupRel = new THREE.Vector3());
      camera.getWorldDirection(fwd);
      rel.copy(PUP.pos).sub(camera.position);
      const depth = rel.dot(fwd);
      if (!PUP.clear || depth < 0.45 || !exploring || DOG.on) {
        el.classList.remove("show"); sh.classList.remove("show");
        return;
      }
      camBend();
      const ndc = bendV((TMP.pupV || (TMP.pupV = new THREE.Vector3())).copy(PUP.pos)).project(camera);
      camUnbend();
      const x = (ndc.x * 0.5 + 0.5) * innerWidth;
      const y = (-ndc.y * 0.5 + 0.5) * innerHeight;
      const fov = camera.fov * Math.PI / 180;
      let hpx = (PUP.h / (2 * depth * Math.tan(fov / 2))) * innerHeight;
      hpx = Math.max(14, Math.min(innerHeight * 0.42, hpx));
      const s = hpx / (56 * PUP.ratio);           /* 56px 寬時的原始高度（依目前狗圖的長寬比） */
      const w = 56 * s;
      /* 面向：用相機右向量判斷左右，加滯後避免來回翻面 */
      const right = TMP.pupR || (TMP.pupR = new THREE.Vector3());
      right.crossVectors(fwd, TMP.up || (TMP.up = new THREE.Vector3(0, 1, 0)));
      const side = PUP.dir.dot(right);
      const wantFlip = side < 0;
      if (wantFlip !== PUP.flip) {
        PUP.flipHold += dt || 0.016;
        if (PUP.flipHold > 0.16 || Math.abs(side) > 0.22) PUP.flip = wantFlip;
      } else PUP.flipHold = 0;
      const flip = PUP.flip;
      const tx = flip ? x + w / 2 : x - w / 2;
      el.style.transform = `translate(${tx.toFixed(1)}px, ${(y - hpx).toFixed(1)}px) scale(${(flip ? -s : s).toFixed(4)}, ${s.toFixed(4)})`;
      sh.style.transform = `translate(${x.toFixed(1)}px, ${y.toFixed(1)}px) scale(${(s * 0.9).toFixed(4)})`;
      el.classList.add("show"); sh.classList.add("show");
    }

    /* ================= 主迴圈 ================= */
    let lastRender = 0;
    function animate(now) {
      requestAnimationFrame(animate);
      const raw = clock.getDelta();
      const dt = Math.min(raw, 0.05);
      const blocked = uiBlocked();
      /* 檢視器／開始畫面開著時降到約 10 fps，省電 */
      if (blocked && now - lastRender < 100) return;
      lastRender = now;
      if (!blocked && !REC.on) perfTick(raw);     /* 錄影中不要自動改解析度 */
      let step = dt;
      const wrec = REC.on && REC.webp;
      if (wrec) {
        if (REC.busy) return;                 /* 等上一格編碼完成，時間軸不前進 → 不漏格 */
        step = 1 / REC.fps;
      }
      if (TOUR.on) tourTick(step);
      if (FLY.on && !blocked) flyTick(step);
      if (HB.on && !blocked) hbTick(step);
      else if (HB.hum && blocked) HB.hum.g.gain.setTargetAtTime(0, MUSIC.ctx.currentTime, 0.2);
      if (DOG.on && !blocked) dogTick(step);
      else if (blocked && $("pet-lift").classList.contains("show")) $("pet-lift").classList.remove("show");
      if (DRONE.on && !blocked) droneTick(step);
      movePlayer(step);
      windowFov(step);
      detectRoom();
      pick();
      updateLights(blocked ? 0.1 : step);
      if (DOT_ANIM.length && !blocked) dotTick(step);
      trailTick(step);
      hoverTick(step);
      pupTick(blocked ? 0 : step);
      camBend();
      renderer.render(scene, camera);
      camUnbend();
      if (wrec && REC.on && TOUR.on) recGrab();
    }

    function onResize() {
      if (REC.on) { recLayout(); capLayout(); return; }        /* 錄影中維持固定輸出尺寸 */
      camera.aspect = innerWidth / innerHeight;
      camera.updateProjectionMatrix();
      renderer.setSize(innerWidth, innerHeight);
      capLayout();
    }

    async function start() {
      initTmp();
      applySavedText();
      if (window.GALLERY_EMBED) {
        GALLERY.rooms.forEach((room) => {
          room.works.forEach((w) => { if (window.GALLERY_EMBED[w.id]) w.file = window.GALLERY_EMBED[w.id]; });
        });
      }
      clock = new THREE.Clock();
      scene = new THREE.Scene();
      scene.background = new THREE.Color("#1b1712");
      scene.fog = new THREE.FogExp2("#1b1712", 0.008);
      camera = new THREE.PerspectiveCamera(68, innerWidth / innerHeight, 0.08, 180);
      camera.position.set(0, PLAYER.h, 7.2);
      renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: "high-performance" });
      renderer.setPixelRatio(PERF.dpr);
      renderer.setSize(innerWidth, innerHeight);
      if (THREE.ACESFilmicToneMapping) renderer.toneMapping = THREE.ACESFilmicToneMapping;
      renderer.toneMappingExposure = 1.1;
      renderer.shadowMap.enabled = true;
      renderer.shadowMap.autoUpdate = false;     // 場景是靜態的：陰影只在有變動時重算
      document.body.prepend(renderer.domElement);
      renderer.domElement.style.touchAction = "none";
      renderer.domElement.addEventListener("webglcontextlost", (e) => {
        e.preventDefault();
        const l = $("loader");
        l.classList.remove("hidden");
        l.querySelector(".hint").textContent = "iPad 記憶體不足，畫面被系統回收。點一下重新載入。";
        l.onclick = () => location.reload();
      });
      addEventListener("resize", onResize);
      if (window.visualViewport) visualViewport.addEventListener("resize", onResize);

      SHARED = {
        backM: new THREE.MeshStandardMaterial({ color: "#1c1610", roughness: 0.9 }),
        linerM: new THREE.MeshStandardMaterial({ color: "#3d2c1c", roughness: 0.62, metalness: 0.12 }),
        plaqueBackM: new THREE.MeshStandardMaterial({ color: "#f3f0e8", roughness: 0.7 }),
        plaqueBackGeo: new THREE.BoxGeometry(0.32, 0.4, 0.03),
        plaqueGeo: new THREE.PlaneGeometry(0.28, 0.35),
        dotGeo: new THREE.CircleGeometry(0.019, 28),
        dotRimGeo: new THREE.RingGeometry(0.019, 0.022, 28),
        dotM: new THREE.MeshBasicMaterial({ map: makeDotTex() }),
        dotRimM: new THREE.MeshBasicMaterial({ color: "#8e1016" })
      };
      Object.values(SHARED).forEach((o) => { o.userData.shared = true; });

      const torchTarget = new THREE.Object3D();
      scene.add(torchTarget);
      const torch = new THREE.SpotLight(0xffe2b8, 0, 24, Math.PI / 6, 0.42, 1.1);
      scene.add(torch);
      torch.target = torchTarget;
      LIGHTS.torch = torch;
      LIGHTS.torchTarget = torchTarget;
      initSpots();                                    // 燈數從此固定 → shader 只編一次
      goldTex = makeGoldTex();
      applyHallNames();
      buildRoom();
      const savedLight = parseInt(lsGet(LIGHT_KEY) || String(HALL.light), 10);
      setLightMode(Number.isFinite(savedLight) ? savedLight : 1);
      bind();
      rebuildPickTargets();
      pupInit();
      markShadow();
      $("loader").classList.add("hidden");
      requestAnimationFrame(animate);
      if(window.VG360) await window.VG360.install({THREE,scene,renderer,panel:document.getElementById('hud'),windowMaterials:[...WIN_TINT.filter(m=>m.map),...SKY_TINT]});

      /* 30 張圖並行解碼，再一次掛上 */
      const jobs = [];
      let done = 0;
      const total = LAYOUT.reduce((n, rec) => {
        const data = GALLERY.rooms.find((r) => r.id === rec.id);
        return n + Math.min(((data && data.works) || []).length, slots10(rec).length);
      }, 0);
      const hint = $("load-progress");
      for (const rec of LAYOUT) {
        const data = GALLERY.rooms.find((r) => r.id === rec.id);
        const works = (data && data.works) || [];
        const sl = slots10(rec);
        for (let i = 0; i < works.length && i < sl.length; i++) {
          jobs.push(texFor(works[i]).then((loaded) => {
            done++;
            if (hint) setProg("progHang", { done, total });
            return { work: works[i], slot: sl[i], loaded, room: rec.id };
          }));
        }
      }
      const all = await Promise.all(jobs);
      await wingFill(all);
      all.forEach((j) => hang(j.work, j.slot, j.loaded, j.room));
      rebuildPickTargets();
      reassignSpots(true);
      markShadow();
      hungAll = true;
      setBusy(false);
      if (AUTOFLY) setTimeout(() => { if (!FLY.on && !TOUR.on && !DRONE.on) flyStart(); }, 600);
      if (hint) setProg("progReady", { n: artworks.length });
      try {                                          // Excel 改展廳參數後重新載入：顯示套用結果
        const f = JSON.parse(sessionStorage.getItem(FLASH_KEY) || "null");
        if (f) { sessionStorage.removeItem(FLASH_KEY); setProgress(f.text, f.warn); }
      } catch {}
      autoLabels();                                   /* v51：自動套用網站上的 works/labels.xlsx */
    }

    applyViewOnly();                  // 欣賞版：開機立刻套用，避免閃出可編輯的文案

    function boot() {
      if (window.THREE) start().catch((e) => { console.error(e); $("loader").querySelector(".hint").textContent = "無法啟動：" + e.message; $("loader").classList.remove("hidden"); });
      else setTimeout(boot, 40);
    }
    boot();
  