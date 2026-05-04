// Preset wizard: Mateřská (PPM — peněžitá pomoc v mateřství)
import { useState, useEffect, useRef } from "react";
import { usePlanStore } from "../../store/usePlanStore";
import { CashflowEvent } from "../../types";
import { AmountInput } from "../AmountInput";
import { formatCZK, dateToMonthOffset, monthOffsetToDate, addMonths } from "../../lib/formatters";
import { PPM_MAX_MONTHLY_2026 } from "../../lib/constants";

interface MaterskaPresetProps {
  onClose: () => void;
}

export function MaterskaPreset({ onClose }: MaterskaPresetProps) {
  const { plan, addEvent, updateEvent } = usePlanStore();
  const startDate = plan.baseline.startDate;
  const mouseDownTarget = useRef<EventTarget | null>(null);

  const incomeEvents = plan.events.filter((e) => e.category === "income");

  const [startMonth, setStartMonth] = useState(monthOffsetToDate(0, startDate));
  const [mode, setMode] = useState<"calculate" | "manual">("calculate");
  const [prevNetMonthly, setPrevNetMonthly] = useState(0);
  const [manualPpm, setManualPpm] = useState(0);
  const [endEventId, setEndEventId] = useState<string>("none");
  const [success, setSuccess] = useState(false);

  const ppmEstimate = Math.min(prevNetMonthly * 0.7, PPM_MAX_MONTHLY_2026);
  const finalAmount = mode === "manual" ? manualPpm : ppmEstimate;
  const wizardStartOffset = dateToMonthOffset(startMonth, startDate);
  const endMonthOffset = wizardStartOffset + 6; // 7 months total (0–6 inclusive)

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const groupId = crypto.randomUUID();

    const newEvent: Omit<CashflowEvent, "id"> = {
      name: "Mateřská (PPM)",
      category: "income",
      frequency: "monthly",
      amount: finalAmount,
      startMonth: wizardStartOffset,
      endMonth: endMonthOffset,
      annualGrowthPct: 0,
      presetGroup: groupId,
    };

    addEvent(newEvent);

    if (endEventId !== "none" && wizardStartOffset > 0) {
      updateEvent(endEventId, { endMonth: wizardStartOffset - 1 });
    }

    setSuccess(true);
    // timer is handled by useEffect below
  }

  useEffect(() => {
    if (!success) return;
    const tid = setTimeout(onClose, 1500);
    return () => clearTimeout(tid);
  }, [success, onClose]);

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
      onMouseDown={(e) => { mouseDownTarget.current = e.target; }}
      onClick={(e) => {
        if (e.target === e.currentTarget && mouseDownTarget.current === e.currentTarget) {
          onClose();
        }
      }}
    >
      <div
        className="bg-white rounded-xl shadow-xl w-full max-w-lg p-6 space-y-4"
      >
        <div className="flex items-center justify-between">
          <h3 className="text-lg font-semibold text-gray-800">Mateřská (PPM)</h3>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 text-xl leading-none"
            aria-label="Zavřít"
          >
            ×
          </button>
        </div>

        {success ? (
          <div className="py-6 text-center text-green-600 font-medium">
            Mateřská byla přidána do plánu.
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-4">
            {/* Start month */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Začátek mateřské
              </label>
              <input
                type="month"
                value={startMonth}
                onChange={(e) => setStartMonth(e.target.value)}
                min={addMonths(startDate, 1)}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                required
              />
              {wizardStartOffset === 0 && (
                <p className="text-xs text-red-500 mt-1">
                  Datum zahájení mateřské musí být po startu plánu.
                </p>
              )}
            </div>

            {/* Mode toggle */}
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => setMode("calculate")}
                className={`flex-1 text-sm font-medium rounded-lg px-3 py-2 border transition-colors ${mode === "calculate" ? "bg-blue-600 text-white border-blue-600" : "bg-white text-gray-600 border-gray-300 hover:bg-gray-50"}`}
              >
                Vypočítat z příjmu
              </button>
              <button
                type="button"
                onClick={() => setMode("manual")}
                className={`flex-1 text-sm font-medium rounded-lg px-3 py-2 border transition-colors ${mode === "manual" ? "bg-blue-600 text-white border-blue-600" : "bg-white text-gray-600 border-gray-300 hover:bg-gray-50"}`}
              >
                Zadat ručně (OSVČ)
              </button>
            </div>

            {mode === "calculate" ? (
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Průměrný čistý měsíční příjem za posledních 12 měsíců (Kč)
                </label>
                <AmountInput
                  value={prevNetMonthly}
                  onChange={setPrevNetMonthly}
                  min={0}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="např. 80 000"
                />
              </div>
            ) : (
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Výše PPM / mateřské (Kč/měs.)
                </label>
                <AmountInput
                  value={manualPpm}
                  onChange={setManualPpm}
                  min={0}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="např. 35 000"
                />
                <p className="text-xs text-gray-400 mt-1">Pro OSVČ závisí výše na zaplacených odvodech — zadej hodnotu z rozhodnutí ČSSZ.</p>
              </div>
            )}

            {/* PPM preview */}
            <div className="bg-blue-50 rounded-lg p-3 text-sm">
              <p className="font-medium text-blue-800">
                {mode === "calculate" ? "Odhadovaná" : "Zadaná"} PPM:{" "}
                <span className="text-blue-900 font-semibold">{formatCZK(Math.round(finalAmount))}/měs.</span>
              </p>
              {mode === "calculate" && (
                <p className="text-blue-600 text-xs mt-0.5">
                  70 % z vašeho příjmu, stropeno 2026 limitem ({formatCZK(PPM_MAX_MONTHLY_2026)}/měs.)
                </p>
              )}
              <p className="text-blue-600 text-xs mt-0.5">
                Trvání: {monthOffsetToDate(wizardStartOffset, startDate).replace("-", "/")} –{" "}
                {addMonths(startDate, endMonthOffset).replace("-", "/")} (7 měsíců / 28 týdnů)
              </p>
            </div>

            {/* Existing income to end */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Stávající příjem k ukončení
              </label>
              <select
                value={endEventId}
                onChange={(e) => setEndEventId(e.target.value)}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="none">žádný</option>
                {incomeEvents.map((ev) => (
                  <option key={ev.id} value={ev.id}>
                    {ev.name} ({formatCZK(ev.amount)}/měs.)
                  </option>
                ))}
              </select>
              {endEventId !== "none" && (
                <p className="text-xs text-gray-500 mt-1">
                  Příjem bude ukončen měsíc před začátkem mateřské (
                  {monthOffsetToDate(wizardStartOffset - 1, startDate).replace("-", "/")}).
                </p>
              )}
            </div>

            <div className="flex gap-3 pt-2">
              <button
                type="button"
                onClick={onClose}
                className="flex-1 border border-gray-300 hover:bg-gray-50 text-gray-700 font-medium rounded-lg px-4 py-2 text-sm transition-colors"
              >
                Zrušit
              </button>
              <button
                type="submit"
                className="flex-1 bg-blue-600 hover:bg-blue-700 text-white font-medium rounded-lg px-4 py-2 text-sm transition-colors"
              >
                Přidat do plánu
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}
