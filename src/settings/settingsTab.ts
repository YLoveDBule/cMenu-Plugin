import type cMenuPlugin from "src/plugin/main";
import { CommandPicker, MacroPicker } from "src/modals/suggesterModals";
import { App, Setting, PluginSettingTab } from "obsidian";
import { AESTHETIC_STYLES, MenuItem, GroupItem, MacroItem } from "src/settings/settingsData";
import { setBottomValue } from "src/util/statusBarConstants";
import { selfDestruct, cMenuPopover } from "src/modals/cMenuModal";
import Sortable from "sortablejs";
import { debounce } from "obsidian";

export class cMenuSettingTab extends PluginSettingTab {
  plugin: cMenuPlugin;

  constructor(app: App, plugin: cMenuPlugin) {
    super(app, plugin);
    this.plugin = plugin;
    addEventListener("cMenu-NewCommand", () => {
      selfDestruct();
      cMenuPopover(app, this.plugin.settings);
      this.display();
    });
  }

  display(): void {
    const { containerEl } = this;
    containerEl.empty();
    containerEl.createEl('h1', { text: 'cMenu 设置' });

    // Tabs skeleton
    const tabs = containerEl.createDiv({ cls: 'cMenu-settings-tabs' });
    const header = tabs.createDiv({ cls: 'cMenu-settings-tabs-header' });
    const body = tabs.createDiv({ cls: 'cMenu-settings-tabs-body' });

    const tabBtns: { key: string; btn: HTMLButtonElement }[] = [];
    const sections: Record<string, HTMLElement> = {
      appearance: body.createDiv({ cls: 'cMenu-settings-tab' }),
      commands: body.createDiv({ cls: 'cMenu-settings-tab' }),
      about: body.createDiv({ cls: 'cMenu-settings-tab' }),
    };

    const switchTo = (key: keyof typeof sections) => {
      Object.entries(sections).forEach(([k, el]) => {
        if (k === key) el.addClass('is-active'); else el.removeClass('is-active');
      });
      tabBtns.forEach(({ key: k, btn }) => {
        if (k === key) btn.addClass('is-active'); else btn.removeClass('is-active');
      });
    };

    const addTabBtn = (key: keyof typeof sections, label: string) => {
      const b = header.createEl('button', { text: label, cls: 'cMenu-settings-tab-btn' });
      b.addEventListener('click', () => switchTo(key));
      tabBtns.push({ key, btn: b });
    };

    addTabBtn('appearance', '外观');
    addTabBtn('commands', '命令与分组');
    addTabBtn('about', '关于');

    // ========== 外观 ==========
    const appearanceEl = sections.appearance;
    appearanceEl.createEl('h3', { text: '外观' });

    new Setting(appearanceEl)
      .setName('外观风格')
      .setDesc('在玻璃拟态与默认风格之间切换。更改后可点击下方“刷新 cMenu”。')
      .addDropdown((dropdown) => {
        const aesthetics: Record<string, string> = {};
        AESTHETIC_STYLES.map((aesthetic) => (aesthetics[aesthetic] = aesthetic));
        dropdown.addOptions(aesthetics);
        dropdown
          .setValue(this.plugin.settings.aestheticStyle)
          .onChange((aestheticStyle) => {
            this.plugin.settings.aestheticStyle = aestheticStyle;
            this.plugin.saveSettings();
          });
      });

    new Setting(appearanceEl)
      .setName('按钮间距 (px)')
      .setDesc('调整 cMenu 按钮的间距。')
      .addSlider((slider) => {
        slider
          .setLimits(0, 24, 1)
          .setValue(this.plugin.settings.cMenuButtonGap)
          .onChange(
            debounce(async (value: number) => {
              this.plugin.settings.cMenuButtonGap = value;
              setBottomValue(this.plugin.settings);
              await this.plugin.saveSettings();
            }, 100, true)
          )
          .setDynamicTooltip();
      });

    new Setting(appearanceEl)
      .setName('按钮尺寸')
      .setDesc('缩放 cMenu 按钮整体大小。')
      .addSlider((slider) => {
        slider
          .setLimits(0.75, 1.5, 0.05)
          .setValue(this.plugin.settings.cMenuButtonScale)
          .onChange(
            debounce(async (value: number) => {
              this.plugin.settings.cMenuButtonScale = value;
              setBottomValue(this.plugin.settings);
              await this.plugin.saveSettings();
            }, 100, true)
          )
          .setDynamicTooltip();
      });

    new Setting(appearanceEl)
      .setName('停靠模式')
      .setDesc('跟随选区，或固定在编辑器顶部。')
      .addDropdown((dropdown) => {
        const options: Record<string, string> = { follow: 'follow', fixed: 'fixed' };
        dropdown.addOptions(options);
        dropdown
          .setValue(this.plugin.settings.cMenuDockMode ?? 'follow')
          .onChange(
            debounce(async (value: string) => {
              this.plugin.settings.cMenuDockMode = (value as any);
              setBottomValue(this.plugin.settings);
              await this.plugin.saveSettings();
              document.dispatchEvent(new Event('selectionchange'));
            }, 100, true)
          );
      });

    new Setting(appearanceEl)
      .setName('溢出模式')
      .setDesc('换行（多行）或滚动（单行横向滚动）。')
      .addDropdown((dropdown) => {
        const options: Record<string, string> = { wrap: 'wrap', scroll: 'scroll' };
        dropdown.addOptions(options);
        dropdown
          .setValue(this.plugin.settings.cMenuOverflowMode ?? 'wrap')
          .onChange(
            debounce(async (value: string) => {
              this.plugin.settings.cMenuOverflowMode = (value as any);
              setBottomValue(this.plugin.settings);
              await this.plugin.saveSettings();
            }, 100, true)
          );
      });

    new Setting(appearanceEl)
      .setName('最大宽度（%）')
      .setDesc('限制 cMenu 相对编辑器宽度的最大宽度。')
      .addSlider((slider) => {
        slider
          .setLimits(30, 100, 5)
          .setValue(this.plugin.settings.cMenuMaxWidthPct ?? 100)
          .onChange(
            debounce(async (value: number) => {
              this.plugin.settings.cMenuMaxWidthPct = value;
              setBottomValue(this.plugin.settings);
              await this.plugin.saveSettings();
            }, 100, true)
          )
          .setDynamicTooltip();
      });

    // ===== 定位与间距 =====
    appearanceEl.createEl('h3', { text: '定位与间距' });

    new Setting(appearanceEl)
      .setName('表格内允许越界（单行）')
      .setDesc('当表格区域太窄或上下空间不足时，允许菜单越出编辑区边界以保持单行显示。')
      .addToggle((toggle) => {
        toggle
          .setValue(!!this.plugin.settings.cMenuAllowTableOverflow)
          .onChange(
            debounce(async (v: boolean) => {
              this.plugin.settings.cMenuAllowTableOverflow = v;
              setBottomValue(this.plugin.settings);
              await this.plugin.saveSettings();
              document.dispatchEvent(new Event('selectionchange'));
            }, 100, true)
          );
      });

    new Setting(appearanceEl)
      .setName('表格紧凑模式（换行）')
      .setDesc('在表格内过窄时允许菜单自动换行以变窄（可与越界模式二选一）。当前仅作为预留开关。')
      .addToggle((toggle) => {
        toggle
          .setValue(!!this.plugin.settings.cMenuCompactInTable)
          .onChange(
            debounce(async (v: boolean) => {
              this.plugin.settings.cMenuCompactInTable = v;
              setBottomValue(this.plugin.settings);
              await this.plugin.saveSettings();
              document.dispatchEvent(new Event('selectionchange'));
            }, 100, true)
          );
      });

    new Setting(appearanceEl)
      .setName('普通场景最小间距 (px)')
      .setDesc('非表格场景下菜单与选区的最小间距。')
      .addSlider((slider) => {
        slider
          .setLimits(0, 24, 1)
          .setValue(this.plugin.settings.cMenuFollowGapMin ?? 6)
          .onChange(
            debounce(async (value: number) => {
              this.plugin.settings.cMenuFollowGapMin = value;
              setBottomValue(this.plugin.settings);
              await this.plugin.saveSettings();
              document.dispatchEvent(new Event('selectionchange'));
            }, 100, true)
          )
          .setDynamicTooltip();
      });

    new Setting(appearanceEl)
      .setName('表格场景最小间距 (px)')
      .setDesc('表格内上下放置时使用的最小间距。')
      .addSlider((slider) => {
        slider
          .setLimits(0, 24, 1)
          .setValue(this.plugin.settings.cMenuTableGapMin ?? 10)
          .onChange(
            debounce(async (value: number) => {
              this.plugin.settings.cMenuTableGapMin = value;
              setBottomValue(this.plugin.settings);
              await this.plugin.saveSettings();
              document.dispatchEvent(new Event('selectionchange'));
            }, 100, true)
          )
          .setDynamicTooltip();
      });

    new Setting(appearanceEl)
      .setName('表格“上方”最小间距 (px)')
      .setDesc('当菜单放在表格选区上方时使用的更小间距（贴近一些）。')
      .addSlider((slider) => {
        slider
          .setLimits(0, 16, 1)
          .setValue(this.plugin.settings.cMenuTableGapAbove ?? 6)
          .onChange(
            debounce(async (value: number) => {
              this.plugin.settings.cMenuTableGapAbove = value;
              setBottomValue(this.plugin.settings);
              await this.plugin.saveSettings();
              document.dispatchEvent(new Event('selectionchange'));
            }, 100, true)
          )
          .setDynamicTooltip();
      });

    new Setting(appearanceEl)
      .setName('使用起始光标作为垂直基准')
      .setDesc('上/下放置时以起始光标所在行的 rect 作为垂直判断基准，更贴近光标位置。')
      .addToggle((toggle) => {
        toggle
          .setValue(!!this.plugin.settings.cMenuUseStartRectVertical)
          .onChange(
            debounce(async (v: boolean) => {
              this.plugin.settings.cMenuUseStartRectVertical = v;
              setBottomValue(this.plugin.settings);
              await this.plugin.saveSettings();
              document.dispatchEvent(new Event('selectionchange'));
            }, 100, true)
          );
      });

    new Setting(appearanceEl)
      .setName('刷新 cMenu')
      .setDesc('添加/删除命令后会自动刷新。若调整了外观或布局，请手动刷新。')
      .addButton((reloadButton) => {
        reloadButton
          .setIcon('cMenuReload')
          .setClass('cMenuSettingsButton')
          .setClass('cMenuSettingsButtonRefresh')
          .setTooltip('刷新')
          .onClick(() => {
            setTimeout(() => { dispatchEvent(new Event('cMenu-NewCommand')); }, 100);
            console.log(`%ccMenu refreshed`, 'color: Violet');
          });
      });

    // ========== 命令与分组 ==========
    const commandsEl = sections.commands;
    commandsEl.createEl('h3', { text: '命令与分组' });

    new Setting(commandsEl)
      .setName('管理 cMenu 命令')
      .setDesc('从命令面板添加命令。拖拽可以排序，右侧按钮可删除项。排序后需手动刷新。')
      .addButton((addButton) => {
        addButton
          .setIcon('cMenuAdd')
          .setTooltip('添加命令')
          .setClass('cMenuSettingsButton')
          .setClass('cMenuSettingsButtonAdd')
          .onClick(() => {
            new CommandPicker(this.plugin).open();
            setTimeout(() => { dispatchEvent(new Event('cMenu-NewCommand')); }, 100);
          });
      })
      .addButton((addGroupBtn) => {
        addGroupBtn
          .setIcon('folder')
          .setTooltip('添加分组')
          .setClass('cMenuSettingsButton')
          .setClass('cMenuSettingsButtonAdd')
          .onClick(async () => {
            const group: GroupItem = { type: 'group', name: '新建分组', items: [] };
            (this.plugin.settings.menuCommands as MenuItem[]).push(group);
            await this.plugin.saveSettings();
            this.display();
          });
      })
      .addButton((addMacroBtn) => {
        addMacroBtn
          .setIcon('cMenuAdd')
          .setTooltip('添加宏')
          .setClass('cMenuSettingsButton')
          .setClass('cMenuSettingsButtonAdd')
          .onClick(async () => {
            const macro: MacroItem = { type: 'macro', name: '新建宏', steps: [] };
            (this.plugin.settings.menuCommands as MenuItem[]).push(macro);
            await this.plugin.saveSettings();
            this.display();
          });
      });

    const cMenuCommandsContainer = commandsEl.createEl('div', { cls: 'cMenuSettingsTabsContainer' });
    Sortable.create(cMenuCommandsContainer, {
      animation: 500,
      ghostClass: 'sortable-ghost',
      chosenClass: 'sortable-chosen',
      dragClass: 'sortable-drag',
      dragoverBubble: true,
      forceFallback: true,
      fallbackClass: 'sortable-fallback',
      easing: 'cubic-bezier(1, 0, 0, 1)',
      filter: '.cMenuSettingsGroupItems, .cMenuSettingsMacroSteps',
      onSort: (command) => {
        const arrayResult = this.plugin.settings.menuCommands;
        const [removed] = arrayResult.splice(command.oldIndex, 1);
        arrayResult.splice(command.newIndex, 0, removed);
        this.plugin.saveSettings();
      },
    });

    const renderTopLevelItem = (item: MenuItem) => {
      if ((item as any).type === 'group') {
        const group = item as GroupItem;
        new Setting(cMenuCommandsContainer)
          .setClass('cMenuCommandItem')
          .setName(group.name)
          .setDesc('分组')
          .addText((t) => {
            t.setPlaceholder('分组名称').setValue(group.name).onChange(async (v) => {
              group.name = v || '分组';
              await this.plugin.saveSettings();
            });
          })
          .addButton((addToGroupBtn) => {
            addToGroupBtn
              .setIcon('cMenuAdd')
              .setTooltip('向分组添加命令')
              .setClass('cMenuSettingsButton')
              .setClass('cMenuSettingsButtonAdd')
              .onClick(() => {
                new CommandPicker(this.plugin, async (cmd) => {
                  group.items.push(cmd as any);
                  await this.plugin.saveSettings();
                  this.display();
                  setTimeout(() => dispatchEvent(new Event('cMenu-NewCommand')), 100);
                }).open();
              });
          })
          .addButton((addMacroToGroupBtn) => {
            addMacroToGroupBtn
              .setIcon('bot-glyph')
              .setTooltip('向分组添加宏')
              .setClass('cMenuSettingsButton')
              .setClass('cMenuSettingsButtonAdd')
              .onClick(() => {
                new MacroPicker(this.plugin, async (macro) => {
                  group.items.push(macro as any);
                  await this.plugin.saveSettings();
                  this.display();
                  setTimeout(() => dispatchEvent(new Event('cMenu-NewCommand')), 100);
                }).open();
              });
          })
          .addButton((deleteButton) => {
            deleteButton
              .setIcon('cMenuDelete')
              .setTooltip('删除分组')
              .setClass('cMenuSettingsButton')
              .setClass('cMenuSettingsButtonDelete')
              .onClick(async () => {
                this.plugin.settings.menuCommands.remove(item as any);
                await this.plugin.saveSettings();
                this.display();
                setTimeout(() => dispatchEvent(new Event('cMenu-NewCommand')), 100);
              });
          });

        const childContainer = cMenuCommandsContainer.createEl('div', { cls: 'cMenuSettingsGroupItems' });
        group.items.forEach((child: any) => {
          new Setting(childContainer)
            .setClass('cMenuCommandItem')
            .setName(child.name)
            .setDesc('分组内')
            .addButton((deleteChild) => {
              deleteChild
                .setIcon('cMenuDelete')
                .setTooltip('从分组移除')
                .setClass('cMenuSettingsButton')
                .setClass('cMenuSettingsButtonDelete')
                .onClick(async () => {
                  group.items.remove(child);
                  await this.plugin.saveSettings();
                  this.display();
                  setTimeout(() => dispatchEvent(new Event('cMenu-NewCommand')), 100);
                });
            });
        });

        Sortable.create(childContainer, {
          animation: 300,
          ghostClass: 'sortable-ghost',
          group: { name: 'cMenu-group', pull: false, put: false },
          onSort: (evt) => {
            const arr = group.items as any[];
            const [removed] = arr.splice(evt.oldIndex, 1);
            arr.splice(evt.newIndex, 0, removed);
            this.plugin.saveSettings();
          },
        });
        return;
      }

      if ((item as any).type === 'macro') {
        const macro = item as MacroItem;
        new Setting(cMenuCommandsContainer)
          .setClass('cMenuCommandItem')
          .setName(macro.name)
          .setDesc('宏')
          .addText((t) => {
            t.setPlaceholder('宏名称').setValue(macro.name).onChange(async (v) => {
              macro.name = v || '宏';
              await this.plugin.saveSettings();
            });
          })
          .addButton((addStepBtn) => {
            addStepBtn
              .setIcon('cMenuAdd')
              .setTooltip('添加步骤')
              .setClass('cMenuSettingsButton')
              .setClass('cMenuSettingsButtonAdd')
              .onClick(() => {
                new CommandPicker(this.plugin, async (cmd) => {
                  macro.steps.push({ id: (cmd as any).id, delayMs: 0 });
                  await this.plugin.saveSettings();
                  this.display();
                  setTimeout(() => dispatchEvent(new Event('cMenu-NewCommand')), 100);
                }).open();
              });
          })
          .addButton((deleteMacroBtn) => {
            deleteMacroBtn
              .setIcon('cMenuDelete')
              .setTooltip('删除宏')
              .setClass('cMenuSettingsButton')
              .setClass('cMenuSettingsButtonDelete')
              .onClick(async () => {
                this.plugin.settings.menuCommands.remove(item as any);
                await this.plugin.saveSettings();
                this.display();
                setTimeout(() => dispatchEvent(new Event('cMenu-NewCommand')), 100);
              });
          });

        const stepsContainer = cMenuCommandsContainer.createEl('div', { cls: 'cMenuSettingsMacroSteps' });
        const allCommands = (this.app as any).commands?.listCommands?.() ?? [];
        const getNameById = (id: string) => (allCommands.find((c: any) => c.id === id)?.name) || id;
        macro.steps.forEach((step, idx) => {
          new Setting(stepsContainer)
            .setClass('cMenuCommandItem')
            .setName(getNameById(step.id))
            .setDesc('延迟 (ms)')
            .addSlider((slider) => {
              slider
                .setLimits(0, 3000, 50)
                .setValue(Number.isFinite(step.delayMs as any) ? (step.delayMs as number) : 0)
                .onChange(
                  debounce(async (value: number) => {
                    step.delayMs = value;
                    await this.plugin.saveSettings();
                  }, 100, true)
                )
                .setDynamicTooltip();
            })
            .addButton((deleteStepBtn) => {
              deleteStepBtn
                .setIcon('cMenuDelete')
                .setTooltip('移除步骤')
                .setClass('cMenuSettingsButton')
                .setClass('cMenuSettingsButtonDelete')
                .onClick(async () => {
                  macro.steps.splice(idx, 1);
                  await this.plugin.saveSettings();
                  this.display();
                });
            });
        });

        Sortable.create(stepsContainer, {
          animation: 300,
          ghostClass: 'sortable-ghost',
          group: { name: 'cMenu-macro', pull: false, put: false },
          onSort: (evt) => {
            const arr = macro.steps as any[];
            const [removed] = arr.splice(evt.oldIndex, 1);
            arr.splice(evt.newIndex, 0, removed);
            this.plugin.saveSettings();
          },
        });
        return;
      }

      // 常规命令项
      new Setting(cMenuCommandsContainer)
        .setClass('cMenuCommandItem')
        .setName((item as any).name)
        .addButton((deleteButton) => {
          deleteButton
            .setIcon('cMenuDelete')
            .setTooltip('删除')
            .setClass('cMenuSettingsButton')
            .setClass('cMenuSettingsButtonDelete')
            .onClick(async () => {
              this.plugin.settings.menuCommands.remove(item as any);
              await this.plugin.saveSettings();
              this.display();
              setTimeout(() => { dispatchEvent(new Event('cMenu-NewCommand')); }, 100);
            });
        });
    };

    (this.plugin.settings.menuCommands as MenuItem[]).forEach(renderTopLevelItem);

    // ========== 关于 ==========
    const aboutEl = sections.about;
    aboutEl.createEl('h3', { text: '关于' });
    const meta = aboutEl.createEl('div', { cls: 'cMenu-about' });
    meta.createEl('p', { text: `版本：v${this.plugin.manifest.version}` });
    const creditP = meta.createEl('p');
    creditP.appendText('作者：');
    creditP.createEl('a', { text: 'Chetachi', href: 'https://github.com/chetachiezikeuzor' });
    meta.createEl('p', { text: '如果你喜欢这个插件并希望支持持续开发，可以点击下方按钮赞助。' });
    aboutEl.appendChild(createDonateButton('https://www.buymeacoffee.com/chetachi'));

    // 默认选中第一个标签页
    const firstKey = Object.keys(sections)[0] as keyof typeof sections;
    switchTo(firstKey);
  }
}

const createDonateButton = (link: string): HTMLElement => {
  const a = createEl("a");
  a.setAttribute("href", link);
  a.addClass("buymeacoffee-chetachi-img");
  a.innerHTML = `<img src="https://img.buymeacoffee.com/button-api/?text=Buy me a coffee&emoji=&slug=chetachi&button_colour=e3e7ef&font_colour=262626&font_family=Inter&outline_colour=262626&coffee_colour=ff0000" height="42px">`;
  return a;
};
