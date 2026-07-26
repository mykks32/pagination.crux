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
  external: ['@nestjs/common', 'class-transformer', 'class-validator', 'mongoose'],
});
