/**
 * Parsed Vision async output JSON (one file per batch of pages).
 * Shape matches Cloud Vision AnnotateFileResponse JSON.
 */
export interface VisionAnnotateFileJson {
  responses?: Array<{
    fullTextAnnotation?: { text?: string } | null;
    error?: { message?: string } | null;
  } | null>;
}

/** Sort output shards by starting page number when names match output-X-to-Y.json. */
export function compareVisionOutputFileNames(a: string, b: string): number {
  const ma = /output-(\d+)-to-(\d+)/i.exec(a);
  const mb = /output-(\d+)-to-(\d+)/i.exec(b);
  if (ma && mb) {
    const startA = parseInt(ma[1], 10);
    const startB = parseInt(mb[1], 10);
    if (startA !== startB) return startA - startB;
    return a.localeCompare(b);
  }
  return a.localeCompare(b);
}

/**
 * Merge text from all Vision async JSON result files (already downloaded as strings).
 */
export function mergeVisionAsyncOutputJsonBodies(
  files: { name: string; body: string }[]
): string {
  const sorted = [...files].sort((x, y) =>
    compareVisionOutputFileNames(x.name, y.name)
  );
  const parts: string[] = [];

  for (const f of sorted) {
    let doc: VisionAnnotateFileJson;
    try {
      doc = JSON.parse(f.body) as VisionAnnotateFileJson;
    } catch {
      continue;
    }
    if (!doc.responses?.length) continue;

    for (const r of doc.responses) {
      if (!r) continue;
      if (r.error?.message) continue;
      const t = r.fullTextAnnotation?.text?.trim();
      if (t) parts.push(t);
    }
  }

  return parts.join("\n\n");
}
