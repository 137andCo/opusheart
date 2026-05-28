<template>
  <div class="resources-page">
    <header class="page-header">
      <h1 id="resources-heading">Community Resources</h1>
      <p class="page-subtitle">Find local services and support in our community directory.</p>
    </header>

    <section class="filters" aria-label="Filter resources">
      <div class="filter-row">
        <div class="filter-group">
          <label for="category-filter" class="sr-only">Filter by category</label>
          <select
            id="category-filter"
            v-model="selectedCategory"
            aria-label="Filter by category"
            class="filter-select"
          >
            <option value="">All Categories</option>
            <option v-for="cat in categories" :key="cat.value" :value="cat.value">
              {{ cat.label }}
            </option>
          </select>
        </div>
        <div class="filter-group">
          <label for="search-input" class="sr-only">Search resources</label>
          <input
            id="search-input"
            v-model="searchQuery"
            type="search"
            placeholder="Search resources..."
            aria-label="Search resources"
            class="filter-input"
            @input="onSearchInput"
          />
        </div>
      </div>
    </section>

    <div v-if="pending" class="loading" aria-live="polite">Loading resources...</div>

    <div v-else-if="resources.length === 0" class="empty-state" aria-live="polite">
      <p>No resources found matching your criteria.</p>
    </div>

    <section v-else aria-labelledby="resources-heading">
      <div class="resource-grid">
        <article
          v-for="resource in resources"
          :key="resource.id"
          class="resource-card"
        >
          <div class="card-header">
            <span class="category-badge" :class="'cat-' + resource.category">
              {{ formatCategory(resource.category) }}
            </span>
            <span v-if="resource.featured" class="featured-badge" aria-label="Featured resource">
              Featured
            </span>
          </div>
          <h2 class="resource-name">{{ resource.name }}</h2>
          <p class="resource-provider">{{ resource.provider }}</p>
          <p class="resource-description">{{ resource.description }}</p>

          <div v-if="resource.eligibility" class="resource-detail">
            <strong>Eligibility:</strong> {{ resource.eligibility }}
          </div>
          <div v-if="resource.hours" class="resource-detail">
            <strong>Hours:</strong> {{ resource.hours }}
          </div>

          <div v-if="resource.languages?.length" class="resource-languages">
            <span v-for="lang in resource.languages" :key="lang" class="lang-tag">
              {{ lang }}
            </span>
          </div>

          <div class="resource-contact">
            <a
              v-if="resource.phone"
              :href="'tel:' + resource.phone"
              class="contact-link"
              :aria-label="'Call ' + resource.name"
            >
              {{ resource.phone }}
            </a>
            <a
              v-if="resource.email"
              :href="'mailto:' + resource.email"
              class="contact-link"
              :aria-label="'Email ' + resource.name"
            >
              {{ resource.email }}
            </a>
            <a
              v-if="resource.website"
              :href="resource.website"
              target="_blank"
              rel="noopener noreferrer"
              class="contact-link"
              :aria-label="'Visit ' + resource.name + ' website'"
            >
              Website
            </a>
          </div>

          <div v-if="resource.address" class="resource-address">
            {{ formatAddress(resource.address) }}
          </div>
        </article>
      </div>

      <nav v-if="totalPages > 1" class="pagination" aria-label="Resource pages">
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

const selectedCategory = ref('');
const searchQuery = ref('');
const debouncedSearch = ref('');
const currentPage = ref(1);
let searchTimeout: ReturnType<typeof setTimeout>;

const categories = [
  { value: 'food', label: 'Food' },
  { value: 'housing', label: 'Housing' },
  { value: 'utilities', label: 'Utilities' },
  { value: 'medical', label: 'Medical' },
  { value: 'mental_health', label: 'Mental Health' },
  { value: 'employment', label: 'Employment' },
  { value: 'education', label: 'Education' },
  { value: 'legal', label: 'Legal' },
  { value: 'transportation', label: 'Transportation' },
  { value: 'clothing', label: 'Clothing' },
  { value: 'financial', label: 'Financial' },
  { value: 'childcare', label: 'Childcare' },
  { value: 'senior_services', label: 'Senior Services' },
  { value: 'disability', label: 'Disability' },
  { value: 'substance_abuse', label: 'Substance Abuse' },
  { value: 'domestic_violence', label: 'Domestic Violence' },
  { value: 'veterans', label: 'Veterans' },
  { value: 'other', label: 'Other' },
];

function onSearchInput() {
  clearTimeout(searchTimeout);
  searchTimeout = setTimeout(() => {
    debouncedSearch.value = searchQuery.value;
    currentPage.value = 1;
  }, 300);
}

watch(selectedCategory, () => {
  currentPage.value = 1;
});

const queryParams = computed(() => {
  const params: Record<string, string | number> = {
    page: currentPage.value,
    limit: 12,
  };
  if (selectedCategory.value) params.category = selectedCategory.value;
  if (debouncedSearch.value) params.search = debouncedSearch.value;
  return params;
});

const { data, pending } = await useFetch<{
  resources: any[];
  pagination: { total: number; page: number; limit: number; pages: number };
}>(`${config.public.apiBase}/resources/public`, {
  query: queryParams,
  watch: [queryParams],
  server: true,
});

const resources = computed(() => data.value?.resources || []);
const totalPages = computed(() => data.value?.pagination?.pages || 1);

function formatCategory(cat: string) {
  return cat
    .split('_')
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(' ');
}

function formatAddress(addr: any) {
  if (!addr) return '';
  const parts = [addr.street, addr.city, addr.state, addr.zip].filter(Boolean);
  return parts.join(', ');
}

useHead({
  title: 'Community Resources',
  meta: [
    {
      name: 'description',
      content: 'Browse local community resources including food, housing, medical, and support services.',
    },
    { property: 'og:title', content: 'Community Resources' },
    {
      property: 'og:description',
      content: 'Browse local community resources including food, housing, medical, and support services.',
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
  flex-wrap: wrap;
}

.filter-group {
  flex: 1;
  min-width: 200px;
}

.filter-select,
.filter-input {
  width: 100%;
  padding: 0.625rem 0.75rem;
  border: 1px solid var(--oh-border);
  border-radius: var(--oh-radius);
  font-size: 0.9375rem;
  background: var(--oh-bg);
  color: var(--oh-text);
}

.filter-select:focus,
.filter-input:focus {
  border-color: var(--oh-primary);
}

.loading,
.empty-state {
  text-align: center;
  padding: 3rem 0;
  color: var(--oh-muted);
}

.resource-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(340px, 1fr));
  gap: 1.5rem;
}

.resource-card {
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
  flex-wrap: wrap;
}

.category-badge {
  display: inline-block;
  padding: 0.2rem 0.6rem;
  border-radius: 9999px;
  font-size: 0.75rem;
  font-weight: 600;
  background: var(--oh-surface);
  color: var(--oh-primary);
  text-transform: uppercase;
  letter-spacing: 0.025em;
}

.featured-badge {
  display: inline-block;
  padding: 0.2rem 0.6rem;
  border-radius: 9999px;
  font-size: 0.75rem;
  font-weight: 600;
  background: var(--oh-secondary);
  color: white;
}

.resource-name {
  font-size: 1.125rem;
  font-weight: 700;
  color: var(--oh-text);
}

.resource-provider {
  font-size: 0.875rem;
  color: var(--oh-muted);
  font-weight: 500;
}

.resource-description {
  font-size: 0.9375rem;
  color: var(--oh-text);
  line-height: 1.5;
}

.resource-detail {
  font-size: 0.875rem;
  color: var(--oh-text);
}

.resource-languages {
  display: flex;
  gap: 0.375rem;
  flex-wrap: wrap;
}

.lang-tag {
  display: inline-block;
  padding: 0.125rem 0.5rem;
  border-radius: var(--oh-radius);
  background: var(--oh-surface);
  color: var(--oh-muted);
  font-size: 0.75rem;
}

.resource-contact {
  display: flex;
  gap: 1rem;
  flex-wrap: wrap;
  margin-top: 0.25rem;
}

.contact-link {
  font-size: 0.875rem;
  font-weight: 500;
}

.resource-address {
  font-size: 0.8125rem;
  color: var(--oh-muted);
  margin-top: auto;
  padding-top: 0.5rem;
  border-top: 1px solid var(--oh-border);
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
  .resource-grid {
    grid-template-columns: 1fr;
  }
}
</style>
