# webrtc-ice-config

Edge Function que entrega a configuracao ICE (STUN + TURN) ao frontend sem codificar credenciais no app.

## TURN gratuito da Cloudflare (recomendado)

O TURN da Cloudflare Calls e gratuito (1 TB de trafego por mes na Free tier) e usa credenciais
efemeras geradas por API — bem mais confiavel que os TURN publicos compartilhados (ex: openrelayproject).

1. Crie uma conta gratuita em https://dash.cloudflare.com
2. Acesse **Workers & Pages** → **Cloudflare Calls** (ou `https://dash.cloudflare.com/?to=/:account/workers/calls`)
3. Em **TURN Server**, crie uma **TURN Key** (deixe as STUN Keys desmarcadas, o servico adiciona STUN junto)
4. Copie o **Key ID** e gere/pegue o **API Token**
5. Configure os secrets e faça o deploy:

```bash
supabase secrets set CLOUDFLARE_TURN_KEY_ID="sua_key_id" CLOUDFLARE_TURN_API_TOKEN="seu_token"
supabase functions deploy webrtc-ice-config
```

Sem Cloudflare, a funcao cai para STUN publico + TURN configurado por env (opcional):

## Variaveis de ambiente (fallback)

- `STUN_URLS`: lista separada por virgula. Padrao: `stun:stun.l.google.com:19302`
- `TURN_URL`: lista separada por virgula, opcional.
- `TURN_USERNAME`: usuario TURN, opcional.
- `TURN_CREDENTIAL`: senha/credential TURN, opcional.

## Deploy

```bash
supabase functions deploy webrtc-ice-config
```

O frontend chama esta funcao automaticamente (`src/lib/iceConfig.ts`). Se ela nao estiver
publicada, o app usa STUN publico + as vars `VITE_TURN_*` como fallback.