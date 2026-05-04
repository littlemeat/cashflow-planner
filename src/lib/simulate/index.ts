// Pure simulation engine — produces MonthlySnapshot[] from a Plan
import { Plan, MonthlySnapshot, FrequencyType, Asset, Period, isActiveAt } from "../../types";
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

// ── Internal types ────────────────────────────────────────────────────────────

interface SimState {
  cashAccount: number;
  investmentsBalance: number;
  mortgageStates: MortgageState[];
  recurringExpensesHistory: number[];
}

interface StepResult {
  income: number;
  expenses: number;
  recurringExpenses: number;
  contributions: EventContribution[];
  totalMortgagePayment: number;      // annuity + extra payments + insurance
  totalInterestPortion: number;
  totalPrincipalPortion: number;
  netCashflow: number;
  investedThisMonth: number;
  investmentYield: number;
  avgRecurring: number;
  targetCash: number;
  runwayMonths: number;
  flags: string[];
  nextState: SimState;
}

// ── Shared event application helper ──────────────────────────────────────────

interface AppliedEvents {
  income: number;
  expenses: number;
  recurringExpenses: number;   // expenses excluding one-off frequency
  contributions: EventContribution[];
}

function applyEvents(plan: Plan, m: number): AppliedEvents {
  const { events } = plan;
  let income = 0;
  let expenses = 0;
  let recurringExpenses = 0;
  const contributions: EventContribution[] = [];

  for (const evt of events) {
    if (evt.hidden) continue;
    const period: Period = { from: evt.startMonth, to: evt.endMonth !== null ? evt.endMonth + 1 : null };
    if (!isActiveAt(period, m)) continue;

    const monthsActive = m - evt.startMonth;

    // Compound growth across schedule periods.
    // Uses monthsActive (= m - startMonth) as the total elapsed months, matching the
    // original single-rate formula: amount * (1 + rate/12)^monthsActive.
    const sortedSchedule = [...evt.growthSchedule].sort((a, b) => a.fromMonth - b.fromMonth);
    let growthFactor = 1;
    for (let i = 0; i < sortedSchedule.length; i++) {
      const entry = sortedSchedule[i]!;
      const nextEntry = sortedSchedule[i + 1];
      const periodStart = entry.fromMonth;                        // relative to startMonth
      const periodEnd = nextEntry ? nextEntry.fromMonth : monthsActive;
      const monthsInPeriod = Math.max(0, Math.min(monthsActive, periodEnd) - periodStart);
      if (monthsInPeriod <= 0) continue;
      growthFactor *= Math.pow(1 + entry.rateAnnual / 12, monthsInPeriod);
    }

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

// ── Asset value computation ───────────────────────────────────────────────────

function computeAssetsValue(assets: Asset[], m: number): number {
  return assets.reduce((sum, asset) => {
    if (asset.hidden) return sum;
    if (m < asset.acquisitionMonth) return sum;
    const monthsHeld = m - asset.acquisitionMonth;
    const value =
      asset.purchaseValue * Math.pow(1 + asset.appreciationAnnual, monthsHeld / 12);
    return sum + value;
  }, 0);
}

// ── Core per-month step function ──────────────────────────────────────────────

function stepMonth(plan: Plan, state: SimState, m: number): StepResult {
  const { baseline, mortgages } = plan;
  const flags: string[] = [];

  // Step 1: Apply events
  const { income, expenses, recurringExpenses, contributions } = applyEvents(plan, m);

  // Step 2: Compute mortgage payments — produce new mortgage states (do not mutate input)
  let totalMortgagePayment = 0;
  let totalInterestPortion = 0;
  let totalPrincipalPortion = 0;
  let totalInsurance = 0;

  const newMortgageStates: MortgageState[] = state.mortgageStates.map(
    (mortState, i) => {
      const mortgage = mortgages[i]!;

      if (mortgage.hidden) return mortState;
      if (mortgage.startMonth > m) return mortState;
      if (mortState.remainingPrincipal <= 0 || mortState.remainingMonths <= 0) return mortState;

      const result = stepMortgage(mortState, mortgage, m);

      totalMortgagePayment += result.payment + result.extraPaid;
      totalInterestPortion += result.interestPortion;
      totalPrincipalPortion += result.principalPortion;
      totalInsurance += mortgage.insuranceMonthly ?? 0;

      return result.newState;
    }
  );

  // Insurance is part of totalMortgagePayment in the final output
  const totalPaymentWithInsurance = totalMortgagePayment + totalInsurance;

  // Step 3: Net cashflow
  const netCashflow = income - expenses - totalPaymentWithInsurance;

  // Step 4: Update cash account
  let cashAccount = state.cashAccount + netCashflow;

  // Step 5: Trailing 12-month average of recurring expenses + mortgage payments
  const newHistory = [...state.recurringExpensesHistory, recurringExpenses + totalPaymentWithInsurance];
  if (newHistory.length > 12) newHistory.shift();

  const avgRecurring =
    newHistory.length > 0
      ? newHistory.reduce((a, b) => a + b, 0) / newHistory.length
      : 0;
  const targetCash = baseline.safetyBufferMonths * avgRecurring;

  // Step 6: Safety buffer sweep
  let investmentsBalance = state.investmentsBalance;
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

  // Step 7: Investment yield growth
  const monthlyGrowthFactor = Math.pow(1 + baseline.investmentsYieldAnnual, 1 / 12);
  const investmentYield = investmentsBalance * (monthlyGrowthFactor - 1);
  investmentsBalance *= monthlyGrowthFactor;

  // Step 8: Runway
  const runwayMonths =
    avgRecurring > 0
      ? (cashAccount + investmentsBalance) / avgRecurring
      : Infinity;

  return {
    income,
    expenses,
    recurringExpenses,
    contributions,
    totalMortgagePayment: totalPaymentWithInsurance,
    totalInterestPortion,
    totalPrincipalPortion,
    netCashflow,
    investedThisMonth,
    investmentYield,
    avgRecurring,
    targetCash,
    runwayMonths,
    flags,
    nextState: {
      cashAccount,
      investmentsBalance,
      mortgageStates: newMortgageStates,
      recurringExpensesHistory: newHistory,
    },
  };
}

// ── simulate ──────────────────────────────────────────────────────────────────

export function simulate(plan: Plan): MonthlySnapshot[] {
  const { baseline, mortgages } = plan;
  const horizonMonths = baseline.horizonYears * 12;

  let current: SimState = {
    cashAccount: baseline.cashAccount,
    investmentsBalance: baseline.investmentsBalance,
    mortgageStates: mortgages.map(initMortgageState),
    recurringExpensesHistory: [],
  };

  const snapshots: MonthlySnapshot[] = [];

  for (let m = 0; m <= horizonMonths; m++) {
    const result = stepMonth(plan, current, m);
    current = result.nextState;

    const mortgageBalance = current.mortgageStates.reduce(
      (sum, s, i) => {
        const mortgage = mortgages[i]!;
        if (mortgage.hidden) return sum;
        return sum + (mortgage.startMonth <= m ? s.remainingPrincipal : 0);
      },
      0
    );
    const assetsValue = computeAssetsValue(plan.assets ?? [], m);
    const netWorth = current.cashAccount + current.investmentsBalance + assetsValue - mortgageBalance;

    snapshots.push({
      month: m,
      date: addMonths(baseline.startDate, m),
      income: result.income,
      expenses: result.expenses,
      mortgagePayment: result.totalMortgagePayment,
      mortgageInterestPortion: result.totalInterestPortion,
      mortgagePrincipalPortion: result.totalPrincipalPortion,
      netCashflow: result.netCashflow,
      cashAccount: current.cashAccount,
      investmentsBalance: current.investmentsBalance,
      mortgageBalance,
      assetsValue,
      netWorth,
      targetCash: result.targetCash,
      runwayMonths: result.runwayMonths,
      flags: result.flags,
    });
  }

  return snapshots;
}

// ── getMonthDetail ────────────────────────────────────────────────────────────

export function getMonthDetail(plan: Plan, targetMonth: number): MonthDetail {
  const { baseline, mortgages } = plan;
  const horizonMonths = baseline.horizonYears * 12;
  const clampedTarget = Math.min(targetMonth, horizonMonths);

  let state: SimState = {
    cashAccount: baseline.cashAccount,
    investmentsBalance: baseline.investmentsBalance,
    mortgageStates: mortgages.map(initMortgageState),
    recurringExpensesHistory: [],
  };

  let lastResult: StepResult | null = null;

  for (let m = 0; m <= clampedTarget; m++) {
    const result = stepMonth(plan, state, m);
    state = result.nextState;
    if (m === clampedTarget) lastResult = result;
  }

  const r = lastResult!;
  return {
    month: clampedTarget,
    date: addMonths(baseline.startDate, clampedTarget),
    income: r.income,
    expenses: r.expenses,
    mortgagePayment: r.totalMortgagePayment,
    mortgageInterest: r.totalInterestPortion,
    mortgagePrincipal: r.totalPrincipalPortion,
    netCashflow: r.netCashflow,
    investedThisMonth: r.investedThisMonth,
    investmentYield: r.investmentYield,
    cashAccount: state.cashAccount,
    investmentsBalance: state.investmentsBalance,
    contributions: r.contributions,
    flags: r.flags,
    runwayMonths: r.runwayMonths,
    assetsValue: computeAssetsValue(plan.assets ?? [], clampedTarget),
  };
}
