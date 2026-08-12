import { supabase } from '../lib/supabase';
import type { Database } from '../lib/database.types';

type ProfileRow = Database['public']['Tables']['profiles']['Row'];

export interface MemberRole {
  id: string;
  name: string;
  color: string;
  position: number;
  permissions: number;
}

export interface ServerMemberWithProfile {
  id: string;
  server_id: string;
  user_id: string;
  nickname: string | null;
  joined_at: string;
  timeout_until: string | null;
  profile: ProfileRow;
  roles: MemberRole[];
}

export async function getServerMembersWithRoles(serverId: string): Promise<ServerMemberWithProfile[]> {
  const { data: members, error } = await supabase
    .from('server_members')
    .select('*, profiles:user_id(*)')
    .eq('server_id', serverId);

  if (error || !members || members.length === 0) return [];

  const { data: roleRows } = await supabase
    .from('roles')
    .select('id, name, color, position, permissions')
    .eq('server_id', serverId);

  const roles = (roleRows || []) as MemberRole[];

  let roleMembers: { role_id: string; user_id: string }[] = [];
  if (roles.length > 0) {
    const { data: rm } = await supabase
      .from('role_members')
      .select('role_id, user_id')
      .in('role_id', roles.map((role) => role.id));
    roleMembers = rm || [];
  }

  const roleByUser = new Map<string, MemberRole[]>();
  roleMembers.forEach((entry) => {
    const role = roles.find((r) => r.id === entry.role_id);
    if (!role) return;
    const list = roleByUser.get(entry.user_id) || [];
    list.push(role);
    roleByUser.set(entry.user_id, list);
  });

  return (members as (Record<string, unknown> & { profiles: ProfileRow | null })[])
    .filter((member) => member.profiles)
    .map((member) => ({
      id: member.id as string,
      server_id: member.server_id as string,
      user_id: member.user_id as string,
      nickname: (member.nickname as string | null) ?? null,
      joined_at: member.joined_at as string,
      timeout_until: (member.timeout_until as string | null) ?? null,
      profile: member.profiles as ProfileRow,
      roles: (roleByUser.get(member.user_id as string) || []).sort((a, b) => b.position - a.position),
    }));
}
