import { useQuery } from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import { useCurrentUserState } from "@/lib/auth/use-current-user";
import { getHistory, useDemo } from "@/lib/pulse/source";
import { formatPrice, formatPts, formatSignedPts, formatUtc, outcomeWord, sideLabel } from "@/lib/pulse/format";
import { useTelegramBack } from "@/lib/pulse/telegram";
import type { HistoryDetail, HistoryRow } from "@/lib/pulse/types";
import { Art, SignInBlock } from "./chrome";
import { ShareActions } from "./share";

export function HistoryScreen() {
  const [on, setOn] = useState(false);
  useEffect(() => setOn(true), []);
  const { user, isPending } = useCurrentUserState();
  const demo = useDemo();
  const [filter, setFilter] = useState<"ALL" | 1 | 5 | 15>("ALL");
  const [code, setCode] = useState<string | null>(null);
  const back = () => setCode(null);
  useTelegramBack(code != null, back);

  if (!on || isPending) {
    return (
      <section>
        <h1 className="font-display text-title">HISTORY</h1>
        <p className="mt-4 font-mono text-meta text-secondary">SYNCING</p>
      </section>
    );
  }
  if (!user && !demo) return <SignInBlock kicker="ARCHIVE" title="YOUR CALLS LIVE HERE." />;

  return <HistoryLive code={code} filter={filter} onFilter={setFilter} onOpen={setCode} onBack={back} />;
}

function HistoryLive({
  code,
  filter,
  onFilter,
  onOpen,
  onBack,
}: {
  code: string | null;
  filter: "ALL" | 1 | 5 | 15;
  onFilter: (filter: "ALL" | 1 | 5 | 15) => void;
  onOpen: (code: string) => void;
  onBack: () => void;
}) {
  const demo = useDemo();
  const q = useQuery({
    queryKey: ["history", code, demo ? "demo" : "real"],
    refetchInterval: demo ? 3000 : undefined,
    queryFn: () => getHistory({ data: { code } }),
  });
  if (q.isPending || !q.data) {
    return (
      <section>
        <h1 className="font-display text-title">HISTORY</h1>
        <p className="mt-4 font-mono text-meta text-secondary">SYNCING</p>
      </section>
    );
  }
  if (code && q.data.detail) return <Detail row={q.data.detail} onBack={onBack} />;
  if (q.data.rows.length === 0) {
    return (
      <section className="pb-8">
        <h1 className="font-display text-title">HISTORY</h1>
        <div className="mt-6 border border-line">
          <Art src="/pulse/empty.jpg" />
          <div className="border-t border-line px-4 py-5">
            <h2 className="font-display text-3xl tracking-tight">NO CALLS YET.</h2>
            <p className="mt-2 font-mono text-meta text-secondary">YOUR FIRST ONE IS WAITING.</p>
          </div>
        </div>
        <Link to="/" className="mt-4 grid h-12 place-items-center bg-fg font-display text-base text-bg">
          VIEW LIVE MARKET
        </Link>
      </section>
    );
  }
  const live = q.data.rows.filter((r) => r.live);
  const rest = q.data.rows.filter((r) => !r.live);
  return (
    <section className="pb-6">
      <h1 className="font-display text-title">HISTORY</h1>
      <p className="mt-2 font-mono text-meta text-secondary">YOUR CALLS. NOTHING ELSE.</p>
      <div className="mt-4 flex gap-2" role="group" aria-label="Market length">
        {(["ALL", 1, 5, 15] as const).map((item) => (
          <button
            key={item}
            type="button"
            aria-pressed={filter === item}
            onClick={() => onFilter(item)}
            className={`h-9 px-3 font-mono text-meta ${filter === item ? "bg-fg text-bg" : "border border-line text-secondary"}`}
          >
            {item === "ALL" ? "ALL" : `${item}M`}
          </button>
        ))}
      </div>
      <VirtualRows rows={[...live, ...rest].filter((row) => filter === "ALL" || row.lengthMin === filter)} onOpen={onOpen} />
    </section>
  );
}

function VirtualRows({ rows, onOpen }: { rows: HistoryRow[]; onOpen: (code: string) => void }) {
  const ref = useRef<HTMLDivElement>(null);
  const [range, setRange] = useState({ start: 0, end: 16 });
  const rowHeight = 76;
  useEffect(() => {
    const root = ref.current?.closest("[data-scroll]");
    if (!root) return;
    const onScroll = () => {
      const top = ref.current?.offsetTop ?? 0;
      const view = root.scrollTop - top;
      const start = Math.max(0, Math.floor(view / rowHeight) - 3);
      const end = start + Math.ceil(root.clientHeight / rowHeight) + 8;
      setRange({ start, end });
    };
    onScroll();
    root.addEventListener("scroll", onScroll, { passive: true });
    return () => root.removeEventListener("scroll", onScroll);
  }, [rows.length]);
  const start = Math.min(range.start, rows.length);
  const end = Math.min(rows.length, range.end);
  return (
    <div ref={ref} className="relative mt-6" style={{ height: rows.length * rowHeight }}>
      {rows.slice(start, end).map((row, i) => (
        <div key={row.code} className="absolute inset-x-0" style={{ top: (start + i) * rowHeight, height: rowHeight }}>
          <button type="button" onClick={() => onOpen(row.code)} className="flex h-full w-full items-center justify-between gap-3 border-t border-line text-left">
            <span className="min-w-0">
              <span className="block truncate font-mono text-meta text-secondary">
                {row.live ? "LIVE · " : ""}
                {row.code} · {row.lengthMin}M · {formatUtc(row.closesAt)}
              </span>
              <span className={`mt-1 block font-display text-lg ${row.side === "up" ? "text-up" : "text-pulse"}`}>
                {sideLabel(row.side)}
              </span>
            </span>
            <span className="shrink-0 text-right">
              <span className="block font-mono text-meta text-secondary">{formatPts(row.stake)}</span>
              <span className="mt-1 block font-display text-sm tabular-nums">
                {row.net == null ? "—" : formatSignedPts(row.net)}
              </span>
              <span className={`block font-mono text-meta ${row.outcome === "win" ? "text-up" : row.outcome === "loss" ? "text-down" : "text-secondary"}`}>
                {outcomeWord(row.outcome)}
              </span>
            </span>
          </button>
        </div>
      ))}
    </div>
  );
}

function Detail({ row, onBack }: { row: HistoryDetail; onBack: () => void }) {
  return (
    <section className="pb-8">
      <button type="button" onClick={onBack} className="font-mono text-meta text-secondary">
        ← HISTORY
      </button>
      <h1 className="mt-4 font-display text-title">{row.code}</h1>
      <p className={`mt-2 font-display text-3xl ${row.side === "up" ? "text-up" : "text-pulse"}`}>{sideLabel(row.side)}</p>
      <p className="mt-4 font-mono text-meta text-fg">{outcomeWord(row.outcome)}</p>
      <dl className="mt-6 border-t border-line">
        <Row k="OPEN" v={row.openPrice != null ? formatPrice(row.openPrice) : "—"} />
        <Row k="CLOSE" v={row.closePrice != null ? formatPrice(row.closePrice) : "—"} />
        <Row k="RESULT" v={row.result ? row.result.toUpperCase() : "—"} />
        <Row k="DIRECTION" v={sideLabel(row.side)} />
        <Row k="STAKE" v={formatPts(row.stake)} />
        <Row k="PAYOUT" v={row.payout == null ? "—" : formatPts(row.payout)} />
        <Row k="NET" v={row.net == null ? "—" : formatSignedPts(row.net)} />
        <Row k="TIME" v={formatUtc(row.closesAt)} />
        <Row k="PARTICIPANTS" v={row.participants.toLocaleString("en-US")} />
        <Row k="UP POOL" v={formatPts(row.upPool)} />
        <Row k="DOWN POOL" v={formatPts(row.downPool)} />
      </dl>
      <ShareActions
        spec={{
          kind: row.live ? "call" : "result",
          code: row.code,
          side: row.side,
          openPrice: row.openPrice,
          closePrice: row.closePrice,
          outcome: row.outcome,
          net: row.net,
          stake: row.stake,
        }}
      />
    </section>
  );
}

function Row({ k, v }: { k: string; v: string }) {
  return (
    <div className="flex items-baseline justify-between gap-4 border-b border-line-soft py-3">
      <dt className="font-mono text-meta text-secondary">{k}</dt>
      <dd className="font-display text-sm tabular-nums">{v}</dd>
    </div>
  );
}
