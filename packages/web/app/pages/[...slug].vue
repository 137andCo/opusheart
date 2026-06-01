<template>
  <div class="dynamic-page">
    <template v-if="error">
      <section class="not-found" aria-labelledby="not-found-heading">
        <h1 id="not-found-heading">Page Not Found</h1>
        <p>Sorry, we couldn't find the page you're looking for.</p>
        <NuxtLink to="/" class="back-link">Return to Home</NuxtLink>
      </section>
    </template>

    <template v-else-if="page">
      <article class="page-content">
        <h1 class="page-title">{{ page.title }}</h1>
        <div v-for="(block, i) in page.content" :key="i" class="content-block">
          <template v-if="block.type === 'heading'">
            <component :is="`h${Math.min(Math.max(block.level || 2, 2), 4)}`">{{ block.text }}</component>
          </template>
          <template v-else-if="block.type === 'paragraph' || block.type === 'text'">
            <p v-html="block.text" />
          </template>
          <template v-else-if="block.type === 'image'">
            <figure>
              <img :src="block.src" :alt="block.alt || ''" loading="lazy" />
              <figcaption v-if="block.caption">{{ block.caption }}</figcaption>
            </figure>
          </template>
          <template v-else-if="block.type === 'html'">
            <div v-html="block.html" />
          </template>
          <template v-else>
            <div v-if="block.text" v-html="block.text" />
          </template>
        </div>
      </article>
    </template>
  </div>
</template>

<script setup lang="ts">
const route = useRoute();
const config = useRuntimeConfig();

const slug = computed(() => {
  const parts = route.params.slug;
  return Array.isArray(parts) ? parts.join('/') : parts;
});

const { data, error } = await useFetch<{ page: any }>(
  () => `${config.public.apiBase}/pages/slug/${slug.value}`,
  { server: true }
);

const page = computed(() => data.value?.page);

useHead({
  title: page.value?.seo?.title || page.value?.title || 'Page',
  meta: [
    {
      name: 'description',
      content: page.value?.seo?.description || '',
    },
    {
      property: 'og:title',
      content: page.value?.seo?.title || page.value?.title || 'Page',
    },
    {
      property: 'og:description',
      content: page.value?.seo?.description || '',
    },
    ...(page.value?.seo?.ogImage
      ? [{ property: 'og:image', content: page.value.seo.ogImage }]
      : []),
    ...(page.value?.seo?.noIndex ? [{ name: 'robots', content: 'noindex' }] : []),
  ],
});

if (error.value) {
  showError({ statusCode: 404, statusMessage: 'Page not found' });
}
</script>

<style scoped>
.page-content {
  max-width: 800px;
  margin: 0 auto;
}

.page-title {
  font-size: 2rem;
  margin-bottom: 1.5rem;
  color: var(--oh-text);
}

.content-block {
  margin-bottom: 1.5rem;
}

.content-block h2,
.content-block h3,
.content-block h4 {
  margin-bottom: 0.75rem;
}

.content-block figure {
  margin: 1.5rem 0;
}

.content-block img {
  border-radius: var(--oh-radius);
}

.content-block figcaption {
  text-align: center;
  color: var(--oh-muted);
  font-size: 0.875rem;
  margin-top: 0.5rem;
}

.not-found {
  text-align: center;
  padding: 4rem 0;
}

.not-found h1 {
  font-size: 2rem;
  color: var(--oh-text);
  margin-bottom: 1rem;
}

.not-found p {
  color: var(--oh-muted);
  margin-bottom: 1.5rem;
}

.back-link {
  font-weight: 600;
}
</style>
