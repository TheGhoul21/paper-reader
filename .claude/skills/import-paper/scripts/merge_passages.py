"""Merge explicitly reviewed extraction blocks, retaining each rectangle's original page.

python3 merge_passages.py /tmp/blocks.json --merge p0012,p0013 --out /tmp/curated.json
Only use before publishing a new import. Existing paragraph IDs must stay stable.
"""
import argparse
import json
from pathlib import Path


def merge_passages(blocks, groups):
    if any("explanations" in block for block in blocks):
        raise ValueError("Use the intermediate extraction, not published paragraphs.json; preserve published IDs.")
    by_id = {b["id"]: b for b in blocks}
    if len(by_id) != len(blocks):
        raise ValueError("Duplicate block IDs")
    replacements, removed = {}, set()
    used = set()
    for ids in groups:
        if len(ids) < 2 or len(set(ids)) != len(ids):
            raise ValueError("Each merge needs at least two distinct IDs")
        if used.intersection(ids):
            raise ValueError("A block cannot belong to two passages")
        used.update(ids)
        selected = [by_id[id_] for id_ in ids]
        if len({b.get("kind", "body") for b in selected}) != 1:
            raise ValueError("Do not merge prose and captions")
        anchors = []
        for block in selected:
            for anchor in block.get("anchors", [{"page": block["page"], "rects": block["rects"]}]):
                if anchors and anchors[-1]["page"] == anchor["page"]:
                    anchors[-1]["rects"].extend(anchor["rects"])
                else:
                    anchors.append({"page": anchor["page"], "rects": list(anchor["rects"])})
        if any(a["page"] > b["page"] for a, b in zip(anchors, anchors[1:])):
            raise ValueError("Passage pages must follow PDF reading order")
        merged = dict(selected[0], text=" ".join(b["text"] for b in selected), anchors=anchors)
        merged["page"], merged["rects"] = anchors[0]["page"], anchors[0]["rects"]
        replacements[ids[0]] = merged
        removed.update(ids[1:])
    return [replacements.get(b["id"], b) for b in blocks if b["id"] not in removed]


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("input")
    parser.add_argument("--merge", action="append", required=True, help="Reviewed IDs in semantic order, comma-separated")
    parser.add_argument("--out", required=True)
    args = parser.parse_args()
    blocks = json.loads(Path(args.input).read_text())
    result = merge_passages(blocks, [group.split(",") for group in args.merge])
    Path(args.out).write_text(json.dumps(result, indent=2, ensure_ascii=False) + "\n")


if __name__ == "__main__":
    main()
