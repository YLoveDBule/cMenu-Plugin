import type cMenuPlugin from "src/plugin/main";
import { CommandPicker, MacroPicker } from "src/modals/suggesterModals";
import { App, Setting, PluginSettingTab, ButtonComponent, Notice } from "obsidian";
import { AESTHETIC_STYLES, MenuItem, GroupItem, MacroItem } from "src/settings/settingsData";
import { setBottomValue } from "src/util/statusBarConstants";
import { selfDestruct, cMenuPopover } from "src/modals/cMenuModal";
import Sortable from "sortablejs";
import { debounce } from "obsidian";
import { searchIcons, getSuggestedIcons, validateIcon, getIconInfo, COMMON_ICONS } from "src/icons/catalog";
import { IconPickerModal } from "src/modals/iconPickerModal";
import { showBatchProcessingModal } from "src/ui/batchProcessingModal";
import { showPerformanceDashboard } from "src/ui/performanceDashboard";
import { showHistoryModal } from "src/ui/historyModal";
import { showTemplateManager } from "src/ui/templateModal";
import { HistoryManager } from "src/features/historyManager";
import { TemplateManager } from "src/features/templateManager";
import { DEFAULT_SETTINGS } from "src/settings/settingsData";

export class cMenuSettingTab extends PluginSettingTab {
  plugin: cMenuPlugin;
  private currentTabKey: string | null = null;

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
      ai: body.createDiv({ cls: 'cMenu-settings-tab' }),
      batch: body.createDiv({ cls: 'cMenu-settings-tab' }),
      history: body.createDiv({ cls: 'cMenu-settings-tab' }),
      templates: body.createDiv({ cls: 'cMenu-settings-tab' }),
      performance: body.createDiv({ cls: 'cMenu-settings-tab' }),
      about: body.createDiv({ cls: 'cMenu-settings-tab' }),
    };

    const switchTo = (key: keyof typeof sections) => {
      Object.entries(sections).forEach(([k, el]) => {
        if (k === key) el.addClass('is-active'); else el.removeClass('is-active');
      });
      tabBtns.forEach(({ key: k, btn }) => {
        if (k === key) btn.addClass('is-active'); else btn.removeClass('is-active');
      });
      this.currentTabKey = key as string;
    };

    const addTabBtn = (key: keyof typeof sections, label: string) => {
      const b = header.createEl('button', { text: label, cls: 'cMenu-settings-tab-btn' });
      b.addEventListener('click', () => switchTo(key));
      tabBtns.push({ key, btn: b });
    };

    addTabBtn('appearance', '外观');
    addTabBtn('commands', '命令与分组');
    addTabBtn('ai', 'AI 助手');
    addTabBtn('batch', '批量处理');
    addTabBtn('history', '历史管理');
    addTabBtn('templates', '模板管理');
    addTabBtn('performance', '性能监控');
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

    // ========== AI 助手 ==========
    const aiEl = sections.ai;
    aiEl.createEl('h3', { text: 'AI 助手' });

    new Setting(aiEl)
      .setName('Provider')
      .setDesc('选择 AI 提供商（默认 DeepSeek，OpenAI 兼容接口）。')
      .addDropdown((dd) => {
        const options: Record<string, string> = { deepseek: 'deepseek', openai: 'openai' };
        dd.addOptions(options)
          .setValue(this.plugin.settings.ai?.provider ?? 'deepseek')
          .onChange(
            debounce(async (value: string) => {
              this.plugin.settings.ai = this.plugin.settings.ai || ({} as any);
              (this.plugin.settings.ai as any).provider = value as any;
              await this.plugin.saveSettings();
            }, 100, true)
          );
      });

    new Setting(aiEl)
      .setName('Base URL')
      .setDesc('可选：覆盖默认的 API Base URL。DeepSeek 缺省为 https://api.deepseek.com')
      .addText((t) => {
        t.setPlaceholder('https://api.deepseek.com')
          .setValue(this.plugin.settings.ai?.baseUrl ?? '')
          .onChange(
            debounce(async (v) => {
              this.plugin.settings.ai = this.plugin.settings.ai || ({} as any);
              (this.plugin.settings.ai as any).baseUrl = v;
              await this.plugin.saveSettings();
            }, 200, true)
          );
      });

    new Setting(aiEl)
      .setName('API Key')
      .setDesc('不会写入文档，仅保存在本地设置。')
      .addText((t) => {
        (t.inputEl as HTMLInputElement).type = 'password';
        t.setPlaceholder('sk-...')
          .setValue(this.plugin.settings.ai?.apiKey ?? '')
          .onChange(
            debounce(async (v) => {
              this.plugin.settings.ai = this.plugin.settings.ai || ({} as any);
              (this.plugin.settings.ai as any).apiKey = v;
              await this.plugin.saveSettings();
            }, 200, true)
          );
      });

    new Setting(aiEl)
      .setName('Model')
      .setDesc('DeepSeek 默认 deepseek-chat。')
      .addText((t) => {
        t.setPlaceholder('deepseek-chat')
          .setValue(this.plugin.settings.ai?.model ?? 'deepseek-chat')
          .onChange(
            debounce(async (v) => {
              this.plugin.settings.ai = this.plugin.settings.ai || ({} as any);
              (this.plugin.settings.ai as any).model = v;
              await this.plugin.saveSettings();
            }, 200, true)
          );
      });

    new Setting(aiEl)
      .setName('System Prompt')
      .setDesc('全局系统提示（可用于约束输出格式与风格）。')
      .addTextArea((ta) => {
        ta.setPlaceholder('You are a helpful writing assistant...')
          .setValue(this.plugin.settings.ai?.systemPrompt ?? '')
          .onChange(
            debounce(async (v) => {
              this.plugin.settings.ai = this.plugin.settings.ai || ({} as any);
              (this.plugin.settings.ai as any).systemPrompt = v;
              await this.plugin.saveSettings();
            }, 300, true)
          );
        ta.inputEl.rows = 4;
      });

    new Setting(aiEl)
      .setName('Temperature')
      .setDesc('创意度（0-2）。')
      .addSlider((s) => {
        s.setLimits(0, 2, 0.1)
          .setValue(this.plugin.settings.ai?.temperature ?? 0.7)
          .onChange(
            debounce(async (v: number) => {
              this.plugin.settings.ai = this.plugin.settings.ai || ({} as any);
              (this.plugin.settings.ai as any).temperature = v;
              await this.plugin.saveSettings();
            }, 100, true)
          )
          .setDynamicTooltip();
      });

    new Setting(aiEl)
      .setName('Max Tokens')
      .setDesc('最大输出 tokens（可留空）。')
      .addText((t) => {
        t.setPlaceholder('800')
          .setValue(String(this.plugin.settings.ai?.maxTokens ?? ''))
          .onChange(
            debounce(async (v) => {
              const n = Number(v);
              this.plugin.settings.ai = this.plugin.settings.ai || ({} as any);
              (this.plugin.settings.ai as any).maxTokens = Number.isFinite(n) ? n : undefined;
              await this.plugin.saveSettings();
            }, 200, true)
          );
      });

    new Setting(aiEl)
      .setName('Timeout (ms)')
      .setDesc('请求超时（毫秒）。')
      .addText((t) => {
        t.setPlaceholder('30000')
          .setValue(String(this.plugin.settings.ai?.timeoutMs ?? 30000))
          .onChange(
            debounce(async (v) => {
              const n = Number(v);
              this.plugin.settings.ai = this.plugin.settings.ai || ({} as any);
              (this.plugin.settings.ai as any).timeoutMs = Number.isFinite(n) ? n : 30000;
              await this.plugin.saveSettings();
            }, 200, true)
          );
      });

    // 流式输出开关
    new Setting(aiEl)
      .setName('启用流式输出')
      .setDesc('默认关闭（非流式）。打开后结果将流式显示到预览面板。')
      .addToggle((tg) => {
        tg.setValue(!!this.plugin.settings.ai?.stream)
          .onChange(
            debounce(async (v: boolean) => {
              this.plugin.settings.ai = this.plugin.settings.ai || ({} as any);
              (this.plugin.settings.ai as any).stream = v;
              await this.plugin.saveSettings();
            }, 100, true)
          );
      });

    // 预览开关与类型
    new Setting(aiEl)
      .setName('启用结果预览')
      .setDesc('在应用到文档之前，先在面板中预览 AI 结果。')
      .addToggle((tg) => {
        tg.setValue(this.plugin.settings.ai?.previewEnabled ?? true)
          .onChange(
            debounce(async (v: boolean) => {
              this.plugin.settings.ai = this.plugin.settings.ai || ({} as any);
              (this.plugin.settings.ai as any).previewEnabled = v;
              await this.plugin.saveSettings();
            }, 100, true)
          );
      });

    new Setting(aiEl)
      .setName('预览面板类型')
      .setDesc('选择预览面板的展现方式。建议使用“锚定主栏”')
      .addDropdown((dd) => {
        dd.addOptions({ anchored: 'anchored（锚定主栏）', modal: 'modal（居中弹出）' })
          .setValue(this.plugin.settings.ai?.previewType ?? 'anchored')
          .onChange(
            debounce(async (v: string) => {
              this.plugin.settings.ai = this.plugin.settings.ai || ({} as any);
              (this.plugin.settings.ai as any).previewType = (v as any);
              await this.plugin.saveSettings();
            }, 100, true)
          );
      });

    new Setting(aiEl)
      .setName('最近使用数量')
      .setDesc('AI 子菜单中显示的“最近使用”最大个数（0-12）')
      .addSlider((s) => {
        s.setLimits(0, 12, 1)
          .setValue(this.plugin.settings.ai?.mruLimit ?? 6)
          .onChange(
            debounce(async (v: number) => {
              this.plugin.settings.ai = this.plugin.settings.ai || ({} as any);
              (this.plugin.settings.ai as any).mruLimit = v;
              await this.plugin.saveSettings();
            }, 100, true)
          )
          .setDynamicTooltip();
      });

    // ---- AI 动作列表（自定义二级菜单） ----
    const aiActionsHeader = aiEl.createDiv({ cls: 'setting-item' });
    aiActionsHeader.createEl('h4', { text: 'AI 动作列表（可自定义二级菜单）' });
    
    // 重置按钮
    const resetBtn = new ButtonComponent(aiActionsHeader);
    resetBtn.setButtonText('重置为默认')
      .setClass('mod-warning')
      .onClick(async () => {
        if (confirm('确定要重置 AI 动作列表为默认设置吗？这将会覆盖所有自定义修改。')) {
          this.plugin.settings.aiActions = DEFAULT_SETTINGS.aiActions.slice();
          await this.plugin.saveSettings();
          this.display(); // 重新渲染界面
        }
      });
    
    const aiActions = (this.plugin.settings.aiActions || []) as any[];
    console.log('[cMenu Settings] AI Actions loaded:', aiActions.length, aiActions.map(a => a.name));
    
    // 如果没有AI动作，显示提示
    if (aiActions.length === 0) {
      const emptyMsg = aiEl.createDiv({ cls: 'setting-item-description' });
      emptyMsg.createEl('p', { 
        text: '没有找到 AI 动作列表。请点击上方“重置为默认”按钮来初始化默认动作。',
        cls: 'mod-warning'
      });
    }
    
    const actionsContainer = aiEl.createDiv({ cls: 'cMenuSettingsTabsContainer' });
    const renderAction = (action: any) => {
      const item = new Setting(actionsContainer)
        .setClass('cMenuCommandItem')
        .setName(action.name || action.id || 'AI 动作')
        .setDesc('名称、图标、落地方式与模版');
      item.addText((t) => {
        t.setPlaceholder('名称').setValue(action.name || '').onChange(
          debounce(async (v) => { action.name = v; await this.plugin.saveSettings(); }, 200, true)
        );
      });
      // 图标输入：带预览、自动完成、推荐
      const iconContainer = item.controlEl.createDiv({ cls: 'cMenuIconInputContainer' });
      
      // 先创建输入框
      const inputWrapper = iconContainer.createDiv({ cls: 'cMenuIconInputWrapper' });
      const input = inputWrapper.createEl('input', { 
        type: 'text', 
        placeholder: '图标 ID（可留空）',
        cls: 'cMenuIconInput'
      });
      input.value = action.icon || '';
      
      // 简化的图标预览（避免复杂组件导致的问题）
      const previewContainer = iconContainer.createDiv({ cls: 'cMenuIconPreviewWrapper' });
      const iconPreviewBtn = new ButtonComponent(previewContainer);
      iconPreviewBtn.setClass('cMenuIconPreview');
      iconPreviewBtn.setDisabled(true);
      
      const updatePreview = (iconId: string) => {
        if (iconId && validateIcon(iconId)) {
          iconPreviewBtn.setIcon(iconId);
          iconPreviewBtn.buttonEl.style.opacity = '1';
        } else if (iconId) {
          iconPreviewBtn.setIcon('bot-glyph'); // 回退图标
          iconPreviewBtn.buttonEl.style.opacity = '0.5';
        } else {
          iconPreviewBtn.setIcon('bot-glyph');
          iconPreviewBtn.buttonEl.style.opacity = '0.3';
        }
      };
      
      updatePreview(action.icon || '');
      
      const iconPreview = {
        setIcon: updatePreview
      };
      
      // 选择图标按钮
      const selectBtn = new ButtonComponent(inputWrapper);
      selectBtn.setButtonText('选择').setClass('cMenuIconSelectBtn');
      selectBtn.onClick(() => {
        const modal = new IconPickerModal(this.app, {
          currentIcon: action.icon,
          onSelect: (iconId: string) => {
            input.value = iconId;
            action.icon = iconId;
            iconPreview.setIcon(iconId);
            this.plugin.saveSettings();
          }
        });
        modal.open();
      });
      
      // 自动完成下拉
      const dropdown = inputWrapper.createDiv({ cls: 'cMenuIconDropdown' });
      dropdown.style.display = 'none';
      
      let currentSuggestions: any[] = [];
      const showDropdown = (suggestions: any[]) => {
        dropdown.empty();
        currentSuggestions = suggestions;
        if (suggestions.length === 0) {
          dropdown.style.display = 'none';
          return;
        }
        
        suggestions.forEach((icon, idx) => {
          const item = dropdown.createDiv({ cls: 'cMenuIconDropdownItem' });
          const iconBtn = new ButtonComponent(item);
          iconBtn.setIcon(icon.id).setClass('cMenuIconDropdownIcon');
          item.createSpan({ text: icon.name, cls: 'cMenuIconDropdownName' });
          item.createSpan({ text: icon.id, cls: 'cMenuIconDropdownId' });
          
          item.addEventListener('click', () => {
            input.value = icon.id;
            action.icon = icon.id;
            iconPreview.setIcon(icon.id);
            dropdown.style.display = 'none';
            this.plugin.saveSettings();
          });
          
          if (idx === 0) item.addClass('is-selected');
        });
        
        dropdown.style.display = 'block';
      };
      
      const hideDropdown = () => {
        setTimeout(() => dropdown.style.display = 'none', 150);
      };
      
      // 输入事件
      input.addEventListener('input', debounce(() => {
        const query = input.value.trim();
        action.icon = query;
        iconPreview.setIcon(query);
        
        if (query) {
          const suggestions = searchIcons(query, 8);
          showDropdown(suggestions);
        } else {
          hideDropdown();
        }
        
        this.plugin.saveSettings();
      }, 200, true));
      
      input.addEventListener('focus', () => {
        if (input.value.trim()) {
          const suggestions = searchIcons(input.value.trim(), 8);
          showDropdown(suggestions);
        } else {
          showDropdown(COMMON_ICONS.slice(0, 8));
        }
      });
      
      input.addEventListener('blur', hideDropdown);
      
      // 键盘导航
      let selectedIndex = -1;
      input.addEventListener('keydown', (e) => {
        if (dropdown.style.display === 'none') return;
        
        if (e.key === 'ArrowDown') {
          e.preventDefault();
          selectedIndex = Math.min(selectedIndex + 1, currentSuggestions.length - 1);
          updateSelection();
        } else if (e.key === 'ArrowUp') {
          e.preventDefault();
          selectedIndex = Math.max(selectedIndex - 1, -1);
          updateSelection();
        } else if (e.key === 'Enter' && selectedIndex >= 0) {
          e.preventDefault();
          const selected = currentSuggestions[selectedIndex];
          if (selected) {
            input.value = selected.id;
            action.icon = selected.id;
            iconPreview.setIcon(selected.id);
            dropdown.style.display = 'none';
            this.plugin.saveSettings();
          }
        } else if (e.key === 'Escape') {
          dropdown.style.display = 'none';
        }
      });
      
      const updateSelection = () => {
        const items = dropdown.querySelectorAll('.cMenuIconDropdownItem');
        items.forEach((item, idx) => {
          if (idx === selectedIndex) {
            item.addClass('is-selected');
          } else {
            item.removeClass('is-selected');
          }
        });
      };
      
      // 推荐图标按钮
      const suggestionsContainer = iconContainer.createDiv({ cls: 'cMenuIconSuggestions' });
      const updateSuggestions = () => {
        suggestionsContainer.empty();
        const suggestions = getSuggestedIcons(action.name || '');
        if (suggestions.length > 0) {
          suggestionsContainer.createSpan({ text: '推荐：', cls: 'cMenuIconSuggestionsLabel' });
          suggestions.slice(0, 4).forEach(iconId => {
            const btn = new ButtonComponent(suggestionsContainer);
            btn.setIcon(iconId).setClass('cMenuIconSuggestionBtn').setTooltip(iconId);
            btn.onClick(() => {
              input.value = iconId;
              action.icon = iconId;
              iconPreview.setIcon(iconId);
              this.plugin.saveSettings();
            });
          });
        }
      };
      updateSuggestions();
      
      // 监听名称变化以更新推荐
      const nameInput = item.controlEl.querySelector('input[placeholder="名称"]') as HTMLInputElement;
      if (nameInput) {
        nameInput.addEventListener('input', debounce(() => {
          updateSuggestions();
        }, 300, true));
      }
      item.addDropdown((dd) => {
        dd.addOptions({ replace: '替换选区', insert: '在选区后插入', quote: '插入为引用块', code: '插入为代码块' })
          .setValue(action.apply || 'replace')
          .onChange(
            debounce(async (v: string) => { action.apply = (v as any); await this.plugin.saveSettings(); }, 100, true)
          );
      });
      item.addButton((del) => {
        del.setIcon('cMenuDelete').setTooltip('删除').setClass('cMenuSettingsButton').setClass('cMenuSettingsButtonDelete')
          .onClick(async () => {
            const idx = aiActions.indexOf(action);
            if (idx >= 0) aiActions.splice(idx, 1);
            this.plugin.settings.aiActions = aiActions as any;
            await this.plugin.saveSettings();
            this.display();
          });
      });
      const templateSetting = new Setting(actionsContainer)
        .setClass('cMenuCommandItem')
        .setName('模版')
        .setDesc('可使用 {selection}、{title}、{surrounding}、{frontmatter}');
      templateSetting.addTextArea((ta) => {
        ta.setValue(action.template || '')
          .onChange(
            debounce(async (v) => { action.template = v; await this.plugin.saveSettings(); }, 300, true)
          );
        ta.inputEl.rows = 4;
      });
    };
    aiActions.forEach(renderAction);
    // 拖拽排序
    Sortable.create(actionsContainer, {
      animation: 300,
      ghostClass: 'sortable-ghost',
      onSort: (evt) => {
        const [removed] = aiActions.splice(evt.oldIndex, 1);
        aiActions.splice(evt.newIndex, 0, removed);
        this.plugin.settings.aiActions = aiActions as any;
        this.plugin.saveSettings();
      },
    });
    // 添加动作按钮
    new Setting(aiEl)
      .setName('添加 AI 动作')
      .setDesc('新增一个自定义的 AI 二级菜单动作')
      .addButton((btn) => {
        btn.setIcon('cMenuAdd').setClass('cMenuSettingsButton').onClick(async () => {
          const action = { id: `ai_custom_${Date.now()}`, name: '新动作', icon: 'bot-glyph', template: '{selection}', apply: 'replace' } as any;
          aiActions.push(action);
          this.plugin.settings.aiActions = aiActions as any;
          await this.plugin.saveSettings();
          this.display();
        });
      });

    // ========== 批量处理 ==========
    const batchEl = sections.batch;
    batchEl.createEl('h3', { text: '批量处理' });
    
    batchEl.createEl('p', { 
      text: '批量处理功能允许您将长文档分割为多个块，并行处理，提高效率。',
      cls: 'setting-item-description'
    });
    
    new Setting(batchEl)
      .setName('打开批量处理界面')
      .setDesc('创建和管理批量处理任务')
      .addButton(btn => {
        btn.setButtonText('打开批量处理')
          .setClass('mod-cta')
          .onClick(() => {
            showBatchProcessingModal(this.app, this.plugin.settings);
          });
      });

    // ========== 历史管理 ==========
    const historyEl = sections.history;
    historyEl.createEl('h3', { text: '历史管理' });
    
    historyEl.createEl('p', { 
      text: 'AI 处理结果的历史记录，支持搜索、收藏和重用。',
      cls: 'setting-item-description'
    });
    
    new Setting(historyEl)
      .setName('打开历史管理界面')
      .setDesc('查看、搜索和管理 AI 处理的历史记录')
      .addButton(btn => {
        btn.setButtonText('打开历史管理')
          .setClass('mod-cta')
          .onClick(() => {
            showHistoryModal(this.app);
          });
      });
    
    // 历史设置
    new Setting(historyEl)
      .setName('最大历史记录数')
      .setDesc('设置保存的最大历史记录数量（100-5000）')
      .addSlider(slider => {
        const historyManager = HistoryManager.getInstance();
        slider.setLimits(100, 5000, 100)
          .setValue(historyManager.getMaxEntries())
          .onChange(value => {
            historyManager.setMaxEntries(value);
          })
          .setDynamicTooltip();
      });

    // ========== 模板管理 ==========
    const templatesEl = sections.templates;
    templatesEl.createEl('h3', { text: '模板管理' });
    
    templatesEl.createEl('p', { 
      text: '创建和管理自定义 AI 动作模板，支持分类、标签、评分和导入导出。',
      cls: 'setting-item-description'
    });
    
    new Setting(templatesEl)
      .setName('打开模板管理器')
      .setDesc('创建、编辑和管理 AI 动作模板')
      .addButton(btn => {
        btn.setButtonText('打开模板管理')
          .setClass('mod-cta')
          .onClick(() => {
            showTemplateManager(this.app);
          });
      });
    
    // 模板统计
    const templateManager = TemplateManager.getInstance();
    const templateStats = templateManager.getStats();
    
    const statsSection = templatesEl.createDiv({ cls: 'setting-item-description' });
    statsSection.createEl('h4', { text: '模板统计' });
    const statsList = statsSection.createEl('ul');
    statsList.createEl('li', { text: `总模板数：${templateStats.totalTemplates}` });
    statsList.createEl('li', { text: `收藏模板：${templateStats.favoriteTemplates}` });
    statsList.createEl('li', { text: `平均评分：${templateStats.averageRating.toFixed(1)}` });
    
    const mostUsedTemplate = templateStats.mostUsedTemplate 
      ? templateManager.getTemplate(templateStats.mostUsedTemplate)?.name || '无'
      : '无';
    statsList.createEl('li', { text: `最常用：${mostUsedTemplate}` });
    
    // 快速操作
    const quickActions = templatesEl.createDiv({ cls: 'setting-item-description' });
    quickActions.createEl('h4', { text: '快速操作' });
    
    const actionsRow = quickActions.createDiv({ cls: 'template-quick-actions' });
    
    const importBtn = actionsRow.createEl('button', { 
      text: '导入模板',
      cls: 'template-action-btn'
    });
    importBtn.addEventListener('click', () => {
      this.importTemplatesQuick();
    });
    
    const exportBtn = actionsRow.createEl('button', { 
      text: '导出所有',
      cls: 'template-action-btn'
    });
    exportBtn.addEventListener('click', () => {
      this.exportAllTemplates();
    });
    
    const clearBtn = actionsRow.createEl('button', { 
      text: '清空模板',
      cls: 'template-action-btn mod-warning'
    });
    clearBtn.addEventListener('click', () => {
      this.clearAllTemplates();
    });
    
    // 模板分类说明
    const categoriesInfo = templatesEl.createDiv({ cls: 'setting-item-description' });
    categoriesInfo.createEl('h4', { text: '默认分类' });
    const categoriesList = categoriesInfo.createEl('ul');
    const categories = templateManager.getAllCategories();
    categories.slice(0, 4).forEach(category => {
      categoriesList.createEl('li', { text: `${category.name}：${category.description}` });
    });
    
    // ========== 性能监控 ==========
    const performanceEl = sections.performance;
    performanceEl.createEl('h3', { text: '性能监控' });
    
    performanceEl.createEl('p', { 
      text: '实时监控 AI 模块的性能指标，优化系统设置。',
      cls: 'setting-item-description'
    });
    
    new Setting(performanceEl)
      .setName('打开性能面板')
      .setDesc('查看实时性能数据和优化建议')
      .addButton(btn => {
        btn.setButtonText('打开性能面板')
          .setClass('mod-cta')
          .onClick(() => {
            showPerformanceDashboard(this.app);
          });
      });
    
    // 性能监控说明
    const perfInfo = performanceEl.createDiv({ cls: 'setting-item-description' });
    perfInfo.createEl('h4', { text: '性能指标说明' });
    const perfList = perfInfo.createEl('ul');
    perfList.createEl('li', { text: '缓存命中率：显示 AI 响应缓存的效率' });
    perfList.createEl('li', { text: '队列吞吐量：每秒处理的请求数量' });
    perfList.createEl('li', { text: '内存使用：当前内存占用情况' });
    perfList.createEl('li', { text: '渲染性能：流式渲染的 FPS 和延迟' });
    
    const perfTips = performanceEl.createDiv({ cls: 'setting-item-description' });
    perfTips.createEl('h4', { text: '性能优化建议' });
    const tipsList = perfTips.createEl('ul');
    tipsList.createEl('li', { text: '如果缓存命中率低，可考虑增加缓存大小' });
    tipsList.createEl('li', { text: '如果队列堆积，可调整并发数量' });
    tipsList.createEl('li', { text: '如果内存使用过高，可开启自动清理' });
    tipsList.createEl('li', { text: '如果渲染卡顿，可降低渲染质量' });

    // ========== 关于 ==========
    const aboutEl = sections.about;
    aboutEl.createEl('h3', { text: '关于 cMenu AI 助手' });
    
    // 基本信息
    const meta = aboutEl.createEl('div', { cls: 'cMenu-about' });
    meta.createEl('p', { text: `版本：v${this.plugin.manifest.version}` });
    const creditP = meta.createEl('p');
    creditP.appendText('原作者：');
    creditP.createEl('a', { text: 'Chetachi', href: 'https://github.com/chetachiezikeuzor' });
    
    // AI 增强功能介绍
    const aiFeatures = aboutEl.createDiv({ cls: 'setting-item-description' });
    aiFeatures.createEl('h4', { text: 'AI 增强功能' });
    const featuresList = aiFeatures.createEl('ul');
    featuresList.createEl('li', { text: '智能文本处理：优化、翻译、总结、解释、改进、续写' });
    featuresList.createEl('li', { text: '批量处理：支持长文档分块并行处理' });
    featuresList.createEl('li', { text: '历史管理：完整的 AI 操作历史记录和管理' });
    featuresList.createEl('li', { text: '性能优化：智能缓存、流式渲染、预加载' });
    featuresList.createEl('li', { text: '稳定性增强：重试机制、错误处理、进度显示' });
    
    // 技术特性
    const techFeatures = aboutEl.createDiv({ cls: 'setting-item-description' });
    techFeatures.createEl('h4', { text: '技术特性' });
    const techList = techFeatures.createEl('ul');
    techList.createEl('li', { text: '支持 DeepSeek 和 OpenAI 兼容接口' });
    techList.createEl('li', { text: '流式输出和实时预览' });
    techList.createEl('li', { text: '自适应性能配置和监控' });
    techList.createEl('li', { text: '本地存储和数据安全' });
    techList.createEl('li', { text: '响应式设计和主题适配' });
    
    // 更新日志
    const changelog = aboutEl.createDiv({ cls: 'setting-item-description' });
    changelog.createEl('h4', { text: '最近更新' });
    const changeList = changelog.createEl('ul');
    changeList.createEl('li', { text: 'Phase 3: 功能增强 - 批量处理和历史管理' });
    changeList.createEl('li', { text: 'Phase 2: 性能优化 - 缓存、流式渲染、预加载' });
    changeList.createEl('li', { text: 'Phase 1: 稳定性增强 - 重试、错误处理、进度显示' });
    changeList.createEl('li', { text: '新增 6 个默认 AI 动作和自定义支持' });
    
    meta.createEl('p', { text: '如果你喜欢这个插件并希望支持持续开发，可以点击下方按钮赞助。' });
    aboutEl.appendChild(createDonateButton('https://www.buymeacoffee.com/chetachi'));

    // 恢复上次激活的标签页（若无则选第一个）
    const fallbackKey = Object.keys(sections)[0] as keyof typeof sections;
    const initialKey = (this.currentTabKey && (this.currentTabKey in sections))
      ? (this.currentTabKey as keyof typeof sections)
      : fallbackKey;
    switchTo(initialKey);
  }

  // 模板管理快速操作方法
  private importTemplatesQuick() {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '.json';
    
    input.addEventListener('change', (e) => {
      const file = (e.target as HTMLInputElement).files?.[0];
      if (!file) return;
      
      const reader = new FileReader();
      reader.onload = (e) => {
        try {
          const data = e.target?.result as string;
          const templateManager = TemplateManager.getInstance();
          const importedCount = templateManager.importTemplates(data, 'merge');
          new Notice(`成功导入 ${importedCount} 个模板`);
          this.display(); // 刷新界面以更新统计信息
        } catch (error) {
          new Notice(`导入失败：${error.message}`);
        }
      };
      reader.readAsText(file);
    });
    
    input.click();
  }

  private exportAllTemplates() {
    const templateManager = TemplateManager.getInstance();
    const data = templateManager.exportTemplates();
    
    // 复制到剪贴板
    navigator.clipboard.writeText(data).then(() => {
      new Notice('所有模板已复制到剪贴板');
    }).catch(() => {
      // 创建下载链接
      const blob = new Blob([data], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `all_templates_${new Date().toISOString().split('T')[0]}.json`;
      a.click();
      URL.revokeObjectURL(url);
      new Notice('所有模板已下载');
    });
  }

  private clearAllTemplates() {
    if (confirm('确定要清空所有模板吗？此操作不可恢复！')) {
      const templateManager = TemplateManager.getInstance();
      const count = templateManager.clearAll();
      new Notice(`已清空 ${count} 个模板`);
      this.display(); // 刷新界面以更新统计信息
    }
  }

}

const createDonateButton = (link: string): HTMLElement => {
  const a = createEl("a");
  a.setAttribute("href", link);
  a.addClass("buymeacoffee-chetachi-img");
  a.innerHTML = `<img src="https://img.buymeacoffee.com/button-api/?text=Buy me a coffee&emoji=&slug=chetachi&button_colour=e3e7ef&font_colour=262626&font_family=Inter&outline_colour=262626&coffee_colour=ff0000" height="42px">`;
  return a;
};
