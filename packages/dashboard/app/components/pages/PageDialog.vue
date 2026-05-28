<script setup lang="ts">
const props = defineProps<{
  visible: boolean;
  page: any | null;
}>();

const emit = defineEmits<{
  (e: 'update:visible', value: boolean): void;
  (e: 'saved'): void;
}>();

const api = useApi();
const toast = useToast();
const saving = ref(false);

const defaultForm = () => ({
  title: '',
  slug: '',
  status: 'draft' as 'draft' | 'published' | 'archived',
  locale: 'en',
  seo: {
    title: '',
    description: '',
    noIndex: false,
  },
});

const form = ref(defaultForm());

const statusOptions = [
  { label: 'Draft', value: 'draft' },
  { label: 'Published', value: 'published' },
  { label: 'Archived', value: 'archived' },
];

const isEdit = computed(() => !!props.page);
const dialogTitle = computed(() => (isEdit.value ? 'Edit Page' : 'New Page'));

// Auto-generate slug from title (only on create)
watch(
  () => form.value.title,
  (title) => {
    if (isEdit.value) return;
    form.value.slug = title
      .toLowerCase()
      .replace(/\s+/g, '-')
      .replace(/[^a-z0-9-]/g, '')
      .replace(/-+/g, '-')
      .replace(/^-|-$/g, '');
  },
);

watch(
  () => props.visible,
  (val) => {
    if (!val) return;
    if (props.page) {
      form.value = {
        title: props.page.title || '',
        slug: props.page.slug || '',
        status: props.page.status || 'draft',
        locale: props.page.locale || 'en',
        seo: {
          title: props.page.seo?.title || '',
          description: props.page.seo?.description || '',
          noIndex: props.page.seo?.noIndex || false,
        },
      };
    } else {
      form.value = defaultForm();
    }
  },
);

function closeDialog() {
  emit('update:visible', false);
}

async function save() {
  if (!form.value.title.trim()) {
    toast.add({ severity: 'warn', summary: 'Validation', detail: 'Title is required', life: 3000 });
    return;
  }

  if (!form.value.slug.trim()) {
    toast.add({ severity: 'warn', summary: 'Validation', detail: 'Slug is required', life: 3000 });
    return;
  }

  saving.value = true;
  try {
    const body: Record<string, any> = {
      title: form.value.title.trim(),
      slug: form.value.slug.trim(),
      status: form.value.status,
      locale: form.value.locale.trim() || 'en',
    };

    const seo: Record<string, any> = {};
    if (form.value.seo.title.trim()) seo.title = form.value.seo.title.trim();
    if (form.value.seo.description.trim()) seo.description = form.value.seo.description.trim();
    if (form.value.seo.noIndex) seo.noIndex = true;
    if (Object.keys(seo).length > 0) {
      body.seo = seo;
    }

    const id = props.page?._id || props.page?.id;
    if (isEdit.value && id) {
      await api(`/api/pages/${id}`, { method: 'PUT', body });
      toast.add({ severity: 'success', summary: 'Updated', detail: 'Page updated successfully', life: 3000 });
    } else {
      await api('/api/pages', { method: 'POST', body });
      toast.add({ severity: 'success', summary: 'Created', detail: 'Page created successfully', life: 3000 });
    }

    emit('saved');
  } catch (err: any) {
    toast.add({
      severity: 'error',
      summary: 'Error',
      detail: err.data?.error?.message || 'Failed to save page',
      life: 4000,
    });
  } finally {
    saving.value = false;
  }
}
</script>

<template>
  <Dialog
    :visible="visible"
    :header="dialogTitle"
    modal
    :closable="true"
    :style="{ width: '650px' }"
    @update:visible="closeDialog"
  >
    <div class="dialog-form">
      <div class="field">
        <label>Title *</label>
        <InputText v-model="form.title" class="w-full" placeholder="Page title" />
      </div>

      <div class="field">
        <label>Slug *</label>
        <InputText v-model="form.slug" class="w-full" placeholder="page-url-slug" />
        <small class="slug-hint">Auto-generated from title. Edit to customise.</small>
      </div>

      <div class="field-row">
        <div class="field">
          <label>Status</label>
          <Dropdown
            v-model="form.status"
            :options="statusOptions"
            option-label="label"
            option-value="value"
            class="w-full"
          />
        </div>
        <div class="field">
          <label>Locale</label>
          <InputText v-model="form.locale" class="w-full" placeholder="en" />
        </div>
      </div>

      <div class="seo-section">
        <div class="section-header">
          <label class="section-label">SEO Settings</label>
        </div>

        <div class="field">
          <label>SEO Title</label>
          <InputText v-model="form.seo.title" class="w-full" placeholder="Override page title for search engines" />
        </div>

        <div class="field">
          <label>Meta Description</label>
          <Textarea v-model="form.seo.description" class="w-full" :rows="2" placeholder="Brief description for search results" />
        </div>

        <div class="field-checkbox">
          <Checkbox v-model="form.seo.noIndex" :binary="true" input-id="noIndex" />
          <label for="noIndex">No Index (hide from search engines)</label>
        </div>
      </div>
    </div>

    <template #footer>
      <div class="dialog-actions">
        <Button label="Cancel" severity="secondary" text @click="closeDialog" />
        <Button :label="isEdit ? 'Update' : 'Create'" :loading="saving" @click="save" />
      </div>
    </template>
  </Dialog>
</template>

<style scoped>
.dialog-form {
  display: flex;
  flex-direction: column;
  gap: 1rem;
}
.field label {
  display: block;
  font-weight: 500;
  margin-bottom: 0.5rem;
  font-size: 0.875rem;
}
.field-row {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 1rem;
}
.field-checkbox {
  display: flex;
  align-items: center;
  gap: 0.75rem;
}
.field-checkbox label {
  font-weight: 500;
  font-size: 0.875rem;
}
.slug-hint {
  display: block;
  margin-top: 0.25rem;
  color: var(--p-text-muted-color);
  font-size: 0.8rem;
}
.seo-section {
  border-top: 1px solid var(--p-surface-200);
  padding-top: 1rem;
  display: flex;
  flex-direction: column;
  gap: 1rem;
}
.section-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
}
.section-label {
  font-weight: 600;
  font-size: 0.9rem;
}
.dialog-actions {
  display: flex;
  justify-content: flex-end;
  gap: 0.75rem;
  padding-top: 0.5rem;
}
.w-full {
  width: 100%;
}
</style>
