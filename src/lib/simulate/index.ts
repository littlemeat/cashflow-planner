// Pure simulation engine — produces MonthlySnapshot[] from a Plan
import { Plan, MonthlySnapshot, FrequencyType } from "../../types";
import { addMonths } from "../formatters";
import { initMortgageState, stepMortgage, MortgageState } from "./mortgage";

export type { MortgageState };

// ── Per-event contribution for a single month ─────────────────────────────────

export interface EventContribution {
  eventId: string;
  eventName: string;
  category: "income" | "expense";
  amount: number;        // actual amount applied this month (with growth)
  frequency: FrequencyType;
}

export interface MonthDetail {
  month: number;
  date: string;
  income: number;
  expenses: number;
  mortgagePayment: number;
  mortgageInterest: number;
  mortgagePrincipal: number;
  netCashflow: number;
  cashAccount: number;
  investmentsBalance: number;
  contributions: EventContribution[];  // per-event breakdown
  flags: string[];
  runwayMonths: number;
}

// ── Shared event application helper ──────────────────────────────────────────

interface AppliedEvents {
  income: number;
  expenses: number;
  contributions: EventContribution[];
}

function applyEvents(plan: Plan, m: number): AppliedEvents {
  const { events, baseline } = plan;
  const horizonMonths = baseline.horizonYears * 12;
  let income = 0;
  let expenses = 0;
  const contributions: EventContribution[] = [];

  for (const evt of events) {
    const evtEnd = evt.endMonth ?? horizonMonths;
    if (m < evt.startMonth || m > evtEnd) continue;

    const monthsActive = m - evt.startMonth;
    const growthFactor = Math.pow(1 + evt.annualGrowthPct / 12, monthsActive);
    const amount = evt.amount * growthFactor;

    let applies = false;
    switch (evt.frequency) {
      case "monthly":
        applies = true;
        break;
      case "yearly":
        applies = (m - evt.startMonth) % 12 === 0;
        break;
      case "one-off":
        applies = m === evt.startMonth;
        break;
    }

    if (!applies) continue;

    if (evt.category === "income") {
      income += amount;
    } else {
      expenses += amount;
    }

    contributions.push({
      eventId: evt.id,
      eventName: evt.name,
      category: evt.category,
      amount,
      frequency: evt.frequency,
    });
  }

  return { income, expenses, contributions };
}

// ── getMonthDetail ────────────────────────────────────────────────────────────

export function getMonthDetail(plan: Plan, targetMonth: number): MonthDetail {
  const { baseline, mortgages } = plan;
  const horizonMonths = baseline.horizonYears * 12;
  const clampedTarget = Math.min(targetMonth, horizonMonths);

  const mortgageStates: MortgageState[] = mortgages.map((m) =>
    initMortgageState(m)
  );

  let cashAccount = baseline.cashAccount;
  let investmentsBalance = baseline.investmentsBalance;
  const recentExpenses: number[] = [];

  let resultDetail: MonthDetail = {
    month: clampedTarget,
    date: addMonths(baseline.startDate, clampedTarget),
    income: 0,
    expenses: 0,
    mortgagePayment: 0,
    mortgageInterest: 0,
    mortgagePrincipal: 0,
    netCashflow: 0,
    cashAccount: 0,
    investmentsBalance: 0,
    contributions: [],
    flags: [],
    runwayMonths: 0,
  };

  for (let m = 0; m <= clampedTarget; m++) {
    const flags: string[] = [];

    // Apply events using shared helper
    const { income, expenses, contributions } = applyEvents(plan, m);

    // Compute mortgage payments
    let totalMortgagePayment = 0;
    let totalInterestPortion = 0;
    let totalPrincipalPortion = 0;
    let totalInsurance = 0;

    for (let i = 0; i < mortgages.length; i++) {
      const mortgage = mortgages[i]!;
      const state = mortgageStates[i]!;

      if (mortgage.startMonth > m) continue;
      if (state.remainingPrincipal <= 0 || state.remainingMonths <= 0) continue;

      const result = stepMortgage(state, mortgage, m);
      mortgageStates[i] = result.newState;

      totalMortgagePayment += result.payment;
      totalInterestPortion += result.interestPortion;
      totalPrincipalPortion += result.principalPortion;
      totalInsurance += mortgage.insuranceMonthly ?? 0;
    }

    const netCashflow = income - expenses - totalMortgagePayment - totalInsurance;

    cashAccount += netCashflow;

    recentExpenses.push(expenses + totalMortgagePayment + totalInsurance);
    if (recentExpenses.length > 3) recentExpenses.shift();

    const avgExpenses =
      recentExpenses.length > 0
        ? recentExpenses.reduce((a, b) => a + b, 0) / recentExpenses.length
        : 0;

    const safetyBuffer = baseline.safetyBufferMonths * avgExpenses;

    if (cashAccount > safetyBuffer) {
      const excess = cashAccount - safetyBuffer;
      investmentsBalance += excess;
      cashAccount -= excess;
    }

    if (cashAccount < 0 && investmentsBalance > 0) {
      const withdrawal = Math.min(-cashAccount, investmentsBalance);
      investmentsBalance -= withdrawal;
      cashAccount += withdrawal;
      flags.push("investments-withdrawn");
    }

    if (cashAccount < 0) {
      flags.push("cash-negative");
    }

    investmentsBalance *= Math.pow(1 + baseline.investmentsYieldAnnual, 1 / 12);

    const runwayMonths =
      avgExpenses > 0
        ? (cashAccount + investmentsBalance) / avgExpenses
        : Infinity;

    if (m === clampedTarget) {
      resultDetail = {
        month: m,
        date: addMonths(baseline.startDate, m),
        income,
        expenses,
        mortgagePayment: totalMortgagePayment + totalInsurance,
        mortgageInterest: totalInterestPortion,
        mortgagePrincipal: totalPrincipalPortion,
        netCashflow,
        cashAccount,
        investmentsBalance,
        contributions,
        flags,
        runwayMonths,
      };
    }
  }

  return resultDetail;
}

export function simulate(plan: Plan): MonthlySnapshot[] {
  const { baseline, mortgages } = plan;
  const horizonMonths = baseline.horizonYears * 12;

  // Initialize per-mortgage mutable state (never mutates plan)
  const mortgageStates: MortgageState[] = mortgages.map((m) =>
    initMortgageState(m)
  );

  // Running account balances — seeded from baseline
  let cashAccount = baseline.cashAccount;
  let investmentsBalance = baseline.investmentsBalance;

  // For safety buffer computation: track last 3 months of (expenses + mortgagePayment)
  const recentExpenses: number[] = [];

  const snapshots: MonthlySnapshot[] = [];

  for (let m = 0; m <= horizonMonths; m++) {
    const flags: string[] = [];

    // ── Step 1: Apply events ──────────────────────────────────────────────────
    const { income, expenses } = applyEvents(plan, m);

    // ── Step 2: Compute mortgage payments ────────────────────────────────────
    let totalMortgagePayment = 0;
    let totalInterestPortion = 0;
    let totalPrincipalPortion = 0;
    let totalInsurance = 0;

    for (let i = 0; i < mortgages.length; i++) {
      const mortgage = mortgages[i]!;
      const state = mortgageStates[i]!;

      // Skip mortgages that haven't started yet
      if (mortgage.startMonth > m) continue;

      // Skip mortgages that are fully paid off
      if (state.remainingPrincipal <= 0 || state.remainingMonths <= 0) continue;

      const result = stepMortgage(state, mortgage, m);
      mortgageStates[i] = result.newState;

      totalMortgagePayment += result.payment;
      totalInterestPortion += result.interestPortion;
      totalPrincipalPortion += result.principalPortion;
      totalInsurance += mortgage.insuranceMonthly ?? 0;
    }

    // ── Step 3: Net cashflow ─────────────────────────────────────────────────
    const netCashflow =
      income - expenses - totalMortgagePayment - totalInsurance;

    // ── Step 4: Apply to accounts ────────────────────────────────────────────
    cashAccount += netCashflow;

    // Track recent expenses for safety buffer
    recentExpenses.push(expenses + totalMortgagePayment + totalInsurance);
    if (recentExpenses.length > 3) recentExpenses.shift();

    const avgExpenses =
      recentExpenses.length > 0
        ? recentExpenses.reduce((a, b) => a + b, 0) / recentExpenses.length
        : 0;

    const safetyBuffer = baseline.safetyBufferMonths * avgExpenses;

    if (cashAccount > safetyBuffer) {
      const excess = cashAccount - safetyBuffer;
      investmentsBalance += excess;
      cashAccount -= excess;
    }

    if (cashAccount < 0 && investmentsBalance > 0) {
      const withdrawal = Math.min(-cashAccount, investmentsBalance);
      investmentsBalance -= withdrawal;
      cashAccount += withdrawal;
      flags.push("investments-withdrawn");
    }

    if (cashAccount < 0) {
      flags.push("cash-negative");
    }

    // ── Step 5: Investments grow ─────────────────────────────────────────────
    investmentsBalance *= Math.pow(1 + baseline.investmentsYieldAnnual, 1 / 12);

    // ── Step 6: Record snapshot ───────────────────────────────────────────────
    // Only count mortgages that have already started — not future ones
    const mortgageBalance = mortgageStates.reduce(
      (sum, s, i) => sum + (mortgages[i]!.startMonth <= m ? s.remainingPrincipal : 0),
      0
    );
    const netWorth = cashAccount + investmentsBalance - mortgageBalance;
    const runwayMonths =
      avgExpenses > 0
        ? (cashAccount + investmentsBalance) / avgExpenses
        : Infinity;

    snapshots.push({
      month: m,
      date: addMonths(baseline.startDate, m),
      income,
      expenses,
      mortgagePayment: totalMortgagePayment + totalInsurance,
      mortgageInterestPortion: totalInterestPortion,
      mortgagePrincipalPortion: totalPrincipalPortion,
      netCashflow,
      cashAccount,
      investmentsBalance,
      mortgageBalance,
      netWorth,
      runwayMonths,
      flags,
    });
  }

  return snapshots;
}
