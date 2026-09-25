# Flags runs of paragraphs whose explanation seems to describe a *neighbouring* paragraph's text
# (explanations drifted by one or more positions), per variant.
#
#   python3 .claude/skills/import-paper/scripts/check_alignment.py <slug>
#
# Language-neutral heuristic: compares the "anchors" an explanation shares with each nearby
# sourceText — numbers, equation/figure references, symbols, capitalised names — and reports where
# a neighbour (offset -2..+2) matches clearly better than the paragraph itself. Isolated hits are
# noise; a run of 3+ consecutive paragraphs with the same offset is a real drift. Exit code 1 if any.
#
# Also validates `recall` questions: ids unique within a paragraph, question and answer present
# for every variant.
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
print("problems found — see above" if found else "OK")
sys.exit(1 if found else 0)
