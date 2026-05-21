import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { resolve } from 'path';
import { readFileSync, writeFileSync, readdirSync } from 'fs';

export default defineConfig({
  plugins: [
    react(),
    {
      name: 'rewrite-manifest',
      closeBundle() {
        const dist = resolve(__dirname, 'dist');
        const manifest = JSON.parse(readFileSync(resolve(__dirname, 'manifest.json'), 'utf-8'));
        const bgFile = readdirSync(resolve(dist, 'assets'))
          .find(f => f.startsWith('background-') && f.endsWith('.js'));
        if (bgFile) {
          manifest.background.service_worker = `assets/${bgFile}`;
          writeFileSync(resolve(dist, 'manifest.json'), JSON.stringify(manifest, null, 2));
        }
      }
    }
  ],
  build: {
    outDir: 'dist',
    emptyOutDir: true,
    rollupOptions: {
      input: {
        popup: resolve(__dirname, 'popup.html'),
        options: resolve(__dirname, 'options.html'),
        background: resolve(__dirname, 'src/background.ts'),
      },
      output: {
        entryFileNames: 'assets/[name]-[hash].js',
        assetFileNames: 'assets/[name]-[hash].[ext]',
      },
    },
  },
});
