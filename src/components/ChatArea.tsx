import React, { useState, useRef, useEffect } from 'react';
import { useApp } from '../context/AppContext';
import type { User } from '../context/AppContext';
import {
  Hash, Waveform, MagnifyingGlass, PaperPlaneTilt, Smiley, ArrowBendUpLeft,
  VideoCamera, Phone, ArrowLeft, ImageSquare, CircleNotch
} from '@phosphor-icons/react';
import { Tooltip, TransmitMeter } from './SharedUI';
import { useContextMenu } from './ContextMenu';
import { supabase } from '../lib/supabase';
import { PERMISSIONS, hasPermission } from '../lib/permissions';
import { buildMessageMenu } from '../lib/contextActions';
import { channelFrequency } from '../lib/station';

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

  // Contexto do chat ativo
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

  // Rolagem automática
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [currentMessages, activeChannelId, activeDmId]);

  const speakingUserIds = new Set(
    callState.isActive ? callState.participants.filter(p => p.isSpeaking).map(p => p.id) : []
  );

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
            className="max-w-sm max-h-96 rounded-md border border-signal-border my-1 object-contain"
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
    <div className="flex-1 bg-signal-bg flex flex-col min-w-0 h-full relative">

      {/* Header */}
      <div className="h-12 px-4 border-b border-signal-border flex items-center justify-between shrink-0 shadow-sm">

        {/* Informações do título */}
        <div className="flex items-center gap-2 min-w-0">
          {/* Voltar (mobile) */}
          <button
            onClick={() => {
              if (onToggleSidebar) onToggleSidebar();
            }}
            className="md:hidden p-1.5 rounded-md text-signal-text-secondary hover:text-signal-text-primary hover:bg-signal-surface transition-colors"
          >
            <ArrowLeft className="w-4 h-4" />
          </button>

          {activeServerId ? (
            isVoiceChannel ? (
              <Waveform className="w-5 h-5 text-signal-text-secondary" />
            ) : (
              <Hash className="w-5 h-5 text-signal-text-secondary" />
            )
          ) : (
            <div className="w-2.5 h-2.5 rounded-full bg-signal-success shrink-0 shadow-[0_0_5px_rgba(79,178,134,0.7)]" />
          )}
          <span className="font-display font-bold text-[14px] text-signal-text-primary truncate">
            {chatTitle || 'Selecione um canal'}
          </span>
          {isVoiceChannel && (
            <span className="font-mono text-[10px] text-signal-text-secondary/70 tabular-nums">
              {activeChatId ? channelFrequency(activeChatId) : ''}
            </span>
          )}
          {chatDesc && (
            <>
              <div className="w-[1px] h-4 bg-signal-border mx-1 shrink-0" />
              <span className="text-xs text-signal-text-secondary truncate font-normal">
                {chatDesc}
              </span>
            </>
          )}
        </div>

        {/* Controles do header */}
        <div className="flex items-center gap-3">

          {/* Console de chamada */}
          {(isVoiceChannel || activeDmId) && !callState.isActive && (
            <div className="flex items-center gap-0.5 bg-signal-surface border border-signal-border p-0.5 rounded-md">
              <Tooltip content="Iniciar chamada de Voz" position="bottom">
                <button
                  onClick={() => handleTriggerCall('voice')}
                  className="p-1.5 rounded-md text-signal-text-secondary hover:text-signal-text-primary hover:bg-signal-hover transition-colors"
                >
                  <Phone className="w-4 h-4" />
                </button>
              </Tooltip>
              <Tooltip content="Iniciar chamada de Vídeo" position="bottom">
                <button
                  onClick={() => handleTriggerCall('video')}
                  className="p-1.5 rounded-md text-signal-text-secondary hover:text-signal-text-primary hover:bg-signal-hover transition-colors"
                >
                  <VideoCamera className="w-4 h-4" />
                </button>
              </Tooltip>
            </div>
          )}

          {/* Busca — tom de console */}
          <div className="relative hidden sm:block">
            <input
              type="text"
              placeholder="> buscar…"
              value={searchVal}
              onChange={(e) => setSearchVal(e.target.value)}
              className="w-40 focus:w-56 px-3 py-1.5 pr-8 bg-signal-secondary border border-signal-border rounded-md text-xs font-mono text-signal-text-primary placeholder:text-signal-text-secondary/40 focus:outline-none focus:border-brass transition-all duration-200"
            />
            <MagnifyingGlass className="w-3.5 h-3.5 text-signal-text-secondary/50 absolute right-2.5 top-1/2 -translate-y-1/2" />
          </div>

        </div>
      </div>

      {/* Área de mensagens */}
      <div className="flex-1 overflow-y-auto px-4 py-4 space-y-4">

        {/* Prompt de entrada em canal de voz */}
        {isVoiceChannel && !callState.isActive && (
          <div className="max-w-md mx-auto my-12 bg-signal-surface border border-signal-border panel-cut p-6 text-center space-y-4 shadow-float-lg">
            <div className="w-14 h-14 bg-brass/10 rounded-full flex items-center justify-center mx-auto text-brass">
              <Waveform className="w-7 h-7" />
            </div>
            <div className="space-y-1.5">
              <h3 className="text-lg font-display font-bold text-signal-text-primary">
                Frequência {activeChatId ? channelFrequency(activeChatId) : ''} — {chatTitle}
              </h3>
              <p className="text-xs text-signal-text-secondary max-w-sm mx-auto leading-relaxed">
                Você pode entrar para conversar por voz, compartilhar sua tela, ou ligar sua câmera de vídeo.
              </p>
            </div>
            <button
              onClick={() => handleTriggerCall('voice')}
              className="px-6 py-3 bg-brass hover:bg-brass-hover text-signal-bg rounded-md text-sm font-bold transition-colors"
            >
              Entrar na frequência
            </button>
          </div>
        )}

        {/* Feed de mensagens */}
        {(!isVoiceChannel || callState.isActive) && (
          <>
            {filteredMessages.length === 0 ? (
              <div className="h-full flex flex-col items-center justify-center text-center p-6 space-y-2 opacity-60">
                <span className="text-3xl">📻</span>
                <p className="text-sm font-bold text-signal-text-primary">Nenhuma transmissão por aqui</p>
                <p className="text-xs text-signal-text-secondary">Seja o primeiro a transmitir neste canal!</p>
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
                const isSenderSpeaking = speakingUserIds.has(msg.userId);

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
                    className="group relative flex flex-col gap-1 hover:bg-signal-surface/20 -mx-4 px-4 py-2 rounded-md transition-colors"
                  >

                    {/* Cabeçalho de resposta */}
                    {msg.replyTo && (
                      <div className="flex items-center gap-1.5 text-xs text-signal-text-secondary/70 pl-9 mb-1">
                        <ArrowBendUpLeft className="w-3.5 h-3.5 text-signal-text-secondary/40" />
                        <span className="font-semibold text-signal-text-secondary">
                          @{msg.replyTo.userName}
                        </span>
                        <span className="truncate max-w-xs">{msg.replyTo.content}</span>
                      </div>
                    )}

                    {/* Corpo padrão */}
                    <div className="flex gap-3">

                      {/* Avatar (pessoa = círculo) */}
                      <button
                        onClick={() => openModal('profile-view', senderUserObj)}
                        className="shrink-0 focus:outline-none relative self-start"
                      >
                        <img
                          src={msg.userAvatar}
                          alt={msg.userName}
                          className="w-9 h-9 rounded-full object-cover border border-signal-border/40"
                        />
                        {isSenderSpeaking && (
                          <span className="absolute -bottom-1.5 left-1/2 -translate-x-1/2">
                            <TransmitMeter bars={4} className="h-2" />
                          </span>
                        )}
                      </button>

                      {/* Bloco principal da mensagem */}
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1">
                          <button
                            onClick={() => openModal('profile-view', senderUserObj)}
                            className="font-bold text-xs text-signal-text-primary hover:underline hover:text-brass transition-colors text-left"
                          >
                            {msg.userName}
                          </button>

                          {/* Badge de cargo */}
                          {msg.userRole && (
                            <span
                              className="px-1.5 py-0.5 rounded-md text-[9px] font-bold"
                              style={msg.userRoleColor ? { color: msg.userRoleColor, backgroundColor: `${msg.userRoleColor}1A` } : undefined}
                            >
                              {msg.userRole}
                            </span>
                          )}

                          <span className="text-[10px] text-signal-text-secondary/60 font-mono">
                            {msg.timestamp}
                          </span>
                        </div>
                        <div className="text-xs text-signal-text-secondary leading-relaxed whitespace-pre-wrap">
                          {renderMessageContent(msg.content)}
                        </div>

                        {/* Reações */}
                        {msg.reactions && msg.reactions.length > 0 && (
                          <div className="flex flex-wrap gap-1.5 mt-2">
                            {msg.reactions.map(react => (
                              <button
                                key={react.emoji}
                                onClick={() => handleReactionClick(msg.id, react.emoji)}
                                className={`px-2 py-0.5 rounded-md border text-xs font-semibold flex items-center gap-1 transition-all ${
                                  react.userReacted
                                    ? 'bg-brass/10 border-brass text-brass'
                                    : 'bg-signal-surface border-signal-border text-signal-text-secondary hover:border-signal-text-primary'
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

                    {/* Toolbar de hover */}
                    <div className="absolute right-4 -top-3.5 opacity-0 group-hover:opacity-100 transition-opacity glass-panel rounded-md flex items-center p-0.5 shadow-float-lg z-20">

                      {/* Opções de reação */}
                      {['👍', '❤️', '😂', '🔥', '🚀'].map(emoji => (
                        <button
                          key={emoji}
                          onClick={() => handleReactionClick(msg.id, emoji)}
                          className="p-1.5 hover:bg-signal-hover rounded-md text-xs transition-colors"
                        >
                          {emoji}
                        </button>
                      ))}

                      <div className="w-[1px] h-4 bg-signal-border mx-1" />

                      <button
                        onClick={() => setReplyTarget({ userName: msg.userName, content: msg.content })}
                        className="px-2 py-1.5 text-[10px] font-bold text-signal-text-secondary hover:text-signal-text-primary rounded-md transition-colors hover:bg-signal-hover"
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

      {/* Console de envio */}
      {(!isVoiceChannel || callState.isActive) && activeChatId && (
        <div className="p-4 border-t border-signal-border bg-signal-bg shrink-0">

          {/* Banner de resposta ativa */}
          {replyTarget && (
            <div className="flex items-center justify-between bg-signal-surface border border-signal-border px-4 py-2 rounded-t-md text-xs -mb-1 animate-fade-in border-b-0">
              <div className="flex items-center gap-1.5 text-signal-text-secondary">
                <span>Respondendo a</span>
                <span className="font-bold text-signal-text-primary">@{replyTarget.userName}</span>
              </div>
              <button
                onClick={() => setReplyTarget(null)}
                className="text-signal-text-secondary hover:text-signal-text-primary"
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
              placeholder={`Transmitir em #${chatTitle || ''}…`}
              className={`w-full px-4 pl-10 py-3 bg-signal-secondary border border-signal-border text-xs text-signal-text-primary placeholder:text-signal-text-secondary/40 focus:outline-none focus:border-brass transition-all pr-24 ${
                replyTarget ? 'rounded-b-md' : 'rounded-md'
              }`}
            />

            {/* Upload de imagem */}
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
              className="absolute left-3 top-1/2 -translate-y-1/2 p-1.5 text-signal-text-secondary hover:text-signal-text-primary rounded-md transition-colors disabled:opacity-50"
            >
              {imageUploading ? <CircleNotch className="w-5 h-5 animate-spin" /> : <ImageSquare className="w-5 h-5" />}
            </button>

            {/* Ferramentas */}
            <div className="absolute right-3 top-1/2 -translate-y-1/2 flex items-center gap-1">

              {/* Emoji */}
              <div className="relative">
                <button
                  type="button"
                  onClick={() => setShowEmojiPicker(!showEmojiPicker)}
                  className="p-1.5 text-signal-text-secondary hover:text-signal-text-primary rounded-md transition-colors"
                >
                  <Smiley className="w-5 h-5" />
                </button>

                {showEmojiPicker && (
                  <div className="absolute bottom-full right-0 mb-3 bg-signal-surface border border-signal-border p-2 rounded-md shadow-float-lg flex gap-1 z-30 animate-slide-up">
                    {['👍', '❤️', '😂', '🔥', '🚀', '🎉', '💩', '👀'].map(emoji => (
                      <button
                        key={emoji}
                        type="button"
                        onClick={() => insertEmoji(emoji)}
                        className="w-8 h-8 flex items-center justify-center hover:bg-signal-hover rounded-md text-lg transition-colors"
                      >
                        {emoji}
                      </button>
                    ))}
                  </div>
                )}
              </div>

              {/* Enviar */}
              <button
                type="submit"
                disabled={!inputVal.trim()}
                className="p-1.5 bg-brass disabled:bg-brass/20 text-signal-bg rounded-md transition-colors"
              >
                <PaperPlaneTilt className="w-4 h-4" />
              </button>

            </div>
          </form>
        </div>
      )}
    </div>
  );
};