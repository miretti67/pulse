// @ts-nocheck
/* Particle field + ticket poof, ported from the first-run prototype.
   No DOM access at import time. */
const BUST_B64 = "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";
const BUST_ASPECT = 638 / 440;
const BG_OPACITY = .25; // butterfly behind first-run text

/* =====================================================================
   1. CLOCK, SCHEDULER, TWEENS — one time source for everything.
   Clock.manual = true lets a recorder step frames deterministically.
   ===================================================================== */
const Clock = {
  t: 0, manual: false, running: false, _last: 0, _raf: 0, _timers: [], _tweens: [], _frame: [],
  after(ms, fn) { const tm = { at: this.t + ms, fn }; this._timers.push(tm); return tm; },
  cancel(tm) { this._timers = this._timers.filter(x => x !== tm); },
  onFrame(fn) { this._frame.push(fn); },
  tick(dt) {
    this.t += dt;
    const due = this._timers.filter(x => x.at <= this.t);
    this._timers = this._timers.filter(x => x.at > this.t);
    due.forEach(x => x.fn());
    this._tweens = this._tweens.filter(tw => tw.step(this.t));
    this._frame.forEach(fn => fn(this.t, dt));
  },
  start() {
    if (this.running || this.manual) return;
    this.running = true; this._last = performance.now();
    const loop = (ts) => {
      if (!this.running) return;
      this.tick(Math.min(50, ts - this._last)); this._last = ts;
      this._raf = requestAnimationFrame(loop);
    };
    this._raf = requestAnimationFrame(loop);
  },
  stop() { this.running = false; cancelAnimationFrame(this._raf); }
};

const Ease = {
  linear: x => x,
  outCubic: x => 1 - Math.pow(1 - x, 3),
  inOutCubic: x => x < .5 ? 4 * x * x * x : 1 - Math.pow(-2 * x + 2, 3) / 2,
  inCubic: x => x * x * x,
  outQuint: x => 1 - Math.pow(1 - x, 5),
};
let REDUCED = false;
export function setReduced(v) { REDUCED = !!v; }
export function isReduced() { return REDUCED; }

/** Tween numeric props on any object. Returns a promise. dur=0 under reduced motion. */
function tween(obj, props, dur, ease = Ease.inOutCubic, onUpdate) {
  if (REDUCED) dur = 0;
  const from = {}; for (const k in props) from[k] = obj[k];
  const t0 = Clock.t;
  // cancel conflicting tweens on the same object+props
  Clock._tweens.forEach(tw => { if (tw.obj === obj) for (const k in props) delete tw.props[k]; });
  return new Promise(res => {
    const tw = { obj, props: { ...props }, step(t) {
      const p = dur <= 0 ? 1 : Math.min(1, (t - t0) / dur), e = ease(p);
      for (const k in this.props) obj[k] = from[k] + (this.props[k] - from[k]) * e;
      onUpdate && onUpdate(e, p);
      if (p >= 1) { res(); return false; } return true;
    }};
    if (dur <= 0) { tw.step(t0); return; }
    Clock._tweens.push(tw);
  });
}
const wait = ms => new Promise(r => Clock.after(REDUCED ? 0 : ms, r));

/** Fade/translate a DOM element via the shared clock (no CSS transitions -> frame-steppable). */
function fadeEl(el, to, dur = 300, dy = 0) {
  const st = el._fade || (el._fade = { o: parseFloat(getComputedStyle(el).opacity) || 0, y: to ? dy : 0 });
  if (to && dy) st.y = dy;
  const apply = () => { el.style.opacity = st.o; el.style.transform = st.y ? `translateY(${st.y}px)` : ''; };
  return tween(st, { o: to, y: to ? 0 : -dy }, dur, Ease.outCubic, apply).then(apply);
}

/* =====================================================================
   2. MODELS — butterfly (procedural, 3D-flapping) and bust (sampled).
   ===================================================================== */
function rng(seed) { return () => { seed |= 0; seed = seed + 0x6D2B79F5 | 0; let t = Math.imul(seed ^ seed >>> 15, 1 | seed); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; }; }
function inPoly(x, y, P) { let c = false; for (let i = 0, j = P.length - 1; i < P.length; j = i++) { const [xi, yi] = P[i], [xj, yj] = P[j]; if ((yi > y) !== (yj > y) && x < (xj - xi) * (y - yi) / (yj - yi) + xi) c = !c; } return c; }

/** Butterfly in local units: body on the Y axis, wings in X (span -1..1), y down.
 *  Each point: x (signed), y, part (0 forewing,1 hindwing,2 body/antenna,3 dust), brightness. */
function buildButterfly(N, seed = 7) {
  const R = rng(seed);
  // forewing: large, leading edge swept out to a pointed apex
  const FW = [[.03,-.10],[.12,-.32],[.28,-.54],[.50,-.70],[.74,-.80],[.97,-.86],[.93,-.70],[.87,-.52],[.80,-.32],[.71,-.16],[.55,-.04],[.35,.04],[.16,.08],[.05,.06]];
  // hindwing: smaller, rounder, tucked under the forewing, with a short tail
  const HW = [[.04,-.02],[.24,.00],[.44,.06],[.58,.16],[.63,.30],[.58,.44],[.48,.56],[.41,.66],[.38,.80],[.33,.95],[.28,.81],[.22,.70],[.12,.56],[.06,.40],[.03,.20]];
  const pts = [];
  const box = P => { const xs = P.map(p => p[0]), ys = P.map(p => p[1]); return [Math.min(...xs), Math.max(...xs), Math.min(...ys), Math.max(...ys)]; };
  const fill = (P, part, n, bright) => { const [x0, x1, y0, y1] = box(P); let k = 0; while (k < n) { const x = x0 + R() * (x1 - x0), y = y0 + R() * (y1 - y0); if (inPoly(x, y, P)) { pts.push([x, y, part, bright(x, y)]); k++; } } };
  const edge = (P, part, n) => { // dots along the outline, slightly inside: gives the wing a crisp silhouette
    const L = []; let tot = 0; for (let i = 0; i < P.length; i++) { const a = P[i], b = P[(i + 1) % P.length]; const l = Math.hypot(b[0] - a[0], b[1] - a[1]); L.push(l); tot += l; }
    for (let k = 0; k < n; k++) { let d = R() * tot, i = 0; while (d > L[i]) { d -= L[i]; i++; } const a = P[i], b = P[(i + 1) % P.length], u = d / L[i];
      const cx = P.reduce((s, p) => s + p[0], 0) / P.length, cy = P.reduce((s, p) => s + p[1], 0) / P.length; const x = a[0] + (b[0] - a[0]) * u, y = a[1] + (b[1] - a[1]) * u, ins = R() * .035;
      pts.push([x + (cx - x) * ins, y + (cy - y) * ins, part, .95]); }
  };
  const vein = (x0, y0, x1, y1, part, n, bend) => { for (let k = 0; k < n; k++) { const u = R(); const x = x0 + (x1 - x0) * u + Math.sin(u * Math.PI) * bend, y = y0 + (y1 - y0) * u; pts.push([x + (R() - .5) * .012, y + (R() - .5) * .012, part, .75]); } };
  const half = Math.floor(N * .48);
  // per side budgets
  const nEdgeF = half * .22 | 0, nEdgeH = half * .11 | 0, nFillF = half * .34 | 0, nFillH = half * .15 | 0, nVein = half * .11 | 0;
  const side = [];
  const start = pts.length;
  // wing fill: brighter towards the margin, a darker "cell" band (reads as pattern, not noise)
  fill(FW, 0, nFillF, (x, y) => { const r = Math.hypot(x - .05, y); return .30 + .55 * Math.min(1, Math.pow(r / 1.05, 2)) + (r > .70 ? .12 : 0); });
  fill(HW, 1, nFillH, (x, y) => { const r = Math.hypot(x - .05, y - .05); return .22 + .4 * Math.min(1, Math.pow(r / .7, 2)); }); // hindwing a touch dimmer: reads as behind
  edge(FW, 0, nEdgeF); edge(HW, 1, nEdgeH);
  const vF = [[.95,-.84],[.90,-.62],[.82,-.38],[.70,-.18],[.60,-.74]], vH = [[.60,.26],[.54,.48],[.40,.70],[.24,.70]];
  vF.forEach(([x, y]) => vein(.05, -.03, x, y, 0, nVein / 9 | 0, -.04));
  vH.forEach(([x, y]) => vein(.06, .06, x, y, 1, nVein / 9 | 0, .03));
  // margin spots on forewing tip (monarch-like), bright
  for (let k = 0; k < half * .04; k++) { const a = R() * Math.PI * 2, r = R() * .03, c = [[.86,-.76],[.78,-.75],[.88,-.62],[.84,-.46]][k % 4]; pts.push([c[0] + Math.cos(a) * r, c[1] + Math.sin(a) * r, 0, 1]); }
  // mirror the right side to the left
  const right = pts.slice(start); right.forEach(p => pts.push([-p[0], p[1], p[2], p[3]]));
  // body (abdomen + thorax + head) and antennae
  while (pts.length < N * .985) {
    const r = R();
    // thin elongated body: thorax + tapering abdomen
    if (r < .62) { const y = -.22 + R() * .76, w = (y < .04 ? .026 : .022 * (1 - (y - .04) / .56) + .005); pts.push([(R() - .5) * 2 * w, y, 2, .85]); }
    // clear head
    else if (r < .72) { const a = R() * 6.28, rr = Math.sqrt(R()) * .036; pts.push([Math.cos(a) * rr, -.265 + Math.sin(a) * rr, 2, 1]); }
    // two curved antennae (outward bow) ...
    else if (r < .92) { const s = R() < .5 ? -1 : 1, u = R(); pts.push([s * (.012 + .16 * u + .09 * u * u), -.29 - .50 * u + .06 * u * u, 2, .8]); }
    // ... with clubbed tips
    else { const s = R() < .5 ? -1 : 1, a = R() * 6.28, rr = Math.sqrt(R()) * .024; pts.push([s * .262 + Math.cos(a) * rr, -.73 + Math.sin(a) * rr, 2, 1]); }
  }
  // loose dust around the form (the "assembling" feel stays even when formed)
  while (pts.length < N) { const a = R() * 6.28, r = .5 + R() * .9; pts.push([Math.cos(a) * r * 1.1, Math.sin(a) * r * .8, 3, .25 + R() * .35]); }
  return pts.slice(0, N);
}

function decodeBust() {
  const bin = atob(BUST_B64), n = bin.length / 5 | 0, out = [];
  for (let i = 0; i < n; i++) { const o = i * 5, x = bin.charCodeAt(o) | bin.charCodeAt(o + 1) << 8, y = bin.charCodeAt(o + 2) | bin.charCodeAt(o + 3) << 8, b = bin.charCodeAt(o + 4);
    out.push([x / 65535, y / 65535, (b & 127) / 127, !!(b & 128)]); }
  return out;
}

/* =====================================================================
   3. ButterflyField — the 2,000-dot field.
   Public API:
     mount(canvas)                 attach + size to parent (DPR capped at 2)
     form({from:'scatter'|'current', dur, stagger})   assemble dots into the butterfly
     setPose({cx,cy,size,yaw,pitch,roll}, dur)        move/turn the butterfly (fractions of the canvas for cx/cy)
     setOpacity(a, dur)            fade the whole field (0..1)
     setFlap({period, amp, base}, dur)                wing beat (period in ms)
     flyTo(cx, cy, size, dur)      curved flight to a point (fractions of canvas)
     dissolve(rect, dur)           dots leave the butterfly and become the particle bust inside rect (px, canvas space)
     setTint('none'|'up'|'down')   collar + lower third tint of the bust; the face stays off-white
     ripple(amount)                brief re-form shimmer (used between explainer beats)
     drift                         0..1 idle drift amount
   ===================================================================== */
class ButterflyField {
  constructor(n = 2000) {
    this.n = n;
    this.fly = buildButterfly(n);
    this.bust = decodeBust();
    // shuffle bust order so dots from every part of the butterfly feed every part of the bust
    const R = rng(11); for (let i = this.bust.length - 1; i > 0; i--) { const j = R() * (i + 1) | 0; [this.bust[i], this.bust[j]] = [this.bust[j], this.bust[i]]; }
    while (this.bust.length < n) this.bust.push(this.bust[this.bust.length % 2000]);
    const F = k => new Float32Array(n);
    this.x = F(); this.y = F(); this.fx = F(); this.fy = F(); this.tx = F(); this.ty = F(); this.ta = F();
    this.delay = F(); this.arc = F(); this.size = F(); this.ph = F(); this.sp = F();
    const R2 = rng(5);
    for (let i = 0; i < n; i++) { this.size[i] = .8 + R2() * R2() * 1.3; this.ph[i] = R2() * 6.28; this.sp[i] = .4 + R2() * .9; this.arc[i] = (R2() - .5) * 2; }
    this.pose = { cx: .5, cy: .32, size: 150, yaw: -.32, pitch: .45, roll: .1 };
    this.flap = { period: 600, amp: .62, base: .28 };
    this.opacity = 1; this.drift = .25; this.shape = 'fly'; this.bustRect = null; this.bustMix = 0;
    this.tint = { r: 241, g: 240, b: 234 }; this._ripple = 0; this.dotScale = 1; this.tintK = 0;
    this.morph = null; // {t0, dur, stagger}
    this.lead = 0;     // wing phase (ms) — integrates period so period changes stay smooth
  }
  mount(canvas) {
    this.c = canvas; this.ctx = canvas.getContext('2d');
    const fit = () => { const r = canvas.parentElement.getBoundingClientRect(); this.dpr = Math.min(2, devicePixelRatio || 1);
      this.w = r.width; this.h = r.height; canvas.width = Math.round(r.width * this.dpr); canvas.height = Math.round(r.height * this.dpr); };
    fit(); addEventListener('resize', fit); this._fit = fit;
    for (let i = 0; i < this.n; i++) { this.x[i] = -9999; this.y[i] = -9999; }
    return this;
  }
  /* ---- targets ---- */
  _flyTargets(t) {
    const P = this.pose, f = this.flap, n = this.n;
    const s = P.size, cx = P.cx * this.w, cy = P.cy * this.h;
    const cyw = Math.cos(P.yaw), syw = Math.sin(P.yaw), cp = Math.cos(P.pitch), sp = Math.sin(P.pitch), cr = Math.cos(P.roll), sr = Math.sin(P.roll);
    const ph = this.lead / f.period * Math.PI * 2;
    const beat = k => f.base + f.amp * (.5 - .5 * Math.cos(ph - k)); // smooth, never snaps
    // hindwing lags the forewing; the left pair lags the right slightly with ~5% less amplitude: feels alive, not mechanical
    const W = [beat(0), beat(.45), f.base + (beat(.16) - f.base) * .95, f.base + (beat(.62) - f.base) * .95].map(a => [Math.cos(a), Math.sin(a)]);
    const D = 3.4;
    for (let i = 0; i < n; i++) {
      const p = this.fly[i]; let X, Y = p[1], Z;
      if (p[2] < 2) { const ax = Math.abs(p[0]), sg = Math.sign(p[0]); const w = W[p[2] + (sg < 0 ? 2 : 0)], c = w[0], sn = w[1];
        X = sg * ax * c; Z = -ax * sn - ax * ax * .08; }
      else if (p[2] === 2) { X = p[0]; Z = 0; }
      else { const tt = t * .00025 * this.sp[i]; X = p[0] + Math.sin(tt + this.ph[i]) * .06; Y = p[1] + Math.cos(tt * 1.3 + this.ph[i]) * .05; Z = 0; }
      // yaw (around body axis Y), pitch (around X), roll (around view Z)
      let x1 = X * cyw - Z * syw, z1 = X * syw + Z * cyw;
      let y2 = Y * cp - z1 * sp, z2 = Y * sp + z1 * cp;
      let x3 = x1 * cr - y2 * sr, y3 = x1 * sr + y2 * cr;
      const k = D / (D + z2);
      this.tx[i] = cx + x3 * s * k; this.ty[i] = cy + y3 * s * k;
      this.ta[i] = p[3] * Math.max(.35, Math.min(1.15, 1 - z2 * .35));
    }
  }
  _bustTargets(t) {
    const r = this.bustRect, n = this.n; if (!r) return;
    for (let i = 0; i < n; i++) { const b = this.bust[i];
      this.tx[i] = r.x + b[0] * r.w + Math.sin(t * .0007 * this.sp[i] + this.ph[i]) * .7;
      this.ty[i] = r.y + b[1] * r.h + Math.cos(t * .0006 * this.sp[i] + this.ph[i]) * .7;
      this.ta[i] = .25 + b[2] * .85; }
  }
  /* ---- API ---- */
  form({ from = 'scatter', dur = 1700, stagger = 500 } = {}) {
    const R = rng(Clock.t | 0 + 3);
    for (let i = 0; i < this.n; i++) {
      if (from === 'scatter' || this.x[i] < -999) { const a = R() * 6.28, r = .45 + R() * .7; this.x[i] = this.w * (.5 + Math.cos(a) * r); this.y[i] = this.h * (.4 + Math.sin(a) * r * .9); }
      this.delay[i] = R() * stagger;
    }
    this.shape = 'fly'; this._startMorph(dur, stagger);
  }
  _startMorph(dur, stagger) {
    for (let i = 0; i < this.n; i++) { this.fx[i] = this.x[i]; this.fy[i] = this.y[i]; }
    this.morph = REDUCED ? null : { t0: Clock.t, dur, end: Clock.t + dur + stagger };
    return new Promise(r => REDUCED ? r() : Clock.after(dur + stagger, r));
  }
  finish() { this.morph = null; }
  setPose(p, dur = 600, ease) { return tween(this.pose, p, dur, ease); }
  setFlap(p, dur = 400) { return tween(this.flap, p, dur); }
  setOpacity(a, dur = 500) { return tween(this, { opacity: a }, dur); }
  /** background mode: ~25% opacity, slightly larger dots (explainer / sign-in / username) */
  setBackground(on, dur = 600) { return tween(this, { opacity: on ? BG_OPACITY : 1, dotScale: on ? 1.35 : 1 }, dur); }
  flyTo(cx, cy, size, dur = 1400) {
    const P = this.pose, x0 = P.cx, y0 = P.cy, s0 = P.size, y0w = P.yaw;
    const mx = (x0 + cx) / 2 + (cy - y0) * .35, my = Math.min(y0, cy) - .12; // curved path, arcs upward
    const st = { u: 0 };
    return tween(st, { u: 1 }, dur, Ease.inOutCubic, (e) => {
      const u = e, a = (1 - u) * (1 - u), b = 2 * u * (1 - u), c = u * u;
      P.cx = a * x0 + b * mx + c * cx; P.cy = a * y0 + b * my + c * cy;
      P.size = s0 + (size - s0) * e; P.yaw = y0w + Math.sin(u * Math.PI) * .35;
      P.roll = .12 + Math.sin(u * Math.PI * 2) * .12;
    });
  }
  dissolve(rect, { dur = 1100, stagger = 700, ox, oy } = {}) {
    this.bustRect = rect; this.shape = 'bust';
    // dots closest to the landing point leave first: reads as "melting into" the avatar
    ox = ox ?? rect.x + rect.w / 2; oy = oy ?? rect.y + rect.h * .35; let mx = 1;
    for (let i = 0; i < this.n; i++) mx = Math.max(mx, Math.hypot(this.x[i] - ox, this.y[i] - oy));
    for (let i = 0; i < this.n; i++) this.delay[i] = Math.hypot(this.x[i] - ox, this.y[i] - oy) / mx * stagger * (.7 + .3 * this.sp[i] / 1.3);
    return this._startMorph(dur, stagger);
  }
  setTint(state, dur = 450) {
    const C = { none: [241, 240, 234], up: [168, 230, 58], down: [125, 32, 40] }[state] || [241, 240, 234];
    tween(this, { tintK: state === 'none' ? 0 : 1 }, dur, Ease.outCubic);
    return tween(this.tint, { r: C[0], g: C[1], b: C[2] }, dur, Ease.outCubic);
  }
  ripple(a = 1) { this._ripple = Math.max(this._ripple, a); }
  /* ---- per frame ---- */
  update(t, dt) {
    if (!REDUCED) this.lead += dt; else this.lead = this.flap.period * .3;
    if (this.shape === 'fly') this._flyTargets(t); else this._bustTargets(t);
    this._ripple *= Math.pow(.25, dt / 1000);
    const m = this.morph, n = this.n, dr = REDUCED ? 0 : this.drift, rp = this._ripple;
    for (let i = 0; i < n; i++) {
      let tx = this.tx[i], ty = this.ty[i];
      if (dr || rp) { const w = t * .001 * this.sp[i] + this.ph[i]; const amp = dr * 2.2 + rp * 14 * this.sp[i]; tx += Math.sin(w) * amp; ty += Math.cos(w * 1.17) * amp; }
      if (m) {
        let p = (t - m.t0 - this.delay[i]) / m.dur; p = p < 0 ? 0 : p > 1 ? 1 : p; const e = Ease.inOutCubic(p);
        const fx = this.fx[i], fy = this.fy[i], dx = tx - fx, dy = ty - fy, bow = Math.sin(p * Math.PI) * this.arc[i] * .18;
        this.x[i] = fx + dx * e - dy * bow; this.y[i] = fy + dy * e + dx * bow;
      } else { this.x[i] = tx; this.y[i] = ty; }
    }
    if (m && t >= m.end) this.morph = null;
  }
  render() {
    const g = this.ctx, d = this.dpr, n = this.n; g.setTransform(1, 0, 0, 1, 0, 0); g.clearRect(0, 0, this.c.width, this.c.height);
    if (this.opacity <= .003) return;
    g.setTransform(d, 0, 0, d, 0, 0);
    // bucket by alpha (8) x colour level (4) => few state changes, 2,000 rects
    const isB = this.shape === 'bust', T = this.tint, tinted = isB && (Math.abs(T.r - 241) + Math.abs(T.g - 240) + Math.abs(T.b - 234) > 2);
    const buckets = this._bk || (this._bk = Array.from({ length: 32 }, () => []));
    buckets.forEach(b => b.length = 0);
    const r = this.bustRect;
    for (let i = 0; i < n; i++) {
      const x = this.x[i], y = this.y[i]; if (x < -20 || y < -20 || x > this.w + 20 || y > this.h + 20) continue;
      let a = this.ta[i]; a = a > 1 ? 1 : a; let lvl = 0;
      if (tinted) { const b = this.bust[i]; // face stays off-white; collar + lower third take the tint
        lvl = b[3] ? 3 : (b[1] > .86 ? 3 : b[1] > .78 ? 2 : b[1] > .70 ? 1 : 0); }
      else if (!isB && this.tintK > 0.02) lvl = 2; // flying dots take the last-call tint
      buckets[lvl * 8 + Math.min(7, a * 8 | 0)].push(i);
    }
    for (let L = 0; L < 4; L++) {
      const u = L / 3; g.fillStyle = `rgb(${241 + (T.r - 241) * u | 0},${240 + (T.g - 240) * u | 0},${234 + (T.b - 234) * u | 0})`;
      // tinted band (collar + lower third): dots grow to ~2x and get a twin dot => reads as a solid band, like the ME card's red line
      const grow = 1 + (L === 3 ? this.tintK : L === 2 ? this.tintK * .25 : 0), twin = L === 3 && this.tintK > .05;
      for (let A = 0; A < 8; A++) { const B = buckets[L * 8 + A]; if (!B.length) continue; g.globalAlpha = Math.min(1, (A + .6) / 8 * (L === 3 ? 1 + .6 * this.tintK : 1)) * this.opacity;
        for (const i of B) { const s = this.size[i] * this.dotScale * grow; g.fillRect(this.x[i] - s / 2, this.y[i] - s / 2, s, s);
          if (twin) { const ox = Math.cos(this.ph[i]) * 2.6, oy = Math.sin(this.ph[i]) * 1.6; g.fillRect(this.x[i] + ox - s / 2, this.y[i] + oy - s / 2, s, s); } } }
    }
    g.globalAlpha = 1;
  }
}

/* =====================================================================
   4. TicketPoof — ticket body -> dots pulled into one side of the crowd bar.
   poof(bodyEl, targetRect, onArrive) ; matte dots, no twinkle/glitter.
   ===================================================================== */
class TicketPoof {
  constructor(canvas) { this.c = canvas; this.g = canvas.getContext('2d'); this.d = []; this.fit(); addEventListener('resize', () => this.fit()); }
  fit() { const r = this.c.parentElement.getBoundingClientRect(); this.dpr = Math.min(2, devicePixelRatio || 1); this.w = r.width; this.h = r.height; this.c.width = r.width * this.dpr | 0; this.c.height = r.height * this.dpr | 0; this.origin = r; }
  poof(src, dst, color, onDone) {
    const R = rng(Clock.t | 0), step = 5, t0 = Clock.t; let total = 0;
    const cx = src.x + src.w / 2, cy = src.y + src.h / 2;
    for (let y = src.y + 2; y < src.y + src.h - 2; y += step) for (let x = src.x + 2; x < src.x + src.w - 2; x += step) {
      if (R() < .3) continue; total++;
      const a = Math.atan2(y - cy, x - cx), burst = 4 + R() * 10;
      // stream order: dots nearest the target leave first, so the flow reads as one ribbon
      const order = Math.hypot(x - (dst.x + dst.w / 2), y - dst.y) / 400;
      this.d.push({ x0: x + R() * 2, y0: y + R() * 2, bx: Math.cos(a) * burst, by: Math.sin(a) * burst,
        tx: dst.x + 1 + R() * (dst.w - 2), ty: dst.y + 1 + R() * (dst.h - 2), t0: t0 + order * 380 + R() * 240, dur: 620 + R() * 160,
        bend: (dst.x + dst.w / 2 < cx ? -1 : 1) * (60 + R() * 50), s: 1 + R() * 1.1, c: color, done: false });
    }
    this.onDone = onDone; this.pending = total;
  }
  update(t) {
    for (const p of this.d) {
      const e = (t - p.t0) / p.dur;
      if (e < 0) { p.x = p.x0; p.y = p.y0; p.a = .9; continue; }
      const b = Math.min(1, (t - p.t0) / 160), bo = Ease.outCubic(b); // short puff outward
      const sx = p.x0 + p.bx * bo, sy = p.y0 + p.by * bo;
      const u = Math.min(1, Math.max(0, (t - p.t0 - 120) / p.dur)), k = Ease.inOutCubic(u); // then pulled, accelerating
      const mx = (sx + p.tx) / 2 + p.bend, my = (sy + p.ty) / 2; // sideways bow: dots stream down on a curve
      p.x = (1 - k) * (1 - k) * sx + 2 * k * (1 - k) * mx + k * k * p.tx; p.y = (1 - k) * (1 - k) * sy + 2 * k * (1 - k) * my + k * k * p.ty;
      p.a = .9; p.sz = p.s * (1 - .5 * k);
      if (u >= 1 && !p.done) { p.done = true; this.pending--; }
    }
    this.d = this.d.filter(p => !p.done);
    if (this.onDone && this.pending <= 0) { const f = this.onDone; this.onDone = null; f(); }
  }
  render() {
    const g = this.g; g.setTransform(1, 0, 0, 1, 0, 0); g.clearRect(0, 0, this.c.width, this.c.height); if (!this.d.length) return;
    g.setTransform(this.dpr, 0, 0, this.dpr, 0, 0); g.fillStyle = '#F1F0EA'; g.globalAlpha = .9;
    for (const p of this.d) { const s = p.sz || p.s; g.fillRect(p.x - s / 2, p.y - s / 2, s, s); }
  }
}


const drawers = new Set();
Clock.onFrame((t, dt) => { for (const fn of drawers) fn(t, dt); });
export function watch(fn) {
  drawers.add(fn);
  Clock.start();
  return () => { drawers.delete(fn); if (!drawers.size) Clock.stop(); };
}
export { Clock, ButterflyField, TicketPoof, BUST_ASPECT, Ease, tween, wait };
