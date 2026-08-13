import React, { useState } from 'react';
import { useApp } from '../context/AppContext';
import type { Channel } from '../context/AppContext';
import { Tooltip, TransmitMeter } from './SharedUI';
import { useContextMenu } from './ContextMenu';
import { PERMISSIONS, hasPermission } from '../lib/permissions';
import { buildChannelMenu, buildCategoryMenu, buildServerMenu } from '../lib/contextActions';
import {
  Hash, Waveform, Gear, Microphone, MicrophoneSlash, VideoCamera, VideoCameraSlash,
  PhoneSlash, UserPlus, CaretDown, Plus, SignOut, Users, FolderPlus
} from '@phosphor-icons/react';
import { channelFrequency } from '../lib/station';

export const SidebarChannels: React.FC = () => {
  const app = useApp();
  const {
    servers,
    activeServerId,
    activeChannelId,
    setActiveChannelId,
    currentUser,
    openSettings,
    openModal,
    callState,
    endCall,
    toggleMute,
    toggleCamera,
    deleteServer,
    voiceCounts,
    getMyPermissions,
  } = app;

  const { openMenu } = useContextMenu();

  const [collapsed, setCollapsed] = useState<Set<string>>(new Set());

  const activeServer = servers.find(s => s.id === activeServerId);

  if (!activeServerId || !activeServer) return null;

  const myPerms = getMyPermissions(activeServerId);
  const canManageChannels = myPerms.isOwner || hasPermission(myPerms.permissions, PERMISSIONS.MANAGE_CHANNELS);

  const channelsByParent = (parentId: string | null) =>
    activeServer.channels.filter(c => (c.parentId || null) === parentId);

  const toggleCategory = (categoryId: string) => {
    setCollapsed(prev => {
      const next = new Set(prev);
      if (next.has(categoryId)) next.delete(categoryId);
      else next.add(categoryId);
      return next;
    });
  };

  const handleChannelClick = (channel: Channel) => {
    setActiveChannelId(channel.id);
  };

  const isInThisVoiceChannel = (chanId: string) =>
    callState.isActive && callState.channelId === chanId;

  const renderChannel = (chan: Channel) => {
    const isActive = activeChannelId === chan.id;
    const isVoice = chan.type === 'voice';
    const voiceMembers = isVoice && isInThisVoiceChannel(chan.id) ? callState.participants : [];
    const count = voiceCounts[chan.id] || 0;

    return (
      <div
        key={chan.id}
        onClick={() => handleChannelClick(chan)}
        onContextMenu={(event) => openMenu(event, buildChannelMenu(app, { server: activeServer, channel: chan }))}
        className={`relative flex items-center justify-between px-2 py-1.5 rounded-md group cursor-pointer transition-colors ${
          isActive
            ? 'bg-signal-hover text-signal-text-primary'
            : 'text-signal-text-secondary hover:bg-signal-hover/50 hover:text-signal-text-primary'
        }`}
      >
        {/* Barra fina de ativo em brass */}
        {isActive && <span className="absolute left-0 top-1/2 -translate-y-1/2 w-0.5 h-4 bg-brass rounded-r-full" />}

        <div className="flex items-center gap-2 truncate">
          {isVoice ? (
            <Waveform className="w-4 h-4 text-signal-text-secondary shrink-0" weight={isActive ? 'bold' : 'regular'} />
          ) : (
            <Hash className="w-4 h-4 text-signal-text-secondary shrink-0" weight={isActive ? 'bold' : 'regular'} />
          )}
          <span className="text-xs font-semibold truncate">{chan.name}</span>
        </div>

        {isVoice && (
          <div className="flex items-center gap-1.5 shrink-0">
            {voiceMembers.length > 0 ? (
              <div className="flex items-center -space-x-1.5">
                {voiceMembers.map(p => (
                  <div key={p.id} className="relative">
                    <img
                      src={p.avatar}
                      alt={p.name}
                      className="w-5 h-5 rounded-full object-cover border border-signal-bg"
                    />
                    {p.isSpeaking && (
                      <span className="absolute -bottom-1 left-1/2 -translate-x-1/2">
                        <TransmitMeter bars={3} className="h-1.5" />
                      </span>
                    )}
                  </div>
                ))}
              </div>
            ) : count > 0 ? (
              <span className="flex items-center gap-1 text-[9px] font-bold text-signal-success shrink-0">
                <Users className="w-3 h-3" />
                {count}
              </span>
            ) : null}
            <span className="font-mono text-[10px] text-signal-text-secondary/70 tabular-nums">
              {channelFrequency(chan.id)}
            </span>
          </div>
        )}
      </div>
    );
  };

  const renderCategoryGroup = (category: { id: string; name: string }, isCollapsed: boolean) => {
    const catChannels = channelsByParent(category.id);
    const hasVoice = catChannels.some(c => c.type === 'voice');
    const label = hasVoice && !catChannels.some(c => c.type === 'text') ? 'FREQUÊNCIAS' : category.name.toUpperCase();
    return (
      <div key={category.id} className="space-y-0.5">
        <div className="flex items-center justify-between px-2 text-[10px] font-bold text-signal-text-secondary uppercase tracking-wider group/cat"
          onContextMenu={(event) => openMenu(event, buildCategoryMenu(app, { server: activeServer, category }))}
        >
          <button
            onClick={() => toggleCategory(category.id)}
            className="flex items-center gap-1 hover:text-signal-text-primary transition-colors"
          >
            <CaretDown className={`w-3 h-3 transition-transform ${isCollapsed ? '-rotate-90' : ''}`} />
            {label}
          </button>
          {canManageChannels && (
            <button
              onClick={() => openModal('create-channel')}
              className="hover:text-signal-text-primary transition-colors"
              title="Criar canal"
            >
              <Plus className="w-3.5 h-3.5" />
            </button>
          )}
        </div>

        {!isCollapsed && (
          <div className="space-y-0.5">
            {catChannels.map(renderChannel)}
            {catChannels.length === 0 && (
              <span className="block px-2 text-[10px] text-signal-text-secondary/40 italic">
                Nenhum canal
              </span>
            )}
          </div>
        )}
      </div>
    );
  };

  const uncategorized = channelsByParent(null);
  const uncategorizedLabel = uncategorized.some(c => c.type === 'voice') && !uncategorized.some(c => c.type === 'text')
    ? 'FREQUÊNCIAS'
    : 'Sem categoria';

  return (
    <div className="w-60 bg-signal-secondary flex flex-col justify-between shrink-0 h-full border-r border-signal-border/40 select-none">

      {/* Header */}
      <div className="h-12 px-4 border-b border-signal-border flex items-center justify-between shadow-sm relative group cursor-pointer hover:bg-signal-hover transition-colors"
        onContextMenu={(event) => openMenu(event, buildServerMenu(app, { server: activeServer }))}
      >
        <span className="font-display font-bold text-[14px] text-signal-text-primary truncate">
          {activeServer.name}
        </span>
        <CaretDown className="w-4 h-4 text-signal-text-secondary group-hover:text-signal-text-primary" />

        {/* Dropdown Options */}
        <div className="absolute top-full left-2 right-2 mt-1 z-40 bg-signal-surface border border-signal-border rounded-md hidden group-hover:block shadow-float-lg p-1.5 animate-fade-in">
          <button
            onClick={() => openModal('join-server')}
            className="w-full flex items-center gap-2 px-3 py-2 text-xs font-semibold text-signal-success hover:bg-signal-success/10 rounded-md transition-colors text-left"
          >
            <UserPlus className="w-4 h-4" />
            Convidar Pessoas
          </button>
          <button
            onClick={() => openSettings('Servidores', activeServer.id)}
            className="w-full flex items-center gap-2 px-3 py-2 text-xs font-semibold text-signal-text-primary hover:bg-signal-hover rounded-md transition-colors text-left"
          >
            <Gear className="w-4 h-4" />
            Configurações do Servidor
          </button>
          <div className="h-px bg-signal-border my-1" />
          <button
            onClick={() => deleteServer(activeServer.id)}
            className="w-full flex items-center gap-2 px-3 py-2 text-xs font-semibold text-signal-danger hover:bg-signal-danger/10 rounded-md transition-colors text-left"
          >
            <SignOut className="w-4 h-4" />
            Sair do Servidor
          </button>
        </div>
      </div>

      {/* Listas de canais */}
      <div className="flex-1 overflow-y-auto px-2 py-3 space-y-4">
        {canManageChannels && (
          <button
            onClick={() => openModal('create-category')}
            className="w-full flex items-center gap-2 px-2 py-1.5 rounded-md text-[10px] font-bold text-signal-text-secondary uppercase tracking-wider hover:text-signal-text-primary hover:bg-signal-hover/50 transition-colors"
          >
            <FolderPlus className="w-3.5 h-3.5" />
            Criar categoria
          </button>
        )}

        {activeServer.categories.map(category => renderCategoryGroup(category, collapsed.has(category.id)))}

        {uncategorized.length > 0 && (
          <div className="space-y-0.5">
            <div className="flex items-center justify-between px-2 text-[10px] font-bold text-signal-text-secondary uppercase tracking-wider group/cat">
              <span>{uncategorizedLabel}</span>
              {canManageChannels && (
                <button
                  onClick={() => openModal('create-channel')}
                  className="hover:text-signal-text-primary transition-colors"
                  title="Criar canal"
                >
                  <Plus className="w-3.5 h-3.5" />
                </button>
              )}
            </div>
            <div className="space-y-0.5">
              {uncategorized.map(renderChannel)}
            </div>
          </div>
        )}
      </div>

      {/* Overlay de status de voz */}
      {callState.isActive && callState.channelId && (
        <div className="p-3 bg-signal-surface border-t border-signal-border flex flex-col gap-2">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2 min-w-0">
              <div className="w-2 h-2 rounded-full bg-signal-success animate-ping" />
              <div className="min-w-0">
                <span className="block text-[10px] font-bold text-signal-success uppercase tracking-wider">
                  Voz Conectada
                </span>
                <span className="block text-[11px] text-signal-text-primary truncate font-medium">
                  {callState.channelName}
                </span>
              </div>
            </div>

            <Tooltip content="Desconectar chamada" position="top">
              <button
                onClick={endCall}
                className="w-8 h-8 rounded-md bg-signal-danger/10 hover:bg-signal-danger text-signal-danger hover:text-white flex items-center justify-center transition-colors"
              >
                <PhoneSlash className="w-4.5 h-4.5" />
              </button>
            </Tooltip>
          </div>
        </div>
      )}

      {/* Painel de usuário (rodapé) */}
      <div className="h-[52px] bg-signal-bg px-2.5 flex items-center justify-between border-t border-signal-border/40">

        {/* Cartão do usuário */}
        <div
          onClick={() => openModal('profile-view', currentUser)}
          className="flex items-center gap-2 cursor-pointer hover:bg-signal-surface/60 p-1 rounded-md transition-colors min-w-0 flex-1 mr-1"
        >
          <div className="relative shrink-0">
            <img
              src={currentUser.avatar}
              alt={currentUser.displayName}
              className="w-8 h-8 rounded-full object-cover"
            />
            {/* Ponto com halo curto */}
            <div className="absolute bottom-0 right-0 w-2.5 h-2.5 rounded-full border border-signal-bg bg-signal-success shadow-[0_0_4px_rgba(79,178,134,0.6)]" />
          </div>
          <div className="min-w-0 leading-tight">
            <span className="block text-xs font-bold text-signal-text-primary truncate">
              {currentUser.displayName}
            </span>
            <span className="block text-[9px] text-signal-text-secondary truncate font-mono">
              @{currentUser.username}
            </span>
          </div>
        </div>

        {/* Botões */}
        <div className="flex items-center gap-0.5 shrink-0">
          <Tooltip content={callState.isMuted ? "Ativar Microfone" : "Silenciar"} position="top">
            <button
              onClick={toggleMute}
              className={`w-7.5 h-7.5 rounded-md flex items-center justify-center transition-colors ${
                callState.isMuted
                  ? 'bg-signal-danger/10 text-signal-danger hover:bg-signal-danger/25'
                  : 'text-signal-text-secondary hover:text-signal-text-primary hover:bg-signal-surface'
              }`}
            >
              {callState.isMuted ? <MicrophoneSlash className="w-4 h-4" /> : <Microphone className="w-4 h-4" />}
            </button>
          </Tooltip>

          <Tooltip content={callState.isCameraOn ? "Desativar Câmera" : "Ativar Câmera"} position="top">
            <button
              onClick={toggleCamera}
              className={`w-7.5 h-7.5 rounded-md flex items-center justify-center transition-colors ${
                callState.isCameraOn
                  ? 'bg-signal-success/15 text-signal-success hover:bg-signal-success/30'
                  : 'text-signal-text-secondary hover:text-signal-text-primary hover:bg-signal-surface'
              }`}
            >
              {callState.isCameraOn ? <VideoCamera className="w-4 h-4" /> : <VideoCameraSlash className="w-4 h-4" />}
            </button>
          </Tooltip>

          <Tooltip content="Configurações do Usuário" position="top">
            <button
              onClick={() => openSettings('Minha conta')}
              className="w-7.5 h-7.5 rounded-md text-signal-text-secondary hover:text-signal-text-primary hover:bg-signal-surface flex items-center justify-center transition-colors"
            >
              <Gear className="w-4 h-4" />
            </button>
          </Tooltip>
        </div>

      </div>
    </div>
  );
};