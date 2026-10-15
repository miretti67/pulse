import { useEffect, useState } from "react";
import { formatPrice, outcomeWord, sideLabel } from "@/lib/pulse/format";
import type { LengthMin, Side } from "@/lib/pulse/math";
import type { AvatarId } from "@/lib/pulse/types";
import { getProfile, useDemo } from "@/lib/pulse/source";
import { localAvatar } from "./dust-avatar";

export type ShareSpec = {
  kind: "call" | "result" | "market";
  code: string;
  /** Market length in minutes (1, 5 or 15). */
  lengthMin?: LengthMin | null;
  side?: Side;
  openPrice?: number | null;
  closePrice?: number | null;
  outcome?: "win" | "loss" | "draw" | "void" | "cancelled" | null;
  net?: number | null;
  stake?: number | null;
  /** Settled pools (points) for the crowd line; omit when unknown. */
  upPool?: number | null;
  downPool?: number | null;
};

export async function copyMarket(spec: ShareSpec): Promise<boolean> {
  const lines = [
    `PULSE · ${spec.lengthMin ? `${spec.lengthMin}M · ` : ""}BTC/USD · ${spec.code}`,
    spec.side ? sideLabel(spec.side) : null,
    spec.openPrice != null ? `OPEN ${formatPrice(spec.openPrice)}` : null,
    spec.closePrice != null ? `CLOSE ${formatPrice(spec.closePrice)}` : null,
    spec.outcome ? outcomeWord(spec.outcome) : null,
  ].filter(Boolean);
  try {
    await navigator.clipboard.writeText(lines.join("\n"));
    return true;
  } catch {
    return false;
  }
}

export function ShareActions({ spec }: { spec: ShareSpec }) {
  const [open, setOpen] = useState(false);
  const [copied, setCopied] = useState(false);
  const label = spec.kind === "result" ? "SHARE RESULT" : spec.kind === "call" ? "SHARE MY CALL" : "SHARE";
  return (
    <div className="mt-4 grid grid-cols-2 gap-2">
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="h-11 border border-line font-mono text-meta text-fg"
      >
        {label}
      </button>
      <button
        type="button"
        onClick={() => {
          void copyMarket(spec).then((ok) => {
            setCopied(ok);
            window.setTimeout(() => setCopied(false), 1600);
          });
        }}
        className="h-11 border border-line font-mono text-meta text-secondary"
      >
        {copied ? "COPIED" : "COPY MARKET"}
      </button>
      {open ? <ShareSheet spec={spec} onClose={() => setOpen(false)} /> : null}
    </div>
  );
}

function ShareSheet({ spec, onClose }: { spec: ShareSpec; onClose: () => void }) {
  const [includeStake, setIncludeStake] = useState(false);
  const [url, setUrl] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const demo = useDemo();
  const [who, setWho] = useState<{ username: string | null; avatar: AvatarId | null } | null>(null);

  useEffect(() => {
    let dead = false;
    void getProfile()
      .then((p) => {
        if (!dead) setWho({ username: p?.username || null, avatar: p?.avatar ?? localAvatar() });
      })
      .catch(() => {
        if (!dead) setWho({ username: null, avatar: localAvatar() });
      });
    return () => {
      dead = true;
    };
  }, []);

  useEffect(() => {
    if (!who) return;
    let dead = false;
    void drawCard(spec, includeStake, { ...who, demo }).then((blob) => {
      if (dead || !blob) return;
      const next = URL.createObjectURL(blob);
      setUrl((prev) => {
        if (prev) URL.revokeObjectURL(prev);
        return next;
      });
    });
    return () => {
      dead = true;
    };
    // Primitives only — the parent clock re-renders often.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    who,
    demo,
    includeStake,
    spec.upPool,
    spec.downPool,
    spec.kind,
    spec.code,
    spec.lengthMin,
    spec.side,
    spec.openPrice,
    spec.closePrice,
    spec.outcome,
    spec.net,
    spec.stake,
  ]);

  useEffect(() => {
    return () => {
      if (url) URL.revokeObjectURL(url);
    };
  }, [url]);

  return (
    <div className="fixed inset-0 z-30 flex items-end justify-center bg-bg/80" role="dialog" aria-label="Share card">
      <div className="w-full max-w-[520px] border-t border-line bg-bg px-4 pb-[max(1rem,env(safe-area-inset-bottom))] pt-4">
        <div className="mb-3 flex items-center justify-between">
          <p className="font-mono text-meta text-secondary">1080 × 1350</p>
          <button type="button" onClick={onClose} className="font-mono text-meta text-fg">
            CLOSE
          </button>
        </div>
        {url ? (
          <img src={url} alt="Share card preview" className="mx-auto max-h-80 w-auto border border-line" />
        ) : (
          <div className="grid h-48 place-items-center font-mono text-meta text-secondary">RENDERING</div>
        )}
        {spec.stake != null ? (
          <label className="mt-3 flex items-center gap-2 font-mono text-meta text-secondary">
            <input
              type="checkbox"
              checked={includeStake}
              onChange={(e) => setIncludeStake(e.target.checked)}
            />
            INCLUDE STAKE
          </label>
        ) : null}
        <button
          type="button"
          disabled={!url || busy}
          onClick={() => {
            if (!url) return;
            setBusy(true);
            void shareBlob(url, spec).finally(() => setBusy(false));
          }}
          className="mt-3 h-12 w-full bg-fg font-display text-base text-bg disabled:bg-elevated disabled:text-muted"
        >
          {busy ? "SENDING…" : "SEND CARD"}
        </button>
      </div>
    </div>
  );
}

export type CardExtras = {
  username?: string | null;
  avatar?: AvatarId | null;
  demo?: boolean;
};

const C = {
  bg: "#080808",
  fg: "#F1F0EA",
  up: "#A8E63A",
  down: "#7D2028",
  pulse: "#E83D43",
  secondary: "#92928D",
  muted: "#5C5C58",
  line: "#2D2D2D",
};
const DISPLAY = "'Space Grotesk', sans-serif";
const MONO = "'JetBrains Mono', monospace";

/**
 * Crowd line from real pool data only. Pools are points, so the share is by points staked.
 * Returns null when there is nothing honest to say (no pools, draw, void, open call).
 */
function crowdLine(spec: ShareSpec): string | null {
  const up = spec.upPool ?? null;
  const down = spec.downPool ?? null;
  if (up == null || down == null || !spec.side) return null;
  const total = up + down;
  if (total <= 0 || up === 0 || down === 0) return null;
  const mine = spec.side === "up" ? up : down;
  const other = total - mine;
  if (spec.outcome === "win") return `BEAT ${Math.round((other / total) * 100)}% OF THE CROWD`;
  if (spec.outcome === "loss") return `${Math.round((other / total) * 100)}% OF THE CROWD CALLED IT`;
  return null;
}

async function renderAvatar(id: AvatarId, tint: "up" | "down" | "none"): Promise<HTMLCanvasElement | null> {
  try {
    const dust = await import("@/lib/pulse/dustbust");
    const c = document.createElement("canvas");
    c.width = 256;
    c.height = 256;
    const b = new dust.DustBust(c, id, { n: 14000, seed: 7 });
    b.setTint(tint);
    b.tint = b.tintTo; // no fade-in for a still image
    b.render(0);
    return c;
  } catch {
    return null;
  }
}

function fitFont(ctx: CanvasRenderingContext2D, text: string, weight: number, start: number, family: string, max: number) {
  let size = start;
  ctx.font = `${weight} ${size}px ${family}`;
  while (ctx.measureText(text).width > max && size > 40) {
    size -= 6;
    ctx.font = `${weight} ${size}px ${family}`;
  }
  return size;
}

export async function drawCard(spec: ShareSpec, includeStake: boolean, extras: CardExtras = {}): Promise<Blob | null> {
  await document.fonts.ready.catch(() => undefined);
  const canvas = document.createElement("canvas");
  canvas.width = 1080;
  canvas.height = 1350;
  const ctx = canvas.getContext("2d");
  if (!ctx) return null;
  const L = 96;
  const R = 984;
  ctx.fillStyle = C.bg;
  ctx.fillRect(0, 0, 1080, 1350);
  ctx.strokeStyle = C.line;
  ctx.lineWidth = 2;
  ctx.strokeRect(48, 48, 984, 1254);

  // Mark + demo label
  ctx.fillStyle = C.pulse;
  ctx.fillRect(L, 100, 18, 18);
  ctx.fillStyle = C.fg;
  ctx.font = `500 42px ${DISPLAY}`;
  ctx.textBaseline = "alphabetic";
  ctx.fillText("PULSE", L + 32, 120);
  ctx.font = `400 24px ${MONO}`;
  ctx.textAlign = "right";
  if (extras.demo) {
    ctx.fillStyle = C.secondary;
    ctx.fillText("DEMO · POINTS ONLY", R, 118);
  }
  ctx.textAlign = "left";
  ctx.fillStyle = C.secondary;
  ctx.font = `400 26px ${MONO}`;
  if (spec.lengthMin) {
    // Market length, loud: "15M · BTC/USD"
    ctx.fillStyle = C.fg;
    ctx.font = `700 34px ${MONO}`;
    const tag = `${spec.lengthMin}M`;
    ctx.fillText(tag, L, 190);
    const w = ctx.measureText(tag).width;
    ctx.fillStyle = C.secondary;
    ctx.font = `400 26px ${MONO}`;
    ctx.fillText(`  ·  BTC/USD  ·  ${spec.code}`, L + w, 190);
  } else ctx.fillText(`${spec.code}  ·  BTC/USD`, L, 190);

  const settled = spec.outcome != null;
  const win = spec.outcome === "win";
  const loss = spec.outcome === "loss";
  const sideCol = spec.side === "up" ? C.up : spec.side === "down" ? C.down : C.fg;

  // Kicker + hero
  const kicker = win
    ? "CALLED IT"
    : loss
      ? "NOT THIS TIME"
      : spec.outcome === "draw"
        ? "DRAW · STAKE BACK"
        : spec.outcome === "void" || spec.outcome === "cancelled"
          ? "RETURNED"
          : "MY CALL";
  ctx.fillStyle = win ? C.up : loss ? C.down : C.fg;
  ctx.font = `700 72px ${DISPLAY}`;
  ctx.fillText(kicker, L, 330);

  let hero: string;
  if (settled && spec.net != null) {
    const v = Math.trunc(spec.net);
    hero = `${v > 0 ? "+\u200A" : v < 0 ? "−\u200A" : ""}${Math.abs(v).toLocaleString("en-US")} PTS`;
  } else hero = spec.side ? (spec.side === "up" ? "UP ↑" : "DOWN ↓") : "LIVE";
  ctx.fillStyle = settled ? C.fg : sideCol;
  fitFont(ctx, hero, 600, 220, DISPLAY, R - L);
  ctx.fillText(hero, L, 530);

  ctx.font = `400 28px ${MONO}`;
  ctx.fillStyle = C.secondary;
  const sub = [spec.side ? `CALLED ${spec.side === "up" ? "UP ↑" : "DOWN ↓"}` : null, includeStake && spec.stake != null ? `STAKE ${spec.stake.toLocaleString("en-US")} PTS` : null]
    .filter(Boolean)
    .join("  ·  ");
  if (sub) ctx.fillText(sub, L, 600);

  // BTC line: open -> close (only the two real prices; no invented path)
  const top = 640;
  const h = 260;
  ctx.strokeStyle = C.line;
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(L, top + h);
  ctx.lineTo(R, top + h);
  ctx.stroke();
  if (spec.openPrice != null) {
    const o = spec.openPrice;
    const c = spec.closePrice;
    const delta = c != null ? c - o : 0;
    const span = Math.max(Math.abs(delta), o * 0.0002);
    const yFor = (p: number) => top + h / 2 - ((p - o) / span) * (h / 2 - 30);
    const x0 = L + 10;
    const x1 = c != null ? R - 150 : L + 260;
    const y0 = yFor(o);
    const y1 = c != null ? yFor(c) : y0;
    // open baseline (dashed)
    ctx.setLineDash([6, 10]);
    ctx.strokeStyle = C.muted;
    ctx.beginPath();
    ctx.moveTo(x0, y0);
    ctx.lineTo(R, y0);
    ctx.stroke();
    ctx.setLineDash([]);
    // price line
    ctx.strokeStyle = c == null ? C.fg : delta > 0 ? C.up : delta < 0 ? C.pulse : C.fg;
    ctx.lineWidth = 6;
    ctx.beginPath();
    ctx.moveTo(x0, y0);
    ctx.lineTo(x1, y1);
    ctx.stroke();
    ctx.fillStyle = C.fg;
    for (const [x, y] of [[x0, y0], [x1, y1]] as const) {
      ctx.beginPath();
      ctx.arc(x, y, 9, 0, Math.PI * 2);
      ctx.fill();
    }
    // the user's call arrow, riding the close point
    if (spec.side) {
      const ax = x1 + 70;
      const ay = y1;
      ctx.fillStyle = sideCol;
      ctx.beginPath();
      if (spec.side === "up") {
        ctx.moveTo(ax, ay - 34);
        ctx.lineTo(ax + 30, ay + 18);
        ctx.lineTo(ax - 30, ay + 18);
      } else {
        ctx.moveTo(ax, ay + 34);
        ctx.lineTo(ax + 30, ay - 18);
        ctx.lineTo(ax - 30, ay - 18);
      }
      ctx.closePath();
      ctx.fill();
    }
  }
  ctx.font = `400 28px ${MONO}`;
  ctx.fillStyle = C.secondary;
  ctx.fillText(`OPEN  ${spec.openPrice != null ? formatPrice(spec.openPrice) : "—"}`, L, top + h + 60);
  ctx.textAlign = "right";
  ctx.fillText(`CLOSE  ${spec.closePrice != null ? formatPrice(spec.closePrice) : "—"}`, R, top + h + 60);
  ctx.textAlign = "left";

  // Player + crowd
  const by = 1020;
  const av = extras.avatar ? await renderAvatar(extras.avatar, spec.side ?? "none") : null;
  let tx = L;
  if (av) {
    ctx.fillStyle = "#050505";
    ctx.fillRect(L, by, 180, 180);
    ctx.drawImage(av, L, by, 180, 180);
    ctx.strokeStyle = C.line;
    ctx.strokeRect(L, by, 180, 180);
    tx = L + 216;
  }
  if (extras.username) {
    ctx.fillStyle = C.fg;
    ctx.font = `500 44px ${DISPLAY}`;
    ctx.fillText(`@${extras.username}`, tx, by + 70);
  }
  const crowd = crowdLine(spec);
  if (crowd) {
    ctx.fillStyle = win ? C.up : C.fg;
    fitFont(ctx, crowd, 500, 40, MONO, R - tx);
    ctx.fillText(crowd, tx, by + (extras.username ? 140 : 90));
  }
  ctx.fillStyle = C.muted;
  ctx.font = `400 22px ${MONO}`;
  ctx.fillText("POINTS HAVE NO CASH VALUE", L, 1262);
  return new Promise((resolve) => canvas.toBlob((b) => resolve(b), "image/png"));
}

async function shareBlob(url: string, spec: ShareSpec) {
  const res = await fetch(url);
  const blob = await res.blob();
  const file = new File([blob], `${spec.code}.png`, { type: "image/png" });
  const nav = navigator as Navigator & { canShare?: (d: ShareData) => boolean };
  if (nav.share && (!nav.canShare || nav.canShare({ files: [file] }))) {
    try {
      await nav.share({ files: [file], title: `Pulse ${spec.code}` });
      return;
    } catch {
      /* fall through to download */
    }
  }
  const a = document.createElement("a");
  a.href = url;
  a.download = `${spec.code}.png`;
  a.click();
}
