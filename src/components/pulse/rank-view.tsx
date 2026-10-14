import { useQuery } from "@tanstack/react-query";
import { useEffect, useRef, useState } from "react";
import { useCurrentUserState } from "@/lib/auth/use-current-user";
import { getRank } from "@/lib/pulse/api";
import { formatPts } from "@/lib/pulse/format";
import type { RankBoard } from "@/lib/pulse/types";

export function RankScreen() {
  const [on, setOn] = useState(false);
  useEffect(() => setOn(true), []);
  const { user } = useCurrentUserState();
  const [board, setBoard] = useState<RankBoard>("main");
  const q = useQuery({
    queryKey: ["rank", board, user?.id ?? "anon"],
    queryFn: () => getRank({ data: { board } }),
    enabled: on,
  });
  const meRef = useRef<HTMLLIElement>(null);
  const [pin, setPin] = useState(false);

  useEffect(() => {
    const root = meRef.current?.closest("[data-scroll]");
    const el = meRef.current;
    if (!root || !el) return;
    const io = new IntersectionObserver(([entry]) => setPin(!entry.isIntersecting), { root, threshold: 1 });
    io.observe(el);
    return () => io.disconnect();
  }, [q.data]);

  if (!on || q.isPending || !q.data) {
    return (
      <section>
        <h1 className="font-display text-title">RANK</h1>
        <p className="mt-3 font-mono text-meta text-secondary">THE CROWD, SORTED.</p>
        <p className="mt-6 font-mono text-meta text-secondary">SYNCING</p>
      </section>
    );
  }
  const data = q.data;
  const mineInList = data.rows.some((r) => r.mine);
  return (
    <section className="pb-20">
      <h1 className="font-display text-title">RANK</h1>
      <p className="mt-3 max-w-[14rem] font-display text-2xl tracking-tight text-secondary">THE CROWD, SORTED.</p>
      <p className="mt-3 font-mono text-meta text-secondary">{data.timeframe}</p>
      <div className="mt-4 flex gap-2" role="group" aria-label="Rank board">
        {(
          [
            ["main", "5M · 15M"],
            ["fast", "1M"],
          ] as const
        ).map(([id, label]) => (
          <button
            key={id}
            type="button"
            aria-pressed={board === id}
            onClick={() => setBoard(id)}
            className={`h-9 px-3 font-mono text-meta ${board === id ? "bg-fg text-bg" : "border border-line text-secondary"}`}
          >
            {label}
          </button>
        ))}
      </div>
      {data.me ? (
        <p className="mt-6 font-display text-3xl tabular-nums tracking-tight">
          #{data.me.rank.toLocaleString("en-US")}
          <span className="ml-2 font-mono text-meta text-secondary">OF {data.total.toLocaleString("en-US")}</span>
        </p>
      ) : (
        <p className="mt-6 font-mono text-meta text-secondary">SIGN IN TO SEE YOUR PLACE.</p>
      )}
      {data.rows.length === 0 ? (
        <p className="mt-8 font-mono text-meta text-secondary">NO ONE HAS JOINED YET.</p>
      ) : (
        <ol className="mt-6">
          {data.rows.map((row) => (
            <li
              key={`${row.rank}-${row.username}`}
              ref={row.mine ? meRef : undefined}
              className={`flex items-baseline gap-3 border-t border-line py-3 ${row.mine ? "bg-surface px-2" : ""}`}
            >
              <span className={`w-10 font-mono text-meta tabular-nums ${row.rank <= 3 ? "text-pulse" : "text-secondary"}`}>
                {String(row.rank).padStart(2, "0")}
              </span>
              <span className="min-w-0 flex-1 truncate font-display">@{row.username}</span>
              <span className="font-display tabular-nums">{formatPts(row.points).replace(" PTS", "")}</span>
            </li>
          ))}
        </ol>
      )}
      {data.me && pin && mineInList ? (
        <div className="sticky bottom-0 border-t border-pulse bg-bg py-3">
          <p className="font-mono text-meta text-secondary">YOU</p>
          <p className="font-display tabular-nums">
            {String(data.me.rank).padStart(2, "0")} @{data.me.username} {formatPts(data.me.points)}
          </p>
        </div>
      ) : null}
      {!mineInList && data.me ? (
        <div className="sticky bottom-0 border-t border-pulse bg-bg py-3">
          <p className="font-mono text-meta text-secondary">YOU</p>
          <p className="font-display tabular-nums">
            #{data.me.rank.toLocaleString("en-US")} @{data.me.username} {formatPts(data.me.points)}
          </p>
        </div>
      ) : null}
    </section>
  );
}
