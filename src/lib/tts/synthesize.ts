import { synthesizeChunk } from "./google-tts";
import { uploadAudio } from "@/lib/supabase/upload-audio";
import {
  chunkText,
  DEFAULT_MAX_CHUNK_BYTES,
} from "@/lib/pdf/chunk-text";

export interface SynthesizeResult {
  audioUrl: string;
  path: string;
}

const MAX_TTS_BYTES = 5000;

function byteLength(str: string): number {
  return Buffer.byteLength(str, "utf8");
}

/**
 * Normalize chunks so every item is under Google's 5000-byte limit.
 * Re-chunks any oversized chunk using chunkText().
 */
function normalizeChunks(chunks: string[]): string[] {
  const out: string[] = [];
  for (const c of chunks) {
    const trimmed = c.trim();
    if (!trimmed) continue;
    if (byteLength(trimmed) <= DEFAULT_MAX_CHUNK_BYTES) {
      out.push(trimmed);
    } else {
      out.push(...chunkText(trimmed, { maxChunkBytes: DEFAULT_MAX_CHUNK_BYTES }));
    }
  }
  return out;
}

/**
 * Synthesize text (or chunks) to speech via Google TTS, concatenate audio,
 * upload to Supabase Storage, and return the public URL.
 * Long input is chunked to stay under Google's 5000-byte limit per request.
 */
export async function synthesizeToSpeech(
  input: { text?: string; chunks?: string[] }
): Promise<SynthesizeResult> {
  console.info("[tts/pipeline] Preparing synthesis input");
  let chunks: string[] = [];
  if (input.chunks?.length) {
    console.info("[tts/pipeline] Normalizing provided chunks", {
      inputChunkCount: input.chunks.length,
    });
    chunks = normalizeChunks(input.chunks);
  } else if (input.text?.trim()) {
    console.info("[tts/pipeline] Chunking raw text input", {
      textLength: input.text.length,
    });
    chunks = chunkText(input.text.trim(), {
      maxChunkBytes: DEFAULT_MAX_CHUNK_BYTES,
    });
  }

  if (chunks.length === 0) {
    console.warn("[tts/pipeline] No chunks available after preprocessing");
    throw new Error("Provide either text or chunks");
  }

  console.info("[tts/pipeline] Synthesizing chunks", {
    chunkCount: chunks.length,
  });
  const buffers: Buffer[] = [];
  for (let i = 0; i < chunks.length; i++) {
    const chunk = chunks[i];
    const trimmed = chunk.trim();
    if (!trimmed) continue;
    if (byteLength(trimmed) > MAX_TTS_BYTES) {
      throw new Error(
        `Chunk exceeds ${MAX_TTS_BYTES} bytes (got ${byteLength(trimmed)}). This should not happen after normalizeChunks.`
      );
    }
    console.info("[tts/pipeline] Synthesizing chunk", {
      chunkIndex: i + 1,
      totalChunks: chunks.length,
      chunkBytes: byteLength(trimmed),
    });
    const buf = await synthesizeChunk(trimmed);
    buffers.push(buf);
  }

  if (buffers.length === 0) {
    console.warn("[tts/pipeline] No audio buffers generated");
    throw new Error("No audio was generated");
  }

  console.info("[tts/pipeline] Combining chunk audio buffers", {
    bufferCount: buffers.length,
  });
  const combined = Buffer.concat(buffers);
  console.info("[tts/pipeline] Uploading combined audio", {
    bytes: combined.length,
  });
  const { audioUrl, path } = await uploadAudio(combined);
  console.info("[tts/pipeline] Upload completed", { path });
  return { audioUrl, path };
}
