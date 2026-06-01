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
const errors = reactive<Record<string, string>>({ name: '' });

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
    errors.name = '';
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

function validate(): boolean {
  errors.name = form.value.name.trim() ? '' : 'Name is required.';
  return !Object.values(errors).some(Boolean);
}

async function save() {
  if (!validate()) return;

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
    :style="{ width: '550px', maxWidth: '92vw' }"
    @update:visible="closeDialog"
  >
    <div class="dialog-form">
      <FormField label="Name" required :error="errors.name">
        <template #default="{ id, describedby, invalid }">
          <InputText :id="id" v-model="form.name" class="w-full" :aria-describedby="describedby" :invalid="invalid" placeholder="Group name" />
        </template>
      </FormField>

      <FormField label="Description">
        <template #default="{ id }">
          <Textarea :id="id" v-model="form.description" class="w-full" :rows="3" placeholder="Group description" />
        </template>
      </FormField>

      <div class="field-row">
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
        <FormField label="Visibility">
          <template #default="{ id }">
            <Dropdown
              :input-id="id"
              v-model="form.visibility"
              :options="visibilityOptions"
              option-label="label"
              option-value="value"
              class="w-full"
            />
          </template>
        </FormField>
      </div>

      <FormField label="Meeting Schedule">
        <template #default="{ id }">
          <InputText :id="id" v-model="form.meetingSchedule" class="w-full" placeholder="e.g. Tuesdays 7:00 PM" />
        </template>
      </FormField>

      <FormField label="Location">
        <template #default="{ id }">
          <InputText :id="id" v-model="form.location" class="w-full" placeholder="Meeting location" />
        </template>
      </FormField>

      <FormField label="Max Members">
        <template #default="{ id }">
          <InputNumber :input-id="id" v-model="form.maxMembers" class="w-full" :min="2" placeholder="Unlimited" />
        </template>
      </FormField>

      <div v-if="isEdit" class="field-checkbox">
        <InputSwitch input-id="group-active" v-model="form.active" />
        <label for="group-active">Active</label>
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
