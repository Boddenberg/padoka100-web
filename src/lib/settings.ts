import AsyncStorage from "@react-native-async-storage/async-storage";
import Constants from "expo-constants";
import * as SecureStore from "expo-secure-store";
import { Platform } from "react-native";
import type { ApiEnvironment } from "@/types/api";

const ENV_KEY = "padoka100:api-environment";
const API_KEY = "padoka100.api_key";

// SecureStore não existe no navegador; lá a API key vai para o AsyncStorage.
const secureStorage = {
  get: (key: string) => (Platform.OS === "web" ? AsyncStorage.getItem(key) : SecureStore.getItemAsync(key)),
  set: (key: string, value: string) =>
    Platform.OS === "web" ? AsyncStorage.setItem(key, value) : SecureStore.setItemAsync(key, value),
  remove: (key: string) => (Platform.OS === "web" ? AsyncStorage.removeItem(key) : SecureStore.deleteItemAsync(key))
};

export interface ApiSettings {
  environment: ApiEnvironment;
  apiKey: string;
}

const extra = Constants.expoConfig?.extra as { apiProdUrl?: string; apiLocalUrl?: string; apiKey?: string } | undefined;

export const apiUrls = {
  production: stripTrailingSlash(extra?.apiProdUrl || "https://padoka100-production.up.railway.app"),
  local: stripTrailingSlash(extra?.apiLocalUrl || "http://localhost:8000")
};

const defaultApiKey = process.env.EXPO_PUBLIC_API_KEY || extra?.apiKey || "";

function stripTrailingSlash(value: string) {
  return value.replace(/\/+$/, "");
}

export function getBaseUrl(environment: ApiEnvironment) {
  return environment === "local" ? apiUrls.local : apiUrls.production;
}

// Ambiente em cache síncrono para montar URLs de imagem sem await.
let cachedEnvironment: ApiEnvironment = "production";

export function getCachedBaseUrl() {
  return getBaseUrl(cachedEnvironment);
}

export async function readApiSettings(): Promise<ApiSettings> {
  const [environment, apiKey] = await Promise.all([AsyncStorage.getItem(ENV_KEY), secureStorage.get(API_KEY)]);
  cachedEnvironment = environment === "local" ? "local" : "production";
  return {
    environment: cachedEnvironment,
    apiKey: apiKey || defaultApiKey
  };
}

export async function saveApiSettings(settings: ApiSettings) {
  cachedEnvironment = settings.environment;
  await Promise.all([
    AsyncStorage.setItem(ENV_KEY, settings.environment),
    settings.apiKey.trim() ? secureStorage.set(API_KEY, settings.apiKey.trim()) : secureStorage.remove(API_KEY)
  ]);
}

export function resolveMediaUrl(url: string | null | undefined) {
  if (!url) return null;
  if (/^(https?:|data:|file:|blob:)/i.test(url)) return url;
  return `${getCachedBaseUrl()}/${url.replace(/^\/+/, "")}`;
}
