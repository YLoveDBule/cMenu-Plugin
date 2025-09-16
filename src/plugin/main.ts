import {
  Menu,
  Plugin,
  Command,
  setIcon,
  debounce,
  Editor,
  MarkdownView,
  SliderComponent,
  ToggleComponent,
  DropdownComponent,
  ButtonComponent,
  App,
} from "obsidian";
import { wait } from "src/util/util";
import { appIcons } from "src/icons/appIcons";
import { CommandPicker } from "src/modals/suggesterModals";
import { cMenuSettingTab } from "src/settings/settingsTab";
import { selfDestruct, cMenuPopover } from "src/modals/cMenuModal";
import { cMenuSettings, DEFAULT_SETTINGS, MenuItem } from "src/settings/settingsData";
import addIcons, {
  addFeatherIcons,
  addRemixIcons,
  addBoxIcons,
} from "src/icons/customIcons";

import { setMenuVisibility, setBottomValue } from "src/util/statusBarConstants";

export default class cMenuPlugin extends Plugin {
  app: App;
  settings: cMenuSettings;
  statusBarIcon: HTMLElement;
  cMenuBar: HTMLElement;
  modCommands: Command[] = [
    {
      id: "editor:insert-embed",
      name: "Add embed",
      icon: "note-glyph",
    },
    {
      id: "editor:insert-link",
      name: "Insert markdown link",
      icon: "link-glyph",
    },
    {
      id: "editor:insert-tag",
      name: "Add tag",
      icon: "price-tag-glyph",
    },
    {
      id: "editor:insert-wikilink",
      name: "Add internal link",
      icon: "bracket-glyph",
    },
    {
      id: "editor:toggle-bold",
      name: "Toggle bold",
      icon: "bold-glyph",
    },
    {
      id: "editor:toggle-italics",
      name: "Toggle italics",
      icon: "italic-glyph",
    },
    {
      id: "editor:toggle-strikethrough",
      name: "Toggle strikethrough",
      icon: "strikethrough-glyph",
    },
    {
      id: "editor:toggle-code",
      name: "Toggle code",
      icon: "code-glyph",
    },
    {
      id: "editor:toggle-blockquote",
      name: "Toggle blockquote",
      icon: "quote-glyph",
    },
    {
      id: "editor:toggle-bullet-list",
      name: "Toggle bullet",
      icon: "bullet-list-glyph",
    },
    {
      id: "editor:toggle-checklist-status",
      name: "Toggle checklist status",
      icon: "checkbox-glyph",
    },
    {
      id: "editor:toggle-comments",
      name: "Toggle comment",
      icon: "percent-sign-glyph",
    },
    {
      id: "editor:toggle-highlight",
      name: "Toggle highlight",
      icon: "highlight-glyph",
    },
    {
      id: "editor:toggle-numbered-list",
      name: "Toggle numbered list",
      icon: "number-list-glyph",
    },
  ];

  async onload(): Promise<void> {
    console.log("cMenu v" + this.manifest.version + " loaded");
    await this.loadSettings();
    addIcons();
    addFeatherIcons(appIcons);
    addRemixIcons(appIcons);
    //addBoxIcons(appIcons);
    this.generateCommands();
    this.app.workspace.onLayoutReady(() => {
      setTimeout(() => {
        this.setupStatusBar();
      });
    });
    this.addSettingTab(new cMenuSettingTab(this.app, this));
    this.registerEvent(
      this.app.workspace.on("active-leaf-change", this.handlecMenu)
    );
  }

  generateCommands() {
    //Hide-show menu
    this.addCommand({
      id: "hide-show-menu",
      name: "Hide/show ",
      icon: "cMenu",
      callback: async () => {
        this.settings.cMenuVisibility = !this.settings.cMenuVisibility;
        this.settings.cMenuVisibility == true
          ? setTimeout(() => {
              dispatchEvent(new Event("cMenu-NewCommand"));
            }, 100)
          : setMenuVisibility(this.settings.cMenuVisibility);
        selfDestruct();
        await this.saveSettings();
      },
    });

    const applyCommand = (command: commandPlot, editor: Editor) => {
      const selectedText = editor.getSelection();
      const curserStart = editor.getCursor("from");
      const curserEnd = editor.getCursor("to");
      const prefix = command.prefix;
      const suffix = command.suffix || prefix;
      const setCursor = (mode: number) => {
        editor.setCursor(
          curserStart.line + command.line * mode,
          curserEnd.ch + command.char * mode
        );
      };
      const preStart = {
        line: curserStart.line - command.line,
        ch: curserStart.ch - prefix.length,
      };
      const pre = editor.getRange(preStart, curserStart);

      if (pre == prefix.trimStart()) {
        const sufEnd = {
          line: curserStart.line + command.line,
          ch: curserEnd.ch + suffix.length,
        };
        const suf = editor.getRange(curserEnd, sufEnd);
        if (suf == suffix.trimEnd()) {
          editor.replaceRange(selectedText, preStart, sufEnd); // codeblock leave blank lines
          return setCursor(-1);
        }
      }
      editor.replaceSelection(`${prefix}${selectedText}${suffix}`);
      return setCursor(1);
    };

    type commandPlot = {
      char: number;
      line: number;
      prefix: string;
      suffix: string;
    };

    type commandsPlot = {
      [key: string]: commandPlot;
    };

    const commandsMap: commandsPlot = {
      underline: {
        char: 3,
        line: 0,
        prefix: "<u>",
        suffix: "</u>",
      },
      superscript: {
        char: 5,
        line: 0,
        prefix: "<sup>",
        suffix: "</sup>",
      },
      subscript: {
        char: 5,
        line: 0,
        prefix: "<sub>",
        suffix: "</sub>",
      },
      codeblock: {
        char: 5,
        line: 1,
        prefix: "\n```\n",
        suffix: "\n```\n",
      },
    };
    // Add new commands
    Object.keys(commandsMap).forEach((type) => {
      this.addCommand({
        id: `${type}`,
        name: `Toggle ${type}`,
        icon: `${type}-glyph`,
        callback: async () => {
          const activeLeaf =
            this.app.workspace.getActiveViewOfType(MarkdownView);
          if (activeLeaf) {
            const view = activeLeaf;
            const editor = view.editor;
            applyCommand(commandsMap[type], editor);
            await wait(10);
            //@ts-ignore
            this.app.commands.executeCommandById("editor:focus");
          }
        },
      });
    });
    // Enhance editor commands
    this.modCommands.forEach((type) => {
      this.addCommand({
        id: `${type["id"]}`,
        name: `${type["name"]}`,
        icon: `${type["icon"]}`,
        callback: async () => {
          const activeLeaf =
            this.app.workspace.getActiveViewOfType(MarkdownView);
          const view = activeLeaf;
          const editor = view.editor;
          //@ts-ignore
          this.app.commands.executeCommandById(`${type["id"]}`);
          editor.setCursor(editor.getCursor("to"));
          await wait(10);
          //@ts-ignore
          this.app.commands.executeCommandById("editor:focus");
        },
      });
    });
  }

  setupStatusBar(): void {
    // If host has no status bar, skip creating the status bar menu entirely
    const statusBarEl = document.querySelector(".status-bar");
    if (!statusBarEl) return;

    this.statusBarIcon = this.addStatusBarItem();
    this.statusBarIcon.addClass("cMenu-statusbar-icon");
    setIcon(this.statusBarIcon, "cMenu");

    this.statusBarIcon.addEventListener("click", (evt) => {
      evt.preventDefault();
      evt.stopPropagation();

      const menu = new Menu();
      const menuDom = (menu as any).dom as HTMLElement;
      menuDom.addClass("cMenu-statusbar-menu");

      // Visibility toggle
      const toggleItem = menuDom.createDiv({ cls: "menu-item" });
      toggleItem.createDiv({ cls: "menu-item-icon" });
      toggleItem.createDiv({ text: "Hide & Show", cls: "menu-item-title" });
      toggleItem.onClickEvent((e) => e.stopPropagation());
      new ToggleComponent(toggleItem)
        .setValue(this.settings.cMenuVisibility)
        .onChange(async (value) => {
          this.settings.cMenuVisibility = value;
          if (value) {
            setTimeout(() => {
              dispatchEvent(new Event("cMenu-NewCommand"));
            }, 100);
          } else {
            setMenuVisibility(value);
          }
          selfDestruct();
          await this.saveSettings();
        });

      // Dock mode (follow | fixed)
      const dockItem = menuDom.createDiv({ cls: "menu-item" });
      dockItem.createDiv({ cls: "menu-item-icon" });
      dockItem.createDiv({ text: "Dock mode", cls: "menu-item-title" });
      dockItem.onClickEvent((e) => e.stopPropagation());
      new DropdownComponent(dockItem)
        .addOptions({ follow: "follow", fixed: "fixed" })
        .setValue(this.settings.cMenuDockMode ?? "follow")
        .onChange(
          debounce(
            async (value: string) => {
              // Update setting and re-apply layout + reposition
              // @ts-ignore narrow string type
              this.settings.cMenuDockMode = value as any;
              setBottomValue(this.settings);
              await this.saveSettings();
              document.dispatchEvent(new Event("selectionchange"));
            },
            100,
            true
          )
        );

      // Bottom slider
      const bottomItem = menuDom.createDiv({ cls: "menu-item" });
      bottomItem.createDiv({ cls: "menu-item-icon" });
      bottomItem.createDiv({ text: "Offset (px)", cls: "menu-item-title" });
      bottomItem.onClickEvent((e) => e.stopPropagation());
      new SliderComponent(bottomItem)
        .setLimits(0, 24, 1)
        .setValue(this.settings.cMenuBottomValue)
        .onChange(
          debounce(
            async (value: number) => {
              this.settings.cMenuBottomValue = value;
              // Re-apply layout using current settings (gap/scale/auto-cols)
              setBottomValue(this.settings);
              await this.saveSettings();
              // Trigger selection handler to recompute positioning immediately
              document.dispatchEvent(new Event("selectionchange"));
            },
            100,
            true
          )
        )
        .setDynamicTooltip();

      // Buttons
      const buttonItem = menuDom.createDiv({ cls: "menu-item buttonitem" });
      const addButton = new ButtonComponent(buttonItem);
      const refreshButton = new ButtonComponent(buttonItem);

      addButton
        .setIcon("cMenuAdd")
        .setClass("cMenuSettingsButton")
        .setClass("cMenuSettingsButtonAdd")
        .setClass("cMenuStatusButton")
        .setTooltip("Add")
        .onClick(() => {
          new CommandPicker(this).open();
        });

      refreshButton
        .setIcon("cMenuReload")
        .setClass("cMenuSettingsButton")
        .setClass("cMenuSettingsButtonRefresh")
        .setTooltip("Refresh")
        .onClick(() => {
          setTimeout(() => {
            dispatchEvent(new Event("cMenu-NewCommand"));
          }, 100);
        });

      const statusBarIconRect = this.statusBarIcon.getBoundingClientRect();
      const statusBarRect =
        document.querySelector(".status-bar")?.getBoundingClientRect() ??
        statusBarIconRect;

      menu.showAtPosition({
        x: statusBarIconRect.right + 5,
        y: statusBarRect.top - 5,
      });
    });
  }

  onunload(): void {
    selfDestruct();
    console.log("cMenu unloaded");
    this.app.workspace.off("active-leaf-change", this.handlecMenu);
    // Clean up global selectionchange listener if installed
    const ref = (window as any).__cMenuSelectionHandlerRef as EventListener | undefined;
    if (ref) {
      document.removeEventListener("selectionchange", ref);
      (window as any).__cMenuSelectionHandlerInstalled = false;
      (window as any).__cMenuSelectionHandlerRef = undefined;
    }
    // Clean up ResizeObserver if installed
    const ro = (window as any).__cMenuResizeObserverRef as ResizeObserver | undefined;
    if (ro) {
      try { ro.disconnect(); } catch(_) {}
      (window as any).__cMenuResizeObserverRef = undefined;
    }
  }

  handlecMenu = (): void => {
    this.settings.cMenuVisibility == true
      ? cMenuPopover(this.app, this.settings)
      : false;
  };

  async loadSettings() {
    const raw = await this.loadData();
    const merged: cMenuSettings = Object.assign({}, DEFAULT_SETTINGS, raw || {});
    // One-time migration: normalize menuCommands to MenuItem[]
    const normalize = (items: any[]): MenuItem[] => {
      if (!Array.isArray(items)) return DEFAULT_SETTINGS.menuCommands.slice();
      const out: MenuItem[] = [];
      for (const it of items) {
        if (!it || typeof it !== 'object') continue;
        const t = (it as any).type;
        if (t === 'group' && Array.isArray((it as any).items)) {
          // Shallow validate children recursively
          const groupItems = normalize((it as any).items);
          out.push({ type: 'group', name: (it as any).name ?? 'Group', icon: (it as any).icon, items: groupItems });
        } else if (t === 'macro' && Array.isArray((it as any).steps)) {
          const steps = ((it as any).steps as any[]).filter(s => s && typeof s.id === 'string').map(s => ({ id: s.id as string, delayMs: Number.isFinite(s.delayMs) ? s.delayMs : undefined }));
          out.push({ type: 'macro', name: (it as any).name ?? 'Macro', icon: (it as any).icon, steps });
        } else if (typeof (it as any).id === 'string' && typeof (it as any).name === 'string') {
          // Plain command item (backward compatible)
          out.push({ ...(it as any) });
        }
      }
      return out;
    };
    merged.menuCommands = normalize((merged as any).menuCommands);
    this.settings = merged;
  }

  async saveSettings() {
    await this.saveData(this.settings);
  }
}
