import { defineConfig } from 'vite';

// Relative base so the build works at any GitHub Pages sub-path.
export default defineConfig({
  base: './',
  build: {
    target: 'es2020',
    assetsInlineLimit: 0,
    chunkSizeWarningLimit: 900,
  },
});
