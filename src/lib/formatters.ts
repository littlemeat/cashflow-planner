// Formatting utilities for CZK amounts and dates

/**
 * Format a number as CZK with space thousand separator, no decimals for amounts >= 100.
 * Example: 1234567 → "1 234 567 Kč"
 */
export function formatCZK(amount: number): string {
  if (Math.abs(amount) >= 100) {
    const rounded = Math.round(amount);
    const formatted = rounded
      .toString()
      .replace(/\B(?=(\d{3})+(?!\d))/g, "\u00a0"); // non-breaking space
    return `${formatted} Kč`;
  }
  // For small amounts, show 2 decimals
  return `${amount.toFixed(2).replace(/\B(?=(\d{3})+(?!\d))/g, "\u00a0")} Kč`;
}

/**
 * Format a "YYYY-MM" string as "RRRR/MM" (Czech rok/měsíc style).
 * Example: "2026-09" → "2026/09"
 */
export function formatYearMonth(isoYearMonth: string): string {
  return isoYearMonth.replace("-", "/");
}

/**
 * Add a number of months to a "YYYY-MM" string.
 * Example: addMonths("2026-09", 3) → "2026-12"
 */
export function addMonths(isoYearMonth: string, months: number): string {
  const parts = isoYearMonth.split("-");
  const year = parts[0];
  const month = parts[1];
  if (!year || !month || isNaN(Number(year)) || isNaN(Number(month))) {
    return "neplatné datum";
  }
  const date = new Date(Number(year), Number(month) - 1, 1);
  date.setMonth(date.getMonth() + months);
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  return `${y}-${m}`;
}

/**
 * Format a percentage for display.
 * Example: 0.045 → "4,5 %"
 */
export function formatPercent(value: number): string {
  return `${(value * 100).toLocaleString("cs-CZ", { maximumFractionDigits: 2 })} %`;
}

/**
 * Format frequency type to Czech label.
 */
export function formatFrequency(frequency: string): string {
  switch (frequency) {
    case "monthly":
      return "Měsíčně";
    case "yearly":
      return "Ročně";
    case "one-off":
      return "Jednorázově";
    default:
      return frequency;
  }
}

/**
 * Format category to Czech label.
 */
export function formatCategory(category: string): string {
  switch (category) {
    case "income":
      return "Příjem";
    case "expense":
      return "Výdaj";
    default:
      return category;
  }
}

/**
 * Convert "YYYY-MM" to offset (number of months) from baseline startDate.
 * Example: dateToMonthOffset("2027-06", "2026-06") → 12
 */
export function dateToMonthOffset(date: string, startDate: string): number {
  const [y1, m1] = startDate.split("-").map(Number);
  const [y2, m2] = date.split("-").map(Number);
  if (!y1 || !m1 || !y2 || !m2) return 0;
  return (y2 - y1) * 12 + (m2 - m1);
}

/**
 * Convert a month offset from baseline startDate to "YYYY-MM".
 * Example: monthOffsetToDate(12, "2026-06") → "2027-06"
 */
export function monthOffsetToDate(offset: number, startDate: string): string {
  const [y, m] = startDate.split("-").map(Number);
  if (!y || !m) return startDate;
  const date = new Date(y, m - 1 + offset);
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;
}

/**
 * Compute annuity monthly payment for a mortgage.
 * @param principal - loan amount
 * @param annualRate - annual interest rate (e.g. 0.045)
 * @param termMonths - number of months
 */
export function computeMonthlyPayment(
  principal: number,
  annualRate: number,
  termMonths: number
): number {
  if (annualRate === 0) {
    return principal / termMonths;
  }
  const r = annualRate / 12;
  return (principal * r * Math.pow(1 + r, termMonths)) / (Math.pow(1 + r, termMonths) - 1);
}
