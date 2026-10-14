import type { LengthMin, Side } from "./math";

export type Feed = "live" | "reconnecting" | "down";

export type ActivityItem = {
  username: string;
  side: Side;
  stake: number;
  at: string;
};

export type MarketSnap = {
  code: string;
  lengthMin: LengthMin;
  status: "open" | "locked" | "settling" | "settled" | "cancelled";
  opensAt: string;
  locksAt: string;
  closesAt: string;
  openPrice: number | null;
  closePrice: number | null;
  price: number | null;
  result: "up" | "down" | "draw" | "void" | "cancelled" | null;
  upPool: number;
  downPool: number;
  participants: number;
  source: string | null;
  samples: number[];
};

export type MyPosition = {
  side: Side;
  stake: number;
  share: number;
  estReturn: number;
  serial: string;
};

export type HeldCall = MyPosition & { code: string; lengthMin: LengthMin };

export type MeSnap = {
  points: number;
  position: MyPosition | null;
  holds: HeldCall[];
  inPlay: number;
};

export type PendingSettle = {
  code: string;
  lengthMin: LengthMin;
  side: Side;
  stake: number;
  openPrice: number | null;
  closesAt: string;
  source: string | null;
};

export type SettledCall = {
  code: string;
  lengthMin: LengthMin;
  side: Side;
  stake: number;
  payout: number;
  net: number;
  outcome: "win" | "loss" | "draw" | "void" | "cancelled";
  openPrice: number | null;
  closePrice: number | null;
  result: "up" | "down" | "draw" | "void" | "cancelled" | null;
  participants: number;
  upPool: number;
  downPool: number;
  closesAt: string;
  opensAt: string;
  source: string | null;
};

export type PulseSnapshot = {
  serverNow: string;
  feed: Feed;
  priceAgeMs: number;
  markets: MarketSnap[];
  market: MarketSnap | null;
  me: MeSnap | null;
  activity: ActivityItem[];
  activities: { code: string; items: ActivityItem[] }[];
  settling: PendingSettle | null;
  recent: SettledCall | null;
};

export type HistoryRow = {
  code: string;
  lengthMin: LengthMin;
  side: Side;
  stake: number;
  net: number | null;
  outcome: SettledCall["outcome"] | null;
  closesAt: string;
  opensAt: string;
  live: boolean;
};

export type HistoryDetail = HistoryRow & {
  openPrice: number | null;
  closePrice: number | null;
  result: string | null;
  payout: number | null;
  source: string | null;
  participants: number;
  upPool: number;
  downPool: number;
};

export type RankRow = {
  rank: number;
  username: string;
  points: number;
  mine: boolean;
};

export type RankBoard = "main" | "fast";

export type RankSnap = {
  timeframe: "ALL-TIME";
  board: RankBoard;
  total: number;
  me: { rank: number; points: number; username: string } | null;
  rows: RankRow[];
};

export type ProfileSnap = {
  displayName: string;
  username: string;
  image: string | null;
  memberNo: string;
  sinceYear: number;
  points: number;
  calls: number;
  wins: number;
  accuracy: number | null;
  accuracyByLength: { lengthMin: LengthMin; accuracy: number | null }[];
  streak: number;
  referralCode: string;
  friends: number;
  referralPoints: number;
};

export type PlaceResult =
  | { ok: true; points: number }
  | {
      ok: false;
      reason: "locked" | "balance" | "already" | "closed" | "unavailable" | "rejected" | "stale";
    };
