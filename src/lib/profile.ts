import AsyncStorage from "@react-native-async-storage/async-storage";

const PROFILE_KEY = "padoka100:perfil-local";

// Dados do perfil guardados no aparelho. Quando o backend ganhar endpoints
// de perfil, este arquivo passa a sincronizar com o servidor.
export interface LocalProfile {
  fotoUri: string | null;
  nome: string;
  nascimento: string;
  telefone: string;
  email: string;
}

export const emptyProfile: LocalProfile = {
  fotoUri: null,
  nome: "",
  nascimento: "",
  telefone: "",
  email: ""
};

export async function readProfile(): Promise<LocalProfile> {
  try {
    const raw = await AsyncStorage.getItem(PROFILE_KEY);
    if (!raw) return emptyProfile;
    return { ...emptyProfile, ...(JSON.parse(raw) as Partial<LocalProfile>) };
  } catch {
    return emptyProfile;
  }
}

export async function saveProfile(profile: LocalProfile) {
  await AsyncStorage.setItem(PROFILE_KEY, JSON.stringify(profile));
}
