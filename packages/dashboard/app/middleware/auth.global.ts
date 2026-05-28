export default defineNuxtRouteMiddleware(async (to) => {
  const authStore = useAuthStore();
  const isLoginPage = to.path === '/login';

  // On a fresh load the in-memory access token is gone (it is never persisted).
  // Try to silently restore the session from the httpOnly refresh cookie before
  // deciding whether to redirect; this keeps users logged in across reloads
  // without exposing the token to localStorage/XSS.
  if (!authStore.accessToken && import.meta.client) {
    const refreshed = await authStore.refreshAccessToken();
    if (refreshed) {
      await authStore.fetchUser();
    }
  } else if (authStore.accessToken && !authStore.user) {
    await authStore.fetchUser();
  }

  if (!authStore.isAuthenticated && !isLoginPage) {
    return navigateTo('/login');
  }

  if (authStore.isAuthenticated && isLoginPage) {
    return navigateTo('/');
  }
});
