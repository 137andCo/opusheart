<script setup lang="ts">
const props = defineProps<{
  visible: boolean;
}>();

const emit = defineEmits<{
  (e: 'update:visible', value: boolean): void;
  (e: 'saved'): void;
}>();

const api = useApi();
const toast = useToast();

const saving = ref(false);
const form = ref({
  name: '',
  type: '' as string,
  description: '',
  capacity: null as number | null,
});

const typeOptions = [
  { label: 'Room', value: 'room' },
  { label: 'Vehicle', value: 'vehicle' },
  { label: 'Equipment', value: 'equipment' },
  { label: 'Other', value: 'other' },
];

const isValid = computed(() =>
  form.value.name.trim() !== '' && form.value.type !== '',
);

watch(() => props.visible, (val) => {
  if (val) {
    form.value = { name: '', type: '', description: '', capacity: null };
  }
});

async function save() {
  if (!isValid.value) return;
  saving.value = true;
  try {
    const body: Record<string, any> = {
      name: form.value.name.trim(),
      type: form.value.type,
    };
    if (form.value.description.trim()) {
      body.description = form.value.description.trim();
    }
    if (form.value.capacity !== null && form.value.capacity > 0) {
      body.capacity = form.value.capacity;
    }
    await api('/api/bookings/resources', { method: 'POST', body });
    toast.add({ severity: 'success', summary: 'Created', detail: 'Resource created successfully', life: 3000 });
    emit('saved');
  } catch (err: any) {
    toast.add({ severity: 'error', summary: 'Error', detail: err.data?.error?.message || 'Failed to create resource', life: 4000 });
  } finally {
    saving.value = false;
  }
}

function close() {
  emit('update:visible', false);
}
</script>

<template>
  <Dialog
    :visible="visible"
    header="New Resource"
    :modal="true"
    :closable="true"
    :style="{ width: '450px', maxWidth: '92vw' }"
    @update:visible="close"
  >
    <div class="dialog-form">
      <FormField label="Name" required>
        <template #default="{ id }">
          <InputText
            :id="id"
            v-model="form.name"
            class="w-full"
            placeholder="Resource name"
          />
        </template>
      </FormField>

      <FormField label="Type" required>
        <template #default="{ id }">
          <Dropdown
            :input-id="id"
            v-model="form.type"
            :options="typeOptions"
            option-label="label"
            option-value="value"
            placeholder="Select type"
            class="w-full"
          />
        </template>
      </FormField>

      <FormField label="Description">
        <template #default="{ id }">
          <Textarea
            :id="id"
            v-model="form.description"
            class="w-full"
            rows="3"
            placeholder="Optional description"
          />
        </template>
      </FormField>

      <FormField label="Capacity">
        <template #default="{ id }">
          <InputNumber
            :input-id="id"
            v-model="form.capacity"
            class="w-full"
            placeholder="e.g. 50"
            :min="0"
          />
        </template>
      </FormField>
    </div>

    <template #footer>
      <Button label="Cancel" text @click="close" />
      <Button label="Create Resource" icon="pi pi-check" :loading="saving" :disabled="!isValid" @click="save" />
    </template>
  </Dialog>
</template>

<style scoped>
.dialog-form {
  display: flex;
  flex-direction: column;
  gap: 1rem;
}
.w-full {
  width: 100%;
}
</style>
