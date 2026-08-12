import { supabase } from '../lib/supabase';
import type { Database } from '../lib/database.types';

type Server = Database['public']['Tables']['servers']['Row'];

// ============================================================
// SERVERS SERVICE
// ============================================================

/** Retorna todos os servidores do usuário autenticado */
export async function getMyServers(): Promise<Server[]> {
  const { data, error } = await supabase
    .from('servers')
    .select(`
      *,
      server_members!inner(user_id)
    `)
    .eq('server_members.user_id', (await supabase.auth.getUser()).data.user?.id ?? '')
    .order('created_at');

  if (error) return [];
  return data as Server[];
}

/** Retorna servidor por ID */
export async function getServer(serverId: string): Promise<Server | null> {
  const { data, error } = await supabase
    .from('servers')
    .select('*')
    .eq('id', serverId)
    .single();

  if (error) return null;
  return data;
}

/** Cria um novo servidor com estrutura padrão */
export async function createServer(
  name: string,
  description?: string
): Promise<{ success: boolean; serverId?: string; error?: string }> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { success: false, error: 'Não autenticado.' };

  const { data, error } = await supabase.rpc('create_server_with_defaults', {
    p_name: name,
    p_description: description ?? null,
  });

  if (error) return { success: false, error: error.message };
  return { success: true, serverId: data as string };
}

/** Atualiza informações do servidor */
export async function updateServer(
  serverId: string,
  updates: { name?: string; description?: string; icon_url?: string }
): Promise<{ success: boolean; error?: string }> {
  const { error } = await supabase
    .from('servers')
    .update(updates)
    .eq('id', serverId);

  if (error) return { success: false, error: error.message };
  return { success: true };
}

/** Exclui o servidor (somente o dono) */
export async function deleteServer(serverId: string): Promise<{ success: boolean; error?: string }> {
  const { error } = await supabase
    .from('servers')
    .delete()
    .eq('id', serverId);

  if (error) return { success: false, error: error.message };
  return { success: true };
}

/** Sair de um servidor */
export async function leaveServer(serverId: string): Promise<{ success: boolean; error?: string }> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { success: false, error: 'Não autenticado.' };

  // Dono não pode sair sem transferir
  const server = await getServer(serverId);
  if (server?.owner_id === user.id) {
    return { success: false, error: 'O proprietário não pode sair do servidor sem transferir a propriedade.' };
  }

  const { error } = await supabase
    .from('server_members')
    .delete()
    .eq('server_id', serverId)
    .eq('user_id', user.id);

  if (error) return { success: false, error: error.message };
  return { success: true };
}

/** Entrar via código de convite */
export async function joinServerViaInvite(
  code: string
): Promise<{ success: boolean; serverId?: string; error?: string }> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { success: false, error: 'Não autenticado.' };

  const { data, error } = await supabase.rpc('join_server_with_invite', {
    p_code: code,
  });

  if (error) return { success: false, error: error.message };

  const result = data as { success: boolean; server_id?: string; error?: string; message?: string };
  if (!result.success) {
    return { success: false, error: result.message ?? result.error };
  }

  return { success: true, serverId: result.server_id };
}

/** Retorna membros de um servidor com perfis */
export async function getServerMembers(serverId: string) {
  const { data, error } = await supabase
    .from('server_members')
    .select(`
      *,
      profiles:user_id (*)
    `)
    .eq('server_id', serverId)
    .order('joined_at');

  if (error) return [];
  return data;
}

/** Verifica se usuário é membro de um servidor */
export async function isMember(serverId: string, userId?: string): Promise<boolean> {
  const uid = userId ?? (await supabase.auth.getUser()).data.user?.id;
  if (!uid) return false;

  const { data } = await supabase
    .from('server_members')
    .select('id')
    .eq('server_id', serverId)
    .eq('user_id', uid)
    .single();

  return !!data;
}
