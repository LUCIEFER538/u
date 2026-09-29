export interface User {
  id: string;
  email: string;
  username: string;
  display_name: string;
  bio: string;
  avatar_url: string | null;
  created_at: string;
}

export interface AuthResponse {
  user: User;
  token: string;
  expires_at: string;
}

export interface Repository {
  id: string;
  name: string;
  description: string;
  visibility: 'public' | 'private';
  default_branch: string;
  language: string;
  archived: boolean;
  owner_username: string;
  created_at: string;
  updated_at: string;
}

export interface Session {
  id: string;
  user_agent: string;
  ip_address: string;
  created_at: string;
  last_seen_at: string;
  expires_at: string;
}

export interface ActivityEvent {
  id: number;
  kind: string;
  summary: string;
  repository_name: string | null;
  actor: string | null;
  created_at: string;
}

export interface Stats {
  repositories: number;
  publicRepositories: number;
  archivedRepositories: number;
  activeSessions: number;
  eventsThisWeek: number;
}

export interface PlatformHealth {
  service: string;
  runtime: string;
  upstream: string;
  database: boolean;
}
