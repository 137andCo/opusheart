<script setup lang="ts">
const props = defineProps<{
  visible: boolean;
  memberId: string;
  note?: CareNote | null;
}>();

const emit = defineEmits<{
  'update:visible': [val: boolean];
  saved: [];
}>();

interface CareNote {
  _id: string;
  type: string;
  content: string;
  followUpDate?: string;
}

const api = useApi();
const toast = useToast();

const typeOptions = [
  { label: 'Visit', value: 'visit' },
  { label: 'Hospital', value: 'hospital' },
  { label: 'Bereavement', value: 'bereavement' },
  { label: 'Meal Train', value: 'meal_train' },
  { label: 'Follow Up', value: 'follow_up' },
  { label: 'General', value: 'general' },
];

const form = ref({
  type: 'general',
  content: '',
  followUpDate: null as Date | null,
});

const saving = ref(false);
const isEdit = computed(() => !!props.note);
const dialogTitle = computed(() => isEdit.value ? 'Edit Care Note' : 'New Care Note');

watch(() => props.visible, (val) => {
  if (val) {
    if (props.note) {
      form.value = {
        type: props.note.type,
        content: props.note.content,
        followUpDate: props.note.followUpDate ? new Date(props.note.followUpDate) : null,
      };
    } else {
      form.value = { type: 'general', content: '', followUpDate: null };
    }
  }
});

async function save() {
  if (!form.value.content.trim()) {
    toast.add({ severity: 'warn', summary: 'Validation', detail: 'Content is required', life: 3000 });
    return;
  }

  saving.value = true;
  try {
    const body: Record<string, unknown> = {
      type: form.value.type,
      content: form.value.content,
    };
    if (form.value.followUpDate) {
      body.followUpDate = form.value.followUpDate.toISOString();
    }

    if (isEdit.value && props.note) {
      await api(`/api/care/${props.note._id}`, { method: 'PUT', body });
      toast.add({ severity: 'success', summary: 'Updated', detail: 'Care note updated', life: 3000 });
    } else {
      body.memberId = props.memberId;
      await api('/api/care', { method: 'POST', body });
      toast.add({ severity: 'success', summary: 'Created', detail: 'Care note created', life: 3000 });
    }

    emit('update:visible', false);
    emit('saved');
  } catch {
    toast.add({ severity: 'error', summary: 'Error', detail: 'Failed to save care note', life: 4000 });
  } finally {
    saving.value = false;
  }
}

function close() {
  emit('update:visible', false);
}
</script>

<template>
  <Dialog
    :visible="visible"
    :header="dialogTitle"
    modal
    :style="{ width: '500px' }"
    @update:visible="close"
  >
    <div class="dialog-form">
      <div class="field">
        <label>Type</label>
        <Dropdown
          v-model="form.type"
          :options="typeOptions"
          option-label="label"
          option-value="value"
          class="w-full"
        />
      </div>

      <div class="field">
        <label>Content *</label>
        <Textarea v-model="form.content" rows="5" class="w-full" placeholder="Describe the care note..." />
      </div>

      <div class="field">
        <label>Follow-up Date</label>
        <DatePicker v-model="form.followUpDate" date-format="M dd, yy" show-icon class="w-full" />
      </div>
    </div>

    <template #footer>
      <Button label="Cancel" severity="secondary" text @click="close" />
      <Button :label="isEdit ? 'Update' : 'Create'" icon="pi pi-check" :loading="saving" @click="save" />
    </template>
  </Dialog>
</template>

<style scoped>
.dialog-form {
  display: flex;
  flex-direction: column;
  gap: 1rem;
}
.field {
  display: flex;
  flex-direction: column;
  gap: 0.25rem;
}
.field label {
  font-weight: 600;
  font-size: 0.875rem;
}
.w-full {
  width: 100%;
}
</style>
