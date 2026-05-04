// KPI summary bar — shows key financial metrics at a selected month
import { useState } from "react";
import { usePlanStore } from "../store/usePlanStore";
import { formatCZK, formatRunway } from "../lib/formatters";
import { KpiCard } from "./KpiCard";
import { InfoTooltip } from "./InfoTooltip";

export function ResultsSummary() {
  const { snapshots, plan } = usePlanStore();
  const [selectedMonth, setSelectedMonth] = useState(0);

  const lastSnap = snapshots[snapshots.length - 1];
  const firstNegativeSnap = snapshots.find((s) => s.flags.includes("cash-negative"));

  // Clamp selectedMonth in case snapshots shrink
  const clampedMonth = Math.min(selectedMonth, Math.max(0, snapshots.length - 1));
  const snap = snapshots[clampedMonth];

  const selectedDate = snap ? snap.date.replace("-", "/") : plan.baseline.startDate.replace("-", "/");
  const startLabel = snapshots[0]?.date.replace("-", "/") ?? plan.baseline.startDate.replace("-", "/");
  const endLabel = lastSnap?.date.replace("-", "/") ?? startLabel;

  // Warning banner: readable Czech date
  const warningDate = firstNegativeSnap
    ? new Date(firstNegativeSnap.date + "-01").toLocaleString("cs-CZ", { year: "numeric", month: "long" })
    : null;

  return (
    <div className="bg-white rounded-xl shadow px-5 py-4 min-w-0 space-y-3">
      {/* Warning banner */}
      {firstNegativeSnap && warningDate && (
        <div className="bg-yellow-50 border border-yellow-300 rounded-lg px-4 py-2 text-sm text-yellow-800">
          ⚠ Hotovost bude záporná od {warningDate}.
        </div>
      )}

      {/* KPI row — horizontal, wraps on narrow screens */}
      {snap && (
        <div className="space-y-2">
          <div className="flex items-center gap-2 flex-wrap">
            <p className="text-xs text-gray-400">
              Stav k: <span className="font-medium text-gray-600">{selectedDate}</span>
            </p>
            {clampedMonth !== 0 && (
              <button
                onClick={() => setSelectedMonth(0)}
                className="text-xs text-blue-500 hover:text-blue-700 underline"
              >
                Reset
              </button>
            )}
            {lastSnap && (
              <span className="text-xs text-gray-400 ml-auto">horizont do <span className="font-medium text-gray-600">{endLabel}</span></span>
            )}
          </div>
          <div className="flex flex-wrap gap-3">
            <KpiCard label="Čisté jmění" value={formatCZK(snap.netWorth)} color="text-purple-700" bg="bg-purple-50"
              tooltip="Hotovost + Investice + Majetek − Hypo zůstatek. Pokud eviduješ hypotéku, ale nemáš přidanou nemovitost v Majetku, bude čisté jmění záporné — to je normální, chybí tam protiváha." />
            <KpiCard label="Hotovost" value={formatCZK(snap.cashAccount)} color="text-blue-700" bg="bg-blue-50"
              subtitle={snap.targetCash > 0 ? `cíl: ${formatCZK(snap.targetCash)}` : undefined}
              tooltip={`Zůstatek na běžném účtu ke konci měsíce. Cílová výše = bezpečnostní rezerva (${plan.baseline.safetyBufferMonths} měs.) × průměr měs. výdajů za posledních 12 měs. Kladný cashflow → přebytek nad cíl jde do investic. Záporný cashflow → hotovost absorbuje propad; pokud klesne pod 0, dorovná se výběrem z investic. Do průměru se nezahrnují jednorázové výdaje.`} />
            <KpiCard label="Investice" value={formatCZK(snap.investmentsBalance)} color="text-green-700" bg="bg-green-50"
              tooltip="Hodnota portfolia ke konci měsíce. Výpočet: (zůstatek + příspěvek) × (1 + roční výnos)^(1/12). Příspěvek = přebytek hotovosti nad cílovou rezervu; záporný příspěvek = výběr při schodku. Počáteční výši nastavíš v Počátečním nastavení → Investice – zůstatek." />
            <KpiCard label="Majetek" value={formatCZK(snap.assetsValue)} color="text-indigo-700" bg="bg-indigo-50"
              tooltip="Tržní hodnota nemovitostí a dalšího majetku ke konci měsíce. Výpočet: pořizovací × (1 + roční zhodnocení)^(roky od pořízení). Pořizovací náklady se promítnou do hotovosti jen pokud sis přidala propojený jednorázový výdaj v panelu Příjmy a výdaje." />
            <KpiCard label="Zůstatek hypotéky" value={formatCZK(snap.mortgageBalance)} color="text-orange-700" bg="bg-orange-50"
              tooltip="Zbývající jistina ke konci měsíce. Klesá jen o jistinovou část anuity — úrok je náklad, ne splácení dluhu. Při změně sazby se jistina nemění, jen se přepočítá poměr úrok/jistina." />
            {/* Runway with info tooltip */}
            <div className="bg-gray-50 rounded-xl px-4 py-3 flex flex-col justify-between min-w-[110px]">
              <div className="flex items-center gap-1 mb-1">
                <p className="text-xs text-gray-500">Runway</p>
                <InfoTooltip width="w-72">
                  <p className="font-semibold mb-1">Co je Runway?</p>
                  <p>Počet měsíců, po které pokryješ výdaje z hotovosti a investic — i kdyby přestaly veškeré příjmy.</p>
                  <p className="mt-1 text-gray-300">Výpočet: (hotovost + investice) ÷ průměr měs. výdajů za posledních 12 měs. (jen opakující se, bez jednorázových)</p>
                </InfoTooltip>
              </div>
              <p className="text-sm font-bold text-gray-700">{formatRunway(snap.runwayMonths)}</p>
            </div>
          </div>

          {/* Date slider */}
          {snapshots.length > 1 && (
            <div className="space-y-1 pt-1">
              <input
                type="range"
                min={0}
                max={snapshots.length - 1}
                step={1}
                value={clampedMonth}
                onChange={(e) => setSelectedMonth(parseInt(e.target.value))}
                className="w-full accent-blue-600"
                aria-label="Vybrat měsíc"
              />
              <div className="flex justify-between text-xs text-gray-400">
                <span>{startLabel}</span>
                <span>{endLabel}</span>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
