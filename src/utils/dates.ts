// Datas sempre como "YYYY-MM-DD" e em UTC, para não depender do fuso do aparelho.
export function addDays(iso: string, amount: number) {
  const [year, month, day] = iso.split("-").map(Number);
  const date = new Date(Date.UTC(year, month - 1, day + amount));
  return date.toISOString().slice(0, 10);
}

// Diferença em dias (end - start).
export function diffDays(start: string, end: string) {
  const [ys, ms, ds] = start.split("-").map(Number);
  const [ye, me, de] = end.split("-").map(Number);
  const startUtc = Date.UTC(ys, ms - 1, ds);
  const endUtc = Date.UTC(ye, me - 1, de);
  return Math.round((endUtc - startUtc) / 86_400_000);
}

export function weekdayOf(iso: string) {
  const [year, month, day] = iso.split("-").map(Number);
  return new Date(Date.UTC(year, month - 1, day)).getUTCDay();
}

export function startOfMonth(iso: string) {
  return `${iso.slice(0, 7)}-01`;
}

const MONTH_NAMES = [
  "janeiro",
  "fevereiro",
  "março",
  "abril",
  "maio",
  "junho",
  "julho",
  "agosto",
  "setembro",
  "outubro",
  "novembro",
  "dezembro"
];

export function monthName(iso: string) {
  const month = Number(iso.slice(5, 7));
  return MONTH_NAMES[month - 1] || "";
}

// Frase curta que descreve o período selecionado para o usuário.
export function describePeriod(start: string, end: string, today: string) {
  if (start === end) {
    if (start === today) return "Hoje";
    return formatShortDate(start);
  }
  if (end === today && start === addDays(today, -6)) return "Últimos 7 dias";
  if (start === startOfMonth(today) && end === today) return `${capitalize(monthName(today))} até hoje`;
  if (start === startOfMonth(start) && end === endOfMonth(start)) {
    return `${capitalize(monthName(start))} de ${start.slice(0, 4)}`;
  }
  return `${formatShortDate(start)} – ${formatShortDate(end)}`;
}

export function endOfMonth(iso: string) {
  const year = Number(iso.slice(0, 4));
  const month = Number(iso.slice(5, 7));
  const lastDay = new Date(Date.UTC(year, month, 0)).getUTCDate();
  return `${iso.slice(0, 7)}-${String(lastDay).padStart(2, "0")}`;
}

function formatShortDate(iso: string) {
  return `${iso.slice(8, 10)}/${iso.slice(5, 7)}/${iso.slice(0, 4)}`;
}

function capitalize(value: string) {
  return value.charAt(0).toUpperCase() + value.slice(1);
}
