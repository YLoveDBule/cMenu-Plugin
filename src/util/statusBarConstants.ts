import type { cMenuSettings } from "src/settings/settingsData";

export const setMenuVisibility = (cMenuVisibility: boolean) => {
  // Sync global flag for selectionchange handler
  (window as any).__cMenuEnabled = cMenuVisibility;
  let cMenuModalBar = document.getElementById("cMenuModalBar");
  if (cMenuModalBar) {
    cMenuVisibility == false
      ? (cMenuModalBar.style.visibility = "hidden")
      : (cMenuModalBar.style.visibility = "visible");
  }
};

export const setBottomValue = (settings: cMenuSettings) => {
  const cMenuModalBar = document.getElementById("cMenuModalBar") as HTMLElement | null;
  if (!cMenuModalBar) return;

  // Batch reads/writes in next frame to minimize layout thrashing
  requestAnimationFrame(() => {
    // Write: apply spacing and scale first so measurements reflect new size
    cMenuModalBar.style.gap = `${settings.cMenuButtonGap}px`;
    cMenuModalBar.style.fontSize = `${settings.cMenuButtonScale}em`;

    // Read: determine bounds (editor/content area)
    const contentRoot = document.querySelector('.workspace, .mod-root, .app-container') as HTMLElement | null;
    const anchorEl = cMenuModalBar.parentElement as HTMLElement | null;
    const editorBoundsEl = (anchorEl?.closest('.cm-scroller, .cm-editor, .markdown-source-view') as HTMLElement)
      || (contentRoot?.querySelector('.cm-scroller') as HTMLElement)
      || (contentRoot?.querySelector('.cm-editor') as HTMLElement)
      || (contentRoot?.querySelector('.markdown-source-view') as HTMLElement)
      || contentRoot
      || document.body;
    const boundsRect = editorBoundsEl.getBoundingClientRect();

    // Read: measure a sample button to estimate per-button width
    const sampleBtn = cMenuModalBar.querySelector('button.cMenuCommandItem') as HTMLElement | null;
    const cmdCount = cMenuModalBar.querySelectorAll('button.cMenuCommandItem').length;
    const perBtn = (sampleBtn?.offsetWidth ?? 40) + settings.cMenuButtonGap; // fallback width
    const horizontalPadding = 16; // safety margin within bounds
    const maxColsByWidth = Math.max(1, Math.floor((boundsRect.width - horizontalPadding) / Math.max(1, perBtn)));

    // Apply max width percent and overflow behavior
    const maxWidthPx = Math.max(100, Math.round((boundsRect.width * (settings.cMenuMaxWidthPct ?? 100)) / 100));
    cMenuModalBar.style.maxWidth = `${maxWidthPx}px`;

    if ((settings.cMenuOverflowMode ?? 'wrap') === 'scroll') {
      // Single row, horizontally scrollable if overflow
      cMenuModalBar.style.overflowX = 'auto';
      cMenuModalBar.style.gridAutoFlow = 'column';
      cMenuModalBar.style.gridTemplateColumns = `repeat(${Math.max(1, cmdCount)}, max-content)`;
    } else {
      // Wrap mode with dynamic columns by available width and command count
      const effectiveCols = Math.max(1, Math.min(maxColsByWidth, cmdCount));
      cMenuModalBar.style.overflowX = 'visible';
      cMenuModalBar.style.gridAutoFlow = 'row';
      cMenuModalBar.style.gridTemplateColumns = `repeat(${effectiveCols}, max-content)`;
    }
  });
};
