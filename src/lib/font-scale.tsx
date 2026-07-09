import AsyncStorage from "@react-native-async-storage/async-storage";
import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react";

// Escolha de tamanho de texto do usuário (idoso pode preferir maior). O valor
// vira um multiplicador aplicado à tipografia principal do app (ui.tsx).
export type FontLevel = "normal" | "grande" | "maior";

const SCALE: Record<FontLevel, number> = {
  normal: 1,
  grande: 1.15,
  maior: 1.32
};

const STORAGE_KEY = "padoka100:font-scale";

interface FontScaleValue {
  level: FontLevel;
  scale: number;
  setLevel: (level: FontLevel) => void;
}

const FontScaleContext = createContext<FontScaleValue>({ level: "normal", scale: 1, setLevel: () => undefined });

export function FontScaleProvider({ children }: { children: ReactNode }) {
  const [level, setLevelState] = useState<FontLevel>("normal");

  useEffect(() => {
    AsyncStorage.getItem(STORAGE_KEY)
      .then((value) => {
        if (value === "normal" || value === "grande" || value === "maior") setLevelState(value);
      })
      .catch(() => undefined);
  }, []);

  const setLevel = useCallback((next: FontLevel) => {
    setLevelState(next);
    AsyncStorage.setItem(STORAGE_KEY, next).catch(() => undefined);
  }, []);

  const value = useMemo(() => ({ level, scale: SCALE[level], setLevel }), [level, setLevel]);
  return <FontScaleContext.Provider value={value}>{children}</FontScaleContext.Provider>;
}

export function useFontScale() {
  return useContext(FontScaleContext);
}

// Só o multiplicador, para escalar um fontSize: `12 * useFontMultiplier()`.
export function useFontMultiplier() {
  return useContext(FontScaleContext).scale;
}
