import type { RealtimeChannel, SupabaseClient } from '@supabase/supabase-js';

export interface CallParticipantInfo {
  id: string;
  name: string;
  avatar: string;
  isSpeaking: boolean;
  isMuted: boolean;
  isCameraOn: boolean;
  isScreenSharing: boolean;
}

export interface VoiceEngineOptions {
  supabase: SupabaseClient;
  channelId: string;
  userId: string;
  displayName: string;
  avatar: string;
  isServerChannel: boolean;
stream: MediaStream;
  iceServers: RTCIceServer[];
  startMuted: boolean;
  startCamera: boolean;
  videoBitrate?: number | null;
  onUpdate: (participants: CallParticipantInfo[]) => void;
  onRemoteStream: (userId: string, stream: MediaStream) => void;
  onRemoteStreamEnd: (userId: string) => void;
  onScreenStream?: (userId: string, stream: MediaStream) => void;
  onScreenStreamEnd?: (userId: string) => void;
  onParticipantJoined: () => void;
  onRemoteLeave?: () => void;
  onError: (message: string) => void;
}

interface Peer {
  pc: RTCPeerConnection;
  polite: boolean;
  stream?: MediaStream;
  screenSender?: RTCRtpSender;
  screenStream?: MediaStream;
}

interface DmPresenceMeta {
  id: string;
  name: string;
  avatar: string;
  muted: boolean;
  camera: boolean;
  screen: boolean;
}

const fallbackAvatar = (name: string) =>
  `https://ui-avatars.com/api/?background=ED4245&color=fff&bold=true&name=${encodeURIComponent(name || 'DX')}`;

export class VoiceCallEngine {
  private opts: VoiceEngineOptions;
  private peers = new Map<string, Peer>();
  private participants = new Map<string, CallParticipantInfo>();
  private realtime: RealtimeChannel | null = null;
  private analyser: AnalyserNode | null = null;
  private audioCtx: AudioContext | null = null;
  private rafId = 0;
  private makingOffer = false;
  private ignoreOffer = false;
  private stopped = false;
  private screenTrack: MediaStreamTrack | null = null;
  private screenStream: MediaStream | null = null;
  private dmRoom: string | null = null;

  constructor(opts: VoiceEngineOptions) {
    this.opts = opts;
  }

  async join() {
    const me: CallParticipantInfo = {
      id: this.opts.userId,
      name: this.opts.displayName,
      avatar: this.opts.avatar,
      isSpeaking: false,
      isMuted: this.opts.startMuted,
      isCameraOn: this.opts.startCamera,
      isScreenSharing: false,
    };
this.participants.set(this.opts.userId, me);
    this.opts.stream.getAudioTracks().forEach((track) => { track.enabled = !this.opts.startMuted; });
    this.opts.stream.getVideoTracks().forEach((track) => { track.enabled = this.opts.startCamera; });
    this.update();
    this.startSpeakingDetection();

    if (!this.opts.isServerChannel) {
      return await this.joinDmCall();
    }

    this.realtime = this.opts.supabase.channel(`webrtc:${this.opts.channelId}`)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'webrtc_signals', filter: `channel_id=eq.${this.opts.channelId}` },
        async (payload) => {
          const row = payload.new as { to_user?: string; from_user?: string; type?: string; payload?: unknown } | null;
          if (!row || !row.from_user || row.to_user !== this.opts.userId || row.from_user === this.opts.userId) return;
          await this.handleSignal(row.from_user, row.type || '', row.payload);
        }
      )
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'voice_states', filter: `channel_id=eq.${this.opts.channelId}` },
        async (payload) => {
          await this.handleVoiceStateChange(payload.eventType, payload.new as Record<string, unknown> | null, payload.old as Record<string, unknown> | null);
        }
      )
      .subscribe();

    const { data: states, error } = await this.opts.supabase
      .from('voice_states')
      .select('*')
      .eq('channel_id', this.opts.channelId);

    if (error) {
      this.opts.onError(error.message);
      return;
    }

    for (const st of (states || []) as { user_id: string; muted: boolean; camera_enabled: boolean }[]) {
      if (st.user_id === this.opts.userId || this.peers.has(st.user_id)) continue;
      const profile = await this.fetchProfile(st.user_id);
      this.participants.set(st.user_id, {
        id: st.user_id,
        name: profile.name,
        avatar: profile.avatar,
        isSpeaking: false,
        isMuted: st.muted,
        isCameraOn: st.camera_enabled,
        isScreenSharing: false,
      });
this.opts.onParticipantJoined();
      await this.createPeer(st.user_id);
      this.update();
    }
  }

  async leave() {
    this.stopped = true;
    cancelAnimationFrame(this.rafId);
    if (this.realtime) {
      if (this.dmRoom) {
        await this.realtime.untrack().catch(() => { /* ignore */ });
      }
      await this.opts.supabase.removeChannel(this.realtime);
      this.realtime = null;
      this.dmRoom = null;
    }
    for (const peer of this.peers.values()) {
      try { peer.pc.close(); } catch { /* ignore */ }
    }
    this.peers.clear();
    if (this.audioCtx) {
      try { await this.audioCtx.close(); } catch { /* ignore */ }
      this.audioCtx = null;
    }
this.participants.clear();
  }

  async setMuted(muted: boolean) {
    this.opts.stream.getAudioTracks().forEach((track) => { track.enabled = !muted; });
    const p = this.participants.get(this.opts.userId);
    if (p) { p.isMuted = muted; p.isSpeaking = false; this.update(); }
    if (this.opts.isServerChannel) {
      await this.opts.supabase
        .from('voice_states')
        .update({ muted })
        .eq('channel_id', this.opts.channelId)
        .eq('user_id', this.opts.userId);
    } else if (this.realtime && this.dmRoom) {
      void this.trackDmPresence({ muted });
    }
  }

  async setCamera(enabled: boolean) {
    this.opts.stream.getVideoTracks().forEach((track) => { track.enabled = enabled; });
    const p = this.participants.get(this.opts.userId);
    if (p) { p.isCameraOn = enabled; this.update(); }
    if (this.opts.isServerChannel) {
      await this.opts.supabase
        .from('voice_states')
        .update({ camera_enabled: enabled })
        .eq('channel_id', this.opts.channelId)
        .eq('user_id', this.opts.userId);
    } else if (this.realtime && this.dmRoom) {
      void this.trackDmPresence({ camera: enabled });
    }
  }

  setScreenTrack(track: MediaStreamTrack | null) {
    this.screenTrack = track;
    const sharing = !!track;
    this.screenStream = sharing && track ? new MediaStream([track]) : null;

    for (const peer of this.peers.values()) {
      if (sharing && track) {
        if (peer.screenSender) {
          void peer.screenSender.replaceTrack(track).catch(() => { /* ignore */ });
        } else {
          try {
            peer.screenSender = peer.pc.addTrack(track, this.screenStream!);
          } catch (error) {
            console.error('addTrack screen error', error);
          }
        }
      } else if (!sharing && peer.screenSender) {
        try {
          peer.pc.removeTrack(peer.screenSender);
        } catch (error) {
          console.error('removeTrack screen error', error);
        }
        peer.screenSender = undefined;
      }
    }

    const p = this.participants.get(this.opts.userId);
    if (p) { p.isScreenSharing = sharing; this.update(); }

    if (this.opts.isServerChannel) {
      void this.opts.supabase
        .from('voice_states')
        .update({ screen_sharing: sharing })
        .eq('channel_id', this.opts.channelId)
        .eq('user_id', this.opts.userId);
    } else if (this.realtime && this.dmRoom) {
      void this.trackDmPresence({ screen: sharing });
    }
  }

  setVideoBitrate(bitrate: number | null) {
    const targetBps = bitrate ? bitrate * 1000 : null;
    for (const peer of this.peers.values()) {
      for (const sender of peer.pc.getSenders()) {
        if (sender.track?.kind !== 'video') continue;
        try {
          const params = sender.getParameters();
          if (!params.encodings?.length) continue;
          params.encodings.forEach((enc) => {
            if (targetBps) enc.maxBitrate = targetBps;
            else delete enc.maxBitrate;
          });
          void sender.setParameters(params).catch(() => { /* ignore */ });
        } catch { /* ignore */ }
      }
    }
  }

  private async fetchProfile(userId: string): Promise<{ name: string; avatar: string }> {
    const { data } = await this.opts.supabase
      .from('profiles')
      .select('display_name, username, avatar_url')
      .eq('id', userId)
      .maybeSingle();
    if (data) {
      return {
        name: (data as { display_name?: string; username?: string }).display_name || (data as { username?: string }).username || userId.slice(0, 8),
        avatar: (data as { avatar_url?: string | null }).avatar_url || fallbackAvatar((data as { display_name?: string }).display_name || 'DX'),
      };
    }
return { name: userId.slice(0, 8), avatar: fallbackAvatar('DX') };
  }

  private async sendSignal(toUserId: string, type: string, payload: unknown) {
    if (!this.opts.isServerChannel) {
      if (!this.dmRoom) return;
      await this.opts.supabase
        .from('dm_call_signals')
        .insert({ call_room: this.dmRoom, from_user: this.opts.userId, to_user: toUserId, type, payload });
      return;
    }
    await this.opts.supabase
      .from('webrtc_signals')
      .insert({ channel_id: this.opts.channelId, from_user: this.opts.userId, to_user: toUserId, type, payload });
  }

  private async joinDmCall() {
    const roomKey = [this.opts.userId, this.opts.channelId].sort().join(':');
    this.dmRoom = roomKey;

    const channel = this.opts.supabase.channel(`dm-call:${roomKey}`, {
      config: { presence: { key: this.opts.userId, enabled: true } },
    });

    channel.on(
      'postgres_changes',
      { event: 'INSERT', schema: 'public', table: 'dm_call_signals', filter: `call_room=eq.${roomKey}` },
      async (payload) => {
        const row = payload.new as { id?: string; from_user?: string; to_user?: string; type?: string; payload?: unknown } | null;
        if (!row || !row.from_user || row.from_user === this.opts.userId) return;
        if (row.to_user && row.to_user !== this.opts.userId) return;
        await this.handleSignal(row.from_user, row.type || '', row.payload);
        if (row.id) {
          try {
            await this.opts.supabase.from('dm_call_signals').delete().eq('id', row.id);
          } catch { /* ignore */ }
        }
      }
    );

    channel.on('presence', { event: 'sync' }, () => { void this.syncDmPresence(); });
    channel.on('presence', { event: 'join' }, () => { void this.syncDmPresence(); });
    channel.on('presence', { event: 'leave' }, () => { void this.syncDmPresence(); });

    channel.subscribe((status) => {
      if (status === 'SUBSCRIBED') {
        void this.trackDmPresence();
      }
    });
    this.realtime = channel;

    await this.trackDmPresence();
    await this.syncDmPresence();
    this.update();
  }

  private async trackDmPresence(overrides: Partial<DmPresenceMeta> = {}) {
    if (!this.realtime || !this.dmRoom) return;
    const p = this.participants.get(this.opts.userId);
    await this.realtime.track({
      id: this.opts.userId,
      name: p?.name || this.opts.displayName,
      avatar: p?.avatar || this.opts.avatar,
      muted: p?.isMuted ?? this.opts.startMuted,
      camera: p?.isCameraOn ?? this.opts.startCamera,
      screen: p?.isScreenSharing ?? false,
      ...overrides,
    }).catch(() => { /* ignore */ });
  }

  private getDmPresenceEntry(state: Record<string, DmPresenceMeta[]>, id: string): DmPresenceMeta | undefined {
    for (const key of Object.keys(state)) {
      const entries = state[key];
      const entry = Array.isArray(entries) ? entries[entries.length - 1] : entries;
      if (entry?.id === id) return entry;
    }
    return undefined;
  }

  private async syncDmPresence() {
    if (!this.realtime || !this.dmRoom) return;
    const state = this.realtime.presenceState<DmPresenceMeta>();
    const presentIds = new Set<string>([this.opts.userId]);
    for (const key of Object.keys(state)) {
      const entries = state[key];
      const entry = Array.isArray(entries) ? entries[entries.length - 1] : entries;
      if (entry?.id) presentIds.add(entry.id);
    }

    for (const [remoteId, peer] of [...this.peers.entries()]) {
      if (peer && !presentIds.has(remoteId)) {
        this.removePeer(remoteId);
        this.opts.onRemoteLeave?.();
      }
    }

    for (const id of presentIds) {
      if (id === this.opts.userId || this.peers.has(id)) continue;
      const entry = this.getDmPresenceEntry(state, id);
      let name = entry?.name || '';
      let avatar = entry?.avatar || '';
      if (!name) {
        const profile = await this.fetchProfile(id);
        name = profile.name;
        avatar = profile.avatar;
      }
      this.participants.set(id, {
        id,
        name,
        avatar: avatar || fallbackAvatar(name || 'DX'),
        isSpeaking: false,
        isMuted: entry?.muted ?? false,
        isCameraOn: entry?.camera ?? false,
        isScreenSharing: entry?.screen ?? false,
      });
      this.opts.onParticipantJoined();
      await this.createPeer(id);
    }
    this.update();
  }

  private async createPeer(remoteUserId: string) {
    if (this.peers.has(remoteUserId)) return;
    const polite = remoteUserId > this.opts.userId;
    const pc = new RTCPeerConnection({ iceServers: this.opts.iceServers });
    const peer: Peer = { pc, polite };
    this.peers.set(remoteUserId, peer);

    this.opts.stream.getTracks().forEach((track) => pc.addTrack(track, this.opts.stream));
    if (this.screenTrack && this.screenStream) {
      peer.screenSender = pc.addTrack(this.screenTrack, this.screenStream);
    }

    pc.onicecandidate = (event) => {
      if (event.candidate) {
        void this.sendSignal(remoteUserId, 'ice-candidate', { candidate: event.candidate.toJSON() });
      }
    };

    pc.ontrack = (event) => {
      const [stream] = event.streams;
      if (!stream) return;
      const isVideo = event.track.kind === 'video';
      if (isVideo && peer.stream && stream.id !== peer.stream.id) {
        peer.screenStream = stream;
        this.opts.onScreenStream?.(remoteUserId, stream);
        event.track.onended = () => {
          if (peer.screenStream === stream) {
            peer.screenStream = undefined;
            this.opts.onScreenStreamEnd?.(remoteUserId);
          }
        };
        return;
      }
      peer.stream = stream;
      this.opts.onRemoteStream(remoteUserId, stream);
    };

    pc.onnegotiationneeded = async () => {
      try {
        if (pc.signalingState !== 'stable') return;
        this.makingOffer = true;
        await pc.setLocalDescription();
        await this.sendSignal(remoteUserId, 'offer', { sdp: pc.localDescription });
      } catch (error) {
        console.error('negotiationneeded error', error);
      } finally {
        this.makingOffer = false;
      }
    };

    pc.onconnectionstatechange = () => {
      if (pc.connectionState === 'failed') {
        try { pc.restartIce(); } catch { /* ignore */ }
      }
    };
  }

  private async handleSignal(fromUserId: string, type: string, payload: unknown) {
    let peer = this.peers.get(fromUserId);
    const parsed = payload as { sdp?: RTCSessionDescriptionInit; candidate?: RTCIceCandidateInit };

    if (!peer) {
      if (type !== 'offer') return;
      const profile = await this.fetchProfile(fromUserId);
      this.participants.set(fromUserId, {
        id: fromUserId,
        name: profile.name,
        avatar: profile.avatar,
        isSpeaking: false,
        isMuted: false,
        isCameraOn: false,
        isScreenSharing: false,
      });
      this.opts.onParticipantJoined();
      this.update();
      await this.createPeer(fromUserId);
      peer = this.peers.get(fromUserId);
      if (!peer) return;
    }

    const pc = peer.pc;

    if (parsed?.sdp) {
      const { sdp } = parsed;
      if (sdp.type === 'offer') {
        const readyForOffer = !this.makingOffer && pc.signalingState === 'stable';
        if (!readyForOffer) {
          if (!peer.polite) {
            this.ignoreOffer = true;
            return;
          }
          try {
            await Promise.all([
              pc.setLocalDescription({ type: 'rollback' }),
              pc.setRemoteDescription(sdp),
            ]);
          } catch (error) {
            console.error('polite offer error', error);
          }
        } else {
          try {
            await pc.setRemoteDescription(sdp);
          } catch (error) {
            console.error('setRemoteDescription offer error', error);
          }
        }
        try {
          await pc.setLocalDescription();
          await this.sendSignal(fromUserId, 'answer', { sdp: pc.localDescription });
        } catch (error) {
          console.error('answer error', error);
        }
      } else if (sdp.type === 'answer') {
        try {
          if (pc.signalingState === 'have-local-offer') {
            await pc.setRemoteDescription(sdp);
          }
        } catch (error) {
          console.error('setRemoteDescription answer error', error);
        }
      }
    } else if (parsed?.candidate) {
      try {
        await pc.addIceCandidate(parsed.candidate);
      } catch (error) {
        if (!this.ignoreOffer) console.error('addIceCandidate error', error);
      }
    }
  }

  private async handleVoiceStateChange(
    event: string,
    newRow: Record<string, unknown> | null,
    oldRow: Record<string, unknown> | null
  ) {
    if (event === 'INSERT' && newRow) {
      const userId = newRow.user_id as string;
      if (userId === this.opts.userId || this.peers.has(userId)) return;
      const profile = await this.fetchProfile(userId);
      this.participants.set(userId, {
        id: userId,
        name: profile.name,
        avatar: profile.avatar,
        isSpeaking: false,
        isMuted: Boolean(newRow.muted),
        isCameraOn: Boolean(newRow.camera_enabled),
        isScreenSharing: Boolean(newRow.screen_sharing),
      });
      this.opts.onParticipantJoined();
      await this.createPeer(userId);
      this.update();
    } else if (event === 'DELETE') {
      const userId = (oldRow?.user_id as string) || (newRow?.user_id as string);
      this.removePeer(userId);
    } else if (event === 'UPDATE' && newRow) {
      const userId = newRow.user_id as string;
      const p = this.participants.get(userId);
      if (p && userId !== this.opts.userId) {
        p.isMuted = Boolean(newRow.muted);
        p.isCameraOn = Boolean(newRow.camera_enabled);
        p.isScreenSharing = Boolean(newRow.screen_sharing);
        this.update();
      }
    }
  }

  private removePeer(userId: string) {
    const peer = this.peers.get(userId);
    if (peer) {
      try { peer.pc.close(); } catch { /* ignore */ }
      this.peers.delete(userId);
    }
    this.participants.delete(userId);
    this.opts.onRemoteStreamEnd(userId);
    this.update();
  }

  private startSpeakingDetection() {
    if (typeof window === 'undefined') return;
    try {
      const AC = window.AudioContext || (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
      if (!AC) return;
      this.audioCtx = new AC();
    } catch { return; }

    if (this.audioCtx.state === 'suspended') void this.audioCtx.resume();
    const source = this.audioCtx.createMediaStreamSource(this.opts.stream);
    this.analyser = this.audioCtx.createAnalyser();
    this.analyser.fftSize = 256;
    source.connect(this.analyser);

    const data = new Uint8Array(this.analyser.fftSize);
    const loop = () => {
      if (this.stopped || !this.analyser) return;
      this.analyser.getByteFrequencyData(data);
      let sum = 0;
      for (let i = 0; i < data.length; i++) sum += data[i];
      const level = sum / data.length;
      const p = this.participants.get(this.opts.userId);
      const speaking = !!p && !p.isMuted && level > 12;
      if (p && p.isSpeaking !== speaking) {
        p.isSpeaking = speaking;
        this.update();
      }
      this.rafId = requestAnimationFrame(loop);
    };
    this.rafId = requestAnimationFrame(loop);
  }

  private update() {
    this.opts.onUpdate([...this.participants.values()]);
  }
}

