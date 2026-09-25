import { useRef, useState } from "react";
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

export default function AnnotationLayer({ page, width, height, tool, color, annotations, onAdd, onUpdate, onDelete }: Props) {
  const svgRef = useRef<SVGSVGElement>(null);
  const [draft, setDraft] = useState<{ x: number; y: number; text: string } | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [drawPoints, setDrawPoints] = useState<[number, number][] | null>(null);

  function toFraction(clientX: number, clientY: number): [number, number] {
    const rect = svgRef.current!.getBoundingClientRect();
    return [(clientX - rect.left) / rect.width, (clientY - rect.top) / rect.height];
  }

  function commitDraft() {
    if (draft && draft.text.trim()) {
      onAdd({ id: newId(), page, type: "text", color, createdAt: new Date().toISOString(), x: draft.x, y: draft.y, text: draft.text });
    }
    setDraft(null);
  }

  function handleBackgroundClick(e: React.MouseEvent) {
    if (tool !== "text") return;
    const [x, y] = toFraction(e.clientX, e.clientY);
    setDraft({ x, y, text: "" });
  }

  function handlePointerDown(e: React.PointerEvent) {
    if (tool !== "draw") return;
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
    >
      {annotations.map((a) => {
        const isEditing = a.type === "text" && editingId === a.id;
        if (a.type === "freehand") {
          return (
            <g key={a.id}>
              <path d={pathFromPoints(a.points, width, height)} stroke={a.color} strokeWidth={a.strokeWidth * width} fill="none" strokeLinecap="round" strokeLinejoin="round" />
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
          <foreignObject key={a.id} x={a.x * width} y={a.y * height} width={220} height={90} style={{ overflow: "visible" }}>
            {isEditing ? (
              <textarea
                className="annotation-text-input"
                style={{ borderColor: a.color }}
                defaultValue={a.text}
                autoFocus
                onBlur={(e) => {
                  const text = e.target.value.trim();
                  if (text) onUpdate(a.id, { text });
                  else onDelete(a.id);
                  setEditingId(null);
                }}
              />
            ) : (
              <div
                className="annotation-note"
                style={{ borderColor: a.color, backgroundColor: `${a.color}22` }}
                onClick={(e) => {
                  e.stopPropagation();
                  if (tool === "erase") onDelete(a.id);
                  else if (tool === "text") setEditingId(a.id);
                }}
              >
                {a.text}
              </div>
            )}
          </foreignObject>
        );
      })}

      {draft && (
        <foreignObject x={draft.x * width} y={draft.y * height} width={220} height={90} style={{ overflow: "visible" }}>
          <textarea
            className="annotation-text-input"
            style={{ borderColor: color }}
            autoFocus
            onChange={(e) => setDraft((d) => (d ? { ...d, text: e.target.value } : d))}
            onBlur={commitDraft}
            onClick={(e) => e.stopPropagation()}
          />
        </foreignObject>
      )}

      {drawPoints && drawPoints.length > 1 && (
        <path d={pathFromPoints(drawPoints, width, height)} stroke={color} strokeWidth={STROKE_WIDTH_FRACTION * width} fill="none" strokeLinecap="round" strokeLinejoin="round" />
      )}
    </svg>
  );
}
