import { copyFileSync, existsSync, mkdirSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import react from '@vitejs/plugin-react';
import { defineConfig } from 'vite';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export default defineConfig({
  plugins: [
    react(),
    {
      name: 'copy-manifest',
      writeBundle() {
        const publicDir = path.join(__dirname, 'src/frontend/public');
        const distDir = path.join(__dirname, 'dist/public');
        if (existsSync(publicDir)) {
          mkdirSync(distDir, { recursive: true });
          copyFileSync(path.join(publicDir, 'manifest.json'), path.join(distDir, 'manifest.json'));
        }
        // Vite preserves the input path structure, so index.html ends up at
        // dist/public/src/frontend/index.html. The Hono SPA fallback expects
        // dist/public/index.html — copy it there.
        const nestedHtml = path.join(distDir, 'src/frontend/index.html');
        const rootHtml = path.join(distDir, 'index.html');
        if (existsSync(nestedHtml)) {
          copyFileSync(nestedHtml, rootHtml);
        }
      },
    },
  ],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
      '@backend': path.resolve(__dirname, './src/backend'),
      '@frontend': path.resolve(__dirname, './src/frontend'),
      '@shared': path.resolve(__dirname, './src/shared'),
    },
  },
  build: {
    outDir: 'dist/public',
    emptyOutDir: true,
    sourcemap: true,
    minify: 'esbuild',
    target: 'es2022',
    rollupOptions: {
      input: {
        main: path.resolve(__dirname, 'src/frontend/index.html'),
      },
    },
  },
  server: {
    port: 5173,
    proxy: {
      '/api': {
        target: 'http://localhost:8080',
        changeOrigin: true,
      },
      '/events': {
        target: 'http://localhost:8080',
        changeOrigin: true,
        ws: true,
      },
    },
  },
});
