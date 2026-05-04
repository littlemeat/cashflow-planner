// Preset wizard: Zvýšení platu
import { useState, useEffect } from "react";
import { usePlanStore } from "../../store/usePlanStore";
import { CashflowEvent } from "../../types";
import { AmountInput } from "../AmountInput";
import { Modal } from "../Modal";
import { formatCZK, dateToMonthOffset, monthOffsetToDate } from "../../lib/formatters";

interface ZvyseniPlatuPresetProps {
  onClose: () => void;
}

export function ZvyseniPlatuPreset({ onClose }: ZvyseniPlatuPresetProps) {
  const { plan, batchUpdate } = usePlanStore();
  const startDate = plan.baseline.startDate;

  const incomeEvents = plan.events.filter((e) => e.category === "income");

  const [selectedEventId, setSelectedEventId] = useState<string>(
    incomeEvents[0]?.id ?? ""
  );
  const [specifiedMonth, setSpecifiedMonth] = useState(monthOffsetToDate(0, startDate));
  const [success, setSuccess] = useState(false);

  const selectedEvent = plan.events.find((e) => e.id === selectedEventId) ?? null;
  const [newAmount, setNewAmount] = useState<number>(selectedEvent?.amount ?? 0);

  // Update newAmount when the selected event changes
  function handleEventChange(id: string) {
    setSelectedEventId(id);
    const ev = plan.events.find((e) => e.id === id);
    if (ev) setNewAmount(ev.amount);
  }

  const wizardStartOffset = dateToMonthOffset(specifiedMonth, startDate);

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!selectedEvent) return;

    const groupId = crypto.randomUUID();
    const targetEvent = selectedEvent; // capture for closure

    batchUpdate((plan) => {
      let events = plan.events;

      // End the existing event at specifiedMonth - 1 (only if start is after plan start)
      if (wizardStartOffset > 0) {
        events = events.map((e) =>
          e.id === targetEvent.id
            ? { ...e, endMonth: wizardStartOffset - 1, presetGroup: groupId }
            : e
        );
      }

      // Create a new event with the new amount starting at specifiedMonth
      const newEvent: CashflowEvent = {
        id: crypto.randomUUID(),
        name: `${targetEvent.name} (po navýšení)`,
        category: targetEvent.category,
        frequency: targetEvent.frequency,
        amount: newAmount,
        startMonth: wizardStartOffset,
        endMonth: null,
        growthSchedule: [{ id: crypto.randomUUID(), fromMonth: 0, rateAnnual: targetEvent.growthSchedule[0]?.rateAnnual ?? 0 }],
        presetGroup: groupId,
      };

      return { ...plan, events: [...events, newEvent] };
    });

    setSuccess(true);
    // timer is handled by useEffect below
  }

  useEffect(() => {
    if (!success) return;
    const tid = setTimeout(onClose, 1500);
    return () => clearTimeout(tid);
  }, [success, onClose]);

  return (
    <Modal onClose={onClose} maxWidth="max-w-lg">
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-semibold text-gray-800">Zvýšení platu</h3>
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
          Zvýšení platu bylo přidáno do plánu.
        </div>
      ) : incomeEvents.length === 0 ? (
        <div className="py-6 text-center text-gray-500 text-sm">
          Nejsou k dispozici žádné příjmové položky. Nejprve přidejte příjem.
        </div>
      ) : (
        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Income event selector */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Příjem k navýšení
            </label>
            <select
              value={selectedEventId}
              onChange={(e) => handleEventChange(e.target.value)}
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              {incomeEvents.map((ev) => (
                <option key={ev.id} value={ev.id}>
                  {ev.name} ({formatCZK(ev.amount)}/měs.)
                </option>
              ))}
            </select>
          </div>

          {/* Specified month */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Od kdy</label>
            <input
              type="month"
              value={specifiedMonth}
              onChange={(e) => setSpecifiedMonth(e.target.value)}
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              required
            />
            {selectedEvent && wizardStartOffset > 0 && (
              <p className="text-xs text-gray-500 mt-1">
                Stávající příjem bude ukončen:{" "}
                {monthOffsetToDate(wizardStartOffset - 1, startDate).replace("-", "/")}
              </p>
            )}
          </div>

          {/* New amount */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Nová výše (Kč)
            </label>
            <AmountInput
              value={newAmount}
              onChange={setNewAmount}
              min={0}
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
            {selectedEvent && newAmount !== selectedEvent.amount && (() => {
              const pctChange = selectedEvent.amount !== 0
                ? ((newAmount - selectedEvent.amount) / selectedEvent.amount * 100).toFixed(1)
                : null;
              return (
                <p className="text-xs text-gray-500 mt-1">
                  Změna:{" "}
                  {newAmount > selectedEvent.amount ? "+" : ""}
                  {formatCZK(newAmount - selectedEvent.amount)}/měs.
                  {pctChange !== null && (
                    <> ({newAmount > selectedEvent.amount ? "+" : ""}{pctChange} %)</>
                  )}
                </p>
              );
            })()}
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
              disabled={!selectedEvent || newAmount <= 0}
              className="flex-1 bg-blue-600 hover:bg-blue-700 disabled:bg-gray-300 text-white font-medium rounded-lg px-4 py-2 text-sm transition-colors"
            >
              Přidat do plánu
            </button>
          </div>
        </form>
      )}
    </Modal>
  );
}
