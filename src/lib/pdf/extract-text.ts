// pdf-parse v1.1.1: legacy API, no worker — works in Next.js server.
// Required lazily so pdf-parse's top-level test block doesn't run at build time.
export const MAX_PDF_SIZE_BYTES = 10 * 1024 * 1024; // 10MB

/**
 * Extract raw text from a PDF buffer. Handles multi-page PDFs.
 */
export async function extractTextFromPdf(buffer: Buffer): Promise<string> {
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const pdf = require("pdf-parse") as (buf: Buffer) => Promise<{ text: string }>;
    const data = await pdf(buffer);
    const text = (data?.text ?? "").trim();
    if (!text) {
      throw new Error("No text could be extracted from the PDF");
    }
    return text;
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    throw new Error(`PDF extraction failed: ${msg}`);
  }
}
