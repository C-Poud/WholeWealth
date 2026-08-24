import devServer from "@hono/vite-dev-server"
import path from "path"
const __dirname = import.meta.dirname
import react from "@vitejs/plugin-react"
import { defineConfig } from "vite"
import { inspectAttr } from 'kimi-plugin-inspect-react'

// Frontend build config — root is this client/ folder; the backend lives
// in ../server and is bundled separately by esbuild (see package.json).
export default defineConfig({
  root: __dirname,
  plugins: [
    devServer({
      entry: path.resolve(__dirname, "../server/boot.ts"),
      exclude: [/^\/(?!api\/).*$/],
    }),
    inspectAttr(), react()],
  server: {
    port: 3000,
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
