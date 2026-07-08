import type { UUID } from "@/types/api";

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
  proxima_acao?: ProximaAcaoCusteio | null;
  entradas?: EntradaSessaoCusteio[] | null;
  [key: string]: unknown;
}

export interface CriarSessaoCusteioRequest {
  produto_id?: UUID | null;
  contexto?: string | null;
}

export interface EntradaTextoCusteioRequest {
  texto: string;
  contexto?: string | null;
  permitir_fallback?: boolean;
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
}
