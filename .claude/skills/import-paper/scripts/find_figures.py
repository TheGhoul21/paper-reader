# /// script
# requires-python = ">=3.11"
# dependencies = ["pymupdf"]
# ///
"""Propose crop rectangles for the figures of a paper, to review before declaring them.

Usage:
    uv run find_figures.py <slug> [--preview DIR] [--pad 0.006]

For every "Figure N" / "Fig. N" caption in papers/<slug>/source/paper.pdf, unions the
vector drawings and raster images in the caption's column directly above it (or below,
when nothing is above) plus the text labels inside them, and prints JSON candidates:
    [{"id": "figure-1", "label": "Figura 1", "page", "rect" (normalized, top-left origin),
      "captionParagraph"?, "captionText"}]
`captionParagraph` is the paragraphs.json passage whose anchor on that page overlaps the
caption. `--preview DIR` renders each candidate exactly as render-figures.py does (1200 px
wide), so the crop can be inspected before it goes into structure.json.

A caption with no drawing found above or below it is listed with "rect": null — find
the figure on the page and write its rect by hand.

These are proposals: multi-panel figures, figures next to tables, and full-width figures in
two-column papers often need the rect adjusted by hand. Always look at the preview.
"""
import argparse
import json
import re
from pathlib import Path

import pymupdf

# A caption, not body text that cites a figure ("Figure 2a,b illustrate …", "Figure 9 compares …").
FIGURE_RE = re.compile(r"^(Fig\.?|Figure)\s*(\d+)(\s*[.:|—–-]|\s+(?-i:[A-Z(]))", re.IGNORECASE)


def regions_of(page):
    """All drawing clusters and images; the large ones seed a figure, small ones only extend it."""
    regions = []
    try:
        regions += page.cluster_drawings()
    except Exception:
        pass
    regions += [pymupdf.Rect(i["bbox"]) for i in page.get_image_info()]
    return [r for r in regions if r.get_area() < 0.9 * page.rect.get_area()]


def large(r):
    return r.width > 20 and r.height > 20


def overlaps_columns(a, b):
    return min(a.x1, b.x1) - max(a.x0, b.x0) > 0.3 * min(a.width, b.width)


def figure_rect(page, caption, regions, taken, pad):
    """Grow from the caption through stacked drawings and short labels, stopping at prose or a gap.

    Searches above the caption first, then below. Short text blocks (panel titles, axis
    labels) bridge stacked panels; a long text block (body prose, another caption) stops it.
    """
    texts = []
    for x0, y0, x1, y1, text, *_ in page.get_text("blocks"):
        block = pymupdf.Rect(x0, y0, x1, y1)
        if block.intersects(caption) or not overlaps_columns(block, caption):
            continue
        if block.y1 < 0.05 * page.rect.height or block.y0 > 0.95 * page.rect.height:
            continue  # running headers, page numbers
        # Prose = many real words on full lines; digit grids and one-per-line legends are labels.
        words = sum(1 for w in text.split() if sum(c.isalpha() for c in w) >= 3)
        lines = max(1, len(text.strip().splitlines()))
        prose = words > 10 and words / lines >= 4
        texts.append((block, prose or bool(FIGURE_RE.match(text.strip()))))
    for up in (True, False):
        items = []
        for r in regions:
            if not large(r) or not overlaps_columns(r, caption):
                continue
            # A drawing cluster can run under its own caption (background clips): cut it there.
            r = pymupdf.Rect(r.x0, r.y0, r.x1, min(r.y1, caption.y0)) if up else \
                pymupdf.Rect(r.x0, max(r.y0, caption.y1), r.x1, r.y1)
            if r.height > 5:
                items.append((r, "drawing"))
        items += [(r, "prose" if prose else "label") for r, prose in texts]
        items = [(r, k) for r, k in items if (r.y1 <= caption.y0 + 2 if up else r.y0 >= caption.y1 - 2)]
        items = [(r, k) for r, k in items if not any(r.intersects(t) for t in taken)]
        items.sort(key=lambda item: -item[0].y1 if up else item[0].y0)
        rect, edge, pending = None, caption.y0 if up else caption.y1, []
        for r, kind in items:
            gap = edge - r.y1 if up else r.y0 - edge
            if kind == "prose" or gap > 40:
                break
            if kind == "label":
                # Labels bridge stacked panels only if another drawing follows them.
                pending.append(r)
                edge = min(edge, r.y0) if up else max(edge, r.y1)
                continue
            rect = pymupdf.Rect(r) if rect is None else rect | r
            for label in pending:
                rect |= label
            pending = []
            edge = rect.y0 if up else rect.y1
        if rect is None:
            continue
        # Absorb drawings, small clusters (panel headers, legends) and labels touching the
        # union, repeatedly, without crossing the caption or into the page header/footer.
        top, bottom = 0.05 * page.rect.height, 0.95 * page.rect.height
        touching = [r for r in regions] + [r for r, prose in texts if not prose]
        grown = True
        while grown:
            grown = False
            for r in touching:
                if r.intersects(rect + (-6, -6, 6, 6)) and not r.intersects(caption) and not r in rect:
                    if r.y0 < top or r.y1 > bottom:
                        continue
                    rect |= r
                    grown = True
        rect.y0, rect.y1 = max(rect.y0, top), min(rect.y1, bottom)
        rect = (rect + (-pad * page.rect.width, -pad * page.rect.height,
                        pad * page.rect.width, pad * page.rect.height)) & page.rect
        # Trim back off any prose (neighbouring captions, body text) that a raster box or the
        # padding reached into.
        for r, prose in texts:
            if prose and r.intersects(rect):
                if (r.y0 + r.y1) / 2 < (rect.y0 + rect.y1) / 2:
                    rect.y0 = max(rect.y0, r.y1 + 1)
                else:
                    rect.y1 = min(rect.y1, r.y0 - 1)
        if up:
            rect.y1 = min(rect.y1, caption.y0 - 1)
        else:
            rect.y0 = max(rect.y0, caption.y1 + 1)
        return rect
    return None


def caption_paragraph(paragraphs, page_no, caption, page_rect):
    norm = [caption.x0 / page_rect.width, caption.y0 / page_rect.height,
            caption.x1 / page_rect.width, caption.y1 / page_rect.height]
    for p in paragraphs:
        for anchor in p.get("anchors") or [{"page": p["page"], "rects": p["rects"]}]:
            if anchor["page"] != page_no:
                continue
            for r in anchor["rects"]:
                if min(r[2], norm[2]) > max(r[0], norm[0]) and min(r[3], norm[3]) > max(r[1], norm[1]):
                    return p["id"]
    return None


def main():
    parser = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    parser.add_argument("slug")
    parser.add_argument("--papers-dir", default="papers")
    parser.add_argument("--preview", help="directory to render candidate crops into")
    parser.add_argument("--pad", type=float, default=0.006, help="normalized padding around each crop")
    args = parser.parse_args()

    folder = Path(args.papers_dir) / args.slug
    paragraphs_path = folder / "paragraphs.json"
    paragraphs = json.loads(paragraphs_path.read_text()) if paragraphs_path.exists() else []
    out, seen = [], set()
    with pymupdf.open(folder / "source/paper.pdf") as doc:
        for page in doc:
            regions = regions_of(page)
            taken = []
            for x0, y0, x1, y1, text, *_ in page.get_text("blocks"):
                match = FIGURE_RE.match(text.strip())
                if not match or match.group(2) in seen:
                    continue
                caption = pymupdf.Rect(x0, y0, x1, y1)
                rect = figure_rect(page, caption, regions, taken, args.pad)
                if rect is None:
                    # Side captions, figures on another page: report it, crop by hand.
                    out.append({"id": f"figure-{match.group(2)}", "label": f"Figura {match.group(2)}",
                                "page": page.number, "rect": None,
                                "captionText": " ".join(text.split())[:160]})
                    seen.add(match.group(2))
                    continue
                taken.append(rect)
                seen.add(match.group(2))
                w, h = page.rect.width, page.rect.height
                norm = [round(rect.x0 / w, 3), round(rect.y0 / h, 3), round(rect.x1 / w, 3), round(rect.y1 / h, 3)]
                entry = {"id": f"figure-{match.group(2)}", "label": f"Figura {match.group(2)}",
                         "page": page.number, "rect": norm}
                para = caption_paragraph(paragraphs, page.number, caption, page.rect)
                if para:
                    entry["captionParagraph"] = para
                entry["captionText"] = " ".join(text.split())[:160]
                out.append(entry)
                if args.preview:
                    target = Path(args.preview) / f"{entry['id']}.png"
                    target.parent.mkdir(parents=True, exist_ok=True)
                    crop = pymupdf.Rect(norm[0] * w, norm[1] * h, norm[2] * w, norm[3] * h)
                    scale = 1200 / crop.width
                    page.get_pixmap(matrix=pymupdf.Matrix(scale, scale), clip=crop, alpha=False).save(target)
    out.sort(key=lambda e: int(e["id"].split("-")[1]))
    print(json.dumps(out, ensure_ascii=False, indent=2))


if __name__ == "__main__":
    main()
