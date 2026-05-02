# Cashflow Planner — Agent Onboarding

Personal long-horizon cashflow planner for a Czech household planning maternity leave and a mortgage. 30-year stress-test of finances with stackable life events, salary changes, inflation, mortgage rate changes.

## Stack

Vite + React 19 + TypeScript + Tailwind CSS v4 + Zustand + Recharts + LocalStorage. No backend, no auth.

## Project structure

```
src/
  types/index.ts          — all TypeScript interfaces (Plan, Baseline, CashflowEvent, Mortgage, MonthlySnapshot)
  store/usePlanStore.ts   — Zustand store + localStorage persistence
  lib/
    simulate/
      index.ts            — simulate(plan): MonthlySnapshot[], getMonthDetail(plan, month): MonthDetail
      mortgage.ts         — MortgageState, initMortgageState(), stepMortgage()
      __tests__/          — 42 tests (simulate, presets, phase4)
    formatters.ts         — formatCZK, dateToMonthOffset, monthOffsetToDate, addMonths, formatYearMonth
    constants.ts          — Czech 2026 social/tax constants (PPM cap, rodičovský příspěvek, sleva na dítě)
    seedData.ts           — default plan seeded on first run
  components/
    AmountInput.tsx       — controlled number input with space thousand separators (cs-CZ)
    BaselinePanel.tsx     — start date, cash, investments, yield, safety buffer, horizon
    EventsPanel.tsx       — CRUD for income/expense events
    EventForm.tsx         — add/edit event modal
    MortgagePanel.tsx     — CRUD for mortgages
    MortgageForm.tsx      — add/edit mortgage modal with live amortization summary
    MonthDetailModal.tsx  — per-event income/expense breakdown for a clicked month
    ResultsPanel.tsx      — ResultsSummary (KPI bar) + ResultsChart (chart + table)
    presets/
      PresetPicker.tsx        — dropdown triggering preset wizards
      MaterskaPreset.tsx      — PPM maternity benefit (calculate from income or manual for OSVČ)
      RodicovskaPreset.tsx    — parental allowance (rodičovský příspěvek)
      SlevaNaDitePreset.tsx   — child tax credit with optional scheduled increases
      ZvyseniPlatuPreset.tsx  — salary raise (% change on existing income event)
      InflacniSkok.tsx        — splits expense events at a date with a new inflation rate
      NavratDoPrice.tsx       — return-to-work income event
  App.tsx — 3-row layout: KPI bar → (baseline | events+mortgages) → chart
```

## Core architecture

### Month offsets
All event/mortgage timing is stored as integer month offsets from `baseline.startDate` ("YYYY-MM"). Never store dates directly. Convert with `dateToMonthOffset(date, startDate)` and `monthOffsetToDate(offset, startDate)`. Use `<input type="month">` in forms and convert on change.

### simulate(plan): MonthlySnapshot[]
Pure function — no side effects, no React dependencies. Called on every plan change. Produces one snapshot per month for `horizonYears * 12 + 1` months. The helper `applyEvents(plan, m)` is shared between `simulate()` and `getMonthDetail()` — do not duplicate this logic.

### Safety buffer sweep
Each month: surplus cash above `safetyBufferMonths * avgExpenses` auto-moves to investments. If cash goes negative, withdraws from investments first. `avgExpenses` = rolling 3-month average of (expenses + mortgagePayments + insurance).

### rebaseOffsets
When `startDate` changes, `rebaseOffsets()` in the store recalculates all event/mortgage month offsets to preserve absolute calendar dates. Critical: without this, changing the start date shifts all events.

### Mortgage extra payment
Stored on `Mortgage.extraPayment: { month, amount, strategy }`. `stepMortgage()` in `mortgage.ts` handles the one-time lump sum — either shortens term or lowers payment.

## Key patterns

### AmountInput
Use for all CZK number inputs. Shows space-separated format on blur, raw number on focus. Enforces `min` on blur. Never use `<input type="number">` for CZK amounts.

### Modal close — mouseDownTarget ref pattern
All modals must close only when BOTH mousedown AND click land on the backdrop (not on modal content). Pattern:
```tsx
const mouseDownTarget = useRef<EventTarget | null>(null);
// on backdrop div:
onMouseDown={(e) => { mouseDownTarget.current = e.target; }}
onClick={(e) => {
  if (e.target === e.currentTarget && mouseDownTarget.current === e.currentTarget) onClose();
}}
```
This prevents the modal closing when the user drags text inside the modal to the backdrop.

### setTimeout auto-close in preset wizards
Always use `useEffect` + `clearTimeout` cleanup, never bare `setTimeout`:
```tsx
useEffect(() => {
  if (!success) return;
  const tid = setTimeout(onClose, 1500);
  return () => clearTimeout(tid);
}, [success, onClose]);
```

### Preset events
Presets insert regular `CashflowEvent` entries with a `presetGroup: string` (UUID) to group related events. No hidden simulation logic in presets.

## UI rules
- All UI strings in Czech. Code, comments, types in English.
- Tailwind only — no CSS-in-JS, no inline styles except dynamic chart colors.
- Number display: `formatCZK()` — space thousand separator, "Kč" suffix, no decimals for amounts ≥ 100.
- Chart x-axis: adaptive tick spacing — every year (≤10y), every 2y (≤20y), every 5y (>20y). Prevents Recharts hiding ticks.

## Czech domain constants (2026)
```
PPM_MAX_MONTHLY_2026 = 49_020       // maternity benefit monthly cap
RODICOVSKY_PRISPEVEK_DEFAULT = 350_000  // parental allowance total
SLEVA_NA_DITE_2026 = [1_267, 1_860, 2_320]  // per child per month (1st, 2nd, 3rd+)
```

## Running the project
```
npm run dev     # start dev server (port 5173)
npm run build   # production build
npm test        # vitest (42 tests)
npx tsc --noEmit  # type check
```

## What's been built (phases 1–4)
- **Phase 1**: Scaffolding, types, store, simulate, seed data, BaselinePanel, EventsPanel, MortgageForm with amortization summary, ResultsPanel with chart and table, JSON export/import.
- **Phase 2**: Safety buffer sweep, investments yield, chart series toggles, KPI summary bar, negative cash warnings, runway metric with tooltip.
- **Phase 3**: AmountInput, preset wizards (Mateřská, Rodičovská, Sleva na dítě, Zvýšení platu), annual growth rate on events with inflation suggestions.
- **Phase 4**: InflacniSkok preset, NavratDoPrice preset, MonthDetailModal (click any chart month or table row), accessibility improvements.

## Known decisions / non-obvious choices
- `rateSchedule[].id: string` — stable UUID keys for React list rendering, not array index.
- `getMonthDetail()` runs a full simulation up to `targetMonth` — it's `useMemo`'d in MonthDetailModal.
- Yearly events (`frequency: "yearly"`) fire on months where `(m - startMonth) % 12 === 0`, not on a fixed calendar month.
- Extra payment strategy `"shorten-term"` recalculates monthly payment from remaining principal + shorter term; `"lower-payment"` keeps original term.
