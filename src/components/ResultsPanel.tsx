// Results panel — Phase 2: simulation chart, big-number summary, table view
// Split into ResultsSummary (KPIs + warnings + series toggles) and ResultsChart (chart + table)
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
import { formatCZK } from "../lib/formatters";
import { MonthlySnapshot } from "../types";
import { MonthDetailModal } from "./MonthDetailModal";

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

const SERIES_STORAGE_KEY = "cashflow-planner-visible-series";

function loadVisibleSeries(): Set<SeriesKey> {
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

function formatRunway(months: number): string {
  if (!isFinite(months) || months > 9999) return "∞";
  return `${Math.round(months)} měs.`;
}

function formatYAxisCZK(value: number): string {
  const abs = Math.abs(value);
  if (abs >= 1_000_000) return `${(value / 1_000_000).toFixed(1)} M`;
  if (abs >= 1_000) return `${(value / 1_000).toFixed(0)} k`;
  return String(value);
}

function getXTick(month: number, startDate: string): string | null {
  if (month % 12 !== 0) return null;
  const [yearStr, monthStr] = startDate.split("-");
  if (!yearStr || !monthStr) return null;
  const year = parseInt(yearStr, 10) + month / 12;
  return String(year);
}

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

function CustomTooltip({ active, payload, label, startDate }: CustomTooltipProps) {
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

// ── Table view ────────────────────────────────────────────────────────────────

interface TableRow {
  year: number;
  snapshot: MonthlySnapshot;
}

function buildYearlyTable(snapshots: MonthlySnapshot[], startDate: string): TableRow[] {
  const [yearStr] = startDate.split("-");
  const baseYear = parseInt(yearStr ?? "2026", 10);
  const rows: TableRow[] = [];

  const maxMonth = snapshots.length - 1;
  let yearIdx = 0;
  while (true) {
    const endOfYearMonth = yearIdx * 12 + 11;
    const pickMonth = Math.min(endOfYearMonth, maxMonth);
    const snap = snapshots[pickMonth];
    if (!snap) break;
    rows.push({ year: baseYear + yearIdx, snapshot: snap });
    if (pickMonth >= maxMonth) break;
    yearIdx++;
  }
  return rows;
}

// ── ResultsSummary: KPI cards + warnings only ────────────────────────────────

export function ResultsSummary() {
  const { snapshots, plan } = usePlanStore();
  const [selectedMonth, setSelectedMonth] = useState(0);

  const lastSnap = snapshots[snapshots.length - 1];
  const firstNegativeSnap = snapshots.find((s) => s.flags.includes("cash-negative"));

  // Clamp selectedMonth in case snapshots shrink
  const clampedMonth = Math.min(selectedMonth, Math.max(0, snapshots.length - 1));
  const snap = snapshots[clampedMonth];

  const selectedDate = snap ? snap.date.replace("-", "/") : plan.baseline.startDate.replace("-", "/");
  const startLabel = snapshots[0]?.date.replace("-", "/") ?? plan.baseline.startDate.replace("-", "/");
  const endLabel = lastSnap?.date.replace("-", "/") ?? startLabel;

  // Warning banner: readable Czech date
  const warningDate = firstNegativeSnap
    ? new Date(firstNegativeSnap.date + "-01").toLocaleString("cs-CZ", { year: "numeric", month: "long" })
    : null;

  return (
    <div className="bg-white rounded-xl shadow px-5 py-4 min-w-0 space-y-3">
      {/* Warning banner */}
      {firstNegativeSnap && warningDate && (
        <div className="bg-yellow-50 border border-yellow-300 rounded-lg px-4 py-2 text-sm text-yellow-800">
          ⚠ Hotovost bude záporná od {warningDate}.
        </div>
      )}

      {/* KPI row — horizontal, wraps on narrow screens */}
      {snap && (
        <div className="space-y-2">
          <div className="flex items-center gap-2 flex-wrap">
            <p className="text-xs text-gray-400">
              Stav k: <span className="font-medium text-gray-600">{selectedDate}</span>
            </p>
            {clampedMonth !== 0 && (
              <button
                onClick={() => setSelectedMonth(0)}
                className="text-xs text-blue-500 hover:text-blue-700 underline"
              >
                Reset
              </button>
            )}
            {lastSnap && (
              <span className="text-xs text-gray-400 ml-auto">horizont do <span className="font-medium text-gray-600">{endLabel}</span></span>
            )}
          </div>
          <div className="flex flex-wrap gap-3">
            <KpiCard label="Čisté jmění" value={formatCZK(snap.netWorth)} color="text-purple-700" bg="bg-purple-50" />
            <KpiCard label="Hotovost" value={formatCZK(snap.cashAccount)} color="text-blue-700" bg="bg-blue-50" />
            <KpiCard label="Investice" value={formatCZK(snap.investmentsBalance)} color="text-green-700" bg="bg-green-50"
              tooltip="Zůstatek na investičním účtu (ETF, fondy apod.) k vybranému měsíci. Přebytek hotovosti nad bezpečnostní rezervou se automaticky přesouvá sem. Počáteční výši zadáš v Počátečním nastavení → Investice – zůstatek." />
            <KpiCard label="Zůstatek hypotéky" value={formatCZK(snap.mortgageBalance)} color="text-orange-700" bg="bg-orange-50" />
            {/* Runway with info tooltip */}
            <div className="bg-gray-50 rounded-xl px-4 py-3 flex flex-col justify-between min-w-[110px]">
              <div className="flex items-center gap-1 mb-1">
                <p className="text-xs text-gray-500">Runway</p>
                <div className="relative group">
                  <svg className="w-3.5 h-3.5 text-gray-400 cursor-help" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <circle cx="12" cy="12" r="10" strokeWidth="2" />
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 8v4m0 4h.01" />
                  </svg>
                  <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 w-64 rounded-lg bg-gray-800 text-white text-xs p-3 shadow-lg opacity-0 group-hover:opacity-100 pointer-events-none transition-opacity z-50">
                    <p className="font-semibold mb-1">Co je Runway?</p>
                    <p>Počet měsíců, po které pokryješ výdaje z aktuální hotovosti a investic — i kdyby přestaly veškeré příjmy.</p>
                    <p className="mt-1 text-gray-300">Výpočet: (hotovost + investice) ÷ průměrné měs. výdaje</p>
                  </div>
                </div>
              </div>
              <p className="text-sm font-bold text-gray-700">{formatRunway(snap.runwayMonths)}</p>
            </div>
          </div>

          {/* Date slider */}
          {snapshots.length > 1 && (
            <div className="space-y-1 pt-1">
              <input
                type="range"
                min={0}
                max={snapshots.length - 1}
                step={1}
                value={clampedMonth}
                onChange={(e) => setSelectedMonth(parseInt(e.target.value))}
                className="w-full accent-blue-600"
                aria-label="Vybrat měsíc"
              />
              <div className="flex justify-between text-xs text-gray-400">
                <span>{startLabel}</span>
                <span>{endLabel}</span>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function KpiCard({ label, value, color, bg, tooltip }: { label: string; value: string; color: string; bg: string; tooltip?: string }) {
  return (
    <div className={`${bg} rounded-xl px-4 py-3 flex flex-col justify-between min-w-[130px] flex-1`}>
      <div className="flex items-center gap-1 mb-1">
        <p className="text-xs text-gray-500">{label}</p>
        {tooltip && (
          <div className="relative group">
            <svg className="w-3.5 h-3.5 text-gray-400 cursor-help" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <circle cx="12" cy="12" r="10" strokeWidth="2" />
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 8v4m0 4h.01" />
            </svg>
            <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 w-64 rounded-lg bg-gray-800 text-white text-xs p-3 shadow-lg opacity-0 group-hover:opacity-100 pointer-events-none transition-opacity z-50">
              {tooltip}
            </div>
          </div>
        )}
      </div>
      <p className={`text-sm font-bold ${color}`}>{value}</p>
    </div>
  );
}

// ── ResultsChart: full-width chart + table toggle + series toggle ─────────────

export function ResultsChart() {
  const { plan, snapshots } = usePlanStore();
  const [showTable, setShowTable] = useState(false);
  const [visibleSeries, setVisibleSeries] = useState<Set<SeriesKey>>(() => loadVisibleSeries());
  const [detailMonth, setDetailMonth] = useState<number | null>(null);

  // Persist series visibility to localStorage so the choice survives page reloads
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

  return (
    <div className="bg-white rounded-xl shadow p-5 space-y-4 min-w-0">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <h2 className="text-lg font-semibold text-gray-800">Přehled vývoje</h2>
        <div className="flex items-center gap-2 flex-wrap">
          {/* Series toggles */}
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
          <button
            onClick={() => setShowTable((t) => !t)}
            className="text-xs font-medium rounded-full px-3 py-1 border border-gray-300 text-gray-600 hover:bg-gray-50 transition-colors"
          >
            {showTable ? "Zobrazit graf" : "Zobrazit tabulku"}
          </button>
        </div>
      </div>

      {showTable ? (
        <div className="overflow-x-auto rounded-lg border border-gray-200">
          <table className="min-w-[480px] w-full text-xs text-gray-700">
            <thead className="bg-gray-50 text-gray-500 uppercase text-[10px]">
              <tr>
                <th className="px-3 py-2 text-left">Rok</th>
                <th className="px-3 py-2 text-right">Příjmy</th>
                <th className="px-3 py-2 text-right">Výdaje</th>
                <th className="px-3 py-2 text-right">Splátka</th>
                <th className="px-3 py-2 text-right">Hotovost</th>
                <th className="px-3 py-2 text-right">Investice</th>
                <th className="px-3 py-2 text-right">Čisté jmění</th>
                <th className="px-3 py-2 text-right">Hypotéka</th>
                <th className="px-3 py-2 text-right"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {yearlyRows.map(({ year, snapshot: s }) => (
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
                  <td className="px-3 py-2 text-right text-green-700">{formatCZK(s.income)}</td>
                  <td className="px-3 py-2 text-right text-red-600">{formatCZK(s.expenses)}</td>
                  <td className="px-3 py-2 text-right text-orange-700">{formatCZK(s.mortgagePayment)}</td>
                  <td className="px-3 py-2 text-right">{formatCZK(s.cashAccount)}</td>
                  <td className="px-3 py-2 text-right">{formatCZK(s.investmentsBalance)}</td>
                  <td className="px-3 py-2 text-right text-purple-700 font-medium">{formatCZK(s.netWorth)}</td>
                  <td className="px-3 py-2 text-right">{formatCZK(s.mortgageBalance)}</td>
                  <td className="px-3 py-2 text-right text-gray-400 text-[10px]">detail ↗</td>
                </tr>
              ))}
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

// ── Legacy export — kept so any existing tests or imports still compile ───────
export function ResultsPanel() {
  return (
    <div className="space-y-4">
      <ResultsSummary />
      <ResultsChart />
    </div>
  );
}
