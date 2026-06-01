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
const errors = reactive<Record<string, string>>({ title: '', slug: '' });

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
    errors.title = '';
    errors.slug = '';
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

function validate(): boolean {
  errors.title = form.value.title.trim() ? '' : 'Title is required.';
  errors.slug = form.value.slug.trim() ? '' : 'Slug is required.';
  return !Object.values(errors).some(Boolean);
}

async function save() {
  if (!validate()) return;

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
    :style="{ width: '650px', maxWidth: '92vw' }"
    @update:visible="closeDialog"
  >
    <div class="dialog-form">
      <FormField label="Title" required :error="errors.title">
        <template #default="{ id, describedby, invalid }">
          <InputText :id="id" v-model="form.title" class="w-full" :aria-describedby="describedby" :invalid="invalid" placeholder="Page title" />
        </template>
      </FormField>

      <FormField label="Slug" required :error="errors.slug" hint="Auto-generated from title. Edit to customise.">
        <template #default="{ id, describedby, invalid }">
          <InputText :id="id" v-model="form.slug" class="w-full" :aria-describedby="describedby" :invalid="invalid" placeholder="page-url-slug" />
        </template>
      </FormField>

      <div class="field-row">
        <FormField label="Status">
          <template #default="{ id }">
            <Dropdown
              :input-id="id"
              v-model="form.status"
              :options="statusOptions"
              option-label="label"
              option-value="value"
              class="w-full"
            />
          </template>
        </FormField>
        <FormField label="Locale">
          <template #default="{ id }">
            <InputText :id="id" v-model="form.locale" class="w-full" placeholder="en" />
          </template>
        </FormField>
      </div>

      <div class="seo-section">
        <div class="section-header">
          <span class="section-label">SEO Settings</span>
        </div>

        <FormField label="SEO Title">
          <template #default="{ id }">
            <InputText :id="id" v-model="form.seo.title" class="w-full" placeholder="Override page title for search engines" />
          </template>
        </FormField>

        <FormField label="Meta Description">
          <template #default="{ id }">
            <Textarea :id="id" v-model="form.seo.description" class="w-full" :rows="2" placeholder="Brief description for search results" />
          </template>
        </FormField>

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
@media (max-width: 640px) {
  .field-row {
    grid-template-columns: 1fr;
  }
}
</style>
