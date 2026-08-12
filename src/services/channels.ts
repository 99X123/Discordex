import { supabase } from '../lib/supabase';
import type { Database } from '../lib/database.types';

type Channel = Database['public']['Tables']['channels']['Row'];

// ============================================================
// CHANNELS SERVICE
// ============================================================

/** Retorna todos os canais de um servidor organizados por categoria */
export async function getChannels(serverId: string): Promise<Channel[]> {
  const { data, error } = await supabase
    .from('channels')
    .select('*')
    .eq('server_id', serverId)
    .order('position');

  if (error) return [];
  return data;
}

/** Retorna um canal por ID */
export async function getChannel(channelId: string): Promise<Channel | null> {
  const { data, error } = await supabase
    .from('channels')
    .select('*')
    .eq('id', channelId)
    .single();

  if (error) return null;
  return data;
}

/** Cria um novo canal */
export async function createChannel(
  serverId: string,
  name: string,
  type: 'text' | 'voice' | 'category',
  options?: {
    description?: string;
    parentId?: string;
    position?: number;
  }
): Promise<{ success: boolean; channel?: Channel; error?: string }> {
  const formattedName = name.toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '');

  const { data, error } = await supabase
    .from('channels')
    .insert({
      server_id: serverId,
      name: formattedName,
      type,
      description: options?.description ?? null,
      parent_id: options?.parentId ?? null,
      position: options?.position ?? 0,
    })
    .select()
    .single();

  if (error) return { success: false, error: error.message };
  return { success: true, channel: data };
}

/** Atualiza nome/descrição de um canal */
export async function updateChannel(
  channelId: string,
  updates: { name?: string; description?: string; position?: number }
): Promise<{ success: boolean; error?: string }> {
  const { error } = await supabase
    .from('channels')
    .update(updates)
    .eq('id', channelId);

  if (error) return { success: false, error: error.message };
  return { success: true };
}

/** Remove um canal */
export async function deleteChannel(channelId: string): Promise<{ success: boolean; error?: string }> {
  const { error } = await supabase
    .from('channels')
    .delete()
    .eq('id', channelId);

  if (error) return { success: false, error: error.message };
  return { success: true };
}

/** Reordena canais */
export async function reorderChannels(
  updates: { id: string; position: number }[]
): Promise<{ success: boolean; error?: string }> {
  for (const update of updates) {
    const { error } = await supabase
      .from('channels')
      .update({ position: update.position })
      .eq('id', update.id);

    if (error) return { success: false, error: error.message };
  }

  return { success: true };
}
