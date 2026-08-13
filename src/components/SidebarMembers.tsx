import React, { useRef } from 'react';
import { useApp } from '../context/AppContext';
import type { ServerMember } from '../context/AppContext';
import { useContextMenu } from './ContextMenu';
import { buildUserMenu } from '../lib/contextActions';
import { supabase } from '../lib/supabase';
import { Crown } from '@phosphor-icons/react';
import { TransmitMeter } from './SharedUI';

const statusHalo = (status: string) =>
  status === 'online' ? 'bg-signal-success shadow-[0_0_5px_rgba(79,178,134,0.7)]' :
  status === 'idle' ? 'bg-signal-warning shadow-[0_0_5px_rgba(226,133,59,0.7)]' :
  status === 'dnd' ? 'bg-signal-danger shadow-[0_0_5px_rgba(217,96,75,0.7)]' :
  'bg-signal-text-secondary';

export const SidebarMembers: React.FC = () => {
  const app = useApp();
  const {
    serverMembers,
    activeServerId,
    openModal,
    currentUser,
    servers,
    callState,
  } = app;

  const { openMenu } = useContextMenu();
  const lastMenuPosRef = useRef({ x: 0, y: 0 });
  const voiceByUserRef = useRef<Record<string, string>>({});
  const memberRef = useRef<ServerMember | null>(null);
  const appRef = useRef(app);
  appRef.current = app;

  const members = activeServerId ? (serverMembers[activeServerId] || []) : [];
  const activeServer = servers.find((server) => server.id === activeServerId);

  const online = members.filter((m) => m.profile.status !== 'offline');
  const offline = members.filter((m) => m.profile.status === 'offline');

  const speakingUserIds = new Set(
    callState.isActive ? callState.participants.filter(p => p.isSpeaking).map(p => p.id) : []
  );

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

  const openMemberMenu = (
    member: ServerMember,
    x: number,
    y: number,
    fetchVoice = true
  ) => {
    if (!activeServerId) return;
    memberRef.current = member;
    lastMenuPosRef.current = { x, y };

    const reopen = () => {
      if (!memberRef.current || !activeServerId) return;
      const currentApp = appRef.current;
      const fresh = (currentApp.serverMembers[activeServerId] || []).find((m) => m.id === memberRef.current!.id) || memberRef.current;
      openMenu({ clientX: x, clientY: y }, buildUserMenu(currentApp, {
        serverId: activeServerId,
        member: fresh,
        voiceChannel: voiceByUserRef.current[member.userId] ?? null,
        reopen,
      }));
    };

    reopen();

    if (fetchVoice) {
      void getTargetVoiceChannel(member.userId).then((voiceChannel) => {
        if (voiceChannel) {
          voiceByUserRef.current[member.userId] = voiceChannel;
          reopen();
        }
      });
    }
  };

  const MemberItem: React.FC<{ member: ServerMember }> = ({ member }) => {
    const topRole = member.roles[0];
    const displayName = member.nickname || member.profile.displayName;
    const isOwner = activeServer?.ownerId === member.userId;
    const isSpeaking = speakingUserIds.has(member.userId);
    return (
      <div
        onClick={() => openModal('profile-view', { ...member.profile, role: (topRole?.name as ServerMember['profile']['role']) || undefined })}
        onContextMenu={(event) => {
          lastMenuPosRef.current = { x: event.clientX, y: event.clientY };
          openMemberMenu(member, event.clientX, event.clientY, true);
        }}
        className="flex items-center gap-2 px-2 py-1.5 rounded-md cursor-pointer hover:bg-signal-surface/60 transition-colors group"
      >
        <div className="relative shrink-0 flex items-center gap-1">
          <div className="relative">
            <img
              src={member.profile.avatar}
              alt={displayName}
              className={`w-8 h-8 rounded-full object-cover border ${topRole?.color ? '' : 'border-signal-border/40'}`}
              style={topRole?.color ? { borderColor: topRole.color } : undefined}
            />
            {/* Status com halo curto */}
            <div className={`absolute bottom-0 right-0 w-2.5 h-2.5 rounded-full border border-signal-bg ${statusHalo(member.profile.status)}`} />
          </div>
          {isSpeaking && <TransmitMeter bars={3} className="h-2" />}
        </div>

        <div className="min-w-0 flex-1">
          <span className="block text-xs font-semibold text-signal-text-secondary group-hover:text-signal-text-primary truncate transition-colors">
            {displayName}
            {isOwner && <Crown className="w-3 h-3 text-signal-warning inline-block ml-1 -mt-0.5" weight="fill" />}
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
    <div className="w-56 bg-signal-secondary flex flex-col shrink-0 h-full border-l border-signal-border/40 select-none p-3 overflow-y-auto no-scrollbar">

      {/* Sinal ativo — contagem em Plex Mono */}
      <h4 className="px-2 mb-2 text-[10px] font-bold text-signal-text-secondary uppercase tracking-wider font-mono">
        ONLINE — {online.length}
      </h4>

      {roleGroups.map((group, index) => (
        <div key={group.name ?? `__norole__${index}`} className="mb-3 space-y-1">
          <h4
            className="px-2 text-[10px] font-bold uppercase tracking-wider"
            style={{ color: group.color || '#93A69B' }}
          >
            {group.name ?? 'Sem cargo'}
          </h4>
          <div className="space-y-0.5">
            {group.members.map((member) => (
              <MemberItem key={member.id} member={member} />
            ))}
          </div>
        </div>
      ))}

      {online.length === 0 && offline.length === 0 && (
        <div className="px-2 text-xs text-signal-text-secondary/50 italic">
          Nenhum membro por aqui.
        </div>
      )}

      {/* Offline */}
      {offline.length > 0 && (
        <div className="space-y-1">
          <h4 className="px-2 text-[10px] font-bold text-signal-text-secondary uppercase tracking-wider font-mono">
            OFFLINE — {offline.length}
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
          <div className="px-2 py-1.5 rounded-md bg-signal-surface/40 border border-signal-border/40 flex items-center gap-2">
            <div className="relative shrink-0">
              <img src={currentUser.avatar} alt={currentUser.displayName} className="w-8 h-8 rounded-full object-cover" />
              <div className="absolute bottom-0 right-0 w-2.5 h-2.5 rounded-full border border-signal-bg bg-signal-success shadow-[0_0_4px_rgba(79,178,134,0.6)]" />
            </div>
            <div className="min-w-0">
              <span className="block text-xs font-bold text-signal-text-primary truncate">{currentUser.displayName}</span>
              <span className="block text-[9px] text-signal-text-secondary truncate font-mono">@{currentUser.username}</span>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};