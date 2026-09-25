# /// script
# requires-python = ">=3.11"
# dependencies = ["pymupdf"]
# ///
"""Extract paragraph-level text blocks with normalized bounding boxes from a PDF.

Usage:
    uv run extract_blocks.py <pdf-path> [--out blocks.json] [--all]

Emits a JSON array of blocks in reading order:
    [{"id", "page" (0-indexed), "order", "kind", "section"?, "rects": [[x0,y0,x1,y1], ...]
      (fractions of page width/height, top-left origin), "text"}]

By default only blocks worth a comment are emitted (kind "body" or "caption");
`--all` emits every block with its kind, for debugging the classification.

Kinds (heuristic, from font size/weight, position and text patterns):
    title, authors      front matter on the first page before the abstract/first heading
                        (title, author names, affiliations, emails, dates, DOIs, …)
    metadata            arXiv stamps, DOIs, "Received: …", copyright, keywords, CCS
                        concepts, corresponding-author footnotes, emails
    heading             section headings — not emitted, but they set the `section`
                        of the blocks that follow them
    body                ordinary paragraphs (a heading glued to the start of its first
                        paragraph, like "AbstractQuantum computing…", stays body)
    caption             "Figure 3: …", "Table 2. …"
    equation            display-math blocks — merged into the preceding body block
                        (its rect is appended), so the formula is explained in context
    reference           bibliography entries (everything after a References heading)
    fragment            very short non-heading text, usually labels inside figures
                        or page numbers

PyMuPDF's block bbox coordinates already use a top-left-origin, y-down system
(like screen/canvas pixels), so no coordinate flip is needed here — only a
divide-by-page-size to get fractions.

Reading order: single-column pages are sorted by (y0, x0). A simple two-column
heuristic clusters block x centres into two groups around the page midpoint;
if both clusters are populated, column 1 (left) is emitted top-to-bottom
before column 2 (right). Full-width blocks at the top of a page (title,
abstract) come first. This heuristic is not perfect — inspect the output
before trusting it, especially on pages with figures, tables, or captions.
"""
import argparse
import json
import re
import sys
from collections import Counter

import pymupdf

BOLD_FLAG = 16

METADATA_RE = re.compile(
    r"(arXiv:\d|doi\.org|\bdoi:|\bDOI\b|^Received:|Accepted:|©|\(c\) ?\d{4}|\bcopyright\b|"
    r"^Keywords\b|^Key words\b|^Index Terms\b|^CCS Concepts|ACM Reference Format|"
    r"^\W?\s*Corresponding author|^\*?\s*Contact author|Permission to make digital|"
    r"licen[cs]ed under|Creative Commons|^Published\b|^Preprint\b|^Submitted\b)",
    re.IGNORECASE,
)
EMAIL_RE = re.compile(r"[\w.+-]+@[\w-]+\.[\w.-]+")
# "Figure 3: …", "Fig. 1 Example of …", "TABLE II. …" — but not body text like "Figure 2a,b illustrate …".
CAPTION_RE = re.compile(
    r"^(Fig\.?|Figure|Table|Algorithm|Listing)\s*([A-Z]?\d+|[IVX]+)[a-z]?(\s*[.:|—–-]|\s+[A-Z(])", re.IGNORECASE
)
REF_ENTRY_RE = re.compile(r"^\[\d+\]\s*\S")
PAGE_FURNITURE_RE = re.compile(r"^(\d+\s+)?page \d+ of \d+(\s+\d+)?$|^\d+$", re.IGNORECASE)
AFFILIATION_RE = re.compile(
    r"\b(Universit|Department|Dept\.|Institut|Laborator|Academy|School of|College|Ltd|Inc\.|GmbH|Center|Centre|Research)",
    re.IGNORECASE,
)
NUMBERED_HEADING_RE = re.compile(r"^(\d+(\.\d+)*\.?|[IVX]+\.|[A-Z]\.|(?i:appendix)\s+[A-Z]\d*:?)\s*[A-Z][A-Za-z]")
# Appendix headings with the letter glued on by the text extraction: "AElectronic Resources", "B.2Proofs".
LETTER_HEADING_RE = re.compile(r"^[A-Z](\.\d+)*\s?[A-Z][a-z]")
UNNUMBERED_HEADINGS = {
    "abstract", "introduction", "conclusion", "conclusions", "discussion", "related work",
    "acknowledgment", "acknowledgments", "acknowledgement", "acknowledgements",
    "references", "bibliography", "appendix", "appendixes", "appendices", "summary",
    "methods", "results", "background", "data availability", "author contributions",
    "competing interests", "funding", "declarations",
}
REFERENCES_RE = re.compile(r"^(\d+\.?\s*)?(references|bibliography|literature cited)\b", re.IGNORECASE)
# A run of capitalised names, optionally joined by "and"/"&"/commas: "Andrew Fagan Ross Duncan".
NAMES_RE = re.compile(r"(?:(?:[A-Z][\w'’.-]*\.?|and|&)\s*){2,}")


def figure_regions_of(page):
    """Bounding boxes of vector drawings (plots, circuit diagrams, table rules) and raster images."""
    regions = []
    try:
        regions += [r for r in page.cluster_drawings() if r.width > 20 and r.height > 20]
    except Exception:
        pass
    for info in page.get_image_info():
        regions.append(pymupdf.Rect(info["bbox"]))
    return regions


def in_figure_region(rect, regions):
    area = rect.get_area()
    if area <= 0:
        return False
    return any((rect & r).get_area() / area > 0.7 for r in regions)


def page_blocks(page):
    figure_regions = figure_regions_of(page)
    raw = page.get_text("dict")["blocks"]
    out = []
    pw, ph = page.rect.width, page.rect.height
    for b in raw:
        if b.get("type") != 0:
            continue
        lines = []
        size_chars = Counter()
        bold_chars = 0
        total_chars = 0
        for line in b.get("lines", []):
            line_text = ""
            for span in line.get("spans", []):
                t = span["text"]
                line_text += t
                n = len(t.strip())
                size_chars[round(span["size"], 1)] += n
                total_chars += n
                if span["flags"] & BOLD_FLAG or "bold" in span.get("font", "").lower():
                    bold_chars += n
            line_text = line_text.strip()
            if line_text:
                lines.append(line_text)
        # Lines join with a space, except after a line-final hyphen (LaTeX hyphenation).
        text = ""
        for line in lines:
            if not text:
                text = line
            elif text.endswith("-"):
                text += line
            else:
                text += " " + line
        text = " ".join(text.split())
        if not text:
            continue
        x0, y0, x1, y1 = b["bbox"]
        in_figure = in_figure_region(pymupdf.Rect(b["bbox"]), figure_regions)
        out.append(
            {
                "text": text,
                "rect": [x0 / pw, y0 / ph, x1 / pw, y1 / ph],
                "size": size_chars.most_common(1)[0][0] if size_chars else 0,
                "bold": total_chars > 0 and bold_chars / total_chars > 0.6,
                "chars": total_chars,
                "size_chars": size_chars,
                "in_figure": in_figure,
            }
        )
    return out


def furniture_key(text):
    # Page numbers change from page to page: "86 Optimising Clifford Circuits" and
    # "88 Optimising Clifford Circuits" are the same running header.
    return re.sub(r"\d+", "#", text)


def strip_running_headers_footers(pages_blocks):
    counts = Counter()
    for blocks in pages_blocks:
        for key in {furniture_key(b["text"]) for b in blocks if b["rect"][1] < 0.08 or b["rect"][1] > 0.92}:
            counts[key] += 1
    repeated = {key for key, n in counts.items() if n >= 3}
    return [
        [b for b in blocks if not ((b["rect"][1] < 0.08 or b["rect"][1] > 0.92) and furniture_key(b["text"]) in repeated)]
        for blocks in pages_blocks
    ]


def order_page_blocks(blocks):
    if not blocks:
        return blocks
    xs = [(b["rect"][0] + b["rect"][2]) / 2 for b in blocks]
    widths = [b["rect"][2] - b["rect"][0] for b in blocks]
    left = [b for b, x, w in zip(blocks, xs, widths) if x < 0.48 and w < 0.55]
    right = [b for b, x, w in zip(blocks, xs, widths) if x >= 0.52 and w < 0.55]
    middle = [b for b in blocks if b not in left and b not in right]
    # Only real paragraphs count as evidence of columns — a short heading on the left and a
    # footnote on the right don't make a single-column page two-column.
    def substantial(bs):
        return sum(1 for b in bs if len(b["text"].split()) >= 15)

    is_two_column = substantial(left) >= 2 and substantial(right) >= 2
    if is_two_column:
        # Full-width / centred blocks (title, abstract, wide figures' captions, a centred
        # page number) are placed by their y relative to the columns: those above the
        # columns' start go first, everything else after the column it's nearest to.
        col_top = min(b["rect"][1] for b in left + right)
        top = sorted([b for b in middle if b["rect"][1] < col_top], key=lambda b: b["rect"][1])
        rest = [b for b in middle if b["rect"][1] >= col_top]
        left_all = sorted(left + [b for b in rest if b["rect"][0] < 0.45], key=lambda b: b["rect"][1])
        right_all = sorted(right + [b for b in rest if b["rect"][0] >= 0.45], key=lambda b: b["rect"][1])
        return top + left_all + right_all
    return sorted(blocks, key=lambda b: (b["rect"][1], b["rect"][0]))


def body_font_size(pages_blocks):
    sizes = Counter()
    for blocks in pages_blocks:
        for b in blocks:
            sizes.update(b["size_chars"])
    return sizes.most_common(1)[0][0] if sizes else 10


def looks_like_equation(text):
    letters = sum(c.isalpha() for c in text)
    words = re.findall(r"[A-Za-z]{3,}", text)
    mathy = sum(c in "=+−-∑∏∫√≤≥≈∈∀∃⊗⊕†⟨⟩|()[]{}^_" for c in text)
    return len(text) >= 4 and (mathy >= 2 or re.search(r"\(\d+[a-z]?\)$", text)) and len(words) <= max(3, letters // 12)


def front_matter_zone(first_page):
    """(y, title_size): page-0 blocks ending above y — the abstract, or with no "Abstract"
    label the first long paragraph or numbered heading — are front matter; the biggest
    font among them is the title."""
    starts = [b["rect"][1] for b in first_page if b["text"].lower().startswith("abstract")]
    if not starts:
        starts = [
            b["rect"][1]
            for b in first_page
            if (NUMBERED_HEADING_RE.match(b["text"]) and len(b["text"].split()) <= 8)
            or (len(b["text"].split()) >= 40 and b["text"].endswith(".") and not METADATA_RE.search(b["text"]))
        ]
    if not starts:
        return 0, None
    y = min(starts) + 0.005
    sizes = [b["size"] for b in first_page if b["rect"][3] <= y]
    return y, (max(sizes) if sizes else None)


def classify(pages_blocks):
    body_size = body_font_size(pages_blocks)
    zone_y, title_size = front_matter_zone(pages_blocks[0]) if pages_blocks else (0, None)
    in_front_matter = True
    in_references = False
    after_meta_label = False
    for page_index, blocks in enumerate(pages_blocks):
        for b in blocks:
            text = b["text"]
            words = len(text.split())
            lower = text.lower().rstrip(".: ")
            is_bigger = b["size"] >= body_size + 0.8
            alpha_words = re.findall(r"[A-Za-z]{2,}", text)
            heading_like = (
                words <= 14
                and not text.endswith((".", "-", ","))
                and "=" not in text
                and not b["in_figure"]
                and len(alpha_words) >= 1
                # IEEE-style small caps headings ("I. INTRODUCTION") can be ~2pt below body size.
                and (b["size"] >= body_size - 1.5 or (text.isupper() and b["size"] >= body_size - 2.5))
                and (
                    NUMBERED_HEADING_RE.match(text)
                    or lower in UNNUMBERED_HEADINGS
                    or ((b["bold"] or is_bigger) and LETTER_HEADING_RE.match(text))
                    or (
                        (b["bold"] or is_bigger)
                        and b["size"] >= body_size - 0.3
                        and words <= 10
                        and text[:1].isupper()
                        and len(alpha_words) >= 2
                    )
                )
            )
            is_footnote = b["size"] <= body_size - 1 and b["rect"][1] > 0.75

            if PAGE_FURNITURE_RE.match(text):
                kind = "fragment"
            elif after_meta_label:
                kind = "metadata"  # the content of a "Keywords" / "CCS Concepts" label block
            elif page_index == 0 and b["rect"][3] <= zone_y:
                # Above the abstract: title, authors, affiliations, dates, venue, emails.
                if title_size is not None and b["size"] >= title_size - 0.3:
                    kind = "title"
                elif METADATA_RE.search(text) or EMAIL_RE.search(text):
                    kind = "metadata"
                else:
                    kind = "authors"
            elif REFERENCES_RE.match(text) and words <= 4:
                kind = "heading"
                in_references = True
                in_front_matter = False
            elif (
                in_references
                and not (heading_like and not REF_ENTRY_RE.match(text))
                # A long body-size paragraph with no year in it isn't a citation: we're past the
                # bibliography (into an appendix whose heading wasn't recognised).
                and not (
                    b["size"] >= body_size - 0.2
                    and words >= 25
                    and not REF_ENTRY_RE.match(text)
                    and not re.search(r"\b(19|20)\d{2}\b", text)
                )
            ):
                kind = "reference"
            elif REF_ENTRY_RE.match(text) and page_index >= len(pages_blocks) // 2:
                # Bibliographies with no "References" heading (e.g. APS style).
                kind = "reference"
                in_references = True
            elif METADATA_RE.search(text) or (EMAIL_RE.search(text) and words <= 12):
                kind = "metadata"
            elif page_index == 0 and b["rect"][1] < 0.4 and words <= 16 and not NUMBERED_HEADING_RE.match(text) and NAMES_RE.fullmatch(re.sub(r"[\d,∗*†‡§¶·]+", " ", text).strip()):
                kind = "authors"  # a line of author names, wherever it ended up in the reading order
            elif page_index == 0 and (is_footnote or (AFFILIATION_RE.search(text) and words <= 40 and (b["rect"][1] < 0.45 or not text.endswith(".")))):
                kind = "authors"  # affiliation lines and first-page author footnotes
            elif in_front_matter and page_index == 0 and (lower.startswith("abstract") or NUMBERED_HEADING_RE.match(text)):
                in_front_matter = False
                kind = "heading" if heading_like else "body"
            elif in_front_matter and page_index == 0 and words < 60:
                kind = "title" if b["size"] >= body_size + 3 else "authors"
            elif CAPTION_RE.match(text) and not b["in_figure"]:
                kind = "caption"
            elif b["in_figure"] and words < 15:
                kind = "fragment"  # labels, axis ticks and legends inside a figure
            elif heading_like and not looks_like_equation(text):
                kind = "heading"
                in_front_matter = False
                in_references = False  # a heading after the bibliography starts an appendix
            elif looks_like_equation(text):
                kind = "equation"
            elif words < 6 or re.fullmatch(r"[\d\s/of]+", text, re.IGNORECASE):
                kind = "fragment"
            else:
                kind = "body"
                if page_index > 0:
                    in_front_matter = False
            b["kind"] = kind
            after_meta_label = kind == "metadata" and words <= 3 and bool(METADATA_RE.search(text))


def clean_heading(text):
    # "2.1Circuit sensitivity" / "1Introduction" → "2.1 Circuit sensitivity" / "1 Introduction"
    return re.sub(r"^(\d+(\.\d+)*\.?)(?=[A-Z])", r"\1 ", text).strip()


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("pdf_path")
    parser.add_argument("--out", default=None, help="write JSON here instead of stdout")
    parser.add_argument("--all", action="store_true", help="emit every block with its kind (debug)")
    args = parser.parse_args()

    doc = pymupdf.open(args.pdf_path)
    pages_blocks = [page_blocks(page) for page in doc]
    pages_blocks = strip_running_headers_footers(pages_blocks)
    pages_blocks = [order_page_blocks(blocks) for blocks in pages_blocks]
    classify(pages_blocks)

    result = []
    section = None
    for page_index, blocks in enumerate(pages_blocks):
        for b in blocks:
            if b["kind"] == "heading":
                section = clean_heading(b["text"])
            entry = {
                "page": page_index,
                "kind": b["kind"],
                **({"section": section} if section and b["kind"] != "heading" else {}),
                "rects": [b["rect"]],
                "text": b["text"],
            }
            if args.all:
                result.append(entry)
                continue
            if b["kind"] == "equation" and result and result[-1]["page"] == page_index and result[-1]["kind"] == "body":
                result[-1]["rects"].append(b["rect"])
                result[-1]["text"] += " " + b["text"]
            elif b["kind"] in ("body", "caption"):
                result.append(entry)

    for order, entry in enumerate(result):
        entry["id"] = f"p{order:04d}"
        entry["order"] = order
    result = [{"id": e["id"], "page": e["page"], "order": e["order"], **{k: v for k, v in e.items() if k not in ("id", "page", "order")}} for e in result]

    output = json.dumps(result, indent=2, ensure_ascii=False)
    if args.out:
        with open(args.out, "w") as f:
            f.write(output)
    else:
        print(output)

    kinds = Counter(b["kind"] for blocks in pages_blocks for b in blocks)
    print(
        f"{len(result)} blocks emitted from {len(pages_blocks)} pages; classified: "
        + ", ".join(f"{k} {n}" for k, n in kinds.most_common()),
        file=sys.stderr,
    )


if __name__ == "__main__":
    main()
