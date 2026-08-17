import { defineConfig } from 'vite';
import { resolve } from 'path';

export default defineConfig({
  // Relative assets make the MVP work both on a custom domain and under /EngKid/ on GitHub Pages.
  base: './',
  worker: { format: 'es' },
  build: {
    target: 'esnext',
    rollupOptions: {
      input: {
        index: resolve(__dirname, 'index.html'),
        play: resolve(__dirname, 'play.html'),
        spaceRescue: resolve(__dirname, 'space-rescue.html'),
      },
    },
  },
  server: {
    port: 5173,
    headers: {
      'Cross-Origin-Opener-Policy': 'same-origin',
      'Cross-Origin-Embedder-Policy': 'require-corp',
    },
    proxy: {
      '/api': {
        target: 'http://localhost:3001',
        changeOrigin: true,
      },
    },
  },
});
