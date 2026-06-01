export function useTheme() {
  const config = useRuntimeConfig();
  const theme = useState<Record<string, string>>('theme', () => ({}));

  async function loadTheme() {
    try {
      const data = await $fetch<{ theme: any }>(`${config.public.apiBase}/theme`);
      if (data.theme) {
        theme.value = data.theme;
        applyTheme(data.theme);
      }
    } catch {
      // Use defaults — theme endpoint may not exist yet
    }
  }

  function applyTheme(t: Record<string, any>) {
    if (!import.meta.client) return;
    const root = document.documentElement;
    if (t.primaryColor) root.style.setProperty('--oh-primary', t.primaryColor);
    if (t.secondaryColor) root.style.setProperty('--oh-secondary', t.secondaryColor);
    if (t.fontFamily) root.style.setProperty('--oh-font', t.fontFamily);
    // Opt-in heading typeface (defaults to the body font when unset).
    if (t.headingFont) root.style.setProperty('--oh-font-heading', t.headingFont);
    // Opt-in entrance motion — toggles a class the stylesheet keys off (and which
    // is itself wrapped in prefers-reduced-motion: no-preference).
    root.classList.toggle('oh-motion', Boolean(t.enableMotion));
  }

  return { theme, loadTheme };
}
