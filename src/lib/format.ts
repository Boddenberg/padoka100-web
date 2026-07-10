import type { DecimalString } from "@/types/api";

export function formatCurrency(value: DecimalString | number | null | undefined) {
  const amount = Number(value || 0);

  return new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL"
  }).format(Number.isFinite(amount) ? amount : 0);
}

// Valor redondo, sem centavos: bom para rótulos de gráfico.
export function formatWholeCurrency(value: DecimalString | number | null | undefined) {
  const amount = Number(value || 0);
  return new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL",
    maximumFractionDigits: 0
  }).format(Number.isFinite(amount) ? amount : 0);
}

export function formatDate(value: string | null | undefined) {
  if (!value) return "-";
  const [dateOnly] = value.split("T");
  const [year, month, day] = dateOnly.split("-");
  if (year && month && day) return `${day}/${month}/${year}`;
  return value;
}

// Dia de HOJE no calendário LOCAL do aparelho, como "YYYY-MM-DD".
// NÃO use toISOString() aqui: ele converte o instante para UTC e, à noite no
// Brasil (UTC-3), devolveria o dia seguinte — o backend então recusa como
// "data futura" (relatórios, vigente_desde, data_venda...). getFullYear/Month/
// Date são locais, alinhados ao calendário da tela e ao dia real do usuário.
export function todayInputValue() {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, "0");
  const day = String(now.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

export function toNumber(value: DecimalString | number | null | undefined) {
  const numberValue = Number(value || 0);
  return Number.isFinite(numberValue) ? numberValue : 0;
}

export function cleanPayload<T extends object>(payload: T) {
  return Object.fromEntries(
    Object.entries(payload as Record<string, unknown>).map(([key, value]) => [key, value === "" ? null : value])
  ) as Partial<T>;
}
