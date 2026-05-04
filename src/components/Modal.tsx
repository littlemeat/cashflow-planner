import { useRef } from "react";

interface ModalProps {
  onClose: () => void;
  children: React.ReactNode;
  /** Optional max-width class, defaults to "max-w-md" */
  maxWidth?: string;
}

export function Modal({ onClose, children, maxWidth = "max-w-md" }: ModalProps) {
  const mouseDownTarget = useRef<EventTarget | null>(null);

  return (
    <div
      className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4"
      onMouseDown={(e) => { mouseDownTarget.current = e.target; }}
      onClick={(e) => {
        if (e.target === e.currentTarget && mouseDownTarget.current === e.currentTarget) onClose();
      }}
    >
      <div className={`bg-white rounded-2xl shadow-xl w-full ${maxWidth} p-6 space-y-4`}>
        {children}
      </div>
    </div>
  );
}
