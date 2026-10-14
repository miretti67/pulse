import { useEffect, useRef } from "react";
import type { AvatarId } from "@/lib/pulse/types";
import { useReducedMotion } from "@/lib/pulse/telegram";

/** Dust-particle bust; rim tinted by the player's last call (up = green, down = red). */
export function DustAvatar({ avatar, tint, className }: { avatar: AvatarId; tint: "up" | "down" | "none"; className?: string }) {
  const ref = useRef<HTMLCanvasElement>(null);
  const bust = useRef<{ setTint: (s: string) => void } | null>(null);
  const reduced = useReducedMotion();
  useEffect(() => {
    let dead = false;
    let stop = () => {};
    void Promise.all([import("@/lib/pulse/motion"), import("@/lib/pulse/dustbust")]).then(([motion, dust]) => {
      if (dead || !ref.current) return;
      const cores = navigator.hardwareConcurrency ?? 8;
      const b = new dust.DustBust(ref.current, avatar, { n: reduced ? 6000 : cores <= 4 ? 12000 : 18000, seed: 7 });
      b.setTint(tint);
      bust.current = b;
      let once = false;
      stop = motion.watch((t: number) => {
        if (reduced && once) return;
        b.render(reduced ? 0 : t);
        once = true;
      });
    });
    return () => {
      dead = true;
      stop();
    };
  }, [avatar, reduced]);
  useEffect(() => bust.current?.setTint(tint), [tint]);
  return (
    <div className={className} style={{ display: "grid", placeItems: "center", background: "#050505" }}>
      <canvas ref={ref} width={256} height={256} data-avatar={avatar} data-tint={tint} style={{ height: "100%", aspectRatio: "1" }} aria-label={`Avatar ${avatar}`} />
    </div>
  );
}

export function localAvatar(): AvatarId | null {
  try {
    const v = localStorage.getItem("pulse-avatar");
    return v === "hood" || v === "bot" || v === "cat" || v === "punk" || v === "astro" ? v : null;
  } catch {
    return null;
  }
}
