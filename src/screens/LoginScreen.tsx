import { LinearGradient } from "expo-linear-gradient";
import { Image } from "expo-image";
import { useRouter } from "expo-router";
import { Eye, EyeOff, LogIn, Mail, UserPlus } from "lucide-react-native";
import { useState } from "react";
import { Keyboard, KeyboardAvoidingView, Platform, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useMutation } from "@tanstack/react-query";
import { Button, Field, Input, StateText } from "@/components/ui";
import { AUTH_REQUIRED } from "@/constants/auth";
import { loginErrorMessage, useAuth } from "@/contexts/auth";
import { supabaseAuthConfigured } from "@/lib/supabase";
import { colors, fonts, gradients, radius, shadows } from "@/lib/theme";
import { getGreeting } from "@/utils/greeting";

type Mode = "login" | "register" | "recover";

export function LoginScreen() {
  const router = useRouter();
  const { signIn, signInWithGoogle, register, requestPasswordReset } = useAuth();
  const [mode, setMode] = useState<Mode>("login");
  const [nome, setNome] = useState("");
  const [telefone, setTelefone] = useState("");
  const [email, setEmail] = useState("");
  const [senha, setSenha] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  const submit = useMutation({
    mutationFn: async () => {
      setSuccessMessage(null);
      if (mode === "recover") {
        await requestPasswordReset(email);
        return "recover" as const;
      }
      if (mode === "register") {
        const result = await register({ nome, email, telefone, senha });
        return result.requiresEmailConfirmation ? ("confirmation" as const) : ("signed-in" as const);
      }
      await signIn(email, senha);
      return "signed-in" as const;
    },
    onSuccess: (result) => {
      if (result === "signed-in") {
        router.replace("/");
        return;
      }
      if (result === "confirmation") {
        setSuccessMessage("Conta criada. Confira seu e-mail para confirmar o acesso.");
        setMode("login");
        setSenha("");
        return;
      }
      setSuccessMessage("Se existir uma conta com esse e-mail, enviaremos o link de recuperacao.");
      setMode("login");
      setSenha("");
    }
  });

  const googleLogin = useMutation({
    mutationFn: signInWithGoogle,
    onSuccess: () => {
      router.replace("/");
    }
  });

  const canSubmit =
    supabaseAuthConfigured &&
    email.trim().length > 0 &&
    (mode === "recover" || senha.length >= 1) &&
    (mode !== "register" || nome.trim().length > 0) &&
    !submit.isPending;

  return (
    <LinearGradient colors={gradients.hero} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.background}>
      <SafeAreaView style={styles.safe}>
        <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : undefined} style={styles.flex}>
          <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
            <Pressable style={styles.content} onPress={Keyboard.dismiss} accessible={false}>
              <View style={styles.brand}>
                <Image source={require("../../Logo.png")} style={styles.logo} contentFit="contain" />
                <Text style={styles.greeting}>{getGreeting()}</Text>
                <Text style={styles.title}>Padoka 100</Text>
                <Text style={styles.subtitle}>{subtitleByMode[mode]}</Text>
              </View>

              <View style={[styles.card, shadows.floating]}>
                <View style={styles.modeRow}>
                  <ModeChip label="Entrar" active={mode === "login"} onPress={() => setMode("login")} />
                  <ModeChip label="Criar conta" active={mode === "register"} onPress={() => setMode("register")} />
                </View>

                {mode === "register" ? (
                  <>
                    <Field label="Seu nome">
                      <Input value={nome} onChangeText={setNome} placeholder="Ex: Maria da Padoka" />
                    </Field>
                    <Field label="Telefone">
                      <Input value={telefone} onChangeText={setTelefone} placeholder="(00) 00000-0000" keyboardType="phone-pad" />
                    </Field>
                  </>
                ) : null}

                <Field label="E-mail">
                  <Input
                    value={email}
                    onChangeText={setEmail}
                    autoCapitalize="none"
                    autoCorrect={false}
                    keyboardType="email-address"
                    placeholder="seu@email.com"
                  />
                </Field>

                {mode !== "recover" ? (
                  <Field label="Senha">
                    <View style={styles.passwordRow}>
                      <Input
                        value={senha}
                        onChangeText={setSenha}
                        secureTextEntry={!showPassword}
                        placeholder="Sua senha"
                        style={styles.passwordInput}
                        onSubmitEditing={() => canSubmit && submit.mutate()}
                      />
                      <Pressable
                        onPress={() => setShowPassword((current) => !current)}
                        style={({ pressed }) => [styles.eyeButton, pressed && styles.pressed]}
                      >
                        {showPassword ? <EyeOff size={20} color={colors.muted} /> : <Eye size={20} color={colors.muted} />}
                      </Pressable>
                    </View>
                  </Field>
                ) : null}

                {!supabaseAuthConfigured ? (
                  <StateText tone="error" text="Supabase Auth ainda nao foi configurado para este build." />
                ) : null}
                {successMessage ? <StateText tone="success" text={successMessage} /> : null}
                {submit.error ? <StateText tone="error" text={loginErrorMessage(submit.error)} /> : null}
                {googleLogin.error ? <StateText tone="error" text={loginErrorMessage(googleLogin.error)} /> : null}

                <Button
                  title={submit.isPending ? pendingTitleByMode[mode] : actionTitleByMode[mode]}
                  icon={iconByMode[mode]}
                  disabled={!canSubmit}
                  onPress={() => submit.mutate()}
                />

                {mode === "login" ? (
                  <>
                    <Button
                      title={googleLogin.isPending ? "Abrindo Google..." : "Entrar com Google"}
                      tone="outline"
                      disabled={!supabaseAuthConfigured || googleLogin.isPending}
                      onPress={() => googleLogin.mutate()}
                    />
                    <Pressable onPress={() => setMode("recover")} style={({ pressed }) => [styles.linkButton, pressed && styles.pressed]}>
                      <Text style={styles.linkText}>Esqueci minha senha</Text>
                    </Pressable>
                  </>
                ) : (
                  <Pressable onPress={() => setMode("login")} style={({ pressed }) => [styles.linkButton, pressed && styles.pressed]}>
                    <Text style={styles.linkText}>Voltar para login</Text>
                  </Pressable>
                )}

                {!AUTH_REQUIRED ? (
                  <Pressable
                    onPress={() => (router.canGoBack() ? router.back() : router.replace("/"))}
                    style={({ pressed }) => [styles.skipLink, pressed && styles.pressed]}
                  >
                    <Text style={styles.skipText}>Voltar sem entrar</Text>
                  </Pressable>
                ) : null}
              </View>
            </Pressable>
          </ScrollView>
        </KeyboardAvoidingView>
      </SafeAreaView>
    </LinearGradient>
  );
}

const subtitleByMode = {
  login: "Entre para cuidar da sua padaria.",
  register: "Crie sua conta para comecar.",
  recover: "Receba um link seguro para trocar sua senha."
};

const actionTitleByMode = {
  login: "Entrar",
  register: "Criar conta",
  recover: "Enviar link"
};

const pendingTitleByMode = {
  login: "Entrando...",
  register: "Criando conta...",
  recover: "Enviando..."
};

const iconByMode = {
  login: <LogIn size={18} color="#fff" />,
  register: <UserPlus size={18} color="#fff" />,
  recover: <Mail size={18} color="#fff" />
};

function ModeChip({ label, active, onPress }: { label: string; active: boolean; onPress: () => void }) {
  return (
    <Pressable onPress={onPress} style={[styles.modeChip, active && styles.modeChipActive]}>
      <Text style={[styles.modeChipText, active && styles.modeChipTextActive]}>{label}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  background: {
    flex: 1
  },
  safe: {
    flex: 1
  },
  flex: {
    flex: 1
  },
  scroll: {
    flexGrow: 1,
    justifyContent: "center"
  },
  content: {
    gap: 24,
    padding: 20
  },
  brand: {
    alignItems: "center",
    gap: 4
  },
  logo: {
    height: 96,
    width: 96,
    borderRadius: 24,
    marginBottom: 8
  },
  greeting: {
    color: "rgba(255,255,255,0.9)",
    fontSize: 16,
    fontFamily: fonts.bodyBold
  },
  title: {
    color: "#fff",
    fontSize: 34,
    fontFamily: fonts.display
  },
  subtitle: {
    color: "rgba(255,255,255,0.85)",
    fontSize: 15,
    fontFamily: fonts.body,
    textAlign: "center"
  },
  card: {
    gap: 14,
    borderRadius: radius.xl,
    backgroundColor: colors.surface,
    padding: 20
  },
  modeRow: {
    flexDirection: "row",
    gap: 6,
    borderRadius: radius.pill,
    backgroundColor: colors.surfaceWarm,
    padding: 5
  },
  modeChip: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    minHeight: 42,
    borderRadius: radius.pill
  },
  modeChipActive: {
    backgroundColor: colors.brand,
    ...shadows.brand
  },
  modeChipText: {
    color: colors.muted,
    fontSize: 14,
    fontFamily: fonts.bodyBold
  },
  modeChipTextActive: {
    color: "#fff"
  },
  passwordRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8
  },
  passwordInput: {
    flex: 1
  },
  eyeButton: {
    height: 52,
    width: 52,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: radius.pill,
    backgroundColor: colors.surfaceWarm
  },
  pressed: {
    opacity: 0.8
  },
  linkButton: {
    alignSelf: "center",
    minHeight: 38,
    justifyContent: "center",
    paddingHorizontal: 12
  },
  linkText: {
    color: colors.brandDeep,
    fontSize: 14,
    fontFamily: fonts.bodyBold
  },
  skipLink: {
    alignSelf: "center",
    minHeight: 40,
    justifyContent: "center",
    paddingHorizontal: 12
  },
  skipText: {
    color: colors.muted,
    fontSize: 14,
    fontFamily: fonts.bodyBold
  }
});
