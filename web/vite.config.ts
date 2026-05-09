/// <reference types="vitest" />
import path, { resolve } from "path";
import { fileURLToPath } from "url";
import { dirname } from "path";
import { createRequire } from "module";
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react-swc";

const require = createRequire(import.meta.url);
const monacoEditorPlugin = require("vite-plugin-monaco-editor").default;

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const proxyHost = process.env.PROXY_HOST || "localhost:5000";

// https://vitejs.dev/config/
export default defineConfig({
  define: {
    "import.meta.vitest": "undefined",
  },
  server: {
  proxy: {
    "/api": {
      target: "http://localhost:5000",
      changeOrigin: true,
    },

     "/clips": {
      target: "http://localhost:5000",
      changeOrigin: true,
    },

    "/recordings": {
      target: "http://localhost:5000",
      changeOrigin: true,
    },

     "/preview": {
      target: "http://localhost:5000",
      changeOrigin: true,
    },

    "/live": {
      target: "http://localhost:5000",
      changeOrigin: true,
    },

    "/ws": {
      target: "ws://localhost:5000",
      ws: true,
      changeOrigin: true,
    },

    "/live/jsmpeg": {
      target: "ws://localhost:5000",
      ws: true,
      changeOrigin: true,
    },
  },
},

  build: {
    rollupOptions: {
      input: {
        main: resolve(__dirname, "index.html"),
        login: resolve(__dirname, "login.html"),
      },
    },
  },
  plugins: [
    react(),
    monacoEditorPlugin({
      customWorkers: [{ label: "yaml", entry: "monaco-yaml/yaml.worker" }],
      languageWorkers: ["editorWorkerService"], // we don't use any of the default languages
    }),
  ],
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
  test: {
    environment: "jsdom",
    alias: {
      "testing-library": path.resolve(
        __dirname,
        "./__test__/testing-library.js",
      ),
    },
    setupFiles: ["./__test__/test-setup.ts"],
    includeSource: ["src/**/*.{js,jsx,ts,tsx}"],
    coverage: {
      reporter: ["text-summary", "text"],
    },
    mockReset: true,
    restoreMocks: true,
    globals: true,
  },
});
