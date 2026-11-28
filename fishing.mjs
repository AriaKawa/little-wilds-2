// Fishing: what bites where, the backpack, rods, Old Tam's market, and the quests of the pier fisherman and the
// demon lord. Rules only, no drawing: the cast, the reel and the windows live in angling.mjs.
import { TW, TH, LW, LH, CELL, CW, ZONES, LANDS, SEA, LAKE } from './world.mjs?v=44';

// Each fish: its icon (a cell of assets/items.png, sixteen to a row), its tier (1 common, 2 uncommon, 3 rare,
// 4 legendary), base worth in seeds, how hard it fights (0 to 1), the waters it lives in, how common it is there,
// a region it is found more in (more) or only in (region), whether it bites only at night, and the rod it needs.
export const FISH = [
  { id: 'minnow', move: 'smooth', name: 'Minnow', icon: 0, tier: 1, v: 6, hard: .1, waters: ['river', 'pond', 'lake'], w: 9, desc: 'Small, silver and everywhere. Bait for bigger things.' },
  { id: 'guppy', move: 'dart', name: 'Fantail guppy', icon: 17, tier: 1, v: 8, hard: .12, waters: ['pond', 'river'], w: 6, more: { 'Sunfall Coast': 2 }, desc: 'A pink dot with a tail far too big for it.' },
  { id: 'bluegill', move: 'smooth', name: 'Bluegill', icon: 16, tier: 1, v: 10, hard: .16, waters: ['pond', 'lake'], w: 7, desc: 'Round, cheerful and always hungry.' },
  { id: 'perch', move: 'smooth', name: 'Striped perch', icon: 18, tier: 1, v: 14, hard: .22, waters: ['lake', 'river'], w: 5, desc: 'Yellow with dark bars, like a little tiger of the shallows.' },
  { id: 'trout', move: 'dart', name: 'Brook trout', icon: 2, tier: 1, v: 18, hard: .3, waters: ['river'], w: 6, desc: 'Speckled and quick, it holds in the current of running rivers.' },
  { id: 'bass', move: 'sink', name: 'Sea bass', icon: 9, tier: 1, v: 22, hard: .34, waters: ['sea'], w: 8, desc: 'A strong, plain fish of the open coast.' },
  { id: 'rainbow', move: 'dart', name: 'Rainbow trout', icon: 27, tier: 2, v: 26, hard: .4, waters: ['river'], w: 3, more: { Frostmere: 2, Glimmerdeep: 2 }, desc: 'A pink stripe down each side. Loves cold, fast water.' },
  { id: 'catfish', move: 'sink', name: 'Catfish', icon: 4, tier: 2, v: 28, hard: .42, waters: ['pond', 'lake', 'river'], w: 2.6, more: { Mistfen: 3 }, desc: 'A whiskered grumbler from the mud. Mistfen is full of them.' },
  { id: 'mudskipper', move: 'dart', name: 'Mudskipper', icon: 19, tier: 2, v: 32, hard: .38, region: 'Mistfen', w: 3, desc: 'Half fish, half frog, all opinion. Only in the fens of Mistfen.' },
  { id: 'tang', move: 'float', name: 'Sunny tang', icon: 20, tier: 2, v: 34, hard: .46, waters: ['sea'], w: 2.6, more: { 'Coral Reach': 3 }, desc: 'Blue and yellow, bright as a summer flag.' },
  { id: 'pike', move: 'dart', name: 'Pike', icon: 3, tier: 2, v: 35, hard: .56, waters: ['lake', 'river'], w: 2, desc: 'All teeth and temper. It likes the great lake best.' },
  { id: 'seahorse', move: 'float', name: 'Seahorse', icon: 23, tier: 2, v: 38, hard: .4, waters: ['sea'], w: 1.6, more: { 'Coral Reach': 3, 'Sunfall Coast': 1.5 }, desc: 'It bobs upright and curls its tail round your finger.' },
  { id: 'eel', move: 'mixed', name: 'Eel', icon: 5, tier: 2, v: 40, hard: .62, waters: ['river', 'sea'], w: 1.5, more: { Mistfen: 2 }, desc: 'Slippery as a rumour. Found where rivers meet the sea.' },
  { id: 'clown', move: 'smooth', name: 'Clownfish', icon: 21, tier: 2, v: 45, hard: .44, region: 'Coral Reach', waters: ['sea', 'pond'], w: 3, desc: 'Orange and white and very proud of it. Only round Coral Reach.' },
  { id: 'puffer', move: 'float', name: 'Pufferfish', icon: 10, tier: 2, v: 50, hard: .5, waters: ['sea'], w: 2, more: { 'Coral Reach': 3 }, desc: 'Puffs up when cross. Coral Reach has the most.' },
  { id: 'carp', move: 'smooth', name: 'Golden carp', icon: 1, tier: 3, v: 60, hard: .52, waters: ['pond', 'lake'], w: 1, desc: 'A lucky fish. Folk say it grants a wish if you let it go.' },
  { id: 'tetra', move: 'dart', name: 'Glimmer tetra', icon: 8, tier: 3, v: 70, hard: .5, region: 'Glimmerdeep', w: 3, desc: 'It glows faintly, like the crystals of Glimmerdeep.' },
  { id: 'capfish', move: 'float', name: 'Capfish', icon: 28, tier: 3, v: 70, hard: .48, region: 'Sporewood', w: 3, desc: 'A little fish wearing a spotted toadstool. Only in Sporewood.' },
  { id: 'axolotl', move: 'sink', name: 'Frilly axolotl', icon: 22, tier: 3, v: 72, hard: .45, waters: ['pond', 'lake'], w: .7, desc: 'Smiles at everything. Hides in still, weedy ponds.' },
  { id: 'nightfin', move: 'mixed', name: 'Starry nightfin', icon: 26, tier: 3, v: 74, hard: .55, waters: ['river', 'lake'], w: 1.8, night: true, desc: 'Its back is speckled like the sky. Rises only after dark.' },
  { id: 'frostfin', move: 'sink', name: 'Frostfin', icon: 6, tier: 3, v: 80, hard: .6, region: 'Frostmere', w: 3, desc: 'Cold-blooded even for a fish. Only bites in Frostmere.' },
  { id: 'moonfish', move: 'float', name: 'Moonfish', icon: 25, tier: 3, v: 80, hard: .52, waters: ['pond', 'lake'], w: 1.6, night: true, desc: 'Pale and round as the moon it follows. Only at night.' },
  { id: 'angler', move: 'sink', name: 'Lantern angler', icon: 24, tier: 3, v: 85, hard: .6, waters: ['sea'], w: 1.5, night: true, desc: 'Lights its little lamp in the dark sea. Only at night.' },
  { id: 'koi', move: 'mixed', name: 'Ember koi', icon: 7, tier: 3, v: 90, hard: .56, region: 'Ember Basin', waters: ['river', 'pond', 'lake'], w: 3, desc: 'Warm to the touch. Lives in the fresh waters of Ember Basin.' },
  { id: 'ghost', move: 'dart', name: 'Ghost minnow', icon: 29, tier: 4, v: 140, hard: .7, w: .3, night: true, rod: 2, desc: 'You can see right through it. Bites in any water, but only at night.' },
  { id: 'lavafin', move: 'mixed', name: 'Lavafin', icon: 11, tier: 4, v: 160, hard: .74, region: 'Demonreach', w: 3, desc: 'Swims in the smouldering waters of Demonreach. Hot to hold.' },
  { id: 'salmon', move: 'mixed', name: 'King salmon', icon: 30, tier: 4, v: 220, hard: .82, waters: ['river'], w: .25, rod: 3, desc: 'The king of the rivers, crown and all. Needs an Ashwood rod or better.' },
  { id: 'dragon', move: 'mixed', name: 'Dragon koi', icon: 31, tier: 4, v: 500, hard: .9, waters: ['lake'], w: .14, rod: 4, desc: 'An ancient koi of the great lake. Only a Demonbone rod can hold it.' },
  // Fish of a season, or of the rain.
  { id: 'blossom', move: 'float', name: 'Blossom carp', icon: 32, tier: 2, v: 42, hard: .4, waters: ['pond', 'lake'], w: 2.6, season: 'spring', desc: 'Petals stick to it all spring long. Only in spring.' },
  { id: 'sunfish', move: 'smooth', name: 'Sunfish', icon: 33, tier: 2, v: 36, hard: .36, waters: ['pond', 'lake', 'river'], w: 3, season: 'summer', desc: 'Warm and golden, it basks near the surface. Only in summer.' },
  { id: 'leaftail', move: 'dart', name: 'Maple leaftail', icon: 34, tier: 2, v: 40, hard: .46, waters: ['river'], w: 2.6, season: 'autumn', desc: 'Its tail is a maple leaf, and it drifts like one. Only in autumn.' },
  { id: 'icefish', move: 'sink', name: 'Snowflake icefish', icon: 35, tier: 3, v: 75, hard: .55, w: 1.6, season: 'winter', desc: 'No two have the same pattern. Bites in any water, only in winter.' },
  { id: 'raindrop', move: 'dart', name: 'Raindrop tetra', icon: 36, tier: 2, v: 46, hard: .42, waters: ['river', 'pond'], w: 3.4, rain: true, desc: 'Comes up to dance whenever it rains. Only in the rain.' },
  { id: 'boot', move: 'sink', name: 'Old boot', icon: 15, tier: 0, v: 1, hard: .05, w: 1.3, junk: true, desc: 'Not a fish. Someone, somewhere, is missing it.' },
  { id: 'pearl', name: 'Pearl', icon: 45, tier: 3, v: 120, treasure: true, desc: 'Found in a treasure chest snagged on your line. Old Tam pays well for these.' },
];
// The fish themselves: not treasure, not boots.
export const CATCHES = FISH.filter(f => !f.treasure);
export const FISH_BY = Object.fromEntries(FISH.map(f => [f.id, f]));
export const TIERS = ['Junk', 'Common', 'Uncommon', 'Rare', 'Legendary'];
export const ICON = { bobber: 12, rod: 13, pack: 14, chest: 37, chestOpen: 38, trap: 39, trapFull: 40, sun: 41, moon: 42, crate: 43, bowl: 44, pearl: 45, blossom: 46, leaf: 47, glow: 48, chum: 49, lure: 50, float: 51, boat: 52, ticket: 53, curse: 54, fork: 55 };
export const ITEM_COLS = 16, ITEM_ROWS = 8;
export const DEMON_LANDS = [11, 12];
// Rods: a better rod brings bites sooner, gives a wider band to reel with and turns up rarer fish.
export const RODS = [null,
  { name: 'Twig rod', bite: 1, band: .25, luck: 0 },
  { name: 'Willow rod', bite: .8, band: .3, luck: .35 },
  { name: 'Ashwood rod', bite: .66, band: .35, luck: .7 },
  { name: 'Demonbone rod', bite: .52, band: .41, luck: 1.1 }];
export const STACK = 10, BAG0 = 8, BAG_MAX = 40;
const POND_T = 178, LAKE_ZONE = LAKE.land * 9 + LAKE.glade;
// Night falls on the same clock the land's light uses (a day is eight minutes).
export const isNight = (s, age = s.age) => (Math.cos((age / 480) % 1 * 6.283) * -1 - .35) / .65 > .4;
export function clockOf(s) {
  const night = isNight(s); let k = 0;
  while (k < 480 && isNight(s, s.age + k) === night) k += 2;
  return { night, left: k };
}
const SEASON_LEN = 1200, SEASON_NAMES = ['spring', 'summer', 'autumn', 'winter'];
export const seasonNow = s => SEASON_NAMES[Math.floor((s.age || 0) / SEASON_LEN) % 4];
export const conditions = s => ({ night: isNight(s), season: seasonNow(s), rain: s.wx?.kind === 'rain', glow: s.baitOn === 'glow' && s.bait?.glow > 0, lure: !!s.tackle?.lure });

export function fishingInit(s) {
  s.bag ||= []; s.bagSize ||= BAG0; s.rod ||= 1; s.quests ||= {}; s.caught ||= {}; s.boon ||= 0; s.tank ||= {}; s.traps ||= []; s.trapsOwned ||= 0; s.bait ||= { glow: 0, chum: 0 }; s.tackle ||= {}; s.baitOn ||= '';
  s.bag = s.bag.filter(q => FISH_BY[q.id] && q.n > 0);
}

// The water at a texel, if there is any you could cast into: the sea off any coast of a woken glade, or rivers,
// ponds and the great lake once their water has come back.
export function waterAt(s, w, x, y) {
  x = Math.floor(x); y = Math.floor(y);
  if (x < 0 || y < 0 || x >= TW || y >= TH) return null;
  const i = y * TW + x, t = w.waterT[i];
  let kind, zone;
  if (t < 255) {
    zone = w.waterZ[i];
    if (s.zones[zone].water * 254 < t) return null; // still a dry bed
    kind = t >= POND_T ? (zone === LAKE_ZONE ? 'lake' : 'pond') : 'river';
  } else if (w.edge[i] === SEA) {
    const col = Math.floor(x / LW), row = Math.floor(y / LH);
    if (!LANDS.some(L => L.col === col && L.row === row)) return null; // the open ocean, far from any shore
    zone = w.zone[Math.floor(y / CELL) * CW + Math.floor(x / CELL)];
    kind = 'sea';
  } else return null;
  if (!s.zones[zone]?.open) return { kind, zone, land: ZONES[zone].land, region: LANDS[ZONES[zone].land].name, asleep: true };
  return { kind, zone, land: ZONES[zone].land, region: LANDS[ZONES[zone].land].name };
}

// What bites: weighted by the water, the region, the hour and the rod.
// Water you may fish: in a woken glade, or anywhere round Demonreach once you have a ferry ticket.
export const canFish = (s, w) => !!w && (!w.asleep || (!!s.ferry && DEMON_LANDS.includes(w.land)));
export function catchTable(kind, region, rod = 1, cond = {}, maxTier = 4) {
  const luck = RODS[rod].luck, out = [];
  for (const f of CATCHES) {
    if (f.region && f.region !== region) continue;
    if (f.waters && !f.waters.includes(kind)) continue;
    if (f.night && !cond.night && !cond.glow) continue;
    if (f.season && f.season !== cond.season) continue;
    if (f.rain && !cond.rain) continue;
    if (f.tier > maxTier) continue;
    if ((f.rod || 1) > rod) continue;
    let w = f.w * (f.more?.[region] || 1);
    if (f.junk) w /= 1 + luck * 1.5;
    else if (f.tier >= 3) w *= (1 + luck) * (cond.lure ? 1.5 : 1);
    if (f.night && cond.glow) w *= 2;
    out.push([f, w]);
  }
  return out;
}
export function rollCatch(kind, region, rod = 1, cond = {}, r = Math.random, maxTier = 4) {
  const t = catchTable(kind, region, rod, cond, maxTier), sum = t.reduce((a, [, w]) => a + w, 0);
  let k = r() * sum;
  for (const [f, w] of t) { k -= w; if (k <= 0) return f; }
  return t[t.length - 1][0];
}
// Where a fish is found, in a few words, for the quest and backpack windows.
const WATER_NAMES = { river: 'rivers', pond: 'ponds', lake: 'the great lake', sea: 'the sea' };
export function fishWhere(f) {
  if (f.where) return f.where; // bugs and finds say where they are found
  if (f.junk) return 'Any water, sadly';
  if (f.treasure) return 'Treasure chests on the reel';
  const waters = f.waters ? f.waters.map(k => WATER_NAMES[k]).join(' or ') : 'any water';
  const parts = [f.region ? `${waters} in ${f.region}` : waters];
  if (f.more && !f.region) parts.push(`most in ${Object.keys(f.more).join(' and ')}`);
  if (f.night) parts.push('at night');
  if (f.season) parts.push(`only in ${f.season}`);
  if (f.rain) parts.push('only in the rain');
  if (f.rod > 1) parts.push(f.rod === RODS.length - 1 ? `needs the ${RODS[f.rod].name}` : `${RODS[f.rod].name} or better`);
  return parts.join(' · ').replace(/^./, c => c.toUpperCase());
}
// What a fish sells for grows with what the restored land earns, so a catch is worth landing all game long.
// About half its base value in seconds of income: a catch is worth landing all game long.
export const fishWorth = (f, inc) => Math.max(1, Math.round(f.v * (1 + inc * .5)));
// Old Tam's market pays double for one fish each day.
const WANTED = CATCHES.filter(f => f.tier >= 1 && f.tier <= 3 && !f.night && !f.region && !f.season && !f.rain);
export const wantedFish = s => WANTED[Math.floor((s.age || 0) / 480 * 7.3) % WANTED.length];
export const marketPrice = (s, f, inc) => fishWorth(f, inc) * (wantedFish(s) === f ? 2 : 1);

/* The backpack: slots of up to ten of a kind. */
const anyFish = f => !f.junk && !f.treasure && !f.kind;
const fits = (q, id, cursed) => !!q.cursed === !!cursed && (id === 'any' ? anyFish(FISH_BY[q.id]) : q.id === id);
export const bagCount = (s, id, cursed = false) => s.bag.reduce((a, q) => a + (fits(q, id, cursed) ? q.n : 0), 0);
export function bagAdd(s, id, cursed = false) {
  const q = s.bag.find(q => q.id === id && !!q.cursed === !!cursed && q.n < STACK);
  if (q) { q.n++; return true; }
  if (s.bag.length >= s.bagSize) return false;
  s.bag.push(cursed ? { id, n: 1, cursed: true } : { id, n: 1 }); return true;
}
// Takes n of a fish (for 'any', the least valuable fish first). Returns how many were taken.
export function bagTake(s, id, n, cursed = false) {
  let left = n;
  const order = s.bag.filter(q => fits(q, id, cursed)).sort((a, b) => FISH_BY[a.id].v - FISH_BY[b.id].v || a.n - b.n);
  for (const q of order) { const k = Math.min(q.n, left); q.n -= k; left -= k; if (!left) break; }
  s.bag = s.bag.filter(q => q.n > 0);
  return n - left;
}
// Fish the open quests still need: kept back when you sell everything.
export function questNeeds(s) {
  const need = {};
  for (const g in GIVERS) { if (!questState(s, g).taken) continue; for (const w of questOf(s, g).want) if (w.fish && w.fish !== 'any') { const k = w.fish + (w.cursed ? '*' : ''); need[k] = (need[k] || 0) + w.n; } }
  return need;
}
export const CRATE = .6;
export const cratePrice = (s, f, inc) => Math.max(1, Math.round(fishWorth(f, inc) * CRATE));
export const CURSED_PRICE = 3;
export function priceOf(s, q, inc, who = 'tam') {
  const f = FISH_BY[q.id];
  if (who === 'lord') return q.cursed ? fishWorth(f, inc) * CURSED_PRICE : 0;
  if (who === 'crate') return cratePrice(s, f, inc);
  if ((f.buyer || 'tam') !== who) return 0; // Old Tam buys fish, Pip bugs, Bramwell fossils and relics
  return q.cursed ? 0 : who === 'tam' ? marketPrice(s, f, inc) : fishWorth(f, inc);
}
const buyer = who => who === true ? 'crate' : who || 'tam';
const keyOf = q => q.id + (q.cursed ? '*' : '');
export function sellSlot(s, slot, n, inc, who = 'tam') {
  const q = s.bag[slot]; if (!q) return 0;
  const price = priceOf(s, q, inc, buyer(who)); if (!price) return 0;
  const k = Math.min(n, q.n), gain = price * k;
  q.n -= k; if (!q.n) s.bag.splice(slot, 1);
  s.seeds += gain; s.sold = (s.sold || 0) + k; return gain;
}
// Sells everything except what open quests still ask for.
export function sellAll(s, inc, who = 'tam') {
  const keep = keepFor(s, who); let gain = 0;
  for (let i = s.bag.length - 1; i >= 0; i--) {
    const q = s.bag[i], k = keyOf(q), hold = Math.min(q.n, keep[k] || 0); keep[k] = (keep[k] || 0) - hold;
    if (q.n > hold && priceOf(s, q, inc, buyer(who))) gain += sellSlot(s, i, q.n - hold, inc, who);
  }
  return gain;
}
// What "sell everything" holds back: what quests need, and anything the buyer would rather see on show first.
const keepFor = (s, who) => { const keep = questNeeds(s); for (const [k, n] of Object.entries(GIVERS[buyer(who)]?.keep?.(s) || {})) keep[k] = (keep[k] || 0) + n; return keep; };
export const bagWorth = (s, inc, who = 'tam') => { const keep = keepFor(s, who); return s.bag.reduce((a, q) => { const k = keyOf(q), hold = Math.min(q.n, keep[k] || 0); keep[k] = (keep[k] || 0) - hold; return a + priceOf(s, q, inc, buyer(who)) * (q.n - hold); }, 0); };
// A bigger backpack can also be bought from Old Tam: four more slots at a time.
export const bagCost = s => Math.round(150 * Math.pow(3, (s.bagSize - BAG0) / 4));

/* Demonreach's twist: fish from its waters sometimes come up cursed. They glow, fight harder and frighten Old
   Tam, but Lord Cinderbrow pays three times their worth for them. */
export const CURSE_CHANCE = .3;
export const rollCursed = (w, f, r = Math.random) => w?.region === 'Demonreach' && !f.junk && !f.treasure && r() < CURSE_CHANCE;

/* Bait (a few uses, chosen before you cast) and tackle (kept for good), all sold by Old Tam. */
export const BAIT = {
  glow: { name: 'Glow-worm bait', icon: 48, n: 5, price: 2, desc: 'Night fish bite at any hour, and twice as often.' },
  chum: { name: 'Chum', icon: 49, n: 5, price: 1.2, desc: 'Fish find your line twice as fast.' },
};
export const TACKLE = {
  lure: { name: 'Shiny lure', icon: 50, price: 14, desc: 'Rare and legendary fish bite half again as often.' },
  float: { name: 'Quill float', icon: 51, price: 9, desc: 'A bite lasts much longer before the fish lets go.' },
};
export const shopPrice = (k, inc) => questSeeds(k, inc);
// Uses one bait if any is chosen. Returns the bait used, or ''.
export function useBait(s) {
  const k = s.baitOn; if (!k || !(s.bait[k] > 0)) { s.baitOn = ''; return ''; }
  s.bait[k]--; if (!s.bait[k]) s.baitOn = '';
  return k;
}

/* The ferry: Old Tam's cousin rows you to Demonreach, so you can fish round the isle before it is restored and
   call on its lord. It opens once Tam trusts you (six of his quests) or four lands are restored. */
export const ferryOpen = (s, lands) => (s.quests?.fisher?.n || 0) >= 6 || lands >= 4;
export const ferryCost = inc => questSeeds(20, inc);

/* The aquarium in Sunfall: one of each fish, donated, adds to all earnings for good, more for rarer fish. */
export const TANK_BONUS = [0, .006, .009, .014, .028]; // all of them together: +40%
export const canDonate = f => !f.junk && !f.treasure;
export const tankBonus = s => Object.keys(s.tank || {}).reduce((a, id) => a + (FISH_BY[id] ? TANK_BONUS[FISH_BY[id].tier] : 0), 0);
export const tankMax = () => CATCHES.filter(canDonate).reduce((a, f) => a + TANK_BONUS[f.tier], 0);
export function donate(s, id) {
  const f = FISH_BY[id];
  if (!f || !canDonate(f) || s.tank[id] || !bagCount(s, id)) return false;
  bagTake(s, id, 1); s.tank[id] = 1; return true;
}

/* Fish traps: set in water, they catch common and uncommon fish on their own, one every four minutes, up to five. */
export const TRAP = { every: 240, cap: 5, max: 4 };
export const trapCost = s => Math.round(400 * Math.pow(3.2, s.trapsOwned || 0));
export const trapCount = (s, t) => Math.min(TRAP.cap, Math.floor(((s.age || 0) - t.t) / TRAP.every));
export function emptyTrap(s, t, r = Math.random) {
  const n = trapCount(s, t), got = [];
  for (let k = 0; k < n; k++) {
    const f = rollCatch(t.kind, t.region, 1, { season: seasonNow(s) }, r, 2);
    if (f.junk) { got.push(f); continue; }
    if (!bagAdd(s, f.id)) break;
    got.push(f); s.caught[f.id] = (s.caught[f.id] || 0) + 1;
  }
  t.t += got.length * TRAP.every;
  if (n === TRAP.cap && got.length === n) t.t = s.age || 0; // a full trap catches nothing more until emptied
  return got;
}

/* Treasure: a chest that drifts across the reel. Hold it in the band to keep it. */
export function openChest(s, inc, r = Math.random) {
  const out = { seeds: questSeeds(3 + r() * 4, inc) };
  s.seeds += out.seeds;
  if (r() < .35 && bagAdd(s, 'pearl')) out.pearl = true;
  return out;
}

/* Quests. Each giver has a ladder from easy to hard (stars), then endless small orders once it runs out. */
const DEMON = [11, 12];
const Q = (stars, title, ask, want, thanks, reward) => ({ stars, title, ask, want: want.map(([fish, n, cursed]) => cursed ? { fish, n, cursed } : { fish, n }), thanks, reward });
export const GIVERS = {
  fisher: { name: 'Old Tam', role: 'the pier fisherman', portrait: 1, quests: [
    Q(1, 'First bites', 'A new face on my pier! Fish are coming back to these waters, you know. Bring me three minnows and we\'ll see if you\'ve the knack.', [['minnow', 3]], 'Ha! Fresh as morning. You\'ve the knack, all right.', { seeds: 3 }),
    Q(1, 'Pond life', 'The still ponds are waking up. Two bluegills and a fantail guppy, if you please. My granddaughter keeps a bowl.', [['bluegill', 2], ['guppy', 1]], 'Look at that guppy\'s tail! She\'ll be over the moon.', { seeds: 4 }),
    Q(1, 'River runners', 'Trout like moving water: the rivers that run from the springs. Two of them would make a fine supper.', [['trout', 2]], 'Lovely speckles on those. Here, this willow rod was my father\'s. It bends but it never breaks.', { seeds: 5, rod: 2 }),
    Q(1, 'Perch for supper', 'Three striped perch from the lake or a river. Fried in butter, there\'s nothing better.', [['perch', 3]], 'You\'ll be wanting room for more, so take this bigger pack.', { seeds: 6, bag: 4 }),
    Q(2, 'Off the end of the pier', 'Now the sea. Cast past the breakers off any coast and bring me two sea bass.', [['bass', 2]], 'That\'s proper fish. The sea\'s been kind to you.', { seeds: 8 }),
    Q(2, 'Whiskers and mud', 'Mistfen\'s bogs are full of odd things. A catfish, and one of those mudskippers that hop about on the bank.', [['catfish', 1], ['mudskipper', 1]], 'It looked at me! The mudskipper. It looked right at me.', { seeds: 10 }),
    Q(2, 'Reef colours', 'They say the sea round Coral Reach is full of colour. Bring me a sunny tang and a clownfish to prove it.', [['tang', 1], ['clown', 1]], 'Like holding a sunset in each hand. Here, a bigger pack for a bigger world.', { seeds: 12, bag: 4 }),
    Q(2, 'Rainbow run', 'Two rainbow trout and a pike. The rainbows like cold water; the pike likes the great lake and biting people.', [['rainbow', 2], ['pike', 1]], 'All my fingers still on? Good. You\'ve earned my ashwood rod. Rare fish can\'t resist it.', { seeds: 14, rod: 3 }),
    Q(3, 'The lucky ones', 'Now for a bit of luck: a golden carp from the still water and a seahorse from the sea.', [['carp', 1], ['seahorse', 1]], 'Gold as a sunrise and a little sea pony besides. I believe in luck again.', { seeds: 20 }),
    Q(3, 'Night shift', 'Some fish only rise after dark. Wait for night and bring me a moonfish from a pond and a starry nightfin from a river.', [['moonfish', 1], ['nightfin', 1]], 'The moon and the stars, in my own two hands. Take my good pack, friend.', { seeds: 25, bag: 4 }),
    Q(3, 'Three far waters', 'Every land has its own fish. A frostfin from Frostmere, an ember koi from Ember Basin and a glimmer tetra from Glimmerdeep.', [['frostfin', 1], ['koi', 1], ['tetra', 1]], 'I\'ve waited forty years to see those three side by side.', { seeds: 30 }),
    Q(3, 'Lanterns and frills', 'A lantern angler lights its lamp in the night sea. And there\'s a frilly axolotl hiding in some weedy pond. One of each?', [['angler', 1], ['axolotl', 1]], 'One glows and the other smiles. What a pair.', { seeds: 35 }),
    Q(3, 'The mushroom wood', 'On the south island, in Sporewood, there\'s a fish that wears a toadstool for a hat. Two capfish, and I\'ll stop asking silly questions.', [['capfish', 2]], 'Hats! Actual hats! I\'ll never stop asking silly questions.', { seeds: 38 }),
    Q(4, 'The burning sea', 'Sailors whisper of an isle to the north, all crimson and horns, where fish swim through fire. A lavafin... I\'d give anything to hold one.', [['lavafin', 1]], 'It\'s warm! Like holding a coal that wriggles. Bless you.', { seeds: 45 }),
    Q(4, 'Ghost of the shallows', 'There\'s a minnow you can see right through. It bites in any water, but only on the darkest nights, and only for a better rod than a twig.', [['ghost', 1]], 'I saw one once, when I was a boy. Nobody believed me. Thank you.', { seeds: 60, bag: 4 }),
    Q(4, 'The salmon king', 'The king of the rivers wears a crown. Truly! He\'ll snap a lesser rod; you\'ll want ashwood at least.', [['salmon', 1]], 'Long live the king. Now put him back in my bucket, gently.', { seeds: 80 }),
    Q(4, 'The dragon of the lake', 'My last wish. In the great lake lives a koi older than the hills, with horns and whiskers. Only a Demonbone rod could hold it, they say.', [['dragon', 1]], 'A dragon. A real dragon, in my hands. I can go fishing in peace now, friend. Forever.', { seeds: 150 }),
  ], orders: ['perch', 'trout', 'bass', 'bluegill', 'catfish', 'rainbow', 'pike', 'eel', 'tang', 'puffer', 'seahorse', 'carp'] },
  lord: { name: 'Lord Cinderbrow', role: 'Master of Demonreach', portrait: 0, quests: [
    Q(2, 'Tribute for the horde', 'So, a gardener dares my steps. My imps are RAVENOUS, mortal. Five fish, any kind, and I may let you keep your little spirits.', [['any', 5]], 'Hmph. Adequate. The imps adore you now, which is disgusting. Take my blessing: your lands will earn a little more.', { seeds: 10, boon: .03 }),
    Q(2, 'Fire from the deep', 'The lavafin swims only in MY waters. Bring me two, and I will carve you a rod from the bones of something terrible.', [['lavafin', 2]], 'Exquisite. Behold: the Demonbone rod. Try not to scream when it bites.', { seeds: 20, rod: 4 }),
    Q(3, 'A dreadful stew', 'I hunger for stew. A dreadful stew. It wants an eel, a pufferfish and a mudskipper. Do NOT ask what else goes in it.', [['eel', 1], ['puffer', 1], ['mudskipper', 1]], 'Mmm. Bubbling nicely. Here, a bigger sack. Carry my glory further.', { seeds: 25, bag: 4, boon: .03 }),
    Q(3, 'The crimson realm reborn', 'My isle lies grey and dead. Restore every glade of Demonreach so that its crimson may burn again.', [], 'LOOK at it. Crimson as a dragon\'s blush. You may consider yourself... a friend of the throne.', { seeds: 60, boon: .06 }),
    Q(3, 'Cursed delicacies', 'Fish from my waters sometimes come up... changed. Glowing. Grumpy. Delicious. Bring me three cursed fish of any kind.', [['any', 3, true]], 'Still twitching! Exquisite. Take this, and bring me every cursed fish you find: I pay far better than that sailor of yours.', { seeds: 35, boon: .03 }),
    Q(3, 'Creatures of the dark', 'I collect things of the night. An angler, a nightfin and a moonfish. For my aquarium. It is very gloomy. I adore it.', [['angler', 1], ['nightfin', 1], ['moonfish', 1]], 'They glow so beautifully in the gloom. You have taste, for a mortal.', { seeds: 45, boon: .03 }),
    Q(3, 'My stolen boot', 'A fish stole my favourite boot. I will not elaborate. Find it.', [['boot', 1]], 'MY BOOT! The fish shall pay. Not you. You may have the gratitude of a demon, which is rarer than you think.', { seeds: 40, boon: .03 }),
    Q(4, 'A crown for a king', 'There is a salmon in your rivers that dares to wear a CROWN. Bring it to me. And a capfish, for its little hat.', [['salmon', 1], ['capfish', 1]], 'Now *I* have two crowns and a hat. As it should be.', { seeds: 90, boon: .03 }),
    Q(4, 'The ghosts in my moat', 'My moat is too ordinary. I want ghosts in it. Two ghost minnows.', [['ghost', 2]], 'Delightfully haunting. My moat is the envy of the underworld.', { seeds: 100, boon: .06 }),
    Q(4, 'Dragon\'s ransom', 'The dragon koi of your great lake. Bring it to me and you shall have my eternal favour. I do not offer this lightly.', [['dragon', 1]], 'Magnificent. Kneel. No, I am joking. Stand, friend of Demonreach. All that you grow shall flourish.', { seeds: 200, boon: .08 }),
  ], orders: ['lavafin', 'any', 'koi', 'frostfin', 'pike', 'eel', 'angler', 'nightfin'] },
};
GIVERS.lord.quests[3].want = [{ glades: DEMON, n: 18, label: 'Demonreach glades restored' }];
export const questState = (s, g) => (s.quests[g] ||= { n: 0, taken: false });
// The quest a giver has for you now: from the ladder, or a small order once the ladder is done.
export function questOf(s, g) {
  const G = GIVERS[g], q = questState(s, g);
  if (q.n < G.quests.length) return G.quests[q.n];
  if (G.order) return G.order(q.n - G.quests.length, s);
  const k = q.n - G.quests.length, pick = G.orders[(k * 5 + 3) % G.orders.length], want = pick === 'any' ? 6 + k % 4 : FISH_BY[pick].tier >= 3 ? 1 + k % 2 : 2 + k % 3;
  const name = pick === 'any' ? 'fish of any kind' : FISH_BY[pick].name.toLowerCase() + (want > 1 ? 's' : '');
  return g === 'lord'
    ? k % 3 === 2 ? { stars: 3, title: 'Cursed tribute', ask: `My larder lacks a certain... glow. ${2 + k % 3} cursed fish, any kind.`, want: [{ fish: 'any', n: 2 + k % 3, cursed: true }], thanks: 'Ahh. Still warm with wickedness.', reward: { seeds: 14 + Math.min(k, 15) * 2 }, order: true }
    : { stars: 2, title: 'Tribute', ask: `My imps grow restless again. ${want} ${name}, mortal. Promptly.`, want: [{ fish: pick, n: want }], thanks: 'Acceptable. Begone, and come back with more.', reward: { seeds: 8 + Math.min(k, 15) * 2 }, order: true }
    : { stars: 1, title: 'An order for the market', ask: `The market in Sunfall wants ${want} ${name}. Fancy the job? I'll split the takings with you.`, want: [{ fish: pick, n: want }], thanks: 'Lovely work. Here\'s your share.', reward: { seeds: 6 + Math.min(k, 15) * 2 }, order: true };
}
export const wantHave = (s, w) => w.has ? w.has(s) : w.glades ? ZONES.filter(z => w.glades.includes(z.land) && s.zones[z.id].done).length : bagCount(s, w.fish, !!w.cursed);
export const wantLabel = w => w.label ? w.label : (w.cursed ? 'Cursed ' : '') + (w.fish === 'any' ? (w.cursed ? 'fish of any kind' : 'Any fish') : w.cursed ? FISH_BY[w.fish].name.toLowerCase() : FISH_BY[w.fish].name);
export const questReady = (s, g) => questOf(s, g).want.every(w => wantHave(s, w) >= w.n);
// Seeds as a reward scale with income, like favours do.
// About 8 seconds of income per point of reward.
export const questSeeds = (k, inc) => Math.round(k * (25 + inc * 8));
export function turnIn(s, g, inc) {
  const Q = questOf(s, g), q = questState(s, g);
  if (!q.taken || !questReady(s, g)) return null;
  for (const w of Q.want) if (w.fish) bagTake(s, w.fish, w.n, !!w.cursed);
  const r = Q.reward, got = { seeds: questSeeds(r.seeds || 0, inc) };
  s.seeds += got.seeds;
  if (r.rod && r.rod > s.rod) { s.rod = r.rod; got.rod = RODS[r.rod].name; }
  if (r.bag) { s.bagSize = Math.min(BAG_MAX, s.bagSize + r.bag); got.bag = r.bag; }
  if (r.boon) { s.boon = Math.round((s.boon + r.boon) * 100) / 100; got.boon = r.boon; }
  if (r.tool && (s[r.tool.key] || 0) < r.tool.level) { s[r.tool.key] = r.tool.level; got.tool = r.tool; }
  q.n++; q.taken = false;
  return got;
}
// What a giver's marker shows over their head: ! for a new quest, ? when you have what they asked for.
export const questMark = (s, g) => { const q = questState(s, g); return !q.taken ? '!' : questReady(s, g) ? '?' : ''; };
