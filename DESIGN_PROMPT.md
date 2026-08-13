# PROMPT COMPLETO DE DESIGN & FRONTEND - DISCORDEX

## 1. VISÃO GERAL DO PROJETO

**Nome:** Discordex  
**Objetivo:** Clone completo do Discord com servidores, canais de texto/voz, DMs, chamadas de vídeo/voz WebRTC, sistema de roles/permissões, amigos e notificações.  
**Stack:** React 19 + TypeScript + Vite + Tailwind CSS 3 + Supabase + WebRTC + Lucide Icons + Fontes (Plus Jakarta Sans / Inter)  

**Arquitetura de Pastas:**
- `src/components/` - Componentes reutilizáveis
- `src/context/AppContext.tsx` - Estado global da aplicação
- `src/lib/` - Utilitários, types, integrações
- `src/services/` - Camada de serviços (auth, servers, channels, etc)
- `src/assets/` - Imagens e recursos estáticos
- `public/` - Arquivos públicos
- `migrations/` - Migrations SQL do Supabase

---

## 2. IDENTIDADE VISUAL

### 2.1 Paleta de Cores (Oficial - do tailwind.config.js)

```
TONS ESCUROS (Background & Superfícies):
  discordex.bg         = #070B14   (Fundo mais escuro, quase preto-azulado)
  discordex.secondary  = #0F1626   (Painel secundário, sidebar)
  discordex.surface    = #1A233A   (Cards, inputs, botões secundários)
  discordex.hover      = #232D47   (Hover em superfícies)
  discordex.border     = rgba(255, 255, 255, 0.08)  (Bordas transparentes)

AZUL PRIMÁRIO (CTA, Links, Acentos):
  primary.DEFAULT      = #3B82F6   (Azul padrão)
  primary.hover        = #60A5FA   (Hover mais claro)
  primary.dark         = #2563EB   (Azul mais escuro)
  primary.glow         = rgba(59, 130, 246, 0.39)  (Glow/Shadow azul)

CORES DE STATUS / SEMÂNTICAS:
  discordex.success    = #34D399   (Verde - Online, Sucesso)
  discordex.warning    = #FBBF24   (Âmbar - Conectando, Aviso)
  discordex.danger     = #F87171   (Vermelho - Offline, Erro, Perigo)

TEXTO:
  discordex.text.primary   = #F1F5F9  (Texto principal - branco frio)
  discordex.text.secondary = #94A3B8  (Texto secundário - cinza claro)
```

**Regra de Uso de Cores:**
- Fundo app inteiro: `bg-discordex-bg`
- Sidebar Servidores: `bg-discordex-bg`
- Sidebar Canais/DMs: `bg-discordex-secondary`
- Painéis/Modais/Cards: `bg-discordex-surface`
- Inputs: `bg-discordex-bg` ou `bg-discordex-secondary`
- Hover botões secundários: `hover:bg-discordex-hover`
- Todos os textos: `text-discordex-text-primary` ou `text-discordex-text-secondary`
- Destaques/CTAs: `bg-primary hover:bg-primary-hover text-white`
- Bordas: SEMPRE usar `border-discordex-border` (nunca cinzas sólidos!)

### 2.2 Tipografia

```
Famílias:
  font-sans: Plus Jakarta Sans, Inter, system-ui  (Padrão global)
  font-inter: Inter, system-ui                    (Alternativa)

Tamanhos (Mobile-First, usar text-):
  - text-[10px] = Badges, labels minúsculas (ex: NOME DE CANAL uppercase)
  - text-xs     = 12px - Mensagens chat, labels, descrições
  - text-sm     = 14px - Botões, campos de formulário
  - text-[14px] = Nome do chat no header
  - text-lg     = Títulos de cards/páginas
  - text-2xl    = Títulos grandes (ex: Login "Discordex")
  - text-3xl+   = Hero sections (quando existir)

Pesos:
  - font-normal (400) = Descrições, conteúdo mensagem
  - font-medium (500) = Raramente usado
  - font-semibold (600) = Subtítulos
  - font-bold (700)   = Nomes usuário, títulos de canal, botões
  - font-black (800+) = Logo Discordex, títulos grandes

**REGRAS:**
- Nomes de usuário SEMPRE font-bold
- Canais/nome do chat no header SEMPRE font-bold
- Botões SEMPRE font-bold ou font-semibold
- Labels minúsculas (ex: "EMAIL", "SENHA"): text-[10px] + font-bold + uppercase + tracking-wider
- Texto de mensagem no chat: text-xs + leading-relaxed (para legibilidade)
```

### 2.3 Ícones (Lucide React)

Biblioteca: `lucide-react` (versão ^1.31.0)  
Tamanhos padrão:
- `w-3 h-3`   = Dentro de badges, ícones minúsculos
- `w-3.5 h-3.5` = Search input
- `w-4 h-4`   = Botões header, ícones chat (padrão)
- `w-4.5 h-4.5` = Icones na sidebar de servidores / settings
- `w-5 h-5`   = Botão "Adicionar servidor", ícones de ação
- `w-6 h-6`   = Ícones de destaque
- `w-7+ h-7+` = Hero, ícones grandes

Cores padrão para ícones:
- Ícones padrão (ativos): `text-discordex-text-secondary`
- Hover: `hover:text-discordex-text-primary`
- Destaque: `text-primary` ou `text-white`

### 2.4 Sombras e Efeitos

```js
// tailwind.config.js shadows
shadow-glow-blue    = 0 4px 14px 0 rgba(59,130,246,0.39)   // Botão primary em destaque
shadow-glow-blue-lg = 0 8px 32px 0 rgba(59,130,246,0.45)   // Modais grandes, CTAs
shadow-float        = 0 8px 24px -6px rgba(2,6,16,0.6)     // Cards suspensos
shadow-float-lg     = 0 16px 40px -8px rgba(2,6,16,0.7)    // Overlays, chamadas
shadow-2xl          = Modais, Context Menus, Toasts

// Efeitos CSS custom (index.css):
.speaking-ring     = box-shadow: 0 0 0 2px #3B82F6, 0 0 12px rgba(59,130,246,0.6)
.glass-panel       = bg: rgba(26,35,58,0.6) + backdrop-blur 12px + border 1px
.input-pill        = border-radius 9999px (pill shape)
```

---

## 3. LAYOUT PRINCIPAL (DASHBOARD)

O layout é de 4 colunas no desktop, com responsividade adaptativa:

```
┌───────────┬───────────────────┬───────────────────────────────────┬──────────────┐
│  Col 1    │     Col 2         │           Col 3 (Chat)            │   Col 4      │
│  72px     │    240px~         │         FLEX: 1 (resto)           │   240px~     │
│ Sidebar   │ Sidebar Canais   │  - Header Chat (52px)             │ Sidebar      │
│ Servidores│ ou Sidebar DMs   │  - Messages (flex-1)              │ Membros      │
│ Fixo      │ Fixo             │  - Input Composer (84px)          │ hidden<lg    │
│           │                  │                                   │              │
│           │                  │                                   │              │
└───────────┴───────────────────┴───────────────────────────────────┴──────────────┘
```

**Responsividade:**
- `lg` (1024px+): 4 colunas completas visíveis
- `md - lg` (768px-1024px): Oculta Col4 (Membros). Chat ocupa + espaço
- `< md` (<768px mobile/tablet): 
  - Col1 + Col2 ficam em drawer off-canvas com overlay
  - Botão hamburger (Menu) no top-left do chat
  - Apenas chat ocupa tela toda
  - Col4 fica oculta totalmente

---

## 4. DETALHAMENTO DE TODOS OS COMPONENTES & TELAS

### 4.1 Tela de Autenticação (AuthPage.tsx)

**Container:**
- Fundo: `min-h-screen bg-discordex-bg`
- Card: `max-w-sm mx-auto w-full bg-discordex-secondary border border-discordex-border rounded-2xl shadow-2xl overflow-hidden`
- Padding: `p-6`

**Header do Card:**
```
- Logo square: w-12 h-12 rounded-2xl bg-primary text-white font-black tracking-wider text "DX"
- Título: text-2xl font-black "Discordex"
- Subtítulo: text-xs text-discordex-text-secondary mt-1
- Divisor: border-b border-discordex-border
```

**Toggle Login/Cadastro:**
- Container: `grid grid-cols-2 gap-2 bg-discordex-bg border border-discordex-border rounded-xl p-1`
- Botão ativo: `bg-primary text-white rounded-lg py-2 text-xs font-bold`
- Botão inativo: `text-discordex-text-secondary hover:text-discordex-text-primary py-2 rounded-lg text-xs font-bold`
- Transição: `transition-colors`

**Campos de Formulário:**
```
<label> com espaço interno space-y-2
  <span>: text-[10px] font-bold uppercase tracking-wider text-discordex-text-secondary
  <input>: 
    w-full px-4 py-3 bg-discordex-bg border border-discordex-border rounded-xl
    text-sm outline-none focus:border-primary
    placeholder cor: placeholder:text-discordex-text-secondary/40
```

**Botão Principal (Submit):**
```
w-full px-4 py-3 rounded-xl bg-primary hover:bg-primary-hover
text-white text-sm font-bold flex items-center justify-center gap-2
disabled:opacity-60 transition-colors
Ícone à esquerda do texto (LogIn ou UserPlus)
```

**Links secundários:**
- Esqueci senha: `w-full text-xs text-discordex-text-secondary hover:text-discordex-text-primary transition-colors`
- Voltar (verify email): `inline-flex items-center justify-center gap-1.5`

**Mensagens de feedback:**
```
text-xs rounded-xl border px-3 py-2
  Erro:    border-discordex-danger/30 bg-discordex-danger/10 text-discordex-danger
  Sucesso: border-discordex-success/30 bg-discordex-success/10 text-discordex-success
```

**Estado de Verificação de Email:**
- Ícone: w-12 h-12 rounded-2xl bg-primary/15 text-primary flex items-center justify-center
- Título: text-lg font-black
- Texto: text-xs text-discordex-text-secondary leading-relaxed
- Email em destaque: `font-semibold text-discordex-text-primary`

---

### 4.2 Sidebar de Servidores (SidebarServers.tsx) - 72px FIXA

**Container:** `w-[72px] bg-discordex-bg flex flex-col items-center py-3 border-r border-discordex-border/40 shrink-0 h-full justify-between`

**Ícone Home (DX):**
- Tooltip com content="Discordex Home" position="right"
- Tamanho: `w-12 h-12`
- Forma: `rounded-2xl` → ativo vira `rounded-[14px]` (transição shape)
- Cores: 
  - Inativo: `bg-discordex-surface text-primary hover:bg-primary hover:text-white hover:rounded-[14px]`
  - Ativo: `bg-primary text-white rounded-[14px]`
- Indicador esquerdo ativo: `absolute left-0 w-1 h-5 bg-white rounded-r-full`
- Texto logo: `font-black tracking-wider text-[11px]` "DX"
- Transição: `transition-all duration-200`

**Divisor:** `w-8 h-[2px] bg-discordex-border rounded-full my-1`

**Itens de Servidor:**
```
w-12 h-12, mesmas regras do Home mas com:
  - Inicial ou letra como ícone fallback (font-bold text-sm)
  - Se tiver iconUrl: <img> w-full h-full object-cover rounded-[14px]
  - Notification pill: 
      Se tem contador > 0: absolute bottom-1 right-1 bg-primary text-white text-[9px] font-black w-4.5 h-4.5 rounded-full flex items-center justify-center border-2 border-discordex-bg
      Se tem notificação simples: absolute bottom-1.5 right-1.5 bg-primary w-2.5 h-2.5 rounded-full border-2 border-discordex-bg
  - Indicador esquerdo hover (não ativo):
      absolute left-0 w-1 bg-white rounded-r-full transition-all duration-200
      h-2 scale-0 group-hover:scale-100 group-hover:h-5
```

**Botões de Ação:**
- "Adicionar Servidor": 
  - w-12 h-12 rounded-2xl bg-discordex-surface text-discordex-text-secondary 
  - **hover:bg-discordex-success hover:text-white hover:rounded-[14px]** (VERDE, diferente dos outros)
  - Ícone Plus w-5 h-5
- "Entrar via Convite":
  - Mesmo tamanho
  - hover:bg-primary hover:text-white (AZUL)
  - Ícone Compass w-5 h-5

**Seção Inferior (Fixo):**
- Status Conexão: 
  - w-8 h-8 rounded-full bg-discordex-surface border border-discordex-border hover:border-primary transition-colors
  - Dentro: w-3.5 h-3.5 rounded-full com cor:
    - online: bg-discordex-success
    - connecting/reconnecting: bg-discordex-warning + animate-pulse ou animate-spin border-dashed
    - offline: bg-discordex-danger
- Configurações:
  - w-10 h-10 rounded-xl bg-discordex-surface text-discordex-text-secondary hover:text-discordex-text-primary
  - border border-discordex-border
  - Ícone Settings w-4.5 h-4.5

---

### 4.3 Sidebar Canais (SidebarChannels.tsx) & DMs (SidebarDMs.tsx)

**Container:** `w-64 bg-discordex-secondary border-r border-discordex-border flex flex-col h-full shrink-0`

**Header do Servidor (Topo):**
- Altura: `h-12 px-4`
- Border: `border-b border-discordex-border`
- Nome do servidor: `font-bold text-[14px] text-discordex-text-primary truncate`
- Background: bg-discordex-secondary
- Dropdown menu ao clicar

**Seções de Canais (ex: TEXTO / VOZ):**
```
Wrapper com px-2 pt-4
  Header da seção (clicável para expandir):
    flex items-center justify-between
    text-[10px] font-bold uppercase tracking-wider text-discordex-text-secondary/80
    hover:text-discordex-text-primary
    setinha ▼ ou ►
  Botão "+" add canal no canto direito do header:
    hover:text-primary transition-colors
```

**Item Canal de Texto:**
```
Container flex items-center gap-2 px-2 py-1.5 rounded-lg cursor-pointer
  Ícone Hash (w-4 h-4 text-discordex-text-secondary)
  Nome canal: text-[13px] font-semibold truncate
  Estado Inativo: text-discordex-text-secondary hover:bg-discordex-hover hover:text-discordex-text-primary
  Estado Ativo: bg-discordex-hover text-discordex-text-primary
  Unread indicator (novo): Bolinha branca w-1.5 h-1.5 rounded-full ou NOME em negrito
  Badge @mentions: bg-discordex-danger text-white text-[9px] font-black px-1.5 rounded-full
  Opções (icons): só aparecem no hover do item
    - User Plus (invite)
    - Settings
```

**Item Canal de Voz:**
- Mesmo container mas com ícone Volume2 (w-4 h-4)
- Abaixo do nome do canal, pode mostrar avatares miniaturas (w-5 h-5 -2) dos usuários conectados

**Painel de Usuário (Rodapé - Fixo):**
```
Altura: ~56px
Background: bg-discordex-bg/60 (mais escuro que sidebar)
Border: border-t border-discordex-border
Padding: px-2 py-1.5
Layout: flex items-center gap-2

Esquerda (Info do usuário):
  Avatar: w-8 h-8 rounded-full relative
    Status indicator: absolute bottom-0 right-0 w-2.5 h-2.5 rounded-full border-2 border-discordex-bg
      Online: bg-discordex-success, Ausente: bg-discordex-warning, Offline: bg-discordex-danger
  Nome display: truncate text-[13px] font-bold text-discordex-text-primary
  @username: truncate text-[10px] text-discordex-text-secondary

Direita (Ícones rápidos):
  Micrófone: Headphones ou Mic w-4 h-4
  Fone: Volume2 w-4 h-4
  Settings: Settings w-4 h-4
  Container dos ícones: flex items-center gap-0.5
  Cada botão: p-1.5 rounded-md text-discordex-text-secondary hover:bg-discordex-hover hover:text-discordex-text-primary transition-colors
```

**DMs (SidebarDMs.tsx):**
- Header grande igual ("Direto" / "Amigos")
- Campo de busca de usuários
- Seção "Direto": Lista de DMs recentes
  - Avatar w-8 h-8 + status indicator
  - Nome do amigo + preview última msg (truncate text-[11px] text-discordex-text-secondary)
  - Badge contador msgs não lidas
- Cada DM clickável, estados ativo/inativo iguais canais

---

### 4.4 Área de Chat (ChatArea.tsx)

**Container:** `flex-1 bg-discordex-bg flex flex-col min-w-0 h-full relative`

**Header do Chat (topo - FIXO):**
```
Altura: h-12 px-4
Border: border-b border-discordex-border
Shadow: shadow-sm
Layout: flex items-center justify-between gap-4 shrink-0

Lado ESQUERDO (Info):
  - Botão hamburger mobile (Menu icon): md:hidden p-1.5 rounded-lg text-discordex-text-secondary hover:text-discordex-text-primary hover:bg-discordex-surface
  - Ícone: Se servidor → Hash (#) w-5 h-5 text-discordex-text-secondary / Se voz → Volume2 / Se DM → Bolinha verde status (w-2.5 h-2.5 rounded-full bg-discordex-success)
  - Título: font-bold text-[14px] text-discordex-text-primary truncate
  - Divisor (se tem descrição): w-[1px] h-4 bg-discordex-border mx-1
  - Descrição: text-xs text-discordex-text-secondary truncate font-normal

Lado DIREITO (Controles):
  - Container Chamada (voz ou DM): flex items-center gap-1 bg-discordex-surface border border-discordex-border p-0.5 rounded-xl
    Botão Voz: p-1.5 rounded-lg text-discordex-text-secondary hover:text-discordex-text-primary hover:bg-discordex-hover (Phone icon w-4 h-4)
    Botão Vídeo: (Video icon w-4 h-4) mesma estilização
  - Campo de Busca: hidden sm:block relative
    Input: w-40 focus:w-56 px-3 py-1.5 pr-8 bg-discordex-secondary border border-discordex-border rounded-xl text-xs text-discordex-text-primary placeholder:text-discordex-text-secondary/40 focus:outline-none focus:border-primary transition-all duration-200
    Search icon: absolute right-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-discordex-text-secondary/50
```

**Feed de Mensagens (scroll):**
```
flex-1 overflow-y-auto px-4 py-4 space-y-4

Empty state (nenhuma msg):
  h-full flex flex-col items-center justify-center text-center p-6 space-y-2 opacity-60
  emoji 3xl + p text-sm font-bold "Nenhuma mensagem por aqui" + subtítulo text-xs

Canal de Voz (se não está em call):
  max-w-md mx-auto my-12 bg-discordex-surface border border-discordex-border rounded-2xl p-6 text-center space-y-4 shadow-xl
  Ícone w-14 h-14 bg-primary/10 rounded-full (Volume2 w-7 h-7 text-primary)
  Titulo text-lg font-bold + paragrafo text-xs max-w-sm mx-auto leading-relaxed
  Botão CTA: px-6 py-3 bg-primary hover:bg-primary-hover text-white rounded-xl text-sm font-semibold transition-colors

Mensagem individual:
  Container: group relative flex flex-col gap-1 hover:bg-discordex-surface/20 -mx-4 px-4 py-2 rounded-xl transition-colors

  Reply header (se tem resposta):
    flex items-center gap-1.5 text-xs text-discordex-text-secondary/70 pl-9 mb-1
    CornerDownLeft icon w-3.5 h-3.5 text-discordex-text-secondary/40
    @username + truncate max-w-xs do conteúdo reply

  Body (flex gap-3):
    Avatar:
      w-9 h-9 rounded-full object-cover border border-discordex-border/40
      clickável para abrir perfil
    Coluna conteúdo (flex-1 min-w-0):
      Header info:
        flex items-center gap-2 mb-1
        Nome usuário: font-bold text-xs text-discordex-text-primary hover:underline hover:text-primary transition-colors (clickável)
        Role badge (se tem): px-1.5 py-0.5 rounded text-[9px] font-bold com COR DINAMICA do cargo (style: color, bg 10%)
        Timestamp: text-[10px] text-discordex-text-secondary/60
      Conteúdo msg:
        text-xs text-discordex-text-secondary leading-relaxed whitespace-pre-wrap
        Imagens inline: max-w-sm max-h-96 rounded-xl border border-discordex-border my-1 object-contain
      Reactions:
        flex flex-wrap gap-1.5 mt-2
        Cada reaction: px-2 py-0.5 rounded-lg border text-xs font-semibold flex items-center gap-1 transition-all
          Se user reagiu: bg-primary/10 border-primary text-primary
          Se não: bg-discordex-surface border-discordex-border text-discordex-text-secondary hover:border-discordex-text-primary
          emoji + contador (text-[10px])

  Toolbar overlay (só aparece no group-hover):
    absolute right-4 -top-3.5 opacity-0 group-hover:opacity-100 transition-opacity
    Container: bg-discordex-surface border border-discordex-border rounded-xl flex items-center p-0.5 shadow-xl z-20
    Quick reactions: 5 emojis (👍❤️😂🔥🚀) cada p-1.5 hover:bg-discordex-hover rounded-lg text-xs transition-colors
    Divisor: w-[1px] h-4 bg-discordex-border mx-1
    Botão Responder: px-2 py-1.5 text-[10px] font-bold text-discordex-text-secondary hover:text-discordex-text-primary rounded-lg hover:bg-discordex-hover
```

**Composer de Mensagem (Inferior - FIXO):**
```
Container: p-4 border-t border-discordex-border bg-discordex-bg shrink-0

Reply Banner (se reply ativo):
  flex items-center justify-between bg-discordex-surface border border-discordex-border px-4 py-2 rounded-t-xl text-xs -mb-1 animate-fade-in border-b-0
  "Respondendo a @username" | X Cancelar

Form do input (relative):
  Input principal:
    w-full px-4 pl-10 py-3 bg-discordex-secondary border border-discordex-border
    text-xs text-discordex-text-primary placeholder:text-discordex-text-secondary/40
    focus:outline-none focus:border-primary transition-all pr-24
    Radius: se tem reply → rounded-b-2xl, senão → rounded-2xl
    Placeholder: "Escreva uma mensagem em #canal..."

  Botão Imagem (esquerda):
    absolute left-3 top-1/2 -translate-y-1/2 p-1.5 text-discordex-text-secondary hover:text-discordex-text-primary rounded-lg transition-colors
    Ícone: ImagePlus w-5 h-5, quando fazendo upload → Loader2 w-5 h-5 animate-spin

  Container direito (absolute right-3):
    Emoji picker trigger:
      relative + p-1.5 text-discordex-text-secondary hover:text-discordex-text-primary rounded-lg
      Smile w-5 h-5
      Picker dropdown (se aberto):
        absolute bottom-full right-0 mb-3 bg-discordex-surface border border-discordex-border p-2 rounded-2xl shadow-2xl flex gap-1 z-30 animate-slide-up
        8 emojis principais em w-8 h-8 hover:bg-discordex-hover rounded-xl text-lg transition-colors
    Botão Enviar:
      p-1.5 bg-primary disabled:bg-primary/20 text-white rounded-lg transition-colors
      Send w-4 h-4
```

---

### 4.5 Sidebar Membros (SidebarMembers.tsx) - Oculta < lg

**Container:** `w-60 bg-discordex-secondary border-l border-discordex-border overflow-y-auto h-full shrink-0`

**Seções por Role:**
```
Header role:
  px-4 pt-4 pb-1
  text-[10px] font-bold uppercase tracking-wider text-discordex-text-secondary
  + " - 5" (contador online)

Lista de Membros do cargo:
  flex flex-col gap-0.5 py-1

Item de Membro:
  group flex items-center gap-2 px-2 py-1.5 rounded-lg cursor-pointer mx-2
  hover:bg-discordex-hover
  Avatar:
    w-8 h-8 rounded-full object-cover border border-discordex-border/40 relative
    Status: absolute bottom-0 right-0 w-2.5 h-2.5 rounded-full border-2 border-discordex-secondary (bg: online=verde, ausente=âmbar, offline=vermelho/off)
  Nome:
    truncate text-[13px] font-semibold
    COR: usar role.color se existir, senão text-discordex-text-primary
  Owner: ícone Crown w-3.5 h-3.5 text-discordex-warning
  Speaking indicator: .speaking-ring no avatar
```

---

### 4.6 Tela de Amigos (FriendsView.tsx) - Sem servidor/DM ativos

**Container:** `flex-1 bg-discordex-bg flex flex-col h-full min-w-0`

**Header:**
```
h-12 px-4 border-b border-discordex-border flex items-center justify-between
Lado esquerdo:
  Users2 ícone w-5 h-5 text-discordex-text-secondary
  Título "Amigos" font-bold text-[14px]
Lado direito:
  Tabs: "Todos | Pendentes | Adicionar" (estilo toggle igual login/cadastro)
  Botão "Adicionar Amigo": bg-primary text-white px-3 py-1.5 rounded-xl text-xs font-bold flex items-center gap-1
```

**Barra de Abaixo (Conteúdo scroll):**
```
Header "Mensagens Diretas" (ou lista de amigos online):
  px-4 py-4 text-[10px] font-bold uppercase tracking-wider text-discordex-text-secondary
Lista de Cards de Amigo / Solicitação:
  Cada item:
    flex items-center justify-between gap-4 px-4 py-3 mx-4 my-2 rounded-xl
    bg-discordex-surface border border-discordex-border hover:bg-discordex-hover transition-colors
    Lado esquerdo:
      Avatar w-10 h-10 rounded-full + status
      Info: flex flex-col
        Nome: text-sm font-bold text-discordex-text-primary
        @username: text-xs text-discordex-text-secondary
        Status text/activity: text-[11px] text-discordex-success
    Lado direito:
      Ações: Chat, Aceitar, Recusar, Perfil
      Botões ícones pequenos com tooltips
```

---

### 4.7 Chamadas (CallView.tsx & IncomingCallOverlay.tsx)

**CallView (Janela de chamada ativa):**
- Posição: painel superior direito ou fullscreen
- Fundo: bg-black/80 (escuro total)
- Grid participants: auto-fit minmax(240px, 1fr)
- Cada participant tile:
  - aspect-video rounded-xl overflow-hidden bg-discordex-secondary relative
  - Vídeo: object-cover w-full h-full
  - Fallback sem vídeo: gradient bg (ou cor do usuário) centralizado com avatar grande w-24 h-24 rounded-full
  - Nome: absolute bottom-3 left-3 px-3 py-1.5 rounded-full bg-black/60 backdrop-blur-sm text-xs font-semibold text-white
  - Ícone Mic: se mutado → MicOff w-3.5 h-3.5 text-discordex-danger ao lado do nome
  - Falando: .speaking-ring (bordas azuis + glow)

**Controles (Fixos inferior centro):**
```
Container: flex items-center gap-3 mb-4
Cada botão de controle:
  w-12 h-12 rounded-full flex items-center justify-center
  Padrão: bg-discordex-surface/80 backdrop-blur-md border border-discordex-border text-white hover:bg-discordex-hover
  Desligar chamada: bg-discordex-danger hover:bg-red-500 (PhoneOff w-5 h-5)
  Toggles com estado ativado: bg-primary
Ícones: Mic, MicOff, Video, VideoOff, MonitorUp (compartilhar tela), Users (membros), MessageSquare (chat), Settings, PhoneOff
```

**Incoming Call (Overlay de chamada recebida):**
```
fixed inset-0 z-50 bg-black/80 backdrop-blur-md flex items-center justify-center animate-fade-in
Card central:
  bg-discordex-surface border border-discordex-border rounded-3xl p-8 max-w-sm w-full mx-4 shadow-float-lg text-center space-y-5
  Avatar grande w-24 h-24 rounded-full + Pulse animation
  Nome caller text-xl font-black
  @username / "Chamada de Vídeo" text-xs text-discordex-text-secondary
  Ringing animation: texto "Chamando..." text-discordex-warning animate-pulse
  Botões (lado a lado):
    Recusar: w-full flex-1 py-3 rounded-xl bg-discordex-danger hover:bg-red-500 text-white font-bold (PhoneOff icon)
    Atender: w-full flex-1 py-3 rounded-xl bg-discordex-success hover:bg-green-500 text-white font-bold (Phone icon)
  gap-4 entre botões
```

---

### 4.8 Componentes Modais (Modals.tsx / Popups)

**Overlay Modal Padrão:**
```
fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4 animate-fade-in
```

**Card Modal:**
```
bg-discordex-secondary border border-discordex-border rounded-2xl overflow-hidden w-full max-w-lg shadow-2xl animate-scale-in
Header modal:
  p-4 border-b border-discordex-border flex items-center justify-between
  Título: text-lg font-bold text-discordex-text-primary
  Botão fechar: X icone w-5 h-5 p-1.5 rounded-lg text-discordex-text-secondary hover:bg-discordex-hover hover:text-discordex-text-primary transition-colors
Body modal:
  p-4 space-y-4 (max-h-[70vh] overflow-y-auto)
Footer modal:
  p-4 border-t border-discordex-border flex items-center justify-end gap-2
  Botão Cancelar: px-4 py-2.5 rounded-xl bg-discordex-surface text-discordex-text-primary text-sm font-semibold hover:bg-discordex-hover transition-colors
  Botão Ação: px-4 py-2.5 rounded-xl bg-primary hover:bg-primary-hover text-white text-sm font-semibold transition-colors
```

**Context Menu (botão direito):**
```
fixed z-50 min-w-[200px] bg-discordex-surface border border-discordex-border rounded-xl py-1 shadow-2xl animate-scale-in
Item menu:
  flex items-center gap-2 px-3 py-2 text-xs text-discordex-text-primary hover:bg-primary hover:text-white transition-colors cursor-pointer
  Ícone w-4 h-4
  Rótulo
  Shortcut (opcional): text-discordex-text-secondary text-[10px] ml-auto
Divisor entre grupos: border-t border-discordex-border my-1
Item perigo/danger: hover:bg-discordex-danger text-discordex-danger hover:text-white
```

**Toasts (Notificações):**
```
fixed top-4 right-4 z-50 flex flex-col gap-2.5 max-w-sm pointer-events-none
Cada toast:
  flex items-center gap-3 bg-discordex-surface border border-discordex-border p-4 rounded-xl shadow-2xl animate-slide-up pointer-events-auto
  Ícone: CheckCircle2 (success verde), AlertTriangle (error vermelho), Info (info azul primário) - w-5 h-5
  Texto: text-sm font-medium text-discordex-text-primary
  Botão X fechar: text-discordex-text-secondary hover:text-discordex-text-primary p-0.5 rounded transition-colors
```

**Settings Panel (Slide lateral direito):**
```
fixed top-0 right-0 h-full w-[380px] max-w-full z-40
bg-discordex-secondary border-l border-discordex-border shadow-2xl
animate-slide-in (right to left)
Overlay backdrop: fixed inset-0 bg-black/50 z-30
Header: h-14 px-5 border-b border-discordex-border flex items-center gap-2
  X fechar, Título página
Conteúdo: overflow-y-auto py-4 px-5 pb-20 space-y-6
  Cada section:
    Título section: text-[10px] font-bold uppercase tracking-wider text-discordex-text-secondary mb-3
    Grupo de campos / itens
  Card perfil: bg-discordex-surface rounded-2xl p-5 border border-discordex-border
    Avatar editável, inputs nome, username, bio
  Lista de items (roles, membros, etc):
    Cada item: flex items-center justify-between p-3 bg-discordex-surface border border-discordex-border rounded-xl mb-2
Footer fixo: bottom-0 left-0 right-0 p-4 border-t border-discordex-border bg-discordex-secondary
  Botões salvar/cancelar
```

---

## 5. ANIMAÇÕES & MICROINTERAÇÕES

### 5.1 Animações Tailwind (do config)

```js
animation: {
  'pulse-subtle': 'pulseSubtle 2s cubic-bezier(0.4, 0, 0.6, 1) infinite',
  'fade-in': 'fadeIn 0.2s ease-out forwards',
  'slide-up': 'slideUp 0.3s cubic-bezier(0.16, 1, 0.3, 1) forwards',
  'scale-in': 'scaleIn 0.2s cubic-bezier(0.16, 1, 0.3, 1) forwards',
}

Uso:
  - animate-fade-in     = Aparição suave (modals overlay, toasts, banners)
  - animate-slide-up    = Elementos sobem de baixo (toasts, emoji picker, reply)
  - animate-scale-in    = Popups que aparecem com zoom (context menu, modal card)
  - animate-pulse       = Pontos de status "conectando"
  - animate-spin        = Loaders, ícones de "conectando reconnecting"
```

### 5.2 Transições Padrão

```
- Botões/hrefs: transition-colors (rápido, padrão 150ms)
- Server icons (shape change): transition-all duration-200
- Drawers/sidebar mobile: transition-transform duration-300
- Search input (width): transition-all duration-200
- Tooltip: transition-all duration-150 ease-out (opacity 0 → 100, scale 95 → 100)
- Hover group items: transition-colors + transition-opacity (toolbar msg)
- Reaction toggle: transition-all
```

### 5.3 Estados Visuais

```
- Loading: Ícone animate-spin, disabled:opacity-60, cursor:wait
- Disabled: opacity-50 + cursor-not-allowed + pointer-events-none (ou só opacity)
- Focus input: outline-none + border-primary (sem outline nativo)
- Selected / active: SEMPRE fundo primário (ou primário/10) + texto branco/primário
- Active server indicator: barra vertical branca esquerda
- Unread / notificações: 
    contador > 0: pill vermelho com número
    simples: bolinha branca
```

---

## 6. RESPONSIVIDADE MOBILE

**Breakpoints Tailwind padrão:**
- `sm`: 640px
- `md`: 768px
- `lg`: 1024px
- `xl`: 1280px

**Regras Específicas:**

| Componente | < md (mobile) | md - lg (tablet) | > lg (desktop) |
|---|---|---|---|
| Sidebar Servidores + Canais | Drawer off-canvas (translate-x), backdrop, botão Menu hamburger | Sempre visíveis | Sempre visíveis |
| Botão Menu (hamburger) | Visível no topo chat | Oculto | Oculto |
| Sidebar Membros (direita) | Oculto total | Oculto total | Visível |
| Search no header chat | Oculto | sm:block (visível) | Visível |
| Modais/Largura max | w-full max-w-sm | max-w-md | max-w-lg/xl |
| Auth card | w-full max-w-xs | max-w-sm | max-w-sm |
| Settings lateral | w-full (anima baixo ou slide) | 320px | 380px |
| Tamanhos fonte | Igual desktop | Igual desktop | Igual desktop |
| Tamanho server icons | 12h12 w12 | 12h12 w12 | 12h12 w12 |

**Navegação Mobile:**
- Backdrop overlay preto 60% (bg-black/60) ao abrir sidebar
- Drawer slide 300ms
- Botão back (ArrowLeft) no chat ao invés de toggle menu quando em sub-telas
- Touch targets: botões >= 40x40px (ideal), nunca menores que 32px
- Scroll em menus: `-webkit-overflow-scrolling: touch`

---

## 7. COMPONENTES UI REUTILIZÁVEIS (SharedUI.tsx)

### 7.1 Tooltip
```tsx
<Tooltip content="Texto do tooltip" position="right | bottom | top | left">
  <button>...</button>
</Tooltip>
- Aparece no group-hover
- Fundo bg-discordex-surface border border-discordex-border text-xs px-3 py-1.5 rounded-md shadow-xl
- Setinha (pointer) alinhada com position
- Opacity 0 → 100 + scale 95 → 100 transition duration-150
```

### 7.2 Input Estilizado (Padrão do Projeto)
```
Fundo: bg-discordex-bg ou bg-discordex-secondary
Borda: border border-discordex-border
Radius: rounded-xl
Padding: px-4 py-3
Fonte: text-sm ou text-xs
Cor placeholder: text-discordex-text-secondary/40
Focus: outline-none + focus:border-primary
Transição: transition-all
```

### 7.3 Button Variants
```
1. Primary (CTA):
   bg-primary hover:bg-primary-hover disabled:bg-primary/20
   text-white font-bold rounded-xl px-4 py-3
   transition-colors + shadow-glow-blue (opcional)

2. Secondary:
   bg-discordex-surface hover:bg-discordex-hover
   text-discordex-text-primary font-semibold rounded-xl px-4 py-2.5
   border border-discordex-border

3. Ghost:
   bg-transparent hover:bg-discordex-hover
   text-discordex-text-secondary hover:text-discordex-text-primary
   rounded-lg p-1.5 (ícone) ou px-3 py-1.5 (texto)

4. Danger / Destructive:
   bg-discordex-danger hover:bg-red-500 text-white font-bold rounded-xl
   (Botão "Desligar chamada", "Sair do servidor", "Excluir")

5. Success:
   bg-discordex-success hover:bg-green-500 text-white font-bold rounded-xl
   (Botão "Aceitar amizade", "Entrar", "Confirmar")
```

---

## 8. DIRETRIZES & PADRÕES DE CÓDIGO

### 8.1 Estrutura de Classes Tailwind
- Ordem: Layout → Box Model → Visual → Tipografia → Estados (consistente)
- Usar utilitários nativos, NÃO usar `@apply` em CSS custom
- Cores: SEMPRE usar tokens `discordex-*` e `primary-*`. Nunca hex hardcoded fora do tailwind config
- Bordas: SEMPRE `border-discordex-border`, nunca `border-gray-500`
- Border radius: 
  - Grandes cards/modals: rounded-2xl
  - Botões, inputs: rounded-xl
  - Ícones pequenos, badges: rounded-lg
  - Server icons: rounded-2xl → ativo rounded-[14px]
  - Avatar: SEMPRE rounded-full (círculo)
  - Toasts: rounded-xl

### 8.2 Icones (Lucide)
- Sempre importar do `lucide-react`
- Usar tamanhos consistentes: `w-4 h-4` (padrão botões), `w-5 h-5` (ações), `w-4.5 h-4.5` (sidebar)
- Cores por estado (ativo/inativo)
- Nunca use emojis como ícones de ação, use Lucide. Emojis = só reactions e placeholders

### 8.3 Acessibilidade
- Botões: sempre `<button>` nativo, nunca `<div onClick>`
- Form: use `<form>`, `onSubmit` com botão `type="submit"`
- Imgs: sempre `alt` descritivo, avatars tem alt="nome usuário"
- Tooltips em ícones sem texto
- Focus visível: inputs e botões devem ter estilo de focus claro (primary border)
- Cores de contraste: texto primário #F1F5F9 sobre fundo #070B14 = WCAG AA (passa)
- Labels minúsculas (10px) em fields: importante para screen readers

### 8.4 Z-Index Stack (garanta que não sobreponha errado)
```
- 10 = padrão (barra inferior micro-interações)
- 20 = toolbar overlay (message)
- 30 = backdrop drawer / emoji picker
- 40 = settings panel slide
- 50 = modals, context menu, toasts, incoming call (MAIS ALTO)
```

---

## 9. MELHORIAS SUGERIDAS (ROADMAP DESIGN)

- [x] Sistema de design tokens baseado no tema escuro
- [x] Animações de entrada/saída (fade, slide, scale)
- [x] Scrollbar custom minimalista
- [x] Responsividade mobile com drawer
- [x] Speaking ring visual em chamadas
- [ ] **Dark mode apenas, mas preparar estrutura para Tema Claro futuramente**
- [ ] **Gradientes sutis em Hero sections / Login page (decoração)**
- [ ] **Bento Grid layout na tela Friends com estatísticas**
- [ ] **Avatar decoration (borda animada para Nitro/Boosters)**
- [ ] **Message attachments com preview de PDF / Video**
- [ ] **Custom cursor / hover highlight no chat**
- [ ] **Micro sound effects (opcional) + visual feedback**
- [ ] **Empty states com ilustrações SVG custom (em vez de emojis)**
- [ ] **Progress bar de upload de imagem**
- [ ] **Typing indicator (3 pontinhos animados) quando usuário estiver digitando**
- [ ] **Confetti / particles no sucesso de ações especiais**
- [ ] **Skeleton loaders (shimmer) para carregamento de mensagens/servidores**
- [ ] **Drag and drop upload de arquivos com drop zone visual**
- [ ] **Reaction animation (pop/bounce) quando usuário reage**
- [ ] **Componente de "Mostrar novo" separator no chat (data / novas msgs)**
- [ ] **Pin messages highlight no topo do chat**
- [ ] **Thread / responder em thread visual (ícone + contador)**
- [ ] **User profile card popover ao passar o mouse no nome/avatar**

---

## 10. REFERÊNCIAS DE ARQUIVOS PARA CONSULTA

- Paleta & Animações: [tailwind.config.js](file:///c:/Users/SnyX/Pictures/Discordex/tailwind.config.js)
- CSS Global, scrollbar, glass, speaking-ring: [index.css](file:///c:/Users/SnyX/Pictures/Discordex/src/index.css)
- Layout Dashboard principal: [App.tsx](file:///c:/Users/SnyX/Pictures/Discordex/src/App.tsx)
- Componentes compartilhados (Tooltip, Toast): [SharedUI.tsx](file:///c:/Users/SnyX/Pictures/Discordex/src/components/SharedUI.tsx)
- Sidebar Servidores (72px): [SidebarServers.tsx](file:///c:/Users/SnyX/Pictures/Discordex/src/components/SidebarServers.tsx)
- Área Chat completa: [ChatArea.tsx](file:///c:/Users/SnyX/Pictures/Discordex/src/components/ChatArea.tsx)
- Tela Login/Cadastro: [AuthPage.tsx](file:///c:/Users/SnyX/Pictures/Discordex/src/components/AuthPage.tsx)
- Dependências: [package.json](file:///c:/Users/SnyX/Pictures/Discordex/package.json)

---

## INSTRUÇÕES FINAIS PARA O DESENVOLVEDOR/AI

**Ao fazer QUALQUER alteração de design ou frontend:**
1. Siga SEMPRE a paleta `discordex-*` do tailwind.config.js. NUNCA invente cores.
2. Use os componentes SharedUI (Tooltip, ToastContainer) já existentes — NÃO crie duplicatas.
3. Todos os estados hover/focus/active/disabled devem ter transição suave.
4. Textos pequenos (descrições, mensagens chat) SEMPRE use `text-xs leading-relaxed`.
5. Botões SEMPRE `font-bold` e ícones consistentes do Lucide.
6. Primeiro mobile (mobile-first), depois desktop. Nunca esqueça `md: lg: sm:`.
7. Modais = sempre `fixed inset-0` + backdrop blur + animação `animate-scale-in` no card.
8. Sempre teste contraste — texto secundário não pode ficar ilegível.
9. Nunca use estilos inline hardcoded, a menos que seja cor dinâmica de role/usuário.
10. Consistência > originalidade. Se já tem um padrão no app, o siga.

---

**FIM DO PROMPT DE DESIGN & FRONTEND**
Use este documento como BÍBLIA para qualquer alteração visual no Discordex.
