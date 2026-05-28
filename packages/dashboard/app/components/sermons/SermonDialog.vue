<script setup lang="ts">
const props = defineProps<{
  visible: boolean;
  sermon: any | null;
  seriesList: any[];
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
  speaker: '',
  date: new Date(),
  series: '',
  seriesOrder: null as number | null,
  description: '',
  scriptureReferences: [] as string[],
  audioUrl: '',
  videoUrl: '',
  notes: '',
  tags: [] as string[],
  published: false,
  podcastInclude: false,
});

const form = ref(defaultForm());

const isEdit = computed(() => !!props.sermon);
const dialogTitle = computed(() => (isEdit.value ? 'Edit Sermon' : 'New Sermon'));

const seriesOptions = computed(() => [
  { label: 'None', value: '' },
  ...props.seriesList.map((s: any) => ({ label: s.title, value: s._id || s.id })),
]);

watch(
  () => props.visible,
  (val) => {
    if (!val) return;
    if (props.sermon) {
      const s = props.sermon;
      form.value = {
        title: s.title || '',
        speaker: s.speaker || '',
        date: s.date ? new Date(s.date) : new Date(),
        series: typeof s.series === 'object' ? (s.series?._id || s.series?.id || '') : (s.series || ''),
        seriesOrder: s.seriesOrder ?? null,
        description: s.description || '',
        scriptureReferences: s.scriptureReferences || [],
        audioUrl: s.audioUrl || '',
        videoUrl: s.videoUrl || '',
        notes: s.notes || '',
        tags: s.tags || [],
        published: s.published || false,
        podcastInclude: s.podcastInclude || false,
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
  if (!form.value.speaker.trim()) {
    toast.add({ severity: 'warn', summary: 'Validation', detail: 'Speaker is required', life: 3000 });
    return;
  }

  saving.value = true;
  try {
    const body: Record<string, any> = {
      title: form.value.title.trim(),
      speaker: form.value.speaker.trim(),
      date: form.value.date.toISOString(),
      description: form.value.description.trim(),
      scriptureReferences: form.value.scriptureReferences,
      notes: form.value.notes.trim(),
      tags: form.value.tags,
      published: form.value.published,
      podcastInclude: form.value.podcastInclude,
    };

    if (form.value.series) {
      body.series = form.value.series;
    }
    if (form.value.seriesOrder !== null && form.value.seriesOrder !== undefined) {
      body.seriesOrder = form.value.seriesOrder;
    }
    if (form.value.audioUrl.trim()) {
      body.audioUrl = form.value.audioUrl.trim();
    }
    if (form.value.videoUrl.trim()) {
      body.videoUrl = form.value.videoUrl.trim();
    }

    const id = props.sermon?._id || props.sermon?.id;
    if (isEdit.value && id) {
      await api(`/api/sermons/${id}`, { method: 'PUT', body });
      toast.add({ severity: 'success', summary: 'Updated', detail: 'Sermon updated successfully', life: 3000 });
    } else {
      await api('/api/sermons', { method: 'POST', body });
      toast.add({ severity: 'success', summary: 'Created', detail: 'Sermon created successfully', life: 3000 });
    }

    emit('saved');
  } catch (err: any) {
    toast.add({
      severity: 'error',
      summary: 'Error',
      detail: err.data?.error?.message || 'Failed to save sermon',
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
    :style="{ width: '700px' }"
    @update:visible="closeDialog"
  >
    <div class="dialog-form">
      <div class="field-row">
        <div class="field">
          <label>Title *</label>
          <InputText v-model="form.title" class="w-full" placeholder="Sermon title" />
        </div>
        <div class="field">
          <label>Speaker *</label>
          <InputText v-model="form.speaker" class="w-full" placeholder="Speaker name" />
        </div>
      </div>

      <div class="field-row">
        <div class="field">
          <label>Date</label>
          <Calendar
            v-model="form.date"
            class="w-full"
            date-format="mm/dd/yy"
            placeholder="Sermon date"
          />
        </div>
        <div class="field">
          <label>Series</label>
          <Dropdown
            v-model="form.series"
            :options="seriesOptions"
            option-label="label"
            option-value="value"
            class="w-full"
            placeholder="Select series"
          />
        </div>
      </div>

      <div class="field">
        <label>Description</label>
        <Textarea v-model="form.description" class="w-full" :rows="3" placeholder="Sermon description" />
      </div>

      <div class="field">
        <label>Scripture References</label>
        <Chips v-model="form.scriptureReferences" class="w-full" placeholder="e.g. John 3:16" />
      </div>

      <div class="field-row">
        <div class="field">
          <label>Audio URL</label>
          <InputText v-model="form.audioUrl" class="w-full" placeholder="https://..." />
        </div>
        <div class="field">
          <label>Video URL</label>
          <InputText v-model="form.videoUrl" class="w-full" placeholder="https://..." />
        </div>
      </div>

      <div class="field">
        <label>Notes</label>
        <Textarea v-model="form.notes" class="w-full" :rows="4" placeholder="Sermon notes" />
      </div>

      <div class="field">
        <label>Tags</label>
        <Chips v-model="form.tags" class="w-full" placeholder="Add tags" />
      </div>

      <div class="field-row-switches">
        <div class="field-checkbox">
          <InputSwitch v-model="form.published" />
          <label>Published</label>
        </div>
        <div class="field-checkbox">
          <InputSwitch v-model="form.podcastInclude" />
          <label>Include in Podcast</label>
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
.field-row-switches {
  display: flex;
  gap: 2rem;
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
