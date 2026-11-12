import { makeWorld, ZONES, LANDS, REGIONS, CN, CW, CH, CELL, hash } from './world.mjs?v=33';
import { mapsDone, newLand, tick, touch, buyGlade, gladeBuyable, gladePrice, landDone, landPct, landTouched, income, upgradeMax, catchUp, encode, decode, buySpirit, buyUpgrade, spiritCost, spiritOpen, upgradeCost, upgradeOpen, zonePct, zoneBloom, doneCount, initObjects, SPIRITS, UPGRADES, SPIRIT_CAP, JOURNAL, note, journalLabel, journalPages, journalCount, journalSize, pageDone, favourText, villageLands, hasWater } from './sim.mjs?v=33';
import { createLand } from './land.mjs?v=33';
import { createRenderer, GRASS_STYLES } from './render.mjs?v=33';
import { createAudio } from './audio.mjs?v=33';
import { spiritFace, useDeerSheet } from './critters.mjs?v=33';

const KEY = 'little-wilds-2-v2', CARDS_KEY = 'little-wilds-2-postcards', SOUND_KEY = 'little-wilds-2-muted', VOLUME_KEY = 'little-wilds-2-volume', GRASS_KEY = 'little-wilds-2-grass', MUSIC_KEY = 'little-wilds-2-music';
const $ = id => document.getElementById(id);
const fmt = n => n >= 1e9 ? (n / 1e9).toFixed(2) + 'b' : n >= 1e6 ? (n / 1e6).toFixed(2) + 'm' : n >= 1e4 ? (n / 1e3).toFixed(1) + 'k' : Math.floor(n).toLocaleString();
const load = src => new Promise((res, rej) => { const im = new Image(); im.onload = () => res(im); im.onerror = rej; im.src = src; });
const nextFrame = () => new Promise(r => setTimeout(r, 30));

const audio = createAudio();
let images, world, land, view, s;
let ready = false, modal = '', lastUI = 0, lastSave = 0, last = performance.now(), toastTimer, bannerTimer, lastActive = performance.now(), frameNo = 0, slowFrames = 0;
const SPIRIT_SLICES = 6;
let preview = null, thenX = null, timelapse = null, currentZone = 0, seedShown = 0, wasHidden = 0, mapFrom = null;
const pointer = { x: 0, y: 0, on: false, holding: false, id: null, kb: false };
let glideTo = -1, glideAt = 0, gliding = 0, quarters = [], rateAt = 0, rateSeeds = 0, rate = 0, pulseTimer;
function pulseSeeds() { $('seeds').parentElement.classList.add('pulse'); clearTimeout(pulseTimer); pulseTimer = setTimeout(() => $('seeds').parentElement.classList.remove('pulse'), 170); }
let carry = null, panning = false; const pointers = new Map(); let pinch = 0;

// A soft toast (a journal note) waits its turn rather than covering something the player just asked about.
let toastUntil = 0; const softToasts = [];
function toast(text, soft = false) {
  if (soft && performance.now() < toastUntil) { if (softToasts.length < 4) softToasts.push(text); return; }
  $('toast').textContent = text; $('toast').classList.add('show'); clearTimeout(toastTimer); toastUntil = performance.now() + 3200;
  toastTimer = setTimeout(() => { $('toast').classList.remove('show'); if (softToasts.length) setTimeout(() => toast(softToasts.shift(), true), 350); }, 3200);
}
let titleOn = false, tour = 0, tourAt = 0, held = null;
// A new journal entry: a little gift of seeds, and a toast. Finishing a page raises all land income for good.
function jot(key) {
  if (!s || preview || !journalLabel(key) || s.journal?.[key]) return;
  const pages = journalPages(s), gift = note(s, key);
  if (!gift) return;
  pulseSeeds(); save();
  if (journalPages(s) > pages) { audio.chime(true); banner('A journal page is complete', 'Every restored land now earns 10% more, for good.'); }
  else toast(`New in your journal: ${journalLabel(key)} · +${fmt(gift)} seeds`, true);
}
const landBloomed = l => ZONES.filter(z => z.land === l).every(z => s.zones[z.id].bloomed);
// A region (Frostmere, Mistfen and Ember Basin each cover two cells) counts once all its cells are done.
const regionOf = l => REGIONS.find(R => R.lands.includes(l)), regionDone = l => regionOf(l).lands.every(q => landDone(s, q)), regionBloomed = l => regionOf(l).lands.every(landBloomed);
const PAT_KINDS = ['deer', 'fawn', 'rabbit'];
// Taps are for fun, not farming: an animal gives a small gift at most once in a while, and only a few taps a
// minute pay at all (a pocket of four that refills one every twenty seconds). Extra taps still get their pat.
let tapPocket = 4, tapPocketAt = performance.now();
function tapGift(o, cooldown, amount) {
  const now = performance.now();
  tapPocket = Math.min(4, tapPocket + (now - tapPocketAt) / 20000); tapPocketAt = now;
  if (o.tapped > now - cooldown || tapPocket < 1) return 0;
  o.tapped = now; tapPocket -= 1;
  return amount;
}
// A pointing hand over anything that can be tapped, a grabbing hand over a spirit you can carry.
function hoverCursor(x, y) {
  if (!view || titleOn || $('modal').open) { canvas.style.cursor = ''; return; }
  canvas.style.cursor = view.hitPet(x, y) || view.hitWild(x, y) || view.hitFolk(x, y) || view.hitSign(x, y) >= 0 ? 'pointer' : view.hitSpirit(s, x, y) ? 'grab' : '';
}
// While the title menu is up, big moments wait and play once you are back on the land.
function banner(title, sub = '', ms = 5200) { if (titleOn) { held = [title, sub, ms]; return; } $('banner-title').textContent = title; $('banner-sub').textContent = sub; $('banner').classList.add('show'); clearTimeout(bannerTimer); bannerTimer = setTimeout(() => $('banner').classList.remove('show'), ms); }
function save() { if (!s || preview) return; try { localStorage.setItem(KEY, encode(s)); } catch { toast('Saving is unavailable in this browser.'); } }
const loading = text => { $('loading').querySelector('span').textContent = text; return nextFrame(); };

// The whole continent is built once, a land at a time behind the loading screen.
async function buildWorld() {
  world = await makeWorld(id => loading(`Raising ${LANDS[id].name}…`));
  land = await createLand(world, id => loading(`Colouring ${LANDS[id].name}…`));
  world.dirty = i => { land.markCell(i); view?.floraCell(i); };
  world.waterMoved = z => land.markWater(z);
}
function attach() {
  initObjects(s, world);
  land.setSource(s.h, s.zones); land.flushAll();
  view?.dispose(); quarters = []; glideTo = -1; mapFrom = null; preview = null;
  $('btn-preview').textContent = 'Preview'; $('btn-preview').setAttribute('aria-pressed', false); $('btn-map').textContent = 'Map';
  view = createRenderer($('world'), world, land, images); try { view.setGrass(localStorage.getItem(GRASS_KEY)); } catch {}
  view.onPet = (label, zone) => toast(`${label} has come back to ${ZONES[zone].name}.`);
  view.onSplash = (pan, near, big) => audio.splash(pan, near, big);
  view.onSeen = key => jot(key);
  // Lands already restored or flourishing before the journal existed are written in quietly.
  LANDS.forEach((_, l) => { if (regionDone(l)) s.journal['land:' + regionOf(l).name] = 1; if (regionBloomed(l)) s.journal['bloom:' + regionOf(l).name] = 1; });
  buildDock();
  currentZone = firstOpen(); view.focusZone(currentZone, true);
}
const firstOpen = () => { const i = s.zones.findIndex(z => z.open && !z.done); return i < 0 ? 0 : i; };
const landUnderView = () => ZONES[currentZone].land;

function buildDock() {
  $('dock').innerHTML = SPIRITS.map((d, i) => `<button class="card" id="card-${i}" data-spirit="${i}" title="${d.job}"><span class="count" id="count-${i}"></span><span class="face" style="background:url(${spiritFace(i)}) center/contain no-repeat"></span><b>${d.name}</b><small id="cost-${i}"></small></button>`).join('') + `<button class="card tend" id="tend" title="Upgrades"><span class="tend-icon">✿</span><b>Tend</b><small id="tend-note"></small></button>`;
}
$('hud').addEventListener('click', e => {
  const b = e.target.closest('[data-spirit]'); if (!b) return;
  audio.start(); wake();
  const t = +b.dataset.spirit;
  if (!spiritOpen(s, t)) { toast(`${SPIRITS[t].name} comes when ${SPIRITS[t].need} glade${SPIRITS[t].need > 1 ? 's are' : ' is'} restored.`); return; }
  if (preview) { toast('Switch Preview off to buy.'); return; }
  if (buySpirit(s, t)) { audio.buy(); save(); updateUI(); const a = s.spirits[s.spirits.length - 1], home = view.toCell(innerWidth / 2, innerHeight / 2), cell = Math.round(Math.max(0, Math.min(CH - 1, home.y))) * CW + Math.round(Math.max(0, Math.min(CW - 1, home.x))); if (s.zones[world.zone[cell]].open && !world.blocked[cell]) { a.x = home.x; a.y = home.y; } view.pop(a.x, a.y); toast(`${SPIRITS[t].name}: ${SPIRITS[t].job}`); }
  else if (s.spirits.length >= SPIRIT_CAP) toast('The continent has all the spirits it can hold.');
});
function nextGoal() {
  const costs = UPGRADES.filter(u => upgradeOpen(s, u) && (s.upgrades[u.id] || 0) < upgradeMax(s, u)).map(u => upgradeCost(s, u));
  return costs.length ? Math.min(...costs) : Infinity;
}
const cheapestGlade = () => Math.min(...ZONES.filter(z => gladeBuyable(s, z.id)).map(z => gladePrice(s, z.id)));
function updateUI() {
  if (!s) return;
  SPIRITS.forEach((d, i) => {
    const open = spiritOpen(s, i), cost = spiritCost(s, i), can = open && s.seeds >= cost && s.spirits.length < SPIRIT_CAP, c = $('card-' + i); if (!c) return;
    c.classList.toggle('locked', !open); c.classList.toggle('can', can);
    $('count-' + i).textContent = s.spirits.filter(a => a.type === i).length || '';
    $('cost-' + i).textContent = open ? fmt(cost) : `after ${d.need} glade${d.need > 1 ? 's' : ''}`;
  });
  $('btn-map').classList.toggle('can', s.seeds >= cheapestGlade());
  const goal = nextGoal(), t = $('tend'); if (t) { t.classList.toggle('can', s.seeds >= goal); $('tend-note').textContent = goal === Infinity ? 'all done' : fmt(goal); }
  // The chip follows whichever glade the player is looking at.
  const look = view.toCell(innerWidth / 2, innerHeight / 2), cx = Math.max(0, Math.min(CW - 1, Math.round(look.x))), cy = Math.max(0, Math.min(CH - 1, Math.round(look.y)));
  currentZone = world.zone[cy * CW + cx];
  const z = s.zones[currentZone], pct = zonePct(s, world, currentZone), bl = zoneBloom(s, world, currentZone);
  $('zone-name').textContent = ZONES[currentZone].name;
  $('zone-bar').style.width = pct * 100 + '%'; $('bloom-bar').style.width = (z.done ? bl * 100 : 0) + '%';
  $('zone-note').textContent = !z.open ? (gladeBuyable(s, currentZone) ? `Asleep · wake for ${fmt(gladePrice(s, currentZone))}` : `Asleep · ${LANDS[ZONES[currentZone].land].name}`) : z.bloomed ? 'Flourishing ✿' : z.done ? `Flowers ${Math.round(bl / .85 * 100)}%` : `${Math.floor(pct * 100)}% restored`;
  if (modal === 'tend') refreshTend(); if (modal === 'valley') openValley();
}
function renderHint() {
  const h = $('hint');
  let text = '';
  if (!s.touched) text = 'Hold and drag across the dead ground';
  else if (!s.revivedAny && s.age > 10 && !s.zones[0].done) text = 'Hold on a dead tree or stone to bring it back';
  else if (s.spirits.length === 1 && s.seeds >= spiritCost(s, 0)) text = 'Those seeds can wake another Mossling';
  else if (!s.bought && s.seeds >= cheapestGlade()) text = 'You can afford to wake a new glade. Click its sign';
  else if (!s.spirits.some(a => a.type === 2) && s.zones.some((z, i) => z.done && z.water < 0 && hasWater(world, i)) ) text = spiritOpen(s, 2) ? 'Riverbeds stay dry until a Rainwisp brings water' : `Riverbeds stay dry until a Rainwisp comes, after ${SPIRITS[2].need} restored glades`;
  if (preview) text = '';
  h.hidden = !text; if (text) h.textContent = text;
}

/* Upgrades */
function tendHTML() {
  return `<h2>Tend the land</h2><p class="sub">Every upgrade changes what you see.</p>` + UPGRADES.map(u => {
    const l = s.upgrades[u.id] || 0, top = upgradeMax(s, u), open = upgradeOpen(s, u), cost = upgradeCost(s, u), max = l >= top;
    return `<div class="up"><strong>${u.name}${top > 1 ? `<em>${l} / ${top}</em>` : ''}</strong><span>${open ? u.desc : 'Comes after your first restored glade.'}</span><button data-up="${u.id}" ${max || !open || s.seeds < cost ? 'disabled' : ''}>${max ? 'Done' : fmt(cost)}</button></div>`;
  }).join('');
}
function refreshTend() { for (const b of document.querySelectorAll('[data-up]')) { const u = UPGRADES.find(q => q.id === b.dataset.up), l = s.upgrades[u.id] || 0; b.disabled = l >= upgradeMax(s, u) || !upgradeOpen(s, u) || s.seeds < upgradeCost(s, u); } }
function show(type, html) { releaseAll(); modal = type; $('modal-body').innerHTML = html; if (!$('modal').open) $('modal').showModal(); }
$('close').onclick = () => $('modal').close();
$('modal').addEventListener('close', () => { modal = ''; wake(); });
$('modal').addEventListener('click', e => { if (e.target === $('modal')) { const r = $('modal').getBoundingClientRect(); if (e.clientX < r.left || e.clientX > r.right || e.clientY < r.top || e.clientY > r.bottom) $('modal').close(); } });
$('hud').addEventListener('click', e => { if (e.target.closest('#tend') && !preview) { audio.start(); show('tend', tendHTML()); } });
$('modal-body').addEventListener('click', e => {
  const up = e.target.closest('[data-up]');
  if (up && buyUpgrade(s, up.dataset.up)) { audio.buy(); save(); show('tend', tendHTML()); return; }
  const f = e.target.closest('[data-focus]');
  if (f) { const z = +f.dataset.focus; if (gladeBuyable(s, z)) wakeGlade(z); view.focusZone(z); $('modal').close(); return; }
  const a = e.target.closest('[data-act]'); if (!a) return;
  ({ land() { view.focusLand(landUnderView()); $('modal').close(); }, map() { $('modal').close(); toggleMap(true); }, exportSave, importSave, reset: resetSave, cards: openCards, journal: openJournal, valley: openValley })[a.dataset.act]?.();
});

/* The land under the camera, glade by glade */
function openValley() {
  const l = landUnderView(), zs = ZONES.filter(z => z.land === l).sort((a, b) => a.py - b.py || a.px - b.px);
  const cells = zs.map(z => { const st = s.zones[z.id], pct = zonePct(s, world, z.id), buy = gladeBuyable(s, z.id); return `<button class="vz ${st.open ? '' : buy ? 'wake' : 'locked'} ${st.done ? 'done' : ''} ${st.bloomed ? 'bloomed' : ''}" data-focus="${z.id}"><b>${z.name}</b><small>${buy ? `wake for ${fmt(gladePrice(s, z.id))}` : !st.open ? 'asleep' : st.bloomed ? 'flourishing ✿' : st.done ? 'restored' : Math.floor(pct * 100) + '%'}</small></button>`; }).join('');
  const html = `<h2>${LANDS[l].name}</h2><p class="sub">${landTouched(s, l) ? `${(landPct(s, world, l) * 100).toFixed(1)}% restored.` : 'Still asleep.'} Choose a glade to visit, or wake one that touches open ground.</p><div class="valley">${cells}</div><div class="row"><button class="wood" data-act="land">See all of ${LANDS[l].name}</button><button class="wood" data-act="map">See the whole map</button></div>`;
  if (modal === 'valley' && $('modal-body').firstChild) { const scroll = $('modal').scrollTop; $('modal-body').innerHTML = html; $('modal').scrollTop = scroll; } else show('valley', html);
}
$('zonechip').onclick = () => { audio.start(); openValley(); };

/* Title menu: the continent you are growing, drifting by behind a few big buttons. Spirits keep working. */
function showTitle() {
  if ($('modal').open) $('modal').close();
  releaseAll(); thenX = null; $('btn-then').setAttribute('aria-pressed', false); if (preview) togglePreview();
  titleOn = true; document.body.classList.add('title'); $('title').hidden = false; tourAt = 0;
  $('title-play').textContent = s.touched ? 'Continue' : 'Begin';
  $('title-tag').textContent = s.touched ? 'Your continent, quietly growing.' : 'A dead continent, waiting for you.';
  titleRecords();
}
function titleRecords() {
  const glades = s.zones.filter(z => z.done).length, lands = mapsDone(s);
  $('title-records').innerHTML = `<span><small>Seeds</small><b><i class="ico ico-seed"></i>${fmt(s.seeds)}</b></span><span><small>Earning</small><b>${rate >= 1 ? fmt(rate) + '/s' : '–'}</b></span><span><small>Glades restored</small><b>${glades} / ${ZONES.length}</b></span><span><small>Lands restored</small><b>${REGIONS.filter(R => R.lands.every(l => landDone(s, l))).length} / ${REGIONS.length}</b></span>`;
}
function hideTitle() {
  if (!titleOn) return;
  titleOn = false; document.body.classList.remove('title'); $('title').hidden = true; wake();
  currentZone = firstOpen(); view.focusZone(currentZone); gliding = performance.now() + 1800;
  if (held) { const [a, b, c] = held; held = null; banner(a, b, c); } else if (!s.touched) banner('Little Wilds', 'Nothing has grown here in a long time.', 4500);
  canvas.focus({ preventScroll: true });
}
// The camera wanders the glades you have woken, a little wider than play, lingering on each.
function stepTour(now) {
  if (now < tourAt) return;
  const open = s.zones.map((z, i) => z.open ? i : -1).filter(i => i >= 0), z = open.length ? open[tour++ % open.length] : 0;
  view.focusZone(z); const c = view.cam;
  view.glide(c.tx + (hash(tour, 1, 9) - .5) * 160, c.ty + (hash(tour, 2, 9) - .5) * 100, c.tz * (.62 + hash(tour, 3, 9) * .2));
  if (!tourAt) { c.x = c.tx; c.y = c.ty; c.z = c.tz; }
  tourAt = now + 9000;
}
$('title').addEventListener('click', e => {
  const b = e.target.closest('[data-title]'); if (!b) return;
  audio.start();
  ({ play: hideTitle, map() { hideTitle(); toggleMap(true); }, cards: openCards, journal: openJournal, settings: openSettings })[b.dataset.title]();
});

/* Menu */
function openMenu() {
  show('menu', `<h2>Little Wilds 2</h2><p class="sub">Bring a dead continent back to life, one glade at a time.</p>
  <label class="volume">Volume <input id="volume" type="range" min="0" max="100" value="${Math.round(audio.volume * 100)}"></label><label class="volume check"><input id="music" type="checkbox"${audio.music ? ' checked' : ''}> Quiet music</label><label class="volume">Grass style <select id="grass">${Object.entries(GRASS_STYLES).map(([k, v]) => `<option value="${k}"${k === view.grass ? ' selected' : ''}>${v}</option>`).join('')}</select></label><div class="row"><button class="wood" data-act="cards">Postcards</button><button class="wood" data-act="journal">Journal</button><button class="wood" data-act="exportSave">Export save</button><button class="wood" data-act="importSave">Import save</button><button class="wood" data-act="reset">Start over</button></div>
  <p class="sub" style="margin-top:14px">Hold and drag: heal the land.<br>Drag a spirit: carry it somewhere.<br>Click a sign on a sleeping glade: wake it with seeds.<br>Click a deer or rabbit: give it a pat. Butterflies, birds, fish and villagers like a tap too.<br>Right-drag, two fingers or arrow keys: look around.<br>Wheel or pinch: zoom. M: the whole map. H: hide the interface.</p><input type="file" id="file" accept=".json,application/json" hidden>`);
}
$('btn-menu').onclick = () => { audio.start(); showTitle(); };
function openSettings() { openMenu(); $('volume').oninput = e => { audio.setVolume(e.target.value / 100); try { localStorage.setItem(VOLUME_KEY, audio.volume); } catch {} };
  $('grass').onchange = e => { view.setGrass(e.target.value); try { localStorage.setItem(GRASS_KEY, view.grass); } catch {} };
  $('music').onchange = e => { audio.start(); audio.setMusic(e.target.checked); try { localStorage.setItem(MUSIC_KEY, e.target.checked ? '1' : ''); } catch {} }; };
function exportSave() { save(); const a = document.createElement('a'), u = URL.createObjectURL(new Blob([encode(s)], { type: 'application/json' })); a.href = u; a.download = 'little-wilds-2-save.json'; a.click(); setTimeout(() => URL.revokeObjectURL(u), 1000); }
function importSave() {
  const f = $('file'); f.onchange = async () => { try { const file = f.files[0]; if (!file || file.size > 4e6) throw 0; const text = await file.text(); const next = decode(text, world); if (!confirm('Replace your whole continent?')) return; s = next; attach(); save(); $('modal').close(); } catch { toast('That is not a Little Wilds 2 save.'); } }; f.click();
}
function resetSave() { if (!confirm('Start again from barren ground? This erases your progress.')) return; s = newLand(); attach(); try { localStorage.removeItem(CARDS_KEY); } catch {} save(); $('modal').close(); }
const readCards = () => { try { return JSON.parse(localStorage.getItem(CARDS_KEY) || '[]'); } catch { return []; } };
function openCards() { const list = readCards(); show('cards', `<h2>Postcards</h2><p class="sub">The lands you have brought back.</p>` + (list.length ? `<div class="cards">${list.map(c => `<figure><img src="${c.now}" alt="${c.name} restored"><figcaption>${c.name}</figcaption></figure>`).join('')}</div>` : '<p>Finish a whole land to keep its postcard here.</p>')); }
function openJournal() {
  const pages = JOURNAL.map((p, n) => {
    const got = p.entries.filter(([k]) => s.journal?.[k]).length, done = pageDone(s, n);
    return `<section class="jpage${done ? ' done' : ''}"><h3>${p.name} <em>${got} / ${p.entries.length}${done ? ' · +10% income' : ''}</em></h3><ul>${p.entries.map(([k, label]) => `<li class="${s.journal?.[k] ? 'got' : ''}">${s.journal?.[k] ? label : '???'}</li>`).join('')}</ul></section>`;
  }).join('');
  const asks = (s.favours || []).filter(f => !f.done).map(f => `<li><b>${f.who}</b> in ${LANDS[f.land].name}: ${favourText(f)} <em>${fmt(f.reward)} seeds</em></li>`).join('');
  show('journal', `<h2>Field journal</h2><p class="sub">${journalCount(s)} of ${journalSize()} found. Each new entry brings a gift of seeds; every finished page makes all restored land earn 10% more.</p>${asks ? `<h3>Favours asked</h3><ul class="asks">${asks}</ul>` : villageLands().some(l => landTouched(s, l)) ? '' : '<p class="sub">Villagers in Frostmere and Sunfall Coast will ask small favours once you reach them.</p>'}${pages}`);
}
function celebrate(l) {
  const then = view.snapshot(true, l), now = view.snapshot(false, l), name = LANDS[l].name;
  const list = readCards(); if (!list.some(c => c.land === l)) { list.push({ land: l, name, now }); try { localStorage.setItem(CARDS_KEY, JSON.stringify(list.slice(-9))); } catch {} }
  show('postcard', `<h2>${name} lives again</h2><p class="sub">Drag to compare. It keeps earning seeds on its own from now on.</p><div class="compare" id="cmp"><img src="${then}" alt="${name} when you arrived"><img class="now" src="${now}" alt="${name} now"><input type="range" min="0" max="100" value="50" aria-label="Compare then and now"></div><div class="row"><button class="wood" data-act="map">See the whole map</button></div>`);
  $('cmp').querySelector('input').oninput = e => $('cmp').style.setProperty('--cut', e.target.value + '%');
}
function wakeGlade(z) {
  if (!gladeBuyable(s, z)) return false;
  const price = gladePrice(s, z), l = ZONES[z].land, fresh = !landTouched(s, l);
  if (!buyGlade(s, z)) { toast(`${ZONES[z].name} costs ${fmt(price)} seeds to wake.`); return false; }
  s.bought = true; audio.chime(fresh); view.glow(z); view.sweep(z); land.markZone(z);
  banner(fresh ? `${LANDS[l].name} stirs` : `${ZONES[z].name} wakes`, fresh ? `${ZONES[z].name} is the first glade to wake in a new land.` : 'The mist lifts.');
  save(); updateUI();
  return true;
}
// The Map button flies out to the whole continent and back to where you were.
function toggleMap(out = !mapFrom) {
  if (out) { mapFrom ||= { x: view.cam.tx, y: view.cam.ty, z: view.cam.tz }; view.focusAll(); gliding = performance.now() + 1500; }
  else if (mapFrom) { view.glide(mapFrom.x, mapFrom.y, mapFrom.z); mapFrom = null; gliding = performance.now() + 1500; }
  $('btn-map').textContent = mapFrom ? 'Back' : 'Map';
}

// Preview: the whole continent finished, for a look. Nothing runs and nothing saves until it is switched off,
// and switching off puts every field, glade and stone back exactly as it was.
function togglePreview() {
  releaseAll(); thenX = null; $('btn-then').setAttribute('aria-pressed', false);
  if (!preview) {
    preview = { h: s.h, zones: s.zones, objHp: s.objHp, active: world.active.slice(), pend: world.pend.slice() };
    s.h = new Float32Array(CN); for (let i = 0; i < CN; i++) if (!world.blocked[i]) s.h[i] = .99;
    s.zones = s.zones.map(z => ({ ...z, open: true, done: true, bloomed: true, water: 1, sweep: -1 }));
    s.objHp = s.objHp.map(() => 0);
    world.active.length = 0; world.pend.fill(0);
    toggleMap(true); banner('Preview', 'The whole continent, restored. Press Preview again to go back.', 4200);
  } else {
    Object.assign(s, { h: preview.h, zones: preview.zones, objHp: preview.objHp });
    world.active.length = 0; world.active.push(...preview.active); world.pend.set(preview.pend);
    preview = null; toggleMap(false);
  }
  land.setSource(s.h, s.zones); land.flushAll(); view.allFlora(); view.regreet(); quarters = []; last = performance.now();
  $('btn-preview').setAttribute('aria-pressed', !!preview); $('btn-preview').textContent = preview ? 'Back to mine' : 'Preview';
  updateUI();
}
$('btn-preview').onclick = () => { audio.start(); togglePreview(); };

/* Then and now, sound */
$('btn-map').onclick = () => { audio.start(); toggleMap(); };
$('btn-then').onclick = () => { $('banner').classList.remove('show'); thenX = thenX == null ? innerWidth / 2 : null; $('btn-then').setAttribute('aria-pressed', thenX != null); if (thenX != null) toast('Drag across the land to compare. Press again to finish.'); };
const syncSound = () => { $('btn-sound').textContent = audio.muted ? 'Muted' : 'Sound'; $('btn-sound').setAttribute('aria-pressed', audio.muted); };
$('btn-sound').onclick = () => { audio.start(); audio.setMuted(!audio.muted); try { localStorage.setItem(SOUND_KEY, audio.muted ? '1' : ''); } catch {} syncSound(); };
try { if (localStorage.getItem(MUSIC_KEY)) audio.setMusic(true); if (localStorage.getItem(SOUND_KEY)) audio.setMuted(true); const v = parseFloat(localStorage.getItem(VOLUME_KEY)); if (v >= 0 && v <= 1) audio.setVolume(v); } catch {} syncSound();

/* Input */
const canvas = $('world');
function wake() { lastActive = performance.now(); document.body.classList.remove('quiet'); }
function releaseAll() { pointer.holding = false; pointer.kb = false; if (carry) { carry.held = false; carry = null; } panning = false; }
canvas.addEventListener('contextmenu', e => e.preventDefault());
canvas.addEventListener('pointerdown', e => {
  if (!ready || $('modal').open || titleOn) return;
  audio.start(); wake(); canvas.focus({ preventScroll: true }); canvas.setPointerCapture(e.pointerId);
  pointers.set(e.pointerId, { x: e.clientX, y: e.clientY }); pointer.x = e.clientX; pointer.y = e.clientY; pointer.on = true;
  if (thenX != null) { thenX = e.clientX; pointer.id = e.pointerId; return; }
  if (pointers.size > 1 || e.button !== 0) { pointer.holding = false; if (carry) { carry.held = false; carry = null; } panning = true; pinch = 0; return; }
  if (preview) { panning = true; pinch = 0; return; } // While previewing, a drag only looks around.
  const sign = view.hitSign(e.clientX, e.clientY);
  if (sign >= 0) { pointers.delete(e.pointerId); wakeGlade(sign); return; }
  const under = view.toCell(e.clientX, e.clientY), cellAt = Math.round(Math.max(0, Math.min(CH - 1, under.y))) * CW + Math.round(Math.max(0, Math.min(CW - 1, under.x))), zoneAt = world.zone[cellAt];
  // Far out on the map, a drag looks around instead of painting.
  if (view.cam.z < .9) { panning = true; pinch = 0; if (!s.zones[zoneAt].open && gladeBuyable(s, zoneAt)) toast(`${ZONES[zoneAt].name}: click its sign to wake it for ${fmt(gladePrice(s, zoneAt))} seeds.`); return; }
  if (!s.zones[zoneAt].open) toast(gladeBuyable(s, zoneAt) ? `${ZONES[zoneAt].name} is asleep. Click its sign to wake it for ${fmt(gladePrice(s, zoneAt))} seeds.` : `${ZONES[zoneAt].name} is asleep. Wake a glade beside it first.`);
  const petted = view.hitPet(e.clientX, e.clientY);
  if (petted) { view.pet(petted); audio.buy(); const gift = tapGift(petted, 45000, 2 + s.seeds * .0004); if (gift) { s.seeds += gift; view.reward(petted.x, petted.y - 12, gift, 3); pulseSeeds(); } s.pats ||= {}; s.pats[petted.kind] = 1; if (PAT_KINDS.every(k => s.pats[k])) jot('pat'); return; }
  const wild = view.hitWild(e.clientX, e.clientY);
  if (wild) { // A butterfly flutters off, a bird flies up, a fish flashes gold. Each gives a little, once in a while.
    view.startle(wild); audio.poke(wild.kind); jot(wild.key);
    const gift = tapGift(wild.o, 30000, 1 + s.seeds * .0002); if (gift) { s.seeds += gift; view.reward(wild.x, wild.y, gift, 2); pulseSeeds(); }
    return;
  }
  const villager = view.hitFolk(e.clientX, e.clientY);
  if (villager) { jot('folk'); villager.wave = 2; villager.pause = 2.5; const f = s.favours?.find(q => q.land === villager.land && !q.done); toast(f ? `${f.who}: ${favourText(f)} (reward ${fmt(f.reward)} seeds)` : ['Thank you for bringing the land back!', 'The fields have never looked so green.', 'Lovely day for a walk, isn\'t it?', 'Did you see the fish in the pond?'][Math.floor(Math.random() * 4)]); return; }
  const hit = view.hitSpirit(s, e.clientX, e.clientY);
  pointer.id = e.pointerId;
  if (hit) { carry = hit; hit.held = true; hit.tx = -1; hit.px = e.clientX; hit.py = e.clientY; return; }
  pointer.holding = true; pointer.since = e.pointerType === 'touch' ? performance.now() + 90 : 0; // a beat for a second finger, so a pinch never plants
});
canvas.addEventListener('pointermove', e => {
  wake();
  const prev = pointers.get(e.pointerId); pointer.x = e.clientX; pointer.y = e.clientY; pointer.on = e.pointerType !== 'touch' || !!prev;
  if (!prev) { if (e.pointerType === 'mouse') hoverCursor(e.clientX, e.clientY); return; }
  pointers.set(e.pointerId, { x: e.clientX, y: e.clientY });
  if (thenX != null) { thenX = Math.max(0, Math.min(innerWidth, e.clientX)); return; }
  if (carry) { carry.px = e.clientX; carry.py = e.clientY; return; }
  if (panning) {
    if (mapFrom && Math.hypot(e.clientX - prev.x, e.clientY - prev.y) > 0) { mapFrom = null; $('btn-map').textContent = 'Map'; }
    if (pointers.size === 2) { const [a, b] = [...pointers.values()], d = Math.hypot(a.x - b.x, a.y - b.y); if (pinch) view.zoomAt(d / pinch, (a.x + b.x) / 2, (a.y + b.y) / 2); pinch = d; view.pan((e.clientX - prev.x) / 2, (e.clientY - prev.y) / 2); }
    else view.pan(e.clientX - prev.x, e.clientY - prev.y);
  }
});
function endPointer(e) {
  if (!pointers.has(e.pointerId)) return;
  pointers.delete(e.pointerId);
  if (carry && e.pointerId === pointer.id) { const c = view.toCell(e.clientX, e.clientY), i = Math.round(Math.max(0, Math.min(CH - 1, c.y + .6))) * CW + Math.round(Math.max(0, Math.min(CW - 1, c.x))); if (s.zones[world.zone[i]].open && !world.blocked[i]) { carry.x = i % CW; carry.y = Math.floor(i / CW); } else toast('That land is still asleep.'); carry.held = false; carry.tx = -1; carry = null; save(); }
  if (e.pointerId === pointer.id) { pointer.holding = false; pointer.id = null; }
  if (!pointers.size) { panning = false; pinch = 0; if (e.pointerType === 'touch') pointer.on = false; }
}
canvas.addEventListener('pointerup', endPointer); canvas.addEventListener('pointercancel', endPointer);
canvas.addEventListener('pointerleave', () => { if (!pointers.size) pointer.on = false; });
canvas.addEventListener('wheel', e => { e.preventDefault(); wake(); if (mapFrom) { mapFrom = null; $('btn-map').textContent = 'Map'; } view.zoomAt(Math.exp(-e.deltaY * .0013), e.clientX, e.clientY); }, { passive: false });
addEventListener('keydown', e => {
  if (!ready || $('modal').open) return;
  if (titleOn) { if (e.code === 'Enter' || e.code === 'Space') { e.preventDefault(); audio.start(); hideTitle(); } return; }
  if (e.code === 'Escape') { showTitle(); return; }
  wake();
  const moves = { ArrowLeft: [90, 0], ArrowRight: [-90, 0], ArrowUp: [0, 90], ArrowDown: [0, -90], KeyA: [90, 0], KeyD: [-90, 0], KeyW: [0, 90], KeyS: [0, -90] };
  if (moves[e.code]) { e.preventDefault(); view.pan(...moves[e.code]); }
  if (e.code === 'Space' && !e.repeat && !preview) { e.preventDefault(); audio.start(); pointer.holding = true; pointer.kb = true; if (!pointer.on) { pointer.x = innerWidth / 2; pointer.y = innerHeight / 2; pointer.on = true; } }
  if (e.key === '+' || e.key === '=') view.zoomAt(1.2); if (e.key === '-') view.zoomAt(1 / 1.2);
  if (e.code === 'KeyM' && !e.repeat) toggleMap();
  if (e.code === 'KeyP' && !e.repeat) togglePreview();
  if (e.code === 'KeyH') { document.body.classList.toggle('quiet'); lastActive = -1e9; }
});
addEventListener('keyup', e => { if (e.code === 'Space' && pointer.kb) { pointer.holding = false; pointer.kb = false; } });
addEventListener('blur', () => { pointers.clear(); releaseAll(); });

/* Events from the simulation: the game's big moments. */
function handle(ev, now, quiet = false) {
  for (const e of ev) {
    if (e.t === 'revive' && !quiet) { view.revived(e.o, now); audio.pop(); view.reward(e.o.x * CELL, e.o.y * CELL - e.o.size * .7, e.reward, (e.o.worth ?? e.o.size) > 40 ? 10 : 5); pulseSeeds(); s.revivedAny = true; }
    if (e.t === 'water' && !quiet) { audio.water(); toast(`The Rainwisp fills the dry riverbed in ${ZONES[e.zone].name}.`); jot('rainwisp'); }
    if (e.t === 'weather' && !quiet) { toast(e.kind === 'snow' ? 'Snow is falling. The land rests under it, growing all the same.' : 'A shower passes over. The green spreads faster in the rain.'); jot(e.kind); }
    if (e.t === 'season' && !quiet) { banner({ spring: 'Spring', summer: 'Summer', autumn: 'Autumn', winter: 'Winter' }[e.season], { spring: 'Blossom drifts over the wilds.', summer: 'Long, warm days.', autumn: 'The leaves turn gold.', winter: 'Frost settles on the land.' }[e.season], 4200); jot(e.season); }
    if (e.t === 'favour') { pulseSeeds(); view.cheer(e.favour.land); if (!quiet) { audio.chime(); banner(`${e.favour.who} is delighted`, `A favour done in ${LANDS[e.favour.land].name} · +${fmt(e.favour.reward)} seeds`); } jot('favour'); }
    if (e.t === 'zone') {
      land.markZone(e.zone);
      if (quiet) continue;
      audio.chime(e.final); view.sweep(e.zone); view.glow(e.zone);
      const next = ZONES[e.zone].adj.filter(n => gladeBuyable(s, n));
      banner(`${ZONES[e.zone].name} restored`, next.length ? `${next.length} glade${next.length > 1 ? 's' : ''} beside it can be woken now.` : 'Life is coming back.');
      const justOpened = SPIRITS.find(d => d.need === doneCount(s));
      if (justOpened) setTimeout(() => toast(`A new spirit has come: ${justOpened.name}.`), 5400);
    }
    if (e.t === 'bloom') { const l = ZONES[e.zone].land; if (regionBloomed(l)) jot('bloom:' + regionOf(l).name); }
    if (e.t === 'bloom' && !quiet) { audio.chime(); view.sweep(e.zone, '#ffc6dd'); view.glow(e.zone, '255,190,220'); banner(`${ZONES[e.zone].name} is flourishing`, 'New life has come to graze.'); }
    if (e.t === 'valley') { if (regionDone(e.land)) jot('land:' + regionOf(e.land).name); save(); if (!quiet) setTimeout(() => { if (!$('modal').open) celebrate(e.land); }, 7000); }
  }
}
function returnFrom(seconds) {
  if (s.paused || seconds < 20) return;
  const pre = s.h.slice(), r = catchUp(s, world, seconds); if (!r.seconds) return;
  handle(r.ev, performance.now(), true);
  const moved = []; for (let i = 0; i < CN; i++) if (Math.abs(s.h[i] - pre[i]) > .004) moved.push(i);
  if (moved.length > 300) { // Play back what grew while the player was gone.
    timelapse = { pre, field: pre.slice(), moved: Uint32Array.from(moved), start: performance.now(), dur: 5200 };
    land.setField(timelapse.field); view.setShown(timelapse.field); land.markAll();
  }
  const mins = Math.round(r.seconds / 60);
  banner('While you were away', `${mins < 90 ? mins + ' minutes' : (mins / 60).toFixed(1) + ' hours'} of quiet growth · ${fmt(r.seeds)} seeds`, 5600);
}
function stepTimelapse(now) {
  const t = timelapse, k = Math.min(1, (now - t.start) / t.dur), f = t.field, target = s.h;
  for (const i of t.moved) { const delay = hash(i % CW >> 2, Math.floor(i / CW) >> 2, 5) * .18 + (Math.floor(i / CW) / CH) * .22, q = Math.max(0, Math.min(1, (k - delay) / .55)), e = q * q * (3 - 2 * q), next = t.pre[i] + (target[i] - t.pre[i]) * e; if (Math.abs(next - f[i]) > .004 || (k >= 1 && f[i] !== target[i])) { f[i] = next; land.markCell(i); view.floraCell(i); } }
  if (k >= 1) { timelapse = null; land.setField(s.h); view.setShown(null); land.markAll(); }
}

/* Main loop */
function frame(now) {
  requestAnimationFrame(frame);
  const dt = Math.min(.05, Math.max(0, (now - last) / 1000)); last = now;
  if (!ready || document.hidden) return;
  if (!$('modal').open && !timelapse && !preview) {
    const ev = [];
    if (pointer.holding && performance.now() >= (pointer.since || 0) && !s.paused && thenX == null && !titleOn) {
      const c = view.toCell(pointer.x, pointer.y), gain = touch(s, world, c.x, c.y, dt, ev);
      if (gain > 0) { view.spark(c.x, c.y, gain * 7, 3); audio.dig(gain * 25); wake(); }
    }
    tick(s, world, dt, ev, frameNo++ % SPIRIT_SLICES, SPIRIT_SLICES);
    if (ev.length) handle(ev, now);
  } else if (timelapse) stepTimelapse(now);
  land.flush(timelapse ? 6 : 3, view.viewBox());
  // Step quality down if this machine is struggling, rather than stuttering.
  slowFrames = Math.max(0, slowFrames + (dt > .032 ? 1 : -.25)); if (slowFrames > 90 && view.quality > 0) { view.setQuality(view.quality - 1); slowFrames = 0; }
  seedShown += (s.seeds - seedShown) * Math.min(1, dt * 9); if (Math.abs(s.seeds - seedShown) < 1) seedShown = s.seeds;
  $('seeds').textContent = fmt(seedShown);
  if (glideTo >= 0 && now > glideAt) { if (!pointer.holding && !pointers.size && !$('modal').open) { view.focusZone(glideTo); gliding = now + 5000; } glideTo = -1; }
  s.zones.forEach((z, i) => { const q = z.open && !z.done ? Math.floor(zonePct(s, world, i) * 4) : 0; if (quarters[i] !== undefined && q > quarters[i] && i === currentZone) { const c = $('zonechip'); c.classList.remove('pulse'); void c.offsetWidth; c.classList.add('pulse'); view.glow(i, '200,255,170'); } quarters[i] = q; });
  if (now - rateAt > 1000) { const d = s.seeds - rateSeeds; if (d >= 0) rate += (d / ((now - rateAt) / 1000) - rate) * .35; rateSeeds = s.seeds; rateAt = now; $('rate').textContent = rate >= 1 ? '+' + fmt(rate) + '/s' : ''; }
  if (titleOn) { stepTour(now); if (now - lastUI > 200) titleRecords(); }
  view.draw(s, now, dt, { carry, pointer: pointer.on && !carry && !titleOn && view.cam.z >= .9 ? pointer : null, holding: pointer.holding, then: thenX, title: titleOn, camSpeed: titleOn ? .35 : now < gliding ? 2.2 : 3.2 });
  if (now - lastUI > 200) { lastUI = now; updateUI(); renderHint(); const ear = view.hearing(); audio.hear(ear.sources, ear.near, .2); if (!pointers.size && !$('modal').open && thenX == null && now - lastActive > 14000) document.body.classList.add('quiet'); }
  if (now - lastSave > 6000) { lastSave = now; save(); }
}
document.addEventListener('visibilitychange', () => {
  releaseAll();
  if (document.hidden) { wasHidden = Date.now(); save(); }
  else { if (wasHidden && ready && !preview) returnFrom((Date.now() - wasHidden) / 1000); wasHidden = 0; last = performance.now(); wake(); }
});
addEventListener('pagehide', save);

async function main() {
  try {
    await nextFrame();
    const [worldImg, spirits, landmarks, pets, flyers, deer, fish, fawn, folk, raincloud, places, ...biomes] = await Promise.all([load('assets/world.png'), load('assets/spirits.png'), load('assets/landmarks.png'), load('assets/pets.png'), load('assets/flyers.png').catch(() => null), load('assets/deer.png?v=33').catch(() => null), load('assets/fish.png?v=33').catch(() => null), load('assets/fawn.png?v=33').catch(() => null), load('assets/folk.png?v=33').catch(() => null), load('assets/raincloud.png?v=33').catch(() => null), load('assets/places.png?v=33').catch(() => null), ...LANDS.slice(1).map((_, n) => load(`assets/biome-${n + 1}.png?v=33`).catch(() => null))]);
    if (deer) useDeerSheet(deer, fawn);
    images = { world: worldImg, spirits, landmarks, pets, flyers, fish, folk, raincloud, places, biomes: [null, ...biomes] };
    await buildWorld();
    let raw = null;
    try { raw = localStorage.getItem(KEY); } catch { raw = null; }
    try { s = raw ? decode(raw, world) : newLand(); } catch (e) { console.error(e); s = newLand(); toast('That save could not be read, so the continent starts fresh.'); }
    const away = (Date.now() - (s.last || Date.now())) / 1000;
    await loading('Waking the spirits…');
    attach();
    if (/^(localhost|127\.0\.0\.1)$/.test(location.hostname)) window.__lw = { togglePreview, get preview() { return !!preview; }, get s() { return s; }, get w() { return world; }, get v() { return view; }, get land() { return land; }, wakeGlade, toggleMap, celebrate, tick: (n, dt = .5) => { const ev = []; for (let k = 0; k < n; k++) tick(s, world, dt, ev); handle(ev, performance.now()); land.markAll(); view.allFlora(); updateUI(); return ev.length; }, grant: n => { s.seeds += n; updateUI(); } };
    ready = true; $('loading').style.display = 'none'; updateUI();
    if (s.touched && s.season) jot(s.season);
    showTitle();
    if (raw) returnFrom(away);
    requestAnimationFrame(frame);
  } catch (e) { console.error(e); $('loading').querySelector('span').textContent = 'The artwork could not load. Refresh to try again.'; }
}
main();
