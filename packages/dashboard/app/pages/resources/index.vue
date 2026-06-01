<script setup lang="ts">
definePageMeta({ layout: 'default' });

const api = useApi();
const confirm = useConfirm();
const toast = useToast();

const activeTab = ref(0);

// --- Category helpers ---
const categoryOptions = [
  { label: 'All Categories', value: '' },
  { label: 'Food', value: 'food' },
  { label: 'Housing', value: 'housing' },
  { label: 'Utilities', value: 'utilities' },
  { label: 'Medical', value: 'medical' },
  { label: 'Mental Health', value: 'mental_health' },
  { label: 'Employment', value: 'employment' },
  { label: 'Education', value: 'education' },
  { label: 'Legal', value: 'legal' },
  { label: 'Transportation', value: 'transportation' },
  { label: 'Clothing', value: 'clothing' },
  { label: 'Financial', value: 'financial' },
  { label: 'Childcare', value: 'childcare' },
  { label: 'Senior Services', value: 'senior_services' },
  { label: 'Disability', value: 'disability' },
  { label: 'Substance Abuse', value: 'substance_abuse' },
  { label: 'Domestic Violence', value: 'domestic_violence' },
  { label: 'Veterans', value: 'veterans' },
  { label: 'Other', value: 'other' },
];

function categoryLabel(value: string): string {
  if (!value) return '';
  return value
    .split('_')
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(' ');
}

// --- Resources tab ---
const { items: resources, totalRecords, loading, filters, fetchAll, remove, onPage } = useCrudApi<any>('/api/resources', 'data');

const searchText = ref('');
const categoryFilter = ref('');
let searchTimer: ReturnType<typeof setTimeout> | null = null;

function onSearchInput() {
  if (searchTimer) clearTimeout(searchTimer);
  searchTimer = setTimeout(() => {
    filters.value.search = searchText.value;
    fetchAll();
  }, 300);
}

function onCategoryFilterChange() {
  filters.value.category = categoryFilter.value || undefined;
  fetchAll();
}

// --- Resource dialog ---
const resourceDialogVisible = ref(false);
const selectedResource = ref<any>(null);

function openCreateResource() {
  selectedResource.value = null;
  resourceDialogVisible.value = true;
}

function openEditResource(resource: any) {
  selectedResource.value = resource;
  resourceDialogVisible.value = true;
}

function onResourceSaved() {
  resourceDialogVisible.value = false;
  fetchAll();
}

async function verifyResource(resource: any) {
  const id = resource._id || resource.id;
  try {
    await api(`/api/resources/${id}/verify`, { method: 'PATCH' });
    toast.add({ severity: 'success', summary: 'Verified', detail: 'Resource re-verified', life: 3000 });
    fetchAll();
  } catch (err: any) {
    toast.add({ severity: 'error', summary: 'Error', detail: err.data?.error?.message || 'Failed to verify resource', life: 4000 });
  }
}

function confirmDeleteResource(resource: any) {
  confirm.require({
    message: `Delete "${resource.name}"? This cannot be undone.`,
    header: 'Confirm Delete',
    icon: 'pi pi-exclamation-triangle',
    acceptClass: 'p-button-danger',
    accept: async () => {
      try {
        await remove(resource._id || resource.id);
        fetchAll();
      } catch {
        toast.add({ severity: 'error', summary: 'Error', detail: 'Failed to delete resource', life: 4000 });
      }
    },
  });
}

// --- Submissions tab ---
const { items: submissions, totalRecords: submissionTotal, loading: submissionsLoading, filters: subFilters, fetchAll: fetchSubmissions, onPage: onSubPage } = useCrudApi<any>('/api/submissions', 'data');

const statusFilter = ref('');
const statusFilterOptions = [
  { label: 'All Statuses', value: '' },
  { label: 'Pending', value: 'pending' },
  { label: 'Approved', value: 'approved' },
  { label: 'Rejected', value: 'rejected' },
];

function onStatusFilterChange() {
  subFilters.value.status = statusFilter.value || undefined;
  fetchSubmissions();
}

function statusSeverity(status: string): string {
  switch (status) {
    case 'pending': return 'warn';
    case 'approved': return 'success';
    case 'rejected': return 'danger';
    default: return 'secondary';
  }
}

async function approveSubmission(submission: any) {
  const id = submission._id || submission.id;
  try {
    await api(`/api/submissions/${id}/approve`, { method: 'PATCH' });
    toast.add({ severity: 'success', summary: 'Approved', detail: 'Submission approved', life: 3000 });
    fetchSubmissions();
  } catch (err: any) {
    toast.add({ severity: 'error', summary: 'Error', detail: err.data?.error?.message || 'Failed to approve submission', life: 4000 });
  }
}

// --- Reject dialog ---
const rejectDialogVisible = ref(false);
const rejectingSubmission = ref<any>(null);
const rejectNotes = ref('');
const rejecting = ref(false);

function openRejectDialog(submission: any) {
  rejectingSubmission.value = submission;
  rejectNotes.value = '';
  rejectDialogVisible.value = true;
}

async function confirmReject() {
  if (!rejectingSubmission.value) return;
  const id = rejectingSubmission.value._id || rejectingSubmission.value.id;
  rejecting.value = true;
  try {
    await api(`/api/submissions/${id}/reject`, { method: 'PATCH', body: { notes: rejectNotes.value } });
    toast.add({ severity: 'success', summary: 'Rejected', detail: 'Submission rejected', life: 3000 });
    rejectDialogVisible.value = false;
    fetchSubmissions();
  } catch (err: any) {
    toast.add({ severity: 'error', summary: 'Error', detail: err.data?.error?.message || 'Failed to reject submission', life: 4000 });
  } finally {
    rejecting.value = false;
  }
}

// --- Helpers ---
function formatDate(dateStr: string): string {
  if (!dateStr) return '';
  return new Date(dateStr).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

onMounted(() => {
  fetchAll();
  fetchSubmissions();
});
</script>

<template>
  <div>
    <ConfirmDialog />
    <Toast />

    <div class="page-header">
      <h1>Resources</h1>
      <Button v-if="activeTab === 0" label="New Resource" icon="pi pi-plus" @click="openCreateResource" />
    </div>

    <TabView v-model:activeIndex="activeTab">
      <TabPanel header="Resources" value="resources">
        <div class="tab-toolbar">
          <div class="page-filters">
            <InputText
              v-model="searchText"
              class="filter-search"
              placeholder="Search resources..."
              @input="onSearchInput"
            />
            <Dropdown
              v-model="categoryFilter"
              :options="categoryOptions"
              option-label="label"
              option-value="value"
              placeholder="Category"
              class="filter-dropdown"
              @change="onCategoryFilterChange"
            />
          </div>
        </div>

        <DataTable
          :value="resources"
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
            <div class="empty-state" role="status">No resources found.</div>
          </template>

          <Column field="name" header="Name" />
          <Column field="provider" header="Provider" />
          <Column header="Category">
            <template #body="{ data }">
              <Tag :value="categoryLabel(data.category)" />
            </template>
          </Column>
          <Column header="Featured">
            <template #body="{ data }">
              <Tag
                v-if="data.featured"
                value="Featured"
                severity="success"
              />
              <span v-else class="text-muted">-</span>
            </template>
          </Column>
          <Column header="Last Verified">
            <template #body="{ data }">
              {{ formatDate(data.lastVerified || data.verifiedAt) }}
            </template>
          </Column>
          <Column header="Actions" style="width: 10rem">
            <template #body="{ data }">
              <div class="action-buttons">
                <Button icon="pi pi-pencil" text rounded severity="info" aria-label="Edit resource" @click="openEditResource(data)" />
                <Button icon="pi pi-check-circle" text rounded severity="success" aria-label="Verify resource" @click="verifyResource(data)" />
                <Button icon="pi pi-trash" text rounded severity="danger" aria-label="Delete resource" @click="confirmDeleteResource(data)" />
              </div>
            </template>
          </Column>
        </DataTable>
      </TabPanel>

      <TabPanel header="Submissions" value="submissions">
        <div class="tab-toolbar">
          <div class="page-filters">
            <Dropdown
              v-model="statusFilter"
              :options="statusFilterOptions"
              option-label="label"
              option-value="value"
              placeholder="Status"
              class="filter-dropdown"
              @change="onStatusFilterChange"
            />
          </div>
        </div>

        <DataTable
          :value="submissions"
          :loading="submissionsLoading"
          :total-records="submissionTotal"
          :rows="20"
          data-key="_id"
          lazy
          paginator
          scrollable
          striped-rows
          :rows-per-page-options="[10, 20, 50]"
          @page="onSubPage"
        >
          <template #empty>
            <div class="empty-state" role="status">No submissions found.</div>
          </template>

          <Column field="name" header="Name" />
          <Column header="Submitter Name">
            <template #body="{ data }">
              {{ data.submitterName || data.submitter?.name || '-' }}
            </template>
          </Column>
          <Column header="Submitter Email">
            <template #body="{ data }">
              {{ data.submitterEmail || data.submitter?.email || '-' }}
            </template>
          </Column>
          <Column header="Category">
            <template #body="{ data }">
              <Tag :value="categoryLabel(data.category)" />
            </template>
          </Column>
          <Column header="Status">
            <template #body="{ data }">
              <Tag
                :value="data.status"
                :severity="statusSeverity(data.status)"
              />
            </template>
          </Column>
          <Column header="Submitted">
            <template #body="{ data }">
              {{ formatDate(data.createdAt || data.submittedAt) }}
            </template>
          </Column>
          <Column header="Actions" style="width: 8rem">
            <template #body="{ data }">
              <div v-if="data.status === 'pending'" class="action-buttons">
                <Button icon="pi pi-check" text rounded severity="success" aria-label="Approve submission" @click="approveSubmission(data)" />
                <Button icon="pi pi-times" text rounded severity="danger" aria-label="Reject submission" @click="openRejectDialog(data)" />
              </div>
              <span v-else class="text-muted">-</span>
            </template>
          </Column>
        </DataTable>
      </TabPanel>
    </TabView>

    <ResourcesResourceDialog
      v-model:visible="resourceDialogVisible"
      :resource="selectedResource"
      @saved="onResourceSaved"
    />

    <!-- Reject submission dialog -->
    <Dialog
      v-model:visible="rejectDialogVisible"
      header="Reject Submission"
      modal
      :closable="true"
      :style="{ width: '450px', maxWidth: '92vw' }"
    >
      <div class="dialog-form">
        <div class="field">
          <label for="reject-notes">Rejection Notes</label>
          <Textarea id="reject-notes" v-model="rejectNotes" class="w-full" :rows="4" placeholder="Reason for rejection..." />
        </div>
      </div>
      <template #footer>
        <div class="dialog-actions">
          <Button label="Cancel" severity="secondary" text @click="rejectDialogVisible = false" />
          <Button label="Reject" severity="danger" :loading="rejecting" @click="confirmReject" />
        </div>
      </template>
    </Dialog>
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
.text-muted {
  color: var(--p-text-muted-color);
}
.dialog-form {
  display: flex;
  flex-direction: column;
  gap: 1rem;
}
.dialog-form .field label {
  display: block;
  font-weight: 500;
  margin-bottom: 0.5rem;
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
</style>
