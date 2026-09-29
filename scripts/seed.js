#!/usr/bin/env node
// Seeds a demo account and a few repositories through the public HTTP API.
// Usage: GITOP_URL=http://localhost:8081 node scripts/seed.js

const BASE = process.env.GITOP_URL ?? 'http://localhost:8081';
const EMAIL = process.env.SEED_EMAIL ?? 'demo@gitop.dev';
const USERNAME = process.env.SEED_USERNAME ?? 'demo';
const PASSWORD = process.env.SEED_PASSWORD ?? 'gitop-demo-2024';

const REPOS = [
  {
    name: 'gitop-api',
    description: 'Rust + Axum core API: auth, sessions, repositories.',
    language: 'Rust',
    visibility: 'public',
  },
  {
    name: 'gitop-gateway',
    description: 'Go edge gateway: CORS, rate limiting and request auditing.',
    language: 'Go',
    visibility: 'public',
  },
  {
    name: 'gitop-console',
    description: 'React + TypeScript console for repositories and account settings.',
    language: 'TypeScript',
    visibility: 'private',
  },
];

async function call(path, { method = 'GET', body, token } = {}) {
  const response = await fetch(`${BASE}${path}`, {
    method,
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: body ? JSON.stringify(body) : undefined,
  });

  const payload = response.status === 204 ? null : await response.json().catch(() => null);
  if (!response.ok) {
    throw new Error(`${method} ${path} → ${response.status} ${payload?.error ?? ''}`.trim());
  }
  return payload;
}

async function authenticate() {
  try {
    const created = await call('/api/auth/register', {
      method: 'POST',
      body: { email: EMAIL, username: USERNAME, password: PASSWORD, display_name: 'GitOp Demo' },
    });
    console.log(`created user ${created.user.username}`);
    return created.token;
  } catch (error) {
    if (!String(error.message).includes('409')) throw error;
    const session = await call('/api/auth/login', {
      method: 'POST',
      body: { email: EMAIL, password: PASSWORD },
    });
    console.log(`reused existing user ${session.user.username}`);
    return session.token;
  }
}

const token = await authenticate();
const existing = new Set((await call('/api/repos', { token })).map((repo) => repo.name));

for (const repo of REPOS) {
  if (existing.has(repo.name)) {
    console.log(`skip ${repo.name} (already exists)`);
    continue;
  }
  await call('/api/repos', { method: 'POST', token, body: repo });
  console.log(`created repository ${repo.name}`);
}

const stats = await call('/api/stats', { token });
console.log('seed complete:', stats);
