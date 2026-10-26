/// <reference types="vitest" />
import { defineConfig } from 'vite';

export default defineConfig({
  base: './',
  server: { port: 5173, host: true },
  build: {
    target: 'es2020',
    chunkSizeWarningLimit: 1200,
    rollupOptions: { output: { manualChunks: undefined } },
  },
  test: {
    environment: 'node',
    include: ['src/**/*.test.ts'],
  },
});
