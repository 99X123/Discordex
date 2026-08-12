import React, { useEffect, useState } from 'react';
import { Camera, CircleGauge, Clapperboard, LogOut, Mic, Monitor, RefreshCw, Shield, Video, X } from 'lucide-react';
import { useApp } from '../context/AppContext';
import { ServerSettings } from './ServerSettings';
import { logout } from '../services/auth';
import { supabase } from '../lib/supabase';
import type { Database } from '../lib/database.types';

type AdminAccount = Database['public']['Functions']['list_registered_accounts']['Returns'][number];

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
  } = useApp();

  const [displayName, setDisplayName] = useState(currentUser.displayName);
  const [username, setUsername] = useState(currentUser.username);
  const [bio, setBio] = useState(currentUser.bio || '');
  const [status, setStatus] = useState(currentUser.status);
  const [avatarUrl, setAvatarUrl] = useState(currentUser.avatar);
  const [avatarUploading, setAvatarUploading] = useState(false);
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
  const activeServer = servers.find((server) => server.id === activeServerSettingsId);

  useEffect(() => {
    setDisplayName(currentUser.displayName);
    setUsername(currentUser.username);
    setBio(currentUser.bio || '');
    setStatus(currentUser.status);
    setAvatarUrl(currentUser.avatar);
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

  useEffect(() => {
    if (isSettingsOpen && activeTab === 'admin') void loadAdminAccounts();
  }, [isSettingsOpen, activeTab, isAppAdmin]);

  if (!isSettingsOpen) return null;

  if (activeServer) {
    return <ServerSettings server={activeServer} onClose={closeSettings} initialTab={serverSettingsTab} initialRoleId={serverSettingsRoleId} />;
  }

  const handleSaveProfile = (event: React.FormEvent) => {
    event.preventDefault();
    updateCurrentUserProfile(displayName, bio, status, avatarUrl, username);
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
    updateCurrentUserProfile(displayName, bio, status, data.publicUrl, username);
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

  return (
    <div className="fixed inset-0 z-50 bg-discordex-bg flex animate-fade-in">
      <aside className="w-60 bg-discordex-secondary flex justify-end border-r border-discordex-border py-12 px-6 shrink-0">
        <div className="w-48 space-y-6">
          <div className="space-y-1">
            <span className="block px-2.5 text-[9px] font-bold text-discordex-text-secondary uppercase tracking-widest mb-2">
              Conta
            </span>
            <button
              onClick={() => setActiveTab('profile')}
              className={`w-full text-left px-2.5 py-1.5 rounded-lg text-xs font-semibold transition-colors ${activeTab === 'profile' ? 'bg-discordex-surface text-discordex-text-primary' : 'text-discordex-text-secondary hover:bg-discordex-surface/40 hover:text-discordex-text-primary'}`}
            >
              Perfil
            </button>
            <button
              onClick={() => setActiveTab('voice')}
              className={`w-full text-left px-2.5 py-1.5 rounded-lg text-xs font-semibold transition-colors ${activeTab === 'voice' ? 'bg-discordex-surface text-discordex-text-primary' : 'text-discordex-text-secondary hover:bg-discordex-surface/40 hover:text-discordex-text-primary'}`}
            >
              Voz e video
            </button>
            {isAppAdmin && (
              <button
                onClick={() => setActiveTab('admin')}
                className={`w-full text-left px-2.5 py-1.5 rounded-lg text-xs font-semibold transition-colors ${activeTab === 'admin' ? 'bg-discordex-surface text-discordex-text-primary' : 'text-discordex-text-secondary hover:bg-discordex-surface/40 hover:text-discordex-text-primary'}`}
              >
                <span className="inline-flex items-center gap-2">
                  <Shield className="w-3.5 h-3.5" />
                  Admin
                </span>
              </button>
            )}
            <button
              onClick={handleLogout}
              className="w-full text-left px-2.5 py-1.5 rounded-lg text-xs font-semibold text-discordex-danger hover:bg-discordex-danger/10 transition-colors"
            >
              <span className="inline-flex items-center gap-2">
                <LogOut className="w-3.5 h-3.5" />
                Sair
              </span>
            </button>
          </div>
        </div>
      </aside>

      <main className="flex-1 bg-discordex-bg overflow-y-auto py-12 px-10 relative">
        <div className="absolute right-12 top-12 flex flex-col items-center">
          <button
            onClick={closeSettings}
            className="w-9 h-9 rounded-full border border-discordex-border hover:border-discordex-text-primary flex items-center justify-center text-discordex-text-secondary hover:text-discordex-text-primary transition-all group"
          >
            <X className="w-5 h-5 group-hover:scale-105" />
          </button>
          <span className="text-[9px] font-bold text-discordex-text-secondary mt-1.5 tracking-wide">
            ESC
          </span>
        </div>

        {activeTab === 'profile' && <form onSubmit={handleSaveProfile} className="max-w-xl space-y-6">
          <div>
            <h2 className="text-xl font-bold text-discordex-text-primary">Perfil de Usuario</h2>
            <p className="text-xs text-discordex-text-secondary mt-1">
              Essas alteracoes sao salvas no Supabase.
            </p>
          </div>

          <div className="bg-discordex-secondary p-4.5 rounded-2xl border border-discordex-border flex items-center gap-4">
            <img
              src={avatarUrl || currentUser.avatar}
              alt={displayName}
              className="w-20 h-20 rounded-full object-cover border border-discordex-border"
              onError={(event) => {
                event.currentTarget.src = currentUser.avatar;
              }}
            />
            <div className="block space-y-2 flex-1 min-w-0">
              <span className="text-xs font-bold text-discordex-text-secondary uppercase tracking-wider inline-flex items-center gap-2">
                <Camera className="w-3.5 h-3.5" />
                Foto de perfil
              </span>
              <label className="inline-flex items-center justify-center px-4 py-3 bg-discordex-bg hover:bg-discordex-surface border border-discordex-border rounded-xl text-xs font-semibold text-discordex-text-primary cursor-pointer transition-colors">
                {avatarUploading ? 'Enviando...' : 'Escolher imagem'}
                <input
                  type="file"
                  accept="image/png,image/jpeg,image/webp,image/gif"
                  onChange={handleAvatarUpload}
                  disabled={avatarUploading}
                  className="sr-only"
                />
              </label>
              <p className="text-[10px] text-discordex-text-secondary">
                PNG, JPG, WEBP ou GIF ate 5 MB.
              </p>
            </div>
          </div>

          <div className="bg-discordex-secondary p-4.5 rounded-2xl border border-discordex-border space-y-3">
            <label className="block text-xs font-bold text-discordex-text-secondary uppercase tracking-wider">
              Status
            </label>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
              {[
                { key: 'online', label: 'Online', color: 'bg-discordex-success' },
                { key: 'idle', label: 'Ausente', color: 'bg-discordex-warning' },
                { key: 'dnd', label: 'Ocupado', color: 'bg-discordex-danger' },
                { key: 'offline', label: 'Invisivel', color: 'bg-discordex-text-secondary' },
              ].map((item) => (
                <button
                  key={item.key}
                  type="button"
                  onClick={() => setStatus(item.key as typeof status)}
                  className={`p-2.5 rounded-xl border flex items-center gap-2 transition-colors ${
                    status === item.key
                      ? 'border-primary bg-primary/5 text-discordex-text-primary'
                      : 'border-discordex-border bg-discordex-bg hover:bg-discordex-surface text-discordex-text-secondary'
                  }`}
                >
                  <div className={`w-2.5 h-2.5 rounded-full ${item.color}`} />
                  <span className="text-xs font-semibold">{item.label}</span>
                </button>
              ))}
            </div>
          </div>

          <label className="block space-y-2">
            <span className="block text-xs font-bold text-discordex-text-secondary uppercase tracking-wider">
              Nome de usuario <span className="text-primary">(unico)</span>
            </span>
            <input
              type="text"
              value={username}
              onChange={(event) => setUsername(event.target.value)}
              pattern="[a-zA-Z0-9_]+"
              minLength={2}
              maxLength={32}
              title="Apenas letras, numeros e _"
              className="w-full px-4 py-3 bg-discordex-secondary border border-discordex-border rounded-xl text-xs text-discordex-text-primary focus:outline-none focus:border-primary transition-colors"
            />
            <span className="block text-[9px] text-discordex-text-secondary">
              Usado para adicionar amigos e ser encontrado (ex: joao_dev).
            </span>
          </label>

          <label className="block space-y-2">
            <span className="block text-xs font-bold text-discordex-text-secondary uppercase tracking-wider">
              Nome de exibicao
            </span>
            <input
              type="text"
              value={displayName}
              onChange={(event) => setDisplayName(event.target.value)}
              className="w-full px-4 py-3 bg-discordex-secondary border border-discordex-border rounded-xl text-xs text-discordex-text-primary focus:outline-none focus:border-primary transition-colors"
              required
            />
          </label>

          <label className="block space-y-2">
            <span className="block text-xs font-bold text-discordex-text-secondary uppercase tracking-wider">
              Bio
            </span>
            <textarea
              value={bio}
              onChange={(event) => setBio(event.target.value)}
              rows={4}
              className="w-full px-4 py-3 bg-discordex-secondary border border-discordex-border rounded-xl text-xs text-discordex-text-primary focus:outline-none focus:border-primary transition-colors resize-none leading-relaxed"
            />
          </label>

          <button
            type="submit"
            className="px-5 py-2.5 bg-primary hover:bg-primary-hover text-white rounded-xl text-sm font-semibold transition-colors"
          >
            Salvar alteracoes
          </button>
        </form>}

        {activeTab === 'voice' && (
          <form onSubmit={handleSaveVoice} className="max-w-xl space-y-6">
            <div>
              <h2 className="text-xl font-bold text-discordex-text-primary">Voz e video</h2>
              <p className="text-xs text-discordex-text-secondary mt-1">
                Preferencias usadas quando voce entra em uma chamada.
              </p>
            </div>

            <div className="bg-discordex-secondary rounded-2xl border border-discordex-border divide-y divide-discordex-border">
              {[
                { label: 'Entrar mutado', value: startMuted, setter: setStartMuted, icon: Mic },
                { label: 'Abrir camera em chamadas de video', value: startCamera, setter: setStartCamera, icon: Video },
                { label: 'Cancelamento de eco', value: echoCancellation, setter: setEchoCancellation, icon: Monitor },
                { label: 'Supressao de ruido', value: noiseSuppression, setter: setNoiseSuppression, icon: Mic },
              ].map((option) => {
                const Icon = option.icon;
                return (
                  <button
                    key={option.label}
                    type="button"
                    onClick={() => option.setter(!option.value)}
                    className="w-full px-4 py-3 flex items-center justify-between text-left hover:bg-discordex-surface/40 transition-colors first:rounded-t-2xl last:rounded-b-2xl"
                  >
                    <span className="inline-flex items-center gap-3 text-xs font-semibold text-discordex-text-primary">
                      <Icon className="w-4 h-4 text-discordex-text-secondary" />
                      {option.label}
                    </span>
                    <span className={`w-10 h-6 rounded-full p-1 transition-colors ${option.value ? 'bg-discordex-success' : 'bg-discordex-border'}`}>
                      <span className={`block w-4 h-4 rounded-full bg-white transition-transform ${option.value ? 'translate-x-4' : 'translate-x-0'}`} />
                    </span>
                  </button>
                );
              })}
            </div>

            <div className={`bg-discordex-secondary rounded-2xl border border-discordex-border p-4 space-y-3 ${noiseSuppression ? '' : 'opacity-60'}`}>
              <div className="flex items-center justify-between">
                <span className="inline-flex items-center gap-2 text-xs font-semibold text-discordex-text-primary">
                  <Mic className="w-4 h-4 text-discordex-text-secondary" />
                  Nivel de supressao de ruido
                </span>
                <span className="text-[10px] text-discordex-text-secondary">
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
                    className={`flex-1 px-3 py-2 rounded-xl text-xs font-bold transition-colors ${
                      noiseSuppressionLevel === option.key
                        ? 'bg-primary text-white'
                        : 'bg-discordex-bg border border-discordex-border text-discordex-text-secondary hover:text-discordex-text-primary'
                    }`}
                  >
                    {option.label}
                  </button>
                ))}
              </div>
            </div>

            <div className="bg-discordex-secondary rounded-2xl border border-discordex-border space-y-4 p-4">
              <div className="flex items-center gap-2">
                <CircleGauge className="w-4 h-4 text-discordex-text-secondary" />
                <span className="text-xs font-bold text-discordex-text-secondary uppercase tracking-wider">
                  Qualidade de transmissao
                </span>
              </div>

              <label className="block space-y-2">
                <span className="block text-[10px] font-bold text-discordex-text-secondary uppercase tracking-wider">Resolucao</span>
                <select
                  value={videoQuality}
                  onChange={(event) => setVideoQuality(event.target.value)}
                  className="w-full px-4 py-3 bg-discordex-bg border border-discordex-border rounded-xl text-xs text-discordex-text-primary focus:outline-none focus:border-primary"
                >
                  <option value="auto">Automatica</option>
                  <option value="480p">480p</option>
                  <option value="720p">720p</option>
                  <option value="1080p">1080p</option>
                </select>
              </label>

              <label className="block space-y-2">
                <span className="block text-[10px] font-bold text-discordex-text-secondary uppercase tracking-wider inline-flex items-center gap-1.5">
                  <Clapperboard className="w-3.5 h-3.5" />
                  Quadros por segundo (FPS)
                </span>
                <select
                  value={videoFps}
                  onChange={(event) => setVideoFps(Number(event.target.value))}
                  className="w-full px-4 py-3 bg-discordex-bg border border-discordex-border rounded-xl text-xs text-discordex-text-primary focus:outline-none focus:border-primary"
                >
                  <option value={15}>15 FPS</option>
                  <option value={24}>24 FPS</option>
                  <option value={30}>30 FPS</option>
                  <option value={60}>60 FPS</option>
                </select>
              </label>

              <label className="block space-y-2">
                <span className="block text-[10px] font-bold text-discordex-text-secondary uppercase tracking-wider">Taxa de bits</span>
                <select
                  value={videoBitrate}
                  onChange={(event) => setVideoBitrate(Number(event.target.value))}
                  className="w-full px-4 py-3 bg-discordex-bg border border-discordex-border rounded-xl text-xs text-discordex-text-primary focus:outline-none focus:border-primary"
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
                className="w-full px-4 py-3 bg-discordex-secondary border border-discordex-border rounded-xl text-xs text-discordex-text-primary focus:outline-none focus:border-primary"
              >
                <option value="">Padrao do navegador</option>
                {devices.filter((device) => device.kind === 'audioinput').map((device) => (
                  <option key={device.deviceId} value={device.deviceId}>{device.label || `Microfone ${device.deviceId.slice(0, 6)}`}</option>
                ))}
              </select>
            </label>

            <label className="block space-y-2">
              <span className="block text-xs font-bold text-discordex-text-secondary uppercase tracking-wider">Camera</span>
              <select
                value={cameraDevice}
                onChange={(event) => setCameraDevice(event.target.value)}
                className="w-full px-4 py-3 bg-discordex-secondary border border-discordex-border rounded-xl text-xs text-discordex-text-primary focus:outline-none focus:border-primary"
              >
                <option value="">Padrao do navegador</option>
                {devices.filter((device) => device.kind === 'videoinput').map((device) => (
                  <option key={device.deviceId} value={device.deviceId}>{device.label || `Camera ${device.deviceId.slice(0, 6)}`}</option>
                ))}
              </select>
            </label>

            <button
              type="submit"
              className="px-5 py-2.5 bg-primary hover:bg-primary-hover text-white rounded-xl text-sm font-semibold transition-colors"
            >
              Salvar preferencias
            </button>
          </form>
        )}

        {activeTab === 'admin' && isAppAdmin && (
          <section className="max-w-4xl space-y-6">
            <div className="flex items-center justify-between gap-4">
              <div>
                <h2 className="text-xl font-bold text-discordex-text-primary">Painel Admin</h2>
                <p className="text-xs text-discordex-text-secondary mt-1">
                  Contas registradas no Supabase.
                </p>
              </div>
              <button
                type="button"
                onClick={loadAdminAccounts}
                className="px-4 py-2.5 bg-discordex-secondary hover:bg-discordex-surface border border-discordex-border text-discordex-text-primary rounded-xl text-xs font-semibold inline-flex items-center gap-2 transition-colors"
              >
                <RefreshCw className={`w-4 h-4 ${adminLoading ? 'animate-spin' : ''}`} />
                Atualizar
              </button>
            </div>

            <div className="bg-discordex-secondary border border-discordex-border rounded-2xl overflow-hidden">
              <div className="grid grid-cols-[1.6fr_1fr_0.8fr_0.8fr] gap-3 px-4 py-3 text-[10px] font-bold uppercase tracking-wider text-discordex-text-secondary border-b border-discordex-border">
                <span>Conta</span>
                <span>Status</span>
                <span>Tipo</span>
                <span>Criada em</span>
              </div>

              {adminAccounts.length === 0 ? (
                <div className="px-4 py-8 text-center text-xs text-discordex-text-secondary">
                  {adminLoading ? 'Carregando contas...' : 'Nenhuma conta retornada.'}
                </div>
              ) : (
                adminAccounts.map((account) => (
                  <div
                    key={account.id}
                    className="grid grid-cols-[1.6fr_1fr_0.8fr_0.8fr] gap-3 px-4 py-3 items-center border-b border-discordex-border/60 last:border-b-0 hover:bg-discordex-surface/30 transition-colors"
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      <img
                        src={account.avatar_url || `https://ui-avatars.com/api/?background=ED4245&color=fff&bold=true&name=${encodeURIComponent(account.display_name || account.username)}`}
                        alt={account.display_name}
                        className="w-9 h-9 rounded-full object-cover border border-discordex-border"
                      />
                      <div className="min-w-0">
                        <span className="block text-xs font-bold text-discordex-text-primary truncate">
                          {account.display_name}
                        </span>
                        <span className="block text-[10px] text-discordex-text-secondary truncate">
                          @{account.username}
                        </span>
                      </div>
                    </div>
                    <span className="text-xs text-discordex-text-secondary capitalize">{account.status}</span>
                    <span className={`text-[10px] font-bold w-fit px-2 py-1 rounded-lg ${account.is_admin ? 'bg-primary/15 text-primary' : 'bg-discordex-surface text-discordex-text-secondary'}`}>
                      {account.is_admin ? 'ADMIN' : 'USER'}
                    </span>
                    <span className="text-[10px] text-discordex-text-secondary">
                      {new Date(account.created_at).toLocaleDateString('pt-BR')}
                    </span>
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
