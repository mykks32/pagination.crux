import { defineConfig } from 'tsup';

export default defineConfig({
  entry: ['src/index.ts'],
  format: ['cjs', 'esm'],
  dts: true,
  sourcemap: true,
  clean: true,
  target: 'es2021',
  splitting: false,
  treeshake: true,
  // Peer dependencies must stay external — never bundle the packages/
  // libraries a consumer is expected to provide themselves.
  external: ['@mykks32/pagination-relay', 'class-transformer', 'class-validator'],
});
