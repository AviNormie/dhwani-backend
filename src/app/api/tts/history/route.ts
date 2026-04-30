import { listRecentAudioFromGcs } from "@/lib/gcs/storage";
import { internalError } from "@/utils/errors";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET() {
  try {
    const items = await listRecentAudioFromGcs(100);
    return Response.json({ items });
  } catch (err) {
    const message =
      err instanceof Error ? err.message : "Failed to list audio history";
    return internalError(message, "STORAGE_FAILED");
  }
}

