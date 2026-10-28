import { test } from 'node:test';
import assert from 'node:assert/strict';
process.env.DATABASE_URL = 'postgresql://test:test@localhost/test';
const { readConfig } = await import('../src/shared/config.ts');

test('rechaza configuración inválida antes de abrir el servidor', () => {
  for (const PORT of ['0', '-1', 'abc', '65536', '3.5', '']) {
    assert.throws(() => readConfig({ PORT, DATABASE_URL: process.env.DATABASE_URL }), /PORT/);
  }
  for (const DATABASE_URL of ['', 'invalid', 'https://localhost/db']) {
    assert.throws(() => readConfig({ DATABASE_URL }), /DATABASE_URL/);
  }
  assert.equal(readConfig({ DATABASE_URL: process.env.DATABASE_URL }).port, 3000);
});

test('separa entorno lógico y dirección de escucha sin cambiar la base recibida', () => {
  const DATABASE_URL = 'postgresql://user:secret@db:5432/reservet_pro';
  const config = readConfig({ DATABASE_URL, APP_ENV: 'pro', HOST: '0.0.0.0', PORT: '3000' });
  assert.equal(config.appEnv, 'pro');
  assert.equal(config.host, '0.0.0.0');
  assert.equal(config.databaseUrl, DATABASE_URL);
  assert.throws(() => readConfig({ DATABASE_URL, APP_ENV: 'production' }), /APP_ENV/);
  assert.throws(() => readConfig({ DATABASE_URL, HOST: 'arbitrary-host' }), /HOST/);
  assert.equal(readConfig({ DATABASE_URL }).host, '127.0.0.1');
});
