import { execSync } from 'node:child_process';

import { PrismaClient } from '@prisma/client';

/** Brings the test database up to the latest migration and empties it once before the run. */
export default async function setup() {
  const url =
    process.env.TEST_DATABASE_URL ?? 'postgresql://taskline:taskline@localhost:5432/taskline_test?schema=public';

  execSync('npx prisma migrate deploy', { stdio: 'inherit', env: { ...process.env, DATABASE_URL: url } });

  const prisma = new PrismaClient({ datasourceUrl: url });
  await prisma.$executeRawUnsafe('TRUNCATE TABLE push_tokens, audit_logs, sessions, tasks, projects, users CASCADE');
  await prisma.$disconnect();
}
