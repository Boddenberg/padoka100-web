import AsyncStorage from "@react-native-async-storage/async-storage";

// Marca, por usuário, se o passeio guiado (coach marks) da tela de Venda já foi
// visto. Guardar local basta para um tutorial: se a pessoa reinstalar, ela vê de
// novo — o que é aceitável (e até bom) para uma boas-vindas.
// A versão no nome da chave (v1) permite reexibir o tour se um dia mudarmos os
// passos: basta subir para v2.
const KEY_PREFIX = "padoka100:coach-tour-v1";

function key(userId?: string | null) {
  return `${KEY_PREFIX}:${userId || "anon"}`;
}

export async function hasSeenSalesTour(userId?: string | null): Promise<boolean> {
  try {
    return (await AsyncStorage.getItem(key(userId))) === "done";
  } catch {
    // Na dúvida, não incomoda mostrando de novo por causa de um erro de leitura.
    return true;
  }
}

export async function markSalesTourSeen(userId?: string | null): Promise<void> {
  try {
    await AsyncStorage.setItem(key(userId), "done");
  } catch {
    // Best-effort: se não gravar, no pior caso o tour reaparece no próximo login.
  }
}
