import Popover from "./Popover";

interface Props {
  text: string;
  pageNumber: number;
  anchor: { x: number; y: number };
  onJumpToPage: (pageNumber: number) => void;
  onClose: () => void;
}

export default function CitationPopover({ text, pageNumber, anchor, onJumpToPage, onClose }: Props) {
  return (
    <Popover anchor={anchor} onClose={onClose}>
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
    </Popover>
  );
}
