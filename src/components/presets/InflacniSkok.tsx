// Preset wizard: Inflační skok — splits expense events at a date with a new growth rate
import { useState, useEffect } from "react";
import { usePlanStore } from "../../store/usePlanStore";
import { CashflowEvent } from "../../types";
import { Modal } from "../Modal";
import { dateToMonthOffset, monthOffsetToDate } from "../../lib/formatters";

interface InflacniSkokProps {
  onClose: () => void;
}

export function InflacniSkok({ onClose }: InflacniSkokProps) {
  const { plan, batchUpdate } = usePlanStore();
  const startDate = plan.baseline.startDate;

  const expenseEvents = plan.events.filter((e) => e.category === "expense");

  // Pre-check all expense events
  const [selectedIds, setSelectedIds] = useState<Set<string>>(
    new Set(expenseEvents.map((e) => e.id))
  );
  const [fromMonth, setFromMonth] = useState(monthOffsetToDate(0, startDate));
  const [newGrowthPct, setNewGrowthPct] = useState(5);
  const [success, setSuccess] = useState(false);
  const [nothingAffectedError, setNothingAffectedError] = useState(false);

  const fromOffset = dateToMonthOffset(fromMonth, startDate);

  // Count events that will actually be affected (fromOffset must be > evt.startMonth)
  const effectiveCount = expenseEvents.filter(
    (evt) => selectedIds.has(evt.id) && fromOffset > evt.startMonth
  ).length;

  function toggleEvent(id: string) {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  }

  function toggleAll() {
    if (selectedIds.size === expenseEvents.length) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(expenseEvents.map((e) => e.id)));
    }
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (selectedIds.size === 0) return;

    if (effectiveCount === 0) {
      setNothingAffectedError(true);
      return;
    }
    setNothingAffectedError(false);

    const groupId = crypto.randomUUID();
    const newRate = newGrowthPct / 100;

    batchUpdate((plan) => {
      let events = plan.events;
      const eventsToSplit = expenseEvents.filter(
        (evt) => selectedIds.has(evt.id) && fromOffset > evt.startMonth
      );

      for (const evt of eventsToSplit) {
        // Compute the grown amount at the split point
        const monthsActive = fromOffset - evt.startMonth;
        const grownAmount =
          monthsActive > 0
            ? evt.amount * Math.pow(1 + evt.annualGrowthPct / 12, monthsActive)
            : evt.amount;

        // End the original event at fromOffset - 1
        events = events.map((e) =>
          e.id === evt.id ? { ...e, endMonth: fromOffset - 1, presetGroup: groupId } : e
        );

        // Create a new event starting at fromOffset with the new growth rate
        const newEvent: CashflowEvent = {
          id: crypto.randomUUID(),
          name: evt.name,
          category: "expense",
          frequency: evt.frequency,
          amount: grownAmount,
          startMonth: fromOffset,
          endMonth: evt.endMonth,
          annualGrowthPct: newRate,
          notes: evt.notes,
          presetGroup: groupId,
        };
        events = [...events, newEvent];
      }

      return { ...plan, events };
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
          <h3 className="text-lg font-semibold text-gray-800">Inflační skok</h3>
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
            Inflační skok byl aplikován na vybrané výdaje.
          </div>
        ) : expenseEvents.length === 0 ? (
          <div className="py-6 text-center text-gray-500 text-sm">
            Nejsou k dispozici žádné výdajové položky. Nejprve přidejte výdaj.
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-4">
            {/* Od kdy */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Od kdy
              </label>
              <input
                type="month"
                value={fromMonth}
                onChange={(e) => setFromMonth(e.target.value)}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                required
              />
              <p className="text-xs text-gray-500 mt-1">
                Nová míra růstu platí od:{" "}
                <span className="font-medium">{fromMonth.replace("-", "/")}</span>
                {fromOffset > 0 && (
                  <> — původní část bude ukončena: {monthOffsetToDate(fromOffset - 1, startDate).replace("-", "/")}</>
                )}
              </p>
            </div>

            {/* Nová roční inflace */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Nová roční inflace (%)
              </label>
              <input
                type="number"
                value={newGrowthPct}
                onChange={(e) => setNewGrowthPct(parseFloat(e.target.value) || 0)}
                step={0.1}
                min={0}
                max={50}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                required
              />
            </div>

            {/* Výběr výdajů */}
            <div>
              <div className="flex items-center justify-between mb-2">
                <label className="block text-sm font-medium text-gray-700">
                  Výdaje k úpravě
                </label>
                <button
                  type="button"
                  onClick={toggleAll}
                  className="text-xs text-blue-500 hover:text-blue-700 underline"
                >
                  {selectedIds.size === expenseEvents.length ? "Zrušit vše" : "Vybrat vše"}
                </button>
              </div>
              <div className="space-y-2 max-h-48 overflow-y-auto border border-gray-200 rounded-lg p-2">
                {expenseEvents.map((evt) => (
                  <label
                    key={evt.id}
                    className="flex items-center gap-2 cursor-pointer hover:bg-gray-50 rounded px-2 py-1"
                  >
                    <input
                      type="checkbox"
                      checked={selectedIds.has(evt.id)}
                      onChange={() => toggleEvent(evt.id)}
                      className="accent-blue-600"
                    />
                    <span className="text-sm text-gray-700">{evt.name}</span>
                    <span className="text-xs text-gray-400 ml-auto">
                      {(evt.annualGrowthPct * 100).toFixed(1)} % → {newGrowthPct.toFixed(1)} %
                    </span>
                  </label>
                ))}
              </div>
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
                disabled={selectedIds.size === 0 || fromOffset <= 0 || effectiveCount === 0}
                className="flex-1 bg-blue-600 hover:bg-blue-700 disabled:bg-gray-300 text-white font-medium rounded-lg px-4 py-2 text-sm transition-colors"
              >
                Aplikovat ({effectiveCount} výdajů)
              </button>
            </div>

            {fromOffset <= 0 && (
              <p className="text-xs text-red-500">
                Datum musí být po začátku plánu ({startDate.replace("-", "/")}).
              </p>
            )}
            {nothingAffectedError && (
              <p className="text-xs text-red-500">
                Žádný výdaj nebyl upraven — zvolené datum je dřívější nebo rovno datu zahájení všech vybraných výdajů.
              </p>
            )}
          </form>
        )}
      </div>
    </Modal>
  );
}
