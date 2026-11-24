// Bugs and buried things: Pip the bug catcher in Honey Meadow and Bramwell the digger at Red Terrace. Rules only;
// the net, the dig spots and their windows live in keepers.mjs. Everything you find goes into the same backpack as
// your fish, so it is registered alongside them in FISH_BY, with a `kind` and the `buyer` who pays for it.
import { CELL, CW, TW, TH, ZONES, LANDS, KIND } from './world.mjs?v=40';
import { FISH_BY, GIVERS, questState, questSeeds, fishWorth } from './fishing.mjs?v=40';

export const PIP_ZONE = 4, BRAM_ZONE = 12; // Honey Meadow in Hollow Vale; Red Terrace in Ember Basin

/* Bugs. Each lives in a habitat (meadow, tree, water or shore), at an hour, in seasons, sometimes in one region or
   only in the rain, and moves in its own way: it flutters, hovers, hops, crawls, perches on a trunk or glows. `shy`
   is how easily it is startled (0 to 1); `size` is how big it is drawn, in texels. Icons are cells 64-95 of items.png. */
const ALL = ['spring', 'summer', 'autumn', 'winter'], WARM = ['spring', 'summer', 'autumn'];
const B = (id, name, icon, tier, v, w, o, desc) => ({ id, kind: 'bug', buyer: 'pip', name, icon, tier, v, w, seasons: ALL, ...o, desc });
export const BUGS = [
  B('cabbage', 'Cabbage white', 64, 1, 10, 9, { hab: ['meadow'], move: 'flutter', day: true, seasons: WARM, shy: .2, size: 8 }, 'A plain white butterfly with smudged black wing tips. The first sign of spring.'),
  B('bee', 'Honeybee', 65, 1, 12, 7, { hab: ['meadow'], move: 'hover', day: true, seasons: ['spring', 'summer'], shy: .3, size: 6 }, 'Busy, fuzzy and always on its way somewhere with flowers.'),
  B('ladybug', 'Ladybug', 66, 1, 14, 6, { hab: ['meadow'], move: 'crawl', day: true, seasons: WARM, shy: .1, size: 5 }, 'Red with black spots. Gardeners love it: it eats the aphids.'),
  B('hopper', 'Grasshopper', 67, 1, 16, 7, { hab: ['meadow'], move: 'hop', day: true, seasons: ['summer', 'autumn'], shy: .35, size: 7 }, 'Springs away the moment you get close. Listen for it in long grass.'),
  B('moth', 'Dusk moth', 68, 1, 12, 8, { hab: ['meadow', 'tree'], move: 'flutter', night: true, seasons: ALL, shy: .2, size: 7 }, 'Dusty brown wings that come out after dark.'),
  B('damsel', 'Blue damselfly', 69, 1, 18, 6, { hab: ['water'], move: 'hover', day: true, seasons: ['spring', 'summer'], shy: .4, size: 8 }, 'Thin as a needle and bright blue. It rests with its wings folded.'),
  B('cricket', 'Field cricket', 70, 1, 16, 6, { hab: ['meadow'], move: 'hop', night: true, seasons: ['summer', 'autumn'], shy: .35, size: 6 }, 'The chirping you hear on warm nights.'),
  B('pillbug', 'Pill bug', 71, 1, 8, 6, { hab: ['meadow', 'tree'], move: 'crawl', rain: 'more', shy: .05, size: 5 }, 'Rolls into a ball when you pick it up. Comes out in the rain.'),
  B('monarch', 'Monarch butterfly', 72, 2, 40, 3, { hab: ['meadow'], move: 'flutter', day: true, seasons: ['summer', 'autumn'], shy: .35, size: 10 }, 'Orange and black, a long-distance traveller.'),
  B('dragonfly', 'Emerald dragonfly', 73, 2, 48, 3, { hab: ['water'], move: 'hover', day: true, seasons: ['summer'], shy: .55, size: 10 }, 'The fastest flier on the water. Good luck.'),
  B('firefly', 'Firefly', 74, 2, 45, 4, { hab: ['water', 'meadow'], move: 'glow', night: true, seasons: ['spring', 'summer'], shy: .25, size: 6 }, 'A beetle with a lantern for a tail. Drifts over still water on summer nights.'),
  B('snail', 'Garden snail', 75, 2, 30, 5, { hab: ['meadow', 'tree'], move: 'crawl', rain: 'only', shy: 0, size: 6 }, 'Only out in the rain. Never in a hurry.'),
  B('bumble', 'Bumblebee', 76, 2, 36, 4, { hab: ['meadow'], move: 'hover', day: true, seasons: ['spring'], shy: .3, size: 7 }, 'Round, fuzzy and far too heavy to fly. It flies anyway.'),
  B('mantis', 'Praying mantis', 77, 2, 55, 2.5, { hab: ['meadow'], move: 'crawl', day: true, seasons: ['summer', 'autumn'], shy: .3, size: 9 }, 'Holds very still, then strikes. Looks like a twig with opinions.'),
  B('cicada', 'Cicada', 78, 2, 50, 4, { hab: ['tree'], move: 'perch', day: true, seasons: ['summer'], shy: .5, size: 8 }, 'Sings from the tree trunks all summer long.'),
  B('stick', 'Walking stick', 79, 2, 52, 2.5, { hab: ['tree'], move: 'perch', seasons: ['summer', 'autumn'], shy: .1, size: 10 }, 'You may have looked straight at it a dozen times.'),
  B('crab', 'Hermit crab', 80, 2, 40, 5, { hab: ['shore'], move: 'crawl', shy: .45, size: 7 }, 'Not a bug, Pip admits, but it lives in a borrowed shell on the sand and that counts.'),
  B('wintermoth', 'Winter moth', 81, 2, 60, 4, { hab: ['meadow', 'tree'], move: 'flutter', night: true, seasons: ['winter'], region: 'Frostmere', shy: .3, size: 7 }, 'Flies on the coldest nights in Frostmere, when nothing else does.'),
  B('stag', 'Stag beetle', 82, 3, 110, 1.6, { hab: ['tree'], move: 'perch', night: true, seasons: ['summer'], shy: .4, size: 9 }, 'Great antler jaws. Clings to tree trunks on summer nights.'),
  B('atlas', 'Atlas moth', 83, 3, 130, 1, { hab: ['tree'], move: 'flutter', night: true, seasons: ['summer', 'autumn'], shy: .4, size: 12 }, 'One of the biggest moths there is. Its wing tips look like snakes.'),
  B('jewel', 'Jewel beetle', 84, 3, 120, 1.2, { hab: ['tree'], move: 'perch', day: true, seasons: ['summer'], shy: .55, size: 7 }, 'Shines green and gold in the sun, like a cut gem.'),
  B('luna', 'Luna moth', 85, 3, 125, 1.2, { hab: ['meadow', 'tree'], move: 'flutter', night: true, seasons: ['spring'], shy: .45, size: 11 }, 'Pale green, with long trailing tails. Only on spring nights.'),
  B('glasswing', 'Glasswing butterfly', 86, 3, 140, 3, { hab: ['meadow'], move: 'flutter', day: true, region: 'Glimmerdeep', shy: .5, size: 9 }, 'Its wings are clear as glass. It lives among the crystals of Glimmerdeep.'),
  B('velvet', 'Red velvet ant', 87, 3, 150, 3, { hab: ['meadow'], move: 'crawl', day: true, region: 'Demonreach', shy: .4, size: 6 }, 'Fuzzy, scarlet and not an ant at all. Thrives on the hot ground of Demonreach.'),
  B('waterbug', 'Giant water bug', 88, 3, 120, 3, { hab: ['water'], move: 'crawl', region: 'Mistfen', shy: .4, size: 9 }, 'Lurks in the bog pools of Mistfen. Do not let it pinch you.'),
  B('molecricket', 'Mole cricket', 89, 3, 100, 0, { hab: [], move: 'crawl', shy: 0, size: 7, dig: true }, 'Lives underground and digs with shovel hands. You only find one by digging.'),
  B('bombardier', 'Bombardier beetle', 90, 3, 130, 3, { hab: ['meadow'], move: 'crawl', region: 'Ember Basin', shy: .5, size: 6 }, 'Puffs a hot little pop when cornered. Right at home in Ember Basin.'),
  B('fungus', 'Fungus beetle', 91, 3, 120, 3, { hab: ['tree', 'meadow'], move: 'crawl', region: 'Sporewood', shy: .3, size: 6 }, 'Orange and black, it feeds on the toadstools of Sporewood.'),
  B('goldstag', 'Golden stag', 92, 4, 500, 1, { hab: ['tree'], move: 'perch', shy: .6, size: 10 }, 'A stag beetle of pure gold. Pip has only ever heard of one.'),
  B('birdwing', 'Queen birdwing', 93, 4, 600, 1, { hab: ['meadow'], move: 'flutter', day: true, seasons: ['summer'], shy: .6, size: 14 }, 'The largest butterfly in the world, green and black. A summer marvel.'),
  B('orchid', 'Orchid mantis', 94, 4, 550, 1, { hab: ['meadow'], move: 'crawl', day: true, seasons: ['spring', 'summer'], shy: .7, size: 9 }, 'Pink and white, it looks exactly like a flower. Until it moves.'),
];
export const BUG_BY = Object.fromEntries(BUGS.map(b => [b.id, b]));
// Nets: a better net reaches further and turns up rare bugs a little more often.
export const NETS = [null, { name: 'Bug net', reach: 9, luck: 0 }, { name: 'Silk net', reach: 12, luck: .4 }, { name: 'Golden net', reach: 15, luck: .9 }];
// How often each tier turns up. Rare bugs appear by chance, not by being in the right place: a legend is about one bug
// in a hundred, and only if one of them could be out right now.
const TIER_ODDS = [0, .66, .26, .07, .01];
export function bugWhere(b) {
  if (b.dig) return 'Dig spots, now and then';
  const hab = { meadow: 'meadows', tree: 'tree trunks', water: 'near water', shore: 'the beach' };
  const parts = [b.hab.map(h => hab[h]).join(' or ') + (b.region ? ` in ${b.region}` : '')];
  if (b.day) parts.push('by day'); if (b.night) parts.push('at night');
  if (b.seasons.length < 4) parts.push(b.seasons.length > 2 ? b.seasons.slice(0, -1).join(', ') + ' or ' + b.seasons.at(-1) : b.seasons.join(' or '));
  if (b.rain === 'only') parts.push('only in the rain'); else if (b.rain) parts.push('more in the rain');
  if (b.tier === 4) parts.push('very rare');
  return parts.join(' · ').replace(/^./, c => c.toUpperCase());
}
// Which bug turns up at a spot: first the tier, by chance, then a bug of that tier that could be out here and now.
export function rollBug(hab, region, cond, net = 1, r = Math.random) {
  const luck = NETS[net]?.luck || 0, odds = TIER_ODDS.map((p, t) => t >= 3 ? p * (1 + luck) : p);
  const fit = b => b.w > 0 && b.hab.includes(hab) && (!b.region || b.region === region) && b.seasons.includes(cond.season) && (!b.day || !cond.night) && (!b.night || cond.night) && (b.rain !== 'only' || cond.rain);
  let k = r() * odds.reduce((a, p) => a + p, 0), tier = 1;
  for (let t = 1; t <= 4; t++) { k -= odds[t]; if (k <= 0) { tier = t; break; } }
  for (let t = tier; t >= 1; t--) {
    const list = BUGS.filter(b => b.tier === t && fit(b)); if (!list.length) continue;
    const ws = list.map(b => b.w * (b.region === region ? 2 : 1) * (b.rain === 'more' && cond.rain ? 3 : 1)), sum = ws.reduce((a, q) => a + q, 0);
    let q = r() * sum; for (let i = 0; i < list.length; i++) { q -= ws[i]; if (q <= 0) return list[i]; }
    return list[list.length - 1];
  }
  return null;
}
// The bug house: one of each bug, donated, adds to all earnings for good, like the aquarium.
export const HOUSE_BONUS = [0, .008, .012, .02, .04];
export const houseBonus = s => Object.keys(s.bugHouse || {}).reduce((a, id) => a + (BUG_BY[id] ? HOUSE_BONUS[BUG_BY[id].tier] : 0), 0);
export const houseMax = () => BUGS.reduce((a, b) => a + HOUSE_BONUS[b.tier], 0);

/* Digging. Dig spots, little star-shaped cracks, turn up on woken ground every day. Dig one with a shovel and you
   find a fossil (Bramwell tells you what it is), a relic, a pouch of seeds, a mole cricket, or an old boot. */
const D = (id, name, icon, tier, v, o, desc) => ({ id, kind: o.kind || 'fossil', buyer: 'bram', name, icon, tier, v, ...o, desc });
export const DIG_ICON = { fossil: 96, spot: 97, hole: 98, shovel: 99, jar: 124, tent: 125, glass: 126, pouch: 123 };
export const FINDS = [
  D('fossil', 'Fossil', 96, 2, 30, { kind: 'raw', buyer: 'none' }, 'Something old, wrapped in rock. Bramwell can tell you what it is.'),
  D('ammonite', 'Ammonite', 100, 2, 70, { set: 'ammonite' }, 'A coiled shell, turned to stone a very long time ago.'),
  D('trilobite', 'Trilobite', 101, 2, 75, { set: 'trilobite' }, 'An ancient sea crawler with a ridged back.'),
  D('fern', 'Fern fossil', 102, 2, 60, { set: 'fern' }, 'The print of a fern frond, pressed into stone.'),
  D('tooth', 'Shark tooth', 103, 2, 80, { set: 'tooth' }, 'A tooth as big as your hand, from a shark as big as a house.'),
  D('amber', 'Amber', 104, 3, 130, { set: 'amber' }, 'Golden tree resin, hardened, with a tiny insect caught inside.'),
  D('mam1', 'Mammoth skull', 105, 3, 110, { set: 'mammoth' }, 'The great domed skull of a woolly mammoth.'),
  D('mam2', 'Mammoth tusks', 106, 3, 100, { set: 'mammoth' }, 'Two long curling tusks.'),
  D('mam3', 'Mammoth body', 107, 3, 100, { set: 'mammoth' }, 'Ribs and spine of a mammoth.'),
  D('rex1', 'T. rex skull', 108, 3, 160, { set: 'rex' }, 'The skull of the tyrant lizard king, all teeth.'),
  D('rex2', 'T. rex torso', 109, 3, 130, { set: 'rex' }, 'Ribs and tiny arms.'),
  D('rex3', 'T. rex tail', 110, 3, 120, { set: 'rex' }, 'A long, heavy tail of stone vertebrae.'),
  D('tri1', 'Triceratops skull', 111, 3, 140, { set: 'tri' }, 'A bony frill and three horns.'),
  D('tri2', 'Triceratops body', 112, 3, 120, { set: 'tri' }, 'The broad ribs of a triceratops.'),
  D('tri3', 'Triceratops tail', 113, 3, 110, { set: 'tri' }, 'A short, stout tail.'),
  D('pte1', 'Pterosaur skull', 114, 3, 130, { set: 'ptero' }, 'A long crested skull with a narrow beak.'),
  D('pte2', 'Pterosaur wings', 115, 3, 120, { set: 'ptero' }, 'Hollow wing bones, light as a bird\'s.'),
  D('pte3', 'Pterosaur body', 116, 3, 110, { set: 'ptero' }, 'A small body and folded legs.'),
  D('coin', 'Ancient coin', 117, 2, 45, { kind: 'relic' }, 'A worn bronze coin. The face on it has long since rubbed away.'),
  D('pot', 'Clay pot', 118, 1, 25, { kind: 'relic' }, 'A little clay pot, cracked but whole.'),
  D('arrow', 'Flint arrowhead', 119, 1, 22, { kind: 'relic' }, 'Knapped from flint by someone very patient.'),
  D('geode', 'Geode', 120, 2, 55, { kind: 'relic' }, 'A plain rock, until you crack it: purple crystals inside.'),
  D('figurine', 'Stone figurine', 121, 3, 120, { kind: 'relic' }, 'A small carved figure, smoothed by many hands.'),
  D('mask', 'Golden mask', 122, 4, 450, { kind: 'relic' }, 'A mask of beaten gold from a forgotten kingdom. Bramwell\'s life\'s dream.'),
  D('key', 'Old iron key', 127, 2, 35, { kind: 'relic' }, 'A heavy key. Whatever it opened is long gone.'),
];
export const FIND_BY = Object.fromEntries(FINDS.map(f => [f.id, f]));
export const SETS = { ammonite: 'Ammonite', trilobite: 'Trilobite', fern: 'Fern fossil', tooth: 'Shark tooth', amber: 'Amber', mammoth: 'Woolly mammoth', rex: 'Tyrannosaurus', tri: 'Triceratops', ptero: 'Pterosaur' };
export const PIECES = FINDS.filter(f => f.set);
export const setPieces = k => PIECES.filter(f => f.set === k);
export const setDone = (s, k) => setPieces(k).every(f => s.museum?.[f.id]);
export const museumCount = s => PIECES.filter(f => s.museum?.[f.id]).length;
export const setsDone = s => Object.keys(SETS).filter(k => setDone(s, k)).length;
// The museum: each piece adds a little to all earnings, and each finished skeleton (or single fossil) a little more.
export const PIECE_BONUS = .004, SET_BONUS = .02;
export const museumBonus = s => museumCount(s) * PIECE_BONUS + setsDone(s) * SET_BONUS;
export const museumMax = () => PIECES.length * PIECE_BONUS + Object.keys(SETS).length * SET_BONUS;
export const SHOVELS = [null, { name: 'Shovel', luck: 0 }, { name: 'Silver shovel', luck: .6 }];
// What a dig spot holds.
export function rollDig(s, r = Math.random) {
  const luck = SHOVELS[s.shovel || 1]?.luck || 0;
  const table = [['fossil', .42 * (1 + luck * .3)], ['pot', .09], ['arrow', .08], ['coin', .07], ['geode', .045], ['key', .035], ['pouch', .14], ['molecricket', .055], ['boot', .045], ['figurine', .022 * (1 + luck)], ['mask', .004 * (1 + luck)]];
  let k = r() * table.reduce((a, [, w]) => a + w, 0);
  for (const [id, w] of table) { k -= w; if (k <= 0) return id; }
  return 'fossil';
}
// Bramwell looks a fossil over and says what it is. He is better at it than luck: pieces you are missing come up more.
export function assess(s, r = Math.random) {
  const have = id => s.museum?.[id] || s.bag.some(q => q.id === id);
  const ws = PIECES.map(f => (have(f.id) ? 1 : 3) * (f.id === 'amber' ? .5 : 1)), sum = ws.reduce((a, q) => a + q, 0);
  let k = r() * sum; for (let i = 0; i < PIECES.length; i++) { k -= ws[i]; if (k <= 0) return PIECES[i]; }
  return PIECES[0];
}
// Dig spots for the day: a few on woken ground, more the more of the continent is restored.
export const DAY = 480;
export function digTarget(s) { const done = s.zones.filter(z => z.done).length; return Math.min(9, 3 + Math.floor(done / 6)); }
export function spawnDigs(s, w, r = Math.random) {
  s.digs ||= [];
  const day = Math.floor((s.age || 0) / DAY);
  if (s.digDay === day && s.digs.length) return 0;
  s.digDay = day;
  const open = ZONES.filter(z => s.zones[z.id].open && w.cellsOf[z.id].length > 20), want = digTarget(s);
  let added = 0;
  for (let tries = 0; tries < 400 && s.digs.length < want && open.length; tries++) {
    const z = open[Math.floor(r() * open.length)], list = w.cellsOf[z.id], c = list[Math.floor(r() * list.length)];
    const x = c % CW * CELL + 2, y = Math.floor(c / CW) * CELL + 2;
    if (s.h[c] < .5 || !w.free(x, y, 14) || w.waterT[Math.floor(y) * TW + Math.floor(x)] !== 255 || w.road[Math.floor(y) * TW + Math.floor(x)]) continue;
    if (s.digs.some(d => Math.hypot(d.x - x, d.y - y) < 120)) continue;
    s.digs.push({ x, y, zone: z.id }); added++;
  }
  return added;
}

/* Everything registers with the backpack. */
for (const b of BUGS) FISH_BY[b.id] = { ...b, where: bugWhere(b) };
for (const f of FINDS) FISH_BY[f.id] = { ...f, where: 'Dig spots' + (f.kind === 'raw' ? '' : f.set ? ' · a fossil, once Bramwell has looked at it' : '') };
for (const b of BUGS) BUG_BY[b.id] = FISH_BY[b.id];

export function findsInit(s) {
  s.net ||= 0; s.shovel ||= 0; s.bugHouse ||= {}; s.museum ||= {}; s.digs ||= []; s.dug ||= 0; s.met ||= {};
}

/* Pip and Bramwell's quests, easy to hard, then small orders. */
const Q = (stars, title, ask, want, thanks, reward) => ({ stars, title, ask, want: want.map(([fish, n]) => ({ fish, n })), thanks, reward });
const NET = n => ({ tool: { key: 'net', level: n, name: NETS[n].name, icon: 95 } });
const SHOVEL = n => ({ tool: { key: 'shovel', level: n, name: SHOVELS[n].name, icon: DIG_ICON.shovel } });
const has = (label, n, icon, fn) => ({ label, n, icon, has: fn });
GIVERS.pip = { name: 'Pip', role: 'the bug catcher of Honey Meadow', quests: [
  Q(1, 'First flutter', 'Oh! Hello! Are you the one waking everything up? The bugs are coming back! Here, take my spare net. Catch me two cabbage whites, the little white butterflies. Swing gently!', [['cabbage', 2]], 'Two! You\'re a natural. I knew it the moment you walked up.', { seeds: 3 }),
  Q(1, 'Garden helpers', 'Bees and ladybugs keep a garden happy. One of each, please, and try not to squish the ladybug.', [['bee', 1], ['ladybug', 1]], 'Perfect! Not a squish on her.', { seeds: 4 }),
  Q(1, 'Long grass', 'Grasshoppers hop away just as you swing. Creep up slowly, then swing. Bring me two!', [['hopper', 2]], 'The creeping works, right? Here, a bigger pack, for all the bugs to come.', { seeds: 5, bag: 4 }),
  Q(1, 'After dark', 'The night has its own bugs. A dusk moth and a field cricket, when the sun goes down.', [['moth', 1], ['cricket', 1]], 'The cricket is singing in my jar. Listen!', { seeds: 6 }),
  Q(2, 'By the water', 'Damselflies and dragonflies love the water. The dragonfly is fast, though. Really fast.', [['damsel', 1], ['dragonfly', 1]], 'You got the dragonfly?! Take my silk net. It reaches further, and rare bugs seem to like it.', { seeds: 8, ...NET(2) }),
  Q(2, 'Rainy day friends', 'When it rains, the slow ones come out. Two garden snails and two pill bugs.', [['snail', 2], ['pillbug', 2]], 'Slimy, rolly, lovely.', { seeds: 9 }),
  Q(2, 'Little lanterns', 'On spring and summer nights fireflies drift over the water. Three of them, for a night light.', [['firefly', 3]], 'My jar is glowing! Here, more room in your pack.', { seeds: 10, bag: 4 }),
  Q(2, 'Orange and fuzzy', 'A monarch butterfly and a bumblebee. One flies far in summer, one only buzzes in spring.', [['monarch', 1], ['bumble', 1]], 'Royalty and fluff, together at last.', { seeds: 12 }),
  Q(2, 'Tree songs', 'Look on the tree trunks! A cicada, and a walking stick, if you can spot it at all.', [['cicada', 1], ['stick', 1]], 'I walked past that stick for a week, you know.', { seeds: 14 }),
  Q(3, 'Shore and stalk', 'A hermit crab from the beach, and a praying mantis from the meadow. Mind the claws, both of them.', [['crab', 1], ['mantis', 1]], 'All my fingers! Thank you.', { seeds: 18 }),
  Q(3, 'Moonlit wings', 'The big moths only come at night. A luna moth in spring, and an atlas moth from the trees. They are rare, so keep watching.', [['luna', 1], ['atlas', 1]], 'They\'re enormous. And so soft. Take my good pack.', { seeds: 25, bag: 4 }),
  Q(3, 'Beetle mania', 'Beetles are the best bugs. Don\'t tell the butterflies. A stag beetle at night and a jewel beetle by day, both on the trees in summer.', [['stag', 1], ['jewel', 1]], 'The jewel beetle! It\'s like holding treasure. You\'ve earned this: my golden net. It turns up the rarest bugs of all.', { seeds: 30, ...NET(3) }),
  Q(3, 'Far-flung', 'Each land has a bug all its own. A glasswing from Glimmerdeep, a bombardier beetle from Ember Basin and a fungus beetle from Sporewood.', [['glasswing', 1], ['bombardier', 1], ['fungus', 1]], 'You went everywhere! I\'ve only read about these.', { seeds: 35 }),
  Q(3, 'The edges of the map', 'And the strangest ones: a winter moth from Frostmere\'s coldest nights, a giant water bug from the Mistfen bogs, and a red velvet ant from the demon isle.', [['wintermoth', 1], ['waterbug', 1], ['velvet', 1]], 'The demon isle! Were you scared? I would have been scared.', { seeds: 40, boon: .03 }),
  Q(4, 'Under our feet', 'Some bugs live underground. Bramwell says his dig spots sometimes turn up a mole cricket, with little shovel hands!', [['molecricket', 1]], 'Shovel hands! Look at its shovel hands!', { seeds: 45 }),
  Q(4, 'The golden stag', 'There\'s a legend of a stag beetle made of gold, clinging to some tree somewhere. You only ever see one by luck.', [['goldstag', 1]], 'It\'s real. It\'s REAL. I\'m going to cry.', { seeds: 80, boon: .03 }),
  Q(4, 'Queen of butterflies', 'The queen birdwing is the biggest butterfly in the world. It only flies on summer days, and hardly ever.', [['birdwing', 1]], 'Its wings are wider than my hands. Thank you, thank you.', { seeds: 100, boon: .03 }),
  Q(4, 'The flower that walks', 'Last one, I promise. Somewhere in the meadows there\'s a flower that isn\'t a flower. The orchid mantis. The rarest of them all.', [['orchid', 1]], 'You found it. You found every one. You\'re the best bug catcher I know, and I know me.', { seeds: 150, boon: .05 }),
], orders: ['cabbage', 'bee', 'ladybug', 'hopper', 'moth', 'cricket', 'damsel', 'monarch', 'firefly', 'cicada', 'mantis', 'crab'] };
GIVERS.pip.order = (k) => {
  const pick = GIVERS.pip.orders[(k * 5 + 3) % GIVERS.pip.orders.length], b = BUG_BY[pick], n = b.tier >= 2 ? 1 + k % 2 : 2 + k % 2;
  return { stars: 1, title: 'A jar to fill', ask: `My bug book needs another drawing. ${n} ${b.name.toLowerCase()}${n > 1 ? 's' : ''}, please?`, want: [{ fish: pick, n }], thanks: 'Got them! Here\'s something for your trouble.', reward: { seeds: 6 + k * 2 }, order: true };
};
GIVERS.bram = { name: 'Bramwell', role: 'the digger of Red Terrace', quests: [
  Q(1, 'Break ground', 'Hm? Oh, hello. Bramwell. I dig. See those little star-shaped cracks in the ground? Something is buried under every one. Take this shovel and dig up three.', [], 'Three holes, and your back still works. Good start.', { seeds: 3 }),
  Q(1, 'Something old', 'Find me a fossil. It looks like any old rock to you, I expect. Bring it and I\'ll tell you what it is.', [['fossil', 1]], 'Ah! You see, a rock is never just a rock.', { seeds: 4 }),
  Q(1, 'Pots and points', 'Folk lived here long before us. Bring me a clay pot and a flint arrowhead.', [['pot', 1], ['arrow', 1]], 'Lovely work, both. Here, a bigger pack: finds are heavy.', { seeds: 5, bag: 4 }),
  Q(2, 'First exhibit', 'My tent is a museum, you know. A small one. Donate two fossils to it and folk will come to look.', [], 'Already more visitors than last year. That is, one.', { seeds: 8 }),
  Q(2, 'Old money', 'Two ancient coins. The old kingdoms paid their diggers in them, they say.', [['coin', 2]], 'And now I pay you. Take my silver shovel. It finds fossils and the rarer things more often.', { seeds: 10, ...SHOVEL(2) }),
  Q(2, 'A heart of crystal', 'A geode looks like a dull rock until you crack it. Bring me one.', [['geode', 1]], 'Purple! Every time, it\'s a surprise.', { seeds: 12 }),
  Q(2, 'Shells of stone', 'Every museum starts with an ammonite and a trilobite. Put both on display.', [], 'Now it looks like a proper museum.', { seeds: 14 }),
  Q(3, 'Caught in amber', 'Sometimes a bug was caught in tree resin, long ago, and the resin turned to amber. Pip would love to see one. So would I.', [['amber', 1]], 'There\'s the little fellow, inside. Pip is going to squeal.', { seeds: 20 }),
  Q(3, 'The woolly giant', 'Now the big ones. A skull, tusks and a body, and we\'ll have a whole woolly mammoth standing in my tent.', [], 'Look at it. LOOK at it. Here, more room in your pack.', { seeds: 30, bag: 4 }),
  Q(3, 'Three horns', 'Next, a triceratops: skull, body and tail.', [], 'Three horns and a frill. Magnificent.', { seeds: 38 }),
  Q(3, 'Wings of stone', 'A pterosaur. Skull, wings and body. It flew, you know, long before any bird.', [], 'I\'ll hang it from the ridge pole. It\'ll look like it\'s flying again.', { seeds: 44, boon: .03 }),
  Q(4, 'The tyrant king', 'And the king of them all: the T. rex. Skull, torso and tail.', [], 'Every child for miles will want to see this. Every adult too. Me most of all.', { seeds: 60, boon: .03 }),
  Q(4, 'Little carved people', 'Stone figurines are rare. Someone carved them for luck. Find me two.', [['figurine', 2]], 'They\'re smiling. They\'ve waited so long to be found.', { seeds: 70 }),
  Q(4, 'The golden mask', 'My life\'s dream. A golden mask from a forgotten kingdom lies under one of those spots, somewhere. You\'ll only find it by luck, and by digging. A lot.', [['mask', 1]], 'I... I need to sit down. Thank you, my friend. The whole valley will remember this.', { seeds: 150, boon: .05 }),
], orders: ['pot', 'arrow', 'coin', 'geode', 'key', 'fossil'] };
const B0 = s => (s.dug || 0) - (questState(s, 'bram').base || 0);
GIVERS.bram.quests[0].want = [has('Dig spots dug', 3, DIG_ICON.hole, B0)];
GIVERS.bram.quests[3].want = [has('Fossils on display', 2, DIG_ICON.tent, s => museumCount(s))];
GIVERS.bram.quests[6].want = [has('Ammonite on display', 1, 100, s => s.museum?.ammonite ? 1 : 0), has('Trilobite on display', 1, 101, s => s.museum?.trilobite ? 1 : 0)];
for (const [i, k, icon] of [[8, 'mammoth', 105], [9, 'tri', 111], [10, 'ptero', 114], [11, 'rex', 108]]) GIVERS.bram.quests[i].want = [has(`${SETS[k]} pieces on display`, 3, icon, s => setPieces(k).filter(f => s.museum?.[f.id]).length)];
GIVERS.pip.keep = s => Object.fromEntries(BUGS.filter(b => !s.bugHouse?.[b.id]).map(b => [b.id, 1]));
GIVERS.bram.keep = s => Object.fromEntries(PIECES.filter(f => !s.museum?.[f.id]).map(f => [f.id, 1]));
GIVERS.bram.onAccept = (s, q) => { q.base = s.dug || 0; if (!s.shovel) s.shovel = 1; };
GIVERS.pip.onAccept = s => { if (!s.net) s.net = 1; };
GIVERS.bram.order = (k) => {
  const pick = GIVERS.bram.orders[(k * 5 + 3) % GIVERS.bram.orders.length], f = FIND_BY[pick], n = f.tier >= 2 ? 1 + k % 2 : 2 + k % 2;
  return { stars: 1, title: 'For the collection', ask: `A collector in Sunfall wants ${n} ${f.name.toLowerCase()}${n > 1 ? 's' : ''}. Fancy a dig?`, want: [{ fish: pick, n }], thanks: 'Splendid. Your share.', reward: { seeds: 6 + k * 2 }, order: true };
};
// What Pip pays for a bug, Bramwell for a find: their worth, growing with what the land earns.
export const findWorth = (f, inc) => fishWorth(f, inc);
export const DIG_SEEDS = inc => questSeeds(1.2, inc);
export { questSeeds };

// Where Pip's stall and Bramwell's tent stand: clear, dry ground a little way from the heart of their glade, the
// same spot every time. The keeper stands just to the right of it.
const stalls = {};
export function stallOf(w, zone) {
  if (zone in stalls) return stalls[zone];
  const z = ZONES[zone]; let best = null;
  const dry = (x, y) => { for (let dy = -14; dy <= 14; dy += 4) for (let dx = -26; dx <= 34; dx += 4) { const i = Math.floor(y + dy) * TW + Math.floor(x + dx); if (w.waterT[i] !== 255 || w.road[i]) return false; } return true; };
  for (let r = 50; r < 260 && !best; r += 10) for (let a = 0; a < 16 && !best; a++) {
    const x = z.px + Math.cos(a * .3927 + 1) * r, y = z.py + Math.sin(a * .3927 + 1) * r * .7;
    if (x < 40 || y < 40 || x > TW - 40 || y > TH - 40 || w.zone[Math.floor(y / CELL) * CW + Math.floor(x / CELL)] !== zone) continue;
    if (w.free(x, y, 30) && w.free(x + 24, y + 2, 12) && dry(x, y)) best = { x, y, kx: x + 24, ky: y + 2 };
  }
  return stalls[zone] = best;
}
