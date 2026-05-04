// Preset wizard: Návrat do práce — adds a new income and optionally ends an existing one
import { useState, useEffect, useRef } from "react";
import { usePlanStore } from "../../store/usePlanStore";
import { CashflowEvent } from "../../types";
import { AmountInput } from "../AmountInput";
import { dateToMonthOffset, monthOffsetToDate } from "../../lib/formatters";

interface NavratDoPriceProps {
  onClose: () => void;
}

export function NavratDoPrice({ onClose }: NavratDoPriceProps) {
  const { plan, addEvent, updateEvent } = usePlanStore();
  const startDate = plan.baseline.startDate;
  const mouseDownTarget = useRef<EventTarget | null>(null);

  const incomeEvents = plan.events.filter((e) => e.category === "income");

  const [fromMonth, setFromMonth] = useState(monthOffsetToDate(0, startDate));
  const [salaryAmount, setSalaryAmount] = useState(50000);
  const [growthPct, setGrowthPct] = useState(3);
  const [name, setName] = useState("Plat po návratu");
  const [endEventId, setEndEventId] = useState<string>("none");
  const [success, setSuccess] = useState(false);

  const fromOffset = dateToMonthOffset(fromMonth, startDate);

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (salaryAmount <= 0) return;

    const groupId = crypto.randomUUID();

    // If an existing income is selected to end, terminate it (only if start is after plan start)
    if (endEventId !== "none" && fromOffset > 0) {
      updateEvent(endEventId, {
        endMonth: fromOffset - 1,
        presetGroup: groupId,
      });
    }

    // Create the new income event
    const newEvent: Omit<CashflowEvent, "id"> = {
      name,
      category: "income",
      frequency: "monthly",
      amount: salaryAmount,
      startMonth: fromOffset,
      endMonth: null,
      annualGrowthPct: growthPct / 100,
      presetGroup: groupId,
    };

    addEvent(newEvent);
    setSuccess(true);
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
      <div className="bg-white rounded-xl shadow-xl w-full max-w-lg p-6 space-y-4 max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between">
          <h3 className="text-lg font-semibold text-gray-800">Návrat do práce</h3>
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
            Příjem po návratu byl přidán do plánu.
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-4">
            {/* Datum nástupu */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Datum nástupu
              </label>
              <input
                type="month"
                value={fromMonth}
                onChange={(e) => setFromMonth(e.target.value)}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                required
              />
            </div>

            {/* Název */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Název
              </label>
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Plat po návratu"
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                required
              />
            </div>

            {/* Čistý měsíční příjem */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Čistý měsíční příjem (Kč)
              </label>
              <AmountInput
                value={salaryAmount}
                onChange={setSalaryAmount}
                min={0}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>

            {/* Roční růst platu */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Roční růst platu (%)
              </label>
              <input
                type="number"
                value={growthPct}
                onChange={(e) => setGrowthPct(parseFloat(e.target.value) || 0)}
                step={0.1}
                min={0}
                max={100}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>

            {/* Stávající příjem k ukončení */}
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
                    {ev.name}
                  </option>
                ))}
              </select>
              {endEventId !== "none" && fromOffset > 0 && (
                <p className="text-xs text-gray-500 mt-1">
                  Vybraný příjem bude ukončen:{" "}
                  <span className="font-medium">{monthOffsetToDate(fromOffset - 1, startDate).replace("-", "/")}</span>
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
                disabled={salaryAmount <= 0 || !name.trim()}
                className="flex-1 bg-blue-600 hover:bg-blue-700 disabled:bg-gray-300 text-white font-medium rounded-lg px-4 py-2 text-sm transition-colors"
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
