/**
 * Demo Mode — client-side simulator.
 * ~1,000 bots + the real user (player 1,001) share the same demo markets.
 * Markets settle on real Coinbase BTC. Demo stats never mix with real-mode data.
 */
import { AVATARS, type AvatarId, type ActivityItem, type Feed, type HistoryDetail, type HistoryRow, type MarketSnap, type PlaceResult, type ProfileSnap, type PulseSnapshot, type RankSnap, type SettledCall } from "./types";
import { STALE_PRICE_MS, LENGTHS, lockLeadMs, cents, estimateReturn, shareOfPool, stakesFor, windowBounds, type LengthMin, type Side } from "./math";

export const DEMO_FLAG = "pulse-demo";
export const DEMO_ENV = typeof import.meta !== "undefined" && (import.meta as { env?: Record<string, string> }).env?.VITE_PULSE_DEMO === "true";
export const BOT_COUNT = 1000;
export const USER_ID = "user";

type Bot = { id: string; username: string; avatar: AvatarId; points: number; style: "mom" | "contra" | "noise"; calls: number; wins: number; streak: number };
type Call = { uid: string; code: string; side: Side; stake: number; at: number; serial: string; settled?: boolean; payout?: number; net?: number; outcome?: SettledCall["outcome"] };
type Mkt = {
  code: string; lengthMin: LengthMin; status: MarketSnap["status"];
  opensAt: number; locksAt: number; closesAt: number;
  openPrice: number | null; closePrice: number | null; result: MarketSnap["result"];
  samples: number[];
};

type Store = {
  bots: Bot[];
  user: { username: string; avatar: AvatarId | null; points: number; calls: number; wins: number; streak: number; lastSide: Side | null };
  calls: Call[];
  markets: Mkt[];
  activity: ActivityItem[];
  serial: number;
  seed: number;
  startedAt: number;
};

const KEY = "pulse-demo-v1";
const CB = "https://api.exchange.coinbase.com/products/BTC-USD";

let store: Store | null = null;
let price = 0;
let priceAt = 0;
let feed: Feed = "down";
let running = false;
let pollTimer = 0;
let simTimer = 0;
const listeners = new Set<() => void>();

function rng(seed: number) {
  return () => {
    seed |= 0;
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const PREFIX = ["pulse", "btc", "moon", "dip", "long", "short", "alpha", "beta", "zeta", "nova", "apex", "flux", "tide", "volt", "echo", "ember", "frost", "ghost", "haze", "iron", "jade", "kite", "lumen", "mirage", "neon", "orbit", "prism", "quill", "raven", "sable", "tide", "umbra", "vivid", "wisp", "xenon", "yarn", "zephyr", "bolt", "chip", "dash"];
const SUFFIX = ["fox", "wolf", "owl", "cat", "ape", "bee", "elk", "jay", "koi", "lynx", "orb", "pug", "ray", "yak", "zen", "01", "07", "42", "99", "x", "hq", "io", "ai", "btc", "eth"];

function makeBots(seed: number): Bot[] {
  const R = rng(seed);
  const used = new Set<string>();
  const bots: Bot[] = [];
  for (let i = 0; i < BOT_COUNT; i++) {
    let name = "";
    do {
      name = `${PREFIX[(R() * PREFIX.length) | 0]}${SUFFIX[(R() * SUFFIX.length) | 0]}${(R() * 90 + 10) | 0}`;
    } while (used.has(name));
    used.add(name);
    bots.push({
      id: `demo_${i}`,
      username: name.slice(0, 16),
      avatar: AVATARS[(R() * AVATARS.length) | 0],
      points: 8000 + ((R() * 12000) | 0),
      style: R() < 0.45 ? "mom" : R() < 0.7 ? "contra" : "noise",
      calls: 0,
      wins: 0,
      streak: 0,
    });
  }
  return bots;
}

function emptyUser(): Store["user"] {
  return { username: "you", avatar: null, points: 10000, calls: 0, wins: 0, streak: 0, lastSide: null };
}

function load(): Store {
  if (store) return store;
  try {
    const raw = localStorage.getItem(KEY);
    if (raw) {
      store = JSON.parse(raw) as Store;
      return store!;
    }
  } catch { /* ignore */ }
  const seed = (Date.now() ^ 0x9e3779b9) >>> 0;
  store = { bots: makeBots(seed), user: emptyUser(), calls: [], markets: [], activity: [], serial: 1000, seed, startedAt: Date.now() };
  backfillHistory(store, seed);
  save();
  return store;
}

function save() {
  if (!store) return;
  try { localStorage.setItem(KEY, JSON.stringify(store)); } catch { /* ignore */ }
}

export function isDemoOn(): boolean {
  if (typeof window === "undefined") return DEMO_ENV;
  try {
    const v = localStorage.getItem(DEMO_FLAG);
    if (v === "1") return true;
    if (v === "0") return false;
  } catch { /* ignore */ }
  return DEMO_ENV;
}

export function setDemoOn(on: boolean) {
  try { localStorage.setItem(DEMO_FLAG, on ? "1" : "0"); } catch { /* ignore */ }
  if (on) ensureRunning();
  else stop();
  notify();
}

function notify() { for (const fn of listeners) fn(); }
export function subscribeDemo(fn: () => void) { listeners.add(fn); return () => listeners.delete(fn); }


/** Seed a few already-settled markets so rank / history / globe look busy on first open. */
function backfillHistory(s: Store, seed: number) {
  const R = rng(seed ^ 0xC0FFEE);
  const now = Date.now();
  // invent a base price path
  let px = 82000 + R() * 400;
  for (let step = 6; step >= 1; step--) {
    for (const length of LENGTHS) {
      const span = length * 60_000;
      const opens = Math.floor(now / span) * span - step * span;
      const lead = lockLeadMs(length);
      const m: Mkt = {
        code: codeFor(length, opens),
        lengthMin: length,
        status: "settled",
        opensAt: opens,
        locksAt: opens + span - lead,
        closesAt: opens + span,
        openPrice: cents(px),
        closePrice: null,
        result: null,
        samples: [cents(px)],
      };
      const drift = (R() - 0.48) * (length === 1 ? 25 : length === 5 ? 60 : 140);
      px = Math.max(1000, px + drift);
      m.closePrice = cents(px);
      m.result = m.closePrice > m.openPrice! ? "up" : m.closePrice < m.openPrice! ? "down" : "draw";
      s.markets.push(m);
      const n = 40 + ((R() * 90) | 0);
      for (let i = 0; i < n; i++) {
        const b = s.bots[(R() * s.bots.length) | 0];
        if (s.calls.some((c) => c.uid === b.id && c.code === m.code)) continue;
        const side: Side = R() < (m.result === "up" ? 0.55 : 0.45) ? "up" : "down";
        const opts = stakesFor(length).filter((x) => x <= b.points);
        if (!opts.length) continue;
        const stake = opts[(R() * opts.length) | 0];
        b.points -= stake;
        s.serial += 1;
        s.calls.push({ uid: b.id, code: m.code, side, stake, at: opens + ((R() * (span - lead)) | 0), serial: `SN-${String(s.serial).padStart(5, "0")}` });
      }
      // settle inline
      const calls = s.calls.filter((c) => c.code === m.code);
      const upPool = calls.filter((c) => c.side === "up").reduce((a, c) => a + c.stake, 0);
      const downPool = calls.filter((c) => c.side === "down").reduce((a, c) => a + c.stake, 0);
      for (const c of calls) {
        c.settled = true;
        let payout = 0;
        let outcome: SettledCall["outcome"] = "loss";
        if (m.result === "draw") { payout = c.stake; outcome = "draw"; }
        else if (c.side === m.result) {
          const sidePool = c.side === "up" ? upPool : downPool;
          const other = c.side === "up" ? downPool : upPool;
          payout = estimateReturn(c.stake, sidePool, other);
          outcome = "win";
        }
        c.payout = payout; c.net = payout - c.stake; c.outcome = outcome;
        const b = s.bots.find((x) => x.id === c.uid);
        if (b) {
          b.points = Math.max(0, b.points + (c.net ?? 0));
          b.calls += 1;
          if (outcome === "win") { b.wins += 1; b.streak += 1; }
          else if ((c.net ?? 0) < 0) b.streak = 0;
        }
      }
    }
  }
}

function codeFor(length: LengthMin, opens: number) {
  return `D${length}M_${opens.toString(36).toUpperCase()}`;
}

function ensureMarkets(now: number) {
  const s = load();
  for (const length of LENGTHS) {
    const w = windowBounds(now, length);
    let m = s.markets.find((x) => x.lengthMin === length && x.opensAt === w.opens);
    if (!m) {
      m = {
        code: codeFor(length, w.opens),
        lengthMin: length,
        status: "open",
        opensAt: w.opens,
        locksAt: w.locks,
        closesAt: w.closes,
        openPrice: price || null,
        closePrice: null,
        result: null,
        samples: price ? [price] : [],
      };
      s.markets.push(m);
    }
    if (m.openPrice == null && price) m.openPrice = price;
    if (price) {
      if (!m.samples.length || m.samples[m.samples.length - 1] !== price) {
        m.samples.push(price);
        if (m.samples.length > 60) m.samples.shift();
      }
    }
    if (now >= m.closesAt && m.status !== "settled") settleMarket(m, now);
    else if (now >= m.locksAt && m.status === "open") m.status = "locked";
  }
  // Settle every past market, not just the current window's. Previously only the market for the
  // current window was checked, so once a new window opened, the old one (holding the user's call)
  // was never settled and the UI sat on VERIFYING RESULT forever.
  for (const m of s.markets) {
    if (m.status !== "settled" && now >= m.closesAt) settleMarket(m, now);
  }
  // keep last ~8 of each length
  for (const length of LENGTHS) {
    const list = s.markets.filter((m) => m.lengthMin === length).sort((a, b) => b.opensAt - a.opensAt);
    const keep = new Set(list.slice(0, 8).map((m) => m.code));
    s.markets = s.markets.filter((m) => m.lengthMin !== length || keep.has(m.code));
  }
}

function settleMarket(m: Mkt, now: number) {
  const s = load();
  if (m.status === "settled") return;
  const close = price || m.openPrice || 0;
  m.closePrice = cents(close);
  m.status = "settled";
  if (m.openPrice == null) m.openPrice = m.closePrice;
  const open = m.openPrice!;
  m.result = m.closePrice > open ? "up" : m.closePrice < open ? "down" : "draw";
  const calls = s.calls.filter((c) => c.code === m.code && !c.settled);
  const upPool = calls.filter((c) => c.side === "up").reduce((a, c) => a + c.stake, 0);
  const downPool = calls.filter((c) => c.side === "down").reduce((a, c) => a + c.stake, 0);
  for (const c of calls) {
    c.settled = true;
    let payout = 0;
    let outcome: SettledCall["outcome"] = "loss";
    if (m.result === "draw") {
      payout = c.stake;
      outcome = m.result === "draw" ? "draw" : "void";
    } else if (c.side === m.result) {
      const sidePool = c.side === "up" ? upPool : downPool;
      const other = c.side === "up" ? downPool : upPool;
      payout = estimateReturn(c.stake, sidePool, other);
      outcome = "win";
    } else {
      payout = 0;
      outcome = "loss";
    }
    c.payout = payout;
    c.net = payout - c.stake;
    c.outcome = outcome;
    applyPoints(c.uid, c.net!, outcome === "win");
  }
  s.calls = s.calls.filter((c) => !c.settled || now - m.closesAt < 36e5);
  save();
}

function applyPoints(uid: string, net: number, won: boolean) {
  const s = load();
  if (uid === USER_ID) {
    s.user.points = Math.max(0, s.user.points + net);
    s.user.calls += 1;
    if (won) { s.user.wins += 1; s.user.streak += 1; } else if (net < 0) s.user.streak = 0;
    return;
  }
  const b = s.bots.find((x) => x.id === uid);
  if (!b) return;
  b.points = Math.max(0, b.points + net);
  b.calls += 1;
  if (won) { b.wins += 1; b.streak += 1; } else if (net < 0) b.streak = 0;
}

function place(uid: string, code: string, side: Side, stake: number, at = Date.now()): boolean {
  const s = load();
  const m = s.markets.find((x) => x.code === code);
  if (!m || m.status !== "open" || at >= m.locksAt) return false;
  if (s.calls.some((c) => c.uid === uid && c.code === code)) return false;
  const pts = uid === USER_ID ? s.user.points : s.bots.find((b) => b.id === uid)?.points ?? 0;
  if (pts < stake) return false;
  if (uid === USER_ID) { s.user.points -= stake; s.user.lastSide = side; }
  else {
    const b = s.bots.find((x) => x.id === uid)!;
    b.points -= stake;
  }
  s.serial += 1;
  s.calls.push({ uid, code, side, stake, at, serial: `SN-${String(s.serial).padStart(5, "0")}` });
  const name = uid === USER_ID ? s.user.username : s.bots.find((b) => b.id === uid)!.username;
  s.activity.unshift({ username: name, side, stake, at: new Date(at).toISOString() });
  if (s.activity.length > 40) s.activity.length = 40;
  return true;
}

function botDecide(b: Bot, m: Mkt, R: () => number): Side | null {
  if (b.points < 10) return null;
  if (sCallsOn(m.code).some((c) => c.uid === b.id)) return null;
  const calls = sCallsOn(m.code);
  const upN = calls.filter((c) => c.side === "up").length;
  const downN = calls.filter((c) => c.side === "down").length;
  const open = m.openPrice ?? price;
  const delta = price && open ? price - open : 0;
  let pUp = 0.5;
  if (b.style === "mom") pUp = delta > 0 ? 0.68 : delta < 0 ? 0.32 : 0.5;
  else if (b.style === "contra") pUp = delta > 0 ? 0.35 : delta < 0 ? 0.65 : 0.5;
  else pUp = 0.45 + R() * 0.1;
  // mild herd toward the thinner side sometimes
  if (upN + downN > 8 && R() < 0.2) pUp = upN < downN ? 0.62 : 0.38;
  return R() < pUp ? "up" : "down";
}

function sCallsOn(code: string) { return load().calls.filter((c) => c.code === code && !c.settled); }

function stakeFor(b: Bot, length: LengthMin, R: () => number) {
  const opts = stakesFor(length).filter((s) => s <= b.points);
  if (!opts.length) return null;
  // small stakes more often
  const weights = opts.map((_, i) => Math.pow(0.55, i));
  const sum = weights.reduce((a, w) => a + w, 0);
  let r = R() * sum;
  for (let i = 0; i < opts.length; i++) { r -= weights[i]; if (r <= 0) return opts[i]; }
  return opts[0];
}

function tickSim(now: number) {
  const s = load();
  ensureMarkets(now);
  if (!price) return;
  const R = rng((s.seed + (now / 1000 | 0)) >>> 0);
  for (const m of s.markets.filter((x) => x.status === "open")) {
    const span = m.closesAt - m.opensAt;
    const lockIn = m.locksAt - now;
    const progress = 1 - (m.closesAt - now) / span;
    // base arrivals: ~18–40 bots per market, denser near lock
    let rate = m.lengthMin === 1 ? 0.08 : m.lengthMin === 5 ? 0.05 : 0.035;
    if (lockIn < 25_000 && lockIn > 0) rate *= 3.2; // burst near lock
    else if (progress > 0.55) rate *= 1.4;
    const n = Math.min(12, Math.floor(rate * BOT_COUNT * 0.01 + R() * 2));
    // pick random bots
    for (let i = 0; i < n; i++) {
      const b = s.bots[(R() * s.bots.length) | 0];
      const side = botDecide(b, m, R);
      if (!side) continue;
      const stake = stakeFor(b, m.lengthMin, R);
      if (!stake) continue;
      place(b.id, m.code, side, stake, now - ((R() * 800) | 0));
    }
  }
  save();
  notify();
}

// --- Live price: Coinbase public WebSocket ticker, REST polling as fallback ---
const WS_URL = "wss://ws-feed.exchange.coinbase.com";
let ws: WebSocket | null = null;
let wsAt = 0; // last socket tick
let wsRetry = 0;
let wsTimer = 0;

function connectSocket() {
  if (typeof WebSocket === "undefined" || !running) return;
  if (ws && (ws.readyState === WebSocket.OPEN || ws.readyState === WebSocket.CONNECTING)) return;
  window.clearTimeout(wsTimer);
  let sock: WebSocket;
  try { sock = new WebSocket(WS_URL); } catch { scheduleReconnect(); return; }
  ws = sock;
  sock.onopen = () => {
    wsRetry = 0;
    sock.send(JSON.stringify({ type: "subscribe", product_ids: ["BTC-USD"], channels: ["ticker"] }));
  };
  sock.onmessage = (ev) => {
    try {
      const j = JSON.parse(String(ev.data)) as { type?: string; price?: string };
      if (j.type !== "ticker" || !j.price) return;
      const n = Number(j.price);
      if (!Number.isFinite(n) || n <= 0) return;
      price = cents(n);
      priceAt = wsAt = Date.now();
      feed = "live";
    } catch { /* ignore */ }
  };
  sock.onclose = () => { if (ws === sock) { ws = null; scheduleReconnect(); } };
  sock.onerror = () => { try { sock.close(); } catch { /* ignore */ } };
}

function scheduleReconnect() {
  if (!running) return;
  window.clearTimeout(wsTimer);
  const delay = Math.min(15_000, 500 * 2 ** wsRetry++);
  wsTimer = window.setTimeout(connectSocket, delay);
}

function closeSocket() {
  window.clearTimeout(wsTimer);
  const s = ws; ws = null;
  if (s) { s.onclose = null; try { s.close(); } catch { /* ignore */ } }
}

/** REST fallback: only hits Coinbase when the socket has gone quiet. */
async function fallbackPoll() {
  if (Date.now() - wsAt < 1500) return;
  await pollPrice();
}

async function pollPrice() {
  try {
    const r = await fetch(`${CB}/ticker`, { cache: "no-store" });
    if (!r.ok) throw 0;
    const j = (await r.json()) as { price: string };
    price = cents(Number(j.price));
    priceAt = Date.now();
    feed = "live";
  } catch {
    if (price) feed = Date.now() - priceAt < 15000 ? "reconnecting" : "down";
    else {
      // bootstrap mock so the preview works offline
      price = cents(80000 + Math.sin(Date.now() / 6e4) * 200);
      priceAt = Date.now();
      feed = "down";
    }
  }
}

let burstOnce = false;
let visHooked = false;
function ensureRunning() {
  if (typeof window === "undefined" || running || !isDemoOn()) return;
  running = true;
  load();
  void pollPrice().then(() => {
    ensureMarkets(Date.now());
    if (!burstOnce) { burstOnce = true; demoBusySnapshot(); }
    else tickSim(Date.now());
  });
  connectSocket();
  pollTimer = window.setInterval(() => void fallbackPoll(), 1000);
  if (!visHooked && typeof document !== "undefined") {
    visHooked = true;
    // background tabs throttle timers: grab a fresh price as soon as the tab is visible again
    document.addEventListener("visibilitychange", () => {
      if (document.visibilityState !== "visible" || !running) return;
      wsRetry = 0;
      connectSocket();
      void pollPrice().then(() => notify());
    });
  }
  simTimer = window.setInterval(() => tickSim(Date.now()), 900);
}

export function demoStop() { stop(); }
function stop() {
  running = false;
  if (pollTimer) window.clearInterval(pollTimer);
  if (simTimer) window.clearInterval(simTimer);
  closeSocket();
  pollTimer = simTimer = 0;
}

function pools(code: string) {
  const calls = sCallsOn(code);
  return {
    upPool: calls.filter((c) => c.side === "up").reduce((a, c) => a + c.stake, 0),
    downPool: calls.filter((c) => c.side === "down").reduce((a, c) => a + c.stake, 0),
    participants: new Set(calls.map((c) => c.uid)).size,
    calls,
  };
}

function toSnap(m: Mkt, now: number): MarketSnap {
  const p = pools(m.code);
  return {
    code: m.code,
    lengthMin: m.lengthMin,
    status: m.status === "settled" ? "settled" : now >= m.locksAt ? "locked" : "open",
    opensAt: new Date(m.opensAt).toISOString(),
    locksAt: new Date(m.locksAt).toISOString(),
    closesAt: new Date(m.closesAt).toISOString(),
    openPrice: m.openPrice,
    closePrice: m.closePrice,
    price: price || m.openPrice,
    result: m.result,
    upPool: p.upPool,
    downPool: p.downPool,
    participants: p.participants,
    source: feed === "live" ? "COINBASE" : "DEMO",
    samples: m.samples.slice(),
  };
}

function myPos(code: string) {
  const s = load();
  const c = s.calls.find((x) => x.uid === USER_ID && x.code === code && !x.settled);
  if (!c) return null;
  const p = pools(code);
  const sidePool = c.side === "up" ? p.upPool : p.downPool;
  const other = c.side === "up" ? p.downPool : p.upPool;
  return { side: c.side, stake: c.stake, share: shareOfPool(c.stake, sidePool), estReturn: estimateReturn(c.stake, sidePool, other), serial: c.serial };
}

export function demoPulse(): PulseSnapshot {
  ensureRunning();
  const s = load();
  const now = Date.now();
  ensureMarkets(now);
  const markets = LENGTHS.map((l) => {
    const m = s.markets.filter((x) => x.lengthMin === l).sort((a, b) => b.opensAt - a.opensAt)[0];
    return m ? toSnap(m, now) : null;
  }).filter(Boolean) as MarketSnap[];
  const holds = s.calls.filter((c) => c.uid === USER_ID && !c.settled).map((c) => {
    const m = s.markets.find((x) => x.code === c.code)!;
    const pos = myPos(c.code)!;
    return { ...pos, code: c.code, lengthMin: m.lengthMin };
  });
  const recentCall = s.calls.filter((c) => c.uid === USER_ID && c.settled).sort((a, b) => b.at - a.at)[0];
  let recent: SettledCall | null = null;
  if (recentCall) {
    const m = s.markets.find((x) => x.code === recentCall.code);
    if (m) {
      const p = pools(m.code);
      // use settled pools from all calls including settled
      const all = s.calls.filter((c) => c.code === m.code);
      const upPool = all.filter((c) => c.side === "up").reduce((a, c) => a + c.stake, 0);
      const downPool = all.filter((c) => c.side === "down").reduce((a, c) => a + c.stake, 0);
      recent = {
        code: m.code, lengthMin: m.lengthMin, side: recentCall.side, stake: recentCall.stake,
        payout: recentCall.payout ?? 0, net: recentCall.net ?? 0, outcome: recentCall.outcome ?? "loss",
        openPrice: m.openPrice, closePrice: m.closePrice, result: m.result,
        participants: new Set(all.map((c) => c.uid)).size, upPool, downPool,
        closesAt: new Date(m.closesAt).toISOString(), opensAt: new Date(m.opensAt).toISOString(),
        source: "DEMO",
      };
      void p;
    }
  }
  const settling = holds.find((h) => {
    const m = s.markets.find((x) => x.code === h.code);
    return m && now >= m.closesAt && m.status !== "settled";
  });
  const activities = markets.map((m) => ({ code: m.code, items: [] as ActivityItem[] }));
  for (const row of activities) {
    const m = s.markets.find((x) => x.code === row.code);
    if (!m) continue;
    row.items = s.calls
      .filter((c) => c.code === m.code)
      .sort((a, b) => b.at - a.at)
      .slice(0, 12)
      .map((c) => ({
        username: c.uid === USER_ID ? s.user.username : s.bots.find((b) => b.id === c.uid)?.username ?? "bot",
        side: c.side,
        stake: c.stake,
        at: new Date(c.at).toISOString(),
      }));
  }
  return {
    serverNow: new Date(now).toISOString(),
    feed,
    priceAgeMs: priceAt ? now - priceAt : 99999,
    markets,
    market: markets.find((m) => m.lengthMin === 15) ?? markets[0] ?? null,
    me: {
      points: s.user.points,
      position: markets[0] ? myPos(markets[0].code) : null,
      holds,
      inPlay: holds.reduce((a, h) => a + h.stake, 0),
    },
    activity: activities[0]?.items ?? [],
    activities,
    settling: settling
      ? {
          code: settling.code,
          lengthMin: settling.lengthMin,
          side: settling.side,
          stake: settling.stake,
          openPrice: s.markets.find((m) => m.code === settling.code)?.openPrice ?? null,
          closesAt: new Date(s.markets.find((m) => m.code === settling.code)!.closesAt).toISOString(),
          source: "DEMO",
        }
      : null,
    recent,
  };
}

export function demoPlace(side: Side, stake: number, code: string): PlaceResult {
  ensureRunning();
  const s = load();
  const m = s.markets.find((x) => x.code === code);
  if (!m) return { ok: false, reason: "unavailable" };
  const now = Date.now();
  if (now >= m.closesAt) return { ok: false, reason: "closed" };
  if (now >= m.locksAt || m.status !== "open") return { ok: false, reason: "locked" };
  if (!stakesFor(m.lengthMin).includes(stake)) return { ok: false, reason: "rejected" };
  if (s.user.points < stake) return { ok: false, reason: "balance" };
  if (s.calls.some((c) => c.uid === USER_ID && c.code === code)) return { ok: false, reason: "already" };
  if (!price || Date.now() - priceAt > STALE_PRICE_MS) return { ok: false, reason: "stale" };
  place(USER_ID, code, side, stake, now);
  save();
  notify();
  return { ok: true, points: s.user.points };
}

export function demoHistory(code: string | null): { rows: HistoryRow[]; detail: HistoryDetail | null } {
  ensureRunning();
  const s = load();
  const mine = s.calls.filter((c) => c.uid === USER_ID).sort((a, b) => b.at - a.at);
  const rows: HistoryRow[] = mine.map((c) => {
    const m = s.markets.find((x) => x.code === c.code)!;
    return {
      code: c.code,
      lengthMin: m.lengthMin,
      side: c.side,
      stake: c.stake,
      net: c.settled ? c.net ?? null : null,
      outcome: c.settled ? c.outcome ?? null : null,
      closesAt: new Date(m.closesAt).toISOString(),
      opensAt: new Date(m.opensAt).toISOString(),
      live: !c.settled,
    };
  });
  if (!code) return { rows, detail: null };
  const c = mine.find((x) => x.code === code);
  const m = s.markets.find((x) => x.code === code);
  if (!c || !m) return { rows, detail: null };
  const all = s.calls.filter((x) => x.code === code);
  return {
    rows,
    detail: {
      ...rows.find((r) => r.code === code)!,
      openPrice: m.openPrice,
      closePrice: m.closePrice,
      result: m.result,
      payout: c.payout ?? null,
      source: "DEMO",
      participants: new Set(all.map((x) => x.uid)).size,
      upPool: all.filter((x) => x.side === "up").reduce((a, x) => a + x.stake, 0),
      downPool: all.filter((x) => x.side === "down").reduce((a, x) => a + x.stake, 0),
    },
  };
}

export function demoRank(board: "main" | "fast"): RankSnap {
  ensureRunning();
  const s = load();
  const people = [
    ...s.bots.map((b) => ({ id: b.id, username: b.username, points: b.points })),
    { id: USER_ID, username: s.user.username, points: s.user.points },
  ].sort((a, b) => b.points - a.points);
  // "fast" board: people with more recent 1M activity get a slight bump via points already earned
  if (board === "fast") {
    // already sorted by points; keep as-is — demo points already come from all lengths
  }
  const rows = people.slice(0, 50).map((p, i) => ({
    rank: i + 1,
    username: p.username,
    points: p.points,
    mine: p.id === USER_ID,
  }));
  const meIdx = people.findIndex((p) => p.id === USER_ID);
  return {
    timeframe: "ALL-TIME",
    board,
    total: people.length,
    me: meIdx >= 0 ? { rank: meIdx + 1, points: s.user.points, username: s.user.username } : null,
    rows,
  };
}

export function demoProfile(): ProfileSnap {
  ensureRunning();
  const s = load();
  const byLen = LENGTHS.map((lengthMin) => {
    const cs = s.calls.filter((c) => c.uid === USER_ID && c.settled && s.markets.find((m) => m.code === c.code)?.lengthMin === lengthMin);
    const wins = cs.filter((c) => c.outcome === "win").length;
    return { lengthMin, accuracy: cs.length ? Math.round((wins / cs.length) * 1000) / 10 : null };
  });
  return {
    displayName: s.user.username,
    username: s.user.username,
    image: null,
    memberNo: "DEMO_0001",
    sinceYear: new Date().getFullYear(),
    points: s.user.points,
    calls: s.user.calls,
    wins: s.user.wins,
    accuracy: s.user.calls ? Math.round((s.user.wins / s.user.calls) * 1000) / 10 : null,
    accuracyByLength: byLen,
    streak: s.user.streak,
    referralCode: "DEMO",
    friends: 0,
    referralPoints: 0,
    avatar: s.user.avatar,
    lastSide: s.user.lastSide,
  };
}

export function demoSetAvatar(avatar: AvatarId) {
  const s = load();
  s.user.avatar = avatar;
  save();
}

export function demoSetUsername(name: string) {
  const s = load();
  s.user.username = name.slice(0, 16) || "you";
  save();
}

export function demoReset() {
  stop();
  burstOnce = false;
  store = null;
  try { localStorage.removeItem(KEY); } catch { /* ignore */ }
  if (isDemoOn()) ensureRunning();
  notify();
}


/** Capture helper: invent a settled call for the real user against the latest settled 15M. */
export function demoPlantSettled(side: Side = "up", stake = 100, length: LengthMin = 15) {
  ensureRunning();
  const s = load();
  const m = s.markets.filter((x) => x.status === "settled" && x.lengthMin === length).sort((a, b) => b.closesAt - a.closesAt)[0];
  if (!m) return null;
  // wipe any prior plant for this code
  s.calls = s.calls.filter((c) => !(c.uid === USER_ID && c.code === m.code));
  s.serial += 1;
  const win = side === m.result;
  const all = s.calls.filter((c) => c.code === m.code);
  const upPool = all.filter((c) => c.side === "up").reduce((a, c) => a + c.stake, 0) + (side === "up" ? stake : 0);
  const downPool = all.filter((c) => c.side === "down").reduce((a, c) => a + c.stake, 0) + (side === "down" ? stake : 0);
  const sidePool = side === "up" ? upPool : downPool;
  const other = side === "up" ? downPool : upPool;
  const payout = win ? estimateReturn(stake, sidePool, other) : m.result === "draw" ? stake : 0;
  const net = payout - stake;
  s.calls.push({
    uid: USER_ID, code: m.code, side, stake, at: m.opensAt + 30_000, serial: `SN-${String(s.serial).padStart(5, "0")}`,
    settled: true, payout, net, outcome: m.result === "draw" ? "draw" : win ? "win" : "loss",
  });
  s.user.calls += 1;
  s.user.points = Math.max(0, s.user.points + net);
  if (win) { s.user.wins += 1; s.user.streak += 1; } else if (net < 0) s.user.streak = 0;
  s.user.lastSide = side;
  save(); notify();
  return m.code;
}

export function demoBusySnapshot() {
  // Force a denser tick for captures: dump ~120 bots into open markets immediately.
  ensureRunning();
  const s = load();
  const now = Date.now();
  ensureMarkets(now);
  const R = rng((s.seed + 99) >>> 0);
  for (const m of s.markets.filter((x) => x.status === "open" || x.status === "locked")) {
    if (m.status === "locked") continue;
    for (let i = 0; i < 80; i++) {
      const b = s.bots[(R() * s.bots.length) | 0];
      const side = botDecide(b, m, R);
      if (!side) continue;
      const stake = stakeFor(b, m.lengthMin, R);
      if (stake) place(b.id, m.code, side, stake, now - ((R() * 4000) | 0));
    }
  }
  save();
  notify();
}

// Kick off if already enabled when this module loads in the browser.
if (typeof window !== "undefined") {
  try { if (isDemoOn()) ensureRunning(); } catch { /* ignore */ }

if (typeof window !== "undefined") {
  (window as unknown as { __pulseDemo?: object }).__pulseDemo = {
    place: demoPlace, plant: demoPlantSettled, busy: demoBusySnapshot, pulse: demoPulse, on: isDemoOn, reset: demoReset,
  };
}

}
