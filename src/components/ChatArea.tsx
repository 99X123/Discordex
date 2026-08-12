import React, { useState, useRef, useEffect } from 'react';
import { useApp } from '../context/AppContext';
import type { User } from '../context/AppContext';
import { 
  Hash, Volume2, Search, Send, Smile, CornerDownLeft, 
  Video, Phone, ArrowLeft, ImagePlus, Loader2
} from 'lucide-react';
import { Tooltip } from './SharedUI';
import { useContextMenu } from './ContextMenu';
import { supabase } from '../lib/supabase';
import { PERMISSIONS, hasPermission } from '../lib/permissions';
import { buildMessageMenu } from '../lib/contextActions';

const isImageLine = (line: string): boolean => {
  const t = line.trim();
  if (!/^https?:\/\/\S+$/i.test(t)) return false;
  if (/\.(png|jpe?g|gif|webp|bmp)(\?|$)/i.test(t)) return true;
  if (/https:\/\/[a-z0-9]+\.supabase\.co\/storage\/v1\/object\/public\/avatars\//i.test(t)) return true;
  return false;
};

export const ChatArea: React.FC<{ onToggleSidebar?: () => void }> = ({ onToggleSidebar }) => {
  const app = useApp();
  const {
    servers,
    activeServerId,
    activeChannelId,
    activeDmId,
    messages,
    dms,
    friends,
    sendMessage,
    toggleReaction,
    startCall,
    callState,
    openModal,
    currentUser,
    addToast,
    getMyPermissions,
  } = app;

  const { openMenu } = useContextMenu();

  const [inputVal, setInputVal] = useState('');
  const [replyTarget, setReplyTarget] = useState<{ userName: string; content: string } | null>(null);
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);
  const [searchVal, setSearchVal] = useState('');
  const [imageUploading, setImageUploading] = useState(false);

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const imageInputRef = useRef<HTMLInputElement>(null);

  // Retrieve current chat container context
  let chatTitle = '';
  let chatDesc = '';
  let isVoiceChannel = false;
  let activeChatId = '';

  const activeServer = servers.find(s => s.id === activeServerId);

  if (activeServerId && activeServer) {
    const channel = activeServer.channels.find(c => c.id === activeChannelId);
    if (channel) {
      chatTitle = channel.name;
      chatDesc = channel.description || '';
      isVoiceChannel = channel.type === 'voice';
      activeChatId = channel.id;
    }
  } else if (activeDmId) {
    const dm = dms.find(d => d.user.id === activeDmId);
    if (dm) {
      chatTitle = dm.user.displayName;
      chatDesc = `@${dm.user.username} • Direct Message`;
      activeChatId = dm.user.id;
    }
  }

  const currentMessages = messages[activeChatId] || [];

  // Scroll to bottom when messages load/change
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [currentMessages, activeChannelId, activeDmId]);

  const handleSend = (e: React.FormEvent) => {
    e.preventDefault();
    if (!inputVal.trim()) return;

    sendMessage(inputVal.trim(), replyTarget || undefined);
    setInputVal('');
    setReplyTarget(null);
  };

  const handleImageSelect = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file || !currentUser) return;

    if (!file.type.startsWith('image/')) {
      addToast('O arquivo selecionado nao e uma imagem.', 'error');
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      addToast('Imagem muito grande. O limite e 5 MB.', 'error');
      return;
    }

    setImageUploading(true);
    const extension = file.name.split('.').pop()?.toLowerCase() || 'png';
    const filePath = `${currentUser.id}/chat/${Date.now()}.${extension}`;

    const { error } = await supabase.storage
      .from('avatars')
      .upload(filePath, file, {
        cacheControl: '3600',
        upsert: true,
        contentType: file.type,
      });

    setImageUploading(false);

    if (error) {
      addToast(error.message || 'Nao foi possivel enviar a imagem.', 'error');
      return;
    }

    const { data } = supabase.storage.from('avatars').getPublicUrl(filePath);
    const caption = inputVal.trim();
    sendMessage(caption ? `${caption}\n${data.publicUrl}` : data.publicUrl, replyTarget || undefined);
    setInputVal('');
    setReplyTarget(null);
  };

  const renderMessageContent = (content: string) => {
    const lines = content.split('\n');
    return lines.map((line, i) => {
      if (isImageLine(line)) {
        return (
          <img
            key={i}
            src={line.trim()}
            alt="Imagem"
            loading="lazy"
            className="max-w-sm max-h-96 rounded-xl border border-discordex-border my-1 object-contain"
          />
        );
      }
      return (
        <span key={i}>
          {line}
          {i < lines.length - 1 ? '\n' : ''}
        </span>
      );
    });
  };

  const insertEmoji = (emoji: string) => {
    setInputVal((prev: string) => prev + emoji);
    setShowEmojiPicker(false);
  };

  const handleReactionClick = (msgId: string, emoji: string) => {
    toggleReaction(msgId, emoji);
  };

  const handleTriggerCall = (type: 'voice' | 'video') => {
    if (activeChatId) {
      const activeDm = dms.find(d => d.user.id === activeDmId);
      startCall(type, activeChatId, chatTitle, false, activeDm?.user.avatar);
    }
  };

  const filteredMessages = currentMessages.filter(msg => 
    msg.content.toLowerCase().includes(searchVal.toLowerCase()) || 
    msg.userName.toLowerCase().includes(searchVal.toLowerCase())
  );

  const isDM = Boolean(!activeServerId && activeDmId);
  const messagePerms = activeServerId ? getMyPermissions(activeServerId) : { isOwner: false, permissions: 0, topPosition: -1 };
  const canManageMessages = messagePerms.isOwner || hasPermission(messagePerms.permissions, PERMISSIONS.MANAGE_MESSAGES);

  return (
    <div className="flex-1 bg-discordex-bg flex flex-col min-w-0 h-full relative">
      
      {/* Top Header */}
      <div className="h-12 px-4 border-b border-discordex-border flex items-center justify-between shrink-0 shadow-sm">
        
        {/* Title Info */}
        <div className="flex items-center gap-2 min-w-0">
          {/* Mobile Back to Servers Button */}
          <button 
            onClick={() => {
              if (onToggleSidebar) onToggleSidebar();
            }}
            className="md:hidden p-1.5 rounded-lg text-discordex-text-secondary hover:text-discordex-text-primary hover:bg-discordex-surface transition-colors"
          >
            <ArrowLeft className="w-4 h-4" />
          </button>

          {activeServerId ? (
            isVoiceChannel ? (
              <Volume2 className="w-5 h-5 text-discordex-text-secondary" />
            ) : (
              <Hash className="w-5 h-5 text-discordex-text-secondary" />
            )
          ) : (
            <div className="w-2.5 h-2.5 rounded-full bg-discordex-success shrink-0" />
          )}
          <span className="font-bold text-[14px] text-discordex-text-primary truncate">
            {chatTitle || 'Selecione um canal'}
          </span>
          {chatDesc && (
            <>
              <div className="w-[1px] h-4 bg-discordex-border mx-1 shrink-0" />
              <span className="text-xs text-discordex-text-secondary truncate font-normal">
                {chatDesc}
              </span>
            </>
          )}
        </div>

        {/* Header Controls */}
        <div className="flex items-center gap-3">
          
          {/* Voice/Video shortcuts */}
          {(isVoiceChannel || activeDmId) && !callState.isActive && (
            <div className="flex items-center gap-1 bg-discordex-surface border border-discordex-border p-0.5 rounded-xl">
              <Tooltip content="Iniciar chamada de Voz" position="bottom">
                <button 
                  onClick={() => handleTriggerCall('voice')}
                  className="p-1.5 rounded-lg text-discordex-text-secondary hover:text-discordex-text-primary hover:bg-discordex-hover transition-colors"
                >
                  <Phone className="w-4 h-4" />
                </button>
              </Tooltip>
              <Tooltip content="Iniciar chamada de Vídeo" position="bottom">
                <button 
                  onClick={() => handleTriggerCall('video')}
                  className="p-1.5 rounded-lg text-discordex-text-secondary hover:text-discordex-text-primary hover:bg-discordex-hover transition-colors"
                >
                  <Video className="w-4 h-4" />
                </button>
              </Tooltip>
            </div>
          )}

          {/* Search box */}
          <div className="relative hidden sm:block">
            <input 
              type="text" 
              placeholder="Buscar" 
              value={searchVal}
              onChange={(e) => setSearchVal(e.target.value)}
              className="w-40 focus:w-56 px-3 py-1.5 pr-8 bg-discordex-secondary border border-discordex-border rounded-xl text-xs text-discordex-text-primary placeholder:text-discordex-text-secondary/40 focus:outline-none focus:border-primary transition-all duration-200"
            />
            <Search className="w-3.5 h-3.5 text-discordex-text-secondary/50 absolute right-2.5 top-1/2 -translate-y-1/2" />
          </div>

        </div>
      </div>

      {/* Messages / Call View area */}
      <div className="flex-1 overflow-y-auto px-4 py-4 space-y-4">
        
        {/* If Voice Channel & not in call, show join prompt */}
        {isVoiceChannel && !callState.isActive && (
          <div className="max-w-md mx-auto my-12 bg-discordex-surface border border-discordex-border rounded-2xl p-6 text-center space-y-4 shadow-xl">
            <div className="w-14 h-14 bg-primary/10 rounded-full flex items-center justify-center mx-auto text-primary">
              <Volume2 className="w-7 h-7" />
            </div>
            <div className="space-y-1.5">
              <h3 className="text-lg font-bold text-discordex-text-primary">Canal de Voz: {chatTitle}</h3>
              <p className="text-xs text-discordex-text-secondary max-w-sm mx-auto leading-relaxed">
                Você pode entrar para conversar por voz, compartilhar sua tela, ou ligar sua câmera de vídeo.
              </p>
            </div>
            <button 
              onClick={() => handleTriggerCall('voice')}
              className="px-6 py-3 bg-primary hover:bg-primary-hover text-white rounded-xl text-sm font-semibold transition-colors"
            >
              Entrar no Canal de Voz
            </button>
          </div>
        )}

        {/* Regular Message Feed */}
        {(!isVoiceChannel || callState.isActive) && (
          <>
            {filteredMessages.length === 0 ? (
              <div className="h-full flex flex-col items-center justify-center text-center p-6 space-y-2 opacity-60">
                <span className="text-3xl">💬</span>
                <p className="text-sm font-bold text-discordex-text-primary">Nenhuma mensagem por aqui</p>
                <p className="text-xs text-discordex-text-secondary">Seja o primeiro a enviar uma mensagem neste canal!</p>
              </div>
            ) : (
              filteredMessages.map((msg) => {
                const senderUserObj: User = friends.find(f => f.id === msg.userId) || {
                  id: msg.userId,
                  displayName: msg.userName,
                  username: msg.userName.toLowerCase().replace(/\s/g, ''),
                  avatar: msg.userAvatar,
                  status: 'online',
                  role: msg.userRole as User['role']
                };

                return (
                  <div
                    key={msg.id}
                    onContextMenu={(event) => openMenu(
                      event,
                      buildMessageMenu(app, {
                        message: msg,
                        author: senderUserObj,
                        isDM,
                        canManageMessages,
                        onReply: (message) => setReplyTarget({ userName: message.userName, content: message.content }),
                      })
                    )}
                    className="group relative flex flex-col gap-1 hover:bg-discordex-surface/20 -mx-4 px-4 py-2 rounded-xl transition-colors"
                  >
                    
                    {/* Reply quote indicator header */}
                    {msg.replyTo && (
                      <div className="flex items-center gap-1.5 text-xs text-discordex-text-secondary/70 pl-9 mb-1">
                        <CornerDownLeft className="w-3.5 h-3.5 text-discordex-text-secondary/40" />
                        <span className="font-semibold text-discordex-text-secondary">
                          @{msg.replyTo.userName}
                        </span>
                        <span className="truncate max-w-xs">{msg.replyTo.content}</span>
                      </div>
                    )}

                    {/* Standard Body */}
                    <div className="flex gap-3">
                      
                      {/* Avatar */}
                      <button 
                        onClick={() => openModal('profile-view', senderUserObj)}
                        className="shrink-0 focus:outline-none"
                      >
                        <img 
                          src={msg.userAvatar} 
                          alt={msg.userName} 
                          className="w-9 h-9 rounded-full object-cover border border-discordex-border/40"
                        />
                      </button>

                      {/* Main Message Block */}
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1">
                          <button 
                            onClick={() => openModal('profile-view', senderUserObj)}
                            className="font-bold text-xs text-discordex-text-primary hover:underline hover:text-primary transition-colors text-left"
                          >
                            {msg.userName}
                          </button>
                          
                          {/* Role Badge */}
                          {msg.userRole && (
                            <span
                              className="px-1.5 py-0.5 rounded text-[9px] font-bold"
                              style={msg.userRoleColor ? { color: msg.userRoleColor, backgroundColor: `${msg.userRoleColor}1A` } : undefined}
                            >
                              {msg.userRole}
                            </span>
                          )}

                          <span className="text-[10px] text-discordex-text-secondary/60">
                            {msg.timestamp}
                          </span>
                        </div>
                        <div className="text-xs text-discordex-text-secondary leading-relaxed whitespace-pre-wrap">
                          {renderMessageContent(msg.content)}
                        </div>

                        {/* Reactions list */}
                        {msg.reactions && msg.reactions.length > 0 && (
                          <div className="flex flex-wrap gap-1.5 mt-2">
                            {msg.reactions.map(react => (
                              <button
                                key={react.emoji}
                                onClick={() => handleReactionClick(msg.id, react.emoji)}
                                className={`px-2 py-0.5 rounded-lg border text-xs font-semibold flex items-center gap-1 transition-all ${
                                  react.userReacted 
                                    ? 'bg-primary/10 border-primary text-primary' 
                                    : 'bg-discordex-surface border-discordex-border text-discordex-text-secondary hover:border-discordex-text-primary'
                                }`}
                              >
                                <span>{react.emoji}</span>
                                <span className="text-[10px]">{react.count}</span>
                              </button>
                            ))}
                          </div>
                        )}
                      </div>

                    </div>

                    {/* Toolbar overlays */}
                    <div className="absolute right-4 -top-3.5 opacity-0 group-hover:opacity-100 transition-opacity bg-discordex-surface border border-discordex-border rounded-xl flex items-center p-0.5 shadow-xl z-20">
                      
                      {/* React options */}
                      {['👍', '❤️', '😂', '🔥', '🚀'].map(emoji => (
                        <button
                          key={emoji}
                          onClick={() => handleReactionClick(msg.id, emoji)}
                          className="p-1.5 hover:bg-discordex-hover rounded-lg text-xs transition-colors"
                        >
                          {emoji}
                        </button>
                      ))}
                      
                      <div className="w-[1px] h-4 bg-discordex-border mx-1" />

                      <button
                        onClick={() => setReplyTarget({ userName: msg.userName, content: msg.content })}
                        className="px-2 py-1.5 text-[10px] font-bold text-discordex-text-secondary hover:text-discordex-text-primary rounded-lg transition-colors hover:bg-discordex-hover"
                      >
                        Responder
                      </button>
                    </div>

                  </div>
                );
              })
            )}
            <div ref={messagesEndRef} />
          </>
        )}
      </div>

      {/* Input Message Composers */}
      {(!isVoiceChannel || callState.isActive) && activeChatId && (
        <div className="p-4 border-t border-discordex-border bg-discordex-bg shrink-0">
          
          {/* Active Reply Banner */}
          {replyTarget && (
            <div className="flex items-center justify-between bg-discordex-surface border border-discordex-border px-4 py-2 rounded-t-xl text-xs -mb-1 animate-fade-in border-b-0">
              <div className="flex items-center gap-1.5 text-discordex-text-secondary">
                <span>Respondendo a</span>
                <span className="font-bold text-discordex-text-primary">@{replyTarget.userName}</span>
              </div>
              <button 
                onClick={() => setReplyTarget(null)}
                className="text-discordex-text-secondary hover:text-discordex-text-primary"
              >
                Cancelar
              </button>
            </div>
          )}

          <form onSubmit={handleSend} className="relative">
            <input 
              type="text" 
              value={inputVal}
              onChange={(e) => setInputVal(e.target.value)}
              placeholder={`Escreva uma mensagem em #${chatTitle || ''}...`}
              className={`w-full px-4 pl-10 py-3 bg-discordex-secondary border border-discordex-border text-xs text-discordex-text-primary placeholder:text-discordex-text-secondary/40 focus:outline-none focus:border-primary transition-all pr-24 ${
                replyTarget ? 'rounded-b-2xl' : 'rounded-2xl'
              }`}
            />

            {/* Image upload */}
            <input
              ref={imageInputRef}
              type="file"
              accept="image/*"
              className="hidden"
              onChange={handleImageSelect}
            />
            <button
              type="button"
              onClick={() => imageInputRef.current?.click()}
              disabled={imageUploading}
              className="absolute left-3 top-1/2 -translate-y-1/2 p-1.5 text-discordex-text-secondary hover:text-discordex-text-primary rounded-lg transition-colors disabled:opacity-50"
            >
              {imageUploading ? <Loader2 className="w-5 h-5 animate-spin" /> : <ImagePlus className="w-5 h-5" />}
            </button>

            {/* Inputs Tools icons */}
            <div className="absolute right-3 top-1/2 -translate-y-1/2 flex items-center gap-1">
              
              {/* Emoji icon and picker */}
              <div className="relative">
                <button
                  type="button"
                  onClick={() => setShowEmojiPicker(!showEmojiPicker)}
                  className="p-1.5 text-discordex-text-secondary hover:text-discordex-text-primary rounded-lg transition-colors"
                >
                  <Smile className="w-5 h-5" />
                </button>

                {showEmojiPicker && (
                  <div className="absolute bottom-full right-0 mb-3 bg-discordex-surface border border-discordex-border p-2 rounded-2xl shadow-2xl flex gap-1 z-30 animate-slide-up">
                    {['👍', '❤️', '😂', '🔥', '🚀', '🎉', '💩', '👀'].map(emoji => (
                      <button
                        key={emoji}
                        type="button"
                        onClick={() => insertEmoji(emoji)}
                        className="w-8 h-8 flex items-center justify-center hover:bg-discordex-hover rounded-xl text-lg transition-colors"
                      >
                        {emoji}
                      </button>
                    ))}
                  </div>
                )}
              </div>

              {/* Submit button */}
              <button
                type="submit"
                disabled={!inputVal.trim()}
                className="p-1.5 bg-primary disabled:bg-primary/20 text-white rounded-lg transition-colors"
              >
                <Send className="w-4 h-4" />
              </button>

            </div>
          </form>
        </div>
      )}
    </div>
  );
};
