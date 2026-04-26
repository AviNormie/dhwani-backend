// pdf-parse v1.1.1: legacy API, no worker — works in Next.js server.
// Required lazily so pdf-parse's top-level test block doesn't run at build time.
export const MAX_PDF_SIZE_BYTES = 10 * 1024 * 1024; // 10MB

/**
 * Extract text with pdf-parse only (no OCR). Returns "" if the PDF has no embedded text.
 * Throws if the file is not a valid PDF or pdf-parse fails.
 */
export async function extractPdfTextRaw(buffer: Buffer): Promise<string> {
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const pdf = require("pdf-parse") as (buf: Buffer) => Promise<{ text: string }>;
    const data = await pdf(buffer);
    return (data?.text ?? "").trim();
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    throw new Error(`PDF extraction failed: ${msg}`);
  }
}

/**
 * Extract raw text from a PDF buffer. Handles multi-page PDFs.
 * Throws if no embedded text (use extractPdfTextWithOcrFallback for scanned PDFs).
 */
export async function extractTextFromPdf(buffer: Buffer): Promise<string> {
  const text = await extractPdfTextRaw(buffer);
  if (!text) {
    throw new Error("No text could be extracted from the PDF");
  }
  return text;
}
