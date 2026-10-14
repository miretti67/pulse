import { createFileRoute } from "@tanstack/react-router";
import { RankScreen } from "@/components/pulse/rank-view";

export const Route = createFileRoute("/rank")({ component: RankScreen });
