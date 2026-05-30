import { createClient } from "@supabase/supabase-js"; // or "@supabase/supabase-js"

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

// Check global scope to see if a client instance is already registered
const globalForSupabase = globalThis;

export const supabase =
  globalForSupabase.supabase || createClient(supabaseUrl, supabaseAnonKey);

// Save the instance to the global window space during local development
if (process.env.NODE_ENV !== "production") {
  globalForSupabase.supabase = supabase;
}