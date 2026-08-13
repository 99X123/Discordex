import React, { useState } from 'react';
import { Key, ArrowsClockwise } from '@phosphor-icons/react';
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
    <main className="min-h-screen bg-signal-bg text-signal-text-primary flex p-6">
      <section className="m-auto w-full max-w-sm bg-signal-secondary border border-signal-border panel-cut shadow-float-lg overflow-hidden">
        <div className="p-6 border-b border-signal-border">
          <div className="w-12 h-12 panel-cut bg-brass text-signal-bg flex items-center justify-center font-display font-bold tracking-tight mb-5 shadow-brass">
            DX
          </div>
          <h1 className="text-2xl font-display font-bold">Redefinir senha</h1>
          <p className="text-xs text-signal-text-secondary mt-1">
            Digite sua nova senha para entrar novamente.
          </p>
          <div className="mt-4 text-[10px] font-mono text-signal-text-secondary/50 tracking-widest">
            SIGNAL://AUTH
          </div>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          <label className="block space-y-2">
            <span className="text-[10px] font-bold uppercase tracking-wider text-signal-text-secondary">
              Nova senha
            </span>
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

          <label className="block space-y-2">
            <span className="text-[10px] font-bold uppercase tracking-wider text-signal-text-secondary">
              Confirmar nova senha
            </span>
            <input
              type="password"
              value={confirm}
              onChange={(event) => setConfirm(event.target.value)}
              className="w-full px-4 py-3 bg-signal-bg border border-signal-border rounded-md text-sm outline-none focus:border-brass"
              placeholder="Repita a nova senha"
              minLength={6}
              required
            />
          </label>

          {message && (
            <div className={`text-xs rounded-md border px-3 py-2 ${message.type === 'error' ? 'border-signal-danger/30 bg-signal-danger/10 text-signal-danger' : 'border-signal-success/30 bg-signal-success/10 text-signal-success'}`}>
              {message.text}
            </div>
          )}

          <button
            type="submit"
            disabled={loading}
            className="w-full px-4 py-3 rounded-md bg-brass hover:bg-brass-hover disabled:opacity-60 text-signal-bg text-sm font-bold flex items-center justify-center gap-2 transition-colors"
          >
            {loading ? <ArrowsClockwise className="w-4 h-4 animate-spin" /> : <Key className="w-4 h-4" />}
            {loading ? 'Salvando...' : 'Salvar nova senha'}
          </button>
        </form>
      </section>
    </main>
  );
};