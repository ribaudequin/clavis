import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { writeFileSync, mkdirSync, readdirSync, copyFileSync } from 'fs';
import path from 'path';

export default defineConfig({
  root: 'src/renderer',
  base: './',
  plugins: [
    react(),
    {
      name: 'copy-svg-assets',
      generateBundle(options, bundle) {
        const srcDir = path.resolve(__dirname, '../icons/svg');
        const destDir = path.resolve(options.dir, 'assets/icons/svg');
        mkdirSync(destDir, { recursive: true });
        const files = readdirSync(srcDir).filter(f => f.endsWith('.svg'));
        for (const file of files) {
          copyFileSync(path.join(srcDir, file), path.join(destDir, file));
        }
      }
    }
  ],
  server: {
    port: 3000,
  },
  build: {
    outDir: '../../dist/renderer',
    emptyOutDir: true,
    assetsInclude: ['**/*.svg', '**/*.png'],
    rollupOptions: {
      output: {
        assetFileNames: 'assets/[name].[ext]'
      }
    }
  },
  clearScreen: false,
});
