/**
 * Standard Nest CLI jest config: spec files live next to the source they
 * test (e.g. `notes.service.ts` + `notes.service.spec.ts`), so `rootDir` is
 * `src` and `testRegex` picks up any `*.spec.ts` under it.
 * @type {import('jest').Config}
 */
module.exports = {
  moduleFileExtensions: ['js', 'json', 'ts'],
  rootDir: 'src',
  testRegex: '.*\\.spec\\.ts$',
  transform: {
    '^.+\\.(t|j)s$': 'ts-jest',
  },
  collectCoverageFrom: ['**/*.(t|j)s'],
  coverageDirectory: '../coverage',
  testEnvironment: 'node',
};
