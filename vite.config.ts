import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import svgr from 'vite-plugin-svgr';

export default defineConfig({
  root: 'src/renderer',
  base: './',
  plugins: [react(), svgr()],
  server: {
    port: 3000,
  },
  build: {
    outDir: '../../dist/renderer',
    emptyOutDir: true,
  },
  clearScreen: false,
});
