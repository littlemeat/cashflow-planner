// Pure simulation engine — produces MonthlySnapshot[] from a Plan
import { Plan, MonthlySnapshot, FrequencyType, Asset } from "../../types";
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
  investedThisMonth: number;  // surplus transferred to investments this month
  investmentYield: number;    // actual CZK growth from yield this month
  cashAccount: number;
  investmentsBalance: number;
  assetsValue: number;        // total market value of assets this month
  contributions: EventContribution[];  // per-event breakdown
  flags: string[];
  runwayMonths: number;
}

// ── Shared event application helper ──────────────────────────────────────────

interface AppliedEvents {
  income: number;
  expenses: number;
  recurringExpenses: number;   // expenses excluding one-off frequency
  contributions: EventContribution[];
}

function applyEvents(plan: Plan, m: number): AppliedEvents {
  const { events, baseline } = plan;
  const horizonMonths = baseline.horizonYears * 12;
  let income = 0;
  let expenses = 0;
  let recurringExpenses = 0;
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
      // Only count recurring (monthly/yearly) expenses for the safety buffer average
      if (evt.frequency !== "one-off") {
        recurringExpenses += amount;
      }
    }

    contributions.push({
      eventId: evt.id,
      eventName: evt.name,
      category: evt.category,
      amount,
      frequency: evt.frequency,
    });
  }

  return { income, expenses, recurringExpenses, contributions };
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
  const recurringExpensesHistory: number[] = [];

  let resultDetail: MonthDetail = {
    month: clampedTarget,
    date: addMonths(baseline.startDate, clampedTarget),
    income: 0,
    expenses: 0,
    mortgagePayment: 0,
    mortgageInterest: 0,
    mortgagePrincipal: 0,
    netCashflow: 0,
    investedThisMonth: 0,
    investmentYield: 0,
    cashAccount: 0,
    investmentsBalance: 0,
    assetsValue: 0,
    contributions: [],
    flags: [],
    runwayMonths: 0,
  };

  for (let m = 0; m <= clampedTarget; m++) {
    const flags: string[] = [];

    // Apply events using shared helper
    const { income, expenses, recurringExpenses, contributions } = applyEvents(plan, m);

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

    // Trailing 12-month average of recurring expenses + mortgage (excludes one-off items)
    recurringExpensesHistory.push(recurringExpenses + totalMortgagePayment + totalInsurance);
    if (recurringExpensesHistory.length > 12) recurringExpensesHistory.shift();

    const avgRecurring =
      recurringExpensesHistory.length > 0
        ? recurringExpensesHistory.reduce((a, b) => a + b, 0) / recurringExpensesHistory.length
        : 0;
    const targetCash = baseline.safetyBufferMonths * avgRecurring;

    let investedThisMonth = 0;
    if (netCashflow >= 0) {
      // Move surplus above target cash to investments
      const surplus = Math.max(0, cashAccount - targetCash);
      if (surplus > 0) {
        investmentsBalance += surplus;
        cashAccount -= surplus;
        investedThisMonth = surplus;
      }
    } else {
      // Deficit month: if cash went negative, pull from investments just to 0
      if (cashAccount < 0 && investmentsBalance > 0) {
        const withdrawal = Math.min(-cashAccount, investmentsBalance);
        investmentsBalance -= withdrawal;
        cashAccount += withdrawal;
        flags.push("investments-withdrawn");
      }
    }

    if (cashAccount < 0) {
      flags.push("cash-negative");
    }

    const monthlyGrowthFactor = Math.pow(1 + baseline.investmentsYieldAnnual, 1 / 12);
    const investmentYield = investmentsBalance * (monthlyGrowthFactor - 1);
    investmentsBalance *= monthlyGrowthFactor;

    const runwayMonths =
      avgRecurring > 0
        ? (cashAccount + investmentsBalance) / avgRecurring
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
        investedThisMonth,
        investmentYield,
        cashAccount,
        investmentsBalance,
        contributions,
        flags,
        runwayMonths,
        assetsValue: computeAssetsValue(plan.assets ?? [], m),
      };
    }
  }

  return resultDetail;
}

// ── Asset value computation ───────────────────────────────────────────────────

function computeAssetsValue(assets: Asset[], m: number): number {
  return assets.reduce((sum, asset) => {
    if (m < asset.acquisitionMonth) return sum;
    const monthsHeld = m - asset.acquisitionMonth;
    const value =
      asset.purchaseValue * Math.pow(1 + asset.appreciationAnnual, monthsHeld / 12);
    return sum + value;
  }, 0);
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

  // Trailing 12-month history of recurring expenses + mortgage for safety buffer target
  const recurringExpensesHistory: number[] = [];

  const snapshots: MonthlySnapshot[] = [];

  for (let m = 0; m <= horizonMonths; m++) {
    const flags: string[] = [];

    // ── Step 1: Apply events ──────────────────────────────────────────────────
    const { income, expenses, recurringExpenses } = applyEvents(plan, m);

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

    // Trailing 12-month average of recurring expenses + mortgage (excludes one-off items)
    recurringExpensesHistory.push(recurringExpenses + totalMortgagePayment + totalInsurance);
    if (recurringExpensesHistory.length > 12) recurringExpensesHistory.shift();

    const avgRecurring =
      recurringExpensesHistory.length > 0
        ? recurringExpensesHistory.reduce((a, b) => a + b, 0) / recurringExpensesHistory.length
        : 0;
    const targetCash = baseline.safetyBufferMonths * avgRecurring;

    if (netCashflow >= 0) {
      // Move surplus above target cash to investments
      const surplus = Math.max(0, cashAccount - targetCash);
      if (surplus > 0) {
        investmentsBalance += surplus;
        cashAccount -= surplus;
      }
    } else {
      // Deficit month: if cash went negative, pull from investments just to 0
      if (cashAccount < 0 && investmentsBalance > 0) {
        const withdrawal = Math.min(-cashAccount, investmentsBalance);
        investmentsBalance -= withdrawal;
        cashAccount += withdrawal;
        flags.push("investments-withdrawn");
      }
    }

    if (cashAccount < 0) {
      flags.push("cash-negative");
    }

    // ── Step 5: Investments grow ─────────────────────────────────────────────
    investmentsBalance *= Math.pow(1 + baseline.investmentsYieldAnnual, 1 / 12);
    // (yield amount = investmentsBalance_before * (factor - 1); tracked in getMonthDetail)

    // ── Step 6: Record snapshot ───────────────────────────────────────────────
    // Only count mortgages that have already started — not future ones
    const mortgageBalance = mortgageStates.reduce(
      (sum, s, i) => sum + (mortgages[i]!.startMonth <= m ? s.remainingPrincipal : 0),
      0
    );
    const assetsValue = computeAssetsValue(plan.assets ?? [], m);
    const netWorth = cashAccount + investmentsBalance + assetsValue - mortgageBalance;
    const runwayMonths =
      avgRecurring > 0
        ? (cashAccount + investmentsBalance) / avgRecurring
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
      assetsValue,
      netWorth,
      targetCash,
      runwayMonths,
      flags,
    });
  }

  return snapshots;
}
