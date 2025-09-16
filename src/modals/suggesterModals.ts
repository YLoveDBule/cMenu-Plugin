import type cMenuPlugin from "src/plugin/main";
import { appIcons } from "src/icons/appIcons";
import { Command, setIcon, FuzzyMatch, FuzzySuggestModal } from "obsidian";
import type { MacroItem, MenuItem } from "src/settings/settingsData";

class ChooseFromIconList extends FuzzySuggestModal<string> {
  plugin: cMenuPlugin;
  command: Command;
  // Optional push handler to store the chosen command at a specific target
  onPick?: (cmd: Command) => Promise<void>;

  constructor(plugin: cMenuPlugin, command: Command, onPick?: (cmd: Command) => Promise<void>) {
    super(plugin.app);
    this.plugin = plugin;
    this.command = command;
    this.onPick = onPick;
    this.setPlaceholder("Choose an icon");
  }

  private capitalJoin(string: string): string {
    const icon = string.split(" ");

    return icon
      .map((icon) => {
        return icon[0].toUpperCase() + icon.substring(1);
      })
      .join(" ");
  }

  getItems(): string[] {
    return appIcons;
  }

  getItemText(item: string): string {
    return this.capitalJoin(
      item
        .replace("feather-", "")
        .replace("remix-", "")
        .replace("bx-", "")
        .replace(/([A-Z])/g, " $1")
        .trim()
        .replace(/-/gi, " ")
    );
  }

  renderSuggestion(icon: FuzzyMatch<string>, iconItem: HTMLElement): void {
    const span = createSpan({ cls: "cMenuIconPick" });
    iconItem.appendChild(span);
    setIcon(span, icon.item);
    super.renderSuggestion(icon, iconItem);
  }

  async onChooseItem(item: string): Promise<void> {
    this.command.icon = item;
    if (this.onPick) {
      await this.onPick(this.command);
    } else {
      this.plugin.settings.menuCommands.push(this.command);
      await this.plugin.saveSettings();
      setTimeout(() => {
        dispatchEvent(new Event("cMenu-NewCommand"));
      }, 100);
      console.log(
        `%cCommand '${this.command.name}' was added to cMenu`,
        "color: Violet"
      );
    }
  }
}

export class MacroPicker extends FuzzySuggestModal<MacroItem> {
  private onPick?: (macro: MacroItem) => Promise<void>;
  constructor(private plugin: cMenuPlugin, onPick?: (macro: MacroItem) => Promise<void>) {
    super(plugin.app);
    this.onPick = onPick;
    this.setPlaceholder("Choose a macro");
  }

  getItems(): MacroItem[] {
    const items = (this.plugin.settings.menuCommands as MenuItem[]) || [];
    return items.filter((it: any) => it && it.type === 'macro') as MacroItem[];
  }

  getItemText(item: MacroItem): string {
    return item.name || 'Macro';
  }

  async onChooseItem(item: MacroItem): Promise<void> {
    if (this.onPick) {
      await this.onPick(item);
    }
  }
}

export class CommandPicker extends FuzzySuggestModal<Command> {
  command: Command;
  // Optional pick handler allowing external callers to decide where to store the command
  private onPick?: (cmd: Command) => Promise<void>;
  // nx7: filter + cache + plugin detection
  private filter: 'all' | 'core' | 'templater' | 'dataview' = 'all';
  private allCommandsCache: Command[] | null = null;
  private hasTemplater = false;
  private hasDataview = false;
  private filterBarEl: HTMLElement | null = null;

  constructor(private plugin: cMenuPlugin, onPick?: (cmd: Command) => Promise<void>) {
    super(plugin.app);
    this.app;
    this.onPick = onPick;
    this.setPlaceholder("Choose a command");
  }

  onOpen(): void {
    // Prepare data on open (plugin detection, cache listCommands)
    try {
      const enabled = ((this.app as any).plugins?.enabledPlugins) as Set<string> | undefined;
      this.hasTemplater = !!enabled?.has?.('templater-obsidian');
      this.hasDataview = !!enabled?.has?.('dataview');
    } catch (_) {
      this.hasTemplater = false;
      this.hasDataview = false;
    }
    if (!this.allCommandsCache) {
      try {
        //@ts-ignore
        this.allCommandsCache = this.app.commands.listCommands();
      } catch (_) {
        this.allCommandsCache = [];
      }
    }
    this.buildFilterBar();
  }

  private buildFilterBar() {
    const modalEl = (this as any).modalEl as HTMLElement | undefined;
    const content = modalEl?.querySelector('.modal-content') as HTMLElement | null;
    if (!content) return;
    // If already built, refresh states
    if (this.filterBarEl) {
      this.updateFilterButtonsState();
      return;
    }
    const bar = document.createElement('div');
    bar.style.display = 'flex';
    bar.style.gap = '8px';
    bar.style.marginBottom = '6px';
    bar.style.alignItems = 'center';
    const mkBtn = (label: string, key: 'all'|'core'|'templater'|'dataview', enabled = true, tooltip?: string) => {
      const btn = document.createElement('button');
      btn.textContent = label;
      btn.className = 'cMenu-filter-btn';
      btn.style.padding = '4px 8px';
      btn.style.borderRadius = '6px';
      btn.style.border = '1px solid var(--background-modifier-border)';
      btn.style.background = 'var(--background-secondary)';
      btn.style.color = 'var(--text-normal)';
      btn.style.cursor = enabled ? 'pointer' : 'not-allowed';
      btn.style.opacity = enabled ? '1' : '0.5';
      if (tooltip) btn.title = tooltip;
      if (enabled) {
        btn.addEventListener('click', () => {
          this.filter = key;
          this.updateFilterButtonsState();
          // Trigger refresh
          try { (this as any).onInputChanged?.(this.inputEl.value); } catch(_) {}
          try { this.inputEl.dispatchEvent(new Event('input')); } catch(_) {}
        });
      }
      (btn as any).dataset.key = key;
      return btn;
    };
    const templaterTip = this.hasTemplater ? undefined : 'Templater plugin is not enabled';
    const dataviewTip = this.hasDataview ? undefined : 'Dataview plugin is not enabled';
    const allBtn = mkBtn('全部', 'all', true);
    const coreBtn = mkBtn('核心', 'core', true);
    const tpBtn = mkBtn('Templater', 'templater', this.hasTemplater, templaterTip);
    const dvBtn = mkBtn('Dataview', 'dataview', this.hasDataview, dataviewTip);
    bar.appendChild(allBtn);
    bar.appendChild(coreBtn);
    bar.appendChild(tpBtn);
    bar.appendChild(dvBtn);
    content.prepend(bar);
    this.filterBarEl = bar;
    this.updateFilterButtonsState();
  }

  private updateFilterButtonsState() {
    if (!this.filterBarEl) return;
    const buttons = Array.from(this.filterBarEl.querySelectorAll('button.cMenu-filter-btn')) as HTMLButtonElement[];
    buttons.forEach(b => {
      const key = (b as any).dataset.key as typeof this.filter | undefined;
      if (!key) return;
      const active = key === this.filter;
      b.style.background = active ? 'var(--interactive-accent)' : 'var(--background-secondary)';
      b.style.color = active ? 'var(--text-on-accent)' : 'var(--text-normal)';
      b.setAttribute('aria-pressed', active ? 'true' : 'false');
    });
  }

  private getFilteredCommands(): Command[] {
    const all = this.allCommandsCache || [];
    if (this.filter === 'all') return all;
    const idHas = (c: Command, s: string) => (c as any).id?.toLowerCase?.().includes(s);
    const nameHas = (c: Command, s: string) => (c as any).name?.toLowerCase?.().includes(s);
    if (this.filter === 'templater') {
      return all.filter(c => idHas(c, 'templater') || nameHas(c, 'templater'));
    }
    if (this.filter === 'dataview') {
      return all.filter(c => idHas(c, 'dataview') || nameHas(c, 'dataview'));
    }
    // core: heuristics by common core prefixes and ensure not matching templater/dataview
    const CORE_PREFIXES = [
      'editor:', 'workspace:', 'app:', 'markdown:', 'pane:', 'file-explorer:', 'graph:', 'search:', 'switcher:', 'starred:', 'window:', 'command-palette:', 'audio-recorder:'
    ];
    return all.filter(c => {
      const id = ((c as any).id || '').toLowerCase();
      if (id.includes('templater') || id.includes('dataview')) return false;
      return CORE_PREFIXES.some(p => id.startsWith(p));
    });
  }

  getItems(): Command[] {
    if (!this.allCommandsCache) {
      try {
        //@ts-ignore
        this.allCommandsCache = this.app.commands.listCommands();
      } catch(_) {
        this.allCommandsCache = [];
      }
    }
    return this.getFilteredCommands();
  }

  getItemText(item: Command): string {
    return item.name;
  }

  async onChooseItem(item: Command): Promise<void> {
    const defaultPush = async (cmd: Command) => {
      this.plugin.settings.menuCommands.push(cmd);
      await this.plugin.saveSettings();
      setTimeout(() => {
        dispatchEvent(new Event("cMenu-NewCommand"));
      }, 100);
      console.log(`%cCommand '${cmd.name}' was added to cMenu`, "color: Violet");
    };

    const push = this.onPick ?? defaultPush;
    if (item.icon) {
      await push(item);
    } else {
      new ChooseFromIconList(this.plugin, item, push).open();
    }
  }
}
