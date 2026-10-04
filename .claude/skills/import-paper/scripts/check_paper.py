# Checks a paper's hand-written data against its paragraphs:
#   1. explanation drift — runs of paragraphs whose explanation seems to describe a *neighbouring*
#      paragraph's text (explanations shifted by one or more positions), per variant;
#   2. recall questions — ids unique within a paragraph, question and answer for every variant;
#   3. structure.json (argument map), if present — thesis/titles/summaries for every variant,
#      unique claim ids, statedIn/evidence pointing at existing paragraphs, dependsOn at existing
#      claims, no dependency cycles; section guides with ordered, unique paragraph coverage;
#   4. forward links ("leadsTo") — targets that exist and come later, "why" for every variant;
#   5. tldr in meta.json, if present — problem/idea/result for every variant's language, and the
#      same tldr in the paper's papers/index.json entry.
#
#   python3 .claude/skills/import-paper/scripts/check_paper.py <slug> [--require-reading-guide]
#
# Language-neutral heuristic: compares the "anchors" an explanation shares with each nearby
# sourceText — numbers, equation/figure references, symbols, capitalised names — and reports where
# a neighbour (offset -2..+2) matches clearly better than the paragraph itself. Isolated hits are
# noise; a run of 3+ consecutive paragraphs with the same offset is a real drift. Exit code 1 if any.
import argparse, hashlib, json, math, re, sys, unicodedata
from collections import Counter

parser = argparse.ArgumentParser(description="Validate a paper's authored reader data")
parser.add_argument("slug")
parser.add_argument("--require-reading-guide", action="store_true", help="Require a guide covering the whole imported paper")
args = parser.parse_args()
slug = args.slug
paragraphs = sorted(json.load(open(f"papers/{slug}/paragraphs.json")), key=lambda x: (x["page"], x["order"]))
variants = [v["key"] for v in json.load(open(f"papers/{slug}/meta.json"))["variants"]]
STOP = {"il", "la", "le", "gli", "in", "si", "per", "questo", "questa", "the", "we", "this", "it"}

def anchors(text):
    text = unicodedata.normalize("NFKC", text)
    tokens = re.findall(r"[A-Za-zÀ-ÿͰ-Ͽ]*\d[\w.]*|[A-Z][A-Za-z]{2,}|[^\sA-Za-z0-9À-ÿ.,;:()'\"“”’\-–—]", text)
    return Counter(t.lower() for t in tokens if t.lower() not in STOP)

def similarity(a, b):
    return sum((a & b).values()) / (1 + (sum(a.values()) * sum(b.values())) ** 0.5)

source = [anchors(p["sourceText"]) for p in paragraphs]
found = False
meta = json.load(open(f"papers/{slug}/meta.json"))
for p in paragraphs:
    passage_anchors = p.get("anchors", [{"page": p["page"], "rects": p["rects"]}])
    problems = []
    if not isinstance(passage_anchors, list) or not passage_anchors:
        problems.append("anchors must be a nonempty array")
    else:
        for anchor in passage_anchors:
            if not isinstance(anchor, dict):
                problems.append("anchor must be an object")
                continue
            page, rects = anchor.get("page"), anchor.get("rects")
            if type(page) is not int or not 0 <= page < meta["pageCount"]:
                problems.append("anchor page is outside the PDF")
            if not isinstance(rects, list) or not rects:
                problems.append("anchor needs rectangles")
                continue
            for rect in rects:
                if (not isinstance(rect, list) or len(rect) != 4 or
                    any(type(n) not in (int, float) or not math.isfinite(n) or not 0 <= n <= 1 for n in rect) or
                    rect[0] >= rect[2] or rect[1] >= rect[3]):
                    problems.append("invalid anchor rectangle")
        if passage_anchors[0] != {"page": p["page"], "rects": p["rects"]}:
            problems.append("legacy page/rects must mirror the first anchor")
    for problem in problems:
        found = True
        print(f"{p['id']}: {problem}")
if "sourceSha256" in meta:
    with open(f"papers/{slug}/source/paper.pdf", "rb") as pdf:
        if hashlib.sha256(pdf.read()).hexdigest() != meta["sourceSha256"]:
            found = True
            print("sourceSha256: stored PDF differs from imported source")
if "sourceVersion" in meta and not re.fullmatch(r"v[1-9]\d*", meta["sourceVersion"]):
    found = True
    print("sourceVersion: expected an arXiv revision vN")
for v in variants:
    offsets = []
    for i, p in enumerate(paragraphs):
        e = anchors(p["explanations"].get(v, ""))
        scores = {d: similarity(e, source[i + d]) for d in range(-2, 3) if 0 <= i + d < len(paragraphs)}
        best = max(scores, key=scores.get)
        offsets.append(best if scores[best] > scores[0] * 1.5 and scores[best] > 0.05 else 0)
    start = None
    for i, o in enumerate(offsets + [0]):
        if start is not None and o != offsets[start]:
            if i - start >= 3:
                found = True
                print(f"{v}: {paragraphs[start]['id']}–{paragraphs[i - 1]['id']} explanations look shifted by {offsets[start]:+d}")
            start = None
        if start is None and o != 0:
            start = i
questions = 0
for p in paragraphs:
    ids = [r.get("id") for r in p.get("recall", [])]
    if len(ids) != len(set(ids)) or None in ids:
        found = True
        print(f"{p['id']}: recall ids missing or duplicated: {ids}")
    for r in p.get("recall", []):
        questions += 1
        for v in variants:
            if not r.get("q", {}).get(v) or not r.get("a", {}).get(v):
                found = True
                print(f"{p['id']}#{r.get('id')}: missing question or answer for {v}")
if questions:
    print(f"{questions} recall questions checked")

position = {p["id"]: i for i, p in enumerate(sorted(paragraphs, key=lambda p: (p["page"], p["order"])))}
links = 0
for p in paragraphs:
    for link in p.get("leadsTo", []):
        links += 1
        to = link.get("to")
        if to not in position:
            found = True
            print(f"{p['id']}: leadsTo {to} is not a paragraph")
        elif position[to] <= position[p["id"]]:
            found = True
            print(f"{p['id']}: leadsTo {to} does not come later")
        for v in variants:
            if not link.get("why", {}).get(v):
                found = True
                print(f"{p['id']}: leadsTo {to} missing why for {v}")
if links:
    print(f"{links} forward links checked")

import os
structure_path = f"papers/{slug}/structure.json"
if os.path.exists(structure_path):
    structure = json.load(open(structure_path))
    paragraph_ids = {p["id"] for p in paragraphs}
    claims = structure.get("claims", [])
    claim_ids = [c.get("id") for c in claims]
    problems = []
    for v in variants:
        if not structure.get("thesis", {}).get(v):
            problems.append(f"thesis: missing {v}")
    if len(claim_ids) != len(set(claim_ids)) or None in claim_ids:
        problems.append(f"claim ids missing or duplicated: {claim_ids}")
    for c in claims:
        for field in ("title", "summary"):
            for v in variants:
                if not c.get(field, {}).get(v):
                    problems.append(f"{c.get('id')}: {field} missing {v}")
        if not c.get("statedIn"):
            problems.append(f"{c.get('id')}: statedIn is empty")
        for field in ("statedIn", "evidence"):
            for pid in c.get(field, []):
                if pid not in paragraph_ids:
                    problems.append(f"{c.get('id')}: {field} {pid} is not a paragraph")
        for dep in c.get("dependsOn", []):
            if dep not in claim_ids:
                problems.append(f"{c.get('id')}: dependsOn {dep} is not a claim")
    deps = {c.get("id"): c.get("dependsOn", []) for c in claims}
    def cyclic(node, stack):
        if node in stack:
            return True
        return any(cyclic(d, stack | {node}) for d in deps.get(node, []) if d in deps)
    if any(cyclic(c, frozenset()) for c in deps):
        problems.append("dependsOn has a cycle")
    guides = structure.get("readingGuide", [])
    guide_ids = [g.get("id") for g in guides]
    if len(guide_ids) != len(set(guide_ids)) or None in guide_ids:
        problems.append(f"reading guide ids missing or duplicated: {guide_ids}")
    guided_paragraphs = set()
    last_position = -1
    for guide in guides:
        gid = guide.get("id")
        for field in ("title", "goal"):
            for v in variants:
                if not guide.get(field, {}).get(v):
                    problems.append(f"guide {gid}: {field} missing {v}")
        steps = guide.get("steps", [])
        step_ids = [s.get("id") for s in steps]
        if not steps or len(step_ids) != len(set(step_ids)) or None in step_ids:
            problems.append(f"guide {gid}: steps empty or ids missing/duplicated")
        for step in steps:
            sid = step.get("id")
            for field in ("title", "meaning", "purpose"):
                for v in variants:
                    if not step.get(field, {}).get(v):
                        problems.append(f"guide {gid}/{sid}: {field} missing {v}")
            if not step.get("paragraphs"):
                problems.append(f"guide {gid}/{sid}: paragraphs is empty")
            for pid in step.get("paragraphs", []):
                if pid not in position:
                    problems.append(f"guide {gid}/{sid}: {pid} is not a paragraph")
                    continue
                if pid in guided_paragraphs:
                    problems.append(f"guide {gid}/{sid}: {pid} belongs to multiple steps")
                guided_paragraphs.add(pid)
                if position[pid] <= last_position:
                    problems.append(f"guide {gid}/{sid}: {pid} is not in reading order")
                last_position = position[pid]
            if diagram := step.get("diagram"):
                path = diagram.get("path", "")
                if not path or os.path.isabs(path) or ".." in path.split("/") or not os.path.isfile(f"public/{path}"):
                    problems.append(f"guide {gid}/{sid}: diagram must exist inside public/")
                for v in variants:
                    if not diagram.get("caption", {}).get(v):
                        problems.append(f"guide {gid}/{sid}: diagram caption missing {v}")
        if next_passage := guide.get("leadsTo"):
            target = next_passage.get("paragraphId")
            if target not in position or position[target] <= last_position:
                problems.append(f"guide {gid}: leadsTo must reference a later paragraph")
            for v in variants:
                if not next_passage.get("why", {}).get(v):
                    problems.append(f"guide {gid}: leadsTo why missing {v}")
    if guides:
        print(f"reading guide: {len(guides)} sections, {len(guided_paragraphs)} paragraphs")
    if guides or args.require_reading_guide:
        missing = paragraph_ids - guided_paragraphs
        if not guides:
            problems.append("reading guide is required")
        if missing:
            problems.append(f"reading guide: {len(missing)} uncovered paragraphs: {', '.join(sorted(missing, key=position.get))}")
    covered = {pid for c in claims for pid in c.get("statedIn", []) + c.get("evidence", [])}
    print(f"structure: {len(claims)} claims, thread covers {len(covered)}/{len(paragraph_ids)} paragraphs")
    for msg in problems:
        found = True
        print(f"structure: {msg}")
elif args.require_reading_guide:
    found = True
    print("structure: structure.json with a complete reading guide is required")
meta = json.load(open(f"papers/{slug}/meta.json"))
if "tldr" in meta:
    tldr = meta["tldr"]
    for lang in sorted({v["language"] for v in meta["variants"]}):
        for field in ("problem", "idea", "result"):
            if not tldr.get(lang, {}).get(field):
                found = True
                print(f"tldr: {lang} missing {field}")
    entry = next((e for e in json.load(open("papers/index.json")) if e["slug"] == slug), None)
    if entry is None or entry.get("tldr") != tldr:
        found = True
        print("tldr: papers/index.json entry doesn't match meta.json")
    else:
        print(f"tldr: {', '.join(sorted(tldr))} OK")
print("problems found — see above" if found else "OK")
sys.exit(1 if found else 0)
