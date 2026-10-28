import assert from 'node:assert/strict';
import { test } from 'node:test';
import { randomUUID } from 'node:crypto';
import { readFile, readdir } from 'node:fs/promises';
import pg from 'pg';
import 'dotenv/config';

const target = process.env.TEST_DATABASE_URL;
if (!target)
  throw new Error('Define TEST_DATABASE_URL; se requiere una base exclusiva terminada en _test.');
const url = new URL(target);
if (
  !url.pathname.endsWith('_test') ||
  url.pathname === new URL(process.env.DATABASE_URL).pathname
) {
  throw new Error('La base de integración debe terminar en _test y ser distinta de DATABASE_URL.');
}
// Cada ejecución aísla sus datos. Nunca se truncan tablas existentes.
const schema = `test_${randomUUID().replaceAll('-', '')}`;
const admin = new pg.Pool({ connectionString: target });
url.searchParams.set('options', `-c search_path=${schema}`);
process.env.DATABASE_URL = url.href;
const { app } = await import('../../src/app.ts');
const { pool } = await import('../../src/shared/database.ts');
const { hashPassword } = await import('../../src/modules/auth/auth.service.ts');

test('autenticación, mesas y persistencia con PostgreSQL real', async (t) => {
  let server;
  let base;
  let cookie = '';
  const start = async () => {
    server = app.listen(0, '127.0.0.1');
    await new Promise((resolve) => server.once('listening', resolve));
    base = `http://127.0.0.1:${server.address().port}`;
  };
  const stop = () =>
    new Promise((resolve, reject) => server.close((error) => (error ? reject(error) : resolve())));
  const request = (path, method = 'GET', body, authenticated = true) =>
    fetch(`${base}/api${path}`, {
      method,
      headers: {
        'Content-Type': 'application/json',
        ...(authenticated && cookie ? { Cookie: cookie } : {}),
      },
      ...(body === undefined ? {} : { body: JSON.stringify(body) }),
    });
  try {
    await admin.query(`CREATE SCHEMA ${schema}`);
    const directory = new URL('../../migrations/', import.meta.url);
    for (const file of (await readdir(directory)).filter((name) => name.endsWith('.sql')).sort()) {
      await pool.query(await readFile(new URL(file, directory), 'utf8'));
    }
    const password = randomUUID();
    await pool.query('INSERT INTO users(username, password_hash) VALUES ($1, $2)', [
      'integration',
      await hashPassword(password),
    ]);
    await start();
    await t.test('todos los endpoints de mesas requieren sesión', async () => {
      for (const [path, method, body] of [
        ['/tables', 'GET'],
        ['/tables', 'POST', {}],
        ['/tables/1/status', 'PATCH', {}],
      ]) {
        assert.equal((await request(path, method, body, false)).status, 401);
      }
    });
    await t.test('login incorrecto y correcto, cookie y sesión actual', async () => {
      assert.equal(
        (await request('/auth/login', 'POST', { username: 'integration', password: 'wrong' }))
          .status,
        401,
      );
      assert.equal(
        (await request('/auth/login', 'POST', { username: 'unknown', password })).status,
        401,
      );
      const response = await request('/auth/login', 'POST', { username: 'integration', password });
      assert.equal(response.status, 200);
      assert.match(response.headers.get('set-cookie'), /HttpOnly/);
      assert.match(response.headers.get('set-cookie'), /SameSite=Lax/);
      cookie = response.headers.get('set-cookie').split(';')[0];
      assert.equal((await (await request('/auth/me')).json()).user.username, 'integration');
    });
    let created;
    await t.test('crear, listar y cambiar estado', async () => {
      const response = await request('/tables', 'POST', { name: 'Terraza', capacity: 4 });
      assert.equal(response.status, 201);
      created = await response.json();
      assert.equal(created.status, 'available');
      assert.equal((await (await request('/tables')).json()).length, 1);
      for (const status of ['occupied', 'out_of_service', 'available']) {
        const result = await request(`/tables/${created.id}/status`, 'PATCH', { status });
        assert.equal(result.status, 200);
        assert.equal((await result.json()).status, status);
      }
    });
    await t.test('validaciones, duplicados y mesa inexistente', async () => {
      for (const body of [
        { name: '', capacity: 4 },
        { name: ' '.repeat(4), capacity: 4 },
        { name: 'x'.repeat(81), capacity: 4 },
        ...[0, 21, 1.5, '4', null].map((capacity) => ({ name: 'Otra', capacity })),
      ]) {
        assert.equal((await request('/tables', 'POST', body)).status, 400);
      }
      assert.equal(
        (await request('/tables', 'POST', { name: 'Terraza', capacity: 4 })).status,
        409,
      );
      assert.equal(
        (await request('/tables/2147483647/status', 'PATCH', { status: 'occupied' })).status,
        404,
      );
      assert.equal(
        (await request('/tables/2147483648/status', 'PATCH', { status: 'occupied' })).status,
        404,
      );
      for (const id of ['0', '-1', '1.5', 'abc']) {
        assert.equal(
          (await request(`/tables/${id}/status`, 'PATCH', { status: 'occupied' })).status,
          400,
        );
      }
      assert.equal(
        (await request(`/tables/${created.id}/status`, 'PATCH', { status: 'invalid' })).status,
        400,
      );
    });
    await t.test('acepta nombres de 80 caracteres y capacidades límite', async () => {
      for (const [name, capacity] of [
        ['x'.repeat(80), 1],
        ['Capacidad máxima', 20],
      ]) {
        const response = await request('/tables', 'POST', { name, capacity });
        assert.equal(response.status, 201);
        const table = await response.json();
        assert.equal(table.name, name);
        assert.equal(table.capacity, capacity);
        assert.equal(table.status, 'available');
      }
    });
    await t.test(
      'mesas y sesión sobreviven al reinicio del servidor HTTP y a otra conexión',
      async () => {
        await stop();
        await start();
        assert.equal((await (await request('/tables')).json())[0].id, created.id);
        const independent = new pg.Pool({ connectionString: url.href });
        try {
          assert.equal(
            (
              await independent.query('SELECT name FROM restaurant_tables WHERE id = $1', [
                created.id,
              ])
            ).rows[0].name,
            'Terraza',
          );
        } finally {
          await independent.end();
        }
      },
    );
    await t.test('logout revoca el token y las sesiones caducadas se rechazan', async () => {
      assert.equal((await request('/auth/logout', 'POST')).status, 200);
      assert.equal((await request('/auth/me')).status, 401);
      assert.equal((await request('/tables')).status, 401);
      const response = await request('/auth/login', 'POST', { username: 'integration', password });
      cookie = response.headers.get('set-cookie').split(';')[0];
      await pool.query("UPDATE sessions SET expires_at = now() - interval '1 second'");
      assert.equal((await request('/tables')).status, 401);
    });
  } finally {
    if (server?.listening) await stop();
    await pool.end();
    await admin.query(`DROP SCHEMA IF EXISTS ${schema} CASCADE`);
    await admin.end();
  }
});
