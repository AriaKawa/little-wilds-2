// The ground as one pixel canvas for the whole continent. Every texel keeps a small code for its grain,
// shade and kind of ground; each land turns codes into colours through lookup tables, one per growth stage,
// so the front line between dead and alive stays crisp and organic without a colour array per stage.
import { TW, TH, LW, LH, CW, CH, CELL, fbm, noise, hash, LANDS, SEA, BEACH, ROCK, landAtTexel, hillShade } from './world.mjs?v=31';

const packed = (r, g, b) => (255 << 24) | (Math.max(0, Math.min(255, b)) << 16) | (Math.max(0, Math.min(255, g)) << 8) | Math.max(0, Math.min(255, r));
const pack = c => packed(c[0], c[1], c[2]);
const mixTo = (c, t, k) => c.map((v, n) => v + (t[n] - v) * k);
const SOIL_AT = .1, GRASS_AT = .3, LUSH_AT = .74, CHUNK = 32, COLS = TW / CHUNK, ROWS = TH / CHUNK, STAGE = 32768;
// One sea for the whole coast, so neighbouring lands meet without a seam in the water.
export const SEA_BLUE = [62, 148, 184];
const EDGE = 0x8000, ROAD = 0xc000; // Codes at or above EDGE are coast, rock or road; below are open ground.
// Growth stages in lookup order: dead, soil, grass, lush, then the two bright rims of the advancing front.
const DEAD = 0, SOIL = 1, GRASS = 2, LUSH = 3, RIM_A = 4, RIM_B = 5;

// Open ground: shade (5 bits), fine mottling (2), blotch band (3), grain class (3), crack (1), sun (1).
function groundTables(P) {
  const t = new Uint32Array(STAGE * 6);
  for (let c = 0; c < STAGE; c++) {
    const shade = .78 + (c & 31) / 31 * .44, fine = c >> 5 & 3, band = (c >> 7 & 7) / 6, grain = c >> 10 & 7, crack = c >> 13 & 1, sun = c >> 14 & 1;
    const g88 = grain >= 1, g90 = grain >= 2, g95 = grain >= 3, salt = grain === 4, mottled = fine / 4 - .4;
    const dk = shade * (1 + (band + (g90 ? .08 : 0) - .5) * .13);
    t[DEAD * STAGE + c] = crack ? pack(P.crack.map(v => v * shade)) : salt ? pack(P.dead.map(v => v * 1.25)) : pack(P.dead.map(v => v * dk));
    t[SOIL * STAGE + c] = pack(P.soil.map(v => v * shade * (.9 + fine * .07 + (g95 ? .14 : 0))));
    t[GRASS * STAGE + c] = pack(P.grass.map(v => v * shade * (1 + mottled * .2 + (g90 ? .1 : 0))));
    t[LUSH * STAGE + c] = pack(P.lush.map(v => v * shade * (1 + mottled * .18 + (sun ? .05 : 0) + (g88 ? .1 : 0))));
    t[RIM_A * STAGE + c] = packed(P.soil[0] * 1.9 * shade, P.soil[1] * 1.9 * shade, P.soil[2] * 1.7 * shade);
    t[RIM_B * STAGE + c] = packed(P.lush[0] * 1.4 * shade + 22, P.lush[1] * 1.28 * shade + 18, P.lush[2] * 1.05 * shade);
  }
  return t;
}
// Coast, rock and road: three colours each. Edges use [dead, alive]; roads use [dead, damp, grown].
function edgeTables(P) {
  const t = new Uint32Array(STAGE * 3), sand = P.sand || [226, 206, 158], peak = P.peak || [214, 208, 196];
  for (let kind = 0; kind < 4; kind++) for (let dq = 0; dq < 16; dq++) for (let band = 0; band < 4; band++) for (let foam = 0; foam < 2; foam++) for (let grain = 0; grain < 2; grain++) {
    const e = kind + 1, d = dq / 15, b4 = band / 4, i = (kind << 12 | dq << 8 | band << 6 | foam << 5 | grain << 4) * 3;
    let a, b;
    if (e === SEA) { const k = .72 + (1 - d) * .32 + b4 * .1; a = mixTo(SEA_BLUE, [72, 84, 104], .62).map(v => v * (1 - d * .22)); b = foam ? [238, 246, 244] : SEA_BLUE.map(v => v * k); }
    else if (e === BEACH) { const k = .94 + b4 * .1 + (grain ? .05 : 0); a = P.dead.map(v => v * 1.14 * k); b = sand.map(v => v * k); }
    else if (e === ROCK) { // Weathered stone in faceted patches, moss creeping up its foot, snow or crystal on the highest peaks.
      const h = d + (b4 - .4) * .35, k = .76 + b4 * .2 + (grain ? .07 : 0), stone = mixTo([138, 130, 122], P.dead, .3);
      a = mixTo(P.crack, P.dead, Math.min(1, .3 + h * .6)).map(v => v * k);
      b = h < .2 ? mixTo(stone, P.grass, .45).map(v => v * k) : h > .84 && P.peak ? P.peak.map(v => v * (.9 + b4 * .1)) : stone.map(v => v * k * (h > .66 ? 1.08 : 1));
    }
    else { const k = .95 + b4 * .12; a = P.crack.map(v => v * 1.12 * k); b = mixTo(P.soil, sand, .55).map(v => v * k); }
    t[i] = pack(a); t[i + 1] = pack(b);
  }
  if (P.road) for (let r = 1; r < 5; r++) for (let rim = 0; rim < 2; rim++) for (let pat = 0; pat < 2; pat++) for (let kq = 0; kq < 4; kq++) for (let grain = 0; grain < 2; grain++) {
    const k = .92 + kq * .05 + (grain ? .12 : 0), i = ((ROAD - EDGE) | r << 8 | rim << 7 | pat << 6 | kq << 4 | grain << 3) * 3;
    let a, b, c;
    if (r === 2 || r === 4) { const gap = pat ? .62 : 1; a = [104 * gap, 96 * gap, 88 * gap]; b = c = [142 * gap, 100 * gap, 62 * gap]; }
    else if (r === 3) { a = (pat ? P.crack : P.dead).map(v => v * k); b = (pat ? P.soil : mixTo(P.soil, P.road, .4)).map(v => v * k); c = (pat ? P.grass : P.soil).map(v => v * k); }
    else { const m = rim ? .8 : 1; a = mixTo(P.dead, P.crack, .4).map(v => v * k * m); b = P.road.map(v => v * k * m); c = b; }
    t[i] = pack(a); t[i + 1] = pack(b.map(v => v * .86)); t[i + 2] = pack(c);
  }
  return t;
}

export async function createLand(w, progress = async () => {}) {
  const N = TW * TH, code = new Uint16Array(N), jitter = new Int8Array(N);
  // Slow, smooth noise is sampled on a coarse grid and blended; only grain, mottling and cracks are per texel.
  const G = 4, gw = LW / G + 2, gh = LH / G + 2, shadeG = new Float32Array(gw * gh), blotchG = new Float32Array(gw * gh), jitG = new Float32Array(gw * gh), cw2 = LW / 2 + 2, crackG = new Float32Array(cw2 * (LH / 2 + 2));
  for (let id = 0; id < LANDS.length; id++) {
    await progress(id);
    const s = 1, ox = LANDS[id].col * LW, oy = LANDS[id].row * LH; // One seed and continent-wide coordinates, so the grain never jumps at a border.
    for (let gy = 0, k = 0; gy < gh; gy++) for (let gx = 0; gx < gw; gx++, k++) {
      const x = ox + gx * G, y = oy + gy * G;
      shadeG[k] = hillShade(x, y); // Rolling hills, lit from the upper left.
      blotchG[k] = fbm(x / 14, y / 14, s + 210); jitG[k] = fbm(x / 7, y / 7, s + 230);
    }
    for (let gy = 0, k = 0; gy < LH / 2 + 2; gy++) for (let gx = 0; gx < cw2; gx++, k++) crackG[k] = noise((ox + gx * 2) / 11, (oy + gy * 2) / 11, s + 240) - noise((ox + gx * 2) / 11, (oy + gy * 2) / 11, s + 241);
    for (let y = 0; y < LH; y++) {
      const fy = y / G, iy = Math.floor(fy), ty = fy - iy, icy = y >> 1, tcy = (y & 1) / 2;
      for (let x = 0, i = (oy + y) * TW + ox; x < LW; x++, i++) {
        const ix = x >> 2, tx = (x & 3) / 4, k = iy * gw + ix;
        const lerp = a => (a[k] * (1 - tx) + a[k + 1] * tx) * (1 - ty) + (a[k + gw] * (1 - tx) + a[k + gw + 1] * tx) * ty;
        const X = ox + x, Y = oy + y, grain = hash(X, Y, s + 3);
        jitter[i] = Math.max(-127, Math.min(127, Math.round(((lerp(jitG) - .5) * 1.1 + (grain - .5) * .45) * 160)));
        const e = w.edge[i], r = w.road[i];
        if (e) {
          const d = w.edgeD[i] / 255, band = Math.min(3, Math.floor(noise(X / 5, Y / 5, s + 220) * 4)), foam = e === SEA && d < .12 && noise(X / 4, Y / 4, s + 250) > .5 ? 1 : 0, gr = grain > (e === ROCK ? .92 : .9) ? 1 : 0;
          code[i] = EDGE | (e - 1) << 12 | Math.round(d * 15) << 8 | band << 6 | foam << 5 | gr << 4;
          continue;
        }
        if (r && LANDS[id].road) {
          const rim = r === 1 && [[1, 0], [-1, 0], [0, 1], [0, -1]].some(([p, q]) => { const j = i + q * TW + p; return j >= 0 && j < N && !w.road[j]; }) ? 1 : 0;
          const pat = r === 2 ? (x % 5 === 0 ? 1 : 0) : r === 4 ? (y % 5 === 0 ? 1 : 0) : r === 3 ? (y % 5 < 2 ? 1 : 0) : 0;
          code[i] = ROAD | r << 8 | rim << 7 | pat << 6 | Math.min(3, Math.floor(noise(X / 4, Y / 4, s + 260) * 4)) << 4 | (grain > .95 ? 1 : 0) << 3;
          continue;
        }
        const kc = icy * cw2 + (x >> 1), tcx = (x & 1) / 2, crack = Math.abs((crackG[kc] * (1 - tcx) + crackG[kc + 1] * tcx) * (1 - tcy) + (crackG[kc + cw2] * (1 - tcx) + crackG[kc + cw2 + 1] * tcx) * tcy) < .026;
        const blotch = lerp(blotchG), shadeQ = Math.max(0, Math.min(31, Math.round((lerp(shadeG) - .78) / .44 * 31))), fine = Math.min(3, Math.floor(noise(X / 3.4, Y / 3.4, s + 220) * 4));
        const gcls = grain > .992 ? 4 : grain > .95 ? 3 : grain > .9 ? 2 : grain > .88 ? 1 : 0;
        code[i] = shadeQ | fine << 5 | Math.min(5, Math.floor(blotch * 6)) << 7 | gcls << 10 | (crack ? 1 : 0) << 13 | (blotch > .55 ? 1 : 0) << 14;
      }
    }
  }
  const ground = LANDS.map(groundTables), edges = LANDS.map(edgeTables);
  // Stream beds and ponds wait as sunken ravines until their water comes: a shadowed upper wall, a dark floor
  // with the odd pebble and a sunlit lower lip, lit from the upper left like the hills. They never grow grass;
  // on restored ground the bed turns to damp mud. Tables per land: [floor, upper wall, deep wall, lip, pebble].
  const bedOf = (base, k) => [base.map(v => v * .66 * k), base.map(v => v * .4 * k), base.map(v => v * .52 * k), base.map(v => Math.min(255, v * 1.02 * k + 8)), mixTo(base, [170, 162, 150], .5).map(v => v * k)].map(pack);
  const bedDry = LANDS.map(P => bedOf(mixTo(P.crack, P.dead, .25), 1)), bedMud = LANDS.map(P => bedOf(P.soil, 1.05));
  const bedPart = new Uint8Array(N); // 0 floor, 1 upper wall, 2 the row below it, 3 lower lip; set only on bed texels
  for (let i = 0; i < N; i++) {
    if (w.waterT[i] === 255) continue;
    const dry = j => j < 0 || j >= N || w.waterT[j] === 255;
    bedPart[i] = dry(i - TW) || dry(i - 1) ? 1 : dry(i - 2 * TW) || dry(i - 2) ? 2 : dry(i + TW) || dry(i + 1) ? 3 : 0;
  }
  const canvas = document.createElement('canvas');
  canvas.width = TW; canvas.height = TH;
  const g = canvas.getContext('2d'), image = g.createImageData(TW, TH), out = new Uint32Array(image.data.buffer);
  const dirty = new Uint8Array(COLS * ROWS);
  // Each glade's reach in chunks, so finishing one repaints only its own corner of the map.
  const boxes = w.count.map(() => [COLS, ROWS, 0, 0]);
  for (let i = 0; i < CW * CH; i++) { const b = boxes[w.zone[i]], x = (i % CW) * CELL / CHUNK | 0, y = Math.floor(i / CW) * CELL / CHUNK | 0; if (x < b[0]) b[0] = x; if (y < b[1]) b[1] = y; if (x > b[2]) b[2] = x; if (y > b[3]) b[3] = y; }
  let view = null, zonesState = null, cursor = 0;

  // Roads belong to their village's land; everything else takes the colours of the land whose ground it is.
  function colourAt(i, stage, L) {
    const c = code[i], B = w.biome[i];
    if (c >= ROAD) return edges[L][(c - EDGE) * 3 + (stage === DEAD ? 0 : stage === SOIL || stage === RIM_A ? 1 : 2)];
    if (w.waterT[i] < 255) { const p = bedPart[i], dry = stage === DEAD, t = (dry ? bedDry : bedMud)[B]; return p && (dry || p !== 4) ? t[p] : dry && (c >> 10 & 7) >= 3 ? t[4] : t[0]; } // a woken bed is clean, dark earth: no pebbles
    return ground[B][stage * STAGE + c];
  }
  function paint(cx, cy, dead = false, target = out) {
    const x0 = cx * CHUNK, y0 = cy * CHUNK, f = view, L = landAtTexel(x0, y0);
    for (let y = y0; y < y0 + CHUNK; y++) {
      const fy = Math.min(CH - 1.001, Math.max(0, y / CELL - .5)), iy = Math.floor(fy), ty = fy - iy;
      for (let x = x0, i = y * TW + x0; x < x0 + CHUNK; x++, i++) {
        const c = code[i];
        if (c >= EDGE && c < ROAD) {
          let col = edges[w.biome[i]][(c - EDGE) * 3 + (!dead && zonesState[w.zone[(y >> 2) * CW + (x >> 2)]].done ? 1 : 0)];
          // Stone is lit from the upper left: its lower rim falls into shadow and its upper rim catches the light.
          if ((c >> 12 & 3) === ROCK - 1) { const rock = j => (code[j] >> 12 & 3) === ROCK - 1 && code[j] >= EDGE && code[j] < ROAD, m = !rock(i + TW) ? .68 : !rock(i - TW) || !rock(i - 1) ? 1.14 : !rock(i + 1) ? .86 : 1; if (m !== 1) col = packed((col & 255) * m, (col >> 8 & 255) * m, (col >> 16 & 255) * m); }
          target[i] = col; continue;
        }
        if (dead) { target[i] = colourAt(i, DEAD, L); continue; }
        const t = w.waterT[i];
        if (t < 255 && zonesState[w.waterZ[i]].water * 254 >= t) {
          const shore = w.waterT[i + 1] === 255 || w.waterT[i - 1] === 255 || w.waterT[i + TW] === 255 || w.waterT[i - TW] === 255, fine = c < EDGE ? (c >> 5 & 3) * 3 >> 2 : 1;
          const wk = (shore ? .78 : .92 + fine * .07) * (t >= 178 ? 1 - (1 - t / 254) * .6 : 1);
          const P = LANDS[w.biome[i]]; target[i] = packed(P.water[0] * wk, P.water[1] * wk, P.water[2] * wk); continue;
        }
        const fx = Math.min(CW - 1.001, Math.max(0, x / CELL - .5)), ix = Math.floor(fx), tx = fx - ix, n = iy * CW + ix;
        // Next to an edge there is nothing to blend with, so the ground takes its restored neighbours' value.
        const raw = w.near[n] ? Math.max(w.blocked[n] ? 0 : f[n], w.blocked[n + 1] ? 0 : f[n + 1], w.blocked[n + CW] ? 0 : f[n + CW], w.blocked[n + CW + 1] ? 0 : f[n + CW + 1])
          : (f[n] * (1 - tx) + f[n + 1] * tx) * (1 - ty) + (f[n + CW] * (1 - tx) + f[n + CW + 1] * tx) * ty;
        if (raw <= .002) { target[i] = colourAt(i, DEAD, L); continue; }
        const v = raw + jitter[i] / 160 * .2 * Math.min(1, raw * 6);
        target[i] = colourAt(i, v < SOIL_AT ? DEAD : v < SOIL_AT + .03 ? RIM_A : v < GRASS_AT ? SOIL : v < GRASS_AT + .025 ? RIM_B : v < LUSH_AT ? GRASS : LUSH, L);
      }
    }
    if (target === out) g.putImageData(image, 0, 0, x0, y0, CHUNK, CHUNK);
  }
  const mark = (a, b) => { if (a >= 0 && b >= 0 && a < COLS && b < ROWS) dirty[b * COLS + a] = 1; };
  let thenC = null;
  return {
    canvas,
    setSource(field, zones) { view = field; zonesState = zones; dirty.fill(1); },
    setField(field) { view = field; },
    markCell(i) {
      const x = i % CW * CELL, y = Math.floor(i / CW) * CELL, a = Math.floor(x / CHUNK), b = Math.floor(y / CHUNK);
      dirty[b * COLS + a] = 1;
      const a1 = Math.floor((x - 6) / CHUNK), a2 = Math.floor((x + 6) / CHUNK), b1 = Math.floor((y - 6) / CHUNK), b2 = Math.floor((y + 6) / CHUNK);
      if (a1 !== a || a2 !== a || b1 !== b || b2 !== b) { mark(a1, b1); mark(a2, b1); mark(a1, b2); mark(a2, b2); }
    },
    markZone(z) { const [a0, b0, a1, b1] = boxes[z]; for (let b = b0; b <= b1; b++) for (let a = a0; a <= a1; a++) dirty[b * COLS + a] = 1; },
    markWater(zone) { for (const [x, y] of w.streams[zone]) if (Math.round(x) % 12 < 2 || Math.round(y) % 12 < 2) mark(Math.floor(x / CHUNK), Math.floor(y / CHUNK)); const p = w.ponds[zone]; for (let b = Math.floor((p.y - p.r - 6) / CHUNK); b <= (p.y + p.r + 6) / CHUNK; b++) for (let a = Math.floor((p.x - p.r - 6) / CHUNK); a <= (p.x + p.r + 6) / CHUNK; a++) mark(a, b); },
    markAll() { dirty.fill(1); },
    // Paints for a few milliseconds at most: what is on screen first, then the rest where it left off.
    flush(ms = 3, box = null) {
      const end = performance.now() + ms;
      let n = 0;
      if (box) {
        const a0 = Math.max(0, Math.floor(box[0] / CHUNK)), b0 = Math.max(0, Math.floor(box[1] / CHUNK)), a1 = Math.min(COLS - 1, Math.floor(box[2] / CHUNK)), b1 = Math.min(ROWS - 1, Math.floor(box[3] / CHUNK));
        for (let b = b0; b <= b1; b++) for (let a = a0; a <= a1; a++) { const i = b * COLS + a; if (!dirty[i]) continue; dirty[i] = 0; paint(a, b); if (++n % 6 === 0 && performance.now() > end) return; }
      }
      for (let k = 0; k < dirty.length; k++) { const i = cursor; cursor = (cursor + 1) % dirty.length; if (!dirty[i]) continue; dirty[i] = 0; paint(i % COLS, Math.floor(i / COLS)); if (++n % 6 === 0 && performance.now() > end) return; }
    },
    flushAll() { this.flush(Infinity); },
    dayOne() { // The continent as it was on day one, painted the first time it is asked for.
      if (thenC) return thenC;
      thenC = document.createElement('canvas'); thenC.width = TW; thenC.height = TH;
      const cg = thenC.getContext('2d'), im = cg.createImageData(TW, TH), px = new Uint32Array(im.data.buffer);
      for (let b = 0; b < ROWS; b++) for (let a = 0; a < COLS; a++) paint(a, b, true, px);
      cg.putImageData(im, 0, 0); return thenC;
    },
  };
}
