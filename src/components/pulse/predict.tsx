import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useRef, useState } from "react";
import { PriceSheet } from "./price-sheet";
import { getPulse, placeCall, useDemo } from "@/lib/pulse/source";
import { useCurrentUserState } from "@/lib/auth/use-current-user";
import { formatClock, formatPct, formatPrice, formatPts, formatSignedPts, formatUtc, sideLabel } from "@/lib/pulse/format";
import { stakesFor, type LengthMin, type Side } from "@/lib/pulse/math";
import { haptic, useReducedMotion } from "@/lib/pulse/telegram";
import type { MarketSnap, PulseSnapshot, SettledCall } from "@/lib/pulse/types";
import { Art, Mark, PixelBar, PriceLine, SignInBlock, TickText, Wordmark } from "./chrome";
import { ShareActions } from "./share";
import { LineReplay, Welcome, ButterflyLoad } from "./welcome";

const REASON: Record<string, string> = {
  locked: "MARKET LOCKED.",
  balance: "NOT ENOUGH POINTS.",
  already: "CALL ALREADY IN.",
  closed: "MARKET CLOSED.",
  unavailable: "MARKET UNAVAILABLE.",
  rejected: "COULD NOT LOCK IN.",
  stale: "PRICE DELAYED. CALLS PAUSED.",
};

function useCrowdMotion(participants: number, upPool: number, downPool: number, reduced: boolean) {
  const prev = useRef({ participants, upPool, downPool, ready: false });
  const timer = useRef<number | null>(null);
  const [count, setCount] = useState(participants);
  const [dropSide, setDropSide] = useState<"up" | "down" | null>(null);
  const [dropKey, setDropKey] = useState(0);

  useEffect(() => {
    const past = prev.current;
    if (!past.ready) {
      prev.current = { participants, upPool, downPool, ready: true };
      setCount(participants);
      return;
    }
    const joined = participants > past.participants || upPool > past.upPool || downPool > past.downPool;
    if (joined) {
      if (!reduced) {
        setDropSide(upPool > past.upPool ? "up" : "down");
        setDropKey((key) => key + 1);
      }
      if (timer.current) window.clearInterval(timer.current);
      if (reduced || participants <= past.participants) {
        setCount(participants);
      } else {
        let n = past.participants;
        timer.current = window.setInterval(() => {
          n += 1;
          setCount(n);
          if (n >= participants && timer.current) {
            window.clearInterval(timer.current);
            timer.current = null;
          }
        }, 50);
      }
    } else if (participants !== past.participants) {
      setCount(participants);
    }
    prev.current = { participants, upPool, downPool, ready: true };
    return () => {
      if (timer.current) window.clearInterval(timer.current);
    };
  }, [participants, upPool, downPool, reduced]);

  return { count, dropSide, dropKey };
}

const INTRO_KEY = "pulse-intro-v3";
const SIDE_KEY = "pulse-last-side";
// Module-level: survives in-app navigation (PredictScreen unmounts/remounts) but resets on a real
// page load. The butterfly loader and intro only ever play once per app load.
let bootDone = false;

export function PredictScreen() {
  const { user, isPending } = useCurrentUserState();
  const demo = useDemo();
  const reduced = useReducedMotion();
  const q = useQuery({
    queryKey: ["pulse", demo ? "demo" : user?.id ?? "anon"],
    queryFn: () => getPulse(),
    refetchInterval: demo ? 1000 : 2000,
  });
  const opened = useRef(0);
  const released = useRef(bootDone);
  // null = not read yet (SSR / first paint): show the welcome so nothing else ever flashes first.
  // Returning via in-app navigation skips both the welcome and the butterfly cover.
  const [intro, setIntro] = useState<boolean | null>(bootDone ? false : null);
  const [cover, setCover] = useState<"on" | "out" | "off">(bootDone ? "off" : "on");
  const [slow, setSlow] = useState(false);
  const [tint, setTint] = useState<"none" | "up" | "down">("none");
  const [stuck, setStuck] = useState(false);

  useEffect(() => {
    opened.current = performance.now();
    try {
      if (!bootDone) setIntro(localStorage.getItem(INTRO_KEY) !== "1");
      const saved = localStorage.getItem(SIDE_KEY);
      if (saved === "up" || saved === "down") setTint(saved);
    } catch {
      setIntro(true);
    }
    const slowTimer = window.setTimeout(() => setSlow(true), 8000);
    const failTimer = window.setTimeout(() => setStuck(true), 5000);
    return () => {
      window.clearTimeout(slowTimer);
      window.clearTimeout(failTimer);
    };
  }, []);

  useEffect(() => {
    const snap = q.data;
    if (!snap) return;
    const side = snap.me?.holds[0]?.side ?? snap.recent?.side ?? null;
    try {
      if (side) localStorage.setItem(SIDE_KEY, side);
      else localStorage.removeItem(SIDE_KEY);
    } catch {
      /* ignore */
    }
    if (side) setTint(side);
  }, [q.data]);

  const ready = !!q.data;
  useEffect(() => {
    if (released.current || intro !== false || !ready) return;
    // loader butterfly forms in ~1.95s; hold it at least 2.1s so it is fully formed and flapping
    const min = reduced ? 0 : 2100;
    const wait = Math.max(0, min - (performance.now() - opened.current));
    const t = window.setTimeout(() => {
      released.current = true;
      setCover("out");
    }, wait);
    return () => window.clearTimeout(t);
  }, [intro, ready, reduced]);

  useEffect(() => {
    if (cover === "off") bootDone = true;
    if (cover !== "out") return;
    const t = window.setTimeout(() => setCover("off"), reduced ? 0 : 420);
    return () => window.clearTimeout(t);
  }, [cover, reduced]);

  const failed = stuck && q.isError && !q.isFetching && !q.data;
  const showMarket = ready && intro === false;
  const showButterfly = intro !== true && cover !== "off" && !failed;

  if (intro === null) return <div data-intro-cover className="fixed inset-0 z-40 bg-bg" aria-hidden />;
  if (intro) {
    return (
      <Welcome
        onDone={() => {
          try {
            localStorage.setItem(INTRO_KEY, "1");
          } catch {
            /* ignore */
          }
          setIntro(false);
        }}
      />
    );
  }

  return (
    <>
      {showMarket && q.data ? (
        <div aria-hidden={cover === "on"} className={cover === "on" ? "invisible" : undefined}>
          <PredictBody
            snap={q.data}
            receivedAt={q.dataUpdatedAt}
            authPending={isPending}
            signedIn={!!user || demo}
            updating={q.isFetching}
          />
        </div>
      ) : null}
      {failed ? (
        <StatusArt
          src="/pulse/signal.jpg"
          kicker="MARKET UNAVAILABLE"
          title="NO SIGNAL."
          action={{ label: "RETRY", onClick: () => void q.refetch() }}
        />
      ) : null}
      {showButterfly ? (
        <div className={`transition-opacity duration-500 ${cover === "out" ? "pointer-events-none opacity-0" : "opacity-100"}`}>
          <ButterflyLoad tint={user ? tint : "none"} slow={slow && !q.data} />
        </div>
      ) : null}
    </>
  );
}

function PredictBody({
  snap,
  receivedAt,
  authPending,
  signedIn,
  updating,
}: {
  snap: PulseSnapshot;
  receivedAt: number;
  authPending: boolean;
  signedIn: boolean;
  updating: boolean;
}) {
  const [length, setLength] = useState<LengthMin>(15);
  const [now, setNow] = useState(() => Date.now());
  const [dismissed, setDismissed] = useState<string | null>(() => {
    try {
      return sessionStorage.getItem("pulse-dismiss");
    } catch {
      return null;
    }
  });
  const [announce, setAnnounce] = useState("");
  useEffect(() => {
    const id = window.setInterval(() => setNow(Date.now()), 250);
    return () => window.clearInterval(id);
  }, []);
  const serverNow = Date.parse(snap.serverNow) + (now - receivedAt);
  const markets = snap.markets?.length ? snap.markets : snap.market ? [snap.market] : [];
  // No silent fallback: if the chosen length has no market yet, say so instead of showing another one.
  const market = markets.find((m) => m.lengthMin === length) ?? null;

  useEffect(() => {
    const id = window.setInterval(() => {
      if (!market || market.price == null) return;
      const closeMs = Date.parse(market.closesAt) - (Date.parse(snap.serverNow) + (Date.now() - receivedAt));
      setAnnounce(`Bitcoin ${formatPrice(market.price)}. Closes in ${formatClock(closeMs)}.`);
    }, 15000);
    return () => window.clearInterval(id);
  }, [market, snap.serverNow, receivedAt]);

  if (!market && markets.length) {
    return (
      <section className="pb-8">
        <DemoBadge /><MarketRows markets={markets} length={length} onLength={setLength} serverNow={serverNow} holds={snap.me?.holds ?? []} />
        <div data-no-market className="mt-6 border border-line px-4 py-8">
          <p className="font-mono text-meta text-secondary">{length}M MARKET</p>
          <h1 className="mt-3 font-display text-title">NO MARKET YET.</h1>
          <p className="mt-4 font-mono text-meta text-secondary">THE NEXT {length}M ROUND OPENS SHORTLY. PICK ANOTHER CARD OR WAIT.</p>
        </div>
      </section>
    );
  }

  if (!market) {
    return <StatusArt src="/pulse/signal.jpg" kicker="MARKET UNAVAILABLE" title="NO SIGNAL." action={null} />;
  }

  const settleOverdue = snap.settling ? serverNow - Date.parse(snap.settling.closesAt) > 20_000 : false;
  if (snap.settling && !(settleOverdue && dismissed === `settling:${snap.settling.code}`)) {
    return (
      <section>
        <Header points={snap.me?.points ?? null} inPlay={snap.me?.inPlay ?? 0} authPending={authPending} signedIn={signedIn} market={market} />
        <div className="relative mt-8 overflow-hidden border border-line">
          <div className="scan-line absolute inset-x-0 top-0 h-px bg-fg" />
          <div className="px-4 py-8">
            <p className="font-mono text-meta text-secondary">VERIFYING RESULT</p>
            <h1 className="mt-3 font-display text-title">WAITING ON THE CLOSE.</h1>
            <p className="mt-6 font-mono text-meta text-secondary">
              {snap.settling.code} · BTC/USD · {sideLabel(snap.settling.side)} · {formatPts(snap.settling.stake)}
            </p>
            {snap.settling.openPrice != null ? (
              <p className="mt-2 font-mono text-meta text-secondary">OPEN {formatPrice(snap.settling.openPrice)}</p>
            ) : null}
            {snap.settling.source ? (
              <p className="mt-2 font-mono text-meta text-muted">{snap.settling.source}</p>
            ) : null}
            {settleOverdue ? (
              <button
                type="button"
                data-settle-skip
                onClick={() => setDismissed(`settling:${snap.settling!.code}`)}
                className="mt-6 h-11 w-full border border-line font-mono text-meta text-fg"
              >
                STILL CHECKING THE PRICE. KEEP PLAYING · RESULT LANDS IN HISTORY
              </button>
            ) : null}
          </div>
        </div>
        <p className="sr-only" aria-live="polite">
          Verifying result for {snap.settling.code}.
        </p>
      </section>
    );
  }

  if (snap.recent && dismissed !== snap.recent.code && snap.recent.code !== market.code) {
    return (
      <ResultView
        call={snap.recent}
        onNext={() => {
          setDismissed(snap.recent!.code);
          sessionStorage.setItem("pulse-dismiss", snap.recent!.code);
        }}
      />
    );
  }

  return (
    <LiveMarket
      snap={snap}
      market={market}
      markets={markets}
      length={market.lengthMin}
      onLength={setLength}
      serverNow={serverNow}
      authPending={authPending}
      signedIn={signedIn}
      announce={announce}
      updating={updating}
    />
  );
}

function LiveMarket({
  snap,
  market,
  markets,
  length,
  onLength,
  serverNow,
  authPending,
  signedIn,
  announce,
  updating,
}: {
  snap: PulseSnapshot;
  market: MarketSnap;
  markets: MarketSnap[];
  length: LengthMin;
  onLength: (length: LengthMin) => void;
  serverNow: number;
  authPending: boolean;
  signedIn: boolean;
  announce: string;
  updating: boolean;
}) {
  const qc = useQueryClient();
  const reduced = useReducedMotion();
  const [side, setSide] = useState<Side | null>(null);
  const [stake, setStake] = useState<number | null>(null);
  const [busy, setBusy] = useState(false);
  const [note, setNote] = useState<string | null>(null);
  const [phase, setPhase] = useState<"idle" | "print" | "hold" | "tear">("idle");
  const [lit, setLit] = useState<number | null>(null);
  const [replay, setReplay] = useState(false);
  const [chart, setChart] = useState(false);
  const [details, setDetails] = useState(false);
  const stageRef = useRef<HTMLElement>(null);
  const fxRef = useRef<HTMLCanvasElement>(null);
  const frozen = useRef<MarketSnap | null>(null);
  const shown = phase === "idle" ? market : (frozen.current ?? market);
  const closeMs = Date.parse(market.closesAt) - serverNow;
  const lockMs = Date.parse(market.locksAt) - serverNow;
  const urgentLimit = length === 1 ? 10000 : 60000;
  const urgent = market.status === "open" ? lockMs < urgentLimit : closeMs < urgentLimit;
  const locked = market.status !== "open" || snap.priceAgeMs > 2000;
  const total = shown.upPool + shown.downPool;
  const upPct = total > 0 ? (shown.upPool / total) * 100 : 0;
  const price = market.price;
  const open = market.openPrice;
  const change = price != null && open != null && open !== 0 ? ((price - open) / open) * 100 : null;
  const points = snap.me?.points ?? null;

  // print (250ms) -> hold (300ms) -> tear. Each step owns its own timer so a phase change can't
  // cancel the next step (the old single effect cleared its own timers on print -> hold).
  useEffect(() => {
    if (phase === "print") {
      haptic("confirm");
      const t = window.setTimeout(() => setPhase("hold"), reduced ? 0 : 250);
      return () => window.clearTimeout(t);
    }
    if (phase === "hold") {
      const t = window.setTimeout(() => setPhase("tear"), reduced ? 0 : 300);
      return () => window.clearTimeout(t);
    }
    if (phase === "tear") {
      // Reduced motion: no flight, the bar just updates. Otherwise the stream landing ends the
      // sequence (tear effect below); this is only a safety net.
      const t = window.setTimeout(() => {
        frozen.current = null;
        setPhase("idle");
      }, reduced ? 300 : 4000);
      return () => window.clearTimeout(t);
    }
  }, [phase, reduced]);

  useEffect(() => {
    if (phase !== "tear" || reduced) return;
    const root = stageRef.current;
    const canvas = fxRef.current;
    const body = root?.querySelector("[data-ticket-body]");
    if (!root || !canvas || !(body instanceof HTMLElement)) return;
    let stop = () => {};
    let dead = false;
    void import("@/lib/pulse/motion").then((motion) => {
      if (dead) return;
      const poof = new motion.TicketPoof(canvas);
      stop = motion.watch((t: number) => {
        poof.update(t);
        poof.render();
      });
      // Reference callSide(): body shrinks to 0.55 (300ms, inOutCubic), then poofs into dots that
      // stream into the 2nd block from the divide on the user's side of the crowd bar.
      body.style.transformOrigin = "center";
      const shrink = body.animate([{ transform: "scale(1)" }, { transform: "scale(0.55)" }], {
        duration: 300,
        easing: "cubic-bezier(0.65, 0, 0.35, 1)",
        fill: "forwards",
      });
      void shrink.finished.then(() => {
        if (dead) return;
        const src = box(body, root);
        body.style.visibility = "hidden";
        // Only the main crowd bar: the market rows above render their own mini PixelBars.
        const cells = [...root.querySelectorAll<HTMLElement>("[data-crowd-bar] [data-cell]")];
        const ups = cells.filter((c) => c.dataset.side === "up");
        const downs = cells.filter((c) => c.dataset.side === "down");
        const cell =
          side === "down"
            ? (downs[1] ?? downs[0] ?? cells[cells.length - 1])
            : (ups[Math.max(0, ups.length - 2)] ?? ups.at(-1) ?? cells[0]);
        if (!cell) return;
        poof.poof(src, box(cell, root), "#F1F0EA", () => {
          const idx = Number(cell.dataset.cell);
          const lit = side === "down" ? "rgb(168, 57, 74)" : "rgb(205, 243, 138)";
          // flash: near off-white for ~250ms easing into the lit colour, which persists
          const flash = cell.animate([{ backgroundColor: "rgb(241, 240, 234)" }, { backgroundColor: lit }], {
            duration: 250,
            easing: "cubic-bezier(0.32, 0, 0.67, 0)",
          });
          void flash.finished.then(() => {
            if (!Number.isNaN(idx)) setLit(idx);
            frozen.current = null;
            setPhase("idle");
          });
        });
      });
    });
    return () => {
      dead = true;
      stop();
    };
  }, [phase, reduced, side]);

  const position = snap.me?.holds?.find((hold) => hold.code === market.code) ?? null;
  const activity = snap.activities?.find((row) => row.code === market.code)?.items ?? snap.activity;
  const stale = snap.priceAgeMs > 2000;
  const crowd = useCrowdMotion(shown.participants, shown.upPool, shown.downPool, reduced);

  async function submit() {
    if (!side || !stake || locked || busy) return;
    setBusy(true);
    setNote(null);
    frozen.current = market;
    const res = await placeCall({ data: { side, stake, code: market.code } }).catch(() => null);
    setBusy(false);
    if (!res || !res.ok) {
      frozen.current = null;
      setNote(res && !res.ok ? REASON[res.reason] : "COULD NOT LOCK IN.");
      return;
    }
    await qc.invalidateQueries({ queryKey: ["pulse"] });
    setPhase("print");
  }

  return (
    <section ref={stageRef} className="relative pb-8">
      <canvas ref={fxRef} className="pointer-events-none absolute inset-0 z-20 h-full w-full" aria-hidden />
      {replay ? <LineReplay onClose={() => setReplay(false)} /> : null}
      {chart ? <PriceSheet market={market} serverNow={serverNow} onClose={() => setChart(false)} /> : null}
      <Header
        points={points}
        inPlay={snap.me?.inPlay ?? 0}
        authPending={authPending}
        signedIn={signedIn}
        market={market}
        feed={snap.feed}
        onReplay={() => setReplay(true)}
      />
      <DemoBadge /><MarketRows markets={markets} length={length} onLength={onLength} serverNow={serverNow} holds={snap.me?.holds ?? []} />
      <StatusPanel market={market} lockMs={lockMs} closeMs={closeMs} />
      <div className="md:grid md:grid-cols-2 md:items-start md:gap-12">
      <div>
      <div className="relative mt-5">
        <div className="pointer-events-none absolute inset-x-0 top-7 h-16">
          <PriceLine samples={market.samples} urgent={urgent && market.status !== "settling"} />
        </div>
        <p className="relative font-mono text-meta text-secondary">BTC / USD</p>
        {price != null ? (
          <>
            <button type="button" data-price-tap aria-label="Open live chart" className="relative block text-left" onClick={() => setChart(true)}>
              <TickText value={formatPrice(price)} className="relative text-price text-fg [&>span]:bg-bg" />
            </button>
            <p className="sr-only">Bitcoin {formatPrice(price)}</p>
          </>
        ) : (
          <p className="font-display text-price text-muted" aria-hidden>
            ——,———.——
          </p>
        )}
        {change != null ? (
          <p className={`relative mt-2 w-fit bg-bg font-mono text-meta ${change > 0 ? "text-up" : change < 0 ? "text-pulse" : "text-secondary"}`}>
            {change > 0 ? "▲ " : change < 0 ? "▼ " : ""}
            {formatPct(change)}
            <span className="sr-only">{change > 0 ? " up" : change < 0 ? " down" : ""}</span>
          </p>
        ) : null}
        <p className="relative mt-2 w-fit bg-bg font-mono text-meta text-secondary">
          PRICE {(snap.priceAgeMs / 1000).toFixed(1)}s AGO
          {updating ? <span className="ml-3">UPDATING</span> : null}
        </p>
      </div>

      {details ? (
      <>
      <div className="mt-6">
        <p className="font-mono text-meta text-secondary">MARKET CLOSE</p>
        <TickText value={formatClock(closeMs)} className={`text-clock ${urgent ? "text-pulse" : "text-fg"}`} />
        <p className="sr-only">Closes in {formatClock(closeMs)}</p>
        {market.status === "open" ? (
          <p className={`mt-2 font-mono text-meta ${urgent ? "text-pulse" : "text-secondary"}`}>
            LOCKS IN {formatClock(lockMs)}
          </p>
        ) : null}
      </div>

      <div className="mt-4 flex items-baseline justify-between gap-3 font-mono text-meta">
        <span className="text-secondary">{open != null ? `OPEN ${formatPrice(open)}` : "OPEN —"}</span>
        <span className="text-secondary">
          {snap.feed === "reconnecting" ? "RECONNECTING" : market.source ?? ""}
        </span>
      </div>
      </>
      ) : null}
      <p className="sr-only" aria-live="polite">
        {announce}
      </p>

      {stale ? (
        <p className="mt-6 border-t border-pulse pt-3 font-mono text-meta text-pulse">PRICE DELAYED. CALLS PAUSED.</p>
      ) : locked ? (
        <p className="mt-6 border-t border-pulse pt-3 font-mono text-meta text-pulse">
          {market.status === "open" ? "TOO LATE. MARKET LOCKED." : "MARKET LOCKED. WAITING ON CLOSE."}
        </p>
      ) : null}

      <div className="mt-6">
        <Mark n="01" label="THE CROWD" />
        <div data-crowd-bar>
          <PixelBar upPct={upPct} empty={total === 0} dropSide={crowd.dropSide} dropKey={crowd.dropKey} litIndex={lit} />
        </div>
        <p className="mt-3 font-mono text-meta text-fg">
          {total === 0
            ? "WAITING ON THE FIRST CALL"
            : `${crowd.count.toLocaleString("en-US")} IN · ${Math.round(upPct)}% OF POOL UP`}
          {total > 0 && shown.participants < 5 ? " · SMALL POOL" : ""}
        </p>
        {details ? (
        <dl className="mt-4 grid grid-cols-3 gap-2 border-t border-line-soft pt-3">
          <PoolStat label="UP ↑" value={formatPts(shown.upPool)} />
          <PoolStat label="DOWN ↓" value={formatPts(shown.downPool)} />
          <PoolStat label="TOTAL" value={formatPts(total)} />
        </dl>
        ) : null}
      </div>
      </div>

      <div className="mt-6">
        <Mark n="02" label="YOUR CALL" />
        {position && phase === "idle" ? (
          <PositionCard market={market} position={position} />
        ) : phase !== "idle" && side && stake ? (
          <div className={phase === "tear" && reduced ? "ticket-tear" : "pt-print"}>
            <Ticket
              market={market}
              side={side}
              stake={stake}
              share={position?.share}
              est={position?.estReturn}
              serial={position?.serial ?? "SN-·····"}
            />
          </div>
        ) : (
          <CallForm
            market={market}
            side={side}
            stake={stake}
            points={points}
            locked={locked}
            busy={busy}
            signedIn={signedIn}
            authPending={authPending}
            note={note}
            onSide={(next) => {
              haptic("select");
              setSide(next);
            }}
            onStake={(next) => {
              haptic("select");
              setStake(next);
            }}
            length={length}
            lockMs={lockMs}
            stale={stale}
            onSubmit={() => void submit()}
          />
        )}
        {signedIn && points != null && points < 10 && (snap.me?.inPlay ?? 0) === 0 ? (
          <p className="mt-3 font-mono text-meta text-pulse">OUT OF POINTS. BACK TOMORROW WITH 1,000.</p>
        ) : null}
      </div>
      </div>

      <button
        type="button"
        data-details-toggle
        aria-expanded={details}
        onClick={() => setDetails((d) => !d)}
        className="mt-8 h-11 w-full border border-line font-mono text-meta text-secondary"
      >
        {details ? "HIDE DETAILS ▴" : "SHOW DETAILS ▾"}
      </button>
      {details ? (
      <div className="mt-8 pb-4">
        <Mark n="03" label="LIVE" />
        {activity.length === 0 ? (
          <p className="font-mono text-meta text-secondary">NO CALLS ON THIS MARKET.</p>
        ) : (
          <ul>
            {activity.map((item, i) => (
              <li
                key={`${item.at}-${item.username}-${i}`}
                className="flex items-baseline justify-between border-b border-line-soft py-3 font-mono text-meta"
              >
                <span className="text-fg">@{item.username}</span>
                <span className={item.side === "up" ? "text-up" : "text-pulse"}>
                  {sideLabel(item.side)}
                  <span className="ml-3 text-secondary">{item.stake.toLocaleString("en-US")}</span>
                </span>
              </li>
            ))}
          </ul>
        )}
      </div>
      ) : null}
    </section>
  );
}

function Header({
  points,
  inPlay,
  authPending,
  signedIn,
  market,
  feed,
  onReplay,
}: {
  points: number | null;
  inPlay: number;
  authPending: boolean;
  signedIn: boolean;
  market?: MarketSnap | null;
  feed?: string;
  onReplay?: () => void;
}) {
  return (
    <header>
      <div className="flex items-baseline justify-between gap-3">
        <Wordmark onReplay={onReplay} />
        <div className="text-right">
          <p className="font-display text-base tabular-nums">
            {authPending || (signedIn && points == null) ? (
              <span className="text-secondary">···· PTS</span>
            ) : signedIn && points != null ? (
              formatPts(points)
            ) : (
              <a href="/login" className="font-mono text-meta text-secondary">
                SIGN IN
              </a>
            )}
          </p>
          {inPlay > 0 ? <p className="font-mono text-meta text-secondary">IN PLAY {inPlay.toLocaleString("en-US")}</p> : null}
        </div>
      </div>
      <p className="mt-2 font-mono text-meta text-secondary">
        BTC/USD
        {market ? ` · ${market.code} · ${market.lengthMin}M` : ""}
        {feed === "reconnecting" ? " · RECONNECTING" : ""}
      </p>
    </header>
  );
}

function MarketRows({
  markets,
  length,
  onLength,
  serverNow,
  holds,
}: {
  markets: MarketSnap[];
  length: LengthMin;
  onLength: (length: LengthMin) => void;
  serverNow: number;
  holds: { code: string }[];
}) {
  const rail = useRef<HTMLDivElement>(null);
  // Picker 1B: horizontal snap cards. Swiping settles the centred card as the selection.
  useEffect(() => {
    const el = rail.current;
    if (!el) return;
    let t = 0;
    const onScroll = () => {
      window.clearTimeout(t);
      t = window.setTimeout(() => {
        const mid = el.scrollLeft + el.clientWidth / 2;
        let best: LengthMin = length, bestD = Infinity;
        for (const card of Array.from(el.children) as HTMLElement[]) {
          const d = Math.abs(card.offsetLeft + card.offsetWidth / 2 - mid);
          if (d < bestD) { bestD = d; best = Number(card.dataset.len) as LengthMin; }
        }
        if (best !== length) onLength(best);
      }, 120);
    };
    el.addEventListener("scroll", onScroll, { passive: true });
    return () => { el.removeEventListener("scroll", onScroll); window.clearTimeout(t); };
  }, [length, onLength]);
  useEffect(() => {
    const card = rail.current?.querySelector<HTMLElement>(`[data-len="${length}"]`);
    card?.scrollIntoView?.({ inline: "center", block: "nearest", behavior: "smooth" });
  }, [length]);
  return (
    <div
      ref={rail}
      role="radiogroup"
      aria-label="Market length"
      className="-mx-4 mt-4 flex snap-x snap-mandatory gap-3 overflow-x-auto px-4 pb-2 [scrollbar-width:none]"
    >
      {([1, 5, 15] as const).map((len) => {
        const row = markets.find((m) => m.lengthMin === len);
        const close = row ? Date.parse(row.closesAt) - serverNow : 0;
        const lockIn = row ? Date.parse(row.locksAt) - serverNow : 0;
        const span = row ? Date.parse(row.closesAt) - Date.parse(row.opensAt) : 1;
        const done = row ? Math.min(1, Math.max(0, 1 - close / span)) : 0;
        const total = row ? row.upPool + row.downPool : 0;
        const up = total > 0 ? (row!.upPool / total) * 100 : 0;
        const held = row ? holds.some((h) => h.code === row.code) : false;
        const active = length === len;
        const locked = row ? row.status !== "open" || lockIn <= 0 : false;
        return (
          <button
            key={len}
            data-len={len}
            type="button"
            role="radio"
            aria-checked={active}
            onClick={() => onLength(len)}
            className={`relative w-[78%] max-w-[300px] shrink-0 snap-center border px-4 py-3 text-left transition-colors ${
              active ? "border-fg bg-[#111] text-fg" : "border-line text-secondary opacity-70"
            }`}
          >
            <span className="flex items-center justify-between font-mono text-meta">
              <span>{len}M{len === 1 ? " FAST" : ""}</span>
              <span>{active ? "● SELECTED" : held ? "LIVE" : row ? (locked ? "LOCKED" : "OPEN") : ""}</span>
            </span>
            <span className="mt-2 block font-display text-3xl tabular-nums">{row ? formatClock(close) : "--:--"}</span>
            <span className="mt-1 block font-mono text-meta">
              {!row ? "NO MARKET YET" : locked ? "LOCKED · SETTLES AT ZERO" : `LOCKS IN ${formatClock(lockIn)}`}
            </span>
            <span className="mt-2 block h-[3px] bg-line">
              <span className="block h-full bg-fg" style={{ width: `${done * 100}%` }} />
            </span>
            <span className="mt-3 block">
              <PixelBar upPct={up} empty={!row || total === 0} calm />
            </span>
            <span className="mt-1 flex justify-between font-mono text-meta">
              <span>{total ? `UP ${Math.round(up)}%` : "NO CALLS YET"}</span>
              <span>{row ? `${row.participants} IN` : ""}</span>
            </span>
          </button>
        );
      })}
    </div>
  );
}

function shortClock(ms: number): string {
  const s = Math.max(0, Math.floor(ms / 1000));
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;
}

/** Beginner summary: one big status, one countdown, both pots, one line. */
function StatusPanel({ market, lockMs, closeMs }: { market: MarketSnap; lockMs: number; closeMs: number }) {
  const status = market.status === "settled" || closeMs <= 0 ? "SETTLED" : market.status === "open" && lockMs > 0 ? "OPEN" : "LOCKED";
  const tone = status === "OPEN" ? "text-up" : status === "LOCKED" ? "text-pulse" : "text-fg";
  return (
    <div data-status-panel className="mt-5 border border-line px-4 py-4">
      <div className="flex items-baseline justify-between gap-3">
        <p data-status className={`font-display text-4xl font-bold leading-none tracking-tight ${tone}`}>{status}</p>
        <p className="text-right font-mono text-meta text-secondary">
          {status === "OPEN" ? "CALLS CLOSE IN" : status === "LOCKED" ? "RESULT IN" : "NEXT ROUND"}
          <span className="block font-display text-2xl tabular-nums text-fg">
            {status === "OPEN" ? shortClock(lockMs) : status === "LOCKED" ? shortClock(closeMs) : "NOW"}
          </span>
        </p>
      </div>
      <dl className="mt-4 grid grid-cols-2 gap-2">
        <div className="border-l-2 border-up pl-3">
          <dt className="font-mono text-meta text-secondary">UP POT</dt>
          <dd className="font-display text-xl tabular-nums text-up">{market.upPool.toLocaleString("en-US")}</dd>
        </div>
        <div className="border-l-2 border-down pl-3">
          <dt className="font-mono text-meta text-secondary">DOWN POT</dt>
          <dd className="font-display text-xl tabular-nums text-fg">{market.downPool.toLocaleString("en-US")}</dd>
        </div>
      </dl>
      <p className="mt-3 font-mono text-meta text-fg">Pick a side. Winners split the pot.</p>
    </div>
  );
}

function PoolStat({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt className="font-mono text-meta text-secondary">{label}</dt>
      <dd className="mt-1 font-display text-sm tabular-nums">{value.replace(" PTS", "")}</dd>
    </div>
  );
}

function CallForm({
  market,
  side,
  stake,
  points,
  locked,
  busy,
  signedIn,
  authPending,
  note,
  onSide,
  onStake,
  length,
  lockMs,
  stale,
  onSubmit,
}: {
  market: MarketSnap;
  side: Side | null;
  stake: number | null;
  points: number | null;
  locked: boolean;
  busy: boolean;
  signedIn: boolean;
  authPending: boolean;
  note: string | null;
  onSide: (s: Side) => void;
  onStake: (n: number) => void;
  length: LengthMin;
  lockMs: number;
  stale: boolean;
  onSubmit: () => void;
}) {
  const left = locked ? null : shortClock(lockMs);
  const total = market.upPool + market.downPool;
  const upPct = total > 0 ? Math.round((market.upPool / total) * 100) : null;
  const downPct = upPct == null ? null : 100 - upPct;
  return (
    <div>
      <div className="grid grid-cols-2 gap-2">
        <SideButton
          side="up"
          pct={upPct}
          pool={market.upPool}
          left={left}
          selected={side === "up"}
          disabled={locked}
          onClick={() => onSide("up")}
        />
        <SideButton
          side="down"
          pct={downPct}
          pool={market.downPool}
          left={left}
          selected={side === "down"}
          disabled={locked}
          onClick={() => onSide("down")}
        />
      </div>
      <div className="mt-3 grid grid-cols-5 gap-2" role="group" aria-label="Stake">
        {stakesFor(length).map((n) => {
          const poor = points != null && n > points;
          const selected = stake === n;
          return (
            <button
              key={n}
              type="button"
              disabled={locked || poor || stale}
              aria-pressed={selected}
              onClick={() => onStake(n)}
              className={`h-11 font-display text-sm tabular-nums ${
                selected
                  ? "bg-fg text-bg"
                  : poor || locked
                    ? "border border-line-soft text-muted"
                    : "border border-line text-fg"
              }`}
            >
              {n}
            </button>
          );
        })}
      </div>
      {points != null || signedIn ? (
        <p className="mt-3 font-mono text-meta text-secondary">
          {points != null ? `BALANCE ${formatPts(points)}` : "BALANCE ····"}
        </p>
      ) : null}
      {signedIn ? (
        <button
          type="button"
          disabled={locked || busy || !side || !stake || authPending}
          onClick={onSubmit}
          className="mt-4 h-12 w-full bg-fg font-display text-base tracking-tight text-bg disabled:bg-elevated disabled:text-muted"
        >
          {busy ? "LOCKING IN…" : "MAKE YOUR CALL"}
        </button>
      ) : (
        <a
          href="/login"
          className="mt-4 grid h-12 place-items-center bg-fg font-display text-base tracking-tight text-bg"
        >
          SIGN IN TO CALL
        </a>
      )}
      {note ? <p className="mt-3 font-mono text-meta text-pulse">{note}</p> : null}
    </div>
  );
}

function SideButton({
  side,
  pct,
  pool,
  left,
  selected,
  disabled,
  onClick,
}: {
  side: Side;
  pct: number | null;
  pool: number;
  left: string | null;
  selected: boolean;
  disabled: boolean;
  onClick: () => void;
}) {
  const up = side === "up";
  return (
    <button
      type="button"
      disabled={disabled}
      aria-pressed={selected}
      onClick={onClick}
      className={`flex min-h-32 flex-col justify-end border px-3 py-4 text-left disabled:text-muted ${
        selected
          ? up
            ? "border-up bg-up text-bg"
            : "border-down bg-down text-fg"
          : "border-line text-fg"
      }`}
    >
      <span className="font-display text-4xl font-bold leading-none tracking-tight">
        {up ? "UP" : "DOWN"}
        <span
          className={`inline-block ${
            selected ? (up ? "motion-safe:-translate-y-0.5" : "motion-safe:translate-y-0.5") : ""
          }`}
        >
          {up ? " ↑" : " ↓"}
        </span>
      </span>
      <span data-call-countdown className={`mt-2 block font-mono text-meta ${selected && up ? "text-bg" : "text-fg"}`}>
        {left ? `CALL ${up ? "UP" : "DOWN"} · ${left} LEFT` : "LOCKED"}
      </span>
      <span className={`mt-1 block font-mono text-meta ${selected && up ? "text-bg" : "text-secondary"}`}>
        {pct == null ? "—" : `${pct}%`} · {pool.toLocaleString("en-US")}
      </span>
      {selected ? (
        <span className={`mt-2 block font-mono text-meta ${selected && up ? "text-bg" : "text-fg"}`}>SELECTED</span>
      ) : null}
    </button>
  );
}

function box(el: HTMLElement, root: HTMLElement) {
  const a = root.getBoundingClientRect();
  const r = el.getBoundingClientRect();
  return { x: r.left - a.left, y: r.top - a.top, w: r.width, h: r.height };
}

function PositionCard({
  market,
  position,
}: {
  market: MarketSnap;
  position: NonNullable<PulseSnapshot["me"]>["position"];
}) {
  if (!position) return null;
  return (
    <div>
      <Ticket
        market={market}
        side={position.side}
        stake={position.stake}
        share={position.share}
        est={position.estReturn}
        serial={position.serial}
        steady
      />
      <ShareActions
        spec={{
          kind: "call",
          code: market.code,
          side: position.side,
          openPrice: market.openPrice,
          stake: position.stake,
        }}
      />
    </div>
  );
}

function Ticket({
  market,
  side,
  stake,
  share,
  est,
  serial,
  steady,
  hideBody,
}: {
  market: MarketSnap;
  side: Side;
  stake: number;
  share?: number;
  est?: number;
  serial: string;
  steady?: boolean;
  hideBody?: boolean;
}) {
  const up = side === "up";
  // Structure and styling mirror the reference ticket (.pt in styles.css): stub, die-cut
  // perforation, body with inner frame, serial, barcode, vertical label, single red detail.
  return (
    <article className={`pt${steady ? " steady" : ""}`}>
      <div className="pt-stub">
        <div>
          <p className="pt-row">YOUR CALL</p>
          <p className="pt-side">{up ? "UP ↑" : "DOWN ↓"}</p>
        </div>
        <div>
          <p className="pt-row">
            <b>{formatPts(stake)}</b>
          </p>
          <p className="pt-row">
            POSITION
            <br />
            {market.status === "open" ? "ACTIVE" : "LOCKED"}
          </p>
        </div>
      </div>
      <div className="pt-perf" />
      <div data-ticket-body className={`pt-body${hideBody ? " invisible" : ""}`}>
        <span className="pt-serial">{serial}</span>
        <p className="pt-row">
          <b>PULSE / {market.code} · {market.lengthMin}M</b>
        </p>
        <p className="pt-row">BTC / USD</p>
        <p className="pt-row">
          OPEN <b>{market.openPrice != null ? formatPrice(market.openPrice) : "—"}</b>
        </p>
        <p className="pt-row">
          SHARE OF {up ? "UP" : "DOWN"} POOL <b>{share != null ? `${share.toFixed(1)}%` : "—"}</b>
        </p>
        <p className="pt-row">
          EST. RETURN IF CLOSED NOW <b>{est != null ? `~${formatPts(est)}` : "—"}</b>
        </p>
        <div className="pt-bar" aria-hidden />
        <span className="pt-vert" aria-hidden>
          PULSE PASS
        </span>
        <span className="pt-red" aria-hidden />
      </div>
      <p className="sr-only">{sideLabel(side)}</p>
    </article>
  );
}

function ResultView({ call, onNext }: { call: SettledCall; onNext: () => void }) {
  const reduced = useReducedMotion();
  const win = call.outcome === "win";
  const loss = call.outcome === "loss";
  const draw = call.outcome === "draw";
  const cancelled = call.outcome === "cancelled";
  const src = win ? "/pulse/win.jpg" : loss ? "/pulse/loss.jpg" : cancelled ? "/pulse/signal.jpg" : "/pulse/draw.jpg";
  const title = win
    ? `CALLED IT. ${formatSignedPts(call.net)}`
    : loss
      ? `NOT THIS TIME. ${formatSignedPts(call.net)}`
      : draw
        ? "DRAW. STAKE REFUNDED."
        : cancelled
          ? "MARKET CANCELLED. STAKE RETURNED."
          : "VOID. STAKE REFUNDED.";
  const line = `${call.openPrice != null ? `OPEN ${formatPrice(call.openPrice)}` : "OPEN —"}${
    call.closePrice != null ? ` → CLOSE ${formatPrice(call.closePrice)}` : ""
  } · ${formatUtc(call.closesAt)}${call.source ? ` · ${call.source}` : ""}`;
  const [phase, setPhase] = useState<"black" | "type" | "show">(reduced ? "show" : "black");
  const [typed, setTyped] = useState(reduced ? line : "");

  useEffect(() => {
    if (reduced) return;
    const t = window.setTimeout(() => setPhase("type"), 500);
    return () => window.clearTimeout(t);
  }, [reduced]);

  useEffect(() => {
    if (phase !== "type") return;
    if (typed.length >= line.length) {
      const t = window.setTimeout(() => setPhase("show"), 120);
      return () => window.clearTimeout(t);
    }
    const t = window.setTimeout(() => setTyped(line.slice(0, typed.length + 1)), 28);
    return () => window.clearTimeout(t);
  }, [phase, typed, line]);

  return (
    <section className="pb-8">
      <p className="sr-only">
        {title}. {line}
      </p>
      <Wordmark />
      {phase === "black" ? <div className="mt-6 min-h-80 bg-bg" /> : null}
      {phase !== "black" ? (
        <p className="mt-8 min-h-6 font-mono text-meta text-secondary" aria-hidden>
          {phase === "show" ? line : typed}
        </p>
      ) : null}
      {phase === "show" ? (
        <>
          <div className="mt-4 border border-line">
            <Art src={src} />
            <div className={`border-t px-4 py-5 ${win ? "border-up" : "border-line"}`}>
              <h1 className={`font-display text-title text-balance ${loss ? "text-secondary" : "text-fg"}`}>{title}</h1>
              {win ? <p className="mt-3 font-mono text-meta text-up">PAYOUT {formatPts(call.payout)}</p> : null}
              <p className="mt-2 font-mono text-meta text-secondary">
                {call.code} · {sideLabel(call.side)} · {formatPts(call.stake)}
              </p>
            </div>
          </div>
          <ShareActions
            spec={{
              kind: "result",
              code: call.code,
              side: call.side,
              openPrice: call.openPrice,
              closePrice: call.closePrice,
              outcome: call.outcome,
              net: call.net,
              stake: call.stake,
            }}
          />
          <button type="button" onClick={onNext} className="mt-3 h-12 w-full bg-fg font-display text-base text-bg">
            NEXT MARKET
          </button>
        </>
      ) : null}
    </section>
  );
}

function DemoBadge() {
  const on = useDemo();
  if (!on) return null;
  return (
    <p data-demo-badge className="mt-3 font-mono text-meta">
      <span className="border border-fg px-2 py-1 text-fg">DEMO · 1,001 PLAYERS · LIVE BTC</span>
    </p>
  );
}

export function StatusArt({
  src,
  kicker,
  title,
  action,
}: {
  src: string;
  kicker: string;
  title: string;
  action: { label: string; onClick: () => void } | null;
}) {
  return (
    <section className="pb-8">
      <Wordmark />
      <div className="mt-6 border border-line">
        <Art src={src} />
        <div className="border-t border-line px-4 py-5">
          <p className="font-mono text-meta text-pulse">{kicker}</p>
          <h1 className="mt-3 font-display text-title">{title}</h1>
        </div>
      </div>
      {action ? (
        <button type="button" onClick={action.onClick} className="mt-4 h-12 w-full bg-fg font-display text-base text-bg">
          {action.label}
        </button>
      ) : null}
    </section>
  );
}

export function PredictGate() {
  return <SignInBlock kicker="PULSE" title="SEE THE CROWD." />;
}
