import { NextRequest } from "next/server";
import { synthesizeToSpeech } from "@/lib/tts/synthesize";
import { badRequest, internalError } from "@/utils/errors";

export const dynamic = "force-dynamic";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const text = typeof body?.text === "string" ? body.text : undefined;
    const chunks = Array.isArray(body?.chunks)
      ? body.chunks.filter((c: unknown) => typeof c === "string")
      : undefined;

    if (!text && (!chunks || chunks.length === 0)) {
      return badRequest("Provide text or chunks", "INVALID_INPUT");
    }

    const result = await synthesizeToSpeech({ text, chunks });
    return Response.json({ audioUrl: result.audioUrl, path: result.path });
  } catch (err) {
    const message = err instanceof Error ? err.message : "TTS failed";
    if (message.includes("Provide") || message.includes("No audio")) {
      return badRequest(message, "INVALID_INPUT");
    }
    if (message.includes("SUPABASE") || message.includes("storage")) {
      return internalError(message, "STORAGE_FAILED");
    }
    return internalError(message, "TTS_FAILED");
  }
}
