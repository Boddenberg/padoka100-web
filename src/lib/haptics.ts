import * as Haptics from "expo-haptics";
import { Platform } from "react-native";

// Feedback tátil discreto. É só enfeite: nunca pode quebrar um fluxo.
// - No-op no navegador (não há vibração).
// - Protegido contra o módulo nativo ausente: um build OTA antigo (sem
//   expo-haptics linkado) simplesmente não vibra, em vez de lançar erro.
const enabled = Platform.OS === "ios" || Platform.OS === "android";

function safe(run: () => Promise<unknown>) {
  if (!enabled) return;
  try {
    run().catch(() => undefined);
  } catch {
    // Módulo nativo indisponível (build sem expo-haptics) — ignora.
  }
}

export const haptics = {
  // Toque leve em +/− e seleções.
  tap: () => safe(() => Haptics.selectionAsync()),
  // Toque um pouco mais firme (começar a gravar, ações principais).
  light: () => safe(() => Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light)),
  // Confirmação de sucesso (venda registrada, custo aceito).
  success: () => safe(() => Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success)),
  // Aviso de erro.
  error: () => safe(() => Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error))
};
