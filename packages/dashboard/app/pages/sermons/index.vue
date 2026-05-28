<script setup lang="ts">
definePageMeta({ layout: 'default' });

const api = useApi();
const confirm = useConfirm();
const toast = useToast();

// --- Sermons tab ---
const { items: sermons, totalRecords, loading, filters, fetchAll, remove, onPage } = useCrudApi<any>('/api/sermons', 'sermons');

const searchText = ref('');
const seriesFilter = ref('');
let searchTimer: ReturnType<typeof setTimeout> | null = null;

function onSearchInput() {
  if (searchTimer) clearTimeout(searchTimer);
  searchTimer = setTimeout(() => {
    filters.value.search = searchText.value;
    fetchAll();
  }, 300);
}

function onSeriesFilterChange() {
  filters.value.series = seriesFilter.value || undefined;
  fetchAll();
}

// --- Series tab ---
const seriesList = ref<any[]>([]);
const seriesLoading = ref(false);

async function fetchSeries() {
  seriesLoading.value = true;
  try {
    const data = await api<any>('/api/sermons/series');
    seriesList.value = data.series || [];
  } catch (err: any) {
    toast.add({ severity: 'error', summary: 'Error', detail: err.data?.error?.message || 'Failed to load series', life: 4000 });
  } finally {
    seriesLoading.value = false;
  }
}

// --- Series dropdown options for filter + sermon dialog ---
const seriesDropdownOptions = computed(() =>
  seriesList.value.map((s: any) => ({ label: s.title, value: s._id || s.id })),
);

// --- Sermon dialog ---
const sermonDialogVisible = ref(false);
const selectedSermon = ref<any>(null);

function openCreateSermon() {
  selectedSermon.value = null;
  sermonDialogVisible.value = true;
}

function openEditSermon(sermon: any) {
  selectedSermon.value = sermon;
  sermonDialogVisible.value = true;
}

function confirmDeleteSermon(sermon: any) {
  confirm.require({
    message: `Delete "${sermon.title}"? This cannot be undone.`,
    header: 'Confirm Delete',
    icon: 'pi pi-exclamation-triangle',
    acceptClass: 'p-button-danger',
    accept: async () => {
      try {
        await remove(sermon._id || sermon.id);
        fetchAll();
      } catch {
        toast.add({ severity: 'error', summary: 'Error', detail: 'Failed to delete sermon', life: 4000 });
      }
    },
  });
}

function onSermonSaved() {
  sermonDialogVisible.value = false;
  fetchAll();
}

// --- Series dialog ---
const seriesDialogVisible = ref(false);
const selectedSeries = ref<any>(null);

function openCreateSeries() {
  selectedSeries.value = null;
  seriesDialogVisible.value = true;
}

function openEditSeries(series: any) {
  selectedSeries.value = series;
  seriesDialogVisible.value = true;
}

function confirmDeleteSeries(series: any) {
  confirm.require({
    message: `Delete series "${series.title}"? This cannot be undone.`,
    header: 'Confirm Delete',
    icon: 'pi pi-exclamation-triangle',
    acceptClass: 'p-button-danger',
    accept: async () => {
      try {
        await api(`/api/sermons/series/${series._id || series.id}`, { method: 'DELETE' });
        toast.add({ severity: 'success', summary: 'Deleted', detail: 'Series deleted', life: 3000 });
        fetchSeries();
      } catch {
        toast.add({ severity: 'error', summary: 'Error', detail: 'Failed to delete series', life: 4000 });
      }
    },
  });
}

function onSeriesSaved() {
  seriesDialogVisible.value = false;
  fetchSeries();
}

// --- Helpers ---
function formatDate(dateStr: string): string {
  if (!dateStr) return '';
  return new Date(dateStr).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

function seriesName(sermon: any): string {
  if (!sermon.series) return '';
  if (typeof sermon.series === 'object') return sermon.series.title || '';
  const found = seriesList.value.find((s: any) => (s._id || s.id) === sermon.series);
  return found ? found.title : '';
}

function truncate(text: string, len: number): string {
  if (!text) return '';
  return text.length > len ? text.slice(0, len) + '...' : text;
}

onMounted(() => {
  fetchAll();
  fetchSeries();
});
</script>

<template>
  <div>
    <ConfirmDialog />
    <Toast />

    <h1 class="page-title">Sermons</h1>

    <TabView>
      <TabPanel header="Sermons" value="sermons">
        <div class="tab-toolbar">
          <div class="page-filters">
            <InputText
              v-model="searchText"
              class="filter-search"
              placeholder="Search sermons..."
              @input="onSearchInput"
            />
            <Dropdown
              v-model="seriesFilter"
              :options="[{ label: 'All Series', value: '' }, ...seriesDropdownOptions]"
              option-label="label"
              option-value="value"
              placeholder="Series"
              class="filter-dropdown"
              @change="onSeriesFilterChange"
            />
          </div>
          <Button label="New Sermon" icon="pi pi-plus" @click="openCreateSermon" />
        </div>

        <DataTable
          :value="sermons"
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
            <div class="empty-state">No sermons found.</div>
          </template>

          <Column field="title" header="Title" />
          <Column field="speaker" header="Speaker" />
          <Column header="Date">
            <template #body="{ data }">
              {{ formatDate(data.date) }}
            </template>
          </Column>
          <Column header="Series">
            <template #body="{ data }">
              {{ seriesName(data) }}
            </template>
          </Column>
          <Column header="Status">
            <template #body="{ data }">
              <Tag
                :value="data.published ? 'Published' : 'Draft'"
                :severity="data.published ? 'success' : 'warn'"
              />
            </template>
          </Column>
          <Column header="Actions" style="width: 8rem">
            <template #body="{ data }">
              <div class="action-buttons">
                <Button icon="pi pi-pencil" text rounded severity="info" @click="openEditSermon(data)" />
                <Button icon="pi pi-trash" text rounded severity="danger" @click="confirmDeleteSermon(data)" />
              </div>
            </template>
          </Column>
        </DataTable>
      </TabPanel>

      <TabPanel header="Series" value="series">
        <div class="tab-toolbar">
          <div class="page-filters" />
          <Button label="New Series" icon="pi pi-plus" @click="openCreateSeries" />
        </div>

        <DataTable
          :value="seriesList"
          :loading="seriesLoading"
          data-key="_id"
          striped-rows
        >
          <template #empty>
            <div class="empty-state">No series found.</div>
          </template>

          <Column field="title" header="Title" />
          <Column header="Description">
            <template #body="{ data }">
              {{ truncate(data.description, 80) }}
            </template>
          </Column>
          <Column header="Start Date">
            <template #body="{ data }">
              {{ formatDate(data.startDate) }}
            </template>
          </Column>
          <Column header="Sermons" field="sermonCount" />
          <Column header="Actions" style="width: 8rem">
            <template #body="{ data }">
              <div class="action-buttons">
                <Button icon="pi pi-pencil" text rounded severity="info" @click="openEditSeries(data)" />
                <Button icon="pi pi-trash" text rounded severity="danger" @click="confirmDeleteSeries(data)" />
              </div>
            </template>
          </Column>
        </DataTable>
      </TabPanel>
    </TabView>

    <SermonDialog
      v-model:visible="sermonDialogVisible"
      :sermon="selectedSermon"
      :series-list="seriesList"
      @saved="onSermonSaved"
    />

    <SeriesDialog
      v-model:visible="seriesDialogVisible"
      :series="selectedSeries"
      @saved="onSeriesSaved"
    />
  </div>
</template>

<style scoped>
.page-title {
  font-size: 1.5rem;
  font-weight: 600;
  margin-bottom: 1.5rem;
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
.filter-search {
  min-width: 250px;
}
.filter-dropdown {
  min-width: 160px;
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
