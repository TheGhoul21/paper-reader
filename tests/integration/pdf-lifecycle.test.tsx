import { render, renderHook, act, waitFor } from "@testing-library/react";
import { expect, it, vi } from "vitest";
import LinkLayer from "../../src/components/LinkLayer";
import { usePdfDocument } from "../../src/lib/usePdfDocument";
import type { PDFDocumentProxy, PDFPageProxy, PageViewport } from "pdfjs-dist";

const { getDocument } = vi.hoisted(() => ({ getDocument: vi.fn() }));
vi.mock("../../src/lib/pdfjs", () => ({ pdfjsLib: { getDocument } }));

it("a pending PDF annotation request can reject after returning to the guide", async () => {
  const pending = Promise.withResolvers<unknown[]>();
  const page = { getAnnotations: () => pending.promise } as unknown as PDFPageProxy;
  const error = Object.assign(new Error("worker task terminated"), {
    name: "UnknownErrorException",
  });
  const log = vi.spyOn(console, "error").mockImplementation(() => {});
  const view = render(
    <LinkLayer
      doc={{} as PDFDocumentProxy}
      page={page}
      viewport={{} as PageViewport}
      onJumpToPage={vi.fn()}
      onCitation={vi.fn()}
    />,
  );
  view.unmount();
  await act(async () => {
    pending.reject(error);
  });
  expect(log).not.toHaveBeenCalled();
});

it("an obsolete PDF annotation result does not start new destination work", async () => {
  const pending = Promise.withResolvers<unknown[]>();
  const resolveDestination = vi.fn();
  const page = { getAnnotations: () => pending.promise } as unknown as PDFPageProxy;
  const doc = { getDestination: resolveDestination } as unknown as PDFDocumentProxy;
  const convert = vi.fn();
  const view = render(
    <LinkLayer
      doc={doc}
      page={page}
      viewport={{ convertToViewportRectangle: convert } as unknown as PageViewport}
      onJumpToPage={vi.fn()}
      onCitation={vi.fn()}
    />,
  );
  view.unmount();
  await act(async () => {
    pending.resolve([{ subtype: "Link", rect: [0, 0, 1, 1], dest: "old" }]);
  });
  expect(convert).not.toHaveBeenCalled();
  expect(resolveDestination).not.toHaveBeenCalled();
});

it("document disposal handles rejection without an unhandled promise or losing diagnostics", async () => {
  const error = new Error("worker disposal failed");
  const destroy = vi.fn().mockRejectedValue(error);
  const doc = { getPage: async () => ({ getViewport: () => ({ width: 612, height: 792 }) }) };
  getDocument.mockReturnValue({ promise: Promise.resolve(doc), destroy });
  const log = vi.spyOn(console, "error").mockImplementation(() => {});
  const view = renderHook(() => usePdfDocument("/paper.pdf"));
  await waitFor(() => expect(view.result.current.doc).toBe(doc));
  view.unmount();
  await act(async () => {});
  expect(destroy).toHaveBeenCalledOnce();
  expect(log).toHaveBeenCalledWith("PDF document cleanup failed", error);
});
