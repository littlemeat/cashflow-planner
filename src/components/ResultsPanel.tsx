// Re-exports for backward compatibility
export { ResultsSummary } from "./ResultsSummary";
export { ResultsChart } from "./ResultsChart";
export type { SeriesKey, SeriesConfig } from "./ResultsChart";
export { SERIES } from "./ResultsChart";

import { ResultsSummary } from "./ResultsSummary";
import { ResultsChart } from "./ResultsChart";

export function ResultsPanel() {
  return (
    <div className="space-y-4">
      <ResultsSummary />
      <ResultsChart />
    </div>
  );
}
