import { hashPassword } from '../src/modules/auth/auth.service.js';
import { pool } from '../src/shared/database.js';

async function main(): Promise<void> {
  const username = process.env.SEED_USERNAME?.trim();
  const password = process.env.SEED_PASSWORD;

  if (!username || username.length > 80) {
    throw new Error('Define SEED_USERNAME con un usuario de hasta 80 caracteres.');
  }

  if (!password || password.length < 12) {
    throw new Error('SEED_PASSWORD debe tener al menos 12 caracteres.');
  }

  const passwordHash = await hashPassword(password);

  await pool.query(
    `INSERT INTO users (username, password_hash)
     VALUES ($1, $2)
     ON CONFLICT (username)
     DO UPDATE SET password_hash = EXCLUDED.password_hash`,
    [username, passwordHash],
  );

  console.log(`Usuario de prueba preparado: ${username}`);
}

main()
  .catch((error: unknown) => {
    console.error(
      'No se pudo preparar el usuario de prueba:',
      error instanceof Error ? error.message : 'Error desconocido',
    );
    process.exitCode = 1;
  })
  .finally(async () => {
    await pool.end();
  });
