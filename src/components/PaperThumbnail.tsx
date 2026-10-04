import { useState } from "react";
import { LibraryIcon } from "./icons";

interface Props {
  imageUrl: string;
  label: string;
}

/** Pre-rendered at import; library cards never download or parse the original PDFs. */
export default function PaperThumbnail({ imageUrl, label }: Props) {
  const [failedUrl, setFailedUrl] = useState<string | null>(null);

  return (
    <div className="paper-thumb">
      {failedUrl !== imageUrl ? (
        <img
          src={imageUrl}
          alt={label}
          loading="lazy"
          decoding="async"
          onError={() => setFailedUrl(imageUrl)}
        />
      ) : (
        <div className="paper-thumb-placeholder">
          <LibraryIcon width={22} height={22} />
        </div>
      )}
    </div>
  );
}
