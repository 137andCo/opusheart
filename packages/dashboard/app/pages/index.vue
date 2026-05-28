<script setup lang="ts">
definePageMeta({ layout: 'default' });

const authStore = useAuthStore();
const api = useApi();

interface DashboardStats {
  members: number;
  events: number;
  groups: number;
  sermons: number;
}

const stats = ref<DashboardStats>({ members: 0, events: 0, groups: 0, sermons: 0 });
const loading = ref(true);

const statCards = computed(() => [
  { label: 'Members', value: stats.value.members, icon: 'pi pi-users', color: 'var(--p-blue-500)', route: '/members' },
  { label: 'Upcoming Events', value: stats.value.events, icon: 'pi pi-calendar', color: 'var(--p-green-500)', route: '/events' },
  { label: 'Groups', value: stats.value.groups, icon: 'pi pi-sitemap', color: 'var(--p-purple-500)', route: '/groups' },
  { label: 'Sermons', value: stats.value.sermons, icon: 'pi pi-book', color: 'var(--p-orange-500)', route: '/sermons' },
]);

async function loadStats() {
  loading.value = true;
  try {
    const [members, events, groups, sermons] = await Promise.all([
      api<any>('/api/members', { query: { limit: 1 } }).catch(() => ({ total: 0 })),
      api<any>('/api/events', { query: { limit: 1, from: new Date().toISOString() } }).catch(() => ({ total: 0 })),
      api<any>('/api/groups', { query: { limit: 1 } }).catch(() => ({ total: 0 })),
      api<any>('/api/sermons', { query: { limit: 1 } }).catch(() => ({ total: 0 })),
    ]);
    stats.value = {
      members: members.total || 0,
      events: events.total || 0,
      groups: groups.total || 0,
      sermons: sermons.total || 0,
    };
  } finally {
    loading.value = false;
  }
}

onMounted(loadStats);
</script>

<template>
  <div>
    <div class="page-header">
      <div>
        <h1>Welcome, {{ authStore.user?.firstName }}</h1>
        <p class="subtitle">Here's what's happening at your community</p>
      </div>
    </div>

    <div class="stats-grid">
      <NuxtLink
        v-for="card in statCards"
        :key="card.label"
        :to="card.route"
        class="stat-card"
      >
        <div class="stat-icon" :style="{ background: card.color }">
          <i :class="card.icon" />
        </div>
        <div class="stat-info">
          <span class="stat-value">{{ loading ? '...' : card.value }}</span>
          <span class="stat-label">{{ card.label }}</span>
        </div>
      </NuxtLink>
    </div>
  </div>
</template>

<style scoped>
.page-header { margin-bottom: 2rem; }
.page-header h1 { font-size: 1.5rem; font-weight: 600; }
.subtitle { color: var(--p-text-muted-color); margin-top: 0.25rem; }

.stats-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(220px, 1fr));
  gap: 1.5rem;
}

.stat-card {
  display: flex;
  align-items: center;
  gap: 1rem;
  padding: 1.5rem;
  background: var(--p-surface-0);
  border: 1px solid var(--p-surface-200);
  border-radius: 12px;
  text-decoration: none;
  color: inherit;
  transition: box-shadow 0.2s, transform 0.2s;
}

.stat-card:hover {
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.08);
  transform: translateY(-2px);
}

.stat-icon {
  width: 48px;
  height: 48px;
  border-radius: 12px;
  display: flex;
  align-items: center;
  justify-content: center;
  color: white;
  font-size: 1.25rem;
  flex-shrink: 0;
}

.stat-info { display: flex; flex-direction: column; }
.stat-value { font-size: 1.75rem; font-weight: 700; line-height: 1; }
.stat-label { font-size: 0.875rem; color: var(--p-text-muted-color); margin-top: 0.25rem; }
</style>
