// Add/Edit mortgage modal form — with live amortization summary
import React, { useState, useEffect, useMemo } from "react";
import { v4 as uuidv4 } from "uuid";
import { Mortgage } from "../types";
import { formatCZK, computeMonthlyPayment, dateToMonthOffset, monthOffsetToDate } from "../lib/formatters";
import { usePlanStore } from "../store/usePlanStore";
import { AmountInput } from "./AmountInput";
import { Modal } from "./Modal";

type RateEntry = { id: string; fromMonth: number; rateAnnual: number };
type MortgageFormData = Omit<Mortgage, "id">;

interface MortgageFormProps {
  initial?: Mortgage;
  onSave: (data: MortgageFormData) => void;
  onCancel: () => void;
}

function makeDefaultRate(): RateEntry {
  return { id: uuidv4(), fromMonth: 0, rateAnnual: 0.045 };
}

const defaultForm: MortgageFormData = {
  name: "",
  principal: 0,
  startMonth: 0,
  termMonths: 360,
  rateSchedule: [makeDefaultRate()],
  insuranceMonthly: 0,
};

// ── Amortization helpers ──────────────────────────────────────────────────────

interface AmortPeriodSummary {
  /** Total paid after X months */
  totalPaid: number;
  /** Total interest paid after X months */
  totalInterest: number;
  /** Remaining principal after X months */
  remainingPrincipal: number;
  /** Fraction of original principal repaid */
  principalRepaidPct: number;
}

interface AmortSummary {
  /** Monthly payment for first rate period */
  monthlyPayment1: number;
  /** Monthly payment for second rate period (if exists), else null */
  monthlyPayment2: number | null;
  /** Total paid over full term */
  totalPaid: number;
  /** Total interest paid over full term */
  totalInterest: number;
  /** Original principal */
  principal: number;
  /** Principal fraction as 0-1 */
  principalFraction: number;
  /** Interest fraction as 0-1 */
  interestFraction: number;
  /** Summaries at specific year checkpoints */
  atYear: (years: number) => AmortPeriodSummary;
}

function computeAmortSummary(
  principal: number,
  termMonths: number,
  rateSchedule: RateEntry[]
): AmortSummary | null {
  if (principal <= 0 || termMonths <= 0 || rateSchedule.length === 0) return null;

  // Sort rate schedule by fromMonth
  const sorted = [...rateSchedule].sort((a, b) => a.fromMonth - b.fromMonth);

  // Get rate for a given month offset within the loan
  function rateAt(monthIdx: number): number {
    let rate = sorted[0]?.rateAnnual ?? 0;
    for (const entry of sorted) {
      if (monthIdx >= entry.fromMonth) rate = entry.rateAnnual;
      else break;
    }
    return rate;
  }

  // Monthly payment for first period
  const rate1 = sorted[0]?.rateAnnual ?? 0;
  const payment1 = computeMonthlyPayment(principal, rate1, termMonths);

  // Monthly payment for second period (if exists)
  let payment2: number | null = null;
  if (sorted.length >= 2 && sorted[1]) {
    const rate2 = sorted[1].rateAnnual;
    const switchMonth = sorted[1].fromMonth;
    // Remaining principal at switchMonth: simulate up to that point
    let rem = principal;
    for (let i = 0; i < switchMonth && i < termMonths; i++) {
      const r = rateAt(i) / 12;
      const interestPortion = rem * r;
      const principalPortion = payment1 - interestPortion;
      rem = Math.max(0, rem - principalPortion);
    }
    const remainingTerm = termMonths - switchMonth;
    if (remainingTerm > 0 && rem > 0) {
      payment2 = computeMonthlyPayment(rem, rate2, remainingTerm);
    }
  }

  // Full amortization schedule
  // We store cumulative paid and interest per month for checkpoint lookups
  const cumulativePaid: number[] = [];
  const cumulativeInterest: number[] = [];
  const remainingPrincipals: number[] = [];

  let rem = principal;
  let totalPaidAcc = 0;
  let totalInterestAcc = 0;

  for (let i = 0; i < termMonths; i++) {
    if (rem <= 0) {
      cumulativePaid.push(totalPaidAcc);
      cumulativeInterest.push(totalInterestAcc);
      remainingPrincipals.push(0);
      continue;
    }
    const r = rateAt(i) / 12;
    const interestPortion = rem * r;
    // Use correct payment for this period
    let payment: number;
    if (payment2 !== null && sorted[1] && i >= sorted[1].fromMonth) {
      payment = payment2;
    } else {
      payment = payment1;
    }
    const principalPortion = Math.max(0, payment - interestPortion);
    rem = Math.max(0, rem - principalPortion);
    totalPaidAcc += payment;
    totalInterestAcc += interestPortion;
    cumulativePaid.push(totalPaidAcc);
    cumulativeInterest.push(totalInterestAcc);
    remainingPrincipals.push(rem);
  }

  const totalPaid = totalPaidAcc;
  const totalInterest = totalInterestAcc;
  const principalFraction = totalPaid > 0 ? principal / totalPaid : 0;
  const interestFraction = totalPaid > 0 ? totalInterest / totalPaid : 0;

  function atYear(years: number): AmortPeriodSummary {
    const monthIdx = Math.min(years * 12 - 1, termMonths - 1);
    const paid = cumulativePaid[monthIdx] ?? totalPaid;
    const interest = cumulativeInterest[monthIdx] ?? totalInterest;
    const remaining = remainingPrincipals[monthIdx] ?? 0;
    const repaidPct = principal > 0 ? ((principal - remaining) / principal) * 100 : 100;
    return { totalPaid: paid, totalInterest: interest, remainingPrincipal: remaining, principalRepaidPct: repaidPct };
  }

  return { monthlyPayment1: payment1, monthlyPayment2: payment2, totalPaid, totalInterest, principal, principalFraction, interestFraction, atYear };
}

// ── Amortization summary UI component ────────────────────────────────────────

function AmortizationSummary({ summary, termMonths }: { summary: AmortSummary; termMonths: number }) {
  const maxYears = Math.ceil(termMonths / 12);
  const [selectedYear, setSelectedYear] = useState(5);

  // Clamp selected year if term changes
  const effectiveYear = Math.min(Math.max(1, selectedYear), maxYears);
  const atYear = summary.atYear(effectiveYear);

  const principalPct = Math.round(summary.principalFraction * 100);
  const interestPct = 100 - principalPct;

  return (
    <div className="border border-gray-200 rounded-xl p-4 space-y-4 bg-gray-50">
      <p className="text-sm font-semibold text-gray-700 border-b border-gray-200 pb-2">
        Přehled splácení
      </p>

      {/* Monthly payments */}
      <div className="space-y-1">
        <div className="flex justify-between text-sm">
          <span className="text-gray-600">
            Měsíční splátka{summary.monthlyPayment2 !== null ? " (1. období)" : ""}:
          </span>
          <span className="font-semibold text-gray-800">{formatCZK(summary.monthlyPayment1)}</span>
        </div>
        {summary.monthlyPayment2 !== null && (
          <div className="flex justify-between text-sm">
            <span className="text-gray-600">Měsíční splátka (2. období):</span>
            <span className="font-semibold text-gray-800">{formatCZK(summary.monthlyPayment2)}</span>
          </div>
        )}
      </div>

      {/* Totals */}
      <div className="space-y-1 border-t border-gray-200 pt-3">
        <div className="flex justify-between text-sm">
          <span className="text-gray-600">Celkem zaplaceno:</span>
          <span className="font-semibold text-gray-800">{formatCZK(summary.totalPaid)}</span>
        </div>
        <div className="flex justify-between text-sm">
          <span className="text-gray-600">Z toho úroky celkem:</span>
          <span className="font-medium text-orange-600">{formatCZK(summary.totalInterest)}</span>
        </div>
        <div className="flex justify-between text-sm">
          <span className="text-gray-600">Z toho jistina:</span>
          <span className="font-medium text-blue-600">{formatCZK(summary.principal)}</span>
        </div>
      </div>

      {/* At-year breakdown */}
      <div className="border-t border-gray-200 pt-3 space-y-2">
        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-sm text-gray-600">Po</span>
          <input
            type="number"
            value={selectedYear}
            onChange={(e) => setSelectedYear(parseInt(e.target.value) || 1)}
            min={1}
            max={maxYears}
            className="w-16 border border-gray-300 rounded-lg px-2 py-1 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
          <span className="text-sm text-gray-600">letech:</span>
        </div>
        <div className="space-y-1 pl-1">
          <div className="flex justify-between text-sm">
            <span className="text-gray-600">Zaplaceno za {effectiveYear} let:</span>
            <span className="font-medium text-gray-800">{formatCZK(atYear.totalPaid)}</span>
          </div>
          <div className="flex justify-between text-sm">
            <span className="text-gray-600">Z toho úroky:</span>
            <span className="font-medium text-orange-600">{formatCZK(atYear.totalInterest)}</span>
          </div>
          <div className="flex justify-between text-sm">
            <span className="text-gray-600">Zbývající jistina:</span>
            <span className="font-medium text-blue-600">{formatCZK(atYear.remainingPrincipal)}</span>
          </div>
          <div className="flex justify-between text-sm">
            <span className="text-gray-600">Splaceno z jistiny:</span>
            <span className="font-medium text-green-600">{atYear.principalRepaidPct.toFixed(1)} %</span>
          </div>
        </div>
      </div>

      {/* Visual bar: principal vs interest */}
      <div className="border-t border-gray-200 pt-3 space-y-2">
        <p className="text-xs text-gray-500">Poměr jistina / úrok (celé splácení)</p>
        <div className="flex rounded-full overflow-hidden h-4 w-full">
          <div
            className="bg-blue-500 h-full transition-all"
            style={{ width: `${principalPct}%` }}
            title={`Jistina: ${principalPct} %`}
          />
          <div
            className="bg-orange-400 h-full transition-all"
            style={{ width: `${interestPct}%` }}
            title={`Úroky: ${interestPct} %`}
          />
        </div>
        <div className="flex gap-4 text-xs text-gray-600">
          <span className="flex items-center gap-1">
            <span className="inline-block w-2.5 h-2.5 rounded-sm bg-blue-500" />
            Jistina: {principalPct} %
          </span>
          <span className="flex items-center gap-1">
            <span className="inline-block w-2.5 h-2.5 rounded-sm bg-orange-400" />
            Úroky: {interestPct} %
          </span>
        </div>
      </div>
    </div>
  );
}

// ── Main form component ───────────────────────────────────────────────────────

export function MortgageForm({ initial, onSave, onCancel }: MortgageFormProps) {
  const { plan } = usePlanStore();
  const startDate = plan.baseline.startDate;

  const [form, setForm] = useState<MortgageFormData>(
    initial
      ? { ...initial, rateSchedule: initial.rateSchedule.map((r) => ({ ...r })) }
      : { ...defaultForm, rateSchedule: [makeDefaultRate()] }
  );

  type ExtraEntry = { id: string; month: number; amount: number; strategy: "shorten-term" | "lower-payment" };

  const [extraPayments, setExtraPayments] = useState<ExtraEntry[]>(
    initial?.extraPayments?.map((ep) => ({ ...ep })) ?? []
  );

  useEffect(() => {
    if (initial) {
      setForm({ ...initial, rateSchedule: initial.rateSchedule.map((r) => ({ ...r })) });
      setExtraPayments(initial.extraPayments?.map((ep) => ({ ...ep })) ?? []);
    }
  }, [initial]);

  function addExtraPayment() {
    setExtraPayments((prev) => [
      ...prev,
      { id: uuidv4(), month: form.startMonth, amount: 0, strategy: "shorten-term" },
    ]);
  }

  function updateExtraPayment(id: string, field: keyof Omit<ExtraEntry, "id">, value: string | number) {
    setExtraPayments((prev) =>
      prev.map((ep) => (ep.id === id ? { ...ep, [field]: value } : ep))
    );
  }

  function removeExtraPayment(id: string) {
    setExtraPayments((prev) => prev.filter((ep) => ep.id !== id));
  }

  // Live amortization summary
  const amortSummary = useMemo(
    () => computeAmortSummary(form.principal, form.termMonths, form.rateSchedule),
    [form.principal, form.termMonths, form.rateSchedule]
  );

  function handleChange(e: React.ChangeEvent<HTMLInputElement>) {
    const { name, value, type } = e.target;
    setForm((prev) => ({
      ...prev,
      [name]: type === "number" ? parseFloat(value) || 0 : value,
    }));
  }

  function handleRateChange(id: string, field: "fromMonth" | "rateAnnual", value: string) {
    setForm((prev) => {
      const updated = prev.rateSchedule.map((r) => {
        if (r.id !== id) return r;
        return {
          ...r,
          [field]: field === "rateAnnual" ? parseFloat(value) / 100 || 0 : parseInt(value) || 0,
        };
      });
      return { ...prev, rateSchedule: updated };
    });
  }

  function addRatePeriod() {
    setForm((prev) => ({
      ...prev,
      rateSchedule: [...prev.rateSchedule, { id: uuidv4(), fromMonth: 60, rateAnnual: 0.035 }],
    }));
  }

  function removeRatePeriod(id: string) {
    setForm((prev) => ({
      ...prev,
      rateSchedule: prev.rateSchedule.filter((r) => r.id !== id),
    }));
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const cleaned: MortgageFormData = {
      ...form,
      insuranceMonthly: form.insuranceMonthly && form.insuranceMonthly > 0 ? form.insuranceMonthly : undefined,
      extraPayments: extraPayments.length > 0 ? extraPayments : undefined,
    };
    onSave(cleaned);
  }

  return (
    <Modal onClose={onCancel} maxWidth="max-w-3xl">
      <div className="max-h-[80vh] overflow-y-auto -m-6 p-6">
        <h3 className="text-lg font-semibold text-gray-800">
          {initial ? "Upravit hypotéku" : "Přidat hypotéku"}
        </h3>

        {/* Two-column layout: form on left, amort summary on right */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mt-4">
          {/* Left: form fields */}
          <form onSubmit={handleSubmit} className="space-y-3" id="mortgage-form">
            {/* Name */}
            <div>
              <label htmlFor="mortgage-name" className="block text-sm font-medium text-gray-700 mb-1">Název</label>
              <input
                id="mortgage-name"
                type="text"
                name="name"
                value={form.name}
                onChange={handleChange}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                required
                placeholder="např. Hypo byt"
              />
            </div>

            {/* Principal */}
            <div>
              <label htmlFor="mortgage-principal" className="block text-sm font-medium text-gray-700 mb-1">Jistina (Kč)</label>
              <AmountInput
                id="mortgage-principal"
                value={form.principal}
                onChange={(v) => setForm((prev) => ({ ...prev, principal: v }))}
                min={0}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>

            {/* Start month */}
            <div>
              <label htmlFor="mortgage-startDate" className="block text-sm font-medium text-gray-700 mb-1">
                Začátek splácení
              </label>
              <input
                id="mortgage-startDate"
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
            </div>

            {/* Term — entered in years, stored as months */}
            <div>
              <label htmlFor="mortgage-termYears" className="block text-sm font-medium text-gray-700 mb-1">
                Délka (roky)
              </label>
              <input
                id="mortgage-termYears"
                type="number"
                value={Math.round(form.termMonths / 12)}
                onChange={(e) => {
                  const years = Math.max(1, parseInt(e.target.value) || 1);
                  setForm((prev) => ({ ...prev, termMonths: years * 12 }));
                }}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                min={1}
                max={50}
                step={1}
              />
              <p className="text-xs text-gray-400 mt-0.5">= {form.termMonths} měsíců</p>
            </div>

            {/* Insurance */}
            <div>
              <label htmlFor="mortgage-insuranceMonthly" className="block text-sm font-medium text-gray-700 mb-1">
                Pojistné (Kč/měs.)
              </label>
              <AmountInput
                id="mortgage-insuranceMonthly"
                value={form.insuranceMonthly ?? 0}
                onChange={(v) => setForm((prev) => ({ ...prev, insuranceMonthly: v }))}
                min={0}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>

            {/* Rate schedule */}
            <div>
              <div className="flex items-center justify-between mb-2">
                <label className="block text-sm font-medium text-gray-700">Harmonogram sazeb</label>
                <button
                  type="button"
                  onClick={addRatePeriod}
                  className="text-blue-600 hover:text-blue-800 text-xs font-medium"
                >
                  + Přidat období
                </button>
              </div>
              <div className="space-y-2">
                {form.rateSchedule.map((rate) => (
                  <div key={rate.id} className="flex gap-2 items-end">
                    <div className="flex-1">
                      <label htmlFor={"rate-from-" + rate.id} className="block text-xs text-gray-500 mb-1">Od měsíce (od zah. hypotéky)</label>
                      <input
                        id={"rate-from-" + rate.id}
                        type="number"
                        value={rate.fromMonth}
                        onChange={(e) => handleRateChange(rate.id, "fromMonth", e.target.value)}
                        className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                        min={0}
                        step={1}
                      />
                      <p className="text-xs text-gray-400 mt-0.5">
                        = {monthOffsetToDate(form.startMonth + rate.fromMonth, startDate).replace("-", "/")}
                      </p>
                    </div>
                    <div className="flex-1">
                      <label htmlFor={"rate-annual-" + rate.id} className="block text-xs text-gray-500 mb-1">Sazba (%)</label>
                      <input
                        id={"rate-annual-" + rate.id}
                        type="number"
                        value={(rate.rateAnnual * 100).toFixed(2)}
                        onChange={(e) => handleRateChange(rate.id, "rateAnnual", e.target.value)}
                        className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                        min={0}
                        max={100}
                        step={0.05}
                      />
                    </div>
                    {form.rateSchedule.length > 1 && (
                      <button
                        type="button"
                        onClick={() => removeRatePeriod(rate.id)}
                        className="text-red-400 hover:text-red-600 pb-2"
                      >
                        ✕
                      </button>
                    )}
                  </div>
                ))}
              </div>
            </div>

            {/* Extra payments (Mimořádné splátky) */}
            <div className="border-t border-gray-100 pt-3 space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium text-gray-700">Mimořádné splátky</span>
                <button
                  type="button"
                  onClick={addExtraPayment}
                  className="text-xs text-blue-600 hover:text-blue-800 font-medium"
                >
                  + Přidat splátku
                </button>
              </div>
              {extraPayments.length === 0 && (
                <p className="text-xs text-gray-400 italic">Žádné mimořádné splátky.</p>
              )}
              {extraPayments.map((ep, idx) => (
                <div key={ep.id} className="pl-2 border-l-2 border-blue-100 space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-medium text-gray-600">Splátka {idx + 1}</span>
                    <button
                      type="button"
                      onClick={() => removeExtraPayment(ep.id)}
                      className="text-xs text-red-400 hover:text-red-600"
                    >
                      Odebrat
                    </button>
                  </div>
                  <div>
                    <label className="block text-xs text-gray-500 mb-1">Měsíc splátky</label>
                    <input
                      type="month"
                      value={monthOffsetToDate(ep.month, startDate)}
                      min={startDate}
                      onChange={(e) =>
                        updateExtraPayment(ep.id, "month", dateToMonthOffset(e.target.value, startDate))
                      }
                      className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                  </div>
                  <div>
                    <label className="block text-xs text-gray-500 mb-1">Výše (Kč)</label>
                    <AmountInput
                      value={ep.amount}
                      onChange={(v) => updateExtraPayment(ep.id, "amount", v)}
                      min={0}
                      className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                  </div>
                  <div>
                    <label className="block text-xs text-gray-500 mb-1">Strategie</label>
                    <select
                      value={ep.strategy}
                      onChange={(e) =>
                        updateExtraPayment(ep.id, "strategy", e.target.value as "shorten-term" | "lower-payment")
                      }
                      className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                    >
                      <option value="shorten-term">Zkrátit dobu splácení</option>
                      <option value="lower-payment">Snížit splátku</option>
                    </select>
                  </div>
                </div>
              ))}
            </div>
          </form>

          {/* Right: live amortization summary */}
          <div className="flex flex-col gap-4">
            {amortSummary ? (
              <AmortizationSummary summary={amortSummary} termMonths={form.termMonths} />
            ) : (
              <div className="border border-dashed border-gray-200 rounded-xl p-6 flex items-center justify-center text-sm text-gray-400 text-center">
                Zadejte jistinu a délku splácení pro zobrazení přehledu
              </div>
            )}
          </div>
        </div>

        {/* Action buttons (outside the form, submitted via form id) */}
        <div className="flex gap-3 pt-4 mt-4 border-t border-gray-100">
          <button
            type="button"
            onClick={onCancel}
            className="flex-1 border border-gray-300 hover:bg-gray-50 text-gray-700 font-medium rounded-lg px-4 py-2 text-sm transition-colors"
          >
            Zrušit
          </button>
          <button
            type="submit"
            form="mortgage-form"
            className="flex-1 bg-blue-600 hover:bg-blue-700 text-white font-medium rounded-lg px-4 py-2 text-sm transition-colors"
          >
            {initial ? "Uložit změny" : "Přidat"}
          </button>
        </div>
      </div>
    </Modal>
  );
}
