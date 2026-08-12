import React from 'react';
import { useApp } from '../context/AppContext';
import { Tooltip } from './SharedUI';
import { Compass, Plus, Settings } from 'lucide-react';

export const SidebarServers: React.FC = () => {
  const { 
    servers, 
    activeServerId, 
    setActiveServerId, 
    setActiveChannelId,
    openModal,
    openSettings,
    connectionState
  } = useApp();

  const handleSelectServer = (serverId: string | null) => {
    setActiveServerId(serverId);
    if (serverId === null) {
      setActiveChannelId(null);
    } else {
      const srv = servers.find(s => s.id === serverId);
      if (srv && srv.channels.length > 0) {
        setActiveChannelId(srv.channels[0].id);
      }
    }
  };

  return (
    <div className="w-[72px] bg-discordex-bg flex flex-col items-center py-3 border-r border-discordex-border/40 shrink-0 h-full justify-between">
      {/* Upper part */}
      <div className="flex flex-col items-center gap-2.5 w-full">
        {/* Discordex Logo / Home button */}
        <Tooltip content="Discordex Home" position="right">
          <button 
            onClick={() => handleSelectServer(null)}
            className={`w-12 h-12 rounded-2xl flex items-center justify-center transition-all duration-200 relative group overflow-hidden ${
              activeServerId === null 
                ? 'bg-primary text-white rounded-[14px]' 
                : 'bg-discordex-surface text-primary hover:bg-primary hover:text-white hover:rounded-[14px]'
            }`}
          >
            {/* Active Server indicator */}
            {activeServerId === null && (
              <div className="absolute left-0 w-1 h-5 bg-white rounded-r-full" />
            )}
            <span className="font-black tracking-wider text-[11px]">DX</span>
          </button>
        </Tooltip>

        <div className="w-8 h-[2px] bg-discordex-border rounded-full my-1" />

        {/* Server Items */}
        <div className="flex flex-col items-center gap-2 w-full overflow-y-auto max-h-[calc(100vh-320px)] no-scrollbar">
          {servers.map(server => {
            const isActive = activeServerId === server.id;
            
            return (
              <Tooltip key={server.id} content={server.name} position="right">
                <button
                  onClick={() => handleSelectServer(server.id)}
                  className={`w-12 h-12 flex items-center justify-center transition-all duration-200 relative group overflow-hidden ${
                    isActive 
                      ? 'bg-primary text-white rounded-[14px]' 
                      : 'bg-discordex-surface text-discordex-text-secondary hover:bg-primary hover:text-white hover:rounded-[14px]'
                  }`}
                >
                  {/* Left indicator pill */}
                  <div className={`absolute left-0 w-1 bg-white rounded-r-full transition-all duration-200 ${
                    isActive ? 'h-8' : 'h-2 scale-0 group-hover:scale-100 group-hover:h-5'
                  }`} />
                  
                  {/* Server Icon/Initials */}
                  {server.iconUrl ? (
                    <img
                      src={server.iconUrl}
                      alt={server.name}
                      className="w-full h-full object-cover rounded-[14px] select-none"
                      onError={(event) => {
                        (event.currentTarget as HTMLImageElement).style.display = 'none';
                      }}
                    />
                  ) : (
                    <span className="font-bold text-sm select-none">{server.icon}</span>
                  )}

                  {/* Red notification dot */}
                  {server.unreadCount && server.unreadCount > 0 ? (
                    <div className="absolute bottom-1 right-1 bg-primary text-white text-[9px] font-black w-4.5 h-4.5 rounded-full flex items-center justify-center border-2 border-discordex-bg">
                      {server.unreadCount}
                    </div>
                  ) : server.hasNotification ? (
                    <div className="absolute bottom-1.5 right-1.5 bg-primary w-2.5 h-2.5 rounded-full border-2 border-discordex-bg" />
                  ) : null}
                </button>
              </Tooltip>
            );
          })}
        </div>

        {/* Action icons */}
        <Tooltip content="Adicionar Servidor" position="right">
          <button 
            onClick={() => openModal('create-server')}
            className="w-12 h-12 rounded-2xl bg-discordex-surface text-discordex-text-secondary hover:bg-discordex-success hover:text-white hover:rounded-[14px] flex items-center justify-center transition-all duration-200"
          >
            <Plus className="w-5 h-5" />
          </button>
        </Tooltip>

        <Tooltip content="Entrar via Convite" position="right">
          <button 
            onClick={() => openModal('join-server')}
            className="w-12 h-12 rounded-2xl bg-discordex-surface text-discordex-text-secondary hover:bg-primary hover:text-white hover:rounded-[14px] flex items-center justify-center transition-all duration-200"
          >
            <Compass className="w-5 h-5" />
          </button>
        </Tooltip>
      </div>

      {/* Bottom control part */}
      <div className="flex flex-col items-center gap-3">
        {/* Connection status indicator */}
        <Tooltip content={`Conexão: ${connectionState}`} position="right">
          <button
            type="button"
            className="w-8 h-8 rounded-full flex items-center justify-center bg-discordex-surface border border-discordex-border hover:border-primary transition-colors"
          >
            <div className={`w-3.5 h-3.5 rounded-full ${
              connectionState === 'online' ? 'bg-discordex-success' :
              connectionState === 'connecting' ? 'bg-discordex-warning animate-pulse' :
              connectionState === 'reconnecting' ? 'bg-discordex-warning animate-spin border-2 border-dashed border-discordex-bg' :
              'bg-discordex-danger'
            }`} />
          </button>
        </Tooltip>

        <Tooltip content="Configurações Gerais" position="right">
          <button 
            onClick={() => openSettings('Minha conta')}
            className="w-10 h-10 rounded-xl bg-discordex-surface text-discordex-text-secondary hover:text-discordex-text-primary flex items-center justify-center transition-colors border border-discordex-border"
          >
            <Settings className="w-4.5 h-4.5" />
          </button>
        </Tooltip>
      </div>
    </div>
  );
};
