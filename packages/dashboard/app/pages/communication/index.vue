<script setup lang="ts">
definePageMeta({ layout: 'default' });

const confirm = useConfirm();
const toast = useToast();
const api = useApi();

interface MessageItem {
  _id: string;
  id: string;
  subject: string;
  body: string;
  bodyPlain: string;
  channel: 'email' | 'push' | 'sms' | 'announcement';
  audience: {
    type: 'all' | 'group' | 'role' | 'custom';
    groupIds?: string[];
    roles?: string[];
    memberIds?: string[];
  };
  status: 'draft' | 'scheduled' | 'sending' | 'sent' | 'failed';
  scheduledFor?: string;
  sentAt?: string;
  deliveryStats?: {
    total: number;
    delivered: number;
    failed: number;
  };
}

const { items: messages, totalRecords, loading, filters, fetchAll, remove, onPage } = useCrudApi<MessageItem>('/api/messages', 'messages');

const statusOptions = [
  { label: 'All', value: '' },
  { label: 'Draft', value: 'draft' },
  { label: 'Scheduled', value: 'scheduled' },
  { label: 'Sending', value: 'sending' },
  { label: 'Sent', value: 'sent' },
  { label: 'Failed', value: 'failed' },
];

const dialogVisible = ref(false);
const selectedMessage = ref<MessageItem | null>(null);

function openCreate() {
  selectedMessage.value = null;
  dialogVisible.value = true;
}

function openEdit(msg: MessageItem) {
  selectedMessage.value = msg;
  dialogVisible.value = true;
}

function confirmDelete(msg: MessageItem) {
  confirm.require({
    message: `Delete "${msg.subject}"? This cannot be undone.`,
    header: 'Confirm Delete',
    icon: 'pi pi-exclamation-triangle',
    acceptClass: 'p-button-danger',
    accept: async () => {
      try {
        await remove(msg._id || msg.id);
        fetchAll();
      } catch {
        toast.add({ severity: 'error', summary: 'Error', detail: 'Failed to delete message', life: 4000 });
      }
    },
  });
}

async function sendNow(msg: MessageItem) {
  confirm.require({
    message: `Send "${msg.subject}" now to ${audienceLabel(msg.audience.type)}?`,
    header: 'Confirm Send',
    icon: 'pi pi-send',
    accept: async () => {
      try {
        const id = msg._id || msg.id;
        await api(`/api/messages/${id}/send`, { method: 'POST' });
        toast.add({ severity: 'success', summary: 'Sent', detail: 'Message is being sent', life: 3000 });
        fetchAll();
      } catch (err: any) {
        toast.add({ severity: 'error', summary: 'Error', detail: err.data?.error?.message || 'Failed to send message', life: 4000 });
      }
    },
  });
}

async function cancelScheduled(msg: MessageItem) {
  confirm.require({
    message: `Cancel scheduled send of "${msg.subject}"?`,
    header: 'Confirm Cancel',
    icon: 'pi pi-times-circle',
    accept: async () => {
      try {
        const id = msg._id || msg.id;
        await api(`/api/messages/${id}/cancel`, { method: 'POST' });
        toast.add({ severity: 'success', summary: 'Cancelled', detail: 'Scheduled send cancelled', life: 3000 });
        fetchAll();
      } catch (err: any) {
        toast.add({ severity: 'error', summary: 'Error', detail: err.data?.error?.message || 'Failed to cancel message', life: 4000 });
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

function statusSeverity(status: string): string {
  switch (status) {
    case 'draft': return 'secondary';
    case 'scheduled': return 'info';
    case 'sending': return 'warn';
    case 'sent': return 'success';
    case 'failed': return 'danger';
    default: return 'secondary';
  }
}

function channelSeverity(channel: string): string {
  switch (channel) {
    case 'email': return 'info';
    case 'push': return 'warn';
    case 'sms': return 'success';
    case 'announcement': return 'secondary';
    default: return 'info';
  }
}

function channelLabel(channel: string): string {
  switch (channel) {
    case 'email': return 'Email';
    case 'push': return 'Push';
    case 'sms': return 'SMS';
    case 'announcement': return 'Announcement';
    default: return channel;
  }
}

function audienceLabel(type: string): string {
  switch (type) {
    case 'all': return 'All Members';
    case 'group': return 'Group';
    case 'role': return 'Role';
    case 'custom': return 'Custom';
    default: return type;
  }
}

function formatDateTime(dateStr?: string): string {
  if (!dateStr) return '-';
  const d = new Date(dateStr);
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) +
    ', ' +
    d.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' });
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
      <h1>Communication</h1>
      <Button label="New Message" icon="pi pi-plus" @click="openCreate" />
    </div>

    <div class="page-filters">
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
      :value="messages"
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
        <div class="empty-state" role="status">No messages found.</div>
      </template>

      <Column field="subject" header="Subject" />
      <Column header="Channel">
        <template #body="{ data }">
          <Tag :value="channelLabel(data.channel)" :severity="channelSeverity(data.channel)" />
        </template>
      </Column>
      <Column header="Status">
        <template #body="{ data }">
          <Tag :value="data.status" :severity="statusSeverity(data.status)" />
        </template>
      </Column>
      <Column header="Audience">
        <template #body="{ data }">
          {{ audienceLabel(data.audience?.type) }}
        </template>
      </Column>
      <Column header="Scheduled / Sent">
        <template #body="{ data }">
          {{ formatDateTime(data.sentAt || data.scheduledFor) }}
        </template>
      </Column>
      <Column header="Actions" style="width: 12rem">
        <template #body="{ data }">
          <div class="action-buttons">
            <Button
              v-if="data.status === 'draft'"
              icon="pi pi-pencil"
              text
              rounded
              severity="info"
              aria-label="Edit message"
              v-tooltip.top="'Edit'"
              @click="openEdit(data)"
            />
            <Button
              v-if="data.status === 'draft'"
              icon="pi pi-send"
              text
              rounded
              severity="success"
              aria-label="Send message"
              v-tooltip.top="'Send Now'"
              @click="sendNow(data)"
            />
            <Button
              v-if="data.status === 'scheduled'"
              icon="pi pi-times-circle"
              text
              rounded
              severity="warn"
              aria-label="Cancel scheduled message"
              v-tooltip.top="'Cancel'"
              @click="cancelScheduled(data)"
            />
            <Button
              v-if="data.status === 'draft'"
              icon="pi pi-trash"
              text
              rounded
              severity="danger"
              aria-label="Delete message"
              v-tooltip.top="'Delete'"
              @click="confirmDelete(data)"
            />
          </div>
        </template>
      </Column>
    </DataTable>

    <MessageDialog v-model:visible="dialogVisible" :message="selectedMessage" @saved="onSaved" />
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
