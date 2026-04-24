import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { crx } from '@crxjs/vite-plugin';
import manifest from './manifest.json';

export default defineConfig({
  plugins: [
    react(),
    crx({ manifest: manifest as any }),
  ],
  server: {
    port: 5173,
    strictPort: true,
    hmr: { port: 5173 },
    cors: true,
    headers: {
      'Access-Control-Allow-Origin': '*',
    },
  },
  build: {
    rollupOptions: {
      input: {
        // Mobile PWA — separate entry, kept alongside extension build.
        // Build with: vite build --mode mobile (or open directly in dev)
      },
    },
  },
});
