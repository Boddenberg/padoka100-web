import { recordApiCall } from "@/lib/api-log";
import { getBaseUrl, readApiSettings, type ApiSettings } from "@/lib/settings";
import type {
  ConfirmarCusteioRequest,
  CorrigirRascunhoCusteioRequest,
  CriarSessaoCusteioRequest,
  EntradaTextoCusteioRequest,
  FinalidadeCusteio,
  GerarListaCompraRequest,
  ListaCompra,
  ProdutoComReceita,
  SessaoCusteio
} from "@/types/custeio";
import type {
  AcaoNotificacaoResposta,
  AnaliseEspecificaRequest,
  AnalisePadraoRequest,
  AtualizarPerfilRequest,
  CorrigirDiaFechadoRequest,
  CriarDiaDeVendaRequest,
  CriarItemProducaoRequest,
  DiaDeVenda,
  FeedNotificacoes,
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
  MidiaRecebidaIA,
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
  // Interno: marca a rechamada após renovar o token (evita loop de 401).
  isRetry?: boolean;
}

export interface NativeFile {
  uri: string;
  name: string;
  type: string;
}

// Token de sessão em cache: enviado como Bearer em toda chamada autenticada.
let sessionToken: string | null = null;
let unauthorizedHandler: (() => void) | null = null;
// Quem detém a sessão (auth context) registra como renovar o token de acesso.
let tokenRefresher: (() => Promise<string | null>) | null = null;
let refreshInFlight: Promise<string | null> | null = null;

export function setApiToken(token: string | null) {
  sessionToken = token;
}

// Sessão expirada (401): quem cuida do estado de auth se registra aqui.
export function setUnauthorizedHandler(handler: (() => void) | null) {
  unauthorizedHandler = handler;
}

// Renovação do token de acesso (Supabase). O auth context registra a função;
// a API a usa quando um request toma 401, para tentar recuperar antes de deslogar.
export function setTokenRefresher(refresher: (() => Promise<string | null>) | null) {
  tokenRefresher = refresher;
}

// Renova no máximo uma vez por vez, mesmo com várias chamadas tomando 401
// juntas (singleflight). Devolve o novo token, ou null se não deu para renovar.
function refreshSessionToken(): Promise<string | null> {
  if (!tokenRefresher) return Promise.resolve(null);
  if (!refreshInFlight) {
    refreshInFlight = tokenRefresher().finally(() => {
      refreshInFlight = null;
    });
  }
  return refreshInFlight;
}

// Mensagens amigáveis por categoria. Nunca expomos código HTTP, nome de exceção
// nem resposta crua do backend na interface — isso fica só nos logs/Diagnóstico.
export const CONNECTION_ERROR_MESSAGE = "Verifique sua conexão e tente novamente.";
const GENERIC_ERROR_MESSAGE = "Não foi possível concluir a operação agora. Tente novamente.";

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

// Falha antes de ter resposta (offline, DNS, servidor fora, timeout de rede).
// Mensagem já pronta para a tela; o erro cru fica só no log (recordApiCall).
export class NetworkError extends Error {
  constructor() {
    super(CONNECTION_ERROR_MESSAGE);
    this.name = "NetworkError";
  }
}

function messageForStatus(status: number): string {
  if (status === 401) return "Sua sessão expirou. Entre novamente.";
  if (status === 403) return "Você não tem permissão para realizar esta ação.";
  if (status === 404) return "Não encontramos as informações solicitadas.";
  if (status === 408 || status === 504) return CONNECTION_ERROR_MESSAGE;
  return GENERIC_ERROR_MESSAGE; // 5xx e demais
}

// Distingue mensagem "de gente" (regra de negócio em pt-BR) de texto técnico
// (exceção, código HTTP, stack, SQL): só a primeira pode chegar à tela.
function looksHuman(text: string): boolean {
  const value = text.trim();
  if (value.length < 3 || value.length > 160) return false;
  if (/\b[1-5]\d{2}\b/.test(value)) return false; // códigos tipo 401/500
  if (/[<>{}]|https?:\/\//.test(value)) return false; // html/json/urls
  if (
    /(traceback|exception|errno|sqlstate|psycopg|pydantic|stack|internal server|value error|key ?error|type ?error|none type|assert|constraint|foreign key|duplicate key|fetch)/i.test(
      value
    )
  ) {
    return false;
  }
  return true;
}

// Mensagem de regra de negócio limpa vinda do backend (4xx), quando houver.
function backendBusinessMessage(payload: unknown): string | null {
  if (!payload || typeof payload !== "object") return null;
  const candidates: unknown[] = [];
  if ("detail" in payload) {
    const detail = (payload as { detail?: unknown }).detail;
    if (typeof detail === "string") candidates.push(detail);
    else if (detail && typeof detail === "object" && "mensagem" in detail) {
      candidates.push((detail as { mensagem?: unknown }).mensagem);
    }
    // `detail` em lista = validação do Pydantic (técnica, em inglês): nunca usar.
  }
  if ("mensagem" in payload) candidates.push((payload as { mensagem?: unknown }).mensagem);
  if ("message" in payload) candidates.push((payload as { message?: unknown }).message);

  for (const candidate of candidates) {
    if (typeof candidate === "string" && looksHuman(candidate)) return candidate.trim();
  }
  return null;
}

// Mensagem pronta para a tela a partir de qualquer erro. Nunca vaza detalhe
// técnico: use este helper (ou .message de ApiError/NetworkError, já amigáveis).
export function friendlyErrorMessage(error: unknown): string {
  if (error instanceof ApiError || error instanceof NetworkError) return error.message;
  if (error instanceof TypeError) return CONNECTION_ERROR_MESSAGE; // fetch caído
  if (error instanceof Error && looksHuman(error.message)) return error.message;
  return GENERIC_ERROR_MESSAGE;
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

// Só o caminho + query para o log (esconde o host da requisição).
function safePath(url: string, fallback: string) {
  try {
    const parsed = new URL(url);
    return parsed.pathname + parsed.search;
  } catch {
    return fallback;
  }
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

function messageForError(status: number, payload: unknown): string {
  // 401/403/404/timeout/5xx: sempre a mensagem por categoria, porque o texto do
  // backend nesses casos costuma ser técnico. Nos 4xx de regra de negócio,
  // aproveitamos uma mensagem limpa em português quando o backend manda uma.
  if (status === 401 || status === 403 || status === 404 || status === 408 || status === 504 || status >= 500) {
    return messageForStatus(status);
  }
  return backendBusinessMessage(payload) || GENERIC_ERROR_MESSAGE;
}

export async function apiRequest<T>(path: string, options: RequestOptions = {}): Promise<T> {
  const method = options.method || (options.body || options.formData ? "POST" : "GET");
  const settings = options.settings || (await readApiSettings());
  const headers = new Headers();

  headers.set("Accept", "application/json");
  if (options.body !== undefined && !options.formData) headers.set("Content-Type", "application/json");
  // Autenticação em /api/v1: a sessão real do usuário (Bearer do Supabase) tem
  // prioridade. Só caímos no X-API-Key legado quando NÃO há sessão — se os dois
  // forem juntos, o backend segue o caminho da service key e devolve 500 em
  // rotas de usuário como /perfil/me.
  if (path.startsWith("/api/v1")) {
    if (sessionToken) {
      headers.set("Authorization", `Bearer ${sessionToken}`);
    } else if (settings.apiKey.trim()) {
      headers.set("X-API-Key", settings.apiKey.trim());
    }
  }

  const url = buildUrl(path, options.query, settings);
  const displayPath = safePath(url, path);
  // Não logamos o binário do multipart nem os headers (token fica de fora).
  const requestBody = options.formData ? "[multipart/form-data]" : options.body;
  const startedAt = Date.now();

  let response: Response;
  try {
    response = await fetch(url, {
      method,
      headers,
      body: options.formData || (options.body !== undefined ? JSON.stringify(options.body) : undefined),
      signal: options.signal
    });
  } catch (networkError) {
    // Cancelamento (troca de tela / novo fetch): propaga sem virar erro de conexão.
    if (networkError instanceof Error && networkError.name === "AbortError") throw networkError;
    // Falhou antes de ter resposta (offline, DNS, servidor fora): registra o erro
    // cru só no log e mostra uma mensagem de conexão amigável (NetworkError).
    const message = networkError instanceof Error ? networkError.message : String(networkError);
    recordApiCall({
      method,
      path: displayPath,
      status: null,
      ok: false,
      durationMs: Date.now() - startedAt,
      requestBody,
      responseChars: message.length,
      response: message
    });
    throw new NetworkError();
  }

  const { value: payload, chars } = await parseResponse(response);

  recordApiCall({
    method,
    path: displayPath,
    status: response.status,
    ok: response.ok,
    durationMs: Date.now() - startedAt,
    requestBody,
    responseChars: chars,
    response: payload
  });

  if (!response.ok) {
    if (response.status === 404 && options.allowNotFound) return null as T;
    // Sessão possivelmente vencida no meio do uso: tenta renovar o token UMA vez
    // e refazer a chamada, antes de deslogar. É o que evita ficar "preso" numa
    // tela com "sessão expirou" quando o Supabase ainda consegue renovar — a
    // pessoa nem percebe. Só desloga (unauthorizedHandler) se a renovação falhar.
    if (response.status === 401 && sessionToken && !options.isRetry) {
      const renewed = await refreshSessionToken();
      if (renewed) return apiRequest<T>(path, { ...options, isRetry: true });
    }
    if (response.status === 401 && sessionToken) unauthorizedHandler?.();
    throw new ApiError(messageForError(response.status, payload), response.status, payload);
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

// Foto para o agente ler: lousa/folha de produção ou cardápio de produtos.
// Produção precisa do dia; cardápio não. O `contexto` ajuda o modelo.
export function createIaPhotoForm(file: NativeFile, options?: { diaDeVendaId?: UUID | null; contexto?: string | null }) {
  const form = new FormData();
  form.append("file", file as unknown as Blob);
  if (options?.diaDeVendaId) form.append("dia_de_venda_id", options.diaDeVendaId);
  if (options?.contexto) form.append("contexto", options.contexto);
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
    // Dia sem id utilizável (backend já devolveu `id: null`) vira "sem dia
    // aberto": todas as ações do dia dependem do id, e um id inválido acaba
    // interpolado nas URLs (ex.: /relatorios/dias/null/resumo → 422).
    current: async () => {
      const day = await apiRequest<DiaDeVenda | null>("/api/v1/dias-de-venda/atual", { allowNotFound: true });
      return day && typeof day.id === "string" && day.id ? day : null;
    },
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
  // Avisos in-app do backend. `feed` é a rota principal do sino (exige Bearer):
  // devolve itens já ordenados + `resumo` (badge). Todas toleram 404 para nunca
  // quebrar a tela enquanto o backend não publica a rota.
  notificacoes: {
    feed: (params?: { limite?: number; incluirLidas?: boolean }) =>
      apiRequest<FeedNotificacoes | null>("/api/v1/notificacoes/feed", {
        query: { limite: params?.limite ?? 20, incluir_lidas: params?.incluirLidas ?? true },
        allowNotFound: true
      }),
    // Compat: lista simples do front antigo, usada como fallback se `feed` não existir.
    list: () =>
      apiRequest<unknown>("/api/v1/notificacoes", { query: { limite: 50, incluir_lidas: true }, allowNotFound: true }),
    marcarLida: (id: UUID) =>
      apiRequest<AcaoNotificacaoResposta | null>(`/api/v1/notificacoes/${id}/lida`, {
        method: "POST",
        body: {},
        allowNotFound: true
      }),
    marcarNaoLida: (id: UUID) =>
      apiRequest<AcaoNotificacaoResposta | null>(`/api/v1/notificacoes/${id}/nao-lida`, {
        method: "POST",
        body: {},
        allowNotFound: true
      }),
    // "Excluir" para o usuário = ocultar do seu feed (não apaga do banco de todos).
    ocultar: (id: UUID) =>
      apiRequest<AcaoNotificacaoResposta | null>(`/api/v1/notificacoes/${id}/ocultar`, {
        method: "POST",
        body: {},
        allowNotFound: true
      })
  },
  ia: {
    // Endpoints genéricos: interpretam qualquer comando (venda, abrir dia com
    // produção etc.), não só vendas.
    interpretCommand: (body: { texto: string; dia_de_venda_id?: UUID | null; permitir_fallback?: boolean }) =>
      apiRequest<RespostaInterpretarVenda>("/api/v1/ia/interpretar-comando", { method: "POST", body }),
    transcribeAudio: (formData: FormData) =>
      apiRequest<RespostaTranscreverAudio>("/api/v1/ia/transcrever-audio", { method: "POST", formData }),
    // Fotos: lousa/folha de produção do dia e cardápio para cadastrar produtos.
    // Ambas devolvem a mesma interpretação (revisar → confirmar).
    importProductionPhoto: (formData: FormData) =>
      apiRequest<RespostaInterpretarVenda>("/api/v1/ia/producao/importar-foto", { method: "POST", formData }),
    importMenuPhoto: (formData: FormData) =>
      apiRequest<RespostaInterpretarVenda>("/api/v1/ia/produtos/importar-cardapio", { method: "POST", formData }),
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
      }),
    // Rastreio admin (admin.gerenciar): áudios/fotos enviados pelos clientes à IA.
    midiasRecebidas: (params?: { item?: "audio" | "foto"; usuarioId?: UUID; limite?: number }) =>
      apiRequest<MidiaRecebidaIA[] | null>("/api/v1/ia/midias-recebidas", {
        query: { item: params?.item, usuario_id: params?.usuarioId, limite: params?.limite ?? 100 },
        allowNotFound: true
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
      // Custeio salvo de um produto (o confirmado, se houver): deixa o app abrir
      // direto o resultado em qualquer aparelho, sem depender da sessão local.
      sessaoDoProduto: (produtoId: UUID) =>
        apiRequest<SessaoCusteio | null>(`/api/v1/custos/assistente/produtos/${produtoId}/sessao`, { allowNotFound: true }),
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
    // Produtos que já têm receita — para a lista de compras separar disponíveis
    // (com receita) de quem ainda precisa passar pela jornada de custo.
    produtosComReceita: () =>
      apiRequest<ProdutoComReceita[] | null>("/api/v1/custos/produtos-com-receita", { allowNotFound: true }),
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
