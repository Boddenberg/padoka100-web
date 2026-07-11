import { useSyncExternalStore } from "react";

// Registro em memória das chamadas HTTP feitas pelo app — alimenta o painel de
// Diagnóstico no Perfil. Serve para ver o corpo cru de erros (ex.: o `detail`
// de um 400) sem precisar de ferramenta externa. Nada é persistido em disco.

export interface ApiLogEntry {
  id: number;
  at: number; // epoch ms
  method: string;
  path: string; // caminho + query, sem host
  status: number | null; // null = falha antes da resposta (rede/offline)
  ok: boolean;
  durationMs: number;
  request: string | null; // corpo enviado, já redigido e truncado
  responseChars: number; // tamanho original do corpo recebido, antes do truncamento
  response: string; // corpo recebido (ou mensagem de erro), truncado
}

const MAX_ENTRIES = 40;
const MAX_TEXT = 4000;
export const apiLogEnabled = __DEV__;

let entries: ApiLogEntry[] = [];
let nextId = 1;
const listeners = new Set<() => void>();

function emit() {
  for (const listener of listeners) listener();
}

// Chaves cujo valor nunca deve aparecer no painel (senhas, tokens, api key).
const SENSITIVE = /senha|password|token|secret|authorization|api[-_]?key/i;

function redact(value: unknown, depth = 0): unknown {
  if (value === null || typeof value !== "object") return value;
  if (depth > 5) return "…";
  if (Array.isArray(value)) return value.map((item) => redact(item, depth + 1));
  const out: Record<string, unknown> = {};
  for (const [key, val] of Object.entries(value as Record<string, unknown>)) {
    out[key] = SENSITIVE.test(key) ? "•••" : redact(val, depth + 1);
  }
  return out;
}

function toText(value: unknown): string {
  if (value === undefined) return "";
  if (typeof value === "string") return value;
  try {
    return JSON.stringify(redact(value), null, 2);
  } catch {
    return String(value);
  }
}

function truncate(text: string): string {
  if (text.length <= MAX_TEXT) return text;
  return `${text.slice(0, MAX_TEXT)}\n… (+${text.length - MAX_TEXT} caracteres)`;
}

export interface RecordApiCallInput {
  method: string;
  path: string;
  status: number | null;
  ok: boolean;
  durationMs: number;
  requestBody?: unknown;
  responseChars?: number;
  response: unknown;
}

export function recordApiCall(input: RecordApiCallInput) {
  if (!apiLogEnabled) return;

  const response = truncate(toText(input.response));
  const entry: ApiLogEntry = {
    id: nextId++,
    at: Date.now(),
    method: input.method,
    path: input.path,
    status: input.status,
    ok: input.ok,
    durationMs: input.durationMs,
    request: input.requestBody === undefined ? null : truncate(toText(input.requestBody)),
    responseChars: input.responseChars ?? response.length,
    response
  };
  entries = [entry, ...entries].slice(0, MAX_ENTRIES);
  emit();
}

export function clearApiLog() {
  entries = [];
  emit();
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

// `entries` só troca de referência em record/clear, então o snapshot é estável
// entre renders — seguro para useSyncExternalStore.
export function useApiLog(): ApiLogEntry[] {
  return useSyncExternalStore(
    subscribe,
    () => entries,
    () => entries
  );
}
