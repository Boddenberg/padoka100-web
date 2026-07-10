import * as WebBrowser from "expo-web-browser";
import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import { api, ApiError, setApiToken, setUnauthorizedHandler } from "@/lib/api";
import { clearSession, readSession, saveSession } from "@/lib/session";
import {
  buildAuthRedirectUrl,
  supabase,
  supabaseAuthConfigured
} from "@/lib/supabase";
import type { UsuarioPerfil } from "@/types/api";

WebBrowser.maybeCompleteAuthSession();

type AuthStatus = "loading" | "signed-in" | "signed-out";

export interface RegisterResult {
  requiresEmailConfirmation: boolean;
}

interface AuthContextValue {
  status: AuthStatus;
  user: UsuarioPerfil | null;
  signIn: (email: string, senha: string) => Promise<void>;
  signInWithGoogle: () => Promise<void>;
  register: (data: { nome: string; email: string; telefone: string; senha: string }) => Promise<RegisterResult>;
  requestPasswordReset: (email: string) => Promise<void>;
  updatePassword: (novaSenha: string) => Promise<void>;
  completeAuthCallback: (code: string) => Promise<void>;
  signOut: () => Promise<void>;
  refreshUser: () => Promise<void>;
  setUser: (user: UsuarioPerfil) => void;
}

const AuthContext = createContext<AuthContextValue | null>(null);

function ensureSupabaseAuthConfigured() {
  if (!supabaseAuthConfigured) {
    throw new Error("Supabase Auth ainda nao foi configurado neste build.");
  }
}

function readUrlParam(url: string, key: string) {
  const source = url.includes("#") ? url.replace("#", "?") : url;
  try {
    return new URL(source).searchParams.get(key);
  } catch {
    const match = new RegExp(`[?#&]${key}=([^&#]+)`).exec(source);
    return match ? decodeURIComponent(match[1]) : null;
  }
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [status, setStatus] = useState<AuthStatus>("loading");
  const [user, setUser] = useState<UsuarioPerfil | null>(null);

  const establishSession = useCallback(async (accessToken: string, fallback?: UsuarioPerfil | null) => {
    setApiToken(accessToken);
    let profile = fallback || null;
    try {
      profile = await api.auth.me();
    } catch {
      if (!profile) throw new Error("Nao foi possivel carregar o perfil da conta.");
    }
    setUser(profile);
    setStatus("signed-in");
    await saveSession({ token: accessToken, usuario: profile });
  }, []);

  const clearLocalAuth = useCallback(async () => {
    setApiToken(null);
    setUser(null);
    setStatus("signed-out");
    await clearSession();
  }, []);

  useEffect(() => {
    let active = true;
    async function restoreSession() {
      try {
        if (supabaseAuthConfigured) {
          const { data } = await supabase.auth.getSession();
          if (!active) return;
          if (data.session?.access_token) {
            await establishSession(data.session.access_token);
            return;
          }
        }

        const session = await readSession();
        if (!active) return;
        if (session) {
          setApiToken(session.token);
          setUser(session.usuario);
          setStatus("signed-in");
        } else {
          setStatus("signed-out");
        }
      } catch {
        if (active) setStatus("signed-out");
      }
    }
    void restoreSession();
    return () => {
      active = false;
    };
  }, [establishSession]);

  useEffect(() => {
    if (!supabaseAuthConfigured) return undefined;
    const { data } = supabase.auth.onAuthStateChange((_event, session) => {
      if (session?.access_token) {
        void establishSession(session.access_token);
      } else {
        void clearLocalAuth();
      }
    });
    return () => data.subscription.unsubscribe();
  }, [clearLocalAuth, establishSession]);

  const signOut = useCallback(async () => {
    api.auth.logout().catch(() => undefined);
    if (supabaseAuthConfigured) {
      await supabase.auth.signOut();
    }
    await clearLocalAuth();
  }, [clearLocalAuth]);

  useEffect(() => {
    setUnauthorizedHandler(() => {
      void signOut();
    });
    return () => setUnauthorizedHandler(null);
  }, [signOut]);

  const completeAuthCallback = useCallback(
    async (code: string) => {
      ensureSupabaseAuthConfigured();
      const { data, error } = await supabase.auth.exchangeCodeForSession(code);
      if (error) throw error;
      if (!data.session?.access_token) throw new Error("Nao foi possivel concluir a autenticacao.");
      await establishSession(data.session.access_token);
    },
    [establishSession]
  );

  const signIn = useCallback(
    async (email: string, senha: string) => {
      ensureSupabaseAuthConfigured();
      const { data, error } = await supabase.auth.signInWithPassword({
        email: email.trim(),
        password: senha
      });
      if (error) throw error;
      if (!data.session?.access_token) throw new Error("Login nao retornou uma sessao valida.");
      await establishSession(data.session.access_token);
    },
    [establishSession]
  );

  const register = useCallback(
    async (data: { nome: string; email: string; telefone: string; senha: string }) => {
      ensureSupabaseAuthConfigured();
      const { data: signUpData, error } = await supabase.auth.signUp({
        email: data.email.trim(),
        password: data.senha,
        options: {
          data: {
            name: data.nome.trim(),
            phone: data.telefone.trim() || null
          },
          emailRedirectTo: buildAuthRedirectUrl("auth/callback")
        }
      });
      if (error) throw error;
      if (signUpData.session?.access_token) {
        await establishSession(signUpData.session.access_token);
        return { requiresEmailConfirmation: false };
      }
      return { requiresEmailConfirmation: true };
    },
    [establishSession]
  );

  const requestPasswordReset = useCallback(async (email: string) => {
    ensureSupabaseAuthConfigured();
    const { error } = await supabase.auth.resetPasswordForEmail(email.trim(), {
      redirectTo: buildAuthRedirectUrl("reset-password")
    });
    if (error) throw error;
  }, []);

  const updatePassword = useCallback(
    async (novaSenha: string) => {
      ensureSupabaseAuthConfigured();
      const { data: sessionData } = await supabase.auth.getSession();
      if (!sessionData.session) throw new Error("Link de recuperacao invalido ou expirado.");
      const { data, error } = await supabase.auth.updateUser({ password: novaSenha });
      if (error) throw error;
      if (data.user && sessionData.session.access_token) {
        await establishSession(sessionData.session.access_token);
      }
    },
    [establishSession]
  );

  const signInWithGoogle = useCallback(async () => {
    ensureSupabaseAuthConfigured();
    const redirectTo = buildAuthRedirectUrl("auth/callback");
    const { data, error } = await supabase.auth.signInWithOAuth({
      provider: "google",
      options: {
        redirectTo,
        skipBrowserRedirect: true
      }
    });
    if (error) throw error;
    if (!data.url) throw new Error("Google login nao retornou URL de autenticacao.");

    const result = await WebBrowser.openAuthSessionAsync(data.url, redirectTo);
    if (result.type !== "success") return;

    const code = readUrlParam(result.url, "code");
    if (code) {
      await completeAuthCallback(code);
      return;
    }

    const accessToken = readUrlParam(result.url, "access_token");
    const refreshToken = readUrlParam(result.url, "refresh_token");
    if (accessToken && refreshToken) {
      const { data: sessionData, error: sessionError } = await supabase.auth.setSession({
        access_token: accessToken,
        refresh_token: refreshToken
      });
      if (sessionError) throw sessionError;
      if (sessionData.session?.access_token) await establishSession(sessionData.session.access_token);
    }
  }, [completeAuthCallback, establishSession]);

  const refreshUser = useCallback(async () => {
    const profile = await api.auth.me();
    setUser(profile);
  }, []);

  const value = useMemo(
    () => ({
      status,
      user,
      signIn,
      signInWithGoogle,
      register,
      requestPasswordReset,
      updatePassword,
      completeAuthCallback,
      signOut,
      refreshUser,
      setUser
    }),
    [
      status,
      user,
      signIn,
      signInWithGoogle,
      register,
      requestPasswordReset,
      updatePassword,
      completeAuthCallback,
      signOut,
      refreshUser
    ]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) throw new Error("useAuth precisa estar dentro de AuthProvider.");
  return context;
}

export function loginErrorMessage(error: unknown) {
  if (error instanceof ApiError) {
    if ([401, 403].includes(error.status)) return "E-mail ou senha invalidos. Confira e tente de novo.";
    if (error.status === 409) return "Ja existe uma conta com esse e-mail.";
    if (error.status === 422) return "Confira os dados: e-mail valido e senha com pelo menos 8 caracteres.";
  }
  if (error && typeof error === "object" && "message" in error) {
    const message = String((error as { message: unknown }).message);
    if (message.toLowerCase().includes("invalid login credentials")) {
      return "E-mail ou senha invalidos. Confira e tente de novo.";
    }
    return message;
  }
  return "Nao foi possivel continuar. Tente novamente.";
}
