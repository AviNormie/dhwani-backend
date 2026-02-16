This is a [Next.js](https://nextjs.org) project bootstrapped with [`create-next-app`](https://nextjs.org/docs/app/api-reference/cli/create-next-app). It provides PDF text extraction and Google Cloud TTS, with audio stored in Supabase Storage.

## Environment variables

Copy `.env.example` to `.env.local` and set:

| Variable | Description |
| -------- | ----------- |
| `SUPABASE_URL` | Supabase project URL (e.g. `https://xxxx.supabase.co`) |
| `SUPABASE_SERVICE_ROLE_KEY` | Supabase service role key (for Storage uploads) |
| `GOOGLE_APPLICATION_CREDENTIALS` | Path to Google Cloud service account JSON, **or** |
| `GCP_CLIENT_EMAIL` + `GCP_PRIVATE_KEY` | Service account email and private key from that JSON |

**Supabase:** Create a Storage bucket named `tts-audio` and allow public read (or use signed URLs if you prefer).

## API

- `POST /api/pdf/upload` — FormData with `file` (PDF). Returns `{ text, chunks, chunkSize }`.
- `POST /api/tts/synthesize` — JSON `{ text }` or `{ chunks: string[] }`. Returns `{ audioUrl }` (Supabase public URL).
- `GET /api/health` — Returns `{ ok: true }`.

## Getting Started

First, run the development server:

```bash
npm run dev
# or
yarn dev
# or
pnpm dev
# or
bun dev
```

Open [http://localhost:3000](http://localhost:3000) with your browser to see the result.

You can start editing the page by modifying `app/page.tsx`. The page auto-updates as you edit the file.

This project uses [`next/font`](https://nextjs.org/docs/app/building-your-application/optimizing/fonts) to automatically optimize and load [Geist](https://vercel.com/font), a new font family for Vercel.

## Learn More

To learn more about Next.js, take a look at the following resources:

- [Next.js Documentation](https://nextjs.org/docs) - learn about Next.js features and API.
- [Learn Next.js](https://nextjs.org/learn) - an interactive Next.js tutorial.

You can check out [the Next.js GitHub repository](https://github.com/vercel/next.js) - your feedback and contributions are welcome!

## Deploy on Vercel

The easiest way to deploy your Next.js app is to use the [Vercel Platform](https://vercel.com/new?utm_medium=default-template&filter=next.js&utm_source=create-next-app&utm_campaign=create-next-app-readme) from the creators of Next.js.

Check out our [Next.js deployment documentation](https://nextjs.org/docs/app/building-your-application/deploying) for more details.
