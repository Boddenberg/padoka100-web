// Identidade visual "padaria tech": tons quentes de forno + acentos vibrantes,
// nada de preto chapado. Gradientes fazem o papel de cor primária.
export const colors = {
  bg: "#fbf5ec",
  surface: "#ffffff",
  surfaceWarm: "#fff3e2",
  surfaceGlow: "#fff8ef",
  ink: "#33231a",
  muted: "#96806f",
  border: "#f0e2d0",

  brand: "#ff7a1a",
  brandDeep: "#f24d0f",
  brandSoft: "#ffe8d2",

  agent: "#8b5cf6",
  agentDeep: "#6d28d9",
  agentSoft: "#f1e9ff",

  success: "#12925c",
  successSoft: "#e2f7ec",
  warning: "#b96a06",
  warningSoft: "#fff1d8",
  danger: "#e0362c",
  dangerSoft: "#ffe6e3"
};

// Gradientes prontos para LinearGradient (sempre início → fim).
export const gradients = {
  brand: ["#ff8a2a", "#f24d0f"] as const,
  hero: ["#432a1c", "#2a1a10"] as const,
  agent: ["#9d6bff", "#6d28d9"] as const,
  glow: ["#fff3e2", "#fbf5ec"] as const
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
    shadowColor: "#f24d0f",
    shadowOpacity: 0.32,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 6 },
    elevation: 6
  },
  agent: {
    shadowColor: "#6d28d9",
    shadowOpacity: 0.32,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 6 },
    elevation: 6
  },
  floating: {
    shadowColor: "#33231a",
    shadowOpacity: 0.22,
    shadowRadius: 24,
    shadowOffset: { width: 0, height: 12 },
    elevation: 10
  }
};
