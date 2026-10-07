import bcrypt from 'bcryptjs';

import { env } from '../config/env';

export function hashPassword(plain: string) {
  return bcrypt.hash(plain, env.BCRYPT_ROUNDS);
}

export function verifyPassword(plain: string, hash: string) {
  return bcrypt.compare(plain, hash);
}

// Compared against when the email doesn't exist, so a login for an unknown account takes
// as long as one with a wrong password and response times don't reveal which emails are registered.
const DUMMY_HASH = bcrypt.hashSync('timing-equaliser-not-a-real-password', env.BCRYPT_ROUNDS);

export async function burnPasswordCheck(plain: string) {
  await bcrypt.compare(plain, DUMMY_HASH);
  return false;
}
