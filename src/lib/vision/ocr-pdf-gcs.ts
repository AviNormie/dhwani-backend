import { Storage } from "@google-cloud/storage";
import { ImageAnnotatorClient } from "@google-cloud/vision";
import type { ClientOptions } from "google-gax";
import { randomUUID } from "crypto";
import { getGcpClientOptions } from "@/lib/gcp/credentials";
import { mergeVisionAsyncOutputJsonBodies } from "@/lib/vision/merge-vision-output";
import { PdfOcrError } from "@/lib/vision/pdf-ocr-error";

let visionClient: ImageAnnotatorClient | null = null;
let storageClient: Storage | null = null;

function getVisionClient(): ImageAnnotatorClient {
  if (!visionClient) {
    visionClient = new ImageAnnotatorClient(
      getGcpClientOptions() as ClientOptions
    );
  }
  return visionClient;
}

function getStorage(): Storage {
  if (!storageClient) {
    storageClient = new Storage(getGcpClientOptions());
  }
  return storageClient;
}

async function deletePrefix(bucketName: string, prefix: string): Promise<void> {
  const bucket = getStorage().bucket(bucketName);
  const [files] = await bucket.getFiles({ prefix });
  await Promise.all(files.map((f) => f.delete({ ignoreNotFound: true })));
}

/**
 * OCR a PDF via Vision async batch (input/output on GCS). Uploads, runs DOCUMENT_TEXT_DETECTION,
 * reads JSON outputs, merges text, then deletes GCS objects under the run prefix.
 */
export async function extractTextFromPdfViaVisionGcs(
  pdfBuffer: Buffer
): Promise<string> {
  const bucketName = process.env.GCS_OCR_BUCKET?.trim();
  if (!bucketName) {
    throw new PdfOcrError(
      "Scanned PDF detected but GCS_OCR_BUCKET is not set. Set it to a GCS bucket for Vision OCR output, or use a text-based PDF.",
      "config"
    );
  }

  const id = randomUUID();
  const inputPath = `ocr-input/${id}.pdf`;
  const outputPrefix = `ocr-output/${id}/`;
  const gcsSourceUri = `gs://${bucketName}/${inputPath}`;
  const gcsDestinationUri = `gs://${bucketName}/${outputPrefix}`;

  const bucket = getStorage().bucket(bucketName);
  const inputFile = bucket.file(inputPath);

  try {
    await inputFile.save(pdfBuffer, {
      contentType: "application/pdf",
      resumable: false,
      metadata: { cacheControl: "no-cache" },
    });

    const client = getVisionClient();
    const [operation] = await client.asyncBatchAnnotateFiles({
      requests: [
        {
          inputConfig: {
            mimeType: "application/pdf",
            gcsSource: { uri: gcsSourceUri },
          },
          features: [{ type: "DOCUMENT_TEXT_DETECTION" }],
          outputConfig: {
            batchSize: 5,
            gcsDestination: { uri: gcsDestinationUri },
          },
        },
      ],
    });

    await operation.promise();

    const [outputFiles] = await bucket.getFiles({ prefix: outputPrefix });
    const jsonFiles = outputFiles.filter((f) => f.name.endsWith(".json"));

    if (jsonFiles.length === 0) {
      throw new PdfOcrError(
        "Vision OCR finished but no result JSON files were found in GCS.",
        "execution"
      );
    }

    const bodies = await Promise.all(
      jsonFiles.map(async (f) => {
        const [buf] = await f.download();
        return { name: f.name, body: buf.toString("utf8") };
      })
    );

    const merged = mergeVisionAsyncOutputJsonBodies(bodies);
    if (!merged.trim()) {
      throw new PdfOcrError(
        "Vision OCR returned no readable text for this PDF.",
        "execution"
      );
    }
    return merged;
  } catch (e) {
    if (e instanceof PdfOcrError) throw e;
    const msg = e instanceof Error ? e.message : String(e);
    throw new PdfOcrError(`Vision OCR failed: ${msg}`, "execution");
  } finally {
    await inputFile.delete({ ignoreNotFound: true }).catch(() => undefined);
    await deletePrefix(bucketName, outputPrefix).catch(() => undefined);
  }
}
