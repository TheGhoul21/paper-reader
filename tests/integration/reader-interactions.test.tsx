import { useState } from "react";
import { MemoryRouter } from "react-router-dom";
import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import PageCanvas from "../../src/components/PageCanvas";
import NotesPane from "../../src/components/NotesPane";
import ExplanationNote from "../../src/components/ExplanationNote";
import Popover from "../../src/components/Popover";
import Toolbar from "../../src/components/Toolbar";
import { useReaderSession } from "../../src/lib/readerSession";
import { buildConceptMatcher } from "../../src/lib/concepts";
import { indexStructure } from "../../src/lib/structure";
import { scrollToOccurrence } from "../../src/lib/conceptHighlight";
import { parseLibrary, parsePaper } from "../../src/lib/papers";
import type { Annotation, Paragraph, PaperStructure } from "../../src/types";
import type { PDFDocumentProxy } from "pdfjs-dist";

// PDF rasterization is external to these lifecycle tests; the annotation editor is real.
vi.mock("../../src/components/TextLayer", () => ({ default: () => null }));
vi.mock("../../src/components/LinkLayer", () => ({ default: () => null }));
const variant = { key: "it-beginner", language: "it", level: "beginner" as const, label: "Base" };
const paragraphs: Paragraph[] = ["a", "b"].map((id, order) => ({
  id,
  page: 0,
  order,
  rects: [[0.1, 0.1, 0.9, 0.2]],
  sourceText: id,
  explanations: { "it-beginner": `Spiegazione ${id}` },
}));
const structure: PaperStructure = {
  thesis: { "it-beginner": "Tesi" },
  claims: [
    {
      id: "c1",
      title: { "it-beginner": "Tesi" },
      summary: { "it-beginner": "Riassunto" },
      statedIn: ["a"],
      evidence: [],
      dependsOn: [],
    },
  ],
};

it("selection reveals an excluded passage and leaves the map tab", () => {
  function Session() {
    const [state, dispatch] = useReaderSession();
    const index = indexStructure(structure, paragraphs)!;
    return (
      <MemoryRouter>
        <button
          onClick={() => {
            dispatch({ type: "toggle-thread" });
            dispatch({ type: "tab", tab: "map" });
          }}
        >
          Filtro e mappa
        </button>
        <button
          onClick={() => dispatch({ type: "reveal", id: "b", inThread: index.thread.has("b") })}
        >
          Passaggio PDF b
        </button>
        <NotesPane
          paperTitle="Demo"
          paragraphs={paragraphs}
          numbers={
            new Map([
              ["a", 1],
              ["b", 2],
            ])
          }
          sectionStarts={new Set()}
          variant={variant.key}
          activeId={state.activeId}
          hoverId={null}
          conceptMatcher={buildConceptMatcher([])}
          argument={{
            structure,
            index,
            tab: state.tab,
            onTab: (tab) => dispatch({ type: "tab", tab }),
            threadOnly: state.threadOnly,
            onToggleThread: () => dispatch({ type: "toggle-thread" }),
            focusClaim: null,
            onFocusClaim: vi.fn(),
            onGoToParagraph: vi.fn(),
          }}
          isInReview={() => false}
          onToggleReview={vi.fn()}
          onActivate={vi.fn()}
          onConcept={vi.fn()}
          onHover={vi.fn()}
          onJumpToPage={vi.fn()}
          onGoToParagraph={vi.fn()}
        />
      </MemoryRouter>
    );
  }
  render(<Session />);
  fireEvent.click(screen.getByText("Filtro e mappa"));
  expect(screen.queryByText("Spiegazione b")).toBeNull();
  fireEvent.click(screen.getByText("Passaggio PDF b"));
  expect(screen.getByText("Spiegazione b")).toBeTruthy();
  expect(screen.getByRole("tab", { name: "Spiegazioni" }).getAttribute("aria-selected")).toBe(
    "true",
  );
});

it("a real annotation draft survives zoom and leaving the render window, saved once", async () => {
  let visibility: IntersectionObserverCallback;
  vi.stubGlobal(
    "IntersectionObserver",
    class {
      constructor(callback: IntersectionObserverCallback) {
        visibility = callback;
      }
      observe() {}
      disconnect() {}
    },
  );
  vi.spyOn(HTMLCanvasElement.prototype, "getContext").mockReturnValue(
    {} as CanvasRenderingContext2D,
  );
  vi.spyOn(SVGSVGElement.prototype, "getBoundingClientRect").mockReturnValue({
    left: 0,
    top: 0,
    width: 300,
    height: 600,
  } as DOMRect);
  const page = {
    getViewport: ({ scale }: { scale: number }) => ({ width: 300 * scale, height: 600 * scale }),
    render: () => ({ promise: Promise.resolve(), cancel() {} }),
  };
  const doc = { getPage: async () => page } as unknown as PDFDocumentProxy;
  let records: Annotation[] = [];
  function Page({ scale }: { scale: number }) {
    const [annotations, setAnnotations] = useState<Annotation[]>([]);
    records = annotations;
    return (
      <PageCanvas
        doc={doc}
        pageNumber={1}
        scale={scale}
        defaultSize={{ width: 300, height: 600 }}
        paragraphs={[]}
        numbers={new Map()}
        activeId={null}
        hoverId={null}
        onSelect={vi.fn()}
        onHoverParagraph={vi.fn()}
        onJumpToPage={vi.fn()}
        onCitation={vi.fn()}
        tool="text"
        color="#e8916a"
        annotations={annotations}
        onAddAnnotation={(note) => setAnnotations((old) => [...old, note])}
        onUpdateAnnotation={(id, patch) =>
          setAnnotations((old) =>
            old.map((n) => (n.id === id ? ({ ...n, ...patch } as Annotation) : n)),
          )
        }
        onDeleteAnnotation={(id) => setAnnotations((old) => old.filter((n) => n.id !== id))}
      />
    );
  }
  const view = render(<Page scale={1} />);
  await act(async () => {});
  const container = document.querySelector(".pdf-page")!;
  await act(async () =>
    visibility(
      [{ target: container, isIntersecting: true } as IntersectionObserverEntry],
      {} as IntersectionObserver,
    ),
  );
  fireEvent.click(document.querySelector(".annotation-layer")!, { clientX: 30, clientY: 60 });
  fireEvent.change(screen.getByRole("textbox", { name: "Testo della mia nota" }), {
    target: { value: "La mia idea" },
  });
  view.rerender(<Page scale={2} />);
  await act(async () =>
    visibility(
      [{ target: container, isIntersecting: false } as IntersectionObserverEntry],
      {} as IntersectionObserver,
    ),
  );
  expect(
    (screen.getByRole("textbox", { name: "Testo della mia nota" }) as HTMLTextAreaElement).value,
  ).toBe("La mia idea");
  expect(records).toHaveLength(1);
  fireEvent.change(screen.getByRole("textbox", { name: "Testo della mia nota" }), {
    target: { value: "Idea completa" },
  });
  expect(records).toHaveLength(1);
  expect(records[0].type === "text" && records[0].text).toBe("Idea completa");
});

it("internal popover scroll stays open; Escape restores the opener", async () => {
  function Dialog() {
    const [open, setOpen] = useState(false);
    return (
      <>
        <button onClick={() => setOpen(true)}>Definizione</button>
        {open && (
          <Popover label="Glossario" anchor={{ x: 20, y: 20 }} onClose={() => setOpen(false)}>
            <div>Definizione lunga</div>
          </Popover>
        )}
      </>
    );
  }
  render(<Dialog />);
  const trigger = screen.getByText("Definizione");
  trigger.focus();
  fireEvent.click(trigger);
  fireEvent.scroll(screen.getByRole("dialog"));
  expect(screen.getByRole("dialog")).toBeTruthy();
  fireEvent.keyDown(screen.getByRole("dialog"), { key: "Escape" });
  await waitFor(() => expect(document.activeElement).toBe(trigger));
});

it("clipboard failure provides manual text and never claims success", async () => {
  Object.defineProperty(navigator, "clipboard", {
    configurable: true,
    value: { writeText: vi.fn().mockRejectedValue(new Error("denied")) },
  });
  render(
    <ExplanationNote
      paperTitle="Demo"
      paragraph={paragraphs[0]}
      number={1}
      showSection={false}
      variant={variant.key}
      active
      highlighted={false}
      conceptMatcher={buildConceptMatcher([])}
      inReview={false}
      onToggleReview={vi.fn()}
      onActivate={vi.fn()}
      onHover={vi.fn()}
      onConcept={vi.fn()}
      onGoToParagraph={vi.fn()}
    />,
  );
  fireEvent.click(screen.getByText("Chiedi un aiuto esterno"));
  fireEvent.click(screen.getByText("Copia per Claude"));
  await screen.findByText(/Copia automatica non riuscita/);
  expect(screen.queryByText("Copiato ✓")).toBeNull();
  expect((screen.getByRole("textbox") as HTMLTextAreaElement).value).toContain("Spiegazione a");
});

it("page editing waits for confirmation and exposes validation", () => {
  const jump = vi.fn();
  render(
    <MemoryRouter>
      <Toolbar
        paper={{ title: "Demo", authors: [], pdfUrl: "/demo.pdf" }}
        pageCount={30}
        viewport={{
          currentPage: 1,
          scale: 1,
          fitMode: "width",
          jumpToPage: jump,
          setFitMode: vi.fn(),
          zoom: vi.fn(),
        }}
        search={{
          query: "",
          setQuery: vi.fn(),
          status: "idle",
          count: 0,
          index: 0,
          retry: vi.fn(),
          move: vi.fn(),
        }}
        tools={{ tool: "none", color: "#e8916a", setTool: vi.fn(), setColor: vi.fn() }}
        variants={[variant]}
        variant={variant.key}
        onVariantChange={vi.fn()}
        panel={{ open: true, toggle: vi.fn() }}
        preferences={{
          fontSize: 16,
          panelWidth: 400,
          setFontSize: vi.fn(),
          setPanelWidth: vi.fn(),
        }}
      />
    </MemoryRouter>,
  );
  const field = screen.getByRole("textbox", { name: "Pagina del PDF" });
  act(() => field.focus());
  fireEvent.change(field, { target: { value: "2" } });
  fireEvent.change(field, { target: { value: "20" } });
  expect(jump).not.toHaveBeenCalled();
  fireEvent.keyDown(field, { key: "Enter" });
  expect(jump).toHaveBeenCalledWith(20);
  expect(jump).toHaveBeenCalledTimes(1);
  act(() => field.focus());
  fireEvent.change(field, { target: { value: "" } });
  fireEvent.blur(field);
  expect(screen.getByRole("alert").textContent).toContain("da 1 a 30");
});

it("obsolete concept navigation cannot claim a new concept mark", async () => {
  document.body.innerHTML =
    '<div id="page-1"><div class="textLayer" data-concept-pattern="new"><mark class="concept-mark" data-occurrence="0">new</mark></div></div>';
  const controller = new AbortController();
  const pending = scrollToOccurrence({ page: 1, indexOnPage: 0 }, controller.signal, "old");
  controller.abort();
  await pending;
  expect(document.querySelector("mark")!.classList.contains("is-current")).toBe(false);
});

it("incomplete manifest and concept entries fail at the data seam", () => {
  expect(() => parseLibrary([{}])).toThrow(/index.json/);
  expect(() =>
    parsePaper(
      "demo",
      { slug: "demo", title: "Demo", authors: [], pageCount: 1, variants: [variant] },
      paragraphs,
      [],
      null,
      { term: [{}] },
    ),
  ).toThrow(/concepts-index.json: term/);
});
