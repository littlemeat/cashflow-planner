// Assets management panel — collapsible, same pattern as MortgagePanel
import { useState } from "react";
import { usePlanStore } from "../store/usePlanStore";
import { Asset } from "../types";
import { AssetForm } from "./AssetForm";
import { CollapsiblePanel } from "./CollapsiblePanel";
import { EyeIcon } from "./EyeIcon";
import { formatCZK, formatYearMonth, monthOffsetToDate } from "../lib/formatters";

export function AssetsPanel() {
  const { plan, addAsset, updateAsset, deleteAsset, toggleAssetHidden } = usePlanStore();

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
                        onClick={() => toggleAssetHidden(asset.id)}
                        aria-label={asset.hidden ? "Zobrazit v simulaci" : "Skrýt ze simulace"}
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
