import React, { useState } from 'react';
import { useApp } from '../context/AppContext';
import type { Channel } from '../context/AppContext';
import { Tooltip } from './SharedUI';
import { useContextMenu } from './ContextMenu';
import { PERMISSIONS, hasPermission } from '../lib/permissions';
import { buildChannelMenu, buildCategoryMenu, buildServerMenu } from '../lib/contextActions';
import { 
  Hash, Volume2, Settings, Mic, MicOff, Video, VideoOff, 
  PhoneOff, UserPlus, ChevronDown, Plus, LogOut, Users, FolderPlus
} from 'lucide-react';

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

  const renderChannel = (chan: Channel) => {
    const isActive = activeChannelId === chan.id;
    const isVoice = chan.type === 'voice';

    return (
      <div
        key={chan.id}
        onClick={() => handleChannelClick(chan)}
        onContextMenu={(event) => openMenu(event, buildChannelMenu(app, { server: activeServer, channel: chan }))}
        className={`flex items-center justify-between px-2 py-1.5 rounded-lg group cursor-pointer transition-colors ${
          isActive 
            ? 'bg-discordex-hover text-discordex-text-primary' 
            : 'text-discordex-text-secondary hover:bg-discordex-hover/50 hover:text-discordex-text-primary'
        }`}
      >
        <div className="flex items-center gap-2 truncate">
          {isVoice ? (
            <Volume2 className="w-4 h-4 text-discordex-text-secondary shrink-0" />
          ) : (
            <Hash className="w-4 h-4 text-discordex-text-secondary shrink-0" />
          )}
          <span className="text-xs font-semibold truncate">{chan.name}</span>
          {isVoice && (voiceCounts[chan.id] || 0) > 0 && (
            <span className="flex items-center gap-1 text-[9px] font-bold text-discordex-success shrink-0">
              <Users className="w-3 h-3" />
              {voiceCounts[chan.id]}
            </span>
          )}
        </div>
      </div>
    );
  };

  const renderCategoryGroup = (category: { id: string; name: string }, isCollapsed: boolean) => {
    const catChannels = channelsByParent(category.id);
    return (
      <div key={category.id} className="space-y-0.5">
        <div className="flex items-center justify-between px-2 text-[10px] font-bold text-discordex-text-secondary uppercase tracking-wider group/cat"
          onContextMenu={(event) => openMenu(event, buildCategoryMenu(app, { server: activeServer, category }))}
        >
          <button
            onClick={() => toggleCategory(category.id)}
            className="flex items-center gap-1 hover:text-discordex-text-primary transition-colors"
          >
            <ChevronDown className={`w-3 h-3 transition-transform ${isCollapsed ? '-rotate-90' : ''}`} />
            {category.name}
          </button>
          {canManageChannels && (
            <button 
              onClick={() => openModal('create-channel')}
              className="hover:text-discordex-text-primary transition-colors"
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
              <span className="block px-2 text-[10px] text-discordex-text-secondary/40 italic">
                Nenhum canal
              </span>
            )}
          </div>
        )}
      </div>
    );
  };

  const uncategorized = channelsByParent(null);

  return (
    <div className="w-60 bg-discordex-secondary flex flex-col justify-between shrink-0 h-full border-r border-discordex-border/40 select-none">
      
      {/* Header */}
      <div className="h-12 px-4 border-b border-discordex-border flex items-center justify-between shadow-sm relative group cursor-pointer hover:bg-discordex-hover transition-colors"
        onContextMenu={(event) => openMenu(event, buildServerMenu(app, { server: activeServer }))}
      >
        <span className="font-bold text-[14px] text-discordex-text-primary truncate">
          {activeServer.name}
        </span>
        <ChevronDown className="w-4 h-4 text-discordex-text-secondary group-hover:text-discordex-text-primary" />
        
        {/* Dropdown Options */}
        <div className="absolute top-full left-2 right-2 mt-1 z-40 bg-discordex-surface border border-discordex-border rounded-xl hidden group-hover:block shadow-2xl p-1.5 animate-fade-in">
          <button 
            onClick={() => openModal('join-server')}
            className="w-full flex items-center gap-2 px-3 py-2 text-xs font-semibold text-discordex-success hover:bg-discordex-success/10 rounded-lg transition-colors text-left"
          >
            <UserPlus className="w-4 h-4" />
            Convidar Pessoas
          </button>
          <button 
            onClick={() => openSettings('Servidores', activeServer.id)}
            className="w-full flex items-center gap-2 px-3 py-2 text-xs font-semibold text-discordex-text-primary hover:bg-discordex-hover rounded-lg transition-colors text-left"
          >
            <Settings className="w-4 h-4" />
            Configurações do Servidor
          </button>
          <div className="h-px bg-discordex-border my-1" />
          <button 
            onClick={() => deleteServer(activeServer.id)}
            className="w-full flex items-center gap-2 px-3 py-2 text-xs font-semibold text-discordex-danger hover:bg-discordex-danger/10 rounded-lg transition-colors text-left"
          >
            <LogOut className="w-4 h-4" />
            Sair do Servidor
          </button>
        </div>
      </div>

      {/* Channel lists */}
      <div className="flex-1 overflow-y-auto px-2 py-3 space-y-4">
        {canManageChannels && (
          <button
            onClick={() => openModal('create-category')}
            className="w-full flex items-center gap-2 px-2 py-1.5 rounded-lg text-[10px] font-bold text-discordex-text-secondary uppercase tracking-wider hover:text-discordex-text-primary hover:bg-discordex-hover/50 transition-colors"
          >
            <FolderPlus className="w-3.5 h-3.5" />
            Criar categoria
          </button>
        )}

        {activeServer.categories.map(category => renderCategoryGroup(category, collapsed.has(category.id)))}

        {uncategorized.length > 0 && (
          <div className="space-y-0.5">
            <div className="flex items-center justify-between px-2 text-[10px] font-bold text-discordex-text-secondary uppercase tracking-wider group/cat">
              <span>Sem categoria</span>
              {canManageChannels && (
                <button 
                  onClick={() => openModal('create-channel')}
                  className="hover:text-discordex-text-primary transition-colors"
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

      {/* Voice Status Overlay panel */}
      {callState.isActive && callState.channelId && (
        <div className="p-3 bg-discordex-surface border-t border-discordex-border flex flex-col gap-2">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2 min-w-0">
              <div className="w-2 h-2 rounded-full bg-discordex-success animate-ping" />
              <div className="min-w-0">
                <span className="block text-[10px] font-bold text-discordex-success uppercase tracking-wider">
                  Voz Conectada
                </span>
                <span className="block text-[11px] text-discordex-text-primary truncate font-medium">
                  {callState.channelName}
                </span>
              </div>
            </div>
            
            <Tooltip content="Desconectar chamada" position="top">
              <button 
                onClick={endCall}
                className="w-8 h-8 rounded-lg bg-discordex-danger/10 hover:bg-discordex-danger text-discordex-danger hover:text-white flex items-center justify-center transition-colors"
              >
                <PhoneOff className="w-4.5 h-4.5" />
              </button>
            </Tooltip>
          </div>
        </div>
      )}

      {/* User Footer Panel */}
      <div className="h-[52px] bg-discordex-bg px-2.5 flex items-center justify-between border-t border-discordex-border/40">
        
        {/* User Card trigger */}
        <div 
          onClick={() => openModal('profile-view', currentUser)}
          className="flex items-center gap-2 cursor-pointer hover:bg-discordex-surface/60 p-1 rounded-lg transition-colors min-w-0 flex-1 mr-1"
        >
          <div className="relative shrink-0">
            <img 
              src={currentUser.avatar} 
              alt={currentUser.displayName} 
              className="w-8 h-8 rounded-full object-cover"
            />
            <div className="absolute bottom-0 right-0 w-2.5 h-2.5 rounded-full border border-discordex-bg bg-discordex-success" />
          </div>
          <div className="min-w-0 leading-tight">
            <span className="block text-xs font-bold text-discordex-text-primary truncate">
              {currentUser.displayName}
            </span>
            <span className="block text-[9px] text-discordex-text-secondary truncate">
              @{currentUser.username}
            </span>
          </div>
        </div>

        {/* Buttons Panel */}
        <div className="flex items-center gap-0.5 shrink-0">
          <Tooltip content={callState.isMuted ? "Ativar Microfone" : "Silenciar"} position="top">
            <button 
              onClick={toggleMute}
              className={`w-7.5 h-7.5 rounded-lg flex items-center justify-center transition-colors ${
                callState.isMuted 
                  ? 'bg-discordex-danger/10 text-discordex-danger hover:bg-discordex-danger/25' 
                  : 'text-discordex-text-secondary hover:text-discordex-text-primary hover:bg-discordex-surface'
              }`}
            >
              {callState.isMuted ? <MicOff className="w-4 h-4" /> : <Mic className="w-4 h-4" />}
            </button>
          </Tooltip>

          <Tooltip content={callState.isCameraOn ? "Desativar Câmera" : "Ativar Câmera"} position="top">
            <button 
              onClick={toggleCamera}
              className={`w-7.5 h-7.5 rounded-lg flex items-center justify-center transition-colors ${
                callState.isCameraOn 
                  ? 'bg-discordex-success/15 text-discordex-success hover:bg-discordex-success/30' 
                  : 'text-discordex-text-secondary hover:text-discordex-text-primary hover:bg-discordex-surface'
              }`}
            >
              {callState.isCameraOn ? <Video className="w-4 h-4" /> : <VideoOff className="w-4 h-4" />}
            </button>
          </Tooltip>

          <Tooltip content="Configurações do Usuário" position="top">
            <button 
              onClick={() => openSettings('Minha conta')}
              className="w-7.5 h-7.5 rounded-lg text-discordex-text-secondary hover:text-discordex-text-primary hover:bg-discordex-surface flex items-center justify-center transition-colors"
            >
              <Settings className="w-4 h-4" />
            </button>
          </Tooltip>
        </div>

      </div>
    </div>
  );
};