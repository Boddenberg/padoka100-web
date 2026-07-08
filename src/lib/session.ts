import AsyncStorage from "@react-native-async-storage/async-storage";
import * as SecureStore from "expo-secure-store";
import { Platform } from "react-native";
import type { UsuarioPerfil } from "@/types/api";

const TOKEN_KEY = "padoka100.auth_token";
const USER_KEY = "padoka100:auth-user";

// SecureStore não existe no navegador; lá o token vai para o AsyncStorage.
const secureStorage = {
  get: (key: string) => (Platform.OS === "web" ? AsyncStorage.getItem(key) : SecureStore.getItemAsync(key)),
  set: (key: string, value: string) =>
    Platform.OS === "web" ? AsyncStorage.setItem(key, value) : SecureStore.setItemAsync(key, value),
  remove: (key: string) => (Platform.OS === "web" ? AsyncStorage.removeItem(key) : SecureStore.deleteItemAsync(key))
};

export interface StoredSession {
  token: string;
  usuario: UsuarioPerfil;
}

export async function readSession(): Promise<StoredSession | null> {
  const [token, rawUser] = await Promise.all([secureStorage.get(TOKEN_KEY), AsyncStorage.getItem(USER_KEY)]);
  if (!token || !rawUser) return null;
  try {
    return { token, usuario: JSON.parse(rawUser) as UsuarioPerfil };
  } catch {
    return null;
  }
}

export async function saveSession(session: StoredSession) {
  await Promise.all([
    secureStorage.set(TOKEN_KEY, session.token),
    AsyncStorage.setItem(USER_KEY, JSON.stringify(session.usuario))
  ]);
}

export async function clearSession() {
  await Promise.all([secureStorage.remove(TOKEN_KEY), AsyncStorage.removeItem(USER_KEY)]);
}
