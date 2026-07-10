import { useLocalSearchParams, useRouter } from "expo-router";
import { Eye, EyeOff, KeyRound } from "lucide-react-native";
import { useEffect, useState } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { useMutation } from "@tanstack/react-query";
import { Button, Field, Input, Page, StateText } from "@/components/ui";
import { loginErrorMessage, useAuth } from "@/contexts/auth";
import { colors, fonts, radius } from "@/lib/theme";

export function ResetPasswordScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{ code?: string }>();
  const { completeAuthCallback, updatePassword } = useAuth();
  const [senha, setSenha] = useState("");
  const [confirmacao, setConfirmacao] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [callbackError, setCallbackError] = useState<unknown>(null);

  useEffect(() => {
    const code = typeof params.code === "string" ? params.code : null;
    if (!code) return;
    completeAuthCallback(code).catch(setCallbackError);
  }, [completeAuthCallback, params.code]);

  const submit = useMutation({
    mutationFn: async () => {
      if (senha.length < 8) throw new Error("A senha precisa ter pelo menos 8 caracteres.");
      if (senha !== confirmacao) throw new Error("As senhas nao conferem.");
      await updatePassword(senha);
    },
    onSuccess: () => router.replace("/")
  });

  return (
    <Page title="Nova senha" subtitle="Defina uma senha segura para voltar ao app.">
      {callbackError ? <StateText tone="error" text={loginErrorMessage(callbackError)} /> : null}
      <Field label="Nova senha">
        <View style={styles.passwordRow}>
          <Input
            value={senha}
            onChangeText={setSenha}
            secureTextEntry={!showPassword}
            placeholder="Minimo de 8 caracteres"
            style={styles.passwordInput}
          />
          <Pressable onPress={() => setShowPassword((current) => !current)} style={styles.eyeButton}>
            {showPassword ? <EyeOff size={20} color={colors.muted} /> : <Eye size={20} color={colors.muted} />}
          </Pressable>
        </View>
      </Field>
      <Field label="Confirmar senha">
        <Input value={confirmacao} onChangeText={setConfirmacao} secureTextEntry={!showPassword} placeholder="Repita a senha" />
      </Field>
      {submit.error ? <StateText tone="error" text={loginErrorMessage(submit.error)} /> : null}
      <Button
        title={submit.isPending ? "Atualizando..." : "Atualizar senha"}
        icon={<KeyRound size={18} color="#fff" />}
        disabled={submit.isPending}
        onPress={() => submit.mutate()}
      />
      <Text style={styles.hint}>Se o link expirou, solicite outro pela tela de login.</Text>
    </Page>
  );
}

const styles = StyleSheet.create({
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
  hint: {
    color: colors.muted,
    fontSize: 13,
    fontFamily: fonts.body,
    textAlign: "center"
  }
});
