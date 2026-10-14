import type { ErrorComponentProps } from "@tanstack/react-router";

const FALLBACK_MESSAGE = "An unexpected error occurred. Try reloading the page.";

function errorMessage(error: unknown): string {
  if (error instanceof Error && error.message) return error.message;
  if (typeof error === "string" && error) return error;
  return FALLBACK_MESSAGE;
}

export function AppErrorComponent({ error }: ErrorComponentProps) {
  return (
    <main className="flex min-h-dvh flex-col items-start justify-center gap-3 bg-bg px-6 text-fg">
      <p className="font-mono text-meta text-pulse">SIGNAL LOST</p>
      <h1 className="font-display text-3xl tracking-tight">Something went wrong</h1>
      <p className="max-w-md font-mono text-meta break-words text-secondary">{errorMessage(error)}</p>
    </main>
  );
}
