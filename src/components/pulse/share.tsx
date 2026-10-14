import { useEffect, useState } from "react";
import { formatPrice, outcomeWord, sideLabel } from "@/lib/pulse/format";
import type { Side } from "@/lib/pulse/math";

export type ShareSpec = {
  kind: "call" | "result" | "market";
  code: string;
  side?: Side;
  openPrice?: number | null;
  closePrice?: number | null;
  outcome?: "win" | "loss" | "draw" | "void" | "cancelled" | null;
  net?: number | null;
  stake?: number | null;
};

export async function copyMarket(spec: ShareSpec): Promise<boolean> {
  const lines = [
    `PULSE · ${spec.code} · BTC/USD`,
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

  useEffect(() => {
    let dead = false;
    void drawCard(spec, includeStake).then((blob) => {
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
    includeStake,
    spec.kind,
    spec.code,
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

async function drawCard(spec: ShareSpec, includeStake: boolean): Promise<Blob | null> {
  await document.fonts.ready.catch(() => undefined);
  const canvas = document.createElement("canvas");
  canvas.width = 1080;
  canvas.height = 1350;
  const ctx = canvas.getContext("2d");
  if (!ctx) return null;
  ctx.fillStyle = "#080808";
  ctx.fillRect(0, 0, 1080, 1350);
  ctx.strokeStyle = "#2D2D2D";
  ctx.strokeRect(48, 48, 984, 1254);
  ctx.fillStyle = "#E83D43";
  ctx.fillRect(80, 96, 18, 18);
  ctx.fillStyle = "#F1F0EA";
  ctx.font = "500 42px 'Space Grotesk', sans-serif";
  ctx.fillText("PULSE", 112, 116);
  ctx.fillStyle = "#92928D";
  ctx.font = "400 28px 'JetBrains Mono', monospace";
  ctx.fillText(`${spec.code}  ·  BTC/USD`, 80, 200);
  ctx.fillStyle = "#F1F0EA";
  ctx.font = "500 168px 'Space Grotesk', sans-serif";
  const headline =
    spec.outcome === "win"
      ? "CALLED IT"
      : spec.outcome === "loss"
        ? "NOT THIS TIME"
        : spec.outcome === "draw"
          ? "DRAW"
          : spec.outcome === "void" || spec.outcome === "cancelled"
            ? "RETURNED"
            : spec.side
              ? sideLabel(spec.side)
              : "LIVE";
  wrap(ctx, headline, 80, 420, 920, 170);
  ctx.fillStyle = spec.side === "down" ? "#7D2028" : spec.side === "up" ? "#A8E63A" : "#F1F0EA";
  if (spec.side && spec.outcome == null) {
    ctx.font = "500 64px 'Space Grotesk', sans-serif";
    ctx.fillText(spec.side === "up" ? "↑" : "↓", 80, 620);
  }
  ctx.fillStyle = "#92928D";
  ctx.font = "400 32px 'JetBrains Mono', monospace";
  let y = 780;
  if (spec.openPrice != null) {
    ctx.fillText(`OPEN  ${formatPrice(spec.openPrice)}`, 80, y);
    y += 52;
  }
  if (spec.closePrice != null) {
    ctx.fillText(`CLOSE  ${formatPrice(spec.closePrice)}`, 80, y);
    y += 52;
  }
  if (spec.outcome) {
    ctx.fillStyle = "#F1F0EA";
    ctx.fillText(outcomeWord(spec.outcome), 80, y);
    y += 52;
  }
  if (includeStake && spec.stake != null) {
    ctx.fillStyle = "#92928D";
    ctx.fillText(`STAKE  ${spec.stake.toLocaleString("en-US")} PTS`, 80, y);
  }
  ctx.fillStyle = "#5C5C58";
  ctx.font = "400 24px 'JetBrains Mono', monospace";
  ctx.fillText("SEE THE CROWD", 80, 1220);
  return new Promise((resolve) => canvas.toBlob((b) => resolve(b), "image/png"));
}

function wrap(ctx: CanvasRenderingContext2D, text: string, x: number, y: number, max: number, lh: number) {
  const words = text.split(" ");
  let line = "";
  let yy = y;
  for (const w of words) {
    const test = line ? `${line} ${w}` : w;
    if (ctx.measureText(test).width > max && line) {
      ctx.fillText(line, x, yy);
      line = w;
      yy += lh;
    } else line = test;
  }
  if (line) ctx.fillText(line, x, yy);
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
