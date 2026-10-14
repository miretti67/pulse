import { createFileRoute } from "@tanstack/react-router";
import { GROK_PROVIDERS, authEnabled, signIn } from "@/lib/auth/client";
import { Wordmark } from "@/components/pulse/chrome";

export const Route = createFileRoute("/login")({ component: Login });

function Login() {
  return (
    <main className="mx-auto flex min-h-dvh w-full max-w-[520px] flex-col justify-between bg-bg px-4 py-8 text-fg">
      <div>
        <Wordmark />
        <p className="mt-16 font-mono text-meta text-secondary">ONE NAME. EVERY MARKET.</p>
        <h1 className="mt-3 max-w-[16rem] font-display text-title text-balance">JOIN THE CROWD.</h1>
      </div>
      <div className="pb-[env(safe-area-inset-bottom)]">
        {authEnabled ? (
          <div className="flex flex-col gap-2">
            {GROK_PROVIDERS.map((p) => (
              <button
                key={p.providerId}
                type="button"
                onClick={() => signIn(p.providerId, { callbackURL: "/" })}
                className="h-12 bg-fg font-display text-base tracking-tight text-bg"
              >
                CONTINUE WITH {p.label.toUpperCase()}
              </button>
            ))}
            <a href="/" className="mt-2 grid h-12 place-items-center font-mono text-meta text-secondary">
              LOOK AROUND FIRST
            </a>
          </div>
        ) : (
          <p className="font-mono text-meta text-secondary">Sign-in is off.</p>
        )}
        <p className="mt-6 font-mono text-meta text-muted">POINTS HAVE NO CASH VALUE.</p>
      </div>
    </main>
  );
}
