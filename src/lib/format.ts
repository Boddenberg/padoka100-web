import type { DecimalString } from "@/types/api";

export function formatCurrency(value: DecimalString | number | null | undefined) {
  const amount = Number(value || 0);

  return new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL"
  }).format(Number.isFinite(amount) ? amount : 0);
}

export function formatDate(value: string | null | undefined) {
  if (!value) return "-";
  const [dateOnly] = value.split("T");
  const [year, month, day] = dateOnly.split("-");
  if (year && month && day) return `${day}/${month}/${year}`;
  return value;
}

export function todayInputValue() {
  return new Date().toISOString().slice(0, 10);
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
