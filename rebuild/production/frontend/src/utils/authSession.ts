const TOKEN_STORAGE_KEY = 'token';
const AUTH_STORAGE_KEY = 'auth-storage';

interface JwtPayload {
  exp?: number;
}

const decodeJwtPayload = (token: string): JwtPayload | null => {
  const parts = token.split('.');
  if (parts.length !== 3) {
    return null;
  }

  try {
    const base64Url = parts[1];
    const base64 = base64Url.replace(/-/g, '+').replace(/_/g, '/');
    const padded = base64.padEnd(Math.ceil(base64.length / 4) * 4, '=');
    const json = atob(padded);
    return JSON.parse(json) as JwtPayload;
  } catch {
    return null;
  }
};

const getTokenFromPersistedAuthStore = (): string | null => {
  const raw = localStorage.getItem(AUTH_STORAGE_KEY);
  if (!raw) {
    return null;
  }

  try {
    const parsed = JSON.parse(raw) as
      | { state?: { token?: unknown } }
      | { token?: unknown }
      | null;

    const stateToken =
      parsed && typeof parsed === 'object' && 'state' in parsed
        ? (parsed as { state?: { token?: unknown } }).state?.token
        : undefined;
    const directToken =
      parsed && typeof parsed === 'object' && 'token' in parsed
        ? (parsed as { token?: unknown }).token
        : undefined;
    const token = typeof stateToken === 'string'
      ? stateToken
      : typeof directToken === 'string'
        ? directToken
        : null;

    if (token) {
      localStorage.setItem(TOKEN_STORAGE_KEY, token);
    }

    return token;
  } catch {
    return null;
  }
};

export const getStoredToken = (): string | null =>
  localStorage.getItem(TOKEN_STORAGE_KEY) || getTokenFromPersistedAuthStore();

export const setStoredToken = (token: string): void => {
  localStorage.setItem(TOKEN_STORAGE_KEY, token);
};

export const clearAuthSession = (): void => {
  localStorage.removeItem(TOKEN_STORAGE_KEY);
  localStorage.removeItem(AUTH_STORAGE_KEY);
};

export const isTokenExpired = (token: string, bufferSeconds = 30): boolean => {
  const payload = decodeJwtPayload(token);
  if (!payload || typeof payload.exp !== 'number') {
    return true;
  }

  const expiryTime = payload.exp * 1000;
  return expiryTime <= Date.now() + bufferSeconds * 1000;
};
