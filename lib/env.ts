export const publicEnv = {
  supabaseUrl: process.env.NEXT_PUBLIC_SUPABASE_URL ?? "",
  supabaseAnonKey: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? ""
};

export const hasSupabaseEnv = Boolean(
  publicEnv.supabaseUrl && publicEnv.supabaseAnonKey
);
