import { createServerFn } from "@tanstack/react-start";
import { authMiddleware } from "@/lib/auth/middleware";
import { optionalAuth } from "./optional-auth";
import type { Side } from "./math";
import type { PlaceResult, RankBoard } from "./types";

export const getPulse = createServerFn({ method: "GET" })
  .middleware([optionalAuth])
  .handler(async ({ context }) => {
    const { loadPulse } = await import("./engine.server");
    return loadPulse(context.userId);
  });

export const placeCall = createServerFn({ method: "POST" })
  .validator((input: { side: Side; stake: number; code: string }) => {
    const side: Side | null = input?.side === "up" || input?.side === "down" ? input.side : null;
    const stake = Number(input?.stake);
    const code = typeof input?.code === "string" ? input.code.slice(0, 20) : "";
    return { side, stake, code };
  })
  .middleware([authMiddleware])
  .handler(async ({ context, data }): Promise<PlaceResult> => {
    if (!data.side || !data.code) return { ok: false, reason: "rejected" };
    const { placeCall: run } = await import("./engine.server");
    return run(context.userId, data.side, data.stake, data.code);
  });

export const syncProfile = createServerFn({ method: "POST" })
  .validator((input: { displayName?: string | null; image?: string | null; referral?: string | null }) => ({
    displayName: typeof input?.displayName === "string" ? input.displayName.slice(0, 40) : null,
    image: typeof input?.image === "string" ? input.image.slice(0, 500) : null,
    referral: typeof input?.referral === "string" ? input.referral.slice(0, 12) : null,
  }))
  .middleware([authMiddleware])
  .handler(async ({ context, data }) => {
    const { ensureProfile } = await import("./engine.server");
    await ensureProfile(context.userId, data);
    return { ok: true as const };
  });

export const claimUsername = createServerFn({ method: "POST" })
  .validator((input: { username?: string | null }) => ({
    username: typeof input?.username === "string" ? input.username.slice(0, 16) : "",
  }))
  .middleware([authMiddleware])
  .handler(async ({ context, data }) => {
    const { claimUsername: run } = await import("./engine.server");
    return run(context.userId, data.username);
  });

export const getHistory = createServerFn({ method: "GET" })
  .validator((input: { code?: string | null }) => ({
    code: typeof input?.code === "string" && input.code ? input.code.slice(0, 20) : null,
  }))
  .middleware([authMiddleware])
  .handler(async ({ context, data }) => {
    const { loadHistory } = await import("./engine.server");
    return loadHistory(context.userId, data.code);
  });

export const getRank = createServerFn({ method: "GET" })
  .validator((input: { board?: RankBoard | null }) => ({
    board: input?.board === "fast" ? "fast" : "main",
  }))
  .middleware([optionalAuth])
  .handler(async ({ context, data }) => {
    const { loadRank } = await import("./engine.server");
    return loadRank(context.userId, data.board as RankBoard);
  });

export const getProfile = createServerFn({ method: "GET" })
  .middleware([authMiddleware])
  .handler(async ({ context }) => {
    const { loadProfile } = await import("./engine.server");
    return loadProfile(context.userId);
  });

export const saveAvatar = createServerFn({ method: "POST" })
  .validator((input: { avatar?: string | null }) => ({ avatar: typeof input?.avatar === "string" ? input.avatar.slice(0, 12) : "" }))
  .middleware([authMiddleware])
  .handler(async ({ context, data }) => {
    const { setAvatar } = await import("./engine.server");
    return setAvatar(context.userId, data.avatar);
  });
