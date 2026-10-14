import { createFileRoute } from "@tanstack/react-router";
import { HistoryScreen } from "@/components/pulse/history-view";

export const Route = createFileRoute("/history")({ component: HistoryScreen });
