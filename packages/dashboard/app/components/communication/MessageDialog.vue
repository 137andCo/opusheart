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

const isEdit = computed(() => !!props.message);
const dialogTitle = computed(() => (isEdit.value ? 'Edit Message' : 'New Message'));

watch(
  () => props.visible,
  (val) => {
    if (!val) return;
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

async function save() {
  if (!form.value.subject.trim()) {
    toast.add({ severity: 'warn', summary: 'Validation', detail: 'Subject is required', life: 3000 });
    return;
  }
  if (!form.value.body.trim()) {
    toast.add({ severity: 'warn', summary: 'Validation', detail: 'Message body is required', life: 3000 });
    return;
  }

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
    :style="{ width: '650px' }"
    @update:visible="closeDialog"
  >
    <div class="dialog-form">
      <div class="field">
        <label>Subject *</label>
        <InputText v-model="form.subject" class="w-full" placeholder="Message subject" />
      </div>

      <div class="field">
        <label>Body *</label>
        <Textarea v-model="form.body" class="w-full" :rows="5" placeholder="Message body (HTML supported)" />
      </div>

      <div class="field">
        <label>Plain Text Body</label>
        <Textarea v-model="form.bodyPlain" class="w-full" :rows="3" placeholder="Plain text version (auto-generated from body if empty)" />
      </div>

      <div class="field-row">
        <div class="field">
          <label>Channel</label>
          <Dropdown
            v-model="form.channel"
            :options="channelOptions"
            option-label="label"
            option-value="value"
            class="w-full"
          />
        </div>
        <div class="field">
          <label>Audience</label>
          <Dropdown
            v-model="form.audienceType"
            :options="audienceTypeOptions"
            option-label="label"
            option-value="value"
            class="w-full"
          />
        </div>
      </div>

      <div class="field">
        <label>Schedule For</label>
        <Calendar
          v-model="form.scheduledFor"
          class="w-full"
          :show-time="true"
          date-format="mm/dd/yy"
          placeholder="Send immediately (leave empty)"
          :show-button-bar="true"
        />
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
