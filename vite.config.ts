import { defineConfig } from 'vite';

export default defineConfig({
  base: '/',
  worker: { format: 'es' },
  build: { target: 'esnext' },
  server: {
    port: 5173,
    proxy: {
      '/api': {
        target: 'http://localhost:3001',
        changeOrigin: true,
      },
    },
  },
});
