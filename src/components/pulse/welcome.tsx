import { useEffect, useRef, useState } from "react";
import { signIn } from "@/lib/auth/client";
import { useCurrentUserState } from "@/lib/auth/use-current-user";
import { claimUsername, saveAvatar } from "@/lib/pulse/api";
import { demoPulse, demoSetAvatar, demoSetUsername, isDemoOn } from "@/lib/pulse/demo";
import { useReducedMotion } from "@/lib/pulse/telegram";
import { AVATARS, type AvatarId } from "@/lib/pulse/types";
import { BUSTS } from "@/lib/pulse/dustbust";

const BEATS = [
  { n: "01 / 03", title: "Watch the\nprice.", body: "BTC, live. A new market every 1, 5 or 15 minutes." },
  { n: "02 / 03", title: "Make your\ncall.", body: "Up or down. Put points on your read." },
  { n: "03 / 03", title: "See who\nwas right.", body: "Clock hits zero. The right side splits the pool." },
] as const;

type Screen = "land" | "explainer" | "signin" | "email" | "username" | "avatar" | "landed";

const AVATAR_KEY = "pulse-avatar";
const lowEnd = () => typeof navigator !== "undefined" && (navigator.hardwareConcurrency ?? 8) <= 4;

export function Welcome({ onDone }: { onDone: () => void }) {
  const reduced = useReducedMotion();
  const { user } = useCurrentUserState();
  const [screen, setScreen] = useState<Screen>("land");
  const [beat, setBeat] = useState(0);
  const [name, setName] = useState("");
  const [err, setErr] = useState("");
  const [busy, setBusy] = useState(false);
  const [note, setNote] = useState("");
  const [booted, setBooted] = useState(false);
  const [tapped, setTapped] = useState(false);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const fxRef = useRef<HTMLCanvasElement>(null);
  const logoRef = useRef<SVGSVGElement>(null);
  const appRef = useRef<HTMLDivElement>(null);
  const fieldRef = useRef<Field | null>(null);
  const screenRef = useRef(screen);
  screenRef.current = screen;

  useEffect(() => {
    try {
      if (sessionStorage.getItem("pulse-intro-user") === "1") setScreen("username");
    } catch {
      /* ignore */
    }
  }, []);

  useEffect(() => {
    let dead = false;
    let stop = () => {};
    void Promise.all([import("@/lib/pulse/motion"), import("@/lib/pulse/logo-points")]).then(([motion, logo]) => {
      const canvas = canvasRef.current;
      if (dead || !canvas) return;
      motion.setReduced(reduced);
      const field = new motion.ButterflyField(reduced ? 480 : lowEnd() ? 1200 : 2000) as unknown as Field;
      fieldRef.current = field;
      field.mount(canvas);
      const L = logoRef.current?.getBoundingClientRect();
      const A = appRef.current?.getBoundingClientRect();
      if (L && A) field.logoRect = { x: L.left - A.left, y: L.top - A.top, w: L.width, h: L.height };
      field.logoPts = logo.LOGO_PTS;
      field.mode = "logo";
      field.opacity = 0;
      field.drift = 0;
      const heads = makeHeads();
      // Demo Mode: heads mirror the live crowd split (share calling UP on the 15M market).
      let share: number | null = null;
      let lastShare = 0;
      stop = motion.watch((t: number, dt: number) => {
        field.update(t, dt);
        field.render();
        if (isDemoOn() && t - lastShare > 1000) {
          lastShare = t;
          const m = demoPulse().market;
          const tot = m ? m.upPool + m.downPool : 0;
          share = tot ? m!.upPool / tot : null;
        }
        drawHeads(fxRef.current, field, heads, t, share);
      });
      setBooted(true);
    });
    return () => {
      dead = true;
      fieldRef.current = null;
      stop();
    };
  }, [reduced]);

  // Real tap: the crisp logo hands over to its own particles, they burst into the butterfly,
  // which flies off to the right and comes back as a faint background behind the explainer.
  async function tapLogo() {
    if (tapped) return;
    setTapped(true);
    const field = fieldRef.current;
    const pose = (f: Field) => {
      Object.assign(f.pose, { cx: 0.5, cy: 0.34, size: Math.min(150, f.w * 0.4), yaw: -0.32, pitch: 0.45, roll: 0.1 });
      Object.assign(f.flap, { period: 600, amp: 0.62, base: 0.28 });
      f.drift = 0.25;
      f.mode = "fly";
      f.shape = "fly";
    };
    if (!field || reduced) {
      if (field) {
        pose(field);
        field.form({ from: "scatter", dur: 0, stagger: 0 });
        field.finish();
        void field.setBackground(true, 0);
        void field.setPose({ cx: 0.84, cy: 0.18, size: Math.min(210, field.w * 0.54) }, 0);
        void field.setOpacity(1, 0);
      }
      setScreen("explainer");
      return;
    }
    const motion = await import("@/lib/pulse/motion");
    await field.setOpacity(1, 180);
    field.ripple(0.6);
    await motion.wait(320);
    pose(field);
    field.form({ from: "current", dur: 1100, stagger: 500 });
    await motion.wait(2000);
    await field.flyTo(1.18, 0.28, Math.min(150, field.w * 0.4), 1400);
    void field.setBackground(true, 700);
    field.setFlap({ period: 1700, amp: 0.5 }, 800);
    field.drift = 0.9;
    void field.setPose({ cx: 0.84, cy: 0.18, size: Math.min(210, field.w * 0.54), yaw: -0.4, roll: 0.12 }, 900);
    if (screenRef.current === "land") setScreen("explainer");
  }

  useEffect(() => {
    const field = fieldRef.current;
    if (!field || !booted) return;
    const d = reduced ? 0 : 1;
    if (screen === "signin" || screen === "email") {
      field.globeCx = 0.82;
      field.globeCy = 0.16;
      field.globeR = Math.min(130, field.w * 0.33);
      field.headsOff = false;
      if (field.mode !== "globe") {
        void field.setOpacity(0.4, 700 * d);
        void field.toGlobe(1300 * d, 850 * d);
      }
    } else if (screen === "explainer") {
      if (field.mode === "globe") {
        field.headsOff = true;
        void field.toFly(1100 * d, 500 * d);
      }
    } else if (screen !== "land") {
      field.headsOff = true;
      void field.setOpacity(0, 500 * d);
    }
  }, [booted, reduced, screen]);

  useEffect(() => {
    if (screen !== "username" || name || !user?.displayName) return;
    const raw = user.displayName.replace(/[^a-zA-Z0-9_]/g, "").slice(0, 16);
    if (raw.length >= 3) setName(raw);
  }, [name, screen, user]);

  function skip() {
    try {
      sessionStorage.removeItem("pulse-intro-user");
    } catch {
      /* ignore */
    }
    onDone();
  }

  function finish(avatar: AvatarId) {
    try {
      localStorage.setItem(AVATAR_KEY, avatar);
      sessionStorage.removeItem("pulse-intro-user");
    } catch {
      /* ignore */
    }
    if (user) void saveAvatar({ data: { avatar } }).catch(() => {});
    if (isDemoOn()) { demoSetAvatar(avatar); demoSetUsername(name); }
    setScreen("landed");
    window.setTimeout(onDone, reduced ? 400 : 2200);
  }

  return (
    <div data-intro-cover className="pi">
      <div className="pi-app" ref={appRef}>
        <canvas ref={canvasRef} className="pi-field" aria-hidden />
        <canvas ref={fxRef} className="pi-field" aria-hidden />

        {screen === "land" ? (
          <section className="screen s-land" aria-label="Welcome" onClick={() => void tapLogo()}>
            <div className="topbar">
              <span />
              <button type="button" className="skip" onClick={(e) => { e.stopPropagation(); setScreen("signin"); }}>
                SKIP
              </button>
            </div>
            <div className="spacer" />
            <svg
              ref={logoRef}
              className="pi-logo"
              viewBox="0 0 320 200"
              aria-label="Pulse"
              style={{ opacity: tapped ? 0 : 1, transition: "opacity 260ms ease 180ms" }}
            >
              <path d="M70 70 H128 L138 46 L150 98 L162 30 L174 84 L182 70 H250" fill="none" stroke="#F2F2F2" strokeWidth="5" strokeLinejoin="miter" />
              <text x="160" y="150" textAnchor="middle" fill="#F2F2F2" fontFamily="var(--font-display, sans-serif)" fontSize="44" fontWeight="700" letterSpacing="6">PULSE</text>
              <rect x="236" y="122" width="14" height="14" fill="#E5484D" />
            </svg>
            <div className="spacer" />
            <p className="mono tap" style={{ opacity: tapped ? 0 : 1, transition: "opacity 300ms" }}>TAP THE LOGO</p>
            <div style={{ height: 40 }} />
            <p className="footer">POINTS HAVE NO CASH VALUE.</p>
          </section>
        ) : null}

        {screen === "explainer" ? (
          <Explainer beat={beat} onBeat={setBeat} onEnter={() => setScreen("signin")} onSkip={() => setScreen("signin")} />
        ) : null}

        {screen === "signin" || screen === "email" ? (
          <SignStep
            note={note}
            sent={screen === "email"}
            onSkip={skip}
            onGuest={skip}
            onEmail={() => {
              setScreen("email");
              window.setTimeout(() => {
                if (screenRef.current === "email") setScreen("username");
              }, reduced ? 0 : 1800);
            }}
            onTelegram={() => setScreen("username")}
            onGoogle={() => {
              try {
                sessionStorage.setItem("pulse-intro-user", "1");
              } catch {
                /* ignore */
              }
              setNote("");
              void signIn("grok-google", { callbackURL: "/" })
                .then(() => setScreen("username"))
                .catch(() => setNote("SIGN-IN DID NOT FINISH."));
            }}
          />
        ) : null}

        {screen === "username" ? (
          <section className="screen s-username" aria-label="Choose a name">
            <div className="topbar">
              <span className="mark">PULSE</span>
              <button type="button" className="skip" onClick={skip}>
                SKIP
              </button>
            </div>
            <div className="spacer" />
            <form
              className="un-form"
              autoComplete="off"
              onSubmit={(event) => {
                event.preventDefault();
                if (name.length < 3 || busy) return;
                if (!user) {
                  setScreen("avatar");
                  return;
                }
                setBusy(true);
                setErr("");
                void claimUsername({ data: { username: name } })
                  .then((res) => {
                    setBusy(false);
                    if (!res.ok) {
                      setErr(res.reason === "taken" ? "TAKEN. TRY ANOTHER." : "THREE CHARACTERS, AT LEAST.");
                      return;
                    }
                    setName(res.username);
                    setScreen("avatar");
                  })
                  .catch(() => {
                    setBusy(false);
                    setErr("COULD NOT SAVE THAT NAME.");
                  });
              }}
            >
              <h1 className="md">
                What does
                <br />
                the crowd
                <br />
                call you?
              </h1>
              <label className="field">
                <span>@</span>
                <input
                  value={name}
                  maxLength={16}
                  autoCapitalize="off"
                  autoCorrect="off"
                  spellCheck={false}
                  aria-label="Username"
                  placeholder="yourname"
                  onChange={(event) => {
                    setName(event.target.value.replace(/[^a-zA-Z0-9_]/g, "").slice(0, 16));
                    setErr("");
                  }}
                />
              </label>
              <p className="err" aria-live="polite">
                {err}
              </p>
              <button type="submit" className="btn solid" disabled={name.length < 3 || busy}>
                THAT&apos;S ME<span className="ar">→</span>
              </button>
            </form>
            <div style={{ height: 28 }} />
          </section>
        ) : null}

        {screen === "avatar" || screen === "landed" ? (
          <AvatarPick name={name} landed={screen === "landed"} reduced={reduced} onPick={finish} />
        ) : null}
      </div>
    </div>
  );
}

function AvatarPick({
  name,
  landed,
  reduced,
  onPick,
}: {
  name: string;
  landed: boolean;
  reduced: boolean;
  onPick: (a: AvatarId) => void;
}) {
  const [sel, setSel] = useState<AvatarId>("hood");
  const [glow, setGlow] = useState<"up" | "down">("up");
  const bigRef = useRef<HTMLCanvasElement>(null);
  const tileRefs = useRef<(HTMLCanvasElement | null)[]>([]);
  const bigBust = useRef<{ setTint: (s: string) => void } | null>(null);
  useEffect(() => {
    let dead = false;
    let stop = () => {};
    void Promise.all([import("@/lib/pulse/motion"), import("@/lib/pulse/dustbust")]).then(([motion, dust]) => {
      if (dead || !bigRef.current) return;
      const big = new dust.DustBust(bigRef.current, sel, { n: reduced ? 6000 : lowEnd() ? 14000 : 22000, seed: 7 });
      big.setTint(glow);
      bigBust.current = big;
      const tiles = AVATARS.map((id, i) => {
        const c = tileRefs.current[i];
        return c ? new dust.DustBust(c, id, { n: 2500, seed: 3 + i, dot: 2.2 }) : null;
      });
      let drewTiles = false;
      stop = motion.watch((t: number) => {
        big.render(reduced ? 0 : t);
        if (!reduced || !drewTiles) for (const tile of tiles) tile?.render(reduced ? 0 : t);
        drewTiles = true;
      });
    });
    return () => {
      dead = true;
      stop();
    };
  }, [sel, reduced]);
  useEffect(() => bigBust.current?.setTint(glow), [glow]);
  const label = BUSTS.find((b: { id: string }) => b.id === sel)?.name ?? "";
  return (
    <section className="screen s-avatar" aria-label="Pick an avatar">
      <div className="topbar">
        <span className="mark">PULSE</span>
        <span className="mono" style={{ fontSize: 11, opacity: 0.6 }}>@{name.toUpperCase()}</span>
      </div>
      <h1 className="md" style={{ marginTop: 8 }}>
        Pick your
        <br />
        face.
      </h1>
      <div style={{ position: "relative", height: 260, margin: "6px auto 0", width: 260 }}>
        <canvas ref={bigRef} width={256} height={256} style={{ width: 260, height: 260 }} aria-label={label} />
      </div>
      <p className="mono" style={{ textAlign: "center", fontSize: 12, letterSpacing: ".12em" }}>{label}</p>
      <div className="seg" role="radiogroup" aria-label="Preview glow" style={{ display: "flex", gap: 6, justifyContent: "center", margin: "6px 0" }}>
        {(["up", "down"] as const).map((g) => (
          <button key={g} type="button" className={`chip${glow === g ? " on" : ""}`} aria-pressed={glow === g} onClick={() => setGlow(g)}>
            {g === "up" ? "CALLED UP" : "CALLED DOWN"}
          </button>
        ))}
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(5,1fr)", gap: 6 }}>
        {AVATARS.map((id, i) => (
          <button
            key={id}
            type="button"
            aria-label={id}
            aria-pressed={sel === id}
            onClick={() => setSel(id)}
            style={{ border: `1px solid ${sel === id ? "#F2F2F2" : "#2A2A2A"}`, background: "#0B0B0B", padding: 2 }}
          >
            <canvas ref={(el) => { tileRefs.current[i] = el; }} width={256} height={256} style={{ width: "100%", aspectRatio: "1" }} />
          </button>
        ))}
      </div>
      <div className="spacer" />
      {landed ? (
        <div className="un-done">
          <p className="mono">@{name.toUpperCase()}</p>
          <h1>
            Welcome in.
            <br />
            10,000 pts to start.
          </h1>
        </div>
      ) : (
        <button type="button" className="btn solid" onClick={() => onPick(sel)}>
          THAT&apos;S MY FACE<span className="ar">→</span>
        </button>
      )}
      <div style={{ height: 28 }} />
    </section>
  );
}

type Head = { th: number; ph: number; flip: number; s: number };
function makeHeads(): Head[] {
  let seed = 9;
  const R = () => {
    seed = (seed * 16807) % 2147483647;
    return seed / 2147483647;
  };
  return Array.from({ length: 22 }, () => ({ th: R() * 6.28, ph: (R() - 0.5) * 1.4, flip: R() * 3000, s: 3 + R() * 1.8 }));
}
function drawHeads(c: HTMLCanvasElement | null, field: Field, heads: Head[], t: number, share: number | null = null) {
  if (!c) return;
  const g = c.getContext("2d");
  if (!g) return;
  const dpr = Math.min(2, window.devicePixelRatio || 1);
  const r = c.getBoundingClientRect();
  if (c.width !== Math.round(r.width * dpr)) {
    c.width = Math.round(r.width * dpr);
    c.height = Math.round(r.height * dpr);
  }
  g.setTransform(1, 0, 0, 1, 0, 0);
  g.clearRect(0, 0, c.width, c.height);
  if (field.mode !== "globe" || field.headsOff) return;
  g.setTransform(dpr, 0, 0, dpr, 0, 0);
  g.globalAlpha = 0.85;
  const cx = field.globeCx * field.w, cy = field.globeCy * field.h, R0 = field.globeR || 150, tilt = 0.42, yaw = t * 0.00035;
  for (const h of heads) {
    const th = h.th + yaw;
    const x = Math.cos(th) * Math.cos(h.ph), y = Math.sin(h.ph), z = Math.sin(th) * Math.cos(h.ph);
    const y2 = y * Math.cos(tilt) - z * Math.sin(tilt), z2 = y * Math.sin(tilt) + z * Math.cos(tilt);
    if (z2 < 0.05) continue;
    const k = 3.2 / (3.2 + z2), px = cx + x * R0 * k, py = cy + y2 * R0 * k, s = h.s * k;
    const i = heads.indexOf(h);
    // occasional head "changes its mind" so the globe still flickers
    const blink = ((((t + h.flip) / 1700) | 0) % 6) === 0;
    const up = share == null ? (((t + h.flip) / 420) | 0) % 2 === 0 : (i / heads.length < share) !== blink;
    g.fillStyle = up ? "#A8E63A" : "#7D2028";
    g.fillRect(px - s / 2, py - s, s, s);
    g.fillRect(px - s, py - s * 2.4, s * 2, s * 1.3);
  }
  g.globalAlpha = 1;
}

type Field = {
  w: number;
  h: number;
  pose: { cx: number; cy: number; size: number; yaw: number; pitch: number; roll: number };
  flap: { period: number; amp: number; base: number };
  opacity: number;
  drift: number;
  mode: string;
  shape: string;
  logoRect?: { x: number; y: number; w: number; h: number };
  logoPts?: [number, number][];
  globeCx: number;
  globeCy: number;
  globeR: number;
  headsOff?: boolean;
  mount: (canvas: HTMLCanvasElement) => void;
  update: (t: number, dt: number) => void;
  render: () => void;
  ripple: (k: number) => void;
  form: (opts: { from: string; dur: number; stagger: number }) => void;
  finish: () => void;
  toGlobe: (dur?: number, stagger?: number) => Promise<unknown>;
  toFly: (dur?: number, stagger?: number) => Promise<unknown>;
  setFlap: (f: { period: number; amp: number }, dur?: number) => void;
  setBackground: (on: boolean, dur?: number) => Promise<unknown>;
  setOpacity: (a: number, dur?: number) => Promise<unknown>;
  setPose: (pose: Partial<{ cx: number; cy: number; size: number; yaw: number; roll: number }>, dur?: number) => Promise<unknown>;
  flyTo: (cx: number, cy: number, size: number, dur?: number) => Promise<unknown>;
};

function Explainer({
  beat,
  onBeat,
  onEnter,
  onSkip,
}: {
  beat: number;
  onBeat: (n: number) => void;
  onEnter: () => void;
  onSkip?: () => void;
}) {
  const startX = useRef<number | null>(null);
  const last = beat === 2;
  return (
    <section
      className="screen s-explainer"
      aria-label="How it works"
      onClick={() => {
        if (!last) onBeat(beat + 1);
      }}
      onTouchStart={(event) => {
        startX.current = event.touches[0]?.clientX ?? null;
      }}
      onTouchEnd={(event) => {
        if (startX.current == null) return;
        const dx = (event.changedTouches[0]?.clientX ?? startX.current) - startX.current;
        startX.current = null;
        if (dx < -40 && beat < 2) onBeat(beat + 1);
      }}
    >
      <div className="topbar">
        <span className="mark">PULSE</span>
        {onSkip ? (
          <button type="button" className="skip" onClick={(e) => { e.stopPropagation(); onSkip(); }}>
            SKIP
          </button>
        ) : null}
      </div>
      <div className="spacer" />
      <div key={beat} className="beat" aria-live="polite">
        <p className="num">{BEATS[beat].n}</p>
        <h1 style={{ whiteSpace: "pre-line" }}>{BEATS[beat].title}</h1>
        <p className="sub">{BEATS[beat].body}</p>
      </div>
      <div className="dots">
        {BEATS.map((row, i) => (
          <i key={row.n} className={i === beat ? "on" : undefined} />
        ))}
      </div>
      <div style={{ position: "relative", height: 52 }}>
        {last ? (
          <button
            type="button"
            className="btn solid fade200"
            style={{ position: "absolute", inset: 0 }}
            onClick={(event) => {
              event.stopPropagation();
              onEnter();
            }}
          >
            ENTER THE MARKET<span className="ar">→</span>
          </button>
        ) : (
          <p className="hint">TAP TO CONTINUE</p>
        )}
      </div>
      <div style={{ height: 28 }} />
    </section>
  );
}

function SignStep({
  note,
  sent,
  onSkip,
  onGuest,
  onGoogle,
  onTelegram,
  onEmail,
}: {
  note: string;
  sent: boolean;
  onSkip: () => void;
  onGuest: () => void;
  onGoogle: () => void;
  onTelegram: () => void;
  onEmail: () => void;
}) {
  return (
    <section className="screen s-signin" aria-label="Sign in" style={sent ? { animation: "none" } : undefined}>
      <div className="topbar">
        <span className="mark">PULSE</span>
        <button type="button" className="skip" onClick={onSkip}>
          SKIP
        </button>
      </div>
      <div className="head">
        <h1>
          Join the
          <br />
          crowd.
        </h1>
        <p className="mono sub">ONE NAME. EVERY MARKET.</p>
        {isDemoOn() ? <p className="mono sub" data-demo-crowd>DEMO · 1,000 PLAYERS ALREADY IN</p> : null}
      </div>
      {sent ? (
        <div className="sent">
          <b>CHECK YOUR INBOX.</b>
          <p className="sub">The link signs you in.</p>
        </div>
      ) : (
        <div className="stack">
          <button type="button" className="btn" onClick={onGoogle}>
            CONTINUE WITH GOOGLE<span className="ar">→</span>
          </button>
          <button type="button" className="btn" onClick={onTelegram}>
            CONTINUE WITH TELEGRAM<span className="ar">→</span>
          </button>
          <button type="button" className="btn" onClick={onEmail}>
            EMAIL ME A LINK<span className="ar">→</span>
          </button>
        </div>
      )}
      {note ? <p className="note">{note}</p> : null}
      <button type="button" className="link" style={{ alignSelf: "flex-start" }} onClick={onGuest}>
        LOOK AROUND FIRST
      </button>
      <div style={{ height: 20 }} />
      <p className="footer">POINTS HAVE NO CASH VALUE.</p>
    </section>
  );
}

export function ButterflyLoad({ tint, slow }: { tint: "none" | "up" | "down"; slow: boolean }) {
  const reduced = useReducedMotion();
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const fieldRef = useRef<{ setTint: (state: string, dur?: number) => void } | null>(null);
  const tintRef = useRef(tint);
  tintRef.current = tint;

  useEffect(() => {
    let dead = false;
    let stop = () => {};
    void import("@/lib/pulse/motion").then((motion) => {
      const canvas = canvasRef.current;
      if (dead || !canvas) return;
      motion.setReduced(reduced);
      const field = new motion.ButterflyField(reduced ? 480 : 2000);
      fieldRef.current = field;
      field.mount(canvas);
      Object.assign(field.pose, {
        cx: 0.5,
        cy: 0.3,
        size: Math.min(138, field.w * 0.36),
        yaw: -0.32,
        pitch: 0.45,
        roll: 0.1,
      });
      // same pose, flap and forming as the reference welcome (forms in ~1.95s)
      Object.assign(field.flap, { period: 600, amp: 0.62, base: 0.28 });
      field.opacity = 1;
      field.drift = 0.25;
      field.form({ from: "scatter", dur: reduced ? 0 : 1500, stagger: reduced ? 0 : 450 });
      if (tintRef.current !== "none") void field.setTint(tintRef.current, reduced ? 0 : 280);
      stop = motion.watch((t: number, dt: number) => {
        field.update(t, dt);
        field.render();
      });
    });
    return () => {
      dead = true;
      fieldRef.current = null;
      stop();
    };
  }, [reduced]);

  useEffect(() => {
    fieldRef.current?.setTint(tint, reduced ? 0 : 320);
  }, [reduced, tint]);

  return (
    <div data-intro-cover className="pi">
      <div className="pi-app">
        <canvas ref={canvasRef} className="pi-field" aria-hidden />
        {slow ? <p className="mono loading-note">STILL CONNECTING</p> : null}
        <p className="sr-only">Loading the live market.</p>
      </div>
    </div>
  );
}

export function LineReplay({ onClose }: { onClose: () => void }) {
  const [beat, setBeat] = useState(0);
  return (
    <div data-intro-cover className="pi">
      <div className="pi-app">
        <Explainer beat={beat} onBeat={setBeat} onEnter={onClose} onSkip={onClose} />
      </div>
    </div>
  );
}
