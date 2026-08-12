# webrtc-ice-config

Edge Function para entregar configuracao ICE ao frontend sem codificar credenciais no app.

Variaveis de ambiente:

- `STUN_URLS`: lista separada por virgula. Padrao: `stun:stun.l.google.com:19302`
- `TURN_URL`: lista separada por virgula, opcional.
- `TURN_USERNAME`: usuario TURN, opcional.
- `TURN_CREDENTIAL`: senha/credential TURN, opcional.

Deploy:

```bash
supabase functions deploy webrtc-ice-config
supabase secrets set STUN_URLS="stun:stun.l.google.com:19302" TURN_URL="turn:turn.example.com:3478" TURN_USERNAME="..." TURN_CREDENTIAL="..."
```
