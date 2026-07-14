import type { OrigemPreco, UUID } from "@/types/api";

// Custeio assistido (/api/v1/custos/assistente): o backend devolve sempre a
// sessão completa. Os campos centrais estão no contrato; o resto é tolerante,
// no mesmo espírito de RespostaAnaliseIA.

export type StatusCampoCusteio = "CONFIRMADO" | "PENDENTE" | string;

export interface ReceitaRascunho {
  nome?: string | null;
  rendimento?: number | string | null;
  unidade_rendimento?: string | null;
  status?: StatusCampoCusteio | null;
  [key: string]: unknown;
}

export interface IngredienteRascunho {
  nome?: string | null;
  quantidade_comprada?: number | string | null;
  unidade_compra?: string | null;
  preco_total?: number | string | null;
  quantidade_usada?: number | string | null;
  unidade_usada?: string | null;
  status?: StatusCampoCusteio | null;
  [key: string]: unknown;
}

export interface CustoAdicionalRascunho {
  tipo?: string | null;
  nome?: string | null;
  valor?: number | string | null;
  aplicacao?: string | null; // "por_unidade" | "por_receita"
  status?: StatusCampoCusteio | null;
  [key: string]: unknown;
}

export interface RascunhoCusteio {
  receita?: ReceitaRascunho | null;
  ingredientes?: IngredienteRascunho[] | null;
  custos_adicionais?: CustoAdicionalRascunho[] | null;
  [key: string]: unknown;
}

// Perguntas, pendências e avisos podem vir como texto puro ou objeto.
export type ItemGuiado = string | Record<string, unknown>;

export type CustoSimulado = Record<string, unknown>;

export interface EntradaSessaoCusteio {
  tipo?: string;
  [key: string]: unknown;
}

export type ProximaAcaoCusteio =
  | "vincular_produto"
  | "enviar_dados_de_custo"
  | "resolver_pendencias"
  | "revisar_e_confirmar"
  | "mostrar_custo_confirmado"
  | "sessao_descartada"
  | string;

// Etapa real da sessão no backend, usada para orientar a jornada da tela.
export type FaseCusteio =
  | "vinculando_produto"
  | "coletando_ingredientes"
  | "coletando_precos"
  | "revisando"
  | "confirmada"
  | "descartada"
  | string;

// Segregação da jornada: cada entrada diz se é receita, compra/preço ou tudo.
export type FinalidadeCusteio = "auto" | "receita" | "compras" | "completo";

export interface SessaoCusteio {
  id?: UUID;
  sessao_id?: UUID;
  produto_id?: UUID | null;
  status?: string | null;
  situacao?: string | null;
  rascunho?: RascunhoCusteio | null;
  perguntas?: ItemGuiado[] | null;
  pendencias?: ItemGuiado[] | null;
  avisos?: ItemGuiado[] | null;
  custo_simulado?: CustoSimulado | null;
  pode_confirmar?: boolean;
  fase?: FaseCusteio | null;
  proxima_acao?: ProximaAcaoCusteio | null;
  entradas?: EntradaSessaoCusteio[] | null;
  [key: string]: unknown;
}

export interface CriarSessaoCusteioRequest {
  produto_id?: UUID | null;
  contexto?: string | null;
  // Semeia a sessão nova já preenchida (usado ao editar um custo confirmado
  // sem perder receita nem preços). O backend só normaliza — não roda IA.
  rascunho_inicial?: RascunhoCusteio | null;
}

export interface EntradaTextoCusteioRequest {
  texto: string;
  contexto?: string | null;
  permitir_fallback?: boolean;
  finalidade?: FinalidadeCusteio;
}

export interface CorrigirRascunhoCusteioRequest {
  modo: "mesclar" | "substituir";
  observacao?: string | null;
  rascunho: RascunhoCusteio;
}

export interface ConfirmarCusteioRequest {
  permitir_pendencias?: boolean;
  atualizar_preco_custo_produto?: boolean;
  vigente_desde?: string;
  motivo_preco?: string;
  // Marca o custo como calculado pela IA (o backend grava em VersaoDePreco.origem).
  origem?: OrigemPreco;
}

// --- Lista de compras por produção planejada. -----------------------------

export interface ListaCompraContribuicao {
  produto_id?: string;
  produto?: string | null;
  receita_id?: string | null;
  quantidade_produto?: number | string;
  quantidade_base?: number | string;
  [key: string]: unknown;
}

export interface ListaCompraItem {
  insumo_id?: string;
  nome?: string | null;
  categoria?: string | null;
  quantidade_base?: number | string;
  unidade_base?: string | null;
  quantidade_sugerida?: number | string;
  unidade_sugerida?: string | null;
  custo_unitario_base?: number | string;
  custo_estimado?: number | string;
  status?: string | null;
  observacoes?: string | null;
  contribuicoes?: ListaCompraContribuicao[] | null;
  [key: string]: unknown;
}

export interface ListaCompra {
  id?: string;
  nome?: string | null;
  data_referencia?: string | null;
  margem_percentual?: number;
  total_estimado?: number | string;
  pendencias?: ItemGuiado[] | null;
  itens?: ListaCompraItem[] | null;
  criado_em?: string | null;
  [key: string]: unknown;
}

// Produtos que já têm receita cadastrada (GET /custos/produtos-com-receita).
// A lista de compras só consegue calcular insumos para estes.
export interface ProdutoComReceita {
  produto_id: string;
  nome: string;
  slug?: string | null;
  situacao?: string;
  receita_id?: string;
  receita_nome?: string | null;
  rendimento?: number | string;
  unidade_rendimento?: string;
  status?: string;
  total_ingredientes?: number;
}

export interface GerarListaCompraRequest {
  nome?: string;
  data_referencia?: string;
  margem_percentual?: number;
  salvar?: boolean;
  itens: { produto_id: string; quantidade: number; receita_id?: string }[];
}
