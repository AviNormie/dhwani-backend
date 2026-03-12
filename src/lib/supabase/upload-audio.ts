import fs from "node:fs";
import path from "node:path";
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

  const supabaseUrl = process.env.SUPABASE_URL;
  const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (supabaseUrl && supabaseKey) {
    try {
      const { data, error } = await getSupabase().storage
        .from(BUCKET)
        .upload(objectName, buffer, {
          contentType: "audio/mpeg",
          upsert: true,
        });

      if (!error && data) {
        const {
          data: { publicUrl },
        } = getSupabase().storage.from(BUCKET).getPublicUrl(data.path);

        return { audioUrl: publicUrl, path: data.path };
      }
    } catch {}
  }

  const publicDir = path.join(process.cwd(), "public", BUCKET);
  await fs.promises.mkdir(publicDir, { recursive: true });
  const filePath = path.join(publicDir, objectName);
  await fs.promises.writeFile(filePath, buffer);
  const publicUrlPath = `/${BUCKET}/${objectName}`;

  return { audioUrl: publicUrlPath, path: filePath };
}
