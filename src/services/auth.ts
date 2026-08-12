import { supabase } from '../lib/supabase';
import type { User } from '@supabase/supabase-js';

// ============================================================
// AUTH SERVICE
// ============================================================

export interface AuthError {
  success: false;
  error: string;
  message: string;
}

export interface AuthSuccess {
  success: true;
  user: User;
}

/** Registra novo usuário com email/senha */
export async function register(
  email: string,
  password: string,
  displayName: string
): Promise<AuthSuccess | AuthError> {
  const { data, error } = await supabase.auth.signUp({
    email,
    password,
    options: {
      data: { display_name: displayName },
    },
  });

  if (error) {
    return {
      success: false,
      error: 'REGISTER_FAILED',
      message: translateAuthError(error.message),
    };
  }

  if (!data.user) {
    return {
      success: false,
      error: 'REGISTER_FAILED',
      message: 'Falha ao criar conta. Tente novamente.',
    };
  }

  return { success: true, user: data.user };
}

/** Autentica usuário com email/senha */
export async function login(
  email: string,
  password: string
): Promise<AuthSuccess | AuthError> {
  const { data, error } = await supabase.auth.signInWithPassword({ email, password });

  if (error) {
    return {
      success: false,
      error: 'LOGIN_FAILED',
      message: translateAuthError(error.message),
    };
  }

  if (!data.user) {
    return {
      success: false,
      error: 'LOGIN_FAILED',
      message: 'Credenciais inválidas.',
    };
  }

  return { success: true, user: data.user };
}

/** Encerra a sessão atual */
export async function logout(): Promise<void> {
  // Atualiza status para offline antes de sair
  const { data: { user } } = await supabase.auth.getUser();
  if (user) {
    await supabase
      .from('profiles')
      .update({ status: 'offline' })
      .eq('id', user.id);
  }

  await supabase.auth.signOut();
}

/** Envia email de recuperação de senha */
export async function resetPassword(email: string): Promise<{ success: boolean; message: string }> {
  const { error } = await supabase.auth.resetPasswordForEmail(email, {
    redirectTo: `${window.location.origin}/reset-password`,
  });

  if (error) {
    return { success: false, message: translateAuthError(error.message) };
  }

  return { success: true, message: 'Email de recuperação enviado. Verifique sua caixa de entrada.' };
}

/** Verifica sessão atual */
export async function getSession() {
  const { data: { session }, error } = await supabase.auth.getSession();
  if (error) return null;
  return session;
}

/** Retorna usuário atual */
export async function getCurrentUser() {
  const { data: { user } } = await supabase.auth.getUser();
  return user;
}

/** Traduz erros do Supabase Auth para português */
function translateAuthError(message: string): string {
  const errors: Record<string, string> = {
    'Invalid login credentials': 'Email ou senha incorretos.',
    'Email not confirmed': 'Confirme seu email antes de entrar.',
    'User already registered': 'Este email já está cadastrado.',
    'Password should be at least 6 characters': 'A senha deve ter pelo menos 6 caracteres.',
    'Unable to validate email address: invalid format': 'Formato de email inválido.',
    'Signup is disabled': 'Cadastro temporariamente desabilitado.',
    'Email rate limit exceeded': 'Muitas tentativas. Aguarde alguns minutos.',
  };

  return errors[message] || message || 'Erro desconhecido. Tente novamente.';
}
