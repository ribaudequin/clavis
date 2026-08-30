import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  root: 'src/renderer',
  base: './',
  plugins: [react()],
  server: {
    port: 3000,
  },
  build: {
    outDir: '../../dist/renderer',
    emptyOutDir: true,
  },
  clearScreen: false,
});
