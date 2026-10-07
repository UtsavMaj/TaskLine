import { defineConfig } from 'tsup';

// The shared package ships TypeScript source, so it is bundled into the server build
// instead of being required at runtime. Everything else stays in node_modules.
export default defineConfig({
  entry: ['src/server.ts'],
  format: ['esm'],
  target: 'node20',
  platform: 'node',
  outDir: 'dist',
  clean: true,
  sourcemap: true,
  noExternal: ['@taskline/shared'],
});
