import { getSupabase } from "./client";

const BUCKET = "tts-audio";

export interface UploadAudioResult {
  audioUrl: string;
  path: string;
}

export async function uploadAudio(
  buffer: Buffer,
  filename?: string
): Promise<UploadAudioResult> {
  const objectName = filename ?? `${crypto.randomUUID()}.mp3`;
  const supabase = getSupabase();

  const { data, error } = await supabase.storage
    .from(BUCKET)
    .upload(objectName, buffer, {
      contentType: "audio/mpeg",
      upsert: true,
    });

  if (error || !data) {
    throw new Error(
      `SUPABASE_STORAGE_UPLOAD_FAILED: ${error?.message ?? "No upload data returned"}`
    );
  }

  const {
    data: { publicUrl },
  } = supabase.storage.from(BUCKET).getPublicUrl(data.path);

  return { audioUrl: publicUrl, path: data.path };
}
