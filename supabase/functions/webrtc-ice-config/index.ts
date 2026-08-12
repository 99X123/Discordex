import { serve } from "https://deno.land/std@0.224.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "GET, OPTIONS",
};

serve((req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  if (req.method !== "GET") {
    return Response.json(
      { success: false, error: "METHOD_NOT_ALLOWED", message: "Metodo nao permitido." },
      { status: 405, headers: corsHeaders },
    );
  }

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
