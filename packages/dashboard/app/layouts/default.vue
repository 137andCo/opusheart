<script setup lang="ts">
const sidebarOpen = ref(false);
const route = useRoute();
const toggleRef = ref<HTMLButtonElement | null>(null);

// Close the drawer whenever the route changes (e.g. after tapping a nav link).
watch(() => route.fullPath, () => {
  sidebarOpen.value = false;
});

function closeSidebar() {
  sidebarOpen.value = false;
}

function onKeydown(e: KeyboardEvent) {
  if (e.key === 'Escape' && sidebarOpen.value) {
    sidebarOpen.value = false;
    toggleRef.value?.focus();
  }
}

// Move focus into the drawer when it opens so keyboard users land on the nav.
watch(sidebarOpen, async (open) => {
  if (!open) return;
  await nextTick();
  document.querySelector<HTMLElement>('.layout-sidebar .nav-item')?.focus();
});

onMounted(() => window.addEventListener('keydown', onKeydown));
onBeforeUnmount(() => window.removeEventListener('keydown', onKeydown));
</script>

<template>
  <div>
    <a href="#main-content" class="skip-to-content">Skip to content</a>

    <header class="mobile-topbar">
      <button
        ref="toggleRef"
        type="button"
        class="sidebar-toggle"
        :aria-expanded="sidebarOpen"
        aria-controls="primary-sidebar"
        aria-label="Toggle navigation menu"
        @click="sidebarOpen = !sidebarOpen"
      >
        <i class="pi pi-bars" aria-hidden="true" />
      </button>
      <span class="mobile-brand">OpusHeart</span>
    </header>

    <div class="layout-wrapper">
      <div
        v-if="sidebarOpen"
        class="sidebar-backdrop"
        aria-hidden="true"
        @click="closeSidebar"
      />
      <LayoutSidebar :open="sidebarOpen" @navigate="closeSidebar" />
      <main id="main-content" class="layout-main" role="main">
        <slot />
      </main>
    </div>
  </div>
</template>
