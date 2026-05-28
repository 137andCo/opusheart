<script setup lang="ts">
definePageMeta({ layout: 'default' });

const api = useApi();
const confirm = useConfirm();
const toast = useToast();

interface HouseholdMember {
  _id: string;
  userId?: {
    _id: string;
    firstName: string;
    lastName: string;
    email?: string;
  };
  membershipStatus?: string;
}

interface Household {
  _id: string;
  id: string;
  name: string;
  address?: {
    street?: string;
    city?: string;
    state?: string;
    zip?: string;
    country?: string;
  };
  members: HouseholdMember[];
  createdAt: string;
}

const { items: households, totalRecords, loading, filters, fetchAll, remove, onPage } = useCrudApi<Household>('/api/households', 'data');

const searchText = ref('');
let debounceTimer: ReturnType<typeof setTimeout>;

watch(searchText, (val) => {
  clearTimeout(debounceTimer);
  debounceTimer = setTimeout(() => {
    filters.value.search = val;
    fetchAll();
  }, 300);
});

// Create/Edit dialog
const dialogVisible = ref(false);
const selectedHousehold = ref<Household | null>(null);

function openCreate() {
  selectedHousehold.value = null;
  dialogVisible.value = true;
}

function openEdit(household: Household) {
  selectedHousehold.value = household;
  dialogVisible.value = true;
}

function onSaved() {
  dialogVisible.value = false;
  fetchAll();
}

function confirmDelete(household: Household) {
  confirm.require({
    message: `Delete "${household.name}"? This cannot be undone.`,
    header: 'Confirm Delete',
    icon: 'pi pi-exclamation-triangle',
    acceptClass: 'p-button-danger',
    accept: async () => {
      try {
        await remove(household._id || household.id);
        fetchAll();
      } catch {
        toast.add({ severity: 'error', summary: 'Error', detail: 'Failed to delete household', life: 4000 });
      }
    },
  });
}

// Detail dialog
const detailVisible = ref(false);
const detailHousehold = ref<Household | null>(null);
const detailLoading = ref(false);
const addMemberId = ref('');
const addingMember = ref(false);

async function openDetail(household: Household) {
  detailLoading.value = true;
  detailVisible.value = true;
  try {
    const result = await api<any>(`/api/households/${household._id || household.id}`);
    detailHousehold.value = result.household || result;
  } catch (err: any) {
    toast.add({ severity: 'error', summary: 'Error', detail: 'Failed to load household details', life: 4000 });
    detailVisible.value = false;
  } finally {
    detailLoading.value = false;
  }
}

async function addMember() {
  const memberId = addMemberId.value.trim();
  if (!memberId || !detailHousehold.value) return;
  addingMember.value = true;
  try {
    const id = detailHousehold.value._id || detailHousehold.value.id;
    await api(`/api/households/${id}/members`, { method: 'POST', body: { memberId } });
    toast.add({ severity: 'success', summary: 'Added', detail: 'Member added to household', life: 3000 });
    addMemberId.value = '';
    // Refresh detail
    const result = await api<any>(`/api/households/${id}`);
    detailHousehold.value = result.household || result;
    fetchAll();
  } catch (err: any) {
    toast.add({ severity: 'error', summary: 'Error', detail: err.data?.error?.message || 'Failed to add member', life: 4000 });
  } finally {
    addingMember.value = false;
  }
}

async function removeMember(memberId: string) {
  if (!detailHousehold.value) return;
  const id = detailHousehold.value._id || detailHousehold.value.id;
  try {
    await api(`/api/households/${id}/members/${memberId}`, { method: 'DELETE' });
    toast.add({ severity: 'success', summary: 'Removed', detail: 'Member removed from household', life: 3000 });
    const result = await api<any>(`/api/households/${id}`);
    detailHousehold.value = result.household || result;
    fetchAll();
  } catch (err: any) {
    toast.add({ severity: 'error', summary: 'Error', detail: err.data?.error?.message || 'Failed to remove member', life: 4000 });
  }
}

function addressDisplay(household: Household): string {
  if (!household.address) return 'No address';
  const { city, state } = household.address;
  if (city && state) return `${city}, ${state}`;
  if (city) return city;
  if (state) return state;
  return 'No address';
}

function fullAddress(household: Household): string {
  if (!household.address) return 'No address on file';
  const parts: string[] = [];
  if (household.address.street) parts.push(household.address.street);
  const cityState = [household.address.city, household.address.state].filter(Boolean).join(', ');
  if (cityState) parts.push(cityState);
  if (household.address.zip) parts.push(household.address.zip);
  if (household.address.country) parts.push(household.address.country);
  return parts.length ? parts.join(', ') : 'No address on file';
}

function memberName(member: HouseholdMember): string {
  if (member.userId && typeof member.userId === 'object') {
    return `${member.userId.firstName || ''} ${member.userId.lastName || ''}`.trim() || 'Unknown';
  }
  return String(member._id || member);
}

function formatDate(dateStr: string): string {
  if (!dateStr) return '';
  return new Date(dateStr).toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' });
}

onMounted(() => fetchAll());
</script>

<template>
  <div>
    <ConfirmDialog />
    <Toast />

    <div class="page-header">
      <h1>Households</h1>
      <Button label="New Household" icon="pi pi-plus" @click="openCreate" />
    </div>

    <div class="page-filters">
      <InputText v-model="searchText" placeholder="Search households..." style="max-width: 300px; width: 100%" />
    </div>

    <DataTable
      :value="households"
      :loading="loading"
      :total-records="totalRecords"
      :rows="20"
      data-key="_id"
      lazy
      paginator
      striped-rows
      :rows-per-page-options="[10, 20, 50]"
      @page="onPage"
      @row-click="(e: any) => openDetail(e.data)"
      row-hover
      class="cursor-pointer-rows"
    >
      <template #empty>
        <div class="empty-state">No households found.</div>
      </template>

      <Column field="name" header="Name" />
      <Column header="Members">
        <template #body="{ data }">
          {{ (data.members || []).length }}
        </template>
      </Column>
      <Column header="Address">
        <template #body="{ data }">
          {{ addressDisplay(data) }}
        </template>
      </Column>
      <Column header="Created">
        <template #body="{ data }">
          {{ formatDate(data.createdAt) }}
        </template>
      </Column>
      <Column header="Actions" style="width: 10rem">
        <template #body="{ data }">
          <div class="action-buttons">
            <Button icon="pi pi-eye" text rounded severity="info" @click.stop="openDetail(data)" />
            <Button icon="pi pi-pencil" text rounded severity="info" @click.stop="openEdit(data)" />
            <Button icon="pi pi-trash" text rounded severity="danger" @click.stop="confirmDelete(data)" />
          </div>
        </template>
      </Column>
    </DataTable>

    <!-- Create/Edit Dialog -->
    <HouseholdsHouseholdDialog v-model:visible="dialogVisible" :household="selectedHousehold" @saved="onSaved" />

    <!-- Detail Dialog -->
    <Dialog
      v-model:visible="detailVisible"
      header="Household Details"
      modal
      :style="{ width: '36rem' }"
      :closable="true"
    >
      <div v-if="detailLoading" class="detail-loading">
        <ProgressSpinner style="width: 3rem; height: 3rem" />
      </div>
      <div v-else-if="detailHousehold" class="detail-content">
        <h2 class="detail-name">{{ detailHousehold.name }}</h2>
        <p class="detail-address">
          <i class="pi pi-map-marker" style="margin-right: 0.5rem" />
          {{ fullAddress(detailHousehold) }}
        </p>

        <Divider />

        <div class="members-section">
          <h3>Members ({{ (detailHousehold.members || []).length }})</h3>

          <div v-if="(detailHousehold.members || []).length === 0" class="no-members">
            No members in this household.
          </div>
          <div v-else class="members-list">
            <div v-for="member in detailHousehold.members" :key="member._id || String(member)" class="member-row">
              <span class="member-name">
                <i class="pi pi-user" style="margin-right: 0.5rem" />
                {{ memberName(member) }}
              </span>
              <Button
                icon="pi pi-times"
                text
                rounded
                severity="danger"
                size="small"
                @click="removeMember(member._id || String(member))"
              />
            </div>
          </div>

          <Divider />

          <div class="add-member-row">
            <InputText
              v-model="addMemberId"
              placeholder="Member ID"
              class="flex-1"
              @keyup.enter="addMember"
            />
            <Button
              label="Add Member"
              icon="pi pi-plus"
              :loading="addingMember"
              :disabled="!addMemberId.trim()"
              size="small"
              @click="addMember"
            />
          </div>
        </div>
      </div>
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
.page-filters {
  display: flex;
  gap: 1rem;
  margin-bottom: 1rem;
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
.cursor-pointer-rows :deep(.p-datatable-row-group-header),
.cursor-pointer-rows :deep(tr) {
  cursor: pointer;
}
.detail-loading {
  display: flex;
  justify-content: center;
  padding: 2rem;
}
.detail-content {
  display: flex;
  flex-direction: column;
}
.detail-name {
  font-size: 1.25rem;
  font-weight: 600;
  margin: 0 0 0.5rem;
}
.detail-address {
  color: var(--p-text-muted-color);
  margin: 0;
}
.members-section h3 {
  font-size: 1rem;
  font-weight: 600;
  margin: 0 0 0.75rem;
}
.no-members {
  color: var(--p-text-muted-color);
  font-style: italic;
  padding: 0.5rem 0;
}
.members-list {
  display: flex;
  flex-direction: column;
  gap: 0.25rem;
}
.member-row {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 0.375rem 0.5rem;
  border-radius: 0.375rem;
}
.member-row:hover {
  background: var(--p-surface-100);
}
.member-name {
  font-size: 0.9rem;
}
.add-member-row {
  display: flex;
  gap: 0.75rem;
  align-items: center;
}
.flex-1 {
  flex: 1;
}
</style>
