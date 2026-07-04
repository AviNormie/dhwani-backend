import type { SynthesizeOptions } from "./google-tts";

/** Unicode script ranges for Indian languages supported by Google Cloud TTS. */
const SCRIPTS = {
  devanagari: /[\u0900-\u097F]/g,
  bengali: /[\u0980-\u09FF]/g,
  gurmukhi: /[\u0A00-\u0A7F]/g,
  gujarati: /[\u0A80-\u0AFF]/g,
  odia: /[\u0B00-\u0B7F]/g,
  tamil: /[\u0B80-\u0BFF]/g,
  telugu: /[\u0C00-\u0C7F]/g,
  kannada: /[\u0C80-\u0CFF]/g,
  malayalam: /[\u0D00-\u0D7F]/g,
  latin: /[a-zA-Z]/g,
} as const;

type IndianLanguageCode =
  | "hi-IN"
  | "mr-IN"
  | "bn-IN"
  | "pa-IN"
  | "gu-IN"
  | "or-IN"
  | "ta-IN"
  | "te-IN"
  | "kn-IN"
  | "ml-IN"
  | "en-IN";

const VOICE_BY_LANGUAGE: Record<IndianLanguageCode, string> = {
  "hi-IN": "hi-IN-Wavenet-A",
  "mr-IN": "mr-IN-Wavenet-A",
  "bn-IN": "bn-IN-Wavenet-A",
  "pa-IN": "pa-IN-Wavenet-A",
  "gu-IN": "gu-IN-Wavenet-C",
  "or-IN": "or-IN-Standard-A",
  "ta-IN": "ta-IN-Wavenet-A",
  "te-IN": "te-IN-Wavenet-A",
  "kn-IN": "kn-IN-Wavenet-C",
  "ml-IN": "ml-IN-Wavenet-C",
  "en-IN": "en-IN-Wavenet-A",
};

/** Script → default Google TTS language (non-Devanagari scripts are unambiguous). */
const SCRIPT_LANGUAGE: Partial<
  Record<keyof typeof SCRIPTS, IndianLanguageCode>
> = {
  bengali: "bn-IN",
  gurmukhi: "pa-IN",
  gujarati: "gu-IN",
  odia: "or-IN",
  tamil: "ta-IN",
  telugu: "te-IN",
  kannada: "kn-IN",
  malayalam: "ml-IN",
};

function countMatches(text: string, re: RegExp): number {
  return (text.match(re) ?? []).length;
}

function countWordHits(text: string, words: string[], weight = 2): number {
  let score = 0;
  for (const word of words) {
    score += countMatches(text, new RegExp(word, "g")) * weight;
  }
  return score;
}

/**
 * Devanagari is shared by Hindi, Marathi, Nepali, etc.
 * Score distinctive Marathi vs Hindi markers; default Hindi when unclear.
 */
function detectDevanagariLanguage(text: string): "hi-IN" | "mr-IN" {
  let marathiScore = 0;
  let hindiScore = 0;

  // ळ is extremely common in Marathi and rare in standard Hindi.
  marathiScore += countMatches(text, /ळ/g) * 6;
  marathiScore += countMatches(text, /[ऑॲ]/g) * 4;

  marathiScore += countWordHits(text, [
    "आहे",
    "नाही",
    "तुम्ही",
    "आम्ही",
    "मी",
    "आणि",
    "म्हणून",
    "म्हणाले",
    "म्हणते",
    "म्हणतात",
    "होते",
    "होणार",
    "माझे",
    "तुमचे",
    "त्याचे",
    "आपले",
    "पण",
    "काही",
    "मराठी",
    "महाराष्ट्र",
    "पुणे",
    "मुंबई",
  ]);

  hindiScore += countWordHits(text, [
    "है",
    "नहीं",
    "नही",
    "मैं",
    "हम",
    "और",
    "लेकिन",
    "परंतु",
    "क्योंकि",
    "क्यों",
    "होगा",
    "होगी",
    "होंगे",
    "था",
    "थी",
    "थे",
    "मेरे",
    "आपके",
    "उसके",
    "इसके",
    "कुछ",
    "हिंदी",
    "भारत",
    "दिल्ली",
  ]);

  // Shared words — lighter weight, tie-breaker only.
  marathiScore += countWordHits(
    text,
    ["काय", "हे", "ते", "जे", "की", "आता"],
    1
  );
  hindiScore += countWordHits(
    text,
    ["क्या", "यह", "वह", "जो", "कि", "अब"],
    1
  );

  return marathiScore > hindiScore ? "mr-IN" : "hi-IN";
}

function dominantScript(
  text: string
): { script: keyof typeof SCRIPTS; count: number } | null {
  let best: { script: keyof typeof SCRIPTS; count: number } | null = null;

  for (const [script, re] of Object.entries(SCRIPTS) as [
    keyof typeof SCRIPTS,
    RegExp,
  ][]) {
    if (script === "latin") continue;
    const count = countMatches(text, re);
    if (!best || count > best.count) {
      best = { script, count };
    }
  }

  return best && best.count >= 5 ? best : null;
}

/**
 * Detect the best Google Cloud TTS language + voice for Indian regional text.
 * Uses script detection first, then Marathi/Hindi heuristics for Devanagari.
 */
export function detectTtsLanguage(text: string): SynthesizeOptions {
  const sample = text.trim();
  if (!sample) {
    return { languageCode: "en-IN", voice: VOICE_BY_LANGUAGE["en-IN"] };
  }

  const latinCount = countMatches(sample, SCRIPTS.latin);
  const dominant = dominantScript(sample);

  if (!dominant || dominant.count <= latinCount) {
    return { languageCode: "en-IN", voice: VOICE_BY_LANGUAGE["en-IN"] };
  }

  if (dominant.script === "devanagari") {
    const code = detectDevanagariLanguage(sample);
    return { languageCode: code, voice: VOICE_BY_LANGUAGE[code] };
  }

  const code = SCRIPT_LANGUAGE[dominant.script];
  if (code) {
    return { languageCode: code, voice: VOICE_BY_LANGUAGE[code] };
  }

  return { languageCode: "en-IN", voice: VOICE_BY_LANGUAGE["en-IN"] };
}

export function resolveTtsOptions(
  text: string,
  override?: Partial<SynthesizeOptions>
): SynthesizeOptions {
  if (override?.languageCode && override?.voice) {
    return {
      languageCode: override.languageCode,
      voice: override.voice,
    };
  }
  if (override?.languageCode) {
    const code = override.languageCode as IndianLanguageCode;
    return {
      languageCode: code,
      voice:
        override.voice ??
        VOICE_BY_LANGUAGE[code] ??
        VOICE_BY_LANGUAGE["en-IN"],
    };
  }
  return detectTtsLanguage(text);
}
