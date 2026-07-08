import { getBaseUrl, readApiSettings, type ApiSettings } from "@/lib/settings";
import type {
  AlterarEmailRequest,
  AlterarSenhaRequest,
  AnaliseIARequest,
  CorrigirDiaFechadoRequest,
  CriarDiaDeVendaRequest,
  CriarItemProducaoRequest,
  DiaDeVenda,
  IniciarHojeRequest,
  ProdutoDaVenda,
  RespostaIniciarHoje,
  EventoLinhaDoTempo,
  HealthStatus,
  LocalVenda,
  LoginRequest,
  Midia,
  Produto,
  RegistrarVendaRequest,
  RespostaLogin,
  RespostaAnaliseIA,
  RespostaConfirmarComando,
  RespostaInterpretarVenda,
  RespostaTranscreverAudio,
  ResumoDoDia,
  ResumoDoPeriodo,
  UsuarioPerfil,
  UUID,
  Venda,
  VersaoDePreco
} from "@/types/api";

type QueryParams = Record<string, string | number | boolean | null | undefined>;

interface RequestOptions {
  method?: "GET" | "POST" | "PATCH" | "DELETE";
  body?: unknown;
  formData?: FormData;
  query?: QueryParams;
  signal?: AbortSignal;
  allowNotFound?: boolean;
  settings?: ApiSettings;
}

export interface NativeFile {
  uri: string;
  name: string;
  type: string;
}

// Token de sessão em cache: enviado como Bearer em toda chamada autenticada.
let sessionToken: string | null = null;
let unauthorizedHandler: (() => void) | null = null;

export function setApiToken(token: string | null) {
  sessionToken = token;
}

// Sessão expirada (401): quem cuida do estado de auth se registra aqui.
export function setUnauthorizedHandler(handler: (() => void) | null) {
  unauthorizedHandler = handler;
}

export class ApiError extends Error {
  status: number;
  payload: unknown;

  constructor(message: string, status: number, payload: unknown) {
    super(message);
    this.name = "ApiError";
    this.status = status;
    this.payload = payload;
  }
}

function buildUrl(path: string, query: QueryParams | undefined, settings: ApiSettings) {
  const url = new URL(path, `${getBaseUrl(settings.environment)}/`);

  Object.entries(query || {}).forEach(([key, value]) => {
    if (value !== undefined && value !== null && value !== "") {
      url.searchParams.set(key, String(value));
    }
  });

  return url.toString();
}

async function parseResponse(response: Response) {
  const contentType = response.headers.get("content-type") || "";
  if (response.status === 204) return null;
  if (contentType.includes("application/json")) return response.json();
  return response.text();
}

function extractErrorMessage(payload: unknown, fallback: string) {
  if (!payload || typeof payload !== "object") return fallback;

  if ("detail" in payload) {
    const detail = (payload as { detail?: unknown }).detail;
    if (typeof detail === "string") return detail;
    if (Array.isArray(detail)) {
      return detail
        .map((item) => {
          if (item && typeof item === "object" && "msg" in item) return String((item as { msg: unknown }).msg);
          return String(item);
        })
        .join("; ");
    }
  }

  if ("message" in payload) return String((payload as { message: unknown }).message);
  return fallback;
}

export async function apiRequest<T>(path: string, options: RequestOptions = {}): Promise<T> {
  const method = options.method || (options.body || options.formData ? "POST" : "GET");
  const settings = options.settings || (await readApiSettings());
  const headers = new Headers();

  headers.set("Accept", "application/json");
  if (options.body !== undefined && !options.formData) headers.set("Content-Type", "application/json");
  if (path.startsWith("/api/v1") && settings.apiKey.trim()) headers.set("X-API-Key", settings.apiKey.trim());
  if (path.startsWith("/api/v1") && sessionToken) headers.set("Authorization", `Bearer ${sessionToken}`);

  const response = await fetch(buildUrl(path, options.query, settings), {
    method,
    headers,
    body: options.formData || (options.body !== undefined ? JSON.stringify(options.body) : undefined),
    signal: options.signal
  });

  const payload = await parseResponse(response);

  if (!response.ok) {
    if (response.status === 404 && options.allowNotFound) return null as T;
    if (response.status === 401 && sessionToken) unauthorizedHandler?.();
    throw new ApiError(extractErrorMessage(payload, `Erro HTTP ${response.status}`), response.status, payload);
  }

  return payload as T;
}

export function createMediaForm(file: NativeFile, options?: { descricao?: string; textoAlternativo?: string }) {
  const form = new FormData();
  form.append("file", file as unknown as Blob);
  if (options?.descricao) form.append("descricao", options.descricao);
  if (options?.textoAlternativo) form.append("texto_alternativo", options.textoAlternativo);
  form.append("definir_como_principal", "true");
  return form;
}

export function createAudioForm(file: NativeFile, diaDeVendaId?: UUID | null) {
  const form = new FormData();
  form.append("file", file as unknown as Blob);
  if (diaDeVendaId) form.append("dia_de_venda_id", diaDeVendaId);
  form.append("interpretar", "true");
  return form;
}

export const api = {
  health: (settings?: ApiSettings) => apiRequest<HealthStatus>("/health", { settings }),
  // Autenticação. Contrato definido pelo app; o backend ainda precisa
  // implementar estes endpoints.
  auth: {
    login: (body: LoginRequest) => apiRequest<RespostaLogin>("/api/v1/auth/login", { method: "POST", body }),
    logout: () => apiRequest<null>("/api/v1/auth/logout", { method: "POST", body: {} }),
    me: () => apiRequest<UsuarioPerfil>("/api/v1/auth/me"),
    changePassword: (body: AlterarSenhaRequest) =>
      apiRequest<null>("/api/v1/auth/alterar-senha", { method: "POST", body }),
    changeEmail: (body: AlterarEmailRequest) =>
      apiRequest<UsuarioPerfil>("/api/v1/auth/alterar-email", { method: "POST", body })
  },
  produtos: {
    list: (somenteAtivos = true) =>
      apiRequest<Produto[]>("/api/v1/produtos", { query: { somente_ativos: somenteAtivos } }),
    create: (body: Record<string, unknown>) => apiRequest<Produto>("/api/v1/produtos", { method: "POST", body }),
    update: (produtoId: UUID, body: Record<string, unknown>) =>
      apiRequest<Produto>(`/api/v1/produtos/${produtoId}`, { method: "PATCH", body }),
    prices: (produtoId: UUID) => apiRequest<VersaoDePreco[]>(`/api/v1/produtos/${produtoId}/precos`),
    createPrice: (produtoId: UUID, body: Record<string, unknown>) =>
      apiRequest<VersaoDePreco>(`/api/v1/produtos/${produtoId}/precos`, { method: "POST", body }),
    uploadMedia: (produtoId: UUID, formData: FormData) =>
      apiRequest<Midia>(`/api/v1/produtos/${produtoId}/midia`, { method: "POST", formData })
  },
  locais: {
    list: (somenteAtivos = true) =>
      apiRequest<LocalVenda[]>("/api/v1/locais", { query: { somente_ativos: somenteAtivos } }),
    create: (body: Record<string, unknown>) => apiRequest<LocalVenda>("/api/v1/locais", { method: "POST", body }),
    update: (localId: UUID, body: Record<string, unknown>) =>
      apiRequest<LocalVenda>(`/api/v1/locais/${localId}`, { method: "PATCH", body }),
    uploadMedia: (localId: UUID, formData: FormData) =>
      apiRequest<Midia>(`/api/v1/midia/local/${localId}`, { method: "POST", formData })
  },
  dias: {
    list: (query?: { data_inicio?: string; data_fim?: string; situacao?: string }) =>
      apiRequest<DiaDeVenda[]>("/api/v1/dias-de-venda", { query }),
    current: () => apiRequest<DiaDeVenda | null>("/api/v1/dias-de-venda/atual", { allowNotFound: true }),
    create: (body: CriarDiaDeVendaRequest) => apiRequest<DiaDeVenda>("/api/v1/dias-de-venda", { method: "POST", body }),
    saveProductionItem: (diaId: UUID, body: CriarItemProducaoRequest) =>
      apiRequest(`/api/v1/dias-de-venda/${diaId}/itens-producao`, { method: "POST", body }),
    close: (diaId: UUID, observacoes?: string | null) =>
      apiRequest<DiaDeVenda>(`/api/v1/dias-de-venda/${diaId}/fechar`, {
        method: "POST",
        body: { observacoes: observacoes || null }
      }),
    // Início do dia com virada automática: idempotente; pode devolver
    // acao "decidir_sobras" para o usuário escolher o que aproveitar.
    startToday: (body: IniciarHojeRequest) =>
      apiRequest<RespostaIniciarHoje>("/api/v1/dias-de-venda/iniciar-hoje", { method: "POST", body }),
    // Correção retroativa de dia fechado, preservando o antes/depois.
    corrections: (diaId: UUID, body: CorrigirDiaFechadoRequest) =>
      apiRequest<Record<string, unknown>>(`/api/v1/dias-de-venda/${diaId}/correcoes`, { method: "POST", body })
  },
  vendas: {
    create: (body: RegistrarVendaRequest) => apiRequest<Venda>("/api/v1/vendas", { method: "POST", body }),
    listByDay: (diaId: UUID) => apiRequest<Venda[]>(`/api/v1/vendas/por-dia/${diaId}`),
    cancel: (vendaId: UUID, motivo?: string | null) =>
      apiRequest<Venda>(`/api/v1/vendas/${vendaId}/cancelar`, { method: "POST", body: { motivo: motivo || null } })
  },
  relatorios: {
    day: (diaId: UUID) => apiRequest<ResumoDoDia>(`/api/v1/relatorios/dias/${diaId}/resumo`),
    dayByDate: (date: string) => apiRequest<ResumoDoDia>(`/api/v1/relatorios/dias/por-data/${date}/resumo`),
    // Produtos que participam do dia (esgotados continuam na lista).
    dayProducts: (diaId: UUID) => apiRequest<ProdutoDaVenda[]>(`/api/v1/relatorios/dias/${diaId}/produtos-venda`),
    period: (dataInicio: string, dataFim: string, produtoId?: UUID) =>
      apiRequest<ResumoDoPeriodo>("/api/v1/relatorios/periodo", {
        query: { data_inicio: dataInicio, data_fim: dataFim, produto_id: produtoId }
      })
  },
  historico: {
    timeline: (query?: { dia_de_venda_id?: string; tipo_entidade?: string; entidade_id?: string; limite?: number }) =>
      apiRequest<EventoLinhaDoTempo[]>("/api/v1/historico/linha-do-tempo", { query: { limite: 100, ...query } })
  },
  ia: {
    // Endpoints genéricos: interpretam qualquer comando (venda, abrir dia com
    // produção etc.), não só vendas.
    interpretCommand: (body: { texto: string; dia_de_venda_id?: UUID | null; permitir_fallback?: boolean }) =>
      apiRequest<RespostaInterpretarVenda>("/api/v1/ia/interpretar-comando", { method: "POST", body }),
    transcribeAudio: (formData: FormData) =>
      apiRequest<RespostaTranscreverAudio>("/api/v1/ia/transcrever-audio", { method: "POST", formData }),
    confirmCommand: (interacaoId: UUID) =>
      apiRequest<RespostaConfirmarComando>(`/api/v1/ia/interacoes/${interacaoId}/confirmar`, { method: "POST" }),
    // Análise do período com IA. Contrato definido pelo app;
    // o backend ainda precisa implementar este endpoint.
    analyzePeriod: (body: AnaliseIARequest) =>
      apiRequest<RespostaAnaliseIA>("/api/v1/ia/analises", { method: "POST", body })
  }
};
