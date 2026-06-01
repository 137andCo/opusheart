<template>
  <div class="sermon-detail-page">
    <div v-if="pending" class="loading" aria-live="polite">Loading sermon...</div>

    <div v-else-if="!sermon" class="empty-state" aria-live="polite">
      <p>Sermon not found.</p>
      <NuxtLink to="/sermons" class="back-link">Back to Sermons</NuxtLink>
    </div>

    <article v-else>
      <NuxtLink to="/sermons" class="back-link" aria-label="Back to sermon list">
        &larr; Back to Sermons
      </NuxtLink>

      <header class="sermon-header">
        <h1 id="sermon-title">{{ sermon.title }}</h1>
        <div class="sermon-meta">
          <span v-if="sermon.speaker" class="sermon-speaker">{{ sermon.speaker }}</span>
          <time v-if="sermon.date" :datetime="sermon.date" class="sermon-date">
            {{ formatDate(sermon.date) }}
          </time>
        </div>

        <div v-if="sermon.scriptureReferences?.length" class="scripture-refs">
          <span
            v-for="ref in sermon.scriptureReferences"
            :key="ref"
            class="scripture-badge"
          >
            {{ ref }}
          </span>
        </div>
      </header>

      <p v-if="sermon.description" class="sermon-description">{{ sermon.description }}</p>

      <div v-if="sermon.audioUrl" class="media-section">
        <h2 class="section-heading">Listen</h2>
        <audio
          :src="sermon.audioUrl"
          controls
          preload="none"
          class="sermon-audio"
          :aria-label="`Listen to ${sermon.title}`"
        />
      </div>

      <div v-if="sermon.videoUrl" class="media-section">
        <h2 class="section-heading">Watch</h2>
        <div v-if="videoEmbedUrl" class="video-embed">
          <iframe
            :src="videoEmbedUrl"
            frameborder="0"
            allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
            allowfullscreen
            :title="`Video: ${sermon.title}`"
          />
        </div>
        <a
          v-else
          :href="sermon.videoUrl"
          target="_blank"
          rel="noopener noreferrer"
          class="video-link"
        >
          Watch Video<span class="sr-only"> (opens in new tab)</span>
        </a>
      </div>

      <div v-if="sermon.notes" class="content-section">
        <h2 class="section-heading">Notes</h2>
        <div class="section-body" v-html="sermon.notes" />
      </div>

      <div v-if="sermon.outline" class="content-section">
        <h2 class="section-heading">Outline</h2>
        <div class="section-body" v-html="sermon.outline" />
      </div>
    </article>
  </div>
</template>

<script setup lang="ts">
const config = useRuntimeConfig();
const route = useRoute();

const { data, pending } = await useFetch<{
  sermon: any;
}>(`${config.public.apiBase}/sermons/public/${route.params.id}`, {
  server: true,
});

const sermon = computed(() => data.value?.sermon || null);

const videoEmbedUrl = computed(() => {
  const url = sermon.value?.videoUrl;
  if (!url) return null;

  // YouTube
  const ytMatch = url.match(/(?:youtube\.com\/watch\?v=|youtu\.be\/)([\w-]+)/);
  if (ytMatch) return `https://www.youtube.com/embed/${ytMatch[1]}`;

  // Vimeo
  const vimeoMatch = url.match(/vimeo\.com\/(\d+)/);
  if (vimeoMatch) return `https://player.vimeo.com/video/${vimeoMatch[1]}`;

  return null;
});

function formatDate(d: string | Date) {
  return new Date(d).toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });
}

watchEffect(() => {
  if (sermon.value) {
    useHead({
      title: sermon.value.title,
      meta: [
        {
          name: 'description',
          content: sermon.value.description || `Sermon: ${sermon.value.title}`,
        },
        { property: 'og:title', content: sermon.value.title },
        {
          property: 'og:description',
          content: sermon.value.description || `Sermon: ${sermon.value.title}`,
        },
      ],
    });
  }
});
</script>

<style scoped>
.sermon-detail-page {
  max-width: 800px;
  margin: 0 auto;
}

.back-link {
  display: inline-block;
  margin-bottom: 1.5rem;
  font-size: 0.875rem;
  font-weight: 500;
  color: var(--oh-primary);
  text-decoration: none;
}

.back-link:hover {
  text-decoration: underline;
}

.loading,
.empty-state {
  text-align: center;
  padding: 3rem 0;
  color: var(--oh-muted);
}

.sermon-header {
  margin-bottom: 1.5rem;
}

.sermon-header h1 {
  font-size: 2rem;
  color: var(--oh-text);
  margin-bottom: 0.5rem;
}

.sermon-meta {
  display: flex;
  align-items: center;
  gap: 0.75rem;
  font-size: 0.9375rem;
  color: var(--oh-muted);
  margin-bottom: 0.75rem;
}

.sermon-speaker {
  font-weight: 600;
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
  background: var(--oh-tag-2-bg);
  color: var(--oh-tag-2-fg);
}

.sermon-description {
  font-size: 1rem;
  color: var(--oh-text);
  line-height: 1.7;
  margin-bottom: 1.5rem;
}

.section-heading {
  font-size: 1.25rem;
  font-weight: 700;
  color: var(--oh-text);
  margin-bottom: 0.75rem;
}

.media-section {
  margin-bottom: 2rem;
}

.sermon-audio {
  width: 100%;
  height: 48px;
}

.video-embed {
  position: relative;
  width: 100%;
  padding-bottom: 56.25%;
  height: 0;
  overflow: hidden;
  border-radius: var(--oh-radius);
}

.video-embed iframe {
  position: absolute;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
}

.video-link {
  display: inline-block;
  padding: 0.5rem 1rem;
  border: 1px solid var(--oh-primary);
  border-radius: var(--oh-radius);
  font-weight: 500;
  font-size: 0.875rem;
  color: var(--oh-primary);
  text-decoration: none;
}

.video-link:hover {
  background: var(--oh-surface);
}

.content-section {
  margin-bottom: 2rem;
  padding: 1.25rem;
  border: 1px solid var(--oh-border);
  border-radius: var(--oh-radius);
}

.section-body {
  font-size: 0.9375rem;
  color: var(--oh-text);
  line-height: 1.7;
}

@media (max-width: 640px) {
  .sermon-header h1 {
    font-size: 1.5rem;
  }

  .sermon-meta {
    flex-direction: column;
    align-items: flex-start;
    gap: 0.25rem;
  }
}
</style>
