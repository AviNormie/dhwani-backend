import { NextRequest } from "next/server";
import { MAX_PDF_SIZE_BYTES } from "@/lib/pdf/extract-text";
import { extractPdfTextWithOcrFallback } from "@/lib/pdf/extract-pdf-with-ocr-fallback";
import { chunkText, DEFAULT_MAX_CHUNK_BYTES } from "@/lib/pdf/chunk-text";
import { PdfOcrError } from "@/lib/vision/pdf-ocr-error";
import { badRequest, payloadTooLarge, internalError } from "@/utils/errors";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";
/** Raise on Vercel / hosts that support longer serverless runs; OCR can take minutes on large PDFs. */
export const maxDuration = 300;

export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData();
    const file = formData.get("file") as File | null;

    if (!file) {
      return badRequest("Missing file", "INVALID_INPUT");
    }

    if (file.size > MAX_PDF_SIZE_BYTES) {
      return payloadTooLarge(
        `PDF must be under ${MAX_PDF_SIZE_BYTES / 1024 / 1024}MB`
      );
    }

    const contentType = file.type?.toLowerCase() ?? "";
    if (
      contentType !== "application/pdf" &&
      !file.name?.toLowerCase().endsWith(".pdf")
    ) {
      return badRequest("File must be a PDF", "INVALID_INPUT");
    }

    const arrayBuffer = await file.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);

    const { text, usedOcr } = await extractPdfTextWithOcrFallback(buffer);
    const chunks = chunkText(text, { maxChunkBytes: DEFAULT_MAX_CHUNK_BYTES });

    return Response.json({
      text,
      chunks,
      chunkSize: DEFAULT_MAX_CHUNK_BYTES,
      usedOcr,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    const stack = err instanceof Error ? err.stack : undefined;
    console.error("[pdf/upload]", message, stack ?? err);

    if (err instanceof PdfOcrError) {
      if (err.kind === "config") {
        return badRequest(message, "OCR_FAILED");
      }
      return internalError(message, "OCR_FAILED");
    }

    if (message.includes("No text")) {
      return badRequest(message, "PDF_EXTRACT_FAILED");
    }
    return internalError(message, "PDF_EXTRACT_FAILED");
  }
}
