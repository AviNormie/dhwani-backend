/**
 * Shared options for Google Cloud Node clients (TTS, Vision, Storage).
 * Supports either:
 * 1) GCP_CLIENT_EMAIL + GCP_PRIVATE_KEY, or
 * 2) GOOGLE_APPLICATION_CREDENTIALS (path to service account JSON).
 * GCP_PROJECT_ID is recommended for Storage/LRO.
 */
export interface GcpClientAuthOptions {
  credentials?: { client_email: string; private_key: string };
  projectId?: string;
}

export function getGcpClientOptions(): GcpClientAuthOptions {
  const client_email = process.env.GCP_CLIENT_EMAIL;
  const private_key = process.env.GCP_PRIVATE_KEY?.replace(/\\n/g, "\n");
  const credentialsPath = process.env.GOOGLE_APPLICATION_CREDENTIALS;
  const projectId = process.env.GCP_PROJECT_ID;

  if (client_email && private_key) {
    return {
      credentials: { client_email, private_key },
      ...(projectId ? { projectId } : {}),
    };
  }

  if (credentialsPath?.trim()) {
    return projectId ? { projectId } : {};
  }

  throw new Error(
    "Missing Google auth config. Set GCP_CLIENT_EMAIL + GCP_PRIVATE_KEY, or set GOOGLE_APPLICATION_CREDENTIALS."
  );
}
