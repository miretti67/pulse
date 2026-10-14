import { createFileRoute } from "@tanstack/react-router";
import { MeScreen } from "@/components/pulse/me-view";

export const Route = createFileRoute("/me")({ component: MeScreen });
