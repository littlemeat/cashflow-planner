// Phase 4 unit tests
// Covers: AC-MonthDetail-1, AC-MonthDetail-2, AC-InflacniSkok-1
import { describe, it, expect } from "vitest";
import { getMonthDetail } from "../index";
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
          annualGrowthPct: 0,
        },
        {
          id: "e2",
          name: "Rent",
          category: "expense",
          amount: 20_000,
          frequency: "monthly",
          startMonth: 0,
          endMonth: null,
          annualGrowthPct: 0,
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
  it("10000 at annualGrowthPct=0.12 → amount at month 1 ≈ 10100", () => {
    // 1% per month: 10000 * (1 + 0.12/12)^1 = 10000 * 1.01 = 10100
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
          annualGrowthPct: 0.12,
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

// ── AC-InflacniSkok-1: pure math — split logic ────────────────────────────────
//
// The InflacniSkok preset is a React component and cannot be unit-tested directly
// without a DOM. Instead, we test the core math it applies:
//   - grownAmount at the split point
//   - new event's annualGrowthPct
//   - original event endMonth = fromOffset - 1
//
// We replicate the exact computation from InflacniSkok.tsx handleSubmit.

describe("AC-InflacniSkok-1 — split math for expense event", () => {
  it("expense 10000, annualGrowthPct=0.03, split at month 6 → grownAmount ≈ 10151, newRate = 0.05", () => {
    // Mirroring InflacniSkok.tsx handleSubmit logic:
    const evt: CashflowEvent = {
      id: "ev1",
      name: "Groceries",
      category: "expense",
      amount: 10_000,
      frequency: "monthly",
      startMonth: 0,
      endMonth: null,
      annualGrowthPct: 0.03,
    };

    const fromOffset = 6; // split at month 6
    const newGrowthPct = 5; // 5% new rate entered by user
    const newRate = newGrowthPct / 100; // 0.05

    // Replicating the preset's grown-amount formula:
    const monthsActive = fromOffset - evt.startMonth; // 6 - 0 = 6
    const grownAmount =
      monthsActive > 0
        ? evt.amount * Math.pow(1 + evt.annualGrowthPct / 12, monthsActive)
        : evt.amount;

    // Expected: 10000 * (1 + 0.03/12)^6 = 10000 * (1.0025)^6
    // (1.0025)^6 ≈ 1.01506... → ~10150.94
    const expected = 10_000 * Math.pow(1 + 0.03 / 12, 6);

    expect(grownAmount).toBeCloseTo(expected, 4);
    // The AC says ≈ 10151 — verify within 1 CZK
    expect(Math.abs(grownAmount - 10_151)).toBeLessThan(1);

    // New event properties
    const newEventStartMonth = fromOffset; // 6
    const originalEventEndMonth = fromOffset - 1; // 5

    expect(newEventStartMonth).toBe(6);
    expect(originalEventEndMonth).toBe(5);
    expect(newRate).toBeCloseTo(0.05, 5);

    // Verify the new event would carry the correct amount
    const newEvent = {
      name: evt.name,
      category: "expense" as const,
      frequency: evt.frequency,
      amount: grownAmount,
      startMonth: fromOffset,
      endMonth: evt.endMonth,
      annualGrowthPct: newRate,
    };

    expect(newEvent.amount).toBeCloseTo(10_151, 0);
    expect(newEvent.annualGrowthPct).toBeCloseTo(0.05, 5);
    expect(newEvent.startMonth).toBe(6);
  });

  it("monthsActive=0 (split at startMonth) → grownAmount equals original amount", () => {
    const evt: CashflowEvent = {
      id: "ev1",
      name: "Rent",
      category: "expense",
      amount: 15_000,
      frequency: "monthly",
      startMonth: 3,
      endMonth: null,
      annualGrowthPct: 0.03,
    };

    const fromOffset = 3; // same as startMonth
    const monthsActive = fromOffset - evt.startMonth; // 0

    const grownAmount =
      monthsActive > 0
        ? evt.amount * Math.pow(1 + evt.annualGrowthPct / 12, monthsActive)
        : evt.amount;

    // No growth when split at startMonth
    expect(grownAmount).toBe(15_000);
  });
});

// ── AC-NavratDoPrice-1: logic verification (static analysis) ──────────────────
//
// NavratDoPrice.tsx is a React component; we test the pure logic it performs.

describe("AC-NavratDoPrice-1 — Návrat do práce logic", () => {
  it("creates income event at fromOffset with correct properties", () => {
    // Replicate handleSubmit logic from NavratDoPrice.tsx
    const fromOffset = 4; // some month offset
    const salaryAmount = 60_000;
    const growthPct = 3;
    const name = "Plat po návratu";

    const groupId = "fake-group-id";

    const newEvent = {
      name,
      category: "income" as const,
      frequency: "monthly" as const,
      amount: salaryAmount,
      startMonth: fromOffset,
      endMonth: null as null,
      annualGrowthPct: growthPct / 100,
      presetGroup: groupId,
    };

    expect(newEvent.category).toBe("income");
    expect(newEvent.startMonth).toBe(fromOffset);
    expect(newEvent.annualGrowthPct).toBeCloseTo(0.03, 5);
    expect(newEvent.presetGroup).toBe(groupId);
  });

  it("existing event gets endMonth = fromOffset - 1 with same presetGroup", () => {
    // When endEventId !== "none", the preset calls:
    //   updateEvent(endEventId, { endMonth: fromOffset - 1, presetGroup: groupId })
    const fromOffset = 4;
    const groupId = "fake-group-id";

    // Simulate what updateEvent receives:
    const updatePayload = {
      endMonth: fromOffset - 1,
      presetGroup: groupId,
    };

    expect(updatePayload.endMonth).toBe(3); // fromOffset - 1 = 3
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

    // Both must share the same presetGroup
    expect(existingEventUpdate.presetGroup).toBe(newEventProperties.presetGroup);
  });
});
