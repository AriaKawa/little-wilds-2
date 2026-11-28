// Pip and Bramwell, played: the bug net (N), bugs out on the land, dig spots and the shovel, Pip's bug house,
// Bramwell's museum, and their markets. Their quests run through the same dialogue as Old Tam's (angling.mjs);
// the rules are in finds.mjs.
import { ZONES, LANDS, CELL, CW, TW, TH, BEACH, KIND } from './world.mjs?v=43';
import { FISH_BY, TIERS, ITEM_COLS, ITEM_ROWS, GIVERS, questState, questNeeds, conditions, waterAt, bagAdd, bagCount, priceOf, sellAll, bagWorth, STACK } from './fishing.mjs?v=43';
import { BUGS, BUG_BY, NETS, rollBug, HOUSE_BONUS, houseBonus, houseMax, FINDS, FIND_BY, SETS, PIECES, setPieces, setDone, museumCount, museumBonus, museumMax, PIECE_BONUS, SET_BONUS, rollDig, assess, spawnDigs, DIG_ICON, DIG_SEEDS, SHOVELS, PIP_ZONE, BRAM_ZONE, stallOf } from './finds.mjs?v=43';
import { icon } from './angling.mjs?v=43';
import { portalSpot, portalStage, portalTotal, portalBonus, giveWood, PORTAL_ZONE, PORTAL_STAGES } from './timber.mjs?v=43';
const WOOD_ICON = 61, PORTAL_ICON = 63;
const STAGE_NAMES = ['A ruin of rotten posts', 'The footings set', 'The pillars raised', 'The crossbeam lifted', 'The roof beam and ropes', 'Whole, and awake'];

const esc = t => String(t).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]);
const iconPos = i => `${(i % ITEM_COLS / (ITEM_COLS - 1) * 100).toFixed(3)}% ${(Math.floor(i / ITEM_COLS) / (ITEM_ROWS - 1) * 100).toFixed(3)}%`;
const SEED = '<i class="ico ico-seed"></i>';
const tierTag = f => `<em class="tier t${f.tier}">${TIERS[f.tier]}</em>`;
const MAX_BUGS = 6;

export function createKeepers(g, angling) {
  const { $, audio, toast, show, fmt, save, jot, pulseSeeds } = g;
  const S = () => g.s(), V = () => g.view(), Wd = () => g.world(), inc = () => angling.inc;
  let net = false, spawnAt = 0, swing = null, cardTimer = 0, digCheck = 0, lastMove = null;
  const bugs = [], holes = [];

  /* The net */
  function toggleNet(want = !net) {
    const s = S();
    if (want && !s.net) { toast('Pip, the bug catcher in Honey Meadow, will lend you a net.'); return; }
    if (want === net) return;
    net = want; if (net && angling.on) angling.toggle(false);
    document.body.classList.toggle('netting', net);
    $('btn-net').setAttribute('aria-pressed', net);
    $('netbar').hidden = !net;
    if (net) { $('netbar').innerHTML = `${icon(95)}<span>${matchMedia('(pointer: coarse)').matches ? 'Tap a bug to swing' : 'Creep up slowly, then click to swing'}. ${esc(NETS[s.net].name)}.</span><small>N to put the net away</small>`; audio.start(); }
  }

  /* Bugs come and go near you, on woken ground, once you have a net. */
  function habitatAt(s, w, x, y) {
    const i = Math.floor(y) * TW + Math.floor(x), c = Math.floor(y / CELL) * CW + Math.floor(x / CELL);
    if (x < 4 || y < 4 || x >= TW - 4 || y >= TH - 4) return null;
    const zone = w.zone[c]; if (!s.zones[zone]?.open) return null;
    const region = LANDS[ZONES[zone].land].name;
    const wa = waterAt(s, w, x, y);
    if (wa && !wa.asleep && wa.kind !== 'sea') return { hab: 'water', zone, region, x, y };
    if (wa) return null;
    if (w.edge[i] === BEACH) return { hab: 'shore', zone, region, x, y };
    if (w.blocked[c] || w.waterT[i] !== 255 || s.h[c] < .4) return null;
    // a tree close by: the bug may live on its trunk
    let tree = null, td = 60; // the nearest living tree: bugs that live on trunks often pick one close by
    for (const o of w.objects) if (!o.place && o.dead === KIND.deadTree && s.objHp[o.id] === 0) { const d = Math.hypot(o.x * CELL - x, o.y * CELL - y); if (d < td) { td = d; tree = { x: o.x * CELL, y: o.y * CELL, h: o.size * .7 }; } }
    for (const t of s.trees) { const d = Math.hypot(t.x * CELL - x, t.y * CELL - y); if (d < td) { td = d; tree = { x: t.x * CELL, y: t.y * CELL, h: 22 }; } }
    return tree && (td < 14 || Math.random() < .45) ? { hab: 'tree', zone, region, x: tree.x, y: tree.y, tree } : { hab: 'meadow', zone, region, x, y };
  }
  function spawnBug(s, now) {
    const v = V(), w = Wd();
    for (let k = 0; k < 8; k++) {
      const p = v.toWorld(60 + Math.random() * (innerWidth - 120), 100 + Math.random() * (innerHeight - 240));
      let h = habitatAt(s, w, p.x, p.y); if (!h) continue;
      const b = rollBug(h.hab, h.region, conditions(s), s.net); if (!b) continue;
      if (b.tier >= 3 && bugs.some(q => q.b.tier >= 3 && !q.flee)) continue; // one rare bug about at a time
      const q = { b, x: h.x, y: h.y, ax: h.x, ay: h.y, lift: 0, dir: Math.random() < .5 ? -1 : 1, age: 0, life: (b.tier >= 3 ? 22 : 38) + Math.random() * 18, pause: 0, alpha: 0, flee: 0, alert: 0, tx: h.x, ty: h.y, ph: Math.random() * 6 };
      if (b.move === 'perch' || (h.tree && b.hab.includes('tree') && h.hab === 'tree')) { const t = h.tree || { x: h.x, y: h.y, h: 20 }; q.x = q.ax = t.x + (Math.random() - .5) * 3; q.y = q.ay = t.y + .5; q.perchLift = t.h * (.25 + Math.random() * .25); q.perched = b.move === 'perch'; }
      bugs.push(q); return;
    }
  }
  function stepBugs(now, dt) {
    const s = S(), v = V();
    if (!s.net || v.cam.z < .9) { bugs.length = 0; return; }
    if (now > spawnAt && bugs.filter(q => !q.flee).length < MAX_BUGS) { spawnAt = now + 2200 + Math.random() * 3000; spawnBug(s, now); }
    const [x0, y0, x1, y1] = v.viewBox();
    for (let i = bugs.length - 1; i >= 0; i--) {
      const q = bugs[i], b = q.b; q.age += dt; q.alert = Math.max(0, q.alert - dt);
      if (q.flee) { q.flee += dt; q.x += q.vx * dt; q.y += q.vy * dt; q.lift += (b.move === 'crawl' || b.move === 'hop' ? 0 : 30) * dt; q.alpha = Math.max(0, 1 - q.flee / .9); if (q.flee > .9) bugs.splice(i, 1); continue; }
      q.alpha = Math.min(1, q.age / 1.2, Math.max(0, (q.life - q.age) / 1.5));
      if (q.age > q.life || q.x < x0 - 80 || q.x > x1 + 80 || q.y < y0 - 80 || q.y > y1 + 80) { bugs.splice(i, 1); continue; }
      const fast = b.tier >= 4 ? 1.5 : b.tier >= 3 ? 1.2 : 1, go = sp => { const dx = q.tx - q.x, dy = q.ty - q.y, d = Math.hypot(dx, dy); if (d < .6) return true; const m = Math.min(d, sp * dt); q.x += dx / d * m; q.y += dy / d * m; if (Math.abs(dx) > .2) q.dir = dx > 0 ? 1 : -1; return false; };
      const pick = r => { q.tx = q.ax + (Math.random() - .5) * r * 2; q.ty = q.ay + (Math.random() - .5) * r * 1.4; };
      if (q.pause > 0) { q.pause -= dt; }
      if (b.move === 'flutter') { if (go(11 * fast)) pick(38); q.lift = (q.perchLift || 8) + Math.sin(q.age * 2 + q.ph) * 3; }
      else if (b.move === 'hover') { if (q.pause <= 0 && go(34 * fast)) { pick(30); q.pause = .6 + Math.random() * 1.6; } q.lift = 7 + Math.sin(q.age * 9) * .6; }
      else if (b.move === 'glow') { if (go(4)) pick(26); q.lift = 6 + Math.sin(q.age * 1.3 + q.ph) * 4; }
      else if (b.move === 'hop') {
        if (q.hop) { q.hop.t += dt / .45; const k = Math.min(1, q.hop.t); q.x = q.hop.x0 + (q.hop.x1 - q.hop.x0) * k; q.y = q.hop.y0 + (q.hop.y1 - q.hop.y0) * k; q.lift = Math.sin(k * Math.PI) * 9; if (k >= 1) { q.hop = null; q.pause = 1 + Math.random() * 2.5; } }
        else if (q.pause <= 0) { pick(22); q.hop = { t: 0, x0: q.x, y0: q.y, x1: q.tx, y1: q.ty }; q.dir = q.tx > q.x ? 1 : -1; }
      } else if (b.move === 'crawl') { if (q.pause <= 0 && go(3.2 * fast)) { pick(q.perchLift ? 1.5 : 14); q.pause = 1 + Math.random() * 3; } q.lift = q.perchLift ? q.perchLift + Math.sin(q.age) * 1.5 : 0; }
      else if (b.move === 'perch') { q.lift = q.perchLift + Math.sin(q.age * .7 + q.ph) * .5; if (Math.random() < dt * .1) q.dir *= -1; }
    }
  }
  // A bug startled by a quick hand flies (or scuttles) off and is gone.
  function scare(q, fx, fy) {
    const a = Math.atan2(q.y - fy, q.x - fx) + (Math.random() - .5) * .6, sp = q.b.move === 'crawl' ? 14 : q.b.move === 'hop' ? 40 : 70;
    q.flee = .001; q.vx = Math.cos(a) * sp; q.vy = Math.sin(a) * sp * .6; q.dir = q.vx > 0 ? 1 : -1;
  }
  // Moving the pointer quickly near a shy bug startles it. Creep up slowly instead.
  function pointerMove(e, now) {
    if (!net) { lastMove = null; return; }
    const v = V(), p = v.toWorld(e.clientX, e.clientY);
    if (lastMove && now > lastMove.t) {
      const speed = Math.hypot(p.x - lastMove.x, p.y - lastMove.y) / ((now - lastMove.t) / 1000);
      for (const q of bugs) {
        if (q.flee || q.b.shy < .15) continue;
        const d = Math.hypot(q.x - p.x, q.y - q.lift - p.y);
        if (d < 12 + q.b.shy * 34 && speed > 240 - q.b.shy * 170) { if (q.alert > 0 || Math.random() < q.b.shy) { scare(q, p.x, p.y); if (q.b.tier >= 3) toast(`The ${q.b.name.toLowerCase()} saw you coming! Move more slowly.`); } else q.alert = 1.5; }
      }
    }
    lastMove = { x: p.x, y: p.y, t: now };
  }
  function swingAt(e, now) {
    const s = S(), v = V(), p = v.toWorld(e.clientX, e.clientY), reach = NETS[s.net].reach;
    swing = { x: p.x, y: p.y, t: now, r: reach };
    audio.swish?.();
    let best = null, bd = Infinity;
    for (const q of bugs) { if (q.flee || q.alpha < .3) continue; const d = Math.hypot(q.x - p.x, q.y - q.lift - p.y) - q.b.size * .4; if (d < reach && d < bd) { bd = d; best = q; } }
    if (!best) { for (const q of bugs) if (!q.flee && q.b.shy > .25 && Math.hypot(q.x - p.x, q.y - q.lift - p.y) < reach * 2.6 && Math.random() < q.b.shy) scare(q, p.x, p.y); return; }
    const b = best.b, slip = (best.alert > 0 ? b.shy : b.shy * .3) + (b.tier >= 4 ? .1 : 0) + (bd > reach * .7 ? .15 : 0);
    if (Math.random() < slip) { scare(best, p.x, p.y); audio.lost(); toast(b.tier >= 3 ? `So close! The ${b.name.toLowerCase()} got away.` : `Missed! The ${b.name.toLowerCase()} got away.`); return; }
    bugs.splice(bugs.indexOf(best), 1);
    caught(b);
  }
  function card(f, html, long) {
    const c = $('catch');
    c.innerHTML = html; c.hidden = false; c.classList.remove('show'); void c.offsetWidth; c.classList.add('show');
    clearTimeout(cardTimer); cardTimer = setTimeout(() => c.classList.remove('show'), long ? 5000 : 3400);
  }
  function caught(b) {
    const s = S(), first = !s.caught[b.id];
    s.caught[b.id] = (s.caught[b.id] || 0) + 1;
    const kept = bagAdd(s, b.id), f = FISH_BY[b.id];
    audio.caught(); jot('bug:' + b.id);
    card(f, `<div class="catch-card t${b.tier}">${first ? '<em class="new">New bug!</em>' : ''}${icon(b.icon, 'big')}${tierTag(b)}<b>You caught a ${esc(b.name.toLowerCase())}!</b><span>${esc(b.desc)}</span><small>${kept ? `${SEED} Pip pays ${fmt(priceOf(s, { id: b.id }, inc(), 'pip'))} · Into your backpack · ${s.bag.length} / ${s.bagSize} slots` : 'Your backpack is full, so you let it go. Sell something to make room.'}</small></div>`, b.tier >= 3);
    save(); hud();
  }

  /* Dig spots */
  function digAt(spot) {
    const s = S(), v = V();
    if (!s.shovel) { toast(`Something is buried here. Bramwell, the digger at ${ZONES[BRAM_ZONE].name} in ${LANDS[ZONES[BRAM_ZONE].land].name}, could lend you a shovel.`); return; }
    const id = rollDig(s), fits = id === 'pouch' || (id === 'molecricket' && !s.net) || s.bag.some(q => q.id === id && !q.cursed && q.n < STACK) || s.bag.length < s.bagSize;
    if (!fits) { v.dirt?.(spot.x, spot.y); audio.shovel?.(); toast('You feel something down there, but your backpack is full. Make room, then dig here again.'); return; }
    s.digs.splice(s.digs.indexOf(spot), 1); s.dug = (s.dug || 0) + 1;
    holes.push({ x: spot.x, y: spot.y, t: performance.now() });
    v.dirt?.(spot.x, spot.y); audio.shovel?.();
    if (id === 'pouch') { const gain = Math.round(DIG_SEEDS(inc()) * (1 + Math.random())); s.seeds += gain; v.reward(spot.x, spot.y - 8, gain, 4); pulseSeeds(); audio.chime(); toast(`A little pouch of seeds, buried long ago · +${fmt(gain)} seeds`); save(); hud(); return; }
    if (id === 'molecricket' && !s.net) { toast('Something wriggles out of the hole and burrows off. A bug? Pip would know.'); save(); hud(); return; }
    const f = FISH_BY[id], first = !s.caught[id], kept = bagAdd(s, id);
    s.caught[id] = (s.caught[id] || 0) + 1; if (f.kind === 'bug') jot('bug:' + id);
    audio.caught(); if (f.tier >= 3) audio.chime();
    const line = id === 'fossil' ? 'It looks like a rock. Bramwell can tell you what it really is.' : id === 'boot' ? 'Another old boot. How do they get everywhere?' : f.desc;
    const pay = f.buyer === 'bram' ? `${SEED} Bramwell pays ${fmt(priceOf(s, { id }, inc(), 'bram'))} · ` : f.buyer === 'pip' ? `${SEED} Pip pays ${fmt(priceOf(s, { id }, inc(), 'pip'))} · ` : '';
    card(f, `<div class="catch-card t${f.tier}">${first ? '<em class="new">New find!</em>' : ''}${icon(f.icon, 'big')}${f.tier ? tierTag(f) : ''}<b>You dug up ${/^[aeiou]/i.test(f.name) ? 'an' : 'a'} ${esc(f.name.toLowerCase())}!</b><span>${esc(line)}</span><small>${kept ? `${pay}Into your backpack · ${s.bag.length} / ${s.bagSize} slots` : 'Your backpack is full, so you leave it. Sell something to make room.'}</small></div>`, f.tier >= 3);
    save(); hud();
  }
  function hitDig(px, py) {
    const s = S(), v = V(); if (v.cam.z < .5) return null;
    const p = v.toWorld(px, py), r = Math.max(7, 12 / v.cam.z);
    return s.digs.find(d => Math.hypot(d.x - p.x, d.y - 3 - p.y) < r) || null;
  }

  /* Input */
  function pointerDown(e, now) {
    if (!net && V().hitPortal?.(e.clientX, e.clientY)) { openPortal(); return true; }
    const dig = hitDig(e.clientX, e.clientY);
    if (dig && (!net || !bugInReach(e))) { digAt(dig); return true; }
    if (!net || V().cam.z < .9) return false; // far out on the map, a click still looks around
    swingAt(e, now); return true;
  }
  function bugInReach(e) { const p = V().toWorld(e.clientX, e.clientY), reach = NETS[S().net]?.reach || 9; return bugs.some(q => !q.flee && q.alpha > .3 && Math.hypot(q.x - p.x, q.y - q.lift - p.y) - q.b.size * .4 < reach); }
  function keyDown(e) { if (e.code === 'KeyN' && !e.repeat) { toggleNet(); return true; } return false; }

  /* The spirit portal in Birch Knoll, rebuilt with wood. */
  function openPortal(msg = '') {
    const s = S(), st = portalStage(s), total = portalTotal(), canGive = Math.min(s.wood, total - s.portal.wood);
    const stages = PORTAL_STAGES.map((need, k) => `<li class="${k < st.stage ? 'ok' : k === st.stage ? 'now' : ''}"><b>${esc(STAGE_NAMES[k + 1])}</b><small>${k < st.stage ? '✓ built' : k === st.stage ? `${st.into} / ${need} wood` : `${need} wood`}</small></li>`).join('');
    show('portal', `<div class="bag-head">${icon(PORTAL_ICON, 'big')}<div><h2>The spirit portal</h2><p class="sub">${msg ? esc(msg) + ' ' : ''}An old wooden gate the spirits once walked through, in ${ZONES[PORTAL_ZONE].name}. Give it wood and it is built up again, a little at a time. Each part raised adds 2% to all your earnings, and the whole gate 10% more.</p></div></div>
      <div class="portal-view"><i class="portal-art" style="background-position:${Math.min(st.stage, 5) * 20}% 0"></i>${st.done ? '' : `<i class="portal-art next" style="background-position:${(st.stage + 1) * 20}% 0;clip-path:inset(${100 - st.into / st.need * 100}% 0 0 0)"></i>`}</div>
      <div class="portal-bar"><i style="width:${s.portal.wood / total * 100}%"></i></div>
      <p class="sub small">${esc(STAGE_NAMES[Math.min(st.stage, 5)])} · ${s.portal.wood} of ${total} wood · +${Math.round(portalBonus(s) * 100)}% earnings now</p>
      <ul class="portal-stages">${stages}</ul>
      <div class="row">${st.done ? '<b class="ok">The portal is whole. Spirit light shines through it.</b>' : `<button class="wood primary" data-kp="givewood" ${canGive ? '' : 'disabled'}>${icon(WOOD_ICON, 'tiny')}${canGive ? `Give ${canGive} wood` : 'No wood to give'}</button>`}<button class="wood" data-talk="bye">Close</button></div>
      <p class="sub small">You have ${s.wood} wood. ${s.spirits.some(a => a.type === 4) ? 'Your Woodkin fell grown trees for more; their stumps sprout again.' : 'A Woodkin spirit fells grown trees for wood, once enough glades are restored.'}</p>`);
  }
  angling.addRow(s => {
    if (!s.zones[PORTAL_ZONE]?.open && !s.wood) return '';
    const st = portalStage(s);
    return `<button class="qt${s.wood && !st.done ? ' ready' : ''}" data-qt="portal"><i class="item" style="background-position:${iconPos(st.done ? PORTAL_ICON : WOOD_ICON)}"></i><span><b>${st.done ? 'The spirit portal is whole' : 'The spirit portal'}</b><small>${st.done ? '+' + Math.round(portalBonus(s) * 100) + '% earnings' : `${s.wood} wood · ${s.portal.wood} / ${portalTotal()} built`}</small></span></button>`;
  });
  angling.addKeeper('portal', { goTo() { const P = portalSpot(Wd()); if (P && S().zones[PORTAL_ZONE].open) { V().glide(P.x, P.y - 20, Math.max(2.2, V().cam.z)); toast('The old spirit portal. Click it to give it wood.'); } else { V().focusZone(PORTAL_ZONE); toast(`An old spirit portal stands in ${ZONES[PORTAL_ZONE].name}. Wake that glade to find it.`); } } });

  /* The tracker: dig spots waiting, once you have a shovel. */
  angling.addRow(s => {
    if (!s.shovel || !s.digs?.length) return '';
    return `<button class="qt" data-qt="dig"><i class="item" style="background-position:${iconPos(DIG_ICON.spot)}"></i><span><b>${s.digs.length} dig spot${s.digs.length > 1 ? 's' : ''} today</b><small class="go">Click to go to the nearest</small></span></button>`;
  });
  angling.addKeeper('dig', { goTo() { const s = S(), v = V(); const d = s.digs.slice().sort((a, b) => Math.hypot(a.x - v.cam.x, a.y - v.cam.y) - Math.hypot(b.x - v.cam.x, b.y - v.cam.y))[0]; if (d) { v.glide(d.x, d.y, Math.max(2.4, v.cam.z)); toast('Click the cracks in the ground to dig.'); } } });
  angling.addBagRow(s => {
    const out = [];
    if (s.net) out.push(`<div class="traps">${icon(95)}<span><b>${esc(NETS[s.net].name)}</b><small>${Object.keys(s.bugHouse).length} of ${BUGS.length} bugs in Pip's bug house · +${Math.round(houseBonus(s) * 1000) / 10}%</small></span><button class="wood" data-kp="house">Bug house</button></div>`);
    if (s.shovel) out.push(`<div class="traps">${icon(DIG_ICON.shovel)}<span><b>${esc(SHOVELS[s.shovel].name)}</b><small>${museumCount(s)} of ${PIECES.length} fossils in Bramwell's museum · +${Math.round(museumBonus(s) * 1000) / 10}%</small></span><button class="wood" data-kp="museum">Museum</button></div>`);
    return out.join('');
  });

  /* Pip */
  const where = (zone, what) => S().zones[zone].open ? `${what} at ${ZONES[zone].name} in ${LANDS[ZONES[zone].land].name}.` : `${what} at ${ZONES[zone].name} in ${LANDS[ZONES[zone].land].name}. Wake that glade to meet them.`;
  const goKeeper = (zone, text) => () => { const st = stallOf(Wd(), zone); if (st && S().zones[zone].open) V().glide(st.kx, st.ky - 10, Math.max(2.4, V().cam.z)); else V().focusZone(zone); toast(text()); };
  angling.addKeeper('pip', {
    waiting: ['Watch the long grass. Something always moves if you wait.', 'Slow hands catch the shy ones!', 'Bugs are everywhere once you start looking. Everywhere!'],
    ready: 'Is that a jar in your pack? Let me see, let me see!',
    accept: 'I\'ll catch them',
    accepted: s => questState(s, 'pip').n === 0 ? 'Here\'s the net! Press N, or the Net button, then creep up on a bug and click. Good luck!' : 'Happy hunting!',
    buttons: s => `<button class="wood" data-kp="pipmarket">${icon(95, 'tiny')}Sell bugs</button><button class="wood" data-kp="house">${icon(DIG_ICON.jar, 'tiny')}Bug house</button>`,
    idle: s => s.net ? `<button class="wood" data-kp="net">${net ? 'Back to catching' : 'Get my net out'}</button>` : '',
    where: (s, st) => `Catches bugs in ${ZONES[PIP_ZONE].name}, Hollow Vale, and buys every one. ${Math.min(st.n, GIVERS.pip.quests.length)} of ${GIVERS.pip.quests.length} quests done.`,
    goTo: goKeeper(PIP_ZONE, () => where(PIP_ZONE, 'Pip hunts for bugs')),
    market: msg => openKeeperMarket('pip', msg),
  });
  angling.addKeeper('bram', {
    waiting: ['Every crack in the ground is a door. Go and knock.', 'Dig a little every day. That\'s the whole secret.', 'Patience. The earth gives things up slowly.'],
    ready: 'Ah, you\'ve brought me something. Let\'s have a look.',
    accept: 'I\'ll dig',
    accepted: s => questState(s, 'bram').n === 0 ? 'Here, my old shovel. Click a crack in the ground to dig it. New ones turn up every day.' : 'Mind your back.',
    buttons: s => { const raw = bagCount(s, 'fossil') - (questNeeds(s).fossil || 0); return `${raw > 0 ? `<button class="wood primary" data-kp="assess">${icon(DIG_ICON.glass, 'tiny')}Look at my fossils (${raw})</button>` : ''}<button class="wood" data-kp="brammarket">${icon(DIG_ICON.shovel, 'tiny')}Sell finds</button><button class="wood" data-kp="museum">${icon(DIG_ICON.tent, 'tiny')}Museum</button>`; },
    idle: s => s.digs?.length ? '<button class="wood" data-kp="digs">Find a dig spot</button>' : '',
    where: (s, st) => `Digs at ${ZONES[BRAM_ZONE].name}, Ember Basin, and keeps a museum of fossils. ${Math.min(st.n, GIVERS.bram.quests.length)} of ${GIVERS.bram.quests.length} quests done.`,
    goTo: goKeeper(BRAM_ZONE, () => where(BRAM_ZONE, 'Bramwell digs')),
    market: msg => openKeeperMarket('bram', msg),
  });

  /* Their markets: Pip buys bugs, Bramwell fossils and relics. */
  function openKeeperMarket(who, msg = '') {
    const s = S(), i0 = inc(), worth = bagWorth(s, i0, who), name = who === 'pip' ? 'Pip' : 'Bramwell';
    const rows = s.bag.map((q, i) => { const f = FISH_BY[q.id]; if (f.buyer !== who && !(who === 'bram' && f.kind === 'raw')) return ''; if (f.kind === 'raw') return `<div class="mrow">${icon(f.icon)}<span><b>${esc(f.name)} ×${q.n}</b></span><small class="price no">"Let me look at it first!"</small><span></span><span></span></div>`; const p = priceOf(s, q, i0, who), museum = who === 'bram' && f.set && !s.museum[f.id], house = who === 'pip' && !s.bugHouse[f.id]; return `<div class="mrow">${icon(f.icon)}<span><b>${esc(f.name)} ×${q.n}</b>${tierTag(f)}${museum ? '<small class="held">Not in the museum yet</small>' : house ? '<small class="held">Not in the bug house yet</small>' : ''}</span><small class="price">${SEED}${fmt(p)}</small><button class="wood" data-mk="1" data-i="${i}">Sell 1</button>${q.n > 1 ? `<button class="wood" data-mk="all" data-i="${i}">All · ${fmt(p * q.n)}</button>` : '<span></span>'}</div>`; }).join('');
    const empty = who === 'pip' ? 'No bugs in your backpack. Press N for your net and go looking!' : 'Nothing dug up yet. Click the star-shaped cracks in the ground with your shovel.';
    show('market', `<div class="market-head"><i class="portrait mini p-${who}"></i><div><h2>${who === 'pip' ? 'Pip\'s bug jars' : 'Bramwell\'s finds'}</h2><p class="sub">${msg ? esc(msg) : who === 'pip' ? 'Pip buys every bug you catch. Rarer bugs are worth far more.' : 'Bramwell buys fossils and relics. Fossils are worth more in his museum, though.'}</p></div></div>
      ${rows ? `<div class="mrows">${rows}</div>` : `<div class="bag-info empty">${empty}</div>`}
      <div class="row"><button class="wood primary" data-mk="everything" ${worth ? '' : 'disabled'}>Sell everything · ${fmt(worth)}</button><button class="wood" data-kp="${who === 'pip' ? 'house' : 'museum'}">${who === 'pip' ? 'Bug house' : 'Museum'}</button><button class="wood" data-talk="back" data-k="${who}">Back</button></div>
      <p class="sub small">Selling everything keeps back anything an open quest still needs, and one of each ${who === 'pip' ? 'bug not yet in the bug house' : 'fossil not yet in the museum'}. ${name} pays for the rest.</p>`);
  }

  /* Pip's bug house */
  function openHouse() {
    const s = S(), had = BUGS.filter(b => s.bugHouse[b.id]);
    const cells = BUGS.map(b => { const inH = s.bugHouse[b.id], have = bagCount(s, b.id), seen = s.caught[b.id] || inH; return `<div class="tc t${b.tier}${inH ? ' in' : ''}${seen ? '' : ' unseen'}" title="${esc(seen ? `${b.name}: ${b.desc}` : FISH_BY[b.id].where)}">${icon(b.icon)}<small>${seen ? esc(b.name) : '???'}</small>${seen ? '' : `<em class="w">${esc(FISH_BY[b.id].where)}</em>`}<em>+${Math.round(HOUSE_BONUS[b.tier] * 1000) / 10}%</em>${inH ? '<b class="ok">✓</b>' : have ? `<button class="wood" data-house="${b.id}">Donate</button>` : ''}</div>`; }).join('');
    const live = had.map((b, n) => { const k = (n * 37 % 100) / 100; return `<i class="item crawl" style="background-position:${iconPos(b.icon)};left:${4 + (n * 29 % 88)}%;top:${10 + (n * 47 % 70)}%;animation-duration:${3 + k * 4}s;animation-delay:-${k * 4}s"></i>`; }).join('');
    show('house', `<div class="bag-head">${icon(DIG_ICON.jar, 'big')}<div><h2>Pip's bug house</h2><p class="sub">Donate one of each bug. Each one here adds to all your earnings, for good. <b>+${Math.round(houseBonus(s) * 1000) / 10}%</b> of a possible +${Math.round(houseMax() * 1000) / 10}%. ${had.length} of ${BUGS.length}.</p></div></div>
      <div class="terrarium">${live || '<p>The bug house is empty. Catch a bug and donate it!</p>'}</div>
      <div class="tgrid">${cells}</div>`);
  }
  /* Bramwell's museum */
  function openMuseum(msg = '') {
    const s = S();
    const sets = Object.entries(SETS).map(([k, name]) => {
      const list = setPieces(k), done = setDone(s, k), n = list.filter(f => s.museum[f.id]).length;
      const pieces = list.map(f => { const inM = s.museum[f.id], have = bagCount(s, f.id); return `<div class="tc t${f.tier}${inM ? ' in' : ''}${inM || s.caught[f.id] ? '' : ' unseen'}" title="${esc(f.desc)}">${icon(f.icon)}<small>${inM || s.caught[f.id] ? esc(f.name) : '???'}</small>${inM ? '<b class="ok">✓</b>' : have ? `<button class="wood" data-museum="${f.id}">Donate</button>` : ''}</div>`; }).join('');
      const art = list.length > 1 ? `<i class="skel s-${k}${done ? ' done' : ''}"></i>` : '';
      return `<div class="mset${done ? ' done' : ''}"><h3>${esc(name)} <em>${n} / ${list.length}${done ? ' · complete ✦' : ''}</em></h3><div class="mset-row">${art}<div class="tgrid">${pieces}</div></div></div>`;
    }).join('');
    const raw = bagCount(s, 'fossil') - (questNeeds(s).fossil || 0);
    show('museum', `<div class="bag-head">${icon(DIG_ICON.tent, 'big')}<div><h2>Bramwell's museum</h2><p class="sub">${msg ? esc(msg) + ' ' : ''}Each fossil on show adds ${PIECE_BONUS * 100}% to all earnings, and each finished skeleton ${SET_BONUS * 100}% more. <b>+${Math.round(museumBonus(s) * 1000) / 10}%</b> of a possible +${Math.round(museumMax() * 1000) / 10}%.</p></div></div>
      ${raw > 0 ? `<div class="bag-info">${icon(DIG_ICON.fossil, 'big')}<div><b>${raw} fossil${raw > 1 ? 's' : ''} to look at</b><span>Bramwell will tell you what ${raw > 1 ? 'they are' : 'it is'}.</span></div><div class="bag-acts"><button class="wood primary" data-kp="assess">Look at them</button></div></div>` : ''}
      ${sets}`);
  }
  // Bramwell looks over every unknown fossil in your pack and names it.
  function assessAll() {
    const s = S(), n = bagCount(s, 'fossil') - (questNeeds(s).fossil || 0); if (n <= 0) { toast('Bramwell: "Keep that one for the job I gave you."'); return; }
    const got = [];
    for (let k = 0; k < n; k++) {
      const piece = assess(s), slot = s.bag.findIndex(q => q.id === 'fossil');
      s.bag[slot].n--; if (!s.bag[slot].n) s.bag.splice(slot, 1);
      if (bagAdd(s, piece.id)) { got.push(piece); s.caught[piece.id] = (s.caught[piece.id] || 0) + 1; jot('dig:' + piece.id); } else { bagAdd(s, 'fossil'); break; }
    }
    audio.chime(); save(); hud();
    const names = {}; for (const f of got) names[f.name] = (names[f.name] || 0) + 1;
    openMuseum(`"${Object.entries(names).map(([k, c]) => `${c > 1 ? c + ' × ' : ''}${k}`).join(', ')}! ${got.some(f => !s.museum[f.id]) ? 'And one I haven\'t got on show yet.' : 'Good specimens.'}"`);
  }

  function modalClick(e) {
    const s = S();
    const kp = e.target.closest('[data-kp]');
    if (kp) {
      const a = kp.dataset.kp;
      if (a === 'house') openHouse();
      if (a === 'museum') openMuseum();
      if (a === 'pipmarket') angling.openMarket('', 'pip');
      if (a === 'brammarket') angling.openMarket('', 'bram');
      if (a === 'assess') assessAll();
      if (a === 'net') { $('modal').close(); toggleNet(true); }
      if (a === 'digs') { $('modal').close(); angling.goTo('dig'); }
      if (a === 'givewood') { const before = portalStage(s).stage, got = giveWood(s), after = portalStage(s); if (got) { audio.chime(after.stage > before); save(); hud(); V().portalBurst?.(); } openPortal(after.done && before < 5 ? 'The last beam settles. The portal wakes, and spirit light pours through it!' : after.stage > before ? `${STAGE_NAMES[after.stage]}!` : got ? `${got} wood added.` : ''); }
      return true;
    }
    const h = e.target.closest('[data-house]');
    if (h) { const b = BUG_BY[h.dataset.house]; if (bagCount(s, b.id) && !s.bugHouse[b.id]) { takeOne(s, b.id); s.bugHouse[b.id] = 1; audio.chime(); toast(`The ${b.name.toLowerCase()} moves into the bug house · +${Math.round(HOUSE_BONUS[b.tier] * 1000) / 10}% to all earnings, for good.`); save(); hud(); } openHouse(); return true; }
    const m = e.target.closest('[data-museum]');
    if (m) { const f = FIND_BY[m.dataset.museum]; if (bagCount(s, f.id) && !s.museum[f.id]) { takeOne(s, f.id); s.museum[f.id] = 1; audio.chime(); const done = setDone(s, f.set); toast(done && setPieces(f.set).length > 1 ? `The ${SETS[f.set].toLowerCase()} is complete! Bramwell is beside himself.` : `The ${f.name.toLowerCase()} goes on show · +${PIECE_BONUS * 100}% to all earnings${done ? `, +${SET_BONUS * 100}% more for a finished exhibit` : ''}.`); save(); hud(); } openMuseum(); return true; }
    return false;
  }
  const takeOne = (s, id) => { const i = s.bag.findIndex(q => q.id === id && !q.cursed); if (i < 0) return; s.bag[i].n--; if (!s.bag[i].n) s.bag.splice(i, 1); };

  function tapFolk(f) {
    if (f.kind === 'pip' || f.kind === 'bram') { f.wave = 1.6; angling.talk(f.kind); return true; }
    return false;
  }
  function hud() { angling.hud(); }
  function step(now, dt) {
    const s = S(); if (!s) return;
    stepBugs(now, dt);
    if (now > digCheck) { digCheck = now + 2000; if (spawnDigs(s, Wd())) save(); }
    for (let i = holes.length - 1; i >= 0; i--) if (performance.now() - holes[i].t > 60000) holes.splice(i, 1);
  }
  return {
    get net() { return net; }, get bugs() { return S()?.net ? bugs : null; }, get holes() { return holes; },
    get swing() { return swing && performance.now() - swing.t < 300 ? swing : null; },
    toggleNet, step, pointerDown, pointerMove, keyDown, modalClick, tapFolk, openHouse, openMuseum, openPortal,
    reset() { toggleNet(false); bugs.length = 0; holes.length = 0; },
  };
}
