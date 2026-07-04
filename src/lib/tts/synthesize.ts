import { synthesizeChunk, type SynthesizeOptions } from "./google-tts";
import { randomUUID } from "node:crypto";
import { uploadAudioToGcs } from "@/lib/gcs/storage";
import {
  chunkText,
} from "@/lib/pdf/chunk-text";
import { detectTtsLanguage, resolveTtsOptions } from "./detect-language";

export { detectTtsLanguage } from "./detect-language";

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

/** Preserve Unicode (Hindi/Devanagari); only strip control chars and normalize whitespace. */
export function cleanText(text: string): string {
  return text
    .replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g, "")
    .replace(/[ \t]+/g, " ")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

function findSentenceBreak(text: string, maxChars: number): number {
  const minBreak = Math.floor(maxChars * 0.5);
  const candidates = [
    text.lastIndexOf(". ", maxChars),
    text.lastIndexOf("। ", maxChars),
    text.lastIndexOf("।", maxChars),
    text.lastIndexOf("? ", maxChars),
    text.lastIndexOf("! ", maxChars),
    text.lastIndexOf("\n\n", maxChars),
    text.lastIndexOf("\n", maxChars),
    text.lastIndexOf(" ", maxChars),
  ];
  const best = Math.max(...candidates);
  return best >= minBreak ? best : -1;
}

function splitByMaxChars(text: string, maxChars: number): string[] {
  if (text.length <= maxChars) return [text];
  const out: string[] = [];
  let remaining = text;

  while (remaining.length > maxChars) {
    let splitAt = findSentenceBreak(remaining, maxChars);
    if (splitAt < 1) {
      splitAt = maxChars;
    } else {
      const ch = remaining[splitAt];
      if (ch === "." || ch === "?" || ch === "!") {
        splitAt += 1;
      } else if (ch === "।") {
        splitAt += 1;
      } else if (remaining.slice(splitAt, splitAt + 2) === "\n\n") {
        splitAt += 2;
      } else if (ch === "\n") {
        splitAt += 1;
      }
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
  input: {
    text?: string;
    chunks?: string[];
    /** Full document text for language detection when synthesizing a single chunk. */
    detectFromText?: string;
    languageCode?: string;
    voice?: string;
  }
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

  const languageSample =
    input.detectFromText?.trim() ||
    input.text?.trim() ||
    chunks.join(" ");
  const ttsOptions = resolveTtsOptions(languageSample, {
    languageCode: input.languageCode,
    voice: input.voice,
  });
  console.info("[tts/pipeline] Synthesizing chunks", {
    chunkCount: chunks.length,
    languageCode: ttsOptions.languageCode,
    voice: ttsOptions.voice,
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
    const buf = await synthesizeChunk(cleaned, ttsOptions);
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
