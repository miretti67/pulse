import { Link } from "@tanstack/react-router";
import { useEffect, useRef, useState, type RefObject } from "react";
import { formatPrice } from "@/lib/pulse/format";
import { LENGTHS, type LengthMin } from "@/lib/pulse/math";
import { getPulse } from "@/lib/pulse/source";
import { useBtcTicker } from "@/lib/pulse/btc-ticker";
import { useReducedMotion } from "@/lib/pulse/telegram";
import type { MarketSnap } from "@/lib/pulse/types";
import "./landing.css";

/**
 * All landing copy in one place so a later pass can swap wording
 * without hunting through the markup. Region ids match data-copy attributes.
 */
const COPY = {
  wordmark: "PULSE",
  disclaimer: "Points only, no cash value.",
  disclaimerLoud: "POINTS HAVE NO CASH VALUE.",
  cta: "Make your call",
  heroKicker: "Short-term BTC markets",
  heroBefore: "Call Bitcoin ",
  heroUp: "up",
  heroMid: " or ",
  heroDown: "down",
  heroEnd: ".",
  heroSub:
    "Over 1, 5 or 15 minutes. Everyone's points go into one pot, and the winners split the losers' side.",
  howKicker: "How it works",
  howTitle: "Three steps. Then the price settles.",
  steps: [
    {
      num: "01",
      kicker: "Pick a market",
      title: "1M, 5M or 15M.",
      body: "Each one opens right as the last one closes.",
    },
    {
      num: "02",
      kicker: "Make a call",
      title: "Call UP or DOWN.",
      body: "Put points in that side's pot. Calls lock shortly before close.",
    },
    {
      num: "03",
      kicker: "Settle",
      title: "The live BTC price decides.",
      body: "If you were right, you split the losing side's pot with the other winners.",
    },
  ],
  settleKicker: "The settle",
  settleTitle: "Drawn against the live price.",
  settleNoteLive: "Recent Coinbase BTC/USD. Markets settle on the live BTC price.",
  settleNoteIllus: "Illustration. Not a live chart. Markets settle on the live BTC price.",
  marketsKicker: "The markets",
  marketsTitle: "1M, 5M and 15M.",
  marketsLead: "Pick a window. Call up or down. Each market opens right as the last one closes.",
  marketLabel: { 1: "One minute", 5: "Five minutes", 15: "Fifteen minutes" } as Record<
    LengthMin,
    string
  >,
  crowdLive: "Live crowd share.",
  crowdIllus: "Illustration only. Not live crowd share.",
  sharesKicker: "After close",
  sharesTitle: "Winners split the other side.",
  sharesLead: "Example layouts of how a settled pot can look. Not live results.",
  shareIllus: "Illustration. Winners split the losing side.",
  demoBadge: "Demo mode",
  demoTitle: "Play against 1,000 practice bots.",
  demoLead:
    "A practice table so you can learn the flow first. Clearly a demo. Not a live market, and no cash value either way.",
  demoCta: "Try the live app",
  endKicker: "Your move",
  endTitle: "See the crowd. Make your call.",
  footerNote: "Pulse · 1M, 5M and 15M",
  footerLink: "Open the app",
};

const ILLUS_SPARK: Record<LengthMin, string> = {
  1: "M0,28 16,24 32,30 48,18 64,22 80,10 96,16 112,14 128,26 144,12 160,18 176,8 200,14",
  5: "M0,18 16,20 32,14 48,22 64,16 80,28 96,22 112,30 128,18 144,24 160,12 176,20 200,16",
  15: "M0,22 16,18 32,24 48,20 64,12 80,16 96,8 112,18 128,10 144,14 160,22 176,6 200,10",
};

const ILLUS_UP: Record<LengthMin, number> = { 1: 58, 5: 44, 15: 51 };

const ILLUS_PATH =
  "M0,260 C80,250 120,210 180,200 C260,184 300,240 360,220 C430,196 470,110 540,130 C610,150 650,90 720,100 C800,112 840,190 920,170 C1000,148 1060,80 1200,60";
const ILLUS_FILL =
  "M0,260 C80,250 120,210 180,200 C260,184 300,240 360,220 C430,196 470,110 540,130 C610,150 650,90 720,100 C800,112 840,190 920,170 C1000,148 1060,80 1200,60 L1200,400 L0,400 Z";

const SHARES: { lengthMin: LengthMin; upPct: number }[] = [
  { lengthMin: 1, upPct: 62 },
  { lengthMin: 5, upPct: 39 },
  { lengthMin: 15, upPct: 71 },
  { lengthMin: 1, upPct: 28 },
  { lengthMin: 5, upPct: 54 },
];

const CB_CANDLES = "https://api.exchange.coinbase.com/products/BTC-USD/candles?granularity=300";

export function LandingPage() {
  const reduced = useReducedMotion();
  return (
    <div className={`pl${reduced ? " reduce" : ""}`} id="pulse-welcome">
      <HeroShader reduced={reduced} />
      <div className="pl-grain" aria-hidden />
      <div className="pl-wrap">
        <header className="pl-bar">
          <a className="pl-wordmark" href="#top">
            {COPY.wordmark}
            <i>.</i>
          </a>
          <p className="pl-disclaimer">{COPY.disclaimer}</p>
          <Link to="/" className="pl-btn pl-header-cta">
            {COPY.cta}
          </Link>
        </header>
        <Hero />
        <How />
        <PriceLine reduced={reduced} />
        <Markets />
        <ShareRail reduced={reduced} />
        <Demo />
        <CloseCta />
        <footer className="pl-foot">
          <p>{COPY.disclaimerLoud}</p>
          <p>{COPY.footerNote}</p>
          <Link to="/">{COPY.footerLink}</Link>
        </footer>
      </div>
    </div>
  );
}

function Hero() {
  const tick = useBtcTicker();
  const live = tick.status === "live";
  return (
    <section className="pl-hero" id="top" data-copy="hero">
      <p className="pl-kicker">{COPY.heroKicker}</p>
      <h1>
        {COPY.heroBefore}
        <span className="up">{COPY.heroUp}</span>
        {COPY.heroMid}
        <span className="down">{COPY.heroDown}</span>
        {COPY.heroEnd}
      </h1>
      <p className="pl-hero-sub">{COPY.heroSub}</p>
      <div
        className={`pl-ticker${live ? "" : " is-stale"}`}
        aria-live="polite"
        aria-label="Live Bitcoin price"
      >
        <span className="dot" aria-hidden />
        <span className="label">BTC</span>
        <span>{tick.price != null ? `$${formatPrice(tick.price)}` : "—"}</span>
      </div>
      <div className="pl-actions">
        <Link to="/" className="pl-btn">
          {COPY.cta}
        </Link>
        <p className="pl-disclaimer">{COPY.disclaimer}</p>
      </div>
    </section>
  );
}

function How() {
  return (
    <section className="pl-how pl-section" id="how" data-copy="how-it-works">
      <div className="pl-how-grid">
        <div className="pl-how-sticky">
          <p className="pl-kicker">{COPY.howKicker}</p>
          <h2>{COPY.howTitle}</h2>
        </div>
        <ol className="pl-steps">
          {COPY.steps.map((step) => (
            <Step key={step.num} step={step} />
          ))}
        </ol>
      </div>
    </section>
  );
}

function Step({ step }: { step: (typeof COPY.steps)[number] }) {
  const ref = useRef<HTMLLIElement>(null);
  useReveal(ref);
  return (
    <li ref={ref} className="pl-step">
      <p className="pl-kicker">
        <span className="pl-step-num">{step.num}</span> {step.kicker}
      </p>
      <h3>{step.title}</h3>
      <p>{step.body}</p>
    </li>
  );
}

function PriceLine({ reduced }: { reduced: boolean }) {
  const [path, setPath] = useState<{ line: string; fill: string; live: boolean }>({
    line: ILLUS_PATH,
    fill: ILLUS_FILL,
    live: false,
  });
  const lineRef = useRef<SVGPathElement>(null);
  const fillRef = useRef<SVGPathElement>(null);
  const chartRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    let dead = false;
    void fetch(CB_CANDLES, { cache: "no-store" })
      .then(async (r) => {
        if (!r.ok) throw new Error("http");
        const rows = (await r.json()) as number[][];
        const closes = rows
          .map((row) => ({ t: row[0], c: row[4] }))
          .filter((p) => Number.isFinite(p.t) && Number.isFinite(p.c))
          .sort((a, b) => a.t - b.t)
          .slice(-180)
          .map((p) => p.c);
        const drawn = pathFromValues(closes, 1200, 400);
        if (!dead && drawn) setPath({ ...drawn, live: true });
      })
      .catch(() => {
        /* keep the illustration path */
      });
    return () => {
      dead = true;
    };
  }, []);

  useEffect(() => {
    const chart = chartRef.current;
    const line = lineRef.current;
    const fill = fillRef.current;
    if (!chart || !line) return;
    const len = line.getTotalLength();
    line.style.strokeDasharray = String(len);
    if (reduced) {
      line.style.strokeDashoffset = "0";
      if (fill) fill.style.opacity = "1";
      return;
    }
    line.style.strokeDashoffset = String(len);
    if (fill) fill.style.opacity = "0";
    let raf = 0;
    const update = () => {
      const rect = chart.getBoundingClientRect();
      const vh = window.innerHeight;
      const start = vh * 0.75;
      const end = vh - rect.height * 0.5;
      const p = Math.min(1, Math.max(0, (start - rect.top) / Math.max(1, start - end)));
      line.style.strokeDashoffset = String(len * (1 - p));
      if (fill) fill.style.opacity = String(p);
    };
    const onScroll = () => {
      window.cancelAnimationFrame(raf);
      raf = window.requestAnimationFrame(update);
    };
    update();
    window.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("resize", onScroll);
    return () => {
      window.cancelAnimationFrame(raf);
      window.removeEventListener("scroll", onScroll);
      window.removeEventListener("resize", onScroll);
    };
  }, [path, reduced]);

  return (
    <section className="pl-price-line pl-section" id="settle" data-copy="price-line">
      <p className="pl-kicker">{COPY.settleKicker}</p>
      <h2>{COPY.settleTitle}</h2>
      <p className="pl-kicker note">{path.live ? COPY.settleNoteLive : COPY.settleNoteIllus}</p>
      <div className="pl-chart" id="price-line" ref={chartRef}>
        <svg viewBox="0 0 1200 400" preserveAspectRatio="none" aria-hidden>
          <defs>
            <linearGradient id="pl-pulseFade" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0" stopColor="#e83d43" stopOpacity="0.28" />
              <stop offset="1" stopColor="#e83d43" stopOpacity="0" />
            </linearGradient>
          </defs>
          <path ref={fillRef} d={path.fill} fill="url(#pl-pulseFade)" />
          <path ref={lineRef} className="pl-btc-path" d={path.line} />
        </svg>
      </div>
    </section>
  );
}

function Markets() {
  const [markets, setMarkets] = useState<MarketSnap[] | null>(null);

  useEffect(() => {
    let dead = false;
    void getPulse()
      .then((snap) => {
        if (!dead) setMarkets(snap.markets ?? []);
      })
      .catch(() => {
        if (!dead) setMarkets([]);
      });
    return () => {
      dead = true;
    };
  }, []);

  return (
    <section className="pl-markets pl-section" id="markets" data-copy="markets">
      <p className="pl-kicker">{COPY.marketsKicker}</p>
      <h2>{COPY.marketsTitle}</h2>
      <p className="pl-lead">{COPY.marketsLead}</p>
      <div className="pl-market-grid">
        {LENGTHS.map((len) => (
          <MarketCard
            key={len}
            length={len}
            market={markets?.find((m) => m.lengthMin === len && m.status !== "settled") ?? null}
            ready={markets != null}
          />
        ))}
      </div>
    </section>
  );
}

function MarketCard({
  length,
  market,
  ready,
}: {
  length: LengthMin;
  market: MarketSnap | null;
  ready: boolean;
}) {
  const ref = useRef<HTMLAnchorElement>(null);
  useReveal(ref);
  const total = market ? market.upPool + market.downPool : 0;
  const live = ready && market != null && total > 0;
  const upPct = live ? Math.round((market.upPool / total) * 100) : ILLUS_UP[length];
  const spark = sparkFromSamples(market?.samples) ?? ILLUS_SPARK[length];
  return (
    <Link ref={ref} to="/" className="pl-card">
      <div className="pl-card-top">
        <h3>{length}M</h3>
        <p className="pl-kicker">{COPY.marketLabel[length]}</p>
      </div>
      <svg className="pl-spark" viewBox="0 0 200 42" aria-hidden>
        <path d={spark} />
      </svg>
      <div className="pl-bar" aria-hidden>
        <span style={{ width: `${upPct}%` }} />
      </div>
      <div className="pl-bar-legend">
        <span className="u">UP {upPct}%</span>
        <span className="d">DOWN {100 - upPct}%</span>
      </div>
      <p className="pl-illus">{live ? COPY.crowdLive : COPY.crowdIllus}</p>
    </Link>
  );
}

function ShareRail({ reduced }: { reduced: boolean }) {
  const section = useRef<HTMLElement>(null);
  const track = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const root = section.current;
    const row = track.current;
    if (!root || !row || reduced) return;
    let raf = 0;
    const update = () => {
      const rect = root.getBoundingClientRect();
      const vh = window.innerHeight;
      const span = Math.max(1, rect.height - vh);
      const p = Math.min(1, Math.max(0, -rect.top / span));
      const max = Math.max(0, row.scrollWidth - root.clientWidth);
      row.style.transform = `translate3d(${-max * p}px,0,0)`;
    };
    const onScroll = () => {
      window.cancelAnimationFrame(raf);
      raf = window.requestAnimationFrame(update);
    };
    update();
    window.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("resize", onScroll);
    return () => {
      window.cancelAnimationFrame(raf);
      window.removeEventListener("scroll", onScroll);
      window.removeEventListener("resize", onScroll);
    };
  }, [reduced]);

  return (
    <section ref={section} className="pl-shares" id="shares" data-copy="share-reel">
      <div className="pl-shares-pin">
        <div className="pl-shares-head">
          <p className="pl-kicker">{COPY.sharesKicker}</p>
          <h2>{COPY.sharesTitle}</h2>
          <p className="pl-lead">{COPY.sharesLead}</p>
        </div>
        <div className="pl-track-wrap">
          <div ref={track} className="pl-track">
            {SHARES.map((card, i) => {
              const upWins = card.upPct >= 50;
              return (
                <article
                  key={`${card.lengthMin}-${i}`}
                  className={`pl-share ${upWins ? "is-win" : "is-loss"}`}
                >
                  <p className="tag">{card.lengthMin}M · example</p>
                  <h3>{upWins ? "UP takes it." : "DOWN takes it."}</h3>
                  <div className="pl-bar" aria-hidden>
                    <span style={{ width: `${card.upPct}%` }} />
                  </div>
                  <div className="pl-bar-legend">
                    <span className="u">UP pot</span>
                    <span className="d">DOWN pot</span>
                  </div>
                  <p className="pl-illus">{COPY.shareIllus}</p>
                </article>
              );
            })}
          </div>
        </div>
      </div>
    </section>
  );
}

function Demo() {
  return (
    <section className="pl-demo pl-section" id="demo" data-copy="demo">
      <p className="pl-badge">{COPY.demoBadge}</p>
      <h2>{COPY.demoTitle}</h2>
      <p className="pl-lead">{COPY.demoLead}</p>
      <Link to="/" className="pl-btn pl-btn-ghost">
        {COPY.demoCta}
      </Link>
    </section>
  );
}

function CloseCta() {
  return (
    <section className="pl-end pl-section" id="call" data-copy="final-cta">
      <p className="pl-kicker">{COPY.endKicker}</p>
      <h2>{COPY.endTitle}</h2>
      <div className="pl-actions">
        <Link to="/" className="pl-btn">
          {COPY.cta}
        </Link>
        <p className="pl-disclaimer">{COPY.disclaimer}</p>
      </div>
    </section>
  );
}

function useReveal(ref: RefObject<HTMLElement | null>) {
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const io = new IntersectionObserver(
      (entries) => {
        for (const e of entries) if (e.isIntersecting) el.classList.add("pl-in");
      },
      { threshold: 0.25 },
    );
    io.observe(el);
    return () => io.disconnect();
  }, [ref]);
}

function pathFromValues(
  values: number[],
  w: number,
  h: number,
): { line: string; fill: string } | null {
  if (values.length < 2) return null;
  const min = Math.min(...values);
  const max = Math.max(...values);
  const span = Math.max(max - min, 1e-6);
  const pad = 24;
  const pts = values.map((v, i) => {
    const x = (i / (values.length - 1)) * w;
    const y = pad + (1 - (v - min) / span) * (h - pad * 2);
    return [x, y] as const;
  });
  const line = pts
    .map(([x, y], i) => `${i === 0 ? "M" : "L"}${x.toFixed(1)},${y.toFixed(1)}`)
    .join(" ");
  const fill = `${line} L${w},${h} L0,${h} Z`;
  return { line, fill };
}

function sparkFromSamples(samples: number[] | undefined): string | null {
  if (!samples || samples.length < 2) return null;
  const drawn = pathFromValues(samples, 200, 42);
  return drawn?.line ?? null;
}

/** Moving red field from the landing mockup. CSS gradient is the fallback. */
function HeroShader({ reduced }: { reduced: boolean }) {
  const ref = useRef<HTMLCanvasElement>(null);
  const [live, setLive] = useState(false);

  useEffect(() => {
    const canvas = ref.current;
    if (!canvas) return;
    const gl = canvas.getContext("webgl", {
      antialias: false,
      alpha: false,
      premultipliedAlpha: false,
    });
    if (!gl) return;

    const vsSrc = "attribute vec2 a;void main(){gl_Position=vec4(a,0,1);}";
    const fsSrc = [
      "precision highp float;",
      "uniform vec2 r;uniform float t;",
      "void main(){",
      " vec2 uv=gl_FragCoord.xy/r; vec2 p=uv*2.0-1.0; p.x*=r.x/max(r.y,1.0);",
      " float n=0.0; float time=t*0.12;",
      " n+=sin(p.x*2.1+time)*cos(p.y*1.4-time*0.7);",
      " n+=sin(length(p+vec2(sin(time),cos(time*0.6)))*3.0-time*1.3)*0.55;",
      " n+=sin((p.x+p.y)*1.8-time)*0.35;",
      " vec3 bg=vec3(0.031,0.031,0.031);",
      " vec3 deep=vec3(0.49,0.125,0.157);",
      " vec3 red=vec3(0.91,0.239,0.263);",
      " vec3 col=mix(bg,deep,0.32+0.38*n);",
      " col=mix(col,red,smoothstep(0.35,1.0,n)*0.42);",
      " col*=1.0-dot(p*0.38,p*0.38);",
      " gl_FragColor=vec4(col,1.0);",
      "}",
    ].join("");

    const compile = (type: number, src: string) => {
      const s = gl.createShader(type);
      if (!s) return null;
      gl.shaderSource(s, src);
      gl.compileShader(s);
      return s;
    };
    const vs = compile(gl.VERTEX_SHADER, vsSrc);
    const fs = compile(gl.FRAGMENT_SHADER, fsSrc);
    const prog = gl.createProgram();
    if (!vs || !fs || !prog) return;
    gl.attachShader(prog, vs);
    gl.attachShader(prog, fs);
    gl.linkProgram(prog);
    if (!gl.getProgramParameter(prog, gl.LINK_STATUS)) return;
    gl.useProgram(prog);

    const buf = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, buf);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 3, -1, -1, 3]), gl.STATIC_DRAW);
    const loc = gl.getAttribLocation(prog, "a");
    gl.enableVertexAttribArray(loc);
    gl.vertexAttribPointer(loc, 2, gl.FLOAT, false, 0, 0);
    const uR = gl.getUniformLocation(prog, "r");
    const uT = gl.getUniformLocation(prog, "t");

    let raf = 0;
    const start = performance.now();
    let frozen = 0;
    const size = () => {
      const dpr = Math.min(window.devicePixelRatio || 1, 1.75);
      const w = Math.max(1, Math.floor(window.innerWidth * dpr));
      const h = Math.max(1, Math.floor(window.innerHeight * dpr));
      if (canvas.width !== w || canvas.height !== h) {
        canvas.width = w;
        canvas.height = h;
        gl.viewport(0, 0, w, h);
      }
    };
    const frame = (now: number) => {
      size();
      const t = reduced ? frozen : (now - start) / 1000;
      if (reduced && !frozen) frozen = t;
      gl.uniform2f(uR, canvas.width, canvas.height);
      gl.uniform1f(uT, t);
      gl.drawArrays(gl.TRIANGLES, 0, 3);
      if (!reduced) raf = window.requestAnimationFrame(frame);
    };
    setLive(true);
    size();
    raf = window.requestAnimationFrame(frame);
    const onResize = () => {
      if (reduced) raf = window.requestAnimationFrame(frame);
    };
    window.addEventListener("resize", onResize, { passive: true });
    return () => {
      window.cancelAnimationFrame(raf);
      window.removeEventListener("resize", onResize);
      gl.getExtension("WEBGL_lose_context")?.loseContext();
    };
  }, [reduced]);

  return (
    <div className={`pl-shader${live ? " is-live" : ""}`} aria-hidden>
      <canvas ref={ref} />
    </div>
  );
}
