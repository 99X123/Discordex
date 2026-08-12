// Edge Function: webrtc-ice-config
// Retorna a lista de ICE servers (STUN + TURN opcional) para as chamadas WebRTC.
//
// Para implantar no seu projeto Supabase:
//   supabase functions deploy webrtc-ice-config --no-verify-jwt
//
// Opcional (para TURN com servidores externos como Twilio / Metered / Coturn),
// defina os secrets no projeto:
//   supabase secrets set TURN_URL=... TURN_USERNAME=... TURN_CREDENTIAL=...

import { corsHeaders } from '../_shared/cors.ts';

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  const iceServers: RTCIceServer[] = [
    { urls: 'stun:stun.l.google.com:19302' },
    { urls: 'stun:stun1.l.google.com:19302' },
    { urls: 'stun:stun2.l.google.com:19302' },
    { urls: 'stun:stun3.l.google.com:19302' },
    { urls: 'stun:stun4.l.google.com:19302' },
    { urls: 'stun:global.stun.twilio.com:3478' },
  ];

  const turnUrl = Deno.env.get('TURN_URL');
  const turnUsername = Deno.env.get('TURN_USERNAME');
  const turnCredential = Deno.env.get('TURN_CREDENTIAL');
  if (turnUrl && turnUsername && turnCredential) {
    iceServers.push({ urls: [turnUrl], username: turnUsername, credential: turnCredential });
  }

  return new Response(JSON.stringify({ iceServers }), {
    headers: { 'Content-Type': 'application/json', ...corsHeaders },
  });
});