#!/usr/bin/env node
// End-to-end smoke test across the Go gateway, the Rust API and PostgreSQL.
// Usage: GITOP_URL=http://localhost:8081 node scripts/smoke-test.js

const BASE = process.env.GITOP_URL ?? 'http://localhost:8081';
const stamp = Date.now();
const account = {
  email: `smoke_${stamp}@gitop.dev`,
  username: `smoke${stamp}`,
  password: `smoke-${stamp}-pass`,
  display_name: 'Smoke Test',
};

let token = null;
let failures = 0;

async function call(path, { method = 'GET', body, auth = true, expect = 200 } = {}) {
  const response = await fetch(`${BASE}${path}`, {
    method,
    headers: {
      'Content-Type': 'application/json',
      ...(auth && token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  const payload = response.status === 204 ? null : await response.json().catch(() => null);
  if (response.status !== expect) {
    throw new Error(`${method} ${path} → ${response.status} (expected ${expect}) ${payload?.error ?? ''}`);
  }
  return payload;
}

async function check(name, fn) {
  try {
    await fn();
    console.log(`PASS  ${name}`);
  } catch (error) {
    failures += 1;
    console.error(`FAIL  ${name}: ${error.message}`);
  }
}

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

await check('gateway health reports a reachable Rust upstream and database', async () => {
  const health = await call('/gw/health', { auth: false });
  assert(health.upstream === 'healthy', `upstream is ${health.upstream}`);
  assert(health.database === true, 'database is not reachable');
});

await check('registration creates a real account', async () => {
  const result = await call('/api/auth/register', { method: 'POST', auth: false, body: account, expect: 201 });
  assert(typeof result.token === 'string' && result.token.length > 20, 'no session token returned');
  assert(result.user.username === account.username, 'wrong username returned');
  token = result.token;
});

await check('a wrong password is rejected', async () => {
  await call('/api/auth/login', {
    method: 'POST',
    auth: false,
    expect: 401,
    body: { email: account.email, password: 'definitely-not-the-password' },
  });
});

await check('login with the right password issues a session', async () => {
  const result = await call('/api/auth/login', {
    method: 'POST',
    auth: false,
    body: { email: account.email, password: account.password },
  });
  assert(result.token !== token, 'login reused the registration token');
  token = result.token;
});

await check('unauthenticated requests are rejected', async () => {
  await call('/api/auth/me', { auth: false, expect: 401 });
});

await check('repository create, read and update round-trips', async () => {
  const created = await call('/api/repos', {
    method: 'POST',
    expect: 201,
    body: { name: 'smoke-repo', description: 'created by the smoke test', visibility: 'public' },
  });
  const fetched = await call(`/api/repos/${account.username}/${created.name}`);
  assert(fetched.id === created.id, 'fetched a different repository');

  const updated = await call(`/api/repos/${account.username}/${created.name}`, {
    method: 'PATCH',
    body: { visibility: 'private', archived: true },
  });
  assert(updated.visibility === 'private' && updated.archived === true, 'update did not persist');
});

await check('stats and activity reflect the new account', async () => {
  const stats = await call('/api/stats');
  assert(stats.repositories === 1, `expected 1 repository, got ${stats.repositories}`);
  const events = await call('/api/activity?limit=10');
  assert(events.length > 0, 'no activity recorded');
});

await check('changing the password revokes other sessions', async () => {
  const other = await call('/api/auth/login', {
    method: 'POST',
    auth: false,
    body: { email: account.email, password: account.password },
  });
  await call('/api/users/me/password', {
    method: 'POST',
    body: { current_password: account.password, new_password: `${account.password}-v2` },
  });

  const response = await fetch(`${BASE}/api/auth/me`, {
    headers: { Authorization: `Bearer ${other.token}` },
  });
  assert(response.status === 401, `revoked session still works (${response.status})`);
});

await check('logout invalidates the current token', async () => {
  const session = await call('/api/auth/login', {
    method: 'POST',
    auth: false,
    body: { email: account.email, password: `${account.password}-v2` },
  });
  token = session.token;
  await call('/api/auth/logout', { method: 'POST', expect: 204 });
  await call('/api/auth/me', { expect: 401 });
});

console.log(failures === 0 ? '\nall smoke checks passed' : `\n${failures} smoke check(s) failed`);
process.exit(failures === 0 ? 0 : 1);
