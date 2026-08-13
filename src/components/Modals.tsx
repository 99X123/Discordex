import React, { useEffect, useState } from 'react';
import { useApp } from '../context/AppContext';
import type { Server } from '../context/AppContext';
import { X, Shield, CalendarBlank, ChatCircleDots, Phone, Hash, Waveform, Lock, LockOpen, FloppyDisk } from '@phosphor-icons/react';

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

  const inputCls = "w-full px-4 py-3 bg-signal-bg border border-signal-border rounded-md text-signal-text-primary placeholder:text-signal-text-secondary/40 focus:outline-none focus:border-brass transition-colors text-sm";
  const labelCls = "block text-xs font-bold text-signal-text-secondary uppercase tracking-wider mb-2";
  const cancelBtn = "px-5 py-2.5 rounded-md text-sm font-semibold text-signal-text-primary hover:bg-signal-hover transition-colors";
  const submitBtn = "px-5 py-2.5 rounded-md text-sm font-bold bg-brass hover:bg-brass-hover text-signal-bg transition-colors";

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm animate-fade-in">
      <div
        className={`w-full ${activeModal === 'edit-channel' ? 'max-w-2xl' : 'max-w-md'} bg-signal-secondary border border-signal-border panel-cut-lg overflow-hidden shadow-float-lg animate-slide-up`}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Modal: Criar servidor */}
        {activeModal === 'create-server' && (
          <form onSubmit={handleCreateServer}>
            <div className="p-6">
              <div className="flex justify-between items-center mb-4">
                <h3 className="text-xl font-display font-bold text-signal-text-primary">Criar sua estação</h3>
                <button type="button" onClick={closeModal} className="text-signal-text-secondary hover:text-signal-text-primary">
                  <X className="w-5 h-5" />
                </button>
              </div>
              <p className="text-xs text-signal-text-secondary mb-6">
                Sua estação é onde você e seus amigos se reúnem. Crie a sua e comece a transmitir.
              </p>

              <div className="mb-6">
                <label className={labelCls}>
                  Nome da estação
                </label>
                <input
                  type="text"
                  value={serverName}
                  onChange={(e) => setServerName(e.target.value)}
                  placeholder="Meu Incrível Servidor"
                  className={inputCls}
                  required
                  autoFocus
                />
              </div>
            </div>
            <div className="px-6 py-4 bg-signal-surface flex justify-end gap-3 border-t border-signal-border">
              <button type="button" onClick={closeModal} className={cancelBtn}>
                Cancelar
              </button>
              <button type="submit" className={submitBtn}>
                Criar
              </button>
            </div>
          </form>
        )}

        {/* Modal: Entrar em um servidor */}
        {activeModal === 'join-server' && (
          <form onSubmit={handleJoinServer}>
            <div className="p-6">
              <div className="flex justify-between items-center mb-4">
                <h3 className="text-xl font-display font-bold text-signal-text-primary">Sintonizar uma estação</h3>
                <button type="button" onClick={closeModal} className="text-signal-text-secondary hover:text-signal-text-primary">
                  <X className="w-5 h-5" />
                </button>
              </div>
              <p className="text-xs text-signal-text-secondary mb-6">
                Insira um código de convite ou nome para se juntar a um servidor existente.
              </p>

              <div className="mb-6">
                <label className={labelCls}>
                  Código do convite
                </label>
                <input
                  type="text"
                  value={inviteCode}
                  onChange={(e) => setInviteCode(e.target.value)}
                  placeholder="https://discordex.gg/h7xK9s"
                  className={inputCls}
                  required
                  autoFocus
                />
              </div>
            </div>
            <div className="px-6 py-4 bg-signal-surface flex justify-end gap-3 border-t border-signal-border">
              <button type="button" onClick={closeModal} className={cancelBtn}>
                Cancelar
              </button>
              <button type="submit" className={submitBtn}>
                Entrar
              </button>
            </div>
          </form>
        )}

        {/* Modal: Criar canal */}
        {activeModal === 'create-channel' && (
          <form onSubmit={handleCreateChannel}>
            <div className="p-6">
              <div className="flex justify-between items-center mb-4">
                <h3 className="text-xl font-display font-bold text-signal-text-primary">Criar canal</h3>
                <button type="button" onClick={closeModal} className="text-signal-text-secondary hover:text-signal-text-primary">
                  <X className="w-5 h-5" />
                </button>
              </div>

              <div className="mb-5">
                <label className={labelCls}>
                  Tipo de canal
                </label>
                <div className="grid grid-cols-2 gap-3">
                  <button
                    type="button"
                    onClick={() => setChannelType('text')}
                    className={`p-3 rounded-md border flex flex-col items-center gap-1.5 transition-colors ${channelType === 'text' ? 'border-brass bg-brass/10' : 'border-signal-border bg-signal-bg hover:bg-signal-surface'}`}
                  >
                    <Hash className="w-5 h-5 text-signal-text-primary" />
                    <span className="text-xs font-semibold text-signal-text-primary">Texto</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setChannelType('voice')}
                    className={`p-3 rounded-md border flex flex-col items-center gap-1.5 transition-colors ${channelType === 'voice' ? 'border-brass bg-brass/10' : 'border-signal-border bg-signal-bg hover:bg-signal-surface'}`}
                  >
                    <Waveform className="w-5 h-5 text-signal-text-primary" />
                    <span className="text-xs font-semibold text-signal-text-primary">Voz</span>
                  </button>
                </div>
              </div>

              <div className="mb-5">
                <label className={labelCls}>
                  Categoria
                </label>
                <select
                  value={channelParentId ?? ''}
                  onChange={(e) => setChannelParentId(e.target.value || null)}
                  className={inputCls}
                >
                  <option value="">Nenhuma</option>
                  {(activeServer?.categories || []).map((category) => (
                    <option key={category.id} value={category.id}>{category.name}</option>
                  ))}
                </select>
              </div>

              <div className="mb-2">
                <label className={labelCls}>
                  Nome do canal
                </label>
                <input
                  type="text"
                  value={channelName}
                  onChange={(e) => setChannelName(e.target.value)}
                  placeholder="novo-canal"
                  className={inputCls}
                  required
                  autoFocus
                />
              </div>
            </div>
            <div className="px-6 py-4 bg-signal-surface flex justify-end gap-3 border-t border-signal-border">
              <button type="button" onClick={closeModal} className={cancelBtn}>
                Cancelar
              </button>
              <button type="submit" className={submitBtn}>
                Criar
              </button>
            </div>
          </form>
        )}

        {/* Modal: Criar categoria */}
        {activeModal === 'create-category' && (
          <form onSubmit={handleCreateCategory}>
            <div className="p-6">
              <div className="flex justify-between items-center mb-4">
                <h3 className="text-xl font-display font-bold text-signal-text-primary">Criar categoria</h3>
                <button type="button" onClick={closeModal} className="text-signal-text-secondary hover:text-signal-text-primary">
                  <X className="w-5 h-5" />
                </button>
              </div>

              <div className="mb-2">
                <label className={labelCls}>
                  Nome da categoria
                </label>
                <input
                  type="text"
                  value={categoryName}
                  onChange={(e) => setCategoryName(e.target.value)}
                  placeholder="Ex.: Canais de Texto"
                  className={inputCls}
                  required
                  autoFocus
                />
              </div>
            </div>
            <div className="px-6 py-4 bg-signal-surface flex justify-end gap-3 border-t border-signal-border">
              <button type="button" onClick={closeModal} className={cancelBtn}>
                Cancelar
              </button>
              <button type="submit" className={submitBtn}>
                Criar
              </button>
            </div>
          </form>
        )}

        {/* Modal: Editar canal */}
        {activeModal === 'edit-channel' && editChannel && (
          <form onSubmit={handleSaveEditChannel} className="max-h-[85vh] overflow-y-auto">
            <div className="p-6">
              <div className="flex justify-between items-center mb-4">
                <h3 className="text-xl font-display font-bold text-signal-text-primary flex items-center gap-2">
                  {editChannel.type === 'voice'
                    ? <Waveform className="w-5 h-5 text-signal-text-secondary" />
                    : <Hash className="w-5 h-5 text-signal-text-secondary" />}
                  Editar canal
                </h3>
                <button type="button" onClick={closeModal} className="text-signal-text-secondary hover:text-signal-text-primary">
                  <X className="w-5 h-5" />
                </button>
              </div>
              <p className="text-xs text-signal-text-secondary mb-6">
                Edite as informações, a categoria e o acesso de cada cargo ao canal.
              </p>

              <div className="space-y-4">
                <div>
                  <label className={labelCls}>
                    Nome do canal
                  </label>
                  <input
                    type="text"
                    value={editChannelName}
                    onChange={(e) => setEditChannelName(e.target.value)}
                    placeholder="nome-do-canal"
                    className={inputCls}
                    required
                    autoFocus
                  />
                </div>

                <div>
                  <label className={labelCls}>
                    Descricao
                  </label>
                  <input
                    type="text"
                    value={editChannelDesc}
                    onChange={(e) => setEditChannelDesc(e.target.value)}
                    placeholder="O que este canal e para?"
                    className={inputCls}
                  />
                </div>

                <div>
                  <label className={labelCls}>
                    Categoria
                  </label>
                  <select
                    value={editChannelParentId ?? ''}
                    onChange={(e) => setEditChannelParentId(e.target.value || null)}
                    className={inputCls}
                  >
                    <option value="">Nenhuma</option>
                    {(activeServer?.categories || []).map((category) => (
                      <option key={category.id} value={category.id}>{category.name}</option>
                    ))}
                  </select>
                </div>

                <div className="bg-signal-bg border border-signal-border rounded-md p-4 space-y-3">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      {editChannelPrivate
                        ? <Lock className="w-4 h-4 text-signal-danger" />
                        : <LockOpen className="w-4 h-4 text-signal-success" />}
                      <span className="text-xs font-bold text-signal-text-primary">
                        {editChannelPrivate ? 'Canal privado' : 'Canal publico'}
                      </span>
                    </div>
                    <button
                      type="button"
                      onClick={toggleEditChannelPrivacy}
                      className={`w-10 h-6 rounded-full p-1 transition-colors ${editChannelPrivate ? 'bg-signal-danger' : 'bg-signal-success'}`}
                    >
                      <span className={`block w-4 h-4 rounded-full bg-white transition-transform ${editChannelPrivate ? 'translate-x-4' : 'translate-x-0'}`} />
                    </button>
                  </div>
                  <p className="text-[10px] text-signal-text-secondary leading-relaxed">
                    {editChannelPrivate
                      ? 'Somente cargos com "Ver" ativado enxergam este canal. Cargos novos entram bloqueados.'
                      : 'Todos os membros enxergam e podem usar este canal. As restricoes abaixo removem o acesso de cargos especificos.'}
                  </p>

                  <div className="h-px bg-signal-border" />

                  <div className="space-y-1.5 max-h-64 overflow-y-auto pr-1">
                    {(serverRoles[activeServerId ?? ''] || []).map((role) => {
                      const view = roleCanView(role.id);
                      const send = roleCanSend(role.id);
                      return (
                        <div key={role.id} className="flex items-center gap-3 px-3 py-2 rounded-md bg-signal-secondary border border-signal-border/60">
                          <span
                            className="w-2.5 h-2.5 rounded-full shrink-0"
                            style={{ backgroundColor: role.color }}
                          />
                          <span className="flex-1 min-w-0 text-xs font-semibold text-signal-text-primary truncate">
                            {role.name}
                          </span>
                          <button
                            type="button"
                            onClick={() => toggleEditRoleView(role.id)}
                            className={`px-2.5 py-1.5 rounded-md text-[10px] font-bold transition-colors ${
                              view ? 'bg-signal-success/15 text-signal-success' : 'bg-signal-danger/15 text-signal-danger'
                            }`}
                          >
                            {view ? 'Ver' : 'Oculto'}
                          </button>
                          {editChannel.type === 'text' && (
                            <button
                              type="button"
                              onClick={() => toggleEditRoleSend(role.id)}
                              className={`px-2.5 py-1.5 rounded-md text-[10px] font-bold transition-colors ${
                                send ? 'bg-signal-success/15 text-signal-success' : 'bg-signal-danger/15 text-signal-danger'
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
            <div className="px-6 py-4 bg-signal-surface flex justify-end gap-3 border-t border-signal-border">
              <button
                type="button"
                onClick={closeModal}
                className={cancelBtn}
              >
                Cancelar
              </button>
              <button
                type="submit"
                className={`${submitBtn} inline-flex items-center gap-2`}
              >
                <FloppyDisk className="w-4 h-4" />
                Salvar
              </button>
            </div>
          </form>
        )}

        {/* Modal: Perfil */}
        {activeModal === 'profile-view' && selectedProfileUser && (
          <div className="overflow-hidden bg-signal-bg">
            {/* Banner */}
            <div className={`relative ${selectedProfileUser.banner ? 'bg-signal-surface' : 'bg-gradient-to-r from-brass-dark to-brass'}`}>
              {selectedProfileUser.banner ? (
                <img
                  src={selectedProfileUser.banner}
                  alt="Banner"
                  className="w-full h-28 object-cover"
                  onError={(event) => { event.currentTarget.style.display = 'none'; }}
                />
              ) : (
                <div className="h-28" />
              )}
              <button
                onClick={closeModal}
                className="absolute top-4 right-4 bg-black/40 hover:bg-black/60 p-2 rounded-full text-white transition-colors"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Conteúdo */}
            <div className="px-6 pb-6 relative">
              <div className="absolute -top-12 left-6">
                <div className="relative">
                  <img
                    src={selectedProfileUser.avatar}
                    alt={selectedProfileUser.displayName}
                    className="w-24 h-24 rounded-full border-4 border-signal-bg object-cover"
                  />
                  <div className={`absolute bottom-1 right-1 w-5 h-5 rounded-full border-4 border-signal-bg ${
                    selectedProfileUser.status === 'online' ? 'bg-signal-success shadow-[0_0_6px_rgba(79,178,134,0.7)]' :
                    selectedProfileUser.status === 'idle' ? 'bg-signal-warning shadow-[0_0_6px_rgba(226,133,59,0.7)]' :
                    selectedProfileUser.status === 'dnd' ? 'bg-signal-danger shadow-[0_0_6px_rgba(217,96,75,0.7)]' :
                    'bg-signal-text-secondary'
                  }`} />
                </div>
              </div>

              <div className="flex justify-end pt-3 gap-2">
                {selectedProfileUser.id !== 'me' && (
                  <>
                    <button
                      onClick={() => {
                        setActiveServerId(null);
                        setActiveDmId(selectedProfileUser.id);
                        closeModal();
                      }}
                      className="p-2.5 bg-signal-surface hover:bg-signal-hover text-signal-text-primary rounded-md border border-signal-border transition-colors tooltip-trigger"
                    >
                      <ChatCircleDots className="w-4.5 h-4.5" />
                    </button>
                    <button
                      onClick={() => {
                        startCall('voice', selectedProfileUser.id, selectedProfileUser.displayName, false, selectedProfileUser.avatar);
                        closeModal();
                      }}
                      className="px-4 py-2.5 bg-brass hover:bg-brass-hover text-signal-bg rounded-md text-sm font-bold flex items-center gap-2 transition-colors"
                    >
                      <Phone className="w-4 h-4" /> Chamada
                    </button>
                  </>
                )}
              </div>

              <div className="mt-6">
                <h2 className="text-xl font-display font-bold text-signal-text-primary flex items-center gap-2">
                  {selectedProfileUser.displayName}
                </h2>
                <span className="text-xs text-signal-text-secondary font-mono">@{selectedProfileUser.username}</span>

                {selectedProfileUser.role && (
                  <div className="mt-3 flex items-center gap-1.5 px-3 py-1 bg-signal-surface border border-signal-border rounded-md w-fit text-xs font-semibold text-signal-text-primary">
                    <Shield className="w-3.5 h-3.5 text-brass" />
                    {selectedProfileUser.role}
                  </div>
                )}

                <div className="h-px bg-signal-border my-4" />

                <div className="mb-4">
                  <span className="block text-[10px] font-bold text-signal-text-secondary uppercase tracking-wider mb-1.5">
                    Sobre mim
                  </span>
                  <p className="text-sm text-signal-text-secondary leading-relaxed">
                    {selectedProfileUser.bio || 'Sem bio disponível.'}
                  </p>
                </div>

                <div className="flex items-center gap-2 text-xs text-signal-text-secondary mt-4 bg-signal-surface/40 p-2.5 rounded-md border border-signal-border/40">
                  <CalendarBlank className="w-4 h-4 text-brass" />
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