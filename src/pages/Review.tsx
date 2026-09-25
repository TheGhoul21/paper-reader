import { useEffect, useMemo, useRef, useState } from "react";
import { downloadBackup, importBackup } from "../lib/backup";
import { Link, useSearchParams } from "react-router-dom";
import { papersUrl } from "../lib/paths";
import { conceptDefinition } from "../lib/concepts";
import { isDue, previewInterval, useReview, type Grade, type ReviewCard } from "../lib/review";
import type { Concept, PaperMeta, Paragraph } from "../types";

interface PaperData {
  meta: PaperMeta;
  paragraphs: Paragraph[];
  /** Paragraph id → 1-based reading-order number (the badge shown in the reader). */
  numbers: Map<string, number>;
  concepts: Map<string, Concept>;
}

const GRADES: { grade: Grade; label: string; key: string }[] = [
  { grade: "again", label: "Non la sapevo", key: "1" },
  { grade: "hard", label: "Difficile", key: "2" },
  { grade: "good", label: "La sapevo", key: "3" },
  { grade: "easy", label: "Facile", key: "4" },
];

async function loadPaper(slug: string): Promise<PaperData> {
  const json = (path: string) =>
    fetch(papersUrl(`${slug}/${path}`)).then((r) => {
      if (!r.ok) throw new Error(`${path}: ${r.status}`);
      return r.json();
    });
  const [meta, paragraphs, concepts] = await Promise.all([
    json("meta.json") as Promise<PaperMeta>,
    json("paragraphs.json") as Promise<Paragraph[]>,
    (json("concepts.json") as Promise<Concept[]>).catch(() => [] as Concept[]),
  ]);
  const ordered = [...paragraphs].sort((a, b) => a.page - b.page || a.order - b.order);
  return {
    meta,
    paragraphs,
    numbers: new Map(ordered.map((p, i) => [p.id, i + 1])),
    concepts: new Map((Array.isArray(concepts) ? concepts : []).map((c) => [c.id, c])),
  };
}

/** Export/import of everything kept only in this browser (review deck + annotations). */
function BackupControls() {
  const input = useRef<HTMLInputElement>(null);
  const [message, setMessage] = useState<string | null>(null);
  async function onFile(file: File) {
    try {
      const { cards, annotations } = importBackup(JSON.parse(await file.text()));
      setMessage(`Importate ${cards} card e ${annotations} annotazioni.`);
    } catch (err) {
      setMessage(err instanceof Error ? err.message : "File non valido.");
    }
  }
  return (
    <div className="review-backup">
      <span>Ripasso e annotazioni restano in questo browser.</span>
      <button className="explanation-ask-btn" onClick={downloadBackup}>
        Esporta backup
      </button>
      <button className="explanation-ask-btn" onClick={() => input.current?.click()}>
        Importa backup
      </button>
      <input
        ref={input}
        type="file"
        accept="application/json,.json"
        hidden
        onChange={(e) => {
          const file = e.target.files?.[0];
          if (file) onFile(file);
          e.target.value = "";
        }}
      />
      {message && <span className="review-backup-message">{message}</span>}
    </div>
  );
}

function formatWhen(iso: string): string {
  const d = new Date(iso);
  const days = Math.round((d.getTime() - Date.now()) / 86400000);
  if (days <= 0) return `oggi alle ${d.toLocaleTimeString("it-IT", { hour: "2-digit", minute: "2-digit" })}`;
  if (days === 1) return "domani";
  return `tra ${days} giorni`;
}

export default function Review() {
  const { cards, gradeCard, removeCard } = useReview();
  // ?paper=<slug>: review only that paper's cards (the reader's "Ripassa questo paper").
  const [searchParams] = useSearchParams();
  const paperFilter = searchParams.get("paper");
  const [papers, setPapers] = useState<Record<string, PaperData | "error">>({});
  const [revealed, setRevealed] = useState(false);
  const [now, setNow] = useState(() => new Date());

  // Cards graded "again" come back after a few minutes: re-evaluate what's due periodically.
  useEffect(() => {
    const timer = setInterval(() => setNow(new Date()), 30000);
    return () => clearInterval(timer);
  }, []);

  const all = useMemo(() => Object.values(cards).filter((c) => !paperFilter || c.slug === paperFilter), [cards, paperFilter]);
  const due = useMemo(() => all.filter((c) => isDue(c, now)).sort((a, b) => a.due.localeCompare(b.due)), [all, now]);
  const current: ReviewCard | undefined = due[0];

  // Load each paper that has cards in the queue, once.
  const neededSlugs = useMemo(() => [...new Set(due.map((c) => c.slug))], [due]);
  useEffect(() => {
    for (const slug of neededSlugs) {
      if (papers[slug]) continue;
      loadPaper(slug).then(
        (data) => setPapers((prev) => ({ ...prev, [slug]: data })),
        () => setPapers((prev) => ({ ...prev, [slug]: "error" })),
      );
    }
  }, [neededSlugs, papers]);

  useEffect(() => setRevealed(false), [current?.id]);

  const paper = current ? papers[current.slug] : undefined;
  const content = useMemo(() => {
    if (!current || !paper || paper === "error") return null;
    if (current.kind === "concept") {
      const concept = paper.concepts.get(current.refId);
      if (!concept) return null;
      const definedIn = paper.paragraphs.find((p) => p.id === concept.definedIn);
      return {
        chip: "Concetto",
        prompt: <>Cos'è <strong>{concept.term}</strong>, nel senso di questo paper?</>,
        context: null as string | null,
        answer: conceptDefinition(concept, current.variant).text,
        openAt: definedIn?.id ?? null,
      };
    }
    if (current.kind === "question") {
      const [paragraphId, questionId] = current.refId.split("#");
      const paragraph = paper.paragraphs.find((p) => p.id === paragraphId);
      const question = paragraph?.recall?.find((r) => r.id === questionId);
      if (!paragraph || !question) return null;
      const pick = (texts: Record<string, string>) => texts[current.variant] ?? Object.values(texts)[0] ?? "";
      return {
        chip: "Domanda",
        prompt: <>{pick(question.q)}</>,
        context: null as string | null,
        answer: pick(question.a),
        openAt: paragraph.id,
      };
    }
    const paragraph = paper.paragraphs.find((p) => p.id === current.refId);
    if (!paragraph) return null;
    const explanation = paragraph.explanations[current.variant] ?? Object.values(paragraph.explanations)[0] ?? "";
    return {
      chip: "Paragrafo",
      prompt: (
        <>
          Rispiega con parole tue il <strong>paragrafo {paper.numbers.get(paragraph.id)}</strong>
          {paragraph.section ? <> ({paragraph.section})</> : null}
        </>
      ),
      context: paragraph.sourceText.length > 420 ? `${paragraph.sourceText.slice(0, 420)}…` : paragraph.sourceText,
      answer: explanation,
      openAt: paragraph.id,
    };
  }, [current, paper]);

  function grade(g: Grade) {
    if (current) gradeCard(current.id, g);
  }

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (!current || e.target instanceof HTMLInputElement) return;
      if (!revealed && (e.key === " " || e.key === "Enter")) {
        e.preventDefault();
        setRevealed(true);
      } else if (revealed) {
        const g = GRADES.find((x) => x.key === e.key);
        if (g) grade(g.grade);
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  });

  if (all.length === 0) {
    return (
      <div className="review">
        <h1 className="review-title">Ripasso</h1>
        <p className="state-message">
          Nessuna card. Mentre leggi, usa <strong>Da ripassare</strong> su una nota o <strong>Aggiungi al ripasso</strong> nel
          glossario: quei concetti e paragrafi ti verranno richiesti qui, a intervalli sempre più lunghi finché non li ricordi.
        </p>
        <BackupControls />
      </div>
    );
  }

  if (!current) {
    const next = [...all].sort((a, b) => a.due.localeCompare(b.due))[0];
    return (
      <div className="review">
        <h1 className="review-title">Ripasso</h1>
        <p className="state-message">
          Niente da ripassare ora{paperFilter ? " per questo paper" : ""}. {all.length} card in tutto; la prossima{" "}
          {formatWhen(next.due)}.{paperFilter && <> <Link to="/review">Tutti i paper</Link></>}
        </p>
        <BackupControls />
      </div>
    );
  }

  return (
    <div className="review">
      <div className="review-header">
        <h1 className="review-title">
          Ripasso
          {paperFilter && (
            <Link to="/review" className="review-filter" title="Mostra tutte le card">
              solo questo paper ×
            </Link>
          )}
        </h1>
        <span className="review-count">{due.length} da ripassare</span>
      </div>

      {!paper ? (
        <p className="state-message">Caricamento…</p>
      ) : paper === "error" || !content ? (
        <div className="review-card">
          <p>Questa card non è più disponibile (il paper o il concetto è stato rimosso o rinominato).</p>
          <button className="explanation-ask-btn" onClick={() => removeCard(current.id)}>
            Rimuovi dal ripasso
          </button>
        </div>
      ) : (
        <div className="review-card">
          <div className="review-card-meta">
            <span className="library-badge">{content.chip}</span>
            <Link to={`/paper/${current.slug}`} className="review-paper-link">
              {paper.meta.title}
            </Link>
          </div>
          <p className="review-prompt">{content.prompt}</p>
          {content.context && <blockquote className="review-context">{content.context}</blockquote>}

          {!revealed ? (
            <button className="review-reveal" onClick={() => setRevealed(true)}>
              Mostra risposta <kbd>spazio</kbd>
            </button>
          ) : (
            <>
              <div className="review-answer">
                <p>{content.answer}</p>
                {content.openAt && (
                  <Link to={`/paper/${current.slug}?p=${content.openAt}`} className="review-open">
                    Apri nel paper →
                  </Link>
                )}
              </div>
              <div className="review-grades">
                {GRADES.map((g) => (
                  <button key={g.grade} className={`review-grade review-grade-${g.grade}`} onClick={() => grade(g.grade)}>
                    <span>{g.label}</span>
                    <small>
                      {previewInterval(current, g.grade)} · <kbd>{g.key}</kbd>
                    </small>
                  </button>
                ))}
              </div>
            </>
          )}
          <button className="review-remove" onClick={() => removeCard(current.id)}>
            Rimuovi dal ripasso
          </button>
        </div>
      )}
      <BackupControls />
    </div>
  );
}
