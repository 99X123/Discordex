import React, { useEffect, useState } from 'react';
import { Camera, Gauge, FilmSlate, SignOut, Microphone, Monitor, ArrowsClockwise, Shield, VideoCamera, X, ImageSquare, Users, CellSignalHigh, UsersThree, PhoneCall, ChatCircleDots, EnvelopeSimpleOpen, Hash, Waveform } from '@phosphor-icons/react';
import { useApp } from '../context/AppContext';
import { ServerSettings } from './ServerSettings';
import { logout } from '../services/auth';
import { supabase } from '../lib/supabase';
import type { Database } from '../lib/database.types';

type AdminAccount = Database['public']['Functions']['list_registered_accounts']['Returns'][number];

const inputCls = "w-full px-4 py-3 bg-signal-bg border border-signal-border rounded-md text-xs text-signal-text-primary focus:outline-none focus:border-brass transition-colors";
const cardCls = "bg-signal-secondary p-4.5 rounded-md border border-signal-border";

export const SettingsPanel: React.FC = () => {
  const {
    isSettingsOpen,
    closeSettings,
    currentUser,
    updateCurrentUserProfile,
    activeServerSettingsId,
    servers,
    isAppAdmin,
    serverSettingsTab,
    serverSettingsRoleId,
    addToast,
  } = useApp();

  const [displayName, setDisplayName] = useState(currentUser.displayName);
  const [username, setUsername] = useState(currentUser.username);
  const [bio, setBio] = useState(currentUser.bio || '');
  const [status, setStatus] = useState(currentUser.status);
  const [avatarUrl, setAvatarUrl] = useState(currentUser.avatar);
  const [bannerUrl, setBannerUrl] = useState(currentUser.banner || '');
  const [avatarUploading, setAvatarUploading] = useState(false);
  const [bannerUploading, setBannerUploading] = useState(false);
  const [activeTab, setActiveTab] = useState<'profile' | 'voice' | 'admin'>('profile');
  const [startMuted, setStartMuted] = useState(localStorage.getItem('discordex:start-muted') === 'true');
  const [startCamera, setStartCamera] = useState(localStorage.getItem('discordex:start-camera') !== 'false');
  const [echoCancellation, setEchoCancellation] = useState(localStorage.getItem('discordex:echo-cancellation') !== 'false');
  const [noiseSuppression, setNoiseSuppression] = useState(localStorage.getItem('discordex:noise-suppression') !== 'false');
  const [noiseSuppressionLevel, setNoiseSuppressionLevel] = useState<'low' | 'medium' | 'high'>(() => {
    const stored = localStorage.getItem('discordex:noise-suppression-level');
    return stored === 'low' || stored === 'high' ? stored : 'medium';
  });
  const [inputDevice, setInputDevice] = useState(localStorage.getItem('discordex:input-device') || '');
  const [cameraDevice, setCameraDevice] = useState(localStorage.getItem('discordex:camera-device') || '');
  const [videoQuality, setVideoQuality] = useState(localStorage.getItem('discordex:video-quality') || 'auto');
  const [videoFps, setVideoFps] = useState(Number(localStorage.getItem('discordex:video-fps') || 30));
  const [videoBitrate, setVideoBitrate] = useState(Number(localStorage.getItem('discordex:video-bitrate') || 0));
  const [devices, setDevices] = useState<MediaDeviceInfo[]>([]);
  const [adminAccounts, setAdminAccounts] = useState<AdminAccount[]>([]);
  const [adminLoading, setAdminLoading] = useState(false);
  const [adminStats, setAdminStats] = useState<Record<string, number> | null>(null);
  const [adminStatsLoading, setAdminStatsLoading] = useState(false);
  const [adminAction, setAdminAction] = useState<string | null>(null);
  const activeServer = servers.find((server) => server.id === activeServerSettingsId);

  useEffect(() => {
    setDisplayName(currentUser.displayName);
    setUsername(currentUser.username);
    setBio(currentUser.bio || '');
    setStatus(currentUser.status);
    setAvatarUrl(currentUser.avatar);
    setBannerUrl(currentUser.banner || '');
  }, [currentUser]);

  useEffect(() => {
    if (!isSettingsOpen || activeTab !== 'voice' || !navigator.mediaDevices?.enumerateDevices) return;
    navigator.mediaDevices.enumerateDevices()
      .then(setDevices)
      .catch(() => setDevices([]));
  }, [isSettingsOpen, activeTab]);

  const loadAdminAccounts = async () => {
    if (!isAppAdmin) return;
    setAdminLoading(true);
    const { data, error } = await supabase.rpc('list_registered_accounts', {});
    setAdminLoading(false);
    if (error) {
      setAdminAccounts([]);
      return;
    }
    setAdminAccounts(data || []);
  };

  const loadAdminStats = async () => {
    if (!isAppAdmin) return;
    setAdminStatsLoading(true);
    const { data, error } = await supabase.rpc('get_admin_stats', {});
    setAdminStatsLoading(false);
    if (error || !data) {
      setAdminStats(null);
      return;
    }
    setAdminStats(data as Record<string, number>);
  };

  const runAdminAction = async (
    rpc: 'promote_app_admin' | 'revoke_app_admin' | 'delete_app_account',
    accountId: string,
    confirmMessage: string
  ) => {
    if (adminAction) return;
    if (!window.confirm(confirmMessage)) return;
    setAdminAction(accountId);
    const { error } = await supabase.rpc(rpc, { p_target_id: accountId });
    setAdminAction(null);
    if (error) {
      window.alert(error.message);
      return;
    }
    void loadAdminAccounts();
    void loadAdminStats();
  };

  useEffect(() => {
    if (isSettingsOpen && activeTab === 'admin') {
      void loadAdminAccounts();
      void loadAdminStats();
    }
  }, [isSettingsOpen, activeTab, isAppAdmin]);

  if (!isSettingsOpen) return null;

  if (activeServer) {
    return <ServerSettings server={activeServer} onClose={closeSettings} initialTab={serverSettingsTab} initialRoleId={serverSettingsRoleId} />;
  }

  const handleSaveProfile = (event: React.FormEvent) => {
    event.preventDefault();
    updateCurrentUserProfile(displayName, bio, status, avatarUrl, username, bannerUrl || undefined);
  };

  const handleAvatarUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    if (!['image/jpeg', 'image/png', 'image/webp', 'image/gif'].includes(file.type)) {
      event.target.value = '';
      return;
    }

    if (file.size > 5 * 1024 * 1024) {
      event.target.value = '';
      return;
    }

    setAvatarUploading(true);
    const extension = file.name.split('.').pop()?.toLowerCase() || 'png';
    const filePath = `${currentUser.id}/avatar-${Date.now()}.${extension}`;

    const { error } = await supabase.storage
      .from('avatars')
      .upload(filePath, file, {
        cacheControl: '3600',
        upsert: true,
        contentType: file.type,
      });

    setAvatarUploading(false);
    event.target.value = '';

    if (error) return;

    const { data } = supabase.storage.from('avatars').getPublicUrl(filePath);
    setAvatarUrl(data.publicUrl);
    updateCurrentUserProfile(displayName, bio, status, data.publicUrl, username, bannerUrl || undefined);
  };

  const handleBannerUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    if (!['image/jpeg', 'image/png', 'image/webp', 'image/gif'].includes(file.type)) {
      event.target.value = '';
      return;
    }

    if (file.size > 5 * 1024 * 1024) {
      event.target.value = '';
      return;
    }

    setBannerUploading(true);
    const extension = file.name.split('.').pop()?.toLowerCase() || 'png';
    const filePath = `${currentUser.id}/banner-${Date.now()}.${extension}`;

    let uploadResult = await supabase.storage
      .from('banners')
      .upload(filePath, file, {
        cacheControl: '3600',
        upsert: true,
        contentType: file.type,
      });
    let usedBucket = 'banners';

    if (uploadResult.error) {
      uploadResult = await supabase.storage
        .from('avatars')
        .upload(filePath, file, {
          cacheControl: '3600',
          upsert: true,
          contentType: file.type,
        });
      usedBucket = 'avatars';
    }

    setBannerUploading(false);
    event.target.value = '';

    if (uploadResult.error) {
      addToast(uploadResult.error.message || 'Nao foi possivel enviar o banner.', 'error');
      return;
    }

    const { data } = supabase.storage.from(usedBucket).getPublicUrl(filePath);
    setBannerUrl(data.publicUrl);
    updateCurrentUserProfile(displayName, bio, status, avatarUrl, username, data.publicUrl);
  };

  const handleSaveVoice = (event: React.FormEvent) => {
    event.preventDefault();
    localStorage.setItem('discordex:start-muted', String(startMuted));
    localStorage.setItem('discordex:start-camera', String(startCamera));
    localStorage.setItem('discordex:echo-cancellation', String(echoCancellation));
    localStorage.setItem('discordex:noise-suppression', String(noiseSuppression));
    localStorage.setItem('discordex:noise-suppression-level', noiseSuppressionLevel);
    localStorage.setItem('discordex:input-device', inputDevice);
    localStorage.setItem('discordex:camera-device', cameraDevice);
    localStorage.setItem('discordex:video-quality', videoQuality);
    localStorage.setItem('discordex:video-fps', String(videoFps));
    localStorage.setItem('discordex:video-bitrate', String(videoBitrate));
    closeSettings();
  };

  const handleLogout = async () => {
    await logout();
    closeSettings();
  };

  const navBtn = (active: boolean) =>
    `w-full text-left px-2.5 py-1.5 rounded-md text-xs font-semibold transition-colors ${active ? 'bg-signal-surface text-signal-text-primary' : 'text-signal-text-secondary hover:bg-signal-surface/40 hover:text-signal-text-primary'}`;

  const primaryBtn = "px-5 py-2.5 bg-brass hover:bg-brass-hover text-signal-bg rounded-md text-sm font-bold transition-colors";

  return (
    <div className="fixed inset-0 z-50 bg-signal-bg flex animate-fade-in">
      <aside className="w-60 bg-signal-secondary flex justify-end border-r border-signal-border py-12 px-6 shrink-0">
        <div className="w-48 space-y-6">
          <div className="space-y-1">
            <span className="block px-2.5 text-[9px] font-bold text-signal-text-secondary uppercase tracking-widest mb-2 font-mono">
              Conta
            </span>
            <button
              onClick={() => setActiveTab('profile')}
              className={navBtn(activeTab === 'profile')}
            >
              Perfil
            </button>
            <button
              onClick={() => setActiveTab('voice')}
              className={navBtn(activeTab === 'voice')}
            >
              Voz e video
            </button>
            {isAppAdmin && (
              <button
                onClick={() => setActiveTab('admin')}
                className={navBtn(activeTab === 'admin')}
              >
                <span className="inline-flex items-center gap-2">
                  <Shield className="w-3.5 h-3.5" />
                  Admin
                </span>
              </button>
            )}
            <button
              onClick={handleLogout}
              className="w-full text-left px-2.5 py-1.5 rounded-md text-xs font-semibold text-signal-danger hover:bg-signal-danger/10 transition-colors"
            >
              <span className="inline-flex items-center gap-2">
                <SignOut className="w-3.5 h-3.5" />
                Sair
              </span>
            </button>
          </div>
        </div>
      </aside>

      <main className="flex-1 bg-signal-bg overflow-y-auto py-12 px-10 relative panel-cut-tl">
        <div className="absolute right-12 top-12 flex flex-col items-center">
          <button
            onClick={closeSettings}
            className="w-9 h-9 rounded-full border border-signal-border hover:border-brass flex items-center justify-center text-signal-text-secondary hover:text-signal-text-primary transition-all group"
          >
            <X className="w-5 h-5 group-hover:scale-105" />
          </button>
          <span className="text-[9px] font-bold text-signal-text-secondary mt-1.5 tracking-wide font-mono">
            ESC
          </span>
        </div>

        {activeTab === 'profile' && <form onSubmit={handleSaveProfile} className="max-w-xl space-y-6">
          <div>
            <h2 className="text-xl font-display font-bold text-signal-text-primary">Perfil de Usuario</h2>
            <p className="text-xs text-signal-text-secondary mt-1">
              Essas alteracoes sao salvas no Supabase.
            </p>
          </div>

          <div className={`${cardCls} flex items-center gap-4`}>
            <img
              src={avatarUrl || currentUser.avatar}
              alt={displayName}
              className="w-20 h-20 rounded-full object-cover border border-signal-border"
              onError={(event) => {
                event.currentTarget.src = currentUser.avatar;
              }}
            />
            <div className="block space-y-2 flex-1 min-w-0">
              <span className="text-xs font-bold text-signal-text-secondary uppercase tracking-wider inline-flex items-center gap-2">
                <Camera className="w-3.5 h-3.5" />
                Foto de perfil
              </span>
              <label className="inline-flex items-center justify-center px-4 py-3 bg-signal-bg hover:bg-signal-surface border border-signal-border rounded-md text-xs font-semibold text-signal-text-primary cursor-pointer transition-colors">
                {avatarUploading ? 'Enviando...' : 'Escolher imagem'}
                <input
                  type="file"
                  accept="image/png,image/jpeg,image/webp,image/gif"
                  onChange={handleAvatarUpload}
                  disabled={avatarUploading}
                  className="sr-only"
                />
              </label>
              <p className="text-[10px] text-signal-text-secondary">
                PNG, JPG, WEBP ou GIF ate 5 MB.
              </p>
            </div>
          </div>

          <div className={`${cardCls} space-y-3`}>
            <span className="block text-xs font-bold text-signal-text-secondary uppercase tracking-wider inline-flex items-center gap-2">
              <ImageSquare className="w-3.5 h-3.5" />
              Banner do perfil
            </span>
            <div
              className={`relative w-full h-28 overflow-hidden rounded-md border border-signal-border bg-signal-bg ${
                bannerUrl ? '' : 'bg-gradient-to-r from-brass-dark to-brass'
              }`}
            >
              {bannerUrl && (
                <img
                  src={bannerUrl}
                  alt="Banner do perfil"
                  className="w-full h-full object-cover"
                  onError={(event) => { event.currentTarget.style.display = 'none'; }}
                />
              )}
            </div>
            <div className="flex items-center gap-2">
              <label className="inline-flex items-center justify-center px-4 py-3 bg-signal-bg hover:bg-signal-surface border border-signal-border rounded-md text-xs font-semibold text-signal-text-primary cursor-pointer transition-colors">
                {bannerUploading ? 'Enviando...' : 'Escolher imagem'}
                <input
                  type="file"
                  accept="image/png,image/jpeg,image/webp,image/gif"
                  onChange={handleBannerUpload}
                  disabled={bannerUploading}
                  className="sr-only"
                />
              </label>
              {bannerUrl && (
                <button
                  type="button"
                  onClick={() => setBannerUrl('')}
                  className="inline-flex items-center justify-center px-4 py-3 bg-signal-bg hover:bg-signal-danger/10 border border-signal-border rounded-md text-xs font-semibold text-signal-danger cursor-pointer transition-colors"
                >
                  Remover banner
                </button>
              )}
            </div>
            <p className="text-[10px] text-signal-text-secondary">
              Aparece no topo do seu perfil. PNG, JPG, WEBP ou GIF ate 5 MB.
            </p>
          </div>

          <div className={`${cardCls} space-y-3`}>
            <label className="block text-xs font-bold text-signal-text-secondary uppercase tracking-wider">
              Status
            </label>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
              {[
                { key: 'online', label: 'Online', color: 'bg-signal-success' },
                { key: 'idle', label: 'Ausente', color: 'bg-signal-warning' },
                { key: 'dnd', label: 'Ocupado', color: 'bg-signal-danger' },
                { key: 'offline', label: 'Invisivel', color: 'bg-signal-text-secondary' },
              ].map((item) => (
                <button
                  key={item.key}
                  type="button"
                  onClick={() => setStatus(item.key as typeof status)}
                  className={`p-2.5 rounded-md border flex items-center gap-2 transition-colors ${
                    status === item.key
                      ? 'border-brass bg-brass/5 text-signal-text-primary'
                      : 'border-signal-border bg-signal-bg hover:bg-signal-surface text-signal-text-secondary'
                  }`}
                >
                  <div className={`w-2.5 h-2.5 rounded-full ${item.color}`} />
                  <span className="text-xs font-semibold">{item.label}</span>
                </button>
              ))}
            </div>
          </div>

          <label className="block space-y-2">
            <span className="block text-xs font-bold text-signal-text-secondary uppercase tracking-wider">
              Nome de usuario <span className="text-brass">(unico)</span>
            </span>
            <input
              type="text"
              value={username}
              onChange={(event) => setUsername(event.target.value)}
              pattern="[a-zA-Z0-9_]+"
              minLength={2}
              maxLength={32}
              title="Apenas letras, numeros e _"
              className={inputCls}
            />
            <span className="block text-[9px] text-signal-text-secondary">
              Usado para adicionar amigos e ser encontrado (ex: joao_dev).
            </span>
          </label>

          <label className="block space-y-2">
            <span className="block text-xs font-bold text-signal-text-secondary uppercase tracking-wider">
              Nome de exibicao
            </span>
            <input
              type="text"
              value={displayName}
              onChange={(event) => setDisplayName(event.target.value)}
              className={inputCls}
              required
            />
          </label>

          <label className="block space-y-2">
            <span className="block text-xs font-bold text-signal-text-secondary uppercase tracking-wider">
              Bio
            </span>
            <textarea
              value={bio}
              onChange={(event) => setBio(event.target.value)}
              rows={4}
              className={`${inputCls} resize-none leading-relaxed`}
            />
          </label>

          <button
            type="submit"
            className={primaryBtn}
          >
            Salvar alteracoes
          </button>
        </form>}

        {activeTab === 'voice' && (
          <form onSubmit={handleSaveVoice} className="max-w-xl space-y-6">
            <div>
              <h2 className="text-xl font-display font-bold text-signal-text-primary">Voz e video</h2>
              <p className="text-xs text-signal-text-secondary mt-1">
                Preferencias usadas quando voce entra em uma chamada.
              </p>
            </div>

            <div className="bg-signal-secondary rounded-md border border-signal-border divide-y divide-signal-border">
              {[
                { label: 'Entrar mutado', value: startMuted, setter: setStartMuted, icon: Microphone },
                { label: 'Abrir camera em chamadas de video', value: startCamera, setter: setStartCamera, icon: VideoCamera },
                { label: 'Cancelamento de eco', value: echoCancellation, setter: setEchoCancellation, icon: Monitor },
                { label: 'Supressao de ruido', value: noiseSuppression, setter: setNoiseSuppression, icon: Microphone },
              ].map((option) => {
                const Icon = option.icon;
                return (
                  <button
                    key={option.label}
                    type="button"
                    onClick={() => option.setter(!option.value)}
                    className="w-full px-4 py-3 flex items-center justify-between text-left hover:bg-signal-surface/40 transition-colors first:rounded-t-md last:rounded-b-md"
                  >
                    <span className="inline-flex items-center gap-3 text-xs font-semibold text-signal-text-primary">
                      <Icon className="w-4 h-4 text-signal-text-secondary" />
                      {option.label}
                    </span>
                    <span className={`w-10 h-6 rounded-full p-1 transition-colors ${option.value ? 'bg-signal-success' : 'bg-signal-border'}`}>
                      <span className={`block w-4 h-4 rounded-full bg-white transition-transform ${option.value ? 'translate-x-4' : 'translate-x-0'}`} />
                    </span>
                  </button>
                );
              })}
            </div>

            <div className={`bg-signal-secondary rounded-md border border-signal-border p-4 space-y-3 ${noiseSuppression ? '' : 'opacity-60'}`}>
              <div className="flex items-center justify-between">
                <span className="inline-flex items-center gap-2 text-xs font-semibold text-signal-text-primary">
                  <Microphone className="w-4 h-4 text-signal-text-secondary" />
                  Nivel de supressao de ruido
                </span>
                <span className="text-[10px] text-signal-text-secondary">
                  {noiseSuppressionLevel === 'low' ? 'Suave - deixa mais som de fundo' : noiseSuppressionLevel === 'high' ? 'Forte - corta quase tudo' : 'Padrao'}
                </span>
              </div>
              <div className="flex gap-1.5">
                {([
                  { key: 'low', label: 'Baixo' },
                  { key: 'medium', label: 'Medio' },
                  { key: 'high', label: 'Alto' },
                ] as const).map((option) => (
                  <button
                    key={option.key}
                    type="button"
                    disabled={!noiseSuppression}
                    onClick={() => setNoiseSuppressionLevel(option.key)}
                    className={`flex-1 px-3 py-2 rounded-md text-xs font-bold transition-colors ${
                      noiseSuppressionLevel === option.key
                        ? 'bg-brass text-signal-bg'
                        : 'bg-signal-bg border border-signal-border text-signal-text-secondary hover:text-signal-text-primary'
                    }`}
                  >
                    {option.label}
                  </button>
                ))}
              </div>
            </div>

            <div className="bg-signal-secondary rounded-md border border-signal-border space-y-4 p-4">
              <div className="flex items-center gap-2">
                <Gauge className="w-4 h-4 text-signal-text-secondary" />
                <span className="text-xs font-bold text-signal-text-secondary uppercase tracking-wider">
                  Qualidade de transmissao
                </span>
              </div>

              <label className="block space-y-2">
                <span className="block text-[10px] font-bold text-signal-text-secondary uppercase tracking-wider">Resolucao</span>
                <select
                  value={videoQuality}
                  onChange={(event) => setVideoQuality(event.target.value)}
                  className={inputCls}
                >
                  <option value="auto">Automatica</option>
                  <option value="480p">480p</option>
                  <option value="720p">720p</option>
                  <option value="1080p">1080p</option>
                </select>
              </label>

              <label className="block space-y-2">
                <span className="block text-[10px] font-bold text-signal-text-secondary uppercase tracking-wider inline-flex items-center gap-1.5">
                  <FilmSlate className="w-3.5 h-3.5" />
                  Quadros por segundo (FPS)
                </span>
                <select
                  value={videoFps}
                  onChange={(event) => setVideoFps(Number(event.target.value))}
                  className={inputCls}
                >
                  <option value={15}>15 FPS</option>
                  <option value={24}>24 FPS</option>
                  <option value={30}>30 FPS</option>
                  <option value={60}>60 FPS</option>
                </select>
              </label>

              <label className="block space-y-2">
                <span className="block text-[10px] font-bold text-signal-text-secondary uppercase tracking-wider">Taxa de bits</span>
                <select
                  value={videoBitrate}
                  onChange={(event) => setVideoBitrate(Number(event.target.value))}
                  className={inputCls}
                >
                  <option value={0}>Automatica</option>
                  <option value={600}>600 kbps</option>
                  <option value={1200}>1.2 Mbps</option>
                  <option value={2500}>2.5 Mbps</option>
                  <option value={4000}>4 Mbps</option>
                </select>
              </label>
            </div>

            <label className="block space-y-2">
              <select
                value={inputDevice}
                onChange={(event) => setInputDevice(event.target.value)}
                className={inputCls}
              >
                <option value="">Padrao do navegador</option>
                {devices.filter((device) => device.kind === 'audioinput').map((device) => (
                  <option key={device.deviceId} value={device.deviceId}>{device.label || `Microfone ${device.deviceId.slice(0, 6)}`}</option>
                ))}
              </select>
            </label>

            <label className="block space-y-2">
              <span className="block text-xs font-bold text-signal-text-secondary uppercase tracking-wider">Camera</span>
              <select
                value={cameraDevice}
                onChange={(event) => setCameraDevice(event.target.value)}
                className={inputCls}
              >
                <option value="">Padrao do navegador</option>
                {devices.filter((device) => device.kind === 'videoinput').map((device) => (
                  <option key={device.deviceId} value={device.deviceId}>{device.label || `Camera ${device.deviceId.slice(0, 6)}`}</option>
                ))}
              </select>
            </label>

            <button
              type="submit"
              className={primaryBtn}
            >
              Salvar preferencias
            </button>
          </form>
        )}

        {activeTab === 'admin' && isAppAdmin && (
          <section className="max-w-5xl space-y-6">
            <div className="flex items-center justify-between gap-4">
              <div>
                <h2 className="text-xl font-display font-bold text-signal-text-primary">Painel Admin</h2>
                <p className="text-xs text-signal-text-secondary mt-1">
                  Administracao global do Discordex.
                </p>
              </div>
              <button
                type="button"
                onClick={() => { void loadAdminAccounts(); void loadAdminStats(); }}
                className="px-4 py-2.5 bg-signal-secondary hover:bg-signal-surface border border-signal-border text-signal-text-primary rounded-md text-xs font-semibold inline-flex items-center gap-2 transition-colors"
              >
                <ArrowsClockwise className={`w-4 h-4 ${adminLoading || adminStatsLoading ? 'animate-spin' : ''}`} />
                Atualizar
              </button>
            </div>

            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              {[
                { label: 'Usuarios', value: adminStats?.total_users, icon: Users },
                { label: 'Online agora', value: adminStats?.online_users, icon: CellSignalHigh },
                { label: 'Servidores', value: adminStats?.total_servers, icon: Hash },
                { label: 'Canais', value: adminStats?.total_channels, icon: Waveform },
                { label: 'Mensagens', value: adminStats?.total_messages, icon: ChatCircleDots },
                { label: 'Mensagens diretas', value: adminStats?.total_dm_messages, icon: EnvelopeSimpleOpen },
                { label: 'Amizades', value: adminStats?.total_friendships, icon: UsersThree },
                { label: 'Em chamada', value: adminStats?.active_voice, icon: PhoneCall },
              ].map((stat) => {
                const Icon = stat.icon;
                return (
                  <div key={stat.label} className="bg-signal-secondary border border-signal-border rounded-md p-4 space-y-2">
                    <span className="inline-flex items-center gap-1.5 text-[10px] font-bold text-signal-text-secondary uppercase tracking-wider">
                      <Icon className="w-3.5 h-3.5 text-brass" />
                      {stat.label}
                    </span>
                    <span className="block text-2xl font-display font-bold text-signal-text-primary font-mono">
                      {stat.value === undefined ? '—' : stat.value.toLocaleString('pt-BR')}
                    </span>
                  </div>
                );
              })}
            </div>

            <div className="bg-signal-secondary border border-signal-border rounded-md overflow-hidden">
              <div className="grid grid-cols-[1.6fr_1fr_0.8fr_1fr_1.4fr] gap-3 px-4 py-3 text-[10px] font-bold uppercase tracking-wider text-signal-text-secondary border-b border-signal-border">
                <span>Conta</span>
                <span>Status</span>
                <span>Tipo</span>
                <span>Criada em</span>
                <span className="text-right">Acoes</span>
              </div>

              {adminAccounts.length === 0 ? (
                <div className="px-4 py-8 text-center text-xs text-signal-text-secondary">
                  {adminLoading ? 'Carregando contas...' : 'Nenhuma conta retornada.'}
                </div>
              ) : (
                adminAccounts.map((account) => (
                  <div
                    key={account.id}
                    className="grid grid-cols-[1.6fr_1fr_0.8fr_1fr_1.4fr] gap-3 px-4 py-3 items-center border-b border-signal-border/60 last:border-b-0 hover:bg-signal-surface/30 transition-colors"
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      <img
                        src={account.avatar_url || `https://ui-avatars.com/api/?background=ED4245&color=fff&bold=true&name=${encodeURIComponent(account.display_name || account.username)}`}
                        alt={account.display_name}
                        className="w-9 h-9 rounded-full object-cover border border-signal-border"
                      />
                      <div className="min-w-0">
                        <span className="block text-xs font-bold text-signal-text-primary truncate">
                          {account.display_name}
                        </span>
                        <span className="block text-[10px] text-signal-text-secondary truncate font-mono">
                          @{account.username}
                        </span>
                      </div>
                    </div>
                    <span className="text-xs text-signal-text-secondary capitalize">{account.status}</span>
                    <span className={`text-[10px] font-bold w-fit px-2 py-1 rounded-md ${account.is_admin ? 'bg-brass/15 text-brass' : 'bg-signal-surface text-signal-text-secondary'}`}>
                      {account.is_admin ? 'ADMIN' : 'USER'}
                    </span>
                    <span className="text-[10px] text-signal-text-secondary font-mono">
                      {new Date(account.created_at).toLocaleDateString('pt-BR')}
                    </span>
                    <div className="flex items-center justify-end gap-1.5">
                      {account.is_admin ? (
                        <button
                          type="button"
                          disabled={adminAction === account.id || account.id === currentUser.id}
                          onClick={() => runAdminAction('revoke_app_admin', account.id, `Remover admin de ${account.display_name}?`)}
                          className="px-2.5 py-1.5 rounded-md text-[10px] font-bold bg-signal-bg border border-signal-border text-signal-warning hover:bg-signal-warning/10 transition-colors disabled:opacity-50"
                        >
                          Remover admin
                        </button>
                      ) : (
                        <button
                          type="button"
                          disabled={adminAction === account.id}
                          onClick={() => runAdminAction('promote_app_admin', account.id, `Tornar ${account.display_name} admin global?`)}
                          className="px-2.5 py-1.5 rounded-md text-[10px] font-bold bg-brass/10 border border-brass/30 text-brass hover:bg-brass hover:text-signal-bg transition-colors disabled:opacity-50"
                        >
                          Tornar admin
                        </button>
                      )}
                      <button
                        type="button"
                        disabled={adminAction === account.id || account.id === currentUser.id}
                        onClick={() => runAdminAction('delete_app_account', account.id, `BANIR ${account.display_name}? Esta acao remove a conta permanentemente.`)}
                        className="px-2.5 py-1.5 rounded-md text-[10px] font-bold bg-signal-danger/10 border border-signal-danger/30 text-signal-danger hover:bg-signal-danger hover:text-white transition-colors disabled:opacity-50"
                      >
                        Banir
                      </button>
                    </div>
                  </div>
                ))
              )}
            </div>
          </section>
        )}
      </main>
    </div>
  );
};