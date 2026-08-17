import { defineConfig } from 'vite';
import { resolve } from 'path';

export default defineConfig({
  // Relative assets allow the original HiKid portal and play shell to run
  // both at localhost / and under the GitHub Pages /EngKid/ project path.
  base: './',
  worker: { format: 'es' },
  build: {
    target: 'esnext',
    rollupOptions: {
      input: {
        index: resolve(__dirname, 'index.html'),
        play: resolve(__dirname, 'play.html'),
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
