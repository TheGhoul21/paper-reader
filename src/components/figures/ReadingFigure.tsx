import { lazy, Suspense, useRef, useState } from "react";
import { Link, useLocation } from "react-router-dom";
import { papersUrl } from "../../lib/paths";
import { pickVariant } from "../../lib/structure";
import type { PaperFigure } from "../../types";
import type { ReadingTools } from "../guided/ReadingContent";

const ParityTwineFigure = lazy(() => import("./ParityTwineFigure"));

export default function ReadingFigure({
  figure,
  panel,
  tools,
}: {
  figure: PaperFigure;
  panel?: "a" | "b" | "c";
  tools: ReadingTools;
}) {
  const location = useLocation();
  const dialog = useRef<HTMLDialogElement>(null);
  const opener = useRef<HTMLButtonElement>(null);
  const [imageFailed, setImageFailed] = useState(false);
  const caption = pickVariant(figure.caption, tools.variant);
  const imageUrl = papersUrl(`${tools.slug}/${figure.image}`);
  const original = (
    <div className="reading-figure-original">
      {imageFailed ? (
        <p role="status">Immagine non disponibile. Apri la figura nel PDF.</p>
      ) : (
        <img src={imageUrl} alt={caption} loading="lazy" onError={() => setImageFailed(true)} />
      )}
      {!imageFailed && (
        <button ref={opener} onClick={() => dialog.current?.showModal()}>
          Ingrandisci figura originale
        </button>
      )}
    </div>
  );
  return (
    <figure className="reading-figure" aria-label={`${figure.label} · pagina ${figure.page + 1}`}>
      <figcaption>
        <strong>{figure.label}</strong>
        <span>Pagina {figure.page + 1}</span>
        <p>{caption}</p>
      </figcaption>
      {figure.animation === "parity-twine" ? (
        <>
          <Suspense fallback={<p>Caricamento animazione…</p>}>
            <ParityTwineFigure initialPanel={panel} />
          </Suspense>
          <details className="reading-figure-source">
            <summary>Mostra figura originale</summary>
            {original}
          </details>
        </>
      ) : (
        original
      )}
      <Link
        className="reading-figure-pdf"
        to={tools.sourceUrl(figure.captionParagraph)}
        state={location.state}
        onClick={tools.onSource}
      >
        Apri figura nel PDF ↗
      </Link>
      <dialog
        ref={dialog}
        className="reading-figure-dialog"
        onClose={() => opener.current?.focus()}
      >
        <div className="reading-figure-dialog-header">
          <strong>{figure.label} · originale</strong>
          <button onClick={() => dialog.current?.close()}>Chiudi</button>
        </div>
        <img src={imageUrl} alt={caption} />
      </dialog>
    </figure>
  );
}
