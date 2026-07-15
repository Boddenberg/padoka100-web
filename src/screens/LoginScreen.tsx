import { LinearGradient } from "expo-linear-gradient";
import { Image } from "expo-image";
import { useRouter } from "expo-router";
import { Eye, EyeOff, LogIn, Mail, UserPlus } from "lucide-react-native";
import { useEffect, useState } from "react";
import { Keyboard, KeyboardAvoidingView, Platform, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useMutation } from "@tanstack/react-query";
import { Button, Field, Input, KeyboardDismissArea, StateText } from "@/components/ui";
import { AUTH_REQUIRED } from "@/constants/auth";
import { loginErrorMessage, useAuth } from "@/contexts/auth";
import { isValidEmail, normalizeEmail } from "@/lib/email";
import { formatBrazilianPhone, isValidBrazilianPhone, PHONE_ERROR } from "@/lib/phone";
import { readLastEmail } from "@/lib/session";
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
  const [confirmSenha, setConfirmSenha] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [phoneError, setPhoneError] = useState<string | null>(null);

  // Adianta a entrada de quem já usou o app: pré-preenche o e-mail do último
  // login (só o e-mail, nunca a senha), sem atrapalhar quem começou a digitar.
  useEffect(() => {
    let active = true;
    readLastEmail().then((saved) => {
      if (active && saved) setEmail((current) => (current.trim() ? current : saved));
    });
    return () => {
      active = false;
    };
  }, []);

  // Com o teclado aberto: a marca (logo/título) some para dar espaço, e a
  // rolagem passa a alinhar ao topo — assim os campos de baixo (senha,
  // confirmar) ficam visíveis em vez de cortados atrás do teclado.
  const [keyboardOpen, setKeyboardOpen] = useState(false);
  useEffect(() => {
    const show = Keyboard.addListener("keyboardDidShow", () => setKeyboardOpen(true));
    const hide = Keyboard.addListener("keyboardDidHide", () => setKeyboardOpen(false));
    return () => {
      show.remove();
      hide.remove();
    };
  }, []);

  // Cadastro só prossegue com as duas senhas iguais; a validação reaparece
  // sozinha se a pessoa mudar a primeira senha depois de confirmar.
  const passwordsMismatch = mode === "register" && confirmSenha.length > 0 && senha !== confirmSenha;

  // E-mail precisa ter uma estrutura mínima (nome@dominio.com). O erro só
  // aparece depois que a pessoa começa a digitar, para não "brigar" com o campo vazio.
  const emailValid = isValidEmail(email);
  const emailInvalid = email.trim().length > 0 && !emailValid;

  const submit = useMutation({
    mutationFn: async () => {
      setSuccessMessage(null);
      // Normaliza (sem espaços, minúsculas) antes de qualquer envio.
      const emailNormalizado = normalizeEmail(email);
      if (mode === "recover") {
        await requestPasswordReset(emailNormalizado);
        return "recover" as const;
      }
      if (mode === "register") {
        const result = await register({ nome, email: emailNormalizado, telefone, senha });
        return result.requiresEmailConfirmation ? ("confirmation" as const) : ("signed-in" as const);
      }
      await signIn(emailNormalizado, senha);
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
        setConfirmSenha("");
        return;
      }
      setSuccessMessage("Se existir uma conta com esse e-mail, enviaremos o link de recuperacao.");
      setMode("login");
      setSenha("");
      setConfirmSenha("");
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
    emailValid &&
    (mode === "recover" || senha.length >= 1) &&
    (mode !== "register" || (nome.trim().length > 0 && confirmSenha.length > 0 && senha === confirmSenha)) &&
    !submit.isPending;

  // Telefone é opcional no cadastro, mas se veio preenchido precisa ser um
  // telefone brasileiro de verdade.
  function handleSubmit() {
    if (!emailValid) return;
    if (mode === "register" && senha !== confirmSenha) return;
    if (mode === "register" && telefone.trim() && !isValidBrazilianPhone(telefone)) {
      setPhoneError(PHONE_ERROR);
      return;
    }
    setPhoneError(null);
    submit.mutate();
  }

  return (
    <LinearGradient colors={gradients.hero} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.background}>
      <SafeAreaView style={styles.safe}>
        {/* Teclado nao cobre os campos: no iOS o KeyboardAvoidingView + insets
            rolam ate o campo focado; no Android a janela e redimensionada
            (softwareKeyboardLayoutMode: "resize"). Com o teclado aberto a
            rolagem alinha ao topo (styles.scrollKeyboard) para nada ser
            cortado, e a marca some para o cartao subir. */}
        <KeyboardAvoidingView style={styles.flex} behavior={Platform.OS === "ios" ? "padding" : undefined}>
          <ScrollView
            contentContainerStyle={[styles.scroll, keyboardOpen && styles.scrollKeyboard]}
            keyboardShouldPersistTaps="handled"
            keyboardDismissMode="interactive"
            showsVerticalScrollIndicator={false}
            automaticallyAdjustKeyboardInsets
          >
            <KeyboardDismissArea style={styles.content}>
              {!keyboardOpen ? (
                <View style={styles.brand}>
                  <Image source={require("../../Logo.png")} style={styles.logo} contentFit="contain" />
                  <Text style={styles.greeting}>{getGreeting()}</Text>
                  <Text style={styles.title}>Padoka 100%</Text>
                  <Text style={styles.subtitle}>{subtitleByMode[mode]}</Text>
                </View>
              ) : null}

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
                      <Input
                        value={telefone}
                        onChangeText={(value) => {
                          setTelefone(formatBrazilianPhone(value));
                          if (phoneError) setPhoneError(null);
                        }}
                        placeholder="(11) 98765-4321"
                        keyboardType="phone-pad"
                        maxLength={16}
                      />
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
                    inputMode="email"
                    textContentType="emailAddress"
                    autoComplete="email"
                    placeholder="seu@email.com"
                  />
                  {emailInvalid ? <StateText tone="error" text="Digite um e-mail válido." /> : null}
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
                        onSubmitEditing={() => canSubmit && handleSubmit()}
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

                {mode === "register" ? (
                  <Field label="Confirmar senha">
                    <View style={styles.passwordRow}>
                      <Input
                        value={confirmSenha}
                        onChangeText={setConfirmSenha}
                        secureTextEntry={!showConfirm}
                        placeholder="Digite a senha de novo"
                        style={styles.passwordInput}
                        onSubmitEditing={() => canSubmit && handleSubmit()}
                      />
                      <Pressable
                        onPress={() => setShowConfirm((current) => !current)}
                        style={({ pressed }) => [styles.eyeButton, pressed && styles.pressed]}
                      >
                        {showConfirm ? <EyeOff size={20} color={colors.muted} /> : <Eye size={20} color={colors.muted} />}
                      </Pressable>
                    </View>
                    {passwordsMismatch ? (
                      <StateText tone="error" text="As senhas não são iguais. Confira e tente novamente." />
                    ) : null}
                  </Field>
                ) : null}

                {!supabaseAuthConfigured ? (
                  <StateText tone="error" text="Supabase Auth ainda nao foi configurado para este build." />
                ) : null}
                {successMessage ? <StateText tone="success" text={successMessage} /> : null}
                {phoneError ? <StateText tone="error" text={phoneError} /> : null}
                {submit.error ? <StateText tone="error" text={loginErrorMessage(submit.error)} /> : null}
                {googleLogin.error ? <StateText tone="error" text={loginErrorMessage(googleLogin.error)} /> : null}

                <Button
                  title={submit.isPending ? pendingTitleByMode[mode] : actionTitleByMode[mode]}
                  icon={iconByMode[mode]}
                  disabled={!canSubmit}
                  onPress={handleSubmit}
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
            </KeyboardDismissArea>
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
  // Teclado aberto: alinha ao topo para poder rolar até os campos de baixo
  // (com "center" o conteúdo que transborda fica cortado e sem rolagem).
  scrollKeyboard: {
    justifyContent: "flex-start"
  },
  content: {
    gap: 18,
    padding: 20
  },
  brand: {
    alignItems: "center",
    gap: 2
  },
  logo: {
    height: 72,
    width: 72,
    borderRadius: 20,
    marginBottom: 4
  },
  greeting: {
    color: "rgba(255,255,255,0.9)",
    fontSize: 15,
    fontFamily: fonts.bodyBold
  },
  title: {
    color: "#fff",
    fontSize: 30,
    fontFamily: fonts.display
  },
  subtitle: {
    color: "rgba(255,255,255,0.85)",
    fontSize: 14.5,
    fontFamily: fonts.body,
    textAlign: "center"
  },
  card: {
    gap: 13,
    borderRadius: radius.xl,
    backgroundColor: colors.surface,
    padding: 18
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
