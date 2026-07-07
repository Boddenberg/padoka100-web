import AsyncStorage from "@react-native-async-storage/async-storage";
import Constants from "expo-constants";
import * as SecureStore from "expo-secure-store";
import type { ApiEnvironment } from "@/types/api";

const ENV_KEY = "padoka100:api-environment";
const API_KEY = "padoka100:api-key";

export interface ApiSettings {
  environment: ApiEnvironment;
  apiKey: string;
}

const extra = Constants.expoConfig?.extra as { apiProdUrl?: string; apiLocalUrl?: string } | undefined;

export const apiUrls = {
  production: stripTrailingSlash(extra?.apiProdUrl || "https://padoka100-production.up.railway.app"),
  local: stripTrailingSlash(extra?.apiLocalUrl || "http://localhost:8000")
};

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
  const [environment, apiKey] = await Promise.all([AsyncStorage.getItem(ENV_KEY), SecureStore.getItemAsync(API_KEY)]);
  cachedEnvironment = environment === "local" ? "local" : "production";
  return {
    environment: cachedEnvironment,
    apiKey: apiKey || ""
  };
}

export async function saveApiSettings(settings: ApiSettings) {
  cachedEnvironment = settings.environment;
  await Promise.all([
    AsyncStorage.setItem(ENV_KEY, settings.environment),
    settings.apiKey.trim() ? SecureStore.setItemAsync(API_KEY, settings.apiKey.trim()) : SecureStore.deleteItemAsync(API_KEY)
  ]);
}

export function resolveMediaUrl(url: string | null | undefined) {
  if (!url) return null;
  if (/^(https?:|data:|file:)/i.test(url)) return url;
  return `${getCachedBaseUrl()}/${url.replace(/^\/+/, "")}`;
}
