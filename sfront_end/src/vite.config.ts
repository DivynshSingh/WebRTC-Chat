import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite'
import { nodePolyfills } from 'vite-plugin-node-polyfills';// need this, for some libraries that depend on stuff, that does not exist in browser, so add them here
export default defineConfig({
  plugins: [
    tailwindcss(),
    react(),
     nodePolyfills({
      exclude: [],
      globals: {
        process: true,
        Buffer: true,
      },
      protocolImports: true,
    }),
  ],
})