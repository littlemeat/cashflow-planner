// Controlled text input that displays numbers with space thousand separators.
// Accepts a numeric `value` and calls `onChange(number)` with the parsed value.
import { useState } from "react";

interface AmountInputProps {
  id?: string;
  value: number;
  onChange: (value: number) => void;
  min?: number;
  max?: number;
  className?: string;
  placeholder?: string;
}

function formatWithSpaces(n: number): string {
  if (isNaN(n)) return "";
  return Math.round(n).toLocaleString("cs-CZ").replace(/\u00a0/g, " ").replace(/,/g, "");
  // cs-CZ uses non-breaking space as thousand sep — normalise to regular space
}

function parseAmount(s: string): number {
  const stripped = s.replace(/\s/g, "").replace(/,/g, ".");
  const n = parseFloat(stripped);
  return isNaN(n) ? 0 : n;
}

export function AmountInput({ id, value, onChange, min = 0, className = "", placeholder }: AmountInputProps) {
  const [raw, setRaw] = useState<string | null>(null); // null = show formatted value

  const displayValue = raw !== null ? raw : formatWithSpaces(value);

  return (
    <input
      id={id}
      type="text"
      inputMode="numeric"
      value={displayValue}
      placeholder={placeholder}
      className={className}
      onChange={(e) => {
        // Allow digits, spaces, dots, commas only
        const v = e.target.value.replace(/[^\d\s.,]/g, "");
        setRaw(v);
        onChange(parseAmount(v));
      }}
      onFocus={() => {
        // Show raw number on focus for easier editing
        setRaw(value === 0 ? "" : String(Math.round(value)));
      }}
      onBlur={() => {
        // Apply min constraint and reformat on blur
        let n = parseAmount(raw ?? "");
        if (min !== undefined && n < min) n = min;
        onChange(n);
        setRaw(null); // switch back to formatted display
      }}
    />
  );
}
