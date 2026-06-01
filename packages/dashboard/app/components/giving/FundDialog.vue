<script setup lang="ts">
const props = defineProps<{
  visible: boolean;
  fund: any | null;
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
  goal: null as number | null,
  active: true,
});

const form = ref(defaultForm());
const errors = reactive<Record<string, string>>({ name: '' });

const isEdit = computed(() => !!props.fund);
const dialogTitle = computed(() => (isEdit.value ? 'Edit Fund' : 'New Fund'));

watch(
  () => props.visible,
  (val) => {
    if (!val) return;
    errors.name = '';
    if (props.fund) {
      const f = props.fund;
      form.value = {
        name: f.name || '',
        description: f.description || '',
        goal: f.goal ?? null,
        active: f.active !== false,
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
  errors.name = form.value.name.trim() ? '' : 'Fund name is required.';
  return !Object.values(errors).some(Boolean);
}

async function save() {
  if (!validate()) return;

  saving.value = true;
  try {
    const body: Record<string, any> = {
      name: form.value.name.trim(),
      active: form.value.active,
    };

    if (form.value.description.trim()) {
      body.description = form.value.description.trim();
    }
    if (form.value.goal !== null && form.value.goal !== undefined) {
      body.goal = form.value.goal;
    }

    const id = props.fund?._id || props.fund?.id;
    if (isEdit.value && id) {
      await api(`/api/giving/funds/${id}`, { method: 'PUT', body });
      toast.add({ severity: 'success', summary: 'Updated', detail: 'Fund updated successfully', life: 3000 });
    } else {
      await api('/api/giving/funds', { method: 'POST', body });
      toast.add({ severity: 'success', summary: 'Created', detail: 'Fund created successfully', life: 3000 });
    }

    emit('saved');
  } catch (err: any) {
    toast.add({
      severity: 'error',
      summary: 'Error',
      detail: err.data?.error?.message || 'Failed to save fund',
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
          <InputText :id="id" v-model="form.name" class="w-full" :aria-describedby="describedby" :invalid="invalid" placeholder="Fund name" />
        </template>
      </FormField>

      <FormField label="Description">
        <template #default="{ id }">
          <Textarea :id="id" v-model="form.description" class="w-full" :rows="3" placeholder="Fund description" />
        </template>
      </FormField>

      <div class="field-row">
        <FormField label="Goal ($)">
          <template #default="{ id }">
            <InputNumber :input-id="id" v-model="form.goal" class="w-full" mode="currency" currency="USD" locale="en-US" placeholder="0.00" />
          </template>
        </FormField>
        <div class="field field-switch">
          <label for="fund-active">Active</label>
          <InputSwitch input-id="fund-active" v-model="form.active" />
        </div>
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
@media (max-width: 640px) {
  .field-row {
    grid-template-columns: 1fr;
  }
}
</style>
