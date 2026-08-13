import React from 'react';
import { useApp } from '../context/AppContext';
import { Tooltip } from './SharedUI';
import { useContextMenu } from './ContextMenu';
import { buildDmMenu } from '../lib/contextActions';
import { Users, Gear } from '@phosphor-icons/react';

export const SidebarDMs: React.FC = () => {
  const app = useApp();
  const {
    dms,
    activeDmId,
    setActiveDmId,
    currentUser,
    openSettings,
    openModal
  } = app;

  const { openMenu } = useContextMenu();

  return (
    <div className="w-60 bg-signal-secondary flex flex-col justify-between shrink-0 h-full border-r border-signal-border/40 select-none">

      {/* Header de busca */}
      <div className="h-12 px-4 border-b border-signal-border flex items-center justify-between shrink-0">
        <button
          onClick={() => {
            setActiveDmId(null);
          }}
          className={`flex-1 flex items-center gap-2 px-3 py-1.5 rounded-md border border-signal-border/60 hover:border-brass/50 text-left text-xs font-semibold transition-all ${
            activeDmId === null ? 'bg-signal-surface text-signal-text-primary' : 'bg-signal-bg text-signal-text-secondary hover:text-signal-text-primary'
          }`}
        >
          <Users className="w-4 h-4" />
          Amigos / Solicitações
        </button>
      </div>

      {/* Lista de conversas */}
      <div className="flex-1 overflow-y-auto px-2 py-3 space-y-4">

        <div className="space-y-1">
          <div className="flex items-center justify-between px-2 text-[10px] font-bold text-signal-text-secondary/70 uppercase tracking-wider mb-2">
            <span>Frequências Diretas</span>
          </div>

          <div className="space-y-0.5">
            {dms.map(dm => {
              const isActive = activeDmId === dm.id;

              return (
                <div
                  key={dm.id}
                  onClick={() => setActiveDmId(dm.id)}
                  onContextMenu={(event) => openMenu(event, buildDmMenu(app, { dm }))}
                  className={`relative flex items-center gap-2.5 px-2 py-2 rounded-md group cursor-pointer transition-all ${
                    isActive
                      ? 'bg-signal-hover text-signal-text-primary'
                      : 'text-signal-text-secondary hover:bg-signal-hover/50 hover:text-signal-text-primary'
                  }`}
                >
                  {isActive && <span className="absolute left-0 top-1/2 -translate-y-1/2 w-0.5 h-4 bg-brass rounded-r-full" />}

                  {/* Avatar de status */}
                  <div className="relative shrink-0">
                    <img
                      src={dm.user.avatar}
                      alt={dm.user.displayName}
                      className="w-8 h-8 rounded-full object-cover"
                    />
                    <div className={`absolute bottom-0 right-0 w-2.5 h-2.5 rounded-full border border-signal-bg ${
                      dm.user.status === 'online' ? 'bg-signal-success' :
                      dm.user.status === 'idle' ? 'bg-signal-warning' :
                      dm.user.status === 'dnd' ? 'bg-signal-danger' :
                      'bg-signal-text-secondary'
                    }`} />
                  </div>

                  {/* Detalhes */}
                  <div className="min-w-0 flex-1 leading-tight">
                    <span className="block text-xs font-bold truncate">
                      {dm.user.displayName}
                    </span>
                    <span className="block text-[10px] text-signal-text-secondary/50 truncate font-mono">
                      @{dm.user.username}
                    </span>
                  </div>

                  {/* Badge de não lida */}
                  {dm.unreadCount > 0 && (
                    <div className="bg-brass text-signal-bg text-[9px] font-black px-1.5 py-0.5 rounded-full shrink-0">
                      {dm.unreadCount}
                    </div>
                  )}

                </div>
              );
            })}
          </div>
        </div>

      </div>

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