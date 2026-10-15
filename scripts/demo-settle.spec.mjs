import assert from "node:assert/strict";
import { test } from "node:test";

// Minimal browser stubs so the demo engine polls (mocked) prices like it does in the app.
const mem = new Map();
globalThis.localStorage = {
  getItem: (k) => (mem.has(k) ? mem.get(k) : null),
  setItem: (k, v) => mem.set(k, String(v)),
  removeItem: (k) => mem.delete(k),
};
globalThis.window = { setInterval: () => 0, clearInterval: () => {}, setTimeout, clearTimeout };
globalThis.fetch = async () => ({ ok: true, json: async () => ({ price: "81234.5" }) });
mem.set("pulse-demo", "1");

const demo = await import("../src/lib/pulse/demo.ts");

test("a 1M call settles after its window closes even once the next market is open (no stuck VERIFYING)", async () => {
  mem.set("pulse-demo", "1");
  const realNow = Date.now;
  try {
    // let the price poll land so calls are not stale
    await new Promise((r) => setTimeout(r, 50));
    let snap = demo.demoPulse();
    let m1 = snap.markets.find((m) => m.lengthMin === 1);
    // if the 1M is in its 15s lock, wait for the next window
    const lockIn = Date.parse(m1.locksAt) - Date.now();
    if (lockIn < 500) await new Promise((r) => setTimeout(r, Date.parse(m1.closesAt) - Date.now() + 300));
    snap = demo.demoPulse();
    m1 = snap.markets.find((m) => m.lengthMin === 1);
    assert.equal(Date.parse(m1.locksAt) - Date.parse(m1.opensAt), 45_000);
    const m15 = snap.markets.find((m) => m.lengthMin === 15);
    assert.equal(Date.parse(m15.closesAt) - Date.parse(m15.locksAt), 180_000);
    const res = demo.demoPlace("up", 10, m1.code);
    assert.equal(res.ok, true, JSON.stringify(res));
    // two windows later
    Date.now = () => Date.parse(m1.closesAt) + 61_000;
    snap = demo.demoPulse();
    assert.equal(snap.settling, null);
    assert.equal(snap.recent?.code, m1.code);
  } finally {
    Date.now = realNow;
    demo.demoStop();
  }
});
