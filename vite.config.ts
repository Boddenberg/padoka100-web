import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";
import { VitePWA } from "vite-plugin-pwa";

const productionBackendUrl = "https://padoka100-production.up.railway.app";

export default defineConfig({
  plugins: [
    react(),
    VitePWA({
      registerType: "autoUpdate",
      includeAssets: ["padoka-mark.svg"],
      manifest: {
        name: "Padoka 100",
        short_name: "Padoka 100",
        description: "Controle mobile-first de producao e vendas.",
        theme_color: "#ef4444",
        background_color: "#fff7ed",
        display: "standalone",
        orientation: "portrait",
        start_url: "/",
        scope: "/",
        lang: "pt-BR",
        icons: [
          {
            src: "/padoka-mark.svg",
            sizes: "any",
            type: "image/svg+xml",
            purpose: "any maskable"
          }
        ]
      },
      workbox: {
        navigateFallbackDenylist: [/^\/api\//],
        runtimeCaching: [
          {
            urlPattern: /^https:\/\/padoka100-production\.up\.railway\.app\/.*$/i,
            handler: "NetworkFirst",
            options: {
              cacheName: "padoka-api",
              networkTimeoutSeconds: 6,
              expiration: {
                maxEntries: 80,
                maxAgeSeconds: 60 * 60
              }
            }
          }
        ]
      }
    })
  ],
  resolve: {
    alias: {
      "@": "/src"
    }
  },
  server: {
    proxy: {
      "/api/v1": {
        target: productionBackendUrl,
        changeOrigin: true,
        secure: true
      },
      "/health": {
        target: productionBackendUrl,
        changeOrigin: true,
        secure: true
      }
    }
  }
});
