// Identidade "Madrugada & Fornada": a padoca acorda antes do sol.
// Base clara de farinha para o trabalho do dia; UM elemento escuro de
// madrugada (o cartão do dia e o agente) com brilho de brasa — o forno é
// a única luz. Uma só cor de ação (brasa); nada de violeta ou framboesa.
export const colors = {
  bg: "#fbf5ec", // farinha
  surface: "#ffffff", // miolo
  surfaceWarm: "#fff3e2",
  surfaceGlow: "#fff8ef",
  ink: "#2e2013", // casca
  muted: "#7d6753", // fermento — AA (≥4.5:1) sobre farinha
  border: "#eee0cc",

  brand: "#e56910", // brasa
  brandDeep: "#b34a05", // brasa p/ texto e ícones pequenos (AA)
  brandSoft: "#fbe7d0",

  // Madrugada: o agente de IA e as superfícies de dados/planejamento.
  agent: "#4d5b96",
  agentDeep: "#333e6e",
  agentSoft: "#e9ecf8",

  success: "#0e7a4d",
  successSoft: "#def3e7",
  warning: "#8f5a03",
  warningSoft: "#fdeed2",
  danger: "#c0332a",
  dangerSoft: "#fce4e0"
};

// Gradientes prontos para LinearGradient (sempre início → fim).
export const gradients = {
  // Crosta: dourado da casca → assado profundo.
  brand: ["#f08c1e", "#d95d08"] as const,
  // Madrugada: céu antes do sol nascer (assinatura do app).
  hero: ["#33406e", "#1a2340"] as const,
  agent: ["#5a68a8", "#333e6e"] as const,
  glow: ["#fff3e2", "#fbf5ec"] as const
};

// Escala de espaçamento: respiro maior e consistente entre blocos.
export const spacing = {
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 20,
  xxl: 28
};

export const radius = {
  sm: 12,
  md: 16,
  lg: 22,
  xl: 28,
  pill: 999
};

export const fonts = {
  display: "SpaceGrotesk_700Bold",
  displayMedium: "SpaceGrotesk_500Medium",
  body: "Nunito_600SemiBold",
  bodyBold: "Nunito_800ExtraBold"
};

export const shadows = {
  soft: {
    shadowColor: "#4a2c12",
    shadowOpacity: 0.08,
    shadowRadius: 14,
    shadowOffset: { width: 0, height: 6 },
    elevation: 3
  },
  brand: {
    shadowColor: "#d95d08",
    shadowOpacity: 0.3,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 6 },
    elevation: 6
  },
  agent: {
    shadowColor: "#333e6e",
    shadowOpacity: 0.28,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 6 },
    elevation: 6
  },
  floating: {
    shadowColor: "#2e2013",
    shadowOpacity: 0.22,
    shadowRadius: 24,
    shadowOffset: { width: 0, height: 12 },
    elevation: 10
  }
};
