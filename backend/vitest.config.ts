import { defineConfig } from 'vitest/config';

// Integration tests hit a real PostgreSQL database (TEST_DATABASE_URL), migrated once in globalSetup.
// Files run one after another because they share that database.
const testDatabaseUrl =
  process.env.TEST_DATABASE_URL ?? 'postgresql://taskline:taskline@localhost:5432/taskline_test?schema=public';

export default defineConfig({
  test: {
    environment: 'node',
    include: ['tests/**/*.test.ts'],
    globalSetup: ['tests/global-setup.ts'],
    fileParallelism: false,
    testTimeout: 20_000,
    hookTimeout: 60_000,
    env: {
      NODE_ENV: 'test',
      DATABASE_URL: testDatabaseUrl,
      JWT_ACCESS_SECRET: 'test-secret-that-is-long-enough-for-hs256-signing',
      BCRYPT_ROUNDS: '4',
      AUTH_RATE_LIMIT_MAX: '10',
      API_RATE_LIMIT_MAX: '10000',
      CORS_ORIGINS: 'http://localhost:5173',
      LOG_LEVEL: 'silent',
    },
  },
});
