// E-mail digitado no cadastro/login. Normaliza antes de enviar e valida uma
// estrutura mínima (nome@dominio.com). O backend também valida — aqui a ideia é
// orientar a pessoa na hora, sem deixar passar formatos claramente errados.

// Remove espaços das pontas e passa para minúsculas.
export function normalizeEmail(value: string): string {
  return value.trim().toLowerCase();
}

// Aceita "nome@dominio.com"; recusa sem @, sem domínio, sem ponto no domínio,
// com espaços ou com @ repetido. Trabalha sobre o valor normalizado.
const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function isValidEmail(value: string): boolean {
  return EMAIL_PATTERN.test(normalizeEmail(value));
}
