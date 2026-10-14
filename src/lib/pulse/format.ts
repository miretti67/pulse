import type { Side } from "./math";

export function formatPts(n: number): string {
  return `${Math.trunc(n).toLocaleString("en-US")} PTS`;
}

export function formatSignedPts(n: number): string {
  const v = Math.trunc(n);
  if (v > 0) return `+${v.toLocaleString("en-US")} PTS`;
  if (v < 0) return `−${Math.abs(v).toLocaleString("en-US")} PTS`;
  return "0 PTS";
}

export function formatPrice(n: number): string {
  return n.toLocaleString("en-US", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

export function formatClock(ms: number): string {
  const s = Math.max(0, Math.floor(ms / 1000));
  const m = Math.floor(s / 60);
  const r = s % 60;
  return `${String(m).padStart(2, "0")}:${String(r).padStart(2, "0")}`;
}

export function formatUtc(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "—";
  const hh = String(d.getUTCHours()).padStart(2, "0");
  const mm = String(d.getUTCMinutes()).padStart(2, "0");
  return `${hh}:${mm} UTC`;
}

export function formatPct(n: number): string {
  const sign = n > 0 ? "+" : n < 0 ? "−" : "";
  return `${sign}${Math.abs(n).toFixed(2)}%`;
}

export function sideLabel(side: Side): string {
  return side === "up" ? "UP ↑" : "DOWN ↓";
}

export function outcomeWord(
  outcome: "win" | "loss" | "draw" | "void" | "cancelled" | null,
): string {
  if (outcome === "win") return "WIN";
  if (outcome === "loss") return "LOSS";
  if (outcome === "draw") return "DRAW";
  if (outcome === "cancelled") return "CANCELLED";
  if (outcome === "void") return "VOID";
  return "LIVE";
}
