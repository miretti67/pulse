/** Live BTC/USD ticker from the same Coinbase feed the app uses (WS + REST fallback). */
import { useEffect, useState } from "react";
import { cents } from "./math";

const REST = "https://api.exchange.coinbase.com/products/BTC-USD";
const WS_URL = "wss://ws-feed.exchange.coinbase.com";

export type TickerStatus = "loading" | "live" | "reconnecting" | "down";

export type BtcTick = {
  price: number | null;
  status: TickerStatus;
  open24h: number | null;
};

const EMPTY: BtcTick = { price: null, status: "loading", open24h: null };

export function useBtcTicker(): BtcTick {
  const [tick, setTick] = useState<BtcTick>(EMPTY);

  useEffect(() => {
    let dead = false;
    let ws: WebSocket | null = null;
    let wsAt = 0;
    let retry = 0;
    let reconnectTimer = 0;
    let pollTimer = 0;
    let open24h: number | null = null;

    const publish = (price: number, status: TickerStatus) => {
      if (dead || !Number.isFinite(price) || price <= 0) return;
      setTick({ price: cents(price), status, open24h });
    };

    async function poll(): Promise<void> {
      try {
        const r = await fetch(`${REST}/ticker`, { cache: "no-store" });
        if (!r.ok) throw new Error("http");
        const j = (await r.json()) as { price?: string; open?: string };
        const n = Number(j.price);
        const o = Number(j.open);
        if (Number.isFinite(o) && o > 0) open24h = cents(o);
        if (Number.isFinite(n) && n > 0) publish(n, "live");
      } catch {
        if (dead) return;
        setTick((prev) => {
          if (prev.price == null) return { ...prev, status: "down" };
          const stale = prev.status === "live" ? "reconnecting" : "down";
          return { ...prev, status: stale };
        });
      }
    }

    function scheduleReconnect() {
      if (dead) return;
      window.clearTimeout(reconnectTimer);
      const delay = Math.min(15_000, 500 * 2 ** retry++);
      reconnectTimer = window.setTimeout(connect, delay);
    }

    function connect() {
      if (dead || typeof WebSocket === "undefined") return;
      if (ws && (ws.readyState === WebSocket.OPEN || ws.readyState === WebSocket.CONNECTING))
        return;
      window.clearTimeout(reconnectTimer);
      let sock: WebSocket;
      try {
        sock = new WebSocket(WS_URL);
      } catch {
        scheduleReconnect();
        return;
      }
      ws = sock;
      sock.onopen = () => {
        retry = 0;
        sock.send(
          JSON.stringify({ type: "subscribe", product_ids: ["BTC-USD"], channels: ["ticker"] }),
        );
      };
      sock.onmessage = (ev) => {
        try {
          const j = JSON.parse(String(ev.data)) as {
            type?: string;
            price?: string;
            open_24h?: string;
          };
          if (j.type !== "ticker" || !j.price) return;
          const n = Number(j.price);
          const o = Number(j.open_24h);
          if (Number.isFinite(o) && o > 0) open24h = cents(o);
          wsAt = Date.now();
          publish(n, "live");
        } catch {
          /* ignore a bad frame */
        }
      };
      sock.onclose = () => {
        if (ws === sock) {
          ws = null;
          scheduleReconnect();
        }
      };
      sock.onerror = () => {
        try {
          sock.close();
        } catch {
          /* ignore */
        }
      };
    }

    void poll().then(() => {
      if (!dead) connect();
    });
    pollTimer = window.setInterval(() => {
      if (Date.now() - wsAt > 1500) void poll();
    }, 1000);

    const onVis = () => {
      if (document.visibilityState !== "visible" || dead) return;
      retry = 0;
      connect();
      void poll();
    };
    document.addEventListener("visibilitychange", onVis);

    return () => {
      dead = true;
      window.clearTimeout(reconnectTimer);
      window.clearInterval(pollTimer);
      document.removeEventListener("visibilitychange", onVis);
      const s = ws;
      ws = null;
      if (s) {
        s.onclose = null;
        try {
          s.close();
        } catch {
          /* ignore */
        }
      }
    };
  }, []);

  return tick;
}
