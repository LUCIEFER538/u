import type {
  ActivityEvent,
  AuthResponse,
  PlatformHealth,
  Repository,
  Session,
  Stats,
  User,
} from '../types';

const TOKEN_KEY = 'gitop.session.token';

export class ApiError extends Error {
  readonly status: number;

  constructor(status: number, message: string) {
    super(message);
    this.status = status;
  }
}

export const tokenStore = {
  get: () => localStorage.getItem(TOKEN_KEY),
  set: (token: string) => localStorage.setItem(TOKEN_KEY, token),
  clear: () => localStorage.removeItem(TOKEN_KEY),
};

async function request<T>(path: string, init: RequestInit = {}): Promise<T> {
  const token = tokenStore.get();
  const headers = new Headers(init.headers);
  headers.set('Content-Type', 'application/json');
  if (token) headers.set('Authorization', `Bearer ${token}`);

  let response: Response;
  try {
    response = await fetch(path, { ...init, headers });
  } catch {
    throw new ApiError(0, 'network_unreachable');
  }

  if (response.status === 204) return undefined as T;

  const payload = await response.json().catch(() => null);

  if (!response.ok) {
    const message =
      payload && typeof payload === 'object' && 'error' in payload
        ? String((payload as { error: unknown }).error)
        : `Request failed with status ${response.status}`;
    throw new ApiError(response.status, message);
  }

  return payload as T;
}

export const api = {
  register: (body: {
    email: string;
    username: string;
    password: string;
    display_name?: string;
  }) => request<AuthResponse>('/api/auth/register', { method: 'POST', body: JSON.stringify(body) }),

  login: (body: { email: string; password: string }) =>
    request<AuthResponse>('/api/auth/login', { method: 'POST', body: JSON.stringify(body) }),

  logout: () => request<void>('/api/auth/logout', { method: 'POST' }),

  me: () => request<User>('/api/auth/me'),

  updateProfile: (body: { display_name?: string; bio?: string; avatar_url?: string | null }) =>
    request<User>('/api/users/me', { method: 'PATCH', body: JSON.stringify(body) }),

  changePassword: (body: { current_password: string; new_password: string }) =>
    request<{ status: string }>('/api/users/me/password', {
      method: 'POST',
      body: JSON.stringify(body),
    }),

  sessions: () => request<Session[]>('/api/sessions'),

  revokeSession: (id: string) => request<void>(`/api/sessions/${id}`, { method: 'DELETE' }),

  repositories: () => request<Repository[]>('/api/repos'),

  createRepository: (body: {
    name: string;
    description?: string;
    visibility?: string;
    default_branch?: string;
    language?: string;
  }) => request<Repository>('/api/repos', { method: 'POST', body: JSON.stringify(body) }),

  repository: (owner: string, name: string) =>
    request<Repository>(`/api/repos/${owner}/${name}`),

  updateRepository: (
    owner: string,
    name: string,
    body: {
      description?: string;
      visibility?: string;
      default_branch?: string;
      language?: string;
      archived?: boolean;
    },
  ) => request<Repository>(`/api/repos/${owner}/${name}`, { method: 'PATCH', body: JSON.stringify(body) }),

  deleteRepository: (owner: string, name: string) =>
    request<void>(`/api/repos/${owner}/${name}`, { method: 'DELETE' }),

  activity: (limit = 30) => request<ActivityEvent[]>(`/api/activity?limit=${limit}`),

  stats: () => request<Stats>('/api/stats'),

  platformHealth: () => request<PlatformHealth>('/gw/health'),
};
