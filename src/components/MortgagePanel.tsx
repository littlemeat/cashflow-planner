// Mortgage management panel
import { useState } from "react";
import { usePlanStore } from "../store/usePlanStore";
import { Mortgage } from "../types";
import { MortgageForm } from "./MortgageForm";
import { CollapsiblePanel } from "./CollapsiblePanel";
import { formatCZK, formatYearMonth, addMonths, computeMonthlyPayment } from "../lib/formatters";

// Compute the remaining principal at a given number of months into the mortgage,
// assuming constant payment from the first rate period.
function principalAtMonth(mortgage: Mortgage, months: number): number {
  const rate = mortgage.rateSchedule[0]?.rateAnnual ?? 0;
  const r = rate / 12;
  const payment = computeMonthlyPayment(mortgage.principal, rate, mortgage.termMonths);
  if (r === 0) return Math.max(0, mortgage.principal - payment * months);
  return (
    mortgage.principal * Math.pow(1 + r, months) -
    payment * ((Math.pow(1 + r, months) - 1) / r)
  );
}

// Compute per-period payments for each rate schedule entry
interface RatePeriodPayment {
  id: string;
  fromMonth: number;
  rateAnnual: number;
  monthlyPayment: number;
}

function getRatePeriodPayments(mortgage: Mortgage): RatePeriodPayment[] {
  return mortgage.rateSchedule.map((rate, idx) => {
    if (idx === 0) {
      // First period: use original principal and full term
      return {
        id: rate.id,
        fromMonth: rate.fromMonth,
        rateAnnual: rate.rateAnnual,
        monthlyPayment: computeMonthlyPayment(
          mortgage.principal,
          rate.rateAnnual,
          mortgage.termMonths
        ),
      };
    }
    // Subsequent periods: compute remaining principal at rate boundary
    const prevRate = mortgage.rateSchedule[idx - 1]!;
    const monthsElapsed = rate.fromMonth - prevRate.fromMonth;
    const remaining = principalAtMonth(mortgage, monthsElapsed);
    const remainingMonths = mortgage.termMonths - rate.fromMonth;
    return {
      id: rate.id,
      fromMonth: rate.fromMonth,
      rateAnnual: rate.rateAnnual,
      monthlyPayment: computeMonthlyPayment(
        Math.max(0, remaining),
        rate.rateAnnual,
        Math.max(1, remainingMonths)
      ),
    };
  });
}

function EyeIcon({ hidden }: { hidden?: boolean }) {
  return hidden ? (
    <svg viewBox="0 0 20 20" fill="currentColor" width="14" height="14" aria-hidden>
      <path fillRule="evenodd" d="M3.707 2.293a1 1 0 00-1.414 1.414l14 14a1 1 0 001.414-1.414l-1.473-1.473A10.014 10.014 0 0019.542 10C18.268 5.943 14.478 3 10 3a9.958 9.958 0 00-4.512 1.074l-1.78-1.781zm4.261 4.26l1.514 1.515a2.003 2.003 0 012.45 2.45l1.514 1.514a4 4 0 00-5.478-5.478z" clipRule="evenodd" />
      <path d="M12.454 16.697L9.75 13.992a4 4 0 01-3.742-3.741L2.335 6.578A9.98 9.98 0 00.458 10c1.274 4.057 5.064 7 9.542 7 .847 0 1.669-.105 2.454-.303z" />
    </svg>
  ) : (
    <svg viewBox="0 0 20 20" fill="currentColor" width="14" height="14" aria-hidden>
      <path d="M10 12a2 2 0 100-4 2 2 0 000 4z" />
      <path fillRule="evenodd" d="M.458 10C1.732 5.943 5.522 3 10 3s8.268 2.943 9.542 7c-1.274 4.057-5.064 7-9.542 7S1.732 14.057.458 10zM14 10a4 4 0 11-8 0 4 4 0 018 0z" clipRule="evenodd" />
    </svg>
  );
}

export function MortgagePanel() {
  const { plan, addMortgage, updateMortgage, deleteMortgage } = usePlanStore();
  const [showForm, setShowForm] = useState(false);
  const [editingMortgage, setEditingMortgage] = useState<Mortgage | null>(null);

  const startDate = plan.baseline.startDate;

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

  const headerRight = (
    <button
      onClick={() => setShowForm(true)}
      className="bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium rounded-lg px-4 py-2 transition-colors"
    >
      + Přidat hypotéku
    </button>
  );

  return (
    <CollapsiblePanel title="Hypotéky" headerRight={headerRight}>
      <>
        {plan.mortgages.length === 0 ? (
          <p className="text-sm text-gray-400 text-center py-6">Žádné hypotéky.</p>
        ) : (
          <div className="space-y-4">
            {plan.mortgages.map((mortgage) => {
              const ratePeriodPayments = getRatePeriodPayments(mortgage);
              const firstPeriod = ratePeriodPayments[0];
              const mortgageStart = addMonths(startDate, mortgage.startMonth);
              const mortgageEnd = addMonths(startDate, mortgage.startMonth + mortgage.termMonths);

              return (
                <div
                  key={mortgage.id}
                  className="border border-gray-200 rounded-xl p-4 space-y-3"
                  style={{ opacity: mortgage.hidden ? 0.4 : 1 }}
                >
                  <div className="flex items-center justify-between">
                    <h3 className="font-semibold text-gray-800">{mortgage.name}</h3>
                    <div className="flex gap-2 items-center">
                      <button
                        onClick={() => updateMortgage(mortgage.id, { hidden: !mortgage.hidden })}
                        title={mortgage.hidden ? "Zobrazit v simulaci" : "Skrýt ze simulace"}
                        className={`flex items-center ${mortgage.hidden ? "text-gray-300 hover:text-gray-500" : "text-gray-400 hover:text-gray-600"}`}
                      >
                        <EyeIcon hidden={mortgage.hidden} />
                      </button>
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
                    {firstPeriod && mortgage.insuranceMonthly != null && mortgage.insuranceMonthly > 0 && (
                      <div className="col-span-2 text-xs text-gray-400">
                        Splátka + pojistné (1. období): {formatCZK(firstPeriod.monthlyPayment + mortgage.insuranceMonthly)}/měs.
                      </div>
                    )}
                  </div>

                  {/* Rate schedule with per-period payment */}
                  <div>
                    <p className="text-xs font-medium text-gray-500 uppercase tracking-wide mb-1">Sazby + splátky</p>
                    <div className="space-y-1">
                      {ratePeriodPayments.map((period) => (
                        <div
                          key={period.id}
                          className="flex items-center gap-2 text-xs text-gray-700"
                        >
                          <span className="bg-gray-100 rounded-full px-3 py-1 whitespace-nowrap">
                            od měs. {period.fromMonth}:{" "}
                            <span className="font-medium">{(period.rateAnnual * 100).toFixed(2)} %</span>
                            {" → "}
                            <span className="font-bold text-blue-700">{formatCZK(period.monthlyPayment)}/měs.</span>
                          </span>
                        </div>
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
      </>
    </CollapsiblePanel>
  );
}
