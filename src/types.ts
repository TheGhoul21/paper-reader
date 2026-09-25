export interface Variant {
  /** "<language>-<level>", e.g. "it-beginner". Key into Paragraph.explanations. */
  key: string;
  language: string;
  level: "beginner" | "intermediate" | "expert";
  /** Human-readable label for the selector, e.g. "Italiano · Nessun background". */
  label: string;
}

export interface LibraryEntry {
  slug: string;
  title: string;
  authors: string[];
  importedAt: string;
  language: string;
  background: string;
  pageCount: number;
  variants: Variant[];
}

export interface PaperMeta extends LibraryEntry {
  sourceType: "arxiv" | "url" | "local";
  sourceRef: string;
}

export interface Paragraph {
  id: string;
  page: number;
  order: number;
  section?: string;
  /** Fractions of page width/height (0-1), top-left origin. */
  rects: [number, number, number, number][];
  sourceText: string;
  /** Keyed by Variant.key ("<language>-<level>"). */
  explanations: Record<string, string>;
  notebookSuggestion?: string;
}

export type AnnotationTool = "none" | "text" | "draw" | "erase";

interface AnnotationBase {
  id: string;
  page: number;
  color: string;
  createdAt: string;
}

export interface TextAnnotation extends AnnotationBase {
  type: "text";
  /** Fractions of page width/height (0-1), top-left origin. */
  x: number;
  y: number;
  text: string;
}

export interface FreehandAnnotation extends AnnotationBase {
  type: "freehand";
  /** Fractions of page width/height (0-1), top-left origin. */
  points: [number, number][];
  strokeWidth: number;
}

export type Annotation = TextAnnotation | FreehandAnnotation;
