import path from "node:path";
import fs from "node:fs";
import textToSpeech from "@google-cloud/text-to-speech";

type TTSClient = InstanceType<typeof textToSpeech.TextToSpeechClient>;
let client: TTSClient | null = null;

function resolveCredentialsPath(rawPath: string): string {
  const resolved = path.isAbsolute(rawPath)
    ? rawPath
    : path.resolve(process.cwd(), rawPath);
  if (fs.existsSync(resolved)) return resolved;
  const inCwd = path.resolve(process.cwd(), path.basename(rawPath));
  if (fs.existsSync(inCwd)) return inCwd;
  return resolved;
}

function getClient(): TTSClient {
  if (!client) {
    const rawPath = process.env.GOOGLE_APPLICATION_CREDENTIALS;
    const keyFilename = rawPath ? resolveCredentialsPath(rawPath) : undefined;
    const clientEmail = process.env.GCP_CLIENT_EMAIL;
    const privateKey = process.env.GCP_PRIVATE_KEY?.replace(/\\n/g, "\n");

    if (keyFilename) {
      client = new textToSpeech.TextToSpeechClient({ keyFilename });
    } else if (clientEmail && privateKey) {
      client = new textToSpeech.TextToSpeechClient({
        credentials: { client_email: clientEmail, private_key: privateKey },
      });
    } else {
      throw new Error(
        "Set GOOGLE_APPLICATION_CREDENTIALS or GCP_CLIENT_EMAIL + GCP_PRIVATE_KEY"
      );
    }
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
  return Buffer.from(content);
}
