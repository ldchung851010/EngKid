import { defineConfig } from 'vite';
import path from 'path';

export default defineConfig({
  base: '/',
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
  worker: { format: 'es' },
  build: { target: 'esnext' },
  assetsInclude: ['**/*.wasm'],
  server: {
    port: 5173,
    proxy: {
      '/api': {
        target: 'http://localhost:3001',
        changeOrigin: true,
      },
    },
  },
  plugins: [
    {
      name: 'onnx-wasm-plugin',
      configureServer(server) {
        server.middlewares.use('/onnx-runtime', (req, _res, next) => {
          if (req.url?.includes('?import')) {
            req.url = req.url.replace('?import', '');
          }
          next();
        });
      },
    },
  ],
});
