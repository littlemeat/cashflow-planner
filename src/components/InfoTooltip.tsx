interface InfoTooltipProps {
  text?: string;
  children?: React.ReactNode;
  /** Tooltip bubble width class, default "w-64" */
  width?: string;
  /** Position: "above-center" (default) or "above-left" */
  position?: "above-left" | "above-center";
}

export function InfoTooltip({ text, children, width = "w-64", position = "above-center" }: InfoTooltipProps) {
  const posClass = position === "above-left"
    ? "bottom-full right-0 mb-2"
    : "bottom-full left-1/2 -translate-x-1/2 mb-2";

  return (
    <div className="relative group inline-flex">
      <svg
        className="w-3.5 h-3.5 text-gray-400 cursor-help flex-shrink-0"
        fill="none"
        viewBox="0 0 24 24"
        stroke="currentColor"
        aria-hidden
      >
        <circle cx="12" cy="12" r="10" strokeWidth="2" />
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 16v-4m0-4h.01" />
      </svg>
      <div
        className={`pointer-events-none absolute ${posClass} ${width} rounded-lg bg-gray-800 text-white text-xs px-3 py-2 shadow-lg opacity-0 group-hover:opacity-100 transition-opacity z-50 whitespace-normal leading-relaxed`}
      >
        {children ?? text}
        <span className="absolute top-full left-1/2 -translate-x-1/2 border-4 border-transparent border-t-gray-800" />
      </div>
    </div>
  );
}
