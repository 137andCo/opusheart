<script setup lang="ts">
const props = defineProps<{
  visible: boolean;
  fundsList: any[];
}>();

const emit = defineEmits<{
  (e: 'update:visible', value: boolean): void;
  (e: 'saved'): void;
}>();

const api = useApi();
const toast = useToast();
const saving = ref(false);

const methodOptions = [
  { label: 'Cash', value: 'cash' },
  { label: 'Check', value: 'check' },
  { label: 'Online', value: 'online' },
  { label: 'Other', value: 'other' },
];

const scheduleOptions = [
  { label: 'Weekly', value: 'weekly' },
  { label: 'Bi-weekly', value: 'biweekly' },
  { label: 'Monthly', value: 'monthly' },
];

const defaultForm = () => ({
  amount: null as number | null,
  currency: 'USD',
  fund: '',
  method: 'cash' as string,
  recurring: false,
  recurringSchedule: '' as string,
  notes: '',
});

const form = ref(defaultForm());

const fundOptions = computed(() =>
  props.fundsList.map((f: any) => ({ label: f.name, value: f._id || f.id })),
);

watch(
  () => props.visible,
  (val) => {
    if (!val) return;
    form.value = defaultForm();
  },
);

function closeDialog() {
  emit('update:visible', false);
}

async function save() {
  if (!form.value.amount || form.value.amount <= 0) {
    toast.add({ severity: 'warn', summary: 'Validation', detail: 'Amount must be greater than 0', life: 3000 });
    return;
  }
  if (!form.value.fund) {
    toast.add({ severity: 'warn', summary: 'Validation', detail: 'Fund is required', life: 3000 });
    return;
  }

  saving.value = true;
  try {
    const body: Record<string, any> = {
      amount: form.value.amount,
      fund: form.value.fund,
      method: form.value.method,
    };

    if (form.value.currency && form.value.currency !== 'USD') {
      body.currency = form.value.currency;
    }
    if (form.value.recurring) {
      body.recurring = true;
      if (form.value.recurringSchedule) {
        body.recurringSchedule = form.value.recurringSchedule;
      }
    }
    if (form.value.notes.trim()) {
      body.notes = form.value.notes.trim();
    }

    await api('/api/giving/donations', { method: 'POST', body });
    toast.add({ severity: 'success', summary: 'Recorded', detail: 'Donation recorded successfully', life: 3000 });
    emit('saved');
  } catch (err: any) {
    toast.add({
      severity: 'error',
      summary: 'Error',
      detail: err.data?.error?.message || 'Failed to record donation',
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
    header="Record Donation"
    modal
    :closable="true"
    :style="{ width: '550px' }"
    @update:visible="closeDialog"
  >
    <div class="dialog-form">
      <div class="field-row">
        <div class="field">
          <label>Amount *</label>
          <InputNumber v-model="form.amount" class="w-full" mode="currency" currency="USD" locale="en-US" placeholder="0.00" />
        </div>
        <div class="field">
          <label>Method</label>
          <Dropdown
            v-model="form.method"
            :options="methodOptions"
            option-label="label"
            option-value="value"
            class="w-full"
          />
        </div>
      </div>

      <div class="field">
        <label>Fund *</label>
        <Dropdown
          v-model="form.fund"
          :options="fundOptions"
          option-label="label"
          option-value="value"
          class="w-full"
          placeholder="Select fund"
        />
      </div>

      <div class="field-row">
        <div class="field field-switch">
          <label>Recurring</label>
          <InputSwitch v-model="form.recurring" />
        </div>
        <div v-if="form.recurring" class="field">
          <label>Schedule</label>
          <Dropdown
            v-model="form.recurringSchedule"
            :options="scheduleOptions"
            option-label="label"
            option-value="value"
            class="w-full"
            placeholder="Select schedule"
          />
        </div>
      </div>

      <div class="field">
        <label>Notes</label>
        <Textarea v-model="form.notes" class="w-full" :rows="3" placeholder="Optional notes" />
      </div>
    </div>

    <template #footer>
      <div class="dialog-actions">
        <Button label="Cancel" severity="secondary" text @click="closeDialog" />
        <Button label="Record" :loading="saving" @click="save" />
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
.field-switch {
  display: flex;
  flex-direction: column;
  justify-content: center;
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
