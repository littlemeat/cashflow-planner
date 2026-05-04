// Assets management panel — collapsible, same pattern as MortgagePanel
import { useState } from "react";
import { usePlanStore } from "../store/usePlanStore";
import { Asset } from "../types";
import { AssetForm } from "./AssetForm";
import { CollapsiblePanel } from "./CollapsiblePanel";
import { formatCZK, formatYearMonth, monthOffsetToDate } from "../lib/formatters";

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

export function AssetsPanel() {
  const { plan, addAsset, updateAsset, deleteAsset } = usePlanStore();

  const [showForm, setShowForm] = useState(false);
  const [editingAsset, setEditingAsset] = useState<Asset | null>(null);

  const startDate = plan.baseline.startDate;
  const assets = plan.assets ?? [];

  function handleAdd(data: Omit<Asset, "id">) {
    addAsset(data);
    setShowForm(false);
  }

  function handleUpdate(data: Omit<Asset, "id">) {
    if (editingAsset) {
      updateAsset(editingAsset.id, data);
      setEditingAsset(null);
    }
  }

  function handleDelete(id: string) {
    if (window.confirm("Opravdu smazat tento majetek?")) {
      deleteAsset(id);
    }
  }

  function getLinkedExpenseName(expenseId: string): string {
    const evt = plan.events.find((e) => e.id === expenseId);
    return evt ? evt.name : expenseId;
  }

  function getLinkedMortgageName(mortgageId: string): string {
    const m = plan.mortgages.find((m) => m.id === mortgageId);
    return m ? m.name : mortgageId;
  }

  const headerRight = (
    <button
      onClick={() => setShowForm(true)}
      className="bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium rounded-lg px-4 py-2 transition-colors"
    >
      + Přidat majetek
    </button>
  );

  return (
    <CollapsiblePanel title="Majetek" headerRight={headerRight}>
      <>
        {assets.length === 0 ? (
          <p className="text-sm text-gray-400 text-center py-6">Žádný majetek.</p>
        ) : (
          <div className="space-y-4">
            {assets.map((asset) => {
              const acquisitionDate = monthOffsetToDate(asset.acquisitionMonth, startDate);
              return (
                <div
                  key={asset.id}
                  className="border border-gray-200 rounded-xl p-4 space-y-3"
                  style={{ opacity: asset.hidden ? 0.4 : 1 }}
                >
                  <div className="flex items-center justify-between">
                    <h3 className="font-semibold text-gray-800">{asset.name}</h3>
                    <div className="flex gap-2 items-center">
                      <button
                        onClick={() => updateAsset(asset.id, { hidden: !asset.hidden })}
                        title={asset.hidden ? "Zobrazit v simulaci" : "Skrýt ze simulace"}
                        className={`flex items-center ${asset.hidden ? "text-gray-300 hover:text-gray-500" : "text-gray-400 hover:text-gray-600"}`}
                      >
                        <EyeIcon hidden={asset.hidden} />
                      </button>
                      <button
                        onClick={() => setEditingAsset(asset)}
                        className="text-blue-500 hover:text-blue-700 text-xs font-medium"
                      >
                        Upravit
                      </button>
                      <button
                        onClick={() => handleDelete(asset.id)}
                        className="text-red-400 hover:text-red-600 text-xs font-medium"
                      >
                        Smazat
                      </button>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-x-6 gap-y-2 text-sm">
                    <div>
                      <span className="text-gray-500">Hodnota:</span>{" "}
                      <span className="font-bold text-indigo-700">{formatCZK(asset.purchaseValue)}</span>
                    </div>
                    <div>
                      <span className="text-gray-500">Zhodnocení:</span>{" "}
                      <span className="font-medium text-gray-800">
                        {(asset.appreciationAnnual * 100).toFixed(1)} % p.a.
                      </span>
                    </div>
                    <div>
                      <span className="text-gray-500">Pořízení:</span>{" "}
                      <span className="font-medium text-gray-800">
                        {formatYearMonth(acquisitionDate)}
                      </span>
                    </div>
                    {asset.linkedExpenseId && (
                      <div>
                        <span className="text-gray-500">Výdaj:</span>{" "}
                        <span className="font-medium text-gray-800">
                          {getLinkedExpenseName(asset.linkedExpenseId)}
                        </span>
                      </div>
                    )}
                    {asset.linkedMortgageId && (
                      <div>
                        <span className="text-gray-500">Hypotéka:</span>{" "}
                        <span className="font-medium text-gray-800">
                          {getLinkedMortgageName(asset.linkedMortgageId)}
                        </span>
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {showForm && (
          <AssetForm
            startDate={startDate}
            expenses={plan.events}
            mortgages={plan.mortgages}
            onSave={handleAdd}
            onCancel={() => setShowForm(false)}
          />
        )}

        {editingAsset && (
          <AssetForm
            initial={editingAsset}
            startDate={startDate}
            expenses={plan.events}
            mortgages={plan.mortgages}
            onSave={handleUpdate}
            onCancel={() => setEditingAsset(null)}
          />
        )}
      </>
    </CollapsiblePanel>
  );
}
