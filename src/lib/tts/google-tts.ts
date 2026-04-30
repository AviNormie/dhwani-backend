import textToSpeech from "@google-cloud/text-to-speech";
import { getGcpClientOptions } from "@/lib/gcp/credentials";

type TTSClient = InstanceType<typeof textToSpeech.TextToSpeechClient>;
let client: TTSClient | null = null;

function getClient(): TTSClient {
  if (!client) {
    client = new textToSpeech.TextToSpeechClient({
      ...getGcpClientOptions(),
      fallback: true,
    });
  }
  return client;
}

const DEFAULT_VOICE = "en-IN-Wavenet-A";
const DEFAULT_LANGUAGE = "en-IN";

export interface SynthesizeOptions {
  voice?: string;
  languageCode?: string;
}

const GOOGLE_TTS_MAX_BYTES = 5000;

/**
 * Synthesize a single text chunk to MP3 audio buffer.
 * Chunk must be ≤ 5000 UTF-8 bytes (Google limit). Use chunkText() for longer input.
 */
export async function synthesizeChunk(
  text: string,
  options: SynthesizeOptions = {}
): Promise<Buffer> {
  const bytes = Buffer.byteLength(text, "utf8");
  console.info("[tts/google] Synthesizing chunk via Google TTS", {
    bytes,
    voice: options.voice ?? DEFAULT_VOICE,
    languageCode: options.languageCode ?? DEFAULT_LANGUAGE,
  });
  if (bytes > GOOGLE_TTS_MAX_BYTES) {
    throw new Error(
      `Input is longer than the limit of ${GOOGLE_TTS_MAX_BYTES} bytes (got ${bytes}). Chunk text before calling or use the synthesize API with text/chunks so the server can chunk for you.`
    );
  }
  const tts = getClient();
  const [response] = await tts.synthesizeSpeech({
    input: { text },
    voice: {
      name: options.voice ?? DEFAULT_VOICE,
      languageCode: options.languageCode ?? DEFAULT_LANGUAGE,
    },
    audioConfig: {
      audioEncoding: "MP3",
      sampleRateHertz: 24000,
    },
  });

  const content = response.audioContent;
  if (!content || !(content instanceof Uint8Array)) {
    throw new Error("Google TTS returned no audio");
  }
  console.info("[tts/google] Google TTS chunk synthesis successful", {
    outputBytes: content.byteLength,
  });
  return Buffer.from(content);
}
