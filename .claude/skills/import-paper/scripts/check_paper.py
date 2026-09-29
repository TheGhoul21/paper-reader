# Checks a paper's hand-written data against its paragraphs:
#   1. explanation drift — runs of paragraphs whose explanation seems to describe a *neighbouring*
#      paragraph's text (explanations shifted by one or more positions), per variant;
#   2. recall questions — ids unique within a paragraph, question and answer for every variant;
#   3. structure.json (argument map), if present — thesis/titles/summaries for every variant,
#      unique claim ids, statedIn/evidence pointing at existing paragraphs, dependsOn at existing
#      claims, no dependency cycles;
#   4. tldr in meta.json, if present — problem/idea/result for every variant's language, and the
#      same tldr in the paper's papers/index.json entry.
#
#   python3 .claude/skills/import-paper/scripts/check_paper.py <slug>
#
# Language-neutral heuristic: compares the "anchors" an explanation shares with each nearby
# sourceText — numbers, equation/figure references, symbols, capitalised names — and reports where
# a neighbour (offset -2..+2) matches clearly better than the paragraph itself. Isolated hits are
# noise; a run of 3+ consecutive paragraphs with the same offset is a real drift. Exit code 1 if any.
import json, re, sys, unicodedata
from collections import Counter

slug = sys.argv[1]
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
    covered = {pid for c in claims for pid in c.get("statedIn", []) + c.get("evidence", [])}
    print(f"structure: {len(claims)} claims, thread covers {len(covered)}/{len(paragraph_ids)} paragraphs")
    for msg in problems:
        found = True
        print(f"structure: {msg}")
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
