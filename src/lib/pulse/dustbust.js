// @ts-nocheck
/* Particle dust busts in the style of the ME card art (public/pulse/profile.jpg).
   Note: the ME card is a static image in the app; the only code version is the 2,000-point
   sample of it in src/lib/pulse/motion.js (BUST_B64 / decodeBust). Here each character is a
   procedural density mask (head-and-shoulders silhouette + accessory), sampled into dust:
   dense core, scattered edges, a tinted rim along the shoulder line. */
const BUSTS = [
  { id: 'hood',  name: 'THE HOODED' },
  { id: 'bot',   name: 'THE HELM' },
  { id: 'cat',   name: 'THE CAT' },
  { id: 'punk',  name: 'THE PUNK' },
  { id: 'astro', name: 'THE ASTRONAUT' },
];
const TINTS = { up: [168, 230, 58], down: [125, 32, 40], none: [232, 61, 67] };
const S = 256; // mask resolution

function shoulders(g) { // shared torso: broad rounded shoulders fading into the base
  g.beginPath(); g.moveTo(30, 256); g.bezierCurveTo(34, 196, 70, 178, 104, 170); g.lineTo(152, 170);
  g.bezierCurveTo(186, 178, 222, 196, 226, 256); g.closePath(); g.fill();
  g.fillRect(108, 140, 40, 40); // neck
}
function head(g, cx = 128, cy = 100, rx = 40, ry = 48) { g.beginPath(); g.ellipse(cx, cy, rx, ry, 0, 0, 7); g.fill(); }
const MASKS = {
  hood(g) { // pointed hood draping onto the shoulders, darker face opening
    shoulders(g);
    g.beginPath(); g.moveTo(128, 18); g.bezierCurveTo(190, 30, 196, 110, 186, 176); g.lineTo(70, 176);
    g.bezierCurveTo(60, 110, 66, 30, 128, 18); g.fill();
    g.fillStyle = 'rgb(70,70,70)'; g.beginPath(); g.ellipse(128, 108, 30, 40, 0, 0, 7); g.fill();
    g.fillStyle = 'rgb(255,255,255)'; g.fillRect(110, 104, 12, 5); g.fillRect(134, 104, 12, 5); // eyes catch light
  },
  bot(g) { // squared helmet, side bolts, dark visor band, short antenna stubs
    shoulders(g);
    g.beginPath(); g.roundRect(80, 46, 96, 104, 16); g.fill();
    g.fillRect(68, 86, 14, 30); g.fillRect(174, 86, 14, 30);
    g.fillRect(96, 30, 8, 18); g.fillRect(152, 30, 8, 18);
    g.fillStyle = 'rgb(60,60,60)'; g.fillRect(90, 82, 76, 22);
    g.fillStyle = 'rgb(255,255,255)'; g.fillRect(100, 89, 16, 8); g.fillRect(140, 89, 16, 8);
    g.fillStyle = 'rgb(150,150,150)'; for (let i = 0; i < 5; i++) g.fillRect(100 + i * 12, 122, 6, 12); // grille
  },
  cat(g) { // round head with two tall pointed ears and whisker hints
    shoulders(g); head(g, 128, 104, 44, 42);
    g.beginPath(); g.moveTo(88, 86); g.lineTo(84, 28); g.lineTo(122, 66); g.fill();
    g.beginPath(); g.moveTo(168, 86); g.lineTo(172, 28); g.lineTo(134, 66); g.fill();
    g.fillStyle = 'rgb(80,80,80)'; g.beginPath(); g.ellipse(112, 100, 7, 9, 0, 0, 7); g.ellipse(144, 100, 7, 9, 0, 0, 7); g.fill();
    g.strokeStyle = 'rgb(255,255,255)'; g.lineWidth = 2;
    for (const s of [-1, 1]) for (const dy of [-4, 4]) { g.beginPath(); g.moveTo(128 + s * 18, 118 + dy); g.lineTo(128 + s * 62, 112 + dy * 2.5); g.stroke(); }
  },
  punk(g) { // shaved head with a tall spiked mohawk fin
    shoulders(g); head(g, 128, 108, 38, 46);
    g.beginPath(); g.moveTo(112, 70);
    const tips = [[106, 22], [118, 50], [124, 8], [134, 46], [144, 14], [148, 52], [160, 30], [150, 74]];
    for (const [x, y] of tips) g.lineTo(x, y); g.closePath(); g.fill();
    g.fillStyle = 'rgb(90,90,90)'; g.fillRect(112, 104, 12, 6); g.fillRect(134, 104, 12, 6);
    g.fillStyle = 'rgb(255,255,255)'; g.beginPath(); g.arc(90, 120, 4, 0, 7); g.fill(); // earring
  },
  astro(g) { // big round helmet with a dark visor, side light and an antenna with a ball
    shoulders(g); g.fillRect(84, 150, 88, 26); // collar ring
    g.beginPath(); g.arc(128, 98, 62, 0, 7); g.fill();
    g.fillStyle = 'rgb(55,55,55)'; g.beginPath(); g.ellipse(128, 104, 42, 30, 0, 0, 7); g.fill();
    g.fillStyle = 'rgb(230,230,230)'; g.beginPath(); g.ellipse(110, 94, 10, 5, -.5, 0, 7); g.fill(); // visor glint
    g.fillStyle = 'rgb(255,255,255)'; g.fillRect(166, 6, 4, 40); g.beginPath(); g.arc(168, 8, 7, 0, 7); g.fill();
  },
};
function buildMask(id) {
  const c = document.createElement('canvas'); c.width = c.height = S; const g = c.getContext('2d');
  g.fillStyle = '#fff'; g.strokeStyle = '#fff'; MASKS[id](g);
  const core = g.getImageData(0, 0, S, S).data;
  const b = document.createElement('canvas'); b.width = b.height = S; const bg = b.getContext('2d');
  bg.filter = 'blur(16px)'; bg.drawImage(c, 0, 0); const halo = bg.getImageData(0, 0, S, S).data;
  const s = document.createElement('canvas'); s.width = s.height = S; const sg = s.getContext('2d');
  sg.filter = 'blur(2px)'; sg.drawImage(c, 0, 0); const soft = sg.getImageData(0, 0, S, S).data;
  return { core, soft, halo };
}
function rngD(seed) { return () => { seed |= 0; seed = seed + 0x6D2B79F5 | 0; let t = Math.imul(seed ^ seed >>> 15, 1 | seed); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; }; }
const rimY = u => 200 + 30 * Math.sin(u * Math.PI); // shoulder rim: arc from left shoulder down through centre, up to right

class DustBust {
  constructor(canvas, id, { n = 9000, seed = 1, dot = 1 } = {}) {
    this.dot = dot;
    this.c = canvas; this.g = canvas.getContext('2d'); this.id = id; this.n = n; this.tint = TINTS.none; this.tintTo = TINTS.none;
    const m = buildMask(id), R = rngD(seed + id.length * 31); const P = [];
    let guard = 0;
    while (P.length < n && guard++ < n * 60) {
      const x = R() * S, y = R() * S, i = ((y | 0) * S + (x | 0)) * 4;
      const core = m.soft[i] / 255, halo = m.halo[i] / 255;
      // dense core that thins smoothly toward the outline (halo), lit from the upper left, plus dust scattering off the edges
      const shade = .72 + .38 * Math.max(0, 1 - Math.hypot(x - 112, y - 90) / 150);
      const below = y > rimY(x / S) + 3 ? .1 : 1;
      let p = core > .05 ? Math.pow(core, 1.2) * (.35 + .65 * Math.pow(halo, 1.3)) * shade * below : halo * .05 * below;
      if (y < 10 || x < 4 || x > S - 4) p *= .2;
      if (R() < p) {
        const edge = 1 - Math.min(1, core * halo * 1.5);
        // dust blows off the outline: edge grains get pushed outward from the bust centre
        let px = x, py = y; if (edge > .3 && R() < edge * .95) { const a = Math.atan2(y - 120, x - 128), d = R() * R() * 44 * edge; px += Math.cos(a) * d + (R() - .5) * 6; py += Math.sin(a) * d - R() * 6 * edge; }
        const clump = .65 + .35 * Math.sin(x * .21 + Math.sin(y * .17) * 2) * Math.cos(y * .19 - x * .07); // grain texture
        const big = R() < .025;
        P.push({ x: px, y: py, s: big ? .9 + R() * .9 : .28 + R() * R() * .7, a: Math.min(1, (.2 + .85 * core * halo) * clump * (.6 + R() * .55) * shade),
          w: 196 + R() * 45, ph: R() * 6.28, sp: .3 + R() * .9, edge }); }
    }
    // rim particles along the shoulder line
    const rim = []; for (let k = 0; k < n * .045; k++) { const u = .02 + R() * .96, x = 40 + u * 176; rim.push({ x: x + (R() - .5) * 3, y: rimY(u) + (R() - .5) * 2.6 * (1 + R()), s: .4 + R() * .9, a: .55 + R() * .45, ph: R() * 6.28 }); }
    this.P = P; this.rim = rim;
  }
  setTint(state) { this.tintTo = TINTS[state] || TINTS.none; }
  render(t) {
    const c = this.c, g = this.g, W = c.width, H = c.height, k = Math.min(W, H) / S, ox = (W - S * k) / 2, oy = (H - S * k) / 2;
    this.tint = this.tint.map((v, i) => v + (this.tintTo[i] - v) * .08);
    g.setTransform(1, 0, 0, 1, 0, 0); g.clearRect(0, 0, W, H);
    const br = 1 + .012 * Math.sin(t / 1500); // breathing, anchored at the base
    const tf = (x, y) => [ox + (128 + (x - 128) * br) * k, oy + (256 + (y - 256) * br) * k];
    for (const p of this.P) { // drift: edge dust wanders further than the core
      const w = t * .0006 * p.sp + p.ph, amp = .35 + p.edge * 2.4;
      const [x, y] = tf(p.x + Math.sin(w) * amp, p.y + Math.cos(w * 1.3) * amp - p.edge * 1.2 * (.5 + .5 * Math.sin(w * .7)));
      g.globalAlpha = p.a * (.85 + .15 * Math.sin(w * 2)); g.fillStyle = `rgb(${p.w + 8 | 0},${p.w + 4 | 0},${p.w - 10 | 0})`; const s = Math.max(.6, p.s * k * this.dot); g.fillRect(x, y, s, s);
    }
    const [r, gg, b] = this.tint.map(v => v | 0);
    // glow under the rim, then the rim dust itself
    g.globalAlpha = .9; g.shadowColor = `rgba(${r},${gg},${b},.9)`; g.shadowBlur = 8 * k; g.fillStyle = `rgb(${r},${gg},${b})`;
    for (const p of this.rim) { const w = t * .001 + p.ph; const [x, y] = tf(p.x + Math.sin(w) * .4, p.y + Math.cos(w) * .4); g.globalAlpha = p.a * (.75 + .25 * Math.sin(w * 3)); const s = Math.max(.8, p.s * k * this.dot); g.fillRect(x, y, s, s); }
    g.shadowBlur = 0; g.globalAlpha = 1;
  }
}
export { BUSTS, DustBust };
