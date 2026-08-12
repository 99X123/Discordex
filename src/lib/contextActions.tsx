import { useApp } from '../context/AppContext';
import type { Server, ServerMember, ServerRole, Channel, Message, DirectMessage, User } from '../context/AppContext';
import type { ContextMenuItem } from '../components/ContextMenu';
import { PERMISSIONS, hasPermission } from './permissions';
import {
  ArrowDown, ArrowUp, Ban, ClipboardList, Copy, DoorOpen, Eye, Flag,
  Hash, Info, LogOut, MessageSquare, Mic, MicOff, MoveRight, Palette, Pencil, Phone,
  PhoneOff, Plus, Reply, Settings as SettingsIcon, Shield, Trash2, UserCircle2,
  UserPlus, Users, Video, Volume2, VolumeX,
} from 'lucide-react';

// ============================================================
// Registro central de acoes do menu de contexto (botao direito).
// Cada construtor recebe o contexto completo da app (MenuDeps) e
// gera dinamicamente as opcoes de acordo com as permissoes.
// Para adicionar novas acoes, basta criar/editar um construtor aqui.
// ============================================================

export type MenuDeps = ReturnType<typeof useApp>;

export const copyToClipboard = async (deps: MenuDeps, text: string) => {
  try {
    await navigator.clipboard.writeText(text);
    deps.addToast('Copiado para a area de transferencia.', 'success');
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
      deps.addToast('Copiado para a area de transferencia.', 'success');
    } catch {
      deps.addToast('Nao foi possivel copiar.', 'error');
    }
  }
};

const slugify = (name: string) =>
  name.trim().toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '');

// ------------------------------------------------------------------
// Usuario
// ------------------------------------------------------------------
export interface UserMenuOptions {
  serverId: string;
  member: ServerMember;
  voiceChannel?: string | null;
  muted?: boolean;
  deafened?: boolean;
  reopen?: () => void;
}

export const buildUserMenu = (deps: MenuDeps, options: UserMenuOptions): ContextMenuItem[] => {
  const { serverId, member, voiceChannel, muted = false, deafened = false, reopen } = options;
  const myPerms = deps.getMyPermissions(serverId);
  const targetTop = member.roles[0]?.position ?? -1;
  const canManage = myPerms.isOwner || myPerms.topPosition > targetTop;
  const hasPerm = (bit: number) => myPerms.isOwner || hasPermission(myPerms.permissions, bit);
  const isSelf = deps.currentUser.id === member.userId;

  const targetUser: User = {
    ...member.profile,
    role: (member.roles[0]?.name as User['role']) || undefined,
  };

  const roles = deps.serverRoles[serverId] || [];
  const hasRoleIds = new Set(member.roles.map((role) => role.id));
  const manageableRoles = roles.filter((role) => myPerms.isOwner || role.position < myPerms.topPosition);

  const roleToggleItems = (): ContextMenuItem[] => {
    if (manageableRoles.length === 0) return [{ label: 'Nenhum cargo gerenciavel' }];
    return manageableRoles.map((role) => ({
      label: role.name,
      icon: <Shield className="w-4 h-4" style={{ color: role.color }} />,
      checked: hasRoleIds.has(role.id),
      keepOpen: true,
      onClick: async () => {
        const has = hasRoleIds.has(role.id);
        const ok = has
          ? await deps.removeRoleFromMember(serverId, member.userId, role.id)
          : await deps.addRoleToMember(serverId, member.userId, role.id);
        if (ok) reopen?.();
      },
    }));
  };

  const roleAssignSubmenu = (mode: 'promote' | 'demote'): ContextMenuItem[] => {
    const list = mode === 'promote'
      ? manageableRoles.filter((role) => !hasRoleIds.has(role.id) && role.position > targetTop)
      : manageableRoles.filter((role) => hasRoleIds.has(role.id) && role.position > targetTop);
    if (list.length === 0) {
      return [{ label: mode === 'promote' ? 'Nenhum cargo superior' : 'Nenhum cargo acima para remover' }];
    }
    return list.map((role) => ({
      label: role.name,
      icon: <Shield className="w-4 h-4" style={{ color: role.color }} />,
      onClick: () => {
        if (mode === 'promote') void deps.promoteMember(serverId, member.userId, role.id).then(() => reopen?.());
        else void deps.demoteMember(serverId, member.userId, role.id).then(() => reopen?.());
      },
    }));
  };

  const moveSubmenu = (): ContextMenuItem[] => {
    const targets = (deps.servers.find((server) => server.id === serverId)?.channels || [])
      .filter((channel) => channel.type === 'voice' && channel.id !== voiceChannel);
    if (targets.length === 0) return [{ label: 'Nenhum canal de voz disponivel' }];
    return targets.map((channel) => ({
      label: channel.name,
      icon: <MoveRight className="w-4 h-4" />,
      onClick: () => void deps.moveMemberBetweenChannels(serverId, member.userId, voiceChannel!, channel.id).then(() => reopen?.()),
    }));
  };

  const items: ContextMenuItem[] = [
    {
      label: 'Ver perfil',
      icon: <UserCircle2 className="w-4 h-4" />,
      onClick: () => deps.openModal('profile-view', targetUser),
    },
    {
      label: 'Ver informacoes',
      icon: <Info className="w-4 h-4" />,
      onClick: () => deps.openModal('profile-view', targetUser),
    },
  ];

  if (!isSelf) {
    items.push({ divider: true });
    items.push({
      label: 'Mensagem',
      icon: <MessageSquare className="w-4 h-4" />,
      onClick: () => deps.setActiveDmId(member.userId),
    });
    items.push({
      label: 'Chamada',
      icon: <Phone className="w-4 h-4" />,
      submenu: [
        {
          label: 'Chamada de voz',
          icon: <Phone className="w-4 h-4" />,
          onClick: () => deps.startCall('voice', member.userId, member.profile.displayName, false, member.profile.avatar),
        },
        {
          label: 'Chamada de video',
          icon: <Video className="w-4 h-4" />,
          onClick: () => deps.startCall('video', member.userId, member.profile.displayName, false, member.profile.avatar),
        },
      ],
    });
  }

  const canManageRoles = canManage && hasPerm(PERMISSIONS.MANAGE_ROLES);
  if (canManageRoles) {
    items.push({ divider: true });
    items.push({
      label: 'Cargos',
      icon: <Shield className="w-4 h-4" />,
      submenu: roleToggleItems(),
    });
    if (hasPerm(PERMISSIONS.PROMOTE_MEMBERS) || hasPerm(PERMISSIONS.MANAGE_ROLES)) {
      items.push({
        label: 'Promover',
        icon: <ArrowUp className="w-4 h-4" />,
        submenu: roleAssignSubmenu('promote'),
      });
    }
    if (hasPerm(PERMISSIONS.DEMOTE_MEMBERS) || hasPerm(PERMISSIONS.MANAGE_ROLES)) {
      items.push({
        label: 'Rebaixar',
        icon: <ArrowDown className="w-4 h-4" />,
        submenu: roleAssignSubmenu('demote'),
      });
    }
  }

  if (voiceChannel) {
    if (canManage && hasPerm(PERMISSIONS.MUTE_MEMBERS)) {
      items.push({ divider: true });
      items.push({
        label: muted ? 'Desmutar' : 'Mutar',
        icon: muted ? <Mic className="w-4 h-4" /> : <MicOff className="w-4 h-4" />,
        onClick: () => void deps.setMemberMuted(serverId, member.userId, !muted).then(() => reopen?.()),
      });
    }
    if (canManage && hasPerm(PERMISSIONS.DEAFEN_MEMBERS)) {
      items.push({
        label: deafened ? 'Remover surdez' : 'Ensurdecer',
        icon: deafened ? <Volume2 className="w-4 h-4" /> : <VolumeX className="w-4 h-4" />,
        onClick: () => void deps.setMemberDeafened(serverId, member.userId, !deafened).then(() => reopen?.()),
      });
    }
    if (canManage && hasPerm(PERMISSIONS.DISCONNECT_MEMBERS)) {
      items.push({
        label: 'Desconectar da call',
        icon: <PhoneOff className="w-4 h-4" />,
        onClick: () => void deps.disconnectMemberFromCall(serverId, member.userId, voiceChannel).then(() => reopen?.()),
      });
    }
    if (canManage && hasPerm(PERMISSIONS.MOVE_MEMBERS)) {
      items.push({
        label: 'Mover para',
        icon: <MoveRight className="w-4 h-4" />,
        submenu: moveSubmenu(),
      });
    }
  }

  if (canManage && hasPerm(PERMISSIONS.KICK_MEMBERS)) {
    items.push({ divider: true });
    items.push({
      label: 'Remover do grupo',
      icon: <LogOut className="w-4 h-4" />,
      danger: true,
      onClick: () => {
        if (window.confirm(`Remover ${member.profile.displayName} do grupo?`)) void deps.kickMember(serverId, member.userId);
      },
    });
  }
  if (canManage && hasPerm(PERMISSIONS.BAN_MEMBERS)) {
    items.push({
      label: 'Banir',
      icon: <Ban className="w-4 h-4" />,
      danger: true,
      onClick: () => {
        if (window.confirm(`Banir ${member.profile.displayName} do grupo?`)) void deps.banMember(serverId, member.userId);
      },
    });
  }

  items.push({ divider: true });
  items.push({
    label: 'Copiar ID',
    icon: <Copy className="w-4 h-4" />,
    onClick: () => void copyToClipboard(deps, member.userId),
  });

  return items;
};

// ------------------------------------------------------------------
// Cargo
// ------------------------------------------------------------------
export interface RoleMenuOptions {
  server: Server;
  role: ServerRole;
  reopen?: () => void;
}

export const buildRoleMenu = (deps: MenuDeps, options: RoleMenuOptions): ContextMenuItem[] => {
  const { server, role, reopen } = options;
  const myPerms = deps.getMyPermissions(server.id);
  const canManageRoles = myPerms.isOwner || hasPermission(myPerms.permissions, PERMISSIONS.MANAGE_ROLES);
  const canEditRole = canManageRoles && (myPerms.isOwner || role.position < myPerms.topPosition);
  const members = deps.serverMembers[server.id] || [];

  const roleMembers = members.filter((member) => member.roles.some((r) => r.id === role.id));
  const membersWithoutRole = members.filter((member) => !member.roles.some((r) => r.id === role.id));

  const items: ContextMenuItem[] = [];

  if (canEditRole) {
    items.push(
      {
        label: 'Editar cargo',
        icon: <Pencil className="w-4 h-4" />,
        onClick: () => deps.openRoleSettings(server.id, role.id),
      },
      {
        label: 'Alterar nome',
        icon: <Pencil className="w-4 h-4" />,
        onClick: () => {
          const name = window.prompt('Novo nome do cargo:', role.name);
          if (name && name.trim()) void deps.updateRole(server.id, role.id, { name: name.trim() }).then(() => reopen?.());
        },
      },
      {
        label: 'Alterar cor',
        icon: <Palette className="w-4 h-4" />,
        onClick: () => {
          const color = window.prompt('Nova cor em hexadecimal (ex.: #ED4245):', role.color);
          if (color && /^#[0-9a-fA-F]{6}$/.test(color)) void deps.updateRole(server.id, role.id, { color }).then(() => reopen?.());
        },
      },
      {
        label: 'Alterar permissoes',
        icon: <SettingsIcon className="w-4 h-4" />,
        onClick: () => deps.openRoleSettings(server.id, role.id),
      },
    );

    items.push({ divider: true });

    items.push({
      label: 'Adicionar usuario',
      icon: <UserPlus className="w-4 h-4" />,
      submenu: membersWithoutRole.length === 0
        ? [{ label: 'Nenhum membro disponivel' }]
        : membersWithoutRole.map((member) => ({
            label: member.nickname || member.profile.displayName,
            onClick: () => void deps.addRoleToMember(server.id, member.userId, role.id).then(() => reopen?.()),
          })),
    });

    items.push({
      label: 'Remover usuario',
      icon: <LogOut className="w-4 h-4" />,
      submenu: roleMembers.length === 0
        ? [{ label: 'Nenhum membro com este cargo' }]
        : roleMembers.map((member) => ({
            label: member.nickname || member.profile.displayName,
            onClick: () => void deps.removeRoleFromMember(server.id, member.userId, role.id).then(() => reopen?.()),
          })),
    });

    items.push({ divider: true });

    if (canManageRoles) {
      items.push({
        label: 'Criar cargo abaixo',
        icon: <Plus className="w-4 h-4" />,
        onClick: () => {
          const name = window.prompt('Nome do novo cargo:');
          if (name && name.trim()) void deps.createRole(server.id, name.trim(), '#99AAB5', 3328).then(() => reopen?.());
        },
      });
    }
    if (canEditRole) {
      items.push({
        label: 'Duplicar cargo',
        icon: <Copy className="w-4 h-4" />,
        onClick: () => void deps.createRole(server.id, `${role.name} (copia)`, role.color, role.permissions).then(() => reopen?.()),
      });
    }
    items.push({
      label: 'Excluir cargo',
      icon: <Trash2 className="w-4 h-4" />,
      danger: true,
      onClick: () => {
        if (window.confirm(`Excluir o cargo "${role.name}"?`)) void deps.deleteRole(server.id, role.id).then(() => reopen?.());
      },
    });
  }

  items.push({
    label: 'Ver membros',
    icon: <Eye className="w-4 h-4" />,
    submenu: roleMembers.length === 0
      ? [{ label: 'Nenhum membro com este cargo' }]
      : roleMembers.map((member) => ({
          label: member.nickname || member.profile.displayName,
          icon: <Users className="w-4 h-4" />,
        })),
  });

  items.push({ divider: true });
  items.push({
    label: 'Copiar ID',
    icon: <Copy className="w-4 h-4" />,
    onClick: () => void copyToClipboard(deps, role.id),
  });

  return items;
};

// ------------------------------------------------------------------
// Canal
// ------------------------------------------------------------------
export interface ChannelMenuOptions {
  server: Server;
  channel: Channel;
}

export const buildChannelMenu = (deps: MenuDeps, options: ChannelMenuOptions): ContextMenuItem[] => {
  const { server, channel } = options;
  const myPerms = deps.getMyPermissions(server.id);
  const hasPerm = (bit: number) => myPerms.isOwner || hasPermission(myPerms.permissions, bit);
  const canManageChannels = hasPerm(PERMISSIONS.MANAGE_CHANNELS);
  const isVoice = channel.type === 'voice';

  const items: ContextMenuItem[] = [
    {
      label: 'Abrir canal',
      icon: isVoice ? <Volume2 className="w-4 h-4" /> : <Hash className="w-4 h-4" />,
      onClick: () => deps.setActiveChannelId(channel.id),
    },
  ];

  if (isVoice && hasPerm(PERMISSIONS.CONNECT)) {
    items.push({
      label: 'Entrar',
      icon: <Volume2 className="w-4 h-4" />,
      onClick: () => deps.startCall('voice', channel.id, channel.name),
    });
  }

  if (isVoice && (hasPerm(PERMISSIONS.MANAGE_MEMBERS) || hasPerm(PERMISSIONS.MANAGE_CHANNELS))) {
    items.push({
      label: 'Gerenciar membros',
      icon: <Users className="w-4 h-4" />,
      onClick: () => deps.openServerTab(server.id, 'members'),
    });
  }

  if (canManageChannels) {
    items.push({ divider: true });
    items.push({
      label: 'Editar canal',
      icon: <Pencil className="w-4 h-4" />,
      onClick: () => deps.openModal('edit-channel', undefined, channel.id),
    });
    items.push({
      label: 'Alterar nome',
      icon: <Pencil className="w-4 h-4" />,
      onClick: () => {
        const name = window.prompt('Novo nome do canal:', channel.name);
        const clean = name && slugify(name);
        if (clean) void deps.updateChannelRow(channel.id, { name: clean });
      },
    });
    items.push({
      label: 'Alterar descricao',
      icon: <Info className="w-4 h-4" />,
      onClick: () => {
        const description = window.prompt('Nova descricao do canal:', channel.description || '');
        if (description !== null) void deps.updateChannelRow(channel.id, { description: description.trim() || undefined });
      },
    });
    items.push({
      label: 'Permissoes do canal',
      icon: <SettingsIcon className="w-4 h-4" />,
      onClick: () => deps.openModal('edit-channel', undefined, channel.id),
    });
    items.push({ divider: true });
    items.push({
      label: 'Criar canal',
      icon: <Plus className="w-4 h-4" />,
      onClick: () => deps.openModal('create-channel', undefined, { parentId: channel.parentId ?? null }),
    });
    items.push({
      label: 'Duplicar canal',
      icon: <Copy className="w-4 h-4" />,
      onClick: () => deps.addChannel(server.id, channel.name, channel.type, channel.parentId),
    });
    items.push({
      label: 'Criar canal privado',
      icon: <Eye className="w-4 h-4" />,
      onClick: () => deps.openModal('create-channel', undefined, { parentId: channel.parentId ?? null }),
    });
    items.push({ divider: true });
    items.push({
      label: 'Excluir canal',
      icon: <Trash2 className="w-4 h-4" />,
      danger: true,
      onClick: () => {
        if (window.confirm(`Excluir o canal #${channel.name}?`)) deps.deleteChannel(server.id, channel.id);
      },
    });
  }

  items.push({ divider: true });
  items.push({
    label: 'Copiar ID',
    icon: <Copy className="w-4 h-4" />,
    onClick: () => void copyToClipboard(deps, channel.id),
  });

  return items;
};

// ------------------------------------------------------------------
// Categoria
// ------------------------------------------------------------------
export interface CategoryMenuOptions {
  server: Server;
  category: { id: string; name: string };
}

export const buildCategoryMenu = (deps: MenuDeps, options: CategoryMenuOptions): ContextMenuItem[] => {
  const { server, category } = options;
  const myPerms = deps.getMyPermissions(server.id);
  const hasPerm = (bit: number) => myPerms.isOwner || hasPermission(myPerms.permissions, bit);
  const canManageChannels = hasPerm(PERMISSIONS.MANAGE_CHANNELS);

  const items: ContextMenuItem[] = [];

  if (canManageChannels) {
    items.push(
      {
        label: 'Editar categoria',
        icon: <Pencil className="w-4 h-4" />,
        onClick: () => deps.openServerTab(server.id, 'channels'),
      },
      {
        label: 'Alterar nome',
        icon: <Pencil className="w-4 h-4" />,
        onClick: () => {
          const name = window.prompt('Novo nome da categoria:', category.name);
          if (name && name.trim()) void deps.updateChannelRow(category.id, { name: name.trim() });
        },
      },
    );
    items.push({ divider: true });
    items.push(
      {
        label: 'Criar canal',
        icon: <Hash className="w-4 h-4" />,
        onClick: () => deps.openModal('create-channel', undefined, { parentId: category.id, type: 'text' }),
      },
      {
        label: 'Criar canal de voz',
        icon: <Volume2 className="w-4 h-4" />,
        onClick: () => deps.openModal('create-channel', undefined, { parentId: category.id, type: 'voice' }),
      },
      {
        label: 'Criar canal privado',
        icon: <Eye className="w-4 h-4" />,
        onClick: () => deps.openModal('create-channel', undefined, { parentId: category.id }),
      },
    );
    items.push({ divider: true });
    items.push({
      label: 'Excluir categoria',
      icon: <Trash2 className="w-4 h-4" />,
      danger: true,
      onClick: () => {
        if (window.confirm(`Excluir a categoria "${category.name}"? Os canais dela serao movidos para "Sem categoria".`)) {
          deps.deleteChannel(server.id, category.id);
        }
      },
    });
  }

  items.push({ divider: true });
  items.push({
    label: 'Copiar ID',
    icon: <Copy className="w-4 h-4" />,
    onClick: () => void copyToClipboard(deps, category.id),
  });

  return items;
};

// ------------------------------------------------------------------
// Mensagem
// ------------------------------------------------------------------
export interface MessageMenuOptions {
  message: Message;
  author: User;
  isDM: boolean;
  canManageMessages: boolean;
  onReply: (message: Message) => void;
}

export const buildMessageMenu = (deps: MenuDeps, options: MessageMenuOptions): ContextMenuItem[] => {
  const { message, author, isDM, canManageMessages, onReply } = options;
  const isOwn = deps.currentUser.id === message.userId;

  const items: ContextMenuItem[] = [
    {
      label: 'Responder',
      icon: <Reply className="w-4 h-4" />,
      onClick: () => onReply(message),
    },
  ];

  if (isOwn) {
    items.push({ divider: true });
    items.push({
      label: 'Editar',
      icon: <Pencil className="w-4 h-4" />,
      onClick: () => {
        const text = window.prompt('Editar mensagem:', message.content);
        if (text !== null && text.trim()) void deps.editMessage(message.id, text.trim());
      },
    });
  }

  if (isOwn || (!isDM && canManageMessages)) {
    items.push({
      label: 'Excluir',
      icon: <Trash2 className="w-4 h-4" />,
      danger: true,
      onClick: () => {
        if (window.confirm('Excluir esta mensagem?')) void deps.deleteMessage(message.id);
      },
    });
  }

  items.push({ divider: true });
  items.push(
    {
      label: 'Copiar conteudo',
      icon: <Copy className="w-4 h-4" />,
      onClick: () => void copyToClipboard(deps, message.content),
    },
    {
      label: 'Copiar ID',
      icon: <Copy className="w-4 h-4" />,
      onClick: () => void copyToClipboard(deps, message.id),
    },
  );

  items.push({ divider: true });
  items.push(
    {
      label: 'Ver perfil',
      icon: <UserCircle2 className="w-4 h-4" />,
      onClick: () => deps.openModal('profile-view', author),
    },
    {
      label: 'Denunciar',
      icon: <Flag className="w-4 h-4" />,
      onClick: () => deps.addToast('Denuncia registrada. Obrigado pelo aviso.', 'info'),
    },
  );

  return items;
};

// ------------------------------------------------------------------
// Grupo (servidor)
// ------------------------------------------------------------------
export interface ServerMenuOptions {
  server: Server;
}

export const buildServerMenu = (deps: MenuDeps, options: ServerMenuOptions): ContextMenuItem[] => {
  const { server } = options;
  const myPerms = deps.getMyPermissions(server.id);
  const isOwner = server.ownerId === deps.currentUser.id;
  const hasPerm = (bit: number) => isOwner || hasPermission(myPerms.permissions, bit);

  const items: ContextMenuItem[] = [
    {
      label: 'Abrir grupo',
      icon: <DoorOpen className="w-4 h-4" />,
      onClick: () => deps.setActiveServerId(server.id),
    },
    { divider: true },
    {
      label: 'Convidar pessoas',
      icon: <UserPlus className="w-4 h-4" />,
      onClick: () => void deps.createServerInvite(server.id),
    },
    {
      label: 'Configuracoes do grupo',
      icon: <SettingsIcon className="w-4 h-4" />,
      onClick: () => deps.openSettings('Servidores', server.id),
    },
    {
      label: 'Ver membros',
      icon: <Users className="w-4 h-4" />,
      onClick: () => deps.openServerTab(server.id, 'members'),
    },
  ];

  if (hasPerm(PERMISSIONS.MANAGE_ROLES)) {
    items.push(
      {
        label: 'Criar cargo',
        icon: <Plus className="w-4 h-4" />,
        onClick: () => {
          const name = window.prompt('Nome do novo cargo:');
          if (name && name.trim()) void deps.createRole(server.id, name.trim(), '#99AAB5', 3328);
        },
      },
      {
        label: 'Gerenciar cargos',
        icon: <Shield className="w-4 h-4" />,
        onClick: () => deps.openServerTab(server.id, 'roles'),
      },
    );
  }

  if (isOwner || hasPerm(PERMISSIONS.VIEW_AUDIT_LOG) || hasPerm(PERMISSIONS.MANAGE_SERVER)) {
    items.push({
      label: 'Ver logs',
      icon: <ClipboardList className="w-4 h-4" />,
      onClick: () => deps.openServerTab(server.id, 'logs'),
    });
  }

  items.push({ divider: true });
  items.push({
    label: isOwner ? 'Excluir grupo' : 'Sair do grupo',
    icon: <LogOut className="w-4 h-4" />,
    danger: true,
    onClick: () => {
      if (window.confirm(isOwner ? `Excluir permanentemente o grupo "${server.name}"?` : `Sair do grupo "${server.name}"?`)) {
        deps.deleteServer(server.id);
      }
    },
  });
  items.push({ divider: true });
  items.push({
    label: 'Copiar ID',
    icon: <Copy className="w-4 h-4" />,
    onClick: () => void copyToClipboard(deps, server.id),
  });

  return items;
};

// ------------------------------------------------------------------
// DM
// ------------------------------------------------------------------
export interface DmMenuOptions {
  dm: DirectMessage;
}

export const buildDmMenu = (deps: MenuDeps, options: DmMenuOptions): ContextMenuItem[] => {
  const { dm } = options;
  const user = dm.user;

  return [
    {
      label: 'Abrir conversa',
      icon: <MessageSquare className="w-4 h-4" />,
      onClick: () => deps.setActiveDmId(dm.id),
    },
    {
      label: 'Ver perfil',
      icon: <UserCircle2 className="w-4 h-4" />,
      onClick: () => deps.openModal('profile-view', user),
    },
    { divider: true },
    {
      label: 'Chamada de voz',
      icon: <Phone className="w-4 h-4" />,
      onClick: () => deps.startCall('voice', dm.id, user.displayName, false, user.avatar),
    },
    {
      label: 'Chamada de video',
      icon: <Video className="w-4 h-4" />,
      onClick: () => deps.startCall('video', dm.id, user.displayName, false, user.avatar),
    },
    { divider: true },
    {
      label: 'Bloquear',
      icon: <Ban className="w-4 h-4" />,
      danger: true,
      onClick: () => {
        if (window.confirm(`Bloquear ${user.displayName}?`)) void deps.blockUser(user.id);
      },
    },
    {
      label: 'Copiar ID',
      icon: <Copy className="w-4 h-4" />,
      onClick: () => void copyToClipboard(deps, user.id),
    },
  ];
};