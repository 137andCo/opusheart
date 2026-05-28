<script setup lang="ts">
definePageMeta({ layout: 'default' });

const confirm = useConfirm();
const toast = useToast();

interface EventItem {
  _id: string;
  id: string;
  title: string;
  description: string;
  startDate: string;
  endDate: string;
  allDay: boolean;
  location: string;
  visibility: 'public' | 'members' | 'leaders';
  rsvps: { status: string }[];
  maxAttendees?: number;
  volunteerSlots: { role: string; needed: number; filled: string[] }[];
  registrationRequired: boolean;
}

const { items: events, totalRecords, loading, filters, fetchAll, remove, onPage } = useCrudApi<EventItem>('/api/events', 'events');

const visibilityOptions = [
  { label: 'All', value: '' },
  { label: 'Public', value: 'public' },
  { label: 'Members Only', value: 'members' },
  { label: 'Leaders Only', value: 'leaders' },
];

const dialogVisible = ref(false);
const selectedEvent = ref<EventItem | null>(null);

function openCreate() {
  selectedEvent.value = null;
  dialogVisible.value = true;
}

function openEdit(event: EventItem) {
  selectedEvent.value = event;
  dialogVisible.value = true;
}

function confirmDelete(event: EventItem) {
  confirm.require({
    message: `Delete "${event.title}"? This cannot be undone.`,
    header: 'Confirm Delete',
    icon: 'pi pi-exclamation-triangle',
    acceptClass: 'p-button-danger',
    accept: async () => {
      try {
        await remove(event._id || event.id);
        fetchAll();
      } catch {
        toast.add({ severity: 'error', summary: 'Error', detail: 'Failed to delete event', life: 4000 });
      }
    },
  });
}

function onFilterChange() {
  fetchAll();
}

function onSaved() {
  dialogVisible.value = false;
  fetchAll();
}

function formatDate(row: EventItem): string {
  const start = new Date(row.startDate);
  const dateStr = start.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });

  if (row.allDay) {
    return `${dateStr} - All Day`;
  }

  const startTime = start.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' });
  const endTime = new Date(row.endDate).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' });
  return `${dateStr}, ${startTime} - ${endTime}`;
}

function visibilitySeverity(visibility: string): string {
  switch (visibility) {
    case 'public': return 'success';
    case 'members': return 'info';
    case 'leaders': return 'warn';
    default: return 'info';
  }
}

function visibilityLabel(visibility: string): string {
  switch (visibility) {
    case 'public': return 'Public';
    case 'members': return 'Members Only';
    case 'leaders': return 'Leaders Only';
    default: return visibility;
  }
}

function rsvpCount(event: EventItem): string {
  const yesCount = (event.rsvps || []).filter((r) => r.status === 'yes').length;
  if (event.maxAttendees) {
    return `${yesCount} / ${event.maxAttendees}`;
  }
  return String(yesCount);
}

onMounted(() => {
  fetchAll();
});
</script>

<template>
  <div>
    <ConfirmDialog />
    <Toast />

    <div class="page-header">
      <h1>Events</h1>
      <Button label="New Event" icon="pi pi-plus" @click="openCreate" />
    </div>

    <div class="page-filters">
      <Dropdown
        v-model="filters.visibility"
        :options="visibilityOptions"
        option-label="label"
        option-value="value"
        placeholder="Visibility"
        class="w-filter"
        @change="onFilterChange"
      />
    </div>

    <DataTable
      :value="events"
      :loading="loading"
      :total-records="totalRecords"
      :rows="20"
      data-key="_id"
      lazy
      paginator
      striped-rows
      :rows-per-page-options="[10, 20, 50]"
      @page="onPage"
    >
      <template #empty>
        <div class="empty-state">No events found.</div>
      </template>

      <Column field="title" header="Title" />
      <Column header="Date">
        <template #body="{ data }">
          {{ formatDate(data) }}
        </template>
      </Column>
      <Column field="location" header="Location" />
      <Column header="Visibility">
        <template #body="{ data }">
          <Tag :value="visibilityLabel(data.visibility)" :severity="visibilitySeverity(data.visibility)" />
        </template>
      </Column>
      <Column header="RSVPs">
        <template #body="{ data }">
          {{ rsvpCount(data) }}
        </template>
      </Column>
      <Column header="Actions" style="width: 8rem">
        <template #body="{ data }">
          <div class="action-buttons">
            <Button icon="pi pi-pencil" text rounded severity="info" @click="openEdit(data)" />
            <Button icon="pi pi-trash" text rounded severity="danger" @click="confirmDelete(data)" />
          </div>
        </template>
      </Column>
    </DataTable>

    <EventDialog v-model:visible="dialogVisible" :event="selectedEvent" @saved="onSaved" />
  </div>
</template>

<style scoped>
.page-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 1.5rem;
}
.page-header h1 {
  font-size: 1.5rem;
  font-weight: 600;
}
.page-filters {
  display: flex;
  gap: 0.75rem;
  margin-bottom: 1rem;
  flex-wrap: wrap;
}
.w-filter {
  min-width: 12rem;
}
.action-buttons {
  display: flex;
  gap: 0.25rem;
}
.empty-state {
  text-align: center;
  padding: 2rem;
  color: var(--p-text-muted-color);
}
</style>
