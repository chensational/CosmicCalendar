import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { resolve } from 'node:path';

export default defineConfig({
  plugins: [react()],
  define: {
    __COSMIC_CALENDAR_LIBRARY__: 'true',
  },
  build: {
    lib: {
      entry: resolve(import.meta.dirname, 'src/index.ts'),
      name: 'CosmicCalendar',
      formats: ['es', 'cjs'],
      fileName: (format) => format === 'es' ? 'cosmic-calendar.js' : 'cosmic-calendar.cjs',
    },
    rollupOptions: {
      external: (id) =>
        id === 'react' || id.startsWith('react/') ||
        id === 'react-dom' || id.startsWith('react-dom/') ||
        id === 'three' || id.startsWith('three/'),
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
