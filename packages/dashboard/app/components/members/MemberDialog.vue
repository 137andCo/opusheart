<script setup lang="ts">
const props = defineProps<{
  visible: boolean;
  member: Record<string, any> | null;
}>();

const emit = defineEmits<{
  (e: 'update:visible', val: boolean): void;
  (e: 'saved'): void;
}>();

const api = useApi();
const toast = useToast();

const saving = ref(false);

const form = reactive({
  userId: '',
  membershipStatus: 'visitor',
  attendanceOptIn: false,
});

const errors = reactive<Record<string, string>>({ userId: '' });

const statusOptions = [
  { label: 'Active', value: 'active' },
  { label: 'Inactive', value: 'inactive' },
  { label: 'Visitor', value: 'visitor' },
];

const isEdit = computed(() => !!props.member);
const dialogTitle = computed(() => isEdit.value ? 'Edit Member' : 'Add Member');

watch(() => props.visible, (val) => {
  if (val) {
    errors.userId = '';
    if (props.member) {
      form.userId = props.member.userId?._id || props.member.userId || '';
      form.membershipStatus = props.member.membershipStatus || 'visitor';
      form.attendanceOptIn = props.member.attendanceOptIn || false;
    } else {
      form.userId = '';
      form.membershipStatus = 'visitor';
      form.attendanceOptIn = false;
    }
  }
});

function close() {
  emit('update:visible', false);
}

async function save() {
  errors.userId = '';
  if (!isEdit.value && !form.userId.trim()) {
    errors.userId = 'User ID is required.';
    return;
  }
  saving.value = true;
  try {
    if (isEdit.value) {
      await api(`/api/members/${props.member!._id}`, {
        method: 'PUT',
        body: {
          membershipStatus: form.membershipStatus,
          attendanceOptIn: form.attendanceOptIn,
        },
      });
      toast.add({ severity: 'success', summary: 'Updated', detail: 'Member updated successfully', life: 3000 });
    } else {
      await api('/api/members', {
        method: 'POST',
        body: {
          userId: form.userId,
          membershipStatus: form.membershipStatus,
          attendanceOptIn: form.attendanceOptIn,
        },
      });
      toast.add({ severity: 'success', summary: 'Created', detail: 'Member created successfully', life: 3000 });
    }
    emit('saved');
  } catch (err: any) {
    const message = err.data?.error?.message || 'An error occurred';
    toast.add({ severity: 'error', summary: 'Error', detail: message, life: 4000 });
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
    :style="{ width: '500px', maxWidth: '92vw' }"
    @update:visible="emit('update:visible', $event)"
  >
    <div class="dialog-form">
      <FormField
        v-if="!isEdit"
        label="User ID"
        required
        :error="errors.userId"
        hint="The account ID of the person to enroll as a member."
      >
        <template #default="{ id, describedby, invalid }">
          <InputText
            :id="id"
            v-model="form.userId"
            class="w-full"
            :aria-describedby="describedby"
            :invalid="invalid"
            placeholder="Enter user ID"
          />
        </template>
      </FormField>

      <FormField label="Membership Status">
        <template #default="{ id }">
          <Dropdown
            :input-id="id"
            v-model="form.membershipStatus"
            :options="statusOptions"
            option-label="label"
            option-value="value"
            class="w-full"
          />
        </template>
      </FormField>

      <FormField label="Attendance Opt-In">
        <template #default="{ id }">
          <InputSwitch :input-id="id" v-model="form.attendanceOptIn" />
        </template>
      </FormField>
    </div>

    <template #footer>
      <div class="dialog-actions">
        <Button label="Cancel" severity="secondary" text @click="close" />
        <Button :label="isEdit ? 'Update' : 'Create'" :loading="saving" @click="save" />
      </div>
    </template>
  </Dialog>
</template>

<style scoped>
.dialog-form { display: flex; flex-direction: column; gap: 1rem; }
.dialog-actions { display: flex; justify-content: flex-end; gap: 0.75rem; padding-top: 0.5rem; }
.w-full { width: 100%; }
</style>
