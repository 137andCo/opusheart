<template>
  <div class="home-page">
    <template v-if="page">
      <section class="page-content">
        <div v-for="(block, i) in page.content" :key="i" class="content-block">
          <template v-if="block.type === 'hero'">
            <section class="oh-hero" :class="`align-${block.align || 'left'}`">
              <p v-if="block.eyebrow" class="oh-hero-eyebrow">{{ block.eyebrow }}</p>
              <h2 class="oh-hero-heading">{{ block.heading }}</h2>
              <p v-if="block.subheading" class="oh-hero-sub">{{ block.subheading }}</p>
              <a v-if="block.ctaLabel && ctaHref(block.ctaHref)" :href="ctaHref(block.ctaHref)!" class="oh-hero-cta">{{ block.ctaLabel }}</a>
            </section>
          </template>
          <template v-else-if="isHeading(block)">
            <component :is="'h' + (block.level || 2)">{{ block.text }}</component>
          </template>
          <template v-else-if="isParagraph(block)">
            <p v-html="block.text" />
          </template>
          <template v-else-if="isImage(block)">
            <figure>
              <img :src="block.src" :alt="block.alt || ''" loading="lazy" />
              <figcaption v-if="block.caption">{{ block.caption }}</figcaption>
            </figure>
          </template>
          <template v-else-if="isHtml(block)">
            <div v-html="block.html" />
          </template>
          <template v-else>
            <div v-if="block.text" v-html="block.text" />
          </template>
        </div>
      </section>
    </template>

    <template v-else-if="!pending">
      <section class="welcome-hero" aria-labelledby="welcome-heading">
        <h1 id="welcome-heading">Welcome to Our Community</h1>
        <p class="hero-subtitle">We're glad you're here. Explore our events, groups, and resources.</p>
        <div class="hero-actions">
          <NuxtLink to="/events" class="btn btn-primary">Upcoming Events</NuxtLink>
          <NuxtLink to="/groups" class="btn btn-secondary">Find a Group</NuxtLink>
          <NuxtLink to="/resources" class="btn btn-outline">Resources</NuxtLink>
        </div>
      </section>
    </template>
  </div>
</template>

<script setup lang="ts">
import { safeBlockHref } from '@opusheart/builder';

const config = useRuntimeConfig();

const { data, pending } = await useFetch<{ page: any }>(
  `${config.public.apiBase}/pages/slug/home`,
  { server: true }
);

const page = computed(() => data.value?.page);

// Safe-href validation lives in @opusheart/builder (shared with the editor + server).
const ctaHref = safeBlockHref;

function isHeading(block: any) {
  return block.type === 'heading';
}
function isParagraph(block: any) {
  return block.type === 'paragraph' || block.type === 'text';
}
function isImage(block: any) {
  return block.type === 'image';
}
function isHtml(block: any) {
  return block.type === 'html';
}

useHead({
  title: page.value?.seo?.title || page.value?.title || 'Home',
  meta: [
    {
      name: 'description',
      content: page.value?.seo?.description || 'Welcome to our community',
    },
    {
      property: 'og:title',
      content: page.value?.seo?.title || page.value?.title || 'Home',
    },
    {
      property: 'og:description',
      content: page.value?.seo?.description || 'Welcome to our community',
    },
    ...(page.value?.seo?.ogImage
      ? [{ property: 'og:image', content: page.value.seo.ogImage }]
      : []),
    ...(page.value?.seo?.noIndex ? [{ name: 'robots', content: 'noindex' }] : []),
  ],
});
</script>

<style scoped>
.welcome-hero {
  text-align: center;
  padding: 4rem 0;
}

.welcome-hero h1 {
  font-size: 2.5rem;
  color: var(--oh-primary);
  margin-bottom: 1rem;
}

.hero-subtitle {
  font-size: 1.25rem;
  color: var(--oh-muted);
  margin-bottom: 2rem;
  max-width: 600px;
  margin-left: auto;
  margin-right: auto;
}

.hero-actions {
  display: flex;
  gap: 1rem;
  justify-content: center;
  flex-wrap: wrap;
}

.btn {
  display: inline-block;
  padding: 0.75rem 1.5rem;
  border-radius: var(--oh-radius);
  font-weight: 600;
  text-decoration: none;
  transition: opacity 0.15s;
}

.btn:hover {
  text-decoration: none;
  opacity: 0.9;
}

.btn-primary {
  background: var(--oh-primary);
  color: white;
}

.btn-secondary {
  /* Track the admin-configured secondary, but darken it enough that white text
     clears WCAG AA (plain sage is too light at ~4.25:1). Older engines without
     color-mix fall back to the AA-safe deep sage token. */
  background: var(--oh-secondary-strong);
  background: color-mix(in oklab, var(--oh-secondary) 80%, #000);
  color: #fff;
}

.btn-outline {
  border: 2px solid var(--oh-primary);
  color: var(--oh-primary);
}

.page-content {
  max-width: 800px;
  margin: 0 auto;
}

.content-block {
  margin-bottom: 1.5rem;
}

.content-block h1,
.content-block h2,
.content-block h3 {
  margin-bottom: 0.75rem;
  color: var(--oh-text);
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

@media (max-width: 640px) {
  .welcome-hero h1 {
    font-size: 1.75rem;
  }

  .hero-subtitle {
    font-size: 1rem;
  }
}
</style>
