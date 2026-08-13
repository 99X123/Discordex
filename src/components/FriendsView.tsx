import React, { useState } from 'react';
import { useApp } from '../context/AppContext';
import { Users, Phone, VideoCamera, ChatText, Check, X } from '@phosphor-icons/react';
import { Tooltip } from './SharedUI';

export const FriendsView: React.FC = () => {
  const {
    friends,
    pendingRequests,
    setActiveDmId,
    startCall,
    sendFriendRequest,
    respondFriendRequest
  } = useApp();

  const [activeTab, setActiveTab] = useState<'online' | 'all' | 'pending' | 'add'>('online');
  const [friendUsername, setFriendUsername] = useState('');

  const displayFriends = friends.filter(friend => {
    if (activeTab === 'online') return friend.status !== 'offline';
    return true;
  });

  const handleAddFriendSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (friendUsername.trim()) {
      sendFriendRequest(friendUsername);
      setFriendUsername('');
      setActiveTab('online');
    }
  };

  return (
    <div className="flex-1 bg-signal-bg flex flex-col h-full select-none">

      {/* Sub-header de Amigos */}
      <div className="h-12 px-5 border-b border-signal-border flex items-center gap-6 shrink-0">
        <div className="flex items-center gap-2 text-signal-text-primary font-display font-bold text-xs">
          <Users className="w-4 h-4 text-signal-text-secondary" />
          <span>Amigos</span>
        </div>

        <div className="w-[1px] h-4 bg-signal-border" />

        {/* Abas */}
        <div className="flex items-center gap-2.5">
          {[
            { id: 'online', label: 'Disponíveis' },
            { id: 'all', label: 'Todos' },
            { id: 'pending', label: 'Pendentes' },
          ].map(tab => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id as any)}
              className={`px-3 py-1 rounded-md text-xs font-semibold transition-all ${
                activeTab === tab.id
                  ? 'bg-signal-surface text-signal-text-primary'
                  : 'text-signal-text-secondary hover:bg-signal-surface/40 hover:text-signal-text-primary'
              }`}
            >
              {tab.label}
              {tab.id === 'pending' && pendingRequests.length > 0 && (
                <span className="ml-1.5 px-1.5 py-0.5 rounded-full bg-brass text-signal-bg text-[9px] font-black">
                  {pendingRequests.length}
                </span>
              )}
            </button>
          ))}

          <button
            onClick={() => setActiveTab('add')}
            className={`px-3 py-1 rounded-md text-xs font-bold transition-all ${
              activeTab === 'add'
                ? 'bg-brass text-signal-bg'
                : 'bg-signal-success/10 text-signal-success hover:bg-signal-success/20'
            }`}
          >
            Adicionar Amigo
          </button>
        </div>
      </div>

      {/* Lista principal */}
      <div className="flex-1 overflow-y-auto p-6">

        {/* ABA ADICIONAR */}
        {activeTab === 'add' && (
          <div className="max-w-md space-y-4">
            <div className="space-y-1.5">
              <h3 className="text-sm font-display font-bold text-signal-text-primary uppercase tracking-wider">Adicionar Amigo</h3>
              <p className="text-xs text-signal-text-secondary">Você pode adicionar amigos com o nome de usuário do Discordex.</p>
            </div>

            <form onSubmit={handleAddFriendSubmit} className="relative">
              <input
                type="text"
                value={friendUsername}
                onChange={(e) => setFriendUsername(e.target.value)}
                placeholder="Insira um Nome de Usuário (ex: joao_dev)"
                className="w-full px-4 py-3 bg-signal-secondary border border-signal-border rounded-md text-xs text-signal-text-primary placeholder:text-signal-text-secondary/40 focus:outline-none focus:border-brass transition-colors pr-24"
                required
                autoFocus
              />
              <button
                type="submit"
                className="absolute right-2 top-1.5 bottom-1.5 px-4 bg-brass hover:bg-brass-hover text-signal-bg rounded-md text-xs font-bold transition-colors"
              >
                Enviar solicitação
              </button>
            </form>
          </div>
        )}

        {/* ABA PENDENTES */}
        {activeTab === 'pending' && (
          <div className="space-y-3">
            <span className="block text-[10px] font-bold text-signal-text-secondary uppercase tracking-wider mb-2 font-mono">
              Solicitações de Amizade — {pendingRequests.length}
            </span>

            {pendingRequests.length === 0 ? (
              <p className="text-xs text-signal-text-secondary/50 italic">Nenhuma solicitação pendente.</p>
            ) : (
              pendingRequests.map(req => (
                <div key={req.id} className="flex items-center justify-between p-3 bg-signal-secondary border border-signal-border panel-cut-sm hover:border-signal-text-secondary/30 transition-all max-w-xl">
                  <div className="flex items-center gap-3">
                    <img src={req.avatar} alt={req.displayName} className="w-9 h-9 rounded-full object-cover" />
                    <div>
                      <span className="block text-xs font-bold text-signal-text-primary">{req.displayName}</span>
                      <span className="block text-[9px] text-signal-text-secondary font-mono">@{req.username}</span>
                    </div>
                  </div>

                  <div className="flex gap-2">
                    <button
                      onClick={() => req.friendshipId && respondFriendRequest(req.friendshipId, 'accepted')}
                      className="w-8 h-8 rounded-md bg-signal-success/10 hover:bg-signal-success text-signal-success hover:text-white flex items-center justify-center transition-colors"
                    >
                      <Check className="w-4.5 h-4.5" />
                    </button>
                    <button
                      onClick={() => req.friendshipId && respondFriendRequest(req.friendshipId, 'declined')}
                      className="w-8 h-8 rounded-md bg-signal-danger/10 hover:bg-signal-danger text-signal-danger hover:text-white flex items-center justify-center transition-colors"
                    >
                      <X className="w-4.5 h-4.5" />
                    </button>
                  </div>
                </div>
              ))
            )}
          </div>
        )}

        {/* VISÃO REGULAR (DISPONÍVEIS / TODOS) */}
        {activeTab !== 'add' && activeTab !== 'pending' && (
          <div className="space-y-2 max-w-2xl">
            <span className="block text-[10px] font-bold text-signal-text-secondary uppercase tracking-wider mb-4 font-mono">
              Todos os Amigos ({displayFriends.length})
            </span>

            {displayFriends.length === 0 ? (
              <p className="text-xs text-signal-text-secondary/50 italic">Nenhum amigo encontrado.</p>
            ) : (
              displayFriends.map(friend => (
                <div
                  key={friend.id}
                  className="flex items-center justify-between p-3 bg-signal-secondary border border-signal-border panel-cut-sm hover:bg-signal-surface/40 hover:border-signal-text-secondary/20 transition-all group"
                >
                  {/* Informações */}
                  <div className="flex items-center gap-3 min-w-0">

                    {/* Avatar de status */}
                    <div className="relative shrink-0">
                      <img
                        src={friend.avatar}
                        alt={friend.displayName}
                        className="w-9 h-9 rounded-full object-cover"
                      />
                      <div className={`absolute bottom-0 right-0 w-2.5 h-2.5 rounded-full border border-signal-bg ${
                        friend.status === 'online' ? 'bg-signal-success shadow-[0_0_4px_rgba(79,178,134,0.6)]' :
                        friend.status === 'idle' ? 'bg-signal-warning shadow-[0_0_4px_rgba(226,133,59,0.6)]' :
                        friend.status === 'dnd' ? 'bg-signal-danger shadow-[0_0_4px_rgba(217,96,75,0.6)]' :
                        'bg-signal-text-secondary'
                      }`} />
                    </div>

                    <div className="min-w-0 leading-tight">
                      <span className="block text-xs font-bold text-signal-text-primary truncate">
                        {friend.displayName}
                      </span>
                      <span className="block text-[10px] text-signal-text-secondary truncate mt-0.5 font-mono">
                        @{friend.username} {friend.bio ? `• ${friend.bio}` : ''}
                      </span>
                    </div>

                  </div>

                  {/* Ações */}
                  <div className="flex items-center gap-2 shrink-0">
                    <Tooltip content="Enviar Mensagem Direta" position="top">
                      <button
                        onClick={() => setActiveDmId(friend.id)}
                        className="w-8 h-8 rounded-md bg-signal-surface hover:bg-signal-hover text-signal-text-secondary hover:text-signal-text-primary flex items-center justify-center transition-colors border border-signal-border"
                      >
                        <ChatText className="w-4 h-4" />
                      </button>
                    </Tooltip>

                    <Tooltip content="Iniciar Chamada de Voz" position="top">
                      <button
                        onClick={() => startCall('voice', friend.id, friend.displayName, false, friend.avatar)}
                        className="w-8 h-8 rounded-md bg-signal-surface hover:bg-signal-hover text-signal-text-secondary hover:text-signal-text-primary flex items-center justify-center transition-colors border border-signal-border"
                      >
                        <Phone className="w-4 h-4" />
                      </button>
                    </Tooltip>

                    <Tooltip content="Iniciar Chamada de Vídeo" position="top">
                      <button
                        onClick={() => startCall('video', friend.id, friend.displayName, false, friend.avatar)}
                        className="w-8 h-8 rounded-md bg-signal-surface hover:bg-signal-hover text-signal-text-secondary hover:text-signal-text-primary flex items-center justify-center transition-colors border border-signal-border"
                      >
                        <VideoCamera className="w-4 h-4" />
                      </button>
                    </Tooltip>
                  </div>

                </div>
              ))
            )}

          </div>
        )}

      </div>

    </div>
  );
};