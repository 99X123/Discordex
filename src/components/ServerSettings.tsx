import React, { useEffect, useState } from 'react';
import { useApp } from '../context/AppContext';
import type { Server } from '../context/AppContext';
import { supabase } from '../lib/supabase';
import { createServerInvite, getServerInvites } from '../services/servers';
import { getServerBans, unbanMember, type ServerBanWithProfile } from '../services/members';
import { RoleSettings, AuditLogs } from './ServerRoleSettings';
import { PERMISSIONS, hasPermission } from '../lib/permissions';
import type { Database } from '../lib/database.types';
import { Prohibit, Camera, Clock, Hash, Waveform, Trash, PencilSimple, Check, X, X as CloseIcon, Shield, CaretLeft, LinkSimple, Copy, Plus, UserMinus } from '@phosphor-icons/react';

type Tab = 'overview' | 'channels' | 'members' | 'bans' | 'roles' | 'invites' | 'logs';

type Invite = Database['public']['Tables']['invites']['Row'];

const copyToClipboard = async (text: string): Promise<boolean> => {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    try {
      const area = document.createElement('textarea');
      area.value = text;
      area.style.position = 'fixed';
      area.style.opacity = '0';
      document.body.appendChild(area);
      area.select();
      document.execCommand('copy');
      document.body.removeChild(area);
      return true;
    } catch {
      return false;
    }
  }
};

const statusColor = (status: string) =>
  status === 'online' ? 'bg-signal-success' :
  status === 'idle' ? 'bg-signal-warning' :
  status === 'dnd' ? 'bg-signal-danger' :
  'bg-signal-text-secondary';

const inputCls = "w-full px-4 py-3 bg-signal-secondary border border-signal-border rounded-md text-xs text-signal-text-primary focus:outline-none focus:border-brass transition-colors disabled:opacity-50";
const cardCls = "bg-signal-secondary p-4.5 rounded-md border border-signal-border";
const primaryBtn = "px-5 py-2.5 bg-brass hover:bg-brass-hover text-signal-bg rounded-md text-sm font-bold transition-colors";

export const ServerSettings: React.FC<{ server: Server; onClose: () => void; initialTab?: string; initialRoleId?: string | null }> = ({ server, onClose, initialTab, initialRoleId }) => {
  const { updateServerConfig, deleteChannel, refreshServers, serverMembers, currentUser, addToast, getMyPermissions, canManageUser, addCategory, kickMember, banMember, timeoutMember } = useApp();

  const [tab, setTab] = useState<Tab>(() => (initialTab as Tab) || 'overview');
  const [name, setName] = useState(server.name);
  const [description, setDescription] = useState(server.description || '');
  const [iconUploading, setIconUploading] = useState(false);
  const [editingChannel, setEditingChannel] = useState<string | null>(null);
  const [editingName, setEditingName] = useState('');
  const [invites, setInvites] = useState<Invite[]>([]);
  const [invitesLoading, setInvitesLoading] = useState(false);
  const [invitesError, setInvitesError] = useState<string | null>(null);
  const [lastInviteUrl, setLastInviteUrl] = useState<string | null>(null);
  const [copiedInviteId, setCopiedInviteId] = useState<string | null>(null);
  const [newCategoryName, setNewCategoryName] = useState('');
  const [bans, setBans] = useState<ServerBanWithProfile[]>([]);
  const [bansLoading, setBansLoading] = useState(false);

  const isOwner = currentUser?.id === server.ownerId;
  const myPerms = getMyPermissions(server.id);
  const canManageRoles = isOwner || hasPermission(myPerms.permissions, PERMISSIONS.MANAGE_ROLES);
  const canKickMembers = isOwner || hasPermission(myPerms.permissions, PERMISSIONS.KICK_MEMBERS);
  const canBanMembers = isOwner || hasPermission(myPerms.permissions, PERMISSIONS.BAN_MEMBERS);
  const canTimeoutMembers = isOwner || hasPermission(myPerms.permissions, PERMISSIONS.MANAGE_MEMBERS) || hasPermission(myPerms.permissions, PERMISSIONS.KICK_MEMBERS);
  const canViewLogs = isOwner
    || hasPermission(myPerms.permissions, PERMISSIONS.MANAGE_SERVER)
    || hasPermission(myPerms.permissions, PERMISSIONS.VIEW_AUDIT_LOG)
    || canManageRoles;

  useEffect(() => {
    setName(server.name);
    setDescription(server.description || '');
  }, [server]);

  const members = serverMembers[server.id] || [];

  const loadBans = async () => {
    setBansLoading(true);
    const rows = await getServerBans(server.id);
    setBans(rows);
    setBansLoading(false);
  };

  useEffect(() => {
    if (tab === 'bans') void loadBans();
  }, [tab, server.id]);

  const canModerateMember = (member: typeof members[number]) =>
    member.userId !== currentUser?.id
    && member.userId !== server.ownerId
    && canManageUser(server.id, member.roles[0]?.position ?? -1);

  const handleKickMember = async (member: typeof members[number]) => {
    if (!canKickMembers || !canModerateMember(member)) return;
    if (!window.confirm(`Expulsar ${member.profile.displayName} do grupo?`)) return;
    await kickMember(server.id, member.userId);
  };

  const handleBanMember = async (member: typeof members[number]) => {
    if (!canBanMembers || !canModerateMember(member)) return;
    if (!window.confirm(`Banir ${member.profile.displayName} do grupo?`)) return;
    await banMember(server.id, member.userId);
    if (tab === 'bans') await loadBans();
  };

  const handleTimeoutMember = async (member: typeof members[number]) => {
    if (!canTimeoutMembers || !canModerateMember(member)) return;
    const raw = window.prompt(`Castigar ${member.profile.displayName} por quantos minutos?`, '10');
    if (!raw) return;
    const minutes = Number(raw);
    if (!Number.isInteger(minutes) || minutes < 1 || minutes > 40320) {
      addToast('Informe um tempo entre 1 minuto e 28 dias.', 'error');
      return;
    }
    await timeoutMember(server.id, member.userId, minutes);
  };

  const handleUnban = async (ban: ServerBanWithProfile) => {
    if (!canBanMembers) return;
    if (!window.confirm(`Remover banimento de ${ban.profile.display_name}?`)) return;
    const result = await unbanMember(server.id, ban.user_id);
    if (!result.success) {
      addToast(result.error || 'Nao foi possivel remover o banimento.', 'error');
      return;
    }
    addToast('Banimento removido.', 'success');
    await loadBans();
  };

  const handleIconUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file) return;
    if (!['image/jpeg', 'image/png', 'image/webp', 'image/gif'].includes(file.type)) {
      addToast('Formato de imagem invalido.', 'error');
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      addToast('Imagem muito grande (max 5 MB).', 'error');
      return;
    }
    if (!isOwner) return;

    setIconUploading(true);
    const extension = file.name.split('.').pop()?.toLowerCase() || 'png';
    const filePath = `${server.id}/icon-${Date.now()}.${extension}`;

    const { error } = await supabase.storage
      .from('server-icons')
      .upload(filePath, file, { cacheControl: '3600', upsert: true, contentType: file.type });
    setIconUploading(false);

    if (error) {
      addToast(error.message, 'error');
      return;
    }

    const { data } = supabase.storage.from('server-icons').getPublicUrl(filePath);
    await updateServerConfig(server.id, { icon_url: data.publicUrl });
  };

  const handleSaveOverview = (event: React.FormEvent) => {
    event.preventDefault();
    if (!isOwner) return;
    if (!name.trim()) {
      addToast('O nome do servidor nao pode ser vazio.', 'error');
      return;
    }
    updateServerConfig(server.id, { name: name.trim(), description: description.trim() || undefined });
  };

  const handleRenameChannel = async (channelId: string) => {
    const clean = editingName.trim().toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '');
    if (clean) {
      await supabase.from('channels').update({ name: clean }).eq('id', channelId);
      await refreshServers();
    }
    setEditingChannel(null);
    setEditingName('');
  };

  useEffect(() => {
    if (tab !== 'invites') return;
    setInvitesLoading(true);
    setInvitesError(null);
    getServerInvites(server.id).then((data) => {
      setInvites(data);
      setInvitesLoading(false);
    });
  }, [tab, server.id]);

  const handleCreateInvite = async () => {
    setInvitesError(null);
    const result = await createServerInvite(server.id);
    if (!result.success || !result.code) {
      setInvitesError(result.error || 'Nao foi possivel criar o convite.');
      return;
    }
    const inviteUrl = result.inviteUrl || `${window.location.origin}?invite=${result.code}`;
    setLastInviteUrl(inviteUrl);
    await copyToClipboard(inviteUrl);
    addToast('Convite criado e link copiado!', 'success');
    const data = await getServerInvites(server.id);
    setInvites(data);
  };

  const handleCopyInvite = async (invite: Invite) => {
    const url = `${window.location.origin}?invite=${invite.code}`;
    const ok = await copyToClipboard(url);
    setCopiedInviteId(ok ? invite.id : null);
    addToast(ok ? 'Link do convite copiado.' : 'Nao foi possivel copiar.', ok ? 'success' : 'error');
    window.setTimeout(() => setCopiedInviteId(null), 2000);
  };

  const channelsByCategory = (categoryId: string | null) =>
    server.channels.filter((channel) => (channel.parentId || null) === categoryId);

  const renderChannelRow = (channel: { id: string; name: string; type: 'text' | 'voice' }) => {
    const isVoice = channel.type === 'voice';
    return (
      <div key={channel.id} className="flex items-center gap-2.5 px-3 py-2.5 bg-signal-secondary border border-signal-border rounded-md group">
        {isVoice
          ? <Waveform className="w-4 h-4 text-signal-text-secondary shrink-0" />
          : <Hash className="w-4 h-4 text-signal-text-secondary shrink-0" />}
        {editingChannel === channel.id ? (
          <div className="flex-1 flex items-center gap-2">
            <input
              autoFocus
              value={editingName}
              onChange={(event) => setEditingName(event.target.value)}
              onKeyDown={(event) => { if (event.key === 'Enter') handleRenameChannel(channel.id); if (event.key === 'Escape') setEditingChannel(null); }}
              className="flex-1 px-3 py-1.5 bg-signal-bg border border-signal-border rounded-md text-xs text-signal-text-primary focus:outline-none focus:border-brass"
            />
            <button onClick={() => handleRenameChannel(channel.id)} className="p-1.5 text-signal-success hover:bg-signal-success/10 rounded-md transition-colors">
              <Check className="w-4 h-4" />
            </button>
            <button onClick={() => setEditingChannel(null)} className="p-1.5 text-signal-text-secondary hover:bg-signal-surface rounded-md transition-colors">
              <X className="w-4 h-4" />
            </button>
          </div>
        ) : (
          <span className="flex-1 text-xs font-semibold text-signal-text-primary truncate">{channel.name}</span>
        )}
        {isOwner && editingChannel !== channel.id && (
          <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
            <button
              onClick={() => { setEditingChannel(channel.id); setEditingName(channel.name); }}
              className="p-1.5 text-signal-text-secondary hover:text-signal-text-primary hover:bg-signal-surface rounded-md transition-colors"
            >
              <PencilSimple className="w-3.5 h-3.5" />
            </button>
            <button
              onClick={() => { if (window.confirm(`Remover o canal #${channel.name}?`)) deleteChannel(server.id, channel.id); }}
              className="p-1.5 text-signal-danger hover:bg-signal-danger/10 rounded-md transition-colors"
            >
              <Trash className="w-3.5 h-3.5" />
            </button>
          </div>
        )}
      </div>
    );
  };

  const navBtn = (active: boolean) =>
    `w-full text-left px-2.5 py-1.5 rounded-md text-xs font-semibold transition-colors ${active ? 'bg-signal-surface text-signal-text-primary' : 'text-signal-text-secondary hover:bg-signal-surface/40 hover:text-signal-text-primary'}`;

  return (
    <div className="fixed inset-0 z-50 bg-signal-bg flex animate-fade-in">
      <aside className="w-60 bg-signal-secondary flex flex-col border-r border-signal-border py-12 px-6 shrink-0 justify-between">
        <div className="w-48 space-y-6">
          <button
            onClick={onClose}
            className="inline-flex items-center gap-2 text-xs font-semibold text-signal-text-secondary hover:text-signal-text-primary transition-colors"
          >
            <CaretLeft className="w-4 h-4" />
            Voltar
          </button>

          <div className="flex items-center gap-3 px-1">
            <div className="w-10 h-10 rounded-md bg-signal-surface flex items-center justify-center overflow-hidden shrink-0 border border-signal-border">
              {server.iconUrl ? (
                <img src={server.iconUrl} alt={server.name} className="w-full h-full object-cover" />
              ) : (
                <span className="text-[11px] font-black text-signal-text-primary">{server.icon}</span>
              )}
            </div>
            <span className="text-sm font-display font-bold text-signal-text-primary truncate">{server.name}</span>
          </div>

          <div className="space-y-1">
            <button
              onClick={() => setTab('overview')}
              className={navBtn(tab === 'overview')}
            >
              Visao geral
            </button>
            <button
              onClick={() => setTab('channels')}
              className={navBtn(tab === 'channels')}
            >
              Canais
            </button>
            <button
              onClick={() => setTab('members')}
              className={navBtn(tab === 'members')}
            >
              Membros
            </button>
            {canBanMembers && (
              <button
                onClick={() => setTab('bans')}
                className={navBtn(tab === 'bans')}
              >
                Banimentos
              </button>
            )}
            {canManageRoles && (
              <button
                onClick={() => setTab('roles')}
                className={navBtn(tab === 'roles')}
              >
                Cargos
              </button>
            )}
            <button
              onClick={() => setTab('invites')}
              className={navBtn(tab === 'invites')}
            >
              Convites
            </button>
            {canViewLogs && (
              <button
                onClick={() => setTab('logs')}
                className={navBtn(tab === 'logs')}
              >
                Logs
              </button>
            )}
          </div>
        </div>
      </aside>

      <main className="flex-1 bg-signal-bg overflow-y-auto py-12 px-10 relative panel-cut-tl">
        <button
          onClick={onClose}
          className="absolute right-12 top-12 w-9 h-9 rounded-full border border-signal-border hover:border-brass flex items-center justify-center text-signal-text-secondary hover:text-signal-text-primary transition-all"
        >
          <CloseIcon className="w-5 h-5" />
        </button>

        {tab === 'overview' && (
          <form onSubmit={handleSaveOverview} className="max-w-xl space-y-6">
            <div>
              <h2 className="text-xl font-display font-bold text-signal-text-primary">Visao geral</h2>
              <p className="text-xs text-signal-text-secondary mt-1">
                {isOwner ? 'Configuracoes basicas do servidor.' : 'Somente o dono do servidor pode editar.'}
              </p>
            </div>

            <div className={`${cardCls} flex items-center gap-4`}>
              <div className="w-20 h-20 rounded-md bg-signal-bg flex items-center justify-center overflow-hidden border border-signal-border shrink-0">
                {server.iconUrl ? (
                  <img
                    src={server.iconUrl}
                    alt={server.name}
                    className="w-full h-full object-cover"
                    onError={(event) => { event.currentTarget.style.display = 'none'; }}
                  />
                ) : (
                  <span className="text-xl font-black text-signal-text-primary">{server.icon}</span>
                )}
              </div>
              {isOwner ? (
                <div className="space-y-2 flex-1 min-w-0">
                  <span className="text-xs font-bold text-signal-text-secondary uppercase tracking-wider inline-flex items-center gap-2">
                    <Camera className="w-3.5 h-3.5" />
                    Icone do servidor
                  </span>
                  <label className="inline-flex items-center justify-center px-4 py-3 bg-signal-bg hover:bg-signal-surface border border-signal-border rounded-md text-xs font-semibold text-signal-text-primary cursor-pointer transition-colors">
                    {iconUploading ? 'Enviando...' : 'Escolher imagem'}
                    <input type="file" accept="image/png,image/jpeg,image/webp,image/gif" onChange={handleIconUpload} disabled={iconUploading} className="sr-only" />
                  </label>
                  <p className="text-[10px] text-signal-text-secondary">PNG, JPG, WEBP ou GIF ate 5 MB.</p>
                </div>
              ) : (
                <div className="flex-1 min-w-0">
                  <span className="block text-xs font-bold text-signal-text-secondary uppercase tracking-wider">Icone do servidor</span>
                </div>
              )}
            </div>

            <label className="block space-y-2">
              <span className="block text-xs font-bold text-signal-text-secondary uppercase tracking-wider">Nome do servidor</span>
              <input
                type="text"
                value={name}
                onChange={(event) => setName(event.target.value)}
                disabled={!isOwner}
                className={inputCls}
                required
              />
            </label>

            <label className="block space-y-2">
              <span className="block text-xs font-bold text-signal-text-secondary uppercase tracking-wider">Descricao</span>
              <textarea
                value={description}
                onChange={(event) => setDescription(event.target.value)}
                disabled={!isOwner}
                rows={4}
                className={`${inputCls} resize-none leading-relaxed`}
              />
            </label>

            {isOwner && (
              <button
                type="submit"
                className={primaryBtn}
              >
                Salvar alteracoes
              </button>
            )}
          </form>
        )}

        {tab === 'channels' && (
          <div className="max-w-2xl space-y-6">
            <div>
              <h2 className="text-xl font-display font-bold text-signal-text-primary">Canais</h2>
              <p className="text-xs text-signal-text-secondary mt-1">
                Organize os canais em categorias, renomeie ou remova.
              </p>
            </div>

            {isOwner && (
              <form
                onSubmit={(event) => {
                  event.preventDefault();
                  if (newCategoryName.trim()) {
                    addCategory(server.id, newCategoryName.trim());
                    setNewCategoryName('');
                  }
                }}
                className="flex items-center gap-2"
              >
                <input
                  type="text"
                  value={newCategoryName}
                  onChange={(event) => setNewCategoryName(event.target.value)}
                  placeholder="Nome da nova categoria"
                  className="flex-1 px-4 py-2.5 bg-signal-secondary border border-signal-border rounded-md text-xs text-signal-text-primary placeholder:text-signal-text-secondary/40 focus:outline-none focus:border-brass transition-colors"
                />
                <button
                  type="submit"
                  className="shrink-0 px-4 py-2.5 bg-signal-surface hover:bg-signal-hover border border-signal-border rounded-md text-xs font-semibold text-signal-text-primary transition-colors"
                >
                  Criar categoria
                </button>
              </form>
            )}

            {server.categories.map((category) => {
              const catChannels = channelsByCategory(category.id);
              return (
                <div key={category.id}>
                  <div className="flex items-center justify-between mb-2">
                    <h3 className="text-[10px] font-bold text-signal-text-secondary uppercase tracking-wider">
                      {category.name}
                    </h3>
                    {isOwner && (
                      <button
                        onClick={() => { if (window.confirm(`Remover a categoria "${category.name}"? Os canais dela serao movidos para "Sem categoria".`)) deleteChannel(server.id, category.id); }}
                        className="p-1 text-signal-danger/70 hover:text-signal-danger transition-colors"
                        title="Excluir categoria"
                      >
                        <Trash className="w-3.5 h-3.5" />
                      </button>
                    )}
                  </div>
                  <div className="space-y-1.5">
                    {catChannels.map(renderChannelRow)}
                    {catChannels.length === 0 && (
                      <span className="block px-2 text-[10px] text-signal-text-secondary/40 italic">Nenhum canal</span>
                    )}
                  </div>
                </div>
              );
            })}

            {channelsByCategory(null).length > 0 && (
              <div key="__uncategorized__">
                <h3 className="text-[10px] font-bold text-signal-text-secondary uppercase tracking-wider mb-2">
                  Sem categoria
                </h3>
                <div className="space-y-1.5">
                  {channelsByCategory(null).map(renderChannelRow)}
                </div>
              </div>
            )}
          </div>
        )}

        {tab === 'members' && (
          <div className="max-w-2xl space-y-4">
            <div>
              <h2 className="text-xl font-display font-bold text-signal-text-primary">Membros</h2>
              <p className="text-xs text-signal-text-secondary mt-1">
                {members.length} membro(s) neste servidor.
              </p>
            </div>

            <div className="space-y-1.5">
              {members.map((member) => {
                const topRole = member.roles[0];
                return (
                  <div key={member.id} className="flex items-center gap-3 px-3 py-2.5 bg-signal-secondary border border-signal-border rounded-md">
                    <div className="relative shrink-0">
                      <img src={member.profile.avatar} alt={member.profile.displayName} className="w-9 h-9 rounded-full object-cover" />
                      <div className={`absolute bottom-0 right-0 w-2.5 h-2.5 rounded-full border border-signal-bg ${statusColor(member.profile.status)}`} />
                    </div>
                    <div className="min-w-0 flex-1">
                      <span className="block text-xs font-bold text-signal-text-primary truncate">
                        {member.nickname || member.profile.displayName}
                      </span>
                      <span className="block text-[10px] text-signal-text-secondary truncate font-mono">@{member.profile.username}</span>
                    </div>
                    {topRole ? (
                      <span
                        className="inline-flex items-center gap-1 text-[10px] font-bold px-2 py-1 rounded-md shrink-0"
                        style={{ color: topRole.color, backgroundColor: `${topRole.color}1A` }}
                      >
                        <Shield className="w-3 h-3" />
                        {topRole.name}
                      </span>
                    ) : (
                      <span className="text-[10px] font-bold text-signal-text-secondary px-2 py-1 bg-signal-surface rounded-md shrink-0">
                        Sem cargo
                      </span>
                    )}
                    {member.timeoutUntil && new Date(member.timeoutUntil) > new Date() && (
                      <span className="text-[10px] font-bold text-signal-warning px-2 py-1 bg-signal-warning/10 rounded-md shrink-0">
                        Castigado
                      </span>
                    )}
                    {canModerateMember(member) && (canKickMembers || canBanMembers || canTimeoutMembers) && (
                      <div className="flex items-center gap-1 shrink-0">
                        {canTimeoutMembers && (
                          <button
                            onClick={() => handleTimeoutMember(member)}
                            className="p-1.5 rounded-md text-signal-warning hover:bg-signal-warning/10 transition-colors"
                            title="Castigar com timeout"
                          >
                            <Clock className="w-3.5 h-3.5" />
                          </button>
                        )}
                        {canKickMembers && (
                          <button
                            onClick={() => handleKickMember(member)}
                            className="p-1.5 rounded-md text-signal-text-secondary hover:text-signal-text-primary hover:bg-signal-surface transition-colors"
                            title="Expulsar"
                          >
                            <UserMinus className="w-3.5 h-3.5" />
                          </button>
                        )}
                        {canBanMembers && (
                          <button
                            onClick={() => handleBanMember(member)}
                            className="p-1.5 rounded-md text-signal-danger hover:bg-signal-danger/10 transition-colors"
                            title="Banir"
                          >
                            <Prohibit className="w-3.5 h-3.5" />
                          </button>
                        )}
                      </div>
                    )}
                  </div>
                );
              })}
              {members.length === 0 && (
                <p className="text-xs text-signal-text-secondary/50 italic">Nenhum membro encontrado.</p>
              )}
            </div>
          </div>
        )}

        {tab === 'bans' && canBanMembers && (
          <div className="max-w-2xl space-y-4">
            <div>
              <h2 className="text-xl font-display font-bold text-signal-text-primary">Banimentos</h2>
              <p className="text-xs text-signal-text-secondary mt-1">
                Pessoas impedidas de entrar neste grupo.
              </p>
            </div>

            {bansLoading ? (
              <p className="text-xs text-signal-text-secondary/50 italic">Carregando banimentos...</p>
            ) : bans.length === 0 ? (
              <p className="text-xs text-signal-text-secondary/50 italic">Nenhum usuario banido.</p>
            ) : (
              <div className="space-y-1.5">
                {bans.map((ban) => (
                  <div key={ban.id} className="flex items-center gap-3 px-3 py-2.5 bg-signal-secondary border border-signal-border rounded-md">
                    <img
                      src={ban.profile.avatar_url || `https://ui-avatars.com/api/?background=ED4245&color=fff&bold=true&name=${encodeURIComponent(ban.profile.display_name || ban.profile.username)}`}
                      alt={ban.profile.display_name}
                      className="w-9 h-9 rounded-full object-cover"
                    />
                    <div className="min-w-0 flex-1">
                      <span className="block text-xs font-bold text-signal-text-primary truncate">{ban.profile.display_name}</span>
                      <span className="block text-[10px] text-signal-text-secondary truncate font-mono">
                        @{ban.profile.username} â€¢ {new Date(ban.created_at).toLocaleDateString('pt-BR')}
                      </span>
                      {ban.reason && (
                        <span className="block text-[10px] text-signal-text-secondary/70 truncate">Motivo: {ban.reason}</span>
                      )}
                    </div>
                    <button
                      onClick={() => handleUnban(ban)}
                      className="px-3 py-2 rounded-md text-xs font-semibold text-signal-text-primary bg-signal-surface hover:bg-signal-hover border border-signal-border transition-colors"
                    >
                      Desbanir
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {tab === 'roles' && canManageRoles && (
          <RoleSettings server={server} initialRoleId={initialRoleId} />
        )}

        {tab === 'logs' && canViewLogs && (
          <AuditLogs server={server} />
        )}

        {tab === 'invites' && (
          <div className="max-w-2xl space-y-6">
            <div>
              <h2 className="text-xl font-display font-bold text-signal-text-primary">Convites</h2>
              <p className="text-xs text-signal-text-secondary mt-1">
                Crie um link de convite para convidar pessoas para este servidor.
              </p>
            </div>

            <button
              onClick={handleCreateInvite}
              className="inline-flex items-center gap-2 px-5 py-3 bg-brass hover:bg-brass-hover text-signal-bg rounded-md text-sm font-bold transition-colors"
            >
              <Plus className="w-4 h-4" />
              Criar convite e copiar link
            </button>

            {invitesError && (
              <div className="text-xs rounded-md border border-signal-danger/30 bg-signal-danger/10 text-signal-danger px-3 py-2">
                {invitesError}
              </div>
            )}

            {lastInviteUrl && (
              <div className="flex items-center gap-2.5 px-3 py-2.5 bg-signal-secondary border border-signal-border rounded-md">
                <LinkSimple className="w-4 h-4 text-signal-text-secondary shrink-0" />
                <span className="flex-1 text-xs text-signal-text-primary font-mono truncate">{lastInviteUrl}</span>
                <button
                  onClick={async () => { const ok = await copyToClipboard(lastInviteUrl); addToast(ok ? 'Link copiado.' : 'Falha ao copiar.', ok ? 'success' : 'error'); }}
                  className="p-1.5 text-signal-text-secondary hover:text-signal-text-primary hover:bg-signal-surface rounded-md transition-colors"
                  title="Copiar link"
                >
                  <Copy className="w-4 h-4" />
                </button>
              </div>
            )}

            <div>
              <h3 className="text-[10px] font-bold text-signal-text-secondary uppercase tracking-wider mb-2">
                Convites ativos ({invites.length})
              </h3>

              {invitesLoading ? (
                <p className="text-xs text-signal-text-secondary/50 italic">Carregando...</p>
              ) : invites.length === 0 ? (
                <p className="text-xs text-signal-text-secondary/50 italic">Nenhum convite criado ainda.</p>
              ) : (
                <div className="space-y-1.5">
                  {invites.map((invite) => (
                    <div key={invite.id} className="flex items-center gap-2.5 px-3 py-2.5 bg-signal-secondary border border-signal-border rounded-md">
                      <LinkSimple className="w-4 h-4 text-signal-text-secondary shrink-0" />
                      <div className="flex-1 min-w-0">
                        <span className="block text-xs font-mono text-signal-text-primary truncate">
                          {window.location.origin}?invite={invite.code}
                        </span>
                        <span className="block text-[10px] text-signal-text-secondary font-mono">
                          {invite.uses} uso(s)
                          {invite.max_uses ? ` / ${invite.max_uses}` : ''} • {new Date(invite.created_at).toLocaleDateString('pt-BR')}
                        </span>
                      </div>
                      <button
                        onClick={() => handleCopyInvite(invite)}
                        className="p-2 text-signal-text-secondary hover:text-signal-text-primary hover:bg-signal-surface rounded-md transition-colors"
                        title="Copiar link"
                      >
                        {copiedInviteId === invite.id
                          ? <Check className="w-4 h-4 text-signal-success" />
                          : <Copy className="w-4 h-4" />}
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}
      </main>
    </div>
  );
};