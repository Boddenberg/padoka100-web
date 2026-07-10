import { useLocalSearchParams, useRouter } from "expo-router";
import { useEffect, useState } from "react";
import { StyleSheet, Text, View } from "react-native";
import { StateText } from "@/components/ui";
import { loginErrorMessage, useAuth } from "@/contexts/auth";
import { colors, fonts } from "@/lib/theme";

export function AuthCallbackScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{ code?: string }>();
  const { completeAuthCallback } = useAuth();
  const [error, setError] = useState<unknown>(null);

  useEffect(() => {
    const code = typeof params.code === "string" ? params.code : null;
    if (!code) {
      setError(new Error("Link de autenticacao invalido."));
      return;
    }
    completeAuthCallback(code)
      .then(() => router.replace("/"))
      .catch(setError);
  }, [completeAuthCallback, params.code, router]);

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Concluindo acesso...</Text>
      {error ? <StateText tone="error" text={loginErrorMessage(error)} /> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: "center",
    gap: 12,
    backgroundColor: colors.bg,
    padding: 24
  },
  title: {
    color: colors.ink,
    fontSize: 22,
    fontFamily: fonts.display,
    textAlign: "center"
  }
});
