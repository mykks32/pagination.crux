// @ts-check
const js = require('@eslint/js');
const tseslint = require('typescript-eslint');
const eslintConfigPrettier = require('eslint-config-prettier');

module.exports = tseslint.config(
  {
    ignores: ['**/dist/**', '**/node_modules/**', '**/coverage/**'],
  },
  js.configs.recommended,
  ...tseslint.configs.recommended,
  eslintConfigPrettier,
  {
    rules: {
      '@typescript-eslint/no-unused-vars': ['warn', { argsIgnorePattern: '^_', varsIgnorePattern: '^_' }],
      '@typescript-eslint/consistent-type-imports': ['warn', { prefer: 'type-imports' }],
    },
  },
  {
    // NestJS relies on `emitDecoratorMetadata`/`reflect-metadata` for DI and
    // for `ValidationPipe` to know a `@Body()`/`@Query()` parameter's DTO
    // class — both need the class imported as a real (non-type-only) value,
    // even though it may only ever appear in a type position in the source.
    // `consistent-type-imports` can't see that runtime need and would flag
    // (and an automated `lint:fix` would silently "fix") those imports into
    // `import type`, breaking DI/validation at runtime. `packages/*` have no
    // such decorator-metadata usage, so the rule stays on there.
    files: ['apps/notes-api/**/*.ts'],
    rules: {
      '@typescript-eslint/consistent-type-imports': 'off',
    },
  },
);
