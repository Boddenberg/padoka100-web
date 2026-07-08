// Cumprimento de acordo com a hora do aparelho: abre todas as telas do app.
export function getGreeting(date = new Date()) {
  const hour = date.getHours();
  if (hour < 12) return "Bom dia!";
  if (hour < 18) return "Boa tarde!";
  return "Boa noite!";
}
