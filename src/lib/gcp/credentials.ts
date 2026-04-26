/**
 * Shared options for Google Cloud Node clients (TTS, Vision, Storage).
 * Requires GCP_CLIENT_EMAIL and GCP_PRIVATE_KEY; GCP_PROJECT_ID is recommended for Storage/LRO.
 */
export interface GcpClientAuthOptions {
  credentials: { client_email: string; private_key: string };
  projectId?: string;
}

export function getGcpClientOptions(): GcpClientAuthOptions {
  const client_email = process.env.GCP_CLIENT_EMAIL;
  const private_key = process.env.GCP_PRIVATE_KEY?.replace(/\\n/g, "\n");

  if (!client_email || !private_key) {
    throw new Error(
      "Missing GCP_CLIENT_EMAIL or GCP_PRIVATE_KEY environment variables"
    );
  }

  const projectId = process.env.GCP_PROJECT_ID;
  return {
    credentials: { client_email, private_key },
    ...(projectId ? { projectId } : {}),
  };
}
