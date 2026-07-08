import type { EventoLinhaDoTempo } from "@/types/api";
import { fixProductName } from "@/utils/text";

// O histórico deve ler como a linha do tempo da padaria, nunca como log
// técnico ("dia_D_venda_aberto" → "Dia aberto").
interface Rule {
  test: (normalized: string) => boolean;
  label: string;
}

const RULES: Rule[] = [
  { test: (text) => text.includes("dia") && (text.includes("abert") || text.includes("abr")), label: "Dia aberto" },
  { test: (text) => text.includes("dia") && (text.includes("fechad") || text.includes("fech")), label: "Dia fechado" },
  { test: (text) => text.includes("venda") && text.includes("cancel"), label: "Venda cancelada" },
  { test: (text) => text.includes("venda") && text.includes("corrig"), label: "Venda corrigida" },
  { test: (text) => text.includes("venda"), label: "Venda realizada" },
  { test: (text) => text.includes("produca") || text.includes("producao"), label: "Produção registrada" },
  { test: (text) => text.includes("produto") && text.includes("esgotad"), label: "Produto esgotado" },
  { test: (text) => text.includes("produto") && (text.includes("adicionad") || text.includes("criad")), label: "Produto adicionado" },
  { test: (text) => text.includes("produto") && text.includes("atualizad"), label: "Produto atualizado" },
  { test: (text) => text.includes("produto") && (text.includes("removid") || text.includes("inativ")), label: "Produto removido" },
  { test: (text) => text.includes("preco"), label: "Preço atualizado" },
  { test: (text) => text.includes("correca") || text.includes("corrig"), label: "Correção realizada" },
  { test: (text) => text.includes("local"), label: "Local atualizado" },
  { test: (text) => text.includes("midia") || text.includes("foto") || text.includes("imagem"), label: "Foto atualizada" },
  { test: (text) => text.includes("ia") || text.includes("agente") || text.includes("interacao"), label: "Ajuda do agente de IA" }
];

function normalizeTechnicalText(value: string) {
  return value
    .normalize("NFD")
    .replace(/\p{M}/gu, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ");
}

function looksTechnical(value: string) {
  return /[_/]|\b[a-f0-9]{8}-[a-f0-9]{4}\b/i.test(value) || value === value.toLowerCase().replace(/ /g, "");
}

export function humanizeEventTitle(event: EventoLinhaDoTempo) {
  // O campo novo `tipo` (público, em caixa alta) tem prioridade; os antigos
  // continuam valendo por compatibilidade.
  const normalized = normalizeTechnicalText(`${event.tipo || ""} ${event.tipo_evento || ""} ${event.titulo || ""}`);
  const rule = RULES.find((candidate) => candidate.test(normalized));
  if (rule) return rule.label;

  // Sem regra conhecida: aproveita o título se ele já for humano.
  if (event.titulo && !looksTechnical(event.titulo)) return event.titulo;
  return fixProductName(event.titulo || event.tipo || event.tipo_evento);
}

// Detalhe curto do evento em linguagem humana (produto, quantidade etc).
export function humanizeEventDetail(event: EventoLinhaDoTempo) {
  const details = { ...(event.detalhes || {}), ...(event.dados || {}) };
  const parts: string[] = [];

  const productName = details["nome_produto"] || details["produto"] || details["nome"];
  if (typeof productName === "string" && productName.trim()) parts.push(fixProductName(productName));

  const quantity = details["quantidade"] ?? details["quantidade_produzida"] ?? details["quantidade_vendida"];
  if (typeof quantity === "number") parts.push(`${quantity} un.`);

  return parts.join(" · ") || null;
}

// Data/hora do evento: campo novo primeiro, antigo como reserva.
export function eventTimestamp(event: EventoLinhaDoTempo) {
  return event.dataHora || event.criado_em;
}
