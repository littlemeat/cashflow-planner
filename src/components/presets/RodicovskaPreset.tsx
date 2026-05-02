// Preset wizard: Rodičovská
import { useState, useEffect, useRef } from "react";
import { usePlanStore } from "../../store/usePlanStore";
import { CashflowEvent } from "../../types";
import { AmountInput } from "../AmountInput";
import { dateToMonthOffset, monthOffsetToDate, addMonths } from "../../lib/formatters";
import { RODICOVSKY_PRISPEVEK_DEFAULT } from "../../lib/constants";

interface RodicovskaPresetProps {
  onClose: () => void;
}

export function RodicovskaPreset({ onClose }: RodicovskaPresetProps) {
  const { plan, addEvent } = usePlanStore();
  const startDate = plan.baseline.startDate;
  const mouseDownTarget = useRef<EventTarget | null>(null);

  const [startMonth, setStartMonth] = useState(monthOffsetToDate(0, startDate));
  const [totalPool, setTotalPool] = useState(RODICOVSKY_PRISPEVEK_DEFAULT);
  const [monthlyAmount, setMonthlyAmount] = useState(20_000);
  const [success, setSuccess] = useState(false);

  const wizardStartOffset = dateToMonthOffset(startMonth, startDate);
  const durationMonths = monthlyAmount > 0 ? Math.floor(totalPool / monthlyAmount) : 0;
  const endOffset = wizardStartOffset + durationMonths - 1;
  const endDateStr =
    durationMonths > 0 ? addMonths(startDate, endOffset).replace("-", "/") : "—";

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const groupId = crypto.randomUUID();

    const newEvent: Omit<CashflowEvent, "id"> = {
      name: "Rodičovská",
      category: "income",
      frequency: "monthly",
      amount: monthlyAmount,
      startMonth: wizardStartOffset,
      endMonth: durationMonths > 0 ? endOffset : null,
      annualGrowthPct: 0,
      presetGroup: groupId,
    };

    addEvent(newEvent);
    setSuccess(true);
    // timer is handled by useEffect below
  }

  useEffect(() => {
    if (!success) return;
    const tid = setTimeout(onClose, 1500);
    return () => clearTimeout(tid);
  }, [success, onClose]);

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
      onMouseDown={(e) => { mouseDownTarget.current = e.target; }}
      onClick={(e) => {
        if (e.target === e.currentTarget && mouseDownTarget.current === e.currentTarget) {
          onClose();
        }
      }}
    >
      <div
        className="bg-white rounded-xl shadow-xl w-full max-w-lg p-6 space-y-4"
      >
        <div className="flex items-center justify-between">
          <h3 className="text-lg font-semibold text-gray-800">Rodičovská</h3>
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
            Rodičovská byla přidána do plánu.
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-4">
            {/* Start month */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Začátek rodičovské
              </label>
              <input
                type="month"
                value={startMonth}
                onChange={(e) => setStartMonth(e.target.value)}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                required
              />
            </div>

            {/* Total pool */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Celková výše rodičovského příspěvku (Kč)
              </label>
              <AmountInput
                value={totalPool}
                onChange={setTotalPool}
                min={0}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
              <p className="text-xs text-gray-500 mt-1">Zákonný limit: 350 000 Kč</p>
            </div>

            {/* Monthly drawdown */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Měsíční čerpání (Kč)
              </label>
              <AmountInput
                value={monthlyAmount}
                onChange={setMonthlyAmount}
                min={1}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
              <p className="text-xs text-gray-500 mt-1">Rozsah: 10 000–50 000 Kč/měs.</p>
            </div>

            {/* Duration preview */}
            <div className="bg-blue-50 rounded-lg p-3 text-sm">
              <p className="font-medium text-blue-800">
                Délka rodičovské:{" "}
                <span className="text-blue-900 font-semibold">
                  {durationMonths > 0 ? `${durationMonths} měsíců` : "—"}
                </span>
                {durationMonths > 0 && ` (do ${endDateStr})`}
              </p>
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
                disabled={durationMonths <= 0}
                className="flex-1 bg-blue-600 hover:bg-blue-700 disabled:bg-gray-300 text-white font-medium rounded-lg px-4 py-2 text-sm transition-colors"
              >
                Přidat do plánu
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}
