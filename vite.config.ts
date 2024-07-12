import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import basicSsl from '@vitejs/plugin-basic-ssl';
import { nodePolyfills } from 'vite-plugin-node-polyfills';
import stringReplace from 'vite-plugin-string-replace';

export default defineConfig({
  plugins: [
    nodePolyfills({
      include: ['buffer'],
    }),
    react(),
    basicSsl(),
    stringReplace([
      {
        search: '\\033\\[40m  \\033\\[0m',
        replace: '\\x1b[40m  \\x1b[0m'
      },
      {
        search: '\\033\\[47m  \\033\\[0m',
        replace: '\\x1b[47m  \\x1b[0m'
      }
    ]),
  ],
  build: {
    outDir: './docs',
  },
  resolve: {
    alias: {
      // This is required for the polyfill to work
      buffer: 'buffer',
    },
  },
  base: '/vite-boilerplate/',
});