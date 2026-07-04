import { describe, it, expect } from "vitest";
import { detectTtsLanguage } from "./detect-language";

describe("detectTtsLanguage", () => {
  it("detects Hindi Devanagari", () => {
    const result = detectTtsLanguage(
      "यह एक हिंदी वाक्य है। मैं भारत से हूँ और यह कहानी बहुत अच्छी है।"
    );
    expect(result.languageCode).toBe("hi-IN");
    expect(result.voice).toBe("hi-IN-Wavenet-A");
  });

  it("detects Marathi Devanagari", () => {
    const result = detectTtsLanguage(
      "हे मराठी वाक्य आहे. मी पुण्यात राहतो आणि मराठी भाषा खूप सुंदर आहे. तुम्ही हे ऐकू शकता."
    );
    expect(result.languageCode).toBe("mr-IN");
    expect(result.voice).toBe("mr-IN-Wavenet-A");
  });

  it("detects Marathi via ळ letter", () => {
    const result = detectTtsLanguage(
      "गुळ, कळा, आणि ळ हे मराठी शब्द आहेत."
    );
    expect(result.languageCode).toBe("mr-IN");
  });

  it("detects Tamil", () => {
    const result = detectTtsLanguage(
      "இது தமிழ் மொழியில் எழுதப்பட்ட ஒரு வாக்கியம். தமிழ் மிகவும் பழமையான மொழி."
    );
    expect(result.languageCode).toBe("ta-IN");
  });

  it("detects Bengali", () => {
    const result = detectTtsLanguage(
      "এটি বাংলা ভাষায় লেখা একটি বাক্য। বাংলা খুব সুন্দর ভাষা।"
    );
    expect(result.languageCode).toBe("bn-IN");
  });

  it("detects Telugu", () => {
    const result = detectTtsLanguage(
      "ఇది తెలుగు భాషలో రాసిన వాక్యం. తెలుగు చాలా మధురమైన భాష."
    );
    expect(result.languageCode).toBe("te-IN");
  });

  it("defaults to English for Latin text", () => {
    const result = detectTtsLanguage(
      "This is an English paragraph about science and history."
    );
    expect(result.languageCode).toBe("en-IN");
  });
});
