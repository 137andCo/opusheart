<script setup lang="ts">
definePageMeta({ layout: 'default' });

const confirm = useConfirm();
const toast = useToast();
const api = useApi();

interface PageItem {
  _id: string;
  id: string;
  title: string;
  slug: string;
  status: 'draft' | 'published' | 'archived';
  locale: string;
  content: any[];
  template?: string;
  seo?: { title?: string; description?: string; ogImage?: string; noIndex?: boolean };
  updatedAt: string;
}

const { items: pages, totalRecords, loading, filters, fetchAll, remove, onPage } = useCrudApi<PageItem>('/api/pages', 'data');

const statusOptions = [
  { label: 'All', value: '' },
  { label: 'Draft', value: 'draft' },
  { label: 'Published', value: 'published' },
  { label: 'Archived', value: 'archived' },
];

const dialogVisible = ref(false);
const selectedPage = ref<PageItem | null>(null);
const searchQuery = ref('');
let searchTimeout: ReturnType<typeof setTimeout> | null = null;

watch(searchQuery, (val) => {
  if (searchTimeout) clearTimeout(searchTimeout);
  searchTimeout = setTimeout(() => {
    filters.value.search = val;
    fetchAll();
  }, 400);
});

function openCreate() {
  selectedPage.value = null;
  dialogVisible.value = true;
}

function openEdit(page: PageItem) {
  selectedPage.value = page;
  dialogVisible.value = true;
}

function onFilterChange() {
  fetchAll();
}

function onSaved() {
  dialogVisible.value = false;
  fetchAll();
}

async function publishPage(page: PageItem) {
  const id = page._id || page.id;
  try {
    await api(`/api/pages/${id}/publish`, { method: 'POST' });
    toast.add({ severity: 'success', summary: 'Published', detail: `"${page.title}" is now live`, life: 3000 });
    fetchAll();
  } catch (err: any) {
    toast.add({ severity: 'error', summary: 'Error', detail: err.data?.error?.message || 'Failed to publish page', life: 4000 });
  }
}

async function duplicatePage(page: PageItem) {
  const id = page._id || page.id;
  try {
    await api(`/api/pages/${id}/duplicate`, { method: 'POST' });
    toast.add({ severity: 'success', summary: 'Duplicated', detail: `Copy of "${page.title}" created`, life: 3000 });
    fetchAll();
  } catch (err: any) {
    toast.add({ severity: 'error', summary: 'Error', detail: err.data?.error?.message || 'Failed to duplicate page', life: 4000 });
  }
}

function confirmDelete(page: PageItem) {
  confirm.require({
    message: `Delete "${page.title}"? This cannot be undone.`,
    header: 'Confirm Delete',
    icon: 'pi pi-exclamation-triangle',
    acceptClass: 'p-button-danger',
    accept: async () => {
      try {
        await remove(page._id || page.id);
        fetchAll();
      } catch {
        toast.add({ severity: 'error', summary: 'Error', detail: 'Failed to delete page', life: 4000 });
      }
    },
  });
}

function statusSeverity(status: string): string {
  switch (status) {
    case 'draft': return 'warn';
    case 'published': return 'success';
    case 'archived': return 'secondary';
    default: return 'info';
  }
}

function formatDate(dateStr: string): string {
  return new Date(dateStr).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
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
      <h1>Pages</h1>
      <Button label="New Page" icon="pi pi-plus" @click="openCreate" />
    </div>

    <div class="page-filters">
      <InputText
        v-model="searchQuery"
        placeholder="Search pages..."
        class="w-filter"
      />
      <Dropdown
        v-model="filters.status"
        :options="statusOptions"
        option-label="label"
        option-value="value"
        placeholder="Status"
        class="w-filter"
        @change="onFilterChange"
      />
    </div>

    <DataTable
      :value="pages"
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
        <div class="empty-state" role="status">No pages found.</div>
      </template>

      <Column field="title" header="Title" />
      <Column field="slug" header="Slug">
        <template #body="{ data }">
          <code class="slug-cell">/{{ data.slug }}</code>
        </template>
      </Column>
      <Column header="Status">
        <template #body="{ data }">
          <Tag :value="data.status" :severity="statusSeverity(data.status)" />
        </template>
      </Column>
      <Column field="locale" header="Locale" style="width: 6rem" />
      <Column header="Updated">
        <template #body="{ data }">
          {{ formatDate(data.updatedAt) }}
        </template>
      </Column>
      <Column header="Actions" style="width: 12rem">
        <template #body="{ data }">
          <div class="action-buttons">
            <Button icon="pi pi-pencil" text rounded severity="info" aria-label="Edit page" @click="openEdit(data)" />
            <Button
              v-if="data.status === 'draft'"
              icon="pi pi-check-circle"
              text
              rounded
              severity="success"
              aria-label="Publish page"
              v-tooltip.top="'Publish'"
              @click="publishPage(data)"
            />
            <Button icon="pi pi-copy" text rounded severity="secondary" aria-label="Duplicate page" v-tooltip.top="'Duplicate'" @click="duplicatePage(data)" />
            <Button icon="pi pi-trash" text rounded severity="danger" aria-label="Delete page" @click="confirmDelete(data)" />
          </div>
        </template>
      </Column>
    </DataTable>

    <PageDialog v-model:visible="dialogVisible" :page="selectedPage" @saved="onSaved" />
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
.slug-cell {
  font-size: 0.85rem;
  color: var(--p-text-muted-color);
  background: var(--p-surface-100);
  padding: 0.15rem 0.4rem;
  border-radius: 4px;
}
.empty-state {
  text-align: center;
  padding: 2rem;
  color: var(--p-text-muted-color);
}
</style>
