This is a [Next.js](https://nextjs.org) project bootstrapped with [`create-next-app`](https://nextjs.org/docs/app/api-reference/cli/create-next-app). It provides PDF text extraction (embedded text or **Google Cloud Vision OCR** for scanned PDFs), Google Cloud TTS, with audio stored in Supabase Storage.

## Environment variables

Create `.env.local` (or set variables in your host) with:

| Variable | Description |
| -------- | ----------- |
| `SUPABASE_URL` | Supabase project URL (e.g. `https://xxxx.supabase.co`) |
| `SUPABASE_SERVICE_ROLE_KEY` | Supabase service role key (for Storage uploads) |
| `GCP_CLIENT_EMAIL` | Google service account email |
| `GCP_PRIVATE_KEY` | Google service account private key (single line with `\n`) |
| `GCP_PROJECT_ID` | Google Cloud project ID (recommended for Vision/Storage LRO) |
| `GCS_OCR_BUCKET` | GCS bucket name (not a `gs://` URL) used for Vision async PDF OCR. Required when a PDF has **no embedded text** (scanned documents). Objects are written under `ocr-input/` and `ocr-output/` and deleted after each run. |

**Supabase:** Create a Storage bucket named `tts-audio` and allow public read (or use signed URLs if you prefer).

### Google Cloud setup for OCR

1. Enable the **Cloud Vision API** on the same project as TTS.
2. Create a **Cloud Storage** bucket whose name you set as `GCS_OCR_BUCKET` (any region; same region as your compute avoids extra latency).
3. Grant the service account used by the app:
   - **Vision AI User** (or a role that includes `vision.files.asyncBatchAnnotate`), and
   - **Storage Object Admin** on that bucket (or equivalent: create/read/delete objects under the OCR prefixes).

Without `GCS_OCR_BUCKET`, uploads of scanned PDFs (no extractable text) return **400** with code `OCR_FAILED` explaining that OCR is not configured.

### Timeouts and hosting

Vision OCR is a **long-running** step (often seconds; large PDFs can take minutes). This repo sets `maxDuration = 300` on [`src/app/api/pdf/upload/route.ts`](src/app/api/pdf/upload/route.ts). On **Vercel**, your plan’s function timeout still applies—raise it in the dashboard if OCR requests are cut off, or run the API on a host with a higher limit.

## API

- `POST /api/pdf/upload` — FormData with `file` (PDF). Returns `{ text, chunks, chunkSize, usedOcr }`. Text comes from embedded PDF parsing when possible; otherwise **Vision `DOCUMENT_TEXT_DETECTION`** via GCS. Response code `OCR_FAILED` indicates missing OCR config or Vision/GCS failure.
- `POST /api/tts/synthesize` — JSON `{ text }` or `{ chunks: string[] }`. Returns `{ audioUrl }` (Supabase public URL).
- `GET /api/health` — Returns `{ ok: true }`.

## Getting Started

First, run the development server:

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) with your browser to see the result.

## Tests

```bash
npm test
```

## Learn More

- [Next.js Documentation](https://nextjs.org/docs)
- [Detect text in files (PDF/TIFF)](https://cloud.google.com/vision/docs/pdf)

## Deploy on Vercel

The easiest way to deploy your Next.js app is to use the [Vercel Platform](https://vercel.com/new?utm_medium=default-template&filter=next.js&utm_source=create-next-app&utm_campaign=create-next-app-readme) from the creators of Next.js.

Check out [Next.js deployment documentation](https://nextjs.org/docs/app/building-your-application/deploying) for more details.
