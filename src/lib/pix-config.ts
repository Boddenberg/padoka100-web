import AsyncStorage from "@react-native-async-storage/async-storage";
import { formatBrazilianPhone } from "@/lib/phone";
import type { PixRecebedor } from "@/lib/pix";

// Cadastro do Pix da própria pessoa (chave + nome + cidade). Fica no aparelho,
// separado por conta, para gerar o QR da Venda 100% no front (OTA-safe, offline)
// — cada usuário usa a SUA chave, nada chumbado. Dá para migrar para o backend
// depois (sincronizar entre aparelhos) sem mudar quem consome estas funções.

export type PixKeyType = "telefone" | "email" | "cpf" | "cnpj" | "aleatoria";

export interface PixConfig {
  tipoChave: PixKeyType;
  chave: string;
  nome: string;
  cidade: string;
}

export const emptyPixConfig: PixConfig = {
  tipoChave: "telefone",
  chave: "",
  nome: "",
  cidade: ""
};

export const PIX_KEY_LABEL: Record<PixKeyType, string> = {
  telefone: "Celular",
  email: "E-mail",
  cpf: "CPF",
  cnpj: "CNPJ",
  aleatoria: "Chave aleatória"
};

const KEY_PREFIX = "padoka100:pix-config:";

export async function readPixConfig(userId?: string | null): Promise<PixConfig | null> {
  if (!userId) return null;
  try {
    const raw = await AsyncStorage.getItem(KEY_PREFIX + userId);
    if (!raw) return null;
    return { ...emptyPixConfig, ...(JSON.parse(raw) as Partial<PixConfig>) };
  } catch {
    return null;
  }
}

export async function savePixConfig(userId: string, config: PixConfig): Promise<void> {
  await AsyncStorage.setItem(KEY_PREFIX + userId, JSON.stringify(config));
}

// Completo o suficiente para gerar o QR: precisa de chave e nome (cidade é
// opcional — cai em "BRASIL" no padrão).
export function isPixConfigComplete(config: PixConfig | null | undefined): config is PixConfig {
  return Boolean(config && config.chave.trim() && config.nome.trim());
}

// Normaliza a chave para o BR Code (campo 01): telefone em E.164, CPF/CNPJ só
// dígitos, e-mail/aleatória em minúsculas.
export function normalizePixKey(tipo: PixKeyType, raw: string): string {
  const value = (raw || "").trim();
  if (!value) return "";
  if (tipo === "email" || tipo === "aleatoria") return value.toLowerCase();
  if (tipo === "cpf" || tipo === "cnpj") return value.replace(/\D/g, "");
  // telefone -> +55 + DDD + número
  const digitos = value.replace(/\D/g, "");
  if (!digitos) return "";
  if (digitos.startsWith("55") && digitos.length >= 12 && digitos.length <= 13) return `+${digitos}`;
  return `+55${digitos}`;
}

// Como mostrar a chave para conferência (telefone/CPF/CNPJ formatados).
export function pixKeyDisplay(tipo: PixKeyType, raw: string): string {
  const value = (raw || "").trim();
  if (!value) return "";
  if (tipo === "telefone") return formatBrazilianPhone(value) || value;
  if (tipo === "cpf") {
    const d = value.replace(/\D/g, "").slice(0, 11);
    return d.length === 11 ? d.replace(/(\d{3})(\d{3})(\d{3})(\d{2})/, "$1.$2.$3-$4") : value;
  }
  if (tipo === "cnpj") {
    const d = value.replace(/\D/g, "").slice(0, 14);
    return d.length === 14 ? d.replace(/(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})/, "$1.$2.$3/$4-$5") : value;
  }
  return value;
}

// Máscara enquanto digita, por tipo (ajuda usuários com menos familiaridade).
export function maskPixKeyInput(tipo: PixKeyType, raw: string): string {
  if (tipo === "telefone") return formatBrazilianPhone(raw);
  if (tipo === "cpf") return raw.replace(/\D/g, "").slice(0, 11);
  if (tipo === "cnpj") return raw.replace(/\D/g, "").slice(0, 14);
  return raw;
}

export function resolveRecebedor(config: PixConfig): PixRecebedor {
  return {
    chave: normalizePixKey(config.tipoChave, config.chave),
    nome: config.nome.trim(),
    cidade: config.cidade.trim() || null
  };
}
