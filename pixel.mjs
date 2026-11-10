// Painted sprites become true pixel art on the ground's own grid: one art pixel per ground texel, a small
// palette with no smooth gradients and lone stray pixels tidied away, so buildings, trees and spirits sit in
// the same chunky world as the grass. Each sprite also gets what ties it to the ground: a shadow cast from its
// own silhouette, grass growing up over its foot, and colours pulled into the light of the land it stands in.
const cache = new Map(), sources = new Map(), shadows = new WeakMap(), skirts = new WeakMap(), aprons = new Map();
let ids = 0, spent = 0;
// Converting costs a millisecond or two per sprite, so only a few are made each frame; the rest wait a frame.
export const newFrame = () => { spent = 0; };
const canvasOf = (w, h) => { const c = document.createElement('canvas'); c.width = w; c.height = h; return c; };

function source(img, sx, sy, sw, sh) {
  img.__pix ??= ++ids;
  const key = `${img.__pix}:${sx}:${sy}:${sw}:${sh}`;
  let d = sources.get(key);
  if (!d) { const c = canvasOf(sw, sh), g = c.getContext('2d'); g.drawImage(img, sx, sy, sw, sh, 0, 0, sw, sh); d = g.getImageData(0, 0, sw, sh).data; sources.set(key, d); }
  return d;
}
// Median cut: split the colour cloud along its widest channel until there are k boxes, then use each box's mean.
function palette(cols, k) {
  let boxes = [cols];
  while (boxes.length < k) {
    let best = -1, span = 0, ch = 0;
    boxes.forEach((b, n) => { if (b.length < 2) return; for (let c = 0; c < 3; c++) { let lo = 255, hi = 0; for (const p of b) { if (p[c] < lo) lo = p[c]; if (p[c] > hi) hi = p[c]; } if (hi - lo > span) { span = hi - lo; best = n; ch = c; } } });
    if (best < 0 || span < 10) break;
    const b = boxes[best].sort((p, q) => p[ch] - q[ch]), mid = b.length >> 1;
    boxes.splice(best, 1, b.slice(0, mid), b.slice(mid));
  }
  return boxes.map(b => [0, 1, 2].map(c => b.reduce((a, p) => a + p[c], 0) / b.length));
}
// `tw` x `th` is the sprite's size in ground texels. `tone` is the land's light ([r, g, b], with `toneId` for caching).
export function pixelize(img, sx, sy, sw, sh, tw, th, flip = false, tone = null, toneId = 0) {
  tw = Math.max(1, Math.round(tw)); th = Math.max(1, Math.round(th));
  // A number, not a string, so looking up thousands of sprites a frame stays cheap.
  const key = (((((img.__pix ??= ++ids) * 2048 + sx) * 2048 + sy) * 256 + Math.min(255, tw)) * 256 + Math.min(255, th)) * 32 + toneId * 2 + (flip ? 1 : 0);
  let out = cache.get(key);
  if (out) return out;
  if (spent > 4) return null;
  const began = performance.now();
  const src = source(img, sx, sy, sw, sh), n = tw * th, rgb = new Float32Array(n * 3), solid = new Uint8Array(n);
  // Box filter: every texel is the alpha-weighted average of the painted pixels under it.
  for (let ty = 0; ty < th; ty++) for (let tx = 0; tx < tw; tx++) {
    const x0 = Math.floor(tx * sw / tw), x1 = Math.max(x0 + 1, Math.floor((tx + 1) * sw / tw)), y0 = Math.floor(ty * sh / th), y1 = Math.max(y0 + 1, Math.floor((ty + 1) * sh / th));
    let r = 0, g = 0, b = 0, a = 0;
    for (let y = y0; y < y1; y++) for (let x = x0, i = (y * sw + x0) * 4; x < x1; x++, i += 4) { const w = src[i + 3]; r += src[i] * w; g += src[i + 1] * w; b += src[i + 2] * w; a += w; }
    const k = ty * tw + (flip ? tw - 1 - tx : tx);
    if (a / ((x1 - x0) * (y1 - y0) * 255) < .45) continue;
    solid[k] = 1; rgb[k * 3] = r / a; rgb[k * 3 + 1] = g / a; rgb[k * 3 + 2] = b / a;
  }
  // A handful of flat colours, fewer for small sprites, the way a pixel artist would pick them.
  const cols = []; for (let k = 0; k < n; k++) if (solid[k]) cols.push([rgb[k * 3], rgb[k * 3 + 1], rgb[k * 3 + 2]]);
  let pal = cols.length ? palette(cols, Math.max(4, Math.min(7, Math.round(2 + Math.sqrt(n) / 10)))) : [[0, 0, 0]];
  const idx = new Int16Array(n).fill(-1);
  for (let k = 0; k < n; k++) if (solid[k]) { let best = 0, bd = Infinity; pal.forEach((p, m) => { const d = (p[0] - rgb[k * 3]) ** 2 * .3 + (p[1] - rgb[k * 3 + 1]) ** 2 * .59 + (p[2] - rgb[k * 3 + 2]) ** 2 * .11; if (d < bd) { bd = d; best = m; } }); idx[k] = best; }
  // Painted art is brighter and purer than the ground; it is softened and pulled into the land's own light.
  if (tone) pal = pal.map(p => { const grey = p[0] * .3 + p[1] * .59 + p[2] * .11; return p.map((v, c) => { const flat = v + (grey - v) * .14; return flat + (tone[c] * (grey / 150) - flat) * .12; }); });
  // Fussy detail goes: a pixel outvoted by five of its eight neighbours takes their colour. The silhouette stays.
  const at = (x, y) => x < 0 || y < 0 || x >= tw || y >= th ? -1 : idx[y * tw + x];
  const next = idx.slice(), votes = new Int16Array(pal.length);
  for (let y = 0; y < th; y++) for (let x = 0; x < tw; x++) {
    const v = at(x, y); if (v < 0) continue;
    votes.fill(0);
    for (let b = -1; b <= 1; b++) for (let a = -1; a <= 1; a++) { const q = (a || b) ? at(x + a, y + b) : -1; if (q >= 0) votes[q]++; }
    let top = v; for (let m = 0; m < pal.length; m++) if (votes[m] > votes[top]) top = m;
    if (top !== v && votes[top] >= 5) next[y * tw + x] = top;
  }
  idx.set(next);
  const c = canvasOf(tw, th), g = c.getContext('2d'), im = g.createImageData(tw, th), d = im.data;
  for (let y = 0; y < th; y++) for (let x = 0; x < tw; x++) {
    const v = at(x, y); if (v < 0) continue;
    // The silhouette darkens a shade of its own colour, not to black, and the sides away from the light
    // (right and below) darken more. No line is drawn along the foot, which sits in the grass.
    const right = at(x + 1, y) < 0, left = at(x - 1, y) < 0, up = at(x, y - 1) < 0, p = pal[v], m = right ? .7 : left || up ? .84 : 1, i = (y * tw + x) * 4;
    d[i] = p[0] * m; d[i + 1] = p[1] * m; d[i + 2] = p[2] * m; d[i + 3] = 255;
  }
  g.putImageData(im, 0, 0);
  cache.set(key, c);
  spent += performance.now() - began;
  return c;
}
const solidOf = c => { const d = c.getContext('2d').getImageData(0, 0, c.width, c.height).data, s = new Uint8Array(c.width * c.height); for (let i = 0; i < s.length; i++) s[i] = d[i * 4 + 3] > 0 ? 1 : 0; return s; };
// The sprite's own silhouette pressed flat onto the ground, leaning away from the light (up and to the right),
// so a palm casts a palm-shaped pool and a cottage a cottage-shaped one. Same height as the sprite's foot row.
export function shadowOf(c) {
  let s = shadows.get(c);
  if (s) return s;
  const w = c.width, h = c.height, solid = solidOf(c), lean = .42, flat = .2, sw = w + Math.ceil(h * lean) + 2, sh = Math.ceil(h * flat) + 3;
  let foot = -1; for (let y = h - 1; y >= 0 && foot < 0; y--) for (let x = 0; x < w; x++) if (solid[y * w + x]) { foot = y; break; }
  const out = canvasOf(sw, sh), g = out.getContext('2d');
  g.fillStyle = 'rgba(20,28,14,.42)';
  const done = new Uint8Array(sw * sh);
  for (let y = 0; y <= foot; y++) for (let x = 0; x < w; x++) {
    if (!solid[y * w + x]) continue;
    const up = foot - y, X = x + Math.round(up * lean), Y = sh - 2 - Math.round(up * flat);
    for (const [a, b] of [[0, 0], [1, 0]]) { const xx = X + a, yy = Y + b; if (xx < sw && yy >= 0 && yy < sh && !done[yy * sw + xx]) { done[yy * sw + xx] = 1; g.fillRect(xx, yy, 1, 1); } }
  }
  s = { c: out, foot };
  shadows.set(c, s);
  return s;
}
// Grass blades growing up over the foot of a sprite, in the colours of the meadow it stands in.
// `sides` keeps the middle clear (a doorway), `cols` are the land's grass colours, darkest first.
export function skirtOf(c, cols, seed, sides = false) {
  let byCols = skirts.get(c); if (!byCols) skirts.set(c, byCols = new Map());
  const key = cols.join() + (sides ? 's' : '');
  let s = byCols.get(key);
  if (s) return s;
  const w = c.width, h = c.height, solid = solidOf(c), H = 6;
  let foot = -1; for (let y = h - 1; y >= 0 && foot < 0; y--) for (let x = 0; x < w; x++) if (solid[y * w + x]) { foot = y; break; }
  const out = canvasOf(w + 4, H), g = out.getContext('2d');
  for (let x = 0; x < w + 4; x++) {
    const sx = x - 2, under = sx >= 0 && sx < w && [0, 1, 2].some(k => foot - k >= 0 && solid[(foot - k) * w + sx]), r = Math.abs(Math.sin((x + 1) * 12.9898 + seed * 78.233)) * 43758.5453 % 1;
    if (r < (under ? .3 : .62)) continue;
    if (sides && sx > w * .3 && sx < w * .7) continue;
    // Uneven blades, lit at the tip and shaded at the root, with gaps between them like real tufts.
    const tall = 2 + Math.floor(((r * 7.31) % 1) * (under ? 4 : 3)), top = H - tall, lean = r > .8 ? 1 : 0;
    for (let y = top; y < H; y++) { g.fillStyle = y === top ? cols[2] : y > H - 2 ? cols[0] : cols[1]; g.fillRect(x + (y === top ? lean : 0), y, 1, 1); }
  }
  s = { c: out, foot };
  byCols.set(key, s);
  return s;
}
// Trodden earth under a building, ragged at the edge, so it stands in a yard rather than on untouched grass.
export function apronOf(w, col, seed) {
  const key = w + ':' + col.join() + ':' + (seed % 7);
  let a = aprons.get(key);
  if (a) return a;
  w = Math.round(w * 1.25); const h = Math.max(5, Math.round(w * .2)), c = canvasOf(w, h), g = c.getContext('2d');
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    const dx = (x + .5 - w / 2) / (w / 2), dy = (y + .5 - h / 2) / (h / 2), r = Math.abs(Math.sin(x * 12.9898 + y * 78.233 + seed) * 43758.5453) % 1;
    const d = dx * dx + dy * dy; if (d > 1 || (d > .62 && r < .55)) continue;
    g.fillStyle = `rgb(${col.map(v => Math.round(v * (r > .8 ? .9 : 1))).join(',')})`; g.fillRect(x, y, 1, 1);
  }
  aprons.set(key, c);
  return c;
}
