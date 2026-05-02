// Unit tests for Phase 1 acceptance criteria
import { describe, it, expect } from "vitest";
import { formatCZK } from "./formatters";
import { SEED_PLAN } from "./seedData";

describe("formatCZK", () => {
  it("formats 1234567 as '1\u00a0234\u00a0567 Kč'", () => {
    expect(formatCZK(1234567)).toBe("1\u00a0234\u00a0567 Kč");
  });

  it("formats 0 as '0.00 Kč' (small amount path)", () => {
    expect(formatCZK(0)).toBe("0.00 Kč");
  });

  it("formats 100000 correctly", () => {
    expect(formatCZK(100000)).toBe("100\u00a0000 Kč");
  });
});

describe("Seed data integrity", () => {
  it("has exactly 6 events", () => {
    expect(SEED_PLAN.events).toHaveLength(6);
  });

  it("has exactly 1 mortgage", () => {
    expect(SEED_PLAN.mortgages).toHaveLength(1);
  });

  it("seed mortgage has exactly 2 rate schedule entries", () => {
    const mortgage = SEED_PLAN.mortgages[0];
    expect(mortgage).toBeDefined();
    expect(mortgage!.rateSchedule).toHaveLength(2);
  });

  it("seed mortgage first rate entry is 4.5% from month 0", () => {
    const entry = SEED_PLAN.mortgages[0]!.rateSchedule[0];
    expect(entry).toMatchObject({ fromMonth: 0, rateAnnual: 0.045 });
  });

  it("seed mortgage second rate entry is 3.5% from month 60", () => {
    const entry = SEED_PLAN.mortgages[0]!.rateSchedule[1];
    expect(entry).toMatchObject({ fromMonth: 60, rateAnnual: 0.035 });
  });
});
