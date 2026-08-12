import React, { useState } from 'react';
import { LogIn, UserPlus } from 'lucide-react';
import { login, register, resetPassword } from '../services/auth';

export const AuthPage: React.FC = () => {
  const [mode, setMode] = useState<'login' | 'register'>('login');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [message, setMessage] = useState<{ type: 'error' | 'success'; text: string } | null>(null);
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    setLoading(true);
    setMessage(null);

    const result = mode === 'login'
      ? await login(email, password)
      : await register(email, password, displayName || email.split('@')[0]);

    setLoading(false);

    if (!result.success) {
      setMessage({ type: 'error', text: result.message });
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

  return (
    <main className="min-h-screen bg-discordex-bg text-discordex-text-primary flex items-center justify-center p-6">
      <section className="w-full max-w-sm bg-discordex-secondary border border-discordex-border rounded-2xl shadow-2xl overflow-hidden">
        <div className="p-6 border-b border-discordex-border">
          <div className="w-12 h-12 rounded-2xl bg-primary text-white flex items-center justify-center font-black tracking-wider mb-5">
            DX
          </div>
          <h1 className="text-2xl font-black">Discordex</h1>
          <p className="text-xs text-discordex-text-secondary mt-1">
            Entre para acessar seus servidores, DMs e chamadas reais.
          </p>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          <div className="grid grid-cols-2 gap-2 bg-discordex-bg border border-discordex-border rounded-xl p-1">
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

          {message && (
            <div className={`text-xs rounded-xl border px-3 py-2 ${message.type === 'error' ? 'border-discordex-danger/30 bg-discordex-danger/10 text-discordex-danger' : 'border-discordex-success/30 bg-discordex-success/10 text-discordex-success'}`}>
              {message.text}
            </div>
          )}

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
      </section>
    </main>
  );
};
