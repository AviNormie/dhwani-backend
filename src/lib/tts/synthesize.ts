import { synthesizeChunk } from "./google-tts";
import { randomUUID } from "node:crypto";
import { uploadAudioToGcs } from "@/lib/gcs/storage";
import {
  chunkText,
} from "@/lib/pdf/chunk-text";

export interface SynthesizeResult {
  audioUrl: string;
  path: string;
}

const MAX_TTS_BYTES = 5000;
const TTS_TARGET_MAX_CHARS = 2800;
const TTS_TARGET_MAX_BYTES = 3000;

function byteLength(str: string): number {
  return Buffer.byteLength(str, "utf8");
}

export function cleanText(text: string): string {
  return text
    .replace(/\s+/g, " ")
    .replace(/[\n\r]+/g, " ")
    .replace(/[^\x00-\x7F]/g, "")
    .trim();
}

function splitByMaxChars(text: string, maxChars: number): string[] {
  if (text.length <= maxChars) return [text];
  const out: string[] = [];
  let remaining = text;

  while (remaining.length > maxChars) {
    let splitAt = remaining.lastIndexOf(". ", maxChars);
    if (splitAt < maxChars * 0.5) {
      splitAt = remaining.lastIndexOf(" ", maxChars);
    }
    if (splitAt < 1) {
      splitAt = maxChars;
    } else if (remaining[splitAt] === ".") {
      splitAt += 1;
    }

    out.push(remaining.slice(0, splitAt).trim());
    remaining = remaining.slice(splitAt).trim();
  }

  if (remaining) out.push(remaining);
  return out;
}

/**
 * Normalize chunks so every item is under Google's 5000-byte limit.
 * Re-chunks any oversized chunk using chunkText().
 */
function normalizeChunks(chunks: string[]): string[] {
  const out: string[] = [];
  for (const c of chunks) {
    const cleaned = cleanText(c);
    if (!cleaned) continue;

    const charSafeChunks = splitByMaxChars(cleaned, TTS_TARGET_MAX_CHARS);
    for (const part of charSafeChunks) {
      if (!part) continue;
      if (byteLength(part) <= TTS_TARGET_MAX_BYTES) {
        out.push(part);
      } else {
        out.push(...chunkText(part, { maxChunkBytes: TTS_TARGET_MAX_BYTES }));
      }
    }
  }
  return out.filter((chunk) => chunk.length > 0);
}

function normalizeTextInput(text: string): string[] {
  const cleaned = cleanText(text);
  if (!cleaned) return [];

  if (byteLength(cleaned) <= TTS_TARGET_MAX_BYTES && cleaned.length <= TTS_TARGET_MAX_CHARS) {
    return [cleaned];
  }

  const chunks = chunkText(cleaned, {
    maxChunkBytes: TTS_TARGET_MAX_BYTES,
  });
  return normalizeChunks(chunks);
}

/**
 * Synthesize text (or chunks) to speech via Google TTS, concatenate audio,
 * upload to GCS, and return the file URL.
 * Input text is sanitized and chunked conservatively for better TTS stability.
 */
export async function synthesizeToSpeech(
  input: { text?: string; chunks?: string[] }
): Promise<SynthesizeResult> {
  console.info("[tts/pipeline] Preparing synthesis input");
  let chunks: string[] = [];
  if (input.chunks?.length) {
    console.info("[tts/pipeline] Normalizing provided chunks", {
      inputChunkCount: input.chunks.length,
      targetMaxChars: TTS_TARGET_MAX_CHARS,
      targetMaxBytes: TTS_TARGET_MAX_BYTES,
    });
    chunks = normalizeChunks(input.chunks);
  } else if (input.text?.trim()) {
    console.info("[tts/pipeline] Cleaning and chunking raw text input", {
      textLength: input.text.length,
      targetMaxChars: TTS_TARGET_MAX_CHARS,
      targetMaxBytes: TTS_TARGET_MAX_BYTES,
    });
    chunks = normalizeTextInput(input.text);
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
    const cleaned = cleanText(chunk);
    if (!cleaned) continue;
    if (byteLength(cleaned) > MAX_TTS_BYTES) {
      throw new Error(
        `Chunk exceeds ${MAX_TTS_BYTES} bytes (got ${byteLength(cleaned)}). This should not happen after normalizeChunks.`
      );
    }
    console.info("[tts/pipeline] Synthesizing chunk", {
      chunkIndex: i + 1,
      totalChunks: chunks.length,
      chunkBytes: byteLength(cleaned),
      chunkChars: cleaned.length,
    });
    const buf = await synthesizeChunk(cleaned);
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
  const { url: audioUrl, path } = await uploadAudioToGcs({
    buffer: combined,
    fileName: `${randomUUID()}.mp3`,
    contentType: "audio/mpeg",
  });
  console.info("[tts/pipeline] Upload completed", { path });
  return { audioUrl, path };
}
