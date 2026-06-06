import { NextRequest } from "next/server";
import { synthesizeToSpeech } from "@/lib/tts/synthesize";
import { chunkText, DEFAULT_MAX_CHUNK_BYTES } from "@/lib/pdf/chunk-text";
import { synthesizeChunk } from "@/lib/tts/google-tts";
import { badRequest, internalError } from "@/utils/errors";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

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
    const proxyAudioUrl = `/api/tts/audio?path=${encodeURIComponent(result.path)}`;
    return Response.json({ audioUrl: proxyAudioUrl, path: result.path });
  } catch (err) {
    const message = err instanceof Error ? err.message : "TTS failed";
    console.error("[tts/synthesize] Request failed", message);
    if (message.includes("Provide") || message.includes("No audio")) {
      return badRequest(message, "INVALID_INPUT");
    }
    if (message.includes("GCS") || message.includes("storage")) {
      return internalError(message, "STORAGE_FAILED");
    }
    return internalError(message, "TTS_FAILED");
  }
}

export async function GET(request: NextRequest) {
  const stream = request.nextUrl.searchParams.get("stream");
  if (stream !== "1" && stream !== "true") {
    return badRequest("Use ?stream=true for direct audio response", "INVALID_INPUT");
  }

  try {
    const text = request.nextUrl.searchParams.get("text")?.trim();
    if (!text) {
      return badRequest("Provide text query param for streaming", "INVALID_INPUT");
    }

    const chunks = chunkText(text, {
      maxChunkBytes: DEFAULT_MAX_CHUNK_BYTES,
    });
    const buffers: Buffer[] = [];

    for (const chunk of chunks) {
      const trimmed = chunk.trim();
      if (!trimmed) continue;
      const audio = await synthesizeChunk(trimmed);
      buffers.push(audio);
    }

    if (buffers.length === 0) {
      return badRequest("No audio could be generated", "INVALID_INPUT");
    }

    const audioBuffer = Buffer.concat(buffers);
    return new Response(new Uint8Array(audioBuffer), {
      headers: {
        "Content-Type": "audio/mpeg",
        "Content-Length": String(audioBuffer.length),
        "Cache-Control": "no-store",
      },
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "TTS stream failed";
    return internalError(message, "TTS_FAILED");
  }
}
