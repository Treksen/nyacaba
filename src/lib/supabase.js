import { createClient } from '@supabase/supabase-js';

const url = import.meta.env.VITE_SUPABASE_URL;
const key = import.meta.env.VITE_SUPABASE_ANON_KEY;

if (!url || !key) {
  // eslint-disable-next-line no-console
  console.warn(
    '[Nyacaba] VITE_SUPABASE_URL or VITE_SUPABASE_ANON_KEY is missing. ' +
    'Copy .env.example to .env and fill in your Supabase credentials.'
  );
}

export const supabase = createClient(
  url || 'https://placeholder.supabase.co',
  key || 'placeholder-anon-key',
  {
    auth: {
      autoRefreshToken: true,
      persistSession: true,
      detectSessionInUrl: true,
    },
  }
);

export const isSupabaseConfigured = Boolean(url && key);
