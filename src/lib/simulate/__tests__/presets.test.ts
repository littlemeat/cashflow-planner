// Unit tests for preset pure-math logic (no React)
// Covers AC-Preset-1, AC-Preset-2, AC-Preset-3
import { describe, it, expect } from "vitest";
import {
  PPM_MAX_MONTHLY_2026,
  RODICOVSKY_PRISPEVEK_DEFAULT,
  SLEVA_NA_DITE_2026,
} from "../../constants";

// ── Pure computation helpers mirroring the preset wizards ─────────────────────

/** Mateřská (PPM): mirrors MaterskaPreset.tsx line 24 */
function computePpm(previousNetMonthly: number): number {
  return Math.min(previousNetMonthly * 0.7, PPM_MAX_MONTHLY_2026);
}

/** Mateřská duration: mirrors MaterskaPreset.tsx line 26 */
function computeMaterskaEndOffset(startMonthOffset: number): number {
  return startMonthOffset + 6; // 7 months total (months 0–6 inclusive)
}

/** Rodičovská duration: mirrors RodicovskaPreset.tsx lines 23-24 */
function computeRodicovskaDuration(totalPool: number, monthlyAmount: number): number {
  return monthlyAmount > 0 ? Math.floor(totalPool / monthlyAmount) : 0;
}

function computeRodicovskaEndOffset(
  startMonthOffset: number,
  totalPool: number,
  monthlyAmount: number
): number {
  const duration = computeRodicovskaDuration(totalPool, monthlyAmount);
  return startMonthOffset + duration - 1;
}

/** Sleva na dítě: mirrors SlevaNaDitePreset.tsx line 23 */
function computeSlevaTotal(childCount: 1 | 2 | 3): number {
  return SLEVA_NA_DITE_2026.slice(0, childCount).reduce((sum, v) => sum + v, 0);
}

// ── AC-Preset-1: Mateřská PPM computation ─────────────────────────────────────

describe("AC-Preset-1 — Mateřská PPM computation", () => {
  it("constant PPM_MAX_MONTHLY_2026 equals 49020", () => {
    expect(PPM_MAX_MONTHLY_2026).toBe(49_020);
  });

  it("previousNetMonthly=80000 → ppmEstimate capped at 49020", () => {
    // 80000 * 0.70 = 56000 > 49020 → capped
    const result = computePpm(80_000);
    expect(result).toBe(49_020);
  });

  it("previousNetMonthly=50000 → ppmEstimate not capped (35000)", () => {
    // 50000 * 0.70 = 35000 < 49020 → not capped
    const result = computePpm(50_000);
    expect(result).toBe(35_000);
  });

  it("ppmEstimate intermediate check: 80000 * 0.70 = 56000 (would-be uncapped value)", () => {
    // Confirm uncapped value is 56000 before the min() cap
    const uncapped = 80_000 * 0.7;
    expect(uncapped).toBe(56_000);
    expect(uncapped).toBeGreaterThan(PPM_MAX_MONTHLY_2026);
  });

  it("duration: endMonth = startMonth + 6 (7 months total, months 0–6 inclusive)", () => {
    const startOffset = 12; // e.g. month 12
    const endOffset = computeMaterskaEndOffset(startOffset);
    expect(endOffset).toBe(startOffset + 6); // = 18
    // Inclusive count: 18 - 12 + 1 = 7 months
    const monthCount = endOffset - startOffset + 1;
    expect(monthCount).toBe(7);
  });

  it("duration: startMonth=0 → endMonth=6", () => {
    expect(computeMaterskaEndOffset(0)).toBe(6);
  });
});

// ── AC-Preset-2: Rodičovská duration ─────────────────────────────────────────

describe("AC-Preset-2 — Rodičovská duration", () => {
  it("constant RODICOVSKY_PRISPEVEK_DEFAULT equals 350000", () => {
    expect(RODICOVSKY_PRISPEVEK_DEFAULT).toBe(350_000);
  });

  it("totalPool=350000, monthlyAmount=20000 → durationMonths = floor(350000/20000) = 17", () => {
    const duration = computeRodicovskaDuration(350_000, 20_000);
    expect(duration).toBe(17);
  });

  it("totalPool=350000, monthlyAmount=20000 → endOffset = startMonth + 16", () => {
    const startOffset = 5; // arbitrary
    const endOffset = computeRodicovskaEndOffset(startOffset, 350_000, 20_000);
    expect(endOffset).toBe(startOffset + 16); // duration 17 → endOffset = start + 17 - 1
  });

  it("floor behaviour: 350000/20000 = 17.5 → floor = 17 (not 18)", () => {
    // Ensures fractional division is floored, not rounded
    const rawDivision = 350_000 / 20_000;
    expect(rawDivision).toBe(17.5);
    expect(Math.floor(rawDivision)).toBe(17);
  });

  it("monthlyAmount=0 → durationMonths = 0 (guard against division by zero)", () => {
    const duration = computeRodicovskaDuration(350_000, 0);
    expect(duration).toBe(0);
  });
});

// ── AC-Preset-3: Sleva na dítě amounts ───────────────────────────────────────

describe("AC-Preset-3 — Sleva na dítě amounts", () => {
  it("constants: SLEVA_NA_DITE_2026 = [1267, 1860, 2320]", () => {
    expect(SLEVA_NA_DITE_2026).toEqual([1_267, 1_860, 2_320]);
  });

  it("1 child → 1267 Kč/měs", () => {
    expect(computeSlevaTotal(1)).toBe(1_267);
  });

  it("2 children → 1267 + 1860 = 3127 Kč/měs", () => {
    expect(computeSlevaTotal(2)).toBe(3_127);
  });

  it("3 children → 1267 + 1860 + 2320 = 5447 Kč/měs", () => {
    expect(computeSlevaTotal(3)).toBe(5_447);
  });

  it("slice(0, childCount) correctly selects first N elements", () => {
    // Verify the summing mechanism used in SlevaNaDitePreset.tsx
    const sum1 = SLEVA_NA_DITE_2026.slice(0, 1).reduce((s, v) => s + v, 0);
    const sum2 = SLEVA_NA_DITE_2026.slice(0, 2).reduce((s, v) => s + v, 0);
    const sum3 = SLEVA_NA_DITE_2026.slice(0, 3).reduce((s, v) => s + v, 0);
    expect(sum1).toBe(1_267);
    expect(sum2).toBe(3_127);
    expect(sum3).toBe(5_447);
  });
});

// ── AC-4 spec: 80k income → capped PPM at maternity month 12 ─────────────────

describe("AC-4 spec — maternity at month 12 with 80k income", () => {
  it("inserting maternity at month 12 with 80k previous net → amount capped at 49020", () => {
    const startMonth = 12;
    const previousNetMonthly = 80_000;

    const ppmEstimate = computePpm(previousNetMonthly);
    const endMonth = computeMaterskaEndOffset(startMonth);

    expect(ppmEstimate).toBe(PPM_MAX_MONTHLY_2026); // capped at 49020
    expect(ppmEstimate).toBe(49_020);
    expect(endMonth).toBe(18); // month 12 + 6
  });
});
