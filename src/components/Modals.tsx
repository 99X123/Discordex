import React, { useEffect, useState } from 'react';
import { useApp } from '../context/AppContext';
import type { Server } from '../context/AppContext';
import { X, Shield, Calendar, MessageSquare, Phone, Hash, Volume2, Lock, LockOpen, Save } from 'lucide-react';

export const Modals: React.FC = () => {
const {
    activeModal,
    closeModal,
    selectedProfileUser,
    addServer,
    joinServer,
    addChannel,
    addCategory,
    activeServerId,
    servers,
    startCall,
    setActiveDmId,
    setActiveServerId,
    modalPayload,
    serverChannelPerms,
    serverRoles,
    setChannelRolePermission,
    removeChannelRolePermission,
    updateChannelRow,
  } = useApp();

  const [serverName, setServerName] = useState('');
  const [inviteCode, setInviteCode] = useState('');
  const [channelName, setChannelName] = useState('');
  const [channelType, setChannelType] = useState<'text' | 'voice'>('text');
  const [channelParentId, setChannelParentId] = useState<string | null>(null);
  const [categoryName, setCategoryName] = useState('');
  const [editChannelId, setEditChannelId] = useState<string | null>(null);
  const [editChannelName, setEditChannelName] = useState('');
  const [editChannelDesc, setEditChannelDesc] = useState('');
  const [editChannelParentId, setEditChannelParentId] = useState<string | null>(null);
  const [editChannelPrivate, setEditChannelPrivate] = useState(false);

  const activeServer = servers.find((server: Server) => server.id === activeServerId);

  useEffect(() => {
    if (activeModal === 'create-channel' && activeServer) {
      const payload = (modalPayload ?? null) as { parentId?: string | null; type?: 'text' | 'voice' } | null;
      setChannelParentId(payload?.parentId !== undefined ? payload.parentId : (activeServer.categories[0]?.id ?? null));
      if (payload?.type) setChannelType(payload.type);
      setChannelName('');
    }
  }, [activeModal, activeServerId, activeServer, modalPayload]);

  useEffect(() => {
    if (activeModal === 'edit-channel' && activeServer) {
      const channelId = (modalPayload ?? null) as string | null;
      const channel = channelId ? activeServer.channels.find((c) => c.id === channelId) : undefined;
      setEditChannelId(channelId);
      setEditChannelName(channel?.name ?? '');
      setEditChannelDesc(channel?.description ?? '');
      setEditChannelParentId(channel?.parentId ?? null);
      setEditChannelPrivate((serverChannelPerms[channelId ?? '']?.length ?? 0) > 0);
    }
  }, [activeModal, activeServerId, activeServer, modalPayload, serverChannelPerms]);

  if (!activeModal) return null;

  const handleCreateServer = (e: React.FormEvent) => {
    e.preventDefault();
    if (serverName.trim()) {
      addServer(serverName.trim());
      setServerName('');
      closeModal();
    }
  };

  const handleJoinServer = (e: React.FormEvent) => {
    e.preventDefault();
    if (inviteCode.trim()) {
      joinServer(inviteCode.trim());
      setInviteCode('');
      closeModal();
    }
  };

  const handleCreateChannel = (e: React.FormEvent) => {
    e.preventDefault();
    if (channelName.trim() && activeServerId) {
      addChannel(activeServerId, channelName.trim(), channelType, channelParentId);
      setChannelName('');
      setChannelParentId(null);
      closeModal();
    }
  };

  const handleCreateCategory = (e: React.FormEvent) => {
    e.preventDefault();
    if (categoryName.trim() && activeServerId) {
      addCategory(activeServerId, categoryName.trim());
      setCategoryName('');
      closeModal();
    }
  };

  const editChannel = activeServer?.channels.find((c) => c.id === editChannelId);
  const editChannelPerms = editChannelId ? serverChannelPerms[editChannelId] || [] : [];
  const rolePermFor = (roleId: string) => editChannelPerms.find((p) => p.role_id === roleId);
  const roleCanView = (roleId: string) => {
    const perm = rolePermFor(roleId);
    return perm ? perm.can_view : editChannelPerms.length === 0;
  };
  const roleCanSend = (roleId: string) => {
    const perm = rolePermFor(roleId);
    return perm ? perm.can_send : editChannelPerms.length === 0;
  };

  const toggleEditRoleView = (roleId: string) => {
    if (!editChannelId) return;
    const current = rolePermFor(roleId);
    const canView = current ? current.can_view : true;
    const canSend = current ? current.can_send : canView;
    void setChannelRolePermission(editChannelId, roleId, !canView, canSend);
  };

  const toggleEditRoleSend = (roleId: string) => {
    if (!editChannelId) return;
    const current = rolePermFor(roleId);
    if (!current) {
      void setChannelRolePermission(editChannelId, roleId, true, false);
      return;
    }
    void setChannelRolePermission(editChannelId, roleId, current.can_view, !current.can_send);
  };

  const toggleEditChannelPrivacy = () => {
    if (!editChannelId) return;
    if (editChannelPrivate) {
      editChannelPerms.forEach((perm) => {
        void removeChannelRolePermission(editChannelId, perm.role_id);
      });
    } else {
      const roles = serverRoles[activeServerId ?? ''] || [];
      roles.forEach((role) => {
        if (!rolePermFor(role.id)) void setChannelRolePermission(editChannelId, role.id, true, true);
      });
    }
    setEditChannelPrivate(!editChannelPrivate);
  };

  const handleSaveEditChannel = (e: React.FormEvent) => {
    e.preventDefault();
    if (!editChannelId) return;
    const name = editChannelName.trim().toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '');
    if (!name) return;
    void updateChannelRow(editChannelId, {
      name,
      description: editChannelDesc.trim() || undefined,
      parent_id: editChannelParentId,
    });
    closeModal();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-fade-in">
      <div 
        className={`w-full ${activeModal === 'edit-channel' ? 'max-w-2xl' : 'max-w-md'} bg-discordex-secondary border border-discordex-border rounded-2xl overflow-hidden shadow-2xl animate-slide-up`}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Create Server Modal */}
        {activeModal === 'create-server' && (
          <form onSubmit={handleCreateServer}>
            <div className="p-6">
              <div className="flex justify-between items-center mb-4">
                <h3 className="text-xl font-bold text-discordex-text-primary">Criar seu servidor</h3>
                <button type="button" onClick={closeModal} className="text-discordex-text-secondary hover:text-discordex-text-primary">
                  <X className="w-5 h-5" />
                </button>
              </div>
              <p className="text-xs text-discordex-text-secondary mb-6">
                Seu servidor é onde você e seus amigos se reúnem. Crie o seu e comece a conversar.
              </p>
              
              <div className="mb-6">
                <label className="block text-xs font-bold text-discordex-text-secondary uppercase tracking-wider mb-2">
                  Nome do servidor
                </label>
                <input 
                  type="text" 
                  value={serverName}
                  onChange={(e) => setServerName(e.target.value)}
                  placeholder="Meu Incrível Servidor" 
                  className="w-full px-4 py-3 bg-discordex-bg border border-discordex-border rounded-xl text-discordex-text-primary placeholder:text-discordex-text-secondary/40 focus:outline-none focus:border-primary transition-colors text-sm"
                  required
                  autoFocus
                />
              </div>
            </div>
            <div className="px-6 py-4 bg-discordex-surface flex justify-end gap-3 border-t border-discordex-border">
              <button 
                type="button" 
                onClick={closeModal} 
                className="px-5 py-2.5 rounded-xl text-sm font-semibold text-discordex-text-primary hover:bg-discordex-hover transition-colors"
              >
                Cancelar
              </button>
              <button 
                type="submit" 
                className="px-5 py-2.5 rounded-xl text-sm font-semibold bg-primary hover:bg-primary-hover text-white transition-colors"
              >
                Criar
              </button>
            </div>
          </form>
        )}

        {/* Join Server Modal */}
        {activeModal === 'join-server' && (
          <form onSubmit={handleJoinServer}>
            <div className="p-6">
              <div className="flex justify-between items-center mb-4">
                <h3 className="text-xl font-bold text-discordex-text-primary">Entrar em um servidor</h3>
                <button type="button" onClick={closeModal} className="text-discordex-text-secondary hover:text-discordex-text-primary">
                  <X className="w-5 h-5" />
                </button>
              </div>
              <p className="text-xs text-discordex-text-secondary mb-6">
                Insira um código de convite ou nome para se juntar a um servidor existente.
              </p>
              
              <div className="mb-6">
                <label className="block text-xs font-bold text-discordex-text-secondary uppercase tracking-wider mb-2">
                  Código do convite
                </label>
                <input 
                  type="text" 
                  value={inviteCode}
                  onChange={(e) => setInviteCode(e.target.value)}
                  placeholder="https://discordex.gg/h7xK9s" 
                  className="w-full px-4 py-3 bg-discordex-bg border border-discordex-border rounded-xl text-discordex-text-primary placeholder:text-discordex-text-secondary/40 focus:outline-none focus:border-primary transition-colors text-sm"
                  required
                  autoFocus
                />
              </div>
            </div>
            <div className="px-6 py-4 bg-discordex-surface flex justify-end gap-3 border-t border-discordex-border">
              <button 
                type="button" 
                onClick={closeModal} 
                className="px-5 py-2.5 rounded-xl text-sm font-semibold text-discordex-text-primary hover:bg-discordex-hover transition-colors"
              >
                Cancelar
              </button>
              <button 
                type="submit" 
                className="px-5 py-2.5 rounded-xl text-sm font-semibold bg-primary hover:bg-primary-hover text-white transition-colors"
              >
                Entrar
              </button>
            </div>
          </form>
        )}

        {/* Create Channel Modal */}
        {activeModal === 'create-channel' && (
          <form onSubmit={handleCreateChannel}>
            <div className="p-6">
              <div className="flex justify-between items-center mb-4">
                <h3 className="text-xl font-bold text-discordex-text-primary">Criar canal</h3>
                <button type="button" onClick={closeModal} className="text-discordex-text-secondary hover:text-discordex-text-primary">
                  <X className="w-5 h-5" />
                </button>
              </div>

              <div className="mb-5">
                <label className="block text-xs font-bold text-discordex-text-secondary uppercase tracking-wider mb-2">
                  Tipo de canal
                </label>
                <div className="grid grid-cols-2 gap-3">
                  <button 
                    type="button"
                    onClick={() => setChannelType('text')}
                    className={`p-3 rounded-xl border flex flex-col items-center gap-1.5 transition-colors ${channelType === 'text' ? 'border-primary bg-primary/10' : 'border-discordex-border bg-discordex-bg hover:bg-discordex-surface'}`}
                  >
                    <span className="text-lg">#</span>
                    <span className="text-xs font-semibold text-discordex-text-primary">Texto</span>
                  </button>
                  <button 
                    type="button"
                    onClick={() => setChannelType('voice')}
                    className={`p-3 rounded-xl border flex flex-col items-center gap-1.5 transition-colors ${channelType === 'voice' ? 'border-primary bg-primary/10' : 'border-discordex-border bg-discordex-bg hover:bg-discordex-surface'}`}
                  >
                    <span className="text-sm">🔊</span>
                    <span className="text-xs font-semibold text-discordex-text-primary">Voz</span>
                  </button>
                </div>
              </div>

              <div className="mb-5">
                <label className="block text-xs font-bold text-discordex-text-secondary uppercase tracking-wider mb-2">
                  Categoria
                </label>
                <select 
                  value={channelParentId ?? ''}
                  onChange={(e) => setChannelParentId(e.target.value || null)}
                  className="w-full px-4 py-3 bg-discordex-bg border border-discordex-border rounded-xl text-discordex-text-primary focus:outline-none focus:border-primary text-sm"
                >
                  <option value="">Nenhuma</option>
                  {(activeServer?.categories || []).map((category) => (
                    <option key={category.id} value={category.id}>{category.name}</option>
                  ))}
                </select>
              </div>

              <div className="mb-2">
                <label className="block text-xs font-bold text-discordex-text-secondary uppercase tracking-wider mb-2">
                  Nome do canal
                </label>
                <input 
                  type="text" 
                  value={channelName}
                  onChange={(e) => setChannelName(e.target.value)}
                  placeholder="novo-canal" 
                  className="w-full px-4 py-3 bg-discordex-bg border border-discordex-border rounded-xl text-discordex-text-primary placeholder:text-discordex-text-secondary/40 focus:outline-none focus:border-primary transition-colors text-sm"
                  required
                  autoFocus
                />
              </div>
            </div>
            <div className="px-6 py-4 bg-discordex-surface flex justify-end gap-3 border-t border-discordex-border">
              <button 
                type="button" 
                onClick={closeModal} 
                className="px-5 py-2.5 rounded-xl text-sm font-semibold text-discordex-text-primary hover:bg-discordex-hover transition-colors"
              >
                Cancelar
              </button>
              <button 
                type="submit" 
                className="px-5 py-2.5 rounded-xl text-sm font-semibold bg-primary hover:bg-primary-hover text-white transition-colors"
              >
                Criar
              </button>
            </div>
          </form>
        )}

        {/* Create Category Modal */}
        {activeModal === 'create-category' && (
          <form onSubmit={handleCreateCategory}>
            <div className="p-6">
              <div className="flex justify-between items-center mb-4">
                <h3 className="text-xl font-bold text-discordex-text-primary">Criar categoria</h3>
                <button type="button" onClick={closeModal} className="text-discordex-text-secondary hover:text-discordex-text-primary">
                  <X className="w-5 h-5" />
                </button>
              </div>

              <div className="mb-2">
                <label className="block text-xs font-bold text-discordex-text-secondary uppercase tracking-wider mb-2">
                  Nome da categoria
                </label>
                <input 
                  type="text" 
                  value={categoryName}
                  onChange={(e) => setCategoryName(e.target.value)}
                  placeholder="Ex.: Canais de Texto" 
                  className="w-full px-4 py-3 bg-discordex-bg border border-discordex-border rounded-xl text-discordex-text-primary placeholder:text-discordex-text-secondary/40 focus:outline-none focus:border-primary transition-colors text-sm"
                  required
                  autoFocus
                />
              </div>
            </div>
            <div className="px-6 py-4 bg-discordex-surface flex justify-end gap-3 border-t border-discordex-border">
              <button 
                type="button" 
                onClick={closeModal} 
                className="px-5 py-2.5 rounded-xl text-sm font-semibold text-discordex-text-primary hover:bg-discordex-hover transition-colors"
              >
                Cancelar
              </button>
              <button 
                type="submit" 
                className="px-5 py-2.5 rounded-xl text-sm font-semibold bg-primary hover:bg-primary-hover text-white transition-colors"
              >
                Criar
              </button>
            </div>
          </form>
        )}

        {/* Edit Channel Modal */}
        {activeModal === 'edit-channel' && editChannel && (
          <form onSubmit={handleSaveEditChannel} className="max-h-[85vh] overflow-y-auto">
            <div className="p-6">
              <div className="flex justify-between items-center mb-4">
                <h3 className="text-xl font-bold text-discordex-text-primary flex items-center gap-2">
                  {editChannel.type === 'voice'
                    ? <Volume2 className="w-5 h-5 text-discordex-text-secondary" />
                    : <Hash className="w-5 h-5 text-discordex-text-secondary" />}
                  Editar canal
                </h3>
                <button type="button" onClick={closeModal} className="text-discordex-text-secondary hover:text-discordex-text-primary">
                  <X className="w-5 h-5" />
                </button>
              </div>
              <p className="text-xs text-discordex-text-secondary mb-6">
                Edite as informações, a categoria e o acesso de cada cargo ao canal.
              </p>

              <div className="space-y-4">
                <div>
                  <label className="block text-xs font-bold text-discordex-text-secondary uppercase tracking-wider mb-2">
                    Nome do canal
                  </label>
                  <input
                    type="text"
                    value={editChannelName}
                    onChange={(e) => setEditChannelName(e.target.value)}
                    placeholder="nome-do-canal"
                    className="w-full px-4 py-3 bg-discordex-bg border border-discordex-border rounded-xl text-discordex-text-primary placeholder:text-discordex-text-secondary/40 focus:outline-none focus:border-primary transition-colors text-sm"
                    required
                    autoFocus
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-discordex-text-secondary uppercase tracking-wider mb-2">
                    Descricao
                  </label>
                  <input
                    type="text"
                    value={editChannelDesc}
                    onChange={(e) => setEditChannelDesc(e.target.value)}
                    placeholder="O que este canal e para?"
                    className="w-full px-4 py-3 bg-discordex-bg border border-discordex-border rounded-xl text-discordex-text-primary placeholder:text-discordex-text-secondary/40 focus:outline-none focus:border-primary transition-colors text-sm"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-discordex-text-secondary uppercase tracking-wider mb-2">
                    Categoria
                  </label>
                  <select
                    value={editChannelParentId ?? ''}
                    onChange={(e) => setEditChannelParentId(e.target.value || null)}
                    className="w-full px-4 py-3 bg-discordex-bg border border-discordex-border rounded-xl text-discordex-text-primary focus:outline-none focus:border-primary text-sm"
                  >
                    <option value="">Nenhuma</option>
                    {(activeServer?.categories || []).map((category) => (
                      <option key={category.id} value={category.id}>{category.name}</option>
                    ))}
                  </select>
                </div>

                <div className="bg-discordex-bg border border-discordex-border rounded-2xl p-4 space-y-3">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      {editChannelPrivate
                        ? <Lock className="w-4 h-4 text-discordex-danger" />
                        : <LockOpen className="w-4 h-4 text-discordex-success" />}
                      <span className="text-xs font-bold text-discordex-text-primary">
                        {editChannelPrivate ? 'Canal privado' : 'Canal publico'}
                      </span>
                    </div>
                    <button
                      type="button"
                      onClick={toggleEditChannelPrivacy}
                      className={`w-10 h-6 rounded-full p-1 transition-colors ${editChannelPrivate ? 'bg-discordex-danger' : 'bg-discordex-success'}`}
                    >
                      <span className={`block w-4 h-4 rounded-full bg-white transition-transform ${editChannelPrivate ? 'translate-x-4' : 'translate-x-0'}`} />
                    </button>
                  </div>
                  <p className="text-[10px] text-discordex-text-secondary leading-relaxed">
                    {editChannelPrivate
                      ? 'Somente cargos com "Ver" ativado enxergam este canal. Cargos novos entram bloqueados.'
                      : 'Todos os membros enxergam e podem usar este canal. As restricoes abaixo removem o acesso de cargos especificos.'}
                  </p>

                  <div className="h-px bg-discordex-border" />

                  <div className="space-y-1.5 max-h-64 overflow-y-auto pr-1">
                    {(serverRoles[activeServerId ?? ''] || []).map((role) => {
                      const view = roleCanView(role.id);
                      const send = roleCanSend(role.id);
                      return (
                        <div key={role.id} className="flex items-center gap-3 px-3 py-2 rounded-xl bg-discordex-secondary border border-discordex-border/60">
                          <span
                            className="w-2.5 h-2.5 rounded-full shrink-0"
                            style={{ backgroundColor: role.color }}
                          />
                          <span className="flex-1 min-w-0 text-xs font-semibold text-discordex-text-primary truncate">
                            {role.name}
                          </span>
                          <button
                            type="button"
                            onClick={() => toggleEditRoleView(role.id)}
                            className={`px-2.5 py-1.5 rounded-lg text-[10px] font-bold transition-colors ${
                              view ? 'bg-discordex-success/15 text-discordex-success' : 'bg-discordex-danger/15 text-discordex-danger'
                            }`}
                          >
                            {view ? 'Ver' : 'Oculto'}
                          </button>
                          {editChannel.type === 'text' && (
                            <button
                              type="button"
                              onClick={() => toggleEditRoleSend(role.id)}
                              className={`px-2.5 py-1.5 rounded-lg text-[10px] font-bold transition-colors ${
                                send ? 'bg-discordex-success/15 text-discordex-success' : 'bg-discordex-danger/15 text-discordex-danger'
                              }`}
                            >
                              {send ? 'Enviar' : 'Sem enviar'}
                            </button>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>
              </div>
            </div>
            <div className="px-6 py-4 bg-discordex-surface flex justify-end gap-3 border-t border-discordex-border">
              <button
                type="button"
                onClick={closeModal}
                className="px-5 py-2.5 rounded-xl text-sm font-semibold text-discordex-text-primary hover:bg-discordex-hover transition-colors"
              >
                Cancelar
              </button>
              <button
                type="submit"
                className="px-5 py-2.5 rounded-xl text-sm font-semibold bg-primary hover:bg-primary-hover text-white inline-flex items-center gap-2 transition-colors"
              >
                <Save className="w-4 h-4" />
                Salvar
              </button>
            </div>
          </form>
        )}

        {/* Profile Details Modal */}
        {activeModal === 'profile-view' && selectedProfileUser && (
          <div className="overflow-hidden bg-discordex-bg">
            {/* Header Banner */}
            <div className="h-28 bg-gradient-to-r from-primary to-primary-dark relative">
              <button 
                onClick={closeModal} 
                className="absolute top-4 right-4 bg-black/40 hover:bg-black/60 p-2 rounded-full text-white transition-colors"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Profile Content */}
            <div className="px-6 pb-6 relative">
              {/* Avatar position */}
              <div className="absolute -top-12 left-6">
                <div className="relative">
                  <img 
                    src={selectedProfileUser.avatar} 
                    alt={selectedProfileUser.displayName} 
                    className="w-24 h-24 rounded-full border-4 border-discordex-bg object-cover"
                  />
                  <div className={`absolute bottom-1 right-1 w-5 h-5 rounded-full border-4 border-discordex-bg ${
                    selectedProfileUser.status === 'online' ? 'bg-discordex-success' :
                    selectedProfileUser.status === 'idle' ? 'bg-discordex-warning' :
                    selectedProfileUser.status === 'dnd' ? 'bg-discordex-danger' :
                    'bg-discordex-text-secondary'
                  }`} />
                </div>
              </div>

              {/* Action Buttons */}
              <div className="flex justify-end pt-3 gap-2">
                {selectedProfileUser.id !== 'me' && (
                  <>
                    <button 
                      onClick={() => {
                        setActiveServerId(null);
                        setActiveDmId(selectedProfileUser.id);
                        closeModal();
                      }}
                      className="p-2.5 bg-discordex-surface hover:bg-discordex-hover text-discordex-text-primary rounded-xl border border-discordex-border transition-colors tooltip-trigger"
                    >
                      <MessageSquare className="w-4.5 h-4.5" />
                    </button>
                    <button 
                      onClick={() => {
                        startCall('voice', selectedProfileUser.id, selectedProfileUser.displayName, false, selectedProfileUser.avatar);
                        closeModal();
                      }}
                      className="px-4 py-2.5 bg-primary hover:bg-primary-hover text-white rounded-xl text-sm font-medium flex items-center gap-2 transition-colors"
                    >
                      <Phone className="w-4 h-4" /> Chamada
                    </button>
                  </>
                )}
              </div>

              {/* User details */}
              <div className="mt-6">
                <h2 className="text-xl font-bold text-discordex-text-primary flex items-center gap-2">
                  {selectedProfileUser.displayName}
                </h2>
                <span className="text-xs text-discordex-text-secondary font-mono">@{selectedProfileUser.username}</span>

                {/* Role badge */}
                {selectedProfileUser.role && (
                  <div className="mt-3 flex items-center gap-1.5 px-3 py-1 bg-discordex-surface border border-discordex-border rounded-lg w-fit text-xs font-semibold text-discordex-text-primary">
                    <Shield className="w-3.5 h-3.5 text-primary" />
                    {selectedProfileUser.role}
                  </div>
                )}

                <div className="h-px bg-discordex-border my-4" />

                {/* Bio */}
                <div className="mb-4">
                  <span className="block text-[10px] font-bold text-discordex-text-secondary uppercase tracking-wider mb-1.5">
                    Sobre mim
                  </span>
                  <p className="text-sm text-discordex-text-secondary leading-relaxed">
                    {selectedProfileUser.bio || 'Sem bio disponível.'}
                  </p>
                </div>

                {/* Join Date */}
                <div className="flex items-center gap-2 text-xs text-discordex-text-secondary mt-4 bg-discordex-surface/40 p-2.5 rounded-xl border border-discordex-border/40">
                  <Calendar className="w-4 h-4 text-primary" />
                  <span>Membro desde {selectedProfileUser.joinedDate || '2026'}</span>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
