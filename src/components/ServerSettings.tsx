import React, { useEffect, useState } from 'react';
import { useApp } from '../context/AppContext';
import type { Server } from '../context/AppContext';
import { supabase } from '../lib/supabase';
import { createServerInvite, getServerInvites } from '../services/servers';
import { RoleSettings, AuditLogs } from './ServerRoleSettings';
import { PERMISSIONS, hasPermission } from '../lib/permissions';
import type { Database } from '../lib/database.types';
import { Camera, Hash, Volume2, Trash2, Pencil, Check, X, X as CloseIcon, Shield, ChevronLeft, Link2, Copy, Plus } from 'lucide-react';

type Tab = 'overview' | 'channels' | 'members' | 'roles' | 'invites' | 'logs';

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
  status === 'online' ? 'bg-discordex-success' :
  status === 'idle' ? 'bg-discordex-warning' :
  status === 'dnd' ? 'bg-discordex-danger' :
  'bg-discordex-text-secondary';

export const ServerSettings: React.FC<{ server: Server; onClose: () => void }> = ({ server, onClose }) => {
  const { updateServerConfig, deleteChannel, refreshServers, serverMembers, currentUser, addToast, getMyPermissions } = useApp();

  const [tab, setTab] = useState<Tab>('overview');
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

  const isOwner = currentUser?.id === server.ownerId;
  const myPerms = getMyPermissions(server.id);
  const canManageRoles = isOwner || hasPermission(myPerms.permissions, PERMISSIONS.MANAGE_ROLES);
  const canViewLogs = isOwner
    || hasPermission(myPerms.permissions, PERMISSIONS.MANAGE_SERVER)
    || hasPermission(myPerms.permissions, PERMISSIONS.VIEW_AUDIT_LOG)
    || canManageRoles;

  useEffect(() => {
    setName(server.name);
    setDescription(server.description || '');
  }, [server]);

  const members = serverMembers[server.id] || [];

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

  const categories = ['INFORMAÇÕES', 'CONVERSA', 'VOZ'] as const;
  const channelsByCategory = (category: typeof categories[number]) =>
    server.channels.filter((channel) => channel.category === category);

  return (
    <div className="fixed inset-0 z-50 bg-discordex-bg flex animate-fade-in">
      <aside className="w-60 bg-discordex-secondary flex flex-col border-r border-discordex-border py-12 px-6 shrink-0 justify-between">
        <div className="w-48 space-y-6">
          <button
            onClick={onClose}
            className="inline-flex items-center gap-2 text-xs font-semibold text-discordex-text-secondary hover:text-discordex-text-primary transition-colors"
          >
            <ChevronLeft className="w-4 h-4" />
            Voltar
          </button>

          <div className="flex items-center gap-3 px-1">
            <div className="w-10 h-10 rounded-2xl bg-discordex-surface flex items-center justify-center overflow-hidden shrink-0 border border-discordex-border">
              {server.iconUrl ? (
                <img src={server.iconUrl} alt={server.name} className="w-full h-full object-cover" />
              ) : (
                <span className="text-[11px] font-black text-discordex-text-primary">{server.icon}</span>
              )}
            </div>
            <span className="text-sm font-bold text-discordex-text-primary truncate">{server.name}</span>
          </div>

          <div className="space-y-1">
            <button
              onClick={() => setTab('overview')}
              className={`w-full text-left px-2.5 py-1.5 rounded-lg text-xs font-semibold transition-colors ${tab === 'overview' ? 'bg-discordex-surface text-discordex-text-primary' : 'text-discordex-text-secondary hover:bg-discordex-surface/40 hover:text-discordex-text-primary'}`}
            >
              Visao geral
            </button>
            <button
              onClick={() => setTab('channels')}
              className={`w-full text-left px-2.5 py-1.5 rounded-lg text-xs font-semibold transition-colors ${tab === 'channels' ? 'bg-discordex-surface text-discordex-text-primary' : 'text-discordex-text-secondary hover:bg-discordex-surface/40 hover:text-discordex-text-primary'}`}
            >
              Canais
            </button>
            <button
              onClick={() => setTab('members')}
              className={`w-full text-left px-2.5 py-1.5 rounded-lg text-xs font-semibold transition-colors ${tab === 'members' ? 'bg-discordex-surface text-discordex-text-primary' : 'text-discordex-text-secondary hover:bg-discordex-surface/40 hover:text-discordex-text-primary'}`}
            >
              Membros
            </button>
            {canManageRoles && (
              <button
                onClick={() => setTab('roles')}
                className={`w-full text-left px-2.5 py-1.5 rounded-lg text-xs font-semibold transition-colors ${tab === 'roles' ? 'bg-discordex-surface text-discordex-text-primary' : 'text-discordex-text-secondary hover:bg-discordex-surface/40 hover:text-discordex-text-primary'}`}
              >
                Cargos
              </button>
            )}
            <button
              onClick={() => setTab('invites')}
              className={`w-full text-left px-2.5 py-1.5 rounded-lg text-xs font-semibold transition-colors ${tab === 'invites' ? 'bg-discordex-surface text-discordex-text-primary' : 'text-discordex-text-secondary hover:bg-discordex-surface/40 hover:text-discordex-text-primary'}`}
            >
              Convites
            </button>
            {canViewLogs && (
              <button
                onClick={() => setTab('logs')}
                className={`w-full text-left px-2.5 py-1.5 rounded-lg text-xs font-semibold transition-colors ${tab === 'logs' ? 'bg-discordex-surface text-discordex-text-primary' : 'text-discordex-text-secondary hover:bg-discordex-surface/40 hover:text-discordex-text-primary'}`}
              >
                Logs
              </button>
            )}
          </div>
        </div>
      </aside>

      <main className="flex-1 bg-discordex-bg overflow-y-auto py-12 px-10 relative">
        <button
          onClick={onClose}
          className="absolute right-12 top-12 w-9 h-9 rounded-full border border-discordex-border hover:border-discordex-text-primary flex items-center justify-center text-discordex-text-secondary hover:text-discordex-text-primary transition-all"
        >
          <CloseIcon className="w-5 h-5" />
        </button>

        {tab === 'overview' && (
          <form onSubmit={handleSaveOverview} className="max-w-xl space-y-6">
            <div>
              <h2 className="text-xl font-bold text-discordex-text-primary">Visao geral</h2>
              <p className="text-xs text-discordex-text-secondary mt-1">
                {isOwner ? 'Configuracoes basicas do servidor.' : 'Somente o dono do servidor pode editar.'}
              </p>
            </div>

            <div className="bg-discordex-secondary p-4.5 rounded-2xl border border-discordex-border flex items-center gap-4">
              <div className="w-20 h-20 rounded-2xl bg-discordex-bg flex items-center justify-center overflow-hidden border border-discordex-border shrink-0">
                {server.iconUrl ? (
                  <img
                    src={server.iconUrl}
                    alt={server.name}
                    className="w-full h-full object-cover"
                    onError={(event) => { event.currentTarget.style.display = 'none'; }}
                  />
                ) : (
                  <span className="text-xl font-black text-discordex-text-primary">{server.icon}</span>
                )}
              </div>
              {isOwner ? (
                <div className="space-y-2 flex-1 min-w-0">
                  <span className="text-xs font-bold text-discordex-text-secondary uppercase tracking-wider inline-flex items-center gap-2">
                    <Camera className="w-3.5 h-3.5" />
                    Icone do servidor
                  </span>
                  <label className="inline-flex items-center justify-center px-4 py-3 bg-discordex-bg hover:bg-discordex-surface border border-discordex-border rounded-xl text-xs font-semibold text-discordex-text-primary cursor-pointer transition-colors">
                    {iconUploading ? 'Enviando...' : 'Escolher imagem'}
                    <input type="file" accept="image/png,image/jpeg,image/webp,image/gif" onChange={handleIconUpload} disabled={iconUploading} className="sr-only" />
                  </label>
                  <p className="text-[10px] text-discordex-text-secondary">PNG, JPG, WEBP ou GIF ate 5 MB.</p>
                </div>
              ) : (
                <div className="flex-1 min-w-0">
                  <span className="block text-xs font-bold text-discordex-text-secondary uppercase tracking-wider">Icone do servidor</span>
                </div>
              )}
            </div>

            <label className="block space-y-2">
              <span className="block text-xs font-bold text-discordex-text-secondary uppercase tracking-wider">Nome do servidor</span>
              <input
                type="text"
                value={name}
                onChange={(event) => setName(event.target.value)}
                disabled={!isOwner}
                className="w-full px-4 py-3 bg-discordex-secondary border border-discordex-border rounded-xl text-xs text-discordex-text-primary focus:outline-none focus:border-primary transition-colors disabled:opacity-50"
                required
              />
            </label>

            <label className="block space-y-2">
              <span className="block text-xs font-bold text-discordex-text-secondary uppercase tracking-wider">Descricao</span>
              <textarea
                value={description}
                onChange={(event) => setDescription(event.target.value)}
                disabled={!isOwner}
                rows={4}
                className="w-full px-4 py-3 bg-discordex-secondary border border-discordex-border rounded-xl text-xs text-discordex-text-primary focus:outline-none focus:border-primary transition-colors resize-none leading-relaxed disabled:opacity-50"
              />
            </label>

            {isOwner && (
              <button
                type="submit"
                className="px-5 py-2.5 bg-primary hover:bg-primary-hover text-white rounded-xl text-sm font-semibold transition-colors"
              >
                Salvar alteracoes
              </button>
            )}
          </form>
        )}

        {tab === 'channels' && (
          <div className="max-w-2xl space-y-6">
            <div>
              <h2 className="text-xl font-bold text-discordex-text-primary">Canais</h2>
              <p className="text-xs text-discordex-text-secondary mt-1">
                Renomeie ou remova os canais do servidor.
              </p>
            </div>

            {categories.map((category) => {
              const catChannels = channelsByCategory(category);
              return (
                <div key={category}>
                  <h3 className="text-[10px] font-bold text-discordex-text-secondary uppercase tracking-wider mb-2">
                    {category}
                  </h3>
                  <div className="space-y-1.5">
                    {catChannels.map((channel) => {
                      const isVoice = channel.type === 'voice';
                      return (
                        <div key={channel.id} className="flex items-center gap-2.5 px-3 py-2.5 bg-discordex-secondary border border-discordex-border rounded-xl group">
                          {isVoice
                            ? <Volume2 className="w-4 h-4 text-discordex-text-secondary shrink-0" />
                            : <Hash className="w-4 h-4 text-discordex-text-secondary shrink-0" />}
                          {editingChannel === channel.id ? (
                            <div className="flex-1 flex items-center gap-2">
                              <input
                                autoFocus
                                value={editingName}
                                onChange={(event) => setEditingName(event.target.value)}
                                onKeyDown={(event) => { if (event.key === 'Enter') handleRenameChannel(channel.id); if (event.key === 'Escape') setEditingChannel(null); }}
                                className="flex-1 px-3 py-1.5 bg-discordex-bg border border-discordex-border rounded-lg text-xs text-discordex-text-primary focus:outline-none focus:border-primary"
                              />
                              <button onClick={() => handleRenameChannel(channel.id)} className="p-1.5 text-discordex-success hover:bg-discordex-success/10 rounded-lg transition-colors">
                                <Check className="w-4 h-4" />
                              </button>
                              <button onClick={() => setEditingChannel(null)} className="p-1.5 text-discordex-text-secondary hover:bg-discordex-surface rounded-lg transition-colors">
                                <X className="w-4 h-4" />
                              </button>
                            </div>
                          ) : (
                            <span className="flex-1 text-xs font-semibold text-discordex-text-primary truncate">{channel.name}</span>
                          )}
                          {isOwner && editingChannel !== channel.id && (
                            <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                              <button
                                onClick={() => { setEditingChannel(channel.id); setEditingName(channel.name); }}
                                className="p-1.5 text-discordex-text-secondary hover:text-discordex-text-primary hover:bg-discordex-surface rounded-lg transition-colors"
                              >
                                <Pencil className="w-3.5 h-3.5" />
                              </button>
                              <button
                                onClick={() => { if (window.confirm(`Remover o canal #${channel.name}?`)) deleteChannel(server.id, channel.id); }}
                                className="p-1.5 text-discordex-danger hover:bg-discordex-danger/10 rounded-lg transition-colors"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            </div>
                          )}
                        </div>
                      );
                    })}
                    {catChannels.length === 0 && (
                      <span className="block px-2 text-[10px] text-discordex-text-secondary/40 italic">Nenhum canal</span>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {tab === 'members' && (
          <div className="max-w-2xl space-y-4">
            <div>
              <h2 className="text-xl font-bold text-discordex-text-primary">Membros</h2>
              <p className="text-xs text-discordex-text-secondary mt-1">
                {members.length} membro(s) neste servidor.
              </p>
            </div>

            <div className="space-y-1.5">
              {members.map((member) => {
                const topRole = member.roles[0];
                return (
                  <div key={member.id} className="flex items-center gap-3 px-3 py-2.5 bg-discordex-secondary border border-discordex-border rounded-xl">
                    <div className="relative shrink-0">
                      <img src={member.profile.avatar} alt={member.profile.displayName} className="w-9 h-9 rounded-full object-cover" />
                      <div className={`absolute bottom-0 right-0 w-2.5 h-2.5 rounded-full border border-discordex-bg ${statusColor(member.profile.status)}`} />
                    </div>
                    <div className="min-w-0 flex-1">
                      <span className="block text-xs font-bold text-discordex-text-primary truncate">
                        {member.nickname || member.profile.displayName}
                      </span>
                      <span className="block text-[10px] text-discordex-text-secondary truncate">@{member.profile.username}</span>
                    </div>
                    {topRole ? (
                      <span
                        className="inline-flex items-center gap-1 text-[10px] font-bold px-2 py-1 rounded-lg shrink-0"
                        style={{ color: topRole.color, backgroundColor: `${topRole.color}1A` }}
                      >
                        <Shield className="w-3 h-3" />
                        {topRole.name}
                      </span>
                    ) : (
                      <span className="text-[10px] font-bold text-discordex-text-secondary px-2 py-1 bg-discordex-surface rounded-lg shrink-0">
                        Sem cargo
                      </span>
                    )}
                  </div>
                );
              })}
              {members.length === 0 && (
                <p className="text-xs text-discordex-text-secondary/50 italic">Nenhum membro encontrado.</p>
              )}
            </div>
          </div>
        )}

        {tab === 'roles' && canManageRoles && (
          <RoleSettings server={server} />
        )}

        {tab === 'logs' && canViewLogs && (
          <AuditLogs server={server} />
        )}

        {tab === 'invites' && (
          <div className="max-w-2xl space-y-6">
            <div>
              <h2 className="text-xl font-bold text-discordex-text-primary">Convites</h2>
              <p className="text-xs text-discordex-text-secondary mt-1">
                Crie um link de convite para convidar pessoas para este servidor.
              </p>
            </div>

            <button
              onClick={handleCreateInvite}
              className="inline-flex items-center gap-2 px-5 py-3 bg-primary hover:bg-primary-hover text-white rounded-xl text-sm font-semibold transition-colors"
            >
              <Plus className="w-4 h-4" />
              Criar convite e copiar link
            </button>

            {invitesError && (
              <div className="text-xs rounded-xl border border-discordex-danger/30 bg-discordex-danger/10 text-discordex-danger px-3 py-2">
                {invitesError}
              </div>
            )}

            {lastInviteUrl && (
              <div className="flex items-center gap-2.5 px-3 py-2.5 bg-discordex-secondary border border-discordex-border rounded-xl">
                <Link2 className="w-4 h-4 text-discordex-text-secondary shrink-0" />
                <span className="flex-1 text-xs text-discordex-text-primary font-mono truncate">{lastInviteUrl}</span>
                <button
                  onClick={async () => { const ok = await copyToClipboard(lastInviteUrl); addToast(ok ? 'Link copiado.' : 'Falha ao copiar.', ok ? 'success' : 'error'); }}
                  className="p-1.5 text-discordex-text-secondary hover:text-discordex-text-primary hover:bg-discordex-surface rounded-lg transition-colors"
                  title="Copiar link"
                >
                  <Copy className="w-4 h-4" />
                </button>
              </div>
            )}

            <div>
              <h3 className="text-[10px] font-bold text-discordex-text-secondary uppercase tracking-wider mb-2">
                Convites ativos ({invites.length})
              </h3>

              {invitesLoading ? (
                <p className="text-xs text-discordex-text-secondary/50 italic">Carregando...</p>
              ) : invites.length === 0 ? (
                <p className="text-xs text-discordex-text-secondary/50 italic">Nenhum convite criado ainda.</p>
              ) : (
                <div className="space-y-1.5">
                  {invites.map((invite) => (
                    <div key={invite.id} className="flex items-center gap-2.5 px-3 py-2.5 bg-discordex-secondary border border-discordex-border rounded-xl">
                      <Link2 className="w-4 h-4 text-discordex-text-secondary shrink-0" />
                      <div className="flex-1 min-w-0">
                        <span className="block text-xs font-mono text-discordex-text-primary truncate">
                          {window.location.origin}?invite={invite.code}
                        </span>
                        <span className="block text-[10px] text-discordex-text-secondary">
                          {invite.uses} uso(s)
                          {invite.max_uses ? ` / ${invite.max_uses}` : ''} • {new Date(invite.created_at).toLocaleDateString('pt-BR')}
                        </span>
                      </div>
                      <button
                        onClick={() => handleCopyInvite(invite)}
                        className="p-2 text-discordex-text-secondary hover:text-discordex-text-primary hover:bg-discordex-surface rounded-lg transition-colors"
                        title="Copiar link"
                      >
                        {copiedInviteId === invite.id
                          ? <Check className="w-4 h-4 text-discordex-success" />
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
