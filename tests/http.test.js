import { after, before, test, mock } from 'node:test';
import assert from 'node:assert/strict';

// Ninguna prueba utiliza la base local ni depende de credenciales reales.
process.env.DATABASE_URL = 'postgresql://test:test@127.0.0.1:1/reservet_test';
const { app } = await import('../src/app.ts');
const { pool } = await import('../src/shared/database.ts');
let server;
let base;
before(async () => {
  server = app.listen(0, '127.0.0.1');
  await new Promise((resolve) => server.once('listening', resolve));
  base = `http://127.0.0.1:${server.address().port}`;
});
after(async () => {
  await new Promise((resolve) => server.close(resolve));
  await pool.end();
});

test('sirve la interfaz UTF-8 con los tres idiomas y cabeceras de seguridad', async () => {
  const response = await fetch(base);
  assert.equal(response.status, 200);
  assert.match(response.headers.get('content-type'), /charset=utf-8/i);
  assert.equal(response.headers.get('x-powered-by'), null);
  assert.equal(response.headers.get('x-content-type-options'), 'nosniff');
  assert.match(response.headers.get('content-security-policy'), /script-src 'self'/);
  const html = await response.text();
  assert.match(html, /Español/);
  assert.match(html, /Русский/);
  assert.doesNotMatch(html, /\?{3,}/);
});

test('salud del proceso y rutas inexistentes tienen contratos claros', async () => {
  const response = await fetch(`${base}/health`);
  assert.equal(response.status, 200);
  assert.deepEqual(await response.json(), { status: 'ok', service: 'reservet' });
  assert.ok(response.headers.get('x-request-id'));
  assert.equal((await fetch(`${base}/missing`)).status, 404);
});

test('la disponibilidad de PostgreSQL se distingue de la salud del proceso', async () => {
  const query = mock.method(pool, 'query', async () => ({ rows: [] }));
  try {
    assert.equal((await fetch(`${base}/health/db`)).status, 200);
    query.mock.mockImplementation(async () => {
      throw new Error('contraseña privada');
    });
    const response = await fetch(`${base}/health/db`);
    assert.equal(response.status, 503);
    assert.deepEqual(await response.json(), { status: 'error', database: 'unavailable' });
  } finally {
    query.mock.restore();
  }
});

test('JSON inválido y cuerpos excesivos no se convierten en errores 500', async () => {
  for (const [body, status, code] of [
    ['{', 400, 'INVALID_JSON'],
    [JSON.stringify({ data: 'a'.repeat(17000) }), 413, 'PAYLOAD_TOO_LARGE'],
  ]) {
    const response = await fetch(`${base}/api/tables`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body,
    });
    assert.equal(response.status, status);
    const payload = await response.json();
    assert.equal(payload.code, code);
    assert.equal(payload.requestId, response.headers.get('x-request-id'));
    assert.equal(payload.stack, undefined);
  }
});
