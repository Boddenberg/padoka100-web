import AsyncStorage from "@react-native-async-storage/async-storage";
import { toNumber } from "@/lib/format";
import type {
  CustoAdicionalRascunho,
  CustoSimulado,
  IngredienteRascunho,
  ItemGuiado,
  ProximaAcaoCusteio,
  SessaoCusteio
} from "@/types/custeio";

// A sessão fica guardada por produto para o usuário retomar de onde parou.
const SESSION_KEY_PREFIX = "padoka100:custeio:sessao:";

export function readStoredSessionId(produtoId: string) {
  return AsyncStorage.getItem(SESSION_KEY_PREFIX + produtoId);
}

export function storeSessionId(produtoId: string, sessaoId: string) {
  return AsyncStorage.setItem(SESSION_KEY_PREFIX + produtoId, sessaoId);
}

export function clearStoredSessionId(produtoId: string) {
  return AsyncStorage.removeItem(SESSION_KEY_PREFIX + produtoId);
}

export function sessionId(sessao: SessaoCusteio | null | undefined) {
  if (!sessao) return null;
  return sessao.id || sessao.sessao_id || null;
}

// Perguntas/pendências/avisos podem chegar como string ou objeto: extraímos
// o texto de forma tolerante para a tela nunca quebrar.
const TEXT_KEYS = ["pergunta", "texto", "mensagem", "descricao", "detalhe", "titulo", "campo", "nome"];

export function guidedItemText(item: ItemGuiado | null | undefined): string {
  if (!item) return "";
  if (typeof item === "string") return item;
  for (const key of TEXT_KEYS) {
    const value = item[key];
    if (typeof value === "string" && value.trim()) return value.trim();
  }
  return "";
}

export function guidedItems(list: ItemGuiado[] | null | undefined): string[] {
  return (list || []).map(guidedItemText).filter(Boolean);
}

// Leitura flexível de números do custo_simulado: o contrato garante custo
// total, custo por unidade e margem, mas não fixa os nomes dos campos.
function readFlexibleNumber(source: Record<string, unknown> | null | undefined, keys: string[]): number | null {
  if (!source) return null;
  for (const key of keys) {
    const value = source[key];
    if (typeof value === "number" && Number.isFinite(value)) return value;
    if (typeof value === "string" && value.trim() !== "") {
      const parsed = Number(value);
      if (Number.isFinite(parsed)) return parsed;
    }
  }
  return null;
}

export function custoPorUnidade(custo: CustoSimulado | null | undefined) {
  return readFlexibleNumber(custo, ["custo_por_unidade", "custo_unitario", "por_unidade", "unitario"]);
}

export function custoTotal(custo: CustoSimulado | null | undefined) {
  return readFlexibleNumber(custo, ["custo_total", "total", "custo_total_receita", "custo_da_receita"]);
}

// Detalhes do custo viram linhas "nome → valor" quando o formato permitir.
export function custoDetalhes(custo: CustoSimulado | null | undefined): { nome: string; valor: number }[] {
  const detalhes = custo?.detalhes;
  if (Array.isArray(detalhes)) {
    return detalhes
      .map((item) => {
        if (!item || typeof item !== "object") return null;
        const record = item as Record<string, unknown>;
        const nome = guidedItemText(record);
        const valor = readFlexibleNumber(record, ["valor", "custo", "total", "subtotal"]);
        if (!nome || valor === null) return null;
        return { nome, valor };
      })
      .filter((item): item is { nome: string; valor: number } => item !== null);
  }
  if (detalhes && typeof detalhes === "object") {
    return Object.entries(detalhes as Record<string, unknown>)
      .map(([nome, valor]) => {
        const parsed = typeof valor === "number" || typeof valor === "string" ? toNumber(valor) : null;
        if (parsed === null || !Number.isFinite(parsed) || parsed === 0) return null;
        return { nome: nome.replace(/_/g, " "), valor: parsed };
      })
      .filter((item): item is { nome: string; valor: number } => item !== null);
  }
  return [];
}

// Etapas da trilha: contar → revisar → confirmar.
export function stepForAction(acao: ProximaAcaoCusteio | null | undefined): 1 | 2 | 3 | 4 {
  switch (acao) {
    case "resolver_pendencias":
      return 2;
    case "revisar_e_confirmar":
      return 3;
    case "mostrar_custo_confirmado":
      return 4;
    default:
      return 1;
  }
}

export function isConfirmedSession(sessao: SessaoCusteio | null | undefined) {
  const status = (sessao?.status || sessao?.situacao || "").toLowerCase();
  return sessao?.proxima_acao === "mostrar_custo_confirmado" || status === "confirmado";
}

export function isDiscardedSession(sessao: SessaoCusteio | null | undefined) {
  const status = (sessao?.status || sessao?.situacao || "").toLowerCase();
  return sessao?.proxima_acao === "sessao_descartada" || status.startsWith("descartad");
}

// Entradas numéricas em pt-BR aceitam vírgula ("1,5" → 1.5).
export function parseDecimalInput(text: string): number | null {
  const normalized = text.trim().replace(/\./g, ".").replace(",", ".");
  if (!normalized) return null;
  const value = Number(normalized);
  return Number.isFinite(value) ? value : null;
}

// Emojis deixam a lista de ingredientes viva mesmo sem fotos.
const INGREDIENT_EMOJIS: [RegExp, string][] = [
  [/farinha|trigo/i, "🌾"],
  [/ovo/i, "🥚"],
  [/leite\s*condensado/i, "🥫"],
  [/leite/i, "🥛"],
  [/manteiga|margarina/i, "🧈"],
  [/a[çc][úu]car|acucar/i, "🍬"],
  [/\bsal\b/i, "🧂"],
  [/fermento/i, "🍞"],
  [/chocolate|cacau/i, "🍫"],
  [/queijo/i, "🧀"],
  [/[óo]leo|azeite/i, "🫒"],
  [/[áa]gua/i, "💧"],
  [/coco/i, "🥥"],
  [/banana/i, "🍌"],
  [/milho|fub[áa]/i, "🌽"],
  [/frango/i, "🍗"],
  [/carne/i, "🥩"],
  [/calabresa|lingui[çc]a|presunto/i, "🌭"],
  [/tomate/i, "🍅"],
  [/cebola/i, "🧅"],
  [/alho/i, "🧄"],
  [/canela|cravo/i, "🌰"],
  [/mel\b/i, "🍯"]
];

export function ingredientEmoji(ingrediente: IngredienteRascunho) {
  const nome = ingrediente.nome || "";
  for (const [pattern, emoji] of INGREDIENT_EMOJIS) {
    if (pattern.test(nome)) return emoji;
  }
  return "🛒";
}

const EXTRA_COST_EMOJIS: [RegExp, string][] = [
  [/embalagem|saquinho|saco|pote|caixa/i, "📦"],
  [/g[áa]s/i, "🔥"],
  [/energia|luz|el[ée]trica/i, "⚡"],
  [/[áa]gua/i, "💧"],
  [/gasolina|transporte|frete|combust/i, "🚗"],
  [/entrega|motoboy/i, "🛵"],
  [/m[ãa]o\s*de\s*obra|funcion[áa]rio/i, "🧑‍🍳"]
];

export function extraCostEmoji(custo: CustoAdicionalRascunho) {
  const texto = `${custo.tipo || ""} ${custo.nome || ""}`;
  for (const [pattern, emoji] of EXTRA_COST_EMOJIS) {
    if (pattern.test(texto)) return emoji;
  }
  return "🧾";
}

// Frase amigável de quantidade: "800 g usados • pacote de 5 kg por R$ 22,00".
export function ingredientSubtitle(ingrediente: IngredienteRascunho, formatCurrency: (value: number) => string) {
  const parts: string[] = [];
  const usada = ingrediente.quantidade_usada;
  const comprada = ingrediente.quantidade_comprada;
  if (usada !== null && usada !== undefined && usada !== "") {
    parts.push(`${usada} ${ingrediente.unidade_usada || ""} na receita`.replace(/\s+/g, " ").trim());
  }
  if (comprada !== null && comprada !== undefined && comprada !== "") {
    const preco = toNumber(ingrediente.preco_total);
    const compra = `comprou ${comprada} ${ingrediente.unidade_compra || ""}`.replace(/\s+/g, " ").trim();
    parts.push(preco > 0 ? `${compra} por ${formatCurrency(preco)}` : compra);
  }
  return parts.join(" • ");
}

export function extraCostSubtitle(custo: CustoAdicionalRascunho, formatCurrency: (value: number) => string) {
  const valor = toNumber(custo.valor);
  const aplicacao = custo.aplicacao === "por_unidade" ? "por unidade" : custo.aplicacao === "por_receita" ? "pela receita toda" : custo.aplicacao || "";
  return `${formatCurrency(valor)} ${aplicacao}`.trim();
}
