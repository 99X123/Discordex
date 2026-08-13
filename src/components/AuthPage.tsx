import React, { useState } from 'react';
import { ArrowLeft, SignIn, EnvelopeSimpleOpen, ArrowsClockwise, UserPlus } from '@phosphor-icons/react';
import { login, register, resetPassword, resendVerification } from '../services/auth';

export const AuthPage: React.FC = () => {
  const [mode, setMode] = useState<'login' | 'register'>('login');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [username, setUsername] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [message, setMessage] = useState<{ type: 'error' | 'success'; text: string } | null>(null);
  const [loading, setLoading] = useState(false);
  const [verifyEmail, setVerifyEmail] = useState<string | null>(null);
  const [resending, setResending] = useState(false);

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    setLoading(true);
    setMessage(null);

    const result = mode === 'login'
      ? await login(email, password)
      : await register(email, password, displayName || username, username);

    setLoading(false);

    if (!result.success) {
      if (mode === 'login' && result.message === 'Confirme seu email antes de entrar.') {
        setVerifyEmail(email);
        setMessage({ type: 'error', text: 'Seu email ainda nao foi confirmado. Reenvie o link para liberar o login.' });
      } else {
        setMessage({ type: 'error', text: result.message });
      }
      return;
    }

    if (mode === 'register' && result.user && !result.user.email_confirmed_at) {
      setVerifyEmail(email);
      setMessage({ type: 'success', text: 'Conta criada! Confirme seu email para poder logar.' });
      return;
    }

    setMessage({
      type: 'success',
      text: mode === 'login' ? 'Login realizado.' : 'Conta criada. Verifique seu email se a confirmacao estiver ativada.',
    });
  };

  const handleResetPassword = async () => {
    if (!email.trim()) {
      setMessage({ type: 'error', text: 'Digite seu email primeiro.' });
      return;
    }

    setLoading(true);
    const result = await resetPassword(email);
    setLoading(false);
    setMessage({ type: result.success ? 'success' : 'error', text: result.message });
  };

  const handleResend = async () => {
    if (!verifyEmail) return;
    setResending(true);
    const result = await resendVerification(verifyEmail);
    setResending(false);
    setMessage({ type: result.success ? 'success' : 'error', text: result.message });
  };

  const messageBox = message && (
    <div className={`text-xs rounded-md border px-3 py-2 ${message.type === 'error' ? 'border-signal-danger/30 bg-signal-danger/10 text-signal-danger' : 'border-signal-success/30 bg-signal-success/10 text-signal-success'}`}>
      {message.text}
    </div>
  );

  return (
    <main className="min-h-screen bg-signal-bg text-signal-text-primary flex p-6">
      <section className="m-auto w-full max-w-sm bg-signal-secondary border border-signal-border panel-cut shadow-float-lg overflow-hidden">

        <div className="p-6 border-b border-signal-border">
          {/* Logo — quadrado com canto chanfrado */}
          <div className="w-12 h-12 panel-cut bg-brass text-signal-bg flex items-center justify-center font-display font-bold tracking-tight mb-5 shadow-brass">
            DX
          </div>
          <h1 className="text-2xl font-display font-bold">Discordex</h1>
          <p className="text-xs text-signal-text-secondary mt-1">
            Entre para acessar seus servidores, DMs e chamadas reais.
          </p>
          <div className="mt-4 text-[10px] font-mono text-signal-text-secondary/50 tracking-widest">
            SIGNAL://AUTH
          </div>
        </div>

        {verifyEmail ? (
          <div className="p-6 space-y-4">
            <div className="w-12 h-12 rounded-md bg-brass/15 text-brass flex items-center justify-center">
              <EnvelopeSimpleOpen className="w-6 h-6" />
            </div>
            <h2 className="text-lg font-display font-bold text-signal-text-primary">Verifique seu email</h2>
            <p className="text-xs text-signal-text-secondary leading-relaxed">
              Enviamos um link de confirmacao para{' '}
              <span className="text-signal-text-primary font-semibold">{verifyEmail}</span>.
              Abra o link para liberar o login na sua conta.
            </p>

            {messageBox}

            <button
              type="button"
              onClick={handleResend}
              disabled={resending}
              className="w-full px-4 py-3 rounded-md bg-brass hover:bg-brass-hover disabled:opacity-60 text-signal-bg text-sm font-bold flex items-center justify-center gap-2 transition-colors"
            >
              <ArrowsClockwise className={`w-4 h-4 ${resending ? 'animate-spin' : ''}`} />
              {resending ? 'Enviando...' : 'Reenviar email de verificacao'}
            </button>

            <button
              type="button"
              onClick={() => { setVerifyEmail(null); setMessage(null); }}
              className="w-full text-xs text-signal-text-secondary hover:text-signal-text-primary inline-flex items-center justify-center gap-1.5 transition-colors"
            >
              <ArrowLeft className="w-3 h-3" />
              Voltar ao login
            </button>
          </div>
        ) : (
          <>
            <div className="p-6 border-b border-signal-border/60 pb-0">
              {/* Toggle Login/Cadastro */}
              <div className="grid grid-cols-2 gap-1 bg-signal-bg border border-signal-border rounded-md p-1 mb-6">
                <button
                  type="button"
                  onClick={() => setMode('login')}
                  className={`py-2 rounded-md text-xs font-bold transition-colors ${mode === 'login' ? 'bg-brass text-signal-bg' : 'text-signal-text-secondary hover:text-signal-text-primary'}`}
                >
                  Login
                </button>
                <button
                  type="button"
                  onClick={() => setMode('register')}
                  className={`py-2 rounded-md text-xs font-bold transition-colors ${mode === 'register' ? 'bg-brass text-signal-bg' : 'text-signal-text-secondary hover:text-signal-text-primary'}`}
                >
                  Cadastro
                </button>
              </div>
            </div>

            <form onSubmit={handleSubmit} className="p-6 space-y-4">

              {mode === 'register' && (
                <>
                  <label className="block space-y-2">
                    <span className="text-[10px] font-bold uppercase tracking-wider text-signal-text-secondary">
                      Nome de usuario <span className="text-brass">(unico)</span>
                    </span>
                    <input
                      value={username}
                      onChange={(event) => setUsername(event.target.value)}
                      className="w-full px-4 py-3 bg-signal-bg border border-signal-border rounded-md text-sm outline-none focus:border-brass"
                      placeholder="joao_dev"
                      minLength={2}
                      maxLength={32}
                      pattern="[a-zA-Z0-9_]+"
                      title="Apenas letras, numeros e _"
                      required
                    />
                    <span className="block text-[9px] text-signal-text-secondary">
                      Seu identificador unico para adicionar amigos e ser encontrado (ex: joao_dev).
                    </span>
                  </label>

                  <label className="block space-y-2">
                    <span className="text-[10px] font-bold uppercase tracking-wider text-signal-text-secondary">Nome (apelido)</span>
                    <input
                      value={displayName}
                      onChange={(event) => setDisplayName(event.target.value)}
                      className="w-full px-4 py-3 bg-signal-bg border border-signal-border rounded-md text-sm outline-none focus:border-brass"
                      placeholder={username || 'Seu nome de exibicao'}
                    />
                  </label>
                </>
              )}

              <label className="block space-y-2">
                <span className="text-[10px] font-bold uppercase tracking-wider text-signal-text-secondary">Email</span>
                <input
                  type="email"
                  value={email}
                  onChange={(event) => setEmail(event.target.value)}
                  className="w-full px-4 py-3 bg-signal-bg border border-signal-border rounded-md text-sm outline-none focus:border-brass"
                  placeholder="voce@email.com"
                  required
                />
              </label>

              <label className="block space-y-2">
                <span className="text-[10px] font-bold uppercase tracking-wider text-signal-text-secondary">Senha</span>
                <input
                  type="password"
                  value={password}
                  onChange={(event) => setPassword(event.target.value)}
                  className="w-full px-4 py-3 bg-signal-bg border border-signal-border rounded-md text-sm outline-none focus:border-brass"
                  placeholder="Minimo 6 caracteres"
                  minLength={6}
                  required
                />
              </label>

              {messageBox}

              <button
                type="submit"
                disabled={loading}
                className="w-full px-4 py-3 rounded-md bg-brass hover:bg-brass-hover disabled:opacity-60 text-signal-bg text-sm font-bold flex items-center justify-center gap-2 transition-colors"
              >
                {mode === 'login' ? <SignIn className="w-4 h-4" /> : <UserPlus className="w-4 h-4" />}
                {loading ? 'Aguarde...' : mode === 'login' ? 'Entrar' : 'Criar conta'}
              </button>

              {mode === 'login' && (
                <button
                  type="button"
                  onClick={handleResetPassword}
                  className="w-full text-xs text-signal-text-secondary hover:text-signal-text-primary transition-colors"
                >
                  Esqueci minha senha
                </button>
              )}
            </form>
          </>
        )}

      </section>
    </main>
  );
};