import { supabase } from '../lib/supabase';
import type { Database } from '../lib/database.types';

type Profile = Database['public']['Tables']['profiles']['Row'];

// ============================================================
// PROFILES SERVICE
// ============================================================

/** Retorna perfil por ID */
export async function getProfile(userId: string): Promise<Profile | null> {
  const { data, error } = await supabase
    .from('profiles')
    .select('*')
    .eq('id', userId)
    .single();

  if (error) return null;
  return data;
}

/** Retorna perfil pelo username */
export async function getProfileByUsername(username: string): Promise<Profile | null> {
  const { data, error } = await supabase
    .from('profiles')
    .select('*')
    .eq('username', username)
    .single();

  if (error) return null;
  return data;
}

/** Retorna o perfil do usuário autenticado */
export async function getMyProfile(): Promise<Profile | null> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;
  return getProfile(user.id);
}

/** Atualiza perfil do usuário autenticado */
export async function updateProfile(updates: {
  display_name?: string;
  username?: string;
  bio?: string;
  avatar_url?: string;
  status?: Profile['status'];
}): Promise<{ success: boolean; data?: Profile; error?: string }> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { success: false, error: 'Não autenticado.' };

  // Verificar username único se mudou
  if (updates.username) {
    const existing = await getProfileByUsername(updates.username);
    if (existing && existing.id !== user.id) {
      return { success: false, error: 'Este username já está em uso.' };
    }
  }

  const { data, error } = await supabase
    .from('profiles')
    .update(updates)
    .eq('id', user.id)
    .select()
    .single();

  if (error) return { success: false, error: error.message };
  return { success: true, data };
}

/** Atualiza o status de presença */
export async function updateStatus(status: Profile['status']): Promise<void> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return;

  await supabase
    .from('profiles')
    .update({ status })
    .eq('id', user.id);
}

/** Busca perfis por username (autocomplete / pesquisa) */
export async function searchProfiles(query: string, limit = 10): Promise<Profile[]> {
  const { data, error } = await supabase
    .from('profiles')
    .select('*')
    .ilike('username', `%${query}%`)
    .limit(limit);

  if (error) return [];
  return data;
}

/** Retorna múltiplos perfis por IDs */
export async function getProfiles(userIds: string[]): Promise<Profile[]> {
  if (userIds.length === 0) return [];

  const { data, error } = await supabase
    .from('profiles')
    .select('*')
    .in('id', userIds);

  if (error) return [];
  return data;
}
