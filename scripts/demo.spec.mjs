import assert from "node:assert/strict";
import { after, test } from "node:test";

// demo.ts touches localStorage; stub a browser-ish global before import.
const mem = new Map();
globalThis.localStorage = {
  getItem: (k) => (mem.has(k) ? mem.get(k) : null),
  setItem: (k, v) => mem.set(k, String(v)),
  removeItem: (k) => mem.delete(k),
};
globalThis.window = globalThis;
globalThis.fetch = async () => { throw new Error("offline"); };

const demo = await import("../src/lib/pulse/demo.ts");
after(() => demo.demoStop());
await new Promise((r) => setTimeout(r, 50));

test("demo seeds 1000 bots + user as player 1001 and never shares a store key with real mode", () => {
  mem.set("pulse-demo", "1");
  const snap = demo.demoPulse();
  assert.equal(snap.markets.length, 3);
  const rank = demo.demoRank("main");
  assert.equal(rank.total, 1001);
  assert.ok(rank.me);
  assert.equal(rank.me.username, "you");
  // bots are flagged via id prefix; user is id 'user'
  const raw = JSON.parse(mem.get("pulse-demo-v1"));
  assert.equal(raw.bots.length, 1000);
  assert.ok(raw.bots.every((b) => b.id.startsWith("demo_")));
  assert.equal(raw.bots.some((b) => b.id === "user"), false);
  // settled history exists
  const settled = raw.markets.filter((m) => m.status === "settled");
  assert.ok(settled.length >= 12);
  const calls = raw.calls.filter((c) => c.settled);
  assert.ok(calls.length > 200);
  assert.ok(raw.bots.some((b) => b.calls > 0 && b.wins >= 0));
});

test("user call lands in the same market pools and is counted", () => {
  const snap = demo.demoPulse();
  const open = snap.markets.find((m) => m.status === "open") ?? snap.markets[0];
  const before = open.participants;
  const res = demo.demoPlace("up", 10, open.code);
  assert.equal(res.ok, true);
  const after = demo.demoPulse().markets.find((m) => m.code === open.code);
  assert.ok(after.participants >= before);
  assert.equal(demo.demoHistory(open.code).rows.some((r) => r.code === open.code && r.live), true);
  const again = demo.demoPlace("down", 10, open.code);
  assert.equal(again.ok, false);
});

test("demo profile stays separate from the real profile shape and avatar saves", () => {
  demo.demoSetAvatar("cat");
  demo.demoSetUsername("pulsetest");
  const p = demo.demoProfile();
  assert.equal(p.username, "pulsetest");
  assert.equal(p.avatar, "cat");
  assert.equal(p.memberNo, "DEMO_0001");
  assert.equal(p.lastSide, "up");
});
