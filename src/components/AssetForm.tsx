// Modal form for adding or editing an asset
import { useState } from "react";
import { Asset, CashflowEvent, Mortgage } from "../types";
import { AmountInput } from "./AmountInput";
import { Modal } from "./Modal";
import { dateToMonthOffset, monthOffsetToDate } from "../lib/formatters";

interface AssetFormProps {
  initial?: Asset;
  startDate: string;           // plan baseline.startDate for month offset conversion
  expenses: CashflowEvent[];   // one-off expense events for linkedExpenseId picker
  mortgages: Mortgage[];       // mortgages for linkedMortgageId picker
  onSave: (data: Omit<Asset, "id">) => void;
  onCancel: () => void;
}

export function AssetForm({ initial, startDate, expenses, mortgages, onSave, onCancel }: AssetFormProps) {
  const [name, setName] = useState(initial?.name ?? "");
  const [purchaseValue, setPurchaseValue] = useState(initial?.purchaseValue ?? 0);
  const [acquisitionMonthStr, setAcquisitionMonthStr] = useState<string>(
    monthOffsetToDate(initial?.acquisitionMonth ?? 0, startDate)
  );
  const [appreciationAnnual, setAppreciationAnnual] = useState(
    initial ? initial.appreciationAnnual * 100 : 0
  );
  const [linkedExpenseId, setLinkedExpenseId] = useState<string>(
    initial?.linkedExpenseId ?? ""
  );
  const [linkedMortgageId, setLinkedMortgageId] = useState<string>(
    initial?.linkedMortgageId ?? ""
  );

  const oneOffExpenses = expenses.filter((e) => e.category === "expense" && e.frequency === "one-off");

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const acquisitionMonth = dateToMonthOffset(acquisitionMonthStr, startDate);
    onSave({
      name: name.trim(),
      purchaseValue,
      acquisitionMonth,
      appreciationAnnual: appreciationAnnual / 100,
      linkedExpenseId: linkedExpenseId || undefined,
      linkedMortgageId: linkedMortgageId || undefined,
    });
  }

  const inputClass =
    "w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500";

  return (
    <Modal onClose={onCancel}>
      <h2 className="text-lg font-semibold text-gray-800">
        {initial ? "Upravit majetek" : "Přidat majetek"}
      </h2>

      <form onSubmit={handleSubmit} className="space-y-4">
        {/* Name */}
        <div>
          <label className="block text-xs font-medium text-gray-600 mb-1" htmlFor="asset-name">
            Název
          </label>
          <input
            id="asset-name"
            type="text"
            required
            value={name}
            onChange={(e) => setName(e.target.value)}
            className={inputClass}
            placeholder="např. Byt Praha"
          />
        </div>

        {/* Purchase value */}
        <div>
          <label className="block text-xs font-medium text-gray-600 mb-1" htmlFor="asset-value">
            Celková hodnota (Kč)
          </label>
          <AmountInput
            id="asset-value"
            value={purchaseValue}
            onChange={setPurchaseValue}
            min={0}
            className={inputClass}
          />
        </div>

        {/* Acquisition date */}
        <div>
          <label className="block text-xs font-medium text-gray-600 mb-1" htmlFor="asset-date">
            Datum pořízení
          </label>
          <input
            id="asset-date"
            type="month"
            required
            value={acquisitionMonthStr}
            onChange={(e) => setAcquisitionMonthStr(e.target.value)}
            className={inputClass}
          />
        </div>

        {/* Annual appreciation */}
        <div>
          <label className="block text-xs font-medium text-gray-600 mb-1" htmlFor="asset-appreciation">
            Roční zhodnocení (%)
          </label>
          <input
            id="asset-appreciation"
            type="number"
            step={0.1}
            value={appreciationAnnual}
            onChange={(e) => setAppreciationAnnual(parseFloat(e.target.value) || 0)}
            className={inputClass}
          />
        </div>

        {/* Linked expense (one-off only) */}
        <div>
          <label className="block text-xs font-medium text-gray-600 mb-1" htmlFor="asset-expense">
            Propojený výdaj (jednorázový)
          </label>
          <select
            id="asset-expense"
            value={linkedExpenseId}
            onChange={(e) => setLinkedExpenseId(e.target.value)}
            className={inputClass}
          >
            <option value="">— žádný —</option>
            {oneOffExpenses.map((evt) => (
              <option key={evt.id} value={evt.id}>
                {evt.name}
              </option>
            ))}
          </select>
        </div>

        {/* Linked mortgage */}
        <div>
          <label className="block text-xs font-medium text-gray-600 mb-1" htmlFor="asset-mortgage">
            Propojená hypotéka
          </label>
          <select
            id="asset-mortgage"
            value={linkedMortgageId}
            onChange={(e) => setLinkedMortgageId(e.target.value)}
            className={inputClass}
          >
            <option value="">— žádná —</option>
            {mortgages.map((m) => (
              <option key={m.id} value={m.id}>
                {m.name}
              </option>
            ))}
          </select>
        </div>

        {/* Actions */}
        <div className="flex justify-end gap-3 pt-2">
          <button
            type="button"
            onClick={onCancel}
            className="border border-gray-300 text-gray-700 text-sm font-medium rounded-lg px-4 py-2 hover:bg-gray-50 transition-colors"
          >
            Zrušit
          </button>
          <button
            type="submit"
            className="bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium rounded-lg px-4 py-2 transition-colors"
          >
            Uložit
          </button>
        </div>
      </form>
    </Modal>
  );
}
