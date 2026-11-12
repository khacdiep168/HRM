import { createClient, type SupabaseClient } from "@supabase/supabase-js";

let cachedAdminClient: SupabaseClient | null = null;

export class MissingSupabaseConfigError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "MissingSupabaseConfigError";
  }
}

/**
 * Server-only Supabase client using SUPABASE_SERVICE_ROLE_KEY.
 * NEVER import this file in Client Components.
 */
export function getSupabaseAdminClient(): SupabaseClient {
  if (typeof window !== "undefined") {
    throw new Error("getSupabaseAdminClient must never run in the browser.");
  }
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!url || !serviceKey || serviceKey === "your-supabase-service-role-key") {
    throw new MissingSupabaseConfigError(
      "Chưa cấu hình NEXT_PUBLIC_SUPABASE_URL hoặc SUPABASE_SERVICE_ROLE_KEY trong biến môi trường server."
    );
  }

  if (!cachedAdminClient) {
    cachedAdminClient = createClient(url, serviceKey, {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
    });
  }
  return cachedAdminClient;
}

