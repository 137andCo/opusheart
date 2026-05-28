<script setup lang="ts">
const props = defineProps<{
  visible: boolean;
  group: any | null;
}>();

const emit = defineEmits<{
  (e: 'update:visible', value: boolean): void;
  (e: 'saved'): void;
}>();

const api = useApi();
const toast = useToast();
const saving = ref(false);

const defaultForm = () => ({
  name: '',
  description: '',
  type: 'small_group',
  visibility: 'members',
  meetingSchedule: '',
  location: '',
  maxMembers: null as number | null,
  active: true,
});

const form = ref(defaultForm());

const typeOptions = [
  { label: 'Small Group', value: 'small_group' },
  { label: 'Bible Study', value: 'bible_study' },
  { label: 'Committee', value: 'committee' },
  { label: 'Ministry', value: 'ministry' },
  { label: 'Team', value: 'team' },
  { label: 'Class', value: 'class' },
  { label: 'Custom', value: 'custom' },
];

const visibilityOptions = [
  { label: 'Public', value: 'public' },
  { label: 'Members Only', value: 'members' },
  { label: 'Invite Only', value: 'invite' },
];

const isEdit = computed(() => !!props.group);
const dialogTitle = computed(() => (isEdit.value ? 'Edit Group' : 'New Group'));

watch(
  () => props.visible,
  (val) => {
    if (!val) return;
    if (props.group) {
      form.value = {
        name: props.group.name || '',
        description: props.group.description || '',
        type: props.group.type || 'small_group',
        visibility: props.group.visibility || 'members',
        meetingSchedule: props.group.meetingSchedule || '',
        location: props.group.location || '',
        maxMembers: props.group.maxMembers ?? null,
        active: props.group.active !== false,
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
  if (!form.value.name.trim()) {
    toast.add({ severity: 'warn', summary: 'Validation', detail: 'Name is required', life: 3000 });
    return;
  }

  saving.value = true;
  try {
    const body: Record<string, any> = {
      name: form.value.name.trim(),
      description: form.value.description.trim(),
      type: form.value.type,
      visibility: form.value.visibility,
      meetingSchedule: form.value.meetingSchedule.trim(),
      location: form.value.location.trim(),
    };

    if (form.value.maxMembers != null) {
      body.maxMembers = form.value.maxMembers;
    }

    const id = props.group?._id || props.group?.id;
    if (isEdit.value && id) {
      body.active = form.value.active;
      await api(`/api/groups/${id}`, { method: 'PUT', body });
      toast.add({ severity: 'success', summary: 'Updated', detail: 'Group updated successfully', life: 3000 });
    } else {
      await api('/api/groups', { method: 'POST', body });
      toast.add({ severity: 'success', summary: 'Created', detail: 'Group created successfully', life: 3000 });
    }

    emit('saved');
  } catch (err: any) {
    toast.add({
      severity: 'error',
      summary: 'Error',
      detail: err.data?.error?.message || 'Failed to save group',
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
    :style="{ width: '550px' }"
    @update:visible="closeDialog"
  >
    <div class="dialog-form">
      <div class="field">
        <label>Name *</label>
        <InputText v-model="form.name" class="w-full" placeholder="Group name" />
      </div>

      <div class="field">
        <label>Description</label>
        <Textarea v-model="form.description" class="w-full" :rows="3" placeholder="Group description" />
      </div>

      <div class="field-row">
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
          <label>Visibility</label>
          <Dropdown
            v-model="form.visibility"
            :options="visibilityOptions"
            option-label="label"
            option-value="value"
            class="w-full"
          />
        </div>
      </div>

      <div class="field">
        <label>Meeting Schedule</label>
        <InputText v-model="form.meetingSchedule" class="w-full" placeholder="e.g. Tuesdays 7:00 PM" />
      </div>

      <div class="field">
        <label>Location</label>
        <InputText v-model="form.location" class="w-full" placeholder="Meeting location" />
      </div>

      <div class="field">
        <label>Max Members</label>
        <InputNumber v-model="form.maxMembers" class="w-full" :min="2" placeholder="Unlimited" />
      </div>

      <div v-if="isEdit" class="field-checkbox">
        <InputSwitch v-model="form.active" />
        <label>Active</label>
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
