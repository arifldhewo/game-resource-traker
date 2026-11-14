import type { Metadata } from "next";
import { ForecastWizard } from "@/components/forecast/forecast-wizard";

export const metadata: Metadata = {
  title: "Forecast",
  description:
    "4-step Arknights gacha forecast: target, resources, spending matrix, and outlook with exact pity probability.",
};

export default function ForecastPage() {
  return <ForecastWizard />;
}
