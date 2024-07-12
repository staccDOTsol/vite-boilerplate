import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import basicSsl from '@vitejs/plugin-basic-ssl';
import { nodePolyfills } from 'vite-plugin-node-polyfills';

export default defineConfig({
  plugins: [
    nodePolyfills({
      include: ['buffer'],
    }),
    react(),
    basicSsl()
  ],
  build: {
    outDir: './docs'
  },
  resolve: {
    alias: {
      // This is required for the polyfill to work
      buffer: 'buffer',
    },
  },
  base: '/'
});
