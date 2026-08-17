import { defineConfig, type Plugin } from 'vite';
import { resolve } from 'path';

function englishOnlyPortalCopy(): Plugin {
  const replacements: Array<[string, string]> = [
    ['\u6b22\u8fce\u6765\u5230\u82f1\u8bed\u573a\u666f\u4e16\u754c', 'Welcome to your English adventure'],
    ['\u5728\u8fd9\u91cc\uff0c\u5b69\u5b50\u53ef\u4ee5\u8fdb\u5165\u4e0d\u540c\u7684 3D \u573a\u666f\uff0c\u4e00\u8fb9\u63a2\u7d22\uff0c\u4e00\u8fb9\u5f00\u53e3\u7ec3\u4e60\u82f1\u8bed\u3002', 'Explore different 3D worlds and practice speaking English as you play.'],
    ['\u9009\u62e9\u4e00\u4e2a\u573a\u666f', 'Choose a scene'],
    ['\u70b9\u51fb\u5df2\u7ecf\u89e3\u9501\u7684\u573a\u666f\u5361\u7247\u5f00\u59cb\u5b66\u4e60\u3002\u6bcf\u4e2a\u573a\u666f\u90fd\u6709\u4e0d\u540c\u7684\u751f\u6d3b\u4e3b\u9898\u548c\u82f1\u8bed\u4efb\u52a1\u3002', 'Tap an unlocked scene card to begin. Each world has its own theme and English missions.'],
    ['\u83b7\u5f97\u661f\u661f', 'Earn stars'],
    ['\u548c NPC \u5bf9\u8bdd\u3001\u8bf4\u51fa\u5408\u9002\u7684\u53e5\u5b50\u3001\u5b8c\u6210\u4efb\u52a1\u540e\uff0c\u5c31\u80fd\u83b7\u5f97\u661f\u661f\u79ef\u5206\u3002', 'Talk with NPCs, use useful English, and complete missions to earn stars.'],
    ['\u6536\u96c6\u5355\u8bcd', 'Collect words'],
    ['\u627e\u5230\u8bcd\u6c47\u7269\u4ef6\u540e\uff0c\u5b83\u4eec\u4f1a\u8fdb\u5165\u8bcd\u6c47\u56fe\u9274\u3002\u8fdb\u5ea6\u548c\u6570\u636e\u4f1a\u4fdd\u5b58\u5728\u5f53\u524d\u6d4f\u89c8\u5668\u91cc\u3002', 'Vocabulary objects you find are added to your collection. Progress stays in this browser.'],
  ];

  return {
    name: 'engkid-english-only-portal-copy',
    enforce: 'pre',
    transform(code, id) {
      if (!id.replace(/\\/g, '/').endsWith('/src/portal/portal.ts')) return null;
      let transformed = code;
      for (const [from, to] of replacements) {
        transformed = transformed.split(from).join(to);
      }
      return transformed === code ? null : { code: transformed, map: null };
    },
  };
}

export default defineConfig({
  // Relative assets allow the original HiKid portal and play shell to run
  // both at localhost / and under the GitHub Pages /EngKid/ project path.
  base: './',
  plugins: [englishOnlyPortalCopy()],
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
