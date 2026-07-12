import { LinearGradient } from "expo-linear-gradient";
import { Image } from "expo-image";
import { ActivityIndicator, StyleSheet, Text, View } from "react-native";
import { fonts, gradients } from "@/lib/theme";

// Tela de carregamento da abertura: cobre o app enquanto a sessão é conferida,
// para a pessoa nunca ver a tela errada (nem um "sessão expirada" piscando)
// antes de o app decidir para onde levar.
export function AppSplash() {
  return (
    <LinearGradient colors={gradients.hero} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.fill}>
      <View style={styles.center}>
        <Image source={require("../../Logo.png")} style={styles.logo} contentFit="contain" />
        <Text style={styles.title}>Padoka 100%</Text>
        <ActivityIndicator color="#fff" style={styles.spinner} />
      </View>
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  fill: {
    ...StyleSheet.absoluteFillObject,
    alignItems: "center",
    justifyContent: "center"
  },
  center: {
    alignItems: "center",
    gap: 6
  },
  logo: {
    height: 84,
    width: 84,
    borderRadius: 22,
    marginBottom: 6
  },
  title: {
    color: "#fff",
    fontSize: 26,
    fontFamily: fonts.display
  },
  spinner: {
    marginTop: 12
  }
});
