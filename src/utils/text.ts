// Nomes de produto podem chegar do backend como slug ou sem acento
// ("pao sovado", "Tran?a de calabresa"). Aqui viram nomes bonitos de vitrine.
const CONNECTORS = new Set(["de", "da", "do", "das", "dos", "e", "com", "a", "o", "em", "no", "na"]);

// Chaves sem acento (como o backend costuma mandar) → palavra correta.
const NAME_FIXES: Record<string, string> = {
  pao: "pão",
  paes: "pães",
  paozinho: "pãozinho",
  paezinhos: "pãezinhos",
  tranca: "trança",
  trancas: "tranças",
  cafe: "café",
  cafes: "cafés",
  acucar: "açúcar",
  frances: "francês",
  franceses: "franceses",
  pudim: "pudim",
  bolo: "bolo",
  broa: "broa",
  rosquinha: "rosquinha",
  sonho: "sonho",
  torta: "torta",
  cuca: "cuca",
  biscoito: "biscoito",
  salgado: "salgado",
  lanche: "lanche"
};

function stripAccents(value: string) {
  return value.normalize("NFD").replace(/\p{M}/gu, "");
}

// "tran?a" vira o padrão /^tran.a$/ para achar "tranca" no dicionário.
function lookupFix(word: string): string | null {
  const base = stripAccents(word.toLowerCase());
  if (!base.includes("?")) return NAME_FIXES[base] || null;

  const pattern = new RegExp(`^${base.replace(/[.*+^${}()|[\]\\]/g, "\\$&").replace(/\?/g, ".")}$`);
  const match = Object.keys(NAME_FIXES).find((key) => pattern.test(key));
  return match ? NAME_FIXES[match] : null;
}

function capitalize(word: string) {
  if (!word) return word;
  return word.charAt(0).toUpperCase() + word.slice(1);
}

export function fixProductName(name: string | null | undefined) {
  if (!name) return "";

  return name
    .replace(/[_-]+/g, " ")
    .trim()
    .split(/\s+/)
    .map((word, index) => {
      const fixed = lookupFix(word) || word.toLowerCase();
      if (index > 0 && CONNECTORS.has(fixed)) return fixed;
      return capitalize(fixed);
    })
    .join(" ");
}
