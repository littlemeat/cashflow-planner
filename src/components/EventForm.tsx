// Add/Edit cashflow event modal form
import React, { useState, useEffect, useRef } from "react";
import { CashflowEvent, EventCategory } from "../types";
import { formatCZK, dateToMonthOffset, monthOffsetToDate } from "../lib/formatters";
import { usePlanStore } from "../store/usePlanStore";
import { AmountInput } from "./AmountInput";

type EventFormData = Omit<CashflowEvent, "id">;

interface EventFormProps {
  initial?: CashflowEvent;
  onSave: (data: EventFormData) => void;
  onCancel: () => void;
}

const defaultForm: EventFormData = {
  name: "",
  category: "expense",
  amount: 0,
  frequency: "monthly",
  startMonth: 0,
  endMonth: null,
  annualGrowthPct: 0,
  notes: "",
};

function suggestGrowthRate(name: string, category: EventCategory): number {
  const n = name.toLowerCase();
  if (n.includes("jídlo") || n.includes("jidlo") || n.includes("potraviny")) return 0.03;
  if (n.includes("energie") || n.includes("elektr") || n.includes("plyn")) return 0.04;
  if (n.includes("nájem") || n.includes("najem") || n.includes("nájemné")) return 0.04;
  if (n.includes("plat") || n.includes("mzda") || n.includes("příjem") || n.includes("prijem")) return 0.03;
  if (category === "expense") return 0.025;
  return 0;
}

export function EventForm({ initial, onSave, onCancel }: EventFormProps) {
  const { plan } = usePlanStore();
  const startDate = plan.baseline.startDate;
  const mouseDownTarget = useRef<EventTarget | null>(null);

  const [form, setForm] = useState<EventFormData>(
    initial ? { ...initial } : { ...defaultForm }
  );
  const [hasEndMonth, setHasEndMonth] = useState(initial?.endMonth != null);
  // Track whether the user has manually edited the growth % field
  const [growthTouched, setGrowthTouched] = useState(false);

  useEffect(() => {
    if (initial) {
      setForm({ ...initial });
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
    setForm((prev) => {
      const updated = { ...prev, category: newCategory };
      if (!growthTouched) {
        updated.annualGrowthPct = suggestGrowthRate(prev.name, newCategory);
      }
      return updated;
    });
  }

  function handleNameBlur(e: React.FocusEvent<HTMLInputElement>) {
    if (!growthTouched) {
      const suggested = suggestGrowthRate(e.target.value, form.category);
      setForm((prev) => ({ ...prev, annualGrowthPct: suggested }));
    }
  }

  function handleGrowthChange(e: React.ChangeEvent<HTMLInputElement>) {
    setGrowthTouched(true);
    setForm((prev) => ({
      ...prev,
      annualGrowthPct: parseFloat(e.target.value) / 100 || 0,
    }));
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    onSave({
      ...form,
      endMonth: hasEndMonth ? form.endMonth : null,
    });
  }

  // Helper text for the growth field
  const growthPct = form.annualGrowthPct;
  const amount = form.amount;
  let growthHelperText: string;
  if (growthPct > 0 && amount > 0) {
    const projected = amount * Math.pow(1 + growthPct, 10);
    growthHelperText = `→ za 10 let: ~${formatCZK(Math.round(projected))}/měs.`;
  } else {
    growthHelperText = "0 % = žádná inflace. Doporučujeme alespoň 2–3 % pro výdaje.";
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
      onMouseDown={(e) => { mouseDownTarget.current = e.target; }}
      onClick={(e) => {
        if (e.target === e.currentTarget && mouseDownTarget.current === e.currentTarget) {
          onCancel();
        }
      }}
    >
      <div className="bg-white rounded-xl shadow-xl w-full max-w-md p-6 space-y-4">
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
                  min={startDate}
                  onChange={(e) =>
                    setForm((prev) => ({
                      ...prev,
                      endMonth: dateToMonthOffset(e.target.value, startDate),
                    }))
                  }
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </>
            )}
          </div>

          {/* Annual growth */}
          <div>
            <label htmlFor="event-annualGrowthPct" className="block text-sm font-medium text-gray-700 mb-1">
              Roční růst / inflace (%)
            </label>
            <input
              id="event-annualGrowthPct"
              type="number"
              name="annualGrowthPct"
              value={(form.annualGrowthPct * 100).toFixed(2)}
              onChange={handleGrowthChange}
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              step={0.1}
            />
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
      </div>
    </div>
  );
}

