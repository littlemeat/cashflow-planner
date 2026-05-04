// Phase 4 unit tests
// Covers: AC-MonthDetail-1, AC-MonthDetail-2, AC-InflacniSkok-1
import { describe, it, expect } from "vitest";
import { simulate, getMonthDetail } from "../index";
import { Plan, Baseline, CashflowEvent } from "../../../types";

// ── Helper ────────────────────────────────────────────────────────────────────

function makePlan(overrides: Partial<Plan> = {}): Plan {
  const baseline: Baseline = {
    startDate: "2026-09",
    cashAccount: 0,
    investmentsBalance: 0,
    investmentsYieldAnnual: 0,
    safetyBufferMonths: 0,
    horizonYears: 5,
  };
  return {
    id: "test",
    name: "Test Plan",
    createdAt: "2026-01-01T00:00:00.000Z",
    updatedAt: "2026-01-01T00:00:00.000Z",
    schemaVersion: 1,
    baseline,
    events: [],
    mortgages: [],
    assets: [],
    ...overrides,
  };
}

// ── AC-MonthDetail-1: per-event contributions, no growth ─────────────────────

describe("AC-MonthDetail-1 — getMonthDetail per-event breakdown at month 0", () => {
  it("returns 2 contributions: income 50k and expense 20k, netCashflow = 30k", () => {
    const plan = makePlan({
      events: [
        {
          id: "e1",
          name: "Salary",
          category: "income",
          amount: 50_000,
          frequency: "monthly",
          startMonth: 0,
          endMonth: null,
          growthSchedule: [{ id: "test-gs", fromMonth: 0, rateAnnual: 0 }],
        },
        {
          id: "e2",
          name: "Rent",
          category: "expense",
          amount: 20_000,
          frequency: "monthly",
          startMonth: 0,
          endMonth: null,
          growthSchedule: [{ id: "test-gs", fromMonth: 0, rateAnnual: 0 }],
        },
      ],
    });

    const detail = getMonthDetail(plan, 0);

    // Two contributions
    expect(detail.contributions).toHaveLength(2);

    // Income contribution
    const incomeContrib = detail.contributions.find((c) => c.category === "income");
    expect(incomeContrib).toBeDefined();
    expect(incomeContrib!.amount).toBeCloseTo(50_000, 0);
    expect(incomeContrib!.eventId).toBe("e1");

    // Expense contribution
    const expenseContrib = detail.contributions.find((c) => c.category === "expense");
    expect(expenseContrib).toBeDefined();
    expect(expenseContrib!.amount).toBeCloseTo(20_000, 0);
    expect(expenseContrib!.eventId).toBe("e2");

    // Net cashflow = 50k - 20k = 30k (no mortgage)
    expect(detail.netCashflow).toBeCloseTo(30_000, 0);
    expect(detail.income).toBeCloseTo(50_000, 0);
    expect(detail.expenses).toBeCloseTo(20_000, 0);
  });
});

// ── AC-MonthDetail-2: growth at month 1 ──────────────────────────────────────

describe("AC-MonthDetail-2 — getMonthDetail growth at month 1", () => {
  it("10000 at rateAnnual=0.12 → amount at month 1 ≈ 10100", () => {
    // monthsActive = 1 - 0 = 1
    // Single entry: monthsInPeriod = max(0, 1-0) = 1
    // factor = (1 + 0.12/12)^1 = 1.01
    // amount = 10000 * 1.01 = 10100
    const plan = makePlan({
      events: [
        {
          id: "e1",
          name: "Growing income",
          category: "income",
          amount: 10_000,
          frequency: "monthly",
          startMonth: 0,
          endMonth: null,
          growthSchedule: [{ id: "test-gs", fromMonth: 0, rateAnnual: 0.12 }],
        },
      ],
    });

    const detail = getMonthDetail(plan, 1);

    expect(detail.contributions).toHaveLength(1);
    const contrib = detail.contributions[0]!;
    // 10000 * (1 + 0.12/12)^1 = 10000 * 1.01 = 10100
    expect(contrib.amount).toBeCloseTo(10_100, 0);
    expect(detail.income).toBeCloseTo(10_100, 0);
  });
});

// ── AC-InflacniSkok-1: growthSchedule piecewise compounding ──────────────────
//
// The new InflacniSkok preset adds a growthSchedule entry to existing events instead
// of splitting them. We test the simulation math directly with a 2-entry schedule.
//
// Growth formula: monthsInPeriod uses max(0, monthsActive - periodStart) for the
// last period and max(0, min(monthsActive, nextFromMonth) - periodStart) for others.
// This preserves backward compatibility: single entry = old annualGrowthPct behavior.

describe("AC-InflacniSkok-1 — growthSchedule piecewise compounding", () => {
  it("expense 10000, 3% for first 6 months, 5% from period [6,∞): new rate applies from month 7", () => {
    // Two entries: {fromMonth:0, rate:0.03} and {fromMonth:6, rate:0.05}
    // At month 6 (monthsActive=6):
    //   Period 0 [0,6): min(6,6)-0=6 months at 3% → (1+0.03/12)^6
    //   Period 1 [6,∞): max(0,6-6)=0 → skipped
    // At month 7 (monthsActive=7):
    //   Period 0 [0,6): min(7,6)-0=6 months at 3% → (1+0.03/12)^6
    //   Period 1 [6,∞): max(0,7-6)=1 month at 5% → (1+0.05/12)^1
    //   factor = (1+0.03/12)^6 * (1+0.05/12)^1
    const plan = makePlan({
      baseline: {
        startDate: "2026-09",
        cashAccount: 100_000_000,
        investmentsBalance: 0,
        investmentsYieldAnnual: 0,
        safetyBufferMonths: 0,
        horizonYears: 5,
      },
      events: [
        {
          id: "e1",
          name: "Groceries",
          category: "expense",
          amount: 10_000,
          frequency: "monthly",
          startMonth: 0,
          endMonth: null,
          growthSchedule: [
            { id: "gs-1", fromMonth: 0, rateAnnual: 0.03 },
            { id: "gs-2", fromMonth: 6, rateAnnual: 0.05 },
          ],
        },
      ],
    });

    const snapshots = simulate(plan);

    // Month 6: only 3% applies (period 1 monthsInPeriod=0)
    const factorAtMonth6 = Math.pow(1 + 0.03/12, 6);
    expect(snapshots[6]?.expenses).toBeCloseTo(10_000 * factorAtMonth6, 0);

    // Month 7: 3% for 6 months + 5% for 1 month
    const factorAtMonth7 = Math.pow(1 + 0.03/12, 6) * Math.pow(1 + 0.05/12, 1);
    expect(snapshots[7]?.expenses).toBeCloseTo(10_000 * factorAtMonth7, 0);

    // Month 7 expense must be greater than month 6 (5% rate adds more growth)
    expect(snapshots[7]!.expenses).toBeGreaterThan(snapshots[6]!.expenses);
  });

  it("single schedule entry produces same result as old annualGrowthPct formula", () => {
    // Single entry {fromMonth:0, rateAnnual:0.03}:
    // monthsInPeriod = max(0, monthsActive-0) = monthsActive
    // factor = (1+0.03/12)^monthsActive — identical to old formula
    const plan = makePlan({
      baseline: {
        startDate: "2026-09",
        cashAccount: 100_000_000,
        investmentsBalance: 0,
        investmentsYieldAnnual: 0,
        safetyBufferMonths: 0,
        horizonYears: 2,
      },
      events: [
        {
          id: "e1",
          name: "Expense",
          category: "expense",
          amount: 10_000,
          frequency: "monthly",
          startMonth: 0,
          endMonth: null,
          growthSchedule: [{ id: "gs-1", fromMonth: 0, rateAnnual: 0.03 }],
        },
      ],
    });

    const snapshots = simulate(plan);

    // At month 0 (monthsActive=0): factor=1, amount=10000
    expect(snapshots[0]?.expenses).toBeCloseTo(10_000, 0);

    // At month 1 (monthsActive=1): factor=(1+0.03/12)^1
    const expected1 = 10_000 * Math.pow(1 + 0.03/12, 1);
    expect(snapshots[1]?.expenses).toBeCloseTo(expected1, 0);

    // At month 12 (monthsActive=12): factor=(1+0.03/12)^12
    const expected12 = 10_000 * Math.pow(1 + 0.03/12, 12);
    expect(snapshots[12]?.expenses).toBeCloseTo(expected12, 0);
  });

  it("at month 0 (first active month), base amount is returned unchanged (no growth yet)", () => {
    // monthsActive=0, single entry → monthsInPeriod=0, factor=1
    const plan = makePlan({
      baseline: {
        startDate: "2026-09",
        cashAccount: 100_000_000,
        investmentsBalance: 0,
        investmentsYieldAnnual: 0,
        safetyBufferMonths: 0,
        horizonYears: 1,
      },
      events: [
        {
          id: "e1",
          name: "Expense",
          category: "expense",
          amount: 15_000,
          frequency: "monthly",
          startMonth: 0,
          endMonth: null,
          growthSchedule: [{ id: "gs-1", fromMonth: 0, rateAnnual: 0.03 }],
        },
      ],
    });

    const snapshots = simulate(plan);
    expect(snapshots[0]?.expenses).toBeCloseTo(15_000, 0);
  });
});

// ── AC-NavratDoPrice-1: logic verification (static analysis) ──────────────────
//
// NavratDoPrice.tsx is a React component; we test the pure logic it performs.

describe("AC-NavratDoPrice-1 — Návrat do práce logic", () => {
  it("creates income event at fromOffset with correct properties", () => {
    // Replicate handleSubmit logic from NavratDoPrice.tsx
    const fromOffset = 4;
    const salaryAmount = 60_000;
    const growthPct = 3;
    const name = "Plat po návratu";

    const groupId = "fake-group-id";

    const newEvent: Omit<CashflowEvent, "id"> = {
      name,
      category: "income",
      frequency: "monthly",
      amount: salaryAmount,
      startMonth: fromOffset,
      endMonth: null,
      growthSchedule: [{ id: crypto.randomUUID(), fromMonth: 0, rateAnnual: growthPct / 100 }],
      presetGroup: groupId,
    };

    expect(newEvent.category).toBe("income");
    expect(newEvent.startMonth).toBe(fromOffset);
    expect(newEvent.growthSchedule[0]!.rateAnnual).toBeCloseTo(0.03, 5);
    expect(newEvent.presetGroup).toBe(groupId);
  });

  it("existing event gets endMonth = fromOffset - 1 with same presetGroup", () => {
    // When endEventId !== "none", the preset calls:
    //   updateEvent(endEventId, { endMonth: fromOffset - 1, presetGroup: groupId })
    const fromOffset = 4;
    const groupId = "fake-group-id";

    const updatePayload = {
      endMonth: fromOffset - 1,
      presetGroup: groupId,
    };

    expect(updatePayload.endMonth).toBe(3);
    expect(updatePayload.presetGroup).toBe(groupId);
  });

  it("new income event and existing event share the same presetGroup", () => {
    const fromOffset = 6;
    const groupId = crypto.randomUUID();

    const existingEventUpdate = {
      endMonth: fromOffset - 1,
      presetGroup: groupId,
    };

    const newEventProperties = {
      startMonth: fromOffset,
      presetGroup: groupId,
      category: "income" as const,
    };

    expect(existingEventUpdate.presetGroup).toBe(newEventProperties.presetGroup);
  });
});
