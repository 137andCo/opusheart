<template>
  <div class="prayer-page">
    <header class="page-header">
      <h1 id="prayer-heading">Prayer Wall</h1>
      <p class="page-subtitle">Lift up your community in prayer.</p>
    </header>

    <div class="filters">
      <label for="category-filter" class="sr-only">Filter by category</label>
      <select
        id="category-filter"
        v-model="selectedCategory"
        class="filter-select"
        aria-label="Filter prayer requests by category"
      >
        <option value="">All Categories</option>
        <option value="health">Health</option>
        <option value="family">Family</option>
        <option value="financial">Financial</option>
        <option value="spiritual">Spiritual Growth</option>
        <option value="grief">Grief &amp; Loss</option>
        <option value="gratitude">Gratitude</option>
        <option value="other">Other</option>
      </select>
    </div>

    <div v-if="pending" class="loading" aria-live="polite">Loading prayer requests...</div>

    <div v-else-if="requests.length === 0" class="empty-state" aria-live="polite">
      <p>No prayer requests at this time. Check back soon!</p>
    </div>

    <section v-else aria-labelledby="prayer-heading">
      <p class="sr-only" aria-live="polite">{{ resultStatus }}</p>
      <ul class="prayer-grid" role="list">
        <li v-for="request in requests" :key="request.id" class="prayer-card">
          <article>
            <span v-if="request.category" class="category-badge">{{ request.category }}</span>
            <p class="prayer-content">{{ request.content }}</p>
            <div class="prayer-meta">
              <span class="prayer-count">
                <span class="pray-icon" aria-hidden="true">&#x1F64F;</span>
                {{ request.prayerCount || 0 }} {{ request.prayerCount === 1 ? 'prayer' : 'prayers' }}
              </span>
            </div>
          </article>
        </li>
      </ul>

      <nav v-if="totalPages > 1" class="pagination" aria-label="Prayer wall pages">
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
const currentPage = ref(1);
const selectedCategory = ref('');

const queryParams = computed(() => {
  const params: Record<string, any> = {
    page: currentPage.value,
    limit: 20,
  };
  if (selectedCategory.value) {
    params.category = selectedCategory.value;
  }
  return params;
});

watch(selectedCategory, () => {
  currentPage.value = 1;
});

const { data, pending } = await useFetch<{
  requests: any[];
  total: number;
  page: number;
  totalPages: number;
}>(`${config.public.apiBase}/prayer/wall`, {
  query: queryParams,
  watch: [queryParams],
  server: true,
});

const requests = computed(() => data.value?.requests || []);
const totalPages = computed(() => data.value?.totalPages || 1);

const resultStatus = computed(() => {
  if (pending.value) return 'Loading…';
  if (requests.value.length === 0) return 'No results found.';
  return `${requests.value.length} result(s)`;
});

useHead({
  title: 'Prayer Wall',
  meta: [
    {
      name: 'description',
      content: 'Lift up your community in prayer. View and support prayer requests from our congregation.',
    },
    { property: 'og:title', content: 'Prayer Wall' },
    {
      property: 'og:description',
      content: 'Lift up your community in prayer. View and support prayer requests from our congregation.',
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
  margin-bottom: 1rem;
}

.sr-only {
  position: absolute;
  width: 1px;
  height: 1px;
  padding: 0;
  margin: -1px;
  overflow: hidden;
  clip: rect(0, 0, 0, 0);
  white-space: nowrap;
  border: 0;
}

.filters {
  display: flex;
  justify-content: center;
  margin-bottom: 1.5rem;
}

.filter-select {
  padding: 0.5rem 1rem;
  border: 1px solid var(--oh-border);
  border-radius: var(--oh-radius);
  background: var(--oh-bg);
  color: var(--oh-text);
  font-size: 0.875rem;
  cursor: pointer;
}

.loading,
.empty-state {
  text-align: center;
  padding: 3rem 0;
  color: var(--oh-muted);
}

.prayer-grid {
  list-style: none;
  padding: 0;
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(280px, 1fr));
  gap: 1.25rem;
}

.prayer-card {
  border: 1px solid var(--oh-border);
  border-radius: var(--oh-radius);
  padding: 1.25rem;
  display: flex;
  flex-direction: column;
}

.category-badge {
  display: inline-block;
  padding: 0.2rem 0.6rem;
  border-radius: 9999px;
  font-size: 0.75rem;
  font-weight: 600;
  background: #dbeafe;
  color: #1e40af;
  text-transform: capitalize;
  margin-bottom: 0.75rem;
  align-self: flex-start;
}

.prayer-content {
  font-size: 0.9375rem;
  color: var(--oh-text);
  line-height: 1.6;
  flex: 1;
  margin-bottom: 0.75rem;
}

.prayer-meta {
  display: flex;
  align-items: center;
  justify-content: flex-end;
  padding-top: 0.5rem;
  border-top: 1px solid var(--oh-border);
}

.prayer-count {
  font-size: 0.8125rem;
  color: var(--oh-muted);
  display: flex;
  align-items: center;
  gap: 0.25rem;
}

.pray-icon {
  font-size: 1rem;
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
  .prayer-grid {
    grid-template-columns: 1fr;
  }
}
</style>
