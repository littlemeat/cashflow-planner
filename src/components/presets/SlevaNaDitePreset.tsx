// Preset wizard: Sleva na dítě — with optional scheduled increases
import { useState, useEffect } from "react";
import { v4 as uuidv4 } from "uuid";
import { usePlanStore } from "../../store/usePlanStore";
import { CashflowEvent } from "../../types";
import { formatCZK, dateToMonthOffset, monthOffsetToDate, addMonths } from "../../lib/formatters";
import { SLEVA_NA_DITE_2026 } from "../../lib/constants";
import { AmountInput } from "../AmountInput";
import { Modal } from "../Modal";

interface SlevaNaDitePresetProps {
  onClose: () => void;
}

interface IncreaseEntry {
  id: string;
  month: string;
  amount: number;
}

export function SlevaNaDitePreset({ onClose }: SlevaNaDitePresetProps) {
  const { plan, batchUpdate } = usePlanStore();
  const startDate = plan.baseline.startDate;

  const [startMonth, setStartMonth] = useState(monthOffsetToDate(0, startDate));
  const [childCount, setChildCount] = useState<1 | 2 | 3>(1);
  const [increases, setIncreases] = useState<IncreaseEntry[]>([]);
  const [success, setSuccess] = useState(false);

  const wizardStartOffset = dateToMonthOffset(startMonth, startDate);

  const totalSleva = SLEVA_NA_DITE_2026.slice(0, childCount).reduce((sum, v) => sum + v, 0);

  function childLabel(count: 1 | 2 | 3): string {
    if (count === 1) return `1 dítě — ${formatCZK(SLEVA_NA_DITE_2026[0]!)}/měs.`;
    if (count === 2)
      return `2 děti — ${formatCZK(SLEVA_NA_DITE_2026[0]! + SLEVA_NA_DITE_2026[1]!)}/měs.`;
    return `3+ děti — ${formatCZK(SLEVA_NA_DITE_2026.reduce((s, v) => s + v, 0))}/měs.`;
  }

  function addIncrease() {
    // Default: 3 years after start (or after last increase)
    const lastMonth = increases.length > 0
      ? increases[increases.length - 1]!.month
      : startMonth;
    const nextDefault = addMonths(lastMonth, 36);
    const lastAmount = increases.length > 0
      ? increases[increases.length - 1]!.amount
      : totalSleva;
    setIncreases((prev) => [
      ...prev,
      { id: uuidv4(), month: nextDefault, amount: lastAmount },
    ]);
  }

  function updateIncrease(id: string, field: keyof Omit<IncreaseEntry, "id">, value: string | number) {
    setIncreases((prev) =>
      prev.map((inc) => (inc.id === id ? { ...inc, [field]: value } : inc))
    );
  }

  function removeIncrease(id: string) {
    setIncreases((prev) => prev.filter((inc) => inc.id !== id));
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const groupId = crypto.randomUUID();

    // Sort increases by calendar order
    const sorted = [...increases].sort(
      (a, b) => dateToMonthOffset(a.month, startDate) - dateToMonthOffset(b.month, startDate)
    );

    // Base event: from startMonth to first increase - 1 (or null if no increases)
    const baseEndOffset = sorted.length > 0
      ? dateToMonthOffset(sorted[0]!.month, startDate) - 1
      : null;

    batchUpdate((plan) => {
      const newEvents: CashflowEvent[] = [];

      newEvents.push({
        id: uuidv4(),
        name: "Sleva na dítě",
        category: "income",
        frequency: "monthly",
        amount: totalSleva,
        startMonth: wizardStartOffset,
        endMonth: baseEndOffset,
        growthSchedule: [{ id: crypto.randomUUID(), fromMonth: 0, rateAnnual: 0 }],
        presetGroup: groupId,
      });

      // Each increase creates a new chained event
      for (let i = 0; i < sorted.length; i++) {
        const inc = sorted[i]!;
        const next = sorted[i + 1];
        const incStartOffset = dateToMonthOffset(inc.month, startDate);
        const incEndOffset = next ? dateToMonthOffset(next.month, startDate) - 1 : null;

        newEvents.push({
          id: uuidv4(),
          name: "Sleva na dítě",
          category: "income",
          frequency: "monthly",
          amount: inc.amount,
          startMonth: incStartOffset,
          endMonth: incEndOffset,
          growthSchedule: [{ id: crypto.randomUUID(), fromMonth: 0, rateAnnual: 0 }],
          presetGroup: groupId,
        });
      }

      return { ...plan, events: [...plan.events, ...newEvents] };
    });

    setSuccess(true);
  }

  useEffect(() => {
    if (!success) return;
    const tid = setTimeout(onClose, 1500);
    return () => clearTimeout(tid);
  }, [success, onClose]);

  return (
    <Modal onClose={onClose} maxWidth="max-w-lg">
      <div className="max-h-[80vh] overflow-y-auto -m-6 p-6 space-y-4">
        <div className="flex items-center justify-between">
          <h3 className="text-lg font-semibold text-gray-800">Sleva na dítě</h3>
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
            Sleva na dítě byla přidána do plánu.
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-4">
            {/* Start month */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Od kdy</label>
              <input
                type="month"
                value={startMonth}
                onChange={(e) => setStartMonth(e.target.value)}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                required
              />
            </div>

            {/* Number of children */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Počet dětí</label>
              <select
                value={childCount}
                onChange={(e) => setChildCount(Number(e.target.value) as 1 | 2 | 3)}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value={1}>{childLabel(1)}</option>
                <option value={2}>{childLabel(2)}</option>
                <option value={3}>{childLabel(3)}</option>
              </select>
              <p className="text-xs text-gray-500 mt-1">
                Hodnoty dle ZDP §35c — 2026: 1. dítě {formatCZK(SLEVA_NA_DITE_2026[0]!)}, 2.{" "}
                {formatCZK(SLEVA_NA_DITE_2026[1]!)}, 3.+ {formatCZK(SLEVA_NA_DITE_2026[2]!)}/měs.
              </p>
            </div>

            {/* Summary */}
            <div className="bg-blue-50 rounded-lg p-3 text-sm">
              <p className="font-medium text-blue-800">
                Výchozí sleva:{" "}
                <span className="text-blue-900 font-semibold">{formatCZK(totalSleva)}/měs.</span>
              </p>
              {increases.length > 0 && (
                <p className="text-blue-600 text-xs mt-0.5">
                  + {increases.length} plánovan{increases.length === 1 ? "é zvýšení" : increases.length < 5 ? "á zvýšení" : "ých zvýšení"}
                </p>
              )}
            </div>

            {/* Scheduled increases */}
            <div>
              <div className="flex items-center justify-between mb-2">
                <label className="block text-sm font-medium text-gray-700">Plánované nárůsty</label>
                <button
                  type="button"
                  onClick={addIncrease}
                  className="text-xs text-blue-500 hover:text-blue-700 underline"
                >
                  + Přidat nárůst
                </button>
              </div>
              {increases.length === 0 ? (
                <p className="text-xs text-gray-400 italic">Žádné nárůsty — sleva zůstane stejná po celou dobu.</p>
              ) : (
                <div className="space-y-2">
                  {increases.map((inc, idx) => (
                    <div key={inc.id} className="flex gap-2 items-end border border-gray-200 rounded-lg p-2">
                      <div className="flex-1">
                        <label className="block text-xs text-gray-500 mb-1">Od {idx + 1}. nárůst</label>
                        <input
                          type="month"
                          value={inc.month}
                          onChange={(e) => updateIncrease(inc.id, "month", e.target.value)}
                          className="w-full border border-gray-300 rounded-lg px-2 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                          required
                        />
                      </div>
                      <div className="flex-1">
                        <label className="block text-xs text-gray-500 mb-1">Nová výše (Kč/měs.)</label>
                        <AmountInput
                          value={inc.amount}
                          onChange={(v) => updateIncrease(inc.id, "amount", v)}
                          min={0}
                          className="w-full border border-gray-300 rounded-lg px-2 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                        />
                      </div>
                      <button
                        type="button"
                        onClick={() => removeIncrease(inc.id)}
                        className="text-red-400 hover:text-red-600 pb-2 text-sm"
                        aria-label="Odebrat nárůst"
                      >
                        ✕
                      </button>
                    </div>
                  ))}
                </div>
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
    </Modal>
  );
}
