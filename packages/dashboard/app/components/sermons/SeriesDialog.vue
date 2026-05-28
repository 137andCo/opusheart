<script setup lang="ts">
const props = defineProps<{
  visible: boolean;
  series: any | null;
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
  description: '',
  imageUrl: '',
  startDate: null as Date | null,
  endDate: null as Date | null,
});

const form = ref(defaultForm());

const isEdit = computed(() => !!props.series);
const dialogTitle = computed(() => (isEdit.value ? 'Edit Series' : 'New Series'));

watch(
  () => props.visible,
  (val) => {
    if (!val) return;
    if (props.series) {
      const s = props.series;
      form.value = {
        title: s.title || '',
        description: s.description || '',
        imageUrl: s.imageUrl || '',
        startDate: s.startDate ? new Date(s.startDate) : null,
        endDate: s.endDate ? new Date(s.endDate) : null,
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

  saving.value = true;
  try {
    const body: Record<string, any> = {
      title: form.value.title.trim(),
      description: form.value.description.trim(),
    };

    if (form.value.imageUrl.trim()) {
      body.imageUrl = form.value.imageUrl.trim();
    }
    if (form.value.startDate) {
      body.startDate = form.value.startDate.toISOString();
    }
    if (form.value.endDate) {
      body.endDate = form.value.endDate.toISOString();
    }

    const id = props.series?._id || props.series?.id;
    if (isEdit.value && id) {
      await api(`/api/sermons/series/${id}`, { method: 'PUT', body });
      toast.add({ severity: 'success', summary: 'Updated', detail: 'Series updated successfully', life: 3000 });
    } else {
      await api('/api/sermons/series', { method: 'POST', body });
      toast.add({ severity: 'success', summary: 'Created', detail: 'Series created successfully', life: 3000 });
    }

    emit('saved');
  } catch (err: any) {
    toast.add({
      severity: 'error',
      summary: 'Error',
      detail: err.data?.error?.message || 'Failed to save series',
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
    :style="{ width: '500px' }"
    @update:visible="closeDialog"
  >
    <div class="dialog-form">
      <div class="field">
        <label>Title *</label>
        <InputText v-model="form.title" class="w-full" placeholder="Series title" />
      </div>

      <div class="field">
        <label>Description</label>
        <Textarea v-model="form.description" class="w-full" :rows="3" placeholder="Series description" />
      </div>

      <div class="field">
        <label>Image URL</label>
        <InputText v-model="form.imageUrl" class="w-full" placeholder="https://..." />
      </div>

      <div class="field-row">
        <div class="field">
          <label>Start Date</label>
          <Calendar
            v-model="form.startDate"
            class="w-full"
            date-format="mm/dd/yy"
            placeholder="Start date"
          />
        </div>
        <div class="field">
          <label>End Date</label>
          <Calendar
            v-model="form.endDate"
            class="w-full"
            date-format="mm/dd/yy"
            placeholder="End date"
          />
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
