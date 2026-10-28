import { t, locale, applyLanguage } from './i18n.js';

const $ = (selector) => document.querySelector(selector);
const statuses = ['available', 'occupied', 'out_of_service'];

let lastNotice = null;
let formError = null;
let currentUser = null;
let busy = false;
let loadError = '';
let tables = [];

const translatedError = (key, values = {}) =>
  Object.assign(new Error(t(key, values)), { key, values });

const showFormError = (error = null) => {
  formError = error;
  $('#form-error').textContent = error
    ? error.key
      ? t(error.key, error.values)
      : error.message
    : '';
};

const showLoginError = (key = '') => {
  $('#login-error').textContent = key ? t(key) : '';
};

const showScreen = (authenticated) => {
  const languageControls = $('#language-controls');
  if (authenticated) $('.topbar').insertBefore(languageControls, $('#logout-button'));
  else $('#login-form').prepend(languageControls);
  $('#login-screen').hidden = authenticated;
  $('#app-shell').hidden = !authenticated;

  if (!authenticated) {
    if ($('#table-dialog').open) $('#table-dialog').close();
    $('#login-password').value = '';
    showLoginError();
    $('#login-username').focus({ preventScroll: true });
  }
};

const displayName = (table) =>
  isDemo() && table.demoKey ? `${t(table.demoKey)} ${table.demoNumber}` : table.name;

let demoTables = [
  {
    id: 1,
    name: 'Mesa 01',
    demoKey: 'tableName',
    demoNumber: '01',
    capacity: 2,
    status: 'available',
  },
  {
    id: 2,
    name: 'Mesa 02',
    demoKey: 'tableName',
    demoNumber: '02',
    capacity: 4,
    status: 'occupied',
  },
  {
    id: 3,
    name: 'Mesa 03',
    demoKey: 'tableName',
    demoNumber: '03',
    capacity: 4,
    status: 'available',
  },
  {
    id: 4,
    name: 'Terraza 01',
    demoKey: 'terrace',
    demoNumber: '01',
    capacity: 6,
    status: 'available',
  },
  {
    id: 5,
    name: 'Terraza 02',
    demoKey: 'terrace',
    demoNumber: '02',
    capacity: 2,
    status: 'occupied',
  },
  {
    id: 6,
    name: 'Mesa 06',
    demoKey: 'tableName',
    demoNumber: '06',
    capacity: 8,
    status: 'out_of_service',
  },
];

const isDemo = () => $('#source').value === 'demo';

const notice = (key = '', error = false, values = {}) => {
  lastNotice = { key, error, values };
  $('#notice').textContent = key ? t(key, values) : '';
  $('#notice').className = `notice${error ? ' error' : ''}`;
};

async function request(path, options = {}) {
  let response;

  try {
    response = await fetch(path, {
      ...options,
      credentials: 'same-origin',
      signal: AbortSignal.timeout(10000),
      headers: {
        'Content-Type': 'application/json',
        ...options.headers,
      },
    });
  } catch {
    throw translatedError('connectionError');
  }

  const body = await response.json().catch(() => null);

  if (!response.ok) {
    if (response.status === 401) {
      throw translatedError('invalidCredentials');
    }

    if (response.status === 404) {
      throw translatedError('notFound', { path });
    }

    throw translatedError(response.status === 409 ? 'duplicate' : 'httpError', {
      status: response.status,
    });
  }

  return body;
}

function validTable(table) {
  return (
    table &&
    Number.isInteger(table.id) &&
    table.id > 0 &&
    typeof table.name === 'string' &&
    table.name.trim().length > 0 &&
    table.name.length <= 80 &&
    Number.isInteger(table.capacity) &&
    table.capacity >= 1 &&
    table.capacity <= 20 &&
    statuses.includes(table.status)
  );
}

function setBusy(value) {
  busy = value;

  for (const selector of [
    '#source',
    '#refresh',
    '#new-table',
    '#save-table',
    '#close-dialog',
    '#cancel-dialog',
  ]) {
    $(selector).disabled = value;
  }

  $('#tables').setAttribute('aria-busy', String(value));
  $('#save-table').textContent = t(value ? 'saving' : 'save');

  document.querySelectorAll('.card-bottom select').forEach((select) => {
    select.disabled = value;
  });
}

function setLoginBusy(value) {
  $('#login-submit').disabled = value;
  $('#login-username').disabled = value;
  $('#login-password').disabled = value;
  $('#login-submit').textContent = t(value ? 'loggingIn' : 'loginButton');
}

function render() {
  $('#total').textContent = tables.length;
  const availableTables = tables.filter((table) => table.status === 'available');
  $('#ready-summary').textContent = t(
    loadError ? 'readinessError' : busy ? 'readinessLoading' : 'readySummary',
    {
      tables: availableTables.length,
      seats: availableTables.reduce((sum, table) => sum + table.capacity, 0),
    },
  );

  for (const status of statuses) {
    $(`#${status}`).textContent = tables.filter((table) => table.status === status).length;
  }

  const query = $('#search').value.trim().toLocaleLowerCase(locale());
  $('#clear-filters').hidden = !query && $('#filter').value === 'all';
  document.querySelectorAll('.stat-filter').forEach((button) => {
    button.setAttribute('aria-pressed', String(button.dataset.filter === $('#filter').value));
  });

  const filtered = tables.filter(
    (table) =>
      displayName(table).toLocaleLowerCase(locale()).includes(query) &&
      ($('#filter').value === 'all' || table.status === $('#filter').value),
  );

  $('#result-count').textContent = t('results', {
    shown: filtered.length,
    total: tables.length,
    source: t(isDemo() ? 'demoData' : 'apiData'),
  });

  $('#tables').replaceChildren();

  if (!filtered.length) {
    const empty = document.createElement('div');
    empty.className = 'empty';

    const title = document.createElement('h3');
    title.textContent = t(loadError ? 'errorTitle' : tables.length ? 'noMatches' : 'emptyTitle');

    const description = document.createElement('p');
    description.textContent = t(
      loadError ? 'errorHint' : tables.length ? 'searchHint' : 'emptyHint',
    );

    empty.append(title, description);
    $('#tables').append(empty);
  }

  for (const table of filtered) {
    const card = document.createElement('article');
    card.className = `table-card table-state-${table.status}`;

    // La plantilla contiene únicamente HTML constante.
    // Los datos variables se insertan mediante textContent.
    card.innerHTML =
      '<div class="card-top"><span class="table-reference" aria-hidden="true"></span><div class="card-body"><h3></h3><p></p></div><span class="badge"></span></div><div class="card-bottom"><label></label><select></select></div>';
    card.querySelector('.table-reference').textContent = String(table.id).padStart(2, '0');

    card.querySelector('.badge').classList.add(table.status);
    card.querySelector('.badge').textContent = t(table.status);
    card.querySelector('h3').textContent = displayName(table);
    card.querySelector('.card-body p').textContent = t('seats', {
      count: table.capacity,
    });

    const select = card.querySelector('select');
    select.id = `status-${table.id}`;

    card.querySelector('label').htmlFor = select.id;
    card.querySelector('label').textContent = t('changeStatus');

    select.setAttribute(
      'aria-label',
      t('statusOf', {
        name: displayName(table),
      }),
    );

    for (const value of statuses) {
      select.add(new Option(t(value), value));
    }

    select.value = table.status;
    select.disabled = busy;
    select.addEventListener('change', () => changeStatus(table, select.value));

    $('#tables').append(card);
  }
}

async function load() {
  if (busy || !currentUser) return;

  loadError = '';
  tables = [];

  setBusy(true);
  render();
  notice('loading');

  try {
    const result = isDemo() ? structuredClone(demoTables) : await request('/api/tables');

    if (
      !Array.isArray(result) ||
      !result.every(validTable) ||
      new Set(result.map((table) => table.id)).size !== result.length
    ) {
      throw translatedError('invalidList');
    }

    tables = result;
    notice(isDemo() ? 'demoNotice' : 'loaded');
  } catch (error) {
    if (error.key === 'invalidCredentials') {
      currentUser = null;
      showScreen(false);
      return;
    }

    loadError = error;
    notice(error.key || 'httpError', true, error.values);
  } finally {
    setBusy(false);

    if (currentUser) render();
  }
}

async function changeStatus(table, status) {
  if (busy || !currentUser) return;
  const restoreFocus = document.activeElement?.id === `status-${table.id}`;

  setBusy(true);

  try {
    if (isDemo()) {
      demoTables = demoTables.map((item) => (item.id === table.id ? { ...item, status } : item));

      tables = structuredClone(demoTables);
    } else {
      const updated = await request(`/api/tables/${table.id}/status`, {
        method: 'PATCH',
        body: JSON.stringify({ status }),
      });

      if (!validTable(updated) || updated.id !== table.id || updated.status !== status) {
        throw translatedError('invalidPatch');
      }

      tables = tables.map((item) => (item.id === updated.id ? updated : item));
    }

    notice('updated', false, { name: displayName(table) });
  } catch (error) {
    if (error.key === 'invalidCredentials') {
      currentUser = null;
      showScreen(false);
      return;
    }

    notice(error.key || 'httpError', true, error.values);
  } finally {
    setBusy(false);

    if (currentUser) {
      render();
      if (restoreFocus) $(`#status-${table.id}`)?.focus({ preventScroll: true });
    }
  }
}

async function login(event) {
  event.preventDefault();

  if ($('#login-submit').disabled) return;

  showLoginError();
  setLoginBusy(true);

  try {
    const username = $('#login-username').value.trim();
    const password = $('#login-password').value;

    const result = await request('/api/auth/login', {
      method: 'POST',
      body: JSON.stringify({ username, password }),
    });

    if (!result?.user || !Number.isInteger(result.user.id)) {
      throw translatedError('loginFailed');
    }

    currentUser = result.user;
    $('#login-password').value = '';
    showScreen(true);

    await load();
  } catch (error) {
    showLoginError(
      error.key === 'connectionError'
        ? 'connectionError'
        : error.key === 'invalidCredentials'
          ? 'invalidCredentials'
          : 'loginFailed',
    );
  } finally {
    setLoginBusy(false);
  }
}

async function checkSession() {
  showScreen(false);

  try {
    const result = await request('/api/auth/me');

    if (!result?.user || !Number.isInteger(result.user.id)) {
      currentUser = null;
      return;
    }

    currentUser = result.user;
    showScreen(true);
    await load();
  } catch {
    currentUser = null;
    showScreen(false);
  }
}

async function logout() {
  if (!currentUser) return;

  $('#logout-button').disabled = true;

  try {
    await request('/api/auth/logout', { method: 'POST' });
    currentUser = null;
    tables = [];
    loadError = '';
    showScreen(false);
  } catch {
    notice('logoutFailed', true);
  } finally {
    $('#logout-button').disabled = false;
  }
}

$('#login-form').addEventListener('submit', login);
$('#logout-button').addEventListener('click', logout);

$('#new-table').addEventListener('click', () => {
  if (!currentUser) return;

  $('#table-form').reset();
  showFormError();
  $('#table-dialog').showModal();
  $('#table-name').focus();
});

for (const selector of ['#close-dialog', '#cancel-dialog']) {
  $(selector).addEventListener('click', () => $('#table-dialog').close());
}

$('#table-dialog').addEventListener('cancel', (event) => {
  if (busy) event.preventDefault();
});

$('#table-form').addEventListener('submit', async (event) => {
  event.preventDefault();

  if (busy || !currentUser) return;

  const name = $('#table-name').value.trim();
  const capacity = Number($('#table-capacity').value);

  showFormError();

  if (!name || name.length > 80 || !Number.isInteger(capacity) || capacity < 1 || capacity > 20) {
    showFormError(translatedError('validation'));
    return;
  }

  setBusy(true);

  try {
    let created;

    if (isDemo()) {
      if (demoTables.some((table) => table.name === name)) {
        throw translatedError('duplicate');
      }

      created = {
        id: Math.max(0, ...demoTables.map((table) => table.id)) + 1,
        name,
        capacity,
        status: 'available',
      };

      demoTables.push(created);
    } else {
      created = await request('/api/tables', {
        method: 'POST',
        body: JSON.stringify({ name, capacity }),
      });

      if (!validTable(created) || tables.some((table) => table.id === created.id)) {
        throw translatedError('invalidPost');
      }
    }

    tables.push(created);
    loadError = '';
    $('#search').value = '';
    $('#filter').value = 'all';
    $('#table-dialog').close();

    notice('created', false, { name });
  } catch (error) {
    if (error.key === 'invalidCredentials') {
      currentUser = null;
      showScreen(false);
    } else {
      showFormError(error);
    }
  } finally {
    setBusy(false);

    if (currentUser) render();
  }
});

$('#source').addEventListener('change', () => {
  $('#mode-description').textContent = t(isDemo() ? 'demoDescription' : 'apiDescription');

  void load();
});

$('#refresh').addEventListener('click', () => void load());
$('#search').addEventListener('input', render);
$('#filter').addEventListener('change', render);
document.querySelectorAll('.stat-filter').forEach((button) => {
  button.addEventListener('click', () => {
    $('#filter').value = button.dataset.filter;
    render();
  });
});
$('#clear-filters').addEventListener('click', () => {
  $('#search').value = '';
  $('#filter').value = 'all';
  render();
  $('#search').focus();
});

function updateLanguage() {
  applyLanguage($('#language').value);

  $('#mode-description').textContent = t(isDemo() ? 'demoDescription' : 'apiDescription');

  setBusy(busy);

  if (currentUser) render();

  if (lastNotice) {
    notice(lastNotice.key, lastNotice.error, lastNotice.values);
  }

  showFormError(formError);
}

$('#language').addEventListener('change', updateLanguage);

applyLanguage();
updateLanguage();
void checkSession();
