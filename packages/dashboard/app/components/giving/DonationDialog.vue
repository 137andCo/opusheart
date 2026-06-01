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
const errors = reactive<Record<string, string>>({ amount: '', fund: '' });

const fundOptions = computed(() =>
  props.fundsList.map((f: any) => ({ label: f.name, value: f._id || f.id })),
);

watch(
  () => props.visible,
  (val) => {
    if (!val) return;
    errors.amount = '';
    errors.fund = '';
    form.value = defaultForm();
  },
);

function closeDialog() {
  emit('update:visible', false);
}

function validate(): boolean {
  errors.amount = form.value.amount && form.value.amount > 0 ? '' : 'Amount must be greater than 0.';
  errors.fund = form.value.fund ? '' : 'Fund is required.';
  return !Object.values(errors).some(Boolean);
}

async function save() {
  if (!validate()) return;

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
    :style="{ width: '550px', maxWidth: '92vw' }"
    @update:visible="closeDialog"
  >
    <div class="dialog-form">
      <div class="field-row">
        <FormField label="Amount" required :error="errors.amount">
          <template #default="{ id, describedby, invalid }">
            <InputNumber :input-id="id" v-model="form.amount" class="w-full" mode="currency" currency="USD" locale="en-US" :aria-describedby="describedby" :invalid="invalid" placeholder="0.00" />
          </template>
        </FormField>
        <FormField label="Method">
          <template #default="{ id }">
            <Dropdown
              :input-id="id"
              v-model="form.method"
              :options="methodOptions"
              option-label="label"
              option-value="value"
              class="w-full"
            />
          </template>
        </FormField>
      </div>

      <FormField label="Fund" required :error="errors.fund">
        <template #default="{ id, describedby, invalid }">
          <Dropdown
            :input-id="id"
            v-model="form.fund"
            :options="fundOptions"
            option-label="label"
            option-value="value"
            class="w-full"
            :aria-describedby="describedby"
            :invalid="invalid"
            placeholder="Select fund"
          />
        </template>
      </FormField>

      <div class="field-row">
        <div class="field-switch">
          <InputSwitch input-id="donation-recurring" v-model="form.recurring" />
          <label for="donation-recurring">Recurring</label>
        </div>
        <FormField v-if="form.recurring" label="Schedule">
          <template #default="{ id }">
            <Dropdown
              :input-id="id"
              v-model="form.recurringSchedule"
              :options="scheduleOptions"
              option-label="label"
              option-value="value"
              class="w-full"
              placeholder="Select schedule"
            />
          </template>
        </FormField>
      </div>

      <FormField label="Notes">
        <template #default="{ id }">
          <Textarea :id="id" v-model="form.notes" class="w-full" :rows="3" placeholder="Optional notes" />
        </template>
      </FormField>
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
.field-row {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 1rem;
}
.field-switch {
  display: flex;
  align-items: center;
  gap: 0.75rem;
}
.field-switch label {
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
