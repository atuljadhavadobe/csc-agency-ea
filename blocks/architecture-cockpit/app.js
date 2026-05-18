/* Architecture Cockpit — JSON-driven static SPA.
   Reads ./data/_accounts.json (picker manifest) and ./data/<id>.json (graph). */

/* ============================================================================
   Constants
   ============================================================================ */
const NODE_W = 200; const
  NODE_H = 50; // leaf pill (smaller than containers)
const ARCH_W = 200; const
  ARCH_H = 50; // architecture-type leaf card (matches leaf size)
const TOP_W = 220; const
  TOP_H = 56; // top-level container chip
const SUB_W = 220; const
  SUB_H = 56; // 2nd-level+ container box
const ROOT_LOGO_W = 240; const
  ROOT_LOGO_H = 120; // root logo image

const STATUS_DEFAULT = 'not-started';
const STATUS_VALUES = ['complete', 'in-progress', 'not-started'];
const STATUS_TO_CLASS = { complete: 'complete', 'in-progress': 'progress', 'not-started': 'notstarted' };
const STATUS_LABELS = { complete: 'Complete', 'in-progress': 'In-Progress', 'not-started': 'Not Started' };
const STATUS_WEIGHTS = { complete: 1.0, 'in-progress': 0.5, 'not-started': 0.0 };

const FILTER_STORE_KEY = 'amm.filters.v4'; // bumped to reset collapsed default + new topbar filter buttons
const PANEL_STORE_KEY = 'amm.left-panel.collapsed';
const NARROW_VIEWPORT = 1100; // below this, right panel is replaced by modal

/* ============================================================================
   Helpers
   ============================================================================ */
function escapeHtml(s) {
  return String(s ?? '').replace(/[&<>"']/g, (c) => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
  }[c]));
}
function countLeaves(n) {
  if (n.type === 'leaf') return 1;
  return (n.children || []).reduce((a, c) => a + countLeaves(c), 0);
}
function slugify(s) {
  return String(s || '').toLowerCase().normalize('NFKD')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '') || 'node';
}
function normalizeStatus(v) {
  return STATUS_VALUES.includes(v) ? v : STATUS_DEFAULT;
}
function isNarrow() { return window.innerWidth < NARROW_VIEWPORT; }

/** Normalized file refs on a leaf (see authoring JSON `documents` array). */
function buildLeafDocuments(node, leafTitle) {
  const out = [];
  if (Array.isArray(node.documents)) {
    for (const d of node.documents) {
      const filePath = String(d.filePath ?? d.url ?? '').trim();
      if (!filePath) continue;
      out.push({
        fileName: String(d.fileName ?? d.title ?? 'Untitled'),
        filePath,
        customerReviewed: !!d.customerReviewed,
        complete: !!d.complete,
      });
    }
  }
  if (!out.length && node.url) {
    out.push({
      fileName: String(node.fileName ?? leafTitle ?? 'Document'),
      filePath: String(node.url),
      customerReviewed: !!node.reviewed,
      complete: normalizeStatus(node.status) === 'complete',
    });
  }
  return out;
}

/** Label for the Documents grid — Lucid, SharePoint by path extension, else external. */
function inferDocumentType(filePath) {
  const raw = String(filePath ?? '').trim();
  if (!raw) return 'External Link';
  let url;
  try {
    url = new URL(raw, window.location.href);
  } catch {
    return 'External Link';
  }
  const host = url.hostname.toLowerCase();
  if (host === 'lucid.app' || host.endsWith('.lucid.app') || host.includes('lucidchart')) {
    return 'Lucid Visual';
  }

  const isSharePoint = host.includes('sharepoint.') || host.includes('sharepoint.com') || raw.toLowerCase().includes('sharepoint.com');
  if (!isSharePoint) return 'External Link';

  const pathDec = decodeURIComponent(url.pathname.replace(/\+/g, ' ')).toLowerCase();
  let fileDec = '';
  const fq = url.searchParams.get('file');
  if (fq) fileDec = decodeURIComponent(fq.replace(/\+/g, ' ')).toLowerCase();
  const hay = `${pathDec} ${fileDec}`;

  if (/\.pptx\b/i.test(hay) || /\.ppt\b/i.test(hay)) return 'Sharepoint - PPT';
  if (/\.pdf\b/i.test(hay)) return 'Sharepoint - PDF';
  return 'External Link';
}

function leafHasDocLinks(meta) {
  if (!meta) return false;
  if (meta.url) return true;
  if (Array.isArray(meta.documents) && meta.documents.length > 0) return true;
  if (Array.isArray(meta.architectureSections)) {
    return meta.architectureSections.some((s) => (s.documents || []).length > 0);
  }
  return false;
}

/** Authoring: `architectureSections` on a leaf — grouped docs for Tech cases / Agency Architectures leaves. */
function buildArchitectureSectionsNormalized(node) {
  if (!Array.isArray(node.architectureSections)) return [];
  return node.architectureSections.map((sec) => {
    const docs = buildLeafDocuments(
      {
        documents: sec.documents,
        url: sec.url,
        reviewed: sec.reviewed,
        status: sec.status,
      },
      sec.sectionTitle || 'Section',
    );
    return {
      sectionTitle: String(sec.sectionTitle ?? 'Section'),
      documents: docs,
    };
  });
}

/* ============================================================================
   Normalizer — authoring JSON → renderer-friendly tree
   `color` cascades from any ancestor that sets it (e.g. Agency Use Cases red).
   ============================================================================ */
function normalize(node, parentPath = '', parentColor = null) {
  const title = String(node.title ?? 'node');
  const slug = slugify(title);
  const path = parentPath ? `${parentPath}/${slug}` : slug;
  const color = node.color ?? parentColor ?? null;

  const hasChildren = Array.isArray(node.children);
  const hasDocList = Array.isArray(node.documents) && node.documents.length > 0;
  const hasArchAuthoring = Array.isArray(node.architectureSections) && node.architectureSections.length > 0;
  const isLeaf = !!node.url || hasDocList || hasArchAuthoring || (!hasChildren && !node.children);
  const type = isLeaf ? 'leaf' : 'folder';

  const meta = {
    title,
    description: node.description ?? null,
    side: node.side ?? null,
    color,
    logo: node.logo ?? null, // root-level only
    nodeType: node.nodeType ?? null,
    nodeIcon: node.nodeIcon ?? null,
  };
  if (type === 'leaf') {
    const architectureSections = buildArchitectureSectionsNormalized(node);
    const hasArch = architectureSections.length > 0;
    const documents = hasArch
      ? architectureSections.flatMap((s) => s.documents)
      : buildLeafDocuments(node, title);
    Object.assign(meta, {
      architectureSections: hasArch ? architectureSections : [],
      documents,
      reviewed: documents.some((d) => d.customerReviewed) || !!node.reviewed,
      url: documents[0]?.filePath ?? null,
      status: normalizeStatus(node.status),
    });
  }

  const out = {
    id: path, type, name: title, path, meta,
  };
  if (type === 'folder') out.children = (node.children || []).map((c) => normalize(c, path, color));
  return out;
}

/* ============================================================================
   Flatten + index helpers
   ============================================================================ */
let byId = new Map();
let parents = new Map();
let leaves = [];

function flatten(n, parent = null) {
  byId.set(n.id, n);
  parents.set(n.id, parent);
  if (n.type === 'leaf') leaves.push(n);
  else (n.children || []).forEach((c) => flatten(c, n.id));
}
function ancestorIds(id) {
  const out = [];
  let c = id;
  while (c) { out.push(c); c = parents.get(c); }
  return out.reverse();
}
function deriveYears() {
  const years = new Set();
  for (const l of leaves) {
    const m = (l.meta.title || '').match(/\b(20\d{2})\b/);
    if (m) years.add(m[1]);
  }
  return [...years].sort();
}
function leafYear(leaf) {
  const m = (leaf.meta.title || '').match(/\b(20\d{2})\b/);
  return m ? m[1] : null;
}

/* ============================================================================
   Detail panel (right sidebar) — primary detail surface
   Falls back to modal popup at narrow viewports.
   ============================================================================ */
const DETAIL_REFRESH_FLASH_MS = 760;

/** Faint overlay flash so content swaps on node/breadcrumb clicks are noticeable. */
function triggerDetailRefreshFlash(el) {
  if (!el || window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
  el.classList.remove('rp-refresh-flash');
  void el.offsetWidth;
  el.classList.add('rp-refresh-flash');
  window.setTimeout(() => el.classList.remove('rp-refresh-flash'), DETAIL_REFRESH_FLASH_MS);
}

const detailPanel = (() => {
  const root = document.getElementById('right-panel');
  const body = document.getElementById('rp-body');
  const closeBtn = document.getElementById('rp-close');
  const ws = () => document.querySelector('.workspace');
  let currentId = null;

  closeBtn.addEventListener('click', () => close());

  function statusPill(status) {
    const k = STATUS_TO_CLASS[status] || STATUS_TO_CLASS[STATUS_DEFAULT];
    return `<span class="rp-status-pill ${k}"><span class="dot"></span>${escapeHtml(STATUS_LABELS[status] || STATUS_LABELS[STATUS_DEFAULT])}</span>`;
  }

  function renderDocCardHtml(d) {
    const href = escapeHtml(d.filePath);
    const fname = escapeHtml(d.fileName);
    const docType = escapeHtml(inferDocumentType(d.filePath));
    const rev = d.customerReviewed
      ? '<span class="rp-badge rp-badge-yes">Yes</span>'
      : '<span class="rp-badge rp-badge-no">No</span>';
    return `
        <div class="rp-doc-card">
          <dl class="rp-doc-grid">
            <dt>Document title</dt>
            <dd><button class="rp-doc-title-link rp-doc-open-btn" type="button" data-href="${href}" data-title="${fname}">${fname}</button></dd>
            <dt>Document type</dt><dd>${docType}</dd>
            <dt>Customer reviewed</dt><dd>${rev}</dd>
          </dl>
        </div>`;
  }

  function renderArchitectureSectionsPanel(node) {
    const secs = node.meta.architectureSections || [];
    if (!secs.length) return '';
    const tabs = secs.map((sec, idx) => {
      const abbr = escapeHtml((sec.sectionTitle || '').split(' ')[0][0] || '?');
      const isActive = idx === 0;
      return `<button role="tab" class="rp-arch-tab${isActive ? ' active' : ''}" data-tab="${idx}" aria-selected="${isActive}">
        <span class="tab-full">${escapeHtml(sec.sectionTitle)}</span>
        <span class="tab-abbr" aria-hidden="true">${abbr}</span>
      </button>`;
    }).join('');
    const panels = secs.map((sec, idx) => {
      const inner = (sec.documents || []).length
        ? sec.documents.map(renderDocCardHtml).join('')
        : '<p class="rp-arch-empty">No documents linked yet.</p>';
      return `<div class="rp-arch-tab-panel${idx !== 0 ? ' hidden' : ''}" data-panel="${idx}">
        <div class="rp-doc-list">${inner}</div>
      </div>`;
    }).join('');
    return `
      <section class="rp-section rp-architecture-docs rp-docs-attention">
        <div class="rp-section-head rp-doc-details-head"><span>Document Details</span></div>
        <div class="rp-arch-tabs">
          <nav class="rp-arch-tab-bar" role="tablist">${tabs}</nav>
          <div class="rp-arch-tab-panels">${panels}</div>
        </div>
      </section>`;
  }

  function renderDocumentsSection(node) {
    const docs = node.meta.documents || [];
    if (!docs.length) return '';
    const cards = docs.map(renderDocCardHtml).join('');
    return `
      <section class="rp-section rp-docs-section rp-docs-attention">
        <div class="rp-section-head rp-doc-details-head"><span>Document Details</span><span class="section-meta">${docs.length}</span></div>
        <div class="rp-doc-list">${cards}</div>
      </section>`;
  }

  function renderBreadcrumb(node) {
    const ids = ancestorIds(node.id);
    return `<nav class="rp-breadcrumb">${
      ids.map((id, i) => {
        const n = byId.get(id);
        const last = i === ids.length - 1;
        const label = escapeHtml(n.meta.title || n.name || 'root');
        return `${i > 0 ? '<span class="sep">›</span>' : ''}<span class="crumb${last ? ' current' : ''}" data-id="${escapeHtml(id)}">${label}</span>`;
      }).join('')
    }</nav>`;
  }

  function renderChildList(node) {
    const kids = node.children || [];
    if (!kids.length) return '';
    const head = `<div class="rp-section-head"><span>Children</span><span class="section-meta">${kids.length} total</span></div>`;
    const rows = kids.map((c) => {
      const isLeaf = c.type === 'leaf';
      const dotCls = isLeaf
        ? STATUS_TO_CLASS[c.meta.status || STATUS_DEFAULT]
        : 'folder';
      return `<div class="rp-child" data-id="${escapeHtml(c.id)}">
        <span class="dot ${dotCls}"></span>
        <span class="child-title">${escapeHtml(c.meta.title || c.name)}</span>
        <span class="child-link">›</span>
      </div>`;
    }).join('');
    return `<section class="rp-section">${head}<div class="rp-children">${rows}</div></section>`;
  }

  function renderLeafSections(node) {
    const m = node.meta;
    const docs = m.documents || [];
    const arch = m.architectureSections;
    const reviewed = docs.length === 0 && !arch?.length && m.reviewed
      ? '<span class="rp-reviewed"><span class="check">✓</span>Reviewed</span>'
      : '';
    const docPanel = arch?.length
      ? renderArchitectureSectionsPanel(node)
      : renderDocumentsSection(node);
    const aiValidateBtn = m.nodeType === 'architecture'
      ? '<button type="button" class="rp-ai-validate-btn" disabled>Validate</button>'
      : '';
    return `
      <section class="rp-section">
        <div class="rp-section-head"><span>Status</span></div>
        <div class="rp-status-row">${statusPill(m.status)} ${reviewed} ${aiValidateBtn}</div>
      </section>
      ${docPanel}`;
  }

  function render(node) {
    const m = node.meta;
    const desc = m.description
      ? `<p class="rp-desc">${escapeHtml(m.description)}</p>`
      : '<p class="rp-desc" style="color:var(--text-faint);font-style:italic">No description provided yet.</p>';
    body.innerHTML = `
      ${renderBreadcrumb(node)}
      <h2 class="rp-title">${escapeHtml(m.title)}</h2>
      ${desc}
      ${node.type === 'leaf' ? renderLeafSections(node) : renderChildList(node)}
    `;

    // Wire breadcrumb + child clicks to swap or focus
    body.querySelectorAll('.rp-breadcrumb .crumb').forEach((el) => {
      el.addEventListener('click', () => {
        const { id } = el.dataset;
        const n = byId.get(id);
        if (n) open(n);
      });
    });
    body.querySelectorAll('.rp-child').forEach((el) => {
      el.addEventListener('click', () => {
        const { id } = el.dataset;
        const n = byId.get(id);
        if (n) open(n);
      });
    });

    // Wire architecture doc tabs
    body.querySelectorAll('.rp-arch-tab').forEach((tab) => {
      tab.addEventListener('click', () => {
        const idx = tab.dataset.tab;
        body.querySelectorAll('.rp-arch-tab').forEach((t) => {
          t.classList.toggle('active', t.dataset.tab === idx);
          t.setAttribute('aria-selected', t.dataset.tab === idx ? 'true' : 'false');
        });
        body.querySelectorAll('.rp-arch-tab-panel').forEach((panel) => {
          panel.classList.toggle('hidden', panel.dataset.panel !== idx);
        });
      });
    });
  }

  function open(node) {
    if (!node) return;
    // On narrow viewports, fall back to the modal popup.
    if (isNarrow()) { openModalPopup(node); return; }

    currentId = node.id;
    if (root.hidden) {
      root.hidden = false;
      ws()?.classList.add('right-open');
    }
    render(node);
    triggerDetailRefreshFlash(body);

    // Tell the renderer to focus this node visually + center the canvas.
    // expand only the ANCESTORS of the target — never the target itself,
    // so we don't accidentally re-expand a folder a user just collapsed.
    if (renderer) {
      renderer.setFocus(node.id);
      const ancs = ancestorIds(node.id);
      if (ancs.length > 1) renderer.expandPathTo(new Set(ancs.slice(0, -1)));
      renderer.focus(node.id);
    }
  }

  function swap(node) { open(node); } // alias for clarity

  function close() {
    currentId = null;
    root.hidden = true;
    ws()?.classList.remove('right-open');
    if (renderer) {
      renderer.setFocus(null);
      // Recenter the canvas so the graph re-occupies the freed-up width
      // without leaving the viewer staring at an off-center layout.
      // Slight delay so the grid-template-columns transition finishes first
      // (see .workspace transition in styles.css ~ 350 ms).
      setTimeout(() => renderer.fitToView(), 360);
    }
  }

  function getCurrentId() { return currentId; }

  return {
    open, swap, close, getCurrentId,
  };
})();

/* ============================================================================
   Modal popup (fallback for narrow viewports only)
   ============================================================================ */
const popupEls = {
  backdrop: document.getElementById('popup-backdrop'),
  popup: document.getElementById('popup'),
};
function openModalPopup(node) {
  const m = node.meta;
  const isLeaf = node.type === 'leaf';
  const stCls = STATUS_TO_CLASS[m.status || STATUS_DEFAULT];
  const docs = m.documents || [];
  const archSecs = m.architectureSections || [];
  let docLinks = '';
  if (isLeaf && archSecs.length) {
    docLinks = archSecs.map((sec) => {
      const items = (sec.documents || []).length
        ? sec.documents.map((d) => `
        <li>
          <button class="popup-doc-title-link popup-doc-open-btn" type="button" data-href="${escapeHtml(d.filePath)}" data-title="${escapeHtml(d.fileName)}">${escapeHtml(d.fileName)}</button>
          <div class="popup-doc-meta">Document type: ${escapeHtml(inferDocumentType(d.filePath))}</div>
          <div class="popup-doc-meta">Customer reviewed: ${d.customerReviewed ? 'Yes' : 'No'}</div>
        </li>`).join('')
        : '<li class="popup-arch-empty-li">No documents linked yet.</li>';
      return `
      <div class="popup-arch-block">
        <h4 class="popup-arch-heading">${escapeHtml(sec.sectionTitle)}</h4>
        <ul class="popup-doc-list">${items}</ul>
      </div>`;
    }).join('');
  } else if (isLeaf && docs.length) {
    docLinks = `<ul class="popup-doc-list">${docs.map((d) => `
        <li>
          <button class="popup-doc-title-link popup-doc-open-btn" type="button" data-href="${escapeHtml(d.filePath)}" data-title="${escapeHtml(d.fileName)}">${escapeHtml(d.fileName)}</button>
          <div class="popup-doc-meta">Document type: ${escapeHtml(inferDocumentType(d.filePath))}</div>
          <div class="popup-doc-meta">Customer reviewed: ${d.customerReviewed ? 'Yes' : 'No'}</div>
        </li>`).join('')}</ul>`;
  }
  const legacySingle = isLeaf && !docs.length && m.url
    ? `<a class="btn primary" href="${escapeHtml(m.url)}" target="_blank" rel="noopener noreferrer">Open ↗</a>`
    : '';
  popupEls.popup.innerHTML = `
    <h2>${escapeHtml(m.title)}</h2>
    <div class="path">${escapeHtml(node.path)}</div>
    ${m.description ? `<p class="desc">${escapeHtml(m.description)}</p>` : ''}
    ${isLeaf ? `<dl class="meta-grid">
      <dt>Status</dt><dd><span class="badge status-${stCls} on">${escapeHtml(STATUS_LABELS[m.status])}</span></dd>
      ${m.reviewed ? '<dt>Reviewed</dt><dd><span class="badge on">✓ Customer reviewed</span></dd>' : ''}
    </dl>` : '<dl class="meta-grid"><dt>Type</dt><dd>Container</dd></dl>'}
    ${docLinks ? `<div class="popup-docs-attention">${docLinks}</div>` : ''}
    <div class="actions">
      <button class="btn" id="popup-close">Close</button>
      ${legacySingle}
    </div>`;
  popupEls.backdrop.classList.remove('hidden');
  document.getElementById('popup-close').onclick = closeModalPopup;
  triggerDetailRefreshFlash(popupEls.popup);
}
function closeModalPopup() {
  popupEls.backdrop.classList.add('hidden');
  popupEls.popup.innerHTML = '';
}
popupEls.backdrop.addEventListener('click', (e) => {
  if (e.target === popupEls.backdrop) closeModalPopup();
});

/* ============================================================================
   Document viewer overlay (inline iframe via Office Online Viewer)
   ============================================================================ */
const docViewerEl = document.getElementById('doc-viewer-overlay');

function openDocViewer(href, title) {
  const isOfficeOrSharePoint = /\.(pptx?|docx?|xlsx?)(\?|$)/i.test(href) || href.includes('sharepoint.com');
  const embedUrl = isOfficeOrSharePoint
    ? `https://view.officeapps.live.com/op/embed.aspx?src=${encodeURIComponent(href)}`
    : href;
  docViewerEl.querySelector('.dv-title').textContent = title;
  docViewerEl.querySelector('.dv-iframe').src = embedUrl;
  docViewerEl.classList.remove('hidden');
  docViewerEl.querySelector('.dv-close').focus();
}

function closeDocViewer() {
  docViewerEl.classList.add('hidden');
  docViewerEl.querySelector('.dv-iframe').src = '';
}

docViewerEl.querySelector('.dv-close').addEventListener('click', closeDocViewer);

// Event delegation: catch doc open button clicks anywhere in the page
document.addEventListener('click', (e) => {
  const btn = e.target.closest('.rp-doc-open-btn, .popup-doc-open-btn');
  if (btn) {
    e.preventDefault();
    openDocViewer(btn.dataset.href, btn.dataset.title);
  }
});

/* ============================================================================
   Filters (left panel) — Status
   Persisted in localStorage.
   ============================================================================ */
const filters = (() => {
  const defaults = {
    statuses: [...STATUS_VALUES], // all on by default
    leftCollapsed: true,
  };
  let state = loadState();

  function loadState() {
    try {
      const raw = localStorage.getItem(FILTER_STORE_KEY);
      const obj = raw ? JSON.parse(raw) : {};
      const merged = { ...defaults, ...obj };
      if (!Array.isArray(merged.statuses) || merged.statuses.length === 0) {
        merged.statuses = [...defaults.statuses];
      }
      return merged;
    } catch { return { ...defaults }; }
  }
  function saveState() {
    try { localStorage.setItem(FILTER_STORE_KEY, JSON.stringify(state)); } catch {}
  }

  function isStatusEnabled(s) {
    return state.statuses.includes(s);
  }

  /** Returns `true` if a leaf passes all current filters. */
  function leafPasses(leaf) {
    return isStatusEnabled(leaf.meta.status);
  }
  /** Always true — category filtering removed. */
  function topLevelEnabled() { return true; }

  // ----- UI mounting -----
  function mount() {
    mountStatus();
    mountLegend();
    const resetBtn = document.getElementById('reset-filters');
    if (resetBtn) {
      resetBtn.onclick = () => {
        state = { ...defaults };
        saveState();
        mount();
        apply();
        renderCompleteness();
      };
    }
    document.getElementById('left-panel-toggle').onclick = () => {
      state.leftCollapsed = !state.leftCollapsed;
      saveState();
      applyCollapse();
    };
    applyCollapse();
  }

  function applyCollapse() {
    const ws = document.querySelector('.workspace');
    if (!ws) return;
    ws.classList.toggle('left-collapsed', !!state.leftCollapsed);
  }

  function mountStatus() {
    const c = document.getElementById('filter-status');
    if (!c) return;
    c.innerHTML = '';
    const counts = { complete: 0, 'in-progress': 0, 'not-started': 0 };
    for (const l of leaves) counts[l.meta.status] = (counts[l.meta.status] || 0) + 1;
    for (const s of STATUS_VALUES) {
      const id = `flt-st-${s}`;
      const item = document.createElement('label');
      item.className = 'filter-item';
      item.htmlFor = id;
      item.innerHTML = `
        <input type="checkbox" id="${id}" ${state.statuses.includes(s) ? 'checked' : ''} />
        <span class="dot ${STATUS_TO_CLASS[s]}"></span>
        <span>${STATUS_LABELS[s]}</span>
        <span class="count">${counts[s] || 0}</span>`;
      item.querySelector('input').onchange = (e) => {
        if (e.target.checked) state.statuses = [...new Set([...state.statuses, s])];
        else state.statuses = state.statuses.filter((x) => x !== s);
        saveState(); apply();
      };
      c.appendChild(item);
    }
  }

  function mountLegend() {
    const c = document.getElementById('legend-list');
    if (!c) return;
    const items = [
      { cls: 'legend-swatch--root', label: 'Root' },
      { cls: 'legend-swatch--folder', label: 'Container' },
      { cls: 'legend-swatch--leaf', label: 'Leaf' },
      { cls: 'legend-swatch--arch', label: 'Architecture' },
    ];
    c.innerHTML = items.map(({ cls, label }) => `
      <div class="legend-item">
        <span class="legend-swatch ${cls}"></span>
        <span class="legend-label">${label}</span>
      </div>`).join('');
  }

  /** True iff every filter is at its wide-open default — nothing to compute. */
  function isAtDefault() {
    return state.statuses.length === STATUS_VALUES.length;
  }

  /** Apply filters to the canvas (dim non-matching leaves + their isolated branches). */
  function apply() {
    if (!renderer) return;

    if (isAtDefault()) {
      renderer.setHighlight(new Set(), false);
      return;
    }

    const passingIds = new Set();
    for (const l of leaves) {
      if (!leafPasses(l)) continue;
      passingIds.add(l.id);
    }
    if (passingIds.size === leaves.length || passingIds.size === 0) {
      renderer.setHighlight(new Set(), false);
    } else {
      renderer.setHighlight(passingIds, true);
    }
  }

  function toggleStatus(s) {
    if (state.statuses.includes(s)) {
      state.statuses = state.statuses.filter((x) => x !== s);
    } else {
      state.statuses = [...new Set([...state.statuses, s])];
    }
    if (state.statuses.length === 0) state.statuses = [...STATUS_VALUES];
    saveState();
    apply();
    renderCompleteness();
  }

  return {
    mount, apply, leafPasses, topLevelEnabled, getState: () => state, toggleStatus,
  };
})();

/* ============================================================================
   Completeness summary (bottom of left panel)
   ============================================================================ */
function computeCompleteness() {
  const buckets = { complete: 0, 'in-progress': 0, 'not-started': 0 };
  leaves.forEach((l) => { buckets[l.meta.status] = (buckets[l.meta.status] || 0) + 1; });
  const total = leaves.length || 1;
  const score = (buckets.complete * STATUS_WEIGHTS.complete
              + buckets['in-progress'] * STATUS_WEIGHTS['in-progress']
              + buckets['not-started'] * STATUS_WEIGHTS['not-started']) / total;
  return { buckets, total: leaves.length, percent: Math.round(score * 100) };
}
function renderCompleteness() {
  const host = document.getElementById('completeness');
  if (!host) return;
  const { buckets, percent } = computeCompleteness();
  const active = filters.getState().statuses;

  const btnDefs = [
    { key: 'complete', label: 'Done', cls: 'cc-done' },
    { key: 'in-progress', label: 'WIP', cls: 'cc-wip' },
    { key: 'not-started', label: 'TODO', cls: 'cc-todo' },
  ];

  const btns = btnDefs.map(({ key, label, cls }) => {
    const isActive = active.includes(key);
    return `<button class="cc-filter-btn ${cls}${isActive ? ' active' : ''}" data-status="${key}" aria-pressed="${isActive}" title="Toggle ${label} filter">
      <span class="cc-filter-count">${buckets[key] || 0}</span>
      <span class="cc-filter-label">${label}</span>
    </button>`;
  }).join('');

  host.innerHTML = `
    <div class="cc-coverage">
      <span class="cc-label">Coverage</span>
      <span class="cc-percent">${percent}%</span>
    </div>
    <div class="cc-status-btns">${btns}</div>
    <div class="cc-track" title="${percent}% complete (weighted)">
      <div class="cc-fill" style="width:${percent}%"></div>
    </div>
  `;

  host.querySelectorAll('.cc-filter-btn').forEach((btn) => {
    btn.addEventListener('click', () => {
      filters.toggleStatus(btn.dataset.status);
    });
  });
}

/* ============================================================================
   Search dropdown — opens on focus, lists grouped matches
   ============================================================================ */
const searchUI = (() => {
  const input = document.getElementById('search');
  const dd = document.getElementById('search-dropdown');
  let activeIdx = -1;
  let resultEls = [];

  input.addEventListener('input', refresh);
  input.addEventListener('focus', refresh);
  input.addEventListener('blur', () => setTimeout(close, 150)); // delay so click fires
  input.addEventListener('keydown', onKey);
  document.addEventListener('keydown', (e) => {
    if (e.key === '/' && document.activeElement !== input && !e.ctrlKey && !e.metaKey) {
      e.preventDefault(); input.focus(); input.select();
    }
  });

  function refresh() {
    const q = input.value.trim();
    if (!fuse || !q) { close(); applyToCanvas(''); return; }
    const hits = fuse.search(q).map((r) => r.item).slice(0, 12);
    if (!hits.length) {
      dd.innerHTML = `<div class="search-empty">No matches for "${escapeHtml(q)}"</div>`;
      dd.hidden = false; resultEls = []; activeIdx = -1;
    } else {
      const docs = hits.filter((n) => n.type === 'leaf').slice(0, 5);
      const cont = hits.filter((n) => n.type !== 'leaf').slice(0, 3);
      dd.innerHTML = `
        ${docs.length ? '<div class="search-group-label">Document Details</div>' : ''}
        ${docs.map((n) => row(n)).join('')}
        ${cont.length ? '<div class="search-group-label">Containers</div>' : ''}
        ${cont.map((n) => row(n)).join('')}`;
      resultEls = [...dd.querySelectorAll('.search-result')];
      activeIdx = resultEls.length ? 0 : -1;
      paintActive();
      resultEls.forEach((el, i) => {
        el.addEventListener('mouseenter', () => { activeIdx = i; paintActive(); });
        el.addEventListener('mousedown', (e) => {
          e.preventDefault();
          choose(byId.get(el.dataset.id));
        });
      });
      dd.hidden = false;
    }
    applyToCanvas(q);
  }

  function row(n) {
    const isLeaf = n.type === 'leaf';
    const dotCls = isLeaf ? STATUS_TO_CLASS[n.meta.status || STATUS_DEFAULT] : 'folder';
    return `<div class="search-result" data-id="${escapeHtml(n.id)}">
      <span class="result-dot ${dotCls}"></span>
      <span class="result-text">
        <div class="result-title">${escapeHtml(n.meta.title || n.name)}</div>
        <div class="result-path">${escapeHtml(n.path)}</div>
      </span>
    </div>`;
  }

  function paintActive() {
    resultEls.forEach((el, i) => el.classList.toggle('active', i === activeIdx));
  }
  function onKey(e) {
    if (dd.hidden) return;
    if (e.key === 'ArrowDown') { e.preventDefault(); activeIdx = Math.min(activeIdx + 1, resultEls.length - 1); paintActive(); } else if (e.key === 'ArrowUp') { e.preventDefault(); activeIdx = Math.max(activeIdx - 1, 0); paintActive(); } else if (e.key === 'Enter') {
      e.preventDefault();
      const el = resultEls[activeIdx]; if (!el) return;
      choose(byId.get(el.dataset.id));
    } else if (e.key === 'Escape') {
      input.blur(); close();
    }
  }
  function choose(node) {
    if (!node) return;
    close();
    detailPanel.open(node);
  }
  function close() { dd.hidden = true; }

  function applyToCanvas(q) {
    if (!renderer) return;
    if (!q) { filters.apply(); return; } // restore normal filter view
    const m = fuse.search(q).map((r) => r.item);
    if (!m.length) { renderer.setHighlight(new Set(), false); return; }
    const ids = new Set();
    m.forEach((l) => ancestorIds(l.id).forEach((id) => ids.add(id)));
    renderer.expandPathTo(ids);
    renderer.setHighlight(new Set(m.map((l) => l.id)), true);
  }

  return { refresh };
})();

/* ============================================================================
   Renderer (D3) — preserved from before, with setFocus added
   ============================================================================ */
class GraphRenderer {
  constructor(svgEl) {
    this.svg = d3.select(svgEl);
    this.g = this.svg.append('g');
    this.highlight = new Set();
    this.dimMode = false;
    this.focusedId = null;

    this.zoom = d3.zoom().scaleExtent([0.2, 2.4]).on('zoom', (e) => {
      this.g.attr('transform', e.transform.toString());
    });
    this.svg.call(this.zoom);

    // Click empty canvas → close detail panel + drop focus
    this.svg.on('click', (e) => {
      if (e.target.tagName === 'svg') {
        this.setFocus(null);
        detailPanel.close();
      }
    });
  }

  reset() { this.g.selectAll('*').remove(); this.svg.call(this.zoom.transform, d3.zoomIdentity); }

  setData(tree) {
    this.root = d3.hierarchy(tree, (d) => (d.type === 'folder' ? d.children : null));
    this.root.descendants().forEach((n) => {
      if (n.depth >= 1 && n.children) { n._children = n.children; n.children = null; }
    });
    this.update();
    this.fitToView();
  }

  setHighlight(ids, dim) { this.highlight = ids; this.dimMode = dim; this.applyClasses(); }

  setFocus(id) { this.focusedId = id; this.applyClasses(); }

  /**
   * Before hiding a folder’s children, collapse every expanded folder in that subtree.
   * Otherwise reopening the parent restores nested folders still expanded (confusing UX).
   */
  collapseExpandedDescendants(d3Node) {
    if (!d3Node.children?.length) return;
    for (const c of d3Node.children) this.collapseExpandedDescendants(c);
    for (const c of d3Node.children) {
      if (c.depth >= 1 && c.data.type === 'folder' && c.children) {
        c._children = c.children;
        c.children = null;
      }
    }
  }

  toggleFolder(id) {
    const n = this.root.descendants().find((x) => x.data.id === id);
    if (!n) return;
    if (n.children) {
      this.collapseExpandedDescendants(n);
      n._children = n.children;
      n.children = null;
    } else if (n._children) {
      n.children = n._children;
      n._children = null;
    }
    this.update();
  }

  /** Collapse every node below the root (back to "depth 0 + 1 visible" baseline). */
  collapseAll() {
    if (!this.root) return;
    this.root.descendants().forEach((n) => {
      if (n.depth >= 1 && n.children) {
        n._children = n.children;
        n.children = null;
      }
    });
    this.update();
  }

  expandPathTo(idset) {
    const walk = (n) => {
      if (idset.has(n.data.id) && n._children) { n.children = n._children; n._children = null; }
      (n.children || []).forEach(walk);
    };
    walk(this.root);
    this.update();
  }

  focus(id) {
    const n = this.layout().descendants().find((x) => x.data.id === id);
    if (!n) return;
    const w = this.svg.node().clientWidth;
    const h = this.svg.node().clientHeight;
    if (!w || !h) return;
    const [x, y] = this.coords(n);
    const t = d3.zoomIdentity.translate(w / 2 - x, h / 2 - y).scale(0.95);
    this.svg.transition().duration(500).call(this.zoom.transform, t);
  }

  fitToView() {
    const w = this.svg.node().clientWidth;
    const h = this.svg.node().clientHeight;
    if (!w || !h) {
      requestAnimationFrame(() => this.fitToView());
      return;
    }
    const ns = this.layout().descendants();
    if (!ns.length) return;
    let topEdge = Infinity; let bottomEdge = -Infinity; let leftEdge = Infinity; let
      rightEdge = -Infinity;
    ns.forEach((n) => {
      const [x, y] = this.coords(n);
      let halfW; let
        halfH;
      if (n.depth === 0) { halfW = ROOT_LOGO_W / 2; halfH = ROOT_LOGO_H / 2; } else if (n.data.type === 'leaf') {
        halfW = n.data.meta?.nodeType === 'architecture' ? ARCH_W / 2 : NODE_W / 2;
        halfH = n.data.meta?.nodeType === 'architecture' ? ARCH_H / 2 : NODE_H / 2;
      } else if (n.depth === 1) { halfW = TOP_W / 2; halfH = TOP_H / 2 + 18; } else { halfW = SUB_W / 2; halfH = SUB_H / 2; }
      if (x - halfW < leftEdge) leftEdge = x - halfW;
      if (x + halfW > rightEdge) rightEdge = x + halfW;
      if (y - halfH < topEdge) topEdge = y - halfH;
      if (y + halfH > bottomEdge) bottomEdge = y + halfH;
    });
    const PAD_TOP = 24; const
      PAD_X = 28;
    const layoutW = (rightEdge - leftEdge) + PAD_X * 2;
    const layoutH = (bottomEdge - topEdge) + PAD_TOP * 2;
    const s = Math.min(w / layoutW, h / layoutH, 1);
    const tx = w / 2 - ((leftEdge + rightEdge) / 2) * s;
    const ty = PAD_TOP - topEdge * s;
    const t = d3.zoomIdentity.translate(tx, ty).scale(s);
    this.svg.transition().duration(400).call(this.zoom.transform, t);
  }

  layout() {
    this.root.x = 0; this.root.y = 0;
    if (!this.root.children?.length) return this.root;

    const sideOf = (n) => {
      if (n.data?.meta?.side === 'left') return 'left';
      if (n.data?.meta?.side === 'right') return 'right';
      return n.data?.type === 'leaf' ? 'left' : 'right';
    };

    const TRUNK_OFFSET_X = 150;
    const SUB_DEPTH_GAP = NODE_W + 90;
    const SUB_SIBLING_DY = NODE_H + 18;
    const TOP_GAP = ROOT_LOGO_H / 2 + 30;
    const PAD_BETWEEN = 32;

    const subLayout = d3.tree().nodeSize([SUB_SIBLING_DY, SUB_DEPTH_GAP]);
    const cursor = { left: TOP_GAP, right: TOP_GAP };

    for (const child of this.root.children) {
      const side = sideOf(child);
      const sign = side === 'left' ? -1 : 1;
      subLayout(child);
      const baseX = child.x; const
        baseY = child.y;
      child.descendants().forEach((n) => {
        const sib = n.x - baseX;
        const dep = n.y - baseY;
        n.x = sign * dep;
        n.y = sib;
      });
      const halfHeight = (n) => {
        if (n === child) return TOP_H / 2 + 18;
        if (n.data.type === 'leaf') return NODE_H / 2;
        return SUB_H / 2;
      };
      let topEdge = Infinity; let
        bottomEdge = -Infinity;
      child.descendants().forEach((n) => {
        const h = halfHeight(n);
        if (n.y - h < topEdge) topEdge = n.y - h;
        if (n.y + h > bottomEdge) bottomEdge = n.y + h;
      });
      const subHeight = bottomEdge - topEdge;
      const anchorX = sign * TRUNK_OFFSET_X;
      const dy = cursor[side] - topEdge;
      child.descendants().forEach((n) => { n.x += anchorX; n.y += dy; });
      cursor[side] += subHeight + PAD_BETWEEN;
    }
    return this.root;
  }

  coords(n) {
    return [n.x, n.y];
  }

  linkPath(d) {
    const [sx, sy] = this.coords(d.source);
    const [tx, ty] = this.coords(d.target);
    if (d.source.depth === 0) {
      const srcBottom = sy + ROOT_LOGO_H / 2;
      const halfChip = TOP_W / 2;
      const tgtNearX = tx + (tx >= sx ? -halfChip : halfChip);
      return `M${sx},${srcBottom} L${sx},${ty} L${tgtNearX},${ty}`;
    }
    const goesRight = tx >= sx;
    const sourceHalfW = d.source.depth === 1 ? TOP_W / 2 : SUB_W / 2;
    const targetHalfW = d.target.data.meta?.nodeType === 'architecture'
      ? ARCH_W / 2
      : (d.target.data.type === 'leaf' ? NODE_W / 2 : SUB_W / 2);
    const sxE = sx + (goesRight ? sourceHalfW : -sourceHalfW);
    const txE = tx + (goesRight ? -targetHalfW : targetHalfW);
    const midX = (sxE + txE) / 2;
    return `M${sxE},${sy} L${midX},${sy} L${midX},${ty} L${txE},${ty}`;
  }

  update() {
    const root = this.layout();
    const nodes = root.descendants(); const
      links = root.links();

    // ---- links ----
    const linkSel = this.g.selectAll('path.link').data(links, (d) => d.target.data.id);
    linkSel.exit().remove();
    const linkEnter = linkSel.enter().append('path');
    linkEnter.merge(linkSel)
      .attr('class', (d) => {
        let cls = 'link';
        if (d.source.depth === 0) cls += ' link-trunk';
        if (d.target.data.type === 'leaf') cls += ' to-leaf';
        return cls;
      })
      .transition().duration(280)
      .attr('d', (d) => this.linkPath(d));

    // ---- nodes ----
    const sel = this.g.selectAll('g.node-group').data(nodes, (d) => d.data.id);
    sel.exit().remove();
    const enter = sel.enter().append('g')
      .attr('class', (d) => {
        const isRoot = d.depth === 0;
        const base = `node-group ${d.data.type === 'folder' ? 'is-folder' : 'is-leaf'}`;
        const colorCls = d.data.meta?.color ? ` color-${d.data.meta.color}` : '';
        if (isRoot) return `${base} is-root${colorCls}`;
        if (d.data.type === 'folder' && d.depth === 1) return `${base} is-toplevel${colorCls}`;
        if (d.data.type === 'leaf') {
          const k = STATUS_TO_CLASS[d.data.meta?.status || STATUS_DEFAULT];
          const archCls = d.data.meta?.nodeType === 'architecture' ? ' is-arch' : '';
          return `${base} status-${k}${colorCls}${archCls}`;
        }
        return base + colorCls;
      })
      .attr('transform', (d) => { const [x, y] = this.coords(d); return `translate(${x},${y})`; })
      .on('click', (e, d) => {
        e.stopPropagation();
        if (d.data.type === 'leaf') {
          detailPanel.open(d.data);
        } else if (d.depth >= 1) {
          this.toggleFolder(d.data.id);
          // Same focus-path treatment as leaves: highlight connectors + pan.
          detailPanel.open(d.data);
        }
      });

    // root logo
    const rootEnter = enter.filter((d) => d.depth === 0);
    rootEnter.filter((d) => d.data.meta?.logo).append('image').attr('class', 'root-logo')
      .attr('href', (d) => d.data.meta.logo)
      .attr('x', -ROOT_LOGO_W / 2)
      .attr('y', -ROOT_LOGO_H / 2)
      .attr('width', ROOT_LOGO_W)
      .attr('height', ROOT_LOGO_H)
      .attr('preserveAspectRatio', 'xMidYMid meet');
    const rootNoLogo = rootEnter.filter((d) => !d.data.meta?.logo);
    rootNoLogo.append('rect').attr('class', 'root-bg')
      .attr('x', -70).attr('y', -18)
      .attr('width', 140)
      .attr('height', 36);
    rootNoLogo.append('text').attr('class', 'branch-label').attr('text-anchor', 'middle').attr('y', 1)
      .text((d) => d.data.meta.title || d.data.name);

    // top-level chip
    const topEnter = enter.filter((d) => d.depth === 1 && d.data.type === 'folder');
    topEnter.append('rect').attr('class', (d) => {
      const empty = !((d.children || d._children || []).length);
      return `branch-bg${empty ? ' is-empty' : ''}`;
    })
      .attr('x', -TOP_W / 2).attr('y', -TOP_H / 2)
      .attr('width', TOP_W)
      .attr('height', TOP_H);
    const topFo = topEnter.append('foreignObject')
      .attr('x', -TOP_W / 2 + 10).attr('y', -TOP_H / 2)
      .attr('width', TOP_W - 36)
      .attr('height', TOP_H);
    topFo.append('xhtml:div').attr('class', 'chip-label-html')
      .text((d) => d.data.meta.title || d.data.name);
    topEnter.append('text').attr('class', 'branch-toggle').attr('y', 4).attr('x', TOP_W / 2 - 12)
      .attr('text-anchor', 'end')
      .text((d) => (d._children ? '+' : '−'));
    topEnter.append('text').attr('class', 'branch-sub').attr('text-anchor', 'middle').attr('y', TOP_H / 2 + 14)
      .text((d) => {
        const c = countLeaves(d.data);
        const k = (d._children?.length ?? d.children?.length ?? 0);
        return `${k} child · ${c} doc${c === 1 ? '' : 's'}`;
      });
    // sub-branch
    const branchEnter = enter.filter((d) => d.depth > 1 && d.data.type === 'folder');
    branchEnter.append('rect').attr('class', (d) => {
      const empty = !((d.children || d._children || []).length);
      return `subbranch-bg${empty ? ' is-empty' : ''}`;
    })
      .attr('x', -SUB_W / 2).attr('y', -SUB_H / 2)
      .attr('width', SUB_W)
      .attr('height', SUB_H);
    const subFo = branchEnter.append('foreignObject')
      .attr('x', -SUB_W / 2 + 8).attr('y', -SUB_H / 2)
      .attr('width', SUB_W - 36)
      .attr('height', SUB_H);
    subFo.append('xhtml:div').attr('class', 'subbranch-label-html')
      .text((d) => d.data.meta.title || d.data.name);
    branchEnter.append('text').attr('class', 'branch-toggle').attr('y', 4).attr('x', SUB_W / 2 - 10)
      .attr('text-anchor', 'end')
      .text((d) => (d._children ? '+' : '−'));
    // leaf — regular (non-architecture)
    const leafEnter = enter.filter((d) => d.data.type === 'leaf');
    const regularLeafEnter = leafEnter.filter((d) => d.data.meta?.nodeType !== 'architecture');
    regularLeafEnter.append('rect').attr('class', 'leaf-rect')
      .attr('x', -NODE_W / 2).attr('y', -NODE_H / 2)
      .attr('width', NODE_W)
      .attr('height', NODE_H);
    regularLeafEnter.append('rect').attr('class', 'leaf-band')
      .attr('x', -NODE_W / 2 + 1).attr('y', -NODE_H / 2 + 1)
      .attr('width', 5)
      .attr('height', NODE_H - 2)
      .attr('rx', 2);
    regularLeafEnter.append('circle').attr('class', (d) => `leaf-status-dot ${STATUS_TO_CLASS[d.data.meta?.status || STATUS_DEFAULT]}`)
      .attr('cx', -NODE_W / 2 + 14).attr('cy', 0)
      .attr('r', 5);
    const EXTLINK_PATH = 'M15 3h6v6 M10 14L21 3 M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6';
    regularLeafEnter.filter((d) => leafHasDocLinks(d.data.meta)).append('g')
      .attr('class', 'leaf-doc-icon')
      .attr('transform', `translate(${NODE_W / 2 - 18}, 0)`)
      .attr('aria-hidden', 'true')
      .each(function () { d3.select(this).append('title').text('Open document'); })
      .append('g')
      .attr('class', 'leaf-doc-icon-inner')
      .append('path')
      .attr('d', EXTLINK_PATH)
      .attr('transform', 'translate(-9.5,-9.5) scale(0.80)');
    const leafFo = regularLeafEnter.append('foreignObject')
      .attr('x', -NODE_W / 2 + 24).attr('y', -NODE_H / 2 + 5)
      .attr('width', (d) => (leafHasDocLinks(d.data.meta) ? NODE_W - 56 : NODE_W - 32))
      .attr('height', NODE_H - 10);
    leafFo.append('xhtml:div').attr('class', 'leaf-label-html')
      .text((d) => d.data.meta.title || d.data.name);

    // leaf — architecture card
    const archLeafEnter = leafEnter.filter((d) => d.data.meta?.nodeType === 'architecture');
    archLeafEnter.append('rect').attr('class', 'arch-leaf-rect')
      .attr('x', -ARCH_W / 2).attr('y', -ARCH_H / 2)
      .attr('width', ARCH_W)
      .attr('height', ARCH_H);
    archLeafEnter.append('rect').attr('class', 'arch-leaf-band')
      .attr('x', -ARCH_W / 2 + 1).attr('y', -ARCH_H / 2 + 1)
      .attr('width', 4)
      .attr('height', ARCH_H - 2)
      .attr('rx', 2);
    archLeafEnter.append('image').attr('class', 'arch-leaf-icon')
      .attr('href', '/assets/architecture-cockpit/image.png')
      .attr('x', ARCH_W / 2 - 24)
      .attr('y', -10)
      .attr('width', 20)
      .attr('height', 20)
      .attr('preserveAspectRatio', 'xMidYMid meet');
    const archFo = archLeafEnter.append('foreignObject')
      .attr('x', -ARCH_W / 2 + 14).attr('y', -ARCH_H / 2 + 6)
      .attr('width', ARCH_W - 50)
      .attr('height', ARCH_H - 12);
    archFo.append('xhtml:div').attr('class', 'arch-leaf-label-html')
      .text((d) => d.data.meta.title || d.data.name);

    // merge transitions
    sel.merge(enter).transition().duration(280)
      .attr('transform', (d) => { const [x, y] = this.coords(d); return `translate(${x},${y})`; });
    this.g.selectAll('g.node-group').each(function (d) {
      if (d.depth >= 1 && d.data.type === 'folder') {
        d3.select(this).select('.branch-toggle').text(d._children ? '+' : '−');
      }
    });
    this.applyClasses();
  }

  applyClasses() {
    const hi = this.highlight; const dim = this.dimMode; const
      { focusedId } = this;

    // ----- focus-mode handling -----
    // When focused: mark focused node + ancestors as visible, dim all others.
    let focusedNode = null;
    const focusedAncestors = new Set();
    if (focusedId) {
      const ns = this.layout().descendants();
      focusedNode = ns.find((x) => x.data.id === focusedId) || null;
      if (focusedNode) {
        focusedNode.ancestors().forEach((a) => focusedAncestors.add(a.data.id));
      }
    }

    const isAncestorOfMatch = (n) => {
      const stack = [n];
      while (stack.length) {
        const c = stack.pop();
        if (hi.has(c.data.id)) return true;
        (c.children || []).forEach((x) => stack.push(x));
      }
      return false;
    };

    this.g.selectAll('g.node-group')
      .classed('match', (d) => hi.has(d.data.id))
      .classed('is-focused', (d) => focusedId && d.data.id === focusedId)
      .classed('dim', (d) => {
        // search/filter dimming
        if (dim) return !hi.has(d.data.id) && !isAncestorOfMatch(d);
        // focus-mode dimming
        if (focusedId) return !focusedAncestors.has(d.data.id);
        return false;
      });

    // Connector "on focus path" treatment
    this.g.selectAll('path.link')
      .classed('on-focus-path', (d) => focusedId && (focusedAncestors.has(d.source.data.id) && focusedAncestors.has(d.target.data.id)))
      .classed('dim', (d) => {
        if (focusedId) return !(focusedAncestors.has(d.source.data.id) && focusedAncestors.has(d.target.data.id));
        return false;
      });
  }
}

/* ============================================================================
   Bootstrap
   ============================================================================ */
let renderer;
let fuse = null;

async function fetchJSON(url) {
  const res = await fetch(url, { cache: 'no-cache' });
  if (!res.ok) throw new Error(`${res.status} ${res.statusText} — ${url}`);
  return res.json();
}
function getAccountFromUrl() { return new URL(window.location.href).searchParams.get('account'); }
function setAccountInUrl(id) {
  const u = new URL(window.location.href);
  u.searchParams.set('account', id);
  history.replaceState(null, '', u.toString());
}

async function loadAccount(account) {
  const loading = document.getElementById('loading');
  loading.style.display = 'grid'; loading.textContent = 'Loading metamodel…';
  try {
    const raw = await fetchJSON(`/data/${account.file}`);
    const tree = normalize(raw);
    byId = new Map(); parents = new Map(); leaves = [];
    flatten(tree);

    if (!renderer) renderer = new GraphRenderer(document.getElementById('canvas'));
    else renderer.reset();
    renderer.setData(tree);

    fuse = new Fuse(leaves, {
      keys: [
        'meta.title',
        'meta.description',
        'name',
        'path',
        'meta.status',
        'meta.documents.fileName',
        'meta.documents.filePath',
      ],
      threshold: 0.35,
      ignoreLocation: true,
    });

    filters.mount();
    // No filters.apply() here. The renderer's own update() in setData() has
    // already painted the clean default state (no highlight, no dim, no focus).
    // apply() runs only when the user actually toggles a filter — that prevents
    // any chance of a dim-everything state appearing on first paint.
    // Defensive belt-and-braces: also explicitly clear any residual highlight.
    renderer.setHighlight(new Set(), false);
    renderer.setFocus(null);
    renderCompleteness();
    detailPanel.close();

    loading.style.display = 'none';
  } catch (err) {
    loading.style.color = 'var(--st-notstarted)';
    loading.textContent = `Error loading ${account.file}: ${err.message}`;
    console.error(err);
  }
}

async function bootstrap() {
  let manifest;
  try {
    manifest = await fetchJSON('/data/_accounts.json');
  } catch (err) {
    document.getElementById('loading').style.color = 'var(--st-notstarted)';
    document.getElementById('loading').textContent = `Could not load data/_accounts.json. Serve via "python -m http.server" (file:// blocks fetch). ${err.message}`;
    return;
  }

  const picker = document.getElementById('account-picker');
  picker.innerHTML = '';
  manifest.accounts.forEach((a) => {
    const opt = document.createElement('option');
    opt.value = a.id; opt.textContent = a.title;
    picker.appendChild(opt);
  });
  const requested = getAccountFromUrl() || manifest.default;
  const chosen = manifest.accounts.find((a) => a.id === requested) || manifest.accounts[0];
  picker.value = chosen.id;
  setAccountInUrl(chosen.id);
  await loadAccount(chosen);

  picker.addEventListener('change', async () => {
    const id = picker.value;
    const acc = manifest.accounts.find((a) => a.id === id);
    if (!acc) return;
    setAccountInUrl(id);
    await loadAccount(acc);
  });

  // Topbar buttons
  document.getElementById('reset-view').addEventListener('click', () => {
    if (!renderer) return;
    detailPanel.close();
    renderer.setHighlight(new Set(), false);
    renderer.setFocus(null);
    renderer.collapseAll(); // back to depth-0+1 baseline
    // Slight delay so the close transition + collapse update settle, then center.
    setTimeout(() => renderer.fitToView(), 360);
  });
  // Global keys
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') { closeDocViewer(); detailPanel.close(); closeModalPopup(); }
    if (e.key === '[' && (e.ctrlKey || e.metaKey)) {
      e.preventDefault();
      document.getElementById('left-panel-toggle').click();
    }
  });

  window.addEventListener('resize', () => {
    if (renderer) renderer.fitToView();
  });
}

bootstrap();
