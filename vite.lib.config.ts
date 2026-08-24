import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { resolve } from 'node:path';

export default defineConfig({
  plugins: [react()],
  build: {
    lib: {
      entry: resolve(import.meta.dirname, 'src/index.ts'),
      name: 'CosmicCalendar',
      formats: ['es', 'cjs'],
      fileName: (format) => format === 'es' ? 'cosmic-calendar.js' : 'cosmic-calendar.cjs',
    },
    rollupOptions: {
      external: ['react', 'react-dom', 'three'],
      output: {
        globals: {
          react: 'React',
          'react-dom': 'ReactDOM',
          three: 'THREE',
        },
        assetFileNames: (assetInfo) =>
          assetInfo.name?.endsWith('.css') ? 'cosmic-calendar.css' : 'assets/[name]-[hash][extname]',
      },
    },
    sourcemap: true,
    emptyOutDir: false,
  },
});
