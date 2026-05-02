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
  annualGrowthPct: number;
  notes?: string;
  presetGroup?: string;
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
}

export interface Plan {
  id: string;
  name: string;
  createdAt: string;
  updatedAt: string;
  baseline: Baseline;
  events: CashflowEvent[];
  mortgages: Mortgage[];
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
  netWorth: number;                    // cash + investments - mortgageBalance
  runwayMonths: number;
  flags: string[];
}
