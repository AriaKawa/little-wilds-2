// Fishing, played: the rod (F), casting into water, the bite, the reel, the catch, the backpack (B), Old Tam's
// market on the pier, and the quests of Old Tam and Lord Cinderbrow. The rules are in fishing.mjs.
import { ZONES } from './world.mjs?v=38';
import { income } from './sim.mjs?v=38';
import { FISH, CATCHES, FISH_BY, TIERS, RODS, ICON, ITEM_COLS, ITEM_ROWS, STACK, BAG_MAX, GIVERS, clockOf, conditions, seasonNow, waterAt, rollCatch, fishWhere, fishWorth, marketPrice, cratePrice, wantedFish, bagAdd, bagCount, sellSlot, sellAll, bagWorth, bagCost, questNeeds, questOf, questState, questReady, questMark, wantHave, wantLabel, questSeeds, turnIn, TANK_BONUS, canDonate, tankBonus, tankMax, donate, TRAP, trapCost, trapCount, emptyTrap, openChest, canFish, rollCursed, priceOf, CURSED_PRICE, BAIT, TACKLE, shopPrice, useBait, ferryOpen, ferryCost, DEMON_LANDS } from './fishing.mjs?v=38';
import { mapsDone } from './sim.mjs?v=38';

const esc = t => String(t).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]);
const iconPos = i => `${(i % ITEM_COLS / (ITEM_COLS - 1) * 100).toFixed(3)}% ${(Math.floor(i / ITEM_COLS) / (ITEM_ROWS - 1) * 100).toFixed(3)}%`;
const ic = (q, cls = '') => icon(FISH_BY[q.id].icon, (q.cursed ? 'cursed ' : '') + cls);
export const icon = (i, cls = '') => `<i class="item ${cls}" style="background-position:${iconPos(i)}"></i>`;
const SEED = '<i class="ico ico-seed"></i>';
// "2 minnows", "3 striped perch", "2 catfish".
const plural = (name, n) => (n === 1 || /(fish|perch|bass|koi|salmon|trout|tang|carp|tetra)$/i.test(name) ? name : name.replace(/y$/, 'ie') + 's').toLowerCase();
const DIFF = ['', 'Easy', 'Medium', 'Hard', 'Legendary'], stars = n => `<span class="stars s${n}" title="${DIFF[n]}">${'★'.repeat(n)}<u>${'★'.repeat(4 - n)}</u><small>${DIFF[n]}</small></span>`;
const tierTag = f => f.junk ? '' : `<em class="tier t${f.tier}">${TIERS[f.tier]}</em>`;
const WAITING = {
  fisher: ['Any luck yet? Patience is most of fishing. The rest is more patience.', 'Still looking? Watch for the bobber to dip, then strike quick.', 'The fish aren\'t going anywhere. Well. They are, that\'s the trouble.'],
  lord: ['Why are you still standing here? GO.', 'My imps grow hungry while you dawdle, mortal.', 'Do not return empty-handed. I find it tedious.'],
};
const READY = { fisher: 'Well now, is that what I think it is in your pack?', lord: 'I smell tribute on you. Hand it over.' };
const IMP = ['The imp giggles and pokes your boot.', 'The imp sticks its tongue out at you.', 'The imp hops in a little circle, delighted.', 'The imp offers you a pebble. It is warm.', 'The imp hisses, then grins.'];

export function createAngling(g) {
  const { $, audio, toast, show, fmt, save, jot, pulseSeeds } = g;
  const S = () => g.s(), V = () => g.view(), Wd = () => g.world();
  let on = false, F = { phase: 'idle' }, hold = false, selected = -1, marks = {}, cardTimer = 0, tickAt = 0, lastTrack = '', placing = false, shadowAt = 0, trapTap = null, lastClock = '';
  const shadows = [];
  const inc = () => income(S());

  /* The rod */
  function toggle(want = !on) {
    if (want === on) return;
    on = want;
    if (!on) { if (F.phase === 'reel') endReel(false, ''); F = { phase: 'idle' }; shadows.length = 0; placing = false; }
    document.body.classList.toggle('fishing', on);
    $('btn-fish').setAttribute('aria-pressed', on);
    $('fishbar').hidden = !on;
    if (on) { setBar('Click open water to cast your line'); audio.start(); }
  }
  const setBar = text => { $('fishbar').innerHTML = `${icon(ICON.rod)}<span>${text}</span><small>F to put the rod away</small>`; };
  function cast(x, y, w, now) {
    const s = S(), rod = RODS[s.rod], c = conditions(s);
    let near = null, nd = 18; for (const h of shadows) { const d = Math.hypot(h.x - x, h.y - y); if (d < nd && !h.fleeing) { nd = d; near = h; } }
    const chum = s.baitOn === 'chum' && s.bait.chum > 0 ? .5 : 1;
    F = { phase: 'fly', at: { x, y }, water: w, t0: now, shadow: near, biteAt: near ? Infinity : now + 450 + (3000 + Math.random() * 6000) * rod.bite * chum, nibble: 0, nextNibble: now + 1200 + Math.random() * 1500 };
    for (const h of shadows) if (h !== near && Math.hypot(h.x - x, h.y - y) < 10) { h.fleeing = true; h.a = Math.atan2(h.y - y, h.x - x); } // the splash scares the others off
    audio.cast();
    setBar(`${near ? 'A fish is coming to look' : 'Waiting for a bite'} in the ${w.kind === 'sea' ? 'sea' : w.kind}… <em>${esc(w.region)}${c.night ? ' · night' : ''}${c.rain ? ' · rain' : ''}</em>`);
  }
  function hook() {
    const s = S(), f = F.fish;
    F.phase = 'reel'; hold = false;
    if (F.shadow) { shadows.splice(shadows.indexOf(F.shadow), 1); F.shadow = null; }
    const w0 = RODS[s.rod].band;
    F.reel = { p: .5, target: .5, retarget: 0, b: .5 - w0 / 2, bv: 0, prog: .3, w: w0, w0, burst: 1, chest: Math.random() < .14 + RODS[s.rod].luck * .06 ? { at: .1 + Math.random() * .8, from: performance.now() + 900 + Math.random() * 2500, got: 0, done: false } : null };
    if (F.reel.chest) F.reel.chest.until = F.reel.chest.from + 6500;
    $('reel-chest').hidden = true; $('reel-chest').classList.remove('open');
    $('reel').hidden = false; $('reel').classList.toggle('hard', f.tier >= 3); $('reel').classList.toggle('cursed', !!F.cursed);
    $('reel-fish').style.backgroundPosition = iconPos(f.icon);
    $('reel-title').textContent = f.tier >= 4 ? 'Something huge is on the line!' : f.tier >= 3 ? 'Something strong is on the line!' : 'Something is on the line!';
    $('reel-band').style.width = F.reel.w * 100 + '%';
    setBar('Reeling in…');
    audio.bite();
  }
  function lose(text) { F = { phase: 'idle' }; audio.lost(); toast(text); setBar('Click open water to cast again'); }
  function endReel(caught, text) {
    $('reel').hidden = true; hold = false;
    const f = F.fish, chest = F.reel?.chest?.done, cursed = F.cursed;
    F = { phase: 'idle' };
    if (caught) landFish(f, chest, cursed); else if (text) lose(text + (chest ? ' The chest sank with it.' : ''));
    if (on) setBar('Click open water to cast again');
  }
  let swapFish = null;
  function landFish(f, chest = false, cursed = false) {
    const s = S(), first = !s.caught[f.id], worth = fishWorth(f, inc());
    s.caught[f.id] = (s.caught[f.id] || 0) + 1;
    const kept = bagAdd(s, f.id, cursed), loot = chest ? openChest(s, inc()) : null;
    const cheap = !kept && f.tier >= 3 ? s.bag.map((q, i) => [i, FISH_BY[q.id].v]).filter(([i]) => FISH_BY[s.bag[i].id].tier < f.tier).sort((a, b) => a[1] - b[1])[0]?.[0] : undefined;
    swapFish = cheap !== undefined ? { f, slot: cheap } : null;
    const where = kept ? `Into your backpack · ${s.bag.length} / ${s.bagSize} slots` : swapFish ? 'Your backpack is full! Make room for it?' : 'Your backpack is full, so you let it go. Sell your catch to make room.';
    const swap = swapFish ? `<div class="swap"><button class="wood primary" data-swap="yes">Let your ${s.bag[cheap].n > 1 ? s.bag[cheap].n + ' ' : ''}${esc(plural(FISH_BY[s.bag[cheap].id].name, s.bag[cheap].n))} go</button><button class="wood" data-swap="no">Let this one go</button></div>` : '';
    const lootHTML = loot ? `<div class="loot">${icon(ICON.chestOpen)}<span>Treasure! <b>+${fmt(loot.seeds)}</b> seeds${loot.pearl ? ' and a pearl' : ''}</span></div>` : '';
    audio.caught(); if (loot) { audio.chime(); pulseSeeds(); }
    const c = $('catch');
    const price = cursed ? `${SEED} Lord Cinderbrow pays ${fmt(worth * CURSED_PRICE)} · ` : `${SEED} Old Tam pays ${fmt(worth)} · `;
    c.innerHTML = `<div class="catch-card t${f.tier}${cursed ? ' cursed' : ''}">${first ? '<em class="new">New catch!</em>' : ''}${icon(f.icon, 'big' + (cursed ? ' cursed' : ''))}${tierTag(f)}${cursed ? '<em class="tier curse">Cursed</em>' : ''}<b>${f.junk ? 'You fished up an ' : cursed ? 'You caught a cursed ' : 'You caught a '}${esc(f.name.toLowerCase())}!</b><span>${cursed ? 'It glows a sickly violet and glares at you. Old Tam will not touch it, but Lord Cinderbrow adores these.' : esc(f.desc)}</span><small>${kept ? price : ''}${where}</small>${lootHTML}${swap}</div>`;
    c.hidden = false; c.classList.remove('show'); void c.offsetWidth; c.classList.add('show');
    clearTimeout(cardTimer); if (!swapFish) cardTimer = setTimeout(() => c.classList.remove('show'), f.tier >= 4 || loot ? 5000 : 3400);
    jot('fish:' + f.id); save(); hud();
  }

  /* The reel: hold to push the green band right, let go and it drifts back. Keep the fish inside it. */
  function stepReel(dt, now) {
    const r = F.reel, f = F.fish, h = Math.min(.95, f.hard + (F.cursed ? .12 : 0)); // cursed fish fight harder
    // How it fights: smooth swimmers wander, darters jump in bursts, sinkers hang back and floaters pull ahead;
    // mixed fish change style every couple of seconds.
    const mv = f.move === 'mixed' ? ['smooth', 'dart', 'sink', 'float'][Math.floor(now / 2200) % 4] : f.move || 'smooth';
    if (now > r.retarget) {
      const q = Math.random();
      r.target = mv === 'sink' ? q * q * .8 : mv === 'float' ? 1 - q * q * .8 : q;
      r.retarget = now + (mv === 'dart' ? (600 - h * 300) * (.5 + Math.random()) : (1500 - h * 1000) * (.4 + Math.random() * .8));
      r.burst = mv === 'dart' ? 1.9 : 1;
    }
    if (f.tier >= 4) { r.w = r.w0 * (1 - .3 * Math.max(0, Math.min(1, r.prog))); $('reel-band').style.width = r.w * 100 + '%'; } // a legend fights harder as it tires
    const sp = (.18 + h * .95) * r.burst, d = r.target - r.p;
    r.p += Math.sign(d) * Math.min(Math.abs(d), sp * dt) + (Math.random() - .5) * h * .03;
    r.p = Math.max(.02, Math.min(.98, r.p));
    r.bv += (hold ? 2.6 : -2.2) * dt; r.bv = Math.max(-1.2, Math.min(1.2, r.bv)); r.b += r.bv * dt;
    if (r.b < 0) { r.b = 0; r.bv = Math.abs(r.bv) * .25; } if (r.b > 1 - r.w) { r.b = 1 - r.w; r.bv = -Math.abs(r.bv) * .25; }
    const inside = r.p >= r.b && r.p <= r.b + r.w;
    r.prog += (inside ? .3 - h * .08 : -(.13 + h * .14)) * dt;
    if (inside && now > tickAt) { audio.reel(); tickAt = now + 110; }
    $('reel-band').style.left = r.b * 100 + '%'; $('reel-band').classList.toggle('on', inside);
    $('reel-fish').style.left = r.p * 100 + '%'; $('reel-prog').style.width = Math.max(0, Math.min(1, r.prog)) * 100 + '%';
    $('reel').classList.toggle('slipping', !inside);
    const C = r.chest;
    if (C && !C.done && now > C.from && now < C.until) {
      if (r.b <= C.at && C.at <= r.b + r.w) C.got += dt;
      if (C.got >= 1.3) { C.done = true; $('reel-chest').classList.add('open'); audio.chime(); }
      $('reel-chest').hidden = false; $('reel-chest').style.left = C.at * 100 + '%'; $('reel-chest-bar').style.width = Math.min(1, C.got / 1.3) * 100 + '%';
      $('reel-chest').classList.toggle('held', r.b <= C.at && C.at <= r.b + r.w);
    } else if (C && !C.done && now >= C.until) $('reel-chest').hidden = true;
    if (r.prog >= 1) endReel(true);
    else if (r.prog <= 0) endReel(false, 'The line went slack. It got away!');
  }
  // Fish shadows: while your rod is out, the shapes of fish drift through the water near you, bigger for rarer
  // fish. Cast close to one and it comes to your bobber.
  function stepShadows(now, dt) {
    const v = V(), s = S();
    if (!on || v.cam.z < .9) { shadows.length = 0; return; }
    const hw = innerWidth / v.cam.z / 2 + 30, hh = innerHeight / v.cam.z / 2 + 30;
    for (let i = shadows.length - 1; i >= 0; i--) { const h = shadows[i]; h.age += dt; if (h !== F.shadow && (h.age > h.life || Math.abs(h.x - v.cam.x) > hw || Math.abs(h.y - v.cam.y) > hh)) shadows.splice(i, 1); }
    if (shadows.length < 7 && now > shadowAt) {
      shadowAt = now + 350;
      for (let k = 0; k < 6; k++) {
        const p = v.toWorld(Math.random() * innerWidth, 80 + Math.random() * (innerHeight - 200)), w = waterAt(s, Wd(), p.x, p.y);
        if (!canFish(s, w) || !shadows.every(h => Math.hypot(h.x - p.x, h.y - p.y) > 26)) continue;
        shadows.push({ x: p.x, y: p.y, fish: rollCatch(w.kind, w.region, s.rod, conditions(s)), a: Math.random() * 6.283, sp: 1.5 + Math.random() * 3, age: 0, life: 16 + Math.random() * 22 });
        break;
      }
    }
    for (const h of shadows) {
      if (h === F.shadow) continue;
      if (h.fleeing) { h.age = Math.max(h.age, h.life - 1.2); }
      h.a += (Math.random() - .5) * dt * 1.6;
      const sp = h.fleeing ? 14 : h.sp, nx = h.x + Math.cos(h.a) * sp * dt, ny = h.y + Math.sin(h.a) * sp * dt;
      if (waterAt(s, Wd(), nx, ny)) { h.x = nx; h.y = ny; } else h.a += Math.PI * (.6 + Math.random() * .6);
    }
  }
  function step(now, dt) {
    stepShadows(now, dt);
    if (F.phase === 'idle') return;
    if (F.phase === 'fly' && now - F.t0 > 450) { F.phase = 'wait'; audio.nibble(); }
    if (F.phase === 'wait') {
      if (now > F.nextNibble && now < F.biteAt - 500) { F.nibble = now + 260; F.nextNibble = now + 1400 + Math.random() * 2600; audio.nibble(); }
      if (F.shadow) { // the shadow swims over, circles once, then bites
        const h = F.shadow, d = Math.hypot(F.at.x - h.x, F.at.y - h.y);
        if (d > 2) { h.a = Math.atan2(F.at.y - h.y, F.at.x - h.x); h.x += Math.cos(h.a) * Math.min(d, 7 * dt); h.y += Math.sin(h.a) * Math.min(d, 7 * dt); }
        else if (F.biteAt === Infinity) F.biteAt = now + 500 + Math.random() * 1500 * RODS[S().rod].bite;
      }
      if (now >= F.biteAt) { const s = S(); F.phase = 'bite'; F.biteEnd = now + 1050 + RODS[s.rod].luck * 200 + (s.tackle.float ? 900 : 0); F.fish = F.shadow ? F.shadow.fish : rollCatch(F.water.kind, F.water.region, s.rod, conditions(s)); F.cursed = rollCursed(F.water, F.fish); F.bait = useBait(s); audio.bite(); setBar(`<b class="strike">A bite! Click or press Space!</b>${F.bait ? ` <em>${esc(BAIT[F.bait].name.toLowerCase())} · ${s.bait[F.bait]} left</em>` : ''}`); }
    }
    if (F.phase === 'bite' && now > F.biteEnd) { if (F.shadow) { F.shadow.fleeing = true; F.shadow = null; } lose('Too slow! Strike as soon as the bobber dips.'); }
    if (F.phase === 'reel') stepReel(dt, now);
  }

  /* Input */
  function pointerDown(e, now) {
    if (F.phase === 'bite') { hook(); return true; }
    if (F.phase === 'reel') { hold = true; return true; }
    const s = S(), v = V(), p = v.toWorld(e.clientX, e.clientY);
    if (v.cam.z >= .5) { const tr = s.traps.find(q => Math.hypot(q.x - p.x, q.y - p.y + 3) < Math.max(6, 14 / v.cam.z)); if (tr) { tapTrap(tr, now); return true; } }
    if (!on && !placing) return false;
    const w = waterAt(s, Wd(), p.x, p.y);
    if (!w) return false;
    if (v.cam.z < .9) { toast(placing ? 'Zoom in closer to set your trap.' : 'Zoom in closer to cast.'); return true; }
    if (!canFish(s, w)) { toast(DEMON_LANDS.includes(w.land) ? 'Demonreach lies across the sea. Old Tam can sell you a ferry ticket.' : `${ZONES[w.zone].name} is asleep. Wake it to fish its waters.`); return true; }
    if (placing) { s.traps.push({ x: p.x, y: p.y, kind: w.kind, region: w.region, t: s.age || 0 }); placing = false; audio.cast(); toast(`Trap set in the ${w.kind}. It catches a fish every four minutes, up to five, even while you are away.`); if (on) setBar('Click open water to cast'); else $('fishbar').hidden = true; save(); return true; }
    cast(p.x, p.y, w, now); return true;
  }
  function keyDown(e) {
    if (e.code === 'KeyF' && !e.repeat) { toggle(); return true; }
    if (e.code === 'KeyB' && !e.repeat) { openBag(); return true; }
    if (e.code === 'Space' && F.phase === 'bite') { e.preventDefault(); hook(); return true; }
    if (e.code === 'Space' && F.phase === 'reel') { e.preventDefault(); hold = true; return true; }
    return F.phase === 'reel';
  }
  function keyUp(e) { if (e.code === 'Space') hold = false; }
  $('reel').addEventListener('pointerdown', e => { e.preventDefault(); hold = true; });
  addEventListener('pointerup', () => { hold = false; }); addEventListener('pointercancel', () => { hold = false; }); addEventListener('blur', () => { hold = false; });
  $('catch').addEventListener('click', e => {
    const b = e.target.closest('[data-swap]'), s = S();
    if (b && swapFish && b.dataset.swap === 'yes') { const q = s.bag[swapFish.slot]; s.bag.splice(swapFish.slot, 1); bagAdd(s, swapFish.f.id); toast(`Let the ${FISH_BY[q.id].name.toLowerCase()} go. The ${swapFish.f.name.toLowerCase()} is in your backpack.`); save(); hud(); }
    else if (b && swapFish) toast(`The ${swapFish.f.name.toLowerCase()} slips back into the water.`);
    swapFish = null; $('catch').classList.remove('show');
  });

  /* Fish traps */
  function tapTrap(tr, now) {
    const s = S(), n = trapCount(s, tr);
    if (n > 0) {
      const got = emptyTrap(s, tr);
      if (!got.length) { toast('Your backpack is full. Sell some fish, then empty the trap.'); return; }
      const names = {}; for (const f of got) names[f.name] = (names[f.name] || 0) + 1;
      for (const f of got) jot('fish:' + f.id);
      audio.caught(); toast(`From the trap: ${Object.entries(names).map(([k, c]) => `${c} ${plural(k, c)}`).join(', ')}${got.length < n ? ' (your backpack is full)' : ''}.`); save(); hud(); return;
    }
    if (trapTap === tr && now - tr.tapped < 3000) { s.traps.splice(s.traps.indexOf(tr), 1); trapTap = null; toast('You pick the trap up. Set it somewhere new from your backpack.'); save(); return; }
    const left = Math.ceil(TRAP.every - ((s.age || 0) - tr.t) % TRAP.every); trapTap = tr; tr.tapped = now;
    toast(`Nothing yet. The next fish in about ${left >= 60 ? Math.ceil(left / 60) + ' min' : left + ' s'}. Click again to pick the trap up.`);
  }
  function placeTrap() { const s = S(); if (s.trapsOwned <= s.traps.length) return; placing = true; $('modal').close(); $('fishbar').hidden = false; setBar('Click open water to set your trap'); }

  /* The HUD: bag count, quest markers and the quest tracker. */
  function hud() {
    const s = S(); if (!s) return;
    $('bag-count').textContent = `${s.bag.length}/${s.bagSize}`;
    const c = clockOf(s), season = seasonNow(s), m = Math.floor(c.left / 60), sec = String(c.left % 60).padStart(2, '0');
    const clock = `${icon(c.night ? ICON.moon : ICON.sun)}<span><b>${c.night ? 'Night' : 'Day'}</b><small>${c.night ? 'Dawn' : 'Nightfall'} in ${m}:${sec} · ${season[0].toUpperCase() + season.slice(1)}${s.wx?.kind === 'rain' ? ' · rain' : s.wx?.kind === 'snow' ? ' · snow' : ''}</small></span>`;
    if (clock !== lastClock) { $('clock').innerHTML = clock; $('clock').classList.toggle('night', c.night); lastClock = clock; }
    $('btn-bag').classList.toggle('full', s.bag.length >= s.bagSize);
    marks = { fisher: questMark(s, 'fisher'), lord: questMark(s, 'lord') };
    if (placing && !$('modal').open) $('fishbar').hidden = false;
    const rows = Object.keys(GIVERS).filter(k => questState(s, k).taken).map(k => {
      const Q = questOf(s, k), ready = questReady(s, k);
      return `<button class="qt${ready ? ' ready' : ''}" data-qt="${k}" title="${esc(GIVERS[k].name)}: ${esc(Q.title)}"><i class="portrait mini p-${k}"></i><span><b>${esc(Q.title)}</b>${Q.want.map(w => { const h = Math.min(wantHave(s, w), w.n); return `<small class="${h >= w.n ? 'ok' : ''}">${w.fish ? icon(w.fish === 'any' ? 0 : FISH_BY[w.fish].icon, 'tiny') : '✿ '}${h} / ${w.n}</small>`; }).join('')}${ready ? `<small class="go">Return to ${esc(GIVERS[k].name)}</small>` : ''}</span></button>`;
    }).join('');
    const strays = V()?.strays?.() || [];
    const all = rows + (strays.length ? `<button class="qt ready" data-qt="imp"><i class="item fork-i" style="background-position:${iconPos(ICON.fork)}"></i><span><b>${strays.length > 1 ? strays.length + ' imps have' : 'An imp has'} run off!</b><small class="go">Find ${strays.length > 1 ? 'them' : 'it'} and tap to send ${strays.length > 1 ? 'them' : 'it'} home</small></span></button>` : '');
    if (all !== lastTrack) { $('quests').innerHTML = all; lastTrack = all; }
  }
  // Glides the camera to a giver: Old Tam at the end of his pier, the lord on his throne.
  function goTo(k) {
    const o = Wd().objects.find(q => q.place === (k === 'lord' ? 'throne' : 'pier'));
    if (!o) return;
    V().focusZone(o.zone);
    toast(k === 'lord' ? (S().objHp[o.id] === 0 ? 'Lord Cinderbrow waits on his throne in Demonreach.' : 'His throne lies in ruins in Demonreach, the isle to the north. Restore it and he returns.') : S().zones[o.zone].open ? 'Old Tam fishes from the end of the pier in Sunfall Coast. Click him to talk and to sell.' : 'Old Tam fishes from the pier in Sunfall Coast. Wake the glade beside it to meet him.');
  }
  $('quests').addEventListener('click', e => { const b = e.target.closest('[data-qt]'); if (!b) return; if (b.dataset.qt === 'imp') { const f = V().strays()[0]; if (f) V().glide(f.x, f.y, Math.max(2.2, V().cam.z)); return; } goTo(b.dataset.qt); });

  /* Talking with the quest givers. */
  function rewardHTML(r) {
    const out = [];
    if (r.seeds) out.push(`<span>${SEED}${fmt(questSeeds(r.seeds, inc()))}</span>`);
    if (r.rod && r.rod > S().rod) out.push(`<span>${icon(ICON.rod, 'tiny')}${RODS[r.rod].name}</span>`);
    if (r.bag) out.push(`<span>${icon(ICON.pack, 'tiny')}+${r.bag} backpack slots</span>`);
    if (r.boon) out.push(`<span class="boon">✦ +${Math.round(r.boon * 100)}% to all earnings</span>`);
    return out.join('');
  }
  const wantRow = (s, w) => {
    const h = wantHave(s, w), f = w.fish && w.fish !== 'any' ? FISH_BY[w.fish] : null;
    const note = f ? (s.caught[f.id] ? fishWhere(f) : `Not caught yet · ${fishWhere(f)}`) : w.fish === 'any' ? 'Anything but boots' : 'Wake and restore them';
    return `<li class="${h >= w.n ? 'ok' : ''}">${w.fish ? icon(f ? f.icon : 0) : '<i class="item glade">✿</i>'}<span>${esc(wantLabel(w))}<small>${esc(note)}</small></span><b>${Math.min(h, w.n)} / ${w.n}</b></li>`;
  };
  function talk(k, said = null, got = null) {
    const s = S(), G = GIVERS[k], q = questState(s, k), Q = questOf(s, k), ready = q.taken && questReady(s, k);
    if (k === 'fisher') jot('folk');
    const line = said ?? (!q.taken ? Q.ask : ready ? READY[k] : WAITING[k][Math.floor(Math.random() * WAITING[k].length)]);
    const gotHTML = got ? `<div class="got">You received: ${[got.seeds ? `<span>${SEED}${fmt(got.seeds)}</span>` : '', got.rod ? `<span>${icon(ICON.rod, 'tiny')}${got.rod}</span>` : '', got.bag ? `<span>${icon(ICON.pack, 'tiny')}+${got.bag} slots</span>` : '', got.boon ? `<span class="boon">✦ +${Math.round(got.boon * 100)}% earnings</span>` : ''].join('')}</div>` : '';
    const ladder = Q.order ? '<em>order</em>' : `<em>${q.n + 1} / ${G.quests.length}</em>`;
    const quest = got ? '' : `<div class="quest${ready ? ' ready' : ''}"><h3><span>${esc(Q.title)} ${stars(Q.stars)}</span>${ladder}</h3><ul class="wants">${Q.want.map(w => wantRow(s, w)).join('')}</ul><div class="rewards"><small>Reward</small>${rewardHTML(Q.reward)}</div></div>`;
    const sell = k === 'fisher' ? `<button class="wood" data-talk="market" data-k="fisher">${icon(ICON.pack, 'tiny')}Sell &amp; shop</button>${s.ferry ? `<button class="wood" data-talk="ferry">${icon(ICON.boat, 'tiny')}Ferry</button>` : ''}` : `<button class="wood" data-talk="lordmarket" data-k="lord">${icon(ICON.curse, 'tiny')}Sell cursed fish</button>`;
    const buttons = got ? `<button class="wood primary" data-talk="next" data-k="${k}">Anything else?</button>${sell}<button class="wood" data-talk="bye">Farewell</button>`
      : !q.taken ? `<button class="wood primary" data-talk="accept" data-k="${k}">${k === 'lord' ? 'As you wish' : 'I\'ll do it'}</button>${sell}<button class="wood" data-talk="bye">Not now</button>`
      : ready ? `<button class="wood primary" data-talk="give" data-k="${k}">Hand it over</button>${sell}<button class="wood" data-talk="bye">Later</button>`
      : `${sell}<button class="wood" data-talk="fish">${on ? 'Back to fishing' : 'Get my rod out'}</button><button class="wood" data-talk="bag">Backpack</button>`;
    show('talk', `<div class="talk p-${k}"><div class="portrait p-${k}"></div><div class="talk-body"><h2>${esc(G.name)}</h2><p class="sub">${esc(G.role)}</p><p class="say">${esc(line)}</p>${gotHTML}${quest}<div class="row">${buttons}</div></div></div>`);
  }

  /* Old Tam's market: he buys anything you catch, and pays double for one fish a day. */
  let marketWho = 'tam';
  function openMarket(msg = '', who = marketWho) {
    marketWho = who;
    if (who === 'lord') return openLordMarket(msg);
    const s = S(), i0 = inc(), want = wantedFish(s), keep = questNeeds(s), worth = bagWorth(s, i0), cost = bagCost(s);
    const rows = s.bag.map((q, i) => { const f = FISH_BY[q.id], p = priceOf(s, q, i0), k = q.id + (q.cursed ? '*' : ''), held = keep[k] ? `<small class="held">${Math.min(q.n, keep[k])} wanted for a quest</small>` : ''; return `<div class="mrow${f === want && !q.cursed ? ' hot' : ''}${q.cursed ? ' cursed' : ''}">${ic(q)}<span><b>${q.cursed ? 'Cursed ' + esc(f.name.toLowerCase()) : esc(f.name)} ×${q.n}</b>${tierTag(f)}${held}</span>${q.cursed ? '<small class="price no">"Get that thing away from me!"</small><span></span><span></span>' : `<small class="price">${SEED}${fmt(p)}${f === want ? ' <em>×2 today</em>' : ''}</small><button class="wood" data-mk="1" data-i="${i}">Sell 1</button>${q.n > 1 ? `<button class="wood" data-mk="all" data-i="${i}">All · ${fmt(p * q.n)}</button>` : '<span></span>'}`}</div>`; }).join('');
    show('market', `<div class="market-head"><i class="portrait mini p-fisher"></i><div><h2>Old Tam's market</h2><p class="sub">${msg ? esc(msg) : 'He buys anything you catch. Fish worth more as your lands earn more.'}</p></div></div>
      <div class="wanted">${icon(want.icon, 'big')}<div><b>Wanted today: ${esc(want.name)}</b><span>Old Tam pays double for it until tomorrow. ${esc(fishWhere(want))}.</span></div></div>
      ${rows ? `<div class="mrows">${rows}</div>` : '<div class="bag-info empty">Your backpack is empty. Go and catch something!</div>'}
      <div class="row"><button class="wood primary" data-mk="everything" ${worth ? '' : 'disabled'}>Sell everything · ${fmt(worth)}</button><button class="wood" data-mk="grow" ${s.bagSize >= BAG_MAX || s.seeds < cost ? 'disabled' : ''}>${s.bagSize >= BAG_MAX ? 'Backpack at its biggest' : `Bigger backpack (+4) · ${fmt(cost)}`}</button><button class="wood" data-mk="trap" ${s.trapsOwned >= TRAP.max || s.seeds < trapCost(s) ? 'disabled' : ''}>${icon(ICON.trap, 'tiny')}${s.trapsOwned >= TRAP.max ? 'All traps bought' : `Fish trap · ${fmt(trapCost(s))}`}</button><button class="wood" data-talk="tank">${icon(ICON.bowl, 'tiny')}Aquarium</button><button class="wood" data-talk="back" data-k="fisher">Back</button></div>
      <p class="sub small">Selling everything keeps back any fish an open quest still needs.</p>
      ${shopHTML(s, i0)}`);
  }
  // Bait, tackle and the ferry ticket, on Old Tam's shelf.
  function shopHTML(s, i0) {
    const bait = Object.entries(BAIT).map(([k, b]) => { const p = shopPrice(b.price, i0); return `<div class="shop">${icon(b.icon)}<span><b>${b.name} <em>×${b.n}</em></b><small>${b.desc} You have ${s.bait[k] || 0}.</small></span><button class="wood" data-buy="${k}" ${s.seeds < p ? 'disabled' : ''}>${fmt(p)}</button></div>`; }).join('');
    const tackle = Object.entries(TACKLE).map(([k, b]) => { const p = shopPrice(b.price, i0), own = s.tackle[k]; return `<div class="shop${own ? ' own' : ''}">${icon(b.icon)}<span><b>${b.name}</b><small>${b.desc}</small></span>${own ? '<b class="ok">✓ Yours</b>' : `<button class="wood" data-buy="${k}" ${s.seeds < p ? 'disabled' : ''}>${fmt(p)}</button>`}</div>`; }).join('');
    const open = ferryOpen(s, mapsDone(s)), fp = ferryCost(i0);
    const ferry = `<div class="shop ferry${s.ferry ? ' own' : ''}">${icon(ICON.boat)}<span><b>Ferry to Demonreach</b><small>${s.ferry ? 'Your ticket never runs out. Sail whenever you like.' : open ? 'My cousin rows to the demon isle. You could fish its waters before you restore it, and meet its lord.' : 'Help me with six quests, or restore four lands, and I\'ll have my cousin row you over.'}</small></span>${s.ferry ? '<button class="wood primary" data-talk="ferry">Sail</button>' : `<button class="wood" data-buy="ferry" ${!open || s.seeds < fp ? 'disabled' : ''}>${open ? fmt(fp) : 'Locked'}</button>`}</div>`;
    return `<h3 class="bag-h">Bait &amp; tackle</h3>${bait}${tackle}<h3 class="bag-h">Travel</h3>${ferry}`;
  }
  // Lord Cinderbrow's larder: he buys cursed fish only, at three times their worth.
  function openLordMarket(msg = '') {
    const s = S(), i0 = inc(), worth = bagWorth(s, i0, 'lord');
    const rows = s.bag.map((q, i) => q.cursed ? (() => { const f = FISH_BY[q.id], p = priceOf(s, q, i0, 'lord'); return `<div class="mrow cursed">${ic(q)}<span><b>Cursed ${esc(f.name.toLowerCase())} ×${q.n}</b>${tierTag(f)}</span><small class="price">${SEED}${fmt(p)} <em>triple</em></small><button class="wood" data-mk="1" data-i="${i}">Sell 1</button>${q.n > 1 ? `<button class="wood" data-mk="all" data-i="${i}">All · ${fmt(p * q.n)}</button>` : '<span></span>'}</div>`; })() : '').join('');
    show('market', `<div class="market-head"><i class="portrait mini p-lord"></i><div><h2>The lord's larder</h2><p class="sub">${msg ? esc(msg) : 'Lord Cinderbrow buys cursed fish, and pays three times what they are worth. Ordinary fish bore him.'}</p></div></div>
      ${rows ? `<div class="mrows">${rows}</div>` : `<div class="bag-info empty">No cursed fish in your backpack. Fish the waters round Demonreach: about one catch in three comes up cursed.</div>`}
      <div class="row"><button class="wood primary" data-mk="everything" ${worth ? '' : 'disabled'}>Sell every cursed fish · ${fmt(worth)}</button><button class="wood" data-talk="back" data-k="lord">Back</button></div>`);
  }
  // The ferry: sail over to fish round the isle, or call on its lord.
  function openFerry() {
    const s = S(), throne = Wd().objects.find(q => q.place === 'throne'), home = throne && s.objHp[throne.id] === 0;
    show('ferry', `<div class="bag-head">${icon(ICON.boat, 'big')}<div><h2>The Demonreach ferry</h2><p class="sub">Tam's cousin Wynn rows you across the channel. "Mind the water, it bites back up there."</p></div></div>
      <div class="row"><button class="wood primary" data-ferry="sail">${icon(ICON.rod, 'tiny')}Sail and fish</button><button class="wood" data-ferry="lord">${icon(ICON.fork, 'tiny')}Call on Lord Cinderbrow</button><button class="wood" data-talk="bye">Stay here</button></div>
      <p class="sub small">${home ? 'His throne stands again, and his imps play round it.' : 'His throne lies in ruins, but he will still receive you at the landing.'} About one fish in three from these waters comes up cursed.</p>`);
  }

  /* The aquarium: your donated fish swim in it, and each adds to all earnings for good. */
  function openTank() {
    const s = S(), list = CATCHES.filter(canDonate), had = list.filter(f => s.tank[f.id]);
    const swim = had.map((f, n) => { const k = (n * 37 % 100) / 100; return `<i class="item swim t${f.tier}" style="background-position:${iconPos(f.icon)};top:${8 + (n * 29 % 74)}%;animation-duration:${16 + k * 14}s,${2.4 + k * 2}s;animation-delay:-${(n * 7.3) % 30}s,-${k * 3}s"></i>`; }).join('');
    const cells = list.map(f => { const inTank = s.tank[f.id], have = bagCount(s, f.id), seen = s.caught[f.id] || have || inTank; return `<div class="tc t${f.tier}${inTank ? ' in' : ''}${seen ? '' : ' unseen'}">${icon(f.icon)}<small>${seen ? esc(f.name) : '???'}</small><em>+${Math.round(TANK_BONUS[f.tier] * 1000) / 10}%</em>${inTank ? '<b class="ok">✓</b>' : have ? `<button class="wood" data-donate="${f.id}">Donate</button>` : ''}</div>`; }).join('');
    show('tank', `<div class="bag-head">${icon(ICON.bowl, 'big')}<div><h2>Sunfall Aquarium</h2><p class="sub">Donate one of each fish. Each one here adds to all your earnings, for good: rarer fish add more. <b>+${Math.round(tankBonus(s) * 1000) / 10}%</b> of a possible +${Math.round(tankMax() * 1000) / 10}%.</p></div></div>
      <div class="tank">${swim || '<p>The tank is empty. Catch a fish and donate it!</p>'}<span class="bubbles"></span></div>
      <div class="tgrid">${cells}</div>`);
  }

  /* The backpack window. */
  function openBag() {
    const s = S(), i0 = inc(), q = s.bag[selected];
    const slots = Array.from({ length: s.bagSize }, (_, i) => { const it = s.bag[i]; return it ? `<button class="slot t${FISH_BY[it.id].tier}${it.cursed ? ' cursed' : ''}${i === selected ? ' sel' : ''}" data-slot="${i}" title="${it.cursed ? 'Cursed ' : ''}${esc(FISH_BY[it.id].name)}">${ic(it)}${it.n > 1 ? `<b>${it.n}</b>` : ''}</button>` : '<span class="slot empty"></span>'; }).join('');
    const baits = Object.keys(BAIT).filter(k => s.bait[k] > 0), baitRow = baits.length || Object.keys(s.tackle).length ? `<div class="traps bait">${icon(s.baitOn ? BAIT[s.baitOn].icon : ICON.bobber)}<span><b>On your hook: ${s.baitOn ? `${BAIT[s.baitOn].name} (${s.bait[s.baitOn]} left)` : 'nothing'}</b><small>${Object.keys(s.tackle).map(k => TACKLE[k].name).join(' and ') || 'No tackle yet'}${Object.keys(s.tackle).length ? ' fitted to your rod' : ''}.</small></span><div class="bag-acts">${baits.map(k => `<button class="wood${s.baitOn === k ? ' primary' : ''}" data-bait="${k}">${icon(BAIT[k].icon, 'tiny')}${s.bait[k]}</button>`).join('')}${s.baitOn ? '<button class="wood ghost" data-bait="">None</button>' : ''}</div></div>` : '';
    const info = q ? (() => { const f = FISH_BY[q.id]; return `<div class="bag-info${q.cursed ? ' cursed' : ''}">${ic(q, 'big')}<div><b>${q.cursed ? 'Cursed ' + esc(f.name.toLowerCase()) : esc(f.name)} ${tierTag(f)}</b><span>${q.cursed ? 'It glows violet and glares at you. Old Tam won\'t touch it.' : esc(f.desc)}</span><small>${SEED}${q.cursed ? `Lord Cinderbrow pays ${fmt(priceOf(s, q, i0, 'lord'))}` : `Old Tam pays ${fmt(marketPrice(s, f, i0))}`} each · ${q.n} here · ${esc(fishWhere(f))}</small></div><div class="bag-acts"><button class="wood ghost" data-bag="release">Let ${q.n > 1 ? 'them' : 'it'} go</button></div></div>`; })()
      : `<div class="bag-info empty">${s.bag.length ? 'Pick something in your backpack to look at it.' : 'Your backpack is empty. Press F, or the Fish button, and click open water to cast.'}</div>`;
    const kinds = CATCHES.filter(f => s.caught[f.id]).length;
    const dex = CATCHES.map(f => { const n = s.caught[f.id]; return `<div class="dex-f t${f.tier}${n ? ' got' : ''}${s.tank[f.id] ? ' tanked' : ''}" title="${n ? esc(`${f.name} (${TIERS[f.tier]}): ${f.desc} Caught ${n}.${s.tank[f.id] ? ' In the aquarium.' : ''}`) : esc(`Not caught yet. ${fishWhere(f)}.`)}">${icon(f.icon)}<small>${n ? esc(f.name) : '???'}</small><em>${n ? '' : esc(fishWhere(f))}</em></div>`; }).join('');
    const quests = Object.keys(GIVERS).map(k => { const G = GIVERS[k], st = questState(s, k), Q = questOf(s, k); return `<button class="bq" data-goto="${k}"><i class="portrait mini p-${k}"></i><div><b>${esc(G.name)} ${st.taken ? stars(Q.stars) : ''}</b><small>${st.taken ? `${esc(Q.title)}: ${Q.want.map(w => `${Math.min(wantHave(s, w), w.n)}/${w.n} ${esc(wantLabel(w))}`).join(', ')}` : k === 'fisher' ? `Fishes from the pier in Sunfall Coast and buys your catch. ${Math.min(st.n, G.quests.length)} of ${G.quests.length} quests done.` : `Sits his throne in Demonreach, the isle to the north. ${Math.min(st.n, G.quests.length)} of ${G.quests.length} quests done.`}</small></div></button>`; }).join('');
    show('bag', `<div class="bag-head">${icon(ICON.pack, 'big')}<div><h2>Backpack</h2><p class="sub">${s.bag.length} of ${s.bagSize} slots · ${RODS[s.rod].name} · up to ${STACK} of a kind per slot</p></div></div>
      <div class="bag">${slots}</div>${info}
      <div class="row"><button class="wood primary" data-goto="fisher">${SEED}Sell to Old Tam · ${fmt(bagWorth(s, i0))}</button><button class="wood" data-bag="crate" ${bagWorth(s, i0, true) ? '' : 'disabled'}>${icon(ICON.crate, 'tiny')}Sell in the crate · ${fmt(bagWorth(s, i0, true))}</button><button class="wood" data-bag="tank">${icon(ICON.bowl, 'tiny')}Aquarium · +${Math.round(tankBonus(s) * 1000) / 10}%</button></div>
      <p class="sub small">The crate takes anything, anywhere, for ${Math.round(.6 * 100)}% of Old Tam's price. It keeps back fish your quests need.</p>
      ${baitRow}${s.ferry ? `<div class="traps">${icon(ICON.boat)}<span><b>Ferry ticket</b><small>Wynn rows you to Demonreach whenever you like.</small></span><button class="wood" data-talk="ferry">Sail</button></div>` : ''}
      ${s.trapsOwned ? `<div class="traps">${icon(ICON.trap)}<span><b>Fish traps</b><small>${s.traps.length} set${s.trapsOwned > s.traps.length ? ` · ${s.trapsOwned - s.traps.length} to place` : ''} · ${s.traps.reduce((a, q) => a + trapCount(s, q), 0)} fish waiting. Click a trap in the water to empty it.</small></span>${s.trapsOwned > s.traps.length ? '<button class="wood" data-bag="place">Set a trap</button>' : ''}</div>` : ''}
      <h3 class="bag-h">Catches <em>${kinds} / ${CATCHES.length}</em></h3><div class="dex">${dex}</div>
      <h3 class="bag-h">Quests</h3>${quests}`);
  }
  function modalClick(e) {
    const s = S();
    const slot = e.target.closest('[data-slot]'); if (slot) { selected = +slot.dataset.slot === selected ? -1 : +slot.dataset.slot; openBag(); return true; }
    const go = e.target.closest('[data-goto]'); if (go) { $('modal').close(); goTo(go.dataset.goto); return true; }
    const b = e.target.closest('[data-bag]');
    if (b && b.dataset.bag === 'crate') { const gain = sellAll(s, inc(), true); if (gain) { audio.buy(); pulseSeeds(); toast(`Into the crate · +${fmt(gain)} seeds`); } selected = -1; save(); hud(); openBag(); return true; }
    if (b && b.dataset.bag === 'tank') { openTank(); return true; }
    if (b && b.dataset.bag === 'place') { placeTrap(); return true; }
    const dn = e.target.closest('[data-donate]');
    if (dn) { const f = FISH_BY[dn.dataset.donate]; if (donate(s, f.id)) { audio.chime(); toast(`The ${f.name.toLowerCase()} joins the aquarium · +${Math.round(TANK_BONUS[f.tier] * 1000) / 10}% to all earnings, for good.`); save(); hud(); } openTank(); return true; }
    if (b && b.dataset.bag === 'release') { s.bag.splice(selected, 1); selected = -1; toast('Back into the water it goes.'); save(); hud(); openBag(); return true; }
    const m = e.target.closest('[data-mk]');
    if (m) {
      const act = m.dataset.mk, i0 = inc(); let gain = 0, msg = '';
      if (act === '1' || act === 'all') gain = sellSlot(s, +m.dataset.i, act === '1' ? 1 : STACK, i0, marketWho);
      if (act === 'everything') gain = sellAll(s, i0, marketWho);
      if (act === 'trap') { const c = trapCost(s); if (s.seeds >= c && s.trapsOwned < TRAP.max) { s.seeds -= c; s.trapsOwned++; audio.buy(); save(); placeTrap(); toast('A wicker fish trap. Click open water to set it.'); return true; } }
      if (act === 'grow') { const c = bagCost(s); if (s.seeds >= c && s.bagSize < BAG_MAX) { s.seeds -= c; s.bagSize += 4; audio.buy(); msg = 'A bigger backpack: four more slots. "Room for the big ones," he winks.'; } }
      if (gain) { audio.buy(); pulseSeeds(); msg = marketWho === 'lord' ? `Sold · +${fmt(gain)} seeds. "Delightfully wicked."` : `Sold · +${fmt(gain)} seeds. "Pleasure doing business."`; }
      selected = -1; save(); hud(); openMarket(msg); return true;
    }
    const buy = e.target.closest('[data-buy]');
    if (buy) {
      const k = buy.dataset.buy, i0 = inc(); let msg = '';
      if (BAIT[k]) { const p = shopPrice(BAIT[k].price, i0); if (s.seeds >= p) { s.seeds -= p; s.bait[k] = (s.bait[k] || 0) + BAIT[k].n; s.baitOn = k; msg = `${BAIT[k].n} ${BAIT[k].name.toLowerCase()}, and it's on your hook. Change bait in your backpack.`; } }
      if (TACKLE[k]) { const p = shopPrice(TACKLE[k].price, i0); if (s.seeds >= p && !s.tackle[k]) { s.seeds -= p; s.tackle[k] = 1; msg = `The ${TACKLE[k].name.toLowerCase()} is yours, for good.`; } }
      if (k === 'ferry') { const p = ferryCost(i0); if (s.seeds >= p && !s.ferry && ferryOpen(s, mapsDone(s))) { s.ferry = true; msg = 'A ferry ticket to Demonreach. "Wynn will row you any time. Just ask."'; } }
      if (msg) { audio.buy(); save(); hud(); }
      openMarket(msg, 'tam'); return true;
    }
    const fy = e.target.closest('[data-ferry]');
    if (fy) {
      if (fy.dataset.ferry === 'lord') { talk('lord'); return true; }
      const o = Wd().objects.find(q => q.place === 'throne'); $('modal').close();
      if (o) { // land on the south shore, facing the channel
        let x = o.x * 4, y = o.y * 4; while (y < o.y * 4 + 600) { const w = waterAt(s, Wd(), x, y); if (w?.kind === 'sea') break; y += 4; }
        V().glide(x, y - 30, 2.2); toggle(true); toast('Wynn rows you over to Demonreach. Cast into the dark water round the isle.');
      }
      return true;
    }
    const bt = e.target.closest('[data-bait]');
    if (bt) { const k = bt.dataset.bait; s.baitOn = k && s.bait[k] > 0 ? k : ''; save(); openBag(); return true; }
    const t = e.target.closest('[data-talk]');
    if (t) {
      const k = t.dataset.k, act = t.dataset.talk;
      if (act === 'bye') $('modal').close();
      if (act === 'accept') { questState(s, k).taken = true; audio.buy(); save(); hud(); talk(k, k === 'lord' ? 'Do not disappoint me.' : 'Good luck out there. Mind the hooks.'); }
      if (act === 'give') { const Q = questOf(s, k), got = turnIn(s, k, inc()); if (got) { audio.chime(); pulseSeeds(); save(); hud(); talk(k, Q.thanks, got); } }
      if (act === 'next') talk(k);
      if (act === 'back') talk(k);
      if (act === 'market') openMarket('', 'tam');
      if (act === 'lordmarket') openMarket('', 'lord');
      if (act === 'ferry') openFerry();
      if (act === 'tank') openTank();
      if (act === 'fish') { $('modal').close(); toggle(true); }
      if (act === 'bag') openBag();
      return true;
    }
    return false;
  }
  function tapFolk(f) {
    if (f.kind === 'pier') { talk('fisher'); return true; }
    if (f.kind === 'lord') { talk('lord'); return true; }
    if (f.kind === 'imp' && (f.stray || f.lost)) {
      const s = S(), gain = questSeeds(2, inc()); s.seeds += gain; pulseSeeds(); audio.chime();
      f.stray = false; f.lost = false; f.homing = true; f.goal = { x: f.home.x, y: f.home.y }; f.wave = .8; f.pause = 0;
      let gift = '';
      if (Math.random() < .45) { const fish = rollCatch('sea', 'Demonreach', s.rod, conditions(s)), cursed = Math.random() < .5; if (!fish.junk && bagAdd(s, fish.id, cursed)) { s.caught[fish.id] = (s.caught[fish.id] || 0) + 1; gift = ` It drops a ${cursed ? 'cursed ' : ''}${fish.name.toLowerCase()} at your feet.`; jot('fish:' + fish.id); } }
      toast(`The imp scampers home to the throne · +${fmt(gain)} seeds.${gift}`); save(); hud(); return true;
    }
    if (f.kind === 'imp') { f.wave = .9; f.pause = 1.5; audio.nibble(); toast(IMP[Math.floor(Math.random() * IMP.length)]); return true; }
    return false;
  }
  return {
    get on() { return on; }, get busy() { return F.phase === 'reel' || F.phase === 'bite'; },
    get state() { return F.phase === 'idle' ? null : F; }, get marks() { return marks; },
    get shadows() { return on ? shadows : null; }, get placing() { return placing; },
    toggle, step, pointerDown, keyDown, keyUp, hud, talk, openBag, openMarket, openTank, modalClick, tapFolk,
    reset() { toggle(false); selected = -1; lastTrack = ''; lastClock = ''; placing = false; shadows.length = 0; hud(); },
  };
}
