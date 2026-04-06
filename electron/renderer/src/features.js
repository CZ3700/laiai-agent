// ═══ MISC FEATURES ═══
import { state } from './state.js';
import { t } from './i18n.js';
import { toast, esc, formatChatText } from './utils.js';

// ═══ CONFIRM DIALOG / SKILLS ═══
export function confirmSkill(name, desc, promptBase){
  const userInput=(document.getElementById('skill-input')||{}).value||'';
  const fullPrompt=userInput.trim()
    ? promptBase+':\n\n```\n'+userInput.trim()+'\n```'
    : promptBase+'（'+t('skills.analyzing')+'）';
  state.pendingSkill={page:'skills',prompt:fullPrompt,name};
  document.getElementById('mc-skill-name').textContent='⚡ '+name;
  document.getElementById('mc-desc').textContent=desc;
  document.getElementById('m-confirm').classList.add('show');
}

export function confirmAction(page, name, desc, prompt){
  state.pendingSkill={page,prompt,name};
  document.getElementById('mc-skill-name').textContent='🤖 '+name;
  document.getElementById('mc-desc').textContent=desc;
  document.getElementById('m-confirm').classList.add('show');
}

export function closeConfirm(){document.getElementById('m-confirm').classList.remove('show')}

export function execConfirmedSkill(){
  closeConfirm();
  runSkillInline(state.pendingSkill.page, state.pendingSkill.prompt);
}

export async function runSkillInline(page, prompt){
  const el=document.getElementById(page+'-result');
  if(!el)return;
  el.className='result-area loading show';
  el.textContent=t('chat.loading');
  const btns=el.closest('.card')?.previousElementSibling?.querySelectorAll('.btn')||
             el.closest('.card')?.querySelectorAll('.btn')||[];
  btns.forEach(b=>b.disabled=true);
  const pid=document.getElementById('tp').value;
  const prov=state.providers.find(p=>p.id===pid)||state.providers.find(p=>p.isDefault);
  if(!prov){el.className='result-area show';el.textContent=t('chat.config_api');btns.forEach(b=>b.disabled=false);return}
  const result=await electronAPI.chatSend({
    provider:{baseUrl:prov.baseUrl,apiKey:prov.apiKey,defaultModel:prov.defaultModel||''},
    messages:[{role:'user',content:prompt}]
  });
  btns.forEach(b=>b.disabled=false);
  el.className='result-area show';
  if(result.ok){el.innerHTML='<div class="r-ai">'+formatChatText(result.content)+'</div>'}
  else{el.textContent=t('chat.error_prefix')+': '+(result.error||'Unknown error')}
}

export async function runGit(cmd){
  const el=document.getElementById('agent-git-info');
  el.className='result-area loading show';
  el.textContent=t('git.executing')+' '+cmd+'...';
  const r=await electronAPI.runShell({cmd:'git '+cmd});
  el.className='result-area show';
  el.textContent=r.ok?(r.output||t('git.no_output')):(r.error||'Error');
}

export async function loadAgentInfo(){runGit('status --short')}

// ═══ MEMORY (LAIAI.md) ═══
export async function loadLaiaiMd(){
  const r=await electronAPI.loadLaiaiMd();
  const editor=document.getElementById('memory-editor');
  const label=document.getElementById('memory-file');
  if(r.ok){editor.value=r.content;label.textContent=r.file}
  else{editor.value='';label.textContent=t('memory.not_found')}
}

export async function saveLaiaiMd(){
  const drawer=document.getElementById('settings-drawer');
  const ed=(drawer&&drawer.classList.contains('open'))?document.getElementById('sd-memory-editor'):document.getElementById('memory-editor');
  await electronAPI.saveLaiaiMd({content:ed?.value||''});
  toast(t('toast.saved'));
}

export async function createLaiaiMd(){
  const content='# LAIAI.md\n\n'+t('ph.memory_template')+'\n';
  document.getElementById('memory-editor').value=content;
  await electronAPI.saveLaiaiMd({content});
  document.getElementById('memory-file').textContent='LAIAI.md';
  toast(t('memory.created'));
}

export async function genLaiaiMd(){
  const drawer=document.getElementById('settings-drawer');
  const el=(drawer&&drawer.classList.contains('open'))?document.getElementById('sd-memory-gen-result'):document.getElementById('memory-gen-result');
  if(el){el.className='result-area loading show';el.textContent=t('memory.ai_analyzing');}
  const pid=document.getElementById('tp').value;
  const prov=state.providers.find(p=>p.id===pid)||state.providers.find(p=>p.isDefault);
  if(!prov){if(el){el.className='result-area show';el.textContent=t('memory.config_api');}return}
  const result=await electronAPI.chatSend({
    provider:{baseUrl:prov.baseUrl,apiKey:prov.apiKey,defaultModel:prov.defaultModel||''},
    messages:[{role:'user',content:'请根据当前项目生成一份LAIAI.md配置文件内容，包含项目说明、技术栈、编码规范。直接输出markdown内容，不需要其他解释。'}]
  });
  if(result.ok){
    document.getElementById('memory-editor').value=result.content;
    if(el){el.className='result-area show';el.innerHTML='<div class="r-ai">'+t('memory.generated')+'</div>';}
  }else{
    if(el){el.className='result-area show';el.textContent=t('chat.error_prefix')+': '+result.error;}
  }
}

// ═══ PLUGINS ═══
// ═══ PLUGIN SYSTEM ═══
let _plugins = [];
let _editingPlugin = null;
let _pluginFilter = 'all';

// SVG icon helper for plugins
function pluginSvgIcon(type) {
  const icons = {
    translate: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><circle cx="12" cy="12" r="10"/><path d="M2 12h20M12 2a15.3 15.3 0 014 10 15.3 15.3 0 01-4 10 15.3 15.3 0 01-4-10 15.3 15.3 0 014-10z"/></svg>',
    summarize: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><line x1="8" y1="6" x2="21" y2="6"/><line x1="8" y1="12" x2="21" y2="12"/><line x1="8" y1="18" x2="21" y2="18"/><line x1="3" y1="6" x2="3.01" y2="6"/><line x1="3" y1="12" x2="3.01" y2="12"/><line x1="3" y1="18" x2="3.01" y2="18"/></svg>',
    email: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"/><polyline points="22 6 12 13 2 6"/></svg>',
    code: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><polyline points="16 18 22 12 16 6"/><polyline points="8 6 2 12 8 18"/></svg>',
    meeting: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/></svg>',
    database: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><ellipse cx="12" cy="5" rx="9" ry="3"/><path d="M21 12c0 1.66-4 3-9 3s-9-1.34-9-3"/><path d="M3 5v14c0 1.66 4 3 9 3s9-1.34 9-3V5"/></svg>',
    regex: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M17 3v10"/><path d="M12.67 5.5l8.66 5"/><path d="M12.67 10.5l8.66-5"/></svg>',
    api: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M10 13a5 5 0 007.54.54l3-3a5 5 0 00-7.07-7.07l-1.72 1.71"/><path d="M14 11a5 5 0 00-7.54-.54l-3 3a5 5 0 007.07 7.07l1.71-1.71"/></svg>',
    git: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><circle cx="18" cy="18" r="3"/><circle cx="6" cy="6" r="3"/><path d="M13 6h3a2 2 0 012 2v7"/><line x1="6" y1="9" x2="6" y2="21"/></svg>',
    notion: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><rect x="3" y="3" width="18" height="18" rx="2"/><path d="M8 7h8M8 12h5M8 17h3"/></svg>',
    slack: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M21 15a2 2 0 01-2 2H7l-4 4V5a2 2 0 012-2h14a2 2 0 012 2z"/></svg>',
    jira: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><circle cx="12" cy="12" r="10"/><circle cx="12" cy="12" r="3"/></svg>',
    default: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><rect x="2" y="7" width="20" height="14" rx="2"/><path d="M16 7V4a2 2 0 00-2-2h-4a2 2 0 00-2 2v3"/></svg>',
  };
  return icons[type] || icons.default;
}

// Built-in plugin marketplace
const PLUGIN_MARKETPLACE = [
  {
    id: 'translator', iconType: 'translate', type: 'command', trigger: '/translate',
    name: 'Universal Translator', nameZh: '万能翻译',
    desc: 'Translate text between any languages', descZh: '翻译任意语言之间的文本',
    prompt: 'Translate the following text. Auto-detect the source language. If the source is Chinese, translate to English. If the source is English, translate to Chinese. If it\'s another language, translate to both Chinese and English. Maintain formatting and tone:\n\n{input}',
  },
  {
    id: 'summarizer', iconType: 'summarize', type: 'command', trigger: '/summarize',
    name: 'Smart Summarizer', nameZh: '智能摘要',
    desc: 'Summarize long text into key points', descZh: '将长文本提炼为要点摘要',
    prompt: 'Please summarize the following content into clear, concise key points. Use bullet points and maintain the original language:\n\n{input}',
  },
  {
    id: 'email-writer', iconType: 'email', type: 'template', trigger: '/draft',
    name: 'Email Composer', nameZh: '邮件撰写助手',
    desc: 'Draft professional emails from brief notes', descZh: '根据简短说明撰写专业邮件',
    prompt: 'Write a professional email based on these notes. Include subject line, greeting, body, and sign-off. Match the tone to the context (formal/casual). Use the same language as the input:\n\n{input}',
  },
  {
    id: 'code-explain', iconType: 'code', type: 'command', trigger: '/explain',
    name: 'Code Explainer', nameZh: '代码讲解',
    desc: 'Explain code with line-by-line comments', descZh: '逐行注释解释代码逻辑',
    prompt: 'Explain the following code in detail. Add inline comments for each important line. Explain the overall logic, design patterns used, and any potential issues:\n\n```\n{input}\n```',
  },
  {
    id: 'meeting-notes', iconType: 'meeting', type: 'template', trigger: '/meeting',
    name: 'Meeting Notes', nameZh: '会议纪要',
    desc: 'Generate structured meeting notes', descZh: '生成结构化会议纪要',
    prompt: 'Based on the following meeting discussion, create structured meeting notes with: 1) Date & Attendees, 2) Key Discussion Points, 3) Decisions Made, 4) Action Items (with owners and deadlines). Use the same language as the input:\n\n{input}',
  },
  {
    id: 'sql-gen', iconType: 'database', type: 'command', trigger: '/sql',
    name: 'SQL Generator', nameZh: 'SQL生成器',
    desc: 'Generate SQL from natural language', descZh: '用自然语言生成SQL查询',
    prompt: 'Generate a SQL query based on this natural language request. If table/column names aren\'t specified, use reasonable defaults. Include comments explaining the query. Also provide the query formatted for readability:\n\n{input}',
  },
  {
    id: 'regex-helper', iconType: 'regex', type: 'command', trigger: '/regex',
    name: 'Regex Helper', nameZh: '正则助手',
    desc: 'Generate and explain regular expressions', descZh: '生成和解释正则表达式',
    prompt: 'Create a regular expression for the following requirement. Provide: 1) The regex pattern, 2) A detailed explanation of each part, 3) Example matches and non-matches, 4) Any edge cases to watch out for:\n\n{input}',
  },
  {
    id: 'api-doc', iconType: 'api', type: 'template', trigger: '/apidoc',
    name: 'API Documentation', nameZh: 'API文档生成',
    desc: 'Generate API docs from code or description', descZh: '从代码或描述生成API文档',
    prompt: 'Generate comprehensive API documentation for the following. Include: endpoint, method, parameters (with types and required/optional), request/response examples in JSON, error codes, and usage notes:\n\n{input}',
  },
  {
    id: 'git-msg', iconType: 'git', type: 'command', trigger: '/commit',
    name: 'Commit Message Writer', nameZh: '提交信息生成',
    desc: 'Write conventional commit messages', descZh: '生成规范的Git提交信息',
    prompt: 'Based on the following code changes or description, write a conventional commit message following the format: type(scope): description. Types: feat, fix, docs, style, refactor, test, chore. Include a brief body if the change is complex:\n\n{input}',
  },
  {
    id: 'notion-sync', iconType: 'notion', type: 'integration',
    name: 'Notion Integration', nameZh: 'Notion集成',
    desc: 'Sync notes and tasks with Notion workspace', descZh: '同步笔记和任务到Notion工作区',
    prompt: 'INTEGRATION_CONFIG',
    envKeys: ['NOTION_TOKEN', 'NOTION_DATABASE_ID'],
  },
  {
    id: 'slack-notify', iconType: 'slack', type: 'integration',
    name: 'Slack Notifications', nameZh: 'Slack通知',
    desc: 'Send messages and notifications to Slack', descZh: '发送消息和通知到Slack频道',
    prompt: 'INTEGRATION_CONFIG',
    envKeys: ['SLACK_WEBHOOK_URL'],
  },
  {
    id: 'jira-tracker', iconType: 'jira', type: 'integration',
    name: 'Jira Integration', nameZh: 'Jira集成',
    desc: 'Create and manage Jira issues from chat', descZh: '从聊天中创建和管理Jira工单',
    prompt: 'INTEGRATION_CONFIG',
    envKeys: ['JIRA_URL', 'JIRA_EMAIL', 'JIRA_TOKEN'],
  },
];

export async function loadPlugins() {
  // Load user plugins from config
  try {
    const cfg = await electronAPI.loadConfig() || {};
    _plugins = cfg.plugins || [];
  } catch { _plugins = []; }
  renderPlugins();
  renderPluginMarket();
}

function renderPlugins() {
  const el = document.getElementById('plugins-list');
  const sdEl = document.getElementById('sd-plugins-installed');
  const countEl = document.getElementById('plugins-count');
  if (!el && !sdEl) return;

  const filtered = _pluginFilter === 'all' ? _plugins : _plugins.filter(p => p.type === _pluginFilter);
  if (countEl) countEl.textContent = _plugins.length;

  const emptyHtml = '<div class="empty-state">' +
    '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><rect x="2" y="7" width="20" height="14" rx="2"/><path d="M16 7V4a2 2 0 00-2-2h-4a2 2 0 00-2 2v3"/></svg>' +
    '<div class="empty-state-title">' + t('plugins.empty_title') + '</div>' +
    '<div class="empty-state-desc">' + t('plugins.empty') + '</div></div>';

  if (!filtered.length) {
    if (el) el.innerHTML = emptyHtml;
    if (sdEl) sdEl.innerHTML = emptyHtml;
    return;
  }

  const html = filtered.map((p, i) => {
    const iconSvg = pluginSvgIcon(p.iconType || p.type || 'default');
    const typeLabel = { command: 'Command', template: 'Template', integration: 'Integration' }[p.type] || p.type;
    return '<div class="plugin-item">' +
      '<div class="plugin-icon">' + iconSvg + '</div>' +
      '<div class="plugin-info">' +
      '<div class="plugin-name">' + esc(p.name) + (p.trigger ? ' <code>' + esc(p.trigger) + '</code>' : '') + '</div>' +
      '<div class="plugin-desc">' + esc(p.desc || '') + '</div>' +
      '<div class="plugin-type">' + typeLabel + '</div>' +
      '</div>' +
      '<div class="plugin-actions">' +
      '<label class="plugin-toggle"><input type="checkbox" ' + (p.enabled !== false ? 'checked' : '') + ' onchange="togglePlugin(' + i + ',this.checked)"><span class="toggle-slider"></span></label>' +
      '<button class="btn btn-xs" onclick="editPlugin(' + i + ')" title="Edit">✏️</button>' +
      '<button class="btn btn-xs" onclick="deletePlugin(' + i + ')" title="Delete">🗑️</button>' +
      '</div></div>';
  }).join('');
  if (el) el.innerHTML = html;
  if (sdEl) sdEl.innerHTML = html;
}

function renderPluginMarket() {
  const el = document.getElementById('plugins-market');
  const sdEl = document.getElementById('sd-plugins-market');
  if (!el && !sdEl) return;
  const installedIds = _plugins.map(p => p.id);
  const filtered = _pluginFilter === 'all'
    ? PLUGIN_MARKETPLACE
    : PLUGIN_MARKETPLACE.filter(p => p.type === _pluginFilter);

  const html = filtered.map(item => {
    const isInstalled = installedIds.includes(item.id);
    const name = state.lang === 'zh' ? (item.nameZh || item.name) : item.name;
    const desc = state.lang === 'zh' ? (item.descZh || item.desc) : item.desc;
    return '<div class="plugin-market-item">' +
      '<div class="plugin-icon">' + pluginSvgIcon(item.iconType || 'default') + '</div>' +
      '<div class="plugin-info">' +
      '<div class="plugin-name">' + esc(name) + (item.trigger ? ' <code>' + esc(item.trigger) + '</code>' : '') + '</div>' +
      '<div class="plugin-desc">' + esc(desc) + '</div>' +
      '</div>' +
      (isInstalled
        ? '<span class="plugin-installed-badge">✓ ' + t('plugins.installed_label') + '</span>'
        : '<button class="btn btn-p btn-sm" onclick="installPlugin(\'' + item.id + '\')">' + t('plugins.install') + '</button>'
      ) + '</div>';
  }).join('');
  if (el) el.innerHTML = html;
  if (sdEl) sdEl.innerHTML = html;
}

export function filterPlugins(type, btn) {
  _pluginFilter = type;
  document.querySelectorAll('.plugin-tab').forEach(t => t.classList.remove('active'));
  if (btn) btn.classList.add('active');
  renderPlugins();
  renderPluginMarket();
}

export function installPlugin(marketId) {
  const item = PLUGIN_MARKETPLACE.find(p => p.id === marketId);
  if (!item) return;

  // Check if integration needs env vars
  if (item.envKeys && item.envKeys.length) {
    // Show editor with pre-filled data for env configuration
    showAddPlugin();
    document.getElementById('pe-name').value = state.lang === 'zh' ? (item.nameZh || item.name) : item.name;
    document.getElementById('pe-type').value = item.type;
    document.getElementById('pe-trigger').value = item.trigger || '';
    document.getElementById('pe-desc').value = state.lang === 'zh' ? (item.descZh || item.desc) : item.desc;
    document.getElementById('pe-prompt').value = item.prompt || '';
    document.getElementById('pe-env').value = item.envKeys.map(k => k + '=').join(', ');
    document.getElementById('pe-env-row').style.display = '';
    onPluginTypeChange();
    _editingPlugin = { marketId: item.id, icon: item.icon };
    return;
  }

  // Direct install
  const plugin = {
    id: item.id,
    icon: item.icon,
    name: state.lang === 'zh' ? (item.nameZh || item.name) : item.name,
    type: item.type,
    trigger: item.trigger || '',
    desc: state.lang === 'zh' ? (item.descZh || item.desc) : item.desc,
    prompt: item.prompt || '',
    enabled: true,
    installed: Date.now(),
  };
  _plugins.push(plugin);
  persistPlugins();
  renderPlugins();
  renderPluginMarket();
  toast('✓ ' + t('plugins.installed_ok'));
}

export function showAddPlugin() {
  _editingPlugin = null;
  document.getElementById('plugin-editor').classList.remove('hidden');
  const overlay = document.getElementById('plugin-editor-overlay');
  if (overlay) overlay.classList.remove('hidden');
  document.getElementById('plugin-editor-title').textContent = t('plugins.create_title');
  document.getElementById('pe-name').value = '';
  document.getElementById('pe-type').value = 'command';
  document.getElementById('pe-trigger').value = '/';
  document.getElementById('pe-desc').value = '';
  document.getElementById('pe-prompt').value = '';
  document.getElementById('pe-env').value = '';
  document.getElementById('pe-env-row').classList.add('hidden');
  onPluginTypeChange();
}

export function editPlugin(idx) {
  const p = _plugins[idx];
  if (!p) return;
  _editingPlugin = idx;
  document.getElementById('plugin-editor').classList.remove('hidden');
  document.getElementById('plugin-editor-overlay')?.classList.remove('hidden');
  document.getElementById('plugin-editor-title').textContent = t('plugins.edit_title');
  document.getElementById('pe-name').value = p.name || '';
  document.getElementById('pe-type').value = p.type || 'command';
  document.getElementById('pe-trigger').value = p.trigger || '';
  document.getElementById('pe-desc').value = p.desc || '';
  document.getElementById('pe-prompt').value = p.prompt || '';
  document.getElementById('pe-env').value = p.envVars || '';
  onPluginTypeChange();
}

export function closePluginEditor() {
  document.getElementById('plugin-editor')?.classList.add('hidden');
  document.getElementById('plugin-editor-overlay')?.classList.add('hidden');
}

export function onPluginTypeChange() {
  const type = document.getElementById('pe-type').value;
  document.getElementById('pe-command-opts').style.display = type === 'command' || type === 'template' ? '' : 'none';
  document.getElementById('pe-env-row').style.display = type === 'integration' ? '' : 'none';
}

export async function savePlugin() {
  const name = document.getElementById('pe-name').value.trim();
  if (!name) { toast(t('plugins.name_required')); return; }

  const plugin = {
    id: (typeof _editingPlugin === 'object' && _editingPlugin?.marketId) || 'custom_' + Date.now(),
    name,
    type: document.getElementById('pe-type').value,
    trigger: document.getElementById('pe-trigger').value.trim(),
    desc: document.getElementById('pe-desc').value.trim(),
    prompt: document.getElementById('pe-prompt').value.trim(),
    envVars: document.getElementById('pe-env').value.trim(),
    icon: (typeof _editingPlugin === 'object' && _editingPlugin?.icon) || '',
    enabled: true,
    installed: Date.now(),
  };

  if (typeof _editingPlugin === 'number') {
    plugin.id = _plugins[_editingPlugin].id;
    _plugins[_editingPlugin] = plugin;
  } else {
    _plugins.push(plugin);
  }

  await persistPlugins();
  closePluginEditor();
  renderPlugins();
  renderPluginMarket();
  toast('✓ ' + t('plugins.saved'));
}

export async function deletePlugin(idx) {
  _plugins.splice(idx, 1);
  await persistPlugins();
  renderPlugins();
  renderPluginMarket();
  toast(t('plugins.deleted'));
}

export function togglePlugin(idx, enabled) {
  if (_plugins[idx]) {
    _plugins[idx].enabled = enabled;
    persistPlugins();
  }
}

async function persistPlugins() {
  try {
    const cfg = await electronAPI.loadConfig() || {};
    cfg.plugins = _plugins;
    await electronAPI.saveConfig(cfg);
  } catch {}
}

// Get active custom commands for chat input processing
export function getPluginCommands() {
  return _plugins.filter(p => p.enabled !== false && p.trigger && p.type !== 'integration');
}

// ═══ SKILL.md COMPATIBILITY (OpenClaw format) ═══
// Parse SKILL.md frontmatter (YAML-like) into plugin format
export function parseSkillMd(content) {
  if (!content || !content.startsWith('---')) return null;
  const endIdx = content.indexOf('---', 3);
  if (endIdx < 0) return null;

  const frontmatter = content.substring(3, endIdx).trim();
  const body = content.substring(endIdx + 3).trim();

  // Simple YAML parser for flat + 1-level nested keys
  const data = {};
  let currentKey = null;
  for (const line of frontmatter.split('\n')) {
    const trimmed = line.trimEnd();
    if (!trimmed || trimmed.startsWith('#')) continue;

    if (!trimmed.startsWith(' ') && !trimmed.startsWith('\t')) {
      const colonIdx = trimmed.indexOf(':');
      if (colonIdx > 0) {
        const key = trimmed.substring(0, colonIdx).trim();
        const val = trimmed.substring(colonIdx + 1).trim();
        if (val) {
          data[key] = val.replace(/^["']|["']$/g, '');
        } else {
          data[key] = {};
          currentKey = key;
        }
      }
    } else if (currentKey && typeof data[currentKey] === 'object') {
      const colonIdx = trimmed.indexOf(':');
      if (colonIdx > 0) {
        const key = trimmed.substring(0, colonIdx).trim();
        const val = trimmed.substring(colonIdx + 1).trim();
        data[currentKey][key] = val.replace(/^["']|["']$/g, '');
      }
    }
  }

  // Convert to our plugin format
  const metadata = data.metadata || {};
  const ocData = metadata.openclaw || data.openclaw || {};
  return {
    id: 'skill_' + (data.name || 'unknown'),
    name: data.name || 'Unknown Skill',
    desc: data.description || body.substring(0, 100),
    icon: ocData.emoji || '📦',
    type: 'command',
    trigger: '/' + (data.name || 'skill'),
    prompt: body || data.description || '',
    homepage: data.homepage || '',
    source: 'openclaw-skill',
    enabled: true,
    installed: Date.now(),
  };
}

// Import a SKILL.md file as a plugin
export async function importSkillMd() {
  try {
    const result = await electronAPI.openFile ? electronAPI.openFile() : null;
    if (!result) {
      toast('File dialog not available');
      return;
    }
    // For now, let the user paste SKILL.md content
    toast('SKILL.md import: paste content in plugin editor prompt field');
    showAddPlugin();
  } catch (e) {
    toast('Import error: ' + e.message);
  }
}

// ═══ TEAMS ═══
// ═══ HOOKS MANAGEMENT ═══
let _hooks = {};
let _editingHook = null;

const HOOK_TEMPLATES = [
  { name: 'Lint on Save', nameZh: '保存时检查', event: 'PostToolUse', matcher: 'Write', command: 'npx eslint --fix "$TOOL_INPUT_FILE_PATH" 2>/dev/null || true' },
  { name: 'Test on Edit', nameZh: '编辑后测试', event: 'PostToolUse', matcher: 'Edit', command: 'npm test -- --bail 2>&1 | head -20' },
  { name: 'Notify on Complete', nameZh: '完成时通知', event: 'Stop', matcher: '', command: 'echo "Task completed at $(date)" >> ~/laiai-notifications.log' },
  { name: 'Block Dangerous Commands', nameZh: '阻止危险命令', event: 'PreToolUse', matcher: 'Bash', command: 'echo "$TOOL_INPUT" | grep -qE "rm -rf|drop table|format" && echo "BLOCKED: dangerous command" && exit 1 || exit 0' },
  { name: 'Log All Tool Use', nameZh: '记录工具使用', event: 'PostToolUse', matcher: '', command: 'echo "[$(date)] $TOOL_NAME: $TOOL_INPUT" >> ~/laiai-tool-log.txt' },
  { name: 'Format on Write', nameZh: '写入时格式化', event: 'PostToolUse', matcher: 'Write', command: 'npx prettier --write "$TOOL_INPUT_FILE_PATH" 2>/dev/null || true' },
];

export async function loadHooks() {
  try {
    _hooks = await electronAPI.loadHooks() || {};
  } catch { _hooks = {}; }
  renderHooks();
  renderHookTemplates();
}

export async function runTeamsAction(action) {
  if (action === 'hooks') { await loadHooks(); }
}

function renderHooks() {
  const el = document.getElementById('hooks-list');
  if (!el) return;

  const entries = [];
  for (const [event, hooks] of Object.entries(_hooks)) {
    if (Array.isArray(hooks)) {
      hooks.forEach((h, i) => entries.push({ event, index: i, ...h }));
    }
  }

  if (!entries.length) {
    el.innerHTML = '<div class="empty-state">' +
      '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M10 13a5 5 0 007.54.54l3-3a5 5 0 00-7.07-7.07l-1.72 1.71"/><path d="M14 11a5 5 0 00-7.54-.54l-3 3a5 5 0 007.07 7.07l1.71-1.71"/></svg>' +
      '<div class="empty-state-title">' + t('hooks.empty_title') + '</div>' +
      '<div class="empty-state-desc">' + t('hooks.empty') + '</div></div>';
    return;
  }

  el.innerHTML = entries.map((h, i) => {
    const eventIcon = { PreToolUse: '⏳', PostToolUse: '✅', Notification: '🔔', Stop: '🛑' }[h.event] || '🔗';
    return '<div class="plugin-item">' +
      '<div class="plugin-icon">' + eventIcon + '</div>' +
      '<div class="plugin-info">' +
      '<div class="plugin-name">' + esc(h.event) + (h.matcher ? ' → <code>' + esc(h.matcher) + '</code>' : '') + '</div>' +
      '<div class="plugin-desc" style="font-family:\'JetBrains Mono\',monospace;font-size:11px">' + esc((h.command || '').substring(0, 80)) + '</div>' +
      '</div>' +
      '<div class="plugin-actions">' +
      '<button class="btn btn-xs" onclick="deleteHook(\'' + esc(h.event) + '\',' + h.index + ')" title="Delete">🗑️</button>' +
      '</div></div>';
  }).join('');
}

function renderHookTemplates() {
  const el = document.getElementById('hooks-templates');
  if (!el) return;
  el.innerHTML = HOOK_TEMPLATES.map((t2, i) => {
    const name = state.lang === 'zh' ? (t2.nameZh || t2.name) : t2.name;
    return '<button class="btn btn-s btn-sm" onclick="installHookTemplate(' + i + ')">' + esc(name) + '</button>';
  }).join('');
}

export function showAddHook() {
  _editingHook = null;
  document.getElementById('hook-editor').classList.remove('hidden');
  document.getElementById('he-event').value = 'PostToolUse';
  document.getElementById('he-matcher').value = '';
  document.getElementById('he-command').value = '';
}

export function closeHookEditor() {
  document.getElementById('hook-editor')?.classList.add('hidden');
}

export async function saveHook() {
  const event = document.getElementById('he-event').value;
  const matcher = document.getElementById('he-matcher').value.trim();
  const command = document.getElementById('he-command').value.trim();
  if (!command) { toast(t('hooks.command_required')); return; }

  if (!_hooks[event]) _hooks[event] = [];
  const hookEntry = { command };
  if (matcher) hookEntry.matcher = matcher;
  _hooks[event].push(hookEntry);

  await electronAPI.saveHooks(_hooks);
  closeHookEditor();
  renderHooks();
  toast('✓ ' + t('hooks.saved'));
}

export async function deleteHook(event, index) {
  if (_hooks[event] && Array.isArray(_hooks[event])) {
    _hooks[event].splice(index, 1);
    if (!_hooks[event].length) delete _hooks[event];
    await electronAPI.saveHooks(_hooks);
    renderHooks();
    toast(t('hooks.deleted'));
  }
}

export async function installHookTemplate(idx) {
  const tmpl = HOOK_TEMPLATES[idx];
  if (!tmpl) return;
  if (!_hooks[tmpl.event]) _hooks[tmpl.event] = [];
  const entry = { command: tmpl.command };
  if (tmpl.matcher) entry.matcher = tmpl.matcher;
  _hooks[tmpl.event].push(entry);
  await electronAPI.saveHooks(_hooks);
  renderHooks();
  toast('✓ ' + t('hooks.installed'));
}

// ═══ KEYBINDINGS ═══
export function showKeybindings(){
  const el=document.getElementById('keybindings-list');
  if(el.classList.contains('show')){el.classList.remove('show');return}
  el.className='result-area show';
  el.innerHTML=[
    '<strong>'+t('kb.global')+'</strong>',
    'Ctrl+C          '+t('kb.interrupt'),
    'Ctrl+D          '+t('kb.exit'),
    'Ctrl+L          '+t('kb.redraw'),
    'Ctrl+T          '+t('kb.task_list'),
    '',
    '<strong>'+t('kb.dialog')+'</strong>',
    'Enter            '+t('kb.send'),
    'Shift+Enter      '+t('kb.newline'),
    'Up / Down        '+t('kb.history'),
    'Ctrl+Z           '+t('kb.undo'),
    'Escape           '+t('kb.cancel'),
    '',
    '<strong>'+t('kb.navigation')+'</strong>',
    'Shift+Tab        '+t('kb.switch_mode'),
    '?                '+t('kb.help'),
    'Ctrl+R           '+t('kb.search_history'),
  ].join('\n');
}

// ═══ BUDDY SYSTEM ═══
export const BUDDY_PETS=['🐱','🐶','🐰','🦊','🐼','🐨','🦁','🐸','🦉','🐲'];

export function buddyPet(){
  const s=document.getElementById('buddy-sprite');
  s.style.transform='scale(1.3)';setTimeout(()=>s.style.transform='',300);
  const h=document.getElementById('buddy-hearts');
  h.textContent='❤️'.repeat(3);setTimeout(()=>h.textContent='',1500);
  state.buddyState.xp+=5;state.buddyState.mood=t('buddy.super_happy');updateBuddy();
}

export function buddyFeed(){
  state.buddyState.hp=Math.min(100,state.buddyState.hp+20);state.buddyState.xp+=3;state.buddyState.mood=t('buddy.full');
  const s=document.getElementById('buddy-sprite');
  s.style.transform='rotate(10deg)';setTimeout(()=>s.style.transform='',300);
  updateBuddy();toast(t('buddy.fed'));
}

export function buddyPlay(){
  state.buddyState.xp+=10;state.buddyState.mood=t('buddy.excited');
  const s=document.getElementById('buddy-sprite');
  s.style.transform='translateY(-20px)';setTimeout(()=>s.style.transform='',400);
  updateBuddy();toast(t('buddy.playing'));
}

export function buddyChange(){
  state.buddyState.pet=(state.buddyState.pet+1)%BUDDY_PETS.length;
  document.getElementById('buddy-sprite').textContent=BUDDY_PETS[state.buddyState.pet];
  updateBuddy();
}

export function updateBuddy(){
  state.buddyState.level=Math.floor(state.buddyState.xp/30)+1;
  document.getElementById('buddy-level').textContent='Lv.'+state.buddyState.level;
  document.getElementById('buddy-hp').textContent='❤️ '+state.buddyState.hp;
  document.getElementById('buddy-xp').textContent='⭐ '+state.buddyState.xp;
  const moodText=state.buddyState.mood.startsWith('buddy.')?t(state.buddyState.mood):state.buddyState.mood;
  document.getElementById('buddy-mood').textContent=t('buddy.mood')+'：'+moodText;
}

// ═══ USAGE STATS ═══
export async function loadUsage(){
  const stats=await electronAPI.loadUsageStats();
  const sizeStr=stats.totalSize>1048576?(stats.totalSize/1048576).toFixed(1)+' MB':(stats.totalSize/1024).toFixed(0)+' KB';
  document.getElementById('usage-cards').innerHTML=`
    <div class="usage-card"><div class="usage-val" style="color:var(--accent-l)">${stats.totalSessions}</div><div class="usage-label">${t('usage.total_sessions')}</div></div>
    <div class="usage-card"><div class="usage-val" style="color:var(--green)">${sizeStr}</div><div class="usage-label">${t('usage.total_data')}</div></div>
    <div class="usage-card"><div class="usage-val" style="color:var(--blue)">${Object.keys(stats.recentDays).length}</div><div class="usage-label">${t('usage.active_days')}</div></div>
    <div class="usage-card"><div class="usage-val" style="color:var(--yellow)">${state.providers.length}</div><div class="usage-label">${t('usage.providers')}</div></div>`;
  const days=[];const now=new Date();
  for(let i=13;i>=0;i--){const d=new Date(now);d.setDate(d.getDate()-i);days.push(d.toISOString().slice(0,10))}
  const maxVal=Math.max(1,...days.map(d=>stats.recentDays[d]||0));
  document.getElementById('usage-chart').innerHTML=days.map(d=>{
    const v=stats.recentDays[d]||0;const pct=Math.round(v/maxVal*100);
    const label=d.slice(5);
    return`<div class="chart-bar-row"><span class="chart-label">${label}</span><div class="chart-bar"><div class="chart-fill" style="width:${pct}%;background:linear-gradient(90deg,var(--accent),var(--accent-l))"></div>${v?'<span class="chart-count">'+v+'</span>':''}</div></div>`
  }).join('');
}

// ═══ SPLASH ═══
const splashStart=Date.now();
export function hideSplash(){
  const sp=document.getElementById('splash');
  if(!sp)return;
  const elapsed=Date.now()-splashStart;
  const remaining=Math.max(0,1500-elapsed);
  setTimeout(()=>{
    sp.classList.add('hide');
    setTimeout(()=>{try{sp.remove()}catch{}},500);
  },remaining);
}
// Failsafe
setTimeout(()=>{const sp=document.getElementById('splash');if(sp){sp.classList.add('hide');setTimeout(()=>{try{sp.remove()}catch{}},500)}},6000);

// ═══ TOOLS ═══
export async function loadTools(){state.allTools=await electronAPI.listTools()||[];renderToolFilters();renderTools()}

export function renderToolFilters(){
  const cats=[...new Set(state.allTools.map(t=>t.category))];
  const el=document.getElementById('tool-filters');
  el.innerHTML='<button class="btn btn-sm '+(state.toolFilter==='all'?'btn-p':'btn-s')+'" onclick="toolFilter=\'all\';renderToolFilters();renderTools()">All ('+state.allTools.length+')</button>'+
    cats.map(c=>'<button class="btn btn-sm '+(state.toolFilter===c?'btn-p':'btn-s')+'" onclick="toolFilter=\''+c+'\';renderToolFilters();renderTools()">'+c[0].toUpperCase()+c.slice(1)+'</button>').join('')
}

export function renderTools(){
  const q=(document.getElementById('tool-search')?.value||'').toLowerCase();
  const f=state.allTools.filter(t=>(state.toolFilter==='all'||t.category===state.toolFilter)&&(!q||t.name.toLowerCase().includes(q)||t.desc.toLowerCase().includes(q)));
  document.getElementById('tool-list').innerHTML=f.map(t=>`<div class="tc"><div class="tc-name">${esc(t.name)}</div><div class="tc-desc">${esc(t.desc)}</div><div class="tc-cat">${esc(t.category)}</div></div>`).join('')
}

// ═══ MCP SERVERS ═══
export async function loadMcp(){
  const data=await electronAPI.loadMcpConfig();
  state.mcpServers=[...(data.userServers||[]),...(data.projectServers||[])];
  renderMcp();
}

export function renderMcp(){
  const el=document.getElementById('mcp-list'),empty=document.getElementById('mcp-empty');
  if(!state.mcpServers.length){el.innerHTML='';empty.style.display='';return}
  empty.style.display='none';
  el.innerHTML=state.mcpServers.map(s=>{
    const typeLabel={stdio:'Local Process',sse:'SSE',http:'HTTP',ws:'WebSocket'}[s.type||'stdio']||s.type||'stdio';
    const safeId=s.name.replace(/[^a-zA-Z0-9]/g,'_');
    return`<div class="mcp-item anim-in">
      <div class="mcp-icon">${(s.name||'?')[0].toUpperCase()}</div>
      <span class="mcp-status-dot unknown" id="mcp-dot-${safeId}"></span>
      <div class="mcp-info"><div class="mcp-name">${esc(s.name)}</div><div class="mcp-type">${esc(typeLabel)} ${s.command?'· '+esc(s.command):''} ${s.url?'· '+esc(s.url):''}</div><div class="mcp-status-detail" id="mcp-detail-${safeId}" style="font-size:10px;color:var(--t4)"></div></div>
      <span class="mcp-scope mcp-scope-${s.scope}">${s.scope}</span>
      <button class="btn btn-s btn-sm" onclick="editMcp('${esc(s.name)}')" style="font-size:10px">✏️</button>
      <button class="btn btn-s btn-sm" onclick="checkMcpStatus('${esc(s.name)}','${esc(s.type||'stdio')}','${esc(s.command||'')}','${esc(s.url||'')}')" style="font-size:10px">${t('mcp.check_status')}</button>
      <button class="btn btn-g btn-sm" onclick="delMcp('${esc(s.name)}','${s.scope}')" style="color:var(--red)">✕</button>
    </div>`}).join('');
}

let _mcpEditMode = false;
let _mcpEditOriginalName = null;

export function showAddMcp(){
  _mcpEditMode = false;
  _mcpEditOriginalName = null;
  document.getElementById('mm-title').textContent = t('mcp.add') || 'Add MCP Server';
  document.getElementById('mm-name').value = '';
  document.getElementById('mm-name').disabled = false;
  document.getElementById('mm-cmd').value = '';
  document.getElementById('mm-args').value = '';
  document.getElementById('mm-url').value = '';
  document.getElementById('mm-type').value = 'stdio';
  document.getElementById('mm-scope').value = 'user';
  mcpTypeChanged();
  document.getElementById('m-mcp').classList.add('show');
}

export async function editMcp(name) {
  // Load fresh MCP data
  const data = await electronAPI.loadMcpConfig().catch(() => ({ userServers: [], projectServers: [] }));
  state.mcpServers = [...(data.userServers || []), ...(data.projectServers || [])];

  let server = state.mcpServers.find(s => s.name === name);

  // For builtin servers not in settings.json, create a placeholder
  if (!server && name.includes('laiai-')) {
    server = { name, type: 'stdio', scope: 'builtin', command: 'node', args: [], builtin: true };
    toast('内置能力，配置由系统自动管理');
    return;
  }
  if (!server) { toast('Server not found: ' + name); return; }
  _mcpEditMode = true;
  _mcpEditOriginalName = name;
  document.getElementById('mm-title').textContent = 'Edit: ' + name;
  document.getElementById('mm-name').value = server.name;
  document.getElementById('mm-name').disabled = true; // Can't rename
  document.getElementById('mm-type').value = server.type || 'stdio';
  document.getElementById('mm-scope').value = server.scope || 'user';
  if (server.type === 'stdio' || !server.type) {
    document.getElementById('mm-cmd').value = server.command || '';
    document.getElementById('mm-args').value = (server.args || []).join(', ');
  } else {
    document.getElementById('mm-url').value = server.url || '';
  }
  mcpTypeChanged();
  document.getElementById('m-mcp').classList.add('show');
}
export function closeMcp(){document.getElementById('m-mcp').classList.remove('show')}

// Quick install MCP from npm package name
export async function quickInstallMcp() {
  const input = document.getElementById('mm-npm-pkg');
  const pkg = (input?.value || '').trim();
  if (!pkg) { toast(t('mcp.pkg_required')); return; }

  // Auto-detect package name as server name
  const name = pkg.replace(/^@/, '').replace(/\//g, '-').replace(/^modelcontextprotocol-server-/, 'mcp-');
  const config = { type: 'stdio', command: 'npx', args: ['-y', pkg] };

  toast(t('mcp.installing') + ': ' + pkg, 'info');
  await electronAPI.saveMcpServer({ name, config, scope: 'user' });
  closeMcp();

  // Refresh displays via window
  try { if (window.renderDrawerMcp) window.renderDrawerMcp(); } catch {}
  try { if (window.renderMcpMarket) window.renderMcpMarket(); } catch {}
  try { renderMcp(); } catch {}
  toast('✓ ' + t('mcp.installed') + ': ' + name);
  if (input) input.value = '';
}

// Quick install from settings drawer search bar
export async function quickInstallMcpFromDrawer() {
  const input = document.getElementById('sd-mcp-search');
  const pkg = (input?.value || '').trim();
  if (!pkg) return;

  // Check if it looks like an npm package (has @ or /)
  if (pkg.includes('/') || pkg.includes('@') || pkg.startsWith('mcp-')) {
    const name = pkg.replace(/^@/, '').replace(/\//g, '-').replace(/^modelcontextprotocol-server-/, 'mcp-');
    const config = { type: 'stdio', command: 'npx', args: ['-y', pkg] };
    toast(t('mcp.installing') + ': ' + pkg, 'info');
    await electronAPI.saveMcpServer({ name, config, scope: 'user' });
    try { if (window.renderDrawerMcp) window.renderDrawerMcp(); } catch {}
    try { if (window.renderMcpMarket) window.renderMcpMarket(); } catch {}
    toast('✓ ' + t('mcp.installed') + ': ' + name);
    input.value = '';
  }
}

// Filter MCP market — local filter + live npm search
let _npmSearchTimer = null;
export function filterMcpMarket(query) {
  // Immediately filter local preset list
  state.mcpSearchQuery = query;
  try { window.renderMcpMarket && window.renderMcpMarket(); } catch {}

  // Debounced npm registry search for longer queries
  clearTimeout(_npmSearchTimer);
  if (query && query.length >= 3) {
    _npmSearchTimer = setTimeout(async () => {
      try {
        const r = await electronAPI.npmSearch({ query: query + ' mcp', size: 15 });
        if (r.ok && r.results.length) {
          renderNpmSearchResults(r.results, r.total);
        }
      } catch {}
    }, 500);
  } else {
    // Clear npm results
    const el = document.getElementById('sd-npm-results');
    if (el) el.innerHTML = '';
  }
}

function renderNpmSearchResults(results, total) {
  let el = document.getElementById('sd-npm-results');
  if (!el) {
    // Create the container after the market list
    const market = document.getElementById('sd-mcp-market');
    if (!market) return;
    el = document.createElement('div');
    el.id = 'sd-npm-results';
    market.parentElement.appendChild(el);
  }

  const installed = (state.mcpServers || []).map(s => s.name);

  el.innerHTML = '<div class="sd-section-title" style="margin-top:12px;font-size:11px">🌐 npm Registry (' + total.toLocaleString() + ' results)</div>' +
    results.map(pkg => {
      const shortName = pkg.name.replace(/^@/, '').replace(/\//g, '-');
      const isInstalled = installed.includes(shortName) || installed.includes(pkg.name);
      const downloads = pkg.downloads > 1000 ? Math.round(pkg.downloads / 1000) + 'k' : pkg.downloads;
      return '<div class="plugin-market-item">' +
        '<div class="plugin-icon">' + pluginSvgIcon('default') + '</div>' +
        '<div class="plugin-info">' +
        '<div class="plugin-name" style="font-size:12px">' + esc(pkg.name) + ' <span style="color:var(--t4);font-weight:400">v' + esc(pkg.version) + '</span></div>' +
        '<div class="plugin-desc">' + esc((pkg.description || '').substring(0, 80)) + '</div>' +
        '<div style="font-size:10px;color:var(--t4);margin-top:2px">⬇ ' + downloads + '/mo' + (pkg.license ? ' · ' + pkg.license : '') + '</div>' +
        '</div>' +
        (isInstalled
          ? '<span class="plugin-installed-badge">✓</span>'
          : '<button class="btn btn-p btn-sm" onclick="quickInstallNpm(\'' + esc(pkg.name) + '\')" style="font-size:11px">' + t('mcp.install_pkg') + '</button>'
        ) + '</div>';
    }).join('');
}

export async function quickInstallNpm(pkgName) {
  const name = pkgName.replace(/^@/, '').replace(/\//g, '-');
  const config = { type: 'stdio', command: 'npx', args: ['-y', pkgName] };
  toast(t('mcp.installing') + ': ' + pkgName, 'info');
  await electronAPI.saveMcpServer({ name, config, scope: 'user' });
  try { if (window.renderDrawerMcp) window.renderDrawerMcp(); } catch {}
  try { if (window.renderMcpMarket) window.renderMcpMarket(); } catch {}
  toast('✓ ' + t('mcp.installed') + ': ' + name);
}
export function mcpTypeChanged(){
  const t=document.getElementById('mm-type').value;
  document.getElementById('mm-stdio-fields').style.display=t==='stdio'?'':'none';
  document.getElementById('mm-url-field').style.display=t!=='stdio'?'':'none';
}

export async function saveMcp(){
  const name=document.getElementById('mm-name').value.trim();
  if(!name)return;
  const type=document.getElementById('mm-type').value;
  const scope=document.getElementById('mm-scope').value;
  let config={};
  if(type==='stdio'){
    const cmd=document.getElementById('mm-cmd').value.trim();
    const argsStr=document.getElementById('mm-args').value.trim();
    config={type:'stdio',command:cmd,args:argsStr?argsStr.split(',').map(a=>a.trim()):[]};
  }else{
    config={type,url:document.getElementById('mm-url').value.trim()};
  }
  // In edit mode, delete old entry first if name changed
  if (_mcpEditMode && _mcpEditOriginalName) {
    const oldServer = state.mcpServers.find(s => s.name === _mcpEditOriginalName);
    if (oldServer) {
      await electronAPI.deleteMcpServer({name:_mcpEditOriginalName, scope:oldServer.scope});
    }
  }
  await electronAPI.saveMcpServer({name,config,scope});
  _mcpEditMode = false;
  _mcpEditOriginalName = null;
  closeMcp();loadMcp();
  try{renderDrawerMcp();renderMcpMarket()}catch(e){}
  toast(t('toast.saved'));
}

export async function delMcp(name,scope){
  await electronAPI.deleteMcpServer({name,scope});
  loadMcp();
  // Refresh Settings drawer lists if open
  try { renderDrawerMcp(); renderMcpMarket(); } catch {}
  toast(t('toast.deleted'));
}
// Import these at call time from window to avoid circular deps
function renderDrawerMcp() { if (window.renderDrawerMcp) window.renderDrawerMcp(); }
function renderMcpMarket() { if (window.renderMcpMarket) window.renderMcpMarket(); }

// ═══ MCP SERVER STATUS CHECK ═══
export async function checkMcpStatus(name, type, command, url) {
  const dotEl = document.getElementById('mcp-dot-' + name.replace(/[^a-zA-Z0-9]/g, '_'));
  const detailEl = document.getElementById('mcp-detail-' + name.replace(/[^a-zA-Z0-9]/g, '_'));
  if (dotEl) { dotEl.className = 'mcp-status-dot checking'; }
  if (detailEl) { detailEl.textContent = t('mcp.checking'); }
  try {
    const r = await electronAPI.mcpServerStatus({ name, type: type || 'stdio', command, url });
    if (dotEl) {
      dotEl.className = 'mcp-status-dot ' + (r.ok ? 'running' : (r.status === 'stopped' ? 'stopped' : 'error'));
    }
    if (detailEl) {
      detailEl.textContent = r.detail || '';
    }
  } catch (e) {
    if (dotEl) dotEl.className = 'mcp-status-dot error';
    if (detailEl) detailEl.textContent = e.message || 'Error';
  }
}
