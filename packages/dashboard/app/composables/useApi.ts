import { ofetch } from 'ofetch';

export function useApi() {
  const config = useRuntimeConfig();
  const authStore = useAuthStore();

  const api = ofetch.create({
    baseURL: config.public.apiBase as string,
    credentials: 'include',
    async onRequest({ options }) {
      const token = authStore.accessToken;
      if (token) {
        const headers = new Headers(options.headers as HeadersInit);
        headers.set('Authorization', `Bearer ${token}`);
        options.headers = headers;
      }
    },
    async onResponseError({ response }) {
      if (response.status === 401) {
        const refreshed = await authStore.refreshAccessToken();
        if (!refreshed) {
          authStore.clearAuth();
          navigateTo('/login');
        }
      }
    },
  });

  return api;
}
