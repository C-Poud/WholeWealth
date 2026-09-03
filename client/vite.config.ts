import devServer from "@hono/vite-dev-server"
import path from "path"
const __dirname = import.meta.dirname
import react from "@vitejs/plugin-react"
import { defineConfig } from "vite"
import { VitePWA } from "vite-plugin-pwa"

// Frontend build config — root is this client/ folder; the backend lives
// in ../server and is bundled separately by esbuild (see package.json).
export default defineConfig({
  root: __dirname,
  plugins: [
    devServer({
      entry: path.resolve(__dirname, "../server/boot.ts"),
      exclude: [/^\/(?!api\/).*$/],
    }),
    react(),
    VitePWA({
      registerType: "autoUpdate",
      includeAssets: ["favicon.svg", "logo.svg", "apple-touch-icon.png"],
      manifest: {
        id: "/",
        name: "WholeWealth Portfolio & Options",
        short_name: "WholeWealth",
        description: "Portfolio and options analytics terminal with live broker sync, probability cones, and risk metrics.",
        theme_color: "#0c0c0e",
        background_color: "#0c0c0e",
        display: "standalone",
        orientation: "portrait",
        start_url: "/",
        scope: "/",
        categories: ["finance", "productivity", "utilities"],
        icons: [
          {
            src: "/pwa-192x192.png",
            sizes: "192x192",
            type: "image/png",
            purpose: "any",
          },
          {
            src: "/pwa-512x512.png",
            sizes: "512x512",
            type: "image/png",
            purpose: "any",
          },
          {
            src: "/pwa-maskable-512x512.png",
            sizes: "512x512",
            type: "image/png",
            purpose: "maskable",
          },
        ],
      },
      workbox: {
        globPatterns: ["**/*.{js,css,html,ico,png,svg,woff,woff2}"],
        navigateFallback: "/index.html",
        navigateFallbackDenylist: [/^\/api/],
        runtimeCaching: [
          {
            urlPattern: /^https:\/\/fonts\.googleapis\.com\/.*/i,
            handler: "CacheFirst",
            options: {
              cacheName: "google-fonts-cache",
              expiration: {
                maxEntries: 10,
                maxAgeSeconds: 60 * 60 * 24 * 365,
              },
              cacheableResponse: {
                statuses: [0, 200],
              },
            },
          },
          {
            urlPattern: /^https:\/\/fonts\.gstatic\.com\/.*/i,
            handler: "CacheFirst",
            options: {
              cacheName: "gstatic-fonts-cache",
              expiration: {
                maxEntries: 10,
                maxAgeSeconds: 60 * 60 * 24 * 365,
              },
              cacheableResponse: {
                statuses: [0, 200],
              },
            },
          },
        ],
      },
      devOptions: {
        enabled: true,
        type: "module",
      },
    }),
  ],
  server: {
    host: "0.0.0.0",
    port: 3000,
    allowedHosts: true,
  },
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
      "@contracts": path.resolve(__dirname, "../contracts"),
      "@db": path.resolve(__dirname, "../server/db"),
      "db": path.resolve(__dirname, "../server/db"),
    },
  },
  css: {
    postcss: path.resolve(__dirname, "postcss.config.js"),
  },
  envDir: path.resolve(__dirname, ".."),
  build: {
    outDir: path.resolve(__dirname, "../dist/public"),
    emptyOutDir: true,
  },
});
