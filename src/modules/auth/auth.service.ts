import { randomBytes, scrypt as scryptCallback, timingSafeEqual } from 'node:crypto';
import { promisify } from 'node:util';
import {
  createSession,
  findSessionByToken,
  findUserByUsername,
  findUserById,
  deleteSession,
} from './auth.repository.js';

const scrypt = promisify(scryptCallback);
const SESSION_DURATION_MS = 8 * 60 * 60 * 1000;

export interface AuthenticatedUser {
  id: number;
  username: string;
}

export async function hashPassword(password: string): Promise<string> {
  const salt = randomBytes(16).toString('hex');
  const derivedKey = (await scrypt(password, salt, 64)) as Buffer;

  return `${salt}:${derivedKey.toString('hex')}`;
}

export async function verifyPassword(password: string, storedHash: string): Promise<boolean> {
  const [salt, keyHex] = storedHash.split(':');

  if (!salt || !keyHex || !/^[a-f0-9]{128}$/i.test(keyHex)) {
    return false;
  }

  const expectedKey = Buffer.from(keyHex, 'hex');
  const actualKey = (await scrypt(password, salt, 64)) as Buffer;

  return timingSafeEqual(actualKey, expectedKey);
}

export async function login(
  username: string,
  password: string,
): Promise<{ token: string; user: AuthenticatedUser } | null> {
  const normalizedUsername = username.trim();
  const user = await findUserByUsername(normalizedUsername);

  if (!user || !(await verifyPassword(password, user.password_hash))) {
    return null;
  }

  const token = randomBytes(32).toString('hex');
  const expiresAt = new Date(Date.now() + SESSION_DURATION_MS);

  await createSession(user.id, token, expiresAt);

  return {
    token,
    user: { id: user.id, username: user.username },
  };
}

export async function getCurrentUser(token: string): Promise<AuthenticatedUser | null> {
  const session = await findSessionByToken(token);

  if (!session) {
    return null;
  }

  const user = await findUserById(session.user_id);

  if (!user) {
    return null;
  }

  return { id: user.id, username: user.username };
}

export async function logout(token: string): Promise<void> {
  await deleteSession(token);
}
