import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { resolve } from 'path';

// Mobile PWA build — independent from the Chrome extension.
// Run: pnpm dev:mobile  (serves src/mobile/index.html on http://localhost:5174)
//      pnpm build:mobile (outputs to dist-mobile/)
//
// publicDir로 manifest.webmanifest / sw.js / icons/ 자동 포함.
// PWA 설치/오프라인 동작을 위해선 HTTPS 환경 필요 (dev:mobile은 LAN HTTP로 충분, 폰에서
// 홈화면 추가하려면 ngrok 등으로 HTTPS 터널 사용).
export default defineConfig({
  root: resolve(__dirname, 'src/mobile'),
  // publicDir 안의 파일은 빌드 시 그대로 dist-mobile/로 복사됨
  publicDir: resolve(__dirname, 'src/mobile/public'),
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
