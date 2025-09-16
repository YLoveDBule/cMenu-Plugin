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

        const menuWidth = cMenu.offsetWidth;
        const menuHeight = cMenu.offsetHeight;
        const GAP = Number(settings.cMenuBottomValue) || 0; // configurable gap from selection

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

        let vpLeft = 0;
        let vpTop = 0;
        if ((settings.cMenuDockMode ?? 'follow') === 'fixed') {
          // Fixed: center at top of editor bounds, shifted by GAP
          vpLeft = boundsRect.left + Math.max(0, (boundsRect.width - menuWidth) / 2);
          vpTop = boundsRect.top + GAP;
        } else {
          // Follow: align to selection start, choose above/below
          let startX = rect.left;
          try {
            const sel = document.getSelection();
            if (sel && sel.rangeCount > 0) {
              const rng = sel.getRangeAt(0).cloneRange();
              rng.collapse(true);
              const startRect = rng.getBoundingClientRect();
              if (startRect && (startRect.width || startRect.height)) {
                startX = startRect.left;
              }
            }
          } catch (_) {}
          vpLeft = startX;
          const availableAbove = rect.top - boundsRect.top;
          const availableBelow = boundsRect.bottom - rect.bottom;
          const placeBelow = availableAbove < (menuHeight + GAP) && availableBelow >= (menuHeight + GAP);
          vpTop = placeBelow ? (rect.bottom + GAP) : (rect.top - menuHeight - GAP);
        }

        // Clamp horizontally within editor bounds
        const minLeft = boundsRect.left + GAP;
        const maxLeft = boundsRect.right - menuWidth - GAP;
        vpLeft = Math.max(minLeft, Math.min(vpLeft, maxLeft));

        // Clamp vertically within editor bounds
        const minTop = boundsRect.top + GAP;
        const maxTop = boundsRect.bottom - menuHeight - GAP;
        vpTop = Math.max(minTop, Math.min(vpTop, maxTop));

        // Convert to parent-local coordinates for absolute positioning
        const parentEl = cMenu.parentElement as HTMLElement | null;
        const parentRect = parentEl?.getBoundingClientRect();
        const localLeft = vpLeft - (parentRect ? parentRect.left : 0);
        const localTop = vpTop - (parentRect ? parentRect.top : 0);

        cMenu.style.left = `${localLeft}px`;
        cMenu.style.top = `${localTop}px`;
        cMenu.style.bottom = "auto";
        cMenu.style.right = "auto";
        // After coordinates are applied, reveal menu (if globally enabled)
        cMenu.style.visibility = 'visible';
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
