// 图标目录：提供可用图标列表、别名、标签和推荐映射
export interface IconInfo {
  id: string;           // 图标 ID
  name: string;         // 显示名称
  aliases?: string[];   // 别名（用于搜索）
  tags?: string[];      // 标签分类
  source: 'obsidian' | 'plugin' | 'lucide'; // 来源
}

// 常用 Obsidian/Lucide 图标
export const COMMON_ICONS: IconInfo[] = [
  // AI 相关
  { id: 'bot', name: '机器人', aliases: ['ai', 'robot'], tags: ['ai'], source: 'lucide' },
  { id: 'bot-glyph', name: '机器人（插件）', aliases: ['ai'], tags: ['ai'], source: 'plugin' },
  { id: 'brain', name: '大脑', aliases: ['think'], tags: ['ai'], source: 'lucide' },
  { id: 'cpu', name: 'CPU', aliases: ['processor'], tags: ['ai'], source: 'lucide' },
  
  // 编辑相关
  { id: 'wand', name: '魔法棒', aliases: ['magic', 'wand'], tags: ['edit'], source: 'lucide' },
  { id: 'pen', name: '编辑笔', aliases: ['edit', 'pen'], tags: ['edit'], source: 'lucide' },
  { id: 'pencil', name: '铅笔', aliases: ['write', 'edit', 'continue'], tags: ['edit'], source: 'lucide' },
  { id: 'edit', name: '编辑', aliases: ['edit'], tags: ['edit'], source: 'lucide' },
  { id: 'feather', name: '羽毛笔', aliases: ['write'], tags: ['edit'], source: 'lucide' },
  
  // 操作相关
  { id: 'arrow-right', name: '右箭头', aliases: ['continue', 'next'], tags: ['action'], source: 'lucide' },
  { id: 'chevron-right', name: '右箭头', aliases: ['continue', 'forward'], tags: ['action'], source: 'lucide' },
  { id: 'rotate-ccw', name: '逆时针旋转', aliases: ['rewrite', 'undo'], tags: ['action'], source: 'lucide' },
  { id: 'refresh-cw', name: '刷新', aliases: ['refresh', 'reload'], tags: ['action'], source: 'lucide' },
  
  // 文档相关
  { id: 'list', name: '列表', aliases: ['summary', 'list'], tags: ['document'], source: 'lucide' },
  { id: 'list-tree', name: '树形列表', aliases: ['structure', 'outline'], tags: ['document'], source: 'lucide' },
  { id: 'list-ordered', name: '有序列表', aliases: ['numbered'], tags: ['document'], source: 'lucide' },
  { id: 'filter', name: '过滤器', aliases: ['filter'], tags: ['document'], source: 'lucide' },
  
  // 语言相关
  { id: 'languages', name: '语言', aliases: ['translate', 'lang'], tags: ['language'], source: 'lucide' },
  { id: 'globe', name: '地球', aliases: ['world', 'translate'], tags: ['language'], source: 'lucide' },
  
  // 验证相关
  { id: 'shield-check', name: '盾牌检查', aliases: ['verify', 'check'], tags: ['verify'], source: 'lucide' },
  { id: 'check-circle', name: '检查圆圈', aliases: ['correct', 'check'], tags: ['verify'], source: 'lucide' },
  { id: 'check', name: '检查', aliases: ['check'], tags: ['verify'], source: 'lucide' },
  { id: 'help-circle', name: '帮助圆圈', aliases: ['help', 'question', 'explain'], tags: ['help'], source: 'lucide' },
  { id: 'info', name: '信息', aliases: ['information'], tags: ['help'], source: 'lucide' },
  
  // 插件自定义
  { id: 'cMenuAdd', name: '添加（插件）', aliases: ['add', 'plus'], tags: ['plugin'], source: 'plugin' },
  { id: 'cMenuDelete', name: '删除（插件）', aliases: ['delete', 'remove'], tags: ['plugin'], source: 'plugin' },
  { id: 'cMenuReload', name: '重载（插件）', aliases: ['reload'], tags: ['plugin'], source: 'plugin' },
  
  // 通用图标
  { id: 'star', name: '星星', aliases: ['favorite'], tags: ['general'], source: 'lucide' },
  { id: 'heart', name: '心形', aliases: ['love', 'like'], tags: ['general'], source: 'lucide' },
  { id: 'bookmark', name: '书签', aliases: ['save'], tags: ['general'], source: 'lucide' },
  { id: 'tag', name: '标签', aliases: ['label'], tags: ['general'], source: 'lucide' },
  { id: 'zap', name: '闪电', aliases: ['fast', 'quick'], tags: ['general'], source: 'lucide' },
  { id: 'sparkles', name: '闪光', aliases: ['magic', 'shine'], tags: ['general'], source: 'lucide' },
  
  // 更多常用图标
  { id: 'file-text', name: '文档', aliases: ['document', 'file'], tags: ['document'], source: 'lucide' },
  { id: 'folder', name: '文件夹', aliases: ['directory'], tags: ['general'], source: 'lucide' },
  { id: 'search', name: '搜索', aliases: ['find'], tags: ['general'], source: 'lucide' },
  { id: 'settings', name: '设置', aliases: ['config'], tags: ['general'], source: 'lucide' },
  { id: 'plus', name: '加号', aliases: ['add'], tags: ['general'], source: 'lucide' },
  { id: 'minus', name: '减号', aliases: ['remove'], tags: ['general'], source: 'lucide' },
  { id: 'x', name: '关闭', aliases: ['close', 'delete'], tags: ['general'], source: 'lucide' },
  { id: 'copy', name: '复制', aliases: ['duplicate'], tags: ['action'], source: 'lucide' },
  { id: 'scissors', name: '剪切', aliases: ['cut'], tags: ['action'], source: 'lucide' },
  { id: 'clipboard', name: '粘贴板', aliases: ['paste'], tags: ['action'], source: 'lucide' },
  { id: 'download', name: '下载', aliases: ['save'], tags: ['action'], source: 'lucide' },
  { id: 'upload', name: '上传', aliases: ['load'], tags: ['action'], source: 'lucide' },
  { id: 'link', name: '链接', aliases: ['url'], tags: ['general'], source: 'lucide' },
  { id: 'image', name: '图片', aliases: ['photo'], tags: ['general'], source: 'lucide' },
  { id: 'video', name: '视频', aliases: ['movie'], tags: ['general'], source: 'lucide' },
  { id: 'music', name: '音乐', aliases: ['audio'], tags: ['general'], source: 'lucide' },
  { id: 'calendar', name: '日历', aliases: ['date'], tags: ['general'], source: 'lucide' },
  { id: 'clock', name: '时钟', aliases: ['time'], tags: ['general'], source: 'lucide' },
  { id: 'user', name: '用户', aliases: ['person'], tags: ['general'], source: 'lucide' },
  { id: 'users', name: '多用户', aliases: ['people'], tags: ['general'], source: 'lucide' },
  { id: 'mail', name: '邮件', aliases: ['email'], tags: ['general'], source: 'lucide' },
  { id: 'phone', name: '电话', aliases: ['call'], tags: ['general'], source: 'lucide' },
  { id: 'home', name: '主页', aliases: ['house'], tags: ['general'], source: 'lucide' },
  { id: 'map-pin', name: '地点', aliases: ['location'], tags: ['general'], source: 'lucide' },
  { id: 'trending-up', name: '上升', aliases: ['increase', 'improve'], tags: ['general'], source: 'lucide' },
  { id: 'trending-down', name: '下降', aliases: ['decrease'], tags: ['general'], source: 'lucide' },
  { id: 'pie-chart', name: '饼图', aliases: ['chart'], tags: ['general'], source: 'lucide' },
  { id: 'bar-chart', name: '柱状图', aliases: ['chart', 'analysis'], tags: ['general'], source: 'lucide' },
  { id: 'code', name: '代码', aliases: ['programming', 'coding'], tags: ['general'], source: 'lucide' },
  { id: 'lightbulb', name: '灯泡', aliases: ['idea', 'creative'], tags: ['general'], source: 'lucide' },
  { id: 'graduation-cap', name: '毕业帽', aliases: ['education', 'learning'], tags: ['general'], source: 'lucide' },
  { id: 'briefcase', name: '公文包', aliases: ['business', 'work'], tags: ['general'], source: 'lucide' },
  { id: 'activity', name: '活动', aliases: ['pulse'], tags: ['general'], source: 'lucide' },
  { id: 'award', name: '奖励', aliases: ['prize'], tags: ['general'], source: 'lucide' },
  { id: 'target', name: '目标', aliases: ['aim'], tags: ['general'], source: 'lucide' },
  { id: 'flag', name: '旗帜', aliases: ['marker'], tags: ['general'], source: 'lucide' },
  { id: 'key', name: '钥匙', aliases: ['password'], tags: ['general'], source: 'lucide' },
  { id: 'lock', name: '锁', aliases: ['secure'], tags: ['general'], source: 'lucide' },
  { id: 'unlock', name: '解锁', aliases: ['open'], tags: ['general'], source: 'lucide' },
  { id: 'eye', name: '眼睛', aliases: ['view', 'show'], tags: ['general'], source: 'lucide' },
  { id: 'eye-off', name: '隐藏', aliases: ['hide'], tags: ['general'], source: 'lucide' },
  { id: 'sun', name: '太阳', aliases: ['light'], tags: ['general'], source: 'lucide' },
  { id: 'moon', name: '月亮', aliases: ['dark'], tags: ['general'], source: 'lucide' },
  { id: 'cloud', name: '云', aliases: ['weather'], tags: ['general'], source: 'lucide' },
  { id: 'wifi', name: 'WiFi', aliases: ['network'], tags: ['general'], source: 'lucide' },
  { id: 'bluetooth', name: '蓝牙', aliases: ['wireless'], tags: ['general'], source: 'lucide' },
  { id: 'battery', name: '电池', aliases: ['power'], tags: ['general'], source: 'lucide' },
  { id: 'volume-2', name: '音量', aliases: ['sound'], tags: ['general'], source: 'lucide' },
  { id: 'volume-x', name: '静音', aliases: ['mute'], tags: ['general'], source: 'lucide' },
];

// 基于动作名称的推荐图标映射
export const ACTION_ICON_SUGGESTIONS: Record<string, string[]> = {
  '优化': ['wand', 'sparkles', 'pen'],
  '润色': ['wand', 'feather', 'sparkles'],
  '续写': ['arrow-right', 'chevron-right', 'pen'],
  '继续': ['arrow-right', 'chevron-right'],
  '总结': ['list', 'filter', 'list-tree'],
  '摘要': ['list', 'filter'],
  '翻译': ['languages', 'globe'],
  '改写': ['rotate-ccw', 'pen', 'refresh-cw'],
  '重述': ['rotate-ccw', 'refresh-cw'],
  '纠错': ['shield-check', 'check-circle'],
  '检查': ['shield-check', 'check-circle', 'check'],
  '结构化': ['list-tree', 'list-ordered'],
  '提纲': ['list-tree', 'list-ordered'],
  '扩展': ['chevron-right', 'arrow-right'],
  '压缩': ['filter', 'list'],
};

// 搜索图标
export function searchIcons(query: string, limit = 10): IconInfo[] {
  if (!query.trim()) return COMMON_ICONS.slice(0, limit);
  
  const q = query.toLowerCase().trim();
  const matches = COMMON_ICONS.filter(icon => {
    return icon.id.toLowerCase().includes(q) ||
           icon.name.toLowerCase().includes(q) ||
           (icon.aliases && icon.aliases.some(alias => alias.toLowerCase().includes(q))) ||
           (icon.tags && icon.tags.some(tag => tag.toLowerCase().includes(q)));
  });
  
  return matches.slice(0, limit);
}

// 获取推荐图标
export function getSuggestedIcons(actionName: string): string[] {
  const name = actionName.toLowerCase().trim();
  for (const [key, suggestions] of Object.entries(ACTION_ICON_SUGGESTIONS)) {
    if (name.includes(key.toLowerCase()) || key.toLowerCase().includes(name)) {
      return suggestions;
    }
  }
  return ['bot-glyph', 'wand', 'pen']; // 默认推荐
}

// 验证图标是否存在
export function validateIcon(iconId: string): boolean {
  if (!iconId) return false;
  return COMMON_ICONS.some(icon => icon.id === iconId);
}

// 获取图标信息
export function getIconInfo(iconId: string): IconInfo | null {
  return COMMON_ICONS.find(icon => icon.id === iconId) || null;
}
