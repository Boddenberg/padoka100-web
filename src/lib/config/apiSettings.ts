import { useEffect, useState } from "react";
import type { ApiEnvironment } from "@/types/api";

const SETTINGS_KEY = "padoka100:api-settings";
const SETTINGS_CHANGED_EVENT = "padoka100:api-settings-changed";

export interface ApiSettings {
  environment: ApiEnvironment;
  apiKey: string;
}

export interface RuntimeApiConfig {
  localUrl: string;
  productionUrl: string;
  useProductionProxy: boolean;
  defaultEnvironment: ApiEnvironment;
  envApiKey: string;
}

export const runtimeApiConfig: RuntimeApiConfig = {
  localUrl: stripTrailingSlash(import.meta.env.VITE_API_LOCAL_URL || "http://localhost:8000"),
  productionUrl: stripTrailingSlash(
    import.meta.env.VITE_API_PROD_URL || "https://padoka100-production.up.railway.app"
  ),
  useProductionProxy: import.meta.env.VITE_API_PROD_PROXY !== "false",
  defaultEnvironment: import.meta.env.VITE_DEFAULT_API_ENV === "local" ? "local" : "production",
  envApiKey: import.meta.env.VITE_API_KEY || ""
};

function stripTrailingSlash(value: string) {
  return value.replace(/\/+$/, "");
}

function readStoredSettings(): Partial<ApiSettings> {
  if (typeof window === "undefined") return {};

  try {
    const stored = window.localStorage.getItem(SETTINGS_KEY);
    if (!stored) return {};
    const parsed = JSON.parse(stored) as Partial<ApiSettings>;
    return {
      environment: parsed.environment === "local" ? "local" : parsed.environment === "production" ? "production" : undefined,
      apiKey: typeof parsed.apiKey === "string" ? parsed.apiKey : undefined
    };
  } catch {
    return {};
  }
}

export function getApiSettings(): ApiSettings {
  const stored = readStoredSettings();

  return {
    environment: stored.environment || runtimeApiConfig.defaultEnvironment,
    apiKey: stored.apiKey ?? runtimeApiConfig.envApiKey
  };
}

export function saveApiSettings(settings: ApiSettings) {
  window.localStorage.setItem(
    SETTINGS_KEY,
    JSON.stringify({
      environment: settings.environment,
      apiKey: settings.apiKey
    })
  );
  window.dispatchEvent(new Event(SETTINGS_CHANGED_EVENT));
}

export function getBaseUrl(environment = getApiSettings().environment) {
  if (environment === "local") return runtimeApiConfig.localUrl;
  if (!runtimeApiConfig.useProductionProxy) return runtimeApiConfig.productionUrl;

  return typeof window === "undefined" ? "" : window.location.origin;
}

export function getBackendTargetUrl(environment = getApiSettings().environment) {
  return environment === "local" ? runtimeApiConfig.localUrl : runtimeApiConfig.productionUrl;
}

export function getApiKey() {
  return getApiSettings().apiKey.trim();
}

export function useApiSettings() {
  const [settings, setSettings] = useState<ApiSettings>(() => getApiSettings());

  useEffect(() => {
    const sync = () => setSettings(getApiSettings());

    window.addEventListener(SETTINGS_CHANGED_EVENT, sync);
    window.addEventListener("storage", sync);

    return () => {
      window.removeEventListener(SETTINGS_CHANGED_EVENT, sync);
      window.removeEventListener("storage", sync);
    };
  }, []);

  return {
    settings,
    saveSettings: saveApiSettings,
    baseUrl: getBaseUrl(settings.environment)
  };
}
