import React from 'react';
import { useApp } from '../context/AppContext';
import { Tooltip, TransmitMeter } from './SharedUI';
import { useContextMenu } from './ContextMenu';
import { buildServerMenu } from '../lib/contextActions';
import { Plus, Compass, Gear } from '@phosphor-icons/react';
import { connectionLabel } from '../lib/station';

export const SidebarServers: React.FC = () => {
  const app = useApp();
  const {
    servers,
    activeServerId,
    setActiveServerId,
    setActiveChannelId,
    openModal,
    openSettings,
    connectionState
  } = app;

  const { openMenu } = useContextMenu();

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

  const connectionVUState = connectionState === 'online' ? 'live' : connectionState === 'connecting' || connectionState === 'reconnecting' ? 'scan' : 'idle';

  return (
    <div className="w-[76px] bg-signal-bg flex flex-col items-center py-3 border-r border-signal-border/40 shrink-0 h-full justify-between">
      {/* Upper part */}
      <div className="flex flex-col items-center gap-2.5 w-full">
        {/* Estação padrão (Home / Rede de contatos) */}
        <Tooltip content="Discordex Home" position="right">
          <button
            onClick={() => handleSelectServer(null)}
            className={`relative w-12 h-12 rounded-full flex items-center justify-center transition-all duration-200 group overflow-hidden ${
              activeServerId === null
                ? 'bg-brass text-signal-bg border border-brass'
                : 'bg-signal-surface text-brass border border-signal-border hover:border-brass/40'
            }`}
          >
            {activeServerId === null && <span className="dial-tick" style={{ transform: 'rotate(45deg)' }} />}
            <span className="font-display font-bold tracking-tight text-[11px]">DX</span>
          </button>
        </Tooltip>

        <div className="w-8 h-[2px] bg-signal-border rounded-full my-1" />

        {/* Estações (servidores) */}
        <div className="flex flex-col items-center gap-2 w-full overflow-y-auto max-h-[calc(100vh-320px)] no-scrollbar">
          {servers.map(server => {
            const isActive = activeServerId === server.id;

            return (
              <Tooltip key={server.id} content={server.name} position="right">
                <button
                  onClick={() => handleSelectServer(server.id)}
                  onContextMenu={(event) => openMenu(event, buildServerMenu(app, { server }))}
                  className={`relative w-12 h-12 rounded-full flex items-center justify-center transition-all duration-200 group overflow-hidden ${
                    isActive
                      ? 'bg-signal-surface text-brass border border-brass/50 shadow-brass'
                      : 'bg-signal-surface text-signal-text-secondary border border-signal-border hover:text-signal-text-primary hover:border-brass/30'
                  }`}
                >
                  {/* Tick do dial — ponteiro de sintonia */}
                  <span
                    className={`dial-tick ${isActive ? 'opacity-100' : 'opacity-0 group-hover:opacity-60'}`}
                    style={{ transform: `rotate(${isActive ? 45 : 110}deg)` }}
                  />

                  {/* Ícone/Iniciais da estação */}
                  {server.iconUrl ? (
                    <img
                      src={server.iconUrl}
                      alt={server.name}
                      className="w-full h-full object-cover rounded-full select-none"
                      onError={(event) => {
                        (event.currentTarget as HTMLImageElement).style.display = 'none';
                      }}
                    />
                  ) : (
                    <span className="font-bold text-sm select-none">{server.icon}</span>
                  )}

                  {/* Badge de notificação — âmbar */}
                  {server.unreadCount && server.unreadCount > 0 ? (
                    <div className="absolute bottom-0.5 right-0.5 bg-brass text-signal-bg text-[9px] font-black w-4.5 h-4.5 rounded-full flex items-center justify-center border-2 border-signal-bg">
                      {server.unreadCount}
                    </div>
                  ) : server.hasNotification ? (
                    <div className="absolute bottom-1.5 right-1.5 bg-brass w-2.5 h-2.5 rounded-full border-2 border-signal-bg" />
                  ) : null}
                </button>
              </Tooltip>
            );
          })}
        </div>

        {/* Ações */}
        <Tooltip content="Adicionar estação" position="right">
          <button
            onClick={() => openModal('create-server')}
            className="w-12 h-12 rounded-full bg-signal-surface text-signal-text-secondary border border-signal-border hover:bg-signal-success hover:text-signal-bg hover:border-signal-success flex items-center justify-center transition-all duration-200"
          >
            <Plus className="w-5 h-5" />
          </button>
        </Tooltip>

        <Tooltip content="Entrar via convite" position="right">
          <button
            onClick={() => openModal('join-server')}
            className="w-12 h-12 rounded-full bg-signal-surface text-signal-text-secondary border border-signal-border hover:bg-brass hover:text-signal-bg hover:border-brass flex items-center justify-center transition-all duration-200"
          >
            <Compass className="w-5 h-5" />
          </button>
        </Tooltip>
      </div>

      {/* Controles inferiores */}
      <div className="flex flex-col items-center gap-3">
        {/* Indicador de conexão — mini VU de 3 barras */}
        <Tooltip content={`Conexão: ${connectionLabel(connectionState)}`} position="right">
          <button
            type="button"
            className="w-10 h-9 rounded-md flex items-center justify-center bg-signal-surface border border-signal-border hover:border-brass/40 transition-colors"
          >
            <TransmitMeter bars={3} state={connectionVUState} />
          </button>
        </Tooltip>

        <Tooltip content="Configurações Gerais" position="right">
          <button
            onClick={() => openSettings('Minha conta')}
            className="w-10 h-10 rounded-full bg-signal-surface text-signal-text-secondary border border-signal-border hover:text-signal-text-primary hover:border-brass/40 flex items-center justify-center transition-colors"
          >
            <Gear className="w-4.5 h-4.5" />
          </button>
        </Tooltip>
      </div>
    </div>
  );
};