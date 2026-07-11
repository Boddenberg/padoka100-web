import type { UsuarioPerfil } from "@/types/api";

export const PLAN_LABEL: Record<string, string> = {
  basico: "Basico",
  analitico: "Analitico",
  ia: "IA",
  admin: "Admin"
};

export const FEATURE_LABEL: Record<string, string> = {
  "relatorios.avancados": "plano Analitico",
  "custos.usar": "plano Analitico",
  "compras.usar": "plano Analitico",
  "ia.operacional": "plano IA",
  "ia.analitica": "plano IA",
  "custos.assistente": "plano IA",
  "admin.gerenciar": "plano Admin"
};

export function hasAccess(user: UsuarioPerfil | null | undefined, capability: string) {
  return Boolean(user?.capacidades?.includes(capability));
}

// Conta admin da plataforma (papel ou plano): enxerga ferramentas de
// diagnóstico que o usuário comum nunca deve ver.
export function isAdmin(user: UsuarioPerfil | null | undefined) {
  return user?.papel === "administrador" || user?.plano === "admin";
}

export function planLabel(user: UsuarioPerfil | null | undefined) {
  return PLAN_LABEL[String(user?.plano || "basico")] || String(user?.plano || "basico");
}

export function upgradeMessage(capability: string) {
  const label = FEATURE_LABEL[capability] || "um plano superior";
  return `Seu acesso atual nao libera esta feature. Ela faz parte do ${label}.`;
}
