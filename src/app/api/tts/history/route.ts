import { NextRequest } from "next/server";
import { getSupabase } from "@/lib/supabase/client";
import { internalError } from "@/utils/errors";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const BUCKET = "tts-audio";

export async function GET(_req: NextRequest) {
  try {
    const supabase = getSupabase();

    const { data, error } = await supabase.storage
      .from(BUCKET)
      .list("", {
        limit: 100,
        sortBy: { column: "created_at", order: "desc" },
      });

    if (error) {
      throw new Error(`SUPABASE_STORAGE_LIST_FAILED: ${error.message}`);
    }

    const items =
      data?.map((item) => {
        const {
          data: { publicUrl },
        } = supabase.storage.from(BUCKET).getPublicUrl(item.name);
        return {
          name: item.name,
          path: item.name,
          createdAt: (item as any).created_at ?? null,
          url: publicUrl,
        };
      }) ?? [];

    return Response.json({ items });
  } catch (err) {
    const message =
      err instanceof Error ? err.message : "Failed to list audio history";
    return internalError(message, "STORAGE_FAILED");
  }
}

