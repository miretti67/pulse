import { useEffect, useState } from "react";

type Haptic = {
  impactOccurred: (style: "light" | "medium" | "heavy") => void;
  notificationOccurred: (type: "error" | "success" | "warning") => void;
  selectionChanged: () => void;
};

type BackButton = {
  show: () => void;
  hide: () => void;
  onClick: (cb: () => void) => void;
  offClick: (cb: () => void) => void;
};

export type TelegramWebApp = {
  openTelegramLink?: (url: string) => void;
  HapticFeedback?: Haptic;
  BackButton?: BackButton;
};

export function telegram(): TelegramWebApp | null {
  if (typeof window === "undefined") return null;
  return (window as unknown as { Telegram?: { WebApp?: TelegramWebApp } }).Telegram?.WebApp ?? null;
}

export function haptic(kind: "select" | "confirm" | "lock" | "result") {
  const h = telegram()?.HapticFeedback;
  try {
    if (h) {
      if (kind === "select") h.selectionChanged();
      else if (kind === "lock") h.notificationOccurred("warning");
      else h.notificationOccurred("success");
      return;
    }
  } catch {
    /* haptics are optional */
  }
  if (typeof navigator !== "undefined" && typeof navigator.vibrate === "function") {
    navigator.vibrate(kind === "select" ? 8 : kind === "lock" ? [10, 30, 10] : 16);
  }
}

export function useTelegramBack(active: boolean, onBack: () => void) {
  useEffect(() => {
    const bb = telegram()?.BackButton;
    if (!bb) return;
    if (!active) {
      bb.hide();
      return;
    }
    bb.show();
    bb.onClick(onBack);
    return () => {
      bb.offClick(onBack);
      bb.hide();
    };
  }, [active, onBack]);
}

export function useReducedMotion() {
  const [reduced, setReduced] = useState(false);
  useEffect(() => {
    const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
    const apply = () => setReduced(mq.matches);
    apply();
    mq.addEventListener("change", apply);
    return () => mq.removeEventListener("change", apply);
  }, []);
  return reduced;
}
