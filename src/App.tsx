// Main application layout with export/import/reset controls
import React, { useRef, useEffect, useState } from "react";
import { usePlanStore } from "./store/usePlanStore";
import { Plan } from "./types";
import { BaselinePanel } from "./components/BaselinePanel";
import { EventsPanel } from "./components/EventsPanel";
import { MortgagePanel } from "./components/MortgagePanel";
import { ResultsSummary, ResultsChart } from "./components/ResultsPanel";
import { formatYearMonth } from "./lib/formatters";

export default function App() {
  const { plan, importPlan, resetToSeed, history, undo } = usePlanStore();
  const [baselineCollapsed, setBaselineCollapsed] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const canUndo = history.length > 0;

  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if ((e.metaKey || e.ctrlKey) && e.key === "z" && !e.shiftKey) {
        e.preventDefault();
        if (canUndo) undo();
      }
    }
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [canUndo, undo]);

  // Export plan as JSON file
  function handleExport() {
    const json = JSON.stringify(plan, null, 2);
    const blob = new Blob([json], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const today = new Date().toISOString().slice(0, 10);
    const a = document.createElement("a");
    a.href = url;
    a.download = `plan-${today}.json`;
    a.click();
    URL.revokeObjectURL(url);
  }

  // Import plan from JSON file
  function handleImport(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      try {
        const parsed = JSON.parse(ev.target?.result as string) as Plan;
        // Basic validation: must have id, baseline, events, mortgages
        if (
          !parsed.id ||
          !parsed.baseline ||
          !Array.isArray(parsed.events) ||
          !Array.isArray(parsed.mortgages)
        ) {
          alert("Neplatný soubor plánu. Zkontrolujte formát JSON.");
          return;
        }
        importPlan(parsed);
        alert("Plán byl úspěšně načten.");
      } catch {
        alert("Chyba při načítání souboru. Ujistěte se, že je soubor platný JSON.");
      }
      // Reset input so the same file can be re-imported if needed
      if (fileInputRef.current) fileInputRef.current.value = "";
    };
    reader.readAsText(file);
  }

  function handleReset() {
    if (window.confirm("Opravdu obnovit výchozí data? Veškeré změny budou ztraceny.")) {
      resetToSeed();
    }
  }

  return (
    <div className="min-h-screen bg-gray-100 flex flex-col overflow-x-hidden">
      {/* Header */}
      <header className="bg-white border-b border-gray-200 px-6 py-4">
        <div className="max-w-screen-xl mx-auto flex flex-wrap items-center justify-between gap-3">
          <div>
            <h1 className="text-xl font-bold text-gray-900">Cashflow Planner</h1>
            <p className="text-xs text-gray-400 mt-0.5">
              {plan.name} · od {formatYearMonth(plan.baseline.startDate)} · horizont {plan.baseline.horizonYears} let
            </p>
          </div>

          {/* Actions */}
          <div className="flex items-center gap-3 flex-wrap">
            {/* Undo */}
            <button
              onClick={undo}
              disabled={!canUndo}
              title="Zpět (Ctrl+Z)"
              className="border border-gray-300 hover:bg-gray-50 text-gray-700 text-sm font-medium rounded-lg px-3 py-2 transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
            >
              ↩ Zpět
            </button>

            {/* Import */}
            <label
              htmlFor="import-file"
              className="cursor-pointer border border-gray-300 hover:bg-gray-50 text-gray-700 text-sm font-medium rounded-lg px-4 py-2 transition-colors"
            >
              Importovat data
            </label>
            <input
              id="import-file"
              type="file"
              accept=".json,application/json"
              ref={fileInputRef}
              onChange={handleImport}
              className="hidden"
            />

            {/* Export */}
            <button
              onClick={handleExport}
              className="border border-gray-300 hover:bg-gray-50 text-gray-700 text-sm font-medium rounded-lg px-4 py-2 transition-colors"
            >
              Exportovat data
            </button>

            {/* Reset to seed */}
            <button
              onClick={handleReset}
              className="border border-red-300 hover:bg-red-50 text-red-600 text-sm font-medium rounded-lg px-4 py-2 transition-colors"
            >
              Obnovit výchozí data
            </button>
          </div>
        </div>
      </header>

      {/* Main content */}
      <main className="flex-1 max-w-screen-xl mx-auto w-full px-4 py-6 space-y-6 pb-8">
        {/* Top row: KPI summary bar — full width */}
        <ResultsSummary />

        {/* Middle row: Baseline + Events+Mortgages */}
        <div className={`grid grid-cols-1 ${baselineCollapsed ? "" : "lg:grid-cols-[300px_1fr]"} gap-6 items-start`}>
          {baselineCollapsed ? (
            <button
              onClick={() => setBaselineCollapsed(false)}
              className="hidden lg:flex items-center gap-2 text-xs text-gray-500 hover:text-blue-600 font-medium border border-dashed border-gray-300 rounded-xl px-3 py-2 transition-colors w-fit"
            >
              <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
              </svg>
              Nastavení
            </button>
          ) : (
            <aside className="min-w-0">
              <BaselinePanel onCollapse={() => setBaselineCollapsed(true)} />
            </aside>
          )}
          <div className="space-y-6 min-w-0">
            <EventsPanel />
            <MortgagePanel />
          </div>
        </div>

        {/* Bottom row: full-width chart + table */}
        <div className="min-w-0">
          <ResultsChart />
        </div>
      </main>

      {/* Footer */}
      <footer className="border-t border-gray-200 py-3 px-6 text-center text-xs text-gray-400">
        Cashflow Planner · Phase 1 · Uloženo: {new Date(plan.updatedAt).toLocaleString("cs-CZ")}
      </footer>
    </div>
  );
}
