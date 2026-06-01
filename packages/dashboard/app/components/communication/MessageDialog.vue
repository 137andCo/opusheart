<script setup lang="ts">
const props = defineProps<{
  visible: boolean;
  message: any | null;
}>();

const emit = defineEmits<{
  (e: 'update:visible', value: boolean): void;
  (e: 'saved'): void;
}>();

const api = useApi();
const toast = useToast();
const saving = ref(false);

const channelOptions = [
  { label: 'Email', value: 'email' },
  { label: 'Push Notification', value: 'push' },
  { label: 'SMS', value: 'sms' },
  { label: 'Announcement', value: 'announcement' },
];

const audienceTypeOptions = [
  { label: 'All Members', value: 'all' },
  { label: 'Group', value: 'group' },
  { label: 'Role', value: 'role' },
  { label: 'Custom', value: 'custom' },
];

const defaultForm = () => ({
  subject: '',
  body: '',
  bodyPlain: '',
  channel: 'email' as 'email' | 'push' | 'sms' | 'announcement',
  audienceType: 'all' as 'all' | 'group' | 'role' | 'custom',
  scheduledFor: null as Date | null,
});

const form = ref(defaultForm());
const errors = reactive<Record<string, string>>({ subject: '', body: '' });

const isEdit = computed(() => !!props.message);
const dialogTitle = computed(() => (isEdit.value ? 'Edit Message' : 'New Message'));

watch(
  () => props.visible,
  (val) => {
    if (!val) return;
    errors.subject = '';
    errors.body = '';
    if (props.message) {
      form.value = {
        subject: props.message.subject || '',
        body: props.message.body || '',
        bodyPlain: props.message.bodyPlain || '',
        channel: props.message.channel || 'email',
        audienceType: props.message.audience?.type || 'all',
        scheduledFor: props.message.scheduledFor ? new Date(props.message.scheduledFor) : null,
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
  errors.subject = form.value.subject.trim() ? '' : 'Subject is required.';
  errors.body = form.value.body.trim() ? '' : 'Message body is required.';
  return !Object.values(errors).some(Boolean);
}

async function save() {
  if (!validate()) return;

  saving.value = true;
  try {
    const body: Record<string, any> = {
      subject: form.value.subject.trim(),
      body: form.value.body.trim(),
      bodyPlain: form.value.bodyPlain.trim() || form.value.body.trim(),
      channel: form.value.channel,
      audience: {
        type: form.value.audienceType,
      },
    };

    if (form.value.scheduledFor) {
      body.scheduledFor = form.value.scheduledFor.toISOString();
    }

    const id = props.message?._id || props.message?.id;
    if (isEdit.value && id) {
      await api(`/api/messages/${id}`, { method: 'PUT', body });
      toast.add({ severity: 'success', summary: 'Updated', detail: 'Message updated successfully', life: 3000 });
    } else {
      await api('/api/messages', { method: 'POST', body });
      toast.add({ severity: 'success', summary: 'Created', detail: 'Message created successfully', life: 3000 });
    }

    emit('saved');
  } catch (err: any) {
    toast.add({
      severity: 'error',
      summary: 'Error',
      detail: err.data?.error?.message || 'Failed to save message',
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
      <FormField label="Subject" required :error="errors.subject">
        <template #default="{ id, describedby, invalid }">
          <InputText :id="id" v-model="form.subject" class="w-full" :aria-describedby="describedby" :invalid="invalid" placeholder="Message subject" />
        </template>
      </FormField>

      <FormField label="Body" required :error="errors.body">
        <template #default="{ id, describedby, invalid }">
          <Textarea :id="id" v-model="form.body" class="w-full" :rows="5" :aria-describedby="describedby" :invalid="invalid" placeholder="Message body (HTML supported)" />
        </template>
      </FormField>

      <FormField label="Plain Text Body">
        <template #default="{ id }">
          <Textarea :id="id" v-model="form.bodyPlain" class="w-full" :rows="3" placeholder="Plain text version (auto-generated from body if empty)" />
        </template>
      </FormField>

      <div class="field-row">
        <FormField label="Channel">
          <template #default="{ id }">
            <Dropdown
              :input-id="id"
              v-model="form.channel"
              :options="channelOptions"
              option-label="label"
              option-value="value"
              class="w-full"
            />
          </template>
        </FormField>
        <FormField label="Audience">
          <template #default="{ id }">
            <Dropdown
              :input-id="id"
              v-model="form.audienceType"
              :options="audienceTypeOptions"
              option-label="label"
              option-value="value"
              class="w-full"
            />
          </template>
        </FormField>
      </div>

      <FormField label="Schedule For">
        <template #default="{ id }">
          <Calendar
            :input-id="id"
            v-model="form.scheduledFor"
            class="w-full"
            :show-time="true"
            date-format="mm/dd/yy"
            placeholder="Send immediately (leave empty)"
            :show-button-bar="true"
          />
        </template>
      </FormField>
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
