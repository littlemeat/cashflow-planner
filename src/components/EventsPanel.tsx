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
import { CollapsiblePanel } from "./CollapsiblePanel";
import { InfoTooltip } from "./InfoTooltip";
import {
  formatCZK,
  formatFrequency,
  formatCategory,
  formatYearMonth,
  addMonths,
} from "../lib/formatters";

type SortField = "name" | "category" | "startMonth" | "amount";
type SortDir = "asc" | "desc";

function EyeIcon({ hidden }: { hidden?: boolean }) {
  return hidden ? (
    <svg viewBox="0 0 20 20" fill="currentColor" width="14" height="14" aria-hidden>
      <path fillRule="evenodd" d="M3.707 2.293a1 1 0 00-1.414 1.414l14 14a1 1 0 001.414-1.414l-1.473-1.473A10.014 10.014 0 0019.542 10C18.268 5.943 14.478 3 10 3a9.958 9.958 0 00-4.512 1.074l-1.78-1.781zm4.261 4.26l1.514 1.515a2.003 2.003 0 012.45 2.45l1.514 1.514a4 4 0 00-5.478-5.478z" clipRule="evenodd" />
      <path d="M12.454 16.697L9.75 13.992a4 4 0 01-3.742-3.741L2.335 6.578A9.98 9.98 0 00.458 10c1.274 4.057 5.064 7 9.542 7 .847 0 1.669-.105 2.454-.303z" />
    </svg>
  ) : (
    <svg viewBox="0 0 20 20" fill="currentColor" width="14" height="14" aria-hidden>
      <path d="M10 12a2 2 0 100-4 2 2 0 000 4z" />
      <path fillRule="evenodd" d="M.458 10C1.732 5.943 5.522 3 10 3s8.268 2.943 9.542 7c-1.274 4.057-5.064 7-9.542 7S1.732 14.057.458 10zM14 10a4 4 0 11-8 0 4 4 0 018 0z" clipRule="evenodd" />
    </svg>
  );
}

export function EventsPanel() {
  const { plan, addEvent, updateEvent, deleteEvent, reorderEvents, deletePresetGroup } = usePlanStore();
  const [showForm, setShowForm] = useState(false);
  const [editingEvent, setEditingEvent] = useState<CashflowEvent | null>(null);
  const [sortField, setSortField] = useState<SortField | null>(null); // null = stored order
  const [sortDir, setSortDir] = useState<SortDir>("asc");

  const startDate = plan.baseline.startDate;

  // Compute preset groups that have 2+ events — these show the "Smazat preset" button
  const presetGroupCounts = new Map<string, number>();
  for (const evt of plan.events) {
    if (evt.presetGroup) {
      presetGroupCounts.set(evt.presetGroup, (presetGroupCounts.get(evt.presetGroup) ?? 0) + 1);
    }
  }

  function handleDeletePresetGroup(groupId: string) {
    if (window.confirm("Smazat všechny události tohoto presetu?")) {
      deletePresetGroup(groupId);
    }
  }

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

  const headerRight = (
    <>
      <PresetPicker />
      <button
        onClick={() => setShowForm(true)}
        className="bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium rounded-lg px-4 py-2 transition-colors"
      >
        + Přidat položku
      </button>
    </>
  );

  return (
    <CollapsiblePanel title="Příjmy a výdaje" headerRight={headerRight}>
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
                        onToggleHidden={() => updateEvent(event.id, { hidden: !event.hidden })}
                        onDeletePreset={
                          event.presetGroup && (presetGroupCounts.get(event.presetGroup) ?? 0) >= 2
                            ? () => handleDeletePresetGroup(event.presetGroup!)
                            : undefined
                        }
                      />
                    ))}
                  </tbody>
                </SortableContext>
              </table>
            </div>
          </DndContext>
        )}

        {showForm && <EventForm onSave={handleAdd} onCancel={() => setShowForm(false)} horizonMonths={plan.baseline.horizonYears * 12} />}
        {editingEvent && (
          <EventForm initial={editingEvent} onSave={handleUpdate} onCancel={() => setEditingEvent(null)} horizonMonths={plan.baseline.horizonYears * 12} />
        )}
      </>
    </CollapsiblePanel>
  );
}

// ── Sortable row ──────────────────────────────────────────────────────────────

interface SortableEventRowProps {
  event: CashflowEvent;
  startDate: string;
  onEdit: () => void;
  onDelete: () => void;
  onToggleHidden: () => void;
  onDeletePreset?: () => void;
}

function SortableEventRow({ event, startDate, onEdit, onDelete, onToggleHidden, onDeletePreset }: SortableEventRowProps) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } =
    useSortable({ id: event.id });

  const style: React.CSSProperties = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.4 : event.hidden ? 0.4 : 1,
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
            <span className="ml-1 flex-shrink-0">
              <InfoTooltip text={event.notes} width="w-56" />
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
        {(() => {
          const schedule = event.growthSchedule;
          if (!schedule || schedule.length === 0) return "—";
          const firstRate = schedule[0]!.rateAnnual;
          if (schedule.length === 1) {
            return firstRate !== 0 ? `${(firstRate * 100).toFixed(1)} % p.a.` : "—";
          }
          return firstRate !== 0
            ? `${(firstRate * 100).toFixed(1)} % → více sazeb`
            : `0 % → více sazeb`;
        })()}
      </td>
      <td className="px-3 py-2">
        <div className="flex gap-2 flex-wrap items-center">
          <button
            onClick={onToggleHidden}
            title={event.hidden ? "Zobrazit v simulaci" : "Skrýt ze simulace"}
            className={`flex items-center ${event.hidden ? "text-gray-300 hover:text-gray-500" : "text-gray-400 hover:text-gray-600"}`}
          >
            <EyeIcon hidden={event.hidden} />
          </button>
          <button onClick={onEdit} className="text-blue-500 hover:text-blue-700 text-xs font-medium">Upravit</button>
          <button onClick={onDelete} className="text-red-400 hover:text-red-600 text-xs font-medium">Smazat</button>
          {onDeletePreset && (
            <button onClick={onDeletePreset} className="text-orange-400 hover:text-orange-600 text-xs font-medium">Smazat preset</button>
          )}
        </div>
      </td>
    </tr>
  );
}
