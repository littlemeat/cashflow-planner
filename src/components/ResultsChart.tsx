// Results chart — line chart + yearly/monthly table toggle
import { useState, useMemo, useEffect } from "react";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ReferenceArea,
  ResponsiveContainer,
} from "recharts";
import { usePlanStore } from "../store/usePlanStore";
import { formatCZK, formatRunway } from "../lib/formatters";
import { MonthlySnapshot } from "../types";
import { MonthDetailModal } from "./MonthDetailModal";
import { InfoTooltip } from "./InfoTooltip";

// ── Series config ─────────────────────────────────────────────────────────────
export type SeriesKey = "cashAccount" | "investmentsBalance" | "netWorth" | "mortgageBalance";

export interface SeriesConfig {
  key: SeriesKey;
  label: string;
  color: string;
}

export const SERIES: SeriesConfig[] = [
  { key: "cashAccount", label: "Hotovost", color: "#3b82f6" },
  { key: "investmentsBalance", label: "Investice", color: "#22c55e" },
  { key: "netWorth", label: "Čisté jmění", color: "#a855f7" },
  { key: "mortgageBalance", label: "Zůstatek hypotéky", color: "#f97316" },
];

const DEFAULT_VISIBLE: SeriesKey[] = ["cashAccount", "investmentsBalance", "netWorth", "mortgageBalance"];

export const SERIES_STORAGE_KEY = "cashflow-planner-visible-series";
export const TABLE_VIEW_KEY = "cashflow-planner-show-table";

export function loadShowTable(): boolean {
  try {
    const raw = localStorage.getItem(TABLE_VIEW_KEY);
    return raw === null ? true : raw === "true"; // default = table
  } catch {
    return true;
  }
}

export function loadVisibleSeries(): Set<SeriesKey> {
  try {
    const raw = localStorage.getItem(SERIES_STORAGE_KEY);
    if (!raw) return new Set(DEFAULT_VISIBLE);
    const parsed = JSON.parse(raw) as SeriesKey[];
    const valid = parsed.filter((k) => SERIES.some((s) => s.key === k));
    if (valid.length > 0) return new Set(valid);
  } catch {}
  return new Set(DEFAULT_VISIBLE);
}

// ── Helpers ───────────────────────────────────────────────────────────────────

export { formatRunway };

export function formatYAxisCZK(value: number): string {
  const abs = Math.abs(value);
  if (abs >= 1_000_000) return `${(value / 1_000_000).toFixed(1)} M`;
  if (abs >= 1_000) return `${(value / 1_000).toFixed(0)} k`;
  return String(value);
}

export function getXTick(month: number, startDate: string): string | null {
  if (month % 12 !== 0) return null;
  const [yearStr, monthStr] = startDate.split("-");
  if (!yearStr || !monthStr) return null;
  const year = parseInt(yearStr, 10) + month / 12;
  return String(year);
}

// ── Table helpers ─────────────────────────────────────────────────────────────

export interface TableRow {
  year: number;
  snapshot: MonthlySnapshot; // end-of-year balance
  annualIncome: number;
  annualExpenses: number;
  annualMortgagePayment: number;
  assetsValueEnd: number;    // end-of-year asset value (balance, not a flow)
}

export function buildYearlyTable(snapshots: MonthlySnapshot[], startDate: string): TableRow[] {
  const [yearStr] = startDate.split("-");
  const baseYear = parseInt(yearStr ?? "2026", 10);
  const rows: TableRow[] = [];

  const maxMonth = snapshots.length - 1;
  let yearIdx = 0;
  while (true) {
    const startOfYear = yearIdx * 12;
    const endOfYearMonth = yearIdx * 12 + 11;
    const pickMonth = Math.min(endOfYearMonth, maxMonth);
    const snap = snapshots[pickMonth];
    if (!snap) break;
    // Sum income/expenses/mortgage across all months of this year
    const yearSnaps = snapshots.slice(startOfYear, pickMonth + 1);
    const annualIncome = yearSnaps.reduce((sum, s) => sum + s.income, 0);
    const annualExpenses = yearSnaps.reduce((sum, s) => sum + s.expenses, 0);
    const annualMortgagePayment = yearSnaps.reduce((sum, s) => sum + s.mortgagePayment, 0);
    rows.push({ year: baseYear + yearIdx, snapshot: snap, annualIncome, annualExpenses, annualMortgagePayment, assetsValueEnd: snap.assetsValue });
    if (pickMonth >= maxMonth) break;
    yearIdx++;
  }
  return rows;
}

// ── CustomTooltip ─────────────────────────────────────────────────────────────

interface TooltipPayloadItem {
  name: string;
  value: number;
  color: string;
}

interface CustomTooltipProps {
  active?: boolean;
  payload?: TooltipPayloadItem[];
  label?: number;
  startDate: string;
}

export function CustomTooltip({ active, payload, label, startDate }: CustomTooltipProps) {
  if (!active || !payload || payload.length === 0 || label === undefined) return null;
  const [yearStr, monthStr] = startDate.split("-");
  if (!yearStr || !monthStr) return null;
  const d = new Date(parseInt(yearStr, 10), parseInt(monthStr, 10) - 1 + label);
  const dateLabel = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
  return (
    <div className="bg-white border border-gray-200 rounded-lg shadow-sm p-3 text-sm">
      <p className="font-medium text-gray-700 mb-2">{dateLabel} (měs. {label})</p>
      {payload.map((item) => (
        <p key={item.name} style={{ color: item.color }}>
          {item.name}: {formatCZK(item.value)}
        </p>
      ))}
    </div>
  );
}

// ── Th: table header cell with tooltip ───────────────────────────────────────

export function Th({ children, tip }: { children: React.ReactNode; tip: string }) {
  return (
    <th className="px-3 py-2 text-right">
      <span className="inline-flex items-center justify-end gap-1">
        {children}
        <InfoTooltip text={tip} position="above-left" width="w-56" />
      </span>
    </th>
  );
}

// ── ResultsChart ──────────────────────────────────────────────────────────────

export function ResultsChart() {
  const { plan, snapshots } = usePlanStore();
  const [showTable, setShowTable] = useState<boolean>(() => loadShowTable());
  const [tableMode, setTableMode] = useState<"yearly" | "monthly">("monthly");
  const [visibleSeries, setVisibleSeries] = useState<Set<SeriesKey>>(() => loadVisibleSeries());
  const [detailMonth, setDetailMonth] = useState<number | null>(null);

  // Persist show/hide table choice
  useEffect(() => {
    localStorage.setItem(TABLE_VIEW_KEY, String(showTable));
  }, [showTable]);

  // Persist series visibility
  useEffect(() => {
    localStorage.setItem(SERIES_STORAGE_KEY, JSON.stringify([...visibleSeries]));
  }, [visibleSeries]);

  function toggleSeries(key: SeriesKey) {
    setVisibleSeries((prev) => {
      const next = new Set(prev);
      if (next.has(key)) {
        if (next.size > 1) next.delete(key);
      } else {
        next.add(key);
      }
      return next;
    });
  }

  // Sample yearly for a smooth long-term chart (monthly fluctuations from annual events
  // like holidays create a sawtooth that obscures the trend over 30 years)
  const chartData = useMemo(() => snapshots
    .filter((s) => s.month % 12 === 0)
    .map((s) => ({
      month: s.month,
      date: s.date,
      cashAccount: s.cashAccount,
      investmentsBalance: s.investmentsBalance,
      netWorth: s.netWorth,
      mortgageBalance: s.mortgageBalance,
    })), [snapshots]);

  const yearlyRows = buildYearlyTable(snapshots, plan.baseline.startDate);

  // Adaptive tick spacing: yearly up to 10y, every 2y up to 20y, every 5y beyond
  const tickStep = plan.baseline.horizonYears <= 10 ? 12
    : plan.baseline.horizonYears <= 20 ? 24
    : 60;
  const xTicks = snapshots
    .filter((s) => s.month % tickStep === 0)
    .map((s) => s.month);

  // Build cash-negative ranges for ReferenceArea
  const negativeRanges = useMemo(() => {
    const ranges: Array<{ start: number; end: number }> = [];
    let rangeStart: number | null = null;
    for (const s of snapshots) {
      const isNeg = s.flags.includes("cash-negative");
      if (isNeg && rangeStart === null) {
        rangeStart = s.month;
      } else if (!isNeg && rangeStart !== null) {
        ranges.push({ start: rangeStart, end: s.month - 1 });
        rangeStart = null;
      }
    }
    if (rangeStart !== null) {
      ranges.push({ start: rangeStart, end: snapshots[snapshots.length - 1]?.month ?? rangeStart });
    }
    return ranges;
  }, [snapshots]);

  function handleChartClick(data: { activeLabel?: number | string | undefined }) {
    const label = data?.activeLabel;
    if (label !== undefined && label !== null) {
      const month = typeof label === "number" ? label : parseInt(String(label), 10);
      if (!isNaN(month)) {
        setDetailMonth(month);
      }
    }
  }

  function exportCSV() {
    const BOM = "﻿";
    const sep = ";";

    const headers =
      tableMode === "monthly"
        ? ["Měsíc", "Příjmy", "Výdaje", "Splátka hypo", "Hotovost", "Investice", "Majetek", "Čisté jmění", "Hypo zůstatek", "Runway (měs.)"]
        : ["Rok", "Příjmy ∑", "Výdaje ∑", "Splátka hypo ∑", "Hotovost", "Investice", "Majetek", "Čisté jmění", "Hypo zůstatek"];

    const dataRows: string[][] = tableMode === "monthly"
      ? snapshots.map((s) => [
          s.date,
          String(Math.round(s.income)),
          String(Math.round(s.expenses)),
          String(Math.round(s.mortgagePayment)),
          String(Math.round(s.cashAccount)),
          String(Math.round(s.investmentsBalance)),
          String(Math.round(s.assetsValue)),
          String(Math.round(s.netWorth)),
          String(Math.round(s.mortgageBalance)),
          isFinite(s.runwayMonths) ? String(Math.round(s.runwayMonths)) : "",
        ])
      : yearlyRows.map(({ year, snapshot: s, annualIncome, annualExpenses, annualMortgagePayment, assetsValueEnd }) => [
          String(year),
          String(Math.round(annualIncome)),
          String(Math.round(annualExpenses)),
          String(Math.round(annualMortgagePayment)),
          String(Math.round(s.cashAccount)),
          String(Math.round(s.investmentsBalance)),
          String(Math.round(assetsValueEnd)),
          String(Math.round(s.netWorth)),
          String(Math.round(s.mortgageBalance)),
        ]);

    const csv = BOM + [headers, ...dataRows].map((row) => row.join(sep)).join("\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `cashflow-${new Date().toISOString().slice(0, 10)}.csv`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    // Revoke after a short delay so the browser has time to start the download
    setTimeout(() => URL.revokeObjectURL(url), 100);
  }

  return (
    <div className="bg-white rounded-xl shadow p-5 space-y-4 min-w-0">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <h2 className="text-lg font-semibold text-gray-800">Přehled vývoje</h2>
        <div className="flex items-center gap-2 flex-wrap">
          {/* Series toggles (chart only) */}
          {!showTable && SERIES.map((s) => (
            <button
              key={s.key}
              onClick={() => toggleSeries(s.key)}
              className={`text-xs font-medium rounded-full px-3 py-1 border transition-colors ${
                visibleSeries.has(s.key)
                  ? "text-white border-transparent"
                  : "bg-white border-gray-300 text-gray-500 hover:bg-gray-50"
              }`}
              style={visibleSeries.has(s.key) ? { backgroundColor: s.color, borderColor: s.color } : {}}
            >
              {s.label}
            </button>
          ))}
          {/* Yearly / monthly toggle (table only) */}
          {showTable && (
            <>
              <button
                onClick={() => setTableMode("yearly")}
                className={`text-xs font-medium rounded-full px-3 py-1 border transition-colors ${tableMode === "yearly" ? "bg-gray-800 text-white border-gray-800" : "bg-white border-gray-300 text-gray-500 hover:bg-gray-50"}`}
              >
                Ročně
              </button>
              <button
                onClick={() => setTableMode("monthly")}
                className={`text-xs font-medium rounded-full px-3 py-1 border transition-colors ${tableMode === "monthly" ? "bg-gray-800 text-white border-gray-800" : "bg-white border-gray-300 text-gray-500 hover:bg-gray-50"}`}
              >
                Měsíčně
              </button>
            </>
          )}
          {showTable && (
            <button
              onClick={exportCSV}
              className="text-xs font-medium rounded-full px-3 py-1 border border-gray-300 text-gray-600 hover:bg-gray-50 transition-colors"
              title="Stáhnout tabulku jako CSV (Excel)"
            >
              ↓ CSV
            </button>
          )}
          <button
            onClick={() => setShowTable((t) => !t)}
            className="text-xs font-medium rounded-full px-3 py-1 border border-gray-300 text-gray-600 hover:bg-gray-50 transition-colors"
          >
            {showTable ? "Zobrazit graf" : "Zobrazit tabulku"}
          </button>
        </div>
      </div>

      {showTable ? (
        <div className="overflow-x-clip rounded-lg border border-gray-200">
          <table className="min-w-[480px] w-full text-xs text-gray-700">
            <thead className="bg-gray-50 text-gray-500 uppercase text-[10px]">
              <tr>
                <th className="px-3 py-2 text-left">{tableMode === "monthly" ? "Měsíc" : "Rok"}</th>
                <Th tip={tableMode === "yearly"
                  ? "Tok ∑ — součet všech příjmů za rok (platy, pronájmy, dávky, jednorázové). Položky s nastaveným růstem % se navyšují každý měsíc geometricky."
                  : "Tok — součet všech aktivních příjmů v daném měsíci (platy, pronájmy, dávky, jednorázové). Položky s nastaveným růstem % se navyšují geometricky."}>Příjmy</Th>
                <Th tip={tableMode === "yearly"
                  ? "Tok ∑ — součet výdajů za rok, bez splátky hypotéky (ta je v samostatném sloupci). Nákup nemovitosti se promítne jen pokud sis přidala jednorázový výdaj v panelu Příjmy a výdaje."
                  : "Tok — součet výdajů v daném měsíci, bez splátky hypotéky. Nákup nemovitosti se promítne jen pokud sis přidala jednorázový výdaj v panelu Příjmy a výdaje."}>Výdaje</Th>
                <Th tip={tableMode === "yearly"
                  ? "Tok ∑ — součet měsíčních anuit za rok. Anuita = jistina + úrok + pojistné. Pokud proběhla změna sazby, zahrnuje splátky za různé sazby."
                  : "Tok — měsíční anuita hypotéky = jistina + úrok + případné pojistné. Při každé změně sazby se přepočítá ze zbývající jistiny a počtu zbývajících měsíců."}>Splátka hypo</Th>
                <Th tip={tableMode === "yearly"
                  ? "Stav ke konci prosince. Cíl = bezpečnostní rezerva × průměr měs. výdajů za posledních 12 měs. (jen opakující se, bez jednorázových). Přebytek nad cíl jde do investic, schodek se krytí z investic."
                  : "Stav ke konci měsíce. Cíl = bezpečnostní rezerva × průměr měs. výdajů za posledních 12 měs. (jen opakující se, bez jednorázových). Přebytek nad cíl jde do investic, schodek se krytí z investic."}>Hotovost</Th>
                <Th tip={tableMode === "yearly"
                  ? "Stav ke konci roku. Výpočet každý měsíc: (zůstatek + příspěvek) × (1 + roční výnos)^(1/12). Příspěvek = přebytek hotovosti nad cíl; záporný = výběr při schodku."
                  : "Stav ke konci měsíce. Výpočet: (zůstatek + příspěvek) × (1 + roční výnos)^(1/12). Příspěvek = přebytek hotovosti nad cílovou rezervu; záporný příspěvek = výběr při schodku hotovosti."}>Investice</Th>
                <Th tip={tableMode === "yearly"
                  ? "Stav ke konci roku. Tržní hodnota nemovitostí a dalšího majetku. Výpočet: pořizovací × (1 + roční zhodnocení)^(roky od pořízení). Pořizovací náklady se promítnou do hotovosti jen pokud sis přidala propojený jednorázový výdaj."
                  : "Stav ke konci měsíce. Tržní hodnota nemovitostí a dalšího majetku. Výpočet: pořizovací × (1 + roční zhodnocení)^(roky od pořízení). Pořizovací náklady se promítnou do hotovosti jen pokud sis přidala propojený jednorázový výdaj."}>Majetek</Th>
                <Th tip="Stav = Hotovost + Investice + Majetek − Hypo zůstatek. Pokud eviduješ hypotéku, ale nemáš přidanou nemovitost v Majetku, bude záporné — normální stav, chybí protiváha.">Čisté jmění</Th>
                <Th tip="Stav — zbývající jistina ke konci období. Klesá jen o jistinovou část anuity (úrok je náklad, ne splácení dluhu). Při změně sazby se jistina nemění, jen se přepočítá poměr úrok/jistina.">Hypo zůstatek</Th>
                <th className="px-3 py-2 text-right"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {/* Initial state row — baseline values before simulation */}
              {(() => {
                const assetsAtMonth0 = (plan.assets ?? [])
                  .filter((a) => a.acquisitionMonth === 0 && !a.hidden)
                  .reduce((sum, a) => sum + a.purchaseValue, 0);
                const mortgageAtMonth0 = plan.mortgages
                  .filter((m) => m.startMonth === 0 && !m.hidden)
                  .reduce((sum, m) => sum + m.principal, 0);
                const initialNetWorth =
                  plan.baseline.cashAccount +
                  plan.baseline.investmentsBalance +
                  assetsAtMonth0 -
                  mortgageAtMonth0;
                return (
                  <tr className="bg-gray-50 text-gray-500 italic">
                    <td className="px-3 py-2 font-medium not-italic text-gray-700">Počáteční stav</td>
                    <td className="px-3 py-2 text-right">—</td>
                    <td className="px-3 py-2 text-right">—</td>
                    <td className="px-3 py-2 text-right">—</td>
                    <td className="px-3 py-2 text-right text-gray-700">{formatCZK(plan.baseline.cashAccount)}</td>
                    <td className="px-3 py-2 text-right text-gray-700">{formatCZK(plan.baseline.investmentsBalance)}</td>
                    <td className="px-3 py-2 text-right text-indigo-700">{assetsAtMonth0 > 0 ? formatCZK(assetsAtMonth0) : "—"}</td>
                    <td className="px-3 py-2 text-right text-purple-600 font-medium not-italic">{formatCZK(initialNetWorth)}</td>
                    <td className="px-3 py-2 text-right">{mortgageAtMonth0 > 0 ? formatCZK(mortgageAtMonth0) : "—"}</td>
                    <td className="px-3 py-2"></td>
                  </tr>
                );
              })()}
              {tableMode === "yearly"
                ? yearlyRows.map(({ year, snapshot: s, annualIncome, annualExpenses, annualMortgagePayment, assetsValueEnd }) => (
                    <tr
                      key={year}
                      onClick={() => setDetailMonth(s.month)}
                      className={`cursor-pointer ${
                        s.flags.includes("cash-negative")
                          ? "bg-red-50 hover:bg-red-100"
                          : "hover:bg-violet-50"
                      }`}
                    >
                      <td className="px-3 py-2 font-medium">{year}</td>
                      <td className="px-3 py-2 text-right text-green-700">{formatCZK(annualIncome)}</td>
                      <td className="px-3 py-2 text-right text-red-600">{formatCZK(annualExpenses)}</td>
                      <td className="px-3 py-2 text-right text-orange-700">{formatCZK(annualMortgagePayment)}</td>
                      <td className="px-3 py-2 text-right">{formatCZK(s.cashAccount)}</td>
                      <td className="px-3 py-2 text-right">{formatCZK(s.investmentsBalance)}</td>
                      <td className="px-3 py-2 text-right text-indigo-700">{formatCZK(assetsValueEnd)}</td>
                      <td className="px-3 py-2 text-right text-purple-700 font-medium">{formatCZK(s.netWorth)}</td>
                      <td className="px-3 py-2 text-right">{formatCZK(s.mortgageBalance)}</td>
                      <td className="px-3 py-2 text-right text-gray-400 text-[10px]">detail ↗</td>
                    </tr>
                  ))
                : snapshots.map((s) => (
                    <tr
                      key={s.month}
                      onClick={() => setDetailMonth(s.month)}
                      className={`cursor-pointer ${
                        s.flags.includes("cash-negative")
                          ? "bg-red-50 hover:bg-red-100"
                          : "hover:bg-violet-50"
                      }`}
                    >
                      <td className="px-3 py-2 font-medium">{s.date.replace("-", "/")}</td>
                      <td className="px-3 py-2 text-right text-green-700">{formatCZK(s.income)}</td>
                      <td className="px-3 py-2 text-right text-red-600">{formatCZK(s.expenses)}</td>
                      <td className="px-3 py-2 text-right text-orange-700">{formatCZK(s.mortgagePayment)}</td>
                      <td className="px-3 py-2 text-right">{formatCZK(s.cashAccount)}</td>
                      <td className="px-3 py-2 text-right">{formatCZK(s.investmentsBalance)}</td>
                      <td className="px-3 py-2 text-right text-indigo-700">{formatCZK(s.assetsValue)}</td>
                      <td className="px-3 py-2 text-right text-purple-700 font-medium">{formatCZK(s.netWorth)}</td>
                      <td className="px-3 py-2 text-right">{formatCZK(s.mortgageBalance)}</td>
                      <td className="px-3 py-2 text-right text-gray-400 text-[10px]">detail ↗</td>
                    </tr>
                  ))
              }
            </tbody>
          </table>
        </div>
      ) : (
        <>
          <p className="text-xs text-gray-400">Kliknutím do grafu zobrazíte měsíční detail.</p>
          <div className="h-[260px] sm:h-[350px] w-full">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart
                data={chartData}
                margin={{ top: 4, right: 8, left: 8, bottom: 4 }}
                onClick={handleChartClick}
                style={{ cursor: "pointer" }}
              >
                <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                <XAxis
                  dataKey="month"
                  ticks={xTicks}
                  tickFormatter={(v: number) => {
                    const tick = getXTick(v, plan.baseline.startDate);
                    return tick ?? "";
                  }}
                  tick={{ fontSize: 11 }}
                />
                <YAxis
                  tickFormatter={formatYAxisCZK}
                  tick={{ fontSize: 11 }}
                  width={56}
                />
                <Tooltip
                  content={
                    <CustomTooltip startDate={plan.baseline.startDate} />
                  }
                />
                <Legend
                  wrapperStyle={{ fontSize: 11 }}
                />

                {negativeRanges.map((range, i) => (
                  <ReferenceArea
                    key={i}
                    x1={range.start}
                    x2={range.end}
                    fill="#fca5a5"
                    fillOpacity={0.3}
                  />
                ))}

                {SERIES.filter((s) => visibleSeries.has(s.key)).map((s) => (
                  <Line
                    key={s.key}
                    type="monotone"
                    dataKey={s.key}
                    name={s.label}
                    stroke={s.color}
                    dot={false}
                    strokeWidth={2}
                  />
                ))}
              </LineChart>
            </ResponsiveContainer>
          </div>
        </>
      )}

      {/* Month detail modal */}
      {detailMonth !== null && (
        <MonthDetailModal
          plan={plan}
          month={detailMonth}
          onClose={() => setDetailMonth(null)}
        />
      )}
    </div>
  );
}
