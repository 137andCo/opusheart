import type { Config } from 'jest';

const config: Config = {
  preset: 'ts-jest/presets/default-esm',
  testEnvironment: 'node',
  roots: ['<rootDir>/packages/', '<rootDir>/verticals/'],
  testMatch: ['**/tests/**/*.test.ts'],
  // Server tests share a single mongoose connection to a real MongoDB instance,
  // so they must run sequentially to avoid connection races.
  maxWorkers: 1,
  moduleDirectories: ['node_modules', 'packages/server/node_modules', 'packages/shared/node_modules'],
  moduleNameMapper: {
    '^(\\.{1,2}/.*)\\.js$': '$1',
    '^@opusheart/ai$': '<rootDir>/packages/ai/src/index.ts',
    '^@opusheart/ai/(.*)\\.js$': '<rootDir>/packages/ai/src/$1',
    '^@opusheart/ai/(.*)$': '<rootDir>/packages/ai/src/$1',
    '^@opusheart/shared$': '<rootDir>/packages/shared/src/index.ts',
    '^@opusheart/shared/(.*)\\.js$': '<rootDir>/packages/shared/src/$1',
    '^@opusheart/shared/(.*)$': '<rootDir>/packages/shared/src/$1',
    '^@opusheart/vertical-church$': '<rootDir>/verticals/church/src/index.ts',
    '^@opusheart/builder$': '<rootDir>/packages/builder/src/index.ts',
    '^@opusheart/connect$': '<rootDir>/packages/connect/src/index.ts',
  },
  transform: {
    '^.+\\.tsx?$': ['ts-jest', {
      useESM: true,
      tsconfig: 'tsconfig.test.json',
      diagnostics: false,
    }],
  },
  extensionsToTreatAsEsm: ['.ts'],
  setupFiles: ['dotenv/config'],
  forceExit: true,
  coverageDirectory: 'coverage',
  coveragePathIgnorePatterns: ['/node_modules/', '/dist/'],
};

export default config;
