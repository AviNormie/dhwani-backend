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
  const direct = await extractPdfTextRaw(buffer);
  if (direct.length > 0) {
    return { text: direct, usedOcr: false };
  }

  const ocrText = await extractTextFromPdfViaVisionGcs(buffer);
  const trimmed = ocrText.trim();
  if (!trimmed) {
    throw new Error("No text could be extracted from the PDF");
  }
  return { text: trimmed, usedOcr: true };
}
