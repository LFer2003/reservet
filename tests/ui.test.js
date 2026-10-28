import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { JSDOM } from 'jsdom';

test('idiomas, datos de usuario, estados y errores funcionan sin base ni red', async () => {
  const dom = new JSDOM(await readFile(new URL('../public/index.html', import.meta.url), 'utf8'), {
    url: 'http://localhost',
  });
  const previous = {};
  for (const key of ['document', 'localStorage', 'Option', 'fetch'])
    previous[key] = globalThis[key];
  try {
    for (const key of ['document', 'localStorage', 'Option']) globalThis[key] = dom.window[key];
    globalThis.fetch = async (url) => {
      if (String(url).endsWith('/api/auth/me')) {
        return {
          ok: true,
          status: 200,
          json: async () => ({ user: { id: 1, username: 'test' } }),
        };
      }
      return { ok: false, status: 404, json: async () => ({}) };
    };
    const { document, localStorage } = dom.window;

    const $ = (selector) => document.querySelector(selector);
    const event = (type) => new dom.window.Event(type, { cancelable: true });
    // Simular solo la API de diálogo que JSDOM todavía no implementa.
    $('#table-dialog').close = () => {};
    localStorage.setItem('reservet.language', 'es');
    await import('../public/app.js');
    await new Promise((resolve) => setTimeout(resolve, 0));
    const { t } = await import('../public/i18n.js');
    for (const language of ['es', 'en', 'ru']) {
      $('#language').value = language;
      $('#language').dispatchEvent(event('change'));
      assert.equal(document.documentElement.lang, language);
      assert.equal($('#app-shell h1').textContent.trim(), t('headline'));
      assert.equal(localStorage.getItem('reservet.language'), language);
      assert.equal(document.querySelectorAll('.table-card').length, 6);
      assert.equal($('#ready-summary').textContent, t('readySummary', { tables: 3, seats: 12 }));
      assert.ok(
        [...document.querySelectorAll('.card-body p')].every(
          (element) => element.textContent.length > 0,
        ),
      );
      $('.stat-filter[data-filter="available"]').click();
      assert.equal(document.querySelectorAll('.table-card').length, 3);
      assert.equal($('.stat-filter[data-filter="available"]').getAttribute('aria-pressed'), 'true');
      assert.equal($('#clear-filters').hidden, false);
      $('#clear-filters').click();
      assert.equal(document.querySelectorAll('.table-card').length, 6);
      assert.equal($('#clear-filters').hidden, true);
      assert.equal($('#login-form label[for="login-username"]').textContent, t('usernameLabel'));
      assert.equal($('#login-form label[for="login-password"]').textContent, t('passwordLabel'));
      assert.equal($('#login-form .muted').textContent, t('loginDescription'));
      assert.equal($('#table-form>label').textContent.trim().startsWith(t('name')), true);
    }
    const status = $('.card-bottom select');
    status.value = 'occupied';
    status.dispatchEvent(event('change'));
    assert.equal($('#occupied').textContent, '3');
    assert.equal($('#ready-summary').textContent, t('readySummary', { tables: 2, seats: 10 }));
    $('#table-name').value = '<img src=x onerror=alert(1)>';
    $('#table-capacity').value = '3';
    $('#table-form').dispatchEvent(event('submit'));
    assert.equal(document.querySelectorAll('.table-card').length, 7);
    assert.equal(document.querySelectorAll('.table-card img').length, 0);
    $('#language').value = 'en';
    $('#language').dispatchEvent(event('change'));
    assert.equal(
      [...document.querySelectorAll('.card-body h3')].at(-1).textContent,
      '<img src=x onerror=alert(1)>',
    );
    $('#search').value = 'no matches';
    $('#search').dispatchEvent(event('input'));
    assert.equal($('.empty h3').textContent, t('noMatches'));
    $('#search').value = '';
    globalThis.fetch = async () => ({ ok: false, status: 404, json: async () => ({}) });
    $('#source').value = 'api';
    $('#source').dispatchEvent(event('change'));
    await new Promise((resolve) => setTimeout(resolve, 0));
    $('#language').value = 'ru';
    $('#language').dispatchEvent(event('change'));
    assert.equal($('#notice').textContent, t('notFound', { path: '/api/tables' }));
    assert.equal(document.querySelectorAll('.table-card').length, 0);
    // Una sesión vencida al crear una mesa debe cerrar el diálogo y mostrar el login.
    $('#table-dialog').open = true;
    $('#table-dialog').close = () => {
      $('#table-dialog').open = false;
    };
    globalThis.fetch = async () => ({ ok: false, status: 401, json: async () => ({}) });
    $('#table-name').value = 'Mesa nueva';
    $('#table-form').dispatchEvent(event('submit'));
    await new Promise((resolve) => setTimeout(resolve, 0));
    assert.equal($('#table-dialog').open, false);
    assert.equal($('#app-shell').hidden, true);
    assert.equal($('#login-screen').hidden, false);
    assert.ok($('#login-form #language'));
    $('#login-username').value = 'test';
    $('#login-password').value = 'incorrect';
    $('#login-form').dispatchEvent(event('submit'));
    await new Promise((resolve) => setTimeout(resolve, 0));
    assert.equal($('#login-error').textContent, t('invalidCredentials'));
    globalThis.fetch = async (url) => ({
      ok: true,
      status: 200,
      json: async () =>
        String(url).endsWith('/login') ? { user: { id: 1, username: 'test' } } : [],
    });
    $('#login-form').dispatchEvent(event('submit'));
    await new Promise((resolve) => setTimeout(resolve, 0));
    assert.equal($('#app-shell').hidden, false);
    assert.equal($('#login-password').value, '');
    globalThis.fetch = async () => {
      throw new Error('offline');
    };
    $('#logout-button').click();
    await new Promise((resolve) => setTimeout(resolve, 0));
    assert.equal($('#app-shell').hidden, false);
    assert.equal($('#notice').textContent, t('logoutFailed'));
    globalThis.fetch = async () => ({ ok: true, json: async () => ({}) });
    $('#logout-button').click();
    await new Promise((resolve) => setTimeout(resolve, 0));
    assert.equal($('#login-screen').hidden, false);
    // Una nueva carga del módulo recupera la preferencia guardada.
    const reloaded = await import(`../public/i18n.js?reload=${Date.now()}`);
    assert.equal(reloaded.locale(), 'ru');
  } finally {
    for (const [key, value] of Object.entries(previous)) {
      if (value === undefined) delete globalThis[key];
      else globalThis[key] = value;
    }
    dom.window.close();
  }
});
