import { createFileRoute } from "@tanstack/react-router";
import { PredictScreen } from "@/components/pulse/predict";

export const Route = createFileRoute("/")({ component: PredictScreen });
