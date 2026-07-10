# Supabase Auth no app

O app usa Supabase Auth para:

- login com e-mail e senha;
- criacao de conta;
- recuperacao de senha por e-mail;
- login Google ja preparado por OAuth.

O backend nao recebe senha do usuario. O app obtem a sessao no Supabase e envia `Authorization: Bearer <access_token>` para a API FastAPI.

## Variaveis publicas

Configure no ambiente de build ou em `expo.extra`:

```text
EXPO_PUBLIC_SUPABASE_URL=https://seu-projeto.supabase.co
EXPO_PUBLIC_SUPABASE_ANON_KEY=sua-anon-key
```

Esses valores sao publicos. Nunca coloque `SUPABASE_SERVICE_ROLE_KEY` no app.

## Redirect URLs

No Supabase, configure os redirects para o scheme do app:

```text
padoka100://auth/callback
padoka100://reset-password
```

Use `padoka100://auth/callback` tambem no Google provider. O botao "Entrar com Google" so fica operacional depois que o provider Google estiver habilitado no Supabase e os OAuth Client IDs estiverem configurados no Google Cloud.

