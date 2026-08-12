import React, { useState } from 'react';
import { useApp } from '../context/AppContext';
import { Users, Phone, Video, MessageSquare, Check, X } from 'lucide-react';
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
    <div className="flex-1 bg-discordex-bg flex flex-col h-full select-none">
      
      {/* Friends Sub-header navbar */}
      <div className="h-12 px-5 border-b border-discordex-border flex items-center gap-6 shrink-0">
        <div className="flex items-center gap-2 text-discordex-text-primary font-bold text-xs">
          <Users className="w-4 h-4 text-discordex-text-secondary" />
          <span>Amigos</span>
        </div>

        <div className="w-[1px] h-4 bg-discordex-border" />

        {/* Tab buttons */}
        <div className="flex items-center gap-2.5">
          {[
            { id: 'online', label: 'Disponíveis' },
            { id: 'all', label: 'Todos' },
            { id: 'pending', label: 'Pendentes' },
          ].map(tab => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id as any)}
              className={`px-3 py-1 rounded-lg text-xs font-semibold transition-all ${
                activeTab === tab.id 
                  ? 'bg-discordex-surface text-discordex-text-primary' 
                  : 'text-discordex-text-secondary hover:bg-discordex-surface/40 hover:text-discordex-text-primary'
              }`}
            >
              {tab.label}
              {tab.id === 'pending' && pendingRequests.length > 0 && (
                <span className="ml-1.5 px-1.5 py-0.5 rounded-full bg-primary text-white text-[9px] font-black">
                  {pendingRequests.length}
                </span>
              )}
            </button>
          ))}

          <button
            onClick={() => setActiveTab('add')}
            className={`px-3 py-1 rounded-lg text-xs font-bold transition-all ${
              activeTab === 'add' 
                ? 'bg-primary text-white' 
                : 'bg-discordex-success/10 text-discordex-success hover:bg-discordex-success/20'
            }`}
          >
            Adicionar Amigo
          </button>
        </div>
      </div>

      {/* Main Friends List panel */}
      <div className="flex-1 overflow-y-auto p-6">
        
        {/* ADD FRIEND TAB VIEW */}
        {activeTab === 'add' && (
          <div className="max-w-md space-y-4">
            <div className="space-y-1.5">
              <h3 className="text-sm font-bold text-discordex-text-primary uppercase tracking-wider">Adicionar Amigo</h3>
              <p className="text-xs text-discordex-text-secondary">Você pode adicionar amigos com o nome de usuário do Discordex.</p>
            </div>
            
            <form onSubmit={handleAddFriendSubmit} className="relative">
              <input 
                type="text" 
                value={friendUsername}
                onChange={(e) => setFriendUsername(e.target.value)}
                placeholder="Insira um Nome de Usuário (ex: joao_dev)" 
                className="w-full px-4 py-3 bg-discordex-secondary border border-discordex-border rounded-xl text-xs text-discordex-text-primary placeholder:text-discordex-text-secondary/40 focus:outline-none focus:border-primary transition-colors pr-24"
                required
                autoFocus
              />
              <button 
                type="submit"
                className="absolute right-2 top-1.5 bottom-1.5 px-4 bg-primary hover:bg-primary-hover text-white rounded-lg text-xs font-semibold transition-colors"
              >
                Enviar solicitação
              </button>
            </form>
          </div>
        )}

        {/* PENDING REQUESTS TAB VIEW */}
        {activeTab === 'pending' && (
          <div className="space-y-3">
            <span className="block text-[10px] font-bold text-discordex-text-secondary uppercase tracking-wider mb-2">
              Solicitações de Amizade — {pendingRequests.length}
            </span>

            {pendingRequests.length === 0 ? (
              <p className="text-xs text-discordex-text-secondary/50 italic">Nenhuma solicitação pendente.</p>
            ) : (
              pendingRequests.map(req => (
                <div key={req.id} className="flex items-center justify-between p-3 bg-discordex-secondary border border-discordex-border rounded-2xl hover:border-discordex-text-secondary/30 transition-all max-w-xl">
                  <div className="flex items-center gap-3">
                    <img src={req.avatar} alt={req.displayName} className="w-9 h-9 rounded-full object-cover" />
                    <div>
                      <span className="block text-xs font-bold text-discordex-text-primary">{req.displayName}</span>
                      <span className="block text-[9px] text-discordex-text-secondary">@{req.username}</span>
                    </div>
                  </div>

                  <div className="flex gap-2">
                    <button 
                      onClick={() => req.friendshipId && respondFriendRequest(req.friendshipId, 'accepted')}
                      className="w-8 h-8 rounded-lg bg-discordex-success/10 hover:bg-discordex-success text-discordex-success hover:text-white flex items-center justify-center transition-colors"
                    >
                      <Check className="w-4.5 h-4.5" />
                    </button>
                    <button 
                      onClick={() => req.friendshipId && respondFriendRequest(req.friendshipId, 'declined')}
                      className="w-8 h-8 rounded-lg bg-discordex-danger/10 hover:bg-discordex-danger text-discordex-danger hover:text-white flex items-center justify-center transition-colors"
                    >
                      <X className="w-4.5 h-4.5" />
                    </button>
                  </div>
                </div>
              ))
            )}
          </div>
        )}

        {/* REGULAR FRIENDS VIEW (ONLINE / ALL) */}
        {activeTab !== 'add' && activeTab !== 'pending' && (
          <div className="space-y-2 max-w-2xl">
            <span className="block text-[10px] font-bold text-discordex-text-secondary uppercase tracking-wider mb-4">
              Todos os Amigos ({displayFriends.length})
            </span>

            {displayFriends.length === 0 ? (
              <p className="text-xs text-discordex-text-secondary/50 italic">Nenhum amigo encontrado.</p>
            ) : (
              displayFriends.map(friend => (
                <div 
                  key={friend.id}
                  className="flex items-center justify-between p-3 bg-discordex-secondary border border-discordex-border rounded-2xl hover:bg-discordex-surface/40 hover:border-discordex-text-secondary/20 transition-all group"
                >
                  {/* Info details */}
                  <div className="flex items-center gap-3 min-w-0">
                    
                    {/* status avatar */}
                    <div className="relative shrink-0">
                      <img 
                        src={friend.avatar} 
                        alt={friend.displayName} 
                        className="w-9 h-9 rounded-full object-cover"
                      />
                      <div className={`absolute bottom-0 right-0 w-2.5 h-2.5 rounded-full border border-discordex-bg ${
                        friend.status === 'online' ? 'bg-discordex-success' :
                        friend.status === 'idle' ? 'bg-discordex-warning' :
                        friend.status === 'dnd' ? 'bg-discordex-danger' :
                        'bg-discordex-text-secondary'
                      }`} />
                    </div>

                    <div className="min-w-0 leading-tight">
                      <span className="block text-xs font-bold text-discordex-text-primary truncate">
                        {friend.displayName}
                      </span>
                      <span className="block text-[10px] text-discordex-text-secondary truncate mt-0.5">
                        @{friend.username} {friend.bio ? `• ${friend.bio}` : ''}
                      </span>
                    </div>

                  </div>

                  {/* Actions buttons */}
                  <div className="flex items-center gap-2 shrink-0">
                    <Tooltip content="Enviar Mensagem Direta" position="top">
                      <button 
                        onClick={() => setActiveDmId(friend.id)}
                        className="w-8 h-8 rounded-lg bg-discordex-surface hover:bg-discordex-hover text-discordex-text-secondary hover:text-discordex-text-primary flex items-center justify-center transition-colors border border-discordex-border"
                      >
                        <MessageSquare className="w-4 h-4" />
                      </button>
                    </Tooltip>

                    <Tooltip content="Iniciar Chamada de Voz" position="top">
                      <button 
                        onClick={() => startCall('voice', friend.id, friend.displayName, false, friend.avatar)}
                        className="w-8 h-8 rounded-lg bg-discordex-surface hover:bg-discordex-hover text-discordex-text-secondary hover:text-discordex-text-primary flex items-center justify-center transition-colors border border-discordex-border"
                      >
                        <Phone className="w-4 h-4" />
                      </button>
                    </Tooltip>

                    <Tooltip content="Iniciar Chamada de Vídeo" position="top">
                      <button 
                        onClick={() => startCall('video', friend.id, friend.displayName, false, friend.avatar)}
                        className="w-8 h-8 rounded-lg bg-discordex-surface hover:bg-discordex-hover text-discordex-text-secondary hover:text-discordex-text-primary flex items-center justify-center transition-colors border border-discordex-border"
                      >
                        <Video className="w-4 h-4" />
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
