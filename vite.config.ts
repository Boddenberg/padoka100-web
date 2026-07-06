import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";
import { VitePWA } from "vite-plugin-pwa";

const productionBackendUrl = "https://padoka100-production.up.railway.app";

export default defineConfig({
  plugins: [
    react(),
    VitePWA({
      registerType: "autoUpdate",
      includeAssets: [
        "logo.png",
        "padoka-mark.svg",
        "icons/padoka-icon-192.png",
        "icons/padoka-icon-512.png",
        "icons/padoka-icon-maskable-512.png"
      ],
      manifest: {
        name: "Padoka 100",
        short_name: "Padoka 100",
        description: "Controle mobile-first de producao e vendas.",
        theme_color: "#e64332",
        background_color: "#fff8ef",
        display: "standalone",
        orientation: "portrait",
        start_url: "/",
        scope: "/",
        lang: "pt-BR",
        icons: [
          {
            src: "/icons/padoka-icon-192.png",
            sizes: "192x192",
            type: "image/png",
            purpose: "any"
          },
          {
            src: "/icons/padoka-icon-512.png",
            sizes: "512x512",
            type: "image/png",
            purpose: "any"
          },
          {
            src: "/icons/padoka-icon-maskable-512.png",
            sizes: "512x512",
            type: "image/png",
            purpose: "maskable"
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
