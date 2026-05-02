// Mortgage management panel
import { useState } from "react";
import { usePlanStore } from "../store/usePlanStore";
import { Mortgage } from "../types";
import { MortgageForm } from "./MortgageForm";
import { formatCZK, formatYearMonth, addMonths, computeMonthlyPayment } from "../lib/formatters";

export function MortgagePanel() {
  const { plan, addMortgage, updateMortgage, deleteMortgage } = usePlanStore();
  const [showForm, setShowForm] = useState(false);
  const [editingMortgage, setEditingMortgage] = useState<Mortgage | null>(null);
  const [collapsed, setCollapsed] = useState(false);

  const startDate = plan.baseline.startDate;

  // Compute monthly payment using the first rate period (initial annuity)
  function getInitialPayment(mortgage: Mortgage): number {
    const firstRate = mortgage.rateSchedule[0];
    if (!firstRate) return 0;
    return computeMonthlyPayment(mortgage.principal, firstRate.rateAnnual, mortgage.termMonths);
  }

  function handleAdd(data: Omit<Mortgage, "id">) {
    addMortgage(data);
    setShowForm(false);
  }

  function handleUpdate(data: Omit<Mortgage, "id">) {
    if (editingMortgage) {
      updateMortgage(editingMortgage.id, data);
      setEditingMortgage(null);
    }
  }

  function handleDelete(id: string) {
    if (window.confirm("Opravdu smazat tuto hypotéku?")) {
      deleteMortgage(id);
    }
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
          Hypotéky
        </button>
        {!collapsed && (
          <button
            onClick={() => setShowForm(true)}
            className="bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium rounded-lg px-4 py-2 transition-colors"
          >
            + Přidat hypotéku
          </button>
        )}
      </div>

      {!collapsed && (
        plan.mortgages.length === 0 ? (
        <p className="text-sm text-gray-400 text-center py-6">Žádné hypotéky.</p>
      ) : (
        <div className="space-y-4">
          {plan.mortgages.map((mortgage) => {
            const monthlyPayment = getInitialPayment(mortgage);
            const mortgageStart = addMonths(startDate, mortgage.startMonth);
            const mortgageEnd = addMonths(startDate, mortgage.startMonth + mortgage.termMonths);

            return (
              <div
                key={mortgage.id}
                className="border border-gray-200 rounded-xl p-4 space-y-3"
              >
                <div className="flex items-center justify-between">
                  <h3 className="font-semibold text-gray-800">{mortgage.name}</h3>
                  <div className="flex gap-2">
                    <button
                      onClick={() => setEditingMortgage(mortgage)}
                      className="text-blue-500 hover:text-blue-700 text-xs font-medium"
                    >
                      Upravit
                    </button>
                    <button
                      onClick={() => handleDelete(mortgage.id)}
                      className="text-red-400 hover:text-red-600 text-xs font-medium"
                    >
                      Smazat
                    </button>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-x-6 gap-y-2 text-sm">
                  <div>
                    <span className="text-gray-500">Jistina:</span>{" "}
                    <span className="font-medium text-gray-800">{formatCZK(mortgage.principal)}</span>
                  </div>
                  <div>
                    <span className="text-gray-500">Délka:</span>{" "}
                    <span className="font-medium text-gray-800">{mortgage.termMonths} měs.</span>
                  </div>
                  <div>
                    <span className="text-gray-500">Zahájení:</span>{" "}
                    <span className="font-medium text-gray-800">{formatYearMonth(mortgageStart)}</span>
                  </div>
                  <div>
                    <span className="text-gray-500">Splacení:</span>{" "}
                    <span className="font-medium text-gray-800">{formatYearMonth(mortgageEnd)}</span>
                  </div>
                  {mortgage.insuranceMonthly != null && mortgage.insuranceMonthly > 0 && (
                    <div>
                      <span className="text-gray-500">Pojistné:</span>{" "}
                      <span className="font-medium text-gray-800">{formatCZK(mortgage.insuranceMonthly)}/měs.</span>
                    </div>
                  )}
                  <div className="col-span-2">
                    <span className="text-gray-500">Odhadovaná splátka:</span>{" "}
                    <span className="font-bold text-blue-700 text-base">{formatCZK(monthlyPayment)}/měs.</span>
                    {mortgage.insuranceMonthly != null && mortgage.insuranceMonthly > 0 && (
                      <span className="text-gray-400 text-xs ml-2">
                        (+ {formatCZK(mortgage.insuranceMonthly)} pojistné = {formatCZK(monthlyPayment + mortgage.insuranceMonthly)}/měs.)
                      </span>
                    )}
                  </div>
                </div>

                {/* Rate schedule */}
                <div>
                  <p className="text-xs font-medium text-gray-500 uppercase tracking-wide mb-1">Sazby</p>
                  <div className="flex flex-wrap gap-2">
                    {mortgage.rateSchedule.map((rate) => (
                      <span
                        key={rate.id}
                        className="inline-block bg-gray-100 rounded-full px-3 py-1 text-xs text-gray-700"
                      >
                        od měs. {rate.fromMonth}: {(rate.rateAnnual * 100).toFixed(2)} % p.a.
                      </span>
                    ))}
                  </div>
                </div>

                {/* Extra payments summary — skip zero-amount entries */}
                {mortgage.extraPayments && mortgage.extraPayments.filter(ep => ep.amount > 0).length > 0 && (
                  <div className="text-sm text-gray-600 space-y-0.5">
                    <span className="font-medium">Mimořádné splátky:</span>
                    {mortgage.extraPayments.filter(ep => ep.amount > 0).map((ep) => (
                      <div key={ep.id} className="pl-2 text-xs text-gray-500">
                        {formatCZK(ep.amount)} v {formatYearMonth(addMonths(startDate, ep.month))}
                        {" · "}{ep.strategy === "shorten-term" ? "zkrácení doby" : "snížení splátky"}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )
      )}

      {showForm && (
        <MortgageForm onSave={handleAdd} onCancel={() => setShowForm(false)} />
      )}

      {editingMortgage && (
        <MortgageForm
          initial={editingMortgage}
          onSave={handleUpdate}
          onCancel={() => setEditingMortgage(null)}
        />
      )}
    </div>
  );
}
