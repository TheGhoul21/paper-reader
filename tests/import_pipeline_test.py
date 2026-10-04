"""Offline import regression tests; all downloaded responses are substituted."""
import contextlib
import hashlib
import importlib.util
import io
import json
from pathlib import Path
import sys
import struct
import tempfile
import unittest
from unittest.mock import patch

import pymupdf

ROOT = Path(__file__).resolve().parents[1]


def module(name, path):
    spec = importlib.util.spec_from_file_location(name, ROOT / path)
    result = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(result)
    return result


resolver = module("resolver", ".claude/skills/import-paper/scripts/resolve_source.py")
merger = module("merger", ".claude/skills/import-paper/scripts/merge_passages.py")
thumbnails = module("thumbnails", "scripts/render-thumbnails.py")


class ImportTests(unittest.TestCase):
    def test_metadata_extracts_the_revision_from_the_arxiv_entry_id(self):
        class Response:
            text = '<feed xmlns="http://www.w3.org/2005/Atom"><entry><id>http://arxiv.org/abs/2401.01234v4</id><title> Demo\n title </title><author><name> A. Author </name></author></entry></feed>'
            def raise_for_status(self):
                pass
        with patch.object(resolver.requests, "get", return_value=Response()):
            meta = resolver.fetch_arxiv_meta("2401.01234v4")
        self.assertEqual(meta, {"title": "Demo title", "authors": ["A. Author"], "sourceVersion": "v4"})

    def test_an_existing_source_pdf_is_never_silently_replaced(self):
        with tempfile.TemporaryDirectory() as tmp:
            source = Path(tmp) / "demo/source/paper.pdf"
            source.parent.mkdir(parents=True)
            source.write_bytes(b"original")
            with patch.object(sys, "argv", ["resolve", "https://example.test/paper.pdf", "--slug", "demo", "--papers-dir", tmp]), \
                 patch.object(resolver, "download") as download:
                with self.assertRaises(FileExistsError):
                    resolver.main()
                download.assert_not_called()
            self.assertEqual(source.read_bytes(), b"original")

    def test_versioned_arxiv_input_keeps_its_requested_revision(self):
        self.assertEqual(resolver.detect_arxiv_id("https://arxiv.org/pdf/2401.01234v2"), "2401.01234v2")
        with tempfile.TemporaryDirectory() as tmp:
            def download(url, dest):
                self.assertEqual(url, "https://arxiv.org/pdf/2401.01234v2")
                dest.write_bytes(b"specific PDF")
            output = io.StringIO()
            with patch.object(sys, "argv", ["resolve", "2401.01234v2", "--papers-dir", tmp]), \
                 patch.object(resolver, "fetch_arxiv_meta", return_value={"title": "Demo", "authors": [], "sourceVersion": "v5"}), \
                 patch.object(resolver, "download", side_effect=download), contextlib.redirect_stdout(output):
                resolver.main()
            meta = json.loads(output.getvalue())
            self.assertEqual(meta["sourceRef"], "2401.01234v2")
            self.assertEqual(meta["sourceVersion"], "v2")
            self.assertEqual(meta["sourceSha256"], hashlib.sha256(b"specific PDF").hexdigest())

    def test_unversioned_arxiv_input_pins_the_revision_returned_by_metadata(self):
        with tempfile.TemporaryDirectory() as tmp:
            def download(url, dest):
                self.assertEqual(url, "https://arxiv.org/pdf/2401.01234v3")
                dest.write_bytes(b"revision 3")
            output = io.StringIO()
            with patch.object(sys, "argv", ["resolve", "2401.01234", "--papers-dir", tmp]), \
                 patch.object(resolver, "fetch_arxiv_meta", return_value={"title": "Demo", "authors": [], "sourceVersion": "v3"}), \
                 patch.object(resolver, "download", side_effect=download), contextlib.redirect_stdout(output):
                resolver.main()
            self.assertEqual(json.loads(output.getvalue())["sourceRef"], "2401.01234v3")

    def test_unversioned_arxiv_input_without_revision_is_not_silently_downloaded(self):
        with tempfile.TemporaryDirectory() as tmp:
            with patch.object(sys, "argv", ["resolve", "2401.01234", "--papers-dir", tmp]), \
                 patch.object(resolver, "fetch_arxiv_meta", return_value={"title": "Demo", "authors": []}), \
                 patch.object(resolver, "download") as download:
                with self.assertRaisesRegex(RuntimeError, "Cannot pin"):
                    resolver.main()
                download.assert_not_called()

    def test_merge_keeps_each_rectangle_on_its_original_page(self):
        blocks = [
            {"id": "p1", "page": 0, "order": 0, "kind": "body", "rects": [[0.1, 0.8, 0.9, 0.9]], "text": "Starts here"},
            {"id": "p2", "page": 1, "order": 0, "kind": "body", "rects": [[0.1, 0.1, 0.9, 0.2]], "text": "and ends here."},
        ]
        original = json.dumps(blocks)
        passage = merger.merge_passages(blocks, [["p1", "p2"]])[0]
        self.assertEqual(passage["id"], "p1")
        self.assertEqual(passage["text"], "Starts here and ends here.")
        self.assertEqual([a["page"] for a in passage["anchors"]], [0, 1])
        self.assertEqual(passage["rects"], blocks[0]["rects"])
        self.assertEqual(json.dumps(blocks), original)
        with self.assertRaises(ValueError):
            merger.merge_passages([{**b, "explanations": {}} for b in blocks], [["p1", "p2"]])
        with self.assertRaises(ValueError):
            merger.merge_passages(blocks, [["p2", "p1"]])

    def test_same_page_merge_does_not_mutate_extracted_rectangles(self):
        blocks = [{"id": f"p{i}", "page": 0, "order": i, "rects": [[0.1, i / 10, 0.9, (i + 1) / 10]], "text": str(i)} for i in (1, 2)]
        original = json.dumps(blocks)
        result = merger.merge_passages(blocks, [["p1", "p2"]])
        self.assertEqual(len(result[0]["rects"]), 2)
        self.assertEqual(json.dumps(blocks), original)

    def test_thumbnails_are_cached_and_refuse_an_unreviewed_pdf_replacement(self):
        with tempfile.TemporaryDirectory() as tmp:
            folder = Path(tmp) / "demo"
            source = folder / "source"
            source.mkdir(parents=True)
            with pymupdf.open() as doc:
                doc.new_page().insert_text((30, 30), "Demo")
                doc.save(source / "paper.pdf")
            (folder / "meta.json").write_text('{\n  "slug": "demo"\n}\n')
            self.assertTrue(thumbnails.render_thumbnail(folder))
            width, _height = struct.unpack(">II", (source / "thumbnail.png").read_bytes()[16:24])
            self.assertEqual(width, 640)
            self.assertFalse(thumbnails.render_thumbnail(folder))
            digest = hashlib.sha256((source / "paper.pdf").read_bytes()).hexdigest()
            self.assertEqual(json.loads((folder / "meta.json").read_text())["sourceSha256"], digest)
            (source / "paper.pdf").write_bytes(b"replacement")
            with self.assertRaisesRegex(ValueError, "PDF changed"):
                thumbnails.render_thumbnail(folder)


if __name__ == "__main__":
    unittest.main()
