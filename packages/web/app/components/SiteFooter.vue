<template>
  <footer class="site-footer" role="contentinfo">
    <div class="container footer-inner">
      <p class="powered-by">
        Powered by <a href="https://github.com/137andCo/opusheart" target="_blank" rel="noopener"><strong>OpusHeart</strong></a>
        — a source-available community platform by <a href="https://137andco.com" target="_blank" rel="noopener">137 &amp; Co.</a>
      </p>
    </div>
  </footer>
</template>

<style scoped>
.site-footer {
  border-top: 1px solid var(--oh-border);
  padding: 2rem 0;
  margin-top: 3rem;
  text-align: center;
  color: var(--oh-muted);
  font-size: 0.875rem;
}

.site-footer a {
  color: inherit;
  text-decoration: underline;
  text-underline-offset: 2px;
}

.site-footer a:hover {
  color: var(--oh-text, #333);
}
</style>
