<script setup lang="ts">
const props = defineProps<{
  visible: boolean;
  event: any | null;
}>();

const emit = defineEmits<{
  (e: 'update:visible', value: boolean): void;
  (e: 'saved'): void;
}>();

const api = useApi();
const toast = useToast();
const saving = ref(false);

const defaultForm = () => ({
  title: '',
  description: '',
  startDate: new Date(),
  endDate: new Date(Date.now() + 3600000),
  allDay: false,
  location: '',
  visibility: 'public',
  maxAttendees: null as number | null,
  registrationRequired: false,
  volunteerSlots: [] as { role: string; needed: number }[],
});

const form = ref(defaultForm());
const errors = reactive<Record<string, string>>({ title: '' });

const visibilityOptions = [
  { label: 'Public', value: 'public' },
  { label: 'Members Only', value: 'members' },
  { label: 'Leaders Only', value: 'leaders' },
];

const isEdit = computed(() => !!props.event);
const dialogTitle = computed(() => (isEdit.value ? 'Edit Event' : 'New Event'));

watch(
  () => props.visible,
  (val) => {
    if (!val) return;
    errors.title = '';
    if (props.event) {
      form.value = {
        title: props.event.title || '',
        description: props.event.description || '',
        startDate: new Date(props.event.startDate),
        endDate: new Date(props.event.endDate),
        allDay: props.event.allDay || false,
        location: props.event.location || '',
        visibility: props.event.visibility || 'public',
        maxAttendees: props.event.maxAttendees ?? null,
        registrationRequired: props.event.registrationRequired || false,
        volunteerSlots: (props.event.volunteerSlots || []).map((s: any) => ({
          role: s.role,
          needed: s.needed,
        })),
      };
    } else {
      form.value = defaultForm();
    }
  },
);

function addSlot() {
  form.value.volunteerSlots.push({ role: '', needed: 1 });
}

function removeSlot(index: number) {
  form.value.volunteerSlots.splice(index, 1);
}

function closeDialog() {
  emit('update:visible', false);
}

async function save() {
  errors.title = '';
  if (!form.value.title.trim()) {
    errors.title = 'Title is required.';
    return;
  }

  saving.value = true;
  try {
    const slots = form.value.volunteerSlots.filter((s) => s.role.trim());

    const body: Record<string, any> = {
      title: form.value.title.trim(),
      description: form.value.description.trim(),
      startDate: form.value.startDate.toISOString(),
      endDate: form.value.endDate.toISOString(),
      allDay: form.value.allDay,
      location: form.value.location.trim(),
      visibility: form.value.visibility,
      registrationRequired: form.value.registrationRequired,
      volunteerSlots: slots.map((s) => ({ role: s.role.trim(), needed: s.needed })),
    };

    if (form.value.maxAttendees && form.value.maxAttendees > 0) {
      body.maxAttendees = form.value.maxAttendees;
    }

    const id = props.event?._id || props.event?.id;
    if (isEdit.value && id) {
      await api(`/api/events/${id}`, { method: 'PUT', body });
      toast.add({ severity: 'success', summary: 'Updated', detail: 'Event updated successfully', life: 3000 });
    } else {
      await api('/api/events', { method: 'POST', body });
      toast.add({ severity: 'success', summary: 'Created', detail: 'Event created successfully', life: 3000 });
    }

    emit('saved');
  } catch (err: any) {
    toast.add({
      severity: 'error',
      summary: 'Error',
      detail: err.data?.error?.message || 'Failed to save event',
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
    :style="{ width: '650px', maxWidth: '92vw' }"
    @update:visible="closeDialog"
  >
    <div class="dialog-form">
      <FormField label="Title" required :error="errors.title">
        <template #default="{ id, describedby, invalid }">
          <InputText :id="id" v-model="form.title" class="w-full" :aria-describedby="describedby" :invalid="invalid" placeholder="Event title" />
        </template>
      </FormField>

      <FormField label="Description">
        <template #default="{ id }">
          <Textarea :id="id" v-model="form.description" class="w-full" :rows="3" placeholder="Event description" />
        </template>
      </FormField>

      <div class="field-checkbox">
        <InputSwitch input-id="event-all-day" v-model="form.allDay" />
        <label for="event-all-day">All Day</label>
      </div>

      <div class="field-row">
        <FormField label="Start Date">
          <template #default="{ id }">
            <Calendar
              :input-id="id"
              v-model="form.startDate"
              class="w-full"
              :show-time="!form.allDay"
              date-format="mm/dd/yy"
              placeholder="Start date"
            />
          </template>
        </FormField>
        <FormField label="End Date">
          <template #default="{ id }">
            <Calendar
              :input-id="id"
              v-model="form.endDate"
              class="w-full"
              :show-time="!form.allDay"
              date-format="mm/dd/yy"
              placeholder="End date"
            />
          </template>
        </FormField>
      </div>

      <FormField label="Location">
        <template #default="{ id }">
          <InputText :id="id" v-model="form.location" class="w-full" placeholder="Event location" />
        </template>
      </FormField>

      <div class="field-row">
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
        <FormField label="Max Attendees">
          <template #default="{ id }">
            <InputNumber :input-id="id" v-model="form.maxAttendees" class="w-full" :min="1" placeholder="Unlimited" />
          </template>
        </FormField>
      </div>

      <div class="field-checkbox">
        <InputSwitch input-id="event-registration" v-model="form.registrationRequired" />
        <label for="event-registration">Registration Required</label>
      </div>

      <div>
        <div class="section-header">
          <span class="section-title">Volunteer Slots</span>
          <Button label="Add Slot" icon="pi pi-plus" text size="small" @click="addSlot" />
        </div>
        <div v-for="(slot, idx) in form.volunteerSlots" :key="idx" class="volunteer-row">
          <InputText v-model="slot.role" placeholder="Role name" style="flex: 1" :aria-label="`Volunteer role ${idx + 1}`" />
          <InputNumber v-model="slot.needed" :min="1" placeholder="Needed" style="width: 6rem" :aria-label="`Number needed for volunteer role ${idx + 1}`" />
          <Button icon="pi pi-times" text rounded severity="danger" size="small" :aria-label="`Remove volunteer slot ${idx + 1}`" @click="removeSlot(idx)" />
        </div>
        <div v-if="form.volunteerSlots.length === 0" class="empty-slots">
          No volunteer slots added.
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
.section-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
}
.section-title {
  font-weight: 600;
  font-size: 0.875rem;
}
.volunteer-row {
  display: flex;
  gap: 0.5rem;
  align-items: center;
  margin-top: 0.5rem;
}
.empty-slots {
  text-align: center;
  padding: 0.75rem;
  color: var(--p-text-muted-color);
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
