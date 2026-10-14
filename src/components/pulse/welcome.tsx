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
      field.pose.size = Math.min(156, field.w * 0.42);
      field.pose.yaw = -0.32;
      field.pose.pitch = 0.45;
      field.pose.roll = 0.1;
      field.flap.period = 640;
      field.flap.amp = 0.58;
      field.flap.base = 0.28;
      field.opacity = 1;
      field.drift = 0.22;
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
      field.form({ from: "scatter", dur: 700, stagger: 180 });
      window.setTimeout(() => {
        if (dead || screenRef.current !== "welcome") return;
        field.form({ from: "scatter", dur: 1100, stagger: 280 });
      }, 900);
      window.setTimeout(() => {
        if (!dead && screenRef.current === "welcome") setCopyOn(true);
      }, 2100);
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
      void field.setPose({ cx: 0.5, cy: 0.3, size: Math.min(156, field.w * 0.42) }, reduced ? 0 : 500);
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

  return (
    <div data-intro-cover className="fixed inset-0 z-40 bg-bg text-fg">
      <canvas ref={canvasRef} className="pointer-events-none absolute inset-0 h-full w-full" aria-hidden />
      <div className="relative z-10 mx-auto flex h-full w-full max-w-[430px] flex-col px-5 pb-6 pt-[max(1.25rem,env(safe-area-inset-top))]">
        <div className="flex h-7 items-center justify-between">
          <span className="font-display text-lg tracking-tight">{screen === "welcome" ? "" : "PULSE"}</span>
          <button type="button" onClick={skip} className="font-mono text-meta tracking-[0.14em] text-secondary">
            SKIP
          </button>
        </div>

        {screen === "welcome" ? (
          <button type="button" onClick={() => (copyOn ? setScreen("explainer") : setCopyOn(true))} className="flex min-h-0 flex-1 flex-col text-left">
            <div className={`mt-auto transition-opacity duration-500 ${copyOn ? "opacity-100" : "opacity-0"}`}>
              <p className="font-display text-lg tracking-tight">PULSE</p>
              <h1 className="mt-5 max-w-[16rem] font-display text-[2.75rem] font-bold uppercase leading-[0.94] tracking-[-0.025em]">
                The crowd
                <br />
                has a pulse.
              </h1>
              <p className="mt-4 font-mono text-[12.5px] leading-relaxed text-secondary">Bitcoin. A clock. Everyone's call.</p>
              <p className="mt-9 font-mono text-meta tracking-[0.14em] text-secondary">TAP TO CONTINUE</p>
            </div>
            <span className="mt-10 font-mono text-[10px] tracking-[0.14em] text-secondary">POINTS HAVE NO CASH VALUE.</span>
          </button>
        ) : null}

        {screen === "explainer" ? (
          <Explainer beat={beat} onBeat={setBeat} onEnter={() => setScreen("signin")} />
        ) : null}

        {screen === "signin" ? (
          <SignStep
            note={note}
            onGuest={skip}
            onEmail={() => setScreen("email")}
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

        {screen === "email" ? (
          <button type="button" onClick={() => setScreen("username")} className="mt-auto pb-8 text-left">
            <h1 className="font-display text-[2.4rem] font-bold uppercase leading-[0.94] tracking-[-0.025em]">
              Check your
              <br />
              inbox.
            </h1>
            <p className="mt-4 font-mono text-[12.5px] text-secondary">The link signs you in.</p>
            <p className="mt-9 font-mono text-meta tracking-[0.14em] text-secondary">TAP TO CONTINUE</p>
          </button>
        ) : null}

        {screen === "username" ? (
          <form
            className="flex min-h-0 flex-1 flex-col"
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
            <div className="mt-auto">
              <h1 className="max-w-[16rem] font-display text-[2.4rem] font-bold uppercase leading-[0.94] tracking-[-0.025em]">
                What does
                <br />
                the crowd
                <br />
                call you?
              </h1>
              <label className="mt-8 flex h-14 items-center border-b border-secondary">
                <span className="font-display text-2xl text-secondary">@</span>
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
                  className="h-full min-w-0 flex-1 bg-transparent font-display text-2xl tracking-tight text-fg outline-none placeholder:text-muted"
                />
              </label>
              <p className="h-7 pt-2 font-mono text-meta tracking-[0.14em] text-pulse" aria-live="polite">
                {err}
              </p>
              <button
                type="submit"
                disabled={name.length < 3 || busy}
                className="flex h-[52px] w-full items-center justify-between bg-fg px-4 font-mono text-meta tracking-[0.14em] text-bg disabled:bg-[#3a3a3a] disabled:text-secondary"
              >
                {busy ? "SAVING" : "THAT'S ME"}
                <span>→</span>
              </button>
            </div>
          </form>
        ) : null}

        {screen === "landed" ? (
          <div className="mt-auto pb-6">
            <p className="font-mono text-meta tracking-[0.14em] text-secondary">@{name.toUpperCase()}</p>
            <h1 className="mt-3 font-display text-[2rem] font-bold uppercase leading-[0.94] tracking-[-0.025em]">
              Welcome in.
              <br />
              10,000 pts to start.
            </h1>
          </div>
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
}: {
  beat: number;
  onBeat: (n: number) => void;
  onEnter: () => void;
}) {
  const startX = useRef<number | null>(null);
  const last = beat === 2;
  return (
    <div
      className="flex min-h-0 flex-1 flex-col"
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
      <div className="mt-auto">
        <p className="font-mono text-meta tracking-[0.14em] text-secondary">{BEATS[beat].n}</p>
        <h1 className="mt-3 whitespace-pre-line font-display text-[2.75rem] font-bold uppercase leading-[0.94] tracking-[-0.025em]">
          {BEATS[beat].title}
        </h1>
        <p className="mt-4 max-w-[18rem] font-mono text-[12.5px] leading-relaxed text-secondary">{BEATS[beat].body}</p>
      </div>
      <div className="mt-8 flex gap-1.5">
        {BEATS.map((row, i) => (
          <i key={row.n} className={`block h-0.5 w-4 ${i === beat ? "bg-fg" : "bg-line"}`} />
        ))}
      </div>
      <div className="relative mt-5 h-[52px]">
        {last ? (
          <button
            type="button"
            onClick={(event) => {
              event.stopPropagation();
              onEnter();
            }}
            className="flex h-[52px] w-full items-center justify-between bg-fg px-4 font-mono text-meta tracking-[0.14em] text-bg"
          >
            ENTER THE MARKET
            <span>→</span>
          </button>
        ) : (
          <p className="flex h-[52px] items-center font-mono text-[10px] tracking-[0.14em] text-secondary">TAP TO CONTINUE</p>
        )}
      </div>
    </div>
  );
}

function SignStep({
  note,
  onGuest,
  onGoogle,
  onTelegram,
  onEmail,
}: {
  note: string;
  onGuest: () => void;
  onGoogle: () => void;
  onTelegram: () => void;
  onEmail: () => void;
}) {
  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div className="mt-auto">
        <h1 className="font-display text-[2.75rem] font-bold uppercase leading-[0.94] tracking-[-0.025em]">
          Join the
          <br />
          crowd.
        </h1>
        <p className="mt-3 font-mono text-meta tracking-[0.12em] text-secondary">ONE NAME. EVERY MARKET.</p>
        <div className="mt-8 flex flex-col gap-2">
          <AuthRow label="CONTINUE WITH GOOGLE" onClick={onGoogle} />
          <AuthRow label="CONTINUE WITH TELEGRAM" onClick={onTelegram} />
          <AuthRow label="EMAIL ME A LINK" onClick={onEmail} />
        </div>
        {note ? <p className="mt-3 font-mono text-meta text-pulse">{note}</p> : null}
        <button type="button" onClick={onGuest} className="mt-4 font-mono text-meta tracking-[0.14em] text-secondary underline decoration-line underline-offset-4">
          LOOK AROUND FIRST
        </button>
      </div>
      <p className="mt-8 font-mono text-[10px] tracking-[0.14em] text-secondary">POINTS HAVE NO CASH VALUE.</p>
    </div>
  );
}

function AuthRow({ label, onClick }: { label: string; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="flex h-[52px] w-full items-center justify-between border border-line bg-bg/40 px-4 font-mono text-meta tracking-[0.14em]"
    >
      {label}
      <span>→</span>
    </button>
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
        cy: 0.42,
        size: Math.min(170, field.w * 0.44),
        yaw: -0.28,
        pitch: 0.45,
        roll: 0.08,
      });
      Object.assign(field.flap, { period: 680, amp: 0.58, base: 0.26 });
      field.opacity = 1;
      field.drift = 0.35;
      field.form({ from: "scatter", dur: reduced ? 0 : 800, stagger: reduced ? 0 : 240 });
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
    <div data-intro-cover className="fixed inset-0 z-40 bg-bg text-fg">
      <canvas ref={canvasRef} className="absolute inset-0 h-full w-full" aria-hidden />
      {slow ? (
        <p className="absolute inset-x-0 bottom-16 text-center font-mono text-meta tracking-[0.14em] text-secondary">
          STILL CONNECTING
        </p>
      ) : null}
      <p className="sr-only">Loading the live market.</p>
    </div>
  );
}

export function LineReplay({ onClose }: { onClose: () => void }) {
  const [beat, setBeat] = useState(0);
  return (
    <div data-intro-cover className="fixed inset-0 z-40 bg-bg text-fg">
      <div className="relative z-10 mx-auto flex h-full w-full max-w-[430px] flex-col px-5 pb-6 pt-[max(1.25rem,env(safe-area-inset-top))]">
        <div className="flex justify-end">
          <button type="button" onClick={onClose} className="font-mono text-meta tracking-[0.14em] text-secondary">
            CLOSE
          </button>
        </div>
        <Explainer beat={beat} onBeat={setBeat} onEnter={onClose} />
      </div>
    </div>
  );
}
