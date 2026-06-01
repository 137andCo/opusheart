<template>
  <div class="sermons-page">
    <header class="page-header">
      <h1 id="sermons-heading">Sermons</h1>
      <p class="page-subtitle">Listen, watch, and grow in faith with our sermon archive.</p>
      <a
        :href="`${config.public.apiBase}/sermons/podcast.xml`"
        class="podcast-link"
        aria-label="Subscribe to sermon podcast RSS feed"
      >
        Subscribe to Podcast (RSS)
      </a>
    </header>

    <div class="filters">
      <div class="filter-group">
        <label for="series-filter" class="sr-only">Filter by series</label>
        <select
          id="series-filter"
          v-model="selectedSeries"
          class="filter-select"
          aria-label="Filter sermons by series"
        >
          <option value="">All Series</option>
          <option v-for="s in seriesList" :key="s.id" :value="s.id">{{ s.title }}</option>
        </select>
      </div>

      <div class="filter-group">
        <label for="speaker-search" class="sr-only">Search by speaker</label>
        <input
          id="speaker-search"
          v-model="speakerQuery"
          type="search"
          class="filter-input"
          placeholder="Search by speaker..."
          aria-label="Search sermons by speaker name"
        />
      </div>
    </div>

    <div v-if="pending" class="loading" aria-live="polite">Loading sermons...</div>

    <div v-else-if="sermons.length === 0" class="empty-state" aria-live="polite">
      <p>No sermons found. Check back soon!</p>
    </div>

    <section v-else aria-labelledby="sermons-heading">
      <p class="sr-only" aria-live="polite">{{ resultStatus }}</p>
      <ul class="sermon-list" role="list">
        <li v-for="sermon in sermons" :key="sermon.id" class="sermon-item">
          <article class="sermon-details">
            <h2 class="sermon-title">
              <NuxtLink :to="`/sermons/${sermon.id}`">{{ sermon.title }}</NuxtLink>
            </h2>

            <div class="sermon-meta">
              <span v-if="sermon.speaker" class="sermon-speaker">{{ sermon.speaker }}</span>
              <time v-if="sermon.date" :datetime="sermon.date" class="sermon-date">
                {{ formatDate(sermon.date) }}
              </time>
            </div>

            <p v-if="sermon.description" class="sermon-description">{{ sermon.description }}</p>

            <div v-if="sermon.scriptureReferences?.length" class="scripture-refs">
              <span
                v-for="ref in sermon.scriptureReferences"
                :key="ref"
                class="scripture-badge"
              >
                {{ ref }}
              </span>
            </div>

            <div class="sermon-media">
              <audio
                v-if="sermon.audioUrl"
                :src="sermon.audioUrl"
                controls
                preload="none"
                class="sermon-audio"
                :aria-label="`Listen to ${sermon.title}`"
              />
              <a
                v-if="sermon.videoUrl"
                :href="sermon.videoUrl"
                target="_blank"
                rel="noopener noreferrer"
                class="video-link"
                :aria-label="`Watch video for ${sermon.title} (opens in new tab)`"
              >
                Watch Video
              </a>
            </div>
          </article>
        </li>
      </ul>

      <nav v-if="totalPages > 1" class="pagination" aria-label="Sermon pages">
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
const selectedSeries = ref('');
const speakerQuery = ref('');

const queryParams = computed(() => {
  const params: Record<string, any> = {
    page: currentPage.value,
    limit: 20,
  };
  if (selectedSeries.value) {
    params.series = selectedSeries.value;
  }
  if (speakerQuery.value.trim()) {
    params.speaker = speakerQuery.value.trim();
  }
  return params;
});

watch([selectedSeries, speakerQuery], () => {
  currentPage.value = 1;
});

const { data: seriesData } = await useFetch<{
  series: any[];
}>(`${config.public.apiBase}/sermons/public/series`, {
  server: true,
});

const seriesList = computed(() => seriesData.value?.series || []);

const { data, pending } = await useFetch<{
  sermons: any[];
  total: number;
  page: number;
  totalPages: number;
}>(`${config.public.apiBase}/sermons/public`, {
  query: queryParams,
  watch: [queryParams],
  server: true,
});

const sermons = computed(() => data.value?.sermons || []);
const totalPages = computed(() => data.value?.totalPages || 1);

const resultStatus = computed(() => {
  if (pending.value) return 'Loading…';
  if (sermons.value.length === 0) return 'No results found.';
  return `${sermons.value.length} result(s)`;
});

function formatDate(d: string | Date) {
  return new Date(d).toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });
}

useHead({
  title: 'Sermons',
  meta: [
    {
      name: 'description',
      content: 'Browse our sermon archive. Listen to audio, watch video, and explore sermon series.',
    },
    { property: 'og:title', content: 'Sermons' },
    {
      property: 'og:description',
      content: 'Browse our sermon archive. Listen to audio, watch video, and explore sermon series.',
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

.podcast-link {
  display: inline-block;
  padding: 0.5rem 1.25rem;
  border: 1px solid var(--oh-primary);
  border-radius: var(--oh-radius);
  font-weight: 500;
  font-size: 0.875rem;
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
  gap: 1rem;
  margin-bottom: 1.5rem;
  flex-wrap: wrap;
}

.filter-select,
.filter-input {
  padding: 0.5rem 1rem;
  border: 1px solid var(--oh-border);
  border-radius: var(--oh-radius);
  background: var(--oh-bg);
  color: var(--oh-text);
  font-size: 0.875rem;
}

.filter-input {
  min-width: 200px;
}

.loading,
.empty-state {
  text-align: center;
  padding: 3rem 0;
  color: var(--oh-muted);
}

.sermon-list {
  list-style: none;
  padding: 0;
  display: flex;
  flex-direction: column;
  gap: 1.25rem;
}

.sermon-item {
  border: 1px solid var(--oh-border);
  border-radius: var(--oh-radius);
  padding: 1.25rem;
}

.sermon-details {
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
}

.sermon-title {
  font-size: 1.125rem;
  font-weight: 700;
}

.sermon-title a {
  color: var(--oh-text);
  text-decoration: none;
}

.sermon-title a:hover {
  color: var(--oh-primary);
}

.sermon-meta {
  display: flex;
  align-items: center;
  gap: 0.75rem;
  font-size: 0.875rem;
  color: var(--oh-muted);
}

.sermon-speaker {
  font-weight: 600;
}

.sermon-description {
  font-size: 0.9375rem;
  color: var(--oh-text);
  line-height: 1.5;
}

.scripture-refs {
  display: flex;
  gap: 0.5rem;
  flex-wrap: wrap;
}

.scripture-badge {
  display: inline-block;
  padding: 0.2rem 0.6rem;
  border-radius: 9999px;
  font-size: 0.75rem;
  font-weight: 600;
  background: #d1fae5;
  color: #065f46;
}

.sermon-media {
  display: flex;
  align-items: center;
  gap: 1rem;
  flex-wrap: wrap;
  margin-top: 0.25rem;
}

.sermon-audio {
  width: 100%;
  max-width: 400px;
  height: 40px;
}

.video-link {
  display: inline-block;
  padding: 0.375rem 0.75rem;
  border: 1px solid var(--oh-primary);
  border-radius: var(--oh-radius);
  font-size: 0.8125rem;
  font-weight: 500;
  color: var(--oh-primary);
  text-decoration: none;
}

.video-link:hover {
  background: var(--oh-surface);
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
  .filters {
    flex-direction: column;
    align-items: stretch;
  }

  .filter-input {
    min-width: auto;
  }

  .sermon-audio {
    max-width: 100%;
  }
}
</style>
