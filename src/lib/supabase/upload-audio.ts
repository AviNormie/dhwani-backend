import { getSupabase } from "./client";

const BUCKET = "tts-audio";

export interface UploadAudioResult {
  audioUrl: string;
  path: string;
}

/**
 * Upload audio buffer to Supabase Storage and return public URL.
 * Bucket must exist and have public read access (or use signed URL if preferred).
 */
export async function uploadAudio(
  buffer: Buffer,
  filename?: string
): Promise<UploadAudioResult> {
  const path = filename ?? `${crypto.randomUUID()}.mp3`;

  const { data, error } = await getSupabase().storage
    .from(BUCKET)
    .upload(path, buffer, {
      contentType: "audio/mpeg",
      upsert: true,
    });

  if (error) {
    throw new Error(`Supabase storage upload failed: ${error.message}`);
  }

  const {
    data: { publicUrl },
  } = getSupabase().storage.from(BUCKET).getPublicUrl(data.path);

  return { audioUrl: publicUrl, path: data.path };
}
