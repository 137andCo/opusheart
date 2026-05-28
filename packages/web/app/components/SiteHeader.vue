<template>
  <header class="site-header" role="banner">
    <div class="container header-inner">
      <NuxtLink to="/" class="site-logo" aria-label="Home">
        <span class="site-name">{{ siteName }}</span>
      </NuxtLink>
      <button
        class="nav-toggle"
        :aria-expanded="menuOpen"
        aria-controls="main-nav"
        aria-label="Toggle navigation menu"
        @click="menuOpen = !menuOpen"
      >
        <span class="nav-toggle-bar" />
        <span class="nav-toggle-bar" />
        <span class="nav-toggle-bar" />
      </button>
      <nav id="main-nav" aria-label="Main navigation" class="main-nav" :class="{ open: menuOpen }">
        <ul>
          <li><NuxtLink to="/events" @click="menuOpen = false">Events</NuxtLink></li>
          <li><NuxtLink to="/sermons" @click="menuOpen = false">Sermons</NuxtLink></li>
          <li><NuxtLink to="/prayer" @click="menuOpen = false">Prayer</NuxtLink></li>
          <li><NuxtLink to="/groups" @click="menuOpen = false">Groups</NuxtLink></li>
          <li><NuxtLink to="/resources" @click="menuOpen = false">Resources</NuxtLink></li>
        </ul>
      </nav>
    </div>
  </header>
</template>

<script setup lang="ts">
const siteName = useState('siteName', () => 'Our Community');
const menuOpen = ref(false);
</script>

<style scoped>
.site-header {
  border-bottom: 1px solid var(--oh-border);
  padding: 1rem 0;
}

.header-inner {
  display: flex;
  align-items: center;
  justify-content: space-between;
  flex-wrap: wrap;
}

.site-logo {
  font-size: 1.25rem;
  font-weight: 700;
  color: var(--oh-primary);
  text-decoration: none;
}

.site-logo:hover {
  text-decoration: none;
}

.nav-toggle {
  display: none;
  flex-direction: column;
  gap: 4px;
  background: none;
  border: none;
  cursor: pointer;
  padding: 0.5rem;
}

.nav-toggle-bar {
  display: block;
  width: 24px;
  height: 2px;
  background: var(--oh-text);
  border-radius: 1px;
  transition: transform 0.2s;
}

.main-nav ul {
  display: flex;
  list-style: none;
  gap: 1.5rem;
  padding: 0;
}

.main-nav a {
  color: var(--oh-text);
  font-weight: 500;
  text-decoration: none;
}

.main-nav a:hover,
.main-nav a.router-link-active {
  color: var(--oh-primary);
}

@media (max-width: 640px) {
  .nav-toggle {
    display: flex;
  }

  .main-nav {
    display: none;
    width: 100%;
    padding-top: 0.75rem;
  }

  .main-nav.open {
    display: block;
  }

  .main-nav ul {
    flex-direction: column;
    gap: 0.5rem;
  }

  .main-nav a {
    display: block;
    padding: 0.5rem 0;
  }
}
</style>
