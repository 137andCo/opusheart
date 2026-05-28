<template>
  <div class="groups-page">
    <header class="page-header">
      <h1 id="groups-heading">Groups &amp; Ministries</h1>
      <p class="page-subtitle">Connect with others through small groups, Bible studies, and ministry teams.</p>
    </header>

    <section class="filters" aria-label="Filter groups">
      <div class="filter-row">
        <div class="filter-group">
          <label for="type-filter" class="sr-only">Filter by type</label>
          <select
            id="type-filter"
            v-model="selectedType"
            aria-label="Filter by group type"
            class="filter-select"
          >
            <option value="">All Types</option>
            <option v-for="t in groupTypes" :key="t.value" :value="t.value">
              {{ t.label }}
            </option>
          </select>
        </div>
      </div>
    </section>

    <div v-if="pending" class="loading" aria-live="polite">Loading groups...</div>

    <div v-else-if="groups.length === 0" class="empty-state" aria-live="polite">
      <p>No groups found matching your criteria.</p>
    </div>

    <section v-else aria-labelledby="groups-heading">
      <div class="group-grid">
        <article
          v-for="group in groups"
          :key="group.id"
          class="group-card"
        >
          <div class="card-header">
            <span class="type-badge" :class="'type-' + group.type">
              {{ formatType(group.type) }}
            </span>
          </div>

          <h2 class="group-name">{{ group.name }}</h2>
          <p class="group-description">{{ group.description }}</p>

          <div class="group-info">
            <div v-if="group.meetingSchedule" class="info-row">
              <span class="info-label">Meets:</span>
              <span class="info-value">{{ group.meetingSchedule }}</span>
            </div>
            <div v-if="group.location" class="info-row">
              <span class="info-label">Location:</span>
              <span class="info-value">{{ group.location }}</span>
            </div>
            <div class="info-row">
              <span class="info-label">Members:</span>
              <span class="info-value">
                {{ group.members?.length || 0 }}
                <template v-if="group.maxMembers"> / {{ group.maxMembers }}</template>
              </span>
            </div>
          </div>

          <div v-if="group.maxMembers && group.members?.length >= group.maxMembers" class="full-badge">
            Group Full
          </div>
          <div
            v-else-if="group.maxMembers && group.members?.length >= group.maxMembers * 0.8"
            class="almost-full-badge"
          >
            Almost Full
          </div>
        </article>
      </div>

      <nav v-if="totalPages > 1" class="pagination" aria-label="Group pages">
        <button
          :disabled="currentPage <= 1"
          class="page-btn"
          aria-label="Previous page"
          @click="currentPage--"
        >
          Previous
        </button>
        <span class="page-info">Page {{ currentPage }} of {{ totalPages }}</span>
        <button
          :disabled="currentPage >= totalPages"
          class="page-btn"
          aria-label="Next page"
          @click="currentPage++"
        >
          Next
        </button>
      </nav>
    </section>
  </div>
</template>

<script setup lang="ts">
const config = useRuntimeConfig();

const selectedType = ref('');
const currentPage = ref(1);

const groupTypes = [
  { value: 'small_group', label: 'Small Groups' },
  { value: 'bible_study', label: 'Bible Studies' },
  { value: 'committee', label: 'Committees' },
  { value: 'ministry', label: 'Ministries' },
  { value: 'team', label: 'Teams' },
  { value: 'class', label: 'Classes' },
  { value: 'custom', label: 'Other' },
];

watch(selectedType, () => {
  currentPage.value = 1;
});

const queryParams = computed(() => {
  const params: Record<string, string | number> = {
    page: currentPage.value,
    limit: 12,
  };
  if (selectedType.value) params.type = selectedType.value;
  return params;
});

const { data, pending } = await useFetch<{
  groups: any[];
  pagination: { total: number; page: number; limit: number; pages: number };
}>(`${config.public.apiBase}/groups/public`, {
  query: queryParams,
  watch: [queryParams],
  server: true,
});

const groups = computed(() => data.value?.groups || []);
const totalPages = computed(() => data.value?.pagination?.pages || 1);

function formatType(type: string) {
  const map: Record<string, string> = {
    small_group: 'Small Group',
    bible_study: 'Bible Study',
    committee: 'Committee',
    ministry: 'Ministry',
    team: 'Team',
    class: 'Class',
    custom: 'Other',
  };
  return map[type] || type;
}

useHead({
  title: 'Groups & Ministries',
  meta: [
    {
      name: 'description',
      content: 'Explore small groups, Bible studies, ministry teams, and more. Find your place in the community.',
    },
    { property: 'og:title', content: 'Groups & Ministries' },
    {
      property: 'og:description',
      content: 'Explore small groups, Bible studies, ministry teams, and more. Find your place in the community.',
    },
  ],
});
</script>

<style scoped>
.page-header {
  text-align: center;
  margin-bottom: 2rem;
}

.page-header h1 {
  font-size: 2rem;
  color: var(--oh-text);
  margin-bottom: 0.5rem;
}

.page-subtitle {
  color: var(--oh-muted);
  font-size: 1.1rem;
}

.filters {
  margin-bottom: 2rem;
}

.filter-row {
  display: flex;
  gap: 1rem;
  max-width: 300px;
}

.filter-group {
  flex: 1;
}

.filter-select {
  width: 100%;
  padding: 0.625rem 0.75rem;
  border: 1px solid var(--oh-border);
  border-radius: var(--oh-radius);
  font-size: 0.9375rem;
  background: var(--oh-bg);
  color: var(--oh-text);
}

.filter-select:focus {
  border-color: var(--oh-primary);
}

.loading,
.empty-state {
  text-align: center;
  padding: 3rem 0;
  color: var(--oh-muted);
}

.group-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(320px, 1fr));
  gap: 1.5rem;
}

.group-card {
  background: var(--oh-bg);
  border: 1px solid var(--oh-border);
  border-radius: var(--oh-radius);
  padding: 1.25rem;
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
}

.card-header {
  display: flex;
  align-items: center;
  gap: 0.5rem;
}

.type-badge {
  display: inline-block;
  padding: 0.2rem 0.6rem;
  border-radius: 9999px;
  font-size: 0.75rem;
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.025em;
}

.type-small_group { background: #d1fae5; color: #065f46; }
.type-bible_study { background: #dbeafe; color: #1e40af; }
.type-committee { background: #fef3c7; color: #92400e; }
.type-ministry { background: #ede9fe; color: #5b21b6; }
.type-team { background: #fce7f3; color: #9d174d; }
.type-class { background: #e0e7ff; color: #3730a3; }
.type-custom { background: var(--oh-surface); color: var(--oh-muted); }

.group-name {
  font-size: 1.125rem;
  font-weight: 700;
  color: var(--oh-text);
}

.group-description {
  font-size: 0.9375rem;
  color: var(--oh-text);
  line-height: 1.5;
}

.group-info {
  display: flex;
  flex-direction: column;
  gap: 0.25rem;
  margin-top: 0.25rem;
}

.info-row {
  font-size: 0.875rem;
  display: flex;
  gap: 0.375rem;
}

.info-label {
  font-weight: 600;
  color: var(--oh-text);
}

.info-value {
  color: var(--oh-muted);
}

.full-badge {
  display: inline-block;
  padding: 0.25rem 0.75rem;
  background: #fee2e2;
  color: #991b1b;
  border-radius: 9999px;
  font-size: 0.75rem;
  font-weight: 600;
  width: fit-content;
  margin-top: auto;
}

.almost-full-badge {
  display: inline-block;
  padding: 0.25rem 0.75rem;
  background: #fef3c7;
  color: #92400e;
  border-radius: 9999px;
  font-size: 0.75rem;
  font-weight: 600;
  width: fit-content;
  margin-top: auto;
}

.pagination {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 1rem;
  margin-top: 2rem;
  padding-top: 1.5rem;
  border-top: 1px solid var(--oh-border);
}

.page-btn {
  padding: 0.5rem 1rem;
  border: 1px solid var(--oh-border);
  border-radius: var(--oh-radius);
  background: var(--oh-bg);
  color: var(--oh-primary);
  font-weight: 500;
  cursor: pointer;
}

.page-btn:disabled {
  opacity: 0.4;
  cursor: not-allowed;
}

.page-btn:not(:disabled):hover {
  background: var(--oh-surface);
}

.page-info {
  font-size: 0.875rem;
  color: var(--oh-muted);
}

@media (max-width: 640px) {
  .group-grid {
    grid-template-columns: 1fr;
  }
}
</style>
