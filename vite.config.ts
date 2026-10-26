import { defineConfig } from "vite";

export default defineConfig({
  optimizeDeps: {
    // O Havok carrega o próprio .wasm; o pré-bundle do Vite quebraria esse caminho.
    exclude: ["@babylonjs/havok"],
  },
  build: {
    target: "es2022",
    // Babylon é grande por natureza; evita avisos de chunk sem utilidade.
    chunkSizeWarningLimit: 6000,
  },
});
