import { NextRequest } from "next/server";
import { downloadAudioFromGcs } from "@/lib/gcs/storage";
import { badRequest, internalError } from "@/utils/errors";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET(request: NextRequest) {
  const path = request.nextUrl.searchParams.get("path")?.trim();
  if (!path) {
    return badRequest("Missing audio path", "INVALID_INPUT");
  }

  try {
    const { buffer, contentType } = await downloadAudioFromGcs(path);
    return new Response(buffer, {
      headers: {
        "Content-Type": contentType,
        "Content-Length": String(buffer.length),
        "Cache-Control": "private, max-age=3600",
      },
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Failed to load audio";
    if (message.includes("Missing") || message.includes("Invalid") || message.includes("not found")) {
      return badRequest(message, "INVALID_INPUT");
    }
    return internalError(message, "STORAGE_FAILED");
  }
}
