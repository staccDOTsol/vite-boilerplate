import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import basicSsl from '@vitejs/plugin-basic-ssl'
import { NodeModulesPolyfillPlugin } from '@esbuild-plugins/node-modules-polyfill'

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [
    react(),
    basicSsl(),
    NodeModulesPolyfillPlugin({
      // To polyfill Buffer globally
      buffer: true
    })
  ],
  build: {
    outDir: './docs'
  },
  base: '/vite-boilerplate/'
});