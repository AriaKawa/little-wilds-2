// Everything above the ground: flora, the dead-and-revived objects, spirits, wildlife, weather and fog.
import { TW, TH, LW, LH, CW, CH, CELL, ZONES, LANDS, REGIONS, WATER, SEA, hash, fbm, FC, FCOLS, FROWS, landAtTexel, lookOf, SHRINK, hillShade } from './world.mjs?v=33';
import { GREEN, brushRadius, SPIRITS, gladeBuyable, gladePrice } from './sim.mjs?v=33';
import { pixelize, newFrame, shadowOf, skirtOf, apronOf } from './pixel.mjs?v=33';
import { duckCanvas, critterCanvas, spiritCanvas, NATIVE, SCALE, WALK_FRAMES, strideOf } from './critters.mjs?v=33';
import { steer, standable, overWater, escape } from './nav.mjs?v=33';
const money = n => n >= 1e9 ? (n / 1e9).toFixed(2) + 'b' : n >= 1e6 ? (n / 1e6).toFixed(2) + 'm' : n >= 1e4 ? (n / 1e3).toFixed(1) + 'k' : Math.floor(n).toLocaleString();

const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const SIZE = 64;
// How many plants of each grass style stay live to carry the wind, rather than being baked still.
const LIVE = { original: .22, meadow: .45, silverwave: .45, lyke: .5, none: 0 };
// The air is mostly still. Now and then a gust sweeps across the land as a broad band, a second or so long at
// any one spot, roughly every ten seconds, some stronger than others. Returns 0 (calm) to 1 (the gust's peak).
const GUST_SPEED = 110, GUST_GAP = 1100, GUST_WIDTH = 170;
export function gustAt(x, y, t) {
  const u = x * .8 + y * .45 - t * GUST_SPEED, d = ((u % GUST_GAP) + GUST_GAP) % GUST_GAP;
  if (d > GUST_WIDTH) return 0;
  const n = Math.floor(u / GUST_GAP), k = Math.abs(Math.sin(n * 12.9898 + 4.1) * 43758.5453) % 1;
  return Math.sin(d / GUST_WIDTH * Math.PI) * (.45 + .55 * k);
}

// Tiny hand-placed pixel art. Letters index a small per-sprite palette.
const art = (rows, pal) => {
  const c = document.createElement('canvas'); c.width = rows[0].length; c.height = rows.length;
  const g = c.getContext('2d');
  rows.forEach((row, y) => [...row].forEach((ch, x) => { if (pal[ch]) { g.fillStyle = pal[ch]; g.fillRect(x, y, 1, 1); } }));
  return c;
};
// Butterflies and birds come from assets/flyers.png (ChatGPT art cut by tools/build_critter_art.py): rows are a
// yellow, pink and blue butterfly, a bluebird and a robin; columns are wings up, level, down, level.
const FLY_W = 18, FLY_H = 16;
// Which cell of a land's 4x4 art sheet stands in for each kind of object.
const KIND_BLOSSOM = 2; // Frames 0-2 are the dead tree, tree and blossom tree.
const BIOME = { 0: 0, 1: 1, 2: 1, 3: 2, 4: 3, 5: 4, 6: 5, 7: 5, 8: 6, 9: 7 };
const HEART = art(['.a.a.', 'aaaaa', 'aaaaa', '.aaa.', '..a..'], { a: '#ff9dbb' });
const PETS = { deer: { row: 0, size: 20, speed: 4, label: 'A spirit deer' }, fawn: { row: 0, size: 14, speed: 5, label: 'A spirit fawn', young: true }, rabbit: { row: 1, size: 11, speed: 9, label: 'A moss rabbit' } };

export const GRASS_STYLES = { original: 'Original', meadow: 'Meadow', silverwave: 'Silverwave', lyke: 'Lyke', none: 'None' };
function floraAtlas(P, style = 'original') {
  // Rows: 0 tuft, 1 tall grass, 2-6 flowers, 7 fern. Columns: three wind poses.
  const cw = 9, ch = 11, c = document.createElement('canvas'); c.width = cw * 3; c.height = ch * 8;
  const g = c.getContext('2d'), tone = (k, a = 0) => `rgb(${P.grass.map((v, i) => clamp(v * k + (i === 1 ? a : 0), 0, 255) | 0).join(',')})`;
  const dot = (x, y, col, w = 1, h = 1) => { g.fillStyle = col; g.fillRect(x, y, w, h); };
  if (style === 'lyke') return lykeAtlas(P, cw, ch);
  if (style !== 'original' && style !== 'none') return grassAtlas(P, style, c, g, cw, ch, dot);
  for (let pose = 0; pose < 3; pose++) {
    const lean = pose - 1, X = pose * cw;
    [[3, 8, 0], [5, 7, 1], [4, 6, 1]].forEach(([x, top, l], k) => { for (let y = top; y < ch; y++) dot(X + x + (y < 9 ? lean * l : 0), y, tone(.72 + k * .22)); });
    [[2, 3], [4, 1], [6, 4], [3, 5]].forEach(([x, top], k) => { for (let y = top; y < ch; y++) dot(X + x + (y < 6 ? lean : 0) + (y < 3 ? lean : 0), ch + y, tone(.7 + k * .17, 8)); });
    P.flowers.forEach((col, f) => {
      const r = 2 + f; const fx = X + 4 + lean, fy = r * ch + 3;
      for (let y = fy + 1; y < (r + 1) * ch; y++) dot(X + 4 + (y < fy + 4 ? lean : 0), y, tone(.78));
      dot(X + 5, (r + 1) * ch - 3, tone(1)); dot(X + 3, (r + 1) * ch - 2, tone(.9));
      dot(fx - 1, fy, col); dot(fx + 1, fy, col); dot(fx, fy - 1, col); dot(fx, fy + 1, col); dot(fx, fy, f === 0 ? '#ffc93c' : '#fff3c4');
    });
    for (const [dx, dy] of [[-3, 5], [-2, 4], [-1, 3], [3, 5], [2, 4], [1, 3], [0, 2], [-2, 6], [2, 6]]) dot(X + 4 + dx + (dy < 4 ? lean : 0), 7 * ch + dy + 1, tone(.85));
    for (let y = 3; y < ch; y++) dot(X + 4 + (y < 5 ? lean : 0), 7 * ch + y, tone(.66));
  }
  return { c, cw, ch, r: 1, v: 1 };
}

// The other grass styles, drawn into the same rows and wind poses as the original.
// Meadow: thin single-pixel blades in clumps, dark at the root and pale at the tip, each leaning its own way, so
// a field reads plainly as grass and every gust and footstep shows. Silverwave: soft round tufts and feathery
// seed heads whose tips catch the light as the wind leans them, so gusts roll across the field as pale waves.
function grassAtlas(P, style, c, g, cw, ch, dot) {
  const rgb = a => `rgb(${a.map(v => clamp(v, 0, 255) | 0).join(',')})`, mixc = (a, b, t) => a.map((v, i) => v + (b[i] - v) * t);
  const grey = a => { const m = (a[0] + a[1] + a[2]) / 3; return mixc(a, [m, m, m], .3); };
  const silver = style === 'silverwave';
  const dark = rgb(grey(P.grass).map(v => v * .62)), mid = rgb(grey(P.grass).map(v => v * .9)), pale = rgb(mixc(grey(P.grass), P.lush, .45).map(v => v * 1.14));
  const sheen = rgb(mixc(P.lush, [255, 246, 214], .55)), seed = rgb(mixc(P.lush, [236, 214, 150], .6));
  // One blade: from its root at (x, bottom of row) up `len` pixels, slanting `slope` per pixel, bent at the tip by the wind.
  const blade = (X, row, x, len, slope, lean, tip = pale) => {
    for (let i = 0; i < len; i++) {
      const u = i / Math.max(1, len - 1), px = Math.round(X + x + slope * i + lean * u * u * 2), py = (row + 1) * ch - 1 - i;
      dot(px, py, i === len - 1 ? tip : i < len * .4 ? dark : mid);
    }
  };
  const TUFT = [[2, 4, -.45], [3, 6, -.22], [4, 5, .05], [5, 6, .28], [6, 4, .5], [4, 3, -.1], [3, 3, .3]];
  const TALL = [[1, 6, -.4], [3, 8, -.18], [4, 9, 0], [5, 8, .2], [7, 6, .42], [2, 5, .1], [6, 5, -.1]];
  for (let pose = 0; pose < 3; pose++) {
    const lean = pose - 1, X = pose * cw, lit = silver && lean !== 0 ? sheen : pale;
    if (silver) {
      // Soft tufts: blades packed close and short, with a round top.
      [[2, 3, -.3], [3, 5, -.12], [4, 6, 0], [5, 5, .14], [6, 3, .3], [3, 4, .2], [5, 4, -.2], [4, 3, 0]].forEach(([x, len, sl]) => blade(X, 0, x, len, sl, lean, lit));
      // Feathery seed heads on long stems.
      [[2, 7, -.25], [4, 9, 0], [6, 7, .25]].forEach(([x, len, sl], k) => {
        blade(X, 1, x, len, sl, lean, lit);
        const tx = Math.round(X + x + sl * (len - 1) + lean * 2), ty = 2 * ch - len;
        dot(tx, ty - 1, lean ? sheen : seed); dot(tx - 1 + (k & 1), ty, lean ? sheen : seed); dot(tx, ty + 1, seed);
      });
    } else {
      TUFT.forEach(([x, len, sl]) => blade(X, 0, x, len, sl, lean));
      TALL.forEach(([x, len, sl]) => blade(X, 1, x, len, sl, lean));
    }
    // Flowers stand on a thin stem among a few blades.
    P.flowers.forEach((col, f) => {
      const r = 2 + f, fx = X + 4 + lean, fy = r * ch + 4;
      [[2, 4, -.4], [6, 4, .4], [3, 3, -.1]].forEach(([x, len, sl]) => blade(X, r, x, len, sl, lean, lit));
      for (let y = fy + 1; y < (r + 1) * ch; y++) dot(X + 4 + (y < fy + 3 ? lean : 0), y, mid);
      dot(fx - 1, fy, col); dot(fx + 1, fy, col); dot(fx, fy - 1, col); dot(fx, fy + 1, col); dot(fx, fy, f === 0 ? '#ffc93c' : '#fff3c4');
    });
    // The fern row becomes a wider, low clump.
    [[1, 3, -.5], [2, 5, -.3], [4, 6, 0], [6, 5, .3], [7, 3, .5], [3, 4, .15], [5, 4, -.15]].forEach(([x, len, sl]) => blade(X, 7, x, len, sl, lean, lit));
  }
  return { c, cw, ch, r: 1, v: 1 };
}

// Lyke: grass that grows strand by strand. There are no clump pictures: every blade is its own little spike,
// broad at the root and tapering to a point, flat-coloured in one of five greens, and each has its own moment
// to sprout as the ground heals, so a spot fills in blade by blade and ends up a thick, even mat. This atlas
// holds the single blades (six lengths, leaning either way, five shades, three wind poses) at three art pixels
// to a texel, plus the wildflowers, which stand among them on bare stems.
const LR = 3, LV = 1, SWT = 7, SHT = 7, SPER = 30, SVAR = 60;
function lykeAtlas(P, cw, ch) {
  const CW_ = cw * LR, CH_ = ch * LR, Y0 = CH_ * 8, sw = SWT * LR, sh = SHT * LR, c = document.createElement('canvas');
  c.width = Math.max(CW_ * 3, SPER * sw); c.height = Y0 + 6 * sh;
  const g = c.getContext('2d');
  const mixc = (a, b, t) => a.map((v, i) => v + (b[i] - v) * t), rgb = a => `rgb(${a.map(v => clamp(v, 0, 255) | 0).join(',')})`;
  const m = (P.grass[0] + P.grass[1] + P.grass[2]) / 3, sage = mixc(P.grass, [m, m + 8, m], .14);
  const SH = [mixc(sage, [18, 44, 30], .55), sage.map(v => v * .78), sage.map(v => v * .94), mixc(sage, P.lush, .3).map(v => v * 1.04), mixc(mixc(sage, P.lush, .55), [214, 236, 170], .14).map(v => v * 1.08)];
  const shade = SH.map(rgb), root = SH.map(s => rgb(s.map(v => v * .8)));
  // One blade with its root at (X + x, bottom - 1), inside a box `wide` px across starting at X.
  const blade = (X, bottom, wide, x, len, w, slope, bend, s) => {
    for (let i = 0; i < len; i++) {
      const u = i / len, half = Math.max(.5, w * Math.pow(1 - u, .9) / 2), cx = X + x + slope * i + bend * len * u * u, y = bottom - 1 - Math.round(i * (1 - Math.abs(bend) * u * .35));
      const a = clamp(Math.round(cx - half + .5), X, X + wide - 1), b = clamp(Math.round(cx + half - .5), X, X + wide - 1);
      g.fillStyle = i < len * .22 ? root[s] : shade[s]; g.fillRect(a, y, Math.max(1, b - a + 1), 1);
    }
  };
  for (let pose = 0; pose < 3; pose++) {
    const lean = pose - 1;
    P.flowers.forEach((col, f) => {
      const X = pose * CW_, Y = (2 + f) * CH_, fx = CW_ / 2 + lean * 2, fy = Y + 14;
      blade(X, Y + CH_, CW_, CW_ / 2 - 2, 7, 3, -.35, lean * .4, 2); blade(X, Y + CH_, CW_, CW_ / 2 + 2, 6, 3, .35, lean * .4, 3);
      g.fillStyle = shade[1]; g.fillRect(X + Math.round(CW_ / 2), fy + 2, 1, CH_ - 16);
      g.fillStyle = col; g.fillRect(X + fx - 2, fy - 1, 5, 3); g.fillRect(X + fx - 1, fy - 2, 3, 5);
      g.fillStyle = f === 1 ? '#5a3a14' : '#ffc93c'; g.fillRect(X + fx, fy, 1, 1);
    });
    for (let v = 0; v < SVAR; v++) {
      const len = Math.round((2.4 + Math.floor(v / 10) * .75) * LR), lean2 = Math.floor(v / 5) % 2 ? 1 : -1, s = v % 5;
      const X = (v % SPER) * sw, Y = Y0 + (pose * 2 + Math.floor(v / SPER)) * sh;
      blade(X, Y + sh, sw, sw / 2, len, 2.6 + (v * 7 % 5) * .35, lean2 * (.05 + (v * 3 % 4) * .06), lean * .5, s);
    }
  }
  return { c, cw, ch, r: LR, v: LV, strands: { y0: Y0, sw, sh } };
}

// Trees come in four builds so a wood isn't one tree stamped over and over: the painted tree as it is, a broader,
// lower one in cooler leaf, a taller, slimmer one in fresh yellow-green, and a rounder one in warm olive, two of
// them facing the other way. Only the leaves change colour; trunks and blossom stay as painted.
const TREE_BUILDS = [null, { sx: 1.08, sy: .92, flip: true, tint: [.88, .93, 1.02] }, { sx: .9, sy: 1.08, flip: false, tint: [1.08, 1.07, .86] }, { sx: 1.04, sy: .97, flip: true, tint: [1.07, .97, .84] }];
const builds = new Map(); let buildIds = 0;
function treeBuild(src, v) {
  const [img, fx, fy, fw, fh] = src, B = TREE_BUILDS[v]; if (!B) return src;
  const key = `${img.__tb ??= ++buildIds}:${fx}:${fy}:${v}`; let c = builds.get(key);
  if (!c) {
    c = document.createElement('canvas'); c.width = fw; c.height = fh; const g = c.getContext('2d', { willReadFrequently: true });
    g.translate(fw / 2, fh); g.scale(B.flip ? -B.sx : B.sx, B.sy); g.drawImage(img, fx, fy, fw, fh, -fw / 2, -fh, fw, fh);
    const d = g.getImageData(0, 0, fw, fh), p = d.data;
    for (let i = 0; i < p.length; i += 4) if (p[i + 3] && p[i + 1] > p[i] && p[i + 1] >= p[i + 2] * .9) for (let k = 0; k < 3; k++) p[i + k] = Math.min(255, p[i + k] * B.tint[k]);
    g.putImageData(d, 0, 0); builds.set(key, c);
  }
  return [c, 0, 0, fw, fh];
}
export function createRenderer(canvas, world, land, images) {
  const ctx = canvas.getContext('2d'), cam = { x: 160, y: 530, z: 3.4, tx: 160, ty: 530, tz: 3.4 };
  let fogTick = 0, quality = 2, greeted = false, flyers = [], floaters = [], glows = [], W = 0, H = 0, dpr = 1, grass = 'original', flora = LANDS.map(P => floraAtlas(P)), particles = [], rings = [], thenC = null, shown = null, critters = [], glints = [];
  const fog = document.createElement('canvas'); fog.width = CW; fog.height = CH;
  const fogG = fog.getContext('2d'), fogAlpha = ZONES.map(() => -1), revives = new Map(), rises = new Map(), baked = new Map(), floraDirty = new Uint8Array(FCOLS * FROWS).fill(1), fogSoft = document.createElement('canvas'), wisps = new Float32Array(CW * CH);
  fogSoft.width = CW; fogSoft.height = CH; const fogSoftG = fogSoft.getContext('2d');
  for (let i = 0; i < wisps.length; i++) wisps[i] = fbm((i % CW) / 11, Math.floor(i / CW) / 11, 91);
  const glintSpots = ZONES.map(z => { const out = [], p = world.ponds[z.id]; for (let k = 0; k < (p.r > 0 ? 26 : 0); k++) { const a = hash(k, z.id, 3) * 6.28, r = Math.sqrt(hash(k, z.id, 5)) * p.r * .8; out.push([p.x + Math.cos(a) * r, p.y + Math.sin(a) * r, hash(k, z.id, 7)]); } return out; });
  const padSpots = ZONES.map(z => { const p = world.ponds[z.id]; return (p.r > 0 ? [0, 1, 2, 3] : []).map(k => [p.x + (hash(k, z.id, 11) - .5) * p.r * 1.2, p.y + (hash(k, z.id, 13) - .5) * p.r * 1.1, hash(k, z.id, 17)]); });

  const seaSpots = [];
  for (let k = 0; k < 30000 && seaSpots.length < 900; k++) { const x = Math.floor(hash(k, 1, 61) * TW), y = Math.floor(hash(k, 2, 61) * TH); if (world.edge[y * TW + x] === SEA) seaSpots.push([x, y, hash(k, 3, 61), world.zone[(y >> 2) * CW + (x >> 2)]]); }
  function resize() {
    W = innerWidth; H = innerHeight; dpr = Math.min(quality > 1 ? 2 : 1, devicePixelRatio || 1, Math.sqrt(3.7e6 / (W * H)));
    canvas.width = Math.round(W * dpr); canvas.height = Math.round(H * dpr);
    canvas.style.width = W + 'px'; canvas.style.height = H + 'px';
  }
  addEventListener('resize', resize); resize();
  const minZoom = () => Math.min(W / TW, H / TH) * .96; // Far enough out to see the whole continent and its sea.
  const sx = x => (x - cam.x) * cam.z + W / 2, sy = y => (y - cam.y) * cam.z + H / 2;
  // Keeps a view centred at (x, y) and zoom z inside the continent.
  const keepIn = (x, y, z) => { const hw = W / 2 / z, hh = H / 2 / z; return [clamp(x, Math.min(hw, TW / 2), Math.max(TW - hw, TW / 2)), clamp(y, Math.min(hh, TH / 2), Math.max(TH - hh, TH / 2))]; };
  const clampCam = () => { [cam.tx, cam.ty] = keepIn(cam.tx, cam.ty, cam.tz); };
  // Wheel, pinch and key zooms ease toward their target around a fixed point: the spot under the cursor stays
  // under the cursor the whole way, and the zoom moves at an even pace in scale (doubling takes as long as
  // halving), so it never lurches. A glide to a glade clears it.
  let anchor = null;
  function focusZone(z, snap = false) {
    anchor = null;
    cam.tx = ZONES[z].px; cam.ty = ZONES[z].py; cam.tz = clamp(Math.min((W - 40) / 340, (H - 200) / 230), minZoom(), 7);
    clampCam(); if (snap) { cam.x = cam.tx; cam.y = cam.ty; cam.z = cam.tz; }
  }
  function focusAll() { anchor = null; cam.tx = TW / 2; cam.ty = TH / 2; cam.tz = minZoom(); clampCam(); }
  function focusLand(l) { anchor = null; const L = LANDS[l]; cam.tx = (L.col + .5) * LW; cam.ty = (L.row + .5) * LH; cam.tz = clamp(Math.min(W / LW, H / LH), minZoom(), 7); clampCam(); }
  function zoomAt(f, px = W / 2, py = H / 2) {
    // Keep the same world point while the cursor stays put, so a run of wheel notches zooms into one spot.
    if (!anchor || Math.hypot(anchor.px - px, anchor.py - py) > 3) { if (!anchor) cam.tz = cam.z; const w = toWorld(px, py); anchor = { px, py, wx: w.x, wy: w.y }; }
    cam.tz = clamp(cam.tz * f, minZoom(), 9);
    [cam.tx, cam.ty] = keepIn(anchor.wx - (px - W / 2) / cam.tz, anchor.wy - (py - H / 2) / cam.tz, cam.tz);
  }
  function pan(dx, dy) {
    if (anchor) { anchor.wx -= dx / cam.z; anchor.wy -= dy / cam.z; }
    cam.tx -= dx / cam.z; cam.ty -= dy / cam.z; clampCam();
    [cam.x, cam.y] = keepIn(cam.x - dx / cam.z, cam.y - dy / cam.z, cam.z);
  }
  function toWorld(px, py) { return { x: (px - W / 2) / cam.z + cam.x, y: (py - H / 2) / cam.z + cam.y }; }
  const toCell = (px, py) => { const p = toWorld(px, py); return { x: p.x / CELL, y: p.y / CELL }; };

  function updateFog(s) {
    if (++fogTick % 5 && fogAlpha[0] >= 0) return;
    let changed = false;
    s.zones.forEach((z, i) => { const want = z.open ? 0 : 1, cur = fogAlpha[i] < 0 ? want : fogAlpha[i], next = cur + clamp(want - cur, -.05, .05); if (next !== fogAlpha[i]) { fogAlpha[i] = next; changed = true; } });
    if (!changed) return;
    const im = fogG.createImageData(CW, CH), m = [214, 210, 202]; // One mist over every land, so sleeping country reads as one continent.
    for (let i = 0; i < world.zone.length; i++) {
      const a = fogAlpha[world.zone[i]]; if (!a || world.edge[(Math.floor(i / CW) * CELL + 2) * TW + i % CW * CELL + 2] === SEA) continue;
      const k = i * 4, wisp = wisps[i];
      im.data[k] = m[0]; im.data[k + 1] = m[1]; im.data[k + 2] = m[2]; im.data[k + 3] = a * (120 + wisp * 150);
    }
    fogG.putImageData(im, 0, 0);
    fogSoftG.clearRect(0, 0, CW, CH); fogSoftG.filter = 'blur(2px)'; fogSoftG.drawImage(fog, 0, 0); fogSoftG.filter = 'none';
  }
  // Every world sprite goes through the pixel converter at its size in ground texels, then sits on the texel grid.
  // `base` is that size when a squash or hop stretches the drawing; `snap` is off inside a rotated or sheared frame.
  const snapX = v => sx(Math.round((v - W / 2) / cam.z + cam.x)), snapY = v => sy(Math.round((v - H / 2) / cam.z + cam.y));
  // Each land's light, which sprites standing in it are pulled toward. `tone` is the land being drawn in, or -1.
  const LIGHT = LANDS.map(l => l.grass.map((v, i) => (v + l.lush[i]) / 2));
  let tone = -1;
  function blit(img, fx, fy, fw, fh, x, y, w, h, flip = false, base = null, snap = true) {
    const z = cam.z, bw = base ? base[0] : w / z, bh = base ? base[1] : h / z, c = pixelize(img, fx, fy, fw, fh, bw, bh, flip, tone < 0 ? null : LIGHT[tone], tone + 1);
    if (!c) { if (flip) { ctx.save(); ctx.translate(x, 0); ctx.scale(-1, 1); ctx.drawImage(img, fx, fy, fw, fh, -w / 2, y - h, w, h); ctx.restore(); } else ctx.drawImage(img, fx, fy, fw, fh, x - w / 2, y - h, w, h); return; }
    const dw = base ? w : c.width * z, dh = base ? h : c.height * z, left = x - dw / 2, top = y - dh;
    ctx.drawImage(c, snap ? snapX(left) : left, snap ? snapY(top) : top, dw, dh);
  }
  function sprite(atlas, frame, x, y, w, h = w, flip = false, cols = 4, base = null, snap = true) {
    blit(atlas, frame % cols * SIZE, Math.floor(frame / cols) * SIZE, SIZE, SIZE, x, y, w, h, flip, base, snap);
  }
  function biomeCell(n, x, y, w, h, b, base = null, snap = true) { blit(b, n % 4 * 96, (n >> 2) * 96, 96, 96, x, y, w, h, false, base, snap); }
  // Where an object's art comes from: [image, x, y, width, height] in that image.
  function artSrc(o, frame) {
    const b = images.biomes[o.art], cell = (img, n) => [img, n % 4 * 96, (n >> 2) * 96, 96, 96];
    if (o.place && images.places) return cell(images.places, frame);
    if (o.mark) return cell(images.landmarks, frame);
    if (b && BIOME[frame] !== undefined) return frame <= KIND_BLOSSOM ? treeBuild(cell(b, BIOME[frame]), Math.imul(o.id + 7, 2654435761) >>> 30) : cell(b, BIOME[frame]);
    return [images.world, frame % 4 * SIZE, Math.floor(frame / 4) * SIZE, SIZE, SIZE];
  }
  function drawArt(o, frame, x, y, w, h = w, base = null, snap = true) {
    const [img, fx, fy, fw, fh] = artSrc(o, frame);
    tone = o.art; blit(img, fx, fy, fw, fh, x, y, w, h, false, base, snap); tone = -1;
  }
  // What ties a sprite to the ground: trodden earth under a building, then a shadow cast from its own silhouette.
  // Returns where the sprite sits, so its foot can be given grass afterwards.
  function underfoot(src, sizeT, land, x, y, yard) {
    const c = pixelize(src[0], src[1], src[2], src[3], src[4], sizeT, sizeT, false, LIGHT[land], land + 1);
    if (!c) return null;
    const z = cam.z, left = snapX(x - c.width * z / 2), top = snapY(y - c.height * z), sh = shadowOf(c);
    if (yard) { const P = LANDS[land], a = apronOf(c.width, (P.road || P.soil.map((v, i) => (v + P.dead[i]) / 2)).map(v => Math.round(v * .95)), c.width); ctx.drawImage(a, snapX(x - a.width * z / 2), top + (sh.foot + 1) * z - Math.round(a.height * .45) * z, a.width * z, a.height * z); }
    ctx.drawImage(sh.c, left, top + (sh.foot - sh.c.height + 2) * z, sh.c.width * z, sh.c.height * z);
    return { c, left, top };
  }
  // Grass grows up over the foot once the ground around it is green. Buildings keep their doorway clear.
  function grassFoot(g, land, cell, seed, building) {
    if (!g || grass === 'none' || s_.h[cell] < .3) return;
    const P = LANDS[land], cols = [P.grass.map(v => v * .72), P.grass, P.lush].map(c => `rgb(${c.map(v => Math.round(Math.min(255, v))).join(',')})`), k = skirtOf(g.c, cols, seed, building), z = cam.z;
    ctx.drawImage(k.c, g.left - 2 * z, g.top + (k.foot - k.c.height + 2) * z, k.c.width * z, k.c.height * z);
  }
  let s_ = null;
  function drawGround(canvasSource) {
    const vw = W / cam.z, vh = H / cam.z, x0 = cam.x - vw / 2, y0 = cam.y - vh / 2;
    ctx.drawImage(canvasSource, x0, y0, vw, vh, 0, 0, W, H);
  }
  const F = world.flora;
  // Plants take the light of the hill they grow on: five shades, darkest on slopes facing away from the light.
  const TG = 8, tgw = TW / TG, tint = new Uint8Array(tgw * (TH / TG)), tinted = new Map();
  for (let y = 0, i = 0; y < TH / TG; y++) for (let x = 0; x < tgw; x++, i++) tint[i] = Math.max(0, Math.min(4, Math.round((hillShade(x * TG + 4, y * TG + 4) - 1) / .075) + 2));
  function plants(px, py) {
    const b = world.biome[Math.min(TH - 1, py | 0) * TW + (px | 0)], t = tint[Math.min(TH / TG - 1, py / TG | 0) * tgw + Math.min(tgw - 1, px / TG | 0)];
    if (t === 2) return flora[b].c;
    const key = b * 5 + t; let c = tinted.get(key);
    if (!c) {
      const src = flora[b].c; c = document.createElement('canvas'); c.width = src.width; c.height = src.height;
      const g = c.getContext('2d'); g.drawImage(src, 0, 0); g.globalCompositeOperation = 'source-atop';
      g.fillStyle = t < 2 ? `rgba(18,28,44,${(2 - t) * .13})` : `rgba(255,248,214,${(t - 2) * .1})`; g.fillRect(0, 0, c.width, c.height);
      tinted.set(key, c);
    }
    return c;
  }
  // Lyke's blades: each grass plant scatters a handful of single blades over its cell, and every blade has its
  // own sprouting threshold, spread from just before the plant's own up to nearly full health, so the ground
  // fills strand by strand as it heals. Built per chunk on first use and sorted back to front.
  const STRANDS = { 0: [5, 0, 3], 1: [8, 1, 6], 7: [6, 0, 4] }, strandCache = new Map();
  function strandsOf(i) {
    let S = strandCache.get(i); if (S) return S;
    const L = [];
    for (let k = F.start[i], end = k + F.count[i]; k < end; k++) {
      const spec = STRANDS[F.kind[k]] || [3, 0, 3], base = F.thr[k] - .12;
      for (let j = 0; j < spec[0]; j++) {
        const a = hash(k, j, 501), b = hash(k, j, 503), c = hash(k, j, 505), d = hash(k, j, 507), len = spec[1] + Math.floor(c * (spec[2] - spec[1]));
        L.push([F.x[k] + (a - .5) * 4.8, F.y[k] + (b - .5) * 4.4, base + (j + hash(k, j, 509)) / spec[0] * (.96 - base), (len * 2 + (a > .5 ? 1 : 0)) * 5 + Math.min(4, Math.floor(d * 5.4)), k]);
      }
    }
    L.sort((p, q) => p[1] - q[1]);
    S = { n: L.length, x: new Float32Array(L.map(s => s[0])), y: new Float32Array(L.map(s => s[1])), thr: new Float32Array(L.map(s => s[2])), v: new Uint8Array(L.map(s => s[3])), k: new Uint32Array(L.map(s => s[4])) };
    strandCache.set(i, S); return S;
  }
  const strandGrow = (h, thr) => Math.min(1, (h - thr) / .05 + .45);
  // Draws blade j of chunk strands S with its root at screen (X, Y), scale z, in pose `pose`, showing only its
  // bottom `rows` texels (all of it by default).
  function strand(g, S, j, X, Y, z, pose, grow, rows = SHT) {
    const A = flora[0], st = A.strands, v = S.v[j], img = plants(S.x[j], S.y[j]);
    const srcY = st.y0 + (pose * 2 + Math.floor(v / SPER)) * st.sh, cut = Math.min(SHT, rows) * LR;
    g.drawImage(img, (v % SPER) * st.sw, srcY + st.sh - cut, st.sw, cut, X - SWT * z / 2, Y - cut / LR * z * grow, SWT * z, cut / LR * z * grow);
  }
  const isStrandKind = k => F.kind[k] < 2 || F.kind[k] === 7;
  // Which atlas column a plant uses: its wind pose, within one of the style's built variants.
  const col = (k, pose) => (flora[0].v > 1 ? (Math.imul(k, 2654435761) >>> 20) % flora[0].v * 3 : 0) + pose;
  // Lyke has far too many blades to draw one by one, so its wind-carrying half is baked twice, standing and bent
  // over, and a passing gust swaps in the bent layer along its band. Chunks bake at a resolution to suit the zoom.
  const bakeRes = () => !flora[0].strands ? 1 : cam.z < 1.5 ? 1 : cam.z < 4 ? 2 : 3;
  const CAP = { 1: 1e9, 2: 300, 3: 110 };
  function bakeChunk(index, s) {
    let b = baked.get(index);
    const { cw, ch, r: sr } = flora[0], r = bakeRes(), lyke = !!flora[0].strands;
    if (b && (b.r !== r || !!b.l !== lyke)) { baked.delete(index); b = null; }
    if (!b) {
      // Fine-bladed chunks are large, so only the most recent are kept.
      if (baked.size > CAP[r]) for (const key of baked.keys()) { baked.delete(key); if (baked.size <= CAP[r] * .75) break; }
      const mk = () => { const c = document.createElement('canvas'); c.width = (FC + 18) * r; c.height = (FC + 14) * r; const g = c.getContext('2d'); g.imageSmoothingEnabled = false; return { c, g }; };
      const m = mk(); b = { c: m.c, g: m.g, r, v: mk(), l: lyke ? mk() : null, l2: lyke ? mk() : null }; baked.set(index, b);
    }
    const cx = index % FCOLS * FC, cy = Math.floor(index / FCOLS) * FC, f = shown || s.h;
    b.g.clearRect(0, 0, b.c.width, b.c.height); b.v.g.clearRect(0, 0, b.c.width, b.c.height); b.empty = true; b.lEmpty = true; b.vEmpty = true;
    if (b.l) { b.l.g.clearRect(0, 0, b.c.width, b.c.height); b.l2.g.clearRect(0, 0, b.c.width, b.c.height); }
    if (grass === 'none') return;
    if (lyke) {
      const S = strandsOf(index);
      for (let j = 0; j < S.n; j++) {
        const k = S.k[j], h = f[F.cell[k]];
        if (h < S.thr[j]) continue;
        const live = F.phase[k] < LIVE[grass], X = (S.x[j] - cx + 9) * r, Y = (S.y[j] - cy + 14) * r, gr = strandGrow(h, S.thr[j]);
        if (live) { b.lEmpty = false; strand(b.l.g, S, j, X, Y, r, 1, gr); strand(b.l2.g, S, j, X, Y, r, 2, gr); }
        else { b.empty = false; strand(b.g, S, j, X, Y, r, 1, gr); }
      }
    }
    for (let k = F.start[index], end = k + F.count[index]; k < end; k++) {
      const h = f[F.cell[k]];
      if (h < F.thr[k] || lyke && isStrandKind(k)) continue;
      // The plants that sway in the wind close up are baked too, on their own layer, standing still: they fill the
      // meadow until the camera is close enough for them to be drawn one by one, so nothing pops in.
      const live = F.phase[k] < LIVE[grass], g = live ? b.v.g : b.g;
      if (live) b.vEmpty = false; else b.empty = false;
      const grow = Math.min(1, (h - F.thr[k]) / .07 + .25), dh = Math.round(ch * r * grow);
      g.drawImage(plants(F.x[k], F.y[k]), col(k, 1) * cw * sr, F.kind[k] * ch * sr, cw * sr, ch * sr, Math.round((F.x[k] - cx + 9 - cw / 2) * r), Math.round((F.y[k] - cy + 14) * r - dh), cw * r, dh);
    }
  }
  // The stretches of a gust band, inside the box at (x, y) w by h texels, where the wind is strong enough to
  // bend the grass: returns a function that adds them to the current path as screen quads, or null if none.
  function gustBands(x, y, w, h, t) {
    const us = [x, x + w].flatMap(a => [y, y + h].map(b => a * .8 + b * .45 - t * GUST_SPEED)), lo = Math.min(...us), hi = Math.max(...us), quads = [];
    for (let n = Math.floor(lo / GUST_GAP); n <= Math.floor(hi / GUST_GAP); n++) {
      const k = Math.abs(Math.sin(n * 12.9898 + 4.1) * 43758.5453) % 1, peak = .45 + .55 * k; if (peak <= .3) continue;
      const d0 = GUST_WIDTH / Math.PI * Math.asin(.3 / peak), c1 = n * GUST_GAP + d0, c2 = n * GUST_GAP + GUST_WIDTH - d0;
      if (c2 < lo || c1 > hi) continue;
      const at = (c, yy) => (c + t * GUST_SPEED - .45 * yy) / .8;
      quads.push([[at(c1, y), y], [at(c2, y), y], [at(c2, y + h), y + h], [at(c1, y + h), y + h]]);
    }
    return quads.length ? () => { for (const q of quads) { ctx.moveTo(sx(q[0][0]), sy(q[0][1])); for (let m = 1; m < 4; m++) ctx.lineTo(sx(q[m][0]), sy(q[m][1])); ctx.closePath(); } } : null;
  }
  // Most plants are baked into per-chunk images, so a full meadow costs a few draws rather than thousands.
  // A smaller share stays live to carry the wind. From far away the meadow is left to the ground colours, and it
  // fades in as the camera comes down rather than appearing all at once.
  const chunksIn = (z, pad = 0) => { const out = [], x0 = cam.x - W / 2 / z - 12 - pad, x1 = cam.x + W / 2 / z + 12 + pad, y0 = cam.y - H / 2 / z - pad, y1 = cam.y + H / 2 / z + 14 + pad;
    for (let cy = Math.max(0, Math.floor(y0 / FC)); cy <= Math.min(FROWS - 1, Math.floor(y1 / FC)); cy++) for (let cx = Math.max(0, Math.floor(x0 / FC)); cx <= Math.min(FCOLS - 1, Math.floor(x1 / FC)); cx++) out.push(cy * FCOLS + cx);
    return out; };
  function drawFlora(s, time, dt) {
    const z = cam.z;
    if (grass === 'none') return;
    const t = reduced || s.paused ? 0 : time / 1000, f = shown || s.h, fade = clamp((z - .6) / .25, 0, 1);
    // Bake what is on screen, nearest the middle first, and when zoomed out the middle of the view as it will be
    // once zoomed in, so the meadow is ready before the camera gets there.
    const want = bakeRes(), lyke = !!flora[0].strands, end = performance.now() + 4;
    const todo = chunksIn(Math.max(z, .85)).filter(i => floraDirty[i] || !baked.has(i) || baked.get(i).r !== want);
    if (todo.length) {
      const mx = cam.x / FC, my = cam.y / FC; todo.sort((a, b) => Math.hypot(a % FCOLS + .5 - mx, Math.floor(a / FCOLS) + .5 - my) - Math.hypot(b % FCOLS + .5 - mx, Math.floor(b / FCOLS) + .5 - my));
      for (const i of todo) { if (performance.now() > end) break; floraDirty[i] = 0; bakeChunk(i, s); }
    }
    if (!fade) return;
    const visible = chunksIn(z), closeUp = z >= 1.7 && quality >= 1;
    ctx.globalAlpha = fade;
    for (const i of visible) {
      const b = baked.get(i); if (!b) continue;
      const X = sx(i % FCOLS * FC - 9), Y = sy(Math.floor(i / FCOLS) * FC - 14), w = b.c.width * z / b.r, hh = b.c.height * z / b.r;
      if (!b.empty) ctx.drawImage(b.c, X, Y, w, hh);
      if (!closeUp && b.v && !b.vEmpty) ctx.drawImage(b.v.c, X, Y, w, hh);
      if (b.l && !b.lEmpty) {
        const bands = t && quality >= 1 ? gustBands(i % FCOLS * FC - 9, Math.floor(i / FCOLS) * FC - 14, b.c.width / b.r, b.c.height / b.r, t) : null;
        if (!bands) { ctx.drawImage(b.l.c, X, Y, w, hh); continue; }
        ctx.save(); ctx.beginPath(); ctx.rect(X, Y, w, hh); bands(); ctx.clip('evenodd'); ctx.drawImage(b.l.c, X, Y, w, hh); ctx.restore();
        ctx.save(); ctx.beginPath(); bands(); ctx.clip(); ctx.drawImage(b.l2.c, X, Y, w, hh); ctx.restore();
      }
    }
    ctx.globalAlpha = 1;
    if (!closeUp) return;
    for (const i of visible) {
      const { cw, ch, r } = flora[0];
      for (let k = F.start[i], stop = k + F.count[i]; k < stop; k++) {
        if (F.phase[k] >= LIVE[grass] || lyke && isStrandKind(k)) continue;
        const h = f[F.cell[k]];
        if (h < F.thr[k]) continue;
        const px = F.x[k], py = F.y[k], gust = t ? gustAt(px, py, t) : 0, pose = gust > .25 + F.phase[k] * 1.4 ? 2 : 1, grow = Math.min(1, (h - F.thr[k]) / .07 + .25), dw = cw * z, dh = ch * z * grow;
        ctx.drawImage(plants(px, py), col(k, pose) * cw * r, F.kind[k] * ch * r, cw * r, ch * r, sx(px) - dw / 2, sy(py) - dh, dw, dh);
      }
    }
  }
  // Creatures walk in the meadow, not on top of it: the blades just in front of one are drawn again over its
  // feet, cut to `cut` texels tall, and those nearest it lean away as it pushes through. x, y, half and cut
  // are in texels; `step` rustles the blades by its feet while it walks.
  function grassOver(x, y, half, cut, step) {
    if (cam.z < .75 || !s_ || grass === 'none') return;
    const f = shown || s_.h, { cw, ch, r } = flora[0], z = cam.z, lyke = !!flora[0].strands;
    for (let cy = Math.max(0, Math.floor((y - 1) / FC)); cy <= Math.min(FROWS - 1, Math.floor((y + 9) / FC)); cy++)
      for (let cx = Math.max(0, Math.floor((x - half) / FC)); cx <= Math.min(FCOLS - 1, Math.floor((x + half) / FC)); cx++) {
        const i = cy * FCOLS + cx;
        if (lyke) {
          // Blades in front of the creature are drawn again over it, those by its body pushed aside.
          const S = strandsOf(i);
          for (let j = 0; j < S.n; j++) {
            const px = S.x[j], py = S.y[j], d = px - x;
            if (py <= y - .5 || py > y + 8 || Math.abs(d) > half) continue;
            const h = f[F.cell[S.k[j]]]; if (h < S.thr[j]) continue;
            const grow = strandGrow(h, S.thr[j]), rows = (py - y + cut) / grow; if (rows <= 0) continue;
            const near = Math.abs(d) < half * .8 && py < y + 3, pose = near ? (d > 0 ? 2 : 0) : step && Math.sin(step * 9 + px * 3) > .5 ? (d > 0 ? 2 : 0) : 1;
            strand(ctx, S, j, sx(px), sy(py), z, pose, grow, rows);
          }
        }
        for (let k = F.start[i], end = k + F.count[i]; k < end; k++) {
          const px = F.x[k], py = F.y[k], d = px - x;
          if (py <= y - .5 || py > y + 8 || Math.abs(d) > half || lyke && isStrandKind(k)) continue;
          const h = f[F.cell[k]]; if (h < F.thr[k]) continue;
          // Only the part of the blade that rises above the creature's feet, up to `cut` above them, covers it.
          const grow = Math.min(1, (h - F.thr[k]) / .07 + .25), rows = Math.min(ch, (py - y + cut) / grow), near = Math.abs(d) < half * .75 && py < y + 3;
          if (rows <= 0) continue;
          const pose = near ? (d > 0 ? 2 : 0) : step && Math.sin(step * 9 + px) > .6 ? (d > 0 ? 2 : 0) : 1;
          ctx.drawImage(plants(px, py), col(k, pose) * cw * r, (F.kind[k] * ch + ch - rows) * r, cw * r, rows * r, sx(px) - cw * z / 2, sy(py) - rows * grow * z, cw * z, rows * grow * z);
        }
      }
  }
  function drawProps(s, time, dt, carry) {
    s_ = s;
    const items = [], z = cam.z, lx = cam.x - W / 2 / z - 70, hx = cam.x + W / 2 / z + 70, ly = cam.y - H / 2 / z - 10, hy = cam.y + H / 2 / z + 120;
    for (const o of world.objects) { if (o.place === 'pier') continue; const x = o.x * CELL, y = o.y * CELL; if (x > lx && x < hx && y > ly && y < hy) items.push({ y, o }); }
    for (const a of s.spirits) if (a !== carry) items.push({ y: (a.ry ?? a.y) * CELL, a });
    const night = clamp((Math.cos((s.age / 480) % 1 * 6.283) * -1 - .35) / .65, 0, 1) > .4;
    for (const c of critters) if (PETS[c.kind]) { if (!s.paused) stepPet(s, c, dt, night); const x = c.x, y = c.y; if (x > lx && x < hx && y > ly && y < hy) items.push({ y, c }); }
    for (const t of s.trees) { const y = t.y * CELL; if (t.x * CELL > lx && t.x * CELL < hx && y > ly && y < hy) items.push({ y, t }); }
    for (const f of folk) { if (!s.paused) stepFolk(f, dt); if (f.x > lx && f.x < hx && f.y > ly && f.y < hy) items.push({ y: f.sortY ?? f.y, f }); }
    items.sort((a, b) => a.y - b.y);
    const atlas = images.world, spirits = images.spirits, tNow = time / 1000;
    const art = drawArt;
    for (const it of items) {
      if (it.o) {
        const o = it.o, x = sx(o.x * CELL), y = sy(o.y * CELL), hp = s.objHp ? s.objHp[o.id] : o.hp, size = o.size * z, born = revives.get(o.id);
        const foot = z > .9 ? underfoot(artSrc(o, hp > 0 ? o.dead : o.live), o.size, o.art, x, y, o.mark) : null;
        if (hp > 0) {
          art(o, o.dead, x, y, size);
          const goal = 1 - hp / o.hp, was = rises.get(o.id) || 0, rise = was + (goal - was) * Math.min(1, dt * 10);
          if (goal > 0) { // Life climbs through the object from the ground up, like a tide of colour.
            rises.set(o.id, rise);
            const edge = y - size * rise;
            ctx.save(); ctx.beginPath(); ctx.rect(x - size, edge, size * 2, y - edge + z); ctx.clip(); art(o, o.live, x, y, size); ctx.restore();
            if (rise > was + .002 && Math.random() < .55) addParticle({ x: o.x * CELL + (Math.random() - .5) * o.size * .55, y: o.y * CELL - o.size * rise, vx: (Math.random() - .5) * 5, vy: -9 - Math.random() * 12, g: 2, life: .6 + Math.random() * .5, age: 0, size: .9, color: ['#fff2ab', '#d8f58f', '#fff'][Math.floor(Math.random() * 3)] });
          }
        } else {
          let k = 1;
          if (born !== undefined) { const a = (time - born) / 620; if (a < 1) k = 1 + Math.sin(a * Math.PI) * .22 * (1 - a) + (a < .25 ? (a / .25 - 1) * .55 : 0); else revives.delete(o.id); }
          const sway = o.size > 18 && !o.mark && !reduced && !s.paused ? Math.sin(tNow * .9 - o.x * .07) * .004 + gustAt(o.x * CELL, o.y * CELL, tNow) * .022 : 0;
          if (!sway && k === 1) art(o, o.live, x, y, size); else { ctx.save(); ctx.translate(snapX(x), snapY(y)); ctx.transform(1, 0, sway, 1, 0, 0); art(o, o.live, 0, 0, size * (2 - k) ** .4, size * k, [o.size, o.size], false); ctx.restore(); }
          grassFoot(foot, o.art, Math.floor(o.y) * CW + Math.floor(o.x), o.id, o.mark);
          if (o.live === 11 && !o.mark && !reduced) { const b = .5 + Math.sin(tNow * 2 + o.x) * .5; ctx.globalAlpha = .18 + b * .2; ctx.fillStyle = '#b8ffe6'; ctx.beginPath(); ctx.arc(x, y - size * .55, size * .32, 0, 7); ctx.fill(); ctx.globalAlpha = 1; }
        }
      } else if (it.t) {
        const t = it.t, g = Math.min(1, (s.age - t.born) / 9), x = sx(t.x * CELL), y = sy(t.y * CELL), size = (10 + 28 * g) * SHRINK * z;
        const land = world.biome[Math.min(TH - 1, Math.floor(t.y * CELL)) * TW + Math.floor(t.x * CELL)], tb = images.biomes[land], src = tb ? treeBuild([tb, 96, 0, 96, 96], Math.imul(Math.floor(t.x * 7 + t.y * 13), 2654435761) >>> 30) : [atlas, (t.blossom ? 2 : 1) * SIZE, 0, SIZE, SIZE];
        const foot = z > .9 ? underfoot(src, size / z, land, x, y, false) : null;
        tone = land; blit(...src, x, y, size, size); tone = -1;
        grassFoot(foot, land, Math.floor(t.y) * CW + Math.floor(t.x), Math.floor(t.x * 7 + t.y), false);
      } else if (it.f) { drawFolk(s, it.f, tNow);
      } else if (it.c) { drawPet(it.c, tNow);
      } else {
        const a = it.a, k = 1 - Math.exp(-dt * 11);
        a.rx ??= a.x; a.ry ??= a.y;
        const mx = (a.x - a.rx) * k, my = (a.y - a.ry) * k, walking = Math.hypot(mx, my) > dt * .25 && !a.working && !(a.nap > 0);
        a.rx += mx; a.ry += my;
        if (walking && !s.paused) a.anim = (a.anim || 0) + dt;
        const x = sx(a.rx * CELL), y = sy(a.ry * CELL), still = reduced || s.paused;
        // One pose squashing and stretching in a hop: smooth at any frame rate, with no sprite popping.
        a.air = (a.air || 0) + (((a.type !== 2 && world.nav && overWater(world, a.rx, a.ry)) ? 1 : 0) - (a.air || 0)) * Math.min(1, dt * 14);
        const hop = walking && !still ? Math.abs(Math.sin((a.anim || 0) * 8)) : 0, q = still ? 0 : walking ? (hop - .45) * .13 : a.working ? Math.sin(tNow * 5 + a.x) * .05 : Math.sin(tNow * 2 + a.x) * .018;
        const frame = still ? 0 : a.nap > 0 ? 1 : a.working ? 3 : 0, float = (a.type === 2 ? 3 + Math.sin(tNow * 2 + a.x) : 0) + Math.sin(a.air * Math.PI / 2) * 5, size = (a.type === 3 ? 20 : 15) * z;
        ctx.fillStyle = 'rgba(30,24,18,.28)'; ctx.beginPath(); ctx.ellipse(x, y, size * (.28 - hop * .06), size * .09, 0, 0, 7); ctx.fill();
        { const c = spiritCanvas(a.type, frame, a.dir < 0), k = z * SHRINK / SCALE, w = c.width * k * (1 - q), h = c.height * k * (1 + q); ctx.drawImage(c, snapX(x - w / 2), snapY(y - (float + hop * 2.4) * SHRINK * z - h), w, h); if (float < 1) grassOver(a.rx * CELL, a.ry * CELL, w / z * .3, Math.max(1.2, h / z * .22 - hop * 2.4 * SHRINK), walking ? a.anim : 0); }
        if (a.type === 2 && !s.paused && !reduced && quality > 0) { // Rainwisps carry their own little weather; filling a riverbed, a downpour.
          const pour = a.rain > 0 && (a.fill != null || a.pour != null), r = SPIRITS[2].r * CELL * z * (pour ? .45 : .75); ctx.fillStyle = pour ? 'rgba(150,205,250,.85)' : 'rgba(170,220,255,.7)';
          if (pour && images.raincloud) { // its own little rain cloud overhead (assets/raincloud.png, ChatGPT art): four frames, puffing and raining
            const c = images.raincloud, fw = c.width / 4, fh = c.height, k = z / SCALE * 1.15, w = fw * k, h = fh * k, f = Math.floor(tNow * 6 + a.x) % 4;
            ctx.globalAlpha = Math.min(1, a.rain * 1.5); ctx.drawImage(c, f * fw, 0, fw, fh, snapX(x - w / 2), snapY(y - 10 * z - h + Math.sin(tNow * 1.6) * z * .6), w, h); ctx.globalAlpha = 1;
          }
          for (let n = 0; n < (pour ? 10 : 7); n++) { const q2 = (tNow * 1.5 + n * .37) % 1, px = x + (hash(n, 1, 8) - .5) * r * 2, py = y - z * 2 + (hash(n, 2, 8) - .5) * r - (1 - q2) * 18 * z; ctx.fillRect(px, py, Math.max(1, z * .5), z * 2); }
        }
      }
    }
  }
  function drawWater(s, time) {
    if (reduced) return;
    const t = time / 1000, z = cam.z;
    const vx0 = cam.x - W / 2 / z - 60, vx1 = cam.x + W / 2 / z + 60, vy0 = cam.y - H / 2 / z - 60, vy1 = cam.y + H / 2 / z + 60;
    for (const [x, y, ph, id] of seaSpots) { if (x < vx0 || x > vx1 || y < vy0 || y > vy1 || !s.zones[id].done) continue; const b = Math.sin(t * 1.2 + ph * 40); if (b < .4) continue; ctx.fillStyle = `rgba(255,255,255,${(b - .4) * .9})`; ctx.fillRect(sx(x + Math.sin(t * .5 + ph * 9) * 3), sy(y), z * 4, z); }
    s.zones.forEach((st, id) => {
      if (st.water < .7) return;
      const P = ZONES[id]; if (P.px < vx0 - 300 || P.px > vx1 + 300 || P.py < vy0 - 300 || P.py > vy1 + 300) return;
      const fill = (st.water - .7) / .3;
      for (const [x, y, ph] of glintSpots[id]) { const b = Math.sin(t * 1.4 + ph * 40); if (b < .55) continue; ctx.fillStyle = `rgba(255,255,255,${(b - .55) * 1.3 * fill})`; ctx.fillRect(sx(x + Math.sin(t * .4 + ph * 9) * 2), sy(y), z * 3, z); }
      if (st.water >= 1) for (const [x, y, ph] of padSpots[id]) { ctx.fillStyle = '#4f9c5a'; ctx.fillRect(sx(x), sy(y), z * 3, z * 2); if (ph > .5) { ctx.fillStyle = '#ffc6dd'; ctx.fillRect(sx(x + 1), sy(y), z, z); } }
      const path = world.streams[id];
      for (let k = 0; k < (path.length ? 16 : 0); k++) { const q = ((t * .06 + k / 16) % 1) * .7; if (q > st.water) continue; const p = path[Math.floor(q / .7 * (path.length - 1))]; ctx.fillStyle = 'rgba(255,255,255,.55)'; ctx.fillRect(sx(p[0]), sy(p[1]), z * 2, z); }
    });
  }
  // Ducks paddle about the great lake once it has filled: drifting to somewhere well out on the water, resting,
  // now and then dabbling tail-up, each leaving a little wake.
  const ducks = []; let duckFirst, duckStart;
  function drawDucks(s, t, dt) {
    const lakeZ = world.ponds.findIndex(p => p.lake);
    duckStart ??= t;
    if (lakeZ < 0 || !s.zones[lakeZ] || s.zones[lakeZ].water < 1) return;
    const P = world.ponds[lakeZ], deep = (x, y) => { x |= 0; y |= 0; return x >= 0 && y >= 0 && x < TW && y < TH && world.waterT[y * TW + x] >= 200 && world.waterT[y * TW + x] < 255; };
    const spot = () => { for (let k = 0; k < 60; k++) { const x = P.x + (Math.random() * 2 - 1) * P.r, y = P.y + (Math.random() * 2 - 1) * P.r * .7; if (deep(x, y)) return [x, y]; } return [P.x, P.y]; };
    // Ducks find a lake that was already full when you came; a lake that fills while you watch gets one at a time.
    if (duckFirst === undefined) duckFirst = t - duckStart < 3 ? -1e9 : t;
    const due = duckFirst < 0 ? 6 : Math.min(6, Math.floor((t - duckFirst) / 22));
    while (ducks.length < due) { const n = ducks.length, [x, y] = spot(); ducks.push({ x, y, tx: x, ty: y, rest: Math.random() * 4, dab: 0, dir: 1, hen: n % 3 === 2, ph: Math.random() * 6, fade: duckFirst < 0 ? 1 : 0 }); }
    const z = cam.z, still = s.paused || reduced;
    for (const d of ducks) {
      let moving = false;
      if (!still) {
        if (d.dab > 0) d.dab -= dt;
        else if (d.rest > 0) { d.rest -= dt; if (d.rest <= 0 && Math.random() < .3) d.dab = 1.4; }
        else {
          const dx = d.tx - d.x, dy = d.ty - d.y, dist = Math.hypot(dx, dy), step = 2.6 * dt;
          if (dist < .5) { d.rest = 2 + Math.random() * 6; [d.tx, d.ty] = spot(); }
          else { const nx = d.x + dx / dist * step, ny = d.y + dy / dist * step; if (deep(nx, ny)) { d.x = nx; d.y = ny; d.dir = dx < 0 ? -1 : 1; moving = true; } else [d.tx, d.ty] = spot(); }
        }
      }
      const x = sx(d.x), y = sy(d.y);
      if (x < -40 || y < -40 || x > W + 40 || y > H + 40) continue;
      d.fade = Math.min(1, d.fade + dt * .4); ctx.globalAlpha = d.fade;
      const c = duckCanvas(d.hen, d.dab > 0 ? 1 : 0, d.dir < 0), k = z * .85 / SCALE, bob = still ? 0 : Math.round(Math.sin(t * 2.2 + d.ph) * .6) * z * .5;
      // Wake: two pale lines trailing out behind and a soft ring at the waterline.
      ctx.fillStyle = 'rgba(235,248,255,.55)';
      ctx.fillRect(x - c.width * k * .45, y, c.width * k * .9, Math.max(1, z * .5));
      if (moving) for (let n = 1; n <= 3; n++) { const back = -d.dir * n * 2.2 * z; ctx.globalAlpha = .5 - n * .13; ctx.fillRect(x + back - n * z * .6, y - n * z * .5, z * 1.4, Math.max(1, z * .5)); ctx.fillRect(x + back - n * z * .6, y + n * z * .5, z * 1.4, Math.max(1, z * .5)); }
      ctx.globalAlpha = d.fade;
      ctx.drawImage(c, snapX(x - c.width * k / 2), snapY(y - c.height * k + z * .4 + bob), c.width * k, c.height * k);
      ctx.globalAlpha = 1;
    }
  }
  // Folk: once the farm in Sunfall Coast is restored a farmer works it, ambling up and down the path by it; once the
  // pier on the coast is mended a fisherman stands at its far end with his rod, looking out to sea.
  // assets/folk.png (ChatGPT art): rows are a farmer, a fisher and a snow villager; four stepping frames, then a wave.
  const folk = []; let folkAt = 0;
  const isRoad = (x, y) => { x |= 0; y |= 0; if (x < 0 || y < 0 || x >= TW || y >= TH) return false; const r = world.road[y * TW + x]; return r === 1 || r === 2 || r === 4; };
  function spawnFolk(s, time) {
    if (time - folkAt < 1000) return; folkAt = time;
    for (const o of world.objects) {
      if (!o.place) continue;
      const here = s.objHp?.[o.id] === 0 && Math.hypot(o.x * CELL - cam.x, o.y * CELL - cam.y) < 1100, f = folk.find(q => q.place === o.id);
      if (here && !f) {
        const fisher = o.place === 'pier', P = WATER.pier, x = fisher ? P.x1 - P.dx * 5 : o.x * CELL + 12, y = fisher ? P.y1 - P.dy * 5 : o.y * CELL + 6;
        folk.push({ place: o.id, kind: o.place, land: o.land, zone: o.zone, x, y, home: { x, y }, sortY: null, hx: 1, hy: 0, dir: fisher ? (P.dx >= 0 ? 1 : -1) : 1, dist: 0, pause: 2, wave: 0, alpha: 0, row: fisher ? 1 : 0, stay: fisher });
      }
      if (!here && f) folk.splice(folk.indexOf(f), 1);
    }
  }
  const HEAD = [[1, 0], [.7, .7], [0, 1], [-.7, .7], [-1, 0], [-.7, -.7], [0, -1], [.7, -.7]];
  function stepFolk(f, dt) {
    f.alpha = Math.min(1, f.alpha + dt * .6);
    if (f.wave > 0) { f.wave -= dt; return; }
    if (f.stay) return; // the fisherman keeps to his pier
    if (f.pause > 0) { f.pause -= dt; return; }
    if (Math.random() < dt * .08) { f.pause = 2 + Math.random() * 4; return; }
    const ahead = (hx, hy) => isRoad(f.x + hx * 3, f.y + hy * 3) && isRoad(f.x + hx * 6, f.y + hy * 6);
    const away = Math.hypot(f.x - f.home.x, f.y - f.home.y), back = away > 120 ? [(f.home.x - f.x) / away, (f.home.y - f.y) / away] : null; // the farmer stays near his farm
    if (!ahead(f.hx, f.hy) || Math.random() < dt * .15 || (back && f.hx * back[0] + f.hy * back[1] < 0)) {
      const score = ([hx, hy]) => (back ? hx * back[0] + hy * back[1] : hx * f.hx + hy * f.hy) + (Math.random() - .5) * .6;
      const opts = HEAD.filter(([hx, hy]) => ahead(hx, hy) && (back || hx * f.hx + hy * f.hy > -.9)).sort((p, q) => score(q) - score(p));
      const h = opts[0] || [-f.hx, -f.hy]; f.hx = h[0]; f.hy = h[1];
      if (!opts.length) { f.pause = 1; return; }
    }
    const v = 6 * dt; f.x += f.hx * v; f.y += f.hy * v; f.dist += v; if (Math.abs(f.hx) > .3) f.dir = f.hx > 0 ? 1 : -1;
  }
  function drawFolk(s, f, tNow) {
    const sheet = images.folk; if (!sheet) return;
    const fw = sheet.width / 5, fh = sheet.height / 3, k = cam.z / SCALE, w = fw * k, h = fh * k, x = sx(f.x), y = sy(f.y);
    const cell = f.wave > 0 ? 4 : f.pause > 0 ? 0 : Math.floor(f.dist / 2.2) % 4;
    ctx.globalAlpha = f.alpha;
    ctx.fillStyle = 'rgba(30,24,18,.25)'; ctx.beginPath(); ctx.ellipse(x, y, w * .26, h * .07, 0, 0, 7); ctx.fill();
    ctx.save(); ctx.translate(snapX(x), 0); if (f.dir < 0) ctx.scale(-1, 1); ctx.drawImage(sheet, cell * fw, f.row * fh, fw, fh, -w / 2, snapY(y - h + cam.z * .5), w, h); ctx.restore();
    f.sx = x; f.sy = y - h / 2; f.sh = h;
    // A villager with a favour to ask carries a little speech bubble.
    const ask = f.kind === 'farm' && s.favours?.find(q => q.land === f.land && !q.done);
    if (ask) {
      const by = y - h - 7 * cam.z + Math.sin(tNow * 3) * cam.z, r = Math.max(7, 3.2 * cam.z);
      ctx.fillStyle = '#fff6df'; ctx.strokeStyle = '#3a2e23'; ctx.lineWidth = Math.max(1.5, cam.z * .5);
      ctx.beginPath(); ctx.roundRect(x - r, by - r, r * 2, r * 1.8, r * .5); ctx.fill(); ctx.stroke();
      ctx.fillStyle = '#d8902a'; ctx.font = `700 ${Math.round(r * 1.3)}px "Pixelify Sans",Georgia,serif`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText('!', x, by - r * .05);
      f.asks = true;
    } else f.asks = false;
    ctx.globalAlpha = 1;
  }
  // The fishing pier, plank by plank along its line from the land out to sea: boards laid across the walkway with a
  // seam every third texel, a darker rail of pilings down each side every seven. Weathered grey with boards missing
  // until it is restored, then warm, whole wood.
  const pierObj = world.objects.find(o => o.place === 'pier');
  function drawPier(s) {
    const P = WATER.pier; if (!P || !pierObj) return;
    const z = cam.z, len = Math.hypot(P.x1 - P.x0, P.y1 - P.y0), nx = -P.dy, ny = P.dx, whole = s.objHp?.[pierObj.id] === 0;
    if (Math.max(P.x0, P.x1) + 10 < cam.x - W / 2 / z || Math.min(P.x0, P.x1) - 10 > cam.x + W / 2 / z || Math.max(P.y0, P.y1) + 10 < cam.y - H / 2 / z || Math.min(P.y0, P.y1) - 10 > cam.y + H / 2 / z) return;
    const wood = whole ? ['#b98552', '#a8743f', '#7a5230'] : ['#9a9284', '#8a8274', '#5e574c'], half = P.w;
    const dot = (x, y, col) => { ctx.fillStyle = col; ctx.fillRect(Math.floor(sx(Math.round(x))), Math.floor(sy(Math.round(y))), Math.ceil(z), Math.ceil(z)); };
    for (let d = 0; d <= len; d += .5) {
      const k = Math.floor(d / 3), x = P.x0 + P.dx * d, y = P.y0 + P.dy * d;
      if (!whole && d > 6 && hash(k, 3, 71) < .28) continue; // a missing board
      const seam = d % 3 < .5, col = seam ? wood[2] : wood[k % 2];
      for (let e = -half; e <= half; e += .5) dot(x + nx * e, y + ny * e, Math.abs(e) > half - .6 ? wood[2] : col);
      if (d > 8 && Math.floor(d) % 7 === 0) for (const side of [-1, 1]) { dot(x + nx * (half + 1) * side, y + ny * (half + 1) * side, wood[2]); dot(x + nx * (half + 1) * side, y + ny * (half + 1) * side + 1, wood[2]); }
    }
  }
  // Weather and the seasons, laid over the land: a tint for the time of year, a shower or snowfall now and then,
  // blossom in spring and drifting leaves in autumn.
  const SEASON_TINT = { spring: [255, 226, 238, .1], summer: [255, 242, 200, .08], autumn: [255, 172, 98, .26], winter: [196, 212, 255, .3] };
  const ORDER = ['spring', 'summer', 'autumn', 'winter'];
  let wxAmt = 0, wxKind = 'rain';
  function drawWeather(s, time, dt) {
    const t = time / 1000, age = s.age || 0, len = 1200, at = (age / len) % 4, cur = ORDER[Math.floor(at)], next = ORDER[(Math.floor(at) + 1) % 4], f = clamp((at % 1 - .92) / .08, 0, 1);
    const a = SEASON_TINT[cur], b = SEASON_TINT[next], c = a.map((v, i) => v + (b[i] - v) * f);
    ctx.globalCompositeOperation = 'multiply'; ctx.fillStyle = `rgba(${c[0] | 0},${c[1] | 0},${c[2] | 0},${c[3]})`; ctx.fillRect(0, 0, W, H);
    const kind = s.wx?.kind;
    wxAmt += ((kind ? 1 : 0) - wxAmt) * Math.min(1, dt * .6); if (kind) wxKind = kind;
    const frost = LANDS[landAtTexel(clamp(cam.x | 0, 0, TW - 1), clamp(cam.y | 0, 0, TH - 1))]?.name === 'Frostmere';
    const snow = wxKind === 'snow' || frost;
    if (wxAmt > .01 && !snow) { ctx.fillStyle = `rgba(118,134,162,${wxAmt * .38})`; ctx.fillRect(0, 0, W, H); }
    ctx.globalCompositeOperation = 'source-over';
    const frostLight = winterGlow(cur, f, next) * .12 + (wxAmt > .01 && snow ? wxAmt * .14 : 0);
    if (frostLight > 0) { ctx.fillStyle = `rgba(240,246,255,${frostLight})`; ctx.fillRect(0, 0, W, H); }
    if (reduced || quality < 1) return;
    const flurry = frost && cam.z > .9 ? .3 : 0; // Frostmere: always a light snow
    if (wxAmt > .01 || flurry) {
      if (snow) { // flakes drifting down and sideways
        ctx.fillStyle = '#ffffff';
        for (let n = 0; n < 240 * Math.max(wxAmt, flurry); n++) { const sp = 26 + hash(n, 3, 91) * 40, x = ((hash(n, 1, 91) * W + Math.sin(t * .8 + n) * 18 + t * 12) % W + W) % W, y = (hash(n, 2, 91) * H + t * sp) % H, r = 2 + Math.floor(hash(n, 4, 91) * 3); ctx.globalAlpha = .7 + hash(n, 5, 91) * .3; ctx.fillRect(x | 0, y | 0, r, r); }
      } else { // slanted streaks of rain
        ctx.strokeStyle = 'rgba(214,232,252,.75)'; ctx.lineWidth = 2; ctx.beginPath();
        for (let n = 0; n < 260 * wxAmt; n++) { const sp = 480 + hash(n, 3, 92) * 260, x = ((hash(n, 1, 92) * W - t * 80) % W + W) % W, y = (hash(n, 2, 92) * H + t * sp) % H; ctx.moveTo(x, y); ctx.lineTo(x - 4, y + 16); }
        ctx.stroke();
        ctx.strokeStyle = 'rgba(225,238,255,.6)'; ctx.lineWidth = 1.5; // little splashes where drops land
        for (let n = 0; n < 50 * wxAmt; n++) { const q = (t * 2.2 + hash(n, 6, 92)) % 1, x = hash(n, 7, 92 + Math.floor(t * 2.2 + hash(n, 6, 92))) * W, y = hash(n, 8, 92 + Math.floor(t * 2.2 + hash(n, 6, 92))) * H; ctx.globalAlpha = (1 - q) * .8; ctx.beginPath(); ctx.ellipse(x, y, 2 + q * 7, 1 + q * 2.5, 0, 0, 7); ctx.stroke(); }
      }
      ctx.globalAlpha = 1;
    }
    if (cam.z > .9 && (cur === 'autumn' || cur === 'spring') && wxAmt < .5) { // drifting leaves or petals
      const cols = cur === 'autumn' ? ['#d8742a', '#e8a33c', '#b8502a'] : ['#ffd6e6', '#ffffff', '#ffc0d8'];
      for (let n = 0; n < 28; n++) { const x = ((hash(n, 1, 93) * W + t * (14 + n % 5 * 4) + Math.sin(t * 1.3 + n) * 20) % W + W) % W, y = ((hash(n, 2, 93) * H + t * (18 + n % 4 * 5)) % H), r = Math.max(3, cam.z * 1.2); ctx.fillStyle = cols[n % 3]; ctx.fillRect(x | 0, y | 0, Math.round(r * (1 + Math.abs(Math.sin(t * 3 + n)))), Math.round(r)); }
    }
  }
  const winterGlow = (cur, f, next) => (cur === 'winter' ? 1 - f : 0) + (next === 'winter' ? f : 0);
  // Fish: now and then one leaps from a filled pond in view, arcs over and drops back in with a ripple.
  // assets/fish.png (ChatGPT art cut by tools/build_critter_art.py): swimming, launching, arched, diving.
  const fish = [], ripples = [];
  let fishAt = 0;
  const closeness = () => clamp((cam.z - 1.6) / 2.9, 0, 1); // 0 far out, 1 right down among the animals
  const heard = (x, y) => ({ pan: (sx(x) - W / 2) / (W / 2), d: Math.min(1, Math.hypot((sx(x) - W / 2) / (W / 2), (sy(y) - H / 2) / (H / 2)) / 1.414) });
  function drawFish(s, t, dt) {
    if (reduced || !images.fish) return;
    const z = cam.z, deep = (x, y) => { x |= 0; y |= 0; return x >= 0 && y >= 0 && x < TW && y < TH && world.waterT[y * TW + x] >= 170 && world.waterT[y * TW + x] < 255; };
    if (!s.paused && t > fishAt) {
      fishAt = t + 4 + Math.random() * 8;
      const [x0, y0, x1, y1] = api.viewBox(), full = world.ponds.map((P, id) => id).filter(id => { const P = world.ponds[id]; return P.r > 0 && s.zones[id]?.water >= 1 && P.x + P.r > x0 && P.x - P.r < x1 && P.y + P.r > y0 && P.y - P.r < y1; });
      if (full.length && fish.length < 3) {
        const P = world.ponds[full[Math.floor(Math.random() * full.length)]];
        for (let k = 0; k < 30; k++) {
          const x = P.x + (Math.random() * 2 - 1) * P.r, y = P.y + (Math.random() * 2 - 1) * P.r * .7, dir = Math.random() < .5 ? -1 : 1, len = 7 + Math.random() * 7;
          if (!deep(x, y) || !deep(x + dir * len, y)) continue;
          fish.push({ x, y, dir, len, h: 6 + Math.random() * 6, age: 0, life: .75 + Math.random() * .3 });
          ripples.push({ x, y, age: 0 }); const e = heard(x, y); api.onSplash?.(e.pan, closeness() * (1 - e.d * .5), false);
          break;
        }
      }
    }
    const sheet = images.fish, fw = sheet.width / 4, fh = sheet.height, k = z / SCALE;
    for (let n = ripples.length - 1; n >= 0; n--) { // flat rings spreading on the water
      const r = ripples[n]; r.age += dt; if (r.age > 1.1) { ripples.splice(n, 1); continue; }
      const q = r.age / 1.1; ctx.strokeStyle = `rgba(235,248,255,${(1 - q) * .7})`; ctx.lineWidth = Math.max(1, z * .6);
      for (const m of [1, .55]) { ctx.beginPath(); ctx.ellipse(sx(r.x), sy(r.y), (1.5 + q * 7 * m) * z, (.7 + q * 2.6 * m) * z, 0, 0, 7); ctx.stroke(); }
    }
    for (let n = fish.length - 1; n >= 0; n--) {
      const f = fish[n]; if (!s.paused) f.age += dt;
      const q = f.age / f.life;
      if (q >= 1) {
        fish.splice(n, 1); const x = f.x + f.dir * f.len; ripples.push({ x, y: f.y, age: 0 }); burst(x, f.y, 5, ['#ffffff', '#cdeeff'], 12);
        const e = heard(x, f.y); api.onSplash?.(e.pan, closeness() * (1 - e.d * .5), true); continue;
      }
      const x = f.x + f.dir * f.len * q, y = f.y - 4 * f.h * q * (1 - q), cell = q < .3 ? 1 : q < .62 ? 2 : 3;
      const w = fw * k, h = fh * k, X = sx(x), Y = sy(y);
      f.sx = X; f.sy = Y; f.sw = Math.max(w, 24); if (closeness() > .3) api.onSeen?.('fish');
      ctx.save(); ctx.translate(X, Y); if (f.dir < 0) ctx.scale(-1, 1);
      ctx.drawImage(sheet, cell * fw, 0, fw, fh, -w / 2, -h / 2, w, h); ctx.restore();
    }
  }
  const keyOf = c => c.kind === 'butterfly' ? 'butterfly' + c.variant % 3 : c.kind === 'bird' ? 'bird' + c.variant % 2 : c.kind !== 'rabbit' && LANDS[ZONES[c.zone].land].native ? 'native' + lookOf(ZONES[c.zone].land) : c.kind;
  // The animals in view, for the sound: where each is across the screen and how far from the middle.
  function hearing() {
    const out = [], near = closeness();
    if (near <= 0) return { near, sources: out };
    const [x0, y0, x1, y1] = api.viewBox();
    for (const c of critters) if ((!PETS[c.kind] || c.alpha > .5) && c.x > x0 && c.x < x1 && c.y > y0 && c.y < y1) out.push({ kind: c.kind, key: keyOf(c), ...heard(c.x, c.y) });
    for (const d of ducks) if (d.x > x0 && d.x < x1 && d.y > y0 && d.y < y1) out.push({ kind: 'duck', key: 'duck', ...heard(d.x, d.y) });
    for (const f of folk) if (f.x > x0 && f.x < x1 && f.y > y0 && f.y < y1) out.push({ kind: 'folk', key: 'folk', ...heard(f.x, f.y) });
    if (near > .35) for (const q of out) if (q.d < .8) api.onSeen?.(q.key);
    return { near, sources: out };
  }
  // Wildlife arrives as the land heals. Butterflies and birds pass through; pets stay and graze.
  let critterAt = -1;
  const announced = new Set();
  function wantFor(s, id, out) {
    const z = s.zones[id];
    if (!z.open) return;
    const p = z.g / (GREEN * world.count[id]);
    if (p > .25) out.push(['butterfly', id, 0], ['butterfly', id, 1]);
    if (p > .5) out.push(['rabbit', id, 4]);
    if (p > .6) out.push(['butterfly', id, 2], ['bird', id, 3]);
    if (z.done) out.push(['deer', id, 7], ['rabbit', id, 5], ['bird', id, 6]);
    if (z.bloomed) out.push(['fawn', id, 8], ['rabbit', id, 9], ['butterfly', id, 10]);
  }
  const arrived = new Map(); // zone * 16 + n: when that animal arrives
  function spawnCritters(s, time) {
    if (time - critterAt < 500) return;
    critterAt = time;
    // The dozen open glades nearest the middle of the screen have wildlife; the rest of the continent rests.
    const near = ZONES.filter(z => s.zones[z.id].open).map(z => [(z.px - cam.x) ** 2 + (z.py - cam.y) ** 2, z.id]).sort((a, b) => a[0] - b[0]).slice(0, 12).map(e => e[1]);
    // Wildlife comes back a little at a time: each animal a glade has earned turns up some while after the
    // glade earned it, one after another, instead of all at once. On a fresh load, everyone is already home.
    const all = []; ZONES.forEach(z => wantFor(s, z.id, all));
    for (const [, zone, n] of all) if (!arrived.has(zone * 16 + n)) arrived.set(zone * 16 + n, greeted ? time + 5000 + n * 9000 + hash(zone, n, 41) * 8000 : -1);
    const want = [], nearSet = new Set(near);
    for (const w of all) if (nearSet.has(w[1]) && time >= arrived.get(w[1] * 16 + w[2])) want.push(w);
    if (!greeted) { announced.clear(); for (const [kind, zone, n] of all) if (PETS[kind]) announced.add(zone * 16 + n); }
    greeted = true;
    const key = want.map(w => w[1] * 16 + w[2]).join();
    if (key === critters.key) return;
    critters = want.map(([kind, zone, n]) => {
      const old = critters.find(c => c.zone === zone && c.n === n);
      if (old) return old;
      const P = ZONES[zone], side = hash(zone, n, 35) * 6.28, far = PETS[kind] ? 150 : 0;
      const c = { kind, zone, n, x: P.px + Math.cos(side) * far + (hash(zone, n, 31) - .5) * 120, y: P.py + Math.sin(side) * far * .7 + (hash(n, zone, 33) - .5) * 90, tx: 0, ty: 0, pause: 0, dir: 1, variant: n % 3, alpha: 0, state: 'walk', step: 0, dist: 0, air: 0, hearts: 0, seen: hash(zone, n, 39) * 5 };
      if (PETS[kind] && world.nav && !standable(world, Math.floor(c.y / CELL) * CW + Math.floor(c.x / CELL))) { // never appear in a pond or a tree
        const list = world.cellsOf[zone].filter(i => standable(world, i)); if (list.length) { const i = list[Math.floor(hash(zone, n, 37) * list.length)]; c.x = i % CW * CELL + 2; c.y = Math.floor(i / CW) * CELL + 2; }
      }
      if (PETS[kind] && !announced.has(zone * 16 + n)) { announced.add(zone * 16 + n); api.onPet?.(petDef(kind, zone).label, zone); }
      return c;
    });
    critters.key = key;
  }
  function petTarget(s, c) {
    const P = ZONES[c.zone], list = world.cellsOf[c.zone];
    for (let k = 0; k < 12; k++) {
      const i = list[Math.floor(Math.random() * list.length)];
      if (s.h[i] >= .5 && (!world.nav || standable(world, i))) { const x = i % CW * CELL + 2, y = Math.floor(i / CW) * CELL + 2; if (Math.hypot(x - c.x, y - c.y) < 150 || k > 8) { c.tx = x; c.ty = y; return; } }
    }
    c.tx = 0; c.pause = 2 + Math.random() * 3; c.state = 'idle';
  }
  // Away from the heartland, each land's own creature takes the deer's place. Rabbits are everywhere.
  function petDef(kind, zone) { const d = PETS[kind], n = LANDS[ZONES[zone].land].native; return n && d.row === 0 ? { row: 3, label: d.young ? n.label.replace(/^An? /, 'A young ') : n.label, size: d.young ? n.size * .72 : n.size, speed: n.speed } : d; }
  function stepPet(s, c, dt, night) {
    const def = petDef(c.kind, c.zone);
    c.alpha = Math.min(1, c.alpha + dt * .5);
    if (c.hearts > 0) { c.hearts -= dt; c.state = 'idle'; return; }
    if (world.nav) { const q = c.nav ||= {}; q.x = c.x / CELL; q.y = c.y / CELL; if (escape(world, q, def.speed * dt / CELL)) { const x0 = c.x; c.x = q.x * CELL; c.y = q.y * CELL; c.dist += Math.abs(c.x - x0) + .01; c.dir = q.dir; c.state = 'walk'; c.pause = 0; c.tx = 0; return; } }
    if (c.pause > 0) {
      c.pause -= dt;
      if (c.pause <= 0) c.state = 'walk';
      return;
    }
    if (!c.tx) petTarget(s, c);
    const d = Math.hypot(c.tx - c.x, c.ty - c.y);
    if (d < 1.5) {
      c.tx = 0; const r = Math.random();
      c.state = night && r < .6 ? 'sleep' : r < .68 ? 'idle' : 'graze';
      c.pause = c.state === 'sleep' ? 25 + Math.random() * 30 : c.state === 'graze' ? 4 + Math.random() * 7 : 2 + Math.random() * 3;
      return;
    }
    c.step += dt;
    // Feel the way round trees, stones, houses and ponds; bound across streams.
    const q = c.nav ||= {}, x0 = c.x, y0 = c.y; q.x = c.x / CELL; q.y = c.y / CELL;
    const r = world.nav ? steer(world, q, c.tx / CELL, c.ty / CELL, Math.min(d, def.speed * dt) / CELL, dt) : 'moving';
    if (!world.nav) { const v = Math.min(d, def.speed * dt); q.x += (c.tx - c.x) / d * v / CELL; q.y += (c.ty - c.y) / d * v / CELL; }
    c.x = q.x * CELL; c.y = q.y * CELL; c.dist += Math.hypot(c.x - x0, c.y - y0);
    if (Math.abs(c.x - x0) > .02) c.dir = c.x < x0 ? -1 : 1;
    if (r !== 'moving') { c.tx = 0; c.state = 'idle'; c.pause = r === 'stuck' ? .5 : 1 + Math.random() * 2; }
  }
  // Animals are drawn smaller than their art, the same share as everything else.
  const small = () => SHRINK;
  function drawPet(c, t) {
    const def = petDef(c.kind, c.zone), z = cam.z, x = sx(c.x), y = sy(c.y), walking = c.state === 'walk';
    const land = ZONES[c.zone].land, name = c.kind === 'rabbit' ? 'rabbit' : land ? NATIVE[land] : c.kind;
    // The walk is driven by distance covered, not time, so feet stay planted on the ground as the body passes.
    // Rabbits bound instead: one hop per four texels, and every animal bounds over a stream.
    const f = small(c.kind), rabbit = c.kind === 'rabbit', cyc = (c.dist || 0) / (strideOf(name) * f), q = c.dist / (5 * f) % 1, hop = walking && rabbit && q > .15 && q < .9 ? Math.sin((q - .15) / .75 * Math.PI) : 0;
    c.air += ((world.nav && overWater(world, c.x / CELL, c.y / CELL) ? 1 : 0) - c.air) * Math.min(1, (1 / 60) * 14);
    const pose = c.state === 'sleep' ? 'sleep' : c.state === 'graze' ? 'graze' : walking && c.air > .25 ? 'leap' : walking ? 'walk' : 'stand', ph = Math.floor((rabbit ? q : cyc % 1) * WALK_FRAMES) % WALK_FRAMES;
    const size = def.size * f * z, lift = (hop * 3 + Math.sin(c.air * Math.PI / 2) * 5) * f * z;
    ctx.globalAlpha = c.alpha;
    const art = critterCanvas(name, pose, pose === 'walk' ? ph : 0, c.dir < 0), k = z * f / SCALE, aw = art.width * k, ah = art.height * k;
    { const sh = shadowOf(art), left = snapX(x - aw / 2); ctx.drawImage(sh.c, left, snapY(y - ah) + (sh.foot - sh.c.height + 2) * k, sh.c.width * k, sh.c.height * k); }
    ctx.drawImage(art, snapX(x - aw / 2), snapY(y - lift - ah), aw, ah);
    if (lift < z * 1.5) { const cut = Math.max(1.6, ah / z * (rabbit ? .3 : .4)) - lift / z; grassOver(c.x, c.y, aw / z * .32, cut, walking ? c.dist : 0); }
    if (def.row === 0 && !reduced && quality > 0) { // Spirit deer shed slow motes of light.
      for (let k = 0; k < 3; k++) { const q = (t * .22 + k / 3 + c.n * .13) % 1; ctx.globalAlpha = c.alpha * Math.sin(q * 3.14) * .85; ctx.fillStyle = '#b8fff0'; ctx.fillRect(x + (hash(k, c.n, 41) - .5) * size * .8 + Math.sin(t + k) * z, y - size * (.35 + q * .85), Math.max(1, z * .7), Math.max(1, z * .7)); }
    }
    ctx.globalAlpha = 1;
    if (c.hearts > 0) { const a = 1 - c.hearts / 1.6; for (let k = 0; k < 3; k++) { const q = Math.max(0, a * 1.6 - k * .2); if (q > 0 && q < 1) { ctx.globalAlpha = 1 - q; ctx.drawImage(HEART, x + (k - 1) * 4 * z + Math.sin(q * 6 + k) * z, y - size * .9 - q * 14 * z, 5 * z, 5 * z); } } ctx.globalAlpha = 1; }
  }
  function drawCritters(s, time, dt) {
    if (reduced && s.paused) return;
    const t = time / 1000, z = cam.z;
    for (const c of critters) {
      if (PETS[c.kind]) continue;
      c.pause -= dt;
      if (c.spook > 0) c.spook -= dt;
      const speed = (c.kind === 'bird' ? 34 : 9) * (c.spook > 0 ? 3 : 1);
      const P = ZONES[c.zone], d = Math.hypot(c.tx - c.x, c.ty - c.y);
      if (d < 2 || !c.tx) { c.tx = P.px + (Math.random() - .5) * 240; c.ty = P.py + (Math.random() - .5) * 150; }
      else { c.x += (c.tx - c.x) / d * speed * dt; c.y += (c.ty - c.y) / d * speed * dt; c.dir = c.tx < c.x ? -1 : 1; }
      const x = sx(c.x), y = sy(c.y);
      if (x < -60 || y < -60 || x > W + 60 || y > H + 60) continue;
      if (!images.flyers) continue;
      c.alpha = Math.min(1, (c.alpha || 0) + dt * .35); ctx.globalAlpha = c.alpha;
      const beat = Math.floor(t * (c.kind === 'bird' ? 9 : 10) + c.n * 1.7) % 4, row = c.kind === 'butterfly' ? c.variant % 3 : 3 + c.variant % 2, lift = (c.kind === 'bird' ? 26 : 7 + Math.sin(t * 2 + c.n) * 3) + (c.spook > 0 ? (1.6 - c.spook) * 12 : 0), w = FLY_W * z / 2, h = FLY_H * z / 2;
      c.sx = x; c.sy = y - lift * z - h / 2; c.sw = Math.max(w, 24);
      ctx.fillStyle = 'rgba(30,24,18,.12)'; ctx.fillRect(x - w / 3, y, w * .66, z);
      const fx = beat * FLY_W, fy = row * FLY_H;
      if (c.kind === 'bird' && c.dir < 0) { ctx.save(); ctx.translate(x, 0); ctx.scale(-1, 1); ctx.drawImage(images.flyers, fx, fy, FLY_W, FLY_H, -w / 2, y - lift * z - h, w, h); ctx.restore(); }
      else ctx.drawImage(images.flyers, fx, fy, FLY_W, FLY_H, x - w / 2, y - lift * z - h, w, h);
      ctx.globalAlpha = 1;
    }
  }
  function addParticle(p) { if (!reduced && particles.length < 340) particles.push(p); }
  function burst(x, y, n, colors, power = 22) {
    for (let k = 0; k < n; k++) { const a = Math.random() * 6.28, v = power * (.35 + Math.random() * .65); addParticle({ x, y, vx: Math.cos(a) * v, vy: Math.sin(a) * v - 12, g: 26, life: .8 + Math.random() * .7, age: 0, size: 1 + Math.random() * 1.1, color: colors[k % colors.length] }); }
  }
  function drawParticles(dt) {
    const z = cam.z;
    for (const p of particles) {
      p.age += dt; p.x += p.vx * dt; p.y += p.vy * dt; p.vy += p.g * dt;
      ctx.globalAlpha = Math.max(0, 1 - (p.age / p.life) ** 2); ctx.fillStyle = p.color;
      ctx.fillRect(sx(p.x), sy(p.y), p.size * z, p.size * z);
    }
    ctx.globalAlpha = 1; particles = particles.filter(p => p.age < p.life);
    for (const r of rings) {
      r.age += dt; const k = r.age / r.life, rad = r.from + (r.to - r.from) * (1 - (1 - k) ** 2);
      ctx.globalAlpha = (1 - k) * .55; ctx.strokeStyle = r.color; ctx.lineWidth = Math.max(2, (8 * (1 - k) + 1) * z);
      ctx.beginPath(); ctx.arc(sx(r.x), sy(r.y), rad * z, 0, 7); ctx.stroke();
    }
    ctx.globalAlpha = 1; rings = rings.filter(r => r.age < r.life);
    if (glows.length) {
      ctx.globalCompositeOperation = 'lighter';
      for (const g of glows) {
        g.age += dt; const k = g.age / g.life, rad = (70 + 230 * k) * z, x = sx(g.x), y = sy(g.y), fill = ctx.createRadialGradient(x, y, 0, x, y, rad);
        fill.addColorStop(0, `rgba(${g.color},${.36 * (1 - k)})`); fill.addColorStop(1, `rgba(${g.color},0)`);
        ctx.fillStyle = fill; ctx.fillRect(x - rad, y - rad, rad * 2, rad * 2);
      }
      ctx.globalCompositeOperation = 'source-over'; glows = glows.filter(g => g.age < g.life);
    }
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.font = '600 ' + Math.round(clamp(z * 7, 17, 30)) + 'px "Pixelify Sans",Georgia,serif';
    for (const f of floaters) { f.age += dt; const k = f.age / 1.3; ctx.globalAlpha = Math.min(1, (1 - k) * 2); ctx.fillStyle = '#2a2017'; ctx.fillText(f.text, sx(f.x) + 1, sy(f.y) - k * 26 * z + 2); ctx.fillStyle = '#ffe28a'; ctx.fillText(f.text, sx(f.x), sy(f.y) - k * 26 * z); }
    ctx.globalAlpha = 1; floaters = floaters.filter(f => f.age < 1.3);
    for (const f of flyers) { f.age += dt; if (f.age < 0) continue; const k = Math.min(1, f.age / f.life), e = k * k * (3 - 2 * k), s = 24 - k * 8; ctx.drawImage(images.world, 64, 192, 64, 64, f.x + (34 - f.x) * e - s / 2, f.y + (32 - f.y) * e - Math.sin(k * 3.14) * 46 - s / 2, s, s); }
    flyers = flyers.filter(f => f.age < f.life);
  }
  // Light across the day. A full cycle is about eight minutes, and nights keep their fireflies.
  function drawLight(s, time) {
    const day = (s.age / 480) % 1, night = clamp((Math.cos(day * 6.283) * -1 - .35) / .65, 0, 1), dusk = clamp(1 - Math.abs(Math.cos(day * 6.283) + .35) * 3.2, 0, 1) * .8;
    ctx.globalCompositeOperation = 'multiply';
    if (night > 0) { ctx.fillStyle = `rgba(${150 - night * 40},${150 - night * 22},${200},${night * .55})`; ctx.fillRect(0, 0, W, H); }
    if (dusk > 0) { ctx.fillStyle = `rgba(255,190,130,${dusk * .55})`; ctx.fillRect(0, 0, W, H); }
    ctx.globalCompositeOperation = 'source-over';
    if (night > .5 && cam.z >= 1.2) api.onSeen?.('fireflies');
    if (night > .15 && !reduced && quality > 0) {
      const t = time / 1000;
      const x0 = Math.floor((cam.x - W / 2 / cam.z) / 160), x1 = Math.floor((cam.x + W / 2 / cam.z) / 160), y0 = Math.floor((cam.y - H / 2 / cam.z) / 160), y1 = Math.floor((cam.y + H / 2 / cam.z) / 160);
      for (let ty = y0; ty <= y1; ty++) for (let tx = x0; tx <= x1; tx++) for (let q = 0; q < 2; q++) {
        const k = (ty * 31 + tx) * 2 + q;
        const fx = (tx + hash(k, 1, 77)) * 160 + Math.sin(t * .3 + k) * 14, fy = (ty + hash(k, 2, 77)) * 160 + Math.cos(t * .23 + k * 2) * 10;
        const c = Math.floor(fy / CELL) * CW + Math.floor(fx / CELL);
        if (fx < 0 || fy < 0 || fx >= TW || fy >= TH || s.h[c] < .5) continue;
        const b = Math.sin(t * 1.7 + k * 3); if (b < .25) continue;
        const x = sx(fx), y = sy(fy);
        ctx.globalAlpha = night * (b - .25) * .4; ctx.fillStyle = '#e7ff8c'; ctx.beginPath(); ctx.arc(x, y, cam.z * 3, 0, 7); ctx.fill();
        ctx.globalAlpha = night * b; ctx.fillRect(x, y, cam.z, cam.z); ctx.globalAlpha = 1;
      }
    }
  }
  // Sleeping glades next to open ground carry a sign you can click to wake them.
  let signs = [];
  function drawLabels(s) {
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; signs = [];
    if (cam.z < .9) REGIONS.forEach(R => {
      const L = R, zs = ZONES.filter(z => R.lands.includes(z.land)), x = sx(zs.reduce((a, z) => a + z.px, 0) / zs.length), y = sy(zs.reduce((a, z) => a + z.py, 0) / zs.length) - 40;
      ctx.globalAlpha = Math.min(1, (.9 - cam.z) * 5); ctx.font = '600 ' + Math.round(clamp(cam.z * 60, W < 600 ? 12 : 18, 34)) + 'px "Pixelify Sans",Georgia,serif';
      ctx.fillStyle = '#231a12'; ctx.fillText(L.name, x + 2, y + 2); ctx.fillStyle = '#fff6df'; ctx.fillText(L.name, x, y); ctx.globalAlpha = 1;
    });
    ZONES.forEach((z, i) => {
      if (fogAlpha[i] < .5) return;
      const x = sx(z.px), y = sy(z.py); if (x < -120 || y < -40 || x > W + 120 || y > H + 40) return;
      const size = Math.round(clamp(cam.z * 7, cam.z < .9 ? 11 : 15, 28));
      ctx.globalAlpha = fogAlpha[i] * .9;
      if (gladeBuyable(s, i)) {
        const price = gladePrice(s, i), can = s.seeds >= price, text = `Wake for ${money(price)}`, small = Math.round(size * .78);
        ctx.font = '600 ' + small + 'px "Pixelify Sans",Georgia,serif'; const tw = ctx.measureText(text).width; ctx.font = '600 ' + size + 'px "Pixelify Sans",Georgia,serif';
        const bw = Math.max(tw, ctx.measureText(z.name).width) + 26, bh = size + small + 18, bx = clamp(x - bw / 2, 8, W - bw - 8), by = clamp(y - bh / 2, 96, H - bh - 112), beat = can && !reduced ? .5 + Math.sin(performance.now() * .004) * .5 : 0;
        ctx.fillStyle = '#3a2e23'; ctx.strokeStyle = can ? `rgb(255,${200 + beat * 30},${90 + beat * 60})` : '#7a6650'; ctx.lineWidth = can ? 3 : 2;
        ctx.beginPath(); ctx.roundRect(bx, by, bw, bh, 7); ctx.fill(); ctx.stroke();
        ctx.fillStyle = '#fff6df'; ctx.fillText(z.name, bx + bw / 2, by + 6 + size / 2);
        ctx.font = '600 ' + small + 'px "Pixelify Sans",Georgia,serif'; ctx.fillStyle = can ? '#ffd36b' : '#c9b8a0'; ctx.fillText(text, bx + bw / 2, by + 9 + size + small / 2);
        signs.push({ i, x: bx, y: by, w: bw, h: bh });
      } else if (cam.z >= .9) { ctx.fillStyle = '#4b4438'; ctx.font = '600 ' + size + 'px "Pixelify Sans",Georgia,serif'; ctx.fillText(z.name, x, y); }
      ctx.globalAlpha = 1;
    });
  }
  const api = {
    onPet: null,
    floraCell(i) { floraDirty[Math.floor(Math.floor(i / CW) * CELL / FC) * FCOLS + Math.floor(i % CW * CELL / FC)] = 1; },
    allFlora() { floraDirty.fill(1); },
    get grass() { return grass; },
    setGrass(style) { if (!GRASS_STYLES[style] || style === grass) return; grass = style; flora = LANDS.map(P => floraAtlas(P, style)); tinted.clear(); floraDirty.fill(1); },
    get quality() { return quality; },
    setQuality(q) { quality = q; resize(); },
    dispose() { removeEventListener('resize', resize); },
    hitSign(px, py) { for (const b of signs) if (px >= b.x && py >= b.y && px <= b.x + b.w && py <= b.y + b.h) return b.i; return -1; },
    hitPet(px, py) { for (const c of critters) { const d = PETS[c.kind]; if (!d) continue; const size = d.size * cam.z, x = sx(c.x), y = sy(c.y); if (Math.abs(px - x) < Math.max(16, size * .45) && py > y - Math.max(24, size) && py < y + 8) return c; } return null; },
    pet(c) { c.hearts = 1.6; c.dir = c.dir || 1; },
    // Wildlife already on the land arrives quietly, as on a fresh load. Used when the whole state is swapped.
    regreet() { greeted = false; critterAt = -1; arrived.clear(); duckFirst = undefined; },
    pets: () => critters.filter(c => PETS[c.kind]),
    onSplash: null, onSeen: null, hearing, keyOf,
    // Butterflies, birds and leaping fish under a tap: the nearest one within reach, or null.
    hitWild(px, py) {
      let best = null, bd = Infinity;
      for (const c of critters) if (!PETS[c.kind] && c.sx != null) { const d = Math.hypot(px - c.sx, py - c.sy); if (d < c.sw * 1.2 && d < bd) { bd = d; best = { kind: c.kind, key: keyOf(c), o: c, x: c.x, y: c.y - 20 }; } }
      for (const f of fish) if (f.sx != null) { const d = Math.hypot(px - f.sx, py - f.sy); if (d < f.sw * 1.2 && d < bd) { bd = d; best = { kind: 'fish', key: 'fish', o: f, x: f.x, y: f.y - 8 }; } }
      return best;
    },
    startle(w) { if (w.kind === 'fish') { burst(w.o.x + w.o.dir * w.o.len * .5, w.o.y - 8, 8, ['#ffd36b', '#fff'], 16); return; } w.o.spook = 1.6; w.o.tx = w.o.x + (Math.random() - .5) * 300; w.o.ty = w.o.y + (Math.random() - .5) * 200; burst(w.o.x, w.o.y - 14, 6, ['#fff', '#ffe28a'], 14); },
    hitFolk(px, py) { for (const f of folk) if (f.sx != null && Math.abs(px - f.sx) < Math.max(14, f.sh * .35) && Math.abs(py - f.sy) < Math.max(18, f.sh * .6)) return f; return null; },
    cheer(land) { for (const f of folk) if (f.land === land) { f.wave = 3; f.pause = 3; } },
    cam, resize, focusZone, focusAll, focusLand, zoomAt, pan, toCell, toWorld,
    glide(x, y, z) { anchor = null; cam.tx = x; cam.ty = y; cam.tz = z; clampCam(); },
    viewBox() { return [cam.x - W / 2 / cam.z, cam.y - H / 2 / cam.z, cam.x + W / 2 / cam.z, cam.y + H / 2 / cam.z]; },
    screenOf(x, y) { return { x: sx(x), y: sy(y) }; },
    setShown(f) { shown = f; floraDirty.fill(1); },
    reward(x, y, amount, fly = 6) { // World position. A number rises and seeds fly home to the counter.
      if (reduced) return;
      floaters.push({ x, y, text: '+' + (amount >= 1e4 ? (amount / 1e3).toFixed(1) + 'k' : Math.round(amount)), age: 0 });
      const from = { x: sx(x), y: sy(y) };
      for (let k = 0; k < fly && flyers.length < 40; k++) flyers.push({ x: from.x + (Math.random() - .5) * 26, y: from.y + (Math.random() - .5) * 26, age: -k * .05, life: .75 });
    },
    glow(z, color = '255,236,170') { const p = world.ponds[z]; glows.push({ x: p.x, y: p.y, age: 0, life: 3.4, color }); },
    pop(cellX, cellY) { burst(cellX * CELL, cellY * CELL - 6, 18, ['#fff', '#d8f58f', '#ffe28a'], 26); rings.push({ x: cellX * CELL, y: cellY * CELL - 6, from: 2, to: 18, age: 0, life: .5, color: '#fff3b8' }); },
    revived(o, time) { revives.set(o.id, time); const x = o.x * CELL, y = o.y * CELL - o.size * .4; burst(x, y, 12 + o.size * .5 | 0, ['#c9f07a', '#ffe28a', '#fff', '#8ad05a'], 30); rings.push({ x, y: y + o.size * .3, from: 4, to: 16 + o.size * .5, age: 0, life: .6, color: '#fff3b8' }); },
    sweep(z, color = '#fff3c4') { const p = world.ponds[z]; rings.push({ x: p.x, y: p.y, from: 8, to: 220, age: 0, life: 4.2, color }); burst(p.x, p.y, 70, ['#fff', '#ffe28a', '#c9f07a', '#ffc6dd'], 58); },
    spark(cellX, cellY, amount, r) { const n = Math.min(4, amount * .28); for (let k = 0; k < n; k++) { if (Math.random() > n / 4 + .2) continue; const a = Math.random() * 6.28, q = Math.random() * r * CELL; addParticle({ x: cellX * CELL + Math.cos(a) * q, y: cellY * CELL + Math.sin(a) * q, vx: (Math.random() - .5) * 8, vy: -8 - Math.random() * 16, g: 3, life: .55 + Math.random() * .6, age: 0, size: .8 + Math.random() * .6, color: ['#d8f58f', '#fff2ab', '#9ddc6a'][k % 3] }); } },
    hitSpirit(s, px, py) { for (let i = s.spirits.length - 1; i >= 0; i--) { const a = s.spirits[i], size = (a.type === 3 ? 20 : 15) * cam.z, x = sx((a.rx ?? a.x) * CELL), y = sy((a.ry ?? a.y) * CELL); if (Math.abs(px - x) < Math.max(14, size * .4) && py > y - size && py < y + 6) return a; } return null; },
    draw(s, time, dt, opts) {
      if (anchor) { // A zoom around a point: ease the scale, then place the view so the point stays put.
        const k = 1 - Math.exp(-Math.min(dt, .05) * 12), lz = Math.log(cam.z), tl = Math.log(cam.tz);
        cam.z = Math.abs(tl - lz) < .002 ? cam.tz : Math.exp(lz + (tl - lz) * k);
        [cam.x, cam.y] = keepIn(anchor.wx - (anchor.px - W / 2) / cam.z, anchor.wy - (anchor.py - H / 2) / cam.z, cam.z);
        if (cam.z === cam.tz) { anchor = null; cam.tx = cam.x; cam.ty = cam.y; }
      } else if (cam.x !== cam.tx || cam.y !== cam.ty || cam.z !== cam.tz) { // A glide: position and scale ease together, the scale evenly.
        const k = 1 - Math.exp(-Math.min(dt, .05) * (opts.camSpeed || 3.2)), lz = Math.log(cam.z), tl = Math.log(cam.tz);
        cam.x += (cam.tx - cam.x) * k; cam.y += (cam.ty - cam.y) * k; cam.z = Math.exp(lz + (tl - lz) * k);
        if (Math.abs(cam.x - cam.tx) + Math.abs(cam.y - cam.ty) < .05 && Math.abs(tl - lz) < .002) { cam.x = cam.tx; cam.y = cam.ty; cam.z = cam.tz; }
      }
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0); ctx.imageSmoothingEnabled = false; newFrame();
      updateFog(s); spawnCritters(s, time); spawnFolk(s, time);
      ctx.fillStyle = '#365568'; ctx.fillRect(0, 0, W, H);
      drawGround(land.canvas); drawWater(s, time); drawDucks(s, time / 1000, dt); drawFish(s, time / 1000, dt); drawPier(s); drawFlora(s, time, dt); drawProps(s, time, dt, opts.carry); drawCritters(s, time, dt); drawLight(s, time); drawWeather(s, time, dt);
      drawParticles(dt);
      if (fogAlpha.some(a => a > 0)) { ctx.imageSmoothingEnabled = true; const drift = reduced || quality < 1 ? 0 : Math.sin(time * .00016) * 7 * cam.z; ctx.globalAlpha = .72; ctx.drawImage(fogSoft, 0, 0, CW, CH, sx(0), sy(0), TW * cam.z, TH * cam.z); ctx.globalAlpha = quality > 1 ? .5 : .35; if (quality > 1) ctx.drawImage(fogSoft, 0, 0, CW, CH, sx(0) + drift, sy(0) - drift * .5, TW * cam.z, TH * cam.z); ctx.globalAlpha = 1; ctx.imageSmoothingEnabled = false; }
      if (!opts.title) drawLabels(s);
      if (opts.then !== null && opts.then !== undefined) {
        thenC ||= land.dayOne();
        ctx.save(); ctx.beginPath(); ctx.rect(0, 0, opts.then, H); ctx.clip(); drawGround(thenC);
        for (const o of world.objects) { const x = sx(o.x * CELL), y = sy(o.y * CELL); if (x > -160 && x < W + 160 && y > -40 && y < H + 300) drawArt(o, o.dead, x, y, o.size * cam.z); }
        ctx.fillStyle = 'rgba(58,52,44,.12)'; ctx.fillRect(0, 0, W, H); ctx.restore();
        ctx.fillStyle = '#fff6df'; ctx.fillRect(opts.then - 2, 0, 4, H);
        ctx.beginPath(); ctx.arc(opts.then, H / 2, 20, 0, 7); ctx.fill(); ctx.fillStyle = '#4b4438'; ctx.font = '600 16px "Pixelify Sans",Georgia,serif'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText('< >', opts.then, H / 2 + 1);
        ctx.font = '600 22px "Pixelify Sans",Georgia,serif'; ctx.fillStyle = '#fff6df'; ctx.shadowColor = '#0009'; ctx.shadowBlur = 5; ctx.fillText('Then', Math.max(46, opts.then - 54), H / 2 - 44); ctx.fillText('Now', Math.min(W - 46, opts.then + 54), H / 2 - 44); ctx.shadowBlur = 0;
      }
      if (opts.pointer && opts.then == null) {
        const r = brushRadius(s) * CELL * cam.z, b = opts.holding ? .22 + Math.sin(time * .012) * .04 : .08;
        ctx.fillStyle = `rgba(255,236,170,${b})`; ctx.beginPath(); ctx.arc(opts.pointer.x, opts.pointer.y, r, 0, 7); ctx.fill();
        ctx.strokeStyle = `rgba(255,246,214,${opts.holding ? .85 : .5})`; ctx.lineWidth = 2; ctx.setLineDash([5, 6]); ctx.lineDashOffset = -time * .02; ctx.stroke(); ctx.setLineDash([]);
      }
      if (opts.carry) {
        const a = opts.carry, size = (a.type === 3 ? 24 : 19) * cam.z, wiggle = reduced ? 0 : Math.sin(time * .02) * .14;
        ctx.save(); ctx.translate(a.px, a.py + 4); ctx.rotate(wiggle); { const c = spiritCanvas(a.type, 0, false), k = cam.z * 1.25 / SCALE; ctx.drawImage(c, -c.width * k / 2, -c.height * k * .8, c.width * k, c.height * k); } ctx.restore();
      }
    },
    snapshot(thenSide, l, width = 480) { // A small postcard of one land.
      const h = Math.round(width * LH / LW), c = document.createElement('canvas'); c.width = width; c.height = h;
      const g = c.getContext('2d'); g.imageSmoothingEnabled = true; thenC ||= land.dayOne(); g.drawImage(thenSide ? thenC : land.canvas, LANDS[l].col * LW, LANDS[l].row * LH, LW, LH, 0, 0, width, h);
      return c.toDataURL('image/jpeg', .72);
    },
  };
  return api;
}
