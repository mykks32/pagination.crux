/** @type {import('jest').Config} */
module.exports = {
  preset: 'ts-jest',
  testEnvironment: 'node',
  rootDir: '.',
  testMatch: ['<rootDir>/test/**/*.spec.ts'],
  collectCoverageFrom: ['src/**/*.ts'],
  // The serializer classes use class-transformer's @Type(), which needs the
  // Reflect.getMetadata polyfill. In the real app this comes from main.ts's
  // `import 'reflect-metadata'` (loaded once, process-wide); this package's
  // own isolated test run has no such app to rely on.
  setupFiles: ['reflect-metadata'],
};
