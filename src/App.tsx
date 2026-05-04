// Main application layout with export/import/reset controls
import React, { useRef, useEffect } from "react";
import { usePlanStore } from "./store/usePlanStore";
import { Plan } from "./types";
import { BaselinePanel } from "./components/BaselinePanel";
import { EventsPanel } from "./components/EventsPanel";
import { MortgagePanel } from "./components/MortgagePanel";
import { AssetsPanel } from "./components/AssetsPanel";
import { ResultsSummary, ResultsChart } from "./components/ResultsPanel";
import { formatYearMonth } from "./lib/formatters";

export default function App() {
  const { plan, importPlan, resetToSeed, history, undo } = usePlanStore();
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
        const b = parsed.baseline;
        if (
          typeof b.horizonYears !== 'number' || b.horizonYears < 1 ||
          typeof b.cashAccount !== 'number' ||
          typeof b.investmentsBalance !== 'number' ||
          typeof b.safetyBufferMonths !== 'number'
        ) {
          alert("Neplatný soubor: základní nastavení obsahuje neplatné hodnoty.");
          return;
        }
        if (parsed.events.some((e: unknown) => !e || typeof (e as Record<string, unknown>).id !== 'string')) {
          alert("Neplatný soubor: seznam příjmů a výdajů obsahuje neplatné záznamy.");
          return;
        }
        if (parsed.mortgages.some((m: unknown) => !m || typeof (m as Record<string, unknown>).id !== 'string')) {
          alert("Neplatný soubor: seznam hypoték obsahuje neplatné záznamy.");
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

        {/* Panels stack */}
        <div className="space-y-6">
          <BaselinePanel />
          <EventsPanel />
          <MortgagePanel />
          <AssetsPanel />
        </div>

        {/* Bottom row: full-width chart + table */}
        <div className="min-w-0">
          <ResultsChart />
        </div>
      </main>

      {/* Footer */}
      <footer className="border-t border-gray-200 py-3 px-6 text-center text-xs text-gray-400">
        Cashflow Planner · Phase 4 · Uloženo: {new Date(plan.updatedAt).toLocaleString("cs-CZ")}
      </footer>
    </div>
  );
}
