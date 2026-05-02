// Baseline configuration panel
import React, { useState, useEffect } from "react";
import { usePlanStore } from "../store/usePlanStore";
import { Baseline } from "../types";
import { AmountInput } from "./AmountInput";

export function BaselinePanel() {
  const { plan, setBaseline } = usePlanStore();
  const [form, setForm] = useState<Baseline>(plan.baseline);
  const [saved, setSaved] = useState(false);
  const [collapsed, setCollapsed] = useState(false);

  // Sync if plan changes externally (import/reset)
  useEffect(() => {
    setForm(plan.baseline);
  }, [plan.baseline]);

  function handleChange(e: React.ChangeEvent<HTMLInputElement>) {
    const { name, value, type } = e.target;
    setForm((prev) => ({
      ...prev,
      [name]: type === "number" ? parseFloat(value) || 0 : value,
    }));
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setBaseline(form);
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  }

  return (
    <div className="bg-white rounded-xl shadow p-5 space-y-4">
      <div className="flex items-center justify-between">
        <button
          onClick={() => setCollapsed((c) => !c)}
          className="flex items-center gap-2 text-lg font-semibold text-gray-800 hover:text-blue-600 transition-colors"
        >
          <svg className={`w-4 h-4 transition-transform ${collapsed ? "-rotate-90" : ""}`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
          </svg>
          Počáteční nastavení
        </button>
      </div>
      {!collapsed && <form onSubmit={handleSubmit} className="space-y-4">
        {/* Grid: 1 col mobile → 2 col sm → 3 col md */}
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">

          {/* Start date */}
          <div>
            <label htmlFor="baseline-startDate" className="block text-sm font-medium text-gray-700 mb-1">
              Datum zahájení
            </label>
            <input
              id="baseline-startDate"
              type="month"
              name="startDate"
              value={form.startDate}
              onChange={handleChange}
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              required
            />
          </div>

          {/* Cash account */}
          <div>
            <label htmlFor="baseline-cashAccount" className="block text-sm font-medium text-gray-700 mb-1">
              Hotovost / běžný účet (Kč)
            </label>
            <AmountInput
              id="baseline-cashAccount"
              value={form.cashAccount}
              onChange={(v) => setForm((prev) => ({ ...prev, cashAccount: v }))}
              min={0}
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          {/* Investments balance */}
          <div>
            <label htmlFor="baseline-investmentsBalance" className="block text-sm font-medium text-gray-700 mb-1">
              Investice – zůstatek (Kč)
            </label>
            <AmountInput
              id="baseline-investmentsBalance"
              value={form.investmentsBalance}
              onChange={(v) => setForm((prev) => ({ ...prev, investmentsBalance: v }))}
              min={0}
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          {/* Investments yield */}
          <div>
            <label htmlFor="baseline-investmentsYieldAnnual" className="block text-sm font-medium text-gray-700 mb-1">
              Roční výnos investic (%)
            </label>
            <input
              id="baseline-investmentsYieldAnnual"
              type="number"
              name="investmentsYieldAnnual"
              value={(form.investmentsYieldAnnual * 100).toFixed(2)}
              onChange={(e) =>
                setForm((prev) => ({
                  ...prev,
                  investmentsYieldAnnual: parseFloat(e.target.value) / 100 || 0,
                }))
              }
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              min={0}
              max={100}
              step={0.1}
            />
          </div>

          {/* Safety buffer months */}
          <div>
            <label htmlFor="baseline-safetyBufferMonths" className="block text-sm font-medium text-gray-700 mb-1">
              Bezpečnostní rezerva (měsíce)
            </label>
            <input
              id="baseline-safetyBufferMonths"
              type="number"
              name="safetyBufferMonths"
              value={form.safetyBufferMonths}
              onChange={handleChange}
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              min={0}
              max={36}
              step={1}
            />
          </div>

        </div>

        {/* Horizon slider — full width */}
        <div>
          <label htmlFor="baseline-horizonYears" className="block text-sm font-medium text-gray-700 mb-1">
            Horizont: <span className="font-bold text-blue-600">{form.horizonYears} let</span>
          </label>
          <input
            id="baseline-horizonYears"
            type="range"
            name="horizonYears"
            value={form.horizonYears}
            onChange={handleChange}
            className="w-full accent-blue-600"
            min={1}
            max={50}
            step={1}
          />
          <div className="flex justify-between text-xs text-gray-400 mt-1">
            <span>1 rok</span>
            <span>50 let</span>
          </div>
        </div>

        <button
          type="submit"
          className="w-full bg-blue-600 hover:bg-blue-700 text-white font-medium rounded-lg px-4 py-2 text-sm transition-colors"
        >
          {saved ? "Uloženo ✓" : "Uložit nastavení"}
        </button>
      </form>}
    </div>
  );
}
