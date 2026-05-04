// Preset wizard: Převzetí hypotéky
// Creates a one-time cash payment (purchase price − assumed principal) + a mortgage entry
import { useState, useEffect, useMemo } from "react";
import { usePlanStore } from "../../store/usePlanStore";
import { AmountInput } from "../AmountInput";
import { Modal } from "../Modal";
import { formatCZK, computeMonthlyPayment, dateToMonthOffset, monthOffsetToDate } from "../../lib/formatters";

interface Props {
  onClose: () => void;
}

export function PrevzetiHypoteky({ onClose }: Props) {
  const { plan, batchUpdate } = usePlanStore();
  const startDate = plan.baseline.startDate;

  // ── Form state ────────────────────────────────────────────────────────────
  const [propertyPrice, setPropertyPrice] = useState(0);
  const [remainingPrincipal, setRemainingPrincipal] = useState(0);
  const [takeoverDate, setTakeoverDate] = useState(startDate);
  const [termYears, setTermYears] = useState(20);
  const [currentRate, setCurrentRate] = useState(3.5);
  const [fixationEnd, setFixationEnd] = useState(""); // "" = no second rate period
  const [rateAfterFixation, setRateAfterFixation] = useState(4.5);
  const [mortgageName, setMortgageName] = useState("Převzatá hypotéka");
  const [insuranceMonthly, setInsuranceMonthly] = useState(0);
  const [success, setSuccess] = useState(false);

  const takeoverOffset = dateToMonthOffset(takeoverDate, startDate);
  const termMonths = termYears * 12;
  const cashPayment = Math.max(0, propertyPrice - remainingPrincipal);

  // Fixation end → fromMonth relative to mortgage start
  const fixationFromMonth = useMemo(() => {
    if (!fixationEnd) return null;
    const fixationOffset = dateToMonthOffset(fixationEnd, startDate);
    return Math.max(1, fixationOffset - takeoverOffset);
  }, [fixationEnd, startDate, takeoverOffset]);

  // Live monthly payment estimate
  const estimatedPayment = useMemo(() => {
    if (remainingPrincipal <= 0 || termMonths <= 0) return null;
    return computeMonthlyPayment(remainingPrincipal, currentRate / 100, termMonths);
  }, [remainingPrincipal, termMonths, currentRate]);

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (remainingPrincipal <= 0 || termYears <= 0) return;

    const rateSchedule = [
      { id: crypto.randomUUID(), fromMonth: 0, rateAnnual: currentRate / 100 },
    ];
    if (fixationFromMonth !== null && fixationFromMonth < termMonths) {
      rateSchedule.push({
        id: crypto.randomUUID(),
        fromMonth: fixationFromMonth,
        rateAnnual: rateAfterFixation / 100,
      });
    }

    // Atomic: one-time cash payment + mortgage in a single batchUpdate → single undo entry
    batchUpdate((plan) => {
      const events = cashPayment > 0
        ? [...plan.events, {
            id: crypto.randomUUID(),
            name: `Vlastní prostředky – ${mortgageName}`,
            category: "expense" as const,
            frequency: "one-off" as const,
            amount: cashPayment,
            startMonth: takeoverOffset,
            endMonth: null,
            growthSchedule: [{ id: crypto.randomUUID(), fromMonth: 0, rateAnnual: 0 }],
          }]
        : plan.events;

      const mortgage = {
        id: crypto.randomUUID(),
        name: mortgageName,
        principal: remainingPrincipal,
        startMonth: takeoverOffset,
        termMonths,
        rateSchedule,
        insuranceMonthly: insuranceMonthly > 0 ? insuranceMonthly : undefined,
      };

      return { ...plan, events, mortgages: [...plan.mortgages, mortgage] };
    });

    setSuccess(true);
  }

  useEffect(() => {
    if (!success) return;
    const tid = setTimeout(onClose, 1800);
    return () => clearTimeout(tid);
  }, [success, onClose]);

  return (
    <Modal onClose={onClose} maxWidth="max-w-lg">
      <div>
        <div className="flex items-center justify-between">
          <h3 className="text-lg font-semibold text-gray-800">Převzetí hypotéky</h3>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 text-xl leading-none" aria-label="Zavřít">×</button>
        </div>

        {success ? (
          <div className="py-8 text-center space-y-1">
            <p className="text-green-600 font-semibold text-base">Přidáno do plánu ✓</p>
            {cashPayment > 0 && (
              <p className="text-sm text-gray-500">Jednorázový výdaj {formatCZK(cashPayment)} + hypotéka {mortgageName}</p>
            )}
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-4">

            {/* Mortgage name */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Název hypotéky</label>
              <input
                type="text"
                value={mortgageName}
                onChange={(e) => setMortgageName(e.target.value)}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                required
              />
            </div>

            {/* Property price */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Cena bytu (Kč)</label>
              <AmountInput
                value={propertyPrice}
                onChange={setPropertyPrice}
                min={0}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>

            {/* Remaining principal */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Zbývající jistina (přebíráš, Kč)</label>
              <AmountInput
                value={remainingPrincipal}
                onChange={setRemainingPrincipal}
                min={0}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
              {/* Cash payment preview */}
              {propertyPrice > 0 && remainingPrincipal > 0 && (
                <p className={`text-xs mt-1 ${cashPayment > 0 ? "text-orange-600" : "text-green-600"}`}>
                  {cashPayment > 0
                    ? `Vlastní prostředky: ${formatCZK(cashPayment)} (přidáno jako jednorázový výdaj)`
                    : "Hypotéka pokrývá celou cenu — žádný doplatek"}
                </p>
              )}
            </div>

            {/* Takeover date */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Datum převzetí</label>
              <input
                type="month"
                value={takeoverDate}
                onChange={(e) => setTakeoverDate(e.target.value)}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                required
              />
            </div>

            {/* Remaining term in years */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Zbývající doba (roky)</label>
              <input
                type="number"
                value={termYears}
                onChange={(e) => setTermYears(Math.max(1, parseInt(e.target.value) || 1))}
                min={1}
                max={50}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
              <p className="text-xs text-gray-400 mt-0.5">= {termMonths} měsíců, splacení {monthOffsetToDate(takeoverOffset + termMonths, startDate).replace("-", "/")}</p>
            </div>

            {/* Current rate */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Stávající sazba (% p.a.)</label>
              <input
                type="number"
                value={currentRate}
                onChange={(e) => setCurrentRate(parseFloat(e.target.value) || 0)}
                min={0}
                max={30}
                step={0.05}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>

            {/* Fixation end (optional) */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Konec fixace <span className="text-gray-400 font-normal">(volitelné)</span>
              </label>
              <input
                type="month"
                value={fixationEnd}
                onChange={(e) => setFixationEnd(e.target.value)}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>

            {/* Rate after fixation */}
            {fixationEnd && (
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Odhadovaná sazba po refixaci (% p.a.)</label>
                <input
                  type="number"
                  value={rateAfterFixation}
                  onChange={(e) => setRateAfterFixation(parseFloat(e.target.value) || 0)}
                  min={0}
                  max={30}
                  step={0.05}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
            )}

            {/* Insurance */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Pojistné <span className="text-gray-400 font-normal">(Kč/měs., volitelné)</span>
              </label>
              <AmountInput
                value={insuranceMonthly}
                onChange={setInsuranceMonthly}
                min={0}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>

            {/* Estimated payment preview */}
            {estimatedPayment !== null && (
              <div className="bg-blue-50 rounded-lg px-4 py-3 text-sm">
                <span className="text-gray-600">Odhadovaná splátka: </span>
                <span className="font-bold text-blue-700">{formatCZK(estimatedPayment)}/měs.</span>
                {insuranceMonthly > 0 && (
                  <span className="text-gray-500 text-xs ml-1">
                    (+ {formatCZK(insuranceMonthly)} pojistné = {formatCZK(estimatedPayment + insuranceMonthly)}/měs.)
                  </span>
                )}
              </div>
            )}

            <div className="flex gap-3 pt-2">
              <button type="button" onClick={onClose}
                className="flex-1 border border-gray-300 hover:bg-gray-50 text-gray-700 font-medium rounded-lg px-4 py-2 text-sm transition-colors">
                Zrušit
              </button>
              <button type="submit"
                disabled={remainingPrincipal <= 0 || termYears <= 0 || !mortgageName.trim()}
                className="flex-1 bg-blue-600 hover:bg-blue-700 disabled:bg-gray-300 text-white font-medium rounded-lg px-4 py-2 text-sm transition-colors">
                Přidat do plánu
              </button>
            </div>
          </form>
        )}
      </div>
    </Modal>
  );
}
