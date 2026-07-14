import * as WebBrowser from "expo-web-browser";
import { useQueryClient } from "@tanstack/react-query";
import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { isAdmin } from "@/lib/access";
import { api, ApiError, setApiToken, setTokenRefresher, setUnauthorizedHandler } from "@/lib/api";
import { setApiLogAdminEnabled } from "@/lib/api-log";
import { clearSession, readSession, saveLastEmail, saveSession } from "@/lib/session";
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

// O fetch do app não tem timeout: uma resposta que nunca chega deixaria a
// Promise pendente para sempre. Na ABERTURA isso prenderia o app no
// carregamento, então corremos a validação da sessão contra um relógio.
function withTimeout<T>(promise: Promise<T>, ms: number): Promise<T> {
  return Promise.race([
    promise,
    new Promise<T>((_, reject) => setTimeout(() => reject(new Error("timeout")), ms))
  ]);
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
  const queryClient = useQueryClient();
  const [status, setStatus] = useState<AuthStatus>("loading");
  const [user, setUser] = useState<UsuarioPerfil | null>(null);
  // Status atual acessível dentro do watchdog sem recriá-lo a cada mudança.
  const statusRef = useRef<AuthStatus>("loading");
  statusRef.current = status;
  // Conta atualmente logada. Serve para detectar troca de conta no mesmo
  // aparelho e limpar caches (avisos, resumos...) sem misturar dados.
  const currentUserIdRef = useRef<string | null>(null);

  // Fora do dev, o Diagnóstico (fim do Perfil) só registra chamadas para
  // contas admin; logout ou troca de conta desliga e limpa o histórico.
  useEffect(() => {
    setApiLogAdminEnabled(isAdmin(user));
  }, [user]);

  const establishSession = useCallback(async (accessToken: string, fallback?: UsuarioPerfil | null) => {
    setApiToken(accessToken);
    let profile = fallback || null;
    try {
      profile = await api.auth.me();
    } catch {
      if (!profile) throw new Error("Nao foi possivel carregar o perfil da conta.");
    }
    // Troca de conta no mesmo aparelho: zera os caches em memória (avisos,
    // resumos, produtos...) para os dados de uma conta nunca aparecerem na outra.
    const previousId = currentUserIdRef.current;
    if (profile?.id && previousId && profile.id !== previousId) {
      queryClient.clear();
    }
    currentUserIdRef.current = profile?.id ?? null;
    setUser(profile);
    setStatus("signed-in");
    // Lembra o e-mail para adiantar a próxima entrada (fica mesmo após sair).
    if (profile?.email) void saveLastEmail(profile.email);
    await saveSession({ token: accessToken, usuario: profile });
  }, [queryClient]);

  const clearLocalAuth = useCallback(async () => {
    setApiToken(null);
    setUser(null);
    setStatus("signed-out");
    // Sai zerando os caches: o próximo login (mesma conta ou outra) começa limpo,
    // sem avisos/dados antigos do aparelho reaparecendo para quem entrar depois.
    currentUserIdRef.current = null;
    queryClient.clear();
    await clearSession();
  }, [queryClient]);

  // Renova o token de acesso pelo Supabase e devolve o novo. A camada de API
  // chama isto quando um request toma 401: renovar + refazer a chamada evita o
  // "sessão expirou" preso na tela quando o token só venceu (e ainda dá para
  // renovar). Devolve null quando a sessão morreu de vez → aí sim desloga.
  const refreshAccessToken = useCallback(async (): Promise<string | null> => {
    if (!supabaseAuthConfigured) return null;
    try {
      const { data, error } = await supabase.auth.refreshSession();
      const token = data.session?.access_token ?? null;
      if (error || !token) return null;
      // O onAuthStateChange("TOKEN_REFRESHED") cuida de perfil/sessão salva; aqui
      // só precisamos do token novo em cache para a rechamada seguir na hora.
      setApiToken(token);
      return token;
    } catch {
      return null;
    }
  }, []);

  useEffect(() => {
    setTokenRefresher(refreshAccessToken);
    return () => setTokenRefresher(null);
  }, [refreshAccessToken]);

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
          // Confere o token salvo ANTES de declarar "logado": assim um token
          // expirado leva direto ao login, em vez de abrir a tela Hoje e só
          // então tomar 401 (o "sessão expirada" que piscava). A conferência
          // tem prazo: se a rede travar (fetch sem timeout) ou o servidor
          // demorar, o app abre com a sessão salva em vez de ficar preso.
          try {
            const profile = await withTimeout(api.auth.me(), 4000);
            if (!active) return;
            setUser(profile);
            setStatus("signed-in");
            await saveSession({ token: session.token, usuario: profile });
          } catch (error) {
            if (!active) return;
            if (error instanceof ApiError && [401, 403].includes(error.status)) {
              await clearLocalAuth();
            } else {
              // Timeout ou falha de rede: abre com o que está salvo (se o token
              // estiver mesmo vencido, o 401 seguinte desloga sozinho).
              setUser(session.usuario);
              setStatus("signed-in");
            }
          }
        } else {
          setStatus("signed-out");
        }
      } catch {
        // Só decide "deslogado" se o watchdog ainda não resolveu por conta dele.
        if (active && statusRef.current === "loading") setStatus("signed-out");
      }
    }
    void restoreSession();

    // Blindagem final: sob QUALQUER travamento (inclusive a sessão do Supabase),
    // o app nunca fica preso no carregamento. Passado o limite, resolve com a
    // sessão salva (o 401 seguinte, se vier, desloga) ou vai para o login.
    const watchdog = setTimeout(async () => {
      if (!active || statusRef.current !== "loading") return;
      const saved = await readSession().catch(() => null);
      if (!active || statusRef.current !== "loading") return;
      if (saved) {
        setApiToken(saved.token);
        setUser(saved.usuario);
        setStatus("signed-in");
      } else {
        setStatus("signed-out");
      }
    }, 7000);

    return () => {
      active = false;
      clearTimeout(watchdog);
    };
  }, [establishSession, clearLocalAuth]);

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
    // Encerra a sessão LOCAL na hora: clearLocalAuth já joga o status para
    // signed-out (o RootNavigator leva ao login com a splash por cima), sem
    // esperar a rede. O logout no servidor/Supabase segue em segundo plano —
    // assim uma sessão expirada nunca fica "presa" na tela atual.
    api.auth.logout().catch(() => undefined);
    if (supabaseAuthConfigured) supabase.auth.signOut().catch(() => undefined);
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
      // "Confirmar e-mail" ligado: o Supabase nao devolve erro quando o e-mail
      // ja existe (protecao contra enumeracao de usuarios) — devolve um usuario
      // "fantasma", com `identities` vazio e sem sessao. Sem tratar isso, o app
      // mostraria um "confira seu e-mail" enganoso para uma conta que ja existe.
      const emailJaCadastrado =
        signUpData.user != null &&
        Array.isArray(signUpData.user.identities) &&
        signUpData.user.identities.length === 0;
      if (emailJaCadastrado) {
        throw new ApiError("E-mail ja cadastrado.", 409, null);
      }
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
    if (error.status === 409) return "Ja existe uma conta com esse e-mail. Tente entrar ou recuperar a senha.";
    if (error.status === 422) return "Confira os dados: e-mail valido e senha com pelo menos 8 caracteres.";
  }
  // Erros do Supabase Auth NAO sao ApiError: expoem `code`/`message` proprios e
  // status 400/422 (nunca 409), entao precisam ser traduzidos a parte — senao a
  // mensagem crua em ingles ("User already registered") vaza para a tela.
  const code =
    error && typeof error === "object" && "code" in error ? String((error as { code: unknown }).code) : "";
  const rawMessage =
    error && typeof error === "object" && "message" in error ? String((error as { message: unknown }).message) : "";
  const lower = rawMessage.toLowerCase();

  if (
    code === "user_already_exists" ||
    code === "email_exists" ||
    lower.includes("already registered") ||
    lower.includes("already been registered")
  ) {
    return "Ja existe uma conta com esse e-mail. Tente entrar ou recuperar a senha.";
  }
  if (code === "invalid_credentials" || lower.includes("invalid login credentials")) {
    return "E-mail ou senha invalidos. Confira e tente de novo.";
  }
  if (code === "email_not_confirmed" || lower.includes("email not confirmed")) {
    return "Confirme seu e-mail pelo link que enviamos antes de entrar.";
  }
  if (code === "weak_password" || lower.includes("password should be")) {
    return "Senha muito fraca. Escolha uma senha mais longa.";
  }
  if (code === "email_address_invalid" || lower.includes("invalid email")) {
    return "E-mail invalido. Confira e tente de novo.";
  }
  if (code.includes("rate_limit") || lower.includes("rate limit") || lower.includes("too many requests")) {
    return "Muitas tentativas em pouco tempo. Aguarde um instante e tente de novo.";
  }
  // Falha de rede (Supabase Auth usa fetch próprio, fora do nosso ApiError):
  // nunca deixa a mensagem crua em inglês ("Network request failed") vazar.
  if (
    error instanceof TypeError ||
    lower.includes("network request failed") ||
    lower.includes("failed to fetch") ||
    lower.includes("fetch failed") ||
    lower.includes("network error")
  ) {
    return "Verifique sua conexao e tente novamente.";
  }
  if (rawMessage) return rawMessage;
  return "Nao foi possivel continuar. Tente novamente.";
}
