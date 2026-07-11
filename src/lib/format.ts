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

// Data de nascimento digitada como "DD/MM/AAAA" → ISO "YYYY-MM-DD" (formato
// que o backend exige em data_nascimento). Devolve null se incompleta ou
// impossível (ex.: 31/02, ano fora de 1900..hoje).
export function brDateToIso(value: string) {
  const match = /^(\d{2})\/(\d{2})\/(\d{4})$/.exec(value.trim());
  if (!match) return null;
  const [, dayText, monthText, yearText] = match;
  const day = Number(dayText);
  const month = Number(monthText);
  const year = Number(yearText);
  const date = new Date(Date.UTC(year, month - 1, day));
  const realDate =
    date.getUTCFullYear() === year && date.getUTCMonth() === month - 1 && date.getUTCDate() === day;
  if (!realDate || year < 1900 || year > new Date().getFullYear()) return null;
  return `${yearText}-${monthText}-${dayText}`;
}

// Normaliza para exibição: aceita ISO vindo do servidor ou texto já em BR.
export function toBrDate(value: string | null | undefined) {
  if (!value) return "";
  if (/^\d{4}-\d{2}-\d{2}/.test(value)) return formatDate(value);
  return value;
}

// Máscara progressiva "DD/MM/AAAA" enquanto digita.
export function maskBrDate(value: string) {
  const digits = value.replace(/\D/g, "").slice(0, 8);
  if (digits.length <= 2) return digits;
  if (digits.length <= 4) return `${digits.slice(0, 2)}/${digits.slice(2)}`;
  return `${digits.slice(0, 2)}/${digits.slice(2, 4)}/${digits.slice(4)}`;
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
