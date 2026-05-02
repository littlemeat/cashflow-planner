// Events CRUD panel with sortable table and collapsible preset groups
import { useState, useMemo } from "react";
import { usePlanStore } from "../store/usePlanStore";
import { CashflowEvent } from "../types";
import { EventForm } from "./EventForm";
import { PresetPicker } from "./presets/PresetPicker";
import {
  formatCZK,
  formatFrequency,
  formatCategory,
  formatYearMonth,
  addMonths,
} from "../lib/formatters";

type SortField = "name" | "category" | "startMonth" | "amount";
type SortDir = "asc" | "desc";

const GROUP_COLORS = [
  "bg-violet-400",
  "bg-emerald-400",
  "bg-amber-400",
  "bg-sky-400",
  "bg-rose-400",
  "bg-fuchsia-400",
];

export function EventsPanel() {
  const { plan, addEvent, updateEvent, deleteEvent } = usePlanStore();
  const [showForm, setShowForm] = useState(false);
  const [editingEvent, setEditingEvent] = useState<CashflowEvent | null>(null);
  const [sortField, setSortField] = useState<SortField>("startMonth");
  const [sortDir, setSortDir] = useState<SortDir>("asc");
  const [collapsedGroups, setCollapsedGroups] = useState<Set<string>>(new Set());

  const startDate = plan.baseline.startDate;

  function handleSort(field: SortField) {
    if (sortField === field) setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    else { setSortField(field); setSortDir("asc"); }
  }

  function toggleGroup(groupId: string) {
    setCollapsedGroups((prev) => {
      const next = new Set(prev);
      if (next.has(groupId)) next.delete(groupId);
      else next.add(groupId);
      return next;
    });
  }

  function handleDeleteGroup(_groupId: string, events: CashflowEvent[]) {
    if (window.confirm(`Smazat celou skupinu (${events.length} položek)?`)) {
      events.forEach((e) => deleteEvent(e.id));
    }
  }

  const sortedEvents = [...plan.events].sort((a, b) => {
    let cmp = 0;
    if (sortField === "name") cmp = a.name.localeCompare(b.name, "cs");
    else if (sortField === "category") cmp = a.category.localeCompare(b.category);
    else if (sortField === "startMonth") cmp = a.startMonth - b.startMonth;
    else if (sortField === "amount") cmp = a.amount - b.amount;
    return sortDir === "asc" ? cmp : -cmp;
  });

  function handleAdd(data: Omit<CashflowEvent, "id">) {
    addEvent(data);
    setShowForm(false);
  }

  function handleUpdate(data: Omit<CashflowEvent, "id">) {
    if (editingEvent) {
      updateEvent(editingEvent.id, data);
      setEditingEvent(null);
    }
  }

  function handleDelete(id: string) {
    if (window.confirm("Opravdu smazat tuto položku?")) deleteEvent(id);
  }

  function SortIcon({ field }: { field: SortField }) {
    if (sortField !== field) return <span className="text-gray-300 ml-1">↕</span>;
    return <span className="ml-1">{sortDir === "asc" ? "↑" : "↓"}</span>;
  }

  function thClass(field: SortField) {
    return `px-3 py-2 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide cursor-pointer hover:text-gray-700 select-none ${
      sortField === field ? "text-blue-600" : ""
    }`;
  }

  // Build stable color map for preset groups
  const presetGroupColors = useMemo(() => {
    const map: Record<string, string> = {};
    let idx = 0;
    for (const ev of plan.events) {
      if (ev.presetGroup && !(ev.presetGroup in map)) {
        map[ev.presetGroup] = GROUP_COLORS[idx % GROUP_COLORS.length]!;
        idx++;
      }
    }
    return map;
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [plan.events]);

  // Separate ungrouped and grouped events
  const ungroupedEvents = sortedEvents.filter((e) => !e.presetGroup);
  const groupedEvents = sortedEvents.filter((e) => e.presetGroup);

  // Collect groups sorted by earliest startMonth
  const groupMap = new Map<string, CashflowEvent[]>();
  for (const ev of groupedEvents) {
    const gid = ev.presetGroup!;
    if (!groupMap.has(gid)) groupMap.set(gid, []);
    groupMap.get(gid)!.push(ev);
  }
  const sortedGroups = [...groupMap.entries()].sort(
    ([, a], [, b]) => Math.min(...a.map((e) => e.startMonth)) - Math.min(...b.map((e) => e.startMonth))
  );

  const COL_COUNT = 8;

  function EventRow({ event }: { event: CashflowEvent; indent?: boolean }) {
    return (
      <tr className="border-b border-gray-50 hover:bg-gray-50 transition-colors">
        <td className="px-3 py-2 font-medium text-gray-800">
          <span className="flex items-center gap-1.5">
            {event.presetGroup && (
              <span
                className={`inline-block w-2 h-2 rounded-full flex-shrink-0 ${presetGroupColors[event.presetGroup] ?? "bg-gray-400"}`}
              />
            )}
            {event.name}
            {event.notes && (
              <span className="ml-1 text-gray-400 text-xs" title={event.notes}>ℹ</span>
            )}
          </span>
        </td>
        <td className="px-3 py-2">
          <span className={`inline-block rounded-full px-2 py-0.5 text-xs font-medium ${
            event.category === "income" ? "bg-green-100 text-green-700" : "bg-red-100 text-red-700"
          }`}>
            {formatCategory(event.category)}
          </span>
        </td>
        <td className="px-3 py-2 text-right font-mono text-gray-700">{formatCZK(event.amount)}</td>
        <td className="px-3 py-2 text-gray-600">{formatFrequency(event.frequency)}</td>
        <td className="px-3 py-2 text-gray-600 whitespace-nowrap">
          {formatYearMonth(addMonths(startDate, event.startMonth))}
        </td>
        <td className="hidden sm:table-cell px-3 py-2 text-gray-600 whitespace-nowrap">
          {event.endMonth != null ? formatYearMonth(addMonths(startDate, event.endMonth)) : "—"}
        </td>
        <td className="hidden sm:table-cell px-3 py-2 text-gray-600">
          {event.annualGrowthPct !== 0 ? `${(event.annualGrowthPct * 100).toFixed(1)} %` : "—"}
        </td>
        <td className="px-3 py-2">
          <div className="flex gap-2">
            <button onClick={() => setEditingEvent(event)} className="text-blue-500 hover:text-blue-700 text-xs font-medium">Upravit</button>
            <button onClick={() => handleDelete(event.id)} className="text-red-400 hover:text-red-600 text-xs font-medium">Smazat</button>
          </div>
        </td>
      </tr>
    );
  }

  return (
    <div className="bg-white rounded-xl shadow p-5 space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold text-gray-800">Příjmy a výdaje</h2>
        <div className="flex items-center gap-2">
          <PresetPicker />
          <button
            onClick={() => setShowForm(true)}
            className="bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium rounded-lg px-4 py-2 transition-colors"
          >
            + Přidat položku
          </button>
        </div>
      </div>

      {plan.events.length === 0 ? (
        <p className="text-sm text-gray-400 text-center py-6">Žádné položky. Přidejte první.</p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-sm min-w-[480px]">
            <thead>
              <tr className="border-b border-gray-100">
                <th className={thClass("name")} onClick={() => handleSort("name")}>Název <SortIcon field="name" /></th>
                <th className={thClass("category")} onClick={() => handleSort("category")}>Kat. <SortIcon field="category" /></th>
                <th className={thClass("amount")} onClick={() => handleSort("amount")}>Částka <SortIcon field="amount" /></th>
                <th className="px-3 py-2 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide">Frekvence</th>
                <th className={thClass("startMonth")} onClick={() => handleSort("startMonth")}>Od <SortIcon field="startMonth" /></th>
                <th className="hidden sm:table-cell px-3 py-2 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide">Do</th>
                <th className="hidden sm:table-cell px-3 py-2 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide">Růst %</th>
                <th className="px-3 py-2 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide">Akce</th>
              </tr>
            </thead>
            <tbody>
              {/* Non-grouped events */}
              {ungroupedEvents.map((event) => (
                <EventRow key={event.id} event={event} />
              ))}

              {/* Grouped events with collapsible headers */}
              {sortedGroups.map(([groupId, events]) => {
                const color = presetGroupColors[groupId] ?? "bg-gray-400";
                const isCollapsed = collapsedGroups.has(groupId);
                const groupName = events[0]?.name ?? "Skupina";
                const earliestStart = Math.min(...events.map((e) => e.startMonth));
                const latestEnd = events.every((e) => e.endMonth === null)
                  ? null
                  : Math.max(...events.map((e) => e.endMonth ?? e.startMonth));

                return (
                  <>
                    {/* Group header row */}
                    <tr key={`group-${groupId}`} className="bg-gray-50 border-t border-gray-200">
                      <td colSpan={COL_COUNT} className="px-3 py-2">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className={`inline-block w-2.5 h-2.5 rounded-full flex-shrink-0 ${color}`} />
                          <span className="text-xs font-semibold text-gray-700">{groupName}</span>
                          <span className="text-xs text-gray-400">{events.length} položek</span>
                          <span className="text-xs text-gray-400">
                            {formatYearMonth(addMonths(startDate, earliestStart))}
                            {latestEnd !== null ? ` → ${formatYearMonth(addMonths(startDate, latestEnd))}` : " →"}
                          </span>
                          <div className="ml-auto flex items-center gap-3">
                            <button
                              onClick={() => handleDeleteGroup(groupId, events)}
                              className="text-xs text-red-400 hover:text-red-600"
                            >
                              Smazat skupinu
                            </button>
                            <button
                              onClick={() => toggleGroup(groupId)}
                              className="text-xs text-blue-500 hover:text-blue-700 font-medium"
                            >
                              {isCollapsed ? "▶ Zobrazit" : "▼ Skrýt"}
                            </button>
                          </div>
                        </div>
                      </td>
                    </tr>

                    {/* Group event rows (when expanded) */}
                    {!isCollapsed && events.map((event) => (
                      <EventRow key={event.id} event={event} />
                    ))}
                  </>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {showForm && <EventForm onSave={handleAdd} onCancel={() => setShowForm(false)} />}
      {editingEvent && (
        <EventForm initial={editingEvent} onSave={handleUpdate} onCancel={() => setEditingEvent(null)} />
      )}
    </div>
  );
}
