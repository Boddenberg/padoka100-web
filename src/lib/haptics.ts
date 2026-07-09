import * as Haptics from "expo-haptics";
import { Platform } from "react-native";

// Feedback tátil discreto. No-op no navegador (não há vibração) e nunca lança:
// haptics é enfeite, não pode quebrar um fluxo.
const enabled = Platform.OS === "ios" || Platform.OS === "android";

export const haptics = {
  // Toque leve em +/− e seleções.
  tap: () => {
    if (enabled) Haptics.selectionAsync().catch(() => undefined);
  },
  // Toque um pouco mais firme (começar a gravar, ações principais).
  light: () => {
    if (enabled) Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => undefined);
  },
  // Confirmação de sucesso (venda registrada, custo aceito).
  success: () => {
    if (enabled) Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => undefined);
  },
  // Aviso de erro.
  error: () => {
    if (enabled) Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error).catch(() => undefined);
  }
};
