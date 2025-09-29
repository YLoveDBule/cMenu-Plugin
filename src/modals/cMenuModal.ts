import type { cMenuSettings } from "src/settings/settingsData";
import { App, Command, MarkdownView, ButtonComponent, debounce, Notice } from "obsidian";
import { wait } from "src/util/util";
import { setBottomValue } from "src/util/statusBarConstants";

export function selfDestruct() {
  let cMenuModalBar = document.getElementById("cMenuModalBar");
  if (cMenuModalBar) {
    if (cMenuModalBar.firstChild) {
      cMenuModalBar.removeChild(cMenuModalBar.firstChild);
    }
    cMenuModalBar.remove();
  }
}

export function cMenuPopover(app: App, settings: cMenuSettings): void {
  // Ensure we only ever register one global selectionchange handler.
  // The handler reads DOM each time, so it stays valid even if the menu is recreated.
  // Placement cache to skip redundant layout
  let __lastPlacementSig: string | undefined;
  let __lastShouldShow: boolean | undefined;
  // Cached menu size to avoid reflow on every selectionchange
  let __menuSize = { w: 0, h: 0 };
  let __menuSizeDirty = true;
  // Shared caret start rect for vertical baseline (per tick)
  let __startRectGlobal: DOMRect | DOMRectReadOnly | undefined;
  let handlerInstalled = (window as any).__cMenuSelectionHandlerInstalled as boolean | undefined;
  if (!handlerInstalled) {
    const onSelectionChange = debounce(() => {
      // Schedule on next frame to avoid reading layout mid-event
      requestAnimationFrame(() => {
        const cMenu = document.getElementById("cMenuModalBar");
        const activeLeaf = app.workspace.getActiveViewOfType(MarkdownView);
        if (!cMenu || !activeLeaf) return;

        // Respect global manual visibility toggle
        const enabled = (window as any).__cMenuEnabled;
        if (enabled === false) {
          cMenu.style.visibility = "hidden";
          return;
        }

        const dockMode = settings.cMenuDockMode ?? 'follow';
        const hasSelection = activeLeaf.editor.somethingSelected();
        // For follow mode without selection, keep hidden and exit early
        if (dockMode !== 'fixed' && !hasSelection) {
          cMenu.style.visibility = 'hidden';
          return;
        }

        const selection = window.getSelection();
        let rect: DOMRect | DOMRectReadOnly | undefined;
        if (selection && selection.rangeCount > 0) {
          const range = selection.getRangeAt(0);
          rect = range.getBoundingClientRect();
          if ((!rect || (rect.width === 0 && rect.height === 0)) && range.getClientRects().length > 0) {
            rect = range.getClientRects()[0] as DOMRect;
          }
        }

        if (!rect) {
          const node = selection?.focusNode ?? selection?.anchorNode;
          const el = node && node.nodeType === Node.ELEMENT_NODE ? (node as Element) : (node as ChildNode | null)?.parentElement ?? null;
          rect = el?.getBoundingClientRect();
        }

        if (!rect && (settings.cMenuDockMode ?? 'follow') !== 'fixed') {
          cMenu.style.visibility = "hidden";
          return;
        }

        // Measure menu size only when needed
        if (__menuSizeDirty || __menuSize.w <= 0 || __menuSize.h <= 0) {
          __menuSize.w = cMenu.offsetWidth;
          __menuSize.h = cMenu.offsetHeight;
          __menuSizeDirty = false;
        }
        let menuWidth = __menuSize.w;
        let menuHeight = __menuSize.h;
        const rawGap = Number(settings.cMenuBottomValue);
        const GAP = Number.isFinite(rawGap) ? rawGap : 0; // configurable gap from selection
        const FOLLOW_GAP_MIN = Number.isFinite(settings.cMenuFollowGapMin as any) ? (settings.cMenuFollowGapMin as number) : 6;
        const TABLE_GAP_MIN = Number.isFinite(settings.cMenuTableGapMin as any) ? (settings.cMenuTableGapMin as number) : 10;
        const TABLE_GAP_ABOVE_CFG = Number.isFinite(settings.cMenuTableGapAbove as any) ? (settings.cMenuTableGapAbove as number) : 6;
        const FOLLOW_GAP = Math.max(GAP, FOLLOW_GAP_MIN); // minimal breathing room for normal selections
        const TABLE_GAP = Math.max(GAP, TABLE_GAP_MIN); // stronger breathing room in tables

        // Determine editor bounds: prefer container closest to selection anchor
        const mdView = app.workspace.getActiveViewOfType(MarkdownView);
        const contentRoot = mdView?.contentEl as HTMLElement | undefined;
        const anchorNode = selection?.anchorNode as Node | null;
        const anchorEl = (anchorNode && (anchorNode as any).nodeType === Node.ELEMENT_NODE)
          ? (anchorNode as Element)
          : ((anchorNode as ChildNode | null)?.parentElement ?? null);
        const editorBoundsEl = (anchorEl?.closest('.cm-scroller, .cm-editor, .markdown-source-view') as HTMLElement)
          || (contentRoot?.querySelector('.cm-scroller') as HTMLElement)
          || (contentRoot?.querySelector('.cm-editor') as HTMLElement)
          || (contentRoot?.querySelector('.markdown-source-view') as HTMLElement)
          || contentRoot
          || document.body;
        const boundsRect = editorBoundsEl.getBoundingClientRect();
        // Detect if selection is inside a Markdown table (Live Preview / Preview)
        const tableLike = anchorEl
          ? (anchorEl.closest('table, .markdown-rendered table, .cm-table, .HyperMD-table') as HTMLElement | null)
          : null;
        const tableCell = anchorEl
          ? (anchorEl.closest('td, th, .cm-table-cell, .HyperMD-table-cell') as HTMLElement | null)
          : null;
        const inTable = !!tableLike;
        const tableRect = (tableCell ?? tableLike)?.getBoundingClientRect();
        const tableBoxRect = tableLike?.getBoundingClientRect();

        let vpLeft = 0;
        let vpTop = 0;

        // Visibility decision for caching
        const shouldShow = (settings.cMenuDockMode ?? 'follow') === 'fixed' ? true : hasSelection;
        // Build a lightweight signature of inputs that affect placement
        const sigParts = [
          (settings.cMenuDockMode ?? 'follow'),
          shouldShow ? 1 : 0,
          inTable ? 1 : 0,
          rect?.left ?? 0, rect?.top ?? 0, rect?.width ?? 0, rect?.height ?? 0,
          boundsRect.left, boundsRect.top, boundsRect.right, boundsRect.bottom,
          __menuSize.w, __menuSize.h,
          GAP, FOLLOW_GAP, TABLE_GAP, TABLE_GAP_ABOVE_CFG,
          settings.cMenuAllowTableOverflow ? 1 : 0,
          settings.cMenuCompactInTable ? 1 : 0,
        ];
        const placementSig = sigParts.join('|');
        if (__lastPlacementSig === placementSig && __lastShouldShow === shouldShow) {
          // No change: ensure visibility is correct and skip heavy reposition
          if (shouldShow) {
            cMenu.style.visibility = 'visible';
          } else {
            cMenu.style.visibility = 'hidden';
          }
          return;
        }
        if ((settings.cMenuDockMode ?? 'follow') === 'fixed') {
          // Fixed: center at top of editor bounds, shifted by GAP
          vpLeft = boundsRect.left + Math.max(0, (boundsRect.width - menuWidth) / 2);
          vpTop = boundsRect.top + GAP;
        } else {
          // Follow: align to selection start, choose above/below
          let startX = rect.left;
          __startRectGlobal = undefined;
          try {
            const sel = document.getSelection();
            if (sel && sel.rangeCount > 0) {
              const rng = sel.getRangeAt(0).cloneRange();
              rng.collapse(true);
              const startRect = rng.getBoundingClientRect();
              if (startRect && (startRect.width || startRect.height)) {
                startX = startRect.left;
                __startRectGlobal = startRect as DOMRect;
              }
            }
          } catch (_) {}
          vpLeft = startX;
          const target = (tableRect ?? rect);
          const gapUsed = inTable ? TABLE_GAP : FOLLOW_GAP;
          let tightVertical = false; // 表格內是否上下空間都不足
          if (inTable) {
            // 表格內：以選區rect為基準，垂直上方優先，否則下方；上下都不足時選重疊更小的一側
            const minX = boundsRect.left + GAP;
            const maxX = boundsRect.right - menuWidth - GAP;
            const minY = boundsRect.top + TABLE_GAP;
            const maxY = boundsRect.bottom - menuHeight - TABLE_GAP;
            const clampX = (x: number) => Math.max(minX, Math.min(x, maxX));
            const clampY = (y: number) => Math.max(minY, Math.min(y, maxY));
            const TABLE_GAP_ABOVE = Math.min(TABLE_GAP, TABLE_GAP_ABOVE_CFG); // 讓上方更貼近選區

            // 水平位置：對齊選區居中
            const centerX = target.left + Math.max(0, (target.width - menuWidth) / 2);
            vpLeft = clampX(centerX);

            const vBase = (settings.cMenuUseStartRectVertical && __startRectGlobal && (__startRectGlobal.width || __startRectGlobal.height)) ? (__startRectGlobal as DOMRect) : target;
            const availableAbove = vBase.top - boundsRect.top;
            const availableBelow = boundsRect.bottom - vBase.bottom;
            const canAbove = availableAbove >= (menuHeight + TABLE_GAP);
            const canBelow = availableBelow >= (menuHeight + TABLE_GAP);
            if (canAbove) {
              vpTop = clampY(vBase.top - menuHeight - TABLE_GAP_ABOVE);
            } else if (canBelow) {
              vpTop = clampY(vBase.bottom + TABLE_GAP);
            } else {
              // 極端狀況：上下皆不足，選擇重疊較小的一側（仍保持上下擺放，不側向）
              const tryAbove = clampY(vBase.top - menuHeight - TABLE_GAP_ABOVE);
              const tryBelow = clampY(vBase.bottom + TABLE_GAP);
              const overlapAbove = Math.max(0, (tryAbove + menuHeight) - vBase.top);
              const overlapBelow = Math.max(0, vBase.bottom - tryBelow);
              vpTop = overlapAbove <= overlapBelow ? tryAbove : tryBelow;
            }
          } else {
            // Non-table: original above/below heuristic
            const vBase = (settings.cMenuUseStartRectVertical && __startRectGlobal && (__startRectGlobal.width || __startRectGlobal.height)) ? (__startRectGlobal as DOMRect) : target;
            const availableAbove = vBase.top - boundsRect.top;
            const availableBelow = boundsRect.bottom - vBase.bottom;
            const placeBelow = availableAbove < (menuHeight + FOLLOW_GAP) && availableBelow >= (menuHeight + FOLLOW_GAP);
            vpTop = placeBelow ? (vBase.bottom + FOLLOW_GAP) : (vBase.top - menuHeight - FOLLOW_GAP);
          }
        }

        // Optional COMPACT MODE (wrap) for narrow table area + 溢出模式联动
        const allowOverflow = !!settings.cMenuAllowTableOverflow;
        const wantCompact = !!settings.cMenuCompactInTable;
        const baseWrap = (settings.cMenuOverflowMode ?? 'wrap') === 'wrap';
        if (inTable && wantCompact && (!allowOverflow || (menuWidth + 2 * GAP > boundsRect.width))) {
          // Enable compact: wrap and clamp max-width to editor bounds
          const maxW = Math.max(160, Math.floor(boundsRect.width - 2 * GAP));
          if (cMenu.style.flexWrap !== 'wrap' || cMenu.style.maxWidth !== `${maxW}px`) {
            cMenu.classList.add('cMenuCompact');
            cMenu.style.flexWrap = 'wrap';
            cMenu.style.maxWidth = `${maxW}px`;
            cMenu.style.overflowX = 'hidden';
            // Remeasure after style change
            __menuSize.w = cMenu.offsetWidth;
            __menuSize.h = cMenu.offsetHeight;
            menuWidth = __menuSize.w;
            menuHeight = __menuSize.h;
          }
        } else {
          // Apply base overflow mode when not in compact
          const expectedWrap = baseWrap ? 'wrap' : 'nowrap';
          const expectedOverflowX = baseWrap ? 'hidden' : 'auto';
          let changed = false;
          if (cMenu.classList.contains('cMenuCompact')) { cMenu.classList.remove('cMenuCompact'); changed = true; }
          if (cMenu.style.flexWrap !== expectedWrap) { cMenu.style.flexWrap = expectedWrap; changed = true; }
          if (!baseWrap && cMenu.style.maxWidth) { cMenu.style.maxWidth = ''; changed = true; }
          if (cMenu.style.overflowX !== expectedOverflowX) { cMenu.style.overflowX = expectedOverflowX; changed = true; }
          if (changed) {
            __menuSize.w = cMenu.offsetWidth;
            __menuSize.h = cMenu.offsetHeight;
            menuWidth = __menuSize.w;
            menuHeight = __menuSize.h;
          }
        }

        // Clamp horizontally; 在表格且過窄时且允许越界时改用容器边界
        const containerRect = (cMenu.parentElement?.getBoundingClientRect()) || document.body.getBoundingClientRect();
        const tooWideForBounds = inTable && allowOverflow && (menuWidth + 2 * GAP > boundsRect.width);
        const minLeft = (tooWideForBounds ? containerRect.left : boundsRect.left) + GAP;
        const maxLeft = (tooWideForBounds ? containerRect.right : boundsRect.right) - menuWidth - GAP;
        vpLeft = Math.max(minLeft, Math.min(vpLeft, maxLeft));

        // Clamp vertically; 表格且上下皆不足且允许越界时改用容器边界
        const activeGap = (settings.cMenuDockMode ?? 'follow') === 'fixed' ? GAP : (inTable ? TABLE_GAP : FOLLOW_GAP);
        const targetY = (tableRect ?? rect);
        const vBaseY = (settings.cMenuUseStartRectVertical && __startRectGlobal && (__startRectGlobal.width || __startRectGlobal.height)) ? (__startRectGlobal as DOMRect) : targetY;
        const needContainerY = !!(inTable && allowOverflow && vBaseY &&
          ((vBaseY.top - boundsRect.top) < (menuHeight + TABLE_GAP)) &&
          ((boundsRect.bottom - vBaseY.bottom) < (menuHeight + TABLE_GAP)));
        const useContainerY = needContainerY;
        const minTop = (useContainerY ? containerRect.top : boundsRect.top) + activeGap;
        const maxTop = (useContainerY ? containerRect.bottom : boundsRect.bottom) - menuHeight - activeGap;
        const beforeClampTop = vpTop;
        vpTop = Math.max(minTop, Math.min(vpTop, maxTop));

        // Final collision check with selection/cell; try to adjust if overlapping
        const targetForCollision = (tableRect ?? rect);
        if (targetForCollision) {
          const overlapsVert = (vpTop < targetForCollision.bottom) && (vpTop + menuHeight > targetForCollision.top);
          const overlapsHorz = (vpLeft < targetForCollision.right) && (vpLeft + menuWidth > targetForCollision.left);
          if (overlapsVert && overlapsHorz) {
            const menuRectNow = cMenu.getBoundingClientRect();
            const selRectNow = targetForCollision as DOMRect | DOMRectReadOnly;
            if (!inTable) {
              // Try above, then below with FOLLOW_GAP
              const tryAbove = Math.max(minTop, Math.min(targetForCollision.top - menuHeight - FOLLOW_GAP, maxTop));
              const tryBelow = Math.min(maxTop, Math.max(targetForCollision.bottom + FOLLOW_GAP, minTop));
              // Prefer side that produces less overlap
              const aboveOverlap = (tryAbove + menuHeight > targetForCollision.top);
              const belowOverlap = (tryBelow < targetForCollision.bottom);
              if (!aboveOverlap) vpTop = tryAbove; else if (!belowOverlap) vpTop = tryBelow; else vpTop = (targetForCollision.top - boundsRect.top > boundsRect.bottom - targetForCollision.bottom) ? tryAbove : tryBelow;
            } else {
              // In table: 垂直優先的修正（上優先，否則下），上方使用更小間距
              const TABLE_GAP_ABOVE = Math.min(TABLE_GAP, TABLE_GAP_ABOVE_CFG);
              const tryAbove = Math.max(minTop, Math.min(targetForCollision.top - menuHeight - TABLE_GAP_ABOVE, maxTop));
              const tryBelow = Math.min(maxTop, Math.max(targetForCollision.bottom + TABLE_GAP, minTop));
              const aboveOverlap = (tryAbove + menuHeight > targetForCollision.top);
              const belowOverlap = (tryBelow < targetForCollision.bottom);
              if (!aboveOverlap) vpTop = tryAbove; else if (!belowOverlap) vpTop = tryBelow; else vpTop = tryBelow;
            }
          }
        }

        // Overlap correction only for table selections（允許越界：只做垂直回退，使用容器邊界）
        if ((settings.cMenuDockMode ?? 'follow') !== 'fixed' && inTable && (tableRect || rect)) {
          const target = (tableRect ?? rect);
          const gapUsed = TABLE_GAP;
          const TABLE_GAP_ABOVE = Math.min(TABLE_GAP, TABLE_GAP_ABOVE_CFG);
          if (vpTop + menuHeight > target.top && vpTop < target.bottom) {
            const abovePos = Math.max((useContainerY ? containerRect.top : boundsRect.top) + TABLE_GAP_ABOVE,
              Math.min(target.top - menuHeight - TABLE_GAP_ABOVE, (useContainerY ? containerRect.bottom : boundsRect.bottom) - menuHeight - TABLE_GAP_ABOVE));
            const belowPos = Math.min((useContainerY ? containerRect.bottom : boundsRect.bottom) - menuHeight - gapUsed,
              Math.max(target.bottom + gapUsed, (useContainerY ? containerRect.top : boundsRect.top) + gapUsed));
            const aboveOverlap = abovePos + menuHeight > target.top;
            const belowOverlap = belowPos < target.bottom;
            if (!aboveOverlap) vpTop = abovePos; else if (!belowOverlap) vpTop = belowPos; else vpTop = belowPos;
          }
        }

        // Convert to parent-local coordinates for absolute positioning
        const parentEl = cMenu.parentElement as HTMLElement | null;
        const parentRect = parentEl?.getBoundingClientRect();
        const localLeft = vpLeft - (parentRect ? parentRect.left : 0);
        const localTop = vpTop - (parentRect ? parentRect.top : 0);

        cMenu.style.left = `${localLeft}px`;
        cMenu.style.top = `${localTop}px`;
        cMenu.style.bottom = "auto";
        cMenu.style.right = "auto";

        // Second-pass collision fix with actual selection rect
        try {
          const menuRect = cMenu.getBoundingClientRect();
          const selRect = rect as DOMRect | DOMRectReadOnly | undefined;
          if (selRect) {
            const gapFinal = (settings.cMenuDockMode ?? 'follow') === 'fixed' ? GAP : (inTable ? TABLE_GAP : FOLLOW_GAP);
            const overlapsVert = menuRect.top < selRect.bottom && menuRect.bottom > selRect.top;
            const overlapsHorz = menuRect.left < selRect.right && menuRect.right > selRect.left;
            if (overlapsVert && overlapsHorz) {
              // Try move above selection
              const aboveTopVp = selRect.top - menuRect.height - gapFinal;
              const belowTopVp = selRect.bottom + gapFinal;
              const canAbove = aboveTopVp >= (boundsRect.top + gapFinal);
              const canBelow = belowTopVp <= (boundsRect.bottom - menuRect.height - gapFinal);
              let newTopVp: number | null = null;
              if (canAbove) newTopVp = aboveTopVp; else if (canBelow) newTopVp = belowTopVp; else newTopVp = null;
              if (newTopVp !== null) {
                const newTopLocal = newTopVp - (parentRect ? parentRect.top : 0);
                cMenu.style.top = `${newTopLocal}px`;
              }
            }
          }
        } catch (_) {}
        // After coordinates are applied, reveal menu (if globally enabled)
        cMenu.style.visibility = 'visible';
        // Update placement cache
        __lastPlacementSig = placementSig;
        __lastShouldShow = shouldShow;
      });
    }, 16, true);

    document.addEventListener("selectionchange", onSelectionChange);
    (window as any).__cMenuSelectionHandlerRef = onSelectionChange;
    (window as any).__cMenuSelectionHandlerInstalled = true;
  }

  // Initialize global enabled flag from settings on first run
  if (typeof (window as any).__cMenuEnabled === "undefined") {
    (window as any).__cMenuEnabled = settings.cMenuVisibility;
  }

  function createMenu() {
    const generateMenu = () => {
      var cMenu = createEl("div");
      if (cMenu) {
        // Ensure hidden before insertion to avoid flash
        (cMenu as HTMLElement).style.visibility = "hidden";
      }
      cMenu.setAttribute("id", "cMenuModalBar");
      settings.aestheticStyle == "default"
        ? cMenu.addClass("cMenuDefaultAesthetic")
        : cMenu.addClass("cMenuGlassAesthetic");
      // Always insert within the workspace container to scope layout correctly
      app.workspace.containerEl.insertAdjacentElement("afterbegin", cMenu);
      // ---- MRU helpers ----
      const MRU_KEY = 'cMenu.mru.v1';
      type MruItem = { id: string; name: string; icon?: string; type: 'cmd'|'macro'; count: number; lastUsed: number };
      const loadMRU = (): Record<string, MruItem> => {
        try { const raw = localStorage.getItem(MRU_KEY); return raw ? JSON.parse(raw) : {}; } catch { return {}; }
      };
      const saveMRU = (data: Record<string, MruItem>) => { try { localStorage.setItem(MRU_KEY, JSON.stringify(data)); } catch {} };
      const recordMRU = (key: string, name: string, icon: string|undefined, type: 'cmd'|'macro') => {
        const m = loadMRU();
        const now = Date.now();
        const prev = m[key];
        m[key] = { id: key, name: name || key, icon, type, count: (prev?.count ?? 0) + 1, lastUsed: now };
        saveMRU(m);
      };
      const getTopMRU = (limit = 5): MruItem[] => {
        const m = Object.values(loadMRU());
        m.sort((a,b) => (b.lastUsed - a.lastUsed) || (b.count - a.count));
        return m.slice(0, limit);
      };
      const renderMRU = (root: HTMLElement) => {
        const items = getTopMRU(5);
        if (!items.length) return;
        const wrap = createEl('div');
        wrap.style.display = 'flex';
        wrap.style.flexWrap = 'wrap';
        wrap.style.gap = `${Number.isFinite((settings as any).cMenuButtonGap) ? (settings as any).cMenuButtonGap : 6}px`;
        wrap.style.marginRight = '6px';
        // Label
        const label = new ButtonComponent(wrap);
        label.setClass('cMenuCommandItem');
        label.setTooltip('最近使用');
        label.setIcon('clock');
        label.buttonEl.setAttribute('aria-label','最近使用');
        label.setDisabled(true);
        // Buttons
        items.forEach(it => {
          const btn = new ButtonComponent(wrap);
          btn
            .setIcon(it.icon || (it.type==='macro' ? 'bot-glyph' : 'clock'))
            .setClass('cMenuCommandItem')
            .setTooltip(it.name)
            .onClick(async () => {
              if (it.type === 'cmd') {
                //@ts-ignore
                app.commands.executeCommandById(it.id);
                recordMRU(it.id, it.name, it.icon, 'cmd');
                return;
              }
              // macro: find by name
              const macro = (settings.menuCommands as any[]).find(x => x?.type === 'macro' && x?.name === it.name);
              if (macro) {
                try {
                  btn.setDisabled(true);
                  // reuse runMacro defined below
                  await runMacro(macro);
                } finally {
                  btn.setDisabled(false);
                }
                recordMRU('macro:'+it.name, it.name, it.icon, 'macro');
              }
            });
        });
        root.appendChild(wrap);
      };
      // Helper: render a group button with hover/long-press submenu
      const renderGroup = (root: HTMLElement, group: any) => {
        const groupBtn = new ButtonComponent(root);
        groupBtn
          .setIcon(group.icon || "folder")
          .setClass("cMenuCommandItem")
          .setTooltip(group.name || "Group");
        // ARIA and focusable for keyboard
        groupBtn.buttonEl.setAttribute('aria-haspopup', 'menu');
        groupBtn.buttonEl.setAttribute('aria-expanded', 'false');
        groupBtn.buttonEl.tabIndex = 0;

        // Lazy submenu container
        const submenu = createEl("div");
        submenu.addClass("cMenuSubmenu");
        submenu.setAttribute('role', 'menu');
        // Reuse aesthetic style for consistency
        settings.aestheticStyle == "default"
          ? submenu.addClass("cMenuDefaultAesthetic")
          : submenu.addClass("cMenuGlassAesthetic");
        // Layout and initial hidden state
        submenu.style.position = "absolute";
        submenu.style.display = "none";
        submenu.style.padding = "4px";
        submenu.style.zIndex = "9999";
        // Place inside cMenu so cleanup is automatic
        root.appendChild(submenu);

        // Render children (commands and macros)
        const renderChildren = () => {
          submenu.empty();
          const items: any[] = Array.isArray(group.items) ? group.items : [];
          items.forEach((child: any) => {
            if (!child) return;
            // Plain command inside group
            if (!child.type) {
              const childBtn = new ButtonComponent(submenu);
              childBtn
                .setIcon(child.icon)
                .setClass("cMenuCommandItem")
                .setTooltip(child.name)
                .onClick(() => {
                  //@ts-ignore
                  app.commands.executeCommandById(child.id);
                  recordMRU(child.id, child.name, child.icon, 'cmd');
                  // Close submenu after action
                  submenu.style.display = "none";
                  groupBtn.buttonEl.setAttribute('aria-expanded', 'false');
                });
              childBtn.buttonEl.setAttribute('role', 'menuitem');
              return;
            }
            // Macro inside group
            if (child.type === 'macro') {
              const macroBtn = new ButtonComponent(submenu);
              macroBtn
                .setIcon(child.icon || 'bot-glyph')
                .setClass('cMenuCommandItem')
                .setTooltip(child.name || 'Macro')
                .onClick(async () => {
                  try {
                    macroBtn.setDisabled(true);
                    await runMacro(child);
                  } finally {
                    macroBtn.setDisabled(false);
                  }
                  // Close submenu after macro completes
                  submenu.style.display = 'none';
                  groupBtn.buttonEl.setAttribute('aria-expanded', 'false');
                  recordMRU('macro:'+child.name, child.name, child.icon, 'macro');
                });
              macroBtn.buttonEl.setAttribute('role', 'menuitem');
              return;
            }
          });
        };

        // Position submenu relative to button and viewport
        const positionSubmenu = () => {
          const btnEl = groupBtn.buttonEl as HTMLElement;
          const btnRect = btnEl.getBoundingClientRect();
          const parentRect = root.getBoundingClientRect();
          // Default below the button
          let left = btnRect.left - parentRect.left;
          let top = btnRect.bottom - parentRect.top + 6;
          // Measure after making visible temporarily
          const prev = submenu.style.display;
          submenu.style.display = "flex";
          submenu.style.flexWrap = "wrap";
          submenu.style.gap = `${Number.isFinite((settings as any).cMenuButtonGap) ? (settings as any).cMenuButtonGap : 6}px`;
          const sw = submenu.offsetWidth;
          const sh = submenu.offsetHeight;
          submenu.style.display = prev;

          // Flip vertically if not enough space below
          if (btnRect.bottom + sh + 8 > window.innerHeight) {
            top = btnRect.top - parentRect.top - sh - 6;
          }
          // Clamp horizontally within viewport
          if (btnRect.left + sw + 8 > window.innerWidth) {
            left = Math.max(6, window.innerWidth - parentRect.left - sw - 6);
          }
          submenu.style.left = `${left}px`;
          submenu.style.top = `${top}px`;
        };

        let hoverTimer: number | undefined;
        let closeTimer: number | undefined;
        let pressTimer: number | undefined;
        const open = () => {
          clearTimeout(closeTimer);
          renderChildren();
          submenu.style.display = "flex";
          submenu.style.flexWrap = "wrap";
          submenu.style.gap = `${Number.isFinite((settings as any).cMenuButtonGap) ? (settings as any).cMenuButtonGap : 6}px`;
          positionSubmenu();
          groupBtn.buttonEl.setAttribute('aria-expanded', 'true');
        };
        const scheduleOpen = (delay = 150) => {
          clearTimeout(hoverTimer);
          hoverTimer = window.setTimeout(open, delay);
        };
        const scheduleClose = () => {
          clearTimeout(closeTimer);
          closeTimer = window.setTimeout(() => {
            submenu.style.display = "none";
            groupBtn.buttonEl.setAttribute('aria-expanded', 'false');
          }, 150);
        };

        const getChildButtons = (): HTMLElement[] =>
          Array.from(submenu.querySelectorAll('button.cMenuCommandItem')) as HTMLElement[];
        const focusFirstChild = () => {
          const btns = getChildButtons();
          btns[0]?.focus();
        };
        const moveFocus = (delta: number) => {
          const btns = getChildButtons();
          const active = document.activeElement as HTMLElement | null;
          const idx = Math.max(0, btns.findIndex(b => b === active));
          const next = (idx + delta + btns.length) % btns.length;
          btns[next]?.focus();
        };

        // Hover to open with small delay
        groupBtn.buttonEl.addEventListener("mouseenter", () => scheduleOpen(150));
        groupBtn.buttonEl.addEventListener("mouseleave", () => {
          clearTimeout(hoverTimer);
          scheduleClose();
        });
        // Long-press to open
        groupBtn.buttonEl.addEventListener("mousedown", () => {
          pressTimer = window.setTimeout(open, 300);
        });
        groupBtn.buttonEl.addEventListener("mouseup", () => {
          clearTimeout(pressTimer);
        });
        groupBtn.buttonEl.addEventListener("mouseleave", () => {
          clearTimeout(pressTimer);
        });

        // Keyboard interactions on group button
        groupBtn.buttonEl.addEventListener('keydown', (e: KeyboardEvent) => {
          if (e.key === 'Enter' || e.key === ' ' || e.key === 'ArrowDown') {
            e.preventDefault();
            const wasHidden = submenu.style.display === 'none' || !submenu.style.display;
            open();
            if (wasHidden) focusFirstChild();
          }
          if (e.key === 'Escape') {
            e.preventDefault();
            submenu.style.display = 'none';
            groupBtn.buttonEl.setAttribute('aria-expanded', 'false');
          }
        });

        // Keyboard interactions within submenu
        submenu.addEventListener('keydown', (e: KeyboardEvent) => {
          if (e.key === 'Escape') {
            e.preventDefault();
            submenu.style.display = 'none';
            groupBtn.buttonEl.setAttribute('aria-expanded', 'false');
            (groupBtn.buttonEl as HTMLElement).focus();
            return;
          }
          if (e.key === 'ArrowRight' || e.key === 'ArrowDown') {
            e.preventDefault();
            moveFocus(1);
          }
          if (e.key === 'ArrowLeft' || e.key === 'ArrowUp') {
            e.preventDefault();
            moveFocus(-1);
          }
        });

        // Keep open when hovering submenu, close on leave
        submenu.addEventListener("mouseenter", () => {
          clearTimeout(closeTimer);
        });
        submenu.addEventListener("mouseleave", () => scheduleClose());
      };

      // Helper to run a macro sequentially with optional per-step delays, with user feedback
      const runMacro = async (macro: any) => {
        const title = (macro && macro.name) ? macro.name : "宏";
        let steps: Array<{ id: string; delayMs?: number }> = [];
        try {
          steps = Array.isArray(macro?.steps) ? macro.steps : [];
          new Notice(`正在执行：${title}`, 1500);
          for (let i = 0; i < steps.length; i++) {
            const step = steps[i];
            if (!step || !step.id) continue;
            //@ts-ignore
            app.commands.executeCommandById(step.id);
            const d = Number(step.delayMs) || 0;
            if (d > 0) await wait(d);
          }
          new Notice(`已完成：${title}（${steps.length} 步）`, 1500);
        } catch (e) {
          console.error("cMenu macro execution error", e);
          new Notice(`宏执行失败：${title}`, 3000);
        }
      };

      // MRU section first
      renderMRU(cMenu);

      settings.menuCommands.forEach((item) => {
        const anyItem = item as any;
        if (anyItem && anyItem.type === "group") {
          renderGroup(cMenu, anyItem);
          return;
        }
        if (anyItem && anyItem.type === "macro") {
          const btn = new ButtonComponent(cMenu);
          btn
            .setIcon(anyItem.icon || "bot-glyph")
            .setClass("cMenuCommandItem")
            .setTooltip(anyItem.name || "Macro")
            .onClick(async () => {
              try {
                btn.setDisabled(true);
                await runMacro(anyItem);
              } finally {
                btn.setDisabled(false);
              }
              recordMRU('macro:'+ (anyItem.name || 'Macro'), anyItem.name || 'Macro', anyItem.icon, 'macro');
            });
          return;
        }
        if (anyItem && anyItem.type) return; // unknown specialized type
        const button = new ButtonComponent(cMenu);
        button
          .setIcon(anyItem.icon)
          .setClass("cMenuCommandItem")
          .setTooltip(anyItem.name)
          .onClick(() => {
            //@ts-ignore
            app.commands.executeCommandById(anyItem.id);
            recordMRU(anyItem.id, anyItem.name, anyItem.icon, 'cmd');
          });
      });

    };
    let Markdown = app.workspace.getActiveViewOfType(MarkdownView);
    if (Markdown) {
      var cMenuModalBar = document.getElementById("cMenuModalBar");
      if (cMenuModalBar) {
        // Always hide first to avoid flash; global handler will set final visibility
        cMenuModalBar.style.visibility = "hidden";
        document.dispatchEvent(new Event('selectionchange'));
        return;
      } else {
        generateMenu();
        let cMenuModalBar = document.getElementById("cMenuModalBar");
        setBottomValue(settings);
        // Hide first to avoid flash; selectionchange will position and reveal if needed
        cMenuModalBar.style.visibility = "hidden";
        document.dispatchEvent(new Event('selectionchange'));
      }
    } else {
      selfDestruct();
    }
  }
  createMenu();

  // Set up ResizeObserver (single instance)
  try {
    const existing = (window as any).__cMenuResizeObserverRef as ResizeObserver | undefined;
    if (existing) {
      existing.disconnect();
      (window as any).__cMenuResizeObserverRef = undefined;
    }
    const mdView = app.workspace.getActiveViewOfType(MarkdownView);
    const contentRoot = mdView?.contentEl as HTMLElement | undefined;
    const editorBoundsEl = (contentRoot?.querySelector('.cm-scroller') as HTMLElement)
      || (contentRoot?.querySelector('.cm-editor') as HTMLElement)
      || (contentRoot?.querySelector('.markdown-source-view') as HTMLElement)
      || contentRoot
      || document.body;
    const ro = new ResizeObserver(() => {
      setBottomValue(settings);
      if ((settings.cMenuDockMode ?? 'follow') === 'fixed') {
        // Force reposition via a fake selectionchange tick
        document.dispatchEvent(new Event('selectionchange'));
      } else {
        document.dispatchEvent(new Event('selectionchange'));
      }
    });
    ro.observe(editorBoundsEl);
    (window as any).__cMenuResizeObserverRef = ro;
  } catch (_) {
    // ignore if ResizeObserver not available
  }
}
