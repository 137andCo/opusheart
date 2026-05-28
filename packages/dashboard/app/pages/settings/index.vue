<script setup lang="ts">
definePageMeta({ layout: 'default' });

const api = useApi();
const toast = useToast();

interface ThemeSettings {
  primaryColor: string;
  secondaryColor: string;
  fontFamily: string;
  logoUrl?: string;
  faviconUrl?: string;
  customCss?: string;
}

const loading = ref(true);
const saving = ref(false);

const theme = ref<ThemeSettings>({
  primaryColor: '#3B82F6',
  secondaryColor: '#10B981',
  fontFamily: 'Inter, sans-serif',
  logoUrl: '',
  faviconUrl: '',
  customCss: '',
});

async function loadTheme() {
  loading.value = true;
  try {
    const res = await api<{ theme: ThemeSettings }>('/api/theme');
    if (res.theme) {
      theme.value = {
        primaryColor: res.theme.primaryColor || '#3B82F6',
        secondaryColor: res.theme.secondaryColor || '#10B981',
        fontFamily: res.theme.fontFamily || 'Inter, sans-serif',
        logoUrl: res.theme.logoUrl || '',
        faviconUrl: res.theme.faviconUrl || '',
        customCss: res.theme.customCss || '',
      };
    }
  } catch {
    toast.add({ severity: 'error', summary: 'Error', detail: 'Failed to load theme settings', life: 3000 });
  } finally {
    loading.value = false;
  }
}

async function saveTheme() {
  saving.value = true;
  try {
    const payload: Record<string, string> = {
      primaryColor: theme.value.primaryColor,
      secondaryColor: theme.value.secondaryColor,
      fontFamily: theme.value.fontFamily,
    };
    if (theme.value.logoUrl) payload.logoUrl = theme.value.logoUrl;
    if (theme.value.faviconUrl) payload.faviconUrl = theme.value.faviconUrl;
    if (theme.value.customCss) payload.customCss = theme.value.customCss;

    await api('/api/theme', { method: 'PUT', body: payload });
    toast.add({ severity: 'success', summary: 'Saved', detail: 'Theme settings updated', life: 3000 });
  } catch {
    toast.add({ severity: 'error', summary: 'Error', detail: 'Failed to save theme settings', life: 3000 });
  } finally {
    saving.value = false;
  }
}

onMounted(loadTheme);
</script>

<template>
  <div>
    <div class="page-header">
      <h1>Settings</h1>
    </div>

    <Card class="settings-card">
      <template #title>Theme Settings</template>
      <template #content>
        <ProgressSpinner v-if="loading" style="width: 40px; height: 40px" />
        <div v-else class="form-grid">
          <div class="form-field">
            <label for="primaryColor">Primary Color</label>
            <div style="display: flex; gap: 0.5rem; align-items: center">
              <input id="primaryColor" v-model="theme.primaryColor" type="color" style="width: 40px; height: 36px; border: none; cursor: pointer" />
              <InputText v-model="theme.primaryColor" style="flex: 1" />
            </div>
          </div>

          <div class="form-field">
            <label for="secondaryColor">Secondary Color</label>
            <div style="display: flex; gap: 0.5rem; align-items: center">
              <input id="secondaryColor" v-model="theme.secondaryColor" type="color" style="width: 40px; height: 36px; border: none; cursor: pointer" />
              <InputText v-model="theme.secondaryColor" style="flex: 1" />
            </div>
          </div>

          <div class="form-field form-field-full">
            <label for="fontFamily">Font Family</label>
            <InputText id="fontFamily" v-model="theme.fontFamily" />
          </div>

          <div class="form-field form-field-full">
            <label for="logoUrl">Logo URL</label>
            <InputText id="logoUrl" v-model="theme.logoUrl" placeholder="https://example.com/logo.png" />
          </div>

          <div class="form-field form-field-full">
            <label for="faviconUrl">Favicon URL</label>
            <InputText id="faviconUrl" v-model="theme.faviconUrl" placeholder="https://example.com/favicon.ico" />
          </div>

          <div class="form-field form-field-full">
            <label for="customCss">Custom CSS</label>
            <Textarea id="customCss" v-model="theme.customCss" rows="6" placeholder="/* Custom styles */" />
          </div>

          <div class="form-field form-field-full" style="margin-top: 0.5rem">
            <Button label="Save Theme" icon="pi pi-save" :loading="saving" @click="saveTheme" />
          </div>
        </div>
      </template>
    </Card>
  </div>
</template>

<style scoped>
.page-header {
  margin-bottom: 1.5rem;
}
.page-header h1 {
  font-size: 1.5rem;
  font-weight: 600;
}
.settings-card {
  max-width: 720px;
}
.form-grid {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 1rem;
}
.form-field {
  display: flex;
  flex-direction: column;
  gap: 0.25rem;
}
.form-field label {
  font-size: 0.875rem;
  font-weight: 500;
}
.form-field-full {
  grid-column: 1 / -1;
}
</style>
