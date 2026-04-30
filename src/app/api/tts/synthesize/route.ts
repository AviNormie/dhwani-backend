import { NextRequest } from "next/server";
import { synthesizeToSpeech } from "@/lib/tts/synthesize";
import { badRequest, internalError } from "@/utils/errors";

export const dynamic = "force-dynamic";

export async function POST(request: NextRequest) {
  try {
    console.info("[tts/synthesize] Request received");
    const body = await request.json();
    const text = typeof body?.text === "string" ? body.text : undefined;
    const chunks = Array.isArray(body?.chunks)
      ? body.chunks.filter((c: unknown) => typeof c === "string")
      : undefined;

    console.info("[tts/synthesize] Input parsed", {
      hasText: Boolean(text?.trim()),
      textLength: text?.length ?? 0,
      chunkCount: chunks?.length ?? 0,
    });

    if (!text && (!chunks || chunks.length === 0)) {
      console.warn("[tts/synthesize] Invalid input: no text or chunks");
      return badRequest("Provide text or chunks", "INVALID_INPUT");
    }

    console.info("[tts/synthesize] Starting synthesis pipeline");
    const result = await synthesizeToSpeech({ text, chunks });
    console.info("[tts/synthesize] Synthesis pipeline completed", {
      path: result.path,
      hasAudioUrl: Boolean(result.audioUrl),
    });
    return Response.json({ audioUrl: result.audioUrl, path: result.path });
  } catch (err) {
    const message = err instanceof Error ? err.message : "TTS failed";
    console.error("[tts/synthesize] Request failed", message);
    if (message.includes("Provide") || message.includes("No audio")) {
      return badRequest(message, "INVALID_INPUT");
    }
    if (message.includes("SUPABASE") || message.includes("storage")) {
      return internalError(message, "STORAGE_FAILED");
    }
    return internalError(message, "TTS_FAILED");
  }
}
