import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';

export default defineConfig({
  base: './',
  plugins: [react()],
  build: {
    outDir: 'site',
    sourcemap: true,
  },
  test: {
    environment: 'jsdom',
    coverage: {
      reporter: ['text', 'json-summary'],
    },
  },
});
