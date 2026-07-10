// DEBUG TEMPORÁRIO: registra cada chamada da API com a rota e a quantidade de
// caracteres da resposta, só para inspecionar o tamanho das respostas no
// aparelho. É provisório — para remover, apague este arquivo, o overlay
// (src/components/api-debug-overlay.tsx) e as chamadas a recordApiCall em
// src/lib/api.ts, além do <ApiDebugOverlay /> em app/_layout.tsx.

export interface ApiDebugEntry {
  id: number;
  method: string;
  path: string;
  status: number;
  chars: number;
  at: number;
}

const MAX_ENTRIES = 40;

let entries: ApiDebugEntry[] = [];
let counter = 0;
const listeners = new Set<() => void>();

export function recordApiCall(entry: Omit<ApiDebugEntry, "id" | "at">) {
  counter += 1;
  entries = [{ ...entry, id: counter, at: Date.now() }, ...entries].slice(0, MAX_ENTRIES);
  listeners.forEach((listener) => listener());
}

export function clearApiCalls() {
  entries = [];
  listeners.forEach((listener) => listener());
}

export function getApiCalls() {
  return entries;
}

export function subscribeApiCalls(listener: () => void) {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}
