// Mortgage amortization state management
import { Mortgage } from "../../types";

export interface MortgageState {
  remainingPrincipal: number;
  remainingMonths: number;
  currentPayment: number;
}

function computeAnnuityPayment(
  principal: number,
  rateAnnual: number,
  termMonths: number
): number {
  if (termMonths <= 0) return 0;
  if (rateAnnual === 0) return principal / termMonths;
  const r = rateAnnual / 12;
  return (principal * r) / (1 - Math.pow(1 + r, -termMonths));
}

// fromMonth in rateSchedule is relative to mortgage start (months elapsed since mortgage.startMonth)
function findCurrentRate(mortgage: Mortgage, monthsElapsed: number): number {
  let rate = mortgage.rateSchedule[0]?.rateAnnual ?? 0;
  for (const entry of mortgage.rateSchedule) {
    if (entry.fromMonth <= monthsElapsed) rate = entry.rateAnnual;
  }
  return rate;
}

export function initMortgageState(mortgage: Mortgage): MortgageState {
  const rateAnnual = findCurrentRate(mortgage, 0);
  const payment = computeAnnuityPayment(mortgage.principal, rateAnnual, mortgage.termMonths);
  return {
    remainingPrincipal: mortgage.principal,
    remainingMonths: mortgage.termMonths,
    currentPayment: payment,
  };
}

export function stepMortgage(
  state: MortgageState,
  mortgage: Mortgage,
  simulationMonth: number
): {
  payment: number;
  interestPortion: number;
  principalPortion: number;
  extraPaid: number;
  newState: MortgageState;
} {
  const monthsElapsed = simulationMonth - mortgage.startMonth;

  let remainingPrincipal = state.remainingPrincipal;
  let remainingMonths = state.remainingMonths;
  let currentPayment = state.currentPayment;
  let extraPaid = 0;

  // Apply all extra payments due this month, in order
  const extrasDue = (mortgage.extraPayments ?? []).filter(
    (ep) => ep.month === simulationMonth
  );

  for (const ep of extrasDue) {
    if (remainingPrincipal <= 0) break;
    const extra = Math.min(ep.amount, remainingPrincipal);
    remainingPrincipal -= extra;
    extraPaid += extra;

    const rateAnnual = findCurrentRate(mortgage, monthsElapsed);
    const r = rateAnnual / 12;

    if (ep.strategy === "shorten-term") {
      if (r === 0 || currentPayment <= 0) {
        remainingMonths = remainingPrincipal > 0 ? Math.ceil(remainingPrincipal / currentPayment) : 0;
      } else {
        const ratio = (remainingPrincipal * r) / currentPayment;
        if (ratio >= 1) {
          remainingMonths = Math.max(0, remainingMonths - 1);
        } else {
          remainingMonths = Math.max(1, Math.ceil(-Math.log(1 - ratio) / Math.log(1 + r)));
        }
      }
    } else {
      // lower-payment: keep term, recompute monthly payment
      currentPayment = computeAnnuityPayment(remainingPrincipal, rateAnnual, remainingMonths);
    }
  }

  // Recompute payment if rate changed since last month
  const rateAnnual = findCurrentRate(mortgage, monthsElapsed);
  if (monthsElapsed > 0) {
    const prevRate = findCurrentRate(mortgage, monthsElapsed - 1);
    if (prevRate !== rateAnnual) {
      currentPayment = computeAnnuityPayment(remainingPrincipal, rateAnnual, remainingMonths);
    }
  }

  const r = rateAnnual / 12;
  const interestPortion = remainingPrincipal * r;
  const principalPortion = Math.min(currentPayment - interestPortion, remainingPrincipal);
  const actualPayment = interestPortion + principalPortion;

  return {
    payment: actualPayment,
    interestPortion,
    principalPortion,
    extraPaid,
    newState: {
      remainingPrincipal: Math.max(0, remainingPrincipal - principalPortion),
      remainingMonths: Math.max(0, remainingMonths - 1),
      currentPayment,
    },
  };
}
