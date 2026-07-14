export type UUID = string;
export type DecimalString = string;
export type ApiEnvironment = "local" | "production";

export interface HealthStatus {
  status?: string;
  app?: string;
  environment?: string;
  supabase_configured?: boolean;
  openai_text_configured?: boolean;
  openai_audio_configured?: boolean;
  api_key_configured?: boolean;
  [key: string]: unknown;
}

// Origem do custo/preço gravado. O assistente marca "ia"; edição na mão, "manual".
// União tolerante (como os outros contratos) pra o backend poder ampliar depois.
export type OrigemPreco = "ia" | "manual" | string;

export interface VersaoDePreco {
  id: UUID;
  produto_id: UUID;
  preco_venda: DecimalString;
  preco_custo: DecimalString;
  moeda: string;
  vigente_desde: string;
  vigente_ate?: string | null;
  motivo?: string | null;
  origem?: OrigemPreco | null;
  criado_em: string;
}

export interface Produto {
  id: UUID;
  nome: string;
  descricao?: string | null;
  descricao_visual?: string | null;
  url_imagem_principal?: string | null;
  cor_botao?: string | null;
  ordem_exibicao?: number;
  slug?: string | null;
  situacao: string;
  preco_atual?: VersaoDePreco | null;
  criado_em: string;
  atualizado_em: string;
}

export interface LocalVenda {
  id: UUID;
  nome: string;
  endereco_texto?: string | null;
  descricao?: string | null;
  url_imagem_principal?: string | null;
  situacao: string;
  criado_em: string;
  atualizado_em: string;
}

export interface ItemProducao {
  id: UUID;
  dia_de_venda_id: UUID;
  produto_id: UUID;
  nome_produto_no_momento: string;
  url_imagem_produto_no_momento?: string | null;
  versao_preco_id?: UUID | null;
  preco_venda_unitario_no_momento: DecimalString;
  preco_custo_unitario_no_momento: DecimalString;
  quantidade_produzida: number;
  observacoes?: string | null;
  criado_em: string;
  atualizado_em: string;
}

export interface DiaDeVenda {
  id: UUID;
  data_venda: string;
  local_id?: UUID | null;
  nome_local_no_momento?: string | null;
  observacoes?: string | null;
  situacao: "aberto" | "fechado" | string;
  aberto_em: string;
  fechado_em?: string | null;
  criado_em: string;
  atualizado_em: string;
  itens_producao?: ItemProducao[];
}

export interface ItemVendido {
  id: UUID;
  venda_id: UUID;
  dia_de_venda_id: UUID;
  produto_id: UUID;
  nome_produto_no_momento: string;
  url_imagem_produto_no_momento?: string | null;
  versao_preco_id?: UUID | null;
  preco_venda_unitario_no_momento: DecimalString;
  preco_custo_unitario_no_momento: DecimalString;
  quantidade: number;
  valor_total_venda: DecimalString;
  valor_total_custo: DecimalString;
  criado_em: string;
}

export interface Venda {
  id: UUID;
  dia_de_venda_id: UUID;
  tipo_entrada: "manual" | "audio" | "ia" | string;
  interacao_ia_id?: UUID | null;
  texto_original?: string | null;
  url_audio?: string | null;
  observacoes?: string | null;
  situacao: string;
  ocorrido_em: string;
  cancelado_em?: string | null;
  motivo_cancelamento?: string | null;
  criado_em: string;
  atualizado_em: string;
  itens?: ItemVendido[];
}

export interface ResumoProdutoNoDia {
  produto_id: UUID;
  nome_produto: string;
  url_imagem_produto?: string | null;
  quantidade_produzida?: number;
  quantidade_sobra_aproveitada?: number;
  quantidade_disponivel?: number;
  quantidade_vendida?: number;
  quantidade_sobra?: number;
  participou_da_venda?: boolean;
  esgotado?: boolean;
  faturamento_bruto?: DecimalString;
  custo_estimado?: DecimalString;
  lucro_estimado?: DecimalString;
}

export interface ResumoDoDia {
  dia_de_venda_id: UUID;
  data_venda: string;
  nome_local?: string | null;
  situacao: string;
  total_produzido?: number;
  total_sobra_aproveitada?: number;
  total_disponivel?: number;
  total_vendido?: number;
  itens_vendidos?: number;
  total_sobra?: number;
  faturamento_bruto?: DecimalString;
  faturamento_total?: DecimalString;
  custo_estimado?: DecimalString;
  lucro_estimado?: DecimalString;
  produtos?: ResumoProdutoNoDia[];
}

export interface ResumoDoPeriodo {
  data_inicio: string;
  data_fim: string;
  total_produzido?: number;
  total_vendido?: number;
  total_sobra?: number;
  faturamento_bruto?: DecimalString;
  custo_estimado?: DecimalString;
  lucro_estimado?: DecimalString;
  dias?: ResumoDoDia[];
}

// Versão enxuta do resumo do período: só o que o 1º card da tela Resumo precisa,
// servida por uma rota agregada leve. `periodo_anterior` chega com comparar=true.
// Valores podem vir número ou string decimal — os formatadores aceitam os dois.
export interface ResumoPeriodoLeve {
  data_inicio: string;
  data_fim: string;
  faturamento_bruto?: DecimalString | number;
  lucro_estimado?: DecimalString | number;
  total_vendido?: number;
  total_sobra?: number;
  periodo_anterior?: { faturamento_bruto?: DecimalString | number } | null;
}

export interface EventoLinhaDoTempo {
  id: UUID;
  dia_de_venda_id?: UUID | null;
  tipo_entidade: string;
  entidade_id?: UUID | null;
  tipo_evento: string;
  titulo: string;
  detalhes: Record<string, unknown>;
  criado_em: string;
  // Campos novos da linha do tempo (os antigos seguem por compatibilidade).
  tipo?: string;
  dataHora?: string;
  dados?: Record<string, unknown>;
}

// Avisos in-app publicados pelo backend (admin → todos os usuários).
// A forma exata pode variar; tratamos de modo tolerante.
export interface NotificacaoMidia {
  tipo?: string;
  url?: string | null;
  descricao?: string | null;
  [key: string]: unknown;
}

export interface Notificacao {
  id: UUID;
  titulo?: string | null;
  corpo?: string | null;
  prioridade?: string | null;
  publico?: string | null;
  midias?: NotificacaoMidia[] | null;
  lida?: boolean;
  lida_em?: string | null;
  // `nova` = ainda não lida (destaque visual); `expira_em` some sozinha depois.
  nova?: boolean;
  expira_em?: string | null;
  criado_em?: string | null;
  publicado_em?: string | null;
  [key: string]: unknown;
}

// Contadores que o feed devolve para o sino e as seções da UI.
export interface ResumoNotificacoes {
  total?: number;
  nao_lidas?: number;
  lidas?: number;
  novas?: number;
  retornadas?: number;
}

// Resposta principal do sino: GET /notificacoes/feed. `itens` já vem ordenado
// (não lidas antes das lidas; alta > normal > baixa; mais recentes primeiro).
export interface FeedNotificacoes {
  itens: Notificacao[];
  resumo?: ResumoNotificacoes;
  limite?: number;
  tem_mais?: boolean;
  persistida?: boolean;
}

// Resposta das ações por clique (lida / não-lida / ocultar).
export interface AcaoNotificacaoResposta {
  notificacao_id: UUID;
  lida?: boolean;
  lida_em?: string | null;
  oculta?: boolean;
  oculta_em?: string | null;
  persistida?: boolean;
}

export interface Midia {
  id: UUID;
  tipo_entidade: string;
  entidade_id: UUID;
  bucket: string;
  caminho_arquivo: string;
  url_publica?: string | null;
  tipo_conteudo?: string | null;
  descricao?: string | null;
  texto_alternativo?: string | null;
  criado_em: string;
}

export interface ItemVendaInterpretado {
  produto_id: UUID;
  nome_produto: string;
  quantidade: number;
  confianca: number;
}

export interface RespostaInterpretarVenda {
  interacao_ia_id: UUID;
  acao: string;
  precisa_confirmacao?: boolean;
  mensagem_assistente: string;
  mensagem_confirmacao?: string | null;
  itens?: ItemVendaInterpretado[];
  itens_nao_identificados?: string[];
  dados_confirmacao: Record<string, unknown>;
  modelo_usado: string;
}

// Rastreio admin: áudios/fotos que os clientes enviaram para a IA
// (GET /ia/midias-recebidas, protegido por admin.gerenciar).
export interface MidiaRecebidaIA {
  id: UUID;
  usuario_id?: UUID | null;
  usuario_nome_cadastrado?: string | null;
  data?: string | null;
  item: "audio" | "foto" | string;
  interacao_ia_id?: UUID | null;
  midia_id?: UUID | null;
  nome_arquivo?: string | null;
  url_publica?: string | null;
  tipo_conteudo?: string | null;
}

export interface RespostaConfirmarComando {
  interacao_ia_id: UUID;
  acao: string;
  sucesso?: boolean;
  mensagem_assistente?: string | null;
  resultado?: Record<string, unknown>;
}

export interface RespostaTranscreverAudio {
  transcricao: string;
  url_audio?: string | null;
  interpretacao?: RespostaInterpretarVenda | null;
}

export interface RespostaConfirmarVenda {
  interacao_ia_id: UUID;
  venda: Venda;
}

export interface CriarItemProducaoRequest {
  produto_id: UUID;
  quantidade_produzida: number;
  observacoes?: string | null;
}

export interface CriarDiaDeVendaRequest {
  data_venda: string;
  local_id?: UUID | null;
  nome_local?: string | null;
  observacoes?: string | null;
  itens_producao?: CriarItemProducaoRequest[];
}

// Autenticação e perfil (/auth/* e /perfil/me).
export type PapelUsuario = "usuario" | "administrador" | "dono";
export type PlanoUsuario = "basico" | "analitico" | "ia" | "admin";

export interface UsuarioPerfil {
  id: UUID;
  email: string;
  nome?: string | null;
  telefone?: string | null;
  foto_url?: string | null;
  data_nascimento?: string | null;
  papel?: PapelUsuario | string;
  plano?: PlanoUsuario | string;
  capacidades?: string[];
}

export interface LoginRequest {
  email: string;
  senha: string;
}

export interface RegistrarRequest {
  email: string;
  senha: string;
  nome: string;
  telefone?: string | null;
}

// O login devolve o token; o usuário é buscado depois em /perfil/me.
export interface RespostaLogin {
  access_token: string;
  token_type?: string;
  usuario?: UsuarioPerfil;
}

export interface TrocarSenhaRequest {
  senha_atual: string;
  nova_senha: string;
}

export interface AtualizarPerfilRequest {
  nome?: string | null;
  telefone?: string | null;
  foto_url?: string | null;
  data_nascimento?: string | null;
  email?: string | null;
}

// Análise de vendas com IA (/ia/analises/padrao e /especifica, papel dono).
export interface AnalisePadraoRequest {
  data_inicio: string;
  data_fim: string;
  contexto_usuario?: string | null;
}

export interface AnaliseEspecificaRequest {
  data_inicio: string;
  data_fim: string;
  pergunta: string;
}

// A forma exata da resposta não está no guia; tratamos de forma flexível.
export interface RespostaAnaliseIA {
  resumo?: string;
  analise?: string;
  texto?: string;
  resposta?: string;
  mensagem?: string;
  principais_achados?: string[];
  mais_venderam?: string[];
  mais_sobraram?: string[];
  sugestoes?: string[];
  pontos_atencao?: string[];
  modelo_usado?: string;
  [key: string]: unknown;
}

// Correção retroativa de um dia fechado (POST /dias-de-venda/{id}/correcoes).
export interface CorrecaoProducaoRequest {
  produto_id: UUID;
  quantidade_produzida: number;
}

export interface CorrecaoItemVendaRequest {
  item_venda_id: UUID;
  quantidade: number;
}

export interface CorrecaoVendaAdicionadaRequest {
  itens: { produto_id: UUID; quantidade: number }[];
  observacoes?: string | null;
}

export interface CorrigirDiaFechadoRequest {
  usuario_id: string;
  motivo?: string | null;
  producoes?: CorrecaoProducaoRequest[];
  itens_venda?: CorrecaoItemVendaRequest[];
  vendas_adicionadas?: CorrecaoVendaAdicionadaRequest[];
  vendas_canceladas?: { venda_id: UUID; motivo?: string | null }[];
}

// Início do dia com virada automática (POST /dias-de-venda/iniciar-hoje).
export interface DecisaoSobraRequest {
  produto_id: UUID;
  quantidade_usada_hoje: number;
  quantidade_nao_usada_hoje?: number;
}

export interface IniciarHojeRequest {
  data_venda?: string;
  itens_producao?: CriarItemProducaoRequest[];
  decisoes_sobra?: DecisaoSobraRequest[];
}

export interface SobraPendente {
  produto_id: UUID;
  nome_produto: string;
  quantidade_sobra: number;
  quantidade_sugerida_para_usar: number;
}

export interface RespostaDecidirSobras {
  acao: "decidir_sobras";
  mensagem: string;
  data_venda: string;
  sobras_pendentes: SobraPendente[];
}

// Dia iniciado agora ou já aberto: o dia vem em `dia_de_venda`.
export interface RespostaDiaIniciado {
  acao: "dia_iniciado" | "dia_atual_aberto";
  mensagem?: string | null;
  dia_de_venda: DiaDeVenda;
}

// Toda resposta traz `acao`; o formato "cru" (DiaDeVenda) fica para o fallback
// do endpoint clássico e compatibilidade com backend antigo.
export type RespostaIniciarHoje = DiaDeVenda | RespostaDecidirSobras | RespostaDiaIniciado;

// Produtos que participam do dia (GET /relatorios/dias/{id}/produtos-venda).
export interface ProdutoDaVenda {
  produto_id: UUID;
  nome_produto?: string;
  esgotado?: boolean;
  quantidade_disponivel?: number;
  [key: string]: unknown;
}

export interface RegistrarVendaRequest {
  dia_de_venda_id: UUID;
  itens: {
    produto_id: UUID;
    quantidade: number;
  }[];
  tipo_entrada?: "manual" | "audio" | "ia";
  interacao_ia_id?: UUID | null;
  texto_original?: string | null;
  url_audio?: string | null;
  observacoes?: string | null;
  ocorrido_em?: string | null;
}

// Canal de reports (feedback do usuário): erro, dificuldade, sugestão ou recado,
// com anexos opcionais (print/foto/áudio). A visão do admin traz o remetente.
export type ReportTipo = "erro" | "dificuldade" | "sugestao" | "recado";
export type ReportStatus = "novo" | "lido" | "resolvido";

export interface ReportAnexo {
  id?: UUID | null;
  url: string;
  tipo: "imagem" | "audio" | "video" | "arquivo" | string;
  tipo_conteudo?: string | null;
}

export interface Report {
  id: UUID;
  tipo: ReportTipo | string;
  mensagem?: string | null;
  contexto?: string | null;
  plataforma?: string | null;
  app_versao?: string | null;
  status: ReportStatus | string;
  criado_em: string;
  anexos: ReportAnexo[];
}

export interface ReportAdmin extends Report {
  usuario_id?: UUID | null;
  usuario_nome?: string | null;
  usuario_email?: string | null;
  usuario_foto_url?: string | null;
  atualizado_em?: string | null;
}
