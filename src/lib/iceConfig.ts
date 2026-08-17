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

async function fetchFrom(url: string): Promise<RTCIceServer[] | null> {
  try {
    const controller = new AbortController();
    const timer = window.setTimeout(() => controller.abort(), 4000);
    const res = await fetch(url, { signal: controller.signal });
    window.clearTimeout(timer);
    if (!res.ok) return null;
    const data = (await res.json()) as IceConfigResponse;
    if (data?.success && Array.isArray(data.iceServers) && data.iceServers.length > 0) {
      return data.iceServers;
    }
  } catch {
    /* endpoint indisponivel -> tenta o proximo */
  }
  return null;
}

/**
 * Retorna os servidores ICE (STUN + TURN) para a chamada.
 *
 * 1) `/api/ice-config` na propria Vercel (mesmo origin, sem CORS; gera
 *    credenciais TURN efemeras e gratuitas da Cloudflare quando configurado).
 * 2) Edge function `webrtc-ice-config` do Supabase (se publicada).
 * 3) Fallback: STUN publico + vars VITE_TURN_* do ambiente.
 *
 * Resultado fica em cache por 5 minutos.
 */
export async function getIceServers(): Promise<RTCIceServer[]> {
  if (cachedIceServers && Date.now() < cacheExpiresAt) return cachedIceServers;

  const sameOrigin = await fetchFrom('/api/ice-config');
  if (sameOrigin) {
    cachedIceServers = sameOrigin;
    cacheExpiresAt = Date.now() + 5 * 60 * 1000;
    return cachedIceServers;
  }

  const supabaseUrl = (import.meta.env.VITE_SUPABASE_URL as string | undefined)?.trim().replace(/\/+$/, '');
  if (supabaseUrl) {
    const fromEdge = await fetchFrom(`${supabaseUrl}/functions/v1/webrtc-ice-config`);
    if (fromEdge) {
      cachedIceServers = fromEdge;
      cacheExpiresAt = Date.now() + 5 * 60 * 1000;
      return cachedIceServers;
    }
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