import Popover from "./Popover";
import { ExternalLinkIcon } from "./icons";
import { citationLinks, paperRequestUrl } from "../lib/requests";
import type { Variant } from "../types";

interface Props {
  text: string;
  pageNumber: number;
  /** The paper being read — the request records where the citation came from and at which level. */
  sourceSlug: string;
  variant?: Variant;
  anchor: { x: number; y: number };
  onJumpToPage: (pageNumber: number) => void;
  onClose: () => void;
}

export default function CitationPopover({ text, pageNumber, sourceSlug, variant, anchor, onJumpToPage, onClose }: Props) {
  const links = citationLinks(text);
  const external = { target: "_blank", rel: "noopener noreferrer" } as const;
  return (
    <Popover anchor={anchor} onClose={onClose}>
      <div className="explanation-section">Riferimento</div>
      <p>{text}</p>
      <div className="citation-search">
        <span className="concept-related-label">Cerca</span>
        {links.arxiv ? (
          <a href={links.arxiv} {...external}>
            arXiv
          </a>
        ) : (
          <a href={links.arxivSearch} {...external}>
            arXiv
          </a>
        )}
        <a href={links.scholar} {...external}>
          Google Scholar
        </a>
        {links.doi && (
          <a href={links.doi} {...external}>
            DOI
          </a>
        )}
      </div>
      <div className="explanation-ask-row">
        <a
          className="explanation-ask-btn citation-request"
          href={paperRequestUrl({ reference: text, sourceSlug, variant })}
          {...external}
          title="Apre una richiesta su GitHub, già compilata con questa citazione"
        >
          Richiedi questo paper
          <ExternalLinkIcon width={13} height={13} />
        </a>
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
    </Popover>
  );
}
