// Configuracao ICE (STUN + TURN) servida pela propria Vercel.
// Mesmo origin do app -> sem problemas de CORS.
//
// Para usar TURN gratuito da Cloudflare (1 TB/mes), configure na Vercel:
//   Settings -> Environment Variables:
//   CLOUDFLARE_TURN_KEY_ID  = key id da TURN Key (Workers & Pages -> Cloudflare Calls)
//   CLOUDFLARE_TURN_API_TOKEN = API token da TURN Key
//
// Fallback: TURN_URL / TURN_USERNAME / TURN_CREDENTIAL (qualquer TURN proprio).
// Sem nada configurado, retorna apenas STUN publico.

const FALLBACK_STUN = [
  'stun:stun.l.google.com:19302',
  'stun:stun1.l.google.com:19302',
  'stun:stun2.l.google.com:19302',
  'stun:stun3.l.google.com:19302',
  'stun:stun4.l.google.com:19302',
  'stun:global.stun.twilio.com:3478',
];

export default async function handler(req, res) {
  if (req.method !== 'GET') {
    return res.status(405).json({ success: false, error: 'METHOD_NOT_ALLOWED' });
  }

  let iceServers = null;

  const cloudflareKeyId = process.env.CLOUDFLARE_TURN_KEY_ID;
  const cloudflareToken = process.env.CLOUDFLARE_TURN_API_TOKEN;
  if (cloudflareKeyId && cloudflareToken) {
    try {
      const cfRes = await fetch(`https://rtc.live.cloudflare.com/v1/turn/keys/${cloudflareKeyId}/credentials/generate`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${cloudflareToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ ttl: 86400 }),
      });
      if (cfRes.ok) {
        const data = await cfRes.json();
        if (Array.isArray(data.iceServers) && data.iceServers.length > 0) {
          iceServers = data.iceServers;
        }
      }
    } catch {
      /* fallback abaixo */
    }
  }

  if (!iceServers) {
    const turnUrl = process.env.TURN_URL;
    const turnUsername = process.env.TURN_USERNAME;
    const turnCredential = process.env.TURN_CREDENTIAL;

    iceServers = FALLBACK_STUN.map((url) => ({ urls: url }));
    if (turnUrl && turnUsername && turnCredential) {
      iceServers.push({ urls: turnUrl, username: turnUsername, credential: turnCredential });
    }
  }

  res.setHeader('Cache-Control', 'private, max-age=300');
  res.status(200).json({ success: true, iceServers, ttlSeconds: 86400 });
}