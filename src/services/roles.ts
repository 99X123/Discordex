import { supabase } from '../lib/supabase';
import type { Database } from '../lib/database.types';

type RoleRow = Database['public']['Tables']['roles']['Row'];
type ChannelRolePermRow = Database['public']['Tables']['channel_role_permissions']['Row'];
type AuditLogRow = Database['public']['Functions']['get_audit_logs']['Returns'][number];

export type { RoleRow, ChannelRolePermRow, AuditLogRow };

type RpcResult = { success: boolean; error?: string };

const parseResult = (data: unknown): RpcResult => {
  const result = data as { success?: boolean; error?: string; message?: string } | null;
  if (!result) return { success: false, error: 'Resposta vazia do servidor.' };
  return { success: Boolean(result.success), error: result.message ?? result.error };
};

export async function getServerRoles(serverId: string): Promise<RoleRow[]> {
  const { data, error } = await supabase
    .from('roles')
    .select('*')
    .eq('server_id', serverId)
    .order('position', { ascending: false });
  if (error) return [];
  return (data || []) as RoleRow[];
}

export async function getChannelRolePermissions(serverId: string): Promise<ChannelRolePermRow[]> {
  const { data: channels } = await supabase.from('channels').select('id').eq('server_id', serverId);
  const channelIds = (channels || []).map((channel) => channel.id);
  if (channelIds.length === 0) return [];
  const { data, error } = await supabase
    .from('channel_role_permissions')
    .select('*')
    .in('channel_id', channelIds);
  if (error) return [];
  return (data || []) as ChannelRolePermRow[];
}

export async function createRole(
  serverId: string,
  name: string,
  color: string,
  permissions: number
): Promise<RpcResult> {
  const { data, error } = await supabase.rpc('create_role', {
    p_server_id: serverId,
    p_name: name,
    p_color: color,
    p_permissions: permissions,
  });
  if (error) return { success: false, error: error.message };
  return parseResult(data);
}

export async function updateRole(
  serverId: string,
  roleId: string,
  updates: { name?: string; color?: string; permissions?: number; position?: number }
): Promise<RpcResult> {
  const { data, error } = await supabase.rpc('update_role', {
    p_server_id: serverId,
    p_role_id: roleId,
    p_name: updates.name ?? null,
    p_color: updates.color ?? null,
    p_permissions: updates.permissions ?? null,
    p_position: updates.position ?? null,
  });
  if (error) return { success: false, error: error.message };
  return parseResult(data);
}

export async function deleteRole(serverId: string, roleId: string): Promise<RpcResult> {
  const { data, error } = await supabase.rpc('delete_role', {
    p_server_id: serverId,
    p_role_id: roleId,
  });
  if (error) return { success: false, error: error.message };
  return parseResult(data);
}

export async function addRoleToMember(
  serverId: string,
  targetId: string,
  roleId: string
): Promise<RpcResult> {
  const { data, error } = await supabase.rpc('add_role_to_member', {
    p_server_id: serverId,
    p_target_id: targetId,
    p_role_id: roleId,
  });
  if (error) return { success: false, error: error.message };
  return parseResult(data);
}

export async function removeRoleFromMember(
  serverId: string,
  targetId: string,
  roleId: string
): Promise<RpcResult> {
  const { data, error } = await supabase.rpc('remove_role_from_member', {
    p_server_id: serverId,
    p_target_id: targetId,
    p_role_id: roleId,
  });
  if (error) return { success: false, error: error.message };
  return parseResult(data);
}

export async function promoteMember(
  serverId: string,
  targetId: string,
  roleId: string
): Promise<RpcResult> {
  const { data, error } = await supabase.rpc('promote_member', {
    p_server_id: serverId,
    p_target_id: targetId,
    p_role_id: roleId,
  });
  if (error) return { success: false, error: error.message };
  return parseResult(data);
}

export async function demoteMember(
  serverId: string,
  targetId: string,
  roleId: string
): Promise<RpcResult> {
  const { data, error } = await supabase.rpc('demote_member', {
    p_server_id: serverId,
    p_target_id: targetId,
    p_role_id: roleId,
  });
  if (error) return { success: false, error: error.message };
  return parseResult(data);
}

export async function kickMember(serverId: string, targetId: string): Promise<RpcResult> {
  const { data, error } = await supabase.rpc('kick_member', {
    p_server_id: serverId,
    p_target_id: targetId,
  });
  if (error) return { success: false, error: error.message };
  return parseResult(data);
}

export async function banMember(serverId: string, targetId: string): Promise<RpcResult> {
  const { data, error } = await supabase.rpc('ban_member', {
    p_server_id: serverId,
    p_target_id: targetId,
  });
  if (error) return { success: false, error: error.message };
  return parseResult(data);
}

export async function timeoutMember(serverId: string, targetId: string, minutes: number): Promise<RpcResult> {
  const { data, error } = await supabase.rpc('timeout_member', {
    p_server_id: serverId,
    p_target_id: targetId,
    p_minutes: minutes,
  });
  if (error) return { success: false, error: error.message };
  return parseResult(data);
}

export async function disconnectMember(
  serverId: string,
  targetId: string,
  channelId: string
): Promise<RpcResult> {
  const { data, error } = await supabase.rpc('disconnect_member', {
    p_server_id: serverId,
    p_target_id: targetId,
    p_channel_id: channelId,
  });
  if (error) return { success: false, error: error.message };
  return parseResult(data);
}

export async function moveMember(
  serverId: string,
  targetId: string,
  fromChannelId: string,
  toChannelId: string
): Promise<RpcResult> {
  const { data, error } = await supabase.rpc('move_member', {
    p_server_id: serverId,
    p_target_id: targetId,
    p_from_channel_id: fromChannelId,
    p_to_channel_id: toChannelId,
  });
  if (error) return { success: false, error: error.message };
  return parseResult(data);
}

export async function setMemberMuted(
  serverId: string,
  targetId: string,
  muted: boolean
): Promise<RpcResult> {
  const { data, error } = await supabase.rpc('set_member_muted', {
    p_server_id: serverId,
    p_target_id: targetId,
    p_muted: muted,
  });
  if (error) return { success: false, error: error.message };
  return parseResult(data);
}

export async function setMemberDeafened(
  serverId: string,
  targetId: string,
  deafened: boolean
): Promise<RpcResult> {
  const { data, error } = await supabase.rpc('set_member_deafened', {
    p_server_id: serverId,
    p_target_id: targetId,
    p_deafened: deafened,
  });
  if (error) return { success: false, error: error.message };
  return parseResult(data);
}

export async function setChannelRolePermission(
  channelId: string,
  roleId: string,
  canView: boolean,
  canSend: boolean
): Promise<RpcResult> {
  const { data, error } = await supabase.rpc('set_channel_role_permission', {
    p_channel_id: channelId,
    p_role_id: roleId,
    p_can_view: canView,
    p_can_send: canSend,
  });
  if (error) return { success: false, error: error.message };
  return parseResult(data);
}

export async function removeChannelRolePermission(
  channelId: string,
  roleId: string
): Promise<RpcResult> {
  const { data, error } = await supabase.rpc('remove_channel_role_permission', {
    p_channel_id: channelId,
    p_role_id: roleId,
  });
  if (error) return { success: false, error: error.message };
  return parseResult(data);
}

export async function getAuditLogs(
  serverId: string,
  limit = 100
): Promise<AuditLogRow[]> {
  const { data, error } = await supabase.rpc('get_audit_logs', {
    p_server_id: serverId,
    p_limit: limit,
  });
  if (error) return [];
  return (data || []) as AuditLogRow[];
}

export const AUDIT_ACTION_LABELS: Record<string, string> = {
  ROLE_CREATED: 'Cargo criado',
  ROLE_UPDATED: 'Cargo atualizado',
  ROLE_DELETED: 'Cargo removido',
  ROLE_ASSIGNED: 'Cargo adicionado',
  ROLE_REMOVED: 'Cargo removido',
  MEMBER_PROMOTED: 'Promoção',
  MEMBER_DEMOTED: 'Rebaixamento',
  MEMBER_JOINED: 'Entrada no grupo',
  MEMBER_LEFT: 'Saída do grupo',
  MEMBER_KICKED: 'Membro removido',
  MEMBER_BANNED: 'Membro banido',
  MEMBER_TIMEOUT: 'Timeout aplicado',
  VOICE_DISCONNECTED: 'Desconexão da call',
  VOICE_MOVED: 'Mover de call',
  VOICE_MUTED: 'Membro mutado',
  VOICE_DEAFENED: 'Membro ensurdecido',
  CHANNEL_PERMISSION_CHANGED: 'Permissão de canal alterada',
};
