import { InfoTooltip } from "./InfoTooltip";

export interface KpiCardProps {
  label: string;
  value: string;
  color: string;
  bg: string;
  tooltip?: string;
  subtitle?: string;
}

export function KpiCard({ label, value, color, bg, tooltip, subtitle }: KpiCardProps) {
  return (
    <div className={`${bg} rounded-xl px-4 py-3 flex flex-col justify-between min-w-[130px] flex-1`}>
      <div className="flex items-center gap-1 mb-1">
        <p className="text-xs text-gray-500">{label}</p>
        {tooltip && <InfoTooltip text={tooltip} width="w-72" />}
      </div>
      <p className={`text-sm font-bold ${color}`}>{value}</p>
      {subtitle && <p className="text-[10px] text-gray-400 mt-0.5">{subtitle}</p>}
    </div>
  );
}
