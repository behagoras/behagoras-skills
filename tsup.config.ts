import { defineConfig } from 'tsup';

export default defineConfig({
  entry: ['cli/src/index.ts'],
  format: ['esm'],
  target: 'node18',
  outDir: 'cli/dist',
  clean: true,
  splitting: false,
  sourcemap: false,
  dts: false,
  shims: false,
  banner: { js: '#!/usr/bin/env node' },
});
