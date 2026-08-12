# Discordex Backend

Backend real baseado em Supabase: PostgreSQL, Auth, RLS, Realtime, RPCs protegidas e Edge Function para configuracao ICE de WebRTC.

## Como aplicar

1. Crie um projeto Supabase.
2. Aplique as migrations em ordem:

```bash
supabase db push
```

3. Ative Realtime para as tabelas publicadas em `migrations/007_indexes_realtime.sql` (e as novas `dm_call_signals`/`dm_call_rings` das migrations 014/015).
4. Publique a Edge Function de ICE:

```bash
supabase functions deploy webrtc-ice-config
supabase secrets set STUN_URLS="stun:stun.l.google.com:19302"
```

> **404 no console?** O erro `functions/v1/webrtc-ice-config: 404` significa que a Edge Function
> ainda nao foi publicada neste projeto. Rode o comando acima. Enquanto isso o app continua
> funcionando usando servidores STUN publicos (fallback embutido), fica sem TURN apenas.

Para producao, configure TURN:

```bash
supabase secrets set TURN_URL="turn:turn.example.com:3478" TURN_USERNAME="usuario" TURN_CREDENTIAL="senha"
```

## Superficie principal

- Auth: Supabase Auth com perfis em `profiles`.
- Servidores: `create_server_with_defaults` cria servidor, owner, cargos e canais padrao.
- Convites: `join_server_with_invite` valida expiracao, limite de uso e banimentos.
- Mensagens: texto apenas, com guards de canal, timeout, permissao e rate limit.
- Reacoes: unicidade por mensagem, usuario e emoji.
- DMs: `get_or_create_dm_channel` cria conversa sem permitir self-DM ou bloqueios.
- Moderacao: `kick_member`, `ban_member`, `timeout_member` usam `auth.uid()` no banco.
- Voz/WebRTC: `voice_states` e `webrtc_signals` com RLS para participantes.
- Notificacoes: triggers para mencoes `@username` e DMs.
- Rate limiting: tabela interna `rate_limits`, inacessivel diretamente ao cliente.
- Admin global: tabela `app_admins` e RPC `list_registered_accounts`.
- Avatars: bucket publico `avatars`, com upload restrito a pasta do proprio usuario.

## Tornar uma conta admin

Depois que a conta existir em `profiles`, execute no SQL Editor do Supabase:

```sql
insert into public.app_admins (user_id)
values ('USER_ID_DA_CONTA');
```

Somente contas presentes em `app_admins` veem o painel Admin no app.

## Seguranca

As RPCs sensiveis nao aceitam `executor_id` nem `owner_id` vindos do frontend. O banco deriva a identidade com `auth.uid()`.

Nunca exponha `service_role` no frontend. Use apenas `VITE_SUPABASE_URL` e `VITE_SUPABASE_ANON_KEY`.
