/* TT Mahjong Junior: the 3D table. One Three.js scene seen straight from above: a square mahjong table (green felt in
   a wooden rim) and all 136 tiles, ivory on a jade back like real ones, with the boys (js/actor.js) standing in front.
   The page behind is the room (CSS), so the canvas is see-through.
   - Layout works in screen pixels (js/layout.js says where every tile goes): the camera looks straight down -z, so
     toWorld(px, py, z) and toScreen() map the two exactly.
   - Every tile is one object for the whole game: MJ.stage.tile(id).to({ x, y, w, back, rot, lift, z }) and it glides
     there (and turns over, or round); snap() puts it there at once. Its face is painted on a canvas (faceTexture):
     dots, bamboo, characters, winds and dragons, in English (numbers and letters, no Chinese characters) or 中文.
   - glow(name, id): a soft glow behind a tile (your brother's best throw, the last throw); bars(): the little
     coloured lines under the sets in your hand on 🐣 EASY; compass(): the wind disc in the middle, with whose turn it
     is and how many tiles are left in the wall. */
(function () {
  'use strict';
  const T = THREE;
  const MJ = (window.MJ = window.MJ || {});
  const { makeCanvas, roundRect, toTexture, EMOJI_FONT, FONT } = Kit.gfx;

  const CW = 1, CH = 1.34; // a tile (world units before scaling)
  const TD = 0.3, BD = 0.18, BEV = 0.05; // the ivory part's depth, the jade back's depth, the bevel
  const FRONT = TD + BEV + 0.004; // where the picture sits (in front of the bevel)
  const FOV = 30, TAN = Math.tan((FOV * Math.PI) / 360), D = 60;
  const HAN = '"Kaiti SC", "STKaiti", "KaiTi", "PingFang SC", "Hiragino Sans GB", "Microsoft YaHei", "Noto Sans SC", serif';
  const C = { blue: '#1d4fa8', green: '#18804a', red: '#cf2e25', navy: '#1b2350' };

  const S = { W: 1, H: 1 };
  let renderer = null, scene = null, camera = null, sun = null;
  let tileGeo = null, backGeo = null, faceGeo = null, ivory = null, jade = null, glowTex = null;
  const faceCache = new Map();
  const tiles = [];
  const glows = {};
  let barPool = [], table = null, compassObj = null;
  let opts = { zh: false, index: false };

  function init(canvas) {
    renderer = new T.WebGLRenderer({ canvas, antialias: true, alpha: true });
    renderer.setClearColor(0x000000, 0);
    renderer.outputEncoding = T.sRGBEncoding;
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = T.PCFSoftShadowMap;
    scene = new T.Scene();
    camera = new T.PerspectiveCamera(FOV, 1, 1, 200);
    camera.position.set(0, 0, D);
    camera.lookAt(0, 0, 0);
    scene.add(new T.HemisphereLight('#fff8ee', '#c8b8a0', 0.82));
    sun = new T.DirectionalLight('#fff3e0', 0.75);
    sun.position.set(-12, 18, 34);
    sun.castShadow = true;
    sun.shadow.mapSize.set(2048, 2048);
    sun.shadow.bias = -0.0008;
    sun.shadow.radius = 3;
    const sc = sun.shadow.camera;
    sc.left = -32; sc.right = 32; sc.top = 32; sc.bottom = -32; sc.near = 1; sc.far = 100;
    scene.add(sun);

    const shape = roundShape(CW - 2 * BEV, CH - 2 * BEV, 0.12);
    tileGeo = new T.ExtrudeGeometry(shape, { depth: TD, bevelEnabled: true, bevelThickness: BEV, bevelSize: BEV, bevelSegments: 2, curveSegments: 5 });
    backGeo = new T.ExtrudeGeometry(shape, { depth: BD, bevelEnabled: true, bevelThickness: BEV, bevelSize: BEV, bevelSegments: 2, curveSegments: 5 });
    backGeo.translate(0, 0, -BD - BEV * 2);
    const face = roundShape(CW - 0.1, CH - 0.1, 0.1);
    faceGeo = new T.ShapeGeometry(face, 5);
    const pos = faceGeo.attributes.position, uv = faceGeo.attributes.uv;
    for (let i = 0; i < pos.count; i++) uv.setXY(i, pos.getX(i) / (CW - 0.1) + 0.5, pos.getY(i) / (CH - 0.1) + 0.5);
    ivory = Kit.gfx.std('#fbf3dc', { roughness: 0.38 });
    jade = Kit.gfx.std('#1f8f62', { roughness: 0.32 });
    glowTex = makeGlow();
    for (const [name, color] of [['hint', '#ffd84a'], ['last', '#ff9a3c'], ['pick', '#ffffff'], ['win', '#7df7c8']]) glows[name] = makeGlowMesh(color);
    buildTable();
    resize();
  }

  function roundShape(w, h, r) {
    const s = new T.Shape();
    const x = -w / 2, y = -h / 2;
    s.moveTo(x + r, y);
    s.lineTo(x + w - r, y);
    s.quadraticCurveTo(x + w, y, x + w, y + r);
    s.lineTo(x + w, y + h - r);
    s.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
    s.lineTo(x + r, y + h);
    s.quadraticCurveTo(x, y + h, x, y + h - r);
    s.lineTo(x, y + r);
    s.quadraticCurveTo(x, y, x + r, y);
    return s;
  }

  // a soft glow, to sit behind a tile
  function makeGlow() {
    const [c, g] = makeCanvas(256, 320);
    g.shadowColor = 'rgba(255, 255, 255, 1)';
    g.shadowBlur = 36;
    g.fillStyle = 'rgba(255, 255, 255, 1)';
    for (let k = 0; k < 3; k++) {
      roundRect(g, 48, 52, 160, 216, 26);
      g.fill();
    }
    return toTexture(c);
  }
  function makeGlowMesh(color) {
    const m = new T.Mesh(new T.PlaneGeometry(CW * 1.9, CH * 1.75), new T.MeshBasicMaterial({ map: glowTex, color, transparent: true, depthWrite: false }));
    m.visible = false;
    m.renderOrder = 2;
    scene.add(m);
    return { mesh: m, id: -1, t: 0 };
  }

  // ---------------------------------------------------------------- the tile faces

  // a coin: a ring of colour round a white ring round a dot (the dots suit started as strings of coins)
  function coin(g, x, y, r, col) {
    g.fillStyle = col;
    g.beginPath(); g.arc(x, y, r, 0, Math.PI * 2); g.fill();
    g.fillStyle = '#fffaf0';
    g.beginPath(); g.arc(x, y, r * 0.72, 0, Math.PI * 2); g.fill();
    g.fillStyle = col;
    g.beginPath(); g.arc(x, y, r * 0.5, 0, Math.PI * 2); g.fill();
    g.fillStyle = '#fffaf0';
    g.beginPath(); g.arc(x, y, r * 0.16, 0, Math.PI * 2); g.fill();
  }
  const DOTS = {
    // [x, y, colour] in a 0..1 box
    2: [[0.5, 0.27, 'g'], [0.5, 0.73, 'b']],
    3: [[0.24, 0.2, 'b'], [0.5, 0.5, 'r'], [0.76, 0.8, 'g']],
    4: [[0.28, 0.27, 'b'], [0.72, 0.27, 'g'], [0.28, 0.73, 'g'], [0.72, 0.73, 'b']],
    5: [[0.25, 0.2, 'b'], [0.75, 0.2, 'g'], [0.5, 0.5, 'r'], [0.25, 0.8, 'g'], [0.75, 0.8, 'b']],
    6: [[0.3, 0.16, 'g'], [0.7, 0.16, 'g'], [0.3, 0.52, 'r'], [0.7, 0.52, 'r'], [0.3, 0.84, 'r'], [0.7, 0.84, 'r']],
    7: [[0.22, 0.1, 'g'], [0.5, 0.2, 'g'], [0.78, 0.3, 'g'], [0.3, 0.58, 'r'], [0.7, 0.58, 'r'], [0.3, 0.86, 'r'], [0.7, 0.86, 'r']],
    8: [[0.3, 0.12, 'b'], [0.7, 0.12, 'b'], [0.3, 0.37, 'b'], [0.7, 0.37, 'b'], [0.3, 0.63, 'b'], [0.7, 0.63, 'b'], [0.3, 0.88, 'b'], [0.7, 0.88, 'b']],
    9: [[0.2, 0.15, 'b'], [0.5, 0.15, 'b'], [0.8, 0.15, 'b'], [0.2, 0.5, 'r'], [0.5, 0.5, 'r'], [0.8, 0.5, 'r'], [0.2, 0.85, 'g'], [0.5, 0.85, 'g'], [0.8, 0.85, 'g']],
  };
  const COL = { b: C.blue, g: C.green, r: C.red };
  function drawDots(g, n) {
    const x0 = 40, y0 = 44, w = 176, h = 244;
    if (n === 1) {
      // the big one: a flower-edged coin
      const x = 128, y = 166;
      g.fillStyle = C.green;
      for (let i = 0; i < 16; i++) {
        const a = (i / 16) * Math.PI * 2;
        g.beginPath(); g.arc(x + Math.cos(a) * 78, y + Math.sin(a) * 78, 14, 0, Math.PI * 2); g.fill();
      }
      coin(g, x, y, 80, C.blue);
      g.fillStyle = C.red;
      g.beginPath(); g.arc(x, y, 30, 0, Math.PI * 2); g.fill();
      g.fillStyle = '#fffaf0';
      g.beginPath(); g.arc(x, y, 10, 0, Math.PI * 2); g.fill();
      return;
    }
    const r = n <= 2 ? 50 : n <= 4 ? 42 : n === 5 ? 34 : n <= 7 ? 30 : n === 8 ? 27 : 26;
    for (const [px, py, c] of DOTS[n]) coin(g, x0 + px * w, y0 + py * h, n === 7 && py < 0.4 ? 24 : r, COL[c]);
  }

  // a bamboo stick: a rounded rod with a knot in the middle and at each end
  function stick(g, x, y, len, col) {
    const w = 20;
    g.fillStyle = col;
    roundRect(g, x - w / 2, y - len / 2, w, len, 9);
    g.fill();
    g.fillStyle = 'rgba(255, 255, 255, 0.35)';
    g.fillRect(x - w / 2 + 4, y - len / 2 + 6, 4, len - 12);
    g.fillStyle = Kit.gfx.shade(col, -0.35);
    for (const k of [-0.5, 0, 0.5]) g.fillRect(x - w / 2 - 2, y + k * (len - 8) - 3, w + 4, 6);
  }
  const STICKS = {
    // rows of sticks: [y (0..1), [x, colour] ...]
    2: [[0.27, [[0.5, 'b']]], [0.73, [[0.5, 'g']]]],
    3: [[0.27, [[0.5, 'b']]], [0.73, [[0.3, 'g'], [0.7, 'g']]]],
    4: [[0.27, [[0.3, 'b'], [0.7, 'g']]], [0.73, [[0.3, 'g'], [0.7, 'b']]]],
    5: [[0.2, [[0.24, 'g'], [0.76, 'b']]], [0.5, [[0.5, 'r']]], [0.8, [[0.24, 'b'], [0.76, 'g']]]],
    6: [[0.27, [[0.2, 'g'], [0.5, 'g'], [0.8, 'g']]], [0.73, [[0.2, 'b'], [0.5, 'b'], [0.8, 'b']]]],
    7: [[0.14, [[0.5, 'r']]], [0.5, [[0.2, 'g'], [0.5, 'b'], [0.8, 'g']]], [0.84, [[0.2, 'g'], [0.5, 'b'], [0.8, 'g']]]],
    8: [[0.27, [[0.14, 'g'], [0.38, 'b'], [0.62, 'b'], [0.86, 'g']]], [0.73, [[0.14, 'g'], [0.38, 'b'], [0.62, 'b'], [0.86, 'g']]]],
    9: [[0.16, [[0.2, 'g'], [0.5, 'r'], [0.8, 'b']]], [0.5, [[0.2, 'g'], [0.5, 'r'], [0.8, 'b']]], [0.84, [[0.2, 'g'], [0.5, 'r'], [0.8, 'b']]]],
  };
  function drawBamboo(g, n) {
    if (n === 1) {
      // the 1 of bamboo is a bird
      g.font = `150px ${EMOJI_FONT}`;
      g.textAlign = 'center';
      g.textBaseline = 'middle';
      g.fillText('🦚', 128, 172);
      return;
    }
    const x0 = 44, y0 = 44, w = 168, h = 244;
    const rows = STICKS[n];
    const len = rows.length === 2 ? 96 : 66;
    for (const [py, sticks] of rows) for (const [px, c] of sticks) stick(g, x0 + px * w, y0 + py * h, len, COL[c]);
  }

  function centred(g, text, x, y, font, color, stroke = 0) {
    g.font = font;
    g.textAlign = 'center';
    g.textBaseline = 'middle';
    if (stroke) {
      g.lineWidth = stroke;
      g.strokeStyle = '#fffaf0';
      g.strokeText(text, x, y);
    }
    g.fillStyle = color;
    g.fillText(text, x, y);
  }
  // a dragon picture for English mode, tinted (🐉 is green; the red dragon gets a red wash)
  function dragon(g, tint) {
    const [c2, g2] = makeCanvas(256, 256);
    g2.font = `170px ${EMOJI_FONT}`;
    g2.textAlign = 'center';
    g2.textBaseline = 'middle';
    g2.fillText('🐉', 128, 140);
    if (tint) {
      g2.globalCompositeOperation = 'source-atop';
      g2.globalAlpha = 0.72;
      g2.fillStyle = tint;
      g2.fillRect(0, 0, 256, 256);
    }
    g.drawImage(c2, 0, 38);
  }
  // the white dragon: a blue frame
  function frame(g) {
    g.lineWidth = 12;
    g.strokeStyle = C.blue;
    roundRect(g, 52, 58, 152, 216, 10);
    g.stroke();
    g.lineWidth = 5;
    roundRect(g, 70, 76, 116, 180, 6);
    g.stroke();
  }

  // A tile's front, for kind k: drawn once per kind, language and corner number, and kept.
  function faceTexture(k) {
    const zh = opts.zh, index = opts.index;
    const key = `${k}:${zh ? 1 : 0}:${index ? 1 : 0}`;
    if (faceCache.has(key)) return faceCache.get(key);
    const c = faceCanvas(k, zh, index);
    const tex = toTexture(c);
    tex.anisotropy = 4;
    faceCache.set(key, tex);
    return tex;
  }
  function faceCanvas(k, zh, index) {
    const R = MJ.rules;
    const [c, g] = makeCanvas(256, 332);
    const grad = g.createLinearGradient(0, 0, 0, 332);
    grad.addColorStop(0, '#fffcf3');
    grad.addColorStop(1, '#f5e9cc');
    g.fillStyle = grad;
    g.fillRect(0, 0, 256, 332);
    const suit = R.suitOf(k), n = R.rankOf(k);
    if (suit === 0) drawDots(g, n);
    else if (suit === 1) drawBamboo(g, n);
    else if (suit === 2) {
      // characters: the number on top, 万 (ten thousand) in red underneath; in English the number and WAN
      if (zh) {
        centred(g, '一二三四五六七八九'[n - 1], 128, 104, `bold 120px ${HAN}`, C.navy);
        centred(g, '万', 128, 238, `bold 122px ${HAN}`, C.red);
      } else {
        centred(g, String(n), 128, 112, `150px ${FONT}`, C.navy);
        centred(g, 'WAN', 128, 250, `62px ${FONT}`, C.red);
      }
    } else if (suit === 3) {
      if (zh) centred(g, '东南西北'[n - 1], 128, 170, `bold 170px ${HAN}`, C.navy);
      else {
        centred(g, 'ESWN'[n - 1], 128, 150, `170px ${FONT}`, C.navy);
        // a little compass needle pointing that way
        g.save();
        g.translate(128, 278);
        g.rotate([Math.PI / 2, Math.PI, -Math.PI / 2, 0][n - 1]);
        g.fillStyle = C.red;
        g.beginPath(); g.moveTo(0, -24); g.lineTo(11, 8); g.lineTo(-11, 8); g.closePath(); g.fill();
        g.restore();
      }
    } else if (n === 1) {
      if (zh) centred(g, '中', 128, 170, `bold 180px ${HAN}`, C.red);
      else dragon(g, C.red);
    } else if (n === 2) {
      if (zh) centred(g, '发', 128, 170, `bold 180px ${HAN}`, C.green);
      else dragon(g, null);
    } else frame(g);
    if (index && suit < 3) centred(g, String(n), 34, 36, `40px ${FONT}`, C.red, 8);
    return c;
  }
  // a tile's face as a picture for the page (the result panel)
  const urlCache = new Map();
  function faceURL(k) {
    const key = `${k}:${opts.zh ? 1 : 0}`;
    if (!urlCache.has(key)) urlCache.set(key, faceCanvas(k, opts.zh, false).toDataURL('image/png'));
    return urlCache.get(key);
  }

  // English or 中文 tiles, and the little corner numbers (🐣 EASY): repaint every face
  function setFaces(o) {
    const changed = o.zh !== opts.zh || o.index !== opts.index;
    opts = Object.assign({}, opts, o);
    if (!changed) return;
    for (const t of tiles) {
      t.face.material.map = faceTexture(t.kind);
      t.face.material.needsUpdate = true;
    }
  }

  // ---------------------------------------------------------------- the tiles

  // Make (or remake) the 136 tile objects; kinds[id] is each tile's kind.
  function makeTiles(kinds) {
    for (let id = 0; id < kinds.length; id++) {
      let t = tiles[id];
      if (!t) {
        const root = new T.Group();
        const spin = new T.Group();
        root.add(spin);
        const body = new T.Mesh(tileGeo, ivory);
        body.castShadow = true;
        const back = new T.Mesh(backGeo, jade);
        back.castShadow = true;
        const face = new T.Mesh(faceGeo, new T.MeshBasicMaterial({ transparent: false }));
        face.position.z = FRONT;
        spin.add(body, back, face);
        root.visible = false;
        scene.add(root);
        t = tiles[id] = {
          id, root, spin, face, kind: -1, cur: { x: 0, y: 0, z: 0, s: 0.01, rz: 0, ry: 0 }, tgt: { x: 0, y: 0, z: 0, s: 0.01, rz: 0, ry: 0 },
          speed: 12, shown: false, px: { x: 0, y: 0, w: 0 },
        };
      }
      if (t.kind !== kinds[id]) {
        t.kind = kinds[id];
        t.face.material.map = faceTexture(t.kind);
        t.face.material.needsUpdate = true;
      }
    }
  }

  // Where tile id should be, in screen pixels: { x, y (its centre), w (its width), back (face down), rot (degrees on
  // the table), lift (px up the screen), z (in front of other tiles), speed }. hide() puts it away.
  function to(id, o) {
    const t = tiles[id];
    const k = kAt(0);
    const lift = o.lift || 0;
    const v = toWorld(o.x, o.y - lift, 0);
    t.tgt.x = v.x;
    t.tgt.y = v.y;
    t.tgt.z = (o.z || 0) + (lift ? 0.6 : 0);
    t.tgt.s = (o.w * k) / CW;
    t.tgt.rz = ((o.rot || 0) * Math.PI) / 180;
    t.tgt.ry = o.back ? Math.PI : 0;
    t.speed = o.speed || 12;
    t.px = { x: o.x, y: o.y - lift, w: o.w, h: o.w * (CH / CW), rot: o.rot || 0 };
    if (!t.shown || o.snap) {
      Object.assign(t.cur, t.tgt);
      if (!t.shown && o.from) {
        // appear from a spot (the wall in the middle), small and face down
        const f = toWorld(o.from.x, o.from.y, 0);
        Object.assign(t.cur, { x: f.x, y: f.y, z: 2, s: t.tgt.s * 0.6, ry: Math.PI });
      }
    }
    t.shown = true;
    t.root.visible = true;
  }
  function hide(id) {
    const t = tiles[id];
    t.shown = false;
    t.root.visible = false;
  }
  function hideAll() {
    for (const t of tiles) hide(t.id);
    for (const g of Object.values(glows)) { g.id = -1; g.mesh.visible = false; }
    bars([]);
  }

  // ---------------------------------------------------------------- glows and bars

  function glow(name, id) {
    const g = glows[name];
    if (!g) return;
    g.id = id == null ? -1 : id;
    g.t = 0;
    g.mesh.visible = g.id >= 0;
  }
  // little lines under groups of hand tiles (🐣 EASY: green under a set, blue under a pair): [{ x0, x1, y, color }]
  function bars(list) {
    while (barPool.length < list.length) {
      const m = new T.Mesh(new T.PlaneGeometry(1, 1), new T.MeshBasicMaterial({ color: '#3fe0b0', transparent: true, opacity: 0.95, depthWrite: false }));
      m.renderOrder = 3;
      scene.add(m);
      barPool.push(m);
    }
    const k = kAt(0);
    barPool.forEach((m, i) => {
      const b = list[i];
      m.visible = !!b;
      if (!b) return;
      const v = toWorld((b.x0 + b.x1) / 2, b.y, 0.5);
      m.position.copy(v);
      m.scale.set((b.x1 - b.x0) * k, (b.h || 6) * k, 1);
      m.material.color.set(b.color);
    });
  }

  // ---------------------------------------------------------------- the table

  function buildTable() {
    table = new T.Group();
    scene.add(table);
    const felt = new T.Mesh(new T.PlaneGeometry(1, 1), new T.MeshStandardMaterial({ map: feltTexture(), roughness: 0.95 }));
    felt.receiveShadow = true;
    felt.position.z = -0.42;
    table.add(felt);
    table.userData.felt = felt;
    table.userData.rim = null;
    // the wind disc in the middle
    const [cc, cg] = makeCanvas(512, 512);
    const tex = toTexture(cc);
    const disc = new T.Mesh(new T.CircleGeometry(0.5, 48), new T.MeshStandardMaterial({ map: tex, roughness: 0.6, transparent: true }));
    disc.position.z = -0.3;
    disc.receiveShadow = true;
    scene.add(disc);
    compassObj = { mesh: disc, canvas: cc, g: cg, tex, key: '' };
  }
  function feltTexture() {
    const [c, g] = makeCanvas(512, 512);
    g.fillStyle = '#1e7a4c';
    g.fillRect(0, 0, 512, 512);
    // a soft speckle, like cloth
    for (let i = 0; i < 9000; i++) {
      g.fillStyle = Math.random() < 0.5 ? 'rgba(255,255,255,0.035)' : 'rgba(0,0,0,0.05)';
      g.fillRect(Math.random() * 512, Math.random() * 512, 2, 2);
    }
    const tex = toTexture(c);
    tex.wrapS = tex.wrapT = T.RepeatWrapping;
    return tex;
  }
  // The table fills rect (screen pixels): green felt inside a wooden rim `rim` px wide.
  function setTable(rect, rim = 14) {
    const felt = table.userData.felt;
    const k = kAt(-0.42);
    const v = toWorld(rect.x + rect.w / 2, rect.y + rect.h / 2, -0.42);
    felt.position.x = v.x;
    felt.position.y = v.y;
    felt.scale.set(rect.w * k, rect.h * k, 1);
    felt.material.map.repeat.set(rect.w / 260, rect.h / 260);
    const key = `${Math.round(rect.w)}x${Math.round(rect.h)}x${rim}`;
    if (table.userData.key !== key) {
      table.userData.key = key;
      if (table.userData.rim) {
        table.remove(table.userData.rim);
        table.userData.rim.geometry.dispose();
      }
      const w = (rect.w + 2 * rim) * k, h = (rect.h + 2 * rim) * k, r = Math.min(w, h) * 0.06;
      const outer = roundShape(w, h, r);
      const hole = roundShape(rect.w * k, rect.h * k, r * 0.6);
      outer.holes.push(hole);
      const geo = new T.ExtrudeGeometry(outer, { depth: 0.6, bevelEnabled: true, bevelThickness: 0.12, bevelSize: 0.12, bevelSegments: 2, curveSegments: 8 });
      const rimMesh = new T.Mesh(geo, Kit.gfx.std('#8a4a22', { roughness: 0.45 }));
      rimMesh.castShadow = true;
      rimMesh.receiveShadow = true;
      table.add(rimMesh);
      table.userData.rim = rimMesh;
    }
    table.userData.rim.position.set(v.x, v.y, -0.75);
    table.visible = true;
  }

  // The wind disc at (x, y), r px across... radius: whose turn (seat), each seat's wind (dealer = east), the tiles
  // left in the wall. Seats: 0 bottom, 1 right, 2 top, 3 left.
  function compass(o) {
    const cm = compassObj;
    if (!o) {
      cm.mesh.visible = false;
      return;
    }
    const k = kAt(-0.3);
    const v = toWorld(o.x, o.y, -0.3);
    cm.mesh.position.x = v.x;
    cm.mesh.position.y = v.y;
    cm.mesh.scale.setScalar(o.r * 2 * k);
    cm.mesh.visible = true;
    const key = `${o.turn}:${o.dealer}:${o.left}:${opts.zh}:${o.glow ? 1 : 0}`;
    if (cm.key === key) return;
    cm.key = key;
    const g = cm.g;
    g.clearRect(0, 0, 512, 512);
    // the wooden disc
    const grad = g.createRadialGradient(256, 230, 20, 256, 256, 256);
    grad.addColorStop(0, '#c98a4b');
    grad.addColorStop(1, '#7a4220');
    g.fillStyle = grad;
    g.beginPath(); g.arc(256, 256, 250, 0, Math.PI * 2); g.fill();
    g.strokeStyle = '#f1c453';
    g.lineWidth = 8;
    g.beginPath(); g.arc(256, 256, 232, 0, Math.PI * 2); g.stroke();
    // each seat's wind on its side; the one whose turn it is in a gold bubble
    const WIND = opts.zh ? '东南西北' : 'ESWN';
    const spots = [[256, 432], [432, 256], [256, 80], [80, 256]];
    for (let s = 0; s < 4; s++) {
      const w = (s - o.dealer + 4) % 4;
      const [x, y] = spots[s];
      const on = s === o.turn;
      g.fillStyle = on ? '#ffd84a' : 'rgba(255, 250, 235, 0.92)';
      g.beginPath(); g.arc(x, y, on ? 70 : 58, 0, Math.PI * 2); g.fill();
      if (on) {
        g.lineWidth = 8;
        g.strokeStyle = '#14121f';
        g.stroke();
      }
      centred(g, WIND[w], x, y + 4, opts.zh ? `bold ${on ? 84 : 70}px ${HAN}` : `${on ? 78 : 64}px ${FONT}`, w === 0 ? C.red : C.navy);
    }
    // the tiles left in the wall: a little tile back and the number
    g.fillStyle = '#1f8f62';
    roundRect(g, 196, 196, 46, 62, 8);
    g.fill();
    g.fillStyle = '#fbf3dc';
    roundRect(g, 196, 248, 46, 12, 4);
    g.fill();
    centred(g, String(o.left), 296, 232, `64px ${FONT}`, '#fffaf0');
    cm.tex.needsUpdate = true;
  }

  // ---------------------------------------------------------------- the screen

  function resize() {
    if (!renderer) return;
    S.W = Math.max(1, innerWidth);
    S.H = Math.max(1, innerHeight);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    renderer.setSize(S.W, S.H, false);
    camera.aspect = S.W / S.H;
    camera.updateProjectionMatrix();
  }
  // world units per pixel at depth z
  const kAt = (z = 0) => (2 * (D - z) * TAN) / S.H;
  function toWorld(px, py, z = 0) {
    const k = kAt(z);
    return new T.Vector3((px - S.W / 2) * k, (S.H / 2 - py) * k, z);
  }
  const tmpV = new T.Vector3();
  function toScreen(v) {
    tmpV.copy(v).project(camera);
    return { x: (tmpV.x + 1) * 0.5 * S.W, y: (1 - tmpV.y) * 0.5 * S.H };
  }

  // which shown tile (of `ids`) is under screen point (x, y), with a little slack
  function tileAt(x, y, ids, slack = 4) {
    let best = -1, bd = Infinity;
    for (const id of ids) {
      const t = tiles[id];
      if (!t || !t.shown) continue;
      const p = t.px, side = p.rot % 180 !== 0;
      const hw = (side ? p.h : p.w) / 2 + slack, hh = (side ? p.w : p.h) / 2 + slack;
      const dx = Math.abs(x - p.x), dy = Math.abs(y - p.y);
      if (dx <= hw && dy <= hh && dx + dy < bd) {
        bd = dx + dy;
        best = id;
      }
    }
    return best;
  }

  function update(dt) {
    const a = 1 - Math.exp(-12 * dt);
    for (const t of tiles) {
      if (!t.shown) continue;
      const c = t.cur, g = t.tgt;
      const k = 1 - Math.exp(-t.speed * dt);
      c.x += (g.x - c.x) * k;
      c.y += (g.y - c.y) * k;
      c.z += (g.z - c.z) * k;
      c.s += (g.s - c.s) * k;
      c.rz += (g.rz - c.rz) * k;
      c.ry += (g.ry - c.ry) * a;
      // a tile in flight rides up off the table a little
      const fly = Math.min(1.5, Math.hypot(g.x - c.x, g.y - c.y) * 0.25);
      t.root.position.set(c.x, c.y, c.z + fly);
      t.root.scale.setScalar(c.s);
      t.root.rotation.z = c.rz;
      t.spin.rotation.y = c.ry;
    }
    for (const g of Object.values(glows)) {
      if (g.id < 0) continue;
      const t = tiles[g.id];
      if (!t || !t.shown) {
        g.mesh.visible = false;
        continue;
      }
      g.t += dt;
      g.mesh.visible = true;
      g.mesh.position.set(t.root.position.x, t.root.position.y, t.root.position.z - 0.2);
      g.mesh.rotation.z = t.root.rotation.z;
      const pulse = 1 + Math.sin(g.t * 6) * 0.06;
      g.mesh.scale.setScalar(t.root.scale.x * pulse);
      g.mesh.material.opacity = 0.75 + Math.sin(g.t * 6) * 0.25;
    }
  }

  function render() {
    renderer.render(scene, camera);
  }

  MJ.stage = {
    init, resize, render, update, makeTiles, to, hide, hideAll, glow, bars, setTable, compass, setFaces, faceURL, tileAt,
    toWorld, toScreen, kAt, CW, CH,
    tile: (id) => tiles[id],
    get scene() { return scene; },
    get camera() { return camera; },
    get W() { return S.W; },
    get H() { return S.H; },
    get tiles() { return tiles; },
    get opts() { return opts; },
  };
})();
