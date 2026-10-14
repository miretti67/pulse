import assert from "node:assert/strict";
import { test } from "node:test";

const mem = new Map();
globalThis.localStorage = {
  getItem: (k) => (mem.has(k) ? mem.get(k) : null),
  setItem: (k, v) => mem.set(k, String(v)),
  removeItem: (k) => mem.delete(k),
};
globalThis.fetch = async () => ({ ok: true, json: async () => ({ price: "81234.5" }) });

const demo = await import("../src/lib/pulse/demo.ts");

test("demo seeds 1000 bots + user as 1001; bots never use the real user id", () => {
  mem.set("pulse-demo", "1");
  const snap = demo.demoPulse();
  assert.equal(snap.markets.length, 3);
  assert.ok(snap.me);
  assert.equal(snap.me.points, 10000);
  const rank = demo.demoRank("main");
  assert.equal(rank.total, 1001);
  assert.equal(rank.me?.username, "you");
  assert.equal(rank.me?.rank >= 1, true);
  const raw = JSON.parse(mem.get("pulse-demo-v1"));
  assert.equal(raw.bots.length, 1000);
  assert.ok(raw.bots.every((b) => String(b.id).startsWith("demo_")));
  assert.equal(raw.bots.some((b) => b.id === "user"), false);
  assert.ok(raw.markets.filter((m) => m.status === "settled").length >= 12);
  assert.ok(raw.calls.filter((c) => c.settled).length > 200);
  assert.ok(new Set(raw.bots.map((b) => b.avatar)).size >= 3);
});

test("demo profile + avatar stay in the demo store; plantSettled counts for the user", () => {
  mem.set("pulse-demo", "1");
  demo.demoSetUsername("pulsetest");
  demo.demoSetAvatar("cat");
  const code = demo.demoPlantSettled("down", 50);
  assert.ok(code);
  const p = demo.demoProfile();
  assert.equal(p.username, "pulsetest");
  assert.equal(p.avatar, "cat");
  assert.equal(p.memberNo, "DEMO_0001");
  assert.equal(p.calls >= 1, true);
  assert.equal(typeof p.accuracy, "number");
  const hist = demo.demoHistory(code);
  assert.ok(hist.rows.some((r) => r.code === code));
  assert.ok(hist.detail);
  assert.equal(hist.detail.source, "DEMO");
  // real-mode key unused
  assert.equal(mem.has("pulse-real"), false);
});
