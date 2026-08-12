import React, { useEffect, useRef, useState } from 'react';
import { useApp } from '../context/AppContext';
import { Tooltip } from './SharedUI';
import {
  Mic, MicOff, Video, VideoOff, ScreenShare,
  PhoneOff, Wifi, Users, Volume2, VolumeX, Maximize, Minimize
} from 'lucide-react';

export const CallView: React.FC = () => {
  const { callState, currentUser, endCall, toggleMute, toggleCamera, toggleScreenShare, toggleSpeakerMute } = useApp();
  const containerRef = useRef<HTMLDivElement>(null);
  const [isFullscreen, setIsFullscreen] = useState(false);

  useEffect(() => {
    const handler = () => setIsFullscreen(Boolean(document.fullscreenElement));
    document.addEventListener('fullscreenchange', handler);
    return () => document.removeEventListener('fullscreenchange', handler);
  }, []);

  const toggleFullscreen = () => {
    if (document.fullscreenElement) {
      void document.exitFullscreen().catch(() => { /* ignore */ });
    } else if (containerRef.current) {
      void containerRef.current.requestFullscreen().catch(() => { /* ignore */ });
    }
  };

  if (!callState.isActive) return null;

  const { localStream, remoteStreams, remoteScreenStreams, screenStream } = callState;

  return (
    <div
      ref={containerRef}
      className={`flex-1 bg-discordex-bg border-b border-discordex-border flex flex-col relative overflow-hidden ${
        isFullscreen ? 'h-full max-h-full' : 'h-[360px] shrink-0'
      }`}
    >

      {/* Top connection details bar */}
      <div className="absolute top-4 left-4 z-30 bg-black/60 backdrop-blur-md px-3 py-1.5 rounded-xl border border-discordex-border/40 flex items-center gap-2.5">
        <Wifi className="w-4 h-4 text-discordex-success" />
        <span className="text-xs text-discordex-text-primary font-bold">Chamada Conectada</span>
        <div className="w-[1px] h-3 bg-discordex-border" />
        <Users className="w-3.5 h-3.5 text-discordex-text-secondary" />
        <span className="text-[10px] text-discordex-text-secondary">{callState.participants.length}</span>
      </div>

      <button
        onClick={toggleFullscreen}
        className="absolute top-4 right-4 z-30 w-8 h-8 rounded-xl bg-black/60 backdrop-blur-md border border-discordex-border/40 flex items-center justify-center text-discordex-text-secondary hover:text-discordex-text-primary hover:bg-black/80 transition-colors"
        title={isFullscreen ? 'Sair da tela cheia' : 'Tela cheia'}
      >
        {isFullscreen ? <Minimize className="w-4 h-4" /> : <Maximize className="w-4 h-4" />}
      </button>

      {/* Main Grid View */}
      <div className="flex-1 p-4 pt-16 flex items-center justify-center">
        <div className={`grid gap-4 w-full h-full ${
          isFullscreen ? 'max-w-[1400px] max-h-full' : 'max-w-4xl max-h-[280px]'
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
                className={`bg-discordex-secondary border rounded-2xl overflow-hidden relative flex flex-col items-center justify-center transition-all duration-300 ${
                  p.isSpeaking
                    ? 'border-primary ring-2 ring-primary/40 shadow-[0_0_12px_rgba(229,57,53,0.3)]'
                    : 'border-discordex-border'
                }`}
              >

                {/* Video / Avatar view */}
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
                        p.isSpeaking ? 'scale-105 border-2 border-primary' : 'border border-discordex-border/40'
                      }`}
                    />
                  </div>
                )}

                {/* Remote audio element (plays when the base stream is not the displayed video) */}
                {!isMe && camera && (!showVideo || stream !== camera) && (
                  <audio
                    ref={(el) => { if (el && el.srcObject !== camera) el.srcObject = camera; }}
                    autoPlay
                    muted={callState.isSpeakerMuted}
                    className="hidden"
                  />
                )}

                {/* Bottom details label overlay */}
                <div className="absolute bottom-2.5 left-2.5 right-2.5 z-20 flex items-center justify-between bg-black/40 backdrop-blur-md px-2.5 py-1 rounded-xl">
                  <span className="text-[10px] text-discordex-text-primary font-semibold truncate">
                    {p.name} {isMe && '(Voce)'}
                  </span>

                  <div className="flex items-center gap-1">
                    {isSharing && <ScreenShare className="w-3 h-3 text-primary" />}
                    {p.isMuted && <MicOff className="w-3 h-3 text-discordex-danger" />}
                    {!p.isCameraOn && !isSharing && <VideoOff className="w-3 h-3 text-discordex-text-secondary" />}
                  </div>
                </div>

              </div>
            );
          })}

        </div>
      </div>

      {/* Call controls overlays bar */}
      <div className="absolute bottom-4 left-1/2 -translate-x-1/2 z-30 bg-black/60 backdrop-blur-md px-5 py-2.5 rounded-2xl border border-discordex-border/40 flex items-center gap-4 shadow-2xl">

        <Tooltip content={callState.isMuted ? "Ativar Microfone" : "Silenciar"} position="top">
          <button
            onClick={toggleMute}
            className={`w-10 h-10 rounded-xl flex items-center justify-center transition-all ${
              callState.isMuted
                ? 'bg-discordex-danger text-white'
                : 'bg-discordex-surface text-discordex-text-primary hover:bg-discordex-hover border border-discordex-border'
            }`}
          >
            {callState.isMuted ? <MicOff className="w-4.5 h-4.5" /> : <Mic className="w-4.5 h-4.5" />}
          </button>
        </Tooltip>

        <Tooltip content={callState.isCameraOn ? "Desativar Camera" : "Ativar Camera"} position="top">
          <button
            onClick={toggleCamera}
            className={`w-10 h-10 rounded-xl flex items-center justify-center transition-all ${
              callState.isCameraOn
                ? 'bg-discordex-success text-white'
                : 'bg-discordex-surface text-discordex-text-primary hover:bg-discordex-hover border border-discordex-border'
            }`}
          >
            {callState.isCameraOn ? <Video className="w-4.5 h-4.5" /> : <VideoOff className="w-4.5 h-4.5" />}
          </button>
        </Tooltip>

        <Tooltip content={callState.isSpeakerMuted ? "Ativar Alto-falante" : "Mutar Alto-falante"} position="top">
          <button
            onClick={toggleSpeakerMute}
            className={`w-10 h-10 rounded-xl flex items-center justify-center transition-all ${
              callState.isSpeakerMuted
                ? 'bg-discordex-danger text-white'
                : 'bg-discordex-surface text-discordex-text-primary hover:bg-discordex-hover border border-discordex-border'
            }`}
          >
            {callState.isSpeakerMuted ? <VolumeX className="w-4.5 h-4.5" /> : <Volume2 className="w-4.5 h-4.5" />}
          </button>
        </Tooltip>

        <Tooltip content="Compartilhar Tela" position="top">
          <button
            onClick={toggleScreenShare}
            className={`w-10 h-10 rounded-xl flex items-center justify-center transition-all ${
              callState.isScreenSharing
                ? 'bg-primary text-white'
                : 'bg-discordex-surface text-discordex-text-primary hover:bg-discordex-hover border border-discordex-border'
            }`}
          >
            <ScreenShare className="w-4.5 h-4.5" />
          </button>
        </Tooltip>

        <div className="w-[1px] h-6 bg-discordex-border" />

        <Tooltip content="Desconectar" position="top">
          <button
            onClick={endCall}
            className="w-12 h-10 rounded-xl bg-discordex-danger hover:bg-discordex-danger/80 text-white flex items-center justify-center transition-colors shadow-lg"
          >
            <PhoneOff className="w-5 h-5" />
          </button>
        </Tooltip>

      </div>

    </div>
  );
};