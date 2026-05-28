<script setup lang="ts">
definePageMeta({ layout: 'default' });

const api = useApi();
const toast = useToast();

interface MemberRecord {
  _id: string;
  userId: {
    _id: string;
    firstName: string;
    lastName: string;
  };
}

interface CareNote {
  _id: string;
  memberId: string;
  type: string;
  content: string;
  followUpDate?: string;
  resolved: boolean;
  authorId?: { _id: string; firstName: string; lastName: string };
  createdAt: string;
}

// --- Member search ---
const memberQuery = ref('');
const memberResults = ref<MemberRecord[]>([]);
const memberSearching = ref(false);
const hasSearched = ref(false);
const selectedMember = ref<MemberRecord | null>(null);

async function searchMembers() {
  const q = memberQuery.value.trim();
  if (!q) return;
  memberSearching.value = true;
  hasSearched.value = false;
  try {
    const res = await api<{ data: MemberRecord[] }>('/api/members', {
      params: { search: q, limit: 10 },
    });
    memberResults.value = res.data || [];
  } catch {
    toast.add({ severity: 'error', summary: 'Error', detail: 'Failed to search members', life: 4000 });
  } finally {
    memberSearching.value = false;
    hasSearched.value = true;
  }
}

function selectMember(member: MemberRecord) {
  selectedMember.value = member;
  memberResults.value = [];
  memberQuery.value = '';
  fetchNotes();
}

function clearMember() {
  selectedMember.value = null;
  notes.value = [];
  totalRecords.value = 0;
}

function memberName(member: MemberRecord): string {
  return member.userId ? `${member.userId.firstName} ${member.userId.lastName}` : 'Unknown';
}

// --- Care notes ---
const notes = ref<CareNote[]>([]);
const totalRecords = ref(0);
const loading = ref(false);
const page = ref(1);
const rows = ref(20);

const typeFilter = ref('');
const resolvedFilter = ref('');

const typeOptions = [
  { label: 'All Types', value: '' },
  { label: 'Visit', value: 'visit' },
  { label: 'Hospital', value: 'hospital' },
  { label: 'Bereavement', value: 'bereavement' },
  { label: 'Meal Train', value: 'meal_train' },
  { label: 'Follow Up', value: 'follow_up' },
  { label: 'General', value: 'general' },
];

const resolvedOptions = [
  { label: 'All', value: '' },
  { label: 'Unresolved', value: 'false' },
  { label: 'Resolved', value: 'true' },
];

async function fetchNotes() {
  if (!selectedMember.value) return;
  loading.value = true;
  try {
    const params: Record<string, string | number> = {
      page: page.value,
      limit: rows.value,
    };
    if (typeFilter.value) params.type = typeFilter.value;
    if (resolvedFilter.value) params.resolved = resolvedFilter.value;

    const res = await api<{ data: CareNote[]; total: number }>(`/api/care/${selectedMember.value._id}`, { params });
    notes.value = res.data || [];
    totalRecords.value = res.total || 0;
  } catch {
    toast.add({ severity: 'error', summary: 'Error', detail: 'Failed to load care notes', life: 4000 });
  } finally {
    loading.value = false;
  }
}

function onPage(event: { page: number; rows: number }) {
  page.value = event.page + 1;
  rows.value = event.rows;
  fetchNotes();
}

function onFilterChange() {
  page.value = 1;
  fetchNotes();
}

// --- Dialog ---
const dialogVisible = ref(false);
const editingNote = ref<CareNote | null>(null);

function openCreate() {
  editingNote.value = null;
  dialogVisible.value = true;
}

function openEdit(note: CareNote) {
  editingNote.value = note;
  dialogVisible.value = true;
}

function onSaved() {
  dialogVisible.value = false;
  fetchNotes();
}

// --- Resolve ---
async function resolveNote(note: CareNote) {
  try {
    await api(`/api/care/${note._id}/resolve`, { method: 'PATCH' });
    toast.add({ severity: 'success', summary: 'Resolved', detail: 'Care note marked as resolved', life: 3000 });
    fetchNotes();
  } catch {
    toast.add({ severity: 'error', summary: 'Error', detail: 'Failed to resolve note', life: 4000 });
  }
}

// --- Formatting ---
function typeSeverity(type: string): string {
  switch (type) {
    case 'visit': return 'info';
    case 'hospital': return 'danger';
    case 'bereavement': return 'secondary';
    case 'meal_train': return 'success';
    case 'follow_up': return 'warn';
    case 'general': return 'info';
    default: return 'info';
  }
}

function typeLabel(type: string): string {
  switch (type) {
    case 'visit': return 'Visit';
    case 'hospital': return 'Hospital';
    case 'bereavement': return 'Bereavement';
    case 'meal_train': return 'Meal Train';
    case 'follow_up': return 'Follow Up';
    case 'general': return 'General';
    default: return type;
  }
}

function truncate(text: string, max = 80): string {
  if (!text) return '';
  return text.length > max ? text.substring(0, max) + '...' : text;
}

function formatDate(dateStr: string): string {
  if (!dateStr) return '';
  return new Date(dateStr).toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' });
}

function authorName(note: CareNote): string {
  if (note.authorId && typeof note.authorId === 'object') {
    return `${note.authorId.firstName} ${note.authorId.lastName}`;
  }
  return '-';
}
</script>

<template>
  <div>
    <Toast />

    <div class="page-header">
      <h1>Care Notes</h1>
      <Button v-if="selectedMember" label="New Note" icon="pi pi-plus" @click="openCreate" />
    </div>

    <!-- Member search -->
    <div v-if="!selectedMember" class="member-search-section">
      <p class="search-prompt">Search for a member to view their care notes.</p>
      <div class="member-search">
        <InputText
          v-model="memberQuery"
          placeholder="Search members by name..."
          style="flex: 1; max-width: 400px"
          @keyup.enter="searchMembers"
        />
        <Button label="Search" icon="pi pi-search" :loading="memberSearching" @click="searchMembers" />
      </div>
      <div v-if="memberResults.length" class="member-results">
        <div
          v-for="m in memberResults"
          :key="m._id"
          class="member-result-item"
          @click="selectMember(m)"
        >
          <i class="pi pi-user" />
          <span>{{ memberName(m) }}</span>
        </div>
      </div>
      <div v-if="memberResults.length === 0 && hasSearched && !memberSearching" class="empty-state">
        No members found.
      </div>
    </div>

    <!-- Selected member: care notes view -->
    <div v-if="selectedMember">
      <div class="selected-member-bar">
        <span class="member-label">
          <i class="pi pi-user" style="margin-right: 0.5rem" />
          {{ memberName(selectedMember) }}
        </span>
        <Button label="Change Member" icon="pi pi-times" severity="secondary" text size="small" @click="clearMember" />
      </div>

      <div class="filters">
        <Dropdown
          v-model="typeFilter"
          :options="typeOptions"
          option-label="label"
          option-value="value"
          placeholder="Type"
          style="min-width: 160px"
          @change="onFilterChange"
        />
        <Dropdown
          v-model="resolvedFilter"
          :options="resolvedOptions"
          option-label="label"
          option-value="value"
          placeholder="Status"
          style="min-width: 160px"
          @change="onFilterChange"
        />
      </div>

      <DataTable
        :value="notes"
        :loading="loading"
        :total-records="totalRecords"
        :rows="rows"
        data-key="_id"
        lazy
        paginator
        striped-rows
        :rows-per-page-options="[10, 20, 50]"
        @page="onPage"
      >
        <template #empty>
          <div class="empty-state">No care notes found for this member.</div>
        </template>

        <Column header="Type" style="width: 120px">
          <template #body="{ data }">
            <Tag :value="typeLabel(data.type)" :severity="typeSeverity(data.type)" />
          </template>
        </Column>
        <Column header="Content">
          <template #body="{ data }">
            {{ truncate(data.content) }}
          </template>
        </Column>
        <Column header="Follow-up" style="width: 120px">
          <template #body="{ data }">
            {{ formatDate(data.followUpDate) }}
          </template>
        </Column>
        <Column header="Author" style="width: 140px">
          <template #body="{ data }">
            {{ authorName(data) }}
          </template>
        </Column>
        <Column header="Resolved" style="width: 100px">
          <template #body="{ data }">
            <Tag
              :value="data.resolved ? 'Yes' : 'No'"
              :severity="data.resolved ? 'success' : 'warn'"
            />
          </template>
        </Column>
        <Column header="Created" style="width: 120px">
          <template #body="{ data }">
            {{ formatDate(data.createdAt) }}
          </template>
        </Column>
        <Column header="Actions" style="width: 100px">
          <template #body="{ data }">
            <div class="action-buttons">
              <Button icon="pi pi-pencil" severity="info" text rounded @click="openEdit(data)" />
              <Button
                v-if="!data.resolved"
                icon="pi pi-check"
                severity="success"
                text
                rounded
                v-tooltip.top="'Mark Resolved'"
                @click="resolveNote(data)"
              />
            </div>
          </template>
        </Column>
      </DataTable>
    </div>

    <CareCareNoteDialog
      v-if="selectedMember"
      v-model:visible="dialogVisible"
      :member-id="selectedMember._id"
      :note="editingNote"
      @saved="onSaved"
    />
  </div>
</template>

<style scoped>
.page-header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 1.5rem; }
.page-header h1 { font-size: 1.5rem; font-weight: 600; }
.filters { display: flex; gap: 1rem; margin-bottom: 1rem; }
.member-search { display: flex; gap: 0.5rem; margin-bottom: 1.5rem; }
.search-prompt { color: var(--p-text-muted-color); margin-bottom: 0.75rem; }
.member-results {
  border: 1px solid var(--p-content-border-color);
  border-radius: 6px;
  max-width: 400px;
  overflow: hidden;
}
.member-result-item {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  padding: 0.625rem 0.75rem;
  cursor: pointer;
  transition: background-color 0.15s;
}
.member-result-item:hover {
  background-color: var(--p-highlight-background);
}
.member-result-item + .member-result-item {
  border-top: 1px solid var(--p-content-border-color);
}
.selected-member-bar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  background-color: var(--p-highlight-background);
  border-radius: 6px;
  padding: 0.5rem 1rem;
  margin-bottom: 1rem;
}
.member-label {
  font-weight: 600;
  font-size: 1.1rem;
}
.member-search-section { margin-bottom: 1rem; }
.action-buttons { display: flex; gap: 0.25rem; }
.empty-state { text-align: center; padding: 2rem; color: var(--p-text-muted-color); }
</style>
