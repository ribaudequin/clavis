import { build } from 'vite';
import { rm } from 'node:fs/promises';

const outDir = 'dist/main';

await build({
  configFile: false,
  build: {
    outDir,
    emptyOutDir: false,
    minify: false,
    sourcemap: true,
    lib: {
      entry: 'src/main/preload/index.ts',
      formats: ['cjs'],
      fileName: () => 'preload.js',
    },
    rollupOptions: {
      external: ['electron'],
    },
  },
});

await rm('dist/main/preload', { recursive: true, force: true });
