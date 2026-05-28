<template>
  <div class="site-wrapper">
    <a href="#main-content" class="skip-to-content">Skip to content</a>
    <SiteHeader />
    <main id="main-content" role="main" class="container site-main">
      <slot />
    </main>
    <SiteFooter />
  </div>
</template>

<script setup lang="ts">
const { loadTheme } = useTheme();
onMounted(() => {
  loadTheme();
});
</script>

<style scoped>
.site-wrapper {
  display: flex;
  flex-direction: column;
  min-height: 100vh;
}

.site-main {
  flex: 1;
  padding-top: 2rem;
  padding-bottom: 2rem;
}
</style>
