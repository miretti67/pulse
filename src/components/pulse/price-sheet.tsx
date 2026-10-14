import { useEffect, useRef, useState } from "react";
import { formatClock, formatPrice } from "@/lib/pulse/format";
import type { MarketSnap } from "@/lib/pulse/types";

type Pt = { time: number; value: number };
const CB = "https://api.exchange.coinbase.com/products/BTC-USD";

/** Live BTC chart bottom sheet: Coinbase candles + ws ticker, mock fallback, current market OPEN line + countdown. */
export function PriceSheet({ market, serverNow, onClose }: { market: MarketSnap; serverNow: number; onClose: () => void }) {
  const host = useRef<HTMLDivElement>(null);
  const [live, setLive] = useState<boolean | null>(null);
  const [last, setLast] = useState<number | null>(market.price);
  const [now, setNow] = useState(serverNow);
  const skew = useRef(serverNow - Date.now());
  const openPx = market.openPrice ?? market.price;

  useEffect(() => {
    const id = window.setInterval(() => setNow(Date.now() + skew.current), 250);
    const esc = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", esc);
    return () => { window.clearInterval(id); window.removeEventListener("keydown", esc); };
  }, [onClose]);

  useEffect(() => {
    let dead = false;
    const timers: number[] = [];
    let sock: WebSocket | null = null;
    let cleanupChart = () => {};
    void import("lightweight-charts").then(async (lw) => {
      if (dead || !host.current) return;
      const chart = lw.createChart(host.current, {
        autoSize: true,
        layout: { background: { type: lw.ColorType.Solid, color: "transparent" }, textColor: "#92928D", fontSize: 10 },
        grid: { vertLines: { visible: false }, horzLines: { color: "#1C1C1C" } },
        rightPriceScale: { borderVisible: false },
        timeScale: { borderVisible: false, timeVisible: true, secondsVisible: false },
        crosshair: { horzLine: { color: "#3A3A3A" }, vertLine: { color: "#3A3A3A" } },
      });
      cleanupChart = () => chart.remove();
      const series = chart.addAreaSeries({ lineColor: "#F1F0EA", lineWidth: 2, topColor: "rgba(241,240,234,.12)", bottomColor: "rgba(241,240,234,0)", priceLineColor: "#F1F0EA", priceLineStyle: 2 });
      if (openPx != null) series.createPriceLine({ price: openPx, color: "#E83D43", lineWidth: 1, lineStyle: 0, axisLabelVisible: true, title: "OPEN" });
      let lastPt: Pt | null = null;
      const tick = (v: number) => {
        if (!Number.isFinite(v) || dead) return;
        const t = Math.floor(Date.now() / 60000) * 60;
        lastPt = { time: Math.max(t, lastPt?.time ?? 0), value: v };
        series.update(lastPt as never);
        setLast(v);
      };
      let ok = false;
      try {
        const r = await fetch(`${CB}/candles?granularity=60`);
        if (!r.ok) throw new Error("http");
        const rows = (await r.json()) as number[][];
        const data = rows.map((x) => ({ time: x[0], value: x[4] })).sort((a, b) => a.time - b.time).slice(-180);
        if (dead) return;
        series.setData(data as never);
        lastPt = data.at(-1) ?? null;
        ok = data.length > 0;
      } catch {
        ok = false;
      }
      if (!ok) {
        // mock: random walk around the market's own price so the sheet never shows empty
        let v = market.price ?? 60000;
        const base = Math.floor(Date.now() / 60000) * 60;
        const data: Pt[] = [];
        for (let i = 179; i >= 0; i--) { v += (Math.random() - 0.5) * 18; data.push({ time: base - i * 60, value: v }); }
        series.setData(data as never);
        lastPt = data.at(-1)!;
        timers.push(window.setInterval(() => tick((lastPt?.value ?? v) + (Math.random() - 0.5) * 6), 1000));
      } else {
        try {
          sock = new WebSocket("wss://ws-feed.exchange.coinbase.com");
          sock.onopen = () => sock?.send(JSON.stringify({ type: "subscribe", product_ids: ["BTC-USD"], channels: ["ticker"] }));
          sock.onmessage = (e) => { const j = JSON.parse(String(e.data)); if (j.type === "ticker") tick(Number(j.price)); };
        } catch { /* REST polling below covers it */ }
        const poll = async () => { try { const r = await fetch(`${CB}/ticker`); tick(Number((await r.json()).price)); } catch { /* ignore */ } };
        timers.push(window.setInterval(poll, 5000));
      }
      chart.timeScale().fitContent();
      setLive(ok);
    });
    return () => { dead = true; timers.forEach((t) => window.clearInterval(t)); sock?.close(); cleanupChart(); };
  }, [market.code]);

  const close = Date.parse(market.closesAt) - now;
  const lock = Date.parse(market.locksAt) - now;
  const delta = last != null && openPx != null ? last - openPx : null;
  return (
    <div data-price-sheet className="fixed inset-0 z-50 flex items-end bg-black/60" onClick={onClose}>
      <div role="dialog" aria-label="BTC live chart" className="mx-auto w-full max-w-[520px] border-t border-line bg-bg px-4 pb-8 pt-3" onClick={(e) => e.stopPropagation()}>
        <div className="mx-auto mb-3 h-1 w-10 bg-line" />
        <div className="flex items-center justify-between font-mono text-meta text-secondary">
          <span>BTC / USD · {market.lengthMin}M · {market.code}</span>
          <span className={live ? "text-fg" : ""}>{live == null ? "LOADING" : live ? "● LIVE · COINBASE" : "MOCK DATA"}</span>
        </div>
        <div className="mt-2 flex items-end justify-between">
          <span className="font-display text-3xl tabular-nums">{last != null ? formatPrice(last) : "--"}</span>
          <span className="text-right font-mono text-meta">
            <span className="block text-secondary">OPEN {openPx != null ? formatPrice(openPx) : "--"}</span>
            {delta != null ? <span style={{ color: delta >= 0 ? "#A8E63A" : "#E83D43" }}>{delta >= 0 ? "▲" : "▼"} {Math.abs(delta).toFixed(2)}</span> : null}
          </span>
        </div>
        <div ref={host} className="mt-3 h-[260px] w-full" />
        <div className="mt-3 flex justify-between font-mono text-meta">
          <span>CLOSES IN <b className="font-display text-base tabular-nums">{formatClock(Math.max(0, close))}</b></span>
          <span style={{ color: lock > 0 ? undefined : "#E83D43" }}>{lock > 0 ? `LOCKS IN ${formatClock(lock)}` : "LOCKED"}</span>
        </div>
        <button type="button" className="mt-4 w-full border border-line py-3 font-mono text-meta" onClick={onClose}>CLOSE</button>
      </div>
    </div>
  );
}
