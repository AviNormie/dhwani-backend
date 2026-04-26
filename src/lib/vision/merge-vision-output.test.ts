import { describe, expect, it } from "vitest";
import {
  compareVisionOutputFileNames,
  mergeVisionAsyncOutputJsonBodies,
} from "@/lib/vision/merge-vision-output";

describe("compareVisionOutputFileNames", () => {
  it("orders by starting page number, not lexicographically", () => {
    const a = "gs-prefix/output-10-to-11.json";
    const b = "gs-prefix/output-2-to-3.json";
    expect(compareVisionOutputFileNames(a, b)).toBeGreaterThan(0);
    expect(compareVisionOutputFileNames(b, a)).toBeLessThan(0);
  });

  it("falls back to localeCompare when pattern missing", () => {
    expect(compareVisionOutputFileNames("b.json", "a.json")).toBeGreaterThan(0);
  });
});

describe("mergeVisionAsyncOutputJsonBodies", () => {
  it("merges pages in file order and joins with double newline", () => {
    const text = mergeVisionAsyncOutputJsonBodies([
      {
        name: "p/output-1-to-1.json",
        body: JSON.stringify({
          responses: [{ fullTextAnnotation: { text: "Page one." } }],
        }),
      },
      {
        name: "p/output-2-to-2.json",
        body: JSON.stringify({
          responses: [{ fullTextAnnotation: { text: "Page two." } }],
        }),
      },
    ]);
    expect(text).toBe("Page one.\n\nPage two.");
  });

  it("sorts shards by output-X-to-Y before merging", () => {
    const text = mergeVisionAsyncOutputJsonBodies([
      {
        name: "output-5-to-5.json",
        body: JSON.stringify({
          responses: [{ fullTextAnnotation: { text: "Fifth" } }],
        }),
      },
      {
        name: "output-1-to-2.json",
        body: JSON.stringify({
          responses: [
            { fullTextAnnotation: { text: "First" } },
            { fullTextAnnotation: { text: "Second" } },
          ],
        }),
      },
    ]);
    expect(text).toBe("First\n\nSecond\n\nFifth");
  });

  it("skips responses with errors and invalid JSON files", () => {
    const text = mergeVisionAsyncOutputJsonBodies([
      {
        name: "bad.json",
        body: "not json",
      },
      {
        name: "ok.json",
        body: JSON.stringify({
          responses: [
            { error: { message: "fail" } },
            { fullTextAnnotation: { text: "OK" } },
          ],
        }),
      },
    ]);
    expect(text).toBe("OK");
  });
});
