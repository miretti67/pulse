import { useEffect, useRef, useState } from "react";
import { signIn } from "@/lib/auth/client";
import { useCurrentUserState } from "@/lib/auth/use-current-user";
import { claimUsername } from "@/lib/pulse/api";
import { useReducedMotion } from "@/lib/pulse/telegram";

const BEATS = [
  { n: "01 / 03", title: "Watch the\nprice.", body: "BTC, live. A new market every 1, 5 or 15 minutes." },
  { n: "02 / 03", title: "Make your\ncall.", body: "Up or down. Put points on your read." },
  { n: "03 / 03", title: "See who\nwas right.", body: "Clock hits zero. The right side splits the pool." },
] as const;

type Screen = "welcome" | "explainer" | "signin" | "email" | "username" | "landed";

export function Welcome({ onDone }: { onDone: () => void }) {
  const reduced = useReducedMotion();
  const { user } = useCurrentUserState();
  const [screen, setScreen] = useState<Screen>("welcome");
  const [beat, setBeat] = useState(0);
  const [copyOn, setCopyOn] = useState(reduced);
  const [name, setName] = useState("");
  const [err, setErr] = useState("");
  const [busy, setBusy] = useState(false);
  const [note, setNote] = useState("");
  const [booted, setBooted] = useState(false);
  const canvasRef = useRef<HTMLCanvasElement>(null);
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
    void import("@/lib/pulse/motion").then((motion) => {
      const canvas = canvasRef.current;
      if (dead || !canvas) return;
      motion.setReduced(reduced);
      const field = new motion.ButterflyField(reduced ? 480 : 2000) as Field;
      fieldRef.current = field;
      field.mount(canvas);
      field.pose.cx = 0.5;
      field.pose.cy = 0.3;
      field.pose.size = Math.min(138, field.w * 0.36);
      field.pose.yaw = -0.32;
      field.pose.pitch = 0.45;
      field.pose.roll = 0.1;
      field.flap.period = 600;
      field.flap.amp = 0.62;
      field.flap.base = 0.28;
      field.opacity = 1;
      field.drift = 0.25;
      stop = motion.watch((t: number, dt: number) => {
        field.update(t, dt);
        field.render();
      });
      setBooted(true);
      if (reduced) {
        field.form({ from: "scatter", dur: 0, stagger: 0 });
        field.finish();
        setCopyOn(true);
        return;
      }
      // reference runWelcome(): dots gather 0 -> ~1.95s, then the copy reveals
      field.form({ from: "scatter", dur: 1500, stagger: 450 });
      window.setTimeout(() => {
        if (dead || screenRef.current !== "welcome") return;
        field.finish();
        setCopyOn(true);
      }, 1950);
    });
    return () => {
      dead = true;
      fieldRef.current = null;
      stop();
    };
  }, [reduced]);

  useEffect(() => {
    const field = fieldRef.current;
    if (!field || !booted) return;
    // The butterfly lives on the welcome screen only. Explainer, sign-in, email and username are
    // plain black: fade the field out as soon as we leave welcome (no background butterfly, no
    // fly-to/dissolve transition on landing).
    if (screen === "welcome") {
      void field.setOpacity(1, reduced ? 0 : 400);
      void field.setPose({ cx: 0.5, cy: 0.3, size: Math.min(138, field.w * 0.36) }, reduced ? 0 : 500);
      return;
    }
    void field.setOpacity(0, reduced ? 0 : 400);
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

  function land(handle: string) {
    setName(handle);
    setScreen("landed");
    window.setTimeout(onDone, reduced ? 400 : 2200);
  }

  const first = useRef(true);
  useEffect(() => {
    if (screen !== "welcome") first.current = false;
  }, [screen]);

  // Markup and classes mirror the reference screens one-to-one (see .pi in styles.css).
  return (
    <div data-intro-cover className="pi">
      <div className="pi-app">
        <canvas ref={canvasRef} className="pi-field" aria-hidden />

        {screen === "welcome" ? (
          <section
            className={`screen s-welcome${first.current ? " first" : ""}`}
            aria-label="Welcome"
            onClick={() => (copyOn ? setScreen("explainer") : setCopyOn(true))}
          >
            <div className="topbar">
              <span />
              <button type="button" className="skip" onClick={(e) => { e.stopPropagation(); setScreen("signin"); }}>
                SKIP
              </button>
            </div>
            <div className="spacer" />
            <div className={`copy${copyOn ? " on" : ""}`}>
              <div className="mark">PULSE</div>
              <h1>
                The crowd
                <br />
                has a pulse.
              </h1>
              <p className="sub">Bitcoin. A clock. Everyone&apos;s call.</p>
              <p className="mono tap">TAP TO CONTINUE</p>
            </div>
            <div style={{ height: 64 }} />
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

        {screen === "username" || screen === "landed" ? (
          <section className="screen s-username" aria-label="Choose a name">
            <div className="topbar">
              <span className="mark">PULSE</span>
              <button type="button" className="skip" onClick={skip}>
                SKIP
              </button>
            </div>
            <div className="spacer" />
            <form
              className={`un-form${screen === "landed" ? " out" : ""}`}
              autoComplete="off"
              onSubmit={(event) => {
                event.preventDefault();
                if (name.length < 3 || busy) return;
                if (!user) {
                  land(name);
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
                    land(res.username);
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
            {screen === "landed" ? (
              <div className="un-done">
                <p className="mono">@{name.toUpperCase()}</p>
                <h1>
                  Welcome in.
                  <br />
                  10,000 pts to start.
                </h1>
              </div>
            ) : null}
          </section>
        ) : null}
      </div>
    </div>
  );
}

type Field = {
  w: number;
  h: number;
  pose: { cx: number; cy: number; size: number; yaw: number; pitch: number; roll: number };
  flap: { period: number; amp: number; base: number };
  opacity: number;
  drift: number;
  mount: (canvas: HTMLCanvasElement) => void;
  update: (t: number, dt: number) => void;
  render: () => void;
  form: (opts: { from: string; dur: number; stagger: number }) => void;
  finish: () => void;
  setBackground: (on: boolean, dur?: number) => Promise<unknown>;
  setOpacity: (a: number, dur?: number) => Promise<unknown>;
  setPose: (pose: { cx: number; cy: number; size: number }, dur?: number) => Promise<unknown>;
  flyTo: (cx: number, cy: number, size: number, dur?: number) => Promise<unknown>;
  dissolve: (rect: { x: number; y: number; w: number; h: number }, opts: { dur: number; stagger: number }) => Promise<unknown>;
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
