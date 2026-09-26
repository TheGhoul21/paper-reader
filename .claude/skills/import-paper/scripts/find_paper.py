# /// script
# requires-python = ">=3.11"
# dependencies = ["requests"]
# ///
"""Find the paper behind a free-text reference (e.g. a bibliography entry pasted in a paper-request
issue) and report whether it's already in the library and under which licence it's distributed.

Usage:
    uv run find_paper.py "<reference text or link>" [--papers-dir papers] [--json]

Resolution order (first hit wins, but all arXiv candidates are listed for the human/agent to confirm):
  1. an arXiv id or arxiv.org URL in the text           → that paper
  2. a DOI in the text                                  → doi.org link (+ arXiv search by its title, if found)
  3. arXiv API title search: quoted title if present, else each sentence-like segment of the
     reference, scored by similarity to the returned titles

For arXiv candidates it also reads the licence from the abstract page: only CC-BY / CC-BY-SA /
CC0 (and similar) papers may be redistributed as the library does (the PDF is published verbatim);
arXiv's default "non-exclusive distribution" licence does not grant that.

It never downloads anything — `resolve_source.py` does that once the paper is confirmed.
"""
import argparse
import json
import re
import sys
import xml.etree.ElementTree as ET
from difflib import SequenceMatcher
from pathlib import Path

import requests

ARXIV_ID_RE = re.compile(r"(?:arxiv[:/ ]|abs/|pdf/)\s*(\d{4}\.\d{4,5})(v\d+)?", re.IGNORECASE)
BARE_ARXIV_RE = re.compile(r"\b(\d{4}\.\d{4,5})(v\d+)?\b")
DOI_RE = re.compile(r"\b(10\.\d{4,9}/[^\s\"<>]+[^\s\"<>.,;])")
ATOM = "{http://www.w3.org/2005/Atom}"
HEADERS = {"User-Agent": "paper-reader-find-paper/1.0 (https://github.com/TheGhoul21/paper-reader)"}
STOPWORDS = {"a", "an", "the", "of", "for", "and", "in", "on", "with", "via", "to", "by", "from", "at", "as", "its", "is", "are", "using"}
REDISTRIBUTABLE = ("creativecommons.org/licenses/by/", "creativecommons.org/licenses/by-sa/", "creativecommons.org/publicdomain/zero/")


def normalize(text: str) -> str:
    return re.sub(r"[^a-z0-9]+", " ", text.lower()).strip()


def arxiv_query(search: str, max_results: int = 5) -> list[dict]:
    resp = requests.get(
        "https://export.arxiv.org/api/query",
        params={"search_query": search, "max_results": max_results},
        headers=HEADERS,
        timeout=30,
    )
    resp.raise_for_status()
    out = []
    for entry in ET.fromstring(resp.text).findall(f"{ATOM}entry"):
        arxiv_id = (entry.findtext(f"{ATOM}id") or "").rsplit("/abs/", 1)[-1]
        title = re.sub(r"\s+", " ", (entry.findtext(f"{ATOM}title") or "").strip())
        authors = [(a.findtext(f"{ATOM}name") or "").strip() for a in entry.findall(f"{ATOM}author")]
        out.append({"arxivId": re.sub(r"v\d+$", "", arxiv_id), "title": title, "authors": authors,
                    "published": (entry.findtext(f"{ATOM}published") or "")[:10]})
    return out


def arxiv_license(arxiv_id: str) -> str | None:
    try:
        html = requests.get(f"https://arxiv.org/abs/{arxiv_id}", headers=HEADERS, timeout=30).text
    except requests.RequestException:
        return None
    m = re.search(r'href="(https?://(?:creativecommons\.org|arxiv\.org)/licenses/[^"]+|https?://creativecommons\.org/publicdomain/[^"]+)"', html)
    return m.group(1) if m else None


def title_segments(reference: str) -> list[str]:
    """Plausible title fragments of a bibliography entry, best first."""
    ref = re.sub(r"^\s*\[?\d{1,3}[\].]\s*", "", reference)  # "[12] " / "12. "
    # "Authors (2019): Title. Venue" (EPTCS/Springer style) — drop everything up to the year.
    ref = re.sub(r"^.{0,300}?\((?:19|20)\d{2}[a-z]?\)\s*[:.]\s*", "", ref)
    quoted = re.findall(r"[“\"']([^”\"']{15,})[”\"']", ref)
    segments = [s.strip(" ,.") for s in re.split(r"(?<=[a-z0-9)])\.\s+|\s*,\s*(?=[A-Z][a-z]+ [a-z])", ref)]
    # Titles are long-ish word runs; author lists are full of initials and commas, venues of digits.
    candidates = [s for s in segments if len(s.split()) >= 4 and not re.search(r"\b[A-Z]\.\s*[A-Z]?\.?", s) and sum(c.isdigit() for c in s) < 6]
    return quoted + sorted(candidates, key=lambda s: -len(s))


def library_matches(papers_dir: Path, arxiv_id: str | None, title: str | None) -> list[str]:
    hits = []
    for meta_path in papers_dir.glob("*/meta.json"):
        meta = json.loads(meta_path.read_text())
        if arxiv_id and arxiv_id in str(meta.get("sourceRef", "")):
            hits.append(meta["slug"])
        elif title and SequenceMatcher(None, normalize(title), normalize(meta.get("title", ""))).ratio() > 0.9:
            hits.append(meta["slug"])
    return hits


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("reference")
    parser.add_argument("--papers-dir", default="papers")
    parser.add_argument("--json", action="store_true")
    args = parser.parse_args()
    ref = args.reference
    papers_dir = Path(args.papers_dir)
    result: dict = {"reference": ref, "doi": None, "candidates": []}

    m = ARXIV_ID_RE.search(ref) or BARE_ARXIV_RE.search(ref)
    if m:
        found = arxiv_query(f"id:{m.group(1)}", 1) or [{"arxivId": m.group(1), "title": None, "authors": [], "published": ""}]
        result["candidates"] = [{**found[0], "score": 1.0, "via": "arXiv id in the text"}]
    else:
        doi = DOI_RE.search(ref)
        if doi:
            result["doi"] = f"https://doi.org/{doi.group(1)}"
        seen = set()
        for segment in title_segments(ref)[:4]:
            words = [w for w in normalize(segment).split() if w not in STOPWORDS and len(w) > 1][:10]
            if not words:
                continue
            phrase = normalize(segment)
            hits = arxiv_query(f'ti:"{phrase}"', 5) or arxiv_query("ti:" + " AND ti:".join(words), 5)
            for hit in hits:
                if hit["arxivId"] in seen:
                    continue
                seen.add(hit["arxivId"])
                score = SequenceMatcher(None, normalize(segment), normalize(hit["title"])).ratio()
                result["candidates"].append({**hit, "score": round(score, 3), "via": f'title search "{segment[:60]}"'})
        result["candidates"].sort(key=lambda c: -c["score"])
        result["candidates"] = result["candidates"][:5]

    for c in result["candidates"][:3]:
        c["license"] = arxiv_license(c["arxivId"])
        c["redistributable"] = bool(c["license"] and any(r in c["license"] for r in REDISTRIBUTABLE))
        c["inLibrary"] = library_matches(papers_dir, c["arxivId"], c.get("title"))

    if args.json:
        print(json.dumps(result, ensure_ascii=False, indent=2))
        return 0
    print(f"Reference: {ref[:200]}")
    if result["doi"]:
        print(f"DOI: {result['doi']}")
    if not result["candidates"]:
        print("No arXiv candidate found. Try the DOI / publisher page, Google Scholar, or ask the requester for a link.")
        return 1
    for c in result["candidates"]:
        flag = "" if "license" not in c else ("  licence OK" if c["redistributable"] else f"  licence NOT redistributable ({c['license'] or 'unknown'})")
        lib = f"  ALREADY IN LIBRARY: {', '.join(c['inLibrary'])}" if c.get("inLibrary") else ""
        print(f"[{c['score']:.2f}] arXiv:{c['arxivId']}  {c['title']}  ({', '.join(c['authors'][:3])}{' et al.' if len(c['authors']) > 3 else ''}, {c['published']}){flag}{lib}")
        print(f"        via {c['via']} — https://arxiv.org/abs/{c['arxivId']}")
    best = result["candidates"][0]
    if best["score"] < 0.8:
        print("Low confidence: confirm the match by hand (authors, year, venue) before importing.")
    return 0


if __name__ == "__main__":
    sys.exit(main())
