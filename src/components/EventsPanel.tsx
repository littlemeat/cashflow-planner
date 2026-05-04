// Events CRUD panel with drag-and-drop ordering
import { useState } from "react";
import {
  DndContext,
  closestCenter,
  PointerSensor,
  KeyboardSensor,
  useSensor,
  useSensors,
  DragEndEvent,
} from "@dnd-kit/core";
import {
  SortableContext,
  sortableKeyboardCoordinates,
  verticalListSortingStrategy,
  useSortable,
  arrayMove,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
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

export function EventsPanel() {
  const { plan, addEvent, updateEvent, deleteEvent, reorderEvents } = usePlanStore();
  const [showForm, setShowForm] = useState(false);
  const [editingEvent, setEditingEvent] = useState<CashflowEvent | null>(null);
  const [sortField, setSortField] = useState<SortField | null>(null); // null = stored order
  const [sortDir, setSortDir] = useState<SortDir>("asc");
  const [collapsed, setCollapsed] = useState(false);

  const startDate = plan.baseline.startDate;

  const sensors = useSensors(
    useSensor(PointerSensor),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  );

  // null sortField → natural stored order; third click on same column resets to natural
  function handleSort(field: SortField) {
    if (sortField === field) {
      if (sortDir === "asc") setSortDir("desc");
      else { setSortField(null); setSortDir("asc"); }
    } else {
      setSortField(field);
      setSortDir("asc");
    }
  }

  const displayedEvents: CashflowEvent[] = sortField
    ? [...plan.events].sort((a, b) => {
        let cmp = 0;
        if (sortField === "name") cmp = a.name.localeCompare(b.name, "cs");
        else if (sortField === "category") cmp = a.category.localeCompare(b.category);
        else if (sortField === "startMonth") cmp = a.startMonth - b.startMonth;
        else if (sortField === "amount") cmp = a.amount - b.amount;
        return sortDir === "asc" ? cmp : -cmp;
      })
    : plan.events;

  function handleDragEnd(event: DragEndEvent) {
    const { active, over } = event;
    if (!over || active.id === over.id) return;
    const oldIndex = displayedEvents.findIndex((e) => e.id === active.id);
    const newIndex = displayedEvents.findIndex((e) => e.id === over.id);
    if (oldIndex === -1 || newIndex === -1) return;
    const reordered = arrayMove(displayedEvents, oldIndex, newIndex);
    reorderEvents(reordered.map((e) => e.id));
    setSortField(null); // switch back to natural order so result is visible
  }

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
    const active = sortField === field;
    return (
      <span className="inline-flex flex-col ml-1 gap-[1px]">
        <svg className={`w-2 h-2 ${active && sortDir === "asc" ? "text-blue-600" : "text-gray-300"}`} viewBox="0 0 8 5" fill="currentColor">
          <path d="M4 0L8 5H0z" />
        </svg>
        <svg className={`w-2 h-2 ${active && sortDir === "desc" ? "text-blue-600" : "text-gray-300"}`} viewBox="0 0 8 5" fill="currentColor">
          <path d="M4 5L0 0h8z" />
        </svg>
      </span>
    );
  }

  function thClass(field: SortField) {
    return `px-3 py-2 text-left text-xs font-semibold uppercase tracking-wide cursor-pointer hover:text-gray-700 select-none ${
      sortField === field ? "text-blue-600" : "text-gray-500"
    }`;
  }

  return (
    <div className="bg-white rounded-xl shadow p-5 space-y-4">
      <div className="flex items-center justify-between">
        <button
          onClick={() => setCollapsed((c) => !c)}
          aria-expanded={!collapsed}
          className="flex items-center gap-2 text-lg font-semibold text-gray-800 hover:text-blue-600 transition-colors"
        >
          <svg className={`w-4 h-4 transition-transform ${collapsed ? "-rotate-90" : ""}`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
          </svg>
          Příjmy a výdaje
        </button>
        {!collapsed && (
          <div className="flex items-center gap-2">
            <PresetPicker />
            <button
              onClick={() => setShowForm(true)}
              className="bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium rounded-lg px-4 py-2 transition-colors"
            >
              + Přidat položku
            </button>
          </div>
        )}
      </div>

      {!collapsed && (
        <>
          {plan.events.length === 0 ? (
            <p className="text-sm text-gray-400 text-center py-6">Žádné položky. Přidejte první.</p>
          ) : (
            <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
              <div className="overflow-x-auto">
                <table className="w-full text-sm min-w-[480px]">
                  <thead>
                    <tr className="border-b border-gray-100">
                      <th className="w-6 px-2 py-2" aria-label="Přetáhnout" />
                      <th className={thClass("name")} onClick={() => handleSort("name")}>Název <SortIcon field="name" /></th>
                      <th className={thClass("category")} onClick={() => handleSort("category")}>Kat. <SortIcon field="category" /></th>
                      <th className={thClass("amount")} onClick={() => handleSort("amount")}>Částka <SortIcon field="amount" /></th>
                      <th className="px-3 py-2 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide">Frekv.</th>
                      <th className={thClass("startMonth")} onClick={() => handleSort("startMonth")}>Od <SortIcon field="startMonth" /></th>
                      <th className="hidden sm:table-cell px-3 py-2 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide">Do</th>
                      <th className="hidden sm:table-cell px-3 py-2 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide">Růst %</th>
                      <th className="px-3 py-2 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide">Akce</th>
                    </tr>
                  </thead>
                  <SortableContext items={displayedEvents.map((e) => e.id)} strategy={verticalListSortingStrategy}>
                    <tbody>
                      {displayedEvents.map((event) => (
                        <SortableEventRow
                          key={event.id}
                          event={event}
                          startDate={startDate}
                          onEdit={() => setEditingEvent(event)}
                          onDelete={() => handleDelete(event.id)}
                        />
                      ))}
                    </tbody>
                  </SortableContext>
                </table>
              </div>
            </DndContext>
          )}

          {showForm && <EventForm onSave={handleAdd} onCancel={() => setShowForm(false)} />}
          {editingEvent && (
            <EventForm initial={editingEvent} onSave={handleUpdate} onCancel={() => setEditingEvent(null)} />
          )}
        </>
      )}
    </div>
  );
}

// ── Sortable row ──────────────────────────────────────────────────────────────

interface SortableEventRowProps {
  event: CashflowEvent;
  startDate: string;
  onEdit: () => void;
  onDelete: () => void;
}

function SortableEventRow({ event, startDate, onEdit, onDelete }: SortableEventRowProps) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } =
    useSortable({ id: event.id });

  const style: React.CSSProperties = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.4 : 1,
    zIndex: isDragging ? 10 : undefined,
  };

  return (
    <tr
      ref={setNodeRef}
      style={style}
      className="border-b border-gray-50 hover:bg-gray-50 transition-colors"
    >
      {/* Drag handle */}
      <td
        className="px-2 py-2 text-gray-300 hover:text-gray-500 cursor-grab active:cursor-grabbing"
        {...attributes}
        {...listeners}
        aria-label="Přetáhnout pro změnu pořadí"
      >
        <svg width="12" height="16" viewBox="0 0 12 16" fill="currentColor" aria-hidden>
          <circle cx="3" cy="3" r="1.5" />
          <circle cx="9" cy="3" r="1.5" />
          <circle cx="3" cy="8" r="1.5" />
          <circle cx="9" cy="8" r="1.5" />
          <circle cx="3" cy="13" r="1.5" />
          <circle cx="9" cy="13" r="1.5" />
        </svg>
      </td>

      <td className="px-3 py-2 font-medium text-gray-800">
        <span className="flex items-center gap-1.5">
          {event.name}
          {event.notes && (
            <span className="relative group ml-1 flex-shrink-0">
              <svg className="w-3.5 h-3.5 text-gray-400 cursor-help" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden>
                <circle cx="12" cy="12" r="10" strokeWidth="2" />
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 16v-4m0-4h.01" />
              </svg>
              <span className="pointer-events-none absolute bottom-full left-1/2 -translate-x-1/2 mb-2 w-56 rounded-lg bg-gray-800 text-white text-xs px-3 py-2 shadow-lg opacity-0 group-hover:opacity-100 transition-opacity z-50 whitespace-normal leading-relaxed">
                {event.notes}
                <span className="absolute top-full left-1/2 -translate-x-1/2 border-4 border-transparent border-t-gray-800" />
              </span>
            </span>
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
          <button onClick={onEdit} className="text-blue-500 hover:text-blue-700 text-xs font-medium">Upravit</button>
          <button onClick={onDelete} className="text-red-400 hover:text-red-600 text-xs font-medium">Smazat</button>
        </div>
      </td>
    </tr>
  );
}
