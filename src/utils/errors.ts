import { NextResponse } from "next/server";

export type ErrorCode =
  | "INVALID_INPUT"
  | "FILE_TOO_LARGE"
  | "PDF_EXTRACT_FAILED"
  | "TTS_FAILED"
  | "STORAGE_FAILED"
  | "INTERNAL";

export function apiError(
  message: string,
  status: number = 400,
  code?: ErrorCode
) {
  return NextResponse.json(
    { error: message, ...(code && { code }) },
    { status }
  );
}

export function badRequest(message: string, code?: ErrorCode) {
  return apiError(message, 400, code);
}

export function payloadTooLarge(message: string = "File too large") {
  return apiError(message, 413, "FILE_TOO_LARGE");
}

export function internalError(message: string = "Internal server error", code?: ErrorCode) {
  return apiError(message, 502, code ?? "INTERNAL");
}
