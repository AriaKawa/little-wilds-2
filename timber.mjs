// Trees that live, and wood. Planted trees grow up from saplings and, once grown, now and then drop a seed that
// sprouts nearby. A Woodkin fells grown trees for wood; each felled tree leaves a stump that sprouts again in time.
// Wood rebuilds the old spirit portal in Birch Knoll, a gate of timber that stands facing you, stage by stage.
// Rules only: the felling and the portal are drawn by render.mjs; the portal window lives in keepers.mjs.
import { CW, CELL, TW, ZONES } from './world.mjs?v=44';
import { markTree, unmarkTree } from './nav.mjs?v=44';

export const TREE_CAP = 160, GROWN = 9, SAPLING = 90, REGROW = 150, SEED_EVERY = 700, WOOD = 4, CHOP = 3.2;
export const PORTAL_ZONE = 6; // Birch Knoll, in Hollow Vale
export const PORTAL_STAGES = [15, 30, 50, 80, 125]; // wood to finish each stage: 300 in all
export const grownOf = (s, t) => Math.min(1, Math.max(0, (s.age - t.born) / (t.grow || GROWN)));
export function timberInit(s) { s.trees ||= []; s.wood ||= 0; s.stumps ||= []; s.portal ||= { wood: 0 }; }

/* The portal */
export const portalTotal = () => PORTAL_STAGES.reduce((a, b) => a + b, 0);
// Which stage the portal is at, and how far into the next.
export function portalStage(s) {
  let left = s.portal?.wood || 0, k = 0;
  for (; k < PORTAL_STAGES.length && left >= PORTAL_STAGES[k]; k++) left -= PORTAL_STAGES[k];
  return { stage: k, into: left, need: PORTAL_STAGES[k] || 0, done: k >= PORTAL_STAGES.length };
}
// Each finished stage adds 2% to all earnings; the whole portal 10% more.
export const portalBonus = s => { const p = portalStage(s); return p.stage * .02 + (p.done ? .1 : 0); };
export function giveWood(s, n = Infinity) {
  const k = Math.max(0, Math.min(n, s.wood, portalTotal() - s.portal.wood));
  s.wood -= k; s.portal.wood += k; return k;
}
// Where the portal stands: open, dry, clear ground near the heart of Birch Knoll, the same spot every time.
let spot;
export function portalSpot(w) {
  if (spot !== undefined) return spot;
  const z = ZONES[PORTAL_ZONE]; spot = null;
  const dry = (x, y) => { for (let dy = -8; dy <= 6; dy += 3) for (let dx = -30; dx <= 30; dx += 3) { const i = Math.floor(y + dy) * TW + Math.floor(x + dx); if (w.waterT[i] !== 255 || w.road[i]) return false; } return true; };
  for (let r = 40; r < 260 && !spot; r += 8) for (let a = 0; a < 20 && !spot; a++) {
    const x = z.px + Math.cos(a * .314 + .5) * r, y = z.py + Math.sin(a * .314 + .5) * r * .7;
    if (w.zone[Math.floor(y / CELL) * CW + Math.floor(x / CELL)] !== PORTAL_ZONE) continue;
    if (w.free(x, y, 40) && dry(x, y) && !w.objects.some(o => Math.hypot(o.x * CELL - x, (o.y * CELL - y) * 1.6) < 44)) spot = { x, y };
  }
  return spot;
}

/* Felling and regrowth */
// The tree goes, a stump stays, and the wood is yours.
export function fell(s, w, t) {
  const i = s.trees.indexOf(t); if (i < 0) return 0;
  s.trees.splice(i, 1); unmarkTree(w, t, s.trees);
  s.stumps.push({ x: t.x, y: t.y, t: s.age, blossom: !!t.blossom });
  s.wood += WOOD; s.felled = (s.felled || 0) + 1;
  return WOOD;
}
// Every tick: stumps sprout again, and grown trees now and then seed a sapling nearby.
export function growTrees(s, w, dt, ev) {
  timberInit(s);
  for (let i = s.stumps.length - 1; i >= 0; i--) {
    const q = s.stumps[i]; if (s.age - q.t < REGROW) continue;
    s.stumps.splice(i, 1);
    if (s.trees.length < TREE_CAP) { const t = { x: q.x, y: q.y, born: s.age, grow: SAPLING, blossom: q.blossom }; s.trees.push(t); markTree(w, t); ev.push({ t: 'sprout', tree: t }); }
  }
  if (s.trees.length >= TREE_CAP) return;
  for (let n = s.trees.length - 1; n >= 0; n--) {
    const t = s.trees[n];
    if (grownOf(s, t) < 1 || Math.random() > dt / SEED_EVERY) continue;
    const a = Math.random() * 6.283, r = 7 + Math.random() * 7, x = t.x + Math.cos(a) * r, y = t.y + Math.sin(a) * r * .8, c = Math.floor(y) * CW + Math.floor(x);
    if (x < 2 || y < 2 || x >= CW - 2 || !s.zones[w.zone[c]]?.open || s.h[c] < .6 || !w.free(x * CELL, y * CELL)) continue;
    if (s.trees.some(q => Math.hypot(q.x - x, q.y - y) < 6) || s.stumps.some(q => Math.hypot(q.x - x, q.y - y) < 4)) continue;
    const sap = { x, y, born: s.age, grow: SAPLING, blossom: !!t.blossom && Math.random() < .7 };
    s.trees.push(sap); markTree(w, sap); ev.push({ t: 'sprout', tree: sap });
    if (s.trees.length >= TREE_CAP) return;
  }
}
// A Woodkin's next tree: the nearest grown one no other Woodkin is felling.
export function pickTree(s, a, reach = 140) {
  let best = null, bd = reach;
  for (const t of s.trees) {
    if (grownOf(s, t) < 1 || s.spirits.some(q => q !== a && q.tree === t)) continue;
    const d = Math.hypot(t.x - a.x, t.y - a.y); if (d < bd) { bd = d; best = t; }
  }
  return best;
}
