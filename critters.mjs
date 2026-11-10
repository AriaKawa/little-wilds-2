// Pixel animals and spirits, drawn at two art pixels per ground texel so they read as the creature they are
// without the chunky blocks of the old art. Each is built from a few soft shapes (body, haunch, neck, head,
// legs) so it can really move: legs stride, heads dip to graze, bodies fold down to sleep. Every shape gets
// three tones lit from the upper left and a darker line of its own colour around the silhouette, the way a
// pixel artist would shade it, and nothing finer than that.
export const SCALE = 2; // art pixels per ground texel

const hex = s => [1, 3, 5].map(i => parseInt(s.slice(i, i + 2), 16));
const mix = (a, b, t) => a.map((v, i) => v + (b[i] - v) * t);
const css = c => `rgb(${c.map(v => Math.max(0, Math.min(255, Math.round(v)))).join(',')})`;
function tonesOf(pal) {
  const t = {};
  for (const [k, v] of Object.entries(pal)) {
    const b = hex(v);
    t[k] = [mix(b.map(x => x * .8), [52, 60, 96], .1), b, mix(b, [255, 249, 228], .28), mix(b.map(x => x * .6), [50, 40, 56], .2)].map(css);
  }
  return t;
}
// Shapes: { e: [cx, cy, rx, ry, angle] } ellipse, { l: [x0, y0, x1, y1, width] } stroke, { d: [[x, y], ...] } single
// pixels. `c` is a palette letter, with ^ for its light tone, _ for shade and ! for its line colour. Coordinates
// are art pixels with x = 0 at the middle and y = 0 at the ground, up being negative.
const rot = (ax, ay, a, list) => {
  const c = Math.cos(a), s = Math.sin(a), P = (x, y) => [ax + x * c - y * s, ay + x * s + y * c];
  return list.map(sh => sh.e ? { ...sh, e: [...P(sh.e[0], sh.e[1]), sh.e[2], sh.e[3], (sh.e[4] || 0) + a] }
    : sh.l ? { ...sh, l: [...P(sh.l[0], sh.l[1]), ...P(sh.l[2], sh.l[3]), sh.l[4]] }
    : { ...sh, d: sh.d.map(([x, y]) => P(x + .5, y + .5).map(v => Math.floor(v))) });
};
function raster(W, H, pal, shapes) {
  const tones = tonesOf(pal), n = W * H, mat = new Array(n).fill(null), tone = new Int8Array(n), lined = new Uint8Array(n), ox = W >> 1;
  const put = (x, y, m, t, ol) => { x += ox; y += H; if (x < 0 || y < 0 || x >= W || y >= H) return; const i = y * W + x; mat[i] = m; tone[i] = t; lined[i] = ol ? 1 : 0; };
  const fixed = c => c.length > 1 ? [c[0], { '_': 0, '^': 2, '!': 3 }[c[1]]] : [c, -1];
  const dots = [];
  for (const sh of shapes) {
    const [m, forced] = fixed(sh.c), t0 = sh.far ? 0 : forced;
    if (sh.e) {
      const [cx, cy, rx, ry, a = 0] = sh.e, ca = Math.cos(a), sa = Math.sin(a), R = Math.max(rx, ry) + 1;
      for (let y = Math.floor(cy - R); y <= Math.ceil(cy + R); y++) for (let x = Math.floor(cx - R); x <= Math.ceil(cx + R); x++) {
        const dx = x + .5 - cx, dy = y + .5 - cy, u = (dx * ca + dy * sa) / rx, v = (-dx * sa + dy * ca) / ry;
        if (u * u + v * v > 1) continue;
        const lit = -(dx / R * .4 + dy / ry * .92);
        put(x, y, m, t0 >= 0 ? t0 : sh.flat ? 1 : lit > .52 ? 2 : lit < -.4 ? 0 : 1, sh.ol ?? true);
      }
    } else if (sh.l) {
      const [x0, y0, x1, y1, w] = sh.l, L = Math.hypot(x1 - x0, y1 - y0) || 1, r = w / 2;
      for (let y = Math.floor(Math.min(y0, y1) - r); y <= Math.ceil(Math.max(y0, y1) + r); y++) for (let x = Math.floor(Math.min(x0, x1) - r); x <= Math.ceil(Math.max(x0, x1) + r); x++) {
        const px = x + .5, py = y + .5, k = Math.max(0, Math.min(1, ((px - x0) * (x1 - x0) + (py - y0) * (y1 - y0)) / (L * L)));
        if (Math.hypot(px - x0 - k * (x1 - x0), py - y0 - k * (y1 - y0)) > r) continue;
        put(x, y, m, t0 >= 0 ? t0 : 1, sh.ol ?? w > 2.6);
      }
    } else dots.push(sh);
  }
  // No outline: the silhouette's lower and right edges, away from the light, fall into the shade tone of what they are made of.
  const edge = new Uint8Array(n);
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
    const i = y * W + x; if (!mat[i] || !lined[i]) continue;
    if (x === W - 1 || !mat[i + 1] || (y < H - 1 && !mat[i + W])) edge[i] = 1;
  }
  const c = document.createElement('canvas'); c.width = W; c.height = H;
  const g = c.getContext('2d');
  for (let i = 0; i < n; i++) if (mat[i]) { g.fillStyle = tones[mat[i]][edge[i] ? 0 : tone[i]]; g.fillRect(i % W, (i / W) | 0, 1, 1); }
  for (const sh of dots) { const [m, t] = fixed(sh.c); g.fillStyle = tones[m][t < 0 ? 1 : t]; for (const [x, y] of sh.d) g.fillRect(x + ox, y + H, 1, 1); }
  return c;
}

// A plain, calm walk, p running 0 to 1 over one stride. Legs stay straight and swing from the hip like
// pendulums, a small way each side, in diagonal pairs: near hind with far fore, near fore with far hind. A leg
// swinging forward lifts its foot a pixel off the grass, and the body rises a pixel as the legs pass under it.
// Over a stream the animal leaps instead: forelegs reaching forward, hind legs stretched back.
function legs(list, pose, p, bob = 0) {
  const out = [];
  for (const L of list) {
    const front = L.x > 0, A = L.stride ?? 2, len = -L.y;
    let fx = L.x, fy = 0;
    if (pose === 'walk') {
      const off = front === !!L.far ? 0 : .5, a = 2 * Math.PI * (p + off);
      fx = L.x + Math.sin(a) * A; fy = -Math.max(0, Math.cos(a)) * (L.lift ?? 1.1);
    } else if (pose === 'leap') { fx = L.x + (front ? len * .5 : -len * .55); fy = front ? -len * .32 : -len * .22; }
    const hy = L.y + bob, d = Math.hypot(fx - L.x, fy - hy) || 1, ux = (fx - L.x) / d, uy = (fy - hy) / d, mx = L.x + ux * d * .55, my = hy + uy * d * .55;
    out.push({ l: [L.x, hy, mx, my, L.w], c: L.c, far: L.far }, { l: [mx, my, fx, fy, L.w * .85], c: L.c2 || L.c, far: L.far });
    if (L.hoof) out.push({ l: [fx - ux * 1.1, fy - uy * 1.1, fx, fy, L.w * .85], c: L.hoof, far: L.far, ol: false });
  }
  return out;
}
const bobOf = (pose, p) => pose === 'leap' ? -1 : pose === 'walk' && Math.abs(Math.sin(2 * Math.PI * p)) < .38 ? -1 : 0;
// Deer legs, after the Crossroads deer: each leg has shape (a thick thigh or shoulder tapering to a slim
// cannon, the hind leg bending back at the hock), and walking shears it rather than swinging a stick. The top
// stays tucked into the body and the lower leg sways more the nearer it is to the hoof, so the leg bends
// softly as it goes. The outer pair (near hind, near fore) moves together, the inner pair opposite. H is the
// height of the leg; hx, fx where the near hind and fore hooves stand; A how far a hoof sways each way.
const ease = t => { t = Math.max(0, Math.min(1, t)); return t * t * (3 - 2 * t); };
function deerLegs(H, hx, fx, A, k, pose, p, bob, far) {
  const hind = x => [[x + .6, -H - 2, 3.6 * k], [x + .9, -H * .76, 3 * k], [x - 1.5, -H * .42, 1.9 * k], [x - .8, -H * .1, 1.5 * k], [x - .6, 0, 1.5 * k]];
  const fore = x => [[x - .3, -H - 1.5, 3.3 * k], [x, -H * .78, 2.6 * k], [x + .3, -H * .42, 1.8 * k], [x + .6, -H * .1, 1.5 * k], [x + .7, 0, 1.5 * k]];
  const set = far ? [[hind(hx + 1.6), .5, -1], [fore(fx - 1.6), .5, 1]] : [[hind(hx), 0, -1], [fore(fx), 0, 1]];
  const out = [];
  for (const [pts, off, side] of set) {
    const a = 2 * Math.PI * (p + off), top = pts[0];
    const P = pts.map(([x, y, w]) => {
      const f = ease(-y / H > 1 ? 0 : 1 + y / H);
      if (pose === 'walk') { x += Math.sin(a) * A * f; y -= Math.max(0, Math.cos(a)) * .9 * f; }
      else if (pose === 'leap') { const r = side > 0 ? -.95 : .85, dx = x - top[0], dy = y - top[1]; x = top[0] + dx * Math.cos(r) - dy * Math.sin(r); y = top[1] + dx * Math.sin(r) + dy * Math.cos(r); }
      return [x, y + bob * (1 - f), w];
    });
    for (let i = 0; i < P.length - 1; i++) {
      const [x0, y0, w0] = P[i], [x1, y1, w1] = P[i + 1];
      out.push({ l: [x0, y0, x1, y1, (w0 + w1) / 2], c: i === P.length - 2 ? 'h' : far ? 'k' : i < 2 ? 'b' : 'k', far, ol: i < 2 });
    }
  }
  return out;
}
const eye = (x, y, closed, c = 'e') => closed ? { d: [[x - 1, y + 1], [x, y + 1]], c: 'b!' } : { d: [[x, y]], c };

export const CRITTERS = {
  deer: { stride: 2.2, // Spirit deer: a red-brown deer with a pale rump and belly, and antlers of glowing mint.
    w: 36, h: 38, pal: { b: '#b9804c', c: '#efdcb8', k: '#8a5c38', h: '#3e2a1c', x: '#a8f2d6', e: '#1e140c', n: '#2a1c14' },
    build(pose, p) {
      const sleep = pose === 'sleep', drop = sleep ? 9 : bobOf(pose, p);
      const head = [{ e: [-1.4, -3, 1.2, 2.6, -.75], c: 'b', far: 1 }, { e: [-.4, -3.2, 1.2, 2.6, -.35], c: 'b' }, { d: [[-1, -4]], c: 'c' },
        { e: [.6, 0, 2.8, 2.4] }, { l: [1.5, .5, 4.4, 1.3, 2.8] }, { l: [4.2, 1.3, 5.6, 1.9, 1.9] }, { d: [[3, 2], [4, 2]], c: 'c' }, { d: [[6, 1]], c: 'n' }, eye(1, -1, sleep),
        { l: [0, -2.5, -1, -8, 1.3], c: 'x', ol: false }, { l: [-.6, -5.5, -3.5, -7.4, 1.2], c: 'x', ol: false }, { l: [2, -2.5, 3, -8.6, 1.3], c: 'x', ol: false }, { l: [2.7, -6, 5, -8, 1.2], c: 'x', ol: false },
        { d: [[-2, -9], [3, -10], [5, -9], [-4, -8]], c: 'x^' }].map(s => ({ c: 'b', ...s }));
      let [ax, ay, ang] = pose === 'graze' ? [12, -7, 1.15] : sleep ? [9, -19, -.1] : [10, -27, 0]; if (!sleep) ay += drop;
      return [
        ...(sleep ? [{ e: [-5, -2, 4, 2], c: 'k' }, { e: [6, -2, 3.5, 2], c: 'k' }] : deerLegs(14, -6.5, 6.5, 1.4, 1, pose, p, drop, 1)),
        { e: [-9.6, -20 + drop, 1.6, 2.4, -.5], c: 'c' },
        { e: [0, -17 + drop, 9, 5] , c: 'b' }, { e: [-5, -17 + drop, 4.6, 5.4], c: 'b' }, { e: [6, -17.5 + drop, 4.2, 5], c: 'b' },
        { e: [0, -13.3 + drop, 6, 1.5], c: 'c', flat: 1, ol: false }, { d: [[-10, -19 + drop], [-9, -18 + drop]], c: 'c^' },
        ...(sleep ? [] : deerLegs(14, -6.5, 6.5, 1.4, 1, pose, p, drop, 0)),
        ...(sleep ? [] : [{ e: [-5.6, -16 + drop, 3.4, 4.6, .25], c: 'b' }, { e: [5.6, -16 + drop, 2.8, 4, -.15], c: 'b' }]),
        { l: [6, -19 + drop, ax - .5, ay + 1, 4], c: 'b' },
        ...rot(ax, ay, ang, head),
      ];
    },
  },
  fawn: { stride: 1.6, // A spotted fawn: big ears, long legs, no antlers yet.
    w: 26, h: 28, pal: { b: '#c48e58', c: '#f6e8cc', k: '#9a6a44', h: '#3e2a1c', e: '#1e140c', n: '#2a1c14' },
    build(pose, p) {
      const sleep = pose === 'sleep', drop = sleep ? 7 : bobOf(pose, p);
      const head = [{ e: [-1.6, -2.8, 1.3, 2.6, -.8], c: 'b', far: 1 }, { e: [-.5, -3.1, 1.3, 2.7, -.4], c: 'b' }, { d: [[-1, -4]], c: 'c' },
        { e: [.5, 0, 2.7, 2.4] }, { l: [1.5, .5, 3.8, 1.2, 2.6] }, { l: [3.6, 1.2, 4.8, 1.7, 1.8] }, { d: [[5, 1]], c: 'n' }, eye(1, -1, sleep)].map(s => ({ c: 'b', ...s }));
      let [ax, ay, ang] = pose === 'graze' ? [9, -5, 1.1] : sleep ? [7, -13, -.1] : [7.5, -19, 0]; if (!sleep) ay += drop;
      return [
        ...(sleep ? [{ e: [-4, -1.6, 3, 1.6], c: 'k' }, { e: [4, -1.6, 3, 1.6], c: 'k' }] : deerLegs(10, -4.6, 4.8, 1.1, .75, pose, p, drop, 1)),
        { e: [-6.8, -14 + drop, 1.3, 1.8, -.5], c: 'c' },
        { e: [0, -12.5 + drop, 6.6, 3.8], c: 'b' }, { e: [-3.5, -12.5 + drop, 3.4, 4], c: 'b' },
        { e: [0, -9.8 + drop, 4.5, 1.1], c: 'c', flat: 1, ol: false },
        { d: [[-3, -14 + drop], [0, -15 + drop], [2, -13 + drop], [-1, -12 + drop], [-5, -12 + drop], [3, -15 + drop]], c: 'c' },
        ...(sleep ? [] : deerLegs(10, -4.6, 4.8, 1.1, .75, pose, p, drop, 0)),
        ...(sleep ? [] : [{ e: [-3.8, -11.5 + drop, 2.5, 3.4, .25], c: 'b' }]),
        { l: [4.5, -14 + drop, ax - .4, ay + 1, 3.2], c: 'b' },
        ...rot(ax, ay, ang, head),
      ];
    },
  },
  rabbit: { // Moss rabbit: a brown-grey cottontail with moss on its back.
    w: 20, h: 22, pal: { b: '#b8a48a', m: '#7fa65a', p: '#e6a2a8', w: '#f6f0e4', e: '#1e140c' },
    // Rabbits hop. Over one hop (p from 0 to 1): crouched with the long hind feet flat, then pushing off with
    // the hind legs kicked out behind, then reaching forward with the forepaws to land, then crouched again.
    // The game lifts the rabbit off the ground through the middle of the hop.
    build(pose, p) {
      const sleep = pose === 'sleep', hop = pose === 'walk' || pose === 'leap';
      const phase = !hop ? 'sit' : pose === 'leap' ? 'push' : p < .2 || p >= .85 ? 'sit' : p < .55 ? 'push' : 'reach';
      const low = sleep ? 1 : 0, tilt = phase === 'push' ? -.2 : phase === 'reach' ? .14 : 0;
      const earA = sleep ? -1.25 : pose === 'graze' ? -.5 : phase === 'push' ? -.45 : phase === 'reach' ? -.25 : 0;
      const ears = rot(-.5, -2, earA, [{ l: [0, 0, -1.6, -7, 2.4], c: 'b', far: 1 }, { l: [1.4, 0, .6, -7.2, 2.4], c: 'b' }, { l: [1.1, -2, .7, -6, .9], c: 'p', ol: false }]);
      const head = [...ears, { e: [0, 0, 3, 2.7], c: 'b' }, { e: [1.8, 1.2, 1.6, 1.1], c: 'w', ol: false }, { d: [[3, 0]], c: 'p' }, eye(1, -1, sleep)];
      const [ax, ay, ang] = pose === 'graze' ? [5.5, -4, .35] : sleep ? [4.5, -6, .1] : [4.6, -9, 0];
      const hind = phase === 'sit' ? (sleep ? [] : [{ e: [-1.4, -.8, 3.2, 1], c: 'b' }])
        : phase === 'push' ? [{ l: [-2.5, -3.5, -6.5, -1.2, 2.4], c: 'b' }, { l: [-6.5, -1.2, -8.8, -.4, 1.6], c: 'b' }]
        : [{ l: [-2.5, -3.2, -5, -2.6, 2.4], c: 'b' }, { l: [-5, -2.6, -6.8, -3.4, 1.6], c: 'b' }];
      const fore = sleep ? [] : phase === 'sit' ? [{ l: [3.4, -3, 3.6, -.4, 1.7], c: 'b' }]
        : phase === 'push' ? [{ l: [3.4, -3.4, 5.6, -4.4, 1.6], c: 'b' }] : [{ l: [3.4, -3.2, 6, -.6, 1.6], c: 'b' }];
      const body = [
        ...hind,
        { e: [0, -5 + low, 5.4, 4.3], c: 'b' }, { e: [-2, -4.6 + low, 4, 4], c: 'b' },
        { e: [-1, -8 + low, 3.8, 1.5, -.15], c: 'm', flat: 1, ol: false }, { d: [[-2, -9 + low], [1, -9 + low]], c: 'm^' },
        { e: [-5.6, -6 + low, 1.7, 1.7], c: 'w' },
        ...fore,
        ...rot(ax, ay, ang, head),
      ];
      return tilt ? rot(0, -3, tilt, body) : body;
    },
  },
  fox: { stride: 2, // Ember Basin: a cinder fox with dark socks and an ember-tipped brush.
    w: 38, h: 26, pal: { b: '#d8682a', w: '#f6ead6', k: '#3a2418', x: '#ffcf5a', e: '#1e120c' },
    build(pose, p) {
      const sleep = pose === 'sleep', drop = sleep ? 6 : bobOf(pose, p);
      const L = [{ x: -4, y: -8, w: 2, c: 'k', far: 1, pair: 1, stride: 2 }, { x: 4, y: -8, w: 2, c: 'k', far: 1, stride: 2 }, { x: -5.5, y: -8, w: 2.2, c: 'b', c2: 'k', stride: 2 }, { x: 5.5, y: -8, w: 2.2, c: 'b', c2: 'k', pair: 1, stride: 2 }];
      const head = [{ l: [-.8, -2, -1.4, -6.4, 2.6], c: 'b', far: 1 }, { l: [1.4, -2, 1.9, -6.6, 2.6], c: 'b' }, { d: [[1, -7], [2, -7]], c: 'k' },
        { e: [0, 0, 3, 2.6], c: 'b' }, { l: [2, .6, 4.6, 1.2, 2.6], c: 'b' }, { l: [4.4, 1.2, 6.2, 1.5, 1.6], c: 'b' }, { e: [1.6, 1.8, 2.4, 1.1], c: 'w', ol: false }, { d: [[6, 1]], c: 'k' }, eye(1, -1, sleep)];
      let [ax, ay, ang] = pose === 'graze' ? [10, -5, .9] : sleep ? [8, -7, .15] : [9, -14, 0]; if (!sleep) ay += drop;
      const tail = sleep ? [{ e: [-3, -2.5, 7, 2.4, .1], c: 'b' }, { e: [3.5, -2, 2.6, 1.8], c: 'w' }, { d: [[5, -2]], c: 'x' }]
        : [{ e: [-11, -11 + (pose === 'walk' && (Math.floor(p * 4) % 2) ? 1 : 0), 5.4, 2.6, -.38], c: 'b' }, { e: [-15.5, -13.4, 2.4, 1.8, -.4], c: 'w' }, { d: [[-17, -14], [-16, -15]], c: 'x' }];
      return [
        ...(sleep ? [] : legs(L.slice(0, 2), pose, p, drop)),
        ...(sleep ? [] : tail),
        { e: [0, -10.5 + drop, 8, 3.8], c: 'b' }, { e: [5, -10 + drop, 3.4, 3.4], c: 'b' },
        { e: [5.5, -8.4 + drop, 2.2, 1.4], c: 'w', flat: 1, ol: false },
        ...(sleep ? tail : legs(L.slice(2), pose, p, drop)),
        { l: [5, -12 + drop, ax, ay, 4], c: 'b' },
        ...rot(ax, ay, ang, head),
      ];
    },
  },
  lynx: { stride: 2, // Frostmere: a snow lynx, stocky, with tufted ears, a cheek ruff and a stub of a tail.
    w: 34, h: 28, pal: { b: '#e6e8ee', s: '#9aa2b4', k: '#3c4250', p: '#d48a9a', e: '#2a3a2a' },
    build(pose, p) {
      const sleep = pose === 'sleep', drop = sleep ? 7 : bobOf(pose, p);
      const L = [{ x: -4, y: -9, w: 2.2, c: 'b', c2: 's', far: 1, pair: 1, knee: -.5 }, { x: 4, y: -9, w: 2.2, c: 'b', c2: 's', far: 1 }, { x: -5.5, y: -9, w: 2.4, c: 'b', c2: 's', knee: -.5 }, { x: 5.5, y: -9, w: 2.4, c: 'b', c2: 's', pair: 1 }];
      const head = [{ l: [-1.6, -2.4, -2, -5, 2.6], c: 'b', far: 1 }, { l: [1.4, -2.4, 1.9, -5.2, 2.6], c: 'b' }, { d: [[-3, -6], [1, -6], [1, -7]], c: 'k' },
        { e: [-.4, 1.6, 3.6, 2.2], c: 'b' }, { e: [0, 0, 3.6, 3.1], c: 'b' }, { e: [2.8, 1, 1.6, 1.3], c: 'b' }, { d: [[4, 0]], c: 'p' }, eye(1, -1, sleep), { d: [[-1, 1], [-2, 2]], c: 's' }];
      let [ax, ay, ang] = pose === 'graze' ? [9.5, -5, .85] : sleep ? [8, -8, .1] : [8.5, -15, 0]; if (!sleep) ay += drop;
      return [
        ...(sleep ? [{ e: [6, -1.5, 3, 1.6], c: 'b' }] : legs(L.slice(0, 2), pose, p, drop)),
        { e: [-9, -13 + drop, 2.2, 1.5, -.6], c: 'b' }, { d: [[-11, -15 + drop]], c: 'k' },
        { e: [0, -12 + drop, 8, 4], c: 'b' }, { e: [-4.5, -11.5 + drop, 4.2, 4.6], c: 'b' }, { e: [5, -12 + drop, 3.6, 4.4], c: 'b' },
        { d: [[-4, -13 + drop], [-1, -14 + drop], [2, -12 + drop], [-6, -11 + drop], [0, -11 + drop], [4, -13 + drop]], c: 's' },
        ...(sleep ? [] : legs(L.slice(2), pose, p, drop)),
        { l: [5, -13 + drop, ax, ay, 5], c: 'b' },
        ...rot(ax, ay, ang, head),
      ];
    },
  },
  tortoise: { // Sunfall Coast: a sun tortoise, a high domed shell with a sunburst on it.
    w: 26, h: 16, pal: { b: '#6f9a42', x: '#ffd34d', k: '#c9a46a', e: '#1e160c' },
    build(pose, p) {
      const sleep = pose === 'sleep', step = pose === 'walk' ? ((Math.floor(p * 4) % 2) ? 1 : -1) * .8 : 0;
      const [ax, ay] = pose === 'graze' ? [10, -2] : sleep ? [7.5, -3] : [10, -5];
      return [
        ...(sleep ? [] : [{ e: [-4 - step, -1, 1.8, 1.4], c: 'k', far: 1 }, { e: [5 + step, -1, 1.8, 1.4], c: 'k', far: 1 }]),
        { l: [6, -3, ax, ay, 2.8], c: 'k' }, { e: [ax, ay, 2.5, 2.1], c: 'k' }, eye(ax + 1, ay - 1, sleep),
        { e: [-8.4, -2.6, 1.4, .9], c: 'k' },
        { e: [0, -4.4, 8.2, 5.6], c: 'b' }, { l: [-7.6, -2.6, 7.6, -2.6, 1.2], c: 'b_', ol: false },
        { d: [[0, -7], [-1, -6], [1, -6], [0, -5], [-2, -8], [2, -8], [-3, -6], [3, -6], [-2, -4], [2, -4]], c: 'x' }, { d: [[0, -6]], c: 'x^' },
        { d: [[-5, -5], [-5, -4], [5, -5], [5, -4], [-4, -8], [4, -8]], c: 'b_' },
        ...(sleep ? [] : [{ e: [-5 + step, -1.2, 1.7, 1.4], c: 'k' }, { e: [4 - step, -1.2, 1.7, 1.4], c: 'k' }]),
      ];
    },
  },
  otter: { stride: 1.1, // Mistfen: a reed otter, long and low, with a pale chin and a tapering tail.
    w: 36, h: 18, pal: { b: '#7c5232', l: '#e6cfa4', k: '#4a3020', e: '#140c08' },
    build(pose, p) {
      const sleep = pose === 'sleep', drop = sleep ? 2.5 : bobOf(pose, p);
      const L = [{ x: -5, y: -4, w: 2, c: 'k', far: 1, pair: 1, stride: 1.1 }, { x: 4, y: -4, w: 2, c: 'k', far: 1, stride: 1.1 }, { x: -6.5, y: -4, w: 2.2, c: 'b', c2: 'k', stride: 1.1 }, { x: 5.5, y: -4, w: 2.2, c: 'b', c2: 'k', pair: 1, stride: 1.1 }];
      const head = [{ e: [-1.6, -2.2, 1.1, .9], c: 'b' }, { e: [0, 0, 3, 2.4], c: 'b' }, { e: [2.4, 1, 2, 1.4], c: 'l', ol: false }, { d: [[4, 0]], c: 'e' }, eye(1, -1, sleep)];
      let [ax, ay, ang] = pose === 'graze' ? [11, -3, .45] : sleep ? [9, -3.5, .1] : [10, -8, 0]; if (!sleep) ay += drop;
      return [
        ...(sleep ? [] : legs(L.slice(0, 2), pose, p, drop)),
        { l: [-8, -5 + drop, -13, -3 + drop * .4, 3], c: 'b', ol: true }, { l: [-12.5, -3 + drop * .4, -17, -1.4, 1.8], c: 'b' },
        { e: [-1, -6 + drop, 9, 3.2], c: 'b' }, { e: [5, -5 + drop, 2.6, 1.4], c: 'l', flat: 1, ol: false },
        ...(sleep ? [] : legs(L.slice(2), pose, p, drop)),
        { l: [6, -7 + drop, ax, ay, 4.4], c: 'b' },
        ...rot(ax, ay, ang, head),
      ];
    },
  },
  ram: { stride: 2, // Auric Steppe: a golden-fleeced ram, lumpy wool, a dark face and curled horns.
    w: 36, h: 30, pal: { b: '#efe0bc', f: '#7a5a3a', x: '#d9a440', k: '#4a3624', e: '#140c08' },
    build(pose, p) {
      const sleep = pose === 'sleep', drop = sleep ? 7 : bobOf(pose, p);
      const L = [{ x: -4.5, y: -9, w: 2.4, c: 'f', far: 1, pair: 1, hoof: 'k', stride: 2 }, { x: 4, y: -9, w: 2.4, c: 'f', far: 1, hoof: 'k', stride: 2 }, { x: -6, y: -9, w: 2.6, c: 'f', hoof: 'k', stride: 2 }, { x: 5.5, y: -9, w: 2.6, c: 'f', pair: 1, hoof: 'k', stride: 2 }];
      const head = [{ e: [.6, .6, 2.8, 2.4, .35], c: 'f' }, { e: [3, 2, 1.7, 1.4], c: 'f' }, { d: [[4, 2]], c: 'k' },
        { e: [-1.2, -.4, 2.8, 2.8], c: 'x' }, { e: [-1, -.2, 1.3, 1.3], c: 'x_', ol: false }, { d: [[-2, 2], [-1, 2]], c: 'x!' }, eye(1, -1, sleep)];
      let [ax, ay, ang] = pose === 'graze' ? [11, -5, .8] : sleep ? [9, -9, .1] : [10, -17, 0]; if (!sleep) ay += drop;
      return [
        ...(sleep ? [] : legs(L.slice(0, 2), pose, p, drop)),
        { e: [0, -12.5 + drop, 9, 5.4], c: 'b' }, { e: [-5, -14.5 + drop, 4.4, 4], c: 'b' }, { e: [1, -15.5 + drop, 4.4, 3.6], c: 'b' }, { e: [6, -13.5 + drop, 4, 4.2], c: 'b' }, { e: [-8, -12 + drop, 2.6, 3.4], c: 'b' },
        { d: [[-6, -15 + drop], [-2, -16 + drop], [2, -17 + drop], [5, -15 + drop], [-4, -12 + drop], [1, -13 + drop], [-8, -14 + drop]], c: 'b^' },
        { d: [[-3, -10 + drop], [3, -9 + drop], [-7, -9 + drop]], c: 'b_' },
        ...(sleep ? [] : legs(L.slice(2), pose, p, drop)),
        { l: [6, -14 + drop, ax, ay, 4.8], c: 'b' },
        ...rot(ax, ay, ang, head),
      ];
    },
  },
  crab: { // Coral Reach: a coral crab, claws up, eyes on stalks. Crabs face you, so they are the same either way.
    w: 26, h: 18, pal: { b: '#e8706e', l: '#ffc8b8', e: '#1e0c0c' },
    build(pose, p) {
      const sleep = pose === 'sleep', k = pose === 'walk' ? ((Math.floor(p * 4) % 2) ? 1 : -1) : 0, up = sleep ? 2.5 : pose === 'graze' ? 1 : 0, open = pose === 'idle' || pose === 'stand' ? ((Math.floor(p * 4) % 2)) : 0;
      const legL = [[-4, -3, -7.5, 0], [-3, -3, -5.5, 0], [-2, -3, -3.6, 0]], body = [];
      for (const [x0, y0, x1] of legL) body.push({ l: [x0, y0 + up * .4, x1 + k * .6, -.2, 1.2], c: 'b_' }, { l: [-x0, y0 + up * .4, -x1 - k * .6, -.2, 1.2], c: 'b_' });
      body.push({ e: [0, -4.6 + up * .5, 6, 3.4], c: 'b' }, { d: [[-2, -6 + up], [1, -7 + up], [3, -6 + up]], c: 'b^' });
      for (const s of [-1, 1]) {
        const cx = s * 8, cy = -9 + up * 1.4;
        body.push({ l: [s * 4.5, -4.5 + up * .5, cx, cy + 1.6, 2], c: 'b' }, { e: [cx, cy, 2.2, 2.4], c: 'b' }, { l: [cx + s * .2, cy - 2.6, cx + s * 1.6, cy - 1 - open, 1.4], c: 'b' }, { d: [[Math.round(cx + s * .8), Math.round(cy - 1)]], c: 'b!' });
      }
      body.push({ l: [-1.5, -7 + up * .5, -1.5, -9.6 + up * .5, 1], c: 'b_' }, { l: [1.5, -7 + up * .5, 1.5, -9.6 + up * .5, 1], c: 'b_' }, sleep ? { d: [[-2, -9], [1, -9]], c: 'b!' } : { d: [[-2, -11], [1, -11]], c: 'e' });
      return body;
    },
  },
  toadling: { // Sporewood: a toad wearing a spotted mushroom cap.
    w: 22, h: 22, pal: { b: '#7e9e5e', l: '#e0e8b4', x: '#a46ad8', y: '#f6eaff', k: '#5e7a46', e: '#140c18' },
    build(pose, p) {
      const sleep = pose === 'sleep', hop = pose === 'walk' && (Math.floor(p * 4) % 2) ? 1.5 : 0, dip = pose === 'graze' ? 1 : 0;
      return [
        { e: [-3.6, -2 - hop * .4, 3, 2.2], c: 'k', far: 1 },
        { e: [0, -4.6 - hop, 5.6, 4.2], c: 'b' }, { e: [1.8, -3.2 - hop, 3, 2.2], c: 'l', flat: 1, ol: false },
        { e: [-3.6, -2.4 - hop * .4, 2.8, 2.2], c: 'b' },
        ...(sleep ? [] : [{ l: [3, -3 - hop, 4 + dip, -.4, 1.8], c: 'b' }]),
        { e: [2.6, -8.2 - hop + dip, 1.7, 1.7], c: 'b' }, eye(3, -9 - Math.round(hop) + dip, sleep), { d: [[5, -5 - Math.round(hop) + dip]], c: 'b!' },
        { e: [-.5, -10.4 - hop + dip, 6.8, 3.4], c: 'x' }, { e: [-.5, -8 - hop + dip, 5.4, .8], c: 'y_', flat: 1, ol: false },
        { d: [[-4, -12], [-3, -12], [0, -13], [2, -11], [-1, -11], [3, -12]].map(([x, y]) => [x, y - Math.round(hop) + dip]), c: 'y' },
      ];
    },
  },
  hedgehog: { // Glimmerdeep: a hedgehog whose quills are glassy crystal.
    w: 24, h: 16, pal: { b: '#9a8070', x: '#8ad8f4', z: '#b8a0ff', k: '#5a4a40', e: '#140c08' },
    build(pose, p) {
      const sleep = pose === 'sleep', step = pose === 'walk' ? ((Math.floor(p * 4) % 2) ? .8 : -.8) : 0, nose = pose === 'graze' ? 1.4 : 0;
      const quills = [];
      for (let k = 0; k < 7; k++) { const a = Math.PI * (1.05 + k * .14), x = -1 + Math.cos(a) * 6.4, y = -4.6 + Math.sin(a) * 4.6; quills.push({ l: [x * .8 - .2, y * .8 - .9, x + Math.cos(a) * 1.8, y + Math.sin(a) * 1.8, 1.1], c: k % 3 ? 'x' : 'z', ol: false }); }
      return [
        ...(sleep ? [] : [{ e: [-3 - step, -.7, 1.4, .9], c: 'k' }, { e: [3 + step, -.7, 1.4, .9], c: 'k' }]),
        ...quills,
        { e: [-2.5, -4.4, 5.8, 4.4], c: 'x' },
        { d: [[-4, -6], [-1, -7], [1, -6], [-3, -3], [0, -4], [-6, -4]], c: 'z' }, { d: [[-3, -7], [0, -8], [-5, -6]], c: 'x^' },
        ...(sleep ? [] : [{ e: [5, -2.8 + nose * .5, 2.8, 2.4], c: 'b' }, { l: [6.4, -2.6 + nose, 8.6, -1.6 + nose * 1.2, 1.7], c: 'b' }, { d: [[9, -2 + Math.round(nose * 1.2)]], c: 'e' }, eye(6, -4 + Math.round(nose * .5), false)]),
        ...(sleep ? [{ d: [[5, -2], [4, -2]], c: 'b!' }] : []),
      ];
    },
  },
};
// A duck on the lake: a mallard drake or a brown hen, floating with its waterline at y = 0. frame 1 dabbles,
// tail up and head under.
const DUCK = { w: 16, h: 12, pal: { b: '#cfc2a6', d: '#9c7a56', w: '#7d6448', g: '#3d8a5e', o: '#f0a03c', e: '#1e140c', k: '#f4f0e6' } };
export function duckCanvas(hen, frame, flip) {
  const key = `duck:${hen ? 1 : 0}:${frame}:${flip ? 1 : 0}`;
  let c = made.get(key); if (c) return c;
  const body = hen ? 'd' : 'b', head = hen ? 'd' : 'g', dab = frame === 1;
  const shapes = dab
    ? [{ e: [-1, -1.6, 4.6, 1.8, -.25], c: body }, { e: [-4.6, -3.6, 1.6, 1.1, -.9], c: 'w' }, { e: [-1, -2.2, 2.8, 1, -.25], c: 'w' }, { e: [3.6, -.4, 1.7, 1, .4], c: head }]
    : [{ e: [-.5, -2, 5, 2.2] , c: body }, { e: [-4.6, -3, 1.6, 1.1, -.5], c: 'w' }, { e: [-.8, -2.6, 3.2, 1.2] , c: 'w' },
       { l: [3, -3, 3.6, -5.4, 2], c: head }, { e: [4, -6.2, 1.9, 1.7], c: head }, { l: [5.4, -5.8, 7, -5.6, 1.3], c: 'o', ol: false }, { d: [[4, -7]], c: 'e' },
       ...(hen ? [] : [{ d: [[3, -4], [4, -4]], c: 'k' }])];
  c = raster(DUCK.w, DUCK.h, DUCK.pal, shapes);
  if (flip) { const f = document.createElement('canvas'); f.width = c.width; f.height = c.height; const g = f.getContext('2d'); g.translate(c.width, 0); g.scale(-1, 1); g.drawImage(c, 0, 0); c = f; }
  made.set(key, c);
  return c;
}
// Each land's own creature takes the deer's place there; rabbits are everywhere.
export const NATIVE = [null, 'fox', 'lynx', 'tortoise', 'otter', 'ram', 'crab', 'toadling', 'hedgehog'];

const made = new Map();
export const WALK_FRAMES = 8;
// How far, in texels, one full stride carries each animal, so its feet stay planted as it moves.
export const strideOf = name => 4 * (CRITTERS[name].stride ?? 2) / SCALE;
// pose: stand, walk, graze or sleep; ph is the frame of the walk, 0 to 7.
// The deer and fawn are painted (ChatGPT art cut by tools/build_critter_art.py into assets/deer.png: walk
// frames 0-7, then stand, graze, sleep and leap). The fawn has its own sheet in the same layout (assets/fawn.png);
// without it, the fawn is the deer smaller, without antlers.
let deerSheet = null, fawnSheet = null;
export function useDeerSheet(img, fawn = null) { deerSheet = img; fawnSheet = fawn; made.clear(); }
const SHEET_POSE = { stand: 8, graze: 9, sleep: 10, leap: 11 };
function fromSheet(cell, fawn) {
  const own = fawn && fawnSheet, sheet = own ? fawnSheet : deerSheet, cw = sheet.width / 12, ch = sheet.height, k = fawn && !own ? .72 : 1, c = document.createElement('canvas');
  c.width = Math.round(cw * k); c.height = Math.round(ch * k);
  const g = c.getContext('2d'); g.imageSmoothingEnabled = false; g.drawImage(sheet, cell * cw, 0, cw, ch, 0, 0, c.width, c.height);
  if (fawn && !own) { const im = g.getImageData(0, 0, c.width, c.height), d = im.data; for (let i = 0; i < d.length; i += 4) if (d[i + 2] > d[i] + 15 && d[i + 1] > d[i]) d[i + 3] = 0; g.putImageData(im, 0, 0); }
  return c;
}
export function critterCanvas(name, pose, ph, flip) {
  const key = `${name}:${pose}:${ph}:${flip ? 1 : 0}`;
  let c = made.get(key);
  if (c) return c;
  const C = CRITTERS[name];
  c = deerSheet && (name === 'deer' || name === 'fawn') ? fromSheet(pose === 'walk' ? ph : SHEET_POSE[pose] ?? 8, name === 'fawn') : raster(C.w, C.h, C.pal, C.build(pose, ph / WALK_FRAMES));
  if (flip) { const f = document.createElement('canvas'); f.width = c.width; f.height = c.height; const g = f.getContext('2d'); g.translate(c.width, 0); g.scale(-1, 1); g.drawImage(c, 0, 0); c = f; }
  made.set(key, c);
  return c;
}

// The spirits who regrow the land. Each is the thing it tends, come alive: a tuft of meadow on a mossy
// pebble, a flower with a face, a drop of rain with a curl of cloud, and a little old stump in a leaf hood.
// frame: 0 standing, 1 napping, 3 working.
const SPIRIT_ART = [
  { // Mossling, the grass spirit.
    w: 24, h: 30, pal: { b: '#6aa648', m: '#4a8436', g: '#9ad660', k: '#7a5a3a', e: '#14200e', c: '#e89a7c' },
    build(f) {
      const nap = f === 1, work = f === 3, lean = nap ? 1.6 : work ? .5 : 1, grow = nap ? .7 : work ? 1.15 : 1;
      const blades = [[-3.4, -2.4, 6], [-1.2, -.8, 8.5], [1, .5, 9.5], [3, 2.2, 7], [-.1, -.1, 6.5]].map(([x, tilt, len]) => { const a = -Math.PI / 2 + tilt * .16 * lean, x0 = x, y0 = -11.5 + Math.abs(x) * .3; return { l: [x0, y0, x0 + Math.cos(a) * len * grow, y0 + Math.sin(a) * len * grow, 1.4], c: 'g', ol: false }; });
      const tips = blades.map(b => [Math.floor(b.l[2]), Math.floor(b.l[3])]);
      return [
        { e: [-2.6, -.9, 1.8, 1], c: 'k' }, { e: [2.6, -.9, 1.8, 1], c: 'k' },
        ...blades,
        { e: [0, -7, 6.6, 6], c: 'b' },
        { e: [-6.4, -6 + (work ? -2 : 0), 1.8, 1, work ? -.9 : .5], c: 'g' }, { e: [6.4, -6 + (work ? -2 : 0), 1.8, 1, work ? .9 : -.5], c: 'g' },
        { d: [[-4, -3], [-3, -2], [3, -3], [1, -2], [-1, -3], [4, -2]], c: 'm' }, { d: [[-3, -10], [-2, -11], [2, -11]], c: 'b^' },
        { d: tips, c: work ? 'g^' : 'g' }, ...(work ? [{ d: tips.map(([x, y]) => [x, y - 2]), c: 'g^' }] : []),
        eye(-2, -7, nap), eye(2, -7, nap), ...(nap ? [] : [{ d: [[-2, -6], [2, -6]], c: 'e' }]), { d: [[-4, -5], [3, -5]], c: 'c' },
      ];
    },
  },
  { // Petalkin, who turns grass to wildflowers.
    w: 24, h: 28, pal: { b: '#6aa848', p: '#f29ab4', y: '#ffe6a2', e: '#2a1420' },
    build(f) {
      const nap = f === 1, work = f === 3, spin = work ? .52 : 0, hy = nap ? -10.5 : -13;
      const petals = []; for (let k = 0; k < 6; k++) { const a = k * Math.PI / 3 + spin; petals.push({ e: [Math.cos(a) * 4.2, hy + Math.sin(a) * 3.8, 2.6, 2, a], c: 'p' }); }
      return [
        { l: [0, -1, 0, hy + 3, 2.4], c: 'b' }, { e: [0, -3, 3, 3], c: 'b' },
        { e: [-3.6, work ? -7 : -4.5, 2.4, 1.1, work ? -.8 : .45], c: 'b' }, { e: [3.6, work ? -7 : -4.5, 2.4, 1.1, work ? .8 : -.45], c: 'b' },
        ...petals, { e: [0, hy, 3.2, 3], c: 'y' },
        eye(-1, Math.round(hy) - 1, nap), eye(1, Math.round(hy) - 1, nap), { d: [[-3, hy + 1], [2, hy + 1]].map(([x, y]) => [x, Math.round(y)]), c: 'p' },
        ...(work ? [{ d: [[-7, hy - 6], [6, hy - 5], [0, hy - 8]].map(([x, y]) => [x, Math.round(y)]), c: 'p^' }] : []),
      ];
    },
  },
  { // Rainwisp, the water spirit: a raindrop with a curl at its tip, a cloud's light in it.
    w: 24, h: 30, pal: { b: '#4f9ee0', w: '#f2fbff', e: '#0e2a46', c: '#ffb8c8' },
    build(f) {
      const nap = f === 1, work = f === 3, sq = nap ? .85 : 1;
      return [
        { e: [0, -6.4 * sq, 6.2, 6.2 * sq], c: 'b' }, { l: [0, -9 * sq, 0, -14 * sq, 5.6], c: 'b' }, { l: [0, -13 * sq, .6, -17.5 * sq, 3.4], c: 'b' }, { l: [.6, -17 * sq, 2.2, -19.8 * sq, 1.8], c: 'b' }, { e: [3, -19.6 * sq, 1.4, 1.2], c: 'b' },
        { e: [-.5, -3.5 * sq, 4.6, 1.2], c: 'b^', flat: 1, ol: false },
        { d: [[-4, -9], [-4, -8], [-3, -10], [-3, -11], [-1, -14]].map(([x, y]) => [x, Math.round(y * sq)]), c: 'w' },
        eye(-2, Math.round(-7 * sq), nap), eye(2, Math.round(-7 * sq), nap), ...(nap ? [] : [{ d: [[-2, Math.round(-6 * sq)], [2, Math.round(-6 * sq)]], c: 'e' }]), { d: [[-4, Math.round(-5 * sq)], [3, Math.round(-5 * sq)]], c: 'c' },
        ...(work ? [{ e: [-8, -13, 1, 1.4], c: 'b' }, { e: [8, -15, 1, 1.4], c: 'b' }, { e: [-9, -6, .8, 1.1], c: 'b' }, { d: [[-9, -14], [7, -16]], c: 'w' }] : []),
      ];
    },
  },
  { // Elderoot, who revives trees: an old stump with root feet, branch arms and a hood of leaves.
    w: 32, h: 40, pal: { b: '#8a6240', d: '#5c9a3e', x: '#e4ffa8', e: '#22160c', m: '#79b04c' },
    build(f) {
      const nap = f === 1, work = f === 3, arm = work ? -6 : 0;
      return [
        { l: [-2.5, -3, -6, -.4, 2.4], c: 'b' }, { l: [2.5, -3, 6, -.4, 2.4], c: 'b' }, { l: [0, -3, .5, -.4, 2.2], c: 'b' },
        { l: [-5, -10, -10, -14 + arm, 2.2], c: 'b' }, { l: [-9, -13 + arm, -10, -17 + arm, 1.3], c: 'b' }, { e: [-10.5, -17.5 + arm, 2.2, 1.5, -.4], c: 'd' },
        { l: [5, -10, 10, -14 + arm, 2.2], c: 'b' }, { l: [9, -13 + arm, 10, -17 + arm, 1.3], c: 'b' }, { e: [10.5, -17.5 + arm, 2.2, 1.5, .4], c: 'd' },
        { e: [0, -10, 6.2, 8], c: 'b' },
        { d: [[-3, -6], [-3, -5], [3, -7], [3, -6], [0, -4], [-1, -3], [2, -3]], c: 'b_' },
        { l: [-3, -22, -5.5, -28, 1.3], c: 'b' }, { l: [-4.6, -26, -7, -27, 1.1], c: 'b' }, { l: [3, -22, 5.5, -28, 1.3], c: 'b' }, { l: [4.6, -26, 7, -27.5, 1.1], c: 'b' },
        { e: [-5, -16.5, 4, 3], c: 'd' }, { e: [5, -16.5, 4, 3], c: 'd' }, { e: [0, -19, 7.6, 4.6], c: 'd' },
        { d: [[-5, -21], [-2, -22], [2, -21], [5, -19], [-7, -17]], c: work ? 'x' : 'm' }, { d: [[-3, -18], [3, -17], [0, -20]], c: 'd_' },
        { d: [[-3, -12], [-2, -12], [2, -12], [3, -12]], c: 'e' }, nap ? { d: [[-3, -12], [2, -12]], c: 'e' } : { d: [[-2, -12], [2, -12]], c: 'x' },
        { d: [[-1, -9], [0, -9]], c: 'b!' },
        ...(work ? [{ d: [[-11, -21], [11, -21], [-12, -16], [12, -15]], c: 'x' }] : []),
      ];
    },
  },
];
export function spiritCanvas(type, frame, flip) {
  const key = `spirit:${type}:${frame}:${flip ? 1 : 0}`;
  let c = made.get(key);
  if (c) return c;
  const S = SPIRIT_ART[type];
  c = raster(S.w, S.h, S.pal, S.build(frame));
  if (flip) { const f = document.createElement('canvas'); f.width = c.width; f.height = c.height; const g = f.getContext('2d'); g.translate(c.width, 0); g.scale(-1, 1); g.drawImage(c, 0, 0); c = f; }
  made.set(key, c);
  return c;
}
// A portrait for the spirit cards.
export const spiritFace = type => spiritCanvas(type, 0, false).toDataURL();
