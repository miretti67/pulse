import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { authEnabled, signOut } from "@/lib/auth/client";
import { hasGateSessionMarker } from "@/lib/auth/gate-session-marker";
import { useCurrentUserState } from "@/lib/auth/use-current-user";
import { syncProfile } from "@/lib/pulse/api";
import { getProfile, useDemo } from "@/lib/pulse/source";
import { DemoToggle } from "./demo-toggle";
import { formatPts } from "@/lib/pulse/format";
import { telegram } from "@/lib/pulse/telegram";
import { Art, SignInBlock } from "./chrome";
import { DustAvatar, localAvatar } from "./dust-avatar";

export function MeScreen() {
  const [on, setOn] = useState(false);
  useEffect(() => setOn(true), []);
  const { user, isPending } = useCurrentUserState();
  const demo = useDemo();
  const qc = useQueryClient();

  useEffect(() => {
    if (!user) return;
    const referral = sessionStorage.getItem("pulse_ref");
    void syncProfile({
      data: {
        displayName: user.displayName ?? user.primaryEmail?.split("@")[0] ?? "Member",
        image: user.profileImageUrl,
        referral,
      },
    })
      .then(() => {
        if (referral) sessionStorage.removeItem("pulse_ref");
        void qc.invalidateQueries({ queryKey: ["profile"] });
        void qc.invalidateQueries({ queryKey: ["pulse"] });
      })
      .catch(() => undefined);
  }, [user, qc]);

  if (!on || isPending) {
    return (
      <section>
        <h1 className="font-display text-title">ME</h1>
        <p className="mt-4 font-mono text-meta text-secondary">SYNCING</p>
      </section>
    );
  }
  if (!user && !demo) return <SignInBlock kicker="MEMBERSHIP" title="THIS ONE IS YOURS." />;
  return <ProfileLive />;
}

function ProfileLive() {
  const demo = useDemo();
  const q = useQuery({ queryKey: ["profile", demo ? "demo" : "real"], queryFn: () => getProfile(), refetchInterval: demo ? 3000 : false });
  const [copied, setCopied] = useState(false);
  const [note, setNote] = useState<string | null>(null);
  const [gate, setGate] = useState(false);
  useEffect(() => setGate(hasGateSessionMarker()), []);
  if (q.isPending || !q.data) {
    return (
      <section>
        <h1 className="font-display text-title">ME</h1>
        <p className="mt-4 font-mono text-meta text-secondary">SYNCING</p>
      </section>
    );
  }
  const p = q.data;
  const accuracy = p.accuracy == null ? "—" : `${p.accuracy.toFixed(1)}%`;
  return (
    <section className="pb-10">
      <h1 className="font-display text-title">ME</h1>
      <div className="mt-6 flex items-center gap-4">
        {p.image ? (
          <img src={p.image} alt="" className="size-14 object-cover" />
        ) : (
          <span className="grid size-14 place-items-center border border-line font-display text-xl">
            {(p.displayName || p.username).slice(0, 1).toUpperCase()}
          </span>
        )}
        <div className="min-w-0">
          <p className="truncate font-display text-2xl tracking-tight">{p.displayName}</p>
          <p className="font-mono text-meta text-secondary">@{p.username}</p>
        </div>
      </div>
      <p className="mt-4 font-mono text-meta text-secondary">PULSE MEMBER SINCE {p.sinceYear}</p>

      <dl className="mt-8 grid grid-cols-2 gap-px bg-line">
        <Stat k="POINTS" v={p.points.toLocaleString("en-US")} />
        <Stat k="CALLS" v={String(p.calls)} />
        <Stat k="WINS" v={String(p.wins)} />
        <Stat k="ACCURACY" v={accuracy} />
        <Stat k="STREAK" v={String(p.streak)} wide />
      </dl>
      <p className="mt-3 font-mono text-meta text-secondary">
        {p.accuracyByLength
          .map((row) => `${row.lengthMin}M ${row.accuracy == null ? "—" : `${row.accuracy.toFixed(0)}%`}`)
          .join(" · ")}
      </p>

      <article className="mt-8 border border-pulse">
        {(q.data.avatar ?? localAvatar()) ? (
          <DustAvatar
            avatar={(q.data.avatar ?? localAvatar())!}
            tint={q.data.lastSide ?? "none"}
            className="h-56 w-full"
          />
        ) : (
          <Art src="/pulse/profile.jpg" className="h-56 w-full object-cover object-center" />
        )}
        <div className="border-t border-line px-4 py-4">
          <div className="flex items-start justify-between">
            <p className="font-mono text-meta text-secondary">PULSE</p>
            <p className="font-mono text-meta text-fg">{p.memberNo}</p>
          </div>
          <p className="mt-4 font-display text-2xl tracking-tight">@{p.username}</p>
          <div className="barcode mt-4" aria-hidden />
          <p className="sr-only">Decorative barcode</p>
        </div>
      </article>

      <div className="mt-10">
        <h2 className="font-display text-3xl tracking-tight">INVITE THE CROWD</h2>
        <p className="mt-3 font-mono text-meta text-fg">{p.referralCode}</p>
        <dl className="mt-4 border-t border-line">
          <div className="flex justify-between border-b border-line-soft py-3">
            <dt className="font-mono text-meta text-secondary">FRIENDS JOINED</dt>
            <dd className="font-display tabular-nums">{p.friends}</dd>
          </div>
          <div className="flex justify-between border-b border-line-soft py-3">
            <dt className="font-mono text-meta text-secondary">POINTS EARNED</dt>
            <dd className="font-display tabular-nums">{formatPts(p.referralPoints)}</dd>
          </div>
        </dl>
        <p className="mt-3 font-mono text-meta text-muted">REFERRAL POINTS STAY OFF THE RANK.</p>
        <button
          type="button"
          onClick={() => void invite(p.referralCode, setCopied, setNote)}
          className="mt-4 h-12 w-full bg-fg font-display text-base text-bg"
        >
          {copied ? "COPIED" : "INVITE FRIENDS"}
        </button>
        {note ? <p className="mt-2 font-mono text-meta text-secondary">{note}</p> : null}
      </div>

      <DemoToggle />
      {authEnabled && !gate ? (
        <button
          type="button"
          onClick={() => {
            void signOut().catch(() => undefined);
          }}
          className="mt-8 font-mono text-meta text-secondary underline-offset-4 hover:underline"
        >
          SIGN OUT
        </button>
      ) : null}
    </section>
  );
}

function Stat({ k, v, wide }: { k: string; v: string; wide?: boolean }) {
  return (
    <div className={`bg-bg px-3 py-4 ${wide ? "col-span-2" : ""}`}>
      <dd className="font-display text-3xl tabular-nums tracking-tight">{v}</dd>
      <dt className="mt-1 font-mono text-meta text-secondary">{k}</dt>
    </div>
  );
}

async function invite(code: string, setCopied: (v: boolean) => void, setNote: (v: string | null) => void) {
  const url = `${window.location.origin}/?ref=${code}`;
  const text = "SEE THE CROWD. MAKE YOUR CALL.";
  const tg = telegram();
  if (tg?.openTelegramLink) {
    tg.openTelegramLink(`https://t.me/share/url?url=${encodeURIComponent(url)}&text=${encodeURIComponent(text)}`);
    return;
  }
  if (navigator.share) {
    try {
      await navigator.share({ title: "Pulse", text, url });
      return;
    } catch {
      /* copy instead */
    }
  }
  try {
    await navigator.clipboard.writeText(`${text} ${url}`);
    setCopied(true);
    setNote("LINK COPIED.");
    window.setTimeout(() => setCopied(false), 1600);
  } catch {
    setNote(url);
  }
}
