// All sound is synthesized and kept low and round. There is no music or ambient bed: the land is quiet
// except for its animals, which you hear when the camera is close to them and lose as it pulls away,
// and a whisper of soft earth under your hand while you plant. A few small chimes mark big moments.
const SCALE = [0, 2, 4, 7, 9, 12];
const pitch = n => 196 * Math.pow(2, n / 12);
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));

// How often each animal calls, per second, while you are near it.
const CALLS = { bird: .07, deer: .018, fawn: .025, rabbit: .02, duck: .045 };

export function createAudio() {
  let ac, master, soft, room, noise, muted = false, volume = .6;
  let lastPop = 0, nextGrain = 0, lastDig = -1, music = false, nextPhrase = 0, home = 0;
  const level = () => muted ? 0 : volume;
  // Optional music, off unless chosen in Settings: a slow music box. A short phrase of soft bell notes from the
  // pentatonic scale, a low note under it now and then, and long rests between, so it never becomes a drone.
  function stepMusic() {
    const t = ac.currentTime;
    if (t < nextPhrase) return;
    const PENTA = [0, 2, 4, 7, 9, 12, 14, 16], n = 3 + Math.floor(Math.random() * 4);
    let k = home = Math.max(0, Math.min(PENTA.length - 1, home + Math.floor(Math.random() * 3) - 1)), at = t + .1;
    for (let i = 0; i < n; i++) {
      const f = pitch(PENTA[k] + 12);
      tone(soft, at, f, f * .999, 2.6, .022); tone(soft, at, f * 2, f * 2 * .999, 1.2, .004);
      at += [.45, .6, .9][Math.floor(Math.random() * 3)];
      k = Math.max(0, Math.min(PENTA.length - 1, k + (Math.random() < .5 ? -1 : 1) * (1 + (Math.random() < .3))));
    }
    if (Math.random() < .5) { const f = pitch(PENTA[home % 5] - 12); tone(soft, t + .1, f, f * .999, 4, .018); }
    nextPhrase = at + 5 + Math.random() * 7;
  }
  function start() {
    if (ac) { if (ac.state === 'suspended') ac.resume(); return; }
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return;
    ac = new AC();
    master = ac.createGain(); master.gain.value = level();
    const limiter = ac.createDynamicsCompressor(); limiter.threshold.value = -24; limiter.ratio.value = 6; limiter.attack.value = .02; limiter.release.value = .4;
    master.connect(limiter); limiter.connect(ac.destination);
    // Chimes pass through this: highs rolled off, with a quiet room echo behind it. Far-off animals use the echo too.
    soft = ac.createBiquadFilter(); soft.type = 'lowpass'; soft.frequency.value = 1500; soft.Q.value = .3;
    const dry = ac.createGain(); dry.gain.value = .8; soft.connect(dry); dry.connect(master);
    room = ac.createDelay(1); room.delayTime.value = .3;
    const back = ac.createGain(), dark = ac.createBiquadFilter(), wet = ac.createGain();
    back.gain.value = .35; dark.type = 'lowpass'; dark.frequency.value = 900; wet.gain.value = .35;
    soft.connect(room); room.connect(dark); dark.connect(back); back.connect(room); dark.connect(wet); wet.connect(master);
    const b = ac.createBuffer(1, ac.sampleRate, ac.sampleRate), d = b.getChannelData(0);
    for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
    noise = b;
  }
  const live = () => ac && ac.state === 'running' && !muted;
  // A path for one sound out in the world: closer is louder, brighter and drier; farther is dull and mostly echo.
  function place(gain, pan, near) {
    const g = ac.createGain(); g.gain.value = gain;
    const lp = ac.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 500 + 3500 * near * near;
    g.connect(lp);
    let out = lp;
    if (ac.createStereoPanner) { const p = ac.createStereoPanner(); p.pan.value = clamp(pan, -1, 1) * .7; lp.connect(p); out = p; }
    const dry = ac.createGain(); dry.gain.value = .35 + .65 * near; out.connect(dry); dry.connect(master);
    const send = ac.createGain(); send.gain.value = .5 * (1 - near) + .1; out.connect(send); send.connect(room);
    return g;
  }
  function tone(dest, when, f0, f1, dur, peak, type = 'sine') {
    const o = ac.createOscillator(), g = ac.createGain();
    o.type = type; o.frequency.setValueAtTime(f0, when); o.frequency.exponentialRampToValueAtTime(f1, when + dur);
    g.gain.setValueAtTime(0, when); g.gain.linearRampToValueAtTime(peak, when + Math.min(.02, dur * .25)); g.gain.exponentialRampToValueAtTime(.0002, when + dur);
    o.connect(g); g.connect(dest); o.start(when); o.stop(when + dur + .02);
  }
  function hiss(dest, when, dur, peak, type, freq, q = 1) {
    const n = ac.createBufferSource(); n.buffer = noise;
    const f = ac.createBiquadFilter(); f.type = type; f.frequency.value = freq; f.Q.value = q;
    const g = ac.createGain(); g.gain.setValueAtTime(0, when); g.gain.linearRampToValueAtTime(peak, when + Math.min(.015, dur * .3)); g.gain.exponentialRampToValueAtTime(.0002, when + dur);
    n.connect(f); f.connect(g); g.connect(dest); n.start(when, Math.random() * .8, dur + .05);
  }
  // The animals' voices.
  const VOICE = {
    bird(d, t) { // two or three quick, sweet chirps
      const base = 2400 + Math.random() * 900, n = 2 + (Math.random() < .5);
      for (let k = 0; k < n; k++) { const w = t + k * (.09 + Math.random() * .05); tone(d, w, base * (1 + k * .04), base * 1.35, .07, .5); }
    },
    deer(d, t) { hiss(d, t, .22, .9, 'bandpass', 700, 1.2); tone(d, t + .02, 330, 260, .2, .12, 'triangle'); }, // a soft snort
    fawn(d, t) { tone(d, t, 620, 540, .28, .35, 'triangle'); tone(d, t, 1240, 1080, .28, .06); }, // a small bleat
    rabbit(d, t) { tone(d, t, 120, 70, .09, .9); tone(d, t + .14, 120, 70, .08, .6); }, // a thump of hind feet
    duck(d, t) { // a short, gentle quack or two
      const n = 1 + (Math.random() < .4);
      for (let k = 0; k < n; k++) { const f = ac.createBiquadFilter(); f.type = 'bandpass'; f.frequency.value = 1100; f.Q.value = 2; f.connect(d); tone(f, t + k * .2, 360, 280, .14, 1.2, 'sawtooth'); }
    },
  };
  return {
    start,
    get muted() { return muted; },
    get volume() { return volume; },
    setMuted(v) { muted = v; if (ac) master.gain.setTargetAtTime(level(), ac.currentTime, .15); },
    setVolume(v) { volume = v; if (ac) master.gain.setTargetAtTime(level(), ac.currentTime, .08); },
    get music() { return music; },
    setMusic(v) { music = v; nextPhrase = 0; },
    // A tap on a butterfly, bird or fish: its own small sound, close and clear.
    poke(kind) {
      if (!live()) return;
      const t = ac.currentTime, d = place(.04, 0, 1);
      if (kind === 'bird') VOICE.bird(d, t);
      else if (kind === 'fish') { hiss(d, t, .2, 1, 'bandpass', 1300, .8); tone(d, t, 600, 280, .12, .25); }
      else { tone(d, t, 1800, 2400, .12, .25); tone(d, t + .08, 2400, 3000, .12, .18); } // a butterfly: a tiny shimmer
    },
    // Called a few times a second with the animals in view: { kind, pan -1..1, d 0 (middle) to 1 (edge) },
    // how close the camera is, 0 (far out) to 1 (right down among them), and seconds since the last call.
    hear(sources, near, dt) {
      if (!live()) return;
      if (music) stepMusic();
      if (near <= 0) return;
      const t = ac.currentTime;
      for (const s of sources) {
        const rate = CALLS[s.kind]; if (!rate || Math.random() > rate * dt) continue;
        const loud = near * near * (1 - s.d * .55);
        if (loud > .02) VOICE[s.kind](place(.05 * loud, s.pan, near), t + Math.random() * .1);
      }
    },
    // A fish breaking the surface or falling back in.
    splash(pan, near, big) {
      if (!live() || near <= 0) return;
      const d = place(.045 * near * near, pan, near), t = ac.currentTime;
      hiss(d, t, big ? .3 : .18, 1, 'bandpass', big ? 900 : 1400, .8); tone(d, t, big ? 420 : 620, big ? 180 : 300, .12, .25);
    },
    // Planting: a whisper of crumbling earth, little grains at a time, never a tone.
    dig(amount) {
      if (!live() || amount < .35) return;
      const t = ac.currentTime;
      if (t - lastDig > .4) nextGrain = t;
      lastDig = t;
      if (t < nextGrain) return;
      nextGrain = t + .07 + Math.random() * .12;
      const d = place(.012 + Math.min(.008, amount * .0006), (Math.random() - .5) * .3, .55);
      hiss(d, t, .03 + Math.random() * .04, 1, 'bandpass', 700 + Math.random() * 900, .9);
      if (Math.random() < .35) hiss(d, t + .03 + Math.random() * .03, .025, .6, 'bandpass', 1500 + Math.random() * 800, 1.2);
    },
    pop() { if (!live()) return; const t = ac.currentTime; if (t - lastPop < .5) return; lastPop = t; const f = pitch(SCALE[Math.floor(Math.random() * 4)] + 7); tone(soft, t, f, f * .999, .7, .03); },
    water() { if (!live()) return; const t = ac.currentTime; [0, 4, 7].forEach((n, k) => { const f = pitch(n + 7); tone(soft, t + k * .3, f, f * .999, 1.8, .025); }); },
    chime(big = false) { if (!live()) return; const t = ac.currentTime; (big ? [0, 4, 7, 12, 16] : [0, 4, 7, 12]).forEach((n, k) => { const f = pitch(n + 12); tone(soft, t + k * .36, f, f * .999, 2.6, .04); }); },
    buy() { if (!live()) return; const t = ac.currentTime; tone(soft, t, pitch(12), pitch(12) * .999, .6, .03); tone(soft, t + .12, pitch(16), pitch(16) * .999, .7, .025); },
  };
}
