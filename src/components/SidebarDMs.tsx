import React from 'react';
import { useApp } from '../context/AppContext';
import { Tooltip } from './SharedUI';
import { useContextMenu } from './ContextMenu';
import { buildDmMenu } from '../lib/contextActions';
import { Users, Settings } from 'lucide-react';

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
    <div className="w-60 bg-discordex-secondary flex flex-col justify-between shrink-0 h-full border-r border-discordex-border/40 select-none">
      
      {/* Search Header */}
      <div className="h-12 px-4 border-b border-discordex-border flex items-center justify-between shrink-0">
        <button 
          onClick={() => {
            setActiveDmId(null);
          }}
          className={`flex-1 flex items-center gap-2 px-3 py-1.5 rounded-xl border border-discordex-border/60 hover:border-primary text-left text-xs font-semibold transition-all ${
            activeDmId === null ? 'bg-discordex-surface text-discordex-text-primary' : 'bg-discordex-bg text-discordex-text-secondary hover:text-discordex-text-primary'
          }`}
        >
          <Users className="w-4 h-4" />
          Amigos / Solicitações
        </button>
      </div>

      {/* Conversations lists scroll view */}
      <div className="flex-1 overflow-y-auto px-2 py-3 space-y-4">
        
        <div className="space-y-1">
          <div className="flex items-center justify-between px-2 text-[10px] font-bold text-discordex-text-secondary/70 uppercase tracking-wider mb-2">
            <span>Mensagens Diretas</span>
          </div>

          <div className="space-y-0.5">
            {dms.map(dm => {
              const isActive = activeDmId === dm.id;
              
              return (
                <div
                  key={dm.id}
                  onClick={() => setActiveDmId(dm.id)}
                  onContextMenu={(event) => openMenu(event, buildDmMenu(app, { dm }))}
                  className={`flex items-center gap-2.5 px-2 py-2 rounded-xl group cursor-pointer transition-all ${
                    isActive 
                      ? 'bg-discordex-hover text-discordex-text-primary' 
                      : 'text-discordex-text-secondary hover:bg-discordex-hover/50 hover:text-discordex-text-primary'
                  }`}
                >
                  {/* Status avatar */}
                  <div className="relative shrink-0">
                    <img 
                      src={dm.user.avatar} 
                      alt={dm.user.displayName} 
                      className="w-8 h-8 rounded-full object-cover"
                    />
                    <div className={`absolute bottom-0 right-0 w-2.5 h-2.5 rounded-full border border-discordex-bg ${
                      dm.user.status === 'online' ? 'bg-discordex-success' :
                      dm.user.status === 'idle' ? 'bg-discordex-warning' :
                      dm.user.status === 'dnd' ? 'bg-discordex-danger' :
                      'bg-discordex-text-secondary'
                    }`} />
                  </div>

                  {/* Details */}
                  <div className="min-w-0 flex-1 leading-tight">
                    <span className="block text-xs font-bold truncate">
                      {dm.user.displayName}
                    </span>
                    <span className="block text-[10px] text-discordex-text-secondary/50 truncate">
                      {dm.user.status === 'online' ? 'Online' : 'Offline'}
                    </span>
                  </div>

                  {/* Unread badge */}
                  {dm.unreadCount > 0 && (
                    <div className="bg-primary text-white text-[9px] font-black px-1.5 py-0.5 rounded-full shrink-0">
                      {dm.unreadCount}
                    </div>
                  )}

                </div>
              );
            })}
          </div>
        </div>

      </div>

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
            <span className="block text-[9px] text-discordex-text-secondary truncate font-mono">
              @{currentUser.username}
            </span>
          </div>
        </div>

        {/* Buttons Panel */}
        <div className="flex items-center gap-0.5 shrink-0">
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
