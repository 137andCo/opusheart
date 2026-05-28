import type { User, UserRole, FeatureToggles } from '@opusheart/shared';

interface AuthUser {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  role: UserRole;
  mfaEnabled: boolean;
  avatar?: string;
  locale: string;
  timezone: string;
  active: boolean;
}

interface LoginResponse {
  user: AuthUser;
  accessToken: string;
}

interface RefreshResponse {
  accessToken: string;
}

interface MeResponse {
  user: AuthUser;
}

export const useAuthStore = defineStore('auth', () => {
  const config = useRuntimeConfig();

  const user = ref<AuthUser | null>(null);
  const accessToken = ref<string | null>(null);
  const features = ref<FeatureToggles | null>(null);
  const isAuthenticated = computed(() => !!accessToken.value && !!user.value);

  // SECURITY: the access token is held in memory only — never localStorage,
  // which any injected script can read (XSS -> token theft). The session
  // survives reloads via the httpOnly refresh cookie (see refreshAccessToken),
  // which JavaScript cannot read.
  function setAccessToken(token: string | null) {
    accessToken.value = token;
  }

  function clearAuth() {
    user.value = null;
    features.value = null;
    setAccessToken(null);
  }

  async function login(email: string, password: string, mfaCode?: string): Promise<void> {
    const apiBase = config.public.apiBase as string;
    const body: Record<string, string> = { email, password };
    if (mfaCode) body.mfaCode = mfaCode;

    const response = await fetch(`${apiBase}/api/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify(body),
    });

    if (!response.ok) {
      const err = await response.json().catch(() => ({ error: { message: 'Login failed' } }));
      throw new Error(err.error?.message || 'Login failed');
    }

    const result: LoginResponse = await response.json();
    setAccessToken(result.accessToken);
    user.value = result.user;
    await fetchFeatures();
  }

  async function logout(): Promise<void> {
    const apiBase = config.public.apiBase as string;
    try {
      await fetch(`${apiBase}/api/auth/logout`, {
        method: 'POST',
        credentials: 'include',
        headers: { Authorization: `Bearer ${accessToken.value}` },
      });
    } catch {
      // Ignore logout API errors
    }
    clearAuth();
  }

  async function refreshAccessToken(): Promise<boolean> {
    const apiBase = config.public.apiBase as string;
    try {
      const response = await fetch(`${apiBase}/api/auth/refresh`, {
        method: 'POST',
        credentials: 'include',
      });

      if (!response.ok) {
        clearAuth();
        return false;
      }

      const result: RefreshResponse = await response.json();
      setAccessToken(result.accessToken);
      return true;
    } catch {
      clearAuth();
      return false;
    }
  }

  async function fetchFeatures(): Promise<void> {
    const apiBase = config.public.apiBase as string;
    try {
      const response = await fetch(`${apiBase}/api/features`);
      if (response.ok) {
        const result = await response.json();
        features.value = result.features;
      }
    } catch {
      // Features are non-critical — fail silently
    }
  }

  async function fetchUser(): Promise<boolean> {
    if (!accessToken.value) return false;
    const apiBase = config.public.apiBase as string;

    try {
      const response = await fetch(`${apiBase}/api/auth/me`, {
        credentials: 'include',
        headers: { Authorization: `Bearer ${accessToken.value}` },
      });

      if (!response.ok) {
        // Try refresh before giving up
        const refreshed = await refreshAccessToken();
        if (!refreshed) return false;
        // Retry with new token
        const retryResponse = await fetch(`${apiBase}/api/auth/me`, {
          credentials: 'include',
          headers: { Authorization: `Bearer ${accessToken.value}` },
        });
        if (!retryResponse.ok) {
          clearAuth();
          return false;
        }
        const retryResult: MeResponse = await retryResponse.json();
        user.value = retryResult.user;
        await fetchFeatures();
        return true;
      }

      const result: MeResponse = await response.json();
      user.value = result.user;
      await fetchFeatures();
      return true;
    } catch {
      clearAuth();
      return false;
    }
  }

  return {
    user,
    accessToken,
    features,
    isAuthenticated,
    login,
    logout,
    refreshAccessToken,
    fetchUser,
    fetchFeatures,
    clearAuth,
  };
});
