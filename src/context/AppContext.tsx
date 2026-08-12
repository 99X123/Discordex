import React, { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import type { RealtimeChannel } from '@supabase/supabase-js';
import { supabase } from '../lib/supabase';
import { createChannel as createChannelRecord } from '../services/channels';
import { createServer, createServerInvite as createServerInviteRecord, deleteServer as deleteServerRecord, extractInviteCode, getMyServers, joinServerViaInvite, leaveServer, updateServer as updateServerRecord } from '../services/servers';
import { getMyProfile, updateProfile } from '../services/profiles';
import { getServerMembersWithRoles, type ServerMemberWithProfile } from '../services/members';
import {
  addRoleToMember as addRoleToMemberRpc,
  banMember as banMemberRpc,
  createRole as createRoleRpc,
  deleteRole as deleteRoleRpc,
  demoteMember as demoteMemberRpc,
  disconnectMember as disconnectMemberRpc,
  getChannelRolePermissions,
  getServerRoles,
  kickMember as kickMemberRpc,
  moveMember as moveMemberRpc,
  promoteMember as promoteMemberRpc,
  removeChannelRolePermission as removeChannelRolePermissionRpc,
  removeRoleFromMember as removeRoleFromMemberRpc,
  setChannelRolePermission as setChannelRolePermissionRpc,
  setMemberDeafened as setMemberDeafenedRpc,
  setMemberMuted as setMemberMutedRpc,
  updateRole as updateRoleRpc,
} from '../services/roles';
import { VoiceCallEngine, type CallParticipantInfo } from '../lib/webrtcCall';
import { applyNoiseSuppression } from '../lib/noiseGate';
import { playJoinSound, playLeaveSound, playPopSound, playRingTone, stopRingTone } from '../lib/sounds';
import type { Database } from '../lib/database.types';

type ProfileRow = Database['public']['Tables']['profiles']['Row'];
type ServerRow = Database['public']['Tables']['servers']['Row'];
type ChannelRow = Database['public']['Tables']['channels']['Row'];
type MessageRow = Database['public']['Tables']['messages']['Row'];
type DirectMessageRow = Database['public']['Tables']['direct_messages']['Row'];
type ReactionRow = Database['public']['Tables']['message_reactions']['Row'];

export interface User {
  id: string;
  username: string;
  displayName: string;
  avatar: string;
  status: 'online' | 'offline' | 'idle' | 'dnd';
  customStatus?: string;
  role?: 'Administrador' | 'Moderador' | 'Membro';
  bio?: string;
  joinedDate?: string;
  friendshipId?: string;
}

export interface Reaction {
  emoji: string;
  count: number;
  userReacted: boolean;
}

export interface Message {
  id: string;
  userId: string;
  userName: string;
  userAvatar: string;
  userRole?: 'Administrador' | 'Moderador' | 'Membro' | string;
  userRoleColor?: string;
  content: string;
  timestamp: string;
  reactions: Reaction[];
  replyTo?: {
    userName: string;
    content: string;
  };
}

export interface ChannelCategory {
  id: string;
  name: string;
  position: number;
}

export interface Channel {
  id: string;
  name: string;
  type: 'text' | 'voice';
  parentId: string | null;
  description?: string;
}

export interface Server {
  id: string;
  name: string;
  icon: string;
  iconUrl?: string;
  description?: string;
  ownerId?: string;
  unreadCount?: number;
  hasNotification?: boolean;
  channels: Channel[];
  categories: ChannelCategory[];
}

export interface ServerMember {
  id: string;
  userId: string;
  nickname: string | null;
  joinedAt: string;
  profile: User;
  roles: { id: string; name: string; color: string; position: number; permissions: number }[];
}

export interface ServerRole {
  id: string;
  server_id: string;
  name: string;
  color: string;
  position: number;
  permissions: number;
  created_at: string;
}

export interface ChannelRolePerm {
  id: string;
  channel_id: string;
  role_id: string;
  can_view: boolean;
  can_send: boolean;
}

export interface MyPermissions {
  permissions: number;
  isOwner: boolean;
  topPosition: number;
}

export interface CallState {
  isActive: boolean;
  type: 'voice' | 'video';
  channelId: string | null;
  channelName: string | null;
  targetAvatar?: string;
  isMuted: boolean;
  isCameraOn: boolean;
  isScreenSharing: boolean;
  isSpeakerMuted: boolean;
  ringing: boolean;
  participants: {
    id: string;
    name: string;
    avatar: string;
    isSpeaking: boolean;
    isMuted: boolean;
    isCameraOn: boolean;
    isScreenSharing: boolean;
  }[];
  localStream?: MediaStream | null;
  screenStream?: MediaStream | null;
  remoteStreams?: Record<string, MediaStream>;
  remoteScreenStreams?: Record<string, MediaStream>;
}

export interface DirectMessage {
  id: string;
  user: User;
  unreadCount: number;
}

interface AppContextType {
  currentUser: User;
  servers: Server[];
  activeServerId: string | null;
  activeChannelId: string | null;
  activeDmId: string | null;
  messages: { [channelIdOrDmId: string]: Message[] };
  dms: DirectMessage[];
  friends: User[];
  pendingRequests: User[];
  callState: CallState;
  connectionState: 'online' | 'connecting' | 'reconnecting' | 'offline';
  isSettingsOpen: boolean;
  settingsTab: string;
  activeServerSettingsId: string | null;
  activeModal: 'create-server' | 'join-server' | 'create-channel' | 'create-category' | 'create-role' | 'ban-user' | 'kick-user' | 'profile-view' | 'edit-channel' | null;
  selectedProfileUser: User | null;
  modalPayload: unknown;
  serverSettingsTab: string;
  serverSettingsRoleId: string | null;
  incomingCall: { id: string; caller: User; type: 'voice' | 'video' } | null;
  toasts: { id: string; message: string; type: 'success' | 'error' | 'info' }[];
  isAppAdmin: boolean;
  serverMembers: Record<string, ServerMember[]>;
  voiceCounts: Record<string, number>;
  serverRoles: Record<string, ServerRole[]>;
  serverChannelPerms: Record<string, ChannelRolePerm[]>;
  getMyPermissions: (serverId: string) => MyPermissions;
  canManageUser: (serverId: string, targetTopPosition: number) => boolean;
  createRole: (serverId: string, name: string, color: string, permissions: number) => Promise<boolean>;
  updateRole: (serverId: string, roleId: string, updates: { name?: string; color?: string; permissions?: number; position?: number }) => Promise<boolean>;
  deleteRole: (serverId: string, roleId: string) => Promise<boolean>;
  addRoleToMember: (serverId: string, targetId: string, roleId: string) => Promise<boolean>;
  removeRoleFromMember: (serverId: string, targetId: string, roleId: string) => Promise<boolean>;
  promoteMember: (serverId: string, targetId: string, roleId: string) => Promise<boolean>;
  demoteMember: (serverId: string, targetId: string, roleId: string) => Promise<boolean>;
  kickMember: (serverId: string, targetId: string) => Promise<boolean>;
  banMember: (serverId: string, targetId: string) => Promise<boolean>;
  disconnectMemberFromCall: (serverId: string, targetId: string, channelId: string) => Promise<boolean>;
  moveMemberBetweenChannels: (serverId: string, targetId: string, fromChannelId: string, toChannelId: string) => Promise<boolean>;
  setMemberMuted: (serverId: string, targetId: string, muted: boolean) => Promise<boolean>;
  setMemberDeafened: (serverId: string, targetId: string, deafened: boolean) => Promise<boolean>;
  setChannelRolePermission: (channelId: string, roleId: string, canView: boolean, canSend: boolean) => Promise<boolean>;
  removeChannelRolePermission: (channelId: string, roleId: string) => Promise<boolean>;
  addServer: (name: string) => void;
  joinServer: (inviteCode: string) => void;
  createServerInvite: (serverId: string) => Promise<void>;
  deleteServer: (serverId: string) => void;
  refreshServers: () => Promise<void>;
  updateServerConfig: (serverId: string, updates: { name?: string; description?: string; icon_url?: string }) => Promise<void>;
  addChannel: (serverId: string, name: string, type: 'text' | 'voice', parentId?: string | null) => void;
  addCategory: (serverId: string, name: string) => void;
  deleteChannel: (serverId: string, channelId: string) => void;
  updateChannelRow: (channelId: string, updates: { name?: string; description?: string; parent_id?: string | null }) => Promise<boolean>;
  editMessage: (messageId: string, newContent: string) => Promise<void>;
  deleteMessage: (messageId: string) => Promise<void>;
  blockUser: (userId: string) => Promise<void>;
  sendMessage: (content: string, replyTo?: { userName: string; content: string }) => void;
  toggleReaction: (messageId: string, emoji: string) => void;
  startCall: (type: 'voice' | 'video', channelId: string, channelName: string, silent?: boolean, targetAvatar?: string) => void;
  endCall: () => void;
  answerCall: () => void;
  declineCall: () => void;
  toggleMute: () => void;
  toggleCamera: () => void;
  toggleScreenShare: () => void;
  toggleSpeakerMute: () => void;
  setActiveServerId: (id: string | null) => void;
  setActiveChannelId: (id: string | null) => void;
  setActiveDmId: (id: string | null) => void;
  openSettings: (tab?: string, serverId?: string | null) => void;
  openServerTab: (serverId: string, tab: string) => void;
  openRoleSettings: (serverId: string, roleId: string) => void;
  closeSettings: () => void;
  openModal: (modal: AppContextType['activeModal'], user?: User, payload?: unknown) => void;
  closeModal: () => void;
  addToast: (message: string, type?: 'success' | 'error' | 'info') => void;
  removeToast: (id: string) => void;
  updateCurrentUserProfile: (displayName: string, bio: string, status: User['status'], avatarUrl?: string, username?: string) => void;
  triggerConnectionChange: (state: AppContextType['connectionState']) => void;
  sendFriendRequest: (username: string) => void;
  respondFriendRequest: (friendshipId: string, status: 'accepted' | 'declined') => void;
}

const AppContext = createContext<AppContextType | undefined>(undefined);

const fallbackAvatar = (name: string) =>
  `https://ui-avatars.com/api/?background=ED4245&color=fff&bold=true&name=${encodeURIComponent(name || 'DX')}`;

const toUser = (profile: ProfileRow, role?: User['role']): User => ({
  id: profile.id,
  username: profile.username,
  displayName: profile.display_name,
  avatar: profile.avatar_url || fallbackAvatar(profile.display_name || profile.username),
  status: profile.status,
  role,
  bio: profile.bio || undefined,
  joinedDate: new Date(profile.created_at).toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' }),
});

const formatTime = (value: string) =>
  new Date(value).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });

const roleFromServer = (server: ServerRow, userId: string): User['role'] =>
  server.owner_id === userId ? 'Administrador' : 'Membro';

const emptyCallState: CallState = {
  isActive: false,
  type: 'voice',
  channelId: null,
  channelName: null,
  targetAvatar: undefined,
  isMuted: false,
  isCameraOn: false,
  isScreenSharing: false,
  isSpeakerMuted: false,
  ringing: false,
  participants: [],
  localStream: null,
  screenStream: null,
  remoteStreams: {},
  remoteScreenStreams: {},
};

interface RingRow {
  id: string;
  caller_id: string;
  callee_id: string;
  call_room: string;
  type: 'voice' | 'video';
  status: 'ringing' | 'accepted' | 'declined';
  created_at: string;
}

export const AppProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [servers, setServers] = useState<Server[]>([]);
  const [serverRows, setServerRows] = useState<ServerRow[]>([]);
  const [activeServerId, setActiveServerIdState] = useState<string | null>(null);
  const [activeChannelId, setActiveChannelId] = useState<string | null>(null);
  const [activeDmId, setActiveDmIdState] = useState<string | null>(null);
  const [messages, setMessages] = useState<{ [channelIdOrDmId: string]: Message[] }>({});
  const [dms, setDms] = useState<DirectMessage[]>([]);
  const [friends, setFriends] = useState<User[]>([]);
  const [pendingRequests, setPendingRequests] = useState<User[]>([]);
  const [connectionState, setConnectionState] = useState<AppContextType['connectionState']>('connecting');
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [settingsTab, setSettingsTab] = useState('Minha conta');
  const [activeServerSettingsId, setActiveServerSettingsId] = useState<string | null>(null);
  const [activeModal, setActiveModal] = useState<AppContextType['activeModal']>(null);
  const [selectedProfileUser, setSelectedProfileUser] = useState<User | null>(null);
  const [modalPayload, setModalPayload] = useState<unknown>(null);
  const [serverSettingsTab, setServerSettingsTab] = useState('overview');
  const [serverSettingsRoleId, setServerSettingsRoleId] = useState<string | null>(null);
  const [incomingCall, setIncomingCall] = useState<AppContextType['incomingCall']>(null);
  const [toasts, setToasts] = useState<AppContextType['toasts']>([]);
  const [callState, setCallState] = useState<CallState>(emptyCallState);
  const [isAppAdmin, setIsAppAdmin] = useState(false);
  const [serverMembers, setServerMembers] = useState<Record<string, ServerMember[]>>({});
  const [voiceCounts, setVoiceCounts] = useState<Record<string, number>>({});
  const [serverRoles, setServerRoles] = useState<Record<string, ServerRole[]>>({});
  const [serverChannelPerms, setServerChannelPerms] = useState<Record<string, ChannelRolePerm[]>>({});
  const engineRef = useRef<VoiceCallEngine | null>(null);
  const screenStreamRef = useRef<MediaStream | null>(null);
  const callTypeRef = useRef<'server' | 'dm' | null>(null);
  const callStateRef = useRef<CallState>(emptyCallState);
  const callActiveRef = useRef(false);
  const callerRingChannelRef = useRef<RealtimeChannel | null>(null);
  const callerRingIdRef = useRef<string | null>(null);
  const ringTimeoutRef = useRef<number | null>(null);
  const remoteLeaveTimerRef = useRef<number | null>(null);
  const ringDismissTimerRef = useRef<number | null>(null);

  const activeServer = useMemo(() => serverRows.find((server) => server.id === activeServerId), [serverRows, activeServerId]);

  const addToast = (message: string, type: 'success' | 'error' | 'info' = 'success') => {
    const id = crypto.randomUUID();
    setToasts((prev) => [...prev, { id, message, type }]);
    setTimeout(() => removeToast(id), 4000);
  };

  const removeToast = (id: string) => {
    setToasts((prev) => prev.filter((toast) => toast.id !== id));
  };

  const loadServers = async () => {
    const rows = await getMyServers();
    setServerRows(rows);

    const hydrated = await Promise.all(rows.map(async (server) => {
      const { data: channelRows } = await supabase
        .from('channels')
        .select('*')
        .eq('server_id', server.id)
        .order('position');

      const categories = new Map<string, { id: string; name: string; position: number }>();
      (channelRows || []).forEach((channel) => {
        if (channel.type === 'category') categories.set(channel.id, { id: channel.id, name: channel.name, position: channel.position });
      });

      const channels = (channelRows || [])
        .filter((channel): channel is ChannelRow & { type: 'text' | 'voice' } => channel.type === 'text' || channel.type === 'voice')
        .map((channel) => ({
          id: channel.id,
          name: channel.name,
          type: channel.type,
          parentId: channel.parent_id,
          description: channel.description || undefined,
        }));

      const catList: ChannelCategory[] = (channelRows || [])
        .filter((channel): channel is ChannelRow & { type: 'category' } => channel.type === 'category')
        .map((channel) => ({ id: channel.id, name: channel.name, position: channel.position }))
        .sort((a, b) => a.position - b.position);

      return {
        id: server.id,
        name: server.name,
        icon: server.name.slice(0, 2).toUpperCase(),
        iconUrl: server.icon_url || undefined,
        description: server.description || undefined,
        ownerId: server.owner_id,
        channels,
        categories: catList,
      };
    }));

    setServers(hydrated);
    if (!activeServerId && hydrated[0]) {
      setActiveServerIdState(hydrated[0].id);
      setActiveChannelId(hydrated[0].channels.find((channel) => channel.type === 'text')?.id || hydrated[0].channels[0]?.id || null);
    }
  };

  const loadFriendsAndDms = async () => {
    const { data: authData } = await supabase.auth.getUser();
    const userId = authData.user?.id;
    if (!userId) return;

    const { data: friendshipRows } = await supabase
      .from('friendships')
      .select('id, requester_id, receiver_id, status')
      .or(`requester_id.eq.${userId},receiver_id.eq.${userId}`);

    const acceptedIds = (friendshipRows || [])
      .filter((row) => row.status === 'accepted')
      .map((row) => row.requester_id === userId ? row.receiver_id : row.requester_id);

    const pendingIds = (friendshipRows || [])
      .filter((row) => row.status === 'pending' && row.receiver_id === userId)
      .map((row) => row.requester_id);

    const allIds = [...new Set([...acceptedIds, ...pendingIds])];
    const { data: profiles } = allIds.length
      ? await supabase.from('profiles').select('*').in('id', allIds)
      : { data: [] as ProfileRow[] };

    const profileMap = new Map((profiles || []).map((profile) => [profile.id, profile]));
    setFriends(acceptedIds.map((id) => profileMap.get(id)).filter(Boolean).map((profile) => toUser(profile as ProfileRow)));
    setPendingRequests(pendingIds.map((id) => {
      const profile = profileMap.get(id);
      const friendship = (friendshipRows || []).find((row) => row.requester_id === id && row.receiver_id === userId && row.status === 'pending');
      return profile ? { ...toUser(profile), friendshipId: friendship?.id } : null;
    }).filter(Boolean) as User[]);

    const { data: dmChannels } = await supabase
      .from('direct_message_channels')
      .select('*')
      .or(`user1_id.eq.${userId},user2_id.eq.${userId}`)
      .order('created_at', { ascending: false });

    const dmUserIds = [...new Set((dmChannels || []).map((channel) => channel.user1_id === userId ? channel.user2_id : channel.user1_id))];
    const { data: dmProfiles } = dmUserIds.length
      ? await supabase.from('profiles').select('*').in('id', dmUserIds)
      : { data: [] as ProfileRow[] };

    const dmProfileMap = new Map((dmProfiles || []).map((profile) => [profile.id, profile]));
    setDms(dmUserIds.map((id) => dmProfileMap.get(id)).filter(Boolean).map((profile) => ({
      id: (profile as ProfileRow).id,
      user: toUser(profile as ProfileRow),
      unreadCount: 0,
    })));
  };

  const loadCurrentUser = async () => {
    const profile = await getMyProfile();
    if (!profile) return;
    setCurrentUser(toUser(profile, 'Membro'));
    await supabase.from('profiles').update({ status: 'online' }).eq('id', profile.id);
    const { data: adminFlag } = await supabase.rpc('is_app_admin', {});
    setIsAppAdmin(Boolean(adminFlag));
    setConnectionState('online');
  };

  const getProfileUser = async (userId: string): Promise<User | null> => {
    const { data } = await supabase.from('profiles').select('*').eq('id', userId).maybeSingle();
    return data ? toUser(data) : null;
  };

  useEffect(() => {
    void loadCurrentUser();
    void loadServers();
    void loadFriendsAndDms();
  }, []);

  const loadServerMembers = async (serverId: string) => {
    const rows = await getServerMembersWithRoles(serverId);
    const mapped: ServerMember[] = rows.map((member: ServerMemberWithProfile) => ({
      id: member.id,
      userId: member.user_id,
      nickname: member.nickname,
      joinedAt: member.joined_at,
      profile: toUser(member.profile),
      roles: member.roles,
    }));
    setServerMembers((prev) => ({ ...prev, [serverId]: mapped }));
  };

  const loadServerRoles = async (serverId: string) => {
    const [roles, perms] = await Promise.all([
      getServerRoles(serverId),
      getChannelRolePermissions(serverId),
    ]);
    setServerRoles((prev) => ({ ...prev, [serverId]: roles }));
    setServerChannelPerms((prev) => ({ ...prev, [serverId]: perms }));
  };

  useEffect(() => {
    if (activeServerId) void loadServerRoles(activeServerId);
  }, [activeServerId]);

  const getMyPermissions = useCallback((serverId: string): MyPermissions => {
    const server = serverRows.find((row) => row.id === serverId);
    const isOwner = Boolean(server && currentUser && server.owner_id === currentUser.id);
    const me = (serverMembers[serverId] || []).find((member) => member.userId === currentUser?.id);
    let permissions = 0;
    let topPosition = -1;
    (me?.roles || []).forEach((role) => {
      permissions |= role.permissions;
      if (role.position > topPosition) topPosition = role.position;
    });
    if (isOwner) topPosition = 2147483647;
    return { permissions, isOwner, topPosition };
  }, [serverRows, serverMembers, currentUser]);

  const canManageUser = useCallback((serverId: string, targetTopPosition: number) => {
    const { isOwner, topPosition } = getMyPermissions(serverId);
    return isOwner || topPosition > targetTopPosition;
  }, [getMyPermissions]);

  const refreshServerRolesAndMembers = async (serverId?: string) => {
    const target = serverId || activeServerId;
    if (!target) return;
    await Promise.all([loadServerMembers(target), loadServerRoles(target)]);
  };

  const runAction = async (
    action: () => Promise<{ success: boolean; error?: string }>,
    successMessage: string
  ): Promise<boolean> => {
    const result = await action();
    if (!result.success) {
      addToast(result.error || 'Ação não concluída.', 'error');
      return false;
    }
    addToast(successMessage, 'success');
    await refreshServerRolesAndMembers();
    return true;
  };

  const createRole = (serverId: string, name: string, color: string, permissions: number) =>
    runAction(() => createRoleRpc(serverId, name, color, permissions), `Cargo "${name}" criado.`);

  const updateRole = (serverId: string, roleId: string, updates: { name?: string; color?: string; permissions?: number; position?: number }) =>
    runAction(() => updateRoleRpc(serverId, roleId, updates), 'Cargo atualizado.');

  const deleteRole = (serverId: string, roleId: string) =>
    runAction(() => deleteRoleRpc(serverId, roleId), 'Cargo removido.');

  const addRoleToMember = (serverId: string, targetId: string, roleId: string) =>
    runAction(() => addRoleToMemberRpc(serverId, targetId, roleId), 'Cargo adicionado ao membro.');

  const removeRoleFromMember = (serverId: string, targetId: string, roleId: string) =>
    runAction(() => removeRoleFromMemberRpc(serverId, targetId, roleId), 'Cargo removido do membro.');

  const promoteMember = (serverId: string, targetId: string, roleId: string) =>
    runAction(() => promoteMemberRpc(serverId, targetId, roleId), 'Membro promovido.');

  const demoteMember = (serverId: string, targetId: string, roleId: string) =>
    runAction(() => demoteMemberRpc(serverId, targetId, roleId), 'Membro rebaixado.');

  const kickMember = (serverId: string, targetId: string) =>
    runAction(() => kickMemberRpc(serverId, targetId), 'Membro removido do grupo.');

  const banMember = (serverId: string, targetId: string) =>
    runAction(() => banMemberRpc(serverId, targetId), 'Membro banido do grupo.');

  const disconnectMemberFromCall = (serverId: string, targetId: string, channelId: string) =>
    runAction(() => disconnectMemberRpc(serverId, targetId, channelId), 'Membro desconectado da call.');

  const moveMemberBetweenChannels = (serverId: string, targetId: string, fromChannelId: string, toChannelId: string) =>
    runAction(() => moveMemberRpc(serverId, targetId, fromChannelId, toChannelId), 'Membro movido para outra call.');

  const setMemberMuted = (serverId: string, targetId: string, muted: boolean) =>
    runAction(() => setMemberMutedRpc(serverId, targetId, muted), muted ? 'Membro mutado.' : 'Microfone do membro ativado.');

  const setMemberDeafened = (serverId: string, targetId: string, deafened: boolean) =>
    runAction(() => setMemberDeafenedRpc(serverId, targetId, deafened), deafened ? 'Membro ensurdecido.' : 'Som do membro ativado.');

  const setChannelRolePermission = (channelId: string, roleId: string, canView: boolean, canSend: boolean) =>
    runAction(() => setChannelRolePermissionRpc(channelId, roleId, canView, canSend), 'Permissão de canal atualizada.');

  const removeChannelRolePermission = (channelId: string, roleId: string) =>
    runAction(() => removeChannelRolePermissionRpc(channelId, roleId), 'Permissão de canal removida.');

  useEffect(() => {
    if (activeServerId) void loadServerMembers(activeServerId);
  }, [activeServerId]);

  useEffect(() => {
    const channel = supabase.channel('voice-presence')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'voice_states' }, async () => {
        const { data } = await supabase.from('voice_states').select('channel_id');
        const counts: Record<string, number> = {};
        (data || []).forEach((vs) => {
          counts[vs.channel_id] = (counts[vs.channel_id] || 0) + 1;
        });
        setVoiceCounts(counts);
      })
      .subscribe();

    return () => {
      void supabase.removeChannel(channel);
    };
  }, []);

  useEffect(() => {
    callStateRef.current = callState;
    callActiveRef.current = callState.isActive;
  }, [callState]);

  useEffect(() => {
    if (incomingCall) {
      playRingTone();
      if (ringDismissTimerRef.current) clearTimeout(ringDismissTimerRef.current);
      ringDismissTimerRef.current = window.setTimeout(() => {
        ringDismissTimerRef.current = null;
        stopRingTone();
        setIncomingCall(null);
      }, 60000);
    } else {
      stopRingTone();
      if (ringDismissTimerRef.current) { clearTimeout(ringDismissTimerRef.current); ringDismissTimerRef.current = null; }
    }
    return () => {
      if (ringDismissTimerRef.current) { clearTimeout(ringDismissTimerRef.current); ringDismissTimerRef.current = null; }
    };
  }, [incomingCall]);

  useEffect(() => {
    if (!currentUser) return;

    const channel = supabase.channel(`dm-call-rings-in:${currentUser.id}`)
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'dm_call_rings', filter: `callee_id=eq.${currentUser.id}` }, async (payload) => {
        const row = payload.new as RingRow | null;
        if (!row || row.status !== 'ringing') return;
        if (callActiveRef.current) {
          try {
            await supabase.from('dm_call_rings').update({ status: 'declined' }).eq('id', row.id);
          } catch { /* ignore */ }
          return;
        }
        const profile = await getProfileUser(row.caller_id);
        if (!profile) return;
        setIncomingCall({ id: row.id, caller: profile, type: row.type });
      })
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'dm_call_rings', filter: `callee_id=eq.${currentUser.id}` }, (payload) => {
        const row = payload.new as RingRow | null;
        if (!row) return;
        setIncomingCall((prev) => (prev && prev.id === row.id ? null : prev));
      })
      .on('postgres_changes', { event: 'DELETE', schema: 'public', table: 'dm_call_rings', filter: `callee_id=eq.${currentUser.id}` }, (payload) => {
        const row = payload.old as RingRow | null;
        if (!row) return;
        setIncomingCall((prev) => (prev && prev.id === row.id ? null : prev));
      })
      .subscribe();

    return () => {
      void supabase.removeChannel(channel);
    };
  }, [currentUser]);

  const loadChannelMessages = async (channelId: string) => {
    const { data } = await supabase
      .from('messages')
      .select('*, profiles:author_id(*), message_reactions(*)')
      .eq('channel_id', channelId)
      .order('created_at', { ascending: false })
      .limit(50);

    const memberMap = new Map<string, ServerMember>();
    (serverMembers[activeServerId || ''] || []).forEach((member) => memberMap.set(member.userId, member));

    const rows = (data || []).reverse() as (MessageRow & { profiles: ProfileRow | null; message_reactions: ReactionRow[] | null })[];
    setMessages((prev) => ({
      ...prev,
      [channelId]: rows.map((message) => {
        const profile = message.profiles;
        const member = memberMap.get(message.author_id);
        const topRole = member?.roles?.[0];
        const reactionMap = new Map<string, Reaction>();
        (message.message_reactions || []).forEach((reaction) => {
          const existing = reactionMap.get(reaction.emoji) || { emoji: reaction.emoji, count: 0, userReacted: false };
          reactionMap.set(reaction.emoji, {
            ...existing,
            count: existing.count + 1,
            userReacted: existing.userReacted || reaction.user_id === currentUser?.id,
          });
        });
        return {
          id: message.id,
          userId: message.author_id,
          userName: profile?.display_name || 'Usuario',
          userAvatar: profile?.avatar_url || fallbackAvatar(profile?.display_name || 'Usuario'),
          userRole: topRole?.name || (activeServer ? roleFromServer(activeServer, message.author_id) : 'Membro'),
          userRoleColor: topRole?.color,
          content: message.content,
          timestamp: formatTime(message.created_at),
          reactions: [...reactionMap.values()],
        };
      }),
    }));
  };

  const loadDmMessages = async (otherUserId: string) => {
    const { data: channelId, error: channelError } = await supabase.rpc('get_or_create_dm_channel', { p_other_user: otherUserId });
    if (channelError || !channelId) {
      addToast(channelError?.message || 'Nao foi possivel abrir a DM.', 'error');
      return;
    }

    const { data } = await supabase
      .from('direct_messages')
      .select('*, profiles:author_id(*)')
      .eq('channel_id', channelId)
      .order('created_at', { ascending: false })
      .limit(50);

    const rows = (data || []).reverse() as (DirectMessageRow & { profiles: ProfileRow | null })[];
    setMessages((prev) => ({
      ...prev,
      [otherUserId]: rows.map((message) => {
        const profile = message.profiles;
        return {
          id: message.id,
          userId: message.author_id,
          userName: profile?.display_name || 'Usuario',
          userAvatar: profile?.avatar_url || fallbackAvatar(profile?.display_name || 'Usuario'),
          content: message.content,
          timestamp: formatTime(message.created_at),
          reactions: [],
        };
      }),
    }));
  };

  useEffect(() => {
    if (activeChannelId) void loadChannelMessages(activeChannelId);
  }, [activeChannelId, currentUser?.id]);

  useEffect(() => {
    if (activeDmId) void loadDmMessages(activeDmId);
  }, [activeDmId]);

  useEffect(() => {
    const key = activeChannelId || activeDmId;
    if (!key) return;

    const channel = supabase.channel(`discordex:${key}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: activeChannelId ? 'messages' : 'direct_messages' }, () => {
        if (activeChannelId) void loadChannelMessages(activeChannelId);
        if (activeDmId) void loadDmMessages(activeDmId);
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'message_reactions' }, () => {
        if (activeChannelId) void loadChannelMessages(activeChannelId);
      })
      .subscribe();

    return () => {
      void supabase.removeChannel(channel);
    };
  }, [activeChannelId, activeDmId]);

  const setActiveServerId = (id: string | null) => {
    setActiveServerIdState(id);
    setActiveDmIdState(null);
    if (id) {
      const server = servers.find((item) => item.id === id);
      setActiveChannelId(server?.channels.find((channel) => channel.type === 'text')?.id || server?.channels[0]?.id || null);
    } else {
      setActiveChannelId(null);
    }
  };

  const setActiveDmId = (id: string | null) => {
    setActiveDmIdState(id);
    setActiveServerIdState(null);
    setActiveChannelId(null);
  };

  const addServer = async (name: string) => {
    const result = await createServer(name);
    if (!result.success || !result.serverId) {
      addToast(result.error || 'Nao foi possivel criar o servidor.', 'error');
      return;
    }
    await loadServers();
    setActiveServerIdState(result.serverId);
    addToast(`Servidor "${name}" criado.`, 'success');
  };

  const joinServer = async (inviteCode: string) => {
    const code = extractInviteCode(inviteCode);
    if (!code) {
      addToast('Convite invalido.', 'error');
      return;
    }
    const result = await joinServerViaInvite(code);
    if (!result.success || !result.serverId) {
      addToast(result.error || 'Convite invalido.', 'error');
      return;
    }
    await loadServers();
    setActiveServerIdState(result.serverId);
    addToast('Voce entrou no servidor.', 'success');
  };

  const createServerInvite = async (serverId: string) => {
    const result = await createServerInviteRecord(serverId);
    if (!result.success || !result.inviteUrl) {
      addToast(result.error || 'Nao foi possivel criar o convite.', 'error');
      return;
    }
    try {
      await navigator.clipboard.writeText(result.inviteUrl);
    } catch {
      const area = document.createElement('textarea');
      area.value = result.inviteUrl;
      area.style.position = 'fixed';
      area.style.opacity = '0';
      document.body.appendChild(area);
      area.select();
      document.execCommand('copy');
      document.body.removeChild(area);
    }
    addToast('Link de convite criado e copiado!', 'success');
  };

  const deleteServer = async (serverId: string) => {
    const row = serverRows.find((server) => server.id === serverId);
    const result = row?.owner_id === currentUser?.id ? await deleteServerRecord(serverId) : await leaveServer(serverId);
    if (!result.success) {
      addToast(result.error || 'Nao foi possivel sair do servidor.', 'error');
      return;
    }
    await loadServers();
    setActiveServerId(null);
    addToast(row?.owner_id === currentUser?.id ? 'Servidor excluido.' : 'Voce saiu do servidor.', 'info');
  };

  const addChannel = async (serverId: string, name: string, type: 'text' | 'voice', parentId: string | null = null) => {
    const result = await createChannelRecord(serverId, name, type, { parentId: parentId || undefined });
    if (!result.success || !result.channel) {
      addToast(result.error || 'Nao foi possivel criar o canal.', 'error');
      return;
    }
    await loadServers();
    setActiveChannelId(result.channel.id);
    addToast(`Canal ${name} criado.`, 'success');
  };

  const addCategory = async (serverId: string, name: string) => {
    const result = await createChannelRecord(serverId, name, 'category');
    if (!result.success) {
      addToast(result.error || 'Nao foi possivel criar a categoria.', 'error');
      return;
    }
    await loadServers();
    addToast(`Categoria ${name} criada.`, 'success');
  };

  const deleteChannel = async (_serverId: string, channelId: string) => {
    const { error } = await supabase.from('channels').delete().eq('id', channelId);
    if (error) {
      addToast(error.message, 'error');
      return;
    }
    await loadServers();
    setActiveChannelId(null);
    addToast('Canal removido.', 'info');
  };

  const refreshServers = async () => {
    await loadServers();
  };

  const updateServerConfig = async (
    serverId: string,
    updates: { name?: string; description?: string; icon_url?: string }
  ) => {
    const result = await updateServerRecord(serverId, updates);
    if (!result.success) {
      addToast(result.error || 'Nao foi possivel atualizar o servidor.', 'error');
      return;
    }
    await loadServers();
    addToast('Servidor atualizado.', 'success');
  };

  const sendMessage = async (content: string) => {
    if (!currentUser || !content.trim()) return;

    if (activeServerId && activeChannelId) {
      const { error } = await supabase.from('messages').insert({ channel_id: activeChannelId, author_id: currentUser.id, content });
      if (error) addToast(error.message, 'error');
      else await loadChannelMessages(activeChannelId);
      return;
    }

    if (activeDmId) {
      const { data: channelId, error: channelError } = await supabase.rpc('get_or_create_dm_channel', { p_other_user: activeDmId });
      if (channelError || !channelId) {
        addToast(channelError?.message || 'Nao foi possivel abrir a DM.', 'error');
        return;
      }
      const { error } = await supabase.from('direct_messages').insert({ channel_id: channelId, author_id: currentUser.id, content });
      if (error) addToast(error.message, 'error');
      else await loadDmMessages(activeDmId);
    }
  };

  const toggleReaction = async (messageId: string, emoji: string) => {
    if (!currentUser || !activeChannelId) return;
    const { data: existing } = await supabase
      .from('message_reactions')
      .select('id')
      .eq('message_id', messageId)
      .eq('user_id', currentUser.id)
      .eq('emoji', emoji)
      .maybeSingle();

    if (existing) {
      await supabase.from('message_reactions').delete().eq('id', existing.id);
    } else {
      await supabase.from('message_reactions').insert({ message_id: messageId, user_id: currentUser.id, emoji });
    }
    await loadChannelMessages(activeChannelId);
  };

  const editMessage = async (messageId: string, newContent: string) => {
    if (!currentUser || !newContent.trim()) return;
    if (activeServerId && activeChannelId) {
      const { error } = await supabase.from('messages').update({ content: newContent.trim() }).eq('id', messageId);
      if (error) addToast(error.message, 'error');
      else await loadChannelMessages(activeChannelId);
    } else if (activeDmId) {
      const { error } = await supabase.from('direct_messages').update({ content: newContent.trim() }).eq('id', messageId);
      if (error) addToast(error.message, 'error');
      else await loadDmMessages(activeDmId);
    }
  };

  const deleteMessage = async (messageId: string) => {
    if (!currentUser) return;
    if (activeServerId && activeChannelId) {
      const { error } = await supabase.from('messages').delete().eq('id', messageId);
      if (error) addToast(error.message, 'error');
      else await loadChannelMessages(activeChannelId);
    } else if (activeDmId) {
      const { error } = await supabase.from('direct_messages').delete().eq('id', messageId);
      if (error) addToast(error.message, 'error');
      else await loadDmMessages(activeDmId);
    }
  };

  const blockUser = async (userId: string) => {
    if (!currentUser || userId === currentUser.id) return;
    const { error } = await supabase.from('blocks').insert({ blocker_id: currentUser.id, blocked_id: userId });
    if (error) addToast(error.message, 'error');
    else addToast('Usuario bloqueado.', 'success');
  };

  const updateChannelRow = async (channelId: string, updates: { name?: string; description?: string; parent_id?: string | null }) => {
    const { error } = await supabase.from('channels').update(updates).eq('id', channelId);
    if (error) {
      addToast(error.message, 'error');
      return false;
    }
    await refreshServers();
    return true;
  };

  const startCall = async (type: 'voice' | 'video', channelId: string, channelName: string, silent = false, targetAvatar?: string) => {
    if (!currentUser || callState.isActive) return;
    const startMuted = localStorage.getItem('discordex:start-muted') === 'true';
    const startCamera = type === 'video' && localStorage.getItem('discordex:start-camera') !== 'false';
    const isServerVoice = servers.some((server) => server.channels.some((channel) => channel.id === channelId && channel.type === 'voice'));
    callTypeRef.current = isServerVoice ? 'server' : 'dm';

    playJoinSound();

    const audioConstraints: MediaTrackConstraints = {
      echoCancellation: localStorage.getItem('discordex:echo-cancellation') !== 'false',
      noiseSuppression: localStorage.getItem('discordex:noise-suppression') !== 'false',
      autoGainControl: true,
    };
    const inputDevice = localStorage.getItem('discordex:input-device');
    if (inputDevice) audioConstraints.deviceId = { exact: inputDevice };
    const videoConstraints: MediaTrackConstraints = {};
    const cameraDevice = localStorage.getItem('discordex:camera-device');
    if (cameraDevice) videoConstraints.deviceId = { exact: cameraDevice };
    const videoQuality = localStorage.getItem('discordex:video-quality') || 'auto';
    if (videoQuality === '480p') { videoConstraints.width = { ideal: 854 }; videoConstraints.height = { ideal: 480 }; }
    else if (videoQuality === '720p') { videoConstraints.width = { ideal: 1280 }; videoConstraints.height = { ideal: 720 }; }
    else if (videoQuality === '1080p') { videoConstraints.width = { ideal: 1920 }; videoConstraints.height = { ideal: 1080 }; }
    const videoFps = Math.min(Math.max(Number(localStorage.getItem('discordex:video-fps') || 30), 1), 60);
    if (videoFps > 0) videoConstraints.frameRate = { ideal: videoFps, max: videoFps };
    const videoBitrate = Math.max(Number(localStorage.getItem('discordex:video-bitrate') || 0), 0) || null;

    let stream: MediaStream;
    try {
      stream = await navigator.mediaDevices.getUserMedia({
        audio: audioConstraints,
        video: startCamera ? videoConstraints : false,
      });
    } catch {
      addToast('Nao foi possivel acessar o microfone. Verifique as permissoes do navegador.', 'error');
      return;
    }

    const noiseSuppressionEnabled = localStorage.getItem('discordex:noise-suppression') !== 'false';
    if (noiseSuppressionEnabled) {
      const noiseSuppressionLevel = (localStorage.getItem('discordex:noise-suppression-level') || 'medium') as 'low' | 'medium' | 'high';
      stream = applyNoiseSuppression(stream, true, noiseSuppressionLevel);
    }

    setCallState({
      isActive: true,
      type,
      channelId,
      channelName,
      targetAvatar,
      isMuted: startMuted,
      isCameraOn: startCamera,
      isScreenSharing: false,
      isSpeakerMuted: false,
      ringing: !isServerVoice && !silent,
      participants: [{ id: currentUser.id, name: currentUser.displayName, avatar: currentUser.avatar, isSpeaking: false, isMuted: startMuted, isCameraOn: startCamera, isScreenSharing: false }],
      localStream: stream,
      screenStream: null,
      remoteStreams: {},
      remoteScreenStreams: {},
    });

    if (isServerVoice) {
      const { error } = await supabase
        .from('voice_states')
        .upsert({ channel_id: channelId, user_id: currentUser.id, muted: startMuted, camera_enabled: startCamera }, { onConflict: 'channel_id,user_id' });
      if (error) {
        addToast(error.message, 'error');
        stream.getTracks().forEach((track) => track.stop());
        setCallState(emptyCallState);
        return;
      }
    }

    if (!isServerVoice && !silent) {
      const roomKey = [currentUser.id, channelId].sort().join(':');
      const { data: ring, error: ringError } = await supabase
        .from('dm_call_rings')
        .insert({ caller_id: currentUser.id, callee_id: channelId, call_room: roomKey, type })
        .select('id')
        .single();
      if (ringError || !ring) {
        addToast('Nao foi possivel iniciar a chamada.', 'error');
        stream.getTracks().forEach((track) => track.stop());
        setCallState(emptyCallState);
        return;
      }
      callerRingIdRef.current = ring.id;
      playRingTone();

      callerRingChannelRef.current = supabase.channel(`dm-call-ring:${callerRingIdRef.current}`)
        .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'dm_call_rings', filter: `id=eq.${callerRingIdRef.current}` }, async (payload) => {
          const row = payload.new as RingRow | null;
          if (!row) return;
          if (row.status === 'declined') {
            stopRingTone();
            addToast('Chamada recusada.', 'info');
            await endCall();
          } else if (row.status === 'accepted') {
            stopRingTone();
            setCallState((prev) => ({ ...prev, ringing: false }));
            if (ringTimeoutRef.current) { clearTimeout(ringTimeoutRef.current); ringTimeoutRef.current = null; }
            if (callerRingChannelRef.current) {
              await supabase.removeChannel(callerRingChannelRef.current).catch(() => { /* ignore */ });
              callerRingChannelRef.current = null;
            }
          }
        })
        .subscribe();

      ringTimeoutRef.current = window.setTimeout(() => {
        if (!callStateRef.current.isActive) return;
        stopRingTone();
        addToast('Chamada sem resposta.', 'info');
        void endCall();
      }, 60000);
    }

    const iceServers: RTCIceServer[] = [
      { urls: 'stun:stun.l.google.com:19302' },
      { urls: 'stun:stun1.l.google.com:19302' },
      { urls: 'stun:stun2.l.google.com:19302' },
      { urls: 'stun:stun3.l.google.com:19302' },
      { urls: 'stun:stun4.l.google.com:19302' },
      { urls: 'stun:global.stun.twilio.com:3478' },
    ];

    engineRef.current = new VoiceCallEngine({
      supabase,
      channelId,
      userId: currentUser.id,
      displayName: currentUser.displayName,
      avatar: currentUser.avatar,
      isServerChannel: isServerVoice,
      stream,
      iceServers,
      startMuted,
      startCamera,
      videoBitrate,
      onUpdate: (participants: CallParticipantInfo[]) => {
        if (participants.length >= 2 && remoteLeaveTimerRef.current) {
          clearTimeout(remoteLeaveTimerRef.current);
          remoteLeaveTimerRef.current = null;
        }
        setCallState((prev) => ({
          ...prev,
          participants: participants.map((p) => ({ ...p })),
        }));
      },
      onRemoteStream: (userId, remoteStream) => {
        setCallState((prev) => ({ ...prev, remoteStreams: { ...prev.remoteStreams, [userId]: remoteStream } }));
      },
      onRemoteStreamEnd: (userId) => {
        setCallState((prev) => {
          if (!prev.remoteStreams?.[userId]) return prev;
          const remoteStreams = { ...prev.remoteStreams };
          delete remoteStreams[userId];
          return { ...prev, remoteStreams };
        });
      },
      onScreenStream: (userId, screenStream) => {
        setCallState((prev) => ({ ...prev, remoteScreenStreams: { ...prev.remoteScreenStreams, [userId]: screenStream } }));
      },
      onScreenStreamEnd: (userId) => {
        setCallState((prev) => {
          if (!prev.remoteScreenStreams?.[userId]) return prev;
          const remoteScreenStreams = { ...prev.remoteScreenStreams };
          delete remoteScreenStreams[userId];
          return { ...prev, remoteScreenStreams };
        });
      },
      onParticipantJoined: () => playPopSound(),
      onRemoteLeave: () => {
        if (callTypeRef.current !== 'dm') return;
        if (remoteLeaveTimerRef.current) clearTimeout(remoteLeaveTimerRef.current);
        remoteLeaveTimerRef.current = window.setTimeout(() => {
          remoteLeaveTimerRef.current = null;
          const current = callStateRef.current;
          if (current.isActive && current.participants.length <= 1) {
            void endCall();
          }
        }, 3000);
      },
      onError: (message) => addToast(message, 'error'),
    });

    try {
      await engineRef.current.join();
      engineRef.current.setVideoBitrate(videoBitrate);
    } catch (error) {
      console.error('Falha ao entrar na chamada', error);
      await endCall();
      return;
    }
    addToast(`Conectado em ${channelName}.`, 'success');
  };

  const endCall = async () => {
    const current = callStateRef.current;
    stopRingTone();
    if (ringTimeoutRef.current) { clearTimeout(ringTimeoutRef.current); ringTimeoutRef.current = null; }
    if (remoteLeaveTimerRef.current) { clearTimeout(remoteLeaveTimerRef.current); remoteLeaveTimerRef.current = null; }
    if (callerRingIdRef.current) {
      try {
        await supabase.from('dm_call_rings').delete().eq('id', callerRingIdRef.current);
      } catch { /* ignore */ }
      callerRingIdRef.current = null;
    }
    if (callerRingChannelRef.current) {
      await supabase.removeChannel(callerRingChannelRef.current).catch(() => { /* ignore */ });
      callerRingChannelRef.current = null;
    }
    if (engineRef.current) {
      await engineRef.current.leave();
      engineRef.current = null;
    }
    if (screenStreamRef.current) {
      screenStreamRef.current.getTracks().forEach((track) => track.stop());
      screenStreamRef.current = null;
    }
    if (callTypeRef.current === 'server' && current.channelId && currentUser) {
      await supabase.from('voice_states').delete().eq('channel_id', current.channelId).eq('user_id', currentUser.id);
    }
    callTypeRef.current = null;
    if (current.localStream) {
      current.localStream.getTracks().forEach((track) => track.stop());
    }
    setCallState(emptyCallState);
    setIncomingCall(null);
    playLeaveSound();
    addToast('Chamada encerrada.', 'info');
  };

  const answerCall = async () => {
    if (!incomingCall || !currentUser) return;
    const { id, caller, type } = incomingCall;
    setIncomingCall(null);
    try {
      await supabase.from('dm_call_rings').update({ status: 'accepted' }).eq('id', id);
    } catch { /* ignore */ }
    startCall(type, caller.id, caller.displayName, true, caller.avatar);
  };

  const declineCall = async () => {
    if (!incomingCall || !currentUser) return;
    const { id } = incomingCall;
    setIncomingCall(null);
    try {
      await supabase.from('dm_call_rings').update({ status: 'declined' }).eq('id', id);
    } catch { /* ignore */ }
  };

  const toggleMute = () => {
    if (!callState.isActive) return;
    const next = !callState.isMuted;
    setCallState((prev) => ({ ...prev, isMuted: next, participants: prev.participants.map((p) => p.id === currentUser?.id ? { ...p, isMuted: next } : p) }));
    if (engineRef.current) {
      void engineRef.current.setMuted(next);
    } else if (callTypeRef.current === 'server' && callState.channelId && currentUser) {
      void supabase.from('voice_states').update({ muted: next }).eq('channel_id', callState.channelId).eq('user_id', currentUser.id);
    }
  };

  const toggleCamera = () => {
    if (!callState.isActive) return;
    const next = !callState.isCameraOn;
    setCallState((prev) => ({ ...prev, isCameraOn: next, participants: prev.participants.map((p) => p.id === currentUser?.id ? { ...p, isCameraOn: next } : p) }));
    if (engineRef.current) {
      void engineRef.current.setCamera(next);
    } else if (callTypeRef.current === 'server' && callState.channelId && currentUser) {
      void supabase.from('voice_states').update({ camera_enabled: next }).eq('channel_id', callState.channelId).eq('user_id', currentUser.id);
    }
  };

  const toggleSpeakerMute = () => {
    if (!callState.isActive) return;
    setCallState((prev) => ({ ...prev, isSpeakerMuted: !prev.isSpeakerMuted }));
  };

  const stopScreenShare = () => {
    if (screenStreamRef.current) {
      screenStreamRef.current.getTracks().forEach((track) => track.stop());
      screenStreamRef.current = null;
    }
    setCallState((prev) => ({
      ...prev,
      isScreenSharing: false,
      screenStream: null,
      participants: prev.participants.map((p) => p.id === currentUser?.id ? { ...p, isScreenSharing: false } : p),
    }));
    if (engineRef.current) {
      void engineRef.current.setScreenTrack(null);
    } else if (callTypeRef.current === 'server' && callState.channelId && currentUser) {
      void supabase.from('voice_states').update({ screen_sharing: false }).eq('channel_id', callState.channelId).eq('user_id', currentUser.id);
    }
  };

  const toggleScreenShare = async () => {
    if (!callState.isActive) return;

    if (callState.isScreenSharing) {
      stopScreenShare();
      addToast('Compartilhamento de tela encerrado.', 'info');
      return;
    }

    let displayStream: MediaStream;
    try {
      const screenConstraints: MediaTrackConstraints = {};
      const videoQuality = localStorage.getItem('discordex:video-quality') || 'auto';
      if (videoQuality === '480p') { screenConstraints.width = { max: 854 }; screenConstraints.height = { max: 480 }; }
      else if (videoQuality === '720p') { screenConstraints.width = { max: 1280 }; screenConstraints.height = { max: 720 }; }
      else if (videoQuality === '1080p') { screenConstraints.width = { max: 1920 }; screenConstraints.height = { max: 1080 }; }
      const videoFps = Math.min(Math.max(Number(localStorage.getItem('discordex:video-fps') || 30), 1), 60);
      screenConstraints.frameRate = { ideal: videoFps, max: videoFps };
      displayStream = await navigator.mediaDevices.getDisplayMedia({ video: screenConstraints });
    } catch (error) {
      const err = error as DOMException;
      if (err.name === 'NotAllowedError' || err.name === 'AbortError') {
        addToast('Compartilhamento de tela cancelado ou sem permissao.', 'info');
      } else if (err.name === 'NotFoundError' || err.name === 'NotReadableError') {
        addToast('Nao foi possivel acessar a tela selecionada. Verifique o navegador e tente novamente.', 'error');
      } else {
        addToast(`Falha ao compartilhar a tela: ${err.message || err.name || 'erro desconhecido'}.`, 'error');
      }
      return;
    }

    const track = displayStream.getVideoTracks()[0];
    if (!track) {
      displayStream.getTracks().forEach((t) => t.stop());
      addToast('Nenhuma tela selecionada.', 'info');
      return;
    }

    screenStreamRef.current = displayStream;

    const handleEnded = () => {
      if (screenStreamRef.current !== displayStream) return;
      stopScreenShare();
      addToast('Compartilhamento de tela encerrado.', 'info');
    };
    track.addEventListener('ended', handleEnded);

    setCallState((prev) => ({
      ...prev,
      isScreenSharing: true,
      screenStream: displayStream,
      participants: prev.participants.map((p) => p.id === currentUser?.id ? { ...p, isScreenSharing: true } : p),
    }));

    if (engineRef.current) {
      void engineRef.current.setScreenTrack(track);
      engineRef.current.setVideoBitrate(Number(localStorage.getItem('discordex:video-bitrate') || 0) > 0 ? Number(localStorage.getItem('discordex:video-bitrate')) : null);
    } else if (callState.channelId && currentUser) {
      void supabase.from('voice_states').update({ screen_sharing: true }).eq('channel_id', callState.channelId).eq('user_id', currentUser.id);
    }

    addToast('Compartilhando tela.', 'success');
  };

  const openSettings = (tab = 'Minha conta', serverId: string | null = null) => {
    setSettingsTab(tab);
    setActiveServerSettingsId(serverId);
    setIsSettingsOpen(true);
  };

  const openServerTab = (serverId: string, tab: string) => {
    setServerSettingsTab(tab);
    setServerSettingsRoleId(null);
    setActiveServerSettingsId(serverId);
    setIsSettingsOpen(true);
  };

  const openRoleSettings = (serverId: string, roleId: string) => {
    setServerSettingsTab('roles');
    setServerSettingsRoleId(roleId);
    setActiveServerSettingsId(serverId);
    setIsSettingsOpen(true);
  };

  const closeSettings = () => {
    setIsSettingsOpen(false);
    setActiveServerSettingsId(null);
  };

  const openModal = (modal: AppContextType['activeModal'], user?: User, payload?: unknown) => {
    setActiveModal(modal);
    setModalPayload(payload ?? null);
    if (user) setSelectedProfileUser(user);
  };

  const closeModal = () => {
    setActiveModal(null);
    setSelectedProfileUser(null);
    setModalPayload(null);
  };

  const updateCurrentUserProfile = async (displayName: string, bio: string, status: User['status'], avatarUrl?: string, username?: string) => {
    const cleanAvatarUrl = avatarUrl?.trim() || undefined;
    const cleanUsername = username?.trim() || undefined;
    const result = await updateProfile({
      display_name: displayName,
      bio,
      status,
      avatar_url: cleanAvatarUrl,
      ...(cleanUsername ? { username: cleanUsername } : {}),
    });
    if (!result.success || !result.data) {
      addToast(result.error || 'Nao foi possivel atualizar o perfil.', 'error');
      return;
    }
    setCurrentUser(toUser(result.data, currentUser?.role));
    addToast('Perfil atualizado.', 'success');
  };

  const triggerConnectionChange = (state: AppContextType['connectionState']) => {
    setConnectionState(state);
  };

  const sendFriendRequest = async (username: string) => {
    if (!currentUser) return;
    const cleanUsername = username.trim().replace(/^@/, '');
    const { data: receiver, error: receiverError } = await supabase
      .from('profiles')
      .select('*')
      .eq('username', cleanUsername)
      .maybeSingle();

    if (receiverError || !receiver) {
      addToast('Usuario nao encontrado.', 'error');
      return;
    }

    const { error } = await supabase
      .from('friendships')
      .insert({ requester_id: currentUser.id, receiver_id: receiver.id });

    if (error) {
      addToast(error.message, 'error');
      return;
    }

    await loadFriendsAndDms();
    addToast(`Solicitacao enviada para ${receiver.display_name}.`, 'success');
  };

  const respondFriendRequest = async (friendshipId: string, status: 'accepted' | 'declined') => {
    const { error } = await supabase
      .from('friendships')
      .update({ status })
      .eq('id', friendshipId);

    if (error) {
      addToast(error.message, 'error');
      return;
    }

    await loadFriendsAndDms();
    addToast(status === 'accepted' ? 'Solicitacao aceita.' : 'Solicitacao recusada.', status === 'accepted' ? 'success' : 'info');
  };

  if (!currentUser) {
    return <div className="h-screen bg-discordex-bg text-discordex-text-primary flex items-center justify-center text-sm">Carregando Discordex...</div>;
  }

  return (
    <AppContext.Provider value={{
      currentUser,
      servers,
      activeServerId,
      activeChannelId,
      activeDmId,
      messages,
      dms,
      friends,
      pendingRequests,
      callState,
      connectionState,
      isSettingsOpen,
      settingsTab,
      activeServerSettingsId,
      serverSettingsTab,
      serverSettingsRoleId,
      activeModal,
      selectedProfileUser,
      modalPayload,
      incomingCall,
      toasts,
      isAppAdmin,
      serverMembers,
      voiceCounts,
      serverRoles,
      serverChannelPerms,
      getMyPermissions,
      canManageUser,
      createRole,
      updateRole,
      deleteRole,
      addRoleToMember,
      removeRoleFromMember,
      promoteMember,
      demoteMember,
      kickMember,
      banMember,
      disconnectMemberFromCall,
      moveMemberBetweenChannels,
      setMemberMuted,
      setMemberDeafened,
      setChannelRolePermission,
      removeChannelRolePermission,
      addServer,
      joinServer,
      createServerInvite,
      deleteServer,
      refreshServers,
      updateServerConfig,
      addChannel,
      addCategory,
      deleteChannel,
      updateChannelRow,
      editMessage,
      deleteMessage,
      blockUser,
      sendMessage,
      toggleReaction,
      startCall,
      endCall,
      answerCall,
      declineCall,
      toggleMute,
      toggleCamera,
      toggleScreenShare,
      toggleSpeakerMute,
      setActiveServerId,
      setActiveChannelId,
      setActiveDmId,
      openSettings,
      openServerTab,
      openRoleSettings,
      closeSettings,
      openModal,
      closeModal,
      addToast,
      removeToast,
      updateCurrentUserProfile,
      triggerConnectionChange,
      sendFriendRequest,
      respondFriendRequest,
    }}>
      {children}
    </AppContext.Provider>
  );
};

export const useApp = () => {
  const context = useContext(AppContext);
  if (context === undefined) {
    throw new Error('useApp must be used within an AppProvider');
  }
  return context;
};
