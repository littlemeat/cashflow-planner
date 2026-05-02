// Zustand store for the cashflow planner plan
import { create } from "zustand";
import { v4 as uuidv4 } from "uuid";
import { Plan, Baseline, CashflowEvent, Mortgage, MonthlySnapshot } from "../types";
import { SEED_PLAN } from "../lib/seedData";
import { simulate } from "../lib/simulate";
import { dateToMonthOffset, monthOffsetToDate } from "../lib/formatters";

const MAX_HISTORY = 20;

// Rebase all month offsets in events and mortgages when startDate changes,
// so that absolute calendar dates stay the same.
function rebaseOffsets(plan: Plan, oldStartDate: string, newStartDate: string): Plan {
  if (oldStartDate === newStartDate) return plan;

  function rebase(offset: number): number {
    const abs = monthOffsetToDate(offset, oldStartDate);
    return dateToMonthOffset(abs, newStartDate);
  }

  const events = plan.events.map((e) => ({
    ...e,
    startMonth: rebase(e.startMonth),
    endMonth: e.endMonth !== null ? rebase(e.endMonth) : null,
  }));

  const mortgages = plan.mortgages.map((m) => ({
    ...m,
    startMonth: rebase(m.startMonth),
    extraPayments: m.extraPayments
      ? m.extraPayments.map((ep) => ({ ...ep, month: rebase(ep.month) }))
      : undefined,
    // rateSchedule.fromMonth is relative to mortgage start, not plan start — leave untouched
  }));

  return { ...plan, events, mortgages };
}

// Migrate old single extraPayment to extraPayments array
function migratePlan(raw: unknown): Plan {
  const plan = raw as Plan & { mortgages: Array<Record<string, unknown>> };
  return {
    ...plan,
    mortgages: plan.mortgages.map((m) => {
      const legacy = m as unknown as Record<string, unknown>;
      if (legacy["extraPayment"] && !legacy["extraPayments"]) {
        const { extraPayment, ...rest } = legacy;
        return {
          ...rest,
          extraPayments: [{ id: uuidv4(), ...(extraPayment as object) }],
        } as unknown as Mortgage;
      }
      return m as unknown as Mortgage;
    }),
  };
}

const STORAGE_KEY = "cashflow-planner-plan";

function loadFromStorage(): Plan | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    return migratePlan(JSON.parse(raw));
  } catch {
    return null;
  }
}

function saveToStorage(plan: Plan): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(plan));
  } catch {
    // Ignore storage errors
  }
}

function createSeedPlan(): Plan {
  const now = new Date().toISOString();
  return {
    ...SEED_PLAN,
    id: uuidv4(),
    createdAt: now,
    updatedAt: now,
  };
}

function touchPlan(plan: Plan): Plan {
  return { ...plan, updatedAt: new Date().toISOString() };
}

interface PlanStore {
  plan: Plan;
  snapshots: MonthlySnapshot[];
  history: Plan[];
  // Actions
  undo: () => void;
  setBaseline: (baseline: Baseline) => void;
  addEvent: (event: Omit<CashflowEvent, "id">) => void;
  updateEvent: (id: string, event: Partial<CashflowEvent>) => void;
  deleteEvent: (id: string) => void;
  addMortgage: (mortgage: Omit<Mortgage, "id">) => void;
  updateMortgage: (id: string, mortgage: Partial<Mortgage>) => void;
  deleteMortgage: (id: string) => void;
  importPlan: (plan: Plan) => void;
  resetToSeed: () => void;
  reorderEvents: (orderedIds: string[]) => void;
}

function pushHistory(state: { history: Plan[]; plan: Plan }): Plan[] {
  return [...state.history.slice(-(MAX_HISTORY - 1)), state.plan];
}

const initialPlan = loadFromStorage() ?? (() => {
  const seed = createSeedPlan();
  saveToStorage(seed);
  return seed;
})();

export const usePlanStore = create<PlanStore>()((set) => ({
  plan: initialPlan,
  snapshots: simulate(initialPlan),
  history: [],

  undo: () =>
    set((state) => {
      if (state.history.length === 0) return state;
      const previous = state.history[state.history.length - 1]!;
      saveToStorage(previous);
      return {
        plan: previous,
        snapshots: simulate(previous),
        history: state.history.slice(0, -1),
      };
    }),

  setBaseline: (baseline) =>
    set((state) => {
      const oldStartDate = state.plan.baseline.startDate;
      const rebased = rebaseOffsets({ ...state.plan, baseline }, oldStartDate, baseline.startDate);
      const updated = touchPlan(rebased);
      saveToStorage(updated);
      return { plan: updated, snapshots: simulate(updated), history: pushHistory(state) };
    }),

  addEvent: (eventData) =>
    set((state) => {
      const newEvent: CashflowEvent = { ...eventData, id: uuidv4() };
      const updated = touchPlan({ ...state.plan, events: [...state.plan.events, newEvent] });
      saveToStorage(updated);
      return { plan: updated, snapshots: simulate(updated), history: pushHistory(state) };
    }),

  updateEvent: (id, eventData) =>
    set((state) => {
      const updated = touchPlan({
        ...state.plan,
        events: state.plan.events.map((e) => (e.id === id ? { ...e, ...eventData } : e)),
      });
      saveToStorage(updated);
      return { plan: updated, snapshots: simulate(updated), history: pushHistory(state) };
    }),

  deleteEvent: (id) =>
    set((state) => {
      const updated = touchPlan({
        ...state.plan,
        events: state.plan.events.filter((e) => e.id !== id),
      });
      saveToStorage(updated);
      return { plan: updated, snapshots: simulate(updated), history: pushHistory(state) };
    }),

  addMortgage: (mortgageData) =>
    set((state) => {
      const newMortgage: Mortgage = { ...mortgageData, id: uuidv4() };
      const updated = touchPlan({ ...state.plan, mortgages: [...state.plan.mortgages, newMortgage] });
      saveToStorage(updated);
      return { plan: updated, snapshots: simulate(updated), history: pushHistory(state) };
    }),

  updateMortgage: (id, mortgageData) =>
    set((state) => {
      const updated = touchPlan({
        ...state.plan,
        mortgages: state.plan.mortgages.map((m) => (m.id === id ? { ...m, ...mortgageData } : m)),
      });
      saveToStorage(updated);
      return { plan: updated, snapshots: simulate(updated), history: pushHistory(state) };
    }),

  deleteMortgage: (id) =>
    set((state) => {
      const updated = touchPlan({
        ...state.plan,
        mortgages: state.plan.mortgages.filter((m) => m.id !== id),
      });
      saveToStorage(updated);
      return { plan: updated, snapshots: simulate(updated), history: pushHistory(state) };
    }),

  importPlan: (plan) =>
    set(() => {
      saveToStorage(plan);
      return { plan, snapshots: simulate(plan), history: [] };
    }),

  resetToSeed: () =>
    set(() => {
      const seed = createSeedPlan();
      saveToStorage(seed);
      return { plan: seed, snapshots: simulate(seed), history: [] };
    }),

  reorderEvents: (orderedIds) =>
    set((state) => {
      const idToEvent = new Map(state.plan.events.map((e) => [e.id, e]));
      const reordered = orderedIds
        .map((id) => idToEvent.get(id))
        .filter((e): e is CashflowEvent => e !== undefined);
      const updated = touchPlan({ ...state.plan, events: reordered });
      saveToStorage(updated);
      return { plan: updated, snapshots: simulate(updated), history: pushHistory(state) };
    }),
}));
