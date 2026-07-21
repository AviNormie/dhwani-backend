import { GoogleAuth } from "google-auth-library";
import { getGcpClientOptions } from "@/lib/gcp/credentials";

/** Map Google TTS locale codes → Cloud Translation target language codes. */
const TRANSLATE_TARGET: Record<string, string> = {
  "en-IN": "en",
  "hi-IN": "hi",
  "mr-IN": "mr",
  "ta-IN": "ta",
  "te-IN": "te",
  "bn-IN": "bn",
  "gu-IN": "gu",
  "kn-IN": "kn",
  "ml-IN": "ml",
  "pa-IN": "pa",
  "or-IN": "or",
};

let authClient: GoogleAuth | null = null;

function getAuth(): GoogleAuth {
  if (!authClient) {
    const opts = getGcpClientOptions();
    authClient = new GoogleAuth({
      credentials: opts.credentials,
      projectId: opts.projectId,
      scopes: ["https://www.googleapis.com/auth/cloud-translation"],
    });
  }
  return authClient;
}

function toTranslateCode(languageCode: string): string {
  const trimmed = languageCode.trim();
  return TRANSLATE_TARGET[trimmed] ?? trimmed.split("-")[0]?.toLowerCase() ?? "en";
}

/**
 * Translate text to the given TTS language (e.g. hi-IN → hi).
 * Returns original text if empty or already effectively the same.
 */
export async function translateToLanguage(
  text: string,
  languageCode: string
): Promise<string> {
  const input = text.trim();
  if (!input) return input;

  const target = toTranslateCode(languageCode);
  const projectId = process.env.GCP_PROJECT_ID?.trim();
  if (!projectId) {
    throw new Error("Missing GCP_PROJECT_ID for translation");
  }

  console.info("[translate] Translating text", {
    chars: input.length,
    target,
    languageCode,
  });

  const client = await getAuth().getClient();
  const url = `https://translation.googleapis.com/v3/projects/${projectId}:translateText`;

  const res = await client.request<{
    translations?: Array<{ translatedText?: string }>;
  }>({
    url,
    method: "POST",
    data: {
      contents: [input],
      mimeType: "text/plain",
      targetLanguageCode: target,
    },
  });

  const translated = res.data.translations?.[0]?.translatedText?.trim();
  if (!translated) {
    throw new Error("Translation returned empty text");
  }

  console.info("[translate] Translation completed", {
    chars: translated.length,
    target,
  });
  return translated;
}

export async function translateChunksToLanguage(
  chunks: string[],
  languageCode: string
): Promise<string[]> {
  const out: string[] = [];
  for (const chunk of chunks) {
    const trimmed = chunk.trim();
    if (!trimmed) continue;
    out.push(await translateToLanguage(trimmed, languageCode));
  }
  return out;
}
