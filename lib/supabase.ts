import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { hasSupabaseEnv, publicEnv } from "@/lib/env";

let browserClient: SupabaseClient | null = null;

export function getSupabaseClient() {
  if (typeof window === "undefined" || !hasSupabaseEnv) {
    return null;
  }

  if (!browserClient) {
    browserClient = createClient(
      publicEnv.supabaseUrl,
      publicEnv.supabaseAnonKey,
      {
        auth: {
          autoRefreshToken: false,
          persistSession: false
        }
      }
    );
  }

  return browserClient;
}
