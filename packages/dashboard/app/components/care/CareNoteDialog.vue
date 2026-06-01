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
const errors = reactive<Record<string, string>>({ content: '' });
const isEdit = computed(() => !!props.note);
const dialogTitle = computed(() => isEdit.value ? 'Edit Care Note' : 'New Care Note');

watch(() => props.visible, (val) => {
  if (val) {
    errors.content = '';
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

function validate(): boolean {
  errors.content = form.value.content.trim() ? '' : 'Content is required.';
  return !Object.values(errors).some(Boolean);
}

async function save() {
  if (!validate()) return;

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
    :style="{ width: '500px', maxWidth: '92vw' }"
    @update:visible="close"
  >
    <div class="dialog-form">
      <FormField label="Type">
        <template #default="{ id }">
          <Dropdown
            :input-id="id"
            v-model="form.type"
            :options="typeOptions"
            option-label="label"
            option-value="value"
            class="w-full"
          />
        </template>
      </FormField>

      <FormField label="Content" required :error="errors.content">
        <template #default="{ id, describedby, invalid }">
          <Textarea :id="id" v-model="form.content" rows="5" class="w-full" :aria-describedby="describedby" :invalid="invalid" placeholder="Describe the care note..." />
        </template>
      </FormField>

      <FormField label="Follow-up Date">
        <template #default="{ id }">
          <DatePicker :input-id="id" v-model="form.followUpDate" date-format="M dd, yy" show-icon class="w-full" />
        </template>
      </FormField>
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
.w-full {
  width: 100%;
}
</style>
