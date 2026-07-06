import type { CapacitorConfig } from "@capacitor/cli";

const config: CapacitorConfig = {
  appId: "com.boddenberg.padoka100",
  appName: "Padoka 100%",
  webDir: "dist",
  server: {
    androidScheme: "https"
  }
};

export default config;
