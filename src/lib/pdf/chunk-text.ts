/**
 * Google TTS has a limit of 5000 BYTES per request (not characters).
 * We chunk by UTF-8 byte length and prefer breaking at sentence or paragraph boundaries.
 */
export const DEFAULT_MAX_CHUNK_BYTES = 4900; // stay under 5000 byte limit

export interface ChunkTextOptions {
  /** Max size per chunk in UTF-8 bytes. Default 4900 (under Google's 5000 limit). */
  maxChunkBytes?: number;
}

function byteLength(str: string): number {
  return Buffer.byteLength(str, "utf8");
}

/**
 * Split text into chunks suitable for TTS (each under maxChunkBytes).
 * Prefers breaking at sentence, paragraph, or word boundaries.
 */
export function chunkText(
  text: string,
  options: ChunkTextOptions = {}
): string[] {
  const maxBytes = options.maxChunkBytes ?? DEFAULT_MAX_CHUNK_BYTES;
  const trimmed = text.trim();
  if (!trimmed) return [];

  const chunks: string[] = [];
  let remaining = trimmed;

  while (remaining.length > 0) {
    if (byteLength(remaining) <= maxBytes) {
      chunks.push(remaining.trim());
      break;
    }

    // Find the longest substring that fits in maxBytes (by character, then trim to fit)
    let end = remaining.length;
    let candidate = remaining;
    while (end > 0 && byteLength(remaining.slice(0, end)) > maxBytes) {
      end = Math.floor(end * 0.9);
      candidate = remaining.slice(0, end);
    }
    // Expand character by character until we're at or just under maxBytes
    while (end < remaining.length && byteLength(remaining.slice(0, end + 1)) <= maxBytes) {
      end += 1;
    }
    const slice = remaining.slice(0, end);

    // Prefer break at sentence end, then double newline, then single newline, then space
    const lastPeriod = slice.lastIndexOf(". ");
    const lastDoubleNewline = slice.lastIndexOf("\n\n");
    const lastNewline = slice.lastIndexOf("\n");
    const lastSpace = slice.lastIndexOf(" ");

    const breakAt = Math.max(
      lastPeriod >= 0 ? lastPeriod + 1 : -1,
      lastDoubleNewline >= 0 ? lastDoubleNewline + 2 : -1,
      lastNewline >= 0 ? lastNewline + 1 : -1,
      lastSpace >= 0 ? lastSpace + 1 : -1
    );

    if (breakAt > 0) {
      const chunk = remaining.slice(0, breakAt).trim();
      if (byteLength(chunk) > maxBytes) {
        // Break point still too large (e.g. long word); force split at byte boundary
        let forceEnd = 0;
        for (let i = 1; i <= chunk.length; i++) {
          if (byteLength(chunk.slice(0, i)) > maxBytes) break;
          forceEnd = i;
        }
        chunks.push(chunk.slice(0, forceEnd).trim());
        remaining = (chunk.slice(forceEnd) + remaining.slice(breakAt)).trim();
      } else {
        chunks.push(chunk);
        remaining = remaining.slice(breakAt).trim();
      }
    } else {
      chunks.push(slice.trim());
      remaining = remaining.slice(slice.length).trim();
    }
  }

  return chunks.filter((c) => c.length > 0);
}

/** @deprecated Use maxChunkBytes. Kept for backwards compatibility. */
export const DEFAULT_MAX_CHUNK_SIZE = DEFAULT_MAX_CHUNK_BYTES;
