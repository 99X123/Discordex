import React, { useState } from 'react';
import { ArrowLeft, LogIn, MailCheck, RefreshCw, UserPlus } from 'lucide-react';
import { login, register, resetPassword, resendVerification } from '../services/auth';

export const AuthPage: React.FC = () => {
  const [mode, setMode] = useState<'login' | 'register'>('login');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
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
      : await register(email, password, displayName || email.split('@')[0]);

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
    <div className={`text-xs rounded-xl border px-3 py-2 ${message.type === 'error' ? 'border-discordex-danger/30 bg-discordex-danger/10 text-discordex-danger' : 'border-discordex-success/30 bg-discordex-success/10 text-discordex-success'}`}>
      {message.text}
    </div>
  );

  return (
    <main className="min-h-screen bg-discordex-bg text-discordex-text-primary flex p-6">
      <section className="m-auto w-full max-w-sm bg-discordex-secondary border border-discordex-border rounded-2xl shadow-2xl overflow-hidden">

        <div className="p-6 border-b border-discordex-border">
          <div className="w-12 h-12 rounded-2xl bg-primary text-white flex items-center justify-center font-black tracking-wider mb-5">
            DX
          </div>
          <h1 className="text-2xl font-black">Discordex</h1>
          <p className="text-xs text-discordex-text-secondary mt-1">
            Entre para acessar seus servidores, DMs e chamadas reais.
          </p>
        </div>

        {verifyEmail ? (
          <div className="p-6 space-y-4">
            <div className="w-12 h-12 rounded-2xl bg-primary/15 text-primary flex items-center justify-center">
              <MailCheck className="w-6 h-6" />
            </div>
            <h2 className="text-lg font-black text-discordex-text-primary">Verifique seu email</h2>
            <p className="text-xs text-discordex-text-secondary leading-relaxed">
              Enviamos um link de confirmacao para{' '}
              <span className="text-discordex-text-primary font-semibold">{verifyEmail}</span>.
              Abra o link para liberar o login na sua conta.
            </p>

            {messageBox}

            <button
              type="button"
              onClick={handleResend}
              disabled={resending}
              className="w-full px-4 py-3 rounded-xl bg-primary hover:bg-primary-hover disabled:opacity-60 text-white text-sm font-bold flex items-center justify-center gap-2 transition-colors"
            >
              <RefreshCw className={`w-4 h-4 ${resending ? 'animate-spin' : ''}`} />
              {resending ? 'Enviando...' : 'Reenviar email de verificacao'}
            </button>

            <button
              type="button"
              onClick={() => { setVerifyEmail(null); setMessage(null); }}
              className="w-full text-xs text-discordex-text-secondary hover:text-discordex-text-primary inline-flex items-center justify-center gap-1.5 transition-colors"
            >
              <ArrowLeft className="w-3 h-3" />
              Voltar ao login
            </button>
          </div>
        ) : (
          <>
            <div className="p-6 border-b border-discordex-border/60 pb-0">
              <div className="grid grid-cols-2 gap-2 bg-discordex-bg border border-discordex-border rounded-xl p-1 mb-6">
                <button
                  type="button"
                  onClick={() => setMode('login')}
                  className={`py-2 rounded-lg text-xs font-bold transition-colors ${mode === 'login' ? 'bg-primary text-white' : 'text-discordex-text-secondary hover:text-discordex-text-primary'}`}
                >
                  Login
                </button>
                <button
                  type="button"
                  onClick={() => setMode('register')}
                  className={`py-2 rounded-lg text-xs font-bold transition-colors ${mode === 'register' ? 'bg-primary text-white' : 'text-discordex-text-secondary hover:text-discordex-text-primary'}`}
                >
                  Cadastro
                </button>
              </div>
            </div>

            <form onSubmit={handleSubmit} className="p-6 space-y-4">

              {mode === 'register' && (
                <label className="block space-y-2">
                  <span className="text-[10px] font-bold uppercase tracking-wider text-discordex-text-secondary">Nome</span>
                  <input
                    value={displayName}
                    onChange={(event) => setDisplayName(event.target.value)}
                    className="w-full px-4 py-3 bg-discordex-bg border border-discordex-border rounded-xl text-sm outline-none focus:border-primary"
                    placeholder="Seu nome"
                  />
                </label>
              )}

              <label className="block space-y-2">
                <span className="text-[10px] font-bold uppercase tracking-wider text-discordex-text-secondary">Email</span>
                <input
                  type="email"
                  value={email}
                  onChange={(event) => setEmail(event.target.value)}
                  className="w-full px-4 py-3 bg-discordex-bg border border-discordex-border rounded-xl text-sm outline-none focus:border-primary"
                  placeholder="voce@email.com"
                  required
                />
              </label>

              <label className="block space-y-2">
                <span className="text-[10px] font-bold uppercase tracking-wider text-discordex-text-secondary">Senha</span>
                <input
                  type="password"
                  value={password}
                  onChange={(event) => setPassword(event.target.value)}
                  className="w-full px-4 py-3 bg-discordex-bg border border-discordex-border rounded-xl text-sm outline-none focus:border-primary"
                  placeholder="Minimo 6 caracteres"
                  minLength={6}
                  required
                />
              </label>

              {messageBox}

              <button
                type="submit"
                disabled={loading}
                className="w-full px-4 py-3 rounded-xl bg-primary hover:bg-primary-hover disabled:opacity-60 text-white text-sm font-bold flex items-center justify-center gap-2 transition-colors"
              >
                {mode === 'login' ? <LogIn className="w-4 h-4" /> : <UserPlus className="w-4 h-4" />}
                {loading ? 'Aguarde...' : mode === 'login' ? 'Entrar' : 'Criar conta'}
              </button>

              {mode === 'login' && (
                <button
                  type="button"
                  onClick={handleResetPassword}
                  className="w-full text-xs text-discordex-text-secondary hover:text-discordex-text-primary transition-colors"
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