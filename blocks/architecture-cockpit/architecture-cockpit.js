function loadScript(src) {
  return new Promise((resolve, reject) => {
    const script = document.createElement('script');
    script.src = src;
    script.onload = resolve;
    script.onerror = reject;
    document.head.appendChild(script);
  });
}

export default async function decorate(block) {
  const header = document.querySelector('header');
  const footer = document.querySelector('footer');
  if (header) header.style.display = 'none';
  if (footer) footer.style.display = 'none';
  document.body.style.overflow = 'hidden';

  block.innerHTML = `
    <div id="app">
      <header class="topbar">
        <div class="topbar-left">
          <div class="app-brand">
            <img class="app-logo" src="${window.hlx.codeBasePath}/assets/architecture-cockpit/logo.jpg" alt="Enterprise Architecture" />
            <div class="app-brand-text">
              <span class="app-brand-title">Enterprise Architecture Model</span>
              <span class="app-brand-subtitle">Content Supply Chain</span>
            </div>
          </div>
          <select class="account-picker" id="account-picker" aria-label="Account"></select>
        </div>
        <div class="topbar-center">
          <div class="search-wrap" id="search-wrap">
            <svg class="search-icon" viewBox="0 0 16 16" aria-hidden="true">
              <path d="M11 11l3 3M7 12a5 5 0 1 1 0-10 5 5 0 0 1 0 10z" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/>
            </svg>
            <input id="search" type="search" placeholder="Search documents…" autocomplete="off" />
            <kbd class="search-kbd">/</kbd>
            <div class="search-dropdown" id="search-dropdown" hidden></div>
          </div>
        </div>
        <div class="topbar-right">
          <button type="button" class="reset-view-btn" id="reset-view" title="Reset view (R)">
            <svg viewBox="0 0 16 16" aria-hidden="true"><path d="M2 8a6 6 0 1 1 1.76 4.24M2 12V8h4" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/></svg>
            Reset
          </button>
          <button class="ghost-btn" id="fit-view" title="Fit to canvas (F)">
            <svg viewBox="0 0 16 16" aria-hidden="true"><path d="M3 6V3h3M13 6V3h-3M3 10v3h3M13 10v3h-3" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/></svg>
            Fit
          </button>
        </div>
      </header>
      <div class="workspace">
        <aside class="left-panel" id="left-panel" aria-label="Filters and categories">
          <button class="panel-collapse-btn" id="left-panel-toggle" aria-label="Collapse panel" title="Collapse ([)">
            <svg viewBox="0 0 16 16" aria-hidden="true"><path d="M10 4 L6 8 L10 12" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/></svg>
          </button>
          <div class="panel-body">
            <section class="panel-section">
              <h4 class="panel-eyebrow">Status</h4>
              <div class="filter-list" id="filter-status"></div>
            </section>
            <section class="panel-section">
              <h4 class="panel-eyebrow">Node Types</h4>
              <div class="legend-list" id="legend-list"></div>
            </section>
            <button class="reset-link" id="reset-filters">Reset filters</button>
          </div>
          <div class="completeness-chip" id="completeness" aria-label="Completeness"></div>
        </aside>
        <main id="canvas-wrap">
          <svg id="canvas"></svg>
          <div class="loading" id="loading">Loading metamodel…</div>
        </main>
        <aside class="right-panel" id="right-panel" aria-label="Documentation details" hidden>
          <header class="rp-header">
            <h2 class="rp-panel-title" id="rp-panel-title">Documentation Details</h2>
            <button class="rp-close" id="rp-close" aria-label="Close (Esc)">
              <svg viewBox="0 0 16 16" aria-hidden="true"><path d="M4 4 L12 12 M12 4 L4 12" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/></svg>
            </button>
          </header>
          <div class="rp-body" id="rp-body"></div>
        </aside>
      </div>
      <div class="popup-backdrop hidden" id="popup-backdrop">
        <div class="popup" id="popup" role="dialog" aria-modal="true"></div>
      </div>
    </div>
  `;

  const link = document.createElement('link');
  link.rel = 'stylesheet';
  link.href = 'https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&family=Instrument+Serif:ital@0;1&family=JetBrains+Mono:wght@400;500&display=swap';
  document.head.appendChild(link);

  await loadScript('https://cdn.jsdelivr.net/npm/d3@7/dist/d3.min.js');
  await loadScript('https://cdn.jsdelivr.net/npm/fuse.js@7.0.0/dist/fuse.min.js');

  const appScript = document.createElement('script');
  appScript.src = `${window.hlx.codeBasePath}/blocks/architecture-cockpit/app.js`;
  document.body.appendChild(appScript);
}
