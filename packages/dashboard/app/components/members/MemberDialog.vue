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

const statusOptions = [
  { label: 'Active', value: 'active' },
  { label: 'Inactive', value: 'inactive' },
  { label: 'Visitor', value: 'visitor' },
];

const isEdit = computed(() => !!props.member);
const dialogTitle = computed(() => isEdit.value ? 'Edit Member' : 'Add Member');

watch(() => props.visible, (val) => {
  if (val) {
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
      if (!form.userId.trim()) {
        toast.add({ severity: 'error', summary: 'Validation', detail: 'User ID is required', life: 4000 });
        saving.value = false;
        return;
      }
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
    :style="{ width: '500px' }"
    @update:visible="emit('update:visible', $event)"
  >
    <div class="dialog-form">
      <div v-if="!isEdit" class="field">
        <label for="userId">User ID</label>
        <InputText id="userId" v-model="form.userId" class="w-full" placeholder="Enter user ID" />
      </div>

      <div class="field">
        <label for="status">Membership Status</label>
        <Dropdown
          id="status"
          v-model="form.membershipStatus"
          :options="statusOptions"
          option-label="label"
          option-value="value"
          class="w-full"
        />
      </div>

      <div class="field">
        <label for="attendanceOptIn">Attendance Opt-In</label>
        <InputSwitch id="attendanceOptIn" v-model="form.attendanceOptIn" />
      </div>
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
.field label { display: block; font-weight: 500; margin-bottom: 0.5rem; font-size: 0.875rem; }
.dialog-actions { display: flex; justify-content: flex-end; gap: 0.75rem; padding-top: 0.5rem; }
.w-full { width: 100%; }
</style>
