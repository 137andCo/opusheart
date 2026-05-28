<script setup lang="ts">
definePageMeta({ layout: 'auth' });

const authStore = useAuthStore();
const router = useRouter();

const email = ref('');
const password = ref('');
const error = ref('');
const loading = ref(false);

async function handleLogin() {
  error.value = '';
  loading.value = true;
  try {
    await authStore.login(email.value, password.value);
    router.push('/');
  } catch (err: any) {
    error.value = err.message || 'Login failed';
  } finally {
    loading.value = false;
  }
}
</script>

<template>
  <div class="login-card">
    <h1>OpusHeart</h1>
    <p class="subtitle">Sign in to your dashboard</p>
    <form @submit.prevent="handleLogin" aria-label="Sign in form">
      <div class="field">
        <label for="email">Email</label>
        <InputText
          id="email"
          v-model="email"
          type="email"
          placeholder="you@example.com"
          required
          autocomplete="email"
          :disabled="loading"
          class="w-full"
        />
      </div>
      <div class="field">
        <label for="password">Password</label>
        <Password
          id="password"
          v-model="password"
          :feedback="false"
          toggleMask
          required
          autocomplete="current-password"
          :disabled="loading"
          inputClass="w-full"
          class="w-full"
        />
      </div>
      <Message v-if="error" severity="error" :closable="false">{{ error }}</Message>
      <Button
        type="submit"
        label="Sign In"
        :loading="loading"
        class="w-full"
      />
    </form>
  </div>
</template>

<style scoped>
.login-card {
  background: var(--p-surface-0);
  border: 1px solid var(--p-surface-200);
  border-radius: 12px;
  padding: 2.5rem;
  width: 100%;
  max-width: 420px;
}

.login-card h1 {
  font-size: 1.75rem;
  font-weight: 700;
  color: var(--p-primary-color);
  margin-bottom: 0.25rem;
}

.subtitle {
  color: var(--p-text-muted-color);
  margin-bottom: 1.5rem;
}

.field {
  margin-bottom: 1rem;
}

.field label {
  display: block;
  font-weight: 500;
  margin-bottom: 0.5rem;
  font-size: 0.875rem;
}

.w-full {
  width: 100%;
}
</style>
