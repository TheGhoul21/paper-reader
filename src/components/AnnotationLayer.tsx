import { useEffect, useRef, useState } from "react";
import type { Annotation, AnnotationTool } from "../types";

interface Props {
  page: number;
  width: number;
  height: number;
  tool: AnnotationTool;
  color: string;
  annotations: Annotation[];
  onAdd: (annotation: Annotation) => void;
  onUpdate: (id: string, patch: Partial<Annotation>) => void;
  onDelete: (id: string) => void;
}

const STROKE_WIDTH_FRACTION = 0.0025;

function newId() {
  return `an-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
}

function pathFromPoints(points: [number, number][], width: number, height: number) {
  return points.map(([x, y], i) => `${i === 0 ? "M" : "L"} ${x * width} ${y * height}`).join(" ");
}

export default function AnnotationLayer({
  page,
  width,
  height,
  tool,
  color,
  annotations,
  onAdd,
  onUpdate,
  onDelete,
}: Props) {
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const svgRef = useRef<SVGSVGElement>(null);
  const [editor, setEditor] = useState<{
    note: Extract<Annotation, { type: "text" }>;
    original: Extract<Annotation, { type: "text" }> | null;
    persisted: boolean;
  } | null>(null);
  const [drawPoints, setDrawPoints] = useState<[number, number][] | null>(null);

  const editingId = editor?.note.id;
  useEffect(() => {
    if (editingId) textareaRef.current?.focus({ preventScroll: true });
  }, [editingId]);

  function toFraction(clientX: number, clientY: number): [number, number] {
    const rect = svgRef.current!.getBoundingClientRect();
    return [(clientX - rect.left) / rect.width, (clientY - rect.top) / rect.height];
  }

  function changeText(text: string) {
    if (!editor) return;
    const note = { ...editor.note, text };
    if (editor.persisted) onUpdate(note.id, { text });
    else onAdd(note);
    setEditor({ ...editor, note, persisted: true });
  }
  function cancelEdit() {
    if (!editor) return;
    if (editor.original) onUpdate(editor.note.id, { text: editor.original.text });
    else if (editor.persisted) onDelete(editor.note.id);
    setEditor(null);
  }
  function finishEdit() {
    if (editor?.persisted && !editor.note.text.trim()) onDelete(editor.note.id);
    setEditor(null);
  }
  function handleBackgroundClick(e: React.MouseEvent) {
    if (
      tool !== "text" ||
      editor ||
      (e.target instanceof Element && e.target.closest(".annotation-editor"))
    )
      return;
    const [x, y] = toFraction(e.clientX, e.clientY);
    setEditor({
      note: {
        id: newId(),
        page,
        type: "text",
        color,
        createdAt: new Date().toISOString(),
        x,
        y,
        text: "",
      },
      original: null,
      persisted: false,
    });
  }

  function handlePointerDown(e: React.PointerEvent) {
    if (tool !== "draw" || (e.target instanceof Element && e.target.closest(".annotation-editor")))
      return;
    (e.target as Element).setPointerCapture(e.pointerId);
    setDrawPoints([toFraction(e.clientX, e.clientY)]);
  }

  function handlePointerMove(e: React.PointerEvent) {
    if (tool !== "draw" || !drawPoints) return;
    setDrawPoints((prev) => (prev ? [...prev, toFraction(e.clientX, e.clientY)] : prev));
  }

  function handlePointerUp() {
    if (tool !== "draw" || !drawPoints) return;
    if (drawPoints.length > 1) {
      onAdd({
        id: newId(),
        page,
        type: "freehand",
        color,
        createdAt: new Date().toISOString(),
        points: drawPoints,
        strokeWidth: STROKE_WIDTH_FRACTION,
      });
    }
    setDrawPoints(null);
  }

  return (
    <svg
      ref={svgRef}
      className={`annotation-layer tool-${tool}`}
      width={width}
      height={height}
      onClick={handleBackgroundClick}
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={handlePointerUp}
      onPointerCancel={() => setDrawPoints(null)}
    >
      {annotations.map((a) => {
        if (a.id === editor?.note.id) return null;
        if (a.type === "freehand") {
          return (
            <g key={a.id}>
              <path
                d={pathFromPoints(a.points, width, height)}
                stroke={a.color}
                strokeWidth={a.strokeWidth * width}
                fill="none"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
              {tool === "erase" && (
                <path
                  d={pathFromPoints(a.points, width, height)}
                  stroke="transparent"
                  strokeWidth={Math.max(a.strokeWidth * width, 14)}
                  fill="none"
                  className="annotation-hit"
                  onClick={(e) => {
                    e.stopPropagation();
                    onDelete(a.id);
                  }}
                />
              )}
            </g>
          );
        }
        return (
          <foreignObject
            key={a.id}
            x={a.x * width}
            y={a.y * height}
            width={220}
            height={90}
            style={{ overflow: "visible" }}
          >
            <button
              type="button"
              className="annotation-note"
              aria-label={tool === "erase" ? `Elimina nota: ${a.text}` : `Modifica nota: ${a.text}`}
              style={{ borderColor: a.color, backgroundColor: `${a.color}22` }}
              onClick={(e) => {
                e.stopPropagation();
                if (tool === "erase") onDelete(a.id);
                else if (tool === "text") setEditor({ note: a, original: a, persisted: true });
              }}
            >
              {a.text}
            </button>
          </foreignObject>
        );
      })}

      {editor && (
        <foreignObject
          x={editor.note.x * width}
          y={editor.note.y * height}
          width={240}
          height={150}
          style={{ overflow: "visible" }}
        >
          <div role="group" aria-label="Editor della mia nota" className="annotation-editor">
            <textarea
              className="annotation-text-input"
              aria-label="Testo della mia nota"
              style={{ borderColor: editor.note.color }}
              ref={textareaRef}
              value={editor.note.text}
              onChange={(e) => changeText(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Escape") {
                  e.stopPropagation();
                  cancelEdit();
                }
                if ((e.ctrlKey || e.metaKey) && e.key === "Enter") finishEdit();
              }}
            />
            <small>Modifiche salvate automaticamente</small>
            <div>
              <button onClick={finishEdit}>Fine</button>
              <button onClick={cancelEdit}>Annulla modifica</button>
            </div>
          </div>
        </foreignObject>
      )}

      {drawPoints && drawPoints.length > 1 && (
        <path
          d={pathFromPoints(drawPoints, width, height)}
          stroke={color}
          strokeWidth={STROKE_WIDTH_FRACTION * width}
          fill="none"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      )}
    </svg>
  );
}
