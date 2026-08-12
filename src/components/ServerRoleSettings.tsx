import React, { useEffect, useMemo, useState } from 'react';
import { useApp } from '../context/AppContext';
import type { Server, ServerRole } from '../context/AppContext';
import { ALL_PERMISSIONS, hasPermission } from '../lib/permissions';
import { getAuditLogs, AUDIT_ACTION_LABELS, type AuditLogRow } from '../services/roles';
import {
  Plus, Trash2, Save, Shield, Hash, Volume2, Users, Check, X, RefreshCw,
} from 'lucide-react';

const DEFAULT_ROLE_COLOR = '#99AAB5';
const DEFAULT_ROLE_PERMS = 256 + 512 + 1024 + 2048;

export const RoleSettings: React.FC<{ server: Server }> = ({ server }) => {
  const {
    serverRoles,
    serverChannelPerms,
    serverMembers,
    getMyPermissions,
    createRole,
    updateRole,
    deleteRole,
    addRoleToMember,
    removeRoleFromMember,
    setChannelRolePermission,
    removeChannelRolePermission,
    addToast,
  } = useApp();

  const roles = serverRoles[server.id] || [];
  const members = serverMembers[server.id] || [];
  const channelPerms = serverChannelPerms[server.id] || [];
  const myPerms = getMyPermissions(server.id);

  const [selectedRoleId, setSelectedRoleId] = useState<string | null>(null);
  const [name, setName] = useState('');
  const [color, setColor] = useState(DEFAULT_ROLE_COLOR);
  const [position, setPosition] = useState(0);
  const [draftPermissions, setDraftPermissions] = useState(0);
  const [addMemberId, setAddMemberId] = useState('');

  const selectedRole = useMemo(
    () => roles.find((role) => role.id === selectedRoleId) || null,
    [roles, selectedRoleId]
  );

  useEffect(() => {
    if (!selectedRole) return;
    setName(selectedRole.name);
    setColor(selectedRole.color);
    setPosition(selectedRole.position);
    setDraftPermissions(selectedRole.permissions);
  }, [selectedRole]);

  const canManageThisRole = (role: ServerRole) =>
    myPerms.isOwner || role.position < myPerms.topPosition;

  const handleCreateRole = async () => {
    const nameInput = window.prompt('Nome do novo cargo:');
    if (!nameInput || !nameInput.trim()) return;
    const result = await createRole(server.id, nameInput.trim(), DEFAULT_ROLE_COLOR, DEFAULT_ROLE_PERMS);
    if (result) addToast('Cargo criado.', 'success');
  };

  const handleSave = async () => {
    if (!selectedRole) return;
    if (!name.trim()) {
      addToast('O nome do cargo não pode ser vazio.', 'error');
      return;
    }
    const ok = await updateRole(server.id, selectedRole.id, {
      name: name.trim(),
      color,
      position,
      permissions: draftPermissions,
    });
    if (ok) addToast('Cargo atualizado.', 'success');
  };

  const togglePermission = (bit: number) => {
    setDraftPermissions((prev) => (hasPermission(prev, bit) ? prev & ~bit : prev | bit));
  };

  const roleMembers = members.filter((member) => member.roles.some((role) => role.id === selectedRoleId));
  const membersWithoutRole = members.filter((member) => !member.roles.some((role) => role.id === selectedRoleId));

  const permsForChannel = (channelId: string) =>
    channelPerms.filter((perm) => perm.channel_id === channelId);

  const toggleChannelView = (roleId: string, channelId: string) => {
    const current = permsForChannel(channelId).find((perm) => perm.role_id === roleId);
    const canView = current ? current.can_view : true;
    const canSend = current ? current.can_send : canView;
    void setChannelRolePermission(channelId, roleId, !canView, canSend);
  };

  const toggleChannelSend = (roleId: string, channelId: string) => {
    const current = permsForChannel(channelId).find((perm) => perm.role_id === roleId);
    if (!current) {
      void setChannelRolePermission(channelId, roleId, true, false);
      return;
    }
    void setChannelRolePermission(channelId, roleId, current.can_view, !current.can_send);
  };

  const clearChannelOverrides = (channelId: string) => {
    permsForChannel(channelId).forEach((perm) => {
      void removeChannelRolePermission(channelId, perm.role_id);
    });
  };

  return (
    <div className="max-w-4xl space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold text-discordex-text-primary">Cargos</h2>
          <p className="text-xs text-discordex-text-secondary mt-1">
            Cada grupo tem seus próprios cargos e permissões, totalmente configuráveis.
          </p>
        </div>
        <button
          onClick={() => void handleCreateRole()}
          className="inline-flex items-center gap-2 px-4 py-2.5 bg-primary hover:bg-primary-hover text-white rounded-xl text-xs font-semibold transition-colors"
        >
          <Plus className="w-4 h-4" />
          Criar cargo
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-[220px_1fr] gap-6">
        {/* Role list */}
        <div className="bg-discordex-secondary border border-discordex-border rounded-2xl overflow-hidden self-start">
          <div className="px-4 py-3 border-b border-discordex-border text-[10px] font-bold uppercase tracking-wider text-discordex-text-secondary">
            Cargos ({roles.length})
          </div>
          <div className="divide-y divide-discordex-border/60">
            {roles.map((role) => {
              const selected = role.id === selectedRoleId;
              return (
                <button
                  key={role.id}
                  onClick={() => setSelectedRoleId(role.id)}
                  className={`w-full flex items-center gap-2.5 px-4 py-2.5 text-left transition-colors ${
                    selected ? 'bg-discordex-surface text-discordex-text-primary' : 'hover:bg-discordex-surface/40 text-discordex-text-secondary'
                  }`}
                >
                  <span className="w-3 h-3 rounded-full shrink-0" style={{ backgroundColor: role.color }} />
                  <span className="flex-1 min-w-0 truncate text-xs font-semibold">{role.name}</span>
                  <span className="text-[9px] text-discordex-text-secondary shrink-0">{role.position}</span>
                </button>
              );
            })}
          </div>
        </div>

        {/* Role editor */}
        {selectedRole ? (
          <div className="space-y-6 min-w-0">
            {!canManageThisRole(selectedRole) ? (
              <div className="text-xs rounded-xl border border-discordex-danger/30 bg-discordex-danger/10 text-discordex-danger px-4 py-3">
                Você não pode editar cargos iguais ou superiores ao seu (hierarquia).
              </div>
            ) : (
              <>
                {/* Basics */}
                <div className="bg-discordex-secondary border border-discordex-border rounded-2xl p-5 space-y-4">
                  <div className="flex items-center justify-between">
                    <h3 className="text-sm font-bold text-discordex-text-primary flex items-center gap-2">
                      <Shield className="w-4 h-4 text-discordex-text-secondary" />
                      Configurações do cargo
                    </h3>
                    <button
                      onClick={() => {
                        if (window.confirm(`Excluir o cargo "${selectedRole.name}"?`)) void deleteRole(server.id, selectedRole.id);
                      }}
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 text-[10px] font-bold text-discordex-danger hover:bg-discordex-danger/10 rounded-lg transition-colors"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                      Excluir
                    </button>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-[1fr_90px_90px] gap-3">
                    <label className="block space-y-1.5">
                      <span className="block text-[10px] font-bold text-discordex-text-secondary uppercase tracking-wider">Nome</span>
                      <input
                        type="text"
                        value={name}
                        onChange={(event) => setName(event.target.value)}
                        className="w-full px-3.5 py-2.5 bg-discordex-bg border border-discordex-border rounded-xl text-xs text-discordex-text-primary focus:outline-none focus:border-primary"
                      />
                    </label>
                    <label className="block space-y-1.5">
                      <span className="block text-[10px] font-bold text-discordex-text-secondary uppercase tracking-wider">Cor</span>
                      <input
                        type="color"
                        value={color}
                        onChange={(event) => setColor(event.target.value)}
                        className="w-full h-[38px] bg-discordex-bg border border-discordex-border rounded-xl cursor-pointer"
                      />
                    </label>
                    <label className="block space-y-1.5">
                      <span className="block text-[10px] font-bold text-discordex-text-secondary uppercase tracking-wider">Posição</span>
                      <input
                        type="number"
                        value={position}
                        min={0}
                        onChange={(event) => setPosition(Math.max(0, Number(event.target.value) || 0))}
                        className="w-full px-3.5 py-2.5 bg-discordex-bg border border-discordex-border rounded-xl text-xs text-discordex-text-primary focus:outline-none focus:border-primary"
                      />
                    </label>
                  </div>
                </div>

                {/* Permissions */}
                <div className="bg-discordex-secondary border border-discordex-border rounded-2xl p-5 space-y-3">
                  <h3 className="text-sm font-bold text-discordex-text-primary flex items-center gap-2">
                    <Shield className="w-4 h-4 text-discordex-text-secondary" />
                    Permissões
                  </h3>
                  <div className="space-y-1">
                    {ALL_PERMISSIONS.map((permission) => (
                      <button
                        key={permission.key}
                        onClick={() => togglePermission(permission.bit)}
                        className="w-full flex items-center gap-3 px-3 py-2 rounded-xl text-left hover:bg-discordex-surface/50 transition-colors"
                      >
                        <span className={`w-4 h-4 rounded border flex items-center justify-center shrink-0 transition-colors ${
                          hasPermission(draftPermissions, permission.bit)
                            ? 'bg-discordex-success border-discordex-success'
                            : 'border-discordex-text-secondary/40'
                        }`}>
                          {hasPermission(draftPermissions, permission.bit) && <Check className="w-3 h-3 text-white" />}
                        </span>
                        <span className="flex-1 min-w-0">
                          <span className="block text-xs font-semibold text-discordex-text-primary">{permission.label}</span>
                          <span className="block text-[10px] text-discordex-text-secondary truncate">{permission.description}</span>
                        </span>
                      </button>
                    ))}
                  </div>
                </div>

                {/* Members */}
                <div className="bg-discordex-secondary border border-discordex-border rounded-2xl p-5 space-y-3">
                  <h3 className="text-sm font-bold text-discordex-text-primary flex items-center gap-2">
                    <Users className="w-4 h-4 text-discordex-text-secondary" />
                    Membros com este cargo ({roleMembers.length})
                  </h3>
                  <div className="space-y-1.5">
                    {roleMembers.map((member) => (
                      <div key={member.userId} className="flex items-center gap-3 px-3 py-2 rounded-xl bg-discordex-bg border border-discordex-border/60">
                        <img src={member.profile.avatar} alt={member.profile.displayName} className="w-7 h-7 rounded-full object-cover" />
                        <span className="flex-1 min-w-0 text-xs font-semibold text-discordex-text-primary truncate">
                          {member.nickname || member.profile.displayName}
                        </span>
                        <button
                          onClick={() => void removeRoleFromMember(server.id, member.userId, selectedRole.id)}
                          className="p-1.5 text-discordex-text-secondary hover:text-discordex-danger hover:bg-discordex-danger/10 rounded-lg transition-colors"
                        >
                          <X className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    ))}
                  </div>
                  <div className="flex items-center gap-2">
                    <select
                      value={addMemberId}
                      onChange={(event) => setAddMemberId(event.target.value)}
                      className="flex-1 px-3.5 py-2.5 bg-discordex-bg border border-discordex-border rounded-xl text-xs text-discordex-text-primary focus:outline-none focus:border-primary"
                    >
                      <option value="">Selecione um membro...</option>
                      {membersWithoutRole.map((member) => (
                        <option key={member.userId} value={member.userId}>
                          {member.nickname || member.profile.displayName}
                        </option>
                      ))}
                    </select>
                    <button
                      onClick={() => {
                        if (!addMemberId) return;
                        void addRoleToMember(server.id, addMemberId, selectedRole.id);
                        setAddMemberId('');
                      }}
                      className="px-3.5 py-2.5 bg-discordex-surface hover:bg-discordex-hover border border-discordex-border rounded-xl text-xs font-semibold text-discordex-text-primary transition-colors"
                    >
                      Adicionar
                    </button>
                  </div>
                </div>

                {/* Channel access */}
                <div className="bg-discordex-secondary border border-discordex-border rounded-2xl p-5 space-y-3">
                  <div className="flex items-center justify-between">
                    <h3 className="text-sm font-bold text-discordex-text-primary flex items-center gap-2">
                      <Hash className="w-4 h-4 text-discordex-text-secondary" />
                      Acesso a canais
                    </h3>
                    <span className="text-[10px] text-discordex-text-secondary">
                      Desmarcar "Ver" de um cargo torna o canal privado para ele.
                    </span>
                  </div>
                  <div className="space-y-1.5">
                    {server.channels.map((channel) => {
                      const perms = permsForChannel(channel.id).find((perm) => perm.role_id === selectedRole.id);
                      const canView = perms ? perms.can_view : !permsForChannel(channel.id).length;
                      const canSend = perms ? perms.can_send : !permsForChannel(channel.id).length;
                      const isVoice = channel.type === 'voice';
                      return (
                        <div key={channel.id} className="flex items-center gap-3 px-3 py-2.5 rounded-xl bg-discordex-bg border border-discordex-border/60">
                          {isVoice
                            ? <Volume2 className="w-4 h-4 text-discordex-text-secondary shrink-0" />
                            : <Hash className="w-4 h-4 text-discordex-text-secondary shrink-0" />}
                          <span className="flex-1 min-w-0 text-xs font-semibold text-discordex-text-primary truncate">
                            {channel.name}
                          </span>
                          <button
                            onClick={() => toggleChannelView(selectedRole.id, channel.id)}
                            className={`px-2.5 py-1.5 rounded-lg text-[10px] font-bold transition-colors ${
                              canView ? 'bg-discordex-success/15 text-discordex-success' : 'bg-discordex-danger/15 text-discordex-danger'
                            }`}
                          >
                            {canView ? 'Ver' : 'Oculto'}
                          </button>
                          {!isVoice && (
                            <button
                              onClick={() => toggleChannelSend(selectedRole.id, channel.id)}
                              className={`px-2.5 py-1.5 rounded-lg text-[10px] font-bold transition-colors ${
                                canSend ? 'bg-discordex-success/15 text-discordex-success' : 'bg-discordex-danger/15 text-discordex-danger'
                              }`}
                            >
                              {canSend ? 'Enviar' : 'Sem enviar'}
                            </button>
                          )}
                        </div>
                      );
                    })}
                  </div>
                  <button
                    onClick={() => { server.channels.forEach((channel) => clearChannelOverrides(channel.id)); }}
                    className="text-[10px] font-bold text-discordex-text-secondary hover:text-discordex-text-primary transition-colors"
                  >
                    Remover todas as restrições deste cargo
                  </button>
                </div>

                <button
                  onClick={() => void handleSave()}
                  className="inline-flex items-center gap-2 px-5 py-2.5 bg-primary hover:bg-primary-hover text-white rounded-xl text-sm font-semibold transition-colors"
                >
                  <Save className="w-4 h-4" />
                  Salvar alterações
                </button>
              </>
            )}
          </div>
        ) : (
          <div className="bg-discordex-secondary border border-discordex-border rounded-2xl p-8 text-center text-xs text-discordex-text-secondary/60 italic">
            Selecione um cargo para editar ou crie um novo.
          </div>
        )}
      </div>
    </div>
  );
};

export const AuditLogs: React.FC<{ server: Server }> = ({ server }) => {
  const [logs, setLogs] = useState<AuditLogRow[]>([]);
  const [loading, setLoading] = useState(false);

  const load = async () => {
    setLoading(true);
    const data = await getAuditLogs(server.id, 100);
    setLogs(data);
    setLoading(false);
  };

  useEffect(() => {
    void load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [server.id]);

  return (
    <div className="max-w-3xl space-y-6">
      <div className="flex items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold text-discordex-text-primary">Logs</h2>
          <p className="text-xs text-discordex-text-secondary mt-1">
            Registro de todas as ações administrativas do grupo.
          </p>
        </div>
        <button
          onClick={() => void load()}
          className="px-4 py-2.5 bg-discordex-secondary hover:bg-discordex-surface border border-discordex-border text-discordex-text-primary rounded-xl text-xs font-semibold inline-flex items-center gap-2 transition-colors"
        >
          <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
          Atualizar
        </button>
      </div>

      <div className="bg-discordex-secondary border border-discordex-border rounded-2xl overflow-hidden">
        <div className="grid grid-cols-[150px_1fr_1fr_130px] gap-3 px-4 py-3 text-[10px] font-bold uppercase tracking-wider text-discordex-text-secondary border-b border-discordex-border">
          <span>Data</span>
          <span>Ação</span>
          <span>Quem / Alvo</span>
          <span>Detalhes</span>
        </div>
        {loading ? (
          <div className="px-4 py-8 text-center text-xs text-discordex-text-secondary">Carregando logs...</div>
        ) : logs.length === 0 ? (
          <div className="px-4 py-8 text-center text-xs text-discordex-text-secondary">Nenhum registro ainda.</div>
        ) : (
          logs.map((log) => (
            <div key={log.id} className="grid grid-cols-[150px_1fr_1fr_130px] gap-3 px-4 py-3 items-center border-b border-discordex-border/60 last:border-b-0 hover:bg-discordex-surface/30 transition-colors">
              <span className="text-[10px] text-discordex-text-secondary">
                {new Date(log.created_at).toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', year: '2-digit', hour: '2-digit', minute: '2-digit' })}
              </span>
              <span className="text-xs font-semibold text-discordex-text-primary">
                {AUDIT_ACTION_LABELS[log.action] || log.action}
              </span>
              <span className="text-[10px] text-discordex-text-secondary truncate">
                {log.actor_name}
                {log.target_name ? ` → ${log.target_name}` : ''}
              </span>
              <span className="text-[10px] text-discordex-text-secondary/70 truncate" title={JSON.stringify(log.details ?? {})}>
                {log.details ? JSON.stringify(log.details) : '—'}
              </span>
            </div>
          ))
        )}
      </div>
    </div>
  );
};