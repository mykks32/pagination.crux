import { defineConfig } from 'tsup';

/**
 * Dual CJS + ESM build so both `require('pagination.crux')` and
 * `import ... from 'pagination.crux'` resolve correctly. Bundling (rather
 * than a plain `tsc` ESM pass) avoids the classic dual-package hazard where
 * relative imports without explicit `.js` extensions break under Node's ESM
 * resolver.
 */
export default defineConfig({
  entry: ['src/index.ts'],
  format: ['cjs', 'esm'],
  dts: true,
  sourcemap: true,
  clean: true,
  target: 'es2021',
  splitting: false,
  treeshake: true,
  // Peer dependencies must stay external — a library should never bundle
  // the framework/ODM it plugs into.
  external: ['@nestjs/common', 'mongoose'],
});
