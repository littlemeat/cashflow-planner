// Modal showing per-event breakdown for a single month
import { useMemo } from "react";
import { Plan } from "../types";
import { getMonthDetail } from "../lib/simulate";
import { formatCZK } from "../lib/formatters";
import { Modal } from "./Modal";

interface MonthDetailModalProps {
  plan: Plan;
  month: number;
  onClose: () => void;
}

function formatRunway(months: number): string {
  if (!isFinite(months) || months > 9999) return "∞";
  return `${Math.round(months)} měs.`;
}

export function MonthDetailModal({ plan, month, onClose }: MonthDetailModalProps) {
  const detail = useMemo(() => getMonthDetail(plan, month), [plan, month]);

  const incomeContributions = detail.contributions.filter((c) => c.category === "income");
  const expenseContributions = detail.contributions.filter((c) => c.category === "expense");

  const netCashflow = detail.income - detail.expenses - detail.mortgagePayment;
  const netPositive = netCashflow >= 0;

  // Format date nicely
  const [yearStr, monthStr] = detail.date.split("-");
  const dateLabel = yearStr && monthStr
    ? new Date(parseInt(yearStr, 10), parseInt(monthStr, 10) - 1, 1).toLocaleString("cs-CZ", { year: "numeric", month: "long" })
    : detail.date;

  return (
    <Modal onClose={onClose} maxWidth="max-w-lg">
      <div className="max-h-[80vh] overflow-y-auto -m-6 p-6 space-y-4">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-lg font-semibold text-gray-800">Měsíc {dateLabel}</h3>
            <p className="text-xs text-gray-400 mt-0.5">Měsíc {month} od začátku plánu</p>
          </div>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 text-xl leading-none"
            aria-label="Zavřít"
          >
            ×
          </button>
        </div>

        {/* Warning badges */}
        {detail.flags.length > 0 && (
          <div className="flex flex-wrap gap-2">
            {detail.flags.includes("cash-negative") && (
              <span className="bg-red-100 text-red-700 text-xs font-medium px-2.5 py-1 rounded-full">
                Hotovost záporná
              </span>
            )}
            {detail.flags.includes("investments-withdrawn") && (
              <span className="bg-yellow-100 text-yellow-700 text-xs font-medium px-2.5 py-1 rounded-full">
                Výběr z investic
              </span>
            )}
          </div>
        )}

        {/* Income + Expense sections side by side */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {/* Příjmy */}
          <section aria-labelledby="income-heading">
            <h4 id="income-heading" className="text-sm font-semibold text-green-700 mb-2">Příjmy</h4>
            {incomeContributions.length === 0 ? (
              <p className="text-xs text-gray-400 italic">Žádné příjmy v tomto měsíci</p>
            ) : (
              <ul className="space-y-1.5">
                {incomeContributions.map((c) => (
                  <li key={c.eventId} className="flex items-center justify-between gap-2 text-sm">
                    <span className="text-gray-700 truncate">{c.eventName}</span>
                    <span className="text-green-700 font-medium whitespace-nowrap">{formatCZK(c.amount)}</span>
                  </li>
                ))}
              </ul>
            )}
            <div className="mt-2 pt-2 border-t border-green-100 flex justify-between text-sm font-semibold">
              <span className="text-gray-600">Celkem</span>
              <span className="text-green-700">{formatCZK(detail.income)}</span>
            </div>
          </section>

          {/* Výdaje + Splátka */}
          <section aria-labelledby="expense-heading">
            <h4 id="expense-heading" className="text-sm font-semibold text-red-700 mb-2">Výdaje + Splátka</h4>
            {expenseContributions.length === 0 && detail.mortgagePayment === 0 ? (
              <p className="text-xs text-gray-400 italic">Žádné výdaje v tomto měsíci</p>
            ) : (
              <ul className="space-y-1.5">
                {expenseContributions.map((c) => (
                  <li key={c.eventId} className="flex items-center justify-between gap-2 text-sm">
                    <span className="text-gray-700 truncate">{c.eventName}</span>
                    <span className="text-red-600 font-medium whitespace-nowrap">{formatCZK(c.amount)}</span>
                  </li>
                ))}
                {detail.mortgagePayment > 0 && (
                  <li className="flex items-center justify-between gap-2 text-sm">
                    <span className="text-gray-700">Splátka hypotéky</span>
                    <span className="text-orange-600 font-medium whitespace-nowrap">{formatCZK(detail.mortgagePayment)}</span>
                  </li>
                )}
              </ul>
            )}
            <div className="mt-2 pt-2 border-t border-red-100 flex justify-between text-sm font-semibold">
              <span className="text-gray-600">Celkem</span>
              <span className="text-red-600">{formatCZK(detail.expenses + detail.mortgagePayment)}</span>
            </div>
          </section>
        </div>

        {/* Footer row */}
        <div className="border-t border-gray-200 pt-4 space-y-3">
          {/* Net cashflow */}
          <div className="flex items-center justify-between">
            <span className="text-sm font-semibold text-gray-700">Čistý cashflow</span>
            <span className={`text-sm font-bold ${netPositive ? "text-green-700" : "text-red-700"}`}>
              {netPositive ? "+" : ""}{formatCZK(netCashflow)}
            </span>
          </div>

          {/* Investment transfer + yield */}
          {(detail.investedThisMonth > 0 || detail.investmentYield > 0) && (
            <div className="bg-green-50 rounded-lg px-3 py-2 text-xs text-gray-600 space-y-1">
              <p className="font-medium text-green-700 mb-1">Investice</p>
              {detail.investedThisMonth > 0 && (
                <div className="flex justify-between">
                  <span>Vloženo tento měsíc</span>
                  <span className="font-medium">+{formatCZK(detail.investedThisMonth)}</span>
                </div>
              )}
              {detail.investmentYield > 0 && (
                <div className="flex justify-between">
                  <span>Výnos z úročení</span>
                  <span className="font-medium text-green-600">+{formatCZK(detail.investmentYield)}</span>
                </div>
              )}
            </div>
          )}

          {/* Mortgage breakdown (if any) */}
          {detail.mortgagePayment > 0 && (
            <div className="bg-orange-50 rounded-lg px-3 py-2 text-xs text-gray-600 space-y-1">
              <p className="font-medium text-orange-700 mb-1">Hypotéka</p>
              <div className="flex justify-between">
                <span>Úrok</span>
                <span>{formatCZK(detail.mortgageInterest)}</span>
              </div>
              <div className="flex justify-between">
                <span>Jistina</span>
                <span>{formatCZK(detail.mortgagePrincipal)}</span>
              </div>
            </div>
          )}

          {/* Account balances */}
          <div className="grid grid-cols-3 gap-2">
            <div className="bg-blue-50 rounded-lg px-3 py-2 text-center">
              <p className="text-xs text-gray-500 mb-0.5">Hotovost</p>
              <p className="text-xs font-bold text-blue-700">{formatCZK(detail.cashAccount)}</p>
            </div>
            <div className="bg-green-50 rounded-lg px-3 py-2 text-center">
              <p className="text-xs text-gray-500 mb-0.5">Investice</p>
              <p className="text-xs font-bold text-green-700">{formatCZK(detail.investmentsBalance)}</p>
            </div>
            <div className="bg-gray-50 rounded-lg px-3 py-2 text-center">
              <p className="text-xs text-gray-500 mb-0.5">Runway</p>
              <p className="text-xs font-bold text-gray-700">{formatRunway(detail.runwayMonths)}</p>
            </div>
          </div>
        </div>
      </div>
    </Modal>
  );
}
