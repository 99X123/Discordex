import { supabase } from './supabase';

interface IceConfigResponse {
  success: boolean;
  iceServers: RTCIceServer[];
  ttlSeconds?: number;
  message?: string;
}

const fallbackStun: RTCIceServer[] = [
  'stun:stun.l.google.com:19302',
  'stun:stun1.l.google.com:19302',
  'stun:stun2.l.google.com:19302',
  'stun:stun3.l.google.com:19302',
  'stun:stun4.l.google.com:19302',
  'stun:global.stun.twilio.com:3478',
].map((url) => ({ urls: url }));

let cachedIceServers: RTCIceServer[] | null = null;
let cacheExpiresAt = 0;

/**
 * Retorna os servidores ICE (STUN + TURN) para a chamada.
 *
 * Primeiro tenta a edge function `webrtc-ice-config` (que pode gerar
 * credenciais TURN efemeras e gratuitas da Cloudflare). Se ela nao
 * estiver publicada, cai para STUN publico + as vars VITE_TURN_* do
 * ambiente. Resultado fica em cache por 5 minutos.
 */
export async function getIceServers(): Promise<RTCIceServer[]> {
  if (cachedIceServers && Date.now() < cacheExpiresAt) return cachedIceServers;

  try {
    const { data, error } = await supabase.functions.invoke<IceConfigResponse>('webrtc-ice-config', {
      method: 'GET',
    });

    if (!error && data?.success && Array.isArray(data.iceServers) && data.iceServers.length > 0) {
      const ttl = (data.ttlSeconds || 300) * 1000;
      cachedIceServers = data.iceServers;
      cacheExpiresAt = Date.now() + ttl;
      return cachedIceServers;
    }
  } catch {
    /* edge function fora do ar -> usa fallback */
  }

  const servers: RTCIceServer[] = [...fallbackStun];

  const turnUrl = import.meta.env.VITE_TURN_URL as string | undefined;
  if (turnUrl) {
    const turnUsername = import.meta.env.VITE_TURN_USERNAME as string | undefined;
    const turnCredential = import.meta.env.VITE_TURN_CREDENTIAL as string | undefined;
    servers.push(
      turnUsername && turnCredential
        ? { urls: turnUrl, username: turnUsername, credential: turnCredential }
        : { urls: turnUrl }
    );
  }

  cachedIceServers = servers;
  cacheExpiresAt = Date.now() + 5 * 60 * 1000;
  return servers;
}