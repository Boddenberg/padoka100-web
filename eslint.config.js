const expoConfig = require("eslint-config-expo/flat");

const base = Array.isArray(expoConfig) ? expoConfig : [expoConfig];

module.exports = [
  ...base,
  {
    rules: {
      // Regras novas do eslint-plugin-react-hooks (RC), ativadas por um bump de
      // tooling. Sinalizam padrões idiomáticos do React Native (interpolar um
      // Animated.Value em render; setState de sincronização dentro de effect),
      // não defeitos — desligadas para manter o lint coerente com a base.
      "react-hooks/refs": "off",
      "react-hooks/set-state-in-effect": "off"
    }
  }
];
