import type { UsuarioPerfil } from "@/types/api";

// Catálogo de planos exibido no perfil. O backend hoje só expõe o enum
// (basico|analitico|ia|admin), sem preços nem benefícios — então o catálogo
// vive aqui no app. Os preços são PROVISÓRIOS: revisar quando o backend
// publicar o catálogo oficial (e aí este arquivo passa a só espelhar a API).
export type PlanoId = "basico" | "analitico" | "ia";

export interface PlanoCatalogo {
  id: PlanoId;
  nome: string;
  slogan: string;
  // null = grátis.
  precoMensal: number | null;
  // Linha "Tudo do plano X, e mais:" antes dos benefícios exclusivos.
  heranca: string | null;
  beneficios: string[];
}

export const PLANOS: PlanoCatalogo[] = [
  {
    id: "basico",
    nome: "Básico",
    slogan: "Pra vender todo dia",
    precoMensal: null,
    heranca: null,
    beneficios: [
      "Venda registrada no toque, rapidinho",
      "Fotos nos seus produtos",
      "Resumo do dia de venda",
      "Histórico de tudo o que aconteceu"
    ]
  },
  {
    id: "analitico",
    nome: "Analítico",
    slogan: "Pra entender e lucrar mais",
    precoMensal: 19.9,
    heranca: "Tudo do Básico, e mais:",
    beneficios: [
      "Relatórios da semana e do mês",
      "Custo e lucro de cada produto",
      "Lista de compras automática"
    ]
  },
  {
    id: "ia",
    nome: "IA",
    slogan: "Sua padaria com superpoderes",
    precoMensal: 39.9,
    heranca: "Tudo do Analítico, e mais:",
    beneficios: [
      "Venda falando: a IA registra pra você",
      "Análises inteligentes das suas vendas",
      "Custeio assistido por IA",
      "Novidades de IA em primeira mão"
    ]
  }
];

const ORDEM: Record<string, number> = { basico: 0, analitico: 1, ia: 2 };

// Posição do plano na escadinha de upgrade (admin fica fora dela).
export function planRank(plano: string | null | undefined) {
  return ORDEM[String(plano || "basico")] ?? 0;
}

export function isAdminPlan(user: UsuarioPerfil | null | undefined) {
  return String(user?.plano) === "admin";
}

// Canal de ativação enquanto o app não tem pagamento embutido: o pedido de
// upgrade vira uma mensagem para a equipe Padoka.
// WhatsApp em formato internacional, só dígitos (ex.: "5511987654321");
// vazio = botão de WhatsApp não aparece.
export const UPGRADE_WHATSAPP = "";
export const UPGRADE_EMAIL = "filipeboddenberg@yahoo.com.br";
