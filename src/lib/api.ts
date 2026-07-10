import { recordApiCall } from "@/lib/api-debug";
import { getBaseUrl, readApiSettings, type ApiSettings } from "@/lib/settings";
import type {
  ConfirmarCusteioRequest,
  CorrigirRascunhoCusteioRequest,
  CriarSessaoCusteioRequest,
  EntradaTextoCusteioRequest,
  FinalidadeCusteio,
  GerarListaCompraRequest,
  ListaCompra,
  SessaoCusteio
} from "@/types/custeio";
import type {
  AnaliseEspecificaRequest,
  AnalisePadraoRequest,
  AtualizarPerfilRequest,
  CorrigirDiaFechadoRequest,
  CriarDiaDeVendaRequest,
  CriarItemProducaoRequest,
  DiaDeVenda,
  IniciarHojeRequest,
  ProdutoDaVenda,
  RegistrarRequest,
  RespostaIniciarHoje,
  TrocarSenhaRequest,
  EventoLinhaDoTempo,
  HealthStatus,
  LocalVenda,
  LoginRequest,
  Midia,
  Notificacao,
  Produto,
  RegistrarVendaRequest,
  RespostaLogin,
  RespostaAnaliseIA,
  RespostaConfirmarComando,
  RespostaInterpretarVenda,
  RespostaTranscreverAudio,
  ResumoDoDia,
  ResumoDoPeriodo,
  ResumoPeriodoLeve,
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

// Lê o corpo uma única vez como texto para medir a quantidade de caracteres da
// resposta (debug provisório) e ainda assim entregar o JSON/texto já parseado.
async function parseResponse(response: Response): Promise<{ value: unknown; chars: number }> {
  if (response.status === 204) return { value: null, chars: 0 };

  const contentType = response.headers.get("content-type") || "";
  const text = await response.text();
  const chars = text.length;

  if (contentType.includes("application/json")) {
    return { value: text ? JSON.parse(text) : null, chars };
  }
  return { value: text, chars };
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

  const { value: payload, chars } = await parseResponse(response);

  // DEBUG provisório: rota + tamanho da resposta no overlay (ver api-debug.ts).
  recordApiCall({ method, path, status: response.status, chars });

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

// Entrada de áudio/imagem do custeio assistido (multipart em /entradas/arquivo).
// `finalidade` segrega a etapa: foto da receita vs. foto da nota/preços.
export function createCusteioFileForm(
  file: NativeFile,
  tipo: "audio" | "imagem",
  options?: { contexto?: string | null; finalidade?: FinalidadeCusteio }
) {
  const form = new FormData();
  form.append("file", file as unknown as Blob);
  form.append("tipo", tipo);
  form.append("finalidade", options?.finalidade || "auto");
  if (options?.contexto) form.append("contexto", options.contexto);
  if (tipo === "audio") form.append("permitir_fallback", "true");
  return form;
}

export const api = {
  health: (settings?: ApiSettings) => apiRequest<HealthStatus>("/health", { settings }),
  // Autenticação e perfil. O primeiro usuário registrado vira "dono".
  auth: {
    register: (body: RegistrarRequest) => apiRequest<RespostaLogin>("/api/v1/auth/registrar", { method: "POST", body }),
    login: (body: LoginRequest) => apiRequest<RespostaLogin>("/api/v1/auth/login", { method: "POST", body }),
    logout: () => apiRequest<null>("/api/v1/auth/logout", { method: "POST", body: {} }),
    me: () => apiRequest<UsuarioPerfil>("/api/v1/perfil/me"),
    updateProfile: (body: AtualizarPerfilRequest) =>
      apiRequest<UsuarioPerfil>("/api/v1/perfil/me", { method: "PATCH", body }),
    uploadPhoto: (formData: FormData) =>
      apiRequest<UsuarioPerfil>("/api/v1/perfil/me/foto", { method: "POST", formData }),
    changePassword: (body: TrocarSenhaRequest) =>
      apiRequest<null>("/api/v1/auth/trocar-senha", { method: "POST", body })
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
      }),
    // Rota agregada leve só para o 1º card da tela Resumo (faturamento + comparação).
    // Tolera 404: enquanto o backend não publica /periodo/resumo, a tela cai no
    // `period` pesado sem quebrar (ver SummaryScreen).
    periodResumo: (dataInicio: string, dataFim: string, comparar = true) =>
      apiRequest<ResumoPeriodoLeve | null>("/api/v1/relatorios/periodo/resumo", {
        query: { data_inicio: dataInicio, data_fim: dataFim, comparar },
        allowNotFound: true
      })
  },
  historico: {
    timeline: (query?: { dia_de_venda_id?: string; tipo_entidade?: string; entidade_id?: string; limite?: number }) =>
      apiRequest<EventoLinhaDoTempo[]>("/api/v1/historico/linha-do-tempo", { query: { limite: 100, ...query } })
  },
  // Avisos in-app que o backend publica para os usuários. `list` tolera 404
  // (endpoint pode não existir ainda) para nunca quebrar a tela.
  notificacoes: {
    list: () => apiRequest<unknown>("/api/v1/notificacoes", { query: { limite: 50 }, allowNotFound: true }),
    marcarLida: (id: UUID) =>
      apiRequest<Notificacao | null>(`/api/v1/notificacoes/${id}/lida`, { method: "POST", body: {}, allowNotFound: true })
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
    // Análises do período (exigem Bearer token e papel "dono").
    analyzeDefault: (body: AnalisePadraoRequest) =>
      apiRequest<RespostaAnaliseIA>("/api/v1/ia/analises/padrao", { method: "POST", body }),
    analyzeSpecific: (body: AnaliseEspecificaRequest) =>
      apiRequest<RespostaAnaliseIA>("/api/v1/ia/analises/especifica", { method: "POST", body }),
    structuredData: (dataInicio: string, dataFim: string) =>
      apiRequest<Record<string, unknown>>("/api/v1/ia/dados-estruturados/periodo", {
        query: { data_inicio: dataInicio, data_fim: dataFim }
      })
  },
  // Custos, insumos e receitas (exigem Bearer token e papel "dono").
  custos: {
    // Custeio assistido: sessão guiada por produto. O backend devolve sempre
    // a sessão completa (rascunho, perguntas, pendências, custo simulado).
    assistente: {
      criarSessao: (body: CriarSessaoCusteioRequest) =>
        apiRequest<SessaoCusteio>("/api/v1/custos/assistente/sessoes", { method: "POST", body }),
      obterSessao: (sessaoId: UUID) =>
        apiRequest<SessaoCusteio | null>(`/api/v1/custos/assistente/sessoes/${sessaoId}`, { allowNotFound: true }),
      enviarTexto: (sessaoId: UUID, body: EntradaTextoCusteioRequest) =>
        apiRequest<SessaoCusteio>(`/api/v1/custos/assistente/sessoes/${sessaoId}/entradas/texto`, {
          method: "POST",
          body: { permitir_fallback: true, ...body }
        }),
      enviarFormulario: (sessaoId: UUID, dados: Record<string, unknown>, finalidade: FinalidadeCusteio = "auto") =>
        apiRequest<SessaoCusteio>(`/api/v1/custos/assistente/sessoes/${sessaoId}/entradas/formulario`, {
          method: "POST",
          body: { finalidade, dados }
        }),
      enviarArquivo: (sessaoId: UUID, formData: FormData) =>
        apiRequest<SessaoCusteio>(`/api/v1/custos/assistente/sessoes/${sessaoId}/entradas/arquivo`, {
          method: "POST",
          formData
        }),
      corrigirRascunho: (sessaoId: UUID, body: CorrigirRascunhoCusteioRequest) =>
        apiRequest<SessaoCusteio>(`/api/v1/custos/assistente/sessoes/${sessaoId}/rascunho`, {
          method: "PATCH",
          body
        }),
      confirmar: (sessaoId: UUID, body: ConfirmarCusteioRequest) =>
        apiRequest<SessaoCusteio>(`/api/v1/custos/assistente/sessoes/${sessaoId}/confirmar`, {
          method: "POST",
          body
        }),
      descartar: (sessaoId: UUID) =>
        apiRequest<SessaoCusteio>(`/api/v1/custos/assistente/sessoes/${sessaoId}/descartar`, { method: "POST" })
    },
    // Lista de compras por produção planejada (salvar=false simula; true grava).
    listaCompras: {
      gerar: (body: GerarListaCompraRequest) =>
        apiRequest<ListaCompra>("/api/v1/custos/lista-compras", { method: "POST", body }),
      historico: () =>
        apiRequest<unknown>("/api/v1/custos/listas-compras", { query: { limite: 50 }, allowNotFound: true }),
      obter: (listaId: UUID) =>
        apiRequest<ListaCompra | null>(`/api/v1/custos/listas-compras/${listaId}`, { allowNotFound: true })
    },
    listInsumos: () => apiRequest<Record<string, unknown>[]>("/api/v1/custos/insumos"),
    createInsumo: (body: Record<string, unknown>) => apiRequest("/api/v1/custos/insumos", { method: "POST", body }),
    updateInsumo: (insumoId: UUID, body: Record<string, unknown>) =>
      apiRequest(`/api/v1/custos/insumos/${insumoId}`, { method: "PATCH", body }),
    createReceita: (produtoId: UUID, body: Record<string, unknown>) =>
      apiRequest(`/api/v1/custos/produtos/${produtoId}/receitas`, { method: "POST", body }),
    addCustoAdicional: (produtoId: UUID, body: Record<string, unknown>) =>
      apiRequest(`/api/v1/custos/produtos/${produtoId}/custos-adicionais`, { method: "POST", body }),
    calcular: (produtoId: UUID) => apiRequest<Record<string, unknown>>(`/api/v1/custos/produtos/${produtoId}/calculo`)
  }
};
