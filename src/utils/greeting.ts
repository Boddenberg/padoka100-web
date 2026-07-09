// Cumprimento de acordo com a hora do aparelho. Com nome, personaliza:
// "Boa noite, Filipe!" (usa só o primeiro nome).
export function getGreeting(name?: string | null, date = new Date()) {
  const hour = date.getHours();
  const saudacao = hour < 12 ? "Bom dia" : hour < 18 ? "Boa tarde" : "Boa noite";
  const primeiroNome = name?.trim().split(/\s+/)[0];
  return primeiroNome ? `${saudacao}, ${primeiroNome}!` : `${saudacao}!`;
}
