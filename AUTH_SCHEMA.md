# Schema de Autenticação — Discordex (Supabase)

Diagrama do fluxo de autenticação do app com o Supabase Auth.

## Visão geral

```
              FRONTEND (React)                    SUPABASE
   ┌──────────────────────────────┐        ┌───────────────────────────────────┐
   │  AuthPage (login/cadastro)   │        │                                   │
   │                              │        │        ┌─────────────────┐        │
   │  supabase.auth.signUp() ─────┼───POST─┼───────►│ /auth/v1/signup │        │
   │  supabase.auth.signInWith    │        │        └────────┬────────┘        │
   │    Password() ───────────────┼───POST─┼───────►│ /auth/v1/token │        │
   │  supabase.auth.resetPassword ┼───POST─┼───────►│/auth/v1/recover │        │
   │  supabase.auth.getSession()  │        │        └────────┬────────┘        │
   │  supabase.auth.onAuthState-  │        │                 ▼                 │
   │    Change (ouve sessão)      │        │        ┌─────────────────┐        │
   │                              │        │        │   auth.users    │        │
   │   JWT (access token)         │        │        │  id (PK)        │        │
   │   ┌──────────────┐           │        │        │  email (unique) │        │
   │   │ header.      │ ◄─────────┼────────┼────────┤  encrypted_pass │        │
   │   │ payload.     │           │        │        │  raw_user_meta_ │        │
   │   │ signature    │           │        │        │   data          │        │
   │   └──────────────┘           │        │        │  (confirmado?)   │        │
   └──────────────────────────────┘        └───────────┬──────┬─────────┘
                                                       │      │
   A cada request REST/Realtime, o JWT vai no header    │      │
   "Authorization: Bearer <token>"                      │      │
                                                        ▼      ▼
                                        ┌───────────────────────────────┐
                                        │   RLS (Row Level Security)    │
                                        │   policies usam:              │
                                        │   auth.uid() = id do JWT      │
                                        │   (quem pode ler/gravar cada  │
                                        │    linha)                     │
                                        └───────────────┬───────────────┘
                                                        ▼
                                          ┌──────────────────────────┐
                                          │  public.profiles         │
                                          │  id = auth.users.id (PK) │
                                          │  username, display_name  │
                                          │  status, avatar_url...   │
                                          └──────────────────────────┘
```

## Fluxo do cadastro com confirmação de email

```
1. signUp() → cria registro em auth.users
        │
        ▼
2. TRIGGER "on_auth_user_created"
   (AFTER INSERT em auth.users)
        │  roda handle_new_user()
        ▼
3. Insere em public.profiles (id = user.id,
   username gerado do email, display_name do metadata)
        │
        ▼
4. Supabase envia o email de confirmação
   com link apontando para o "Site URL"
   (produção → https://discordex-smoky.vercel.app)
        │
        ▼
5. Usuário clica no link → volta pro app
   com os tokens na URL → detectSessionInUrl: true
   captura a sessão → entra
```

## Configs (dashboard → Authentication)

| Config | Onde | Importância |
|--------|------|-------------|
| **Site URL** | URL Configuration | base do link de confirmação/reset |
| **Redirect URLs** | URL Configuration | URLs permitidas pós-confirmação |
| **Confirm email** | Providers → Email | liga/desliga confirmação por email |
| **ANON KEY** | Project Settings → API | chave pública do client (`VITE_SUPABASE_ANON_KEY`) |
| **JWT expiry** | Project Settings → API | validade do access token (padrão 1h) |

## Onde cada peça fica no código

- `src/lib/supabase.ts` — cria o client (URL + anon key + `detectSessionInUrl: true`)
- `src/services/auth.ts` — signUp/login/reset/`emailRedirectTo: window.location.origin`
- `src/App.tsx` — `getSession()` + `onAuthStateChange` decide Login ou Dashboard
- `migrations/006_rls_policies.sql` — policies usam `auth.uid()`
- `migrations/001_profiles.sql` — trigger `handle_new_user` (cria profile no cadastro)
