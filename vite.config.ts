import react from '@vitejs/plugin-react';
import { defineConfig, type Plugin } from 'vite';

const CSP = [
  "default-src 'self'",
  "script-src 'self' https://accounts.google.com/gsi/client https://*.firebasedatabase.app https://*.firebaseio.com",
  "style-src 'self' 'unsafe-inline' https://accounts.google.com/gsi/style",
  "connect-src 'self' https://identitytoolkit.googleapis.com https://securetoken.googleapis.com https://*.firebasedatabase.app wss://*.firebasedatabase.app https://*.firebaseio.com wss://*.firebaseio.com https://open.er-api.com https://api.frankfurter.dev https://gmail.googleapis.com https://www.googleapis.com https://accounts.google.com/gsi/",
  'frame-src https://accounts.google.com/gsi/ https://*.firebaseapp.com',
  "img-src 'self' data:",
  "font-src 'self'",
  "base-uri 'none'",
  "form-action 'self'",
].join('; ');

// 本番ビルドにだけ CSP を入れる（開発サーバーの HMR を妨げないため）
const csp: Plugin = {
  name: 'csp',
  apply: 'build',
  transformIndexHtml: () => [
    { tag: 'meta', attrs: { 'http-equiv': 'Content-Security-Policy', content: CSP }, injectTo: 'head-prepend' },
  ],
};

export default defineConfig({
  base: './',
  plugins: process.env.VITE_DEMO === '1' ? [react()] : [react(), csp],
  build: { rollupOptions: { input: ['index.html', 'manual.html'] } },
  test: { include: ['tests/**/*.test.{ts,tsx}'], testTimeout: 30000 },
} as never);
