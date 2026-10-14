import { Link, useRouterState } from "@tanstack/react-router";
import { useEffect, useRef, useState, type ReactNode } from "react";
import { GROK_PROVIDERS, signIn } from "@/lib/auth/client";

const NAV = [
  { to: "/", label: "PREDICT", icon: IconPredict },
  { to: "/history", label: "HISTORY", icon: IconHistory },
  { to: "/rank", label: "RANK", icon: IconRank },
  { to: "/me", label: "ME", icon: IconMe },
] as const;

export function Shell({ children }: { children: ReactNode }) {
  useEffect(() => {
    const web = (window as unknown as { Telegram?: { WebApp?: TelegramLike } }).Telegram?.WebApp;
    try {
      web?.ready?.();
      web?.expand?.();
      web?.setHeaderColor?.("#080808");
      web?.setBackgroundColor?.("#080808");
    } catch {
      /* not in Telegram */
    }
  }, []);

  return (
    <div className="relative mx-auto flex h-dvh w-full max-w-[520px] flex-col overflow-hidden bg-bg text-fg md:max-w-[1120px]">
      <div className="grain" aria-hidden />
      <nav aria-label="Primary" className="relative z-10 hidden grid-cols-4 border-b border-line bg-bg md:grid">
        {NAV.map((item) => (
          <NavItem key={item.to} {...item} edge="bottom" />
        ))}
      </nav>
      <div data-scroll className="relative z-10 min-h-0 flex-1 overflow-y-auto overflow-x-hidden px-4 pt-[max(1rem,env(safe-area-inset-top))] md:px-8">
        {children}
        <p className="pb-6 pt-10 font-mono text-meta text-muted">POINTS HAVE NO CASH VALUE.</p>
      </div>
      <nav
        aria-label="Primary"
        className="relative z-10 grid grid-cols-4 border-t border-line bg-bg pb-[env(safe-area-inset-bottom)] md:hidden"
      >
        {NAV.map((item) => (
          <NavItem key={item.to} {...item} edge="top" />
        ))}
      </nav>
    </div>
  );
}

function NavItem({
  to,
  label,
  icon: Icon,
  edge,
}: {
  to: "/" | "/history" | "/rank" | "/me";
  label: string;
  icon: () => ReactNode;
  edge: "top" | "bottom";
}) {
  const path = useRouterState({ select: (s) => s.location.pathname });
  const active = to === "/" ? path === "/" : path.startsWith(to);
  return (
    <Link
      to={to}
      aria-current={active ? "page" : undefined}
      className={`relative flex min-h-14 flex-col items-center justify-center gap-1 ${
        active ? "text-fg" : "text-secondary"
      }`}
    >
      {active ? (
        <span className={`absolute inset-x-5 h-px bg-pulse ${edge === "top" ? "top-0" : "bottom-0"}`} />
      ) : null}
      <Icon />
      <span className="font-mono text-meta">{label}</span>
    </Link>
  );
}

export function Mark({ n, label }: { n: string; label: string }) {
  return (
    <div className="mb-3 flex items-baseline justify-between border-t border-line pt-3">
      <span className="font-mono text-meta text-secondary">{n}</span>
      <span className="font-mono text-meta text-secondary">{label}</span>
    </div>
  );
}

export function Wordmark({ onReplay }: { onReplay?: () => void }) {
  return (
    <span className="inline-flex items-center gap-2 font-display text-lg tracking-tight">
      PULSE
      {onReplay ? (
        <button
          type="button"
          onClick={onReplay}
          aria-label="Replay how it works"
          className="font-mono text-meta text-secondary"
        >
          ?
        </button>
      ) : null}
      <span className="inline-block size-2 bg-pulse" aria-hidden />
    </span>
  );
}

export function TickText({ value, className }: { value: string; className?: string }) {
  return (
    <span className={`inline-flex items-end font-display tabular-nums ${className ?? ""}`} aria-hidden>
      {value.split("").map((ch, i) => (
        <TickChar key={`${i}-${value.length}`} ch={ch} />
      ))}
    </span>
  );
}

function TickChar({ ch }: { ch: string }) {
  const [shown, setShown] = useState(ch);
  const [flip, setFlip] = useState(false);
  useEffect(() => {
    if (ch === shown) return;
    setShown(ch);
    setFlip(true);
    const t = window.setTimeout(() => setFlip(false), 170);
    return () => window.clearTimeout(t);
  }, [ch, shown]);
  const narrow = ch === "." || ch === "," || ch === ":" || ch === " ";
  return (
    <span
      className="inline-block overflow-hidden text-center"
      style={{ width: narrow ? "0.32em" : "0.56em", height: "1.12em", lineHeight: 1 }}
    >
      <span className={`inline-block ${flip ? "tick-in" : ""}`}>{shown}</span>
    </span>
  );
}

export function PixelBar({
  upPct,
  empty,
  dropSide,
  dropKey,
  calm,
  litIndex,
}: {
  upPct: number;
  empty: boolean;
  dropSide?: "up" | "down" | null;
  dropKey?: number;
  calm?: boolean;
  litIndex?: number | null;
}) {
  const n = 32;
  const up = empty ? 0 : Math.round((Math.min(100, Math.max(0, upPct)) / 100) * n);
  const prevUp = useRef(up);
  const [fall, setFall] = useState<number[]>([]);
  useEffect(() => {
    const before = prevUp.current;
    prevUp.current = up;
    if (empty || !dropSide || dropKey == null || dropKey === 0) return;
    const next: number[] = [];
    if (dropSide === "up") {
      for (let i = Math.min(before, up); i < Math.max(before, up); i += 1) next.push(i);
      if (!next.length) next.push(Math.max(0, up - 1));
    } else {
      const from = Math.min(before, up);
      const to = Math.max(before, up);
      for (let i = from; i < to; i += 1) next.push(i);
      if (!next.length) next.push(Math.min(n - 1, up));
    }
    setFall(next);
  }, [dropKey, dropSide, empty, up]);
  return (
    <div
      className="flex gap-0.5"
      role="img"
      aria-label={empty ? "Waiting on the first call" : `${Math.round(upPct)} percent of the pool is up`}
    >
      {Array.from({ length: n }, (_, i) => (
        <span
          key={i}
          data-cell={i}
          data-side={empty ? "empty" : i < up ? "up" : "down"}
          className={`h-3 min-w-0 flex-1 ${
            empty ? (calm ? "bg-elevated" : "pixel-scan bg-elevated") : fall.includes(i) ? "pixel-drop" : ""
          } ${
            empty
              ? litIndex === i
                ? "bg-fg"
                : ""
              : litIndex === i
                ? i < up
                  ? "bg-[#CDF38A]"
                  : "bg-[#A8394A]"
                : i < up
                  ? "bg-up"
                  : "bg-down"
          }`}
          style={empty && !calm ? { animationDelay: `${i * 90}ms` } : undefined}
        />
      ))}
    </div>
  );
}

export function PriceLine({ samples, urgent }: { samples: number[]; urgent: boolean }) {
  if (samples.length === 0) return null;
  const min = Math.min(...samples);
  const max = Math.max(...samples);
  const span = max - min || 1;
  const pts = samples.map((p, i) => {
    const x = samples.length === 1 ? 96 : (i / (samples.length - 1)) * 100;
    const y = 88 - ((p - min) / span) * 64;
    return { x, y };
  });
  const d = pts.map((p, i) => `${i === 0 ? "M" : "L"}${p.x.toFixed(2)},${p.y.toFixed(2)}`).join(" ");
  const last = pts[pts.length - 1];
  return (
    <svg viewBox="0 0 100 100" preserveAspectRatio="none" className="absolute inset-0 h-full w-full" aria-hidden>
      <path d={d} fill="none" stroke={urgent ? "#E83D43" : "#F1F0EA"} strokeWidth="1.4" vectorEffect="non-scaling-stroke" />
      <circle cx={last.x} cy={last.y} r="1.35" fill={urgent ? "#E83D43" : "#F1F0EA"} className={urgent ? "pulse-dot" : ""} />
    </svg>
  );
}

export function Art({ src, className }: { src: string; className?: string }) {
  return <img src={src} alt="" className={className ?? "h-52 w-full object-cover object-top"} />;
}

export function SignInBlock({ kicker, title }: { kicker: string; title: string }) {
  return (
    <div className="pb-10">
      <p className="font-mono text-meta text-secondary">{kicker}</p>
      <h1 className="mt-3 max-w-[14rem] font-display text-title text-balance">{title}</h1>
      <p className="mt-4 max-w-[18rem] text-sm leading-relaxed text-secondary">
        Sign in to hold points, make a call, and take a place in the crowd.
      </p>
      <div className="mt-8 flex flex-col gap-2">
        {GROK_PROVIDERS.map((p) => (
          <button
            key={p.providerId}
            type="button"
            onClick={() => signIn(p.providerId, { callbackURL: "/" })}
            className="h-12 bg-fg px-4 font-display text-base tracking-tight text-bg"
          >
            Continue with {p.label}
          </button>
        ))}
      </div>
    </div>
  );
}

function IconPredict() {
  return (
    <svg width="18" height="18" viewBox="0 0 18 18" fill="none" aria-hidden>
      <path d="M3 9h12M9 3v12" stroke="currentColor" strokeWidth="1.5" />
      <circle cx="9" cy="9" r="2.25" stroke="currentColor" strokeWidth="1.5" />
    </svg>
  );
}
function IconHistory() {
  return (
    <svg width="18" height="18" viewBox="0 0 18 18" fill="none" aria-hidden>
      <path d="M3 5h12M3 9h12M3 13h8" stroke="currentColor" strokeWidth="1.5" />
    </svg>
  );
}
function IconRank() {
  return (
    <svg width="18" height="18" viewBox="0 0 18 18" fill="none" aria-hidden>
      <path d="M4 14V8M9 14V4M14 14v-3" stroke="currentColor" strokeWidth="1.5" />
    </svg>
  );
}
function IconMe() {
  return (
    <svg width="18" height="18" viewBox="0 0 18 18" fill="none" aria-hidden>
      <circle cx="9" cy="6.5" r="2.25" stroke="currentColor" strokeWidth="1.5" />
      <path d="M4 15.5c.8-2.4 2.6-3.5 5-3.5s4.2 1.1 5 3.5" stroke="currentColor" strokeWidth="1.5" />
    </svg>
  );
}

type TelegramLike = {
  ready?: () => void;
  expand?: () => void;
  setHeaderColor?: (c: string) => void;
  setBackgroundColor?: (c: string) => void;
};
