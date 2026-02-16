import { synthesizeChunk } from "./google-tts";
import { uploadAudio } from "@/lib/supabase/upload-audio";
import {
  chunkText,
  DEFAULT_MAX_CHUNK_BYTES,
} from "@/lib/pdf/chunk-text";

export interface SynthesizeResult {
  audioUrl: string;
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
  let chunks: string[] = [];
  if (input.chunks?.length) {
    chunks = normalizeChunks(input.chunks);
  } else if (input.text?.trim()) {
    chunks = chunkText(input.text.trim(), {
      maxChunkBytes: DEFAULT_MAX_CHUNK_BYTES,
    });
  }

  if (chunks.length === 0) {
    throw new Error("Provide either text or chunks");
  }

  const buffers: Buffer[] = [];
  for (const chunk of chunks) {
    const trimmed = chunk.trim();
    if (!trimmed) continue;
    if (byteLength(trimmed) > MAX_TTS_BYTES) {
      throw new Error(
        `Chunk exceeds ${MAX_TTS_BYTES} bytes (got ${byteLength(trimmed)}). This should not happen after normalizeChunks.`
      );
    }
    const buf = await synthesizeChunk(trimmed);
    buffers.push(buf);
  }

  if (buffers.length === 0) {
    throw new Error("No audio was generated");
  }

  const combined = Buffer.concat(buffers);
  const { audioUrl } = await uploadAudio(combined);
  return { audioUrl };
}
