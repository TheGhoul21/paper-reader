import { useRef } from "react";
import { SearchIcon, CloseIcon } from "../icons";

export default function CatalogSearch({
  query,
  onQuery,
  submit,
}: {
  query: string;
  onQuery: (query: string) => void;
  submit?: () => void;
}) {
  const input = useRef<HTMLInputElement>(null);
  return (
    <form
      className="catalog-search-form"
      role="search"
      onSubmit={(event) => {
        event.preventDefault();
        submit?.();
      }}
    >
      <div className="library-search">
        <SearchIcon className="library-search-icon" />
        <input
          ref={input}
          type="search"
          className="library-search-input"
          aria-label="Cerca per titolo, autore, concetto, DOI o arXiv"
          placeholder="Titolo, autore, concetto, DOI o arXiv"
          value={query}
          onChange={(event) => onQuery(event.target.value)}
        />
        {query && (
          <button
            type="button"
            className="library-search-clear"
            onClick={() => {
              onQuery("");
              input.current?.focus();
            }}
            aria-label="Cancella ricerca"
          >
            <CloseIcon width={16} height={16} />
          </button>
        )}
      </div>
      {submit && (
        <button type="submit" className="catalog-search-submit">
          Cerca
        </button>
      )}
    </form>
  );
}
