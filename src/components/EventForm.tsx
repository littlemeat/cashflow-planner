// Add/Edit cashflow event modal form
import React, { useState, useEffect } from "react";
import { CashflowEvent, EventCategory } from "../types";
import { formatCZK, dateToMonthOffset, monthOffsetToDate } from "../lib/formatters";
import { usePlanStore } from "../store/usePlanStore";
import { AmountInput } from "./AmountInput";
import { Modal } from "./Modal";

type GrowthEntry = { id: string; fromMonth: number; rateAnnual: number };
type EventFormData = Omit<CashflowEvent, "id">;

interface EventFormProps {
  initial?: CashflowEvent;
  onSave: (data: EventFormData) => void;
  onCancel: () => void;
  horizonMonths: number;
}

const defaultGrowthSchedule = (): GrowthEntry[] => [
  { id: crypto.randomUUID(), fromMonth: 0, rateAnnual: 0 },
];

const defaultForm = (): Omit<EventFormData, "growthSchedule"> => ({
  name: "",
  category: "expense",
  amount: 0,
  frequency: "monthly",
  startMonth: 0,
  endMonth: null,
  notes: "",
});

function suggestGrowthRate(name: string, category: EventCategory): number {
  const n = name.toLowerCase();
  if (n.includes("jídlo") || n.includes("jidlo") || n.includes("potraviny")) return 0.03;
  if (n.includes("energie") || n.includes("elektr") || n.includes("plyn")) return 0.04;
  if (n.includes("nájem") || n.includes("najem") || n.includes("nájemné")) return 0.04;
  if (n.includes("plat") || n.includes("mzda") || n.includes("příjem") || n.includes("prijem")) return 0.03;
  if (category === "expense") return 0.025;
  return 0;
}

export function EventForm({ initial, onSave, onCancel, horizonMonths }: EventFormProps) {
  const { plan } = usePlanStore();
  const startDate = plan.baseline.startDate;

  const [form, setForm] = useState<Omit<EventFormData, "growthSchedule">>(
    initial ? {
      name: initial.name,
      category: initial.category,
      amount: initial.amount,
      frequency: initial.frequency,
      startMonth: initial.startMonth,
      endMonth: initial.endMonth,
      notes: initial.notes,
      presetGroup: initial.presetGroup,
    } : defaultForm()
  );
  const [growthSchedule, setGrowthSchedule] = useState<GrowthEntry[]>(
    initial?.growthSchedule ?? defaultGrowthSchedule()
  );
  const [hasEndMonth, setHasEndMonth] = useState(initial?.endMonth != null);
  // Track whether the user has manually edited the growth % field
  const [growthTouched, setGrowthTouched] = useState(false);
  const [endBeforeStartError, setEndBeforeStartError] = useState(false);
  const [startBeyondHorizonError, setStartBeyondHorizonError] = useState(false);

  useEffect(() => {
    if (initial) {
      setForm({
        name: initial.name,
        category: initial.category,
        amount: initial.amount,
        frequency: initial.frequency,
        startMonth: initial.startMonth,
        endMonth: initial.endMonth,
        notes: initial.notes,
        presetGroup: initial.presetGroup,
      });
      setGrowthSchedule(initial.growthSchedule ?? defaultGrowthSchedule());
      setHasEndMonth(initial.endMonth != null);
      setGrowthTouched(false);
    }
  }, [initial]);

  function handleChange(
    e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>
  ) {
    const { name, value, type } = e.target;
    setForm((prev) => ({
      ...prev,
      [name]:
        type === "number"
          ? parseFloat(value) || 0
          : value,
    }));
  }

  function handleCategoryChange(e: React.ChangeEvent<HTMLSelectElement>) {
    const newCategory = e.target.value as EventCategory;
    setForm((prev) => ({ ...prev, category: newCategory }));
    if (!growthTouched) {
      const suggested = suggestGrowthRate(form.name, newCategory);
      setGrowthSchedule((prev) => prev.map((entry, idx) => idx === 0 ? { ...entry, rateAnnual: suggested } : entry));
    }
  }

  function handleNameBlur(e: React.FocusEvent<HTMLInputElement>) {
    if (!growthTouched) {
      const suggested = suggestGrowthRate(e.target.value, form.category);
      setGrowthSchedule((prev) => prev.map((entry, idx) => idx === 0 ? { ...entry, rateAnnual: suggested } : entry));
    }
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (form.startMonth > horizonMonths) {
      setStartBeyondHorizonError(true);
      return;
    }
    setStartBeyondHorizonError(false);
    const resolvedEndMonth = hasEndMonth ? form.endMonth : null;
    if (resolvedEndMonth !== null && resolvedEndMonth < form.startMonth) {
      setEndBeforeStartError(true);
      return;
    }
    setEndBeforeStartError(false);
    onSave({
      ...form,
      endMonth: resolvedEndMonth,
      growthSchedule,
    });
  }

  // Sort growth schedule entries by fromMonth for display
  const sortedSchedule = [...growthSchedule].sort((a, b) => a.fromMonth - b.fromMonth);

  function addGrowthPeriod() {
    const last = sortedSchedule[sortedSchedule.length - 1];
    const newFromMonth = last ? last.fromMonth + 12 : 12;
    const newRateAnnual = last ? last.rateAnnual : 0;
    setGrowthTouched(true);
    setGrowthSchedule((prev) => [
      ...prev,
      { id: crypto.randomUUID(), fromMonth: newFromMonth, rateAnnual: newRateAnnual },
    ]);
  }

  function removeGrowthPeriod(id: string) {
    setGrowthSchedule((prev) => prev.filter((entry) => entry.id !== id));
  }

  function updateGrowthEntry(id: string, field: "fromMonth" | "rateAnnual", value: number) {
    setGrowthTouched(true);
    setGrowthSchedule((prev) =>
      prev.map((entry) => (entry.id === id ? { ...entry, [field]: value } : entry))
    );
  }

  // Helper text: show projection for first period's rate
  const firstRate = sortedSchedule[0]?.rateAnnual ?? 0;
  const amount = form.amount;
  let growthHelperText: string;
  if (firstRate > 0 && amount > 0) {
    const projected = amount * Math.pow(1 + firstRate, 10);
    growthHelperText = `→ za 10 let při prvním růstu: ~${formatCZK(Math.round(projected))}/měs.`;
  } else {
    growthHelperText = "0 % = žádná inflace. Doporučujeme alespoň 2–3 % pro výdaje.";
  }

  return (
    <Modal onClose={onCancel}>
      <h3 className="text-lg font-semibold text-gray-800">
        {initial ? "Upravit položku" : "Přidat položku"}
      </h3>
      <form onSubmit={handleSubmit} className="space-y-3">
        {/* Name */}
        <div>
          <label htmlFor="event-name" className="block text-sm font-medium text-gray-700 mb-1">Název</label>
          <input
            id="event-name"
            type="text"
            name="name"
            value={form.name}
            onChange={handleChange}
            onBlur={handleNameBlur}
            className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            required
            placeholder="např. Nájem"
          />
        </div>

        {/* Category */}
        <div>
          <label htmlFor="event-category" className="block text-sm font-medium text-gray-700 mb-1">Kategorie</label>
          <select
            id="event-category"
            name="category"
            value={form.category}
            onChange={handleCategoryChange}
            className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            <option value="income">Příjem</option>
            <option value="expense">Výdaj</option>
          </select>
        </div>

        {/* Amount */}
        <div>
          <label htmlFor="event-amount" className="block text-sm font-medium text-gray-700 mb-1">Částka (Kč)</label>
          <AmountInput
            id="event-amount"
            value={form.amount}
            onChange={(v) => setForm((prev) => ({ ...prev, amount: v }))}
            min={0}
            className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>

        {/* Frequency */}
        <div>
          <label htmlFor="event-frequency" className="block text-sm font-medium text-gray-700 mb-1">Frekvence</label>
          <select
            id="event-frequency"
            name="frequency"
            value={form.frequency}
            onChange={handleChange}
            className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            <option value="monthly">Měsíčně</option>
            <option value="yearly">Ročně</option>
            <option value="one-off">Jednorázově</option>
          </select>
        </div>

        {/* Start month */}
        <div>
          <label htmlFor="event-startDate" className="block text-sm font-medium text-gray-700 mb-1">
            Začátek
          </label>
          <input
            id="event-startDate"
            type="month"
            value={monthOffsetToDate(form.startMonth, startDate)}
            min={startDate}
            onChange={(e) =>
              setForm((prev) => ({
                ...prev,
                startMonth: dateToMonthOffset(e.target.value, startDate),
              }))
            }
            className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
          <p className="text-xs text-gray-500 mt-1">
            Tato položka začíná: {monthOffsetToDate(form.startMonth, startDate).replace("-", "/")} (měsíc {form.startMonth} od začátku plánu)
          </p>
          {startBeyondHorizonError && (
            <p className="text-xs text-red-500 mt-1">
              Datum zahájení je za horizontem plánu — prodlužte horizont nebo vyberte dřívější datum.
            </p>
          )}
        </div>

        {/* End month toggle + field */}
        <div>
          <label htmlFor="event-endForever" className="flex items-center gap-2 text-sm font-medium text-gray-700 mb-1 cursor-pointer">
            <input
              id="event-endForever"
              type="checkbox"
              checked={!hasEndMonth}
              onChange={(e) => {
                const forever = e.target.checked;
                setHasEndMonth(!forever);
                if (forever) {
                  setForm((prev) => ({ ...prev, endMonth: null }));
                } else {
                  // Default end = 1 year after start
                  setForm((prev) => ({ ...prev, endMonth: prev.startMonth + 12 }));
                }
              }}
              className="accent-blue-600"
            />
            bez konce (trvá navždy)
          </label>
          {hasEndMonth && (
            <>
              <label htmlFor="event-endDate" className="block text-sm font-medium text-gray-700 mb-1">
                Konec
              </label>
              <input
                id="event-endDate"
                type="month"
                value={monthOffsetToDate(form.endMonth ?? (form.startMonth + 12), startDate)}
                min={monthOffsetToDate(form.startMonth, startDate)}
                onChange={(e) => {
                  setEndBeforeStartError(false);
                  setForm((prev) => ({
                    ...prev,
                    endMonth: dateToMonthOffset(e.target.value, startDate),
                  }));
                }}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
              {endBeforeStartError && (
                <p className="text-xs text-red-500 mt-1">
                  Datum konce nesmí být před datem začátku.
                </p>
              )}
            </>
          )}
        </div>

        {/* Growth schedule */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">Roční růst</label>
          <div className="space-y-2">
            {sortedSchedule.map((entry, idx) => {
              const isFirst = idx === 0;
              const canRemove = growthSchedule.length > 1;
              return (
                <div key={entry.id} className="flex items-center gap-2">
                  {isFirst ? (
                    <span className="text-sm text-gray-500 w-28 flex-shrink-0">od začátku</span>
                  ) : (
                    <input
                      type="month"
                      value={monthOffsetToDate(entry.fromMonth + form.startMonth, startDate)}
                      onChange={(e) => {
                        const picked = dateToMonthOffset(e.target.value, startDate);
                        updateGrowthEntry(entry.id, "fromMonth", Math.max(0, picked - form.startMonth));
                      }}
                      className="border border-gray-300 rounded-lg px-2 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 w-28 flex-shrink-0"
                    />
                  )}
                  <div className="flex items-center gap-1 flex-1">
                    <input
                      type="number"
                      step={0.01}
                      value={(entry.rateAnnual * 100).toFixed(2)}
                      onChange={(e) => {
                        updateGrowthEntry(entry.id, "rateAnnual", (parseFloat(e.target.value) || 0) / 100);
                      }}
                      className="w-full border border-gray-300 rounded-lg px-2 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                    <span className="text-sm text-gray-500 flex-shrink-0">%</span>
                  </div>
                  <button
                    type="button"
                    onClick={() => removeGrowthPeriod(entry.id)}
                    disabled={!canRemove}
                    className="text-red-400 hover:text-red-600 disabled:text-gray-200 text-sm flex-shrink-0 w-5 text-center"
                    aria-label="Odebrat období"
                  >
                    ×
                  </button>
                </div>
              );
            })}
          </div>
          <button
            type="button"
            onClick={addGrowthPeriod}
            className="mt-2 text-xs text-blue-500 hover:text-blue-700 underline"
          >
            + Přidat období
          </button>
          <p className="text-xs text-gray-500 mt-1">{growthHelperText}</p>
        </div>

        {/* Notes */}
        <div>
          <label htmlFor="event-notes" className="block text-sm font-medium text-gray-700 mb-1">Poznámka</label>
          <textarea
            id="event-notes"
            name="notes"
            value={form.notes ?? ""}
            onChange={handleChange}
            rows={2}
            className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
            placeholder="Volitelná poznámka..."
          />
        </div>

        <div className="flex gap-3 pt-2">
          <button
            type="button"
            onClick={onCancel}
            className="flex-1 border border-gray-300 hover:bg-gray-50 text-gray-700 font-medium rounded-lg px-4 py-2 text-sm transition-colors"
          >
            Zrušit
          </button>
          <button
            type="submit"
            className="flex-1 bg-blue-600 hover:bg-blue-700 text-white font-medium rounded-lg px-4 py-2 text-sm transition-colors"
          >
            {initial ? "Uložit změny" : "Přidat"}
          </button>
        </div>
      </form>
    </Modal>
  );
}
