import { LinearGradient } from "expo-linear-gradient";
import { Image } from "expo-image";
import { useRouter } from "expo-router";
import { Eye, EyeOff, LogIn } from "lucide-react-native";
import { useState } from "react";
import { Keyboard, KeyboardAvoidingView, Platform, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useMutation } from "@tanstack/react-query";
import { Button, Field, Input, StateText } from "@/components/ui";
import { AUTH_REQUIRED } from "@/constants/auth";
import { loginErrorMessage, useAuth } from "@/contexts/auth";
import { colors, fonts, gradients, radius, shadows } from "@/lib/theme";
import { getGreeting } from "@/utils/greeting";

export function LoginScreen() {
  const router = useRouter();
  const { signIn } = useAuth();
  const [usuario, setUsuario] = useState("");
  const [senha, setSenha] = useState("");
  const [showPassword, setShowPassword] = useState(false);

  const login = useMutation({
    mutationFn: () => signIn(usuario, senha),
    onSuccess: () => {
      router.replace("/");
    }
  });

  const canSubmit = usuario.trim().length > 0 && senha.length > 0 && !login.isPending;

  return (
    <LinearGradient colors={gradients.hero} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.background}>
      <SafeAreaView style={styles.safe}>
        <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : undefined} style={styles.flex}>
          <ScrollView
            contentContainerStyle={styles.scroll}
            keyboardShouldPersistTaps="handled"
            showsVerticalScrollIndicator={false}
          >
            <Pressable style={styles.content} onPress={Keyboard.dismiss} accessible={false}>
              <View style={styles.brand}>
                <Image source={require("../../Logo.png")} style={styles.logo} contentFit="contain" />
                <Text style={styles.greeting}>{getGreeting()}</Text>
                <Text style={styles.title}>Padoka 100</Text>
                <Text style={styles.subtitle}>Entre para cuidar da sua padaria.</Text>
              </View>

              <View style={[styles.card, shadows.floating]}>
                <Field label="Usuário ou e-mail">
                  <Input
                    value={usuario}
                    onChangeText={setUsuario}
                    autoCapitalize="none"
                    autoCorrect={false}
                    keyboardType="email-address"
                    placeholder="Ex: maria ou maria@email.com"
                  />
                </Field>
                <Field label="Senha">
                  <View style={styles.passwordRow}>
                    <Input
                      value={senha}
                      onChangeText={setSenha}
                      secureTextEntry={!showPassword}
                      placeholder="Sua senha"
                      style={styles.passwordInput}
                      onSubmitEditing={() => canSubmit && login.mutate()}
                    />
                    <Pressable
                      onPress={() => setShowPassword((current) => !current)}
                      style={({ pressed }) => [styles.eyeButton, pressed && styles.pressed]}
                    >
                      {showPassword ? <EyeOff size={20} color={colors.muted} /> : <Eye size={20} color={colors.muted} />}
                    </Pressable>
                  </View>
                </Field>

                {login.error ? <StateText tone="error" text={loginErrorMessage(login.error)} /> : null}

                <Button
                  title={login.isPending ? "Entrando..." : "Entrar"}
                  icon={<LogIn size={18} color="#fff" />}
                  disabled={!canSubmit}
                  onPress={() => login.mutate()}
                />

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
    fontFamily: fonts.display,
    letterSpacing: -0.6
  },
  subtitle: {
    color: "rgba(255,255,255,0.85)",
    fontSize: 15,
    fontFamily: fonts.body
  },
  card: {
    gap: 14,
    borderRadius: radius.xl,
    backgroundColor: colors.surface,
    padding: 20
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
