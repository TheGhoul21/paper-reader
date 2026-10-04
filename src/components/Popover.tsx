import { useEffect, useRef, useState, type ReactNode } from "react";

interface Props {
  anchor: { x: number; y: number };
  onClose: () => void;
  children: ReactNode;
  /** Extra class for per-use sizing (e.g. the glossary card is wider than a citation). */
  className?: string;
  label?: string;
}

/** Floating card at a click position, kept inside the viewport; closes on outside click or Escape. Scrolling keeps the definition readable. */
export default function Popover({
  anchor,
  onClose,
  children,
  className,
  label = "Dettagli",
}: Props) {
  const ref = useRef<HTMLDivElement>(null);
  const [pos, setPos] = useState(anchor);
  useEffect(() => {
    const trigger = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    const panel = ref.current;
    panel?.focus({ preventScroll: true });
    return () => {
      if (
        trigger?.isConnected &&
        (document.activeElement === document.body || panel?.contains(document.activeElement))
      )
        trigger.focus({ preventScroll: true });
    };
  }, []);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const { innerWidth, innerHeight } = window;
    const rect = el.getBoundingClientRect();
    const margin = 12;
    const x = Math.min(Math.max(anchor.x, margin), innerWidth - rect.width - margin);
    const y = Math.min(Math.max(anchor.y, margin), innerHeight - rect.height - margin);
    setPos({ x, y });
    // Re-measure when the content changes too (e.g. switching to a related concept).
  }, [anchor, children]);

  useEffect(() => {
    function handlePointerDown(e: PointerEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) onClose();
    }
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") {
        e.stopPropagation();
        onClose();
      }
    }
    document.addEventListener("pointerdown", handlePointerDown, true);
    document.addEventListener("keydown", handleKeyDown, true);
    return () => {
      document.removeEventListener("pointerdown", handlePointerDown, true);
      document.removeEventListener("keydown", handleKeyDown, true);
    };
  }, [onClose]);

  return (
    <div
      ref={ref}
      tabIndex={-1}
      aria-label={label}
      className={`explanation-popover${className ? ` ${className}` : ""}`}
      style={{ left: pos.x, top: pos.y }}
      role="dialog"
    >
      {children}
      <button className="explanation-close" onClick={onClose} aria-label="Chiudi dettagli">
        ×
      </button>
    </div>
  );
}
