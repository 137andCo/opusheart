<script setup lang="ts">
const authStore = useAuthStore();

interface NavItem {
  label: string;
  icon: string;
  to: string;
  feature?: string; // key in FeatureToggles, undefined = always show
  minRole?: string; // minimum role to see this item
}

const allNavItems: NavItem[] = [
  { label: 'Dashboard', icon: 'pi pi-home', to: '/' },
  { label: 'Members', icon: 'pi pi-users', to: '/members' },
  { label: 'Pages', icon: 'pi pi-file', to: '/pages' },
  { label: 'Resources', icon: 'pi pi-map', to: '/resources', feature: 'resourceHub' },
  { label: 'Events', icon: 'pi pi-calendar', to: '/events' },
  { label: 'Groups', icon: 'pi pi-sitemap', to: '/groups', feature: 'groups' },
  { label: 'Sermons', icon: 'pi pi-book', to: '/sermons', feature: 'sermons' },
  { label: 'Households', icon: 'pi pi-building', to: '/households' },
  { label: 'Care Notes', icon: 'pi pi-heart-fill', to: '/care', feature: 'memberCare' },
  { label: 'Bookings', icon: 'pi pi-clock', to: '/bookings' },
  { label: 'Communication', icon: 'pi pi-envelope', to: '/communication' },
  { label: 'Giving', icon: 'pi pi-heart', to: '/giving', feature: 'giving' },
  { label: 'Settings', icon: 'pi pi-cog', to: '/settings', minRole: 'admin' },
];

const visibleNavItems = computed(() => {
  return allNavItems.filter((item) => {
    // Feature toggle check
    if (item.feature && authStore.features) {
      const key = item.feature as keyof typeof authStore.features;
      if (!authStore.features[key]) return false;
    }
    // TODO: role check once ROLE_HIERARCHY is wired
    return true;
  });
});
</script>

<template>
  <aside class="layout-sidebar" role="navigation" aria-label="Main navigation">
    <div class="sidebar-header">
      <h2>OpusHeart</h2>
    </div>
    <nav class="sidebar-nav" aria-label="Primary">
      <NuxtLink
        v-for="item in visibleNavItems"
        :key="item.to"
        :to="item.to"
        class="nav-item"
        active-class="nav-item-active"
      >
        <i :class="item.icon" aria-hidden="true" />
        <span>{{ item.label }}</span>
      </NuxtLink>
    </nav>
    <div class="sidebar-footer">
      <div v-if="authStore.user" class="user-info">
        <i class="pi pi-user" aria-hidden="true" />
        <span>{{ authStore.user.firstName }} {{ authStore.user.lastName }}</span>
      </div>
      <Button
        label="Logout"
        icon="pi pi-sign-out"
        severity="secondary"
        text
        class="logout-btn"
        aria-label="Sign out"
        @click="async () => { await authStore.logout(); await navigateTo('/login'); }"
      />
    </div>
  </aside>
</template>
