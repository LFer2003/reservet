import { createHash } from 'node:crypto';
import { pool } from '../../shared/database.js';

export interface User {
  id: number;
  username: string;
  password_hash: string;
}

export interface Session {
  id: number;
  user_id: number;
  token_hash: string;
  expires_at: Date;
}

export async function findUserByUsername(username: string): Promise<User | null> {
  const result = await pool.query<User>(
    `SELECT id, username, password_hash
     FROM users
     WHERE username = $1`,
    [username],
  );

  return result.rows[0] ?? null;
}

export async function findUserById(id: number): Promise<User | null> {
  const result = await pool.query<User>(
    `SELECT id, username, password_hash
     FROM users
     WHERE id = $1`,
    [id],
  );

  return result.rows[0] ?? null;
}

export async function createUser(username: string, passwordHash: string): Promise<User> {
  const result = await pool.query<User>(
    `INSERT INTO users (username, password_hash)
     VALUES ($1, $2)
     RETURNING id, username, password_hash`,
    [username, passwordHash],
  );

  return result.rows[0]!;
}

export async function createSession(userId: number, token: string, expiresAt: Date): Promise<void> {
  const tokenHash = createHash('sha256').update(token).digest('hex');

  await pool.query(
    `INSERT INTO sessions (user_id, token_hash, expires_at)
     VALUES ($1, $2, $3)`,
    [userId, tokenHash, expiresAt],
  );
}

export async function findSessionByToken(token: string): Promise<Session | null> {
  const tokenHash = createHash('sha256').update(token).digest('hex');

  const result = await pool.query<Session>(
    `SELECT id, user_id, token_hash, expires_at
     FROM sessions
     WHERE token_hash = $1 AND expires_at > now()`,
    [tokenHash],
  );

  return result.rows[0] ?? null;
}

export async function deleteSession(token: string): Promise<void> {
  const tokenHash = createHash('sha256').update(token).digest('hex');

  await pool.query('DELETE FROM sessions WHERE token_hash = $1', [tokenHash]);
}
