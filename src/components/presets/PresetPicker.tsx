// PresetPicker — dropdown button listing all preset macros
import { useState, useRef, useEffect } from "react";
import { MaterskaPreset } from "./MaterskaPreset";
import { RodicovskaPreset } from "./RodicovskaPreset";
import { SlevaNaDitePreset } from "./SlevaNaDitePreset";
import { ZvyseniPlatuPreset } from "./ZvyseniPlatuPreset";
import { InflacniSkok } from "./InflacniSkok";
import { NavratDoPrice } from "./NavratDoPrice";

type PresetId = "materska" | "rodicovskaPreset" | "slevaNaDite" | "zvyseniPlatu" | "inflacniSkok" | "navratDoPrice";

interface PresetOption {
  id: PresetId;
  label: string;
  description: string;
}

const PRESETS: PresetOption[] = [
  {
    id: "materska",
    label: "Mateřská (PPM)",
    description: "Peněžitá pomoc v mateřství — 70 % příjmu, max 49 020 Kč/měs.",
  },
  {
    id: "rodicovskaPreset",
    label: "Rodičovská",
    description: "Rodičovský příspěvek — celkem 350 000 Kč, dle zvoleného čerpání.",
  },
  {
    id: "slevaNaDite",
    label: "Sleva na dítě",
    description: "Daňová sleva dle ZDP §35c — 2026 hodnoty pro 1–3+ děti.",
  },
  {
    id: "zvyseniPlatu",
    label: "Zvýšení platu",
    description: "Ukončí stávající příjem a přidá nový se zvýšenou částkou.",
  },
  {
    id: "inflacniSkok",
    label: "Inflační skok",
    description: "Změní míru růstu vybraných výdajů od zvoleného data.",
  },
  {
    id: "navratDoPrice",
    label: "Návrat do práce",
    description: "Přidá nový příjem po návratu a volitelně ukončí stávající.",
  },
];

export function PresetPicker() {
  const [open, setOpen] = useState(false);
  const [activePreset, setActivePreset] = useState<PresetId | null>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Close dropdown when clicking outside
  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    if (open) {
      document.addEventListener("mousedown", handleClickOutside);
    }
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [open]);

  function openPreset(id: PresetId) {
    setOpen(false);
    setActivePreset(id);
  }

  function closePreset() {
    setActivePreset(null);
  }

  return (
    <>
      <div className="relative" ref={dropdownRef}>
        <button
          onClick={() => setOpen((v) => !v)}
          className="bg-violet-600 hover:bg-violet-700 text-white text-sm font-medium rounded-lg px-4 py-2 transition-colors flex items-center gap-1.5"
        >
          <span>Přidat preset</span>
          <svg
            className={`w-3.5 h-3.5 transition-transform ${open ? "rotate-180" : ""}`}
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
          </svg>
        </button>

        {open && (
          <div className="absolute right-0 mt-2 w-72 bg-white border border-gray-200 rounded-xl shadow-lg z-40 py-1 overflow-hidden">
            {PRESETS.map((preset) => (
              <button
                key={preset.id}
                onClick={() => openPreset(preset.id)}
                className="w-full text-left px-4 py-3 hover:bg-violet-50 transition-colors"
              >
                <p className="text-sm font-medium text-gray-800">{preset.label}</p>
                <p className="text-xs text-gray-500 mt-0.5">{preset.description}</p>
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Wizard modals */}
      {activePreset === "materska" && <MaterskaPreset onClose={closePreset} />}
      {activePreset === "rodicovskaPreset" && <RodicovskaPreset onClose={closePreset} />}
      {activePreset === "slevaNaDite" && <SlevaNaDitePreset onClose={closePreset} />}
      {activePreset === "zvyseniPlatu" && <ZvyseniPlatuPreset onClose={closePreset} />}
      {activePreset === "inflacniSkok" && <InflacniSkok onClose={closePreset} />}
      {activePreset === "navratDoPrice" && <NavratDoPrice onClose={closePreset} />}
    </>
  );
}
