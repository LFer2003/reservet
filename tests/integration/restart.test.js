import assert from 'node:assert/strict';
import { test } from 'node:test';
import { spawn } from 'node:child_process';
import { randomUUID } from 'node:crypto';
import { createServer } from 'node:net';
import { once } from 'node:events';
import pg from 'pg';
import 'dotenv/config';

const target = process.env.TEST_DATABASE_URL;
if (!target) throw new Error('Define TEST_DATABASE_URL con una base exclusiva terminada en _test.');
const url = new URL(target);
if (
  !url.pathname.endsWith('_test') ||
  url.pathname === new URL(process.env.DATABASE_URL).pathname
) {
  throw new Error('La base de pruebas debe terminar en _test y ser distinta de la principal.');
}

test('instalación repetible y persistencia tras reiniciar el proceso Node completo', async () => {
  const schema = `restart_${randomUUID().replaceAll('-', '')}`;
  const admin = new pg.Pool({ connectionString: target });
  url.searchParams.set('options', `-c search_path=${schema}`);
  const env = {
    ...process.env,
    DATABASE_URL: url.href,
    HOST: '127.0.0.1',
    APP_ENV: 'dev',
    SEED_USERNAME: 'delivery',
    SEED_PASSWORD: randomUUID(),
  };
  const listener = createServer();
  listener.listen(0, '127.0.0.1');
  await once(listener, 'listening');
  env.PORT = String(listener.address().port);
  await new Promise((resolve) => listener.close(resolve));
  const base = `http://127.0.0.1:${env.PORT}`;
  let child;
  const runScript = async (path) => {
    const process = spawn(globalThis.process.execPath, ['--import', 'tsx', path], {
      env,
      stdio: 'ignore',
    });
    const [code] = await once(process, 'exit');
    assert.equal(code, 0, `El comando ${path} debe finalizar correctamente`);
  };
  const start = async () => {
    child = spawn(process.execPath, ['dist/server.js'], { env, stdio: 'ignore' });
    for (let attempt = 0; attempt < 100; attempt++) {
      if (child.exitCode !== null)
        throw new Error('El proceso del servidor terminó antes de estar disponible.');
      try {
        if ((await fetch(`${base}/health`, { signal: AbortSignal.timeout(500) })).ok) return;
      } catch {
        /* El proceso todavía está arrancando. */
      }
      await new Promise((resolve) => setTimeout(resolve, 100));
    }
    throw new Error('El servidor no arrancó dentro del tiempo de prueba.');
  };
  const stop = async () => {
    if (!child || child.exitCode !== null) return;
    const exited = once(child, 'exit');
    child.kill();
    await exited;
  };
  try {
    await admin.query(`CREATE SCHEMA ${schema}`);
    // Se prueban los mismos scripts de instalación documentados, dos veces.
    await runScript('scripts/migrate.ts');
    await runScript('scripts/migrate.ts');
    await runScript('scripts/seed-user.ts');
    await runScript('scripts/seed-user.ts');
    await start();
    assert.equal((await fetch(`${base}/health/db`)).status, 200);
    const login = await fetch(`${base}/api/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username: env.SEED_USERNAME, password: env.SEED_PASSWORD }),
    });
    assert.equal(login.status, 200);
    const headers = {
      Cookie: login.headers.get('set-cookie').split(';')[0],
      'Content-Type': 'application/json',
    };
    const created = await fetch(`${base}/api/tables`, {
      method: 'POST',
      headers,
      body: JSON.stringify({ name: 'Persistencia', capacity: 20 }),
    });
    assert.equal(created.status, 201);
    const table = await created.json();
    assert.equal(
      (
        await fetch(`${base}/api/tables/${table.id}/status`, {
          method: 'PATCH',
          headers,
          body: JSON.stringify({ status: 'occupied' }),
        })
      ).status,
      200,
    );
    await stop();
    await start();
    assert.equal((await fetch(`${base}/api/auth/me`, { headers })).status, 200);
    const listed = await (await fetch(`${base}/api/tables`, { headers })).json();
    assert.equal(listed[0].id, table.id);
    assert.equal(listed[0].capacity, 20);
    assert.equal(listed[0].status, 'occupied');
    assert.equal((await fetch(`${base}/api/auth/logout`, { method: 'POST', headers })).status, 200);
    assert.equal((await fetch(`${base}/api/tables`, { headers })).status, 401);
  } finally {
    await stop();
    await admin.query(`DROP SCHEMA IF EXISTS ${schema} CASCADE`);
    await admin.end();
  }
});
