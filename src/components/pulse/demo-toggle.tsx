import { useQueryClient } from "@tanstack/react-query";
import { demoBusySnapshot, demoReset, isDemoOn, setDemoOn } from "@/lib/pulse/demo";
import { useDemo } from "@/lib/pulse/source";

/** In-app Demo Mode switch (also flipable via VITE_PULSE_DEMO / localStorage pulse-demo). */
export function DemoToggle() {
  const on = useDemo();
  const qc = useQueryClient();
  function flip(next: boolean) {
    setDemoOn(next);
    if (next) demoBusySnapshot();
    void qc.invalidateQueries();
  }
  return (
    <div data-demo-toggle className="mt-8 border border-line px-4 py-4">
      <p className="font-mono text-meta text-secondary">DEV · DEMO MODE</p>
      <p className="mt-2 text-sm text-secondary">
        ~1,000 bots + you on the same markets. Settles on live BTC. Demo stats stay separate from real play.
      </p>
      <div className="mt-3 flex flex-wrap gap-2">
        <button
          type="button"
          aria-pressed={on}
          className={`border px-3 py-2 font-mono text-meta ${on ? "border-fg bg-fg text-bg" : "border-line text-secondary"}`}
          onClick={() => flip(!on)}
        >
          {on ? "DEMO ON" : "TURN DEMO ON"}
        </button>
        {on ? (
          <>
            <button type="button" className="border border-line px-3 py-2 font-mono text-meta text-secondary" onClick={() => { demoBusySnapshot(); void qc.invalidateQueries(); }}>
              CROWD BURST
            </button>
            <button type="button" className="border border-line px-3 py-2 font-mono text-meta text-secondary" onClick={() => { demoReset(); void qc.invalidateQueries(); }}>
              RESET DEMO
            </button>
          </>
        ) : null}
      </div>
      <p className="mt-2 font-mono text-meta text-muted">FLAG {isDemoOn() ? "ON" : "OFF"} · ENV {String(import.meta.env.VITE_PULSE_DEMO === "true")}</p>
    </div>
  );
}

