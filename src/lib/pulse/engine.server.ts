import { getSql, type Sql } from "@/lib/db";
import { cents, estimateReturn, LENGTHS, shareOfPool, stakesFor, windowBounds, type LengthMin, type Side } from "./math";
import { AVATARS, type AvatarId } from "./types";
import type {
  ActivityItem,
  Feed,
  HistoryDetail,
  HistoryRow,
  MarketSnap,
  MeSnap,
  PendingSettle,
  PlaceResult,
  ProfileSnap,
  PulseSnapshot,
  RankSnap,
  SettledCall,
} from "./types";

const REFERRAL_BONUS = 500;
const CANCEL_AFTER_MS = 90_000;

type Quote = {
  price: number;
  source: "COINBASE" | "KRAKEN";
  at: number;
  window: number;
  open: number | null;
  samples: { t: number; p: number }[];
};

type Minute = { t: number; open: number; close: number };

type Book = {
  at: number;
  price: number;
  source: "COINBASE" | "KRAKEN";
  minutes: Minute[];
};

let bookCache: Book | null = null;
let bookAttempt = 0;
let settleChain: Promise<void> = Promise.resolve();

function num(v: unknown): number {
  if (typeof v === "number" && Number.isFinite(v)) return v;
  if (typeof v === "bigint") return Number(v);
  if (typeof v === "string" && v.trim() !== "" && Number.isFinite(Number(v))) return Number(v);
  return 0;
}

function numOrNull(v: unknown): number | null {
  if (v == null) return null;
  const n = num(v);
  return Number.isFinite(n) ? n : null;
}

function iso(v: unknown): string {
  if (v instanceof Date) return v.toISOString();
  if (typeof v === "string") {
    const d = new Date(v);
    if (!Number.isNaN(d.getTime())) return d.toISOString();
  }
  return new Date(num(v)).toISOString();
}

async function fetchJson(url: string): Promise<unknown> {
  const res = await fetch(url, {
    signal: AbortSignal.timeout(4500),
    headers: { accept: "application/json" },
  });
  if (!res.ok) throw new Error(String(res.status));
  return res.json();
}

function minutesFrom(rows: unknown[]): Minute[] {
  const out: Minute[] = [];
  for (const row of rows) {
    if (!Array.isArray(row)) continue;
    const t = Number(row[0]) * 1000;
    const open = Number(row[3]);
    const close = Number(row[4]);
    if (!Number.isFinite(t) || !Number.isFinite(open) || !Number.isFinite(close)) continue;
    out.push({ t, open: cents(open), close: cents(close) });
  }
  out.sort((a, b) => a.t - b.t);
  return out;
}

async function bookCoinbase(): Promise<Book | null> {
  const [spot, minutes] = await Promise.all([
    fetchJson("https://api.coinbase.com/v2/prices/BTC-USD/spot"),
    fetchJson("https://api.exchange.coinbase.com/products/BTC-USD/candles?granularity=60"),
  ]);
  const amount = (spot as { data?: { amount?: string } }).data?.amount;
  const price = Number(amount);
  if (!Number.isFinite(price) || !Array.isArray(minutes)) return null;
  return { at: Date.now(), price: cents(price), source: "COINBASE", minutes: minutesFrom(minutes) };
}

async function bookKraken(): Promise<Book | null> {
  const ticker = (await fetchJson("https://api.kraken.com/0/public/Ticker?pair=XBTUSD")) as {
    result?: { XXBTZUSD?: { c?: string[] } };
  };
  const price = Number(ticker.result?.XXBTZUSD?.c?.[0]);
  if (!Number.isFinite(price)) return null;
  const ohlc = (await fetchJson("https://api.kraken.com/0/public/OHLC?pair=XBTUSD&interval=1")) as {
    result?: { XXBTZUSD?: unknown[][] };
  };
  const rows = (ohlc.result?.XXBTZUSD ?? []).map((c) => [c[0], c[3], c[2], c[1], c[4]]);
  return { at: Date.now(), price: cents(price), source: "KRAKEN", minutes: minutesFrom(rows) };
}

async function loadBook(): Promise<{ book: Book | null; feed: Feed }> {
  if (bookCache && Date.now() - bookCache.at < 1500) return { book: bookCache, feed: "live" };
  if (bookCache && Date.now() - bookAttempt < 2000) {
    const age = Date.now() - bookCache.at;
    return { book: bookCache, feed: age < 12000 ? "reconnecting" : "down" };
  }
  bookAttempt = Date.now();
  try {
    const next = (await bookCoinbase().catch(() => null)) ?? (await bookKraken().catch(() => null));
    if (next) {
      bookCache = next;
      return { book: bookCache, feed: "live" };
    }
  } catch {
    /* feed down */
  }
  if (bookCache && Date.now() - bookCache.at < 30000) return { book: bookCache, feed: "reconnecting" };
  return { book: null, feed: "down" };
}

function quoteFor(book: Book, opens: number, closes: number): Quote {
  const inWindow = book.minutes.filter((m) => m.t >= opens && m.t < closes);
  let open = inWindow.find((m) => m.t === opens)?.open ?? inWindow[0]?.open ?? null;
  if (open == null && Date.now() - opens >= 0 && Date.now() - opens < 4000) open = book.price;
  return {
    price: book.price,
    source: book.source,
    at: book.at,
    window: opens,
    open,
    samples: inWindow.map((m) => ({ t: m.t, p: m.close })),
  };
}

async function fetchClose(opens: number, closes: number): Promise<{ price: number; source: string } | null> {
  const { book } = await loadBook();
  const minutes = book?.minutes ?? [];
  const inWindow = minutes.filter((m) => m.t >= opens && m.t < closes);
  const last = inWindow.at(-1);
  if (last && last.t >= closes - 60_000) return { price: last.close, source: book?.source ?? "COINBASE" };
  try {
    const rows = (await fetchJson(
      "https://api.exchange.coinbase.com/products/BTC-USD/candles?granularity=60",
    )) as unknown[];
    const parsed = minutesFrom(rows).filter((m) => m.t >= opens && m.t < closes);
    const hit = parsed.at(-1);
    if (hit && hit.t >= closes - 60_000) return { price: hit.close, source: "COINBASE" };
  } catch {
    /* unavailable */
  }
  return null;
}

function codeFrom(id: string): string {
  const alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  let h = 2166136261;
  for (const ch of id) h = Math.imul(h ^ ch.charCodeAt(0), 16777619);
  let n = h >>> 0;
  let out = "";
  for (let i = 0; i < 6; i += 1) {
    out += alphabet[n % alphabet.length];
    n = Math.floor(n / alphabet.length) + i * 17 + 3;
  }
  return out;
}

function usernameFrom(name: string, id: string): string {
  const base = name.toLowerCase().replace(/[^a-z0-9]/g, "").slice(0, 12) || "member";
  const tail = id.replace(/[^a-z0-9]/gi, "").slice(-4).toLowerCase() || "0000";
  return `${base}${tail}`.slice(0, 16);
}

function cleanName(name: string): string {
  const t = name.replace(/[\u0000-\u001f]/g, "").trim().slice(0, 40);
  return t || "Member";
}

export async function claimUsername(
  userId: string,
  raw: string,
): Promise<{ ok: true; username: string } | { ok: false; reason: "short" | "taken" }> {
  const username = raw.replace(/[^a-zA-Z0-9_]/g, "").slice(0, 16).toLowerCase();
  if (username.length < 3) return { ok: false, reason: "short" };
  const sql = await getSql();
  await ensureProfile(userId);
  const taken = await sql<{ user_id: string }>`
    select user_id from profiles
    where lower(username) = ${username} and user_id <> ${userId}
    limit 1
  `;
  if (taken.length) return { ok: false, reason: "taken" };
  try {
    await sql`
      update profiles
      set username = ${username}, display_name = ${username}
      where user_id = ${userId}
    `;
  } catch {
    return { ok: false, reason: "taken" };
  }
  return { ok: true, username };
}

export async function ensureProfile(
  userId: string,
  patch?: { displayName?: string | null; image?: string | null; referral?: string | null },
): Promise<void> {
  const sql = await getSql();
  const name = cleanName(patch?.displayName ?? "Member");
  const image = patch?.image && /^https?:\/\//.test(patch.image) ? patch.image.slice(0, 500) : null;
  const existing = await sql<{ user_id: string }>`select user_id from profiles where user_id = ${userId}`;
  if (!existing.length) {
    let username = usernameFrom(name, userId);
    let code = codeFrom(userId);
    for (let i = 0; i < 5; i += 1) {
      try {
        await sql`
          insert into profiles (user_id, display_name, username, image, referral_code)
          values (${userId}, ${name}, ${username}, ${image}, ${code})
        `;
        break;
      } catch {
        username = `${usernameFrom(name, userId).slice(0, 12)}${i}${code.slice(0, 2)}`.slice(0, 16);
        code = `${codeFrom(userId + String(i))}${i}`.slice(0, 8);
      }
    }
  } else if (patch?.displayName || image) {
    await sql`
      update profiles
      set display_name = ${name},
          image = coalesce(${image}, image)
      where user_id = ${userId}
    `;
  }
  if (patch?.referral) await attachReferral(sql, userId, patch.referral);
}

async function attachReferral(sql: Sql, userId: string, raw: string): Promise<void> {
  const code = raw.toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, 12);
  if (!code) return;
  const ref = await sql<{ user_id: string }>`
    select user_id from profiles where referral_code = ${code} and user_id <> ${userId} limit 1
  `;
  if (!ref.length) return;
  const updated = await sql<{ user_id: string }>`
    update profiles
    set referred_by = ${ref[0].user_id}
    where user_id = ${userId}
      and referred_by is null
      and created_at > now() - interval '1 hour'
    returning user_id
  `;
  if (!updated.length) return;
}

async function refund(sql: Sql, marketId: number, outcome: "draw" | "void" | "cancelled"): Promise<void> {
  await sql`
    with claimed as (
      update positions
      set outcome = ${outcome}, payout = stake, net = 0
      where market_id = ${marketId} and outcome is null
      returning user_id, payout
    )
    update profiles pr
    set prediction_points = pr.prediction_points + claimed.payout
    from claimed
    where pr.user_id = claimed.user_id
  `;
}

async function paySides(sql: Sql, marketId: number, win: Side): Promise<void> {
  await sql`
    with pools as (
      select
        coalesce(sum(stake) filter (where side = 'up'), 0)::int as up_pool,
        coalesce(sum(stake) filter (where side = 'down'), 0)::int as down_pool
      from positions
      where market_id = ${marketId}
    ),
    claimed as (
      update positions p
      set
        outcome = case when p.side = ${win} then 'win' else 'loss' end,
        net = case
          when p.side = ${win} then floor(
            p.stake::numeric
            / nullif((select case when ${win} = 'up' then up_pool else down_pool end from pools), 0)
            * (select case when ${win} = 'up' then down_pool else up_pool end from pools)
          )::int
          else -p.stake
        end,
        payout = case
          when p.side = ${win} then p.stake + floor(
            p.stake::numeric
            / nullif((select case when ${win} = 'up' then up_pool else down_pool end from pools), 0)
            * (select case when ${win} = 'up' then down_pool else up_pool end from pools)
          )::int
          else 0
        end
      where p.market_id = ${marketId}
        and p.outcome is null
        and (select up_pool from pools) > 0
        and (select down_pool from pools) > 0
      returning p.user_id, p.payout
    )
    update profiles pr
    set prediction_points = pr.prediction_points + claimed.payout
    from claimed
    where pr.user_id = claimed.user_id
  `;
}

async function settleOne(
  sql: Sql,
  row: { id: number; open_price: unknown; opens_at: unknown; closes_at: unknown },
): Promise<void> {
  const id = num(row.id);
  const opens = new Date(iso(row.opens_at)).getTime();
  const closes = new Date(iso(row.closes_at)).getTime();
  await sql`
    update markets set status = 'settling'
    where id = ${id} and status in ('open', 'locked') and closes_at <= now()
  `;
  const openPrice = numOrNull(row.open_price);
  const closed = await fetchClose(opens, closes);
  if (!closed || openPrice == null) {
    if (Date.now() - closes > CANCEL_AFTER_MS) {
      await refund(sql, id, "cancelled");
      await sql`
        update markets
        set status = 'cancelled', result = 'cancelled', close_price = ${closed ? cents(closed.price) : null}
        where id = ${id} and status <> 'settled'
      `;
    }
    return;
  }
  const closePrice = cents(closed.price);
  const openC = cents(openPrice);
  const pools = await sql<{ up_pool: number; down_pool: number }>`
    select
      coalesce(sum(stake) filter (where side = 'up'), 0)::int as up_pool,
      coalesce(sum(stake) filter (where side = 'down'), 0)::int as down_pool
    from positions where market_id = ${id}
  `;
  const up = num(pools[0]?.up_pool);
  const down = num(pools[0]?.down_pool);
  let result: "up" | "down" | "draw" | "void";
  if (up === 0 || down === 0) {
    result = "void";
    await refund(sql, id, "void");
  } else if (closePrice === openC) {
    result = "draw";
    await refund(sql, id, "draw");
  } else {
    result = closePrice > openC ? "up" : "down";
    await paySides(sql, id, result);
  }
  await sql`
    update markets
    set status = 'settled', result = ${result}, close_price = ${closePrice},
        price_source = coalesce(price_source, ${closed.source})
    where id = ${id}
  `;
  await creditReferrals(sql, id);
}

async function creditReferrals(sql: Sql, marketId: number): Promise<void> {
  const users = await sql<{ user_id: string }>`
    select user_id from positions where market_id = ${marketId}
  `;
  for (const user of users) {
    const ready = await sql<{ referred_by: string }>`
      select referred_by from profiles
      where user_id = ${user.user_id}
        and referred_by is not null
        and referral_paid = false
        and (
          select count(*) from positions
          where user_id = ${user.user_id} and outcome is not null
        ) >= 3
      limit 1
    `;
    if (!ready[0]) continue;
    const paid = await sql<{ referred_by: string }>`
      update profiles
      set referral_paid = true
      where user_id = ${user.user_id} and referral_paid = false
      returning referred_by
    `;
    if (!paid[0]) continue;
    await sql`
      update profiles
      set referral_points = referral_points + ${REFERRAL_BONUS}
      where user_id = ${paid[0].referred_by}
    `;
  }
}

async function settleDue(sql: Sql): Promise<void> {
  const run = settleChain.then(async () => {
    const due = await sql<{ id: number; open_price: unknown; opens_at: unknown; closes_at: unknown }>`
      select id, open_price, opens_at, closes_at
      from markets
      where closes_at <= now() and status in ('open', 'locked', 'settling')
      order by closes_at asc
      limit 12
    `;
    for (const row of due) await settleOne(sql, row);
  });
  settleChain = run.then(
    () => undefined,
    () => undefined,
  );
  await run;
}

async function ensureMarket(
  sql: Sql,
  quote: Quote,
  bounds: { opens: number; locks: number; closes: number },
  length: LengthMin,
) {
  if (quote.open == null) return;
  const status = Date.now() >= bounds.locks ? "locked" : "open";
  await sql`
    insert into markets (code, opens_at, locks_at, closes_at, status, open_price, price_source, length_min)
    select
      'MKT_' || lpad(nextval('market_code_seq')::text, 5, '0'),
      ${new Date(bounds.opens).toISOString()}::timestamptz,
      ${new Date(bounds.locks).toISOString()}::timestamptz,
      ${new Date(bounds.closes).toISOString()}::timestamptz,
      ${status},
      ${cents(quote.open)},
      ${quote.source},
      ${length}
    where not exists (
      select 1 from markets
      where length_min = ${length}
        and opens_at = ${new Date(bounds.opens).toISOString()}::timestamptz
    )
  `;
}

async function poolsFor(sql: Sql, marketId: number) {
  const rows = await sql<{ up_pool: number; down_pool: number; participants: number }>`
    select
      coalesce(sum(stake) filter (where side = 'up'), 0)::int as up_pool,
      coalesce(sum(stake) filter (where side = 'down'), 0)::int as down_pool,
      count(distinct user_id)::int as participants
    from positions
    where market_id = ${marketId}
  `;
  return {
    upPool: num(rows[0]?.up_pool),
    downPool: num(rows[0]?.down_pool),
    participants: num(rows[0]?.participants),
  };
}

function asLength(v: unknown): LengthMin {
  const n = num(v);
  return n === 1 || n === 5 || n === 15 ? n : 15;
}

async function loadMarket(
  sql: Sql,
  quote: Quote | null,
  length: LengthMin,
  bounds: { opens: number; locks: number },
): Promise<MarketSnap | null> {
  const rows = await sql<{
    id: number;
    code: string;
    length_min: number;
    status: MarketSnap["status"];
    opens_at: unknown;
    locks_at: unknown;
    closes_at: unknown;
    open_price: unknown;
    close_price: unknown;
    result: MarketSnap["result"];
    price_source: string | null;
  }>`
    select id, code, length_min, status, opens_at, locks_at, closes_at, open_price, close_price, result, price_source
    from markets
    where length_min = ${length}
      and opens_at = ${new Date(bounds.opens).toISOString()}::timestamptz
    limit 1
  `;
  const row = rows[0];
  if (!row) return null;
  if (row.status === "open" && Date.now() >= bounds.locks) {
    await sql`update markets set status = 'locked' where id = ${row.id} and status = 'open'`;
    row.status = "locked";
  }
  const pools = await poolsFor(sql, num(row.id));
  const samples = await sql<{ price: unknown }>`
    select price from price_samples
    where market_id = ${row.id}
    order by sampled_at asc
    limit 40
  `;
  const line = samples.map((s) => cents(num(s.price)));
  const live = quote && quote.window === bounds.opens ? cents(quote.price) : line.at(-1) ?? null;
  if (live != null && (line.length === 0 || line[line.length - 1] !== live)) line.push(live);
  return {
    code: row.code,
    lengthMin: asLength(row.length_min),
    status: row.status,
    opensAt: iso(row.opens_at),
    locksAt: iso(row.locks_at),
    closesAt: iso(row.closes_at),
    openPrice: numOrNull(row.open_price),
    closePrice: numOrNull(row.close_price),
    price: live,
    result: row.result,
    upPool: pools.upPool,
    downPool: pools.downPool,
    participants: pools.participants,
    source: row.price_source,
    samples: line,
  };
}

async function storeSamples(sql: Sql, marketId: number, quote: Quote) {
  const last = await sql<{ sampled_at: unknown }>`
    select sampled_at from price_samples where market_id = ${marketId} order by sampled_at desc limit 1
  `;
  const lastMs = last[0] ? new Date(iso(last[0].sampled_at)).getTime() : 0;
  const incoming = quote.samples.filter((s) => s.t >= lastMs);
  if (Date.now() - lastMs > 20000) incoming.push({ t: Date.now(), p: quote.price });
  for (const s of incoming.slice(-8)) {
    await sql`
      insert into price_samples (market_id, sampled_at, price)
      values (${marketId}, ${new Date(s.t).toISOString()}::timestamptz, ${cents(s.p)})
      on conflict do nothing
    `;
  }
}

async function mySnap(sql: Sql, userId: string, market: MarketSnap | null): Promise<MeSnap | null> {
  const prof = await sql<{ prediction_points: number }>`
    select prediction_points from profiles where user_id = ${userId}
  `;
  if (!prof.length) return null;
  const openRows = await sql<{
    id: number;
    side: Side;
    stake: number;
    code: string;
    length_min: number;
    market_id: number;
  }>`
    select p.id, p.side, p.stake, m.code, m.length_min, m.id as market_id
    from positions p
    join markets m on m.id = p.market_id
    where p.user_id = ${userId} and p.outcome is null
  `;
  const holds: MeSnap["holds"] = [];
  for (const row of openRows) {
    const pools = await poolsFor(sql, num(row.market_id));
    const sidePool = row.side === "up" ? pools.upPool : pools.downPool;
    const other = row.side === "up" ? pools.downPool : pools.upPool;
    holds.push({
      code: row.code,
      lengthMin: asLength(row.length_min),
      side: row.side,
      stake: num(row.stake),
      share: Math.round(shareOfPool(num(row.stake), sidePool) * 10) / 10,
      estReturn: estimateReturn(num(row.stake), sidePool, other),
      serial: `SN-${String(num(row.id)).padStart(5, "0")}`,
    });
  }
  const position = market ? (holds.find((h) => h.code === market.code) ?? null) : (holds[0] ?? null);
  return {
    points: num(prof[0].prediction_points),
    position,
    holds,
    inPlay: holds.reduce((sum, h) => sum + h.stake, 0),
  };
}

async function activityFor(sql: Sql, code: string | null): Promise<ActivityItem[]> {
  if (!code) return [];
  const rows = await sql<{ username: string; side: Side; stake: number; created_at: unknown }>`
    select pr.username, po.side, po.stake, po.created_at
    from positions po
    join profiles pr on pr.user_id = po.user_id
    join markets m on m.id = po.market_id
    where m.code = ${code}
    order by po.created_at desc
    limit 16
  `;
  return rows.map((r) => ({
    username: r.username,
    side: r.side,
    stake: num(r.stake),
    at: iso(r.created_at),
  }));
}

async function userSettlement(
  sql: Sql,
  userId: string,
): Promise<{ settling: PendingSettle | null; recent: SettledCall | null }> {
  const pending = await sql<{
    code: string;
    length_min: number;
    side: Side;
    stake: number;
    open_price: unknown;
    closes_at: unknown;
    price_source: string | null;
  }>`
    select m.code, m.length_min, p.side, p.stake, m.open_price, m.closes_at, m.price_source
    from positions p
    join markets m on m.id = p.market_id
    where p.user_id = ${userId} and p.outcome is null and m.status = 'settling'
    order by m.closes_at desc
    limit 1
  `;
  const settling: PendingSettle | null = pending[0]
    ? {
        code: pending[0].code,
        lengthMin: asLength(pending[0].length_min),
        side: pending[0].side,
        stake: num(pending[0].stake),
        openPrice: numOrNull(pending[0].open_price),
        closesAt: iso(pending[0].closes_at),
        source: pending[0].price_source,
      }
    : null;
  const recentRows = await sql<{
    code: string;
    length_min: number;
    side: Side;
    stake: number;
    payout: number;
    net: number;
    outcome: SettledCall["outcome"];
    open_price: unknown;
    close_price: unknown;
    result: SettledCall["result"];
    closes_at: unknown;
    opens_at: unknown;
    price_source: string | null;
    market_id: number;
  }>`
    select m.code, m.length_min, p.side, p.stake, p.payout, p.net, p.outcome, m.open_price, m.close_price,
           m.result, m.closes_at, m.opens_at, m.price_source, m.id as market_id
    from positions p
    join markets m on m.id = p.market_id
    where p.user_id = ${userId}
      and p.outcome is not null
      and m.closes_at > now() - interval '20 minutes'
    order by m.closes_at desc
    limit 1
  `;
  if (!recentRows[0]) return { settling, recent: null };
  const r = recentRows[0];
  const pools = await poolsFor(sql, num(r.market_id));
  const recent: SettledCall = {
    code: r.code,
    lengthMin: asLength(r.length_min),
    side: r.side,
    stake: num(r.stake),
    payout: num(r.payout),
    net: num(r.net),
    outcome: r.outcome,
    openPrice: numOrNull(r.open_price),
    closePrice: numOrNull(r.close_price),
    result: r.result,
    participants: pools.participants,
    upPool: pools.upPool,
    downPool: pools.downPool,
    closesAt: iso(r.closes_at),
    opensAt: iso(r.opens_at),
    source: r.price_source,
  };
  return { settling, recent };
}

export async function loadPulse(userId: string | null): Promise<PulseSnapshot> {
  const sql = await getSql();
  const now = Date.now();
  await settleDue(sql);
  await sql`
    update markets set status = 'locked'
    where status = 'open' and locks_at <= now() and closes_at > now()
  `;
  const { book, feed } = await loadBook();
  const markets: MarketSnap[] = [];
  for (const length of LENGTHS) {
    const bounds = windowBounds(now, length);
    const quote = book ? quoteFor(book, bounds.opens, bounds.closes) : null;
    if (quote) await ensureMarket(sql, quote, bounds, length);
    let market = await loadMarket(sql, quote, length, bounds);
    if (market && quote) {
      const idRows = await sql<{ id: number }>`select id from markets where code = ${market.code}`;
      if (idRows[0]) await storeSamples(sql, num(idRows[0].id), quote);
      market = (await loadMarket(sql, quote, length, bounds)) ?? market;
    }
    if (market) markets.push(market);
  }
  const fresh = markets.find((m) => m.lengthMin === 15) ?? markets[0] ?? null;
  if (userId) {
    await ensureProfile(userId);
    await maybeTopUp(sql, userId);
  }
  const activities: { code: string; items: ActivityItem[] }[] = [];
  for (const market of markets) {
    activities.push({ code: market.code, items: await activityFor(sql, market.code) });
  }
  const me = userId ? await mySnap(sql, userId, fresh) : null;
  const settlement = userId ? await userSettlement(sql, userId) : { settling: null, recent: null };
  return {
    serverNow: new Date().toISOString(),
    feed: markets.length ? feed : "down",
    priceAgeMs: book ? Date.now() - book.at : 99_000,
    markets,
    market: fresh,
    me,
    activity: activities.find((a) => a.code === fresh?.code)?.items ?? [],
    activities,
    settling: settlement.settling,
    recent: settlement.recent,
  };
}

async function maybeTopUp(sql: Sql, userId: string): Promise<void> {
  await sql`
    update profiles p
    set broke_on = (now() at time zone 'utc')::date
    where p.user_id = ${userId}
      and p.prediction_points < 10
      and p.broke_on is null
      and not exists (
        select 1 from positions po
        where po.user_id = p.user_id and po.outcome is null
      )
  `;
  await sql`
    update profiles p
    set prediction_points = p.prediction_points + 1000,
        topup_points = p.topup_points + 1000,
        broke_on = null
    where p.user_id = ${userId}
      and p.broke_on is not null
      and p.broke_on < (now() at time zone 'utc')::date
      and p.prediction_points < 10
      and not exists (
        select 1 from positions po
        where po.user_id = p.user_id and po.outcome is null
      )
  `;
}

export async function placeCall(userId: string, side: Side, stake: number, code: string): Promise<PlaceResult> {
  if (side !== "up" && side !== "down") return { ok: false, reason: "rejected" };
  const sql = await getSql();
  const { book } = await loadBook();
  if (!book || Date.now() - book.at > 2000) return { ok: false, reason: "stale" };
  await ensureProfile(userId);
  const markets = await sql<{ id: number; length_min: number }>`
    select id, length_min from markets where code = ${code} and status = 'open' and locks_at > now() limit 1
  `;
  if (!markets.length) {
    const any = await sql<{ status: string }>`select status from markets where code = ${code} limit 1`;
    if (!any.length) return { ok: false, reason: "unavailable" };
    return { ok: false, reason: any[0].status === "open" ? "closed" : "locked" };
  }
  const length = asLength(markets[0].length_min);
  if (!stakesFor(length).includes(stake)) return { ok: false, reason: "rejected" };
  const marketId = num(markets[0].id);
  const rows = await sql<{ prediction_points: number }>`
    with ins as (
      insert into positions (market_id, user_id, side, stake)
      select ${marketId}, ${userId}, ${side}, ${stake}
      where exists (
        select 1 from profiles p
        where p.user_id = ${userId} and p.prediction_points >= ${stake}
      )
      and exists (
        select 1 from markets m
        where m.id = ${marketId} and m.status = 'open' and m.locks_at > now()
      )
      on conflict (market_id, user_id) do nothing
      returning stake, user_id
    )
    update profiles
    set prediction_points = prediction_points - ins.stake
    from ins
    where profiles.user_id = ins.user_id
    returning profiles.prediction_points
  `;
  if (rows.length) return { ok: true, points: num(rows[0].prediction_points) };
  const pos = await sql`select id from positions where market_id = ${marketId} and user_id = ${userId}`;
  if (pos.length) return { ok: false, reason: "already" };
  const prof = await sql<{ prediction_points: number }>`
    select prediction_points from profiles where user_id = ${userId}
  `;
  if (!prof.length) return { ok: false, reason: "unavailable" };
  if (num(prof[0].prediction_points) < stake) return { ok: false, reason: "balance" };
  return { ok: false, reason: "locked" };
}

export async function loadHistory(userId: string, code: string | null): Promise<{ rows: HistoryRow[]; detail: HistoryDetail | null }> {
  const sql = await getSql();
  const rows = await sql<{
    code: string;
    length_min: number;
    side: Side;
    stake: number;
    net: number | null;
    outcome: SettledCall["outcome"] | null;
    closes_at: unknown;
    opens_at: unknown;
    status: string;
  }>`
    select m.code, m.length_min, p.side, p.stake, p.net, p.outcome, m.closes_at, m.opens_at, m.status
    from positions p
    join markets m on m.id = p.market_id
    where p.user_id = ${userId}
    order by (p.outcome is null) desc, m.closes_at desc
    limit 200
  `;
  const mapped: HistoryRow[] = rows.map((r) => ({
    code: r.code,
    lengthMin: asLength(r.length_min),
    side: r.side,
    stake: num(r.stake),
    net: r.outcome ? num(r.net) : null,
    outcome: r.outcome,
    closesAt: iso(r.closes_at),
    opensAt: iso(r.opens_at),
    live: r.outcome == null,
  }));
  if (!code) return { rows: mapped, detail: null };
  const detailRows = await sql<{
    code: string;
    length_min: number;
    side: Side;
    stake: number;
    net: number | null;
    outcome: SettledCall["outcome"] | null;
    payout: number | null;
    closes_at: unknown;
    opens_at: unknown;
    status: string;
    open_price: unknown;
    close_price: unknown;
    result: string | null;
    price_source: string | null;
    market_id: number;
  }>`
    select m.code, m.length_min, p.side, p.stake, p.net, p.outcome, p.payout, m.closes_at, m.opens_at, m.status,
           m.open_price, m.close_price, m.result, m.price_source, m.id as market_id
    from positions p
    join markets m on m.id = p.market_id
    where p.user_id = ${userId} and m.code = ${code}
    limit 1
  `;
  if (!detailRows[0]) return { rows: mapped, detail: null };
  const d = detailRows[0];
  const pools = await poolsFor(sql, num(d.market_id));
  const detail: HistoryDetail = {
    code: d.code,
    lengthMin: asLength(d.length_min),
    side: d.side,
    stake: num(d.stake),
    net: d.outcome ? num(d.net) : null,
    outcome: d.outcome,
    closesAt: iso(d.closes_at),
    opensAt: iso(d.opens_at),
    live: d.outcome == null,
    openPrice: numOrNull(d.open_price),
    closePrice: numOrNull(d.close_price),
    result: d.result,
    payout: d.payout == null ? null : num(d.payout),
    source: d.price_source,
    participants: pools.participants,
    upPool: pools.upPool,
    downPool: pools.downPool,
  };
  return { rows: mapped, detail };
}

export async function loadRank(userId: string | null, board: "main" | "fast" = "main"): Promise<RankSnap> {
  const sql = await getSql();
  const lengths = board === "fast" ? [1, 1] : [5, 15];
  const scored = await sql<{ user_id: string; username: string; points: number }>`
    select pr.user_id, pr.username,
      coalesce(sum(p.net) filter (where m.length_min in (${lengths[0]}, ${lengths[1]})), 0)::int as points
    from profiles pr
    left join positions p on p.user_id = pr.user_id and p.outcome is not null
    left join markets m on m.id = p.market_id
    group by pr.user_id, pr.username, pr.created_at
    order by points desc, pr.created_at asc
  `;
  const ranked = scored.map((row, i) => ({
    rank: i + 1,
    username: row.username,
    points: num(row.points),
    mine: userId != null && row.user_id === userId,
    userId: row.user_id,
  }));
  const mine = ranked.find((row) => row.mine) ?? null;
  return {
    timeframe: "ALL-TIME",
    board,
    total: ranked.length,
    me: mine ? { rank: mine.rank, points: mine.points, username: mine.username } : null,
    rows: ranked.slice(0, 50).map(({ userId: _id, ...row }) => row),
  };
}

export async function loadProfile(userId: string): Promise<ProfileSnap | null> {
  const sql = await getSql();
  await ensureProfile(userId);
  const rows = await sql<{
    display_name: string;
    username: string;
    image: string | null;
    member_no: number;
    created_at: unknown;
    prediction_points: number;
    referral_code: string;
    referral_points: number;
    avatar: string | null;
  }>`
    select display_name, username, image, member_no, created_at, prediction_points, referral_code, referral_points, avatar
    from profiles where user_id = ${userId}
  `;
  const p = rows[0];
  if (!p) return null;
  const callsRow = await sql<{ calls: number; wins: number; losses: number }>`
    select
      count(*)::int as calls,
      count(*) filter (where outcome = 'win')::int as wins,
      count(*) filter (where outcome = 'loss')::int as losses
    from positions where user_id = ${userId}
  `;
  const outcomes = await sql<{ outcome: string }>`
    select p.outcome
    from positions p
    join markets m on m.id = p.market_id
    where p.user_id = ${userId} and p.outcome is not null
    order by m.closes_at desc
    limit 80
  `;
  let streak = 0;
  for (const o of outcomes) {
    if (o.outcome === "win") streak += 1;
    else if (o.outcome === "loss") break;
  }
  const friends = await sql<{ n: number }>`
    select count(*)::int as n from profiles where referred_by = ${userId}
  `;
  const byLength = await sql<{ length_min: number; wins: number; losses: number }>`
    select m.length_min,
      count(*) filter (where p.outcome = 'win')::int as wins,
      count(*) filter (where p.outcome = 'loss')::int as losses
    from positions p
    join markets m on m.id = p.market_id
    where p.user_id = ${userId}
    group by m.length_min
  `;
  const accuracyByLength = LENGTHS.map((lengthMin) => {
    const row = byLength.find((r) => asLength(r.length_min) === lengthMin);
    const winsN = num(row?.wins);
    const lossesN = num(row?.losses);
    const decisiveN = winsN + lossesN;
    return {
      lengthMin,
      accuracy: decisiveN === 0 ? null : Math.round((winsN / decisiveN) * 1000) / 10,
    };
  });
  const wins = num(callsRow[0]?.wins);
  const losses = num(callsRow[0]?.losses);
  const decisive = wins + losses;
  return {
    displayName: p.display_name,
    username: p.username,
    image: p.image,
    memberNo: `USER_${String(num(p.member_no)).padStart(5, "0")}`,
    avatar: (AVATARS as readonly string[]).includes(p.avatar ?? "") ? (p.avatar as AvatarId) : null,
    lastSide: await lastSideFor(sql, userId),
    sinceYear: new Date(iso(p.created_at)).getUTCFullYear(),
    points: num(p.prediction_points),
    calls: num(callsRow[0]?.calls),
    wins,
    accuracy: decisive === 0 ? null : Math.round((wins / decisive) * 1000) / 10,
    accuracyByLength,
    streak,
    referralCode: p.referral_code,
    friends: num(friends[0]?.n),
    referralPoints: num(p.referral_points),
  };
}

async function lastSideFor(sql: Sql, userId: string): Promise<Side | null> {
  const rows = await sql<{ side: Side }>`
    select side from positions where user_id = ${userId} order by created_at desc limit 1
  `;
  return rows[0]?.side ?? null;
}

export async function setAvatar(userId: string, avatar: string): Promise<{ ok: boolean }> {
  if (!(AVATARS as readonly string[]).includes(avatar)) return { ok: false };
  const sql = await getSql();
  await ensureProfile(userId);
  await sql`update profiles set avatar = ${avatar} where user_id = ${userId}`;
  return { ok: true };
}
