// How creatures get around: a map of what each ground cell is (open, a stream to hop, a pond to walk
// around, or something solid like rock, a trunk or a house), and a little steering that walks toward a goal
// and feels its way round whatever is in the way. Positions are in cells.
import { CW, CH, CELL, TW, TREE } from './world.mjs?v=31';

export const OPEN = 0, STREAM = 1, POND = 2, SOLID = 3;
const POND_T = 178; // waterT at or above this is a pond; below it is a stream.

export function buildNav(w) {
  const nav = new Uint8Array(CW * CH);
  for (let y = 0; y < CH; y++) for (let x = 0; x < CW; x++) {
    const i = y * CW + x;
    if (w.blocked[i]) { nav[i] = SOLID; continue; }
    let pond = 0, stream = 0;
    for (let b = 0; b < CELL; b++) for (let a = 0; a < CELL; a++) { const t = w.waterT[(y * CELL + b) * TW + x * CELL + a]; if (t === 255) continue; if (t >= POND_T) pond++; else stream++; }
    nav[i] = pond >= 6 ? POND : stream + pond >= 3 ? STREAM : OPEN;
  }
  w.nav = nav;
  for (const o of w.objects) markFoot(w, o.x, o.y, o.size, o.mark);
  return nav;
}
// The ground a trunk, stone or house stands on. x, y are its base in cells; size is in texels.
export function markFoot(w, x, y, size, building = false) {
  const hw = (building ? size * .36 : size * .2) / CELL, up = (building ? size * .28 : size * .1) / CELL;
  for (let yy = Math.floor(y - up); yy <= Math.floor(y + .3); yy++) for (let xx = Math.floor(x - hw); xx <= Math.floor(x + hw); xx++) {
    if (xx < 0 || yy < 0 || xx >= CW || yy >= CH) continue;
    const i = yy * CW + xx; if (w.nav[i] !== POND) w.nav[i] = SOLID;
  }
}
export const markTree = (w, t) => markFoot(w, t.x, t.y, TREE);
export const kindAt = (w, x, y) => { const xi = Math.floor(x), yi = Math.floor(y); return xi < 0 || yi < 0 || xi >= CW || yi >= CH ? SOLID : w.nav[yi * CW + xi]; };
// Somewhere a walker can stand.
export const standable = (w, i) => w.nav[i] === OPEN;

// Can a walker head this way? A stream is fine if there is dry ground within a hop on the far side.
function clear(w, x, y, ux, uy, float) {
  for (const d of [.5, 1.2]) { const k = kindAt(w, x + ux * d, y + uy * d); if (k === SOLID || (k === POND && !float)) return false; }
  if (float) return true;
  const k = kindAt(w, x + ux * 1.2, y + uy * 1.2), k0 = kindAt(w, x + ux * .5, y + uy * .5);
  if (k !== STREAM && k0 !== STREAM) return true;
  for (let d = 1.6; d <= 5; d += .4) { const q = kindAt(w, x + ux * d, y + uy * d); if (q === OPEN) return true; if (q !== STREAM) return false; }
  return false;
}
const TRY = [0, .35, .7, 1.05, 1.4, 1.75, 2.1, 2.5];
// A route on the cell grid (A*, eight ways, no cutting corners past rock or trunks). Streams cost a little
// more, so a bridge or a narrow spot is preferred when it is close. Returns waypoints, or null if the goal
// cannot be reached within a short search, so the walker picks a different goal instead of trying in vain.
let G = null, from = null, seen = null, stamp = 0, heap = null, hf = null;
const passable = (k, float) => k === OPEN || k === STREAM || (float && k === POND);
export function findPath(w, x0, y0, x1, y1, float = false, budget = 9000) {
  const N = CW * CH;
  if (!G) { G = new Float32Array(N); from = new Int32Array(N); seen = new Uint32Array(N); heap = new Int32Array(N); hf = new Float32Array(N); }
  const s = Math.floor(y0) * CW + Math.floor(x0), gx = Math.floor(x1), gy = Math.floor(y1), goal = gy * CW + gx;
  if (gx < 0 || gy < 0 || gx >= CW || gy >= CH || !passable(w.nav[goal], float)) return null;
  stamp++; let n = 0;
  const h = i => { const dx = Math.abs(i % CW - gx), dy = Math.abs(((i / CW) | 0) - gy); return Math.max(dx, dy) + .414 * Math.min(dx, dy); };
  const push = (i, f) => { let k = n++; while (k > 0) { const p = (k - 1) >> 1; if (hf[p] <= f) break; heap[k] = heap[p]; hf[k] = hf[p]; k = p; } heap[k] = i; hf[k] = f; };
  const pop = () => { const top = heap[0], li = heap[--n], lf = hf[n]; let k = 0; for (;;) { let c = 2 * k + 1; if (c >= n) break; if (c + 1 < n && hf[c + 1] < hf[c]) c++; if (hf[c] >= lf) break; heap[k] = heap[c]; hf[k] = hf[c]; k = c; } heap[k] = li; hf[k] = lf; return top; };
  seen[s] = stamp; G[s] = 0; from[s] = -1; push(s, h(s));
  for (let it = 0; n && it < budget; it++) {
    const i = pop();
    if (i === goal) {
      const out = []; for (let k = i; k >= 0; k = from[k]) out.push([k % CW + .5, ((k / CW) | 0) + .5]);
      return out.reverse();
    }
    const x = i % CW, y = (i / CW) | 0;
    for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) {
      if (!dx && !dy) continue;
      const xx = x + dx, yy = y + dy; if (xx < 0 || yy < 0 || xx >= CW || yy >= CH) continue;
      const j = yy * CW + xx, k = w.nav[j]; if (!passable(k, float)) continue;
      if (dx && dy && (!passable(w.nav[y * CW + xx], float) || !passable(w.nav[yy * CW + x], float))) continue;
      const g = G[i] + (dx && dy ? 1.414 : 1) * (k === STREAM && !float ? 1.6 : 1);
      if (seen[j] === stamp && G[j] <= g) continue;
      seen[j] = stamp; G[j] = g; from[j] = i; push(j, g + h(j));
    }
  }
  return null;
}
// Can a walker go straight from one point to another without touching anything it would have to go round?
function sight(w, x0, y0, x1, y1, float) {
  const d = Math.hypot(x1 - x0, y1 - y0), n = Math.ceil(d * 2.5);
  for (let k = 1; k <= n; k++) { const t = k / n, x = x0 + (x1 - x0) * t, y = y0 + (y1 - y0) * t; for (const [a, b] of [[0, 0], [.3, .3], [-.3, .3], [.3, -.3], [-.3, -.3]]) { const q = kindAt(w, x + a, y + b); if (q === SOLID || (q === POND && !float)) return false; } }
  return true;
}
// Moves `a` up to `step` toward (tx, ty). Returns 'moving', 'arrived' (or as close as the ground allows) or
// 'stuck' when it has made no headway for a while and should pick somewhere else to go.
export function steer(w, a, tx, ty, step, dt, float = false) {
  if (a.goalX !== tx || a.goalY !== ty) {
    a.goalX = tx; a.goalY = ty; a.best = Infinity; a.stall = 0; a.wp = 0;
    // Plan a route unless the way is plainly clear; no route means this goal is out of reach.
    a.route = sight(w, a.x, a.y, tx, ty, float) ? null : findPath(w, a.x, a.y, tx, ty, float);
    if (!a.route && !sight(w, a.x, a.y, tx, ty, float)) { const k = kindAt(w, a.x, a.y); if (k !== SOLID && !(k === POND && !float)) return 'stuck'; }
    if (a.route) a.route[a.route.length - 1] = [tx, ty];
  }
  let left = step;
  for (let n = 0; n < 40 && left > 1e-6; n++) {
    // Head for the furthest waypoint in plain sight, so the route is walked smoothly rather than cell by cell.
    let gx = tx, gy = ty;
    if (a.route) {
      const R = a.route;
      while (a.wp < R.length - 1 && Math.hypot(R[a.wp][0] - a.x, R[a.wp][1] - a.y) < .8) a.wp++;
      let k = a.wp; for (let m = Math.min(R.length - 1, a.wp + 8); m > a.wp; m--) if (sight(w, a.x, a.y, R[m][0], R[m][1], float)) { k = m; break; }
      a.wp = k; [gx, gy] = R[k];
    }
    const dx = gx - a.x, dy = gy - a.y, d = Math.hypot(dx, dy), dGoal = Math.hypot(tx - a.x, ty - a.y);
    if (dGoal < .05) return 'arrived';
    if (d < .05) { a.wp++; continue; }
    const here = kindAt(w, a.x, a.y), trapped = here === SOLID || (here === POND && !float);
    let ang = Math.atan2(dy, dx);
    if (!trapped) {
      let found = null; const side = a.side || 1;
      for (const off of TRY) { for (const sg of off ? [side, -side] : [1]) { const t = ang + off * sg; if (clear(w, a.x, a.y, Math.cos(t), Math.sin(t), float)) { found = t; if (off && sg !== side) a.side = sg; break; } } if (found !== null) break; }
      if (found === null || (dGoal < 1.6 && found !== ang && Math.abs(found - ang) > .4)) return dGoal < 2.5 ? 'arrived' : 'stuck';
      ang = found;
    }
    const fast = !float && (here === STREAM || kindAt(w, a.x + Math.cos(ang) * .6, a.y + Math.sin(ang) * .6) === STREAM) ? 1.9 : 1; // a bound across the water
    const m = Math.min(Math.min(left, 1) * fast, d);
    a.x += Math.cos(ang) * m; a.y += Math.sin(ang) * m; a.dir = Math.cos(ang) < 0 ? -1 : 1;
    left -= Math.min(left, 1);
  }
  // Headway is measured along the route, since going round a pond can mean moving away from the goal for a while.
  const R = a.route, d = R ? (R.length - a.wp) * 1.2 + Math.hypot(R[Math.min(a.wp, R.length - 1)][0] - a.x, R[Math.min(a.wp, R.length - 1)][1] - a.y) : Math.hypot(tx - a.x, ty - a.y);
  if (d < a.best - .25) { a.best = d; a.stall = 0; } else if ((a.stall += dt) > 4) return 'stuck';
  return 'moving';
}
// Anything set down in a pond or inside a trunk (dropped there, or there before the map knew better) walks
// straight out to the nearest open ground before doing anything else. Returns true while it is doing so.
export function escape(w, a, step, float = false) {
  const k = kindAt(w, a.x, a.y);
  if (!(k === SOLID || (k === POND && !float))) { a.out = null; return false; }
  if (!a.out) {
    const x0 = Math.floor(a.x), y0 = Math.floor(a.y);
    for (let r = 1; r < 40 && !a.out; r++) for (let dy = -r; dy <= r && !a.out; dy++) for (let dx = -r; dx <= r; dx++) {
      if (Math.max(Math.abs(dx), Math.abs(dy)) !== r) continue;
      const x = x0 + dx, y = y0 + dy; if (x < 0 || y < 0 || x >= CW || y >= CH) continue;
      if (w.nav[y * CW + x] === OPEN) { a.out = [x + .5, y + .5]; break; }
    }
    if (!a.out) return false;
  }
  const dx = a.out[0] - a.x, dy = a.out[1] - a.y, d = Math.hypot(dx, dy), m = Math.min(step, d);
  if (d > 1e-6) { a.x += dx / d * m; a.y += dy / d * m; a.dir = dx < 0 ? -1 : 1; }
  return true;
}
// How high a hopping walker is: 0 on dry ground, rising to 1 over a stream.
export const overWater = (w, x, y) => kindAt(w, x, y) === STREAM;
