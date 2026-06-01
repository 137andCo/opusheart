<script setup lang="ts">
definePageMeta({ layout: 'default' });

const api = useApi();
const confirm = useConfirm();
const toast = useToast();

const activeTab = ref(0);

// --- Currency formatter ---
const fmt = new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' });

// --- Funds tab ---
const { items: funds, totalRecords: fundsTotalRecords, loading: fundsLoading, fetchAll: fetchFunds, remove: removeFund, onPage: onFundsPage } = useCrudApi<any>('/api/giving/funds', 'funds');

// --- Donations tab ---
const { items: donations, totalRecords: donationsTotalRecords, loading: donationsLoading, filters: donationFilters, fetchAll: fetchDonations, onPage: onDonationsPage } = useCrudApi<any>('/api/giving/donations', 'donations');

const fundFilter = ref('');
const statusFilter = ref('');
const startDate = ref<Date | null>(null);
const endDate = ref<Date | null>(null);

const statusOptions = [
  { label: 'All Statuses', value: '' },
  { label: 'Completed', value: 'completed' },
  { label: 'Pending', value: 'pending' },
  { label: 'Refunded', value: 'refunded' },
  { label: 'Failed', value: 'failed' },
];

const fundDropdownOptions = computed(() => [
  { label: 'All Funds', value: '' },
  ...funds.value.map((f: any) => ({ label: f.name, value: f._id || f.id })),
]);

function onFundFilterChange() {
  donationFilters.value.fund = fundFilter.value || undefined;
  fetchDonations();
}

function onStatusFilterChange() {
  donationFilters.value.status = statusFilter.value || undefined;
  fetchDonations();
}

function onDateFilterChange() {
  donationFilters.value.startDate = startDate.value ? startDate.value.toISOString() : undefined;
  donationFilters.value.endDate = endDate.value ? endDate.value.toISOString() : undefined;
  fetchDonations();
}

// --- Fund dialog ---
const fundDialogVisible = ref(false);
const selectedFund = ref<any>(null);

function openCreateFund() {
  selectedFund.value = null;
  fundDialogVisible.value = true;
}

function openEditFund(fund: any) {
  selectedFund.value = fund;
  fundDialogVisible.value = true;
}

function confirmDeleteFund(fund: any) {
  confirm.require({
    message: `Delete fund "${fund.name}"? This cannot be undone.`,
    header: 'Confirm Delete',
    icon: 'pi pi-exclamation-triangle',
    acceptClass: 'p-button-danger',
    accept: async () => {
      try {
        await removeFund(fund._id || fund.id);
        fetchFunds();
      } catch {
        toast.add({ severity: 'error', summary: 'Error', detail: 'Failed to delete fund', life: 4000 });
      }
    },
  });
}

function onFundSaved() {
  fundDialogVisible.value = false;
  fetchFunds();
}

// --- Donation dialog ---
const donationDialogVisible = ref(false);

function openRecordDonation() {
  donationDialogVisible.value = true;
}

function onDonationSaved() {
  donationDialogVisible.value = false;
  fetchDonations();
}

// --- Refund ---
function confirmRefund(donation: any) {
  confirm.require({
    message: `Refund this donation of ${fmt.format(donation.amount)}? This cannot be undone.`,
    header: 'Confirm Refund',
    icon: 'pi pi-exclamation-triangle',
    acceptClass: 'p-button-danger',
    accept: async () => {
      try {
        await api(`/api/giving/donations/${donation._id || donation.id}/refund`, { method: 'POST' });
        toast.add({ severity: 'success', summary: 'Refunded', detail: 'Donation refunded successfully', life: 3000 });
        fetchDonations();
      } catch (err: any) {
        toast.add({ severity: 'error', summary: 'Error', detail: err.data?.error?.message || 'Failed to refund donation', life: 4000 });
      }
    },
  });
}

// --- Helpers ---
function formatDate(dateStr: string): string {
  if (!dateStr) return '';
  return new Date(dateStr).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

function truncate(text: string, len: number): string {
  if (!text) return '';
  return text.length > len ? text.slice(0, len) + '...' : text;
}

function fundName(donation: any): string {
  if (!donation.fund) return '';
  if (typeof donation.fund === 'object') return donation.fund.name || '';
  const found = funds.value.find((f: any) => (f._id || f.id) === donation.fund);
  return found ? found.name : '';
}

function statusSeverity(status: string): string {
  switch (status) {
    case 'completed': return 'success';
    case 'pending': return 'warn';
    case 'refunded': return 'info';
    case 'failed': return 'danger';
    default: return 'secondary';
  }
}

function methodLabel(method: string): string {
  switch (method) {
    case 'online': return 'Online';
    case 'cash': return 'Cash';
    case 'check': return 'Check';
    case 'other': return 'Other';
    default: return method || '';
  }
}

onMounted(() => {
  fetchFunds();
  fetchDonations();
});
</script>

<template>
  <div>
    <ConfirmDialog />
    <Toast />

    <div class="page-header">
      <h1>Giving</h1>
      <Button v-if="activeTab === 0" label="New Fund" icon="pi pi-plus" @click="openCreateFund" />
      <Button v-else label="Record Donation" icon="pi pi-plus" @click="openRecordDonation" />
    </div>

    <TabView v-model:activeIndex="activeTab">
      <TabPanel header="Funds" value="funds">
        <DataTable
          :value="funds"
          :loading="fundsLoading"
          :total-records="fundsTotalRecords"
          :rows="20"
          data-key="_id"
          lazy
          paginator
          scrollable
          striped-rows
          :rows-per-page-options="[10, 20, 50]"
          @page="onFundsPage"
        >
          <template #empty>
            <div class="empty-state" role="status">No funds found.</div>
          </template>

          <Column field="name" header="Name" />
          <Column header="Description">
            <template #body="{ data }">
              {{ truncate(data.description, 60) }}
            </template>
          </Column>
          <Column header="Goal">
            <template #body="{ data }">
              {{ data.goal ? fmt.format(data.goal) : '-' }}
            </template>
          </Column>
          <Column header="Raised">
            <template #body="{ data }">
              {{ fmt.format(data.raised || 0) }}
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
          <Column header="Actions" style="width: 8rem">
            <template #body="{ data }">
              <div class="action-buttons">
                <Button icon="pi pi-pencil" text rounded severity="info" aria-label="Edit fund" @click="openEditFund(data)" />
                <Button icon="pi pi-trash" text rounded severity="danger" aria-label="Delete fund" @click="confirmDeleteFund(data)" />
              </div>
            </template>
          </Column>
        </DataTable>
      </TabPanel>

      <TabPanel header="Donations" value="donations">
        <div class="tab-toolbar">
          <div class="page-filters">
            <Dropdown
              v-model="fundFilter"
              :options="fundDropdownOptions"
              option-label="label"
              option-value="value"
              placeholder="Fund"
              class="filter-dropdown"
              @change="onFundFilterChange"
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
              v-model="startDate"
              class="filter-date"
              date-format="mm/dd/yy"
              placeholder="Start date"
              :show-icon="true"
              @date-select="onDateFilterChange"
            />
            <Calendar
              v-model="endDate"
              class="filter-date"
              date-format="mm/dd/yy"
              placeholder="End date"
              :show-icon="true"
              @date-select="onDateFilterChange"
            />
          </div>
        </div>

        <DataTable
          :value="donations"
          :loading="donationsLoading"
          :total-records="donationsTotalRecords"
          :rows="20"
          data-key="_id"
          lazy
          paginator
          scrollable
          striped-rows
          :rows-per-page-options="[10, 20, 50]"
          @page="onDonationsPage"
        >
          <template #empty>
            <div class="empty-state" role="status">No donations found.</div>
          </template>

          <Column header="Date">
            <template #body="{ data }">
              {{ formatDate(data.createdAt || data.date) }}
            </template>
          </Column>
          <Column header="Amount">
            <template #body="{ data }">
              {{ fmt.format(data.amount) }}
            </template>
          </Column>
          <Column header="Fund">
            <template #body="{ data }">
              {{ fundName(data) }}
            </template>
          </Column>
          <Column header="Method">
            <template #body="{ data }">
              <Tag :value="methodLabel(data.method)" severity="info" />
            </template>
          </Column>
          <Column header="Status">
            <template #body="{ data }">
              <Tag
                :value="data.status || 'pending'"
                :severity="statusSeverity(data.status)"
              />
            </template>
          </Column>
          <Column header="Recurring">
            <template #body="{ data }">
              <Tag
                :value="data.recurring ? 'Yes' : 'No'"
                :severity="data.recurring ? 'info' : 'secondary'"
              />
            </template>
          </Column>
          <Column header="Actions" style="width: 6rem">
            <template #body="{ data }">
              <div class="action-buttons">
                <Button
                  v-if="data.status === 'completed'"
                  icon="pi pi-replay"
                  text
                  rounded
                  severity="warn"
                  aria-label="Refund donation"
                  v-tooltip.top="'Refund'"
                  @click="confirmRefund(data)"
                />
              </div>
            </template>
          </Column>
        </DataTable>
      </TabPanel>
    </TabView>

    <GivingFundDialog
      v-model:visible="fundDialogVisible"
      :fund="selectedFund"
      @saved="onFundSaved"
    />

    <GivingDonationDialog
      v-model:visible="donationDialogVisible"
      :funds-list="funds"
      @saved="onDonationSaved"
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
