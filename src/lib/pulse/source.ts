/** Data source switch: real server functions, or the client-side Demo Mode simulator. */
import { useSyncExternalStore } from "react";
import * as api from "./api";
import { demoHistory, demoPlace, demoProfile, demoPulse, demoRank, isDemoOn, subscribeDemo } from "./demo";
import type { RankBoard } from "./types";
import type { Side } from "./math";

export const getPulse = () => (isDemoOn() ? Promise.resolve(demoPulse()) : api.getPulse());
export const placeCall = (a: { data: { side: Side; stake: number; code: string } }) =>
  isDemoOn() ? Promise.resolve(demoPlace(a.data.side, a.data.stake, a.data.code)) : api.placeCall(a);
export const getHistory = (a: { data: { code: string | null } }) =>
  isDemoOn() ? Promise.resolve(demoHistory(a.data.code)) : api.getHistory(a);
export const getRank = (a: { data: { board: RankBoard } }) =>
  isDemoOn() ? Promise.resolve(demoRank(a.data.board)) : api.getRank(a);
export const getProfile = () => (isDemoOn() ? Promise.resolve(demoProfile()) : api.getProfile());

/** True when Demo Mode is on (client only; SSR renders as off). */
export function useDemo(): boolean {
  return useSyncExternalStore(
    (fn) => { const off = subscribeDemo(fn); return () => { off(); }; },
    () => isDemoOn(),
    () => false,
  );
}
