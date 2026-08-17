import { serve } from "https://deno.land/std@0.224.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "GET, OPTIONS",
};

const CLOUDFLARE_TURN_API = "https://rtc.live.cloudflare.com/v1/turn/keys";

interface CloudflareTurnResponse {
  iceServers: RTCIceServer[];
}

async function fetchCloudflareTurn(): Promise<RTCIceServer[] | null> {
  const keyId = Deno.env.get("CLOUDFLARE_TURN_KEY_ID");
  const apiToken = Deno.env.get("CLOUDFLARE_TURN_API_TOKEN");
  if (!keyId || !apiToken) return null;

  try {
    const res = await fetch(`${CLOUDFLARE_TURN_API}/${keyId}/credentials/generate`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ ttl: 86400 }),
    });

    if (!res.ok) {
      console.error("Cloudflare TURN error", res.status, await res.text());
      return null;
    }

    const data = (await res.json()) as CloudflareTurnResponse;
    if (!Array.isArray(data.iceServers) || data.iceServers.length === 0) return null;
    return data.iceServers;
  } catch (error) {
    console.error("Cloudflare TURN fetch failed", error);
    return null;
  }
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  if (req.method !== "GET") {
    return Response.json(
      { success: false, error: "METHOD_NOT_ALLOWED", message: "Metodo nao permitido." },
      { status: 405, headers: corsHeaders },
    );
  }

  // TURN efemero e gratuito da Cloudflare (1TB/mes na Free tier).
  const cloudflareTurn = await fetchCloudflareTurn();

  if (cloudflareTurn) {
    return Response.json(
      { success: true, iceServers: cloudflareTurn, ttlSeconds: 86400 },
      { headers: { ...corsHeaders, "Cache-Control": "private, max-age=300" } },
    );
  }

  // Fallback: STUN publico + TURN configurado por env (opcional).
  const stunUrls = (Deno.env.get("STUN_URLS") ?? "stun:stun.l.google.com:19302")
    .split(",")
    .map((url) => url.trim())
    .filter(Boolean);

  const turnUrl = Deno.env.get("TURN_URL");
  const turnUsername = Deno.env.get("TURN_USERNAME");
  const turnCredential = Deno.env.get("TURN_CREDENTIAL");

  const iceServers: RTCIceServer[] = [{ urls: stunUrls }];

  if (turnUrl && turnUsername && turnCredential) {
    iceServers.push({
      urls: turnUrl.split(",").map((url) => url.trim()).filter(Boolean),
      username: turnUsername,
      credential: turnCredential,
    });
  }

  return Response.json(
    { success: true, iceServers, ttlSeconds: 300 },
    { headers: { ...corsHeaders, "Cache-Control": "private, max-age=300" } },
  );
});