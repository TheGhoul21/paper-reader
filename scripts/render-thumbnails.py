# /// script
# requires-python = ">=3.11"
# dependencies = ["pymupdf"]
# ///
"""Generate library thumbnails at import time; no PDF parser is needed on library cards.

uv run scripts/render-thumbnails.py [slug ...]
Rerenders only when the original PDF's SHA-256 changes.
"""
import argparse
import hashlib
import json
from pathlib import Path

import pymupdf


def render_thumbnail(folder):
    source = folder / "source"
    pdf = source / "paper.pdf"
    digest = hashlib.sha256(pdf.read_bytes()).hexdigest()
    metadata = folder / "meta.json"
    if metadata.exists():
        meta = json.loads(metadata.read_text())
        if meta.get("sourceSha256") not in (None, digest):
            raise ValueError(f"{folder.name}: the PDF changed; reimport its explanations before regenerating the thumbnail")
        if "sourceSha256" not in meta:
            original = metadata.read_text()
            closing = original.rfind("}")
            metadata.write_text(original[:closing].rstrip() + ',\n  "sourceSha256": ' + json.dumps(digest) + "\n}\n")
    image = source / "thumbnail.png"
    stamp = source / "thumbnail.sha256"
    if image.exists() and stamp.exists() and stamp.read_text().strip() == digest:
        return False
    with pymupdf.open(pdf) as doc:
        page = doc[0]
        scale = 640 / page.rect.width
        page.get_pixmap(matrix=pymupdf.Matrix(scale, scale), alpha=False).save(image)
    stamp.write_text(digest + "\n")
    return True


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("slugs", nargs="*")
    parser.add_argument("--papers-dir", type=Path, default=Path("papers"))
    args = parser.parse_args()
    slugs = args.slugs or [p["slug"] for p in json.loads((args.papers_dir / "index.json").read_text())]
    count = sum(render_thumbnail(args.papers_dir / slug) for slug in slugs)
    print(f"{count} thumbnails generated; {len(slugs) - count} already current")


if __name__ == "__main__":
    main()
