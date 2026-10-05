# /// script
# requires-python = ">=3.11"
# dependencies = ["pymupdf"]
# ///
"""Render reviewed figure crops declared in structure.json.

uv run scripts/render-figures.py [slug ...]
Coordinates are reviewed against the PDF; figure boundaries are never guessed.
"""
import argparse
import hashlib
import json
from pathlib import Path

import pymupdf


def render_figures(folder):
    structure = folder / "structure.json"
    figures = json.loads(structure.read_text()).get("figures", []) if structure.exists() else []
    if not figures:
        return 0
    pdf = folder / "source/paper.pdf"
    digest = hashlib.sha256(pdf.read_bytes()).hexdigest()
    count = 0
    with pymupdf.open(pdf) as doc:
        for figure in figures:
            if figure["sourceSha256"] != digest:
                raise ValueError(f"{folder.name}/{figure['id']}: source changed; review the crop and animation")
            image = folder / figure["image"]
            if folder.resolve() not in image.resolve().parents:
                raise ValueError("Figure image must stay inside the paper folder")
            stamp = image.with_suffix(".sha256")
            identity = hashlib.sha256(json.dumps([digest, figure["page"], figure["rect"], 1200], separators=(",", ":")).encode()).hexdigest()
            if image.exists() and stamp.exists() and stamp.read_text().strip() == identity:
                continue
            page = doc[figure["page"]]
            x0, y0, x1, y1 = figure["rect"]
            if not (0 <= x0 < x1 <= 1 and 0 <= y0 < y1 <= 1):
                raise ValueError("Invalid normalized figure crop")
            crop = pymupdf.Rect(x0 * page.rect.width, y0 * page.rect.height, x1 * page.rect.width, y1 * page.rect.height)
            scale = 1200 / crop.width
            image.parent.mkdir(parents=True, exist_ok=True)
            page.get_pixmap(matrix=pymupdf.Matrix(scale, scale), clip=crop, alpha=False).save(image)
            stamp.write_text(identity + "\n")
            count += 1
    return count


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("slugs", nargs="*")
    args = parser.parse_args()
    slugs = args.slugs or [p["slug"] for p in json.loads(Path("papers/index.json").read_text())]
    print(f"{sum(render_figures(Path('papers') / slug) for slug in slugs)} figures generated")


if __name__ == "__main__":
    main()
