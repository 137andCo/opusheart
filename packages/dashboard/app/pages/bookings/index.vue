<script setup lang="ts">
definePageMeta({ layout: 'default' });

const api = useApi();
const confirm = useConfirm();
const toast = useToast();

const activeTab = ref(0);

// --- Bookings tab (paginated via useCrudApi) ---
const { items: bookings, totalRecords, loading, filters, fetchAll: fetchBookings, onPage } = useCrudApi<any>('/api/bookings', 'bookings');

// --- Resources (non-paginated, loaded directly) ---
const resources = ref<any[]>([]);
const resourcesLoading = ref(false);

async function fetchResources() {
  resourcesLoading.value = true;
  try {
    const data = await api<any>('/api/bookings/resources', { query: { active: undefined } });
    resources.value = data.resources || [];
  } catch (err: any) {
    toast.add({ severity: 'error', summary: 'Error', detail: err.data?.error?.message || 'Failed to load resources', life: 4000 });
  } finally {
    resourcesLoading.value = false;
  }
}

// --- Booking filters ---
const resourceFilter = ref('');
const statusFilter = ref('');
const fromDate = ref<Date | null>(null);
const toDate = ref<Date | null>(null);

const statusOptions = [
  { label: 'All Statuses', value: '' },
  { label: 'Confirmed', value: 'confirmed' },
  { label: 'Cancelled', value: 'cancelled' },
];

const resourceDropdownOptions = computed(() => [
  { label: 'All Resources', value: '' },
  ...resources.value.map((r: any) => ({ label: r.name, value: r._id || r.id })),
]);

function onResourceFilterChange() {
  filters.value.resource = resourceFilter.value || undefined;
  fetchBookings();
}

function onStatusFilterChange() {
  filters.value.status = statusFilter.value || undefined;
  fetchBookings();
}

function onDateFilterChange() {
  filters.value.from = fromDate.value ? fromDate.value.toISOString() : undefined;
  filters.value.to = toDate.value ? toDate.value.toISOString() : undefined;
  fetchBookings();
}

// --- Booking dialog ---
const bookingDialogVisible = ref(false);

function openCreateBooking() {
  bookingDialogVisible.value = true;
}

function onBookingSaved() {
  bookingDialogVisible.value = false;
  fetchBookings();
}

// --- Cancel booking ---
function confirmCancelBooking(booking: any) {
  confirm.require({
    message: `Cancel booking "${booking.title}"? This cannot be undone.`,
    header: 'Confirm Cancellation',
    icon: 'pi pi-exclamation-triangle',
    acceptClass: 'p-button-danger',
    accept: async () => {
      try {
        await api(`/api/bookings/${booking._id || booking.id}/cancel`, { method: 'PATCH' });
        toast.add({ severity: 'success', summary: 'Cancelled', detail: 'Booking cancelled successfully', life: 3000 });
        fetchBookings();
      } catch (err: any) {
        toast.add({ severity: 'error', summary: 'Error', detail: err.data?.error?.message || 'Failed to cancel booking', life: 4000 });
      }
    },
  });
}

// --- Resource dialog ---
const resourceDialogVisible = ref(false);

function openCreateResource() {
  resourceDialogVisible.value = true;
}

function onResourceSaved() {
  resourceDialogVisible.value = false;
  fetchResources();
}

// --- Helpers ---
function formatDateTime(dateStr: string): string {
  if (!dateStr) return '';
  return new Date(dateStr).toLocaleString('en-US', {
    month: 'short', day: 'numeric', year: 'numeric',
    hour: 'numeric', minute: '2-digit',
  });
}

function resourceName(booking: any): string {
  if (!booking.resource) return '';
  if (typeof booking.resource === 'object') return booking.resource.name || '';
  const found = resources.value.find((r: any) => (r._id || r.id) === booking.resource);
  return found ? found.name : '';
}

function truncate(text: string, len: number): string {
  if (!text) return '';
  return text.length > len ? text.slice(0, len) + '...' : text;
}

function typeSeverity(type: string): string {
  switch (type) {
    case 'room': return 'info';
    case 'vehicle': return 'warn';
    case 'equipment': return 'secondary';
    case 'other': return 'contrast';
    default: return 'secondary';
  }
}

onMounted(() => {
  fetchResources();
  fetchBookings();
});
</script>

<template>
  <div>
    <ConfirmDialog />
    <Toast />

    <div class="page-header">
      <h1>Bookings</h1>
      <Button v-if="activeTab === 0" label="New Booking" icon="pi pi-plus" @click="openCreateBooking" />
      <Button v-else label="New Resource" icon="pi pi-plus" @click="openCreateResource" />
    </div>

    <TabView v-model:activeIndex="activeTab">
      <TabPanel header="Bookings" value="bookings">
        <div class="tab-toolbar">
          <div class="page-filters">
            <Dropdown
              v-model="resourceFilter"
              :options="resourceDropdownOptions"
              option-label="label"
              option-value="value"
              placeholder="Resource"
              class="filter-dropdown"
              @change="onResourceFilterChange"
            />
            <Dropdown
              v-model="statusFilter"
              :options="statusOptions"
              option-label="label"
              option-value="value"
              placeholder="Status"
              class="filter-dropdown"
              @change="onStatusFilterChange"
            />
            <Calendar
              v-model="fromDate"
              class="filter-date"
              date-format="mm/dd/yy"
              placeholder="From date"
              :show-icon="true"
              @date-select="onDateFilterChange"
            />
            <Calendar
              v-model="toDate"
              class="filter-date"
              date-format="mm/dd/yy"
              placeholder="To date"
              :show-icon="true"
              @date-select="onDateFilterChange"
            />
          </div>
        </div>

        <DataTable
          :value="bookings"
          :loading="loading"
          :total-records="totalRecords"
          :rows="20"
          data-key="_id"
          lazy
          paginator
          scrollable
          striped-rows
          :rows-per-page-options="[10, 20, 50]"
          @page="onPage"
        >
          <template #empty>
            <div class="empty-state" role="status">No bookings found.</div>
          </template>

          <Column field="title" header="Title" />
          <Column header="Resource">
            <template #body="{ data }">
              {{ resourceName(data) }}
            </template>
          </Column>
          <Column header="Start Time">
            <template #body="{ data }">
              {{ formatDateTime(data.startTime) }}
            </template>
          </Column>
          <Column header="End Time">
            <template #body="{ data }">
              {{ formatDateTime(data.endTime) }}
            </template>
          </Column>
          <Column header="Status">
            <template #body="{ data }">
              <Tag
                :value="data.status || 'confirmed'"
                :severity="data.status === 'cancelled' ? 'danger' : 'success'"
              />
            </template>
          </Column>
          <Column header="Actions" style="width: 6rem">
            <template #body="{ data }">
              <div class="action-buttons">
                <Button
                  v-if="data.status !== 'cancelled'"
                  icon="pi pi-times"
                  text
                  rounded
                  severity="danger"
                  aria-label="Cancel booking"
                  v-tooltip.top="'Cancel'"
                  @click="confirmCancelBooking(data)"
                />
              </div>
            </template>
          </Column>
        </DataTable>
      </TabPanel>

      <TabPanel header="Resources" value="resources">
        <DataTable
          :value="resources"
          :loading="resourcesLoading"
          data-key="_id"
          scrollable
          striped-rows
        >
          <template #empty>
            <div class="empty-state" role="status">No resources found.</div>
          </template>

          <Column field="name" header="Name" />
          <Column header="Type">
            <template #body="{ data }">
              <Tag :value="data.type" :severity="typeSeverity(data.type)" />
            </template>
          </Column>
          <Column header="Description">
            <template #body="{ data }">
              {{ truncate(data.description, 60) }}
            </template>
          </Column>
          <Column header="Capacity">
            <template #body="{ data }">
              {{ data.capacity || '-' }}
            </template>
          </Column>
          <Column header="Active">
            <template #body="{ data }">
              <Tag
                :value="data.active !== false ? 'Active' : 'Inactive'"
                :severity="data.active !== false ? 'success' : 'secondary'"
              />
            </template>
          </Column>
        </DataTable>
      </TabPanel>
    </TabView>

    <BookingsBookingDialog
      v-model:visible="bookingDialogVisible"
      :resources-list="resources"
      @saved="onBookingSaved"
    />

    <BookingsBookableResourceDialog
      v-model:visible="resourceDialogVisible"
      @saved="onResourceSaved"
    />
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
.tab-toolbar {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  margin-bottom: 1rem;
}
.page-filters {
  display: flex;
  gap: 0.75rem;
  flex-wrap: wrap;
}
.filter-dropdown {
  min-width: 160px;
}
.filter-date {
  min-width: 140px;
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
