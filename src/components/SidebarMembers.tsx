import React, { useRef } from 'react';
import { useApp } from '../context/AppContext';
import type { ServerMember, ServerRole } from '../context/AppContext';
import { useContextMenu, type ContextMenuItem } from './ContextMenu';
import { PERMISSIONS } from '../lib/permissions';
import { supabase } from '../lib/supabase';
import {
  Shield, UserPlus, UserMinus, ArrowUp, ArrowDown, PhoneOff,
  MoveRight, LogOut, Settings2, UserCircle2, ArrowLeft,
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

  const buildRoleItems = (member: ServerMember, mode: 'add' | 'remove' | 'promote' | 'demote'): ContextMenuItem[] => {
    const myPerms = getMyPermissions(activeServerId!);
    const targetTop = member.roles[0]?.position ?? -1;
    const hasRoleIds = new Set(member.roles.map((role) => role.id));
    const manageable = roles.filter((role) => myPerms.isOwner || role.position < myPerms.topPosition);

    let list: ServerRole[];
    if (mode === 'add') list = manageable.filter((role) => !hasRoleIds.has(role.id));
    else if (mode === 'remove') list = manageable.filter((role) => hasRoleIds.has(role.id));
    else if (mode === 'promote') list = manageable.filter((role) => !hasRoleIds.has(role.id) && role.position > targetTop);
    else list = manageable.filter((role) => hasRoleIds.has(role.id) && role.position > targetTop);

    const items: ContextMenuItem[] = [{
      label: 'Voltar',
      icon: <ArrowLeft className="w-4 h-4" />,
      onClick: () => openMemberMenu(member, lastMenuPosRef.current.x, lastMenuPosRef.current.y, false),
    }];

    if (list.length === 0) {
      items.push({ label: mode === 'promote' ? 'Nenhum cargo superior' : mode === 'demote' ? 'Nenhum cargo acima' : 'Nenhum cargo disponível' });
    } else {
      list.forEach((role) => {
        items.push({
          label: role.name,
          icon: <Shield className="w-4 h-4" style={{ color: role.color }} />,
          onClick: () => {
            if (mode === 'add') void addRoleToMember(activeServerId!, member.userId, role.id);
            else if (mode === 'remove') void removeRoleFromMember(activeServerId!, member.userId, role.id);
            else if (mode === 'promote') void promoteMember(activeServerId!, member.userId, role.id);
            else void demoteMember(activeServerId!, member.userId, role.id);
          },
        });
      });
    }
    return items;
  };

  const openMoveMenu = (member: ServerMember, fromChannelId: string) => {
    const targets = (activeServer?.channels || []).filter((channel) => channel.type === 'voice' && channel.id !== fromChannelId);
    const items: ContextMenuItem[] = [{
      label: 'Voltar',
      icon: <ArrowLeft className="w-4 h-4" />,
      onClick: () => openMemberMenu(member, lastMenuPosRef.current.x, lastMenuPosRef.current.y, false),
    }];
    if (targets.length === 0) {
      items.push({ label: 'Nenhum canal de voz disponível' });
    } else {
      targets.forEach((channel) => {
        items.push({
          label: channel.name,
          icon: <MoveRight className="w-4 h-4" />,
          onClick: () => void moveMemberBetweenChannels(activeServerId!, member.userId, fromChannelId, channel.id),
        });
      });
    }
    openMenu({ clientX: lastMenuPosRef.current.x, clientY: lastMenuPosRef.current.y }, items);
  };

  const openMemberMenu = async (
    member: ServerMember,
    x: number,
    y: number,
    fetchVoice = true
  ) => {
    if (!activeServerId) return;
    const { isOwner, permissions, topPosition } = getMyPermissions(activeServerId);
    const targetTop = member.roles[0]?.position ?? -1;
    const canManage = isOwner || topPosition > targetTop;
    const hasPerm = (bit: number) => isOwner || (permissions & bit) === bit;

    let voiceChannel: string | null = null;
    if (fetchVoice) {
      voiceChannel = await getTargetVoiceChannel(member.userId);
      if (voiceChannel) voiceByUserRef.current[member.userId] = voiceChannel;
    } else {
      voiceChannel = voiceByUserRef.current[member.userId] || null;
    }

    const items: ContextMenuItem[] = [];
    items.push({
      label: 'Ver informações do membro',
      icon: <UserCircle2 className="w-4 h-4" />,
      onClick: () => openModal('profile-view', member.profile),
    });

    const canManageRoles = canManage && hasPerm(PERMISSIONS.MANAGE_ROLES);
    if (canManageRoles) {
      items.push({ divider: true });
      items.push({
        label: 'Gerenciar membro',
        icon: <Settings2 className="w-4 h-4" />,
        onClick: () => openMenu({ clientX: x, clientY: y }, buildRoleItems(member, 'add')),
      });
      items.push({
        label: 'Adicionar cargo',
        icon: <UserPlus className="w-4 h-4" />,
        onClick: () => openMenu({ clientX: x, clientY: y }, buildRoleItems(member, 'add')),
      });
      items.push({
        label: 'Remover cargo',
        icon: <UserMinus className="w-4 h-4" />,
        onClick: () => openMenu({ clientX: x, clientY: y }, buildRoleItems(member, 'remove')),
      });
    }
    if (canManage && (hasPerm(PERMISSIONS.PROMOTE_MEMBERS) || hasPerm(PERMISSIONS.MANAGE_ROLES))) {
      items.push({
        label: 'Promover',
        icon: <ArrowUp className="w-4 h-4" />,
        onClick: () => openMenu({ clientX: x, clientY: y }, buildRoleItems(member, 'promote')),
      });
    }
    if (canManage && (hasPerm(PERMISSIONS.DEMOTE_MEMBERS) || hasPerm(PERMISSIONS.MANAGE_ROLES))) {
      items.push({
        label: 'Rebaixar',
        icon: <ArrowDown className="w-4 h-4" />,
        onClick: () => openMenu({ clientX: x, clientY: y }, buildRoleItems(member, 'demote')),
      });
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
        onClick: () => openMoveMenu(member, voiceChannel),
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

    openMenu({ clientX: x, clientY: y }, items);
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