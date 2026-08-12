import React, { useState } from 'react';
import { KeyRound, RefreshCw } from 'lucide-react';
import { supabase } from '../lib/supabase';

interface ResetPasswordPageProps {
  onComplete: () => void;
}

export const ResetPasswordPage: React.FC<ResetPasswordPageProps> = ({ onComplete }) => {
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [message, setMessage] = useState<{ type: 'error' | 'success'; text: string } | null>(null);
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    setMessage(null);

    if (password.length < 6) {
      setMessage({ type: 'error', text: 'A senha deve ter pelo menos 6 caracteres.' });
      return;
    }
    if (password !== confirm) {
      setMessage({ type: 'error', text: 'As senhas nao conferem.' });
      return;
    }

    setLoading(true);
    const { error } = await supabase.auth.updateUser({ password });
    setLoading(false);

    if (error) {
      setMessage({ type: 'error', text: error.message || 'Nao foi possivel alterar a senha.' });
      return;
    }

    setMessage({ type: 'success', text: 'Senha alterada com sucesso!' });
    setTimeout(onComplete, 1500);
  };

  return (
    <main className="min-h-screen bg-discordex-bg text-discordex-text-primary flex p-6">
      <section className="m-auto w-full max-w-sm bg-discordex-secondary border border-discordex-border rounded-2xl shadow-2xl overflow-hidden">
        <div className="p-6 border-b border-discordex-border">
          <div className="w-12 h-12 rounded-2xl bg-primary text-white flex items-center justify-center font-black tracking-wider mb-5">
            DX
          </div>
          <h1 className="text-2xl font-black">Redefinir senha</h1>
          <p className="text-xs text-discordex-text-secondary mt-1">
            Digite sua nova senha para entrar novamente.
          </p>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          <label className="block space-y-2">
            <span className="text-[10px] font-bold uppercase tracking-wider text-discordex-text-secondary">
              Nova senha
            </span>
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

          <label className="block space-y-2">
            <span className="text-[10px] font-bold uppercase tracking-wider text-discordex-text-secondary">
              Confirmar nova senha
            </span>
            <input
              type="password"
              value={confirm}
              onChange={(event) => setConfirm(event.target.value)}
              className="w-full px-4 py-3 bg-discordex-bg border border-discordex-border rounded-xl text-sm outline-none focus:border-primary"
              placeholder="Repita a nova senha"
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
            {loading ? <RefreshCw className="w-4 h-4 animate-spin" /> : <KeyRound className="w-4 h-4" />}
            {loading ? 'Salvando...' : 'Salvar nova senha'}
          </button>
        </form>
      </section>
    </main>
  );
};