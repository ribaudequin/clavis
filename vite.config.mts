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
    rollupOptions: {
      output: {
        manualChunks: (id) => {
          if (id.includes('node_modules')) {
            if (id.includes('react') || id.includes('react-dom')) {
              return 'react-vendor';
            }
            if (id.includes('react-hot-toast')) {
              return 'toast-vendor';
            }
            return 'vendor';
          }
        },
      },
    },
    chunkSizeWarningLimit: 500,
  },
  clearScreen: false,
});
