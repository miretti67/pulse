import { createFileRoute } from "@tanstack/react-router";
import { LandingPage } from "@/components/pulse/landing";

export const Route = createFileRoute("/welcome")({ component: LandingPage });
