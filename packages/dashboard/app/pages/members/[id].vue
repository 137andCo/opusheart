<script setup lang="ts">
definePageMeta({ layout: 'default' });

const route = useRoute();
const api = useApi();
const toast = useToast();

const member = ref<Record<string, any> | null>(null);
const loading = ref(true);

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

async function loadMember() {
  loading.value = true;
  try {
    const data = await api<{ member: Record<string, any> }>(`/api/members/${route.params.id}`);
    member.value = data.member;
  } catch (err: any) {
    toast.add({ severity: 'error', summary: 'Error', detail: err.data?.error?.message || 'Failed to load member', life: 4000 });
    navigateTo('/members');
  } finally {
    loading.value = false;
  }
}

onMounted(() => loadMember());
</script>

<template>
  <div>
    <NuxtLink to="/members" class="back-link">
      <i class="pi pi-arrow-left" /> Back to Members
    </NuxtLink>

    <div v-if="loading" class="loading-state">
      <ProgressSpinner style="width: 50px; height: 50px" />
    </div>

    <template v-else-if="member">
      <div class="page-header">
        <h1>{{ member.userId?.firstName }} {{ member.userId?.lastName }}</h1>
      </div>

      <div class="detail-card">
        <h3>Profile</h3>
        <div class="detail-grid">
          <div class="detail-item">
            <span class="detail-label">Email</span>
            <span class="detail-value">{{ member.userId?.email || '-' }}</span>
          </div>
          <div class="detail-item">
            <span class="detail-label">Status</span>
            <span class="detail-value">
              <Tag :value="member.membershipStatus" :severity="statusSeverity(member.membershipStatus)" />
            </span>
          </div>
          <div class="detail-item">
            <span class="detail-label">Joined</span>
            <span class="detail-value">{{ formatDate(member.joinedAt || member.createdAt) }}</span>
          </div>
          <div class="detail-item">
            <span class="detail-label">Attendance Opt-In</span>
            <span class="detail-value">{{ member.attendanceOptIn ? 'Yes' : 'No' }}</span>
          </div>
        </div>
      </div>

      <div v-if="member.groups && member.groups.length > 0" class="detail-card">
        <h3>Groups</h3>
        <ul class="groups-list">
          <li v-for="group in member.groups" :key="group._id || group">
            {{ group.name || group }}
          </li>
        </ul>
      </div>
    </template>
  </div>
</template>

<style scoped>
.back-link {
  display: inline-flex;
  align-items: center;
  gap: 0.5rem;
  color: var(--p-primary-color);
  text-decoration: none;
  margin-bottom: 1.5rem;
  font-size: 0.875rem;
}
.back-link:hover { text-decoration: underline; }

.page-header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 1.5rem; }
.page-header h1 { font-size: 1.5rem; font-weight: 600; }

.loading-state { display: flex; justify-content: center; padding: 3rem; }

.detail-card {
  background: var(--p-surface-0);
  border: 1px solid var(--p-surface-200);
  border-radius: 8px;
  padding: 1.5rem;
  margin-bottom: 1.5rem;
}
.detail-card h3 { margin: 0 0 1rem 0; font-size: 1.1rem; font-weight: 600; }

.detail-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(220px, 1fr)); gap: 1rem; }
.detail-item { display: flex; flex-direction: column; gap: 0.25rem; }
.detail-label { font-size: 0.8rem; color: var(--p-text-muted-color); font-weight: 500; text-transform: uppercase; letter-spacing: 0.03em; }
.detail-value { font-size: 0.95rem; }

.groups-list { margin: 0; padding-left: 1.25rem; }
.groups-list li { padding: 0.25rem 0; }
</style>
