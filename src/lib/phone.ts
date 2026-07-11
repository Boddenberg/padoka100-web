// Telefone brasileiro: DDD (2 dígitos, sem zero) + celular 9XXXX-XXXX ou
// fixo XXXX-XXXX. Validação básica por regex, usada no cadastro e no perfil.
const BR_PHONE_DIGITS = /^[1-9][0-9](?:9[0-9]{8}|[2-9][0-9]{7})$/;

export const PHONE_ERROR = "Telefone inválido. Use o formato (11) 98765-4321.";

export function onlyPhoneDigits(value: string) {
  return value.replace(/\D/g, "").slice(0, 11);
}

export function isValidBrazilianPhone(value: string) {
  return BR_PHONE_DIGITS.test(onlyPhoneDigits(value));
}

// Máscara progressiva enquanto digita: "(11) 98765-4321" / "(11) 3456-7890".
export function formatBrazilianPhone(value: string) {
  const digits = onlyPhoneDigits(value);
  if (!digits) return "";
  if (digits.length <= 2) return `(${digits}`;
  const ddd = digits.slice(0, 2);
  const rest = digits.slice(2);
  if (rest.length <= 4) return `(${ddd}) ${rest}`;
  // Com 9 dígitos é celular (5+4); até 8 formata como fixo (4+4).
  const split = rest.length === 9 ? 5 : 4;
  return `(${ddd}) ${rest.slice(0, split)}-${rest.slice(split)}`;
}
