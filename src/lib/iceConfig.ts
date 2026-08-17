export interface IceConfig {
  primary: RTCIceServer[];
  backup: RTCIceServer[];
}

interface IceConfigResponse {
  success: boolean;
  iceServers: RTCIceServer[];
  ttlSeconds?: number;
  message?: string;
}

// STUN publico — sem conta, sem configuracao. Conecta direto (P2P) quando a rede permite.
const stunServers: RTCIceServer[] = [
  'stun:stun.l.google.com:19302',
  'stun:stun1.l.google.com:19302',
  'stun:stun2.l.google.com:19302',
  'stun:stun3.l.google.com:19302',
  'stun:stun4.l.google.com:19302',
  'stun:global.stun.twilio.com:3478',
].map((url) => ({ urls: url }));

// Relay publico sem cadastro — usado automaticamente SO quando a conexao direta falha.
const publicTurn: RTCIceServer[] = [
  {
    urls: 'turn:openrelay.metered.ca:80',
    username: 'openrelayproject',
    credential: 'openrelayproject',
  },
];

let cachedPrimary: RTCIceServer[] | null = null;
let cachedBackup: RTCIceServer[] | null = null;
let cacheExpiresAt = 0;

async function fetchFrom(url: string): Promise<RTCIceServer[] | null> {
  try {
    const controller = new AbortController();
    const timer = window.setTimeout(() => controller.abort(), 2000);
    const res = await fetch(url, { signal: controller.signal });
    window.clearTimeout(timer);
    if (!res.ok) return null;
    const data = (await res.json()) as IceConfigResponse;
    if (data?.success && Array.isArray(data.iceServers) && data.iceServers.length > 0) {
      return data.iceServers;
    }
  } catch {
    /* endpoint indisponivel -> usa STUN puro */
  }
  return null;
}

/**
 * Retorna a configuracao ICE da chamada, em duas camadas:
 *
 * primary: conexao direta (STUN publico, sem conta) — usada primeiro.
 *          Se /api/ice-config responder rapido, pode incluir TURN efemero
 *          (Cloudflare) configurado opcionalmente nas env vars da Vercel.
 * backup:  STUN + relay publico sem cadastro (openrelay), usado pelo
 *          engine SOMENTE quando a conexao direta nao estabelece.
 *
 * Resultado fica em cache por 5 minutos.
 */
export async function getIceConfig(): Promise<IceConfig> {
  if (cachedPrimary && cachedBackup && Date.now() < cacheExpiresAt) {
    return { primary: cachedPrimary, backup: cachedBackup };
  }

  let primary: RTCIceServer[] = [...stunServers];

  if (import.meta.env.PROD) {
    const remote = await fetchFrom('/api/ice-config');
    if (remote && remote.length > 0) primary = remote;
  }

  const turnUrl = import.meta.env.VITE_TURN_URL as string | undefined;
  if (turnUrl) {
    const turnUsername = import.meta.env.VITE_TURN_USERNAME as string | undefined;
    const turnCredential = import.meta.env.VITE_TURN_CREDENTIAL as string | undefined;
    primary = [
      ...primary,
      turnUsername && turnCredential
        ? { urls: turnUrl, username: turnUsername, credential: turnCredential }
        : { urls: turnUrl },
    ];
  }

  cachedPrimary = primary;
  cachedBackup = [...stunServers, ...publicTurn];
  cacheExpiresAt = Date.now() + 5 * 60 * 1000;
  return { primary: cachedPrimary, backup: cachedBackup };
}