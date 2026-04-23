import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { resolve } from 'path';

// Mobile PWA build — independent from the Chrome extension.
// Run: pnpm dev:mobile  (serves src/mobile/index.html on http://localhost:5174)
//      pnpm build:mobile (outputs to dist-mobile/)
export default defineConfig({
  root: resolve(__dirname, 'src/mobile'),
  plugins: [react()],
  server: {
    port: 5174,
    strictPort: true,
    host: true, // expose on LAN so a phone can connect
    allowedHosts: true, // ngrok/터널링 허용
  },
  build: {
    outDir: resolve(__dirname, 'dist-mobile'),
    emptyOutDir: true,
  },
});
