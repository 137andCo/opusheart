<script setup lang="ts">
defineProps<{
  /** Whether the off-canvas drawer is open (mobile only). */
  open?: boolean;
}>();

const emit = defineEmits<{
  /** Fired when a nav link is activated, so the layout can close the drawer. */
  (e: 'navigate'): void;
}>();

const authStore = useAuthStore();

interface NavItem {
  label: string;
  icon: string;
  to: string;
  feature?: string; // key in FeatureToggles, undefined = always show
  minRole?: string; // minimum role to see this item
}

// Ascending privilege. UI-only gating — the server enforces real authorization.
const ROLE_RANK: Record<string, number> = {
  visitor: 0, member: 1, leader: 2, pastor: 3, admin: 4,
};

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

const userRank = computed(() => ROLE_RANK[authStore.user?.role ?? 'visitor'] ?? 0);

const visibleNavItems = computed(() => {
  return allNavItems.filter((item) => {
    // Feature toggle check
    if (item.feature && authStore.features) {
      const key = item.feature as keyof typeof authStore.features;
      if (!authStore.features[key]) return false;
    }
    // Role check — hide items that require a higher role than the current user.
    if (item.minRole && userRank.value < (ROLE_RANK[item.minRole] ?? Infinity)) {
      return false;
    }
    return true;
  });
});
</script>

<template>
  <aside
    id="primary-sidebar"
    class="layout-sidebar"
    :class="{ open }"
    role="navigation"
    aria-label="Main navigation"
  >
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
        @click="emit('navigate')"
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
