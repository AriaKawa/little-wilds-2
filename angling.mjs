// Fishing, played: the rod (F), casting into water, the bite, the reel, the catch, the backpack (B), Old Tam's
// market on the pier, and the quests of Old Tam and Lord Cinderbrow. The rules are in fishing.mjs.
import { ZONES } from './world.mjs?v=36';
import { income } from './sim.mjs?v=36';
import { FISH, FISH_BY, TIERS, RODS, ICON, ITEM_COLS, ITEM_ROWS, STACK, BAG_MAX, GIVERS, isNight, waterAt, rollCatch, fishWhere, fishWorth, marketPrice, wantedFish, bagAdd, sellSlot, sellAll, bagWorth, bagCost, questNeeds, questOf, questState, questReady, questMark, wantHave, wantLabel, questSeeds, turnIn } from './fishing.mjs?v=36';

const esc = t => String(t).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]);
const iconPos = i => `${(i % ITEM_COLS / (ITEM_COLS - 1) * 100).toFixed(3)}% ${(Math.floor(i / ITEM_COLS) / (ITEM_ROWS - 1) * 100).toFixed(3)}%`;
export const icon = (i, cls = '') => `<i class="item ${cls}" style="background-position:${iconPos(i)}"></i>`;
const SEED = '<i class="ico ico-seed"></i>';
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
  let on = false, F = { phase: 'idle' }, hold = false, selected = -1, marks = {}, cardTimer = 0, tickAt = 0, lastTrack = '';
  const inc = () => income(S());

  /* The rod */
  function toggle(want = !on) {
    if (want === on) return;
    on = want;
    if (!on) { if (F.phase === 'reel') endReel(false, ''); F = { phase: 'idle' }; }
    document.body.classList.toggle('fishing', on);
    $('btn-fish').setAttribute('aria-pressed', on);
    $('fishbar').hidden = !on;
    if (on) { setBar('Click open water to cast your line'); audio.start(); }
  }
  const setBar = text => { $('fishbar').innerHTML = `${icon(ICON.rod)}<span>${text}</span><small>F to put the rod away</small>`; };
  function cast(x, y, w, now) {
    const rod = RODS[S().rod];
    F = { phase: 'fly', at: { x, y }, water: w, t0: now, biteAt: now + 450 + (2200 + Math.random() * 5000) * rod.bite, nibble: 0, nextNibble: now + 1200 + Math.random() * 1500 };
    audio.cast();
    setBar(`Waiting for a bite in the ${w.kind === 'sea' ? 'sea' : w.kind}… <em>${esc(w.region)}${isNight(S()) ? ' · night' : ''}</em>`);
  }
  function hook() {
    const s = S(), f = F.fish;
    F.phase = 'reel'; hold = false;
    F.reel = { p: .5, target: .5, retarget: 0, b: .5 - RODS[s.rod].band / 2, bv: 0, prog: .3, w: RODS[s.rod].band };
    $('reel').hidden = false; $('reel').classList.toggle('hard', f.tier >= 3);
    $('reel-fish').style.backgroundPosition = iconPos(f.icon);
    $('reel-title').textContent = f.tier >= 4 ? 'Something huge is on the line!' : f.tier >= 3 ? 'Something strong is on the line!' : 'Something is on the line!';
    $('reel-band').style.width = F.reel.w * 100 + '%';
    setBar('Reeling in…');
    audio.bite();
  }
  function lose(text) { F = { phase: 'idle' }; audio.lost(); toast(text); setBar('Click open water to cast again'); }
  function endReel(caught, text) {
    $('reel').hidden = true; hold = false;
    const f = F.fish;
    F = { phase: 'idle' };
    if (caught) landFish(f); else if (text) lose(text);
    if (on) setBar('Click open water to cast again');
  }
  function landFish(f) {
    const s = S(), first = !s.caught[f.id], worth = fishWorth(f, inc());
    s.caught[f.id] = (s.caught[f.id] || 0) + 1;
    const kept = bagAdd(s, f.id);
    const where = kept ? `Into your backpack · ${s.bag.length} / ${s.bagSize} slots` : 'Your backpack is full, so you let it go. Sell your catch to Old Tam to make room.';
    audio.caught();
    const c = $('catch');
    c.innerHTML = `<div class="catch-card t${f.tier}">${first ? '<em class="new">New catch!</em>' : ''}${icon(f.icon, 'big')}${tierTag(f)}<b>${f.junk ? 'You fished up an ' : 'You caught a '}${esc(f.name.toLowerCase())}!</b><span>${esc(f.desc)}</span><small>${kept ? `${SEED} Old Tam pays ${fmt(worth)} · ` : ''}${where}</small></div>`;
    c.hidden = false; c.classList.remove('show'); void c.offsetWidth; c.classList.add('show');
    clearTimeout(cardTimer); cardTimer = setTimeout(() => c.classList.remove('show'), f.tier >= 4 ? 5000 : 3400);
    jot('fish:' + f.id); save(); hud();
  }

  /* The reel: hold to push the green band right, let go and it drifts back. Keep the fish inside it. */
  function stepReel(dt, now) {
    const r = F.reel, f = F.fish, h = f.hard;
    if (now > r.retarget) { r.target = Math.random(); r.retarget = now + (1500 - h * 1000) * (.4 + Math.random() * .8); }
    const sp = .18 + h * .95, d = r.target - r.p;
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
    if (r.prog >= 1) endReel(true);
    else if (r.prog <= 0) endReel(false, 'The line went slack. It got away!');
  }
  function step(now, dt) {
    if (F.phase === 'idle') return;
    if (F.phase === 'fly' && now - F.t0 > 450) { F.phase = 'wait'; audio.nibble(); }
    if (F.phase === 'wait') {
      if (now > F.nextNibble && now < F.biteAt - 500) { F.nibble = now + 260; F.nextNibble = now + 1400 + Math.random() * 2600; audio.nibble(); }
      if (now >= F.biteAt) { const s = S(); F.phase = 'bite'; F.biteEnd = now + 1050 + RODS[s.rod].luck * 200; F.fish = rollCatch(F.water.kind, F.water.region, s.rod, isNight(s)); audio.bite(); setBar('<b class="strike">A bite! Click or press Space!</b>'); }
    }
    if (F.phase === 'bite' && now > F.biteEnd) lose('Too slow! Strike as soon as the bobber dips.');
    if (F.phase === 'reel') stepReel(dt, now);
  }

  /* Input */
  function pointerDown(e, now) {
    if (F.phase === 'bite') { hook(); return true; }
    if (F.phase === 'reel') { hold = true; return true; }
    if (!on) return false;
    const v = V(), p = v.toWorld(e.clientX, e.clientY), w = waterAt(S(), Wd(), p.x, p.y);
    if (!w) return false;
    if (v.cam.z < .9) { toast('Zoom in closer to cast.'); return true; }
    if (w.asleep) { toast(`${ZONES[w.zone].name} is asleep. Wake it to fish its waters.`); return true; }
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
  $('catch').addEventListener('click', () => $('catch').classList.remove('show'));

  /* The HUD: bag count, quest markers and the quest tracker. */
  function hud() {
    const s = S(); if (!s) return;
    $('bag-count').textContent = `${s.bag.length}/${s.bagSize}`;
    $('btn-bag').classList.toggle('full', s.bag.length >= s.bagSize);
    marks = { fisher: questMark(s, 'fisher'), lord: questMark(s, 'lord') };
    const rows = Object.keys(GIVERS).filter(k => questState(s, k).taken).map(k => {
      const Q = questOf(s, k), ready = questReady(s, k);
      return `<button class="qt${ready ? ' ready' : ''}" data-qt="${k}" title="${esc(GIVERS[k].name)}: ${esc(Q.title)}"><i class="portrait mini p-${k}"></i><span><b>${esc(Q.title)}</b>${Q.want.map(w => { const h = Math.min(wantHave(s, w), w.n); return `<small class="${h >= w.n ? 'ok' : ''}">${w.fish ? icon(w.fish === 'any' ? 0 : FISH_BY[w.fish].icon, 'tiny') : '✿ '}${h} / ${w.n}</small>`; }).join('')}${ready ? `<small class="go">Return to ${esc(GIVERS[k].name)}</small>` : ''}</span></button>`;
    }).join('');
    if (rows !== lastTrack) { $('quests').innerHTML = rows; lastTrack = rows; }
  }
  // Glides the camera to a giver: Old Tam at the end of his pier, the lord on his throne.
  function goTo(k) {
    const o = Wd().objects.find(q => q.place === (k === 'lord' ? 'throne' : 'pier'));
    if (!o) return;
    V().focusZone(o.zone);
    toast(k === 'lord' ? (S().objHp[o.id] === 0 ? 'Lord Cinderbrow waits on his throne in Demonreach.' : 'His throne lies in ruins in Demonreach, the isle to the north. Restore it and he returns.') : S().zones[o.zone].open ? 'Old Tam fishes from the end of the pier in Sunfall Coast. Click him to talk and to sell.' : 'Old Tam fishes from the pier in Sunfall Coast. Wake the glade beside it to meet him.');
  }
  $('quests').addEventListener('click', e => { const b = e.target.closest('[data-qt]'); if (b) goTo(b.dataset.qt); });

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
    const sell = k === 'fisher' ? `<button class="wood" data-talk="market" data-k="fisher">${icon(ICON.pack, 'tiny')}Sell fish</button>` : '';
    const buttons = got ? `<button class="wood primary" data-talk="next" data-k="${k}">Anything else?</button>${sell}<button class="wood" data-talk="bye">Farewell</button>`
      : !q.taken ? `<button class="wood primary" data-talk="accept" data-k="${k}">${k === 'lord' ? 'As you wish' : 'I\'ll do it'}</button>${sell}<button class="wood" data-talk="bye">Not now</button>`
      : ready ? `<button class="wood primary" data-talk="give" data-k="${k}">Hand it over</button>${sell}<button class="wood" data-talk="bye">Later</button>`
      : `${sell}<button class="wood" data-talk="fish">${on ? 'Back to fishing' : 'Get my rod out'}</button><button class="wood" data-talk="bag">Backpack</button>`;
    show('talk', `<div class="talk p-${k}"><div class="portrait p-${k}"></div><div class="talk-body"><h2>${esc(G.name)}</h2><p class="sub">${esc(G.role)}</p><p class="say">${esc(line)}</p>${gotHTML}${quest}<div class="row">${buttons}</div></div></div>`);
  }

  /* Old Tam's market: he buys anything you catch, and pays double for one fish a day. */
  function openMarket(msg = '') {
    const s = S(), i0 = inc(), want = wantedFish(s), keep = questNeeds(s), worth = bagWorth(s, i0), cost = bagCost(s);
    const rows = s.bag.map((q, i) => { const f = FISH_BY[q.id], p = marketPrice(s, f, i0), held = keep[q.id] ? `<small class="held">${Math.min(q.n, keep[q.id])} wanted for a quest</small>` : ''; return `<div class="mrow${f === want ? ' hot' : ''}">${icon(f.icon)}<span><b>${esc(f.name)} ×${q.n}</b>${tierTag(f)}${held}</span><small class="price">${SEED}${fmt(p)}${f === want ? ' <em>×2 today</em>' : ''}</small><button class="wood" data-mk="1" data-i="${i}">Sell 1</button>${q.n > 1 ? `<button class="wood" data-mk="all" data-i="${i}">All · ${fmt(p * q.n)}</button>` : '<span></span>'}</div>`; }).join('');
    show('market', `<div class="market-head"><i class="portrait mini p-fisher"></i><div><h2>Old Tam's market</h2><p class="sub">${msg ? esc(msg) : 'He buys anything you catch. Fish worth more as your lands earn more.'}</p></div></div>
      <div class="wanted">${icon(want.icon, 'big')}<div><b>Wanted today: ${esc(want.name)}</b><span>Old Tam pays double for it until tomorrow. ${esc(fishWhere(want))}.</span></div></div>
      ${rows ? `<div class="mrows">${rows}</div>` : '<div class="bag-info empty">Your backpack is empty. Go and catch something!</div>'}
      <div class="row"><button class="wood primary" data-mk="everything" ${worth ? '' : 'disabled'}>Sell everything · ${fmt(worth)}</button><button class="wood" data-mk="grow" ${s.bagSize >= BAG_MAX || s.seeds < cost ? 'disabled' : ''}>${s.bagSize >= BAG_MAX ? 'Backpack at its biggest' : `Bigger backpack (+4) · ${fmt(cost)}`}</button><button class="wood" data-talk="back" data-k="fisher">Back</button></div>
      <p class="sub small">Selling everything keeps back any fish an open quest still needs.</p>`);
  }

  /* The backpack window. */
  function openBag() {
    const s = S(), i0 = inc(), q = s.bag[selected];
    const slots = Array.from({ length: s.bagSize }, (_, i) => { const it = s.bag[i]; return it ? `<button class="slot t${FISH_BY[it.id].tier}${i === selected ? ' sel' : ''}" data-slot="${i}" title="${esc(FISH_BY[it.id].name)}">${icon(FISH_BY[it.id].icon)}${it.n > 1 ? `<b>${it.n}</b>` : ''}</button>` : '<span class="slot empty"></span>'; }).join('');
    const info = q ? (() => { const f = FISH_BY[q.id]; return `<div class="bag-info">${icon(f.icon, 'big')}<div><b>${esc(f.name)} ${tierTag(f)}</b><span>${esc(f.desc)}</span><small>${SEED}Old Tam pays ${fmt(marketPrice(s, f, i0))} each · ${q.n} here · ${esc(fishWhere(f))}</small></div><div class="bag-acts"><button class="wood ghost" data-bag="release">Let ${q.n > 1 ? 'them' : 'it'} go</button></div></div>`; })()
      : `<div class="bag-info empty">${s.bag.length ? 'Pick something in your backpack to look at it.' : 'Your backpack is empty. Press F, or the Fish button, and click open water to cast.'}</div>`;
    const kinds = FISH.filter(f => s.caught[f.id]).length;
    const dex = FISH.map(f => { const n = s.caught[f.id]; return `<div class="dex-f t${f.tier}${n ? ' got' : ''}" title="${n ? esc(`${f.name} (${TIERS[f.tier]}): ${f.desc} Caught ${n}.`) : esc(`Not caught yet. ${fishWhere(f)}.`)}">${icon(f.icon)}<small>${n ? esc(f.name) : '???'}</small></div>`; }).join('');
    const quests = Object.keys(GIVERS).map(k => { const G = GIVERS[k], st = questState(s, k), Q = questOf(s, k); return `<button class="bq" data-goto="${k}"><i class="portrait mini p-${k}"></i><div><b>${esc(G.name)} ${st.taken ? stars(Q.stars) : ''}</b><small>${st.taken ? `${esc(Q.title)}: ${Q.want.map(w => `${Math.min(wantHave(s, w), w.n)}/${w.n} ${esc(wantLabel(w))}`).join(', ')}` : k === 'fisher' ? `Fishes from the pier in Sunfall Coast and buys your catch. ${Math.min(st.n, G.quests.length)} of ${G.quests.length} quests done.` : `Sits his throne in Demonreach, the isle to the north. ${Math.min(st.n, G.quests.length)} of ${G.quests.length} quests done.`}</small></div></button>`; }).join('');
    show('bag', `<div class="bag-head">${icon(ICON.pack, 'big')}<div><h2>Backpack</h2><p class="sub">${s.bag.length} of ${s.bagSize} slots · ${RODS[s.rod].name} · up to ${STACK} of a kind per slot</p></div></div>
      <div class="bag">${slots}</div>${info}
      <div class="row"><button class="wood primary" data-goto="fisher">${SEED}Sell to Old Tam · worth ${fmt(bagWorth(s, i0))}</button></div>
      <h3 class="bag-h">Catches <em>${kinds} / ${FISH.length}</em></h3><div class="dex">${dex}</div>
      <h3 class="bag-h">Quests</h3>${quests}`);
  }
  function modalClick(e) {
    const s = S();
    const slot = e.target.closest('[data-slot]'); if (slot) { selected = +slot.dataset.slot === selected ? -1 : +slot.dataset.slot; openBag(); return true; }
    const go = e.target.closest('[data-goto]'); if (go) { $('modal').close(); goTo(go.dataset.goto); return true; }
    const b = e.target.closest('[data-bag]');
    if (b && b.dataset.bag === 'release') { s.bag.splice(selected, 1); selected = -1; toast('Back into the water it goes.'); save(); hud(); openBag(); return true; }
    const m = e.target.closest('[data-mk]');
    if (m) {
      const act = m.dataset.mk, i0 = inc(); let gain = 0, msg = '';
      if (act === '1' || act === 'all') gain = sellSlot(s, +m.dataset.i, act === '1' ? 1 : STACK, i0);
      if (act === 'everything') gain = sellAll(s, i0);
      if (act === 'grow') { const c = bagCost(s); if (s.seeds >= c && s.bagSize < BAG_MAX) { s.seeds -= c; s.bagSize += 4; audio.buy(); msg = 'A bigger backpack: four more slots. "Room for the big ones," he winks.'; } }
      if (gain) { audio.buy(); pulseSeeds(); msg = `Sold · +${fmt(gain)} seeds. "Pleasure doing business."`; }
      selected = -1; save(); hud(); openMarket(msg); return true;
    }
    const t = e.target.closest('[data-talk]');
    if (t) {
      const k = t.dataset.k, act = t.dataset.talk;
      if (act === 'bye') $('modal').close();
      if (act === 'accept') { questState(s, k).taken = true; audio.buy(); save(); hud(); talk(k, k === 'lord' ? 'Do not disappoint me.' : 'Good luck out there. Mind the hooks.'); }
      if (act === 'give') { const Q = questOf(s, k), got = turnIn(s, k, inc()); if (got) { audio.chime(); pulseSeeds(); save(); hud(); talk(k, Q.thanks, got); } }
      if (act === 'next') talk(k);
      if (act === 'back') talk(k);
      if (act === 'market') openMarket();
      if (act === 'fish') { $('modal').close(); toggle(true); }
      if (act === 'bag') openBag();
      return true;
    }
    return false;
  }
  function tapFolk(f) {
    if (f.kind === 'pier') { talk('fisher'); return true; }
    if (f.kind === 'lord') { talk('lord'); return true; }
    if (f.kind === 'imp') { f.wave = .9; f.pause = 1.5; audio.nibble(); toast(IMP[Math.floor(Math.random() * IMP.length)]); return true; }
    return false;
  }
  return {
    get on() { return on; }, get busy() { return F.phase === 'reel' || F.phase === 'bite'; },
    get state() { return F.phase === 'idle' ? null : F; }, get marks() { return marks; },
    toggle, step, pointerDown, keyDown, keyUp, hud, talk, openBag, openMarket, modalClick, tapFolk,
    reset() { toggle(false); selected = -1; lastTrack = ''; hud(); },
  };
}
