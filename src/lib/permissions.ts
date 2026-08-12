// ============================================================
// Permissões (bitmask) — espelha migrations/002 e /016
// ============================================================

export const PERMISSIONS = {
  ADMINISTRATOR: 1 << 0,
  MANAGE_SERVER: 1 << 1,
  MANAGE_CHANNELS: 1 << 2,
  MANAGE_ROLES: 1 << 3,
  MANAGE_MESSAGES: 1 << 4,
  KICK_MEMBERS: 1 << 5,
  BAN_MEMBERS: 1 << 6,
  CREATE_INVITES: 1 << 7,
  VIEW_CHANNELS: 1 << 8,
  SEND_MESSAGES: 1 << 9,
  CONNECT: 1 << 10,
  SPEAK: 1 << 11,
  VIDEO: 1 << 12,
  SCREEN_SHARE: 1 << 13,
  MANAGE_MEMBERS: 1 << 14,
  PROMOTE_MEMBERS: 1 << 15,
  DEMOTE_MEMBERS: 1 << 16,
  DISCONNECT_MEMBERS: 1 << 17,
  MOVE_MEMBERS: 1 << 18,
  MANAGE_PRIVATE_CHANNELS: 1 << 19,
  MUTE_MEMBERS: 1 << 20,
  DEAFEN_MEMBERS: 1 << 21,
  VIEW_AUDIT_LOG: 1 << 22,
} as const;

export type PermissionKey = keyof typeof PERMISSIONS;

export interface PermissionInfo {
  key: PermissionKey;
  bit: number;
  label: string;
  description: string;
}

export const ALL_PERMISSIONS: PermissionInfo[] = [
  { key: 'ADMINISTRATOR', bit: PERMISSIONS.ADMINISTRATOR, label: 'Administrador', description: 'Ignora todas as permissões abaixo (cargo supremo).' },
  { key: 'MANAGE_SERVER', bit: PERMISSIONS.MANAGE_SERVER, label: 'Gerenciar grupo', description: 'Editar nome, descrição, ícone e configurações do grupo.' },
  { key: 'MANAGE_CHANNELS', bit: PERMISSIONS.MANAGE_CHANNELS, label: 'Gerenciar canais', description: 'Criar, renomear e remover canais.' },
  { key: 'MANAGE_ROLES', bit: PERMISSIONS.MANAGE_ROLES, label: 'Gerenciar cargos', description: 'Criar, editar, excluir cargos e atribuí-los a membros.' },
  { key: 'MANAGE_MESSAGES', bit: PERMISSIONS.MANAGE_MESSAGES, label: 'Gerenciar mensagens', description: 'Excluir mensagens de outros membros.' },
  { key: 'KICK_MEMBERS', bit: PERMISSIONS.KICK_MEMBERS, label: 'Expulsar membros', description: 'Remover membros do grupo.' },
  { key: 'BAN_MEMBERS', bit: PERMISSIONS.BAN_MEMBERS, label: 'Banir membros', description: 'Banir membros permanentemente do grupo.' },
  { key: 'CREATE_INVITES', bit: PERMISSIONS.CREATE_INVITES, label: 'Criar convites', description: 'Criar links de convite para o grupo.' },
  { key: 'VIEW_CHANNELS', bit: PERMISSIONS.VIEW_CHANNELS, label: 'Ver canais', description: 'Visualizar canais do grupo.' },
  { key: 'SEND_MESSAGES', bit: PERMISSIONS.SEND_MESSAGES, label: 'Enviar mensagens', description: 'Enviar mensagens em canais de texto.' },
  { key: 'CONNECT', bit: PERMISSIONS.CONNECT, label: 'Conectar (voz)', description: 'Entrar em canais de voz.' },
  { key: 'SPEAK', bit: PERMISSIONS.SPEAK, label: 'Falar (voz)', description: 'Falar em canais de voz.' },
  { key: 'VIDEO', bit: PERMISSIONS.VIDEO, label: 'Video', description: 'Ativar a câmera em chamadas.' },
  { key: 'SCREEN_SHARE', bit: PERMISSIONS.SCREEN_SHARE, label: 'Compartilhar tela', description: 'Compartilhar a tela em chamadas.' },
  { key: 'MANAGE_MEMBERS', bit: PERMISSIONS.MANAGE_MEMBERS, label: 'Gerenciar membros', description: 'Adicionar/remover membros, aplicar timeout e gerenciar membros básicos.' },
  { key: 'PROMOTE_MEMBERS', bit: PERMISSIONS.PROMOTE_MEMBERS, label: 'Promover membros', description: 'Atribuir cargos superiores aos membros.' },
  { key: 'DEMOTE_MEMBERS', bit: PERMISSIONS.DEMOTE_MEMBERS, label: 'Rebaixar membros', description: 'Remover cargos superiores dos membros.' },
  { key: 'DISCONNECT_MEMBERS', bit: PERMISSIONS.DISCONNECT_MEMBERS, label: 'Desconectar da call', description: 'Desconectar membros de canais de voz.' },
  { key: 'MOVE_MEMBERS', bit: PERMISSIONS.MOVE_MEMBERS, label: 'Mover de call', description: 'Mover membros entre canais de voz.' },
  { key: 'MANAGE_PRIVATE_CHANNELS', bit: PERMISSIONS.MANAGE_PRIVATE_CHANNELS, label: 'Gerenciar canais privados', description: 'Configurar visibilidade de canais por cargo.' },
  { key: 'MUTE_MEMBERS', bit: PERMISSIONS.MUTE_MEMBERS, label: 'Mutar membros', description: 'Silenciar o microfone de membros na call.' },
  { key: 'DEAFEN_MEMBERS', bit: PERMISSIONS.DEAFEN_MEMBERS, label: 'Ensurdear membros', description: 'Ensurdear membros na call (som e micro).' },
  { key: 'VIEW_AUDIT_LOG', bit: PERMISSIONS.VIEW_AUDIT_LOG, label: 'Ver logs', description: 'Visualizar os logs de ações do grupo.' },
];

export const ADMIN_BITMASK = 2147483647;

export function hasPermission(permissions: number, bit: number): boolean {
  return (permissions & bit) === bit;
}

export function combinePermissions(...permissions: number[]): number {
  return permissions.reduce((acc, value) => acc | value, 0);
}

export function canManageRole(myTopPosition: number, rolePosition: number): boolean {
  return myTopPosition === 2147483647 || myTopPosition > rolePosition;
}

export function canManageMember(myTopPosition: number, targetTopPosition: number): boolean {
  return myTopPosition === 2147483647 || myTopPosition > targetTopPosition;
}

export function getRoleTopPosition(positions: number[]): number {
  return positions.length === 0 ? -1 : Math.max(...positions);
}