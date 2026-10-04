# /// script
# requires-python = ">=3.11"
# dependencies = ["requests"]
# ///
"""Resolve a paper input (arXiv id/URL, direct PDF URL, or local path) into
a downloaded PDF plus basic metadata.

Usage:
    uv run resolve_source.py <input> [--papers-dir papers] [--slug SLUG]

Prints a single JSON object to stdout:
    {"slug", "title", "authors", "sourceType", "sourceRef", "sourceVersion"?, "sourceSha256", "pdfPath"}

Downloads/copies the PDF to <papers-dir>/<slug>/source/paper.pdf.
Does NOT write meta.json — the caller (the import-paper skill) assembles the
final meta.json once it also knows the interview answers (language, background).
"""
import argparse
import hashlib
import json
import re
import shutil
import sys
import xml.etree.ElementTree as ET
from pathlib import Path
from urllib.parse import urlparse

import requests

ARXIV_ID_RE = re.compile(r"(\d{4}\.\d{4,5})(v\d+)?")
ATOM_NS = "{http://www.w3.org/2005/Atom}"


def detect_arxiv_id(raw: str) -> str | None:
    m = ARXIV_ID_RE.search(raw)
    return m.group(0) if m else None


def fetch_arxiv_meta(arxiv_id: str) -> dict:
    resp = requests.get(
        "http://export.arxiv.org/api/query",
        params={"id_list": arxiv_id},
        timeout=30,
    )
    resp.raise_for_status()
    root = ET.fromstring(resp.text)
    entry = root.find(f"{ATOM_NS}entry")
    if entry is None:
        raise RuntimeError(f"arXiv API returned no entry for {arxiv_id}")
    title = entry.findtext(f"{ATOM_NS}title", default="").strip().replace("\n", " ")
    title = re.sub(r"\s+", " ", title)
    authors = [
        (a.findtext(f"{ATOM_NS}name") or "").strip()
        for a in entry.findall(f"{ATOM_NS}author")
    ]
    entry_id = entry.findtext(f"{ATOM_NS}id", default="")
    version = re.search(r"v\d+$", entry_id)
    return {"title": title, "authors": [a for a in authors if a], **({"sourceVersion": version.group(0)} if version else {})}


def slugify(title: str, papers_dir: Path) -> str:
    base = re.sub(r"[^a-z0-9]+", "-", title.lower()).strip("-")
    base = "-".join(base.split("-")[:8]) or "paper"
    slug = base
    n = 2
    while (papers_dir / slug).exists():
        slug = f"{base}-{n}"
        n += 1
    return slug


def download(url: str, dest: Path) -> None:
    resp = requests.get(url, timeout=60, headers={"User-Agent": "paper-reader-import/1.0"})
    resp.raise_for_status()
    dest.write_bytes(resp.content)


def title_from_pdf_filename(raw: str) -> str:
    name = Path(urlparse(raw).path if raw.startswith("http") else raw).stem
    return re.sub(r"[-_]+", " ", name).strip().title() or "Untitled"


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("input", help="arXiv id/URL, direct PDF URL, or local file path")
    parser.add_argument("--papers-dir", default="papers")
    parser.add_argument("--slug", default=None)
    parser.add_argument("--title", default=None, help="override title (e.g. when caller already knows it)")
    parser.add_argument("--authors", default=None, help="comma-separated authors override")
    args = parser.parse_args()

    papers_dir = Path(args.papers_dir)
    papers_dir.mkdir(parents=True, exist_ok=True)

    raw = args.input.strip()
    arxiv_id = detect_arxiv_id(raw) if ("arxiv" in raw.lower() or ARXIV_ID_RE.fullmatch(raw)) else None

    if arxiv_id:
        source_type = "arxiv"
        source_ref = arxiv_id
        try:
            meta = fetch_arxiv_meta(arxiv_id)
        except Exception as exc:
            print(f"warning: arXiv metadata API failed ({exc}); falling back to id as title", file=sys.stderr)
            meta = {"title": arxiv_id, "authors": []}
        title = args.title or meta["title"]
        authors = args.authors.split(",") if args.authors else meta["authors"]
        if not re.search(r"v\d+$", arxiv_id) and meta.get("sourceVersion"):
            arxiv_id += meta["sourceVersion"]
            source_ref = arxiv_id
        if not re.search(r"v\d+$", arxiv_id):
            raise RuntimeError("Cannot pin the arXiv revision; retry metadata lookup or provide an explicit versioned ID (vN).")
        pdf_url = f"https://arxiv.org/pdf/{arxiv_id}"
    elif raw.startswith("http://") or raw.startswith("https://"):
        source_type = "url"
        source_ref = raw
        title = args.title or title_from_pdf_filename(raw)
        authors = args.authors.split(",") if args.authors else []
        pdf_url = raw
    else:
        source_type = "local"
        source_ref = str(Path(raw).resolve())
        title = args.title or title_from_pdf_filename(raw)
        authors = args.authors.split(",") if args.authors else []
        pdf_url = None

    slug = args.slug or slugify(title, papers_dir)
    dest_dir = papers_dir / slug / "source"
    dest_dir.mkdir(parents=True, exist_ok=True)
    dest_pdf = dest_dir / "paper.pdf"
    if dest_pdf.exists():
        raise FileExistsError(f"{dest_pdf} already exists; resolve a replacement in a staging directory and review its reimport before replacing the published PDF.")

    if pdf_url:
        download(pdf_url, dest_pdf)
    else:
        src_path = Path(raw)
        if not src_path.exists():
            print(f"error: local file not found: {raw}", file=sys.stderr)
            sys.exit(1)
        shutil.copyfile(src_path, dest_pdf)

    print(
        json.dumps(
            {
                "slug": slug,
                "title": title,
                "authors": [a.strip() for a in authors],
                "sourceType": source_type,
                "sourceRef": source_ref,
                "sourceSha256": hashlib.sha256(dest_pdf.read_bytes()).hexdigest(),
                **({"sourceVersion": re.search(r"v\d+$", arxiv_id).group(0)} if arxiv_id and re.search(r"v\d+$", arxiv_id) else {}),
                "pdfPath": str(dest_pdf),
            },
            indent=2,
        )
    )


if __name__ == "__main__":
    main()
