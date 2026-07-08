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

export interface VersaoDePreco {
  id: UUID;
  produto_id: UUID;
  preco_venda: DecimalString;
  preco_custo: DecimalString;
  moeda: string;
  vigente_desde: string;
  vigente_ate?: string | null;
  motivo?: string | null;
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
  quantidade_vendida?: number;
  quantidade_sobra?: number;
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
  total_vendido?: number;
  total_sobra?: number;
  faturamento_bruto?: DecimalString;
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

export interface EventoLinhaDoTempo {
  id: UUID;
  dia_de_venda_id?: UUID | null;
  tipo_entidade: string;
  entidade_id?: UUID | null;
  tipo_evento: string;
  titulo: string;
  detalhes: Record<string, unknown>;
  criado_em: string;
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

// Autenticação (backend ainda vai implementar).
export interface UsuarioPerfil {
  id: UUID;
  usuario: string;
  email?: string | null;
  nome?: string | null;
}

export interface LoginRequest {
  usuario: string;
  senha: string;
}

export interface RespostaLogin {
  token: string;
  usuario: UsuarioPerfil;
}

export interface AlterarSenhaRequest {
  senha_atual: string;
  senha_nova: string;
}

export interface AlterarEmailRequest {
  email: string;
  senha: string;
}

// Análise de vendas com IA (backend ainda vai implementar).
export interface AnaliseIARequest {
  data_inicio: string;
  data_fim: string;
  contexto?: string | null;
}

export interface RespostaAnaliseIA {
  resumo: string;
  principais_achados?: string[];
  mais_venderam?: string[];
  mais_sobraram?: string[];
  sugestoes?: string[];
  pontos_atencao?: string[];
  modelo_usado?: string;
}

// Correção retroativa de um dia fechado (backend ainda vai implementar).
export interface CorrecaoItemRequest {
  produto_id: UUID;
  quantidade_produzida?: number | null;
  quantidade_vendida?: number | null;
}

export interface CorrigirDiaRequest {
  itens: CorrecaoItemRequest[];
  motivo?: string | null;
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
