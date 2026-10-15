import { createRootRoute, HeadContent, Outlet, Scripts, useRouterState } from "@tanstack/react-router";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { AuthProvider } from "@/lib/auth/provider";
import { PreviewHostBridge } from "@/components/preview-host-bridge";
import { Shell } from "@/components/pulse/chrome";
import appCss from "../styles.css?url";

const APP_NAME = "Pulse";
const PITCH =
  "Call Bitcoin up or down over 1, 5 or 15 minutes. Everyone's points go into one pot, and the winners split the losers' side. Points only, no cash value.";

export const Route = createRootRoute({
  head: () => ({
    meta: [
      { charSet: "utf-8" },
      { name: "viewport", content: "width=device-width, initial-scale=1, viewport-fit=cover" },
      { title: `${APP_NAME} · Call BTC up or down. Winners split the pot.` },
      { name: "theme-color", content: "#080808" },
      { name: "description", content: PITCH },
      { property: "og:type", content: "website" },
      { property: "og:site_name", content: APP_NAME },
      { property: "og:title", content: `${APP_NAME} · Call BTC up or down` },
      { property: "og:description", content: PITCH },
      { property: "og:image", content: "/og.jpg" },
      { name: "twitter:card", content: "summary_large_image" },
      { name: "twitter:title", content: `${APP_NAME} · Call BTC up or down` },
      { name: "twitter:description", content: PITCH },
      { name: "twitter:image", content: "/og.jpg" },
    ],
    links: [
      { rel: "icon", type: "image/svg+xml", href: "/favicon.svg" },
      { rel: "stylesheet", href: appCss },
      { rel: "manifest", href: "/__grok/manifest.webmanifest" },
      { rel: "apple-touch-icon", href: "/__grok/icon-180.png" },
    ],
  }),
  component: Root,
});

function Root() {
  const [client] = useState(
    () =>
      new QueryClient({
        defaultOptions: { queries: { retry: 1, refetchOnWindowFocus: false, staleTime: 1000 } },
      }),
  );
  return (
    <html lang="en" className="antialiased" suppressHydrationWarning>
      <head>
        <HeadContent />
        {/* Mark JS before first paint so the static landing below is hidden for app users. */}
        <script dangerouslySetInnerHTML={{ __html: "document.documentElement.classList.add('js')" }} />
      </head>
      <body>
        <StaticLanding />
        <PreviewHostBridge />
        <QueryClientProvider client={client}>
          <AuthProvider>
            <RefCapture />
            <Frame />
          </AuthProvider>
        </QueryClientProvider>
        <Scripts />
      </body>
    </html>
  );
}

/** Server-rendered product summary. Visible to non-JS readers, crawlers and link unfurlers;
 * hidden by CSS (html.js) once JavaScript runs so the app takes over. */
function StaticLanding() {
  return (
    <section id="pulse-static" className="mx-auto max-w-xl px-5 py-10 text-fg">
      <h1 className="font-display text-4xl font-bold tracking-tight">PULSE</h1>
      <p className="mt-3 font-mono text-meta text-secondary">{PITCH}</p>
      <h2 className="mt-8 font-mono text-meta text-secondary">HOW IT WORKS</h2>
      <ol className="mt-3 space-y-3 font-mono text-meta">
        <li>1. Pick a market: 1M, 5M or 15M. Each one opens right as the last one closes.</li>
        <li>2. Call UP or DOWN on the BTC price and put points in that side's pot. Calls lock shortly before close.</li>
        <li>3. At close the price settles. If you were right, you split the losing side's pot with the other winners.</li>
      </ol>
      <p className="mt-8 font-mono text-meta text-muted">POINTS HAVE NO CASH VALUE.</p>
    </section>
  );
}

function Frame() {
  const path = useRouterState({ select: (s) => s.location.pathname });
  if (path === "/login") return <Outlet />;
  return (
    <Shell>
      <Outlet />
    </Shell>
  );
}

function RefCapture() {
  useEffect(() => {
    const ref = new URLSearchParams(window.location.search).get("ref");
    if (!ref) return;
    const clean = ref.toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, 12);
    if (clean) sessionStorage.setItem("pulse_ref", clean);
  }, []);
  return null;
}
