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
    :style="{ width: '500px' }"
    @update:visible="close"
  >
    <div class="dialog-form">
      <div class="field">
        <label for="booking-title">Title *</label>
        <InputText
          id="booking-title"
          v-model="form.title"
          class="w-full"
          placeholder="Booking title"
        />
      </div>

      <div class="field">
        <label for="booking-resource">Resource *</label>
        <Dropdown
          id="booking-resource"
          v-model="form.resource"
          :options="resourceOptions"
          option-label="label"
          option-value="value"
          placeholder="Select a resource"
          class="w-full"
        />
      </div>

      <div class="field">
        <label for="booking-start">Start Time *</label>
        <Calendar
          id="booking-start"
          v-model="form.startTime"
          class="w-full"
          date-format="mm/dd/yy"
          :show-time="true"
          :show-icon="true"
          placeholder="Select start date/time"
          hour-format="12"
        />
      </div>

      <div class="field">
        <label for="booking-end">End Time *</label>
        <Calendar
          id="booking-end"
          v-model="form.endTime"
          class="w-full"
          date-format="mm/dd/yy"
          :show-time="true"
          :show-icon="true"
          placeholder="Select end date/time"
          hour-format="12"
        />
      </div>

      <div class="field">
        <label for="booking-notes">Notes</label>
        <Textarea
          id="booking-notes"
          v-model="form.notes"
          class="w-full"
          rows="3"
          placeholder="Optional notes"
        />
      </div>
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
.field {
  display: flex;
  flex-direction: column;
  gap: 0.25rem;
}
.field label {
  font-weight: 600;
  font-size: 0.875rem;
}
.w-full {
  width: 100%;
}
</style>
