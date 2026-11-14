// The valley: deterministic geography shared by the simulation and the renderer.
// Texels are the land's pixels; cells are the 4x4 texel blocks that hold restoration.
export const LW = 960, LH = 640, CELL = 4, LCW = LW / CELL, LCH = LH / CELL, LCN = LCW * LCH;
// The whole continent: the nine lands side by side.
export const COLS = 3, ROWS = 4, TW = LW * COLS, TH = LH * ROWS, CW = TW / CELL, CH = TH / CELL, CN = CW * CH;

const grid = [
  ['Hearthfield', 0, 2, -1], ['Clover Downs', 1, 2, 0], ['Willow Draw', 0, 1, 0],
  ['Pebble Hollow', 1, 1, 1], ['Honey Meadow', 2, 2, 1], ['Dry Creek Bend', 0, 0, 2],
  ['Birch Knoll', 2, 1, 3], ['Daisy Vale', 1, 0, 3], ["Mother's Rise", 2, 0, 6],
];
const GLADES = grid.map(([name, col, row, parent], id) => ({
  id, name, col, row, parent, px: 160 + col * 320, py: 110 + row * 210,
}));
GLADES.forEach(z => { z.adj = GLADES.filter(o => Math.abs(o.col - z.col) + Math.abs(o.row - z.row) === 1).map(o => o.id); });
export const FINALE = 8;
// Pebble Hollow, in the middle of Hollow Vale, holds a great lake where ducks come to live.
export const LAKE = { land: 0, glade: 3, r: 92, squash: 1.5 };

export const KIND = { deadTree: 0, tree: 1, blossom: 2, boulder: 3, mossy: 4, bramble: 5, bush: 6, flowering: 7, column: 8, ruin: 9, shrineDead: 10, shrine: 11, fern: 12, seed: 13, dew: 14, star: 15 };

export function hash(x, y, seed = 0) {
  let n = Math.imul(x + seed * 131, 374761393) ^ Math.imul(y - seed * 57, 668265263);
  n = Math.imul(n ^ (n >>> 13), 1274126177);
  return ((n ^ (n >>> 16)) >>> 0) / 4294967295;
}
const smooth = t => t * t * (3 - 2 * t);
export function noise(x, y, seed = 0) {
  const ix = Math.floor(x), iy = Math.floor(y), u = smooth(x - ix), v = smooth(y - iy);
  return (hash(ix, iy, seed) * (1 - u) + hash(ix + 1, iy, seed) * u) * (1 - v)
    + (hash(ix, iy + 1, seed) * (1 - u) + hash(ix + 1, iy + 1, seed) * u) * v;
}
// Rolling hills across the continent: broad rises with smaller knolls on them, lit from the upper left. Returns
// how bright the ground is at (x, y) in texels: above 1 on slopes facing the light and on tops, below 1 in shade.
const hill = (a, b) => fbm(a / 170, b / 170, 203) * .62 + fbm(a / 58, b / 58, 201) * .38;
export function hillShade(x, y) {
  const e = hill(x, y), ex = hill(x + 4, y), ey = hill(x, y + 4);
  return 1 + Math.max(-.19, Math.min(.19, (e - ex) * 26 + (e - ey) * 34)) + (e - .5) * .2;
}
export function fbm(x, y, seed = 0) {
  return noise(x, y, seed) * .55 + noise(x * 2.1, y * 2.1, seed + 1) * .3 + noise(x * 4.3, y * 4.3, seed + 2) * .15;
}

// The continent is 3x3 maps. Coasts and ridges come from continent-wide coordinates, so neighbours line up.
// The coast is a lobed, warped blob, so bays and headlands cut through the outer maps. Sampled coarsely since it is smooth.
const GW = LW * 3, GH = LH * 3, COAST_STEP = 16, COAST_W = GW / COAST_STEP + 2, COAST_H = GH / COAST_STEP + 2;
let coastGrid = null;
function buildCoast() {
  coastGrid = new Float32Array(COAST_W * COAST_H);
  for (let b = 0, i = 0; b < COAST_H; b++) for (let a = 0; a < COAST_W; a++, i++) {
    const gx = a * COAST_STEP, gy = b * COAST_STEP;
    const u = (gx - GW / 2) / (GW / 2) + (fbm(gx / 520, gy / 520, 81) - .5) * .26, v0 = (gy - GH / 2) / (GH / 2), v = v0 * (v0 > 0 ? 1.1 : 1) + (fbm(gx / 520, gy / 520, 83) - .5) * .26;
    const rho = Math.pow(Math.abs(u) ** 2.5 + Math.abs(v) ** 2.5, 1 / 2.5), th = Math.atan2(v, u);
    coastGrid[i] = (.93 + .05 * Math.sin(3 * th + 2.6) + .05 * Math.sin(5 * th + .4) + .025 * Math.sin(8 * th + 4) - rho + (fbm(gx / 230, gy / 230, 87) - .5) * .13) * 1000;
  }
}
export function coastInset(gx, gy) { // Roughly how many texels inland this point is.
  if (!coastGrid) buildCoast();
  const fx = Math.max(0, Math.min(COAST_W - 1.001, gx / COAST_STEP)), fy = Math.max(0, Math.min(COAST_H - 1.001, gy / COAST_STEP)), a = Math.floor(fx), b = Math.floor(fy), u = fx - a, v = fy - b, i = b * COAST_W + a;
  return (coastGrid[i] * (1 - u) + coastGrid[i + 1] * u) * (1 - v) + (coastGrid[i + COAST_W] * (1 - u) + coastGrid[i + COAST_W + 1] * u) * v;
}
export const SEA = 1, BEACH = 2, ROCK = 3, PATH = 4;
export let edgeDepth = 0;
// The island in the south: one land, Sporewood to the west and Coral Reach to the east, across a channel of sea.
export const ISLAND = { x: LW * 2, y: LH * 3 + 300, rx: 640, ry: 245 };
export function terrain(col, row, x, y, pad = 0) {
  const gx = col * LW + x, gy = row * LH + y;
  const inset = row >= 3 ? islandInset(gx, gy) : coastInset(gx, gy);
  if (inset < 100) {
    const shore = 44 + (fbm(gx / 85, gy / 85, 71) - .5) * 70 + (fbm(gx / 24, gy / 24, 72) - .5) * 16;
    if (inset < shore - pad) { edgeDepth = Math.min(1, (shore - inset) / 40); return SEA; }
    if (inset < shore + 9 - pad) { edgeDepth = 0; return BEACH; }
  }
  return 0; // Open land: no rocky outcrops anywhere.
}
function islandInset(gx, gy) {
  const u = (gx - ISLAND.x) / ISLAND.rx, v = (gy - ISLAND.y) / ISLAND.ry, a = Math.atan2(v, u);
  return (1 + .06 * Math.sin(3 * a + 1) + .05 * Math.sin(5 * a + 2.2) - Math.hypot(u, v)) * 260 + (fbm(gx / 120, gy / 120, 85) - .5) * 60;
}

// Each map dresses the same glade tree in its own names, opening on the side nearest the heartland.
function dressZones(mapId) {
  const map = LANDS[mapId], flipX = map.col === 0, flipY = map.row === 2;
  for (const z of GLADES) { const c = flipX ? 2 - z.col : z.col, r = flipY ? 2 - z.row : z.row; z.name = map.glades[z.id]; z.px = 160 + c * 320; z.py = 110 + r * 210; }
  if (mapId) fitGlades(map);
}
// Coastal maps squeeze their nine glades onto the ground that is actually there.
function fitGlades(map) {
  const ground = [];
  let x0 = LW, x1 = 0, y0 = LH, y1 = 0;
  for (let y = 8; y < LH; y += 16) for (let x = 8; x < LW; x += 16) if (!terrain(map.col, map.row, x, y)) { ground.push(x, y); x0 = Math.min(x0, x); x1 = Math.max(x1, x); y0 = Math.min(y0, y); y1 = Math.max(y1, y); }
  for (const z of GLADES) { z.px = x0 + z.px / LW * (x1 - x0); z.py = y0 + z.py / LH * (y1 - y0); }
  for (let k = 0; k < 14; k++) { // Each glade drifts to the middle of the ground nearest it, which evens out their sizes.
    const sum = GLADES.map(() => [0, 0, 0]);
    for (let g = 0; g < ground.length; g += 2) { let best = 0, bd = Infinity; for (const z of GLADES) { const d = (ground[g] - z.px) ** 2 + (ground[g + 1] - z.py) ** 2; if (d < bd) { bd = d; best = z.id; } } sum[best][0] += ground[g]; sum[best][1] += ground[g + 1]; sum[best][2]++; }
    let big = 0; sum.forEach((q, n) => { if (q[2] > sum[big][2]) big = n; });
    for (const z of GLADES) if (sum[z.id][2]) { z.px = sum[z.id][0] / sum[z.id][2]; z.py = sum[z.id][1] / sum[z.id][2]; } else { z.px = GLADES[big].px + 40 + z.id * 9; z.py = GLADES[big].py + 30 - z.id * 7; } // A glade stranded in the sea takes half of the biggest one.
  }
}

export function makeLand(seed = 1, mapId = 0) {
  dressZones(mapId);
  const map = LANDS[mapId];
  const edge = new Uint8Array(LW * LH), edgeD = new Float32Array(LW * LH), blocked = new Uint8Array(LCN), near = new Uint8Array(LCN);
  for (let y = 0, i = 0; y < LH; y++) for (let x = 0; x < LW; x++, i++) { const e = terrain(map.col, map.row, x, y); if (e) { edge[i] = e; edgeD[i] = edgeDepth; } }
  // No stray specks: a scrap of land or sand too small to be an island sinks, and a puddle of sea cut off inside the
  // land fills in, so the coast is one clean line.
  { const seen = new Uint8Array(LW * LH), stack = new Int32Array(LW * LH);
    for (let s0 = 0; s0 < LW * LH; s0++) {
      if (seen[s0]) continue;
      const wet = edge[s0] === SEA; let n = 0, sp = 0, border = false; stack[sp++] = s0; seen[s0] = 1; const part = [];
      while (sp) { const i = stack[--sp]; if (n < 2600) part.push(i); n++; const x = i % LW, y = (i / LW) | 0; if (x === 0 || y === 0 || x === LW - 1 || y === LH - 1) border = true;
        if (x > 0 && !seen[i - 1] && (edge[i - 1] === SEA) === wet) { seen[i - 1] = 1; stack[sp++] = i - 1; }
        if (x < LW - 1 && !seen[i + 1] && (edge[i + 1] === SEA) === wet) { seen[i + 1] = 1; stack[sp++] = i + 1; }
        if (y > 0 && !seen[i - LW] && (edge[i - LW] === SEA) === wet) { seen[i - LW] = 1; stack[sp++] = i - LW; }
        if (y < LH - 1 && !seen[i + LW] && (edge[i + LW] === SEA) === wet) { seen[i + LW] = 1; stack[sp++] = i + LW; } }
      if (!wet && n < 2500 && !border) for (const i of part) { edge[i] = SEA; edgeD[i] = .3; }
      if (wet && n < 900 && !border) for (const i of part) { edge[i] = BEACH; edgeD[i] = 0; }
    }
  }
  // A cell is off limits only if it sits well inside the edge, so restored ground always reaches the shore.
  for (let y = 0, i = 0; y < LCH; y++) for (let x = 0; x < LCW; x++, i++) if (terrain(map.col, map.row, x * CELL + 2, y * CELL + 2, 3) || edge[(y * CELL + 2) * LW + x * CELL + 2] === SEA) blocked[i] = 1;
  for (let y = 0, i = 0; y < LCH; y++) for (let x = 0; x < LCW; x++, i++) for (let b = -1; b < 3 && !near[i]; b++) for (let a = -1; a < 3; a++) { const xx = x + a, yy = y + b; if (xx >= 0 && yy >= 0 && xx < LCW && yy < LCH && blocked[yy * LCW + xx]) { near[i] = 1; break; } }
  const blockedAt = (x, y, r = 0) => { for (const [a, b] of [[0, 0], [r, 0], [-r, 0], [0, r], [0, -r]]) { const xx = Math.floor((x + a) / CELL), yy = Math.floor((y + b) / CELL); if (xx < 0 || yy < 0 || xx >= LCW || yy >= LCH || blocked[yy * LCW + xx]) return true; } return false; };
  const zone = new Uint8Array(LCN), cellsOf = GLADES.map(() => []);
  for (let y = 0; y < LCH; y++) for (let x = 0; x < LCW; x++) {
    const tx = x * CELL + 2, ty = y * CELL + 2;
    const wx = tx + (fbm(tx / 70, ty / 70, seed + 11) - .5) * 85 + (fbm(tx / 19, ty / 19, seed + 13) - .5) * 46, wy = ty + (fbm(tx / 70, ty / 70, seed + 29) - .5) * 85 + (fbm(tx / 19, ty / 19, seed + 31) - .5) * 46;
    let best = 0, bd = Infinity;
    for (const z of GLADES) { const d = (wx - z.px) ** 2 + (wy - z.py) ** 2; if (d < bd) { bd = d; best = z.id; } }
    zone[y * LCW + x] = best;
    if (!blocked[y * LCW + x]) cellsOf[best].push(y * LCW + x);
  }

  // Each glade has a heart near its middle, where its life gathers. The only standing water of its own here is the
  // great lake of Hollow Vale; the rivers, the few small ponds and the one path come from the continent's plan
  // (WATER), and this land lays down whatever part of them falls inside it.
  const ponds = GLADES.map(z => ({ x: z.px + (hash(z.id, 3, seed) - .5) * 70, y: z.py + (hash(z.id, 7, seed) - .5) * 50, r: 0 }));
  if (mapId === LAKE.land) { const p = ponds[LAKE.glade], z = GLADES[LAKE.glade]; p.x = z.px; p.y = z.py; p.r = LAKE.r; p.lake = true; }
  const waterT = new Float32Array(LW * LH).fill(-1), waterZ = new Uint8Array(LW * LH);
  const ox = map.col * LW, oy = map.row * LH, inCell = (x, y, m) => x > ox - m && x < ox + LW + m && y > oy - m && y < oy + LH + m;
  const disc = (x, y, r, f) => { for (let yy = Math.floor(y - r); yy <= y + r; yy++) for (let xx = Math.floor(x - r); xx <= x + r; xx++) if (xx >= 0 && yy >= 0 && xx < LW && yy < LH && (xx - x) ** 2 + (yy - y) ** 2 <= r * r) f(yy * LW + xx); };
  // Rivers cut their own way across the beach and out into the sea, so they never stop short at the sand.
  // (Their depth along the bed is set by the continent once it knows which glade owns which stretch.)
  for (const river of WATER.rivers) for (const [gx, gy, w] of river) {
    if (!inCell(gx, gy, w + 4)) continue;
    const x = gx - ox, y = gy - oy;
    disc(x, y, w + 3, i => { if (edge[i] === BEACH) edge[i] = 0; });
    disc(x, y, w, i => { if (!edge[i] && waterT[i] < 0) waterT[i] = .35; });
  }
  const pool = (p, x, y, id) => { // a pond: an oval with a wandering shore (the lake is broad and flat)
    const R = p.r + 4, sq = p.lake ? LAKE.squash : 1;
    for (let yy = Math.floor(y - R); yy <= y + R; yy++) for (let xx = Math.floor(x - R); xx <= x + R; xx++) {
      if (xx < 0 || yy < 0 || xx >= LW || yy >= LH) continue;
      const a = Math.atan2(yy - y, xx - x), d = Math.hypot(xx - x, (yy - y) * sq);
      const rim = p.r * (p.lake ? .84 + noise(a * 2.4 + 9, id, seed + 77) * .2 + (fbm(xx / 30, yy / 30, seed + 79) - .5) * .16 : .82 + noise(a * 1.6 + 9, id, seed + 77) * .36);
      if (d < rim && !edge[yy * LW + xx]) { const i = yy * LW + xx; waterT[i] = .7 + .3 * d / rim; waterZ[i] = id; }
    }
  };
  ponds.forEach((p, id) => { if (p.r) pool(p, p.x, p.y, id); });
  WATER.ponds.forEach((p, n) => { if (inCell(p.x, p.y, p.r + 6)) pool(p, p.x - ox, p.y - oy, 20 + n); });
  const nearWater = (x, y, r) => {
    for (let k = 0; k < 10; k++) {
      const a = k * .628, xx = Math.round(x + Math.cos(a) * r), yy = Math.round(y + Math.sin(a) * r);
      if (xx >= 0 && yy >= 0 && xx < LW && yy < LH && waterT[yy * LW + xx] >= 0) return true;
    }
    return xx0(x, y);
  };
  const xx0 = (x, y) => { const i = Math.round(y) * LW + Math.round(x); return waterT[i] >= 0; };
  // A plant's blades rise a few texels and spread a few more, so it keeps that far back from a stream bed.
  const bankClear = (x, y) => { for (let yy = Math.round(y) - 7; yy <= Math.round(y) + 1; yy++) for (let xx = Math.round(x) - 4; xx <= Math.round(x) + 4; xx++) if (xx >= 0 && yy >= 0 && xx < LW && yy < LH && waterT[yy * LW + xx] >= 0) return false; return true; };

  // Dead things to bring back: each has one withered sprite and one living sprite.
  const objects = [];
  const place = (z, dead, live, x, y, size) => objects.push({ id: objects.length, zone: z, dead, live, x: x / CELL, y: y / CELL, size, hp: size > 40 ? 3 : size > 22 ? 1.5 : .8 });
  const clear = (x, y, gap) => !objects.some(o => (o.x * CELL - x) ** 2 + (o.y * CELL - y) ** 2 < gap * gap);
  // The one path: a narrow dirt track (1), with plank bridges (2 east-west, 4 north-south) where it crosses water.
  const road = new Uint8Array(LW * LH);
  for (let k = 0; k < WATER.path.length; k++) {
    const [gx, gy, w] = WATER.path[k]; if (!inCell(gx, gy, w + 2)) continue;
    const [px, py] = WATER.path[Math.max(0, k - 2)], plank = Math.abs(gx - px) >= Math.abs(gy - py) ? 2 : 4;
    disc(gx - ox, gy - oy, w, i => { if (edge[i]) return; if (waterT[i] >= 0) { waterT[i] = -1; road[i] = plank; } else if (road[i] !== 2 && road[i] !== 4) road[i] ||= 1; });
  }
  const scan = (test, x, y, w, up, down) => { for (let yy = Math.floor(y - up); yy <= y + down; yy += 3) for (let xx = Math.floor(x - w); xx <= x + w; xx += 3) if (xx >= 0 && yy >= 0 && xx < LW && yy < LH && test(yy * LW + xx)) return true; return false; };
  const roadNear = (...box) => scan(i => road[i], ...box);
  // Far less on the land than there used to be: a few trees, a stone or two and some brambles per glade, so the
  // meadows read as open country. Hollow Vale keeps its great blossom tree on Mother's Rise.
  for (const z of GLADES) {
    const pond = ponds[z.id];
    if (mapId === 0 && z.id === FINALE) { const side = blockedAt(pond.x + 60, pond.y + 6, 24) ? -1 : 1; place(z.id, KIND.deadTree, KIND.blossom, pond.x + side * 60, pond.y + 6, 110); }
    const list = cellsOf[z.id];
    const quota = [[KIND.deadTree, hash(z.id, 21, seed) > .5 ? KIND.blossom : KIND.tree, 30, 3], [KIND.boulder, KIND.mossy, 16, 1], [KIND.bramble, KIND.flowering, 14, 4]];
    let tries = 0;
    for (const [dead, live, size, full] of quota) for (let n = 0, count = full; n < count && tries < 900 && list.length;) {
      tries++;
      const c = list[Math.floor(hash(tries, z.id * 13 + dead, seed + 3) * list.length)], x = c % LCW * CELL + 2, y = Math.floor(c / LCW) * CELL + 2;
      if (x < 20 || y < 34 || x > LW - 20 || y > LH - 10 || blockedAt(x, y, 6) || nearWater(x, y, 10) || !clear(x, y, 40) || roadNear(x, y, 9, 4, 4)) continue;
      place(z.id, dead, dead === KIND.deadTree && n % 3 === 2 ? KIND.tree : live, x, y, size + hash(tries, 5, seed) * 6);
      n++;
    }
  }

  // Flora appear when their cell passes a threshold. They are stored per chunk for culling.
  const FC = 64, floraCols = Math.ceil(LW / FC), floraRows = Math.ceil(LH / FC), flora = Array.from({ length: floraCols * floraRows }, () => []);
  for (let y = 0; y < LCH; y++) for (let x = 0; x < LCW; x++) for (let k = 0; k < 2; k++) {
    let r = hash(x * 3 + k, y * 5 - k, seed + 101); const r2 = hash(x + k * 9, y + k * 3, seed + 107);
    const tx = (x + hash(x, y + k, seed + 103)) * CELL, ty = (y + hash(x + k, y, seed + 105)) * CELL;
    // A blade whose cell is just inside rock or shore still grows if its own spot is ground, taking its growth
    // from an open neighbour, so the meadow runs right up to the stone instead of stopping a cell short.
    let cell = y * LCW + x;
    if (blocked[cell]) { cell = -1; for (const [a, b] of [[1, 0], [-1, 0], [0, 1], [0, -1], [1, 1], [-1, -1], [1, -1], [-1, 1]]) { const xx = x + a, yy = y + b; if (xx >= 0 && yy >= 0 && xx < LCW && yy < LCH && !blocked[yy * LCW + xx]) { cell = yy * LCW + xx; break; } } }
    if (cell < 0 || edge[Math.min(LH - 1, Math.floor(ty)) * LW + Math.min(LW - 1, Math.floor(tx))] || road[Math.min(LH - 1, Math.floor(ty)) * LW + Math.min(LW - 1, Math.floor(tx))] || !bankClear(tx, ty)) continue;
    if (map.flora < 1 && hash(x + k * 13, y - k * 17, seed + 113) > map.flora) continue; // sparse on snow and dry plains
    // Tall grass grows in broad, ragged patches; between them lie open lawns of short green turf, with only
    // the odd tuft or flower. A patch thins out over a few texels at its edge rather than stopping dead.
    // And tall grass only really takes hold in a few broad grassy stretches of each land; elsewhere the ground is
    // open lawn, and where wildflowers drift the grass gives way to them, so the colourful places stay open.
    const flowery = fbm(x / 16, y / 16, seed + 131) > .56;
    const wild = fbm(tx / 140, ty / 140, seed + 151), grassy = wild < .54 ? 0 : wild < .6 ? (wild - .54) / .06 : 1;
    const patch = fbm(tx / 42, ty / 42, seed + 141) * .72 + fbm(tx / 11, ty / 11, seed + 143) * .28;
    let lawn = Math.max(patch < .44 ? 1 : patch < .51 ? (.51 - patch) / .07 : 0, 1 - grassy);
    if (flowery) lawn = Math.max(lawn, .85);
    if (lawn && hash(x + k * 5, y - k * 7, seed + 109) < lawn * (flowery ? .62 : .97)) continue;
    // A plant left standing in a flowery lawn is nearly always a flower.
    if (flowery && lawn > .5 && r < .9) r = .66 + r / .9 * .24;
    let kind, thr;
    if (r < .3) { kind = 0; thr = .33 + r2 * .12; }        // short tuft
    else if (r < .66) { kind = 1; thr = .46 + r2 * .12; }   // tall grass
    else if (r < .9) { // Wildflowers only in drifts, the way they grow in a real meadow; between drifts it is grass.
      if (flowery) { kind = 2 + Math.floor(fbm(x / 13, y / 13, seed + 121) * 7) % 5; thr = .7 + r2 * .28; }
      else if (r < .8) { kind = 1; thr = .46 + r2 * .12; } else { kind = 0; thr = .33 + r2 * .12; }
    }
    else if (r < .935) { kind = 7; thr = .8 + r2 * .18; }  // fern
    else continue;
    flora[Math.floor(ty / FC) * floraCols + Math.floor(tx / FC)].push({ x: tx, y: ty, cell, kind, thr, phase: r2 });
  }
  for (const list of flora) list.sort((a, b) => a.y - b.y);

  const order = cellsOf.map((list, z) => {
    const p = ponds[z];
    return Uint32Array.from(list.map(i => [i, Math.hypot(i % LCW * CELL - p.x, Math.floor(i / LCW) * CELL - p.y) + hash(i, 1, seed) * 26]).sort((a, b) => a[1] - b[1]).map(e => e[0]));
  });
  return { seed, mapId, road, edge, edgeD, blocked, near, pend: new Float32Array(LCN), active: [], zone, cellsOf, order, ponds, streams: GLADES.map(() => []), waterT, waterZ, objects, flora, floraCols, floraRows, FC, count: cellsOf.map(l => l.length), dirty: () => {} };
}

// How each region looks: its ground, grass, water and flowers.
const LOOK = {
  hollow: { dead: [132, 121, 106], crack: [86, 76, 66], soil: [78, 58, 44], grass: [88, 138, 68], lush: [116, 160, 76], water: [66, 150, 182], flowers: ['#fff4f0', '#ffd34d', '#ff8fb1', '#b890ff', '#ff9d5c'], mist: [214, 208, 192], road: [150, 118, 84] },
  // Each region's grass takes its own colour, the same as its restored ground: dry gold drylands in Ember Basin,
  // pink in Coral Reach, violet in Sporewood, icy blue in Glimmerdeep.
  ember: { flora: .5, dead: [92, 86, 88], crack: [48, 42, 46], soil: [70, 48, 44], grass: [184, 136, 62], lush: [214, 160, 66], water: [56, 170, 170], flowers: ['#ffe9b0', '#ff7a4d', '#ffc247', '#ff5f7e', '#fff4e0'], mist: [190, 180, 178] },
  // Frostmere lies under snow: pale frosted grass, white drifts and cold blue water.
  frost: { flora: .4, dead: [176, 182, 194], crack: [122, 130, 146], soil: [108, 104, 118], grass: [184, 206, 216], lush: [228, 238, 246], water: [96, 170, 222], flowers: ['#ffffff', '#d8ecff', '#b8e0ff', '#e8d8ff', '#ffffff'], mist: [232, 238, 246], peak: [246, 250, 255] },
  sun: { dead: [168, 150, 118], crack: [112, 94, 70], soil: [112, 82, 54], grass: [122, 172, 76], lush: [170, 196, 84], water: [52, 176, 190], flowers: ['#fff6d8', '#ff6f6f', '#ffb347', '#ff8fc8', '#7fd8d0'], mist: [232, 222, 196], sand: [240, 216, 160], road: [188, 156, 108] },
  mist: { dead: [104, 104, 92], crack: [62, 64, 56], soil: [52, 48, 40], grass: [72, 130, 96], lush: [96, 156, 118], water: [78, 142, 150], flowers: ['#e8fff0', '#b8f0d0', '#d8b8ff', '#fff2a8', '#88d8c8'], mist: [196, 210, 200] },
  coral: { dead: [150, 134, 136], crack: [98, 84, 92], soil: [98, 66, 80], grass: [206, 122, 146], lush: [236, 140, 160], water: [64, 196, 206], flowers: ['#fff0f4', '#ff7fa8', '#ffb09a', '#a0f0e0', '#ffe28a'], mist: [234, 212, 220], sand: [250, 214, 200] },
  spore: { dead: [106, 92, 104], crack: [64, 52, 66], soil: [60, 44, 58], grass: [116, 98, 166], lush: [132, 110, 180], water: [92, 130, 190], flowers: ['#f0e0ff', '#c890ff', '#ff90c8', '#90f0d0', '#ffd890'], mist: [204, 192, 214] },
  glimmer: { dead: [116, 116, 134], crack: [68, 68, 90], soil: [62, 56, 86], grass: [96, 158, 200], lush: [120, 190, 220], water: [110, 150, 240], flowers: ['#ffffff', '#b8e8ff', '#d0b0ff', '#90f0e0', '#ffc0f0'], mist: [212, 214, 236], peak: [214, 196, 255] },
};
// The map is a grid of land-sized cells, three across and four down. A region can cover more than one cell:
// Frostmere spans the north, Mistfen the west and Ember Basin the east. The bottom row is sea, with one island
// whose western half is Sporewood and eastern half Coral Reach. Ids 0 to 8 keep the cells older saves knew;
// `look` names the cell whose art and colours a cell shares (its region's first cell).
export const LANDS = [
  { name: 'Hollow Vale', col: 1, row: 1, ...LOOK.hollow, glades: ['Hearthfield', 'Clover Downs', 'Willow Draw', 'Pebble Hollow', 'Honey Meadow', 'Dry Creek Bend', 'Birch Knoll', 'Daisy Vale', "Mother's Rise"] },
  { name: 'Ember Basin', col: 2, row: 1, ...LOOK.ember, native: { label: 'A cinder fox', size: 24, speed: 9 }, glades: ['Ashfall Gate', 'Kiln Hollow', 'Smoulder Run', 'Red Terrace', 'Coalbloom', 'Charcoal Bend', 'Lantern Scarp', 'Sparkfield', 'The Warm Heart'] },
  { name: 'Frostmere', col: 1, row: 0, ...LOOK.frost, native: { label: 'A snow lynx', size: 26, speed: 8 }, glades: ['Thaw Gate', 'Rimewood', 'Icicle Draw', 'Hushed Fell', 'Silverbrook', 'Glass Bend', 'Pine Knoll', 'Winterbell', 'The First Melt'] },
  { name: 'Sunfall Coast', col: 1, row: 2, ...LOOK.sun, village: true, native: { label: 'A sun tortoise', size: 20, speed: 4 }, glades: ['Tidegate', 'Palm Hollow', 'Saltgrass', 'Shell Rise', 'Gull Rest', 'Driftwood Bend', 'Lighthouse Knoll', 'Hibiscus Vale', 'Sunfall Point'] },
  { name: 'Mistfen', col: 0, row: 1, ...LOOK.mist, native: { label: 'A reed otter', size: 20, speed: 8 }, glades: ['Reedgate', 'Sedge Hollow', 'Lily Draw', 'Heron Rest', 'Willow Sink', 'Peat Bend', 'Lantern Bog', 'Cattail Vale', 'The Still Eye'] },
  { name: 'Frostmere', col: 2, row: 0, look: 2, ...LOOK.frost, native: { label: 'A snow lynx', size: 26, speed: 8 }, glades: ['Hoarfrost Gate', 'Drift Hollow', 'Sleet Draw', 'Bellfrost Rise', 'Snowberry', 'Cold Spring Bend', 'Fir Knoll', 'Starfrost Vale', 'The Long Winter'] },
  { name: 'Ember Basin', col: 2, row: 2, look: 1, ...LOOK.ember, native: { label: 'A cinder fox', size: 24, speed: 9 }, glades: ['Cinder Gate', 'Ashen Hollow', 'Ember Draw', 'Kindle Rise', 'Glowfield', 'Smoke Bend', 'Hearth Knoll', 'Saffron Vale', 'The Last Ember'] },
  { name: 'Mistfen', col: 0, row: 2, look: 4, ...LOOK.mist, native: { label: 'A reed otter', size: 20, speed: 8 }, glades: ['Fogmouth', 'Bog Hollow', 'Rush Draw', 'Mire Rise', 'Frogspawn', 'Drizzle Bend', 'Moth Knoll', 'Marsh Vale', 'The Drowned Lantern'] },
  { name: 'Glimmerdeep', col: 0, row: 0, ...LOOK.glimmer, native: { label: 'A crystal hedgehog', size: 16, speed: 6 }, glades: ['Shardgate', 'Quartz Hollow', 'Prism Draw', 'Echo Rise', 'Geode Meadow', 'Facet Bend', 'Amethyst Knoll', 'Glint Vale', 'The Deep Light'] },
  { name: 'Sporewood', col: 1, row: 3, ...LOOK.spore, native: { label: 'A spore toadling', size: 17, speed: 6 }, glades: ['Capgate', 'Gill Hollow', 'Puffball Draw', 'Mycel Rise', 'Glowcap', 'Rootrot Bend', 'Moss Knoll', 'Dapple Vale', 'The Great Cap'] },
  { name: 'Coral Reach', col: 2, row: 3, ...LOOK.coral, native: { label: 'A coral crab', size: 15, speed: 7 }, glades: ['Pearlgate', 'Anemone Hollow', 'Brine Draw', 'Conch Rise', 'Rosereef', 'Urchin Bend', 'Foam Knoll', 'Starfish Vale', 'The Pink Tide'] },
];
// The cell whose art and colours each cell uses.
export const lookOf = l => LANDS[l]?.look ?? l;
// The regions, in order, with the cells each covers.
export const REGIONS = [...new Set(LANDS.map(L => L.name))].map(name => ({ name, lands: LANDS.map((L, l) => L.name === name ? l : -1).filter(l => l >= 0) }));

// The continent's water and its one path, planned for the whole map at once: little rivers run down from springs
// in Frostmere, Glimmerdeep, Mistfen and Ember Basin into the great lake in Hollow Vale, and one river runs out of
// the lake south through Sunfall Coast to the sea. Three small ponds lie where no river reaches. A narrow path runs
// from the farm in Sunfall Coast down to the fishing pier on the coast. Points are [x, y, width].
export const WATER = { rivers: [], ponds: [], springs: [], path: [], farm: null, pier: null };
const onLand = (gx, gy) => { const col = Math.floor(gx / LW), row = Math.floor(gy / LH); if (col < 0 || row < 0 || col >= COLS || row >= ROWS) return false; return !terrain(col, row, gx - col * LW, gy - row * LH); };
function inland(x, y, m) { // the nearest point to (x, y) with land all round it for m texels
  for (let r = 0; r < 700; r += 10) for (let a = 0; a < 6.283; a += r ? 10 / r : 7) {
    const px = x + Math.cos(a) * r, py = y + Math.sin(a) * r;
    if (onLand(px, py) && [0, .785, 1.571, 2.356, 3.142, 3.927, 4.712, 5.498].every(b => onLand(px + Math.cos(b) * m, py + Math.sin(b) * m))) return { x: px, y: py };
  }
  return { x, y };
}
function course(a, b, w0, w1, k, sway, extra = 0, wave = 85) {
  const len = Math.hypot(b.x - a.x, b.y - a.y) || 1, nx = -(b.y - a.y) / len, ny = (b.x - a.x) / len, out = [];
  for (let d = 0; d <= len + extra; d++) {
    const t = Math.min(1, d / len), s = (fbm(d / wave, k * 7.1, 905) - .5) * sway * Math.sin(t * Math.PI);
    out.push([a.x + (b.x - a.x) * d / len + nx * s, a.y + (b.y - a.y) * d / len + ny * s, w0 + (w1 - w0) * t + (noise(d / 26, k, 907) - .5) * .8]);
  }
  return out;
}
function planWater() {
  const lake = { x: LW + 480, y: LH + 320 }, rx = LAKE.r * .86, ry = rx / LAKE.squash;
  const into = p => { const a = Math.atan2(p.y - lake.y, p.x - lake.x); return { x: lake.x + Math.cos(a) * rx * .6, y: lake.y + Math.sin(a) * ry * .6 }; };
  // Like a real watershed: streams rise at springs in the uplands round the edge of the heartland and run down
  // in long, easy meanders. The stream from Glimmerdeep joins the one from Frostmere before they reach the lake; the
  // stream from Ember Basin flows in from the east; one river flows out south to the sea, and the stream from Mistfen
  // joins it on the way, so the water branches like a real river system rather than meeting at one point.
  const rim = p => { const a = Math.atan2(p.y - lake.y, p.x - lake.x); return { x: lake.x + Math.cos(a) * rx * .82, y: lake.y + Math.sin(a) * ry * .82 }; };
  const spring = (x, y) => inland(x, y, 90), seep = path => { for (let d = 0; d < 8 && d < path.length; d++) path[d][2] += (8 - d) * .1; return path; };
  const frostS = spring(LW * 1.8, LH * .45), glimS = spring(LW * .55, LH * .55), mistS = spring(LW * .4, LH * 1.5), emberS = spring(LW * 2.55, LH * 1.18);
  const frost = seep(course(frostS, rim(frostS), 1.8, 4, 1, 300, 0, 170));
  const meet = frost[Math.floor(frost.length * .62)], glim = seep(course(glimS, { x: meet[0], y: meet[1] }, 1.6, 2.8, 2, 260, 0, 150));
  for (let k = Math.floor(frost.length * .62); k < frost.length; k++) frost[k][2] += .9; // the stream runs fuller below where they meet
  const ember = seep(course(emberS, rim(emberS), 1.8, 4, 4, 300, 0, 170));
  WATER.rivers = [frost, glim, ember];
  WATER.springs = [frostS, glimS, mistS, emberS];
  let my = lake.y + ry; while (my < LH * 3 && onLand(lake.x, my + 30)) my += 4;
  const out = course({ x: lake.x, y: lake.y + ry * .82 }, { x: lake.x, y: my + 30 }, 4.4, 6.2, 9, 300, 40, 190);
  out.forEach((p, d) => { const t = d / out.length; if (t > .82) p[2] += (t - .82) / .18 * 5; }); // a little delta at the sea
  WATER.rivers.push(out);
  const join = out[Math.floor(out.length * .4)], mist = seep(course(mistS, { x: join[0], y: join[1] }, 1.8, 3.8, 3, 280, 0, 170));
  for (let k = Math.floor(out.length * .4); k < out.length; k++) out[k][2] += .8; // fuller below the meeting
  WATER.rivers.push(mist);
  WATER.ponds = [[LW * .5, LH * 2.3, 10], [LW * 2.5, LH * 2.25, 11], [LW * 1.62, LH * 3 + 290, 10]].map(([x, y, r]) => ({ ...inland(x, y, 50), r }));
  // The farm west of the river in Sunfall Coast.
  WATER.farm = inland(LW * 1.3, LH * 2.22, 70);
  // The fishing pier: on the coast nearest the farm (well clear of the river mouth), it starts on dry land and
  // runs straight out to sea, square to the shore. Its direction is the way from the land around it to the sea.
  const F = WATER.farm, sea = (x, y) => { const col = Math.floor(x / LW), row = Math.floor(y / LH); return col >= 0 && row >= 0 && col < COLS && row < ROWS && terrain(col, row, x - col * LW, y - row * LH) === SEA; };
  let S = null, sd = Infinity;
  for (let y = F.y; y < LH * 3; y += 4) for (let x = F.x - 320; x <= F.x + 320; x += 4) { const d = Math.hypot(x - F.x, y - F.y); if (d < sd && Math.abs(x - lake.x) > 110 && sea(x, y)) { sd = d; S = { x, y }; } }
  let ax = 0, ay = 0; for (let a = 0; a < 6.283; a += .2) for (const r of [18, 34]) { const x = S.x + Math.cos(a) * r, y = S.y + Math.sin(a) * r, k = sea(x, y) ? 1 : -1; ax += Math.cos(a) * k; ay += Math.sin(a) * k; }
  const al = Math.hypot(ax, ay) || 1, dx = ax / al, dy = ay / al;
  let back = 0; while (back < 200 && !onLand(S.x - dx * back, S.y - dy * back)) back += 2; // the first dry ground behind the shore
  const land = { x: S.x - dx * (back + 10), y: S.y - dy * (back + 10) };
  WATER.pier = { x0: land.x, y0: land.y, x1: S.x + dx * 40, y1: S.y + dy * 40, dx, dy, w: 3.5 };
  WATER.path = course({ x: F.x + 4, y: F.y + 6 }, { x: land.x - dx * 4, y: land.y - dy * 4 }, 2.3, 2.3, 11, 40);
}

export const landAt = i => LANDS[i % LANDS.length];

// Every glade on the continent: land * 9 + its place in that land's tree.
export const ZONES = [];
export const FC = 64, FCOLS = TW / FC, FROWS = TH / FC;
// The nine lands are generated one at a time on their own, exactly as before, then laid side by side.
// Texel layers shrink to bytes here, since the whole continent is nine times the size of one land.
export async function makeWorld(progress = async () => {}) {
  const N = TW * TH, edge = new Uint8Array(N), edgeD = new Uint8Array(N), road = new Uint8Array(N), waterT = new Uint8Array(N).fill(255), waterZ = new Uint8Array(N);
  const blocked = new Uint8Array(CN), near = new Uint8Array(CN), zone = new Uint8Array(CN), cellsOf = [], order = [], ponds = [], streams = [], objects = [], objStart = [];
  const cap = CN * 2, fx = new Float32Array(cap), fy = new Float32Array(cap), fcell = new Uint32Array(cap), fkind = new Uint8Array(cap), fthr = new Float32Array(cap), fphase = new Float32Array(cap), fstart = new Uint32Array(FCOLS * FROWS), fcount = new Uint32Array(FCOLS * FROWS);
  let fn = 0;
  ZONES.length = 0;
  planWater();
  for (let id = 0; id < LANDS.length; id++) {
    await progress(id);
    const L = makeLand(1 + id * 17, id), map = LANDS[id], ox = map.col * LW, oy = map.row * LH, cx = map.col * LCW, cy = map.row * LCH, zb = id * 9;
    GLADES.forEach(g => { ZONES[zb + g.id] = { id: zb + g.id, land: id, glade: g.id, name: map.glades[g.id], px: g.px + ox, py: g.py + oy, adj: [] }; });
    for (let y = 0; y < LH; y++) for (let x = 0, a = y * LW, b = (oy + y) * TW + ox; x < LW; x++, a++, b++) {
      edge[b] = L.edge[a]; edgeD[b] = Math.round(L.edgeD[a] * 255); road[b] = L.road[a];
      const t = L.waterT[a]; if (t >= 0) { waterT[b] = Math.round(t * 254); waterZ[b] = zb + L.waterZ[a]; }
    }
    for (let y = 0; y < LCH; y++) for (let x = 0, a = y * LCW, b = (cy + y) * CW + cx; x < LCW; x++, a++, b++) { blocked[b] = L.blocked[a]; near[b] = L.near[a]; zone[b] = zb + L.zone[a]; }
    const toG = i => (cy + Math.floor(i / LCW)) * CW + cx + i % LCW;
    L.cellsOf.forEach((l, j) => { cellsOf[zb + j] = l.map(toG); order[zb + j] = Uint32Array.from(L.order[j], toG); });
    for (const p of L.ponds) ponds.push({ x: p.x + ox, y: p.y + oy, r: p.r, lake: p.lake });
    objStart[id] = objects.length;
    for (const o of L.objects) objects.push({ ...o, id: objects.length, zone: zb + o.zone, land: id, x: o.x + cx, y: o.y + cy });
    L.flora.forEach((list, k) => {
      const c = (map.row * L.floraRows + Math.floor(k / L.floraCols)) * FCOLS + map.col * L.floraCols + k % L.floraCols;
      fstart[c] = fn; fcount[c] = list.length;
      for (const p of list) { fx[fn] = p.x + ox; fy[fn] = p.y + oy; fcell[fn] = toG(p.cell); fkind[fn] = p.kind; fthr[fn] = p.thr; fphase[fn] = p.phase; fn++; }
    });
  }
  // The open-sea cells: all water, nothing to restore.
  for (const k of EMPTY_CELLS) {
    const col = k % COLS, row = Math.floor(k / COLS);
    for (let y = 0; y < LH; y++) for (let x = 0, b = (row * LH + y) * TW + col * LW; x < LW; x++, b++) { edge[b] = SEA; edgeD[b] = 255; }
    for (let y = 0; y < LCH; y++) for (let x = 0, b = (row * LCH + y) * CW + col * LCW; x < LCW; x++, b++) blocked[b] = 1;
  }
  // Glades belong to the whole continent, not to a rectangle: each cell joins the nearest glade through
  // the same wavy warp the lands used, so glade edges (and the mist on them) wander across the old seams.
  for (let y = 0, i = 0; y < CH; y++) for (let x = 0; x < CW; x++, i++) {
    const tx = x * CELL + 2, ty = y * CELL + 2;
    const wx = tx + (fbm(tx / 70, ty / 70, 511) - .5) * 85 + (fbm(tx / 19, ty / 19, 513) - .5) * 46, wy = ty + (fbm(tx / 70, ty / 70, 529) - .5) * 85 + (fbm(tx / 19, ty / 19, 531) - .5) * 46;
    let best = 0, bd = Infinity;
    for (const z of ZONES) { const d = (wx - z.px) ** 2 + (wy - z.py) ** 2; if (d < bd) { bd = d; best = z.id; } }
    zone[i] = best;
  }
  // Each glade owns the stretch of river inside it; its bed deepens in order down the river, which is how its water
  // fills when a Rainwisp brings rain. A glade's pond is one of the few small ponds if it holds one (or the lake).
  const zoneAt = (x, y) => zone[Math.max(0, Math.min(CH - 1, Math.floor(y / CELL))) * CW + Math.max(0, Math.min(CW - 1, Math.floor(x / CELL)))];
  const discG = (x, y, r, f) => { for (let yy = Math.floor(y - r); yy <= y + r; yy++) for (let xx = Math.floor(x - r); xx <= x + r; xx++) if (xx >= 0 && yy >= 0 && xx < TW && yy < TH && (xx - x) ** 2 + (yy - y) ** 2 <= r * r) f(yy * TW + xx); };
  const owned = ZONES.map(() => []);
  for (const river of WATER.rivers) for (const p of river) owned[zoneAt(p[0], p[1])].push(p);
  owned.forEach((list, z) => {
    list.forEach(([x, y, w], k) => { const t = Math.round((list.length > 1 ? k / (list.length - 1) : 0) * .7 * 254); discG(x, y, w, i => { if (waterT[i] < 178) { waterT[i] = t; waterZ[i] = z; } }); });
    streams[z] = list.map(([x, y]) => [x, y]);
  });
  for (let z = 0; z < ZONES.length; z++) streams[z] ||= [];
  for (const p of WATER.ponds) { const z = zoneAt(p.x, p.y); ponds[z] = { x: p.x, y: p.y, r: p.r }; discG(p.x, p.y, p.r + 4, i => { if (waterT[i] !== 255) waterZ[i] = z; }); }
  for (let z = 0; z < ZONES.length; z++) cellsOf[z] = [];
  for (let i = 0; i < CN; i++) if (!blocked[i]) cellsOf[zone[i]].push(i);
  cellsOf.forEach((list, z) => { const p = ponds[z]; order[z] = Uint32Array.from(list.map(i => [i, Math.hypot(i % CW * CELL - p.x, Math.floor(i / CW) * CELL - p.y) + hash(i, 1, 7) * 26]).sort((a, b) => a[1] - b[1]).map(e => e[0])); });
  near.fill(0);
  for (let y = 0, i = 0; y < CH; y++) for (let x = 0; x < CW; x++, i++) for (let b = -1; b < 3 && !near[i]; b++) for (let a = -1; a < 3; a++) { const xx = x + a, yy = y + b; if (xx >= 0 && yy >= 0 && xx < CW && yy < CH && blocked[yy * CW + xx]) { near[i] = 1; break; } }
  // Which land's ground each texel shows. The borders wander in broad bays and long fingers, and the last few
  // texels are dithered, so one country runs into the next the way a meadow fades into heath.
  const biome = new Uint8Array(N), gw = CW + 1, wxG = new Float32Array(gw * (CH + 1)), wyG = new Float32Array(gw * (CH + 1));
  for (let gy = 0, k = 0; gy <= CH; gy++) for (let gx = 0; gx <= CW; gx++, k++) {
    const x = gx * CELL, y = gy * CELL;
    wxG[k] = (fbm(x / 620, y / 620, 601) - .5) * 560 + (fbm(x / 150, y / 150, 603) - .5) * 190 + (fbm(x / 38, y / 38, 605) - .5) * 46;
    wyG[k] = (fbm(x / 620, y / 620, 611) - .5) * 560 + (fbm(x / 150, y / 150, 613) - .5) * 190 + (fbm(x / 38, y / 38, 615) - .5) * 46;
  }
  for (let y = 0, i = 0; y < TH; y++) {
    const gy = y >> 2, ty = (y & 3) / 4;
    for (let x = 0; x < TW; x++, i++) {
      const gx = x >> 2, tx = (x & 3) / 4, k = gy * gw + gx, d = hash(x, y, 617) - .5;
      const dx = (wxG[k] * (1 - tx) + wxG[k + 1] * tx) * (1 - ty) + (wxG[k + gw] * (1 - tx) + wxG[k + gw + 1] * tx) * ty, dy = (wyG[k] * (1 - tx) + wyG[k + 1] * tx) * (1 - ty) + (wyG[k + gw] * (1 - tx) + wyG[k + gw + 1] * tx) * ty;
      const by = y + dy - d * 44; // the island across the channel never borrows the mainland's colours, or the reverse
      biome[i] = lookOf(landAtTexel(x + dx + d * 44, y >= LH * 3 ? Math.max(LH * 3, by) : Math.min(LH * 3 - 1, by)));
    }
  }
  // A last look over the whole continent: nothing stands in water, on a road or crop row, on rock or sand, or on
  // top of something else. A misplaced tree or stone shuffles a little way over, or is left out.
  // The farm and the fishing pier are places that earn seeds once restored. The farm is ChatGPT art (assets/places.png);
  // the pier is drawn plank by plank along its line, so it always starts on land and points out to sea.
  { const F = WATER.farm, D = { x: WATER.pier.x0, y: WATER.pier.y0 }, keep = objects.filter(o => Math.hypot(o.x * CELL - F.x, o.y * CELL - F.y) > 70 && Math.hypot(o.x * CELL - D.x, o.y * CELL - D.y) > 36 && WATER.springs.every(q => Math.hypot(o.x * CELL - q.x, o.y * CELL - q.y) > 34));
    objects.length = 0; objects.push(...keep);
    for (const [P, place, dead, size] of [[F, 'farm', 0, 66], [D, 'pier', 2, 40], ...WATER.springs.map(q => [{ x: q.x, y: q.y + 5 }, 'spring', 4, 30])]) objects.push({ id: objects.length, zone: 0, dead, live: dead + 1, x: P.x / CELL, y: P.y / CELL, size, hp: 3, place, land: landAtTexel(P.x, P.y) }); }
  for (const o of objects) { o.worth = o.size; o.size *= SHRINK; }
  const solid = (x, y) => { x |= 0; y |= 0; if (x < 0 || y < 0 || x >= TW || y >= TH) return true; const i = y * TW + x; return edge[i] || road[i] || waterT[i] < 255; };
  const scanClear = (x, y, half, deep, step) => { for (let yy = y - deep; yy <= y + 4; yy += step) for (let xx = x - half; xx <= x + half; xx += step) if (solid(xx, yy)) return false; return true; };
  const footClear = (x, y, half, deep = 6) => scanClear(x, y, half, deep, 3) && scanClear(x, y, half, deep, 1); // A quick look first, then every texel.
  // Roots and the lower canopy spread about two fifths of a sprite's size each way; a few texels more keep water at a distance.
  const base = size => [Math.max(4, Math.round(size * .4)) + 4, Math.max(8, Math.round(size * .5))];
  const BUCKET = 48, buckets = new Map(), bucketAt = (x, y) => Math.floor(x / BUCKET) * 1000 + Math.floor(y / BUCKET);
  const crowded = (x, y, size, skip) => { for (let b = -1; b <= 1; b++) for (let a = -1; a <= 1; a++) for (const q of buckets.get(bucketAt(x + a * BUCKET, y + b * BUCKET)) || []) { if (q === skip) continue; const qx = q.x * CELL, qy = q.y * CELL; if (Math.abs(qx - x) < (q.size + size) * .3 && Math.abs(qy - y) < Math.max(8, (q.size + size) * .16)) return true; } return false; };
  const keep = o => { const k = bucketAt(o.x * CELL, o.y * CELL); if (!buckets.has(k)) buckets.set(k, []); buckets.get(k).push(o); };
  const kept = [];
  for (const o of objects) if (o.place) { kept.push(o); keep(o); } // The farm and the pier stand where they were planned.
  for (const o of objects) {
    if (o.place) continue;
    const [half, deep] = base(o.size), x0 = o.x * CELL, y0 = o.y * CELL, reach = Math.max(36, o.size);
    let spot = footClear(x0, y0, half, deep) && !crowded(x0, y0, o.size) ? [x0, y0] : null;
    for (let r = 6; !spot && r <= reach; r += 6) for (let a = 0; a < 12 && !spot; a++) { const x = x0 + Math.cos(a * .524) * r, y = y0 + Math.sin(a * .524) * r * .7; if (!blocked[Math.floor(y / CELL) * CW + Math.floor(x / CELL)] && footClear(x, y, half, deep) && !crowded(x, y, o.size)) spot = [x, y]; }
    if (!spot) continue;
    o.x = spot[0] / CELL; o.y = spot[1] / CELL; kept.push(o); keep(o);
  }
  kept.sort((a, b) => a.land - b.land || a.id - b.id);
  objects.length = 0; kept.forEach((o, i) => { o.id = i; objects.push(o); });
  LANDS.forEach((_, id) => { const i = objects.findIndex(o => o.land === id); objStart[id] = i < 0 ? objects.length : i; });
  // Planted trees ask the same question: is this a clear patch of ground?
  const free = (x, y, size = TREE) => footClear(x, y, ...base(size)) && !crowded(x, y, size);
  // Village buildings keep their own land's art; trees and stones take the look of the ground they stand on.
  for (const o of objects) { o.zone = zone[Math.min(CN - 1, Math.floor(o.y) * CW + Math.floor(o.x))]; o.art = biome[Math.min(N - 1, Math.floor(o.y * CELL) * TW + Math.floor(o.x * CELL))]; }
  // Neighbouring glades: they touch, or face each other across a ridge of rock.
  const links = ZONES.map(() => new Set()), across = (i, step, n) => { for (let k = 1; k <= n; k++) { const j = i + step * k; if (!blocked[j]) return j; const x = j % CW, y = Math.floor(j / CW), e = edge[(y * CELL + 2) * TW + x * CELL + 2]; if (e !== ROCK && e !== PATH) return -1; } return -1; };
  for (let y = 0; y < CH - 1; y++) for (let x = 0; x < CW - 1; x++) {
    const i = y * CW + x; if (blocked[i]) continue;
    for (const step of [1, CW]) {
      const j = blocked[i + step] ? (step === 1 ? (x + 16 < CW ? across(i, 1, 16) : -1) : (y + 16 < CH ? across(i, CW, 16) : -1)) : i + step;
      if (j >= 0 && zone[j] !== zone[i]) { links[zone[i]].add(zone[j]); links[zone[j]].add(zone[i]); }
    }
  }
  // The island lies across the sea: its glade nearest the mainland faces the nearest mainland glade, so it can be woken from the coast.
  { const isle = ZONES.filter(z => LANDS[z.land].row >= 3), main = ZONES.filter(z => LANDS[z.land].row < 3 && cellsOf[z.id].length);
    let best = null, bd = Infinity; for (const a of isle) for (const m of main) { const d = Math.hypot(a.px - m.px, a.py - m.py); if (cellsOf[a.id].length && d < bd) { bd = d; best = [a.id, m.id]; } }
    if (best) { links[best[0]].add(best[1]); links[best[1]].add(best[0]); } }
  ZONES.forEach((z, n) => { z.adj = [...links[n]]; });
  const sub = a => a.slice(0, fn);
  return { free, biome, edge, edgeD, road, waterT, waterZ, blocked, near, zone, cellsOf, order, ponds, streams, objects, objStart, count: cellsOf.map(l => l.length), pend: new Float32Array(CN), active: [], dirty: () => {},
    flora: { x: sub(fx), y: sub(fy), cell: sub(fcell), kind: sub(fkind), thr: sub(fthr), phase: sub(fphase), start: fstart, count: fcount } };
}
// Trees, stones and buildings are drawn at this share of the size the land was laid out for.
export const SHRINK = .7, TREE = 38 * SHRINK; // TREE: a grown planted tree.
export const landOfCell = (w, i) => ZONES[w.zone[i]].land;
export const landAtTexel = (x, y) => LAND_GRID[Math.min(ROWS - 1, Math.max(0, Math.floor(y / LH))) * COLS + Math.min(COLS - 1, Math.max(0, Math.floor(x / LW)))];
const LAND_GRID = new Array(COLS * ROWS).fill(-1);
LANDS.forEach((l, id) => { LAND_GRID[l.row * COLS + l.col] = id; });
// Cells with no land of their own (open sea) take their colours from the nearest land in their row.
export const EMPTY_CELLS = LAND_GRID.map((l, i) => l < 0 ? i : -1).filter(i => i >= 0);
for (const i of EMPTY_CELLS) { const row = Math.floor(i / COLS); LAND_GRID[i] = LAND_GRID.find((l, j) => l >= 0 && Math.floor(j / COLS) === row) ?? 0; }
