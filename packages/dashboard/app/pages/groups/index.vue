<script setup lang="ts">
definePageMeta({ layout: 'default' });

const confirm = useConfirm();
const toast = useToast();

const { items: groups, totalRecords, loading, filters, fetchAll, remove, onPage } = useCrudApi<any>('/api/groups', 'groups');

const typeOptions = [
  { label: 'All Types', value: '' },
  { label: 'Small Group', value: 'small_group' },
  { label: 'Bible Study', value: 'bible_study' },
  { label: 'Committee', value: 'committee' },
  { label: 'Ministry', value: 'ministry' },
  { label: 'Team', value: 'team' },
  { label: 'Class', value: 'class' },
  { label: 'Custom', value: 'custom' },
];

const typeLabels: Record<string, string> = {
  small_group: 'Small Group',
  bible_study: 'Bible Study',
  committee: 'Committee',
  ministry: 'Ministry',
  team: 'Team',
  class: 'Class',
  custom: 'Custom',
};

const typeSeverities: Record<string, string> = {
  small_group: 'success',
  bible_study: 'info',
  committee: 'warn',
  ministry: 'help',
  team: 'danger',
  class: 'contrast',
  custom: 'secondary',
};

const dialogVisible = ref(false);
const selectedGroup = ref<any | null>(null);

function openCreate() {
  selectedGroup.value = null;
  dialogVisible.value = true;
}

function openEdit(group: any) {
  selectedGroup.value = group;
  dialogVisible.value = true;
}

function confirmDelete(group: any) {
  confirm.require({
    message: `Delete "${group.name}"? This cannot be undone.`,
    header: 'Confirm Delete',
    icon: 'pi pi-exclamation-triangle',
    acceptClass: 'p-button-danger',
    accept: async () => {
      try {
        await remove(group._id || group.id);
        fetchAll();
      } catch {
        toast.add({ severity: 'error', summary: 'Error', detail: 'Failed to delete group', life: 4000 });
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

function membersDisplay(group: any): string {
  const count = group.members?.length ?? 0;
  if (group.maxMembers) {
    return `${count} / ${group.maxMembers}`;
  }
  return String(count);
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
      <h1>Groups</h1>
      <Button label="New Group" icon="pi pi-plus" @click="openCreate" />
    </div>

    <div class="page-filters">
      <Dropdown
        v-model="filters.type"
        :options="typeOptions"
        option-label="label"
        option-value="value"
        placeholder="All Types"
        class="filter-dropdown"
        @change="onFilterChange"
      />
    </div>

    <DataTable
      :value="groups"
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
        <div class="empty-state">No groups found.</div>
      </template>

      <Column field="name" header="Name" />
      <Column header="Type">
        <template #body="{ data }">
          <Tag :value="typeLabels[data.type] || data.type" :severity="typeSeverities[data.type] || 'secondary'" />
        </template>
      </Column>
      <Column header="Members">
        <template #body="{ data }">
          {{ membersDisplay(data) }}
        </template>
      </Column>
      <Column field="meetingSchedule" header="Schedule" />
      <Column field="location" header="Location" />
      <Column header="Active">
        <template #body="{ data }">
          <Tag :value="data.active !== false ? 'Active' : 'Inactive'" :severity="data.active !== false ? 'success' : 'warn'" />
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

    <GroupDialog v-model:visible="dialogVisible" :group="selectedGroup" @saved="onSaved" />
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
