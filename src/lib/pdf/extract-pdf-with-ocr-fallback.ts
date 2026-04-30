import { extractPdfTextRaw } from "@/lib/pdf/extract-text";
import { extractTextFromPdfViaVisionGcs } from "@/lib/vision/ocr-pdf-gcs";

export interface ExtractPdfForTtsResult {
  text: string;
  usedOcr: boolean;
}

/**
 * Prefer embedded PDF text (pdf-parse). If empty (typical scanned PDF), run Vision OCR via GCS.
 */
export async function extractPdfTextWithOcrFallback(
  buffer: Buffer
): Promise<ExtractPdfForTtsResult> {
  console.info("[pdf/extract] Trying direct text extraction");
  const direct = await extractPdfTextRaw(buffer);
  console.info("[pdf/extract] Direct extraction completed", {
    textLength: direct.length,
  });

  if (direct.length > 0) {
    console.info("[pdf/extract] Using direct PDF text (no OCR)");
    return { text: direct, usedOcr: false };
  }

  console.info("[pdf/extract] No direct text found, starting OCR");
  const ocrText = await extractTextFromPdfViaVisionGcs(buffer);
  const trimmed = ocrText.trim();
  console.info("[pdf/extract] OCR completed", { textLength: trimmed.length });
  if (!trimmed) {
    console.warn("[pdf/extract] OCR returned empty text");
    throw new Error("No text could be extracted from the PDF");
  }
  console.info("[pdf/extract] Using OCR text");
  return { text: trimmed, usedOcr: true };
}
