import type { UsuarioPerfil } from "@/types/api";

export const PLAN_LABEL: Record<string, string> = {
  basico: "Basico",
  analitico: "Analitico",
  ia: "IA",
  admin: "Admin"
};

// Nome do plano que libera cada funcionalidade — usado nas mensagens e no CTA
// "Conhecer o Plano X" do aviso de bloqueio.
export const FEATURE_PLAN: Record<string, string> = {
  "relatorios.avancados": "Analítico",
  "custos.usar": "Analítico",
  "compras.usar": "Analítico",
  "ia.operacional": "IA",
  "ia.analitica": "IA",
  "custos.assistente": "IA",
  "admin.gerenciar": "Admin"
};

// Nome do plano (ex.: "Analítico") que desbloqueia a funcionalidade, ou null.
export function featurePlanName(capability: string): string | null {
  return FEATURE_PLAN[capability] ?? null;
}

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
  const plan = FEATURE_PLAN[capability];
  return plan
    ? `Seu plano atual não inclui esta funcionalidade. Ela faz parte do plano ${plan}.`
    : "Seu plano atual não inclui esta funcionalidade. Ela faz parte de um plano superior.";
}
