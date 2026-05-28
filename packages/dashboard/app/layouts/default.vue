<template>
  <div>
    <a href="#main-content" class="skip-to-content">Skip to content</a>
    <div class="layout-wrapper">
      <LayoutSidebar />
      <main id="main-content" class="layout-main" role="main">
        <slot />
      </main>
    </div>
  </div>
</template>
