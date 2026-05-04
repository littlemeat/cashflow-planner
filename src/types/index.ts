// All TypeScript types for the cashflow planner

export type FrequencyType = "monthly" | "yearly" | "one-off";
export type EventCategory = "income" | "expense";

export interface Baseline {
  startDate: string; // ISO "YYYY-MM"
  cashAccount: number;
  investmentsBalance: number;
  investmentsYieldAnnual: number;
  safetyBufferMonths: number;
  horizonYears: number;
}

export interface CashflowEvent {
  id: string;
  name: string;
  category: EventCategory;
  amount: number;
  frequency: FrequencyType;
  startMonth: number;
  endMonth: number | null;
  growthSchedule: Array<{ id: string; fromMonth: number; rateAnnual: number }>;
  notes?: string;
  presetGroup?: string;
  hidden?: boolean;
}

export interface Mortgage {
  id: string;
  name: string;
  principal: number;
  startMonth: number;
  termMonths: number;
  rateSchedule: Array<{ id: string; fromMonth: number; rateAnnual: number }>;
  insuranceMonthly?: number;
  extraPayments?: Array<{
    id: string;
    month: number;
    amount: number;
    strategy: "shorten-term" | "lower-payment";
  }>;
  hidden?: boolean;
}

export interface Asset {
  id: string;
  name: string;
  purchaseValue: number;          // total value at acquisition (e.g. 8 200 000)
  acquisitionMonth: number;       // month offset from plan start; 0 = exists from start
  appreciationAnnual: number;     // e.g. 0.02 for 2 %/year
  linkedExpenseId?: string;       // optional: one-off expense that paid for this
  linkedMortgageId?: string;      // optional: mortgage tied to this property
  hidden?: boolean;
}

/** A half-open month-offset interval: active from `from` (inclusive) to `to` (exclusive, null = forever) */
export interface Period {
  from: number;
  to: number | null;
}

/** Returns true if month offset `m` falls within the period */
export function isActiveAt(period: Period, m: number): boolean {
  return m >= period.from && (period.to === null || m < period.to);
}

export interface Plan {
  id: string;
  name: string;
  createdAt: string;
  updatedAt: string;
  schemaVersion: number;
  baseline: Baseline;
  events: CashflowEvent[];
  mortgages: Mortgage[];
  assets: Asset[];
}

export interface MonthlySnapshot {
  month: number;                       // 0 … horizonYears*12
  date: string;                        // "YYYY-MM"
  income: number;
  expenses: number;
  mortgagePayment: number;             // broken out from expenses
  mortgageInterestPortion: number;
  mortgagePrincipalPortion: number;
  netCashflow: number;
  cashAccount: number;
  investmentsBalance: number;
  mortgageBalance: number;             // remaining principal across all mortgages
  assetsValue: number;                 // sum of all asset values this month
  netWorth: number;                    // cash + investments + assetsValue - mortgageBalance
  targetCash: number;                  // safetyBuffer × trailing-12m avg recurring expenses
  runwayMonths: number;
  flags: string[];
}
