// Enquanto o backend não tem endpoints de autenticação, o app funciona sem
// login obrigatório. Quando /api/v1/auth/* existir, vire esta chave para true:
// o app passa a exigir login antes de qualquer tela.
export const AUTH_REQUIRED = false;
