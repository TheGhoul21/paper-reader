import { useEffect, useRef, useState } from "react";

interface Props {
  text: string;
  pageNumber: number;
  anchor: { x: number; y: number };
  onJumpToPage: (pageNumber: number) => void;
  onClose: () => void;
}

export default function CitationPopover({ text, pageNumber, anchor, onJumpToPage, onClose }: Props) {
  const ref = useRef<HTMLDivElement>(null);
  const [pos, setPos] = useState(anchor);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const { innerWidth, innerHeight } = window;
    const rect = el.getBoundingClientRect();
    const margin = 12;
    const x = Math.min(Math.max(anchor.x, margin), innerWidth - rect.width - margin);
    const y = Math.min(Math.max(anchor.y, margin), innerHeight - rect.height - margin);
    setPos({ x, y });
  }, [anchor]);

  useEffect(() => {
    function handlePointerDown(e: PointerEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) onClose();
    }
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    document.addEventListener("pointerdown", handlePointerDown, true);
    document.addEventListener("keydown", handleKeyDown);
    window.addEventListener("scroll", onClose, true);
    return () => {
      document.removeEventListener("pointerdown", handlePointerDown, true);
      document.removeEventListener("keydown", handleKeyDown);
      window.removeEventListener("scroll", onClose, true);
    };
  }, [onClose]);

  return (
    <div ref={ref} className="explanation-popover" style={{ left: pos.x, top: pos.y }} role="dialog">
      <div className="explanation-section">Riferimento</div>
      <p>{text}</p>
      <div className="explanation-ask-row">
        <button
          className="explanation-ask-btn"
          onClick={() => {
            onJumpToPage(pageNumber);
            onClose();
          }}
        >
          Vai a pagina {pageNumber}
        </button>
      </div>
      <button className="explanation-close" onClick={onClose} aria-label="Close">
        ×
      </button>
    </div>
  );
}
