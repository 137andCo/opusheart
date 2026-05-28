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

const isEdit = computed(() => !!props.fund);
const dialogTitle = computed(() => (isEdit.value ? 'Edit Fund' : 'New Fund'));

watch(
  () => props.visible,
  (val) => {
    if (!val) return;
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

async function save() {
  if (!form.value.name.trim()) {
    toast.add({ severity: 'warn', summary: 'Validation', detail: 'Fund name is required', life: 3000 });
    return;
  }

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
    :style="{ width: '550px' }"
    @update:visible="closeDialog"
  >
    <div class="dialog-form">
      <div class="field">
        <label>Name *</label>
        <InputText v-model="form.name" class="w-full" placeholder="Fund name" />
      </div>

      <div class="field">
        <label>Description</label>
        <Textarea v-model="form.description" class="w-full" :rows="3" placeholder="Fund description" />
      </div>

      <div class="field-row">
        <div class="field">
          <label>Goal ($)</label>
          <InputNumber v-model="form.goal" class="w-full" mode="currency" currency="USD" locale="en-US" placeholder="0.00" />
        </div>
        <div class="field field-switch">
          <label>Active</label>
          <InputSwitch v-model="form.active" />
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
</style>
