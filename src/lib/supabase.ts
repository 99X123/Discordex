import { createClient } from '@supabase/supabase-js';
import type { Database } from './database.types';

const rawSupabaseUrl = import.meta.env.VITE_SUPABASE_URL as string;
export const supabaseUrl = rawSupabaseUrl.trim().replace(/\/+$/, '').replace(/\/rest\/v1$/i, '');
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY as string;

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error(
    'Variáveis de ambiente do Supabase não encontradas.\n' +
    'Copie .env.example para .env.local e preencha com os valores do seu projeto.'
  );
}

export const supabase = createClient<Database>(supabaseUrl, supabaseAnonKey, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: true,
  },
  realtime: {
    params: {
      eventsPerSecond: 10,
    },
  },
});

export type SupabaseClient = typeof supabase;
