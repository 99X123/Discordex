import React, { useRef } from 'react';
import { useApp } from '../context/AppContext';
import type { ServerMember } from '../context/AppContext';
import { useContextMenu, type ContextMenuItem } from './ContextMenu';
import { PERMISSIONS } from '../lib/permissions';
import { supabase } from '../lib/supabase';
import {
  Shield, ArrowUp, ArrowDown, PhoneOff,
  MoveRight, LogOut, UserCircle2,
} from 'lucide-react';

const statusColor = (status: string) =>
  status === 'online' ? 'bg-discordex-success' :
  status === 'idle' ? 'bg-discordex-warning' :
  status === 'dnd' ? 'bg-discordex-danger' :
  'bg-discordex-text-secondary';

export const SidebarMembers: React.FC = () => {
  const {
    serverMembers,
    activeServerId,
    openModal,
    currentUser,
    servers,
    serverRoles,
    getMyPermissions,
    addRoleToMember,
    removeRoleFromMember,
    promoteMember,
    demoteMember,
    kickMember,
    disconnectMemberFromCall,
    moveMemberBetweenChannels,
  } = useApp();

  const { openMenu } = useContextMenu();
  const lastMenuPosRef = useRef({ x: 0, y: 0 });
  const voiceByUserRef = useRef<Record<string, string>>({});
  const memberRef = useRef<ServerMember | null>(null);

  const members = activeServerId ? (serverMembers[activeServerId] || []) : [];
  const activeServer = servers.find((server) => server.id === activeServerId);
  const roles = activeServerId ? (serverRoles[activeServerId] || []) : [];

  const online = members.filter((m) => m.profile.status !== 'offline');
  const offline = members.filter((m) => m.profile.status === 'offline');

  const roleGroups: { name: string | null; color?: string; members: ServerMember[] }[] = [];
  const roleMap = new Map<string, { name: string; color: string; members: ServerMember[] }>();
  const noRole: ServerMember[] = [];

  online.forEach((member) => {
    const role = member.roles[0];
    if (!role) {
      noRole.push(member);
      return;
    }
    let group = roleMap.get(role.id);
    if (!group) {
      group = { name: role.name, color: role.color, members: [] };
      roleMap.set(role.id, group);
      roleGroups.push(group);
    }
    group.members.push(member);
  });

  if (noRole.length > 0) roleGroups.push({ name: null, members: noRole });

  const getTargetVoiceChannel = async (userId: string): Promise<string | null> => {
    if (!activeServer || !activeServerId) return null;
    const voiceIds = activeServer.channels.filter((channel) => channel.type === 'voice').map((channel) => channel.id);
    if (voiceIds.length === 0) return null;
    const { data } = await supabase
      .from('voice_states')
      .select('channel_id')
      .eq('user_id', userId)
      .in('channel_id', voiceIds)
      .maybeSingle();
    return data?.channel_id || null;
  };

  // Submenu "Cargos": alterna cargos com checkbox, estilo Discord
  const buildRoleToggleItems = (member: ServerMember): ContextMenuItem[] => {
    const myPerms = getMyPermissions(activeServerId!);
    const hasRoleIds = new Set(member.roles.map((role) => role.id));
    const manageable = roles.filter((role) => myPerms.isOwner || role.position < myPerms.topPosition);
    if (manageable.length === 0) {
      return [{ label: 'Nenhum cargo gerenciável' }];
    }
    return manageable.map((role) => ({
      label: role.name,
      icon: <Shield className="w-4 h-4" style={{ color: role.color }} />,
      checked: hasRoleIds.has(role.id),
      keepOpen: true,
      onClick: async () => {
        const has = hasRoleIds.has(role.id);
        const ok = has
          ? await removeRoleFromMember(activeServerId!, member.userId, role.id)
          : await addRoleToMember(activeServerId!, member.userId, role.id);
        if (ok) reopenMemberMenu();
      },
    }));
  };

  const buildRoleSubmenuItems = (member: ServerMember, mode: 'promote' | 'demote'): ContextMenuItem[] => {
    const myPerms = getMyPermissions(activeServerId!);
    const targetTop = member.roles[0]?.position ?? -1;
    const hasRoleIds = new Set(member.roles.map((role) => role.id));
    const manageable = roles.filter((role) => myPerms.isOwner || role.position < myPerms.topPosition);

    const list = mode === 'promote'
      ? manageable.filter((role) => !hasRoleIds.has(role.id) && role.position > targetTop)
      : manageable.filter((role) => hasRoleIds.has(role.id) && role.position > targetTop);

    if (list.length === 0) {
      return [{ label: mode === 'promote' ? 'Nenhum cargo superior' : 'Nenhum cargo acima para remover' }];
    }
    return list.map((role) => ({
      label: role.name,
      icon: <Shield className="w-4 h-4" style={{ color: role.color }} />,
      onClick: () => {
        if (mode === 'promote') void promoteMember(activeServerId!, member.userId, role.id);
        else void demoteMember(activeServerId!, member.userId, role.id);
      },
    }));
  };

  const buildMoveSubmenu = (member: ServerMember, fromChannelId: string): ContextMenuItem[] => {
    const targets = (activeServer?.channels || []).filter((channel) => channel.type === 'voice' && channel.id !== fromChannelId);
    if (targets.length === 0) {
      return [{ label: 'Nenhum canal de voz disponível' }];
    }
    return targets.map((channel) => ({
      label: channel.name,
      icon: <MoveRight className="w-4 h-4" />,
      onClick: () => void moveMemberBetweenChannels(activeServerId!, member.userId, fromChannelId, channel.id),
    }));
  };

  const reopenMemberMenu = () => {
    if (!memberRef.current || !activeServerId) return;
    const fresh = (serverMembers[activeServerId] || []).find((m) => m.id === memberRef.current!.id) || memberRef.current;
    void openMemberMenu(fresh, lastMenuPosRef.current.x, lastMenuPosRef.current.y, false);
  };

  const openMemberMenu = async (
    member: ServerMember,
    x: number,
    y: number,
    fetchVoice = true
  ) => {
    if (!activeServerId) return;
    memberRef.current = member;
    const { isOwner, permissions, topPosition } = getMyPermissions(activeServerId);
    const targetTop = member.roles[0]?.position ?? -1;
    const canManage = isOwner || topPosition > targetTop;
    const hasPerm = (bit: number) => isOwner || (permissions & bit) === bit;

    const buildItems = (voiceChannel: string | null): ContextMenuItem[] => {
      const items: ContextMenuItem[] = [{
        label: 'Ver informações do membro',
        icon: <UserCircle2 className="w-4 h-4" />,
        onClick: () => openModal('profile-view', { ...member.profile, role: (member.roles[0]?.name as ServerMember['profile']['role']) || undefined }),
      }];

      const canManageRoles = canManage && hasPerm(PERMISSIONS.MANAGE_ROLES);
      if (canManageRoles) {
        items.push({ divider: true });
        items.push({
          label: 'Cargos',
          icon: <Shield className="w-4 h-4" />,
          submenu: buildRoleToggleItems(member),
        });
        if (canManage && (hasPerm(PERMISSIONS.PROMOTE_MEMBERS) || hasPerm(PERMISSIONS.MANAGE_ROLES))) {
          items.push({
            label: 'Promover',
            icon: <ArrowUp className="w-4 h-4" />,
            submenu: buildRoleSubmenuItems(member, 'promote'),
          });
        }
        if (canManage && (hasPerm(PERMISSIONS.DEMOTE_MEMBERS) || hasPerm(PERMISSIONS.MANAGE_ROLES))) {
          items.push({
            label: 'Rebaixar',
            icon: <ArrowDown className="w-4 h-4" />,
            submenu: buildRoleSubmenuItems(member, 'demote'),
          });
        }
      }

      if (canManage && voiceChannel && hasPerm(PERMISSIONS.DISCONNECT_MEMBERS)) {
        items.push({
          label: 'Desconectar da call',
          icon: <PhoneOff className="w-4 h-4" />,
          onClick: () => void disconnectMemberFromCall(activeServerId, member.userId, voiceChannel),
        });
      }
      if (canManage && voiceChannel && hasPerm(PERMISSIONS.MOVE_MEMBERS)) {
        items.push({
          label: 'Mover de call',
          icon: <MoveRight className="w-4 h-4" />,
          submenu: buildMoveSubmenu(member, voiceChannel),
        });
      }

      if (canManage && (hasPerm(PERMISSIONS.KICK_MEMBERS) || hasPerm(PERMISSIONS.MANAGE_MEMBERS))) {
        items.push({ divider: true });
        items.push({
          label: 'Remover do grupo',
          icon: <LogOut className="w-4 h-4" />,
          danger: true,
          onClick: () => {
            if (window.confirm(`Remover ${member.profile.displayName} do grupo?`)) {
              void kickMember(activeServerId, member.userId);
            }
          },
        });
      }

      return items;
    };

    openMenu({ clientX: x, clientY: y }, buildItems(null));

    if (!fetchVoice) return;
    let voiceChannel: string | null = null;
    try {
      voiceChannel = await getTargetVoiceChannel(member.userId);
    } catch {
      voiceChannel = null;
    }
    if (voiceChannel) {
      voiceByUserRef.current[member.userId] = voiceChannel;
      openMenu({ clientX: x, clientY: y }, buildItems(voiceChannel));
    }
  };

  const MemberItem: React.FC<{ member: ServerMember }> = ({ member }) => {
    const topRole = member.roles[0];
    const displayName = member.nickname || member.profile.displayName;
    return (
      <div
        onClick={() => openModal('profile-view', { ...member.profile, role: (topRole?.name as ServerMember['profile']['role']) || undefined })}
        onContextMenu={(event) => {
          lastMenuPosRef.current = { x: event.clientX, y: event.clientY };
          void openMemberMenu(member, event.clientX, event.clientY, true);
        }}
        className="flex items-center gap-2 px-2 py-1.5 rounded-xl cursor-pointer hover:bg-discordex-surface/60 transition-colors group"
      >
        <div className="relative shrink-0">
          <img
            src={member.profile.avatar}
            alt={displayName}
            className={`w-8 h-8 rounded-full object-cover border ${topRole?.color ? '' : 'border-discordex-border/40'}`}
            style={topRole?.color ? { borderColor: topRole.color } : undefined}
          />
          <div className={`absolute bottom-0 right-0 w-2.5 h-2.5 rounded-full border border-discordex-bg ${statusColor(member.profile.status)}`} />
        </div>

        <div className="min-w-0 flex-1">
          <span className="block text-xs font-semibold text-discordex-text-secondary group-hover:text-discordex-text-primary truncate transition-colors">
            {displayName}
          </span>
          {topRole && (
            <span
              className="block text-[10px] font-medium truncate"
              style={{ color: topRole.color }}
            >
              {topRole.name}
            </span>
          )}
        </div>
      </div>
    );
  };

  return (
    <div className="w-56 bg-discordex-secondary flex flex-col shrink-0 h-full border-l border-discordex-border/40 select-none p-3 overflow-y-auto no-scrollbar">

      {roleGroups.map((group, index) => (
        <div key={group.name ?? `__norole__${index}`} className="mb-5 space-y-1">
          <h4
            className="px-2 text-[10px] font-bold uppercase tracking-wider"
            style={{ color: group.color || 'var(--tw-text-secondary, #A8A8B3)' }}
          >
            {group.name ?? 'Sem cargo'} — {group.members.length}
          </h4>
          <div className="space-y-0.5">
            {group.members.map((member) => (
              <MemberItem key={member.id} member={member} />
            ))}
          </div>
        </div>
      ))}

      {online.length === 0 && offline.length === 0 && (
        <div className="px-2 text-xs text-discordex-text-secondary/50 italic">
          Nenhum membro por aqui.
        </div>
      )}

      {/* Offline Category */}
      {offline.length > 0 && (
        <div className="space-y-1">
          <h4 className="px-2 text-[10px] font-bold text-discordex-text-secondary uppercase tracking-wider">
            Offline — {offline.length}
          </h4>
          <div className="space-y-0.5">
            {offline.map((member) => (
              <MemberItem key={member.id} member={member} />
            ))}
          </div>
        </div>
      )}

      {currentUser && (
        <div className="mt-auto pt-4">
          <div className="px-2 py-1.5 rounded-xl bg-discordex-surface/40 border border-discordex-border/40 flex items-center gap-2">
            <div className="relative shrink-0">
              <img src={currentUser.avatar} alt={currentUser.displayName} className="w-8 h-8 rounded-full object-cover" />
              <div className="absolute bottom-0 right-0 w-2.5 h-2.5 rounded-full border border-discordex-bg bg-discordex-success" />
            </div>
            <div className="min-w-0">
              <span className="block text-xs font-bold text-discordex-text-primary truncate">{currentUser.displayName}</span>
              <span className="block text-[9px] text-discordex-text-secondary truncate">@{currentUser.username}</span>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};