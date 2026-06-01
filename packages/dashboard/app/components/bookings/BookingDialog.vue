<script setup lang="ts">
const props = defineProps<{
  visible: boolean;
  resourcesList: any[];
}>();

const emit = defineEmits<{
  (e: 'update:visible', value: boolean): void;
  (e: 'saved'): void;
}>();

const api = useApi();
const toast = useToast();

const saving = ref(false);
const form = ref({
  title: '',
  resource: '',
  startTime: null as Date | null,
  endTime: null as Date | null,
  notes: '',
});

const resourceOptions = computed(() =>
  props.resourcesList
    .filter((r: any) => r.active !== false)
    .map((r: any) => ({ label: r.name, value: r._id || r.id })),
);

const isValid = computed(() =>
  form.value.title.trim() !== ''
  && form.value.resource !== ''
  && form.value.startTime !== null
  && form.value.endTime !== null,
);

watch(() => props.visible, (val) => {
  if (val) {
    form.value = { title: '', resource: '', startTime: null, endTime: null, notes: '' };
  }
});

async function save() {
  if (!isValid.value) return;
  saving.value = true;
  try {
    await api('/api/bookings', {
      method: 'POST',
      body: {
        title: form.value.title.trim(),
        resource: form.value.resource,
        startTime: form.value.startTime!.toISOString(),
        endTime: form.value.endTime!.toISOString(),
        notes: form.value.notes.trim() || undefined,
      },
    });
    toast.add({ severity: 'success', summary: 'Created', detail: 'Booking created successfully', life: 3000 });
    emit('saved');
  } catch (err: any) {
    toast.add({ severity: 'error', summary: 'Error', detail: err.data?.error?.message || 'Failed to create booking', life: 4000 });
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
    header="New Booking"
    :modal="true"
    :closable="true"
    :style="{ width: '500px', maxWidth: '92vw' }"
    @update:visible="close"
  >
    <div class="dialog-form">
      <FormField label="Title" required>
        <template #default="{ id }">
          <InputText
            :id="id"
            v-model="form.title"
            class="w-full"
            placeholder="Booking title"
          />
        </template>
      </FormField>

      <FormField label="Resource" required>
        <template #default="{ id }">
          <Dropdown
            :input-id="id"
            v-model="form.resource"
            :options="resourceOptions"
            option-label="label"
            option-value="value"
            placeholder="Select a resource"
            class="w-full"
          />
        </template>
      </FormField>

      <FormField label="Start Time" required>
        <template #default="{ id }">
          <Calendar
            :input-id="id"
            v-model="form.startTime"
            class="w-full"
            date-format="mm/dd/yy"
            :show-time="true"
            :show-icon="true"
            placeholder="Select start date/time"
            hour-format="12"
          />
        </template>
      </FormField>

      <FormField label="End Time" required>
        <template #default="{ id }">
          <Calendar
            :input-id="id"
            v-model="form.endTime"
            class="w-full"
            date-format="mm/dd/yy"
            :show-time="true"
            :show-icon="true"
            placeholder="Select end date/time"
            hour-format="12"
          />
        </template>
      </FormField>

      <FormField label="Notes">
        <template #default="{ id }">
          <Textarea
            :id="id"
            v-model="form.notes"
            class="w-full"
            rows="3"
            placeholder="Optional notes"
          />
        </template>
      </FormField>
    </div>

    <template #footer>
      <Button label="Cancel" text @click="close" />
      <Button label="Create Booking" icon="pi pi-check" :loading="saving" :disabled="!isValid" @click="save" />
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
