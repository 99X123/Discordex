import React from 'react';
import { useApp } from '../context/AppContext';
import type { ServerMember } from '../context/AppContext';

const statusColor = (status: string) =>
  status === 'online' ? 'bg-discordex-success' :
  status === 'idle' ? 'bg-discordex-warning' :
  status === 'dnd' ? 'bg-discordex-danger' :
  'bg-discordex-text-secondary';

export const SidebarMembers: React.FC = () => {
  const { serverMembers, activeServerId, openModal, currentUser } = useApp();

  const members = activeServerId ? (serverMembers[activeServerId] || []) : [];

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

  const MemberItem: React.FC<{ member: ServerMember }> = ({ member }) => {
    const topRole = member.roles[0];
    const displayName = member.nickname || member.profile.displayName;
    return (
      <div
        onClick={() => openModal('profile-view', { ...member.profile, role: (topRole?.name as ServerMember['profile']['role']) || undefined })}
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
