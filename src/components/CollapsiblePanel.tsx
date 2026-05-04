import { useState } from "react";

interface CollapsiblePanelProps {
  title: string;
  defaultOpen?: boolean;
  headerRight?: React.ReactNode; // slot for buttons next to the title (e.g. "+ Přidat")
  children: React.ReactNode;
}

export function CollapsiblePanel({ title, defaultOpen = true, headerRight, children }: CollapsiblePanelProps) {
  const [collapsed, setCollapsed] = useState(!defaultOpen);

  return (
    <div className="bg-white rounded-xl shadow p-5 space-y-4">
      <div className="flex items-center justify-between">
        <button
          onClick={() => setCollapsed((c) => !c)}
          aria-expanded={!collapsed}
          className="flex items-center gap-2 text-lg font-semibold text-gray-800 hover:text-blue-600 transition-colors"
        >
          <svg
            className={`w-4 h-4 transition-transform ${collapsed ? "-rotate-90" : ""}`}
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
          >
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
          </svg>
          {title}
        </button>
        {!collapsed && headerRight && (
          <div className="flex items-center gap-2">{headerRight}</div>
        )}
      </div>
      {!collapsed && <div>{children}</div>}
    </div>
  );
}
