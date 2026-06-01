<script setup lang="ts">
definePageMeta({ layout: 'default' });

const confirm = useConfirm();

interface MemberRecord {
  _id: string;
  userId: {
    _id: string;
    firstName: string;
    lastName: string;
    email: string;
    phone?: string;
    role: string;
    avatar?: string;
  };
  householdId?: { _id: string; name: string };
  membershipStatus: string;
  joinedAt: string;
  attendanceOptIn: boolean;
  groups: string[];
  createdAt: string;
}

const { items: members, totalRecords, loading, filters, fetchAll, remove, onPage } = useCrudApi<MemberRecord>('/api/members', 'data');

const statusOptions = [
  { label: 'All', value: '' },
  { label: 'Active', value: 'active' },
  { label: 'Inactive', value: 'inactive' },
  { label: 'Visitor', value: 'visitor' },
  { label: 'Archived', value: 'archived' },
];

const searchText = ref('');
let debounceTimer: ReturnType<typeof setTimeout>;

watch(searchText, (val) => {
  clearTimeout(debounceTimer);
  debounceTimer = setTimeout(() => {
    filters.value.search = val;
    fetchAll();
  }, 300);
});

function onStatusChange(val: string) {
  filters.value.status = val;
  fetchAll();
}

const dialogVisible = ref(false);
const editingMember = ref<MemberRecord | null>(null);

function openCreate() {
  editingMember.value = null;
  dialogVisible.value = true;
}

function openEdit(member: MemberRecord) {
  editingMember.value = member;
  dialogVisible.value = true;
}

function onSaved() {
  dialogVisible.value = false;
  fetchAll();
}

function confirmDelete(member: MemberRecord) {
  const name = member.userId ? `${member.userId.firstName} ${member.userId.lastName}` : 'this member';
  confirm.require({
    message: `Are you sure you want to archive ${name}?`,
    header: 'Confirm Archive',
    icon: 'pi pi-exclamation-triangle',
    acceptClass: 'p-button-danger',
    accept: async () => {
      await remove(member._id);
      fetchAll();
    },
  });
}

function statusSeverity(status: string): string {
  switch (status) {
    case 'active': return 'success';
    case 'inactive': return 'warn';
    case 'visitor': return 'info';
    case 'archived': return 'danger';
    default: return 'secondary';
  }
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

    <div class="page-header">
      <h1>Members</h1>
      <Button label="Add Member" icon="pi pi-plus" @click="openCreate" />
    </div>

    <div class="page-filters">
      <InputText v-model="searchText" placeholder="Search members..." class="w-full" style="max-width: 300px" />
      <Dropdown
        :options="statusOptions"
        option-label="label"
        option-value="value"
        placeholder="Status"
        :model-value="filters.status || ''"
        @update:model-value="onStatusChange"
        style="min-width: 160px"
      />
    </div>

    <DataTable
      :value="members"
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
        <div class="empty-state" role="status">No members found.</div>
      </template>

      <Column field="userId.firstName" header="First Name">
        <template #body="{ data }">
          <NuxtLink :to="`/members/${data._id}`" style="color: var(--p-primary-color); text-decoration: none">
            {{ data.userId?.firstName || '-' }}
          </NuxtLink>
        </template>
      </Column>
      <Column field="userId.lastName" header="Last Name">
        <template #body="{ data }">{{ data.userId?.lastName || '-' }}</template>
      </Column>
      <Column field="userId.email" header="Email">
        <template #body="{ data }">{{ data.userId?.email || '-' }}</template>
      </Column>
      <Column field="membershipStatus" header="Status">
        <template #body="{ data }">
          <Tag :value="data.membershipStatus" :severity="statusSeverity(data.membershipStatus)" />
        </template>
      </Column>
      <Column field="joinedAt" header="Joined">
        <template #body="{ data }">{{ formatDate(data.joinedAt || data.createdAt) }}</template>
      </Column>
      <Column header="Actions" style="width: 120px">
        <template #body="{ data }">
          <div style="display: flex; gap: 0.5rem">
            <Button icon="pi pi-pencil" severity="secondary" text rounded aria-label="Edit member" @click="openEdit(data)" />
            <Button icon="pi pi-trash" severity="danger" text rounded aria-label="Archive member" @click="confirmDelete(data)" />
          </div>
        </template>
      </Column>
    </DataTable>

    <MembersMemberDialog v-model:visible="dialogVisible" :member="editingMember" @saved="onSaved" />
  </div>
</template>

<style scoped>
.page-header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 1.5rem; }
.page-header h1 { font-size: 1.5rem; font-weight: 600; }
.page-filters { display: flex; gap: 0.75rem; margin-bottom: 1rem; flex-wrap: wrap; }
.w-full { width: 100%; }
.empty-state { text-align: center; padding: 2rem; color: var(--p-text-muted-color); }
</style>
