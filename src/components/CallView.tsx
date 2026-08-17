import React, { useEffect, useRef, useState } from 'react';
import { useApp } from '../context/AppContext';
import { Tooltip, TransmitMeter } from './SharedUI';
import { useContextMenu } from './ContextMenu';
import { PERMISSIONS, hasPermission } from '../lib/permissions';
import { buildUserMenu } from '../lib/contextActions';
import {
  Microphone, MicrophoneSlash, VideoCamera, VideoCameraSlash, Presentation,
  PhoneSlash, WifiHigh, Users, SpeakerHigh, SpeakerSlash, ArrowsOutSimple, ArrowsInSimple, ArrowRight,
} from '@phosphor-icons/react';

export const CallView: React.FC = () => {
  const app = useApp();
  const {
    callState,
    currentUser,
    endCall,
    toggleMute,
    toggleCamera,
    toggleScreenShare,
    toggleSpeakerMute,
    servers,
    serverMembers,
    getMyPermissions,
    disconnectMemberFromCall,
    moveMemberBetweenChannels,
    setMemberMuted,
    setMemberDeafened,
    addToast,
  } = app;

  const { openMenu } = useContextMenu();
  const containerRef = useRef<HTMLDivElement>(null);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [forcedFullscreen, setForcedFullscreen] = useState(false);
  const [moveMenuFor, setMoveMenuFor] = useState<string | null>(null);
  const [deafenedMap, setDeafenedMap] = useState<Record<string, boolean>>({});
  const [expandedScreen, setExpandedScreen] = useState<{ id: string; stream: MediaStream; name: string } | null>(null);

  const callServer = servers.find((server) =>
    server.channels.some((channel) => channel.id === callState.channelId && channel.type === 'voice')
  );

  const myPerms = callServer ? getMyPermissions(callServer.id) : { permissions: 0, isOwner: false, topPosition: -1 };
  const hasPerm = (bit: number) => myPerms.isOwner || hasPermission(myPerms.permissions, bit);

  const targetTopPosition = (userId: string) => {
    const member = (serverMembers[callServer?.id || ''] || []).find((m) => m.userId === userId);
    return member?.roles?.[0]?.position ?? -1;
  };

  const canManage = (userId: string) => myPerms.isOwner || myPerms.topPosition > targetTopPosition(userId);

  useEffect(() => {
    const handler = () => {
      setIsFullscreen(Boolean(document.fullscreenElement));
      if (!document.fullscreenElement) setForcedFullscreen(false);
    };
    document.addEventListener('fullscreenchange', handler);
    return () => document.removeEventListener('fullscreenchange', handler);
  }, []);

  useEffect(() => {
    if (!expandedScreen) return;
    if (!callState.isActive) { setExpandedScreen(null); return; }
    const liveStreams = expandedScreen.id === currentUser.id
      ? (callState.screenStream || null)
      : (callState.remoteScreenStreams?.[expandedScreen.id] || null);
    if (liveStreams !== expandedScreen.stream) setExpandedScreen(null);
  }, [callState.screenStream, callState.remoteScreenStreams, callState.isActive, expandedScreen, currentUser.id]);

  const toggleFullscreen = () => {
    if (document.fullscreenElement || forcedFullscreen) {
      setForcedFullscreen(false);
      void document.exitFullscreen().catch(() => { /* ignore */ });
    } else if (containerRef.current) {
      void containerRef.current
        .requestFullscreen({ navigationUI: 'hide' } as FullscreenOptions)
        .catch(() => {
          setForcedFullscreen(true);
          addToast('Tela cheia nativa bloqueada pelo navegador. Usando modo expandido.', 'info');
        });
    }
  };

  if (!callState.isActive) return null;

  const { localStream, remoteStreams, remoteScreenStreams, screenStream } = callState;

  return (
    <div
      ref={containerRef}
      className={`flex-1 bg-black border-b border-signal-border flex flex-col relative overflow-hidden ${
        isFullscreen || forcedFullscreen
          ? 'fixed inset-0 z-[70] h-screen max-h-screen border-b-0'
          : 'h-[360px] shrink-0'
      }`}
    >

      {/* Barra de status da conexão */}
      <div className="absolute top-4 left-4 z-30 bg-black/60 backdrop-blur-md px-3 py-1.5 rounded-md border border-signal-border/40 flex items-center gap-2.5">
        {callState.ringing ? (
          <SpeakerHigh className="w-4 h-4 text-signal-warning animate-pulse" />
        ) : (
          <WifiHigh className="w-4 h-4 text-signal-success" />
        )}
        <span className="text-xs text-signal-text-primary font-bold font-mono">
          {callState.ringing ? 'CHAMANDO…' : 'TRANSMISSÃO ATIVA'}
        </span>
        <div className="w-[1px] h-3 bg-signal-border" />
        <Users className="w-3.5 h-3.5 text-signal-text-secondary" />
        <span className="text-[10px] text-signal-text-secondary font-mono">{callState.participants.length}</span>
      </div>

      <button
        onClick={toggleFullscreen}
        className="absolute top-4 right-4 z-30 w-8 h-8 rounded-md bg-black/60 backdrop-blur-md border border-signal-border/40 flex items-center justify-center text-signal-text-secondary hover:text-signal-text-primary hover:bg-black/80 transition-colors"
        title={(isFullscreen || forcedFullscreen) ? 'Sair da tela cheia' : 'Tela cheia'}
      >
        {(isFullscreen || forcedFullscreen) ? <ArrowsInSimple className="w-4 h-4" /> : <ArrowsOutSimple className="w-4 h-4" />}
      </button>

      {/* Grid principal */}
      <div className="flex-1 p-4 pt-16 flex items-center justify-center">
        {callState.ringing ? (
          <div className="flex flex-col items-center gap-5 py-4 animate-fade-in">
            <div className="relative">
              <div className="absolute inset-0 rounded-full bg-brass/25 animate-ping" />
              <img
                src={callState.targetAvatar}
                alt={callState.channelName || ''}
                className="relative w-24 h-24 rounded-full object-cover border-2 border-brass/60 shadow-brass-lg"
              />
            </div>
            <div className="text-center">
              <p className="text-base font-display font-bold text-signal-text-primary">{callState.channelName}</p>
              <p className="text-xs text-signal-warning mt-1 animate-pulse font-mono">
                {callState.type === 'video' ? 'CHAMADA DE VÍDEO…' : 'CHAMADA DE VOZ…'}
              </p>
            </div>
          </div>
        ) : (
          <div className={`grid gap-4 w-full h-full ${
            (isFullscreen || forcedFullscreen) ? 'max-w-[1400px] max-h-full' : 'max-w-4xl max-h-[280px]'
          } ${
            callState.participants.length <= 1 ? 'grid-cols-1' :
            callState.participants.length <= 2 ? 'grid-cols-2' :
            'grid-cols-3 sm:grid-cols-4'
          }`}>

          {callState.participants.map(p => {
            const isMe = p.id === currentUser.id;
            const isSharing = isMe ? callState.isScreenSharing : p.isScreenSharing;
            const screen = isMe ? screenStream : (remoteScreenStreams?.[p.id] || null);
            const camera = isMe ? localStream : (remoteStreams?.[p.id] || null);
            const stream = (isSharing && screen) ? screen : camera;
            const showVideo = !!stream && (p.isCameraOn || isSharing);

            return (
              <div
                key={p.id}
                onContextMenu={(event) => {
                  if (!callServer) return;
                  const member = (serverMembers[callServer.id] || []).find((m) => m.userId === p.id);
                  if (!member) return;
                  openMenu(event, buildUserMenu(app, {
                    serverId: callServer.id,
                    member,
                    voiceChannel: callState.channelId,
                    muted: p.isMuted,
                    deafened: deafenedMap[p.id],
                  }));
                }}
                className={`bg-signal-secondary border rounded-md overflow-hidden relative flex flex-col items-center justify-center transition-all duration-300 group ${
                  p.isSpeaking ? 'border-brass/50' : 'border-signal-border'
                }`}
              >

                {/* Vídeo / Avatar */}
                {showVideo ? (
                  <video
                    ref={(el) => { if (el && el.srcObject !== stream) el.srcObject = stream; }}
                    autoPlay
                    playsInline
                    muted={isMe || callState.isSpeakerMuted}
                    className="absolute inset-0 w-full h-full object-cover"
                  />
                ) : (
                  <div className="relative z-10 flex flex-col items-center gap-3">
                    <img
                      src={p.avatar}
                      alt={p.name}
                      className={`w-16 h-16 rounded-full object-cover transition-all ${
                        p.isSpeaking ? 'scale-105 border-2 border-brass' : 'border border-signal-border/40'
                      }`}
                    />
                  </div>
                )}

                {/* Medidor de transmissão no canto do tile */}
                {p.isSpeaking && (
                  <div className="absolute top-2.5 left-2.5 z-20 bg-black/60 backdrop-blur-md px-2 py-1.5 rounded-md border border-brass/30">
                    <TransmitMeter bars={5} className="h-2.5" />
                  </div>
                )}

                {/* Áudio remoto */}
                {!isMe && camera && (!showVideo || stream !== camera) && (
                  <audio
                    ref={(el) => { if (el && el.srcObject !== camera) el.srcObject = camera; }}
                    autoPlay
                    muted={callState.isSpeakerMuted}
                    className="hidden"
                  />
                )}

                {/* Chip de nome */}
                <div className="absolute bottom-2.5 left-2.5 right-2.5 z-20 flex items-center justify-between bg-black/60 backdrop-blur-md px-2.5 py-1 rounded-md">
                  <span className="text-[10px] text-signal-text-primary font-semibold truncate">
                    {p.name} {isMe && '(Voce)'}
                  </span>

                  <div className="flex items-center gap-1">
                    {isSharing && stream && (
                      <button
                        onClick={() => setExpandedScreen({ id: p.id, stream, name: p.name })}
                        className="p-1 text-brass hover:bg-brass/20 rounded-md transition-colors"
                        title="Expandir tela"
                      >
                        <ArrowsOutSimple className="w-3 h-3" />
                      </button>
                    )}
                    {isSharing && <Presentation className="w-3 h-3 text-brass" />}
                    {p.isMuted && <MicrophoneSlash className="w-3 h-3 text-signal-danger" />}
                    {!p.isCameraOn && !isSharing && <VideoCameraSlash className="w-3 h-3 text-signal-text-secondary" />}
                  </div>
                </div>

                {/* Toolbar de moderação */}
                {!isMe && callServer && callState.channelId && canManage(p.id) && (
                  <div className="absolute top-2.5 right-2.5 z-30 flex items-center gap-1 bg-black/60 backdrop-blur-md px-1.5 py-1 rounded-md opacity-0 group-hover:opacity-100 transition-opacity">
                    {hasPerm(PERMISSIONS.DISCONNECT_MEMBERS) && (
                      <Tooltip content="Desconectar da call" position="bottom">
                        <button
                          onClick={() => { void disconnectMemberFromCall(callServer.id, p.id, callState.channelId!); }}
                          className="p-1.5 text-signal-danger hover:bg-signal-danger/20 rounded-md transition-colors"
                        >
                          <PhoneSlash className="w-3.5 h-3.5" />
                        </button>
                      </Tooltip>
                    )}
                    {hasPerm(PERMISSIONS.MUTE_MEMBERS) && (
                      <Tooltip content={p.isMuted ? 'Ativar microfone' : 'Mutar'} position="bottom">
                        <button
                          onClick={() => { void setMemberMuted(callServer.id, p.id, !p.isMuted); }}
                          className="p-1.5 text-signal-text-primary hover:bg-signal-surface rounded-md transition-colors"
                        >
                          {p.isMuted ? <MicrophoneSlash className="w-3.5 h-3.5" /> : <Microphone className="w-3.5 h-3.5" />}
                        </button>
                      </Tooltip>
                    )}
                    {hasPerm(PERMISSIONS.DEAFEN_MEMBERS) && (
                      <Tooltip content={deafenedMap[p.id] ? 'Ativar som' : 'Ensurdecer'} position="bottom">
                        <button
                          onClick={() => {
                            const next = !deafenedMap[p.id];
                            setDeafenedMap((prev) => ({ ...prev, [p.id]: next }));
                            void setMemberDeafened(callServer.id, p.id, next);
                          }}
                          className="p-1.5 text-signal-text-primary hover:bg-signal-surface rounded-md transition-colors"
                        >
                          {deafenedMap[p.id] ? <SpeakerSlash className="w-3.5 h-3.5 text-signal-danger" /> : <SpeakerSlash className="w-3.5 h-3.5" />}
                        </button>
                      </Tooltip>
                    )}
                    {hasPerm(PERMISSIONS.MOVE_MEMBERS) && (
                      <div className="relative">
                        <Tooltip content="Mover de call" position="bottom">
                          <button
                            onClick={() => setMoveMenuFor(moveMenuFor === p.id ? null : p.id)}
                            className="p-1.5 text-signal-text-primary hover:bg-signal-surface rounded-md transition-colors"
                          >
                            <ArrowRight className="w-3.5 h-3.5" />
                          </button>
                        </Tooltip>
                        {moveMenuFor === p.id && (
                          <div className="absolute right-0 top-full mt-1 z-40 min-w-[180px] bg-signal-surface border border-signal-border rounded-md p-1.5 shadow-float-lg">
                            <span className="block px-2 py-1 text-[10px] font-bold uppercase tracking-wider text-signal-text-secondary font-mono">
                              Mover para...
                            </span>
                            {callServer.channels
                              .filter((channel) => channel.type === 'voice' && channel.id !== callState.channelId)
                              .map((channel) => (
                                <button
                                  key={channel.id}
                                  onClick={() => {
                                    setMoveMenuFor(null);
                                    void moveMemberBetweenChannels(callServer.id, p.id, callState.channelId!, channel.id);
                                  }}
                                  className="w-full text-left px-2 py-1.5 rounded-md text-xs text-signal-text-primary hover:bg-signal-hover transition-colors"
                                >
                                  {channel.name}
                                </button>
                              ))}
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                )}

              </div>
            );
          })}

          </div>
        )}
      </div>

      {/* Controles da chamada — botões circulares (físicos) */}
      <div className="absolute bottom-4 left-1/2 -translate-x-1/2 z-30 glass-panel px-5 py-2.5 rounded-full border border-signal-border/40 flex items-center gap-4 shadow-float-lg">

        <Tooltip content={callState.isMuted ? "Ativar Microfone" : "Silenciar"} position="top">
          <button
            onClick={toggleMute}
            className={`w-10 h-10 rounded-full flex items-center justify-center transition-all ${
              callState.isMuted
                ? 'bg-signal-danger text-white'
                : 'bg-signal-surface text-signal-text-primary hover:bg-signal-hover border border-signal-border'
            }`}
          >
            {callState.isMuted ? <MicrophoneSlash className="w-4.5 h-4.5" /> : <Microphone className="w-4.5 h-4.5" />}
          </button>
        </Tooltip>

        <Tooltip content={callState.isCameraOn ? "Desativar Camera" : "Ativar Camera"} position="top">
          <button
            onClick={toggleCamera}
            className={`w-10 h-10 rounded-full flex items-center justify-center transition-all ${
              callState.isCameraOn
                ? 'bg-brass text-signal-bg'
                : 'bg-signal-surface text-signal-text-primary hover:bg-signal-hover border border-signal-border'
            }`}
          >
            {callState.isCameraOn ? <VideoCamera className="w-4.5 h-4.5" /> : <VideoCameraSlash className="w-4.5 h-4.5" />}
          </button>
        </Tooltip>

        <Tooltip content={callState.isSpeakerMuted ? "Ativar Alto-falante" : "Mutar Alto-falante"} position="top">
          <button
            onClick={toggleSpeakerMute}
            className={`w-10 h-10 rounded-full flex items-center justify-center transition-all ${
              callState.isSpeakerMuted
                ? 'bg-signal-danger text-white'
                : 'bg-signal-surface text-signal-text-primary hover:bg-signal-hover border border-signal-border'
            }`}
          >
            {callState.isSpeakerMuted ? <SpeakerSlash className="w-4.5 h-4.5" /> : <SpeakerHigh className="w-4.5 h-4.5" />}
          </button>
        </Tooltip>

        <Tooltip content="Compartilhar Tela" position="top">
          <button
            onClick={toggleScreenShare}
            className={`w-10 h-10 rounded-full flex items-center justify-center transition-all ${
              callState.isScreenSharing
                ? 'bg-brass text-signal-bg'
                : 'bg-signal-surface text-signal-text-primary hover:bg-signal-hover border border-signal-border'
            }`}
          >
            <Presentation className="w-4.5 h-4.5" />
          </button>
        </Tooltip>

        <div className="w-[1px] h-6 bg-signal-border" />

        <Tooltip content="Desconectar" position="top">
          <button
            onClick={endCall}
            className="w-12 h-10 rounded-full bg-signal-danger hover:bg-signal-danger/80 text-white flex items-center justify-center transition-colors shadow-lg"
          >
            <PhoneSlash className="w-5 h-5" />
          </button>
        </Tooltip>

      </div>

      {/* Tela compartilhada expandida */}
      {expandedScreen && expandedScreen.stream && (
        <div
          className="fixed inset-0 z-[80] bg-black/95 backdrop-blur-md flex flex-col"
          onClick={() => setExpandedScreen(null)}
        >
          <div className="flex items-center justify-between px-5 py-3 border-b border-signal-border/40">
            <div className="flex items-center gap-2.5">
              <Presentation className="w-4 h-4 text-brass" />
              <span className="text-xs font-mono font-bold text-signal-text-primary uppercase tracking-wider">
                Tela de {expandedScreen.name}
              </span>
            </div>
            <button
              onClick={() => setExpandedScreen(null)}
              className="w-8 h-8 rounded-md bg-signal-surface border border-signal-border hover:bg-signal-hover flex items-center justify-center text-signal-text-secondary hover:text-signal-text-primary transition-colors"
              title="Fechar"
            >
              <ArrowRight className="w-4 h-4 rotate-180" />
            </button>
          </div>
          <div className="flex-1 p-4 flex items-center justify-center overflow-hidden" onClick={(e) => e.stopPropagation()}>
            <video
              ref={(el) => { if (el && el.srcObject !== expandedScreen.stream) el.srcObject = expandedScreen.stream; }}
              autoPlay
              playsInline
              className="max-w-full max-h-full rounded-md border border-signal-border/40 bg-black object-contain"
            />
          </div>
        </div>
      )}

    </div>
  );
};