import fs from "node:fs";
import path from "node:path";
import { NextRequest } from "next/server";
import { getSupabase } from "@/lib/supabase/client";
import { internalError } from "@/utils/errors";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const BUCKET = "tts-audio";

export async function GET(_req: NextRequest) {
  try {
    try {
      const supabase = getSupabase();
      const { data, error } = await supabase.storage
        .from(BUCKET)
        .list("", {
          limit: 100,
          sortBy: { column: "created_at", order: "desc" },
        });

      if (error) {
        throw new Error(error.message);
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
    } catch (supabaseError) {
      if (process.env.NODE_ENV === "production") {
        throw new Error(
          `SUPABASE_STORAGE_LIST_FAILED: ${
            supabaseError instanceof Error ? supabaseError.message : "Unknown storage error"
          }`
        );
      }
      // Local dev fallback only (Vercel file system is read-only).
    }

    const dir = path.join(process.cwd(), "public", BUCKET);
    const entries = await fs.promises.readdir(dir, { withFileTypes: true }).catch(() => []);
    const files = entries.filter((entry) => entry.isFile()).slice(0, 100);

    const withStats = await Promise.all(
      files.map(async (file) => {
        const filePath = path.join(dir, file.name);
        const stat = await fs.promises.stat(filePath);
        return { file, stat };
      })
    );

    withStats.sort((a, b) => b.stat.mtimeMs - a.stat.mtimeMs);

    const origin = _req.nextUrl.origin;
    const items = withStats.map(({ file, stat }) => ({
      name: file.name,
      path: `${BUCKET}/${file.name}`,
      createdAt: stat.mtime.toISOString(),
      url: `${origin}/${BUCKET}/${encodeURIComponent(file.name)}`,
    }));

    return Response.json({ items });
  } catch (err) {
    const message =
      err instanceof Error ? err.message : "Failed to list audio history";
    return internalError(message, "STORAGE_FAILED");
  }
}

