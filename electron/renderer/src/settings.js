// ═══ SETTINGS + PROXY + ONBOARDING ═══
import { state } from './state.js';
import { t, onLangChange } from './i18n.js';
import { toast, esc, gid, showSt } from './utils.js';
import { renderDrawerProviders, renderDrawerModels, collectModels, renderProvs, persistProvs, domainToUrl } from './providers.js';
import { updateChatModelSelect } from './chat.js';
import { startTerm } from './terminal.js';

export function openSettings(){
  document.getElementById('settings-overlay').classList.add('open');
  document.getElementById('settings-drawer').classList.add('open');
  try{
    document.getElementById('sd-theme').value=state.theme;
    document.getElementById('sd-lang').value=state.lang;
  }catch(e){}
  collectModels();
  renderDrawerProviders();
  renderDrawerModels();
  loadDrawerMemory();
  renderDrawerMcp();
  renderMcpMarket();
  loadCronTasks();
  loadProxyList();
  loadKeybindingsUI();
  try { if (window.loadPlugins) window.loadPlugins(); } catch {}
  try { if (window.loadWorkflows) window.loadWorkflows(); } catch {}
  try { loadAutomationStatus(); } catch {}
}

export function closeSettings(){
  document.getElementById('settings-overlay').classList.remove('open');
  document.getElementById('settings-drawer').classList.remove('open');
}

export function sdTab(id,el){
  document.querySelectorAll('.sd-tab').forEach(t=>t.classList.remove('active'));
  document.querySelectorAll('.sd-panel').forEach(p=>p.classList.remove('active'));
  el.classList.add('active');
  document.getElementById('sd-'+id).classList.add('active');
}

export async function loadDrawerMemory(){
  const r=await electronAPI.loadLaiaiMd().catch(()=>({ok:false}));
  const ed=document.getElementById('sd-memory-editor');
  if(ed&&r.ok)ed.value=r.content;
}

// ═══ MCP MARKETPLACE ═══
// SVG icon helper — returns inline SVG for each MCP type
function mcpSvgIcon(type) {
  const icons = {
    image: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="8.5" cy="8.5" r="1.5"/><polyline points="21 15 16 10 5 21"/></svg>',
    memory: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M12 2a7 7 0 017 7c0 5.25-7 13-7 13S5 14.25 5 9a7 7 0 017-7z"/><circle cx="12" cy="9" r="2.5"/></svg>',
    github: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M15 22v-4a4.8 4.8 0 00-1-3.5c3 0 6-2 6-5.5.08-1.25-.27-2.48-1-3.5.28-1.15.28-2.35 0-3.5 0 0-1 0-3 1.5-2.64-.5-5.36-.5-8 0C6 2 5 2 5 2c-.3 1.15-.3 2.35 0 3.5A5.4 5.4 0 004 9c0 3.5 3 5.5 6 5.5-.39.49-.68 1.05-.85 1.65S8.93 17.38 9 18v4"/><path d="M9 18c-4.51 2-5-2-7-2"/></svg>',
    browser: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><rect x="2" y="3" width="20" height="14" rx="2"/><line x1="8" y1="21" x2="16" y2="21"/><line x1="12" y1="17" x2="12" y2="21"/></svg>',
    filesystem: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M22 19a2 2 0 01-2 2H4a2 2 0 01-2-2V5a2 2 0 012-2h5l2 3h9a2 2 0 012 2z"/></svg>',
    search: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>',
    video: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><polygon points="23 7 16 12 23 17 23 7"/><rect x="1" y="5" width="15" height="14" rx="2"/></svg>',
    imageproc: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><rect x="3" y="3" width="18" height="18" rx="2"/><path d="M3 9h18M9 3v18"/></svg>',
    default: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><rect x="2" y="7" width="20" height="14" rx="2"/><path d="M16 7V4a2 2 0 00-2-2h-4a2 2 0 00-2 2v3"/></svg>',
  };
  return icons[type] || icons.default;
}

const MCP_MARKETPLACE = [
  {
    id: 'laiai-image-gen',
    iconType: 'image',
    name: '图像生成',
    nameEn: 'Image Generation',
    desc: '用自然语言生成图片，支持多种风格和尺寸',
    descEn: 'Generate images from text prompts with various styles',
    builtin: true,
  },
  {
    id: 'memory',
    iconType: 'memory',
    name: 'AI 长期记忆',
    nameEn: 'AI Memory',
    desc: '跨会话记住用户偏好和项目上下文',
    descEn: 'Persistent memory across chat sessions',
    command: 'npx',
    args: ['-y', '@modelcontextprotocol/server-memory'],
  },
  {
    id: 'github',
    iconType: 'github',
    name: 'GitHub',
    nameEn: 'GitHub',
    desc: '仓库管理、PR 审查、Issue 跟踪',
    descEn: 'Repository management, PR review, Issue tracking',
    command: 'npx',
    args: ['-y', '@modelcontextprotocol/server-github'],
    envKeys: ['GITHUB_TOKEN'],
  },
  {
    id: 'puppeteer',
    iconType: 'browser',
    name: '浏览器自动化',
    nameEn: 'Browser Automation',
    desc: '控制浏览器、截图、自动化测试',
    descEn: 'Control browser, screenshots, automated testing',
    command: 'npx',
    args: ['-y', '@modelcontextprotocol/server-puppeteer'],
  },
  {
    id: 'filesystem',
    iconType: 'filesystem',
    name: '文件系统增强',
    nameEn: 'Filesystem',
    desc: '高级文件搜索、目录监控、批量操作',
    descEn: 'Advanced file search, directory watch, batch operations',
    command: 'npx',
    args: ['-y', '@modelcontextprotocol/server-filesystem', '/'],
  },
  {
    id: 'brave-search',
    iconType: 'search',
    name: 'Brave 搜索',
    nameEn: 'Brave Search',
    desc: '使用 Brave 搜索引擎获取实时信息',
    descEn: 'Search the web using Brave Search engine',
    command: 'npx',
    args: ['-y', '@modelcontextprotocol/server-brave-search'],
    envKeys: ['BRAVE_API_KEY'],
  },
  {
    id: 'mcp-kling',
    iconType: 'video',
    name: '视频生成 (Kling)',
    nameEn: 'Video Generation (Kling)',
    desc: 'AI 视频生成、视频延长、口型同步、虚拟换装',
    descEn: 'AI video generation, extension, lip-sync, virtual try-on',
    command: 'npx',
    args: ['-y', 'mcp-kling'],
    envKeys: ['KLING_ACCESS_KEY', 'KLING_SECRET_KEY'],
  },
  {
    id: 'mcp-server-image',
    iconType: 'imageproc',
    name: '图像处理',
    nameEn: 'Image Processing',
    desc: '图片裁剪、缩放、格式转换等操作',
    descEn: 'Crop, resize, format conversion and more',
    command: 'npx',
    args: ['-y', 'mcp-server-image'],
  },
];

export async function renderMcpMarket() {
  const el = document.getElementById('sd-mcp-market');
  if (!el) return;

  // Always load fresh data from disk
  const data = await electronAPI.loadMcpConfig().catch(() => ({ userServers: [], projectServers: [] }));
  const allServers = [...(data.userServers || []), ...(data.projectServers || [])];
  state.mcpServers = allServers;
  const installed = allServers.map(s => s.name);

  // Filter by search query if present
  const query = (state.mcpSearchQuery || '').toLowerCase();
  const filtered = query
    ? MCP_MARKETPLACE.filter(item => {
        const n = (item.name + ' ' + item.nameEn + ' ' + item.desc + ' ' + item.descEn + ' ' + item.id).toLowerCase();
        return n.includes(query);
      })
    : MCP_MARKETPLACE;

  el.innerHTML = filtered.map(item => {
    const isInstalled = item.builtin || installed.includes(item.id) || installed.some(s => s.includes(item.id));
    const name = state.lang === 'en' ? item.nameEn : item.name;
    const desc = state.lang === 'en' ? item.descEn : item.desc;

    return '<div class="mcp-market-item">' +
      '<div class="mcp-market-icon">' + mcpSvgIcon(item.iconType || 'default') + '</div>' +
      '<div class="mcp-market-info">' +
        '<div class="mcp-market-name">' + esc(name) + '</div>' +
        '<div class="mcp-market-desc">' + esc(desc) + '</div>' +
      '</div>' +
      (isInstalled
        ? '<span class="mcp-market-badge installed">✓ 已安装</span>'
        : '<button class="btn btn-p btn-sm mcp-market-install" onclick="installMcpFromMarket(\'' + esc(item.id) + '\')">安装</button>'
      ) +
    '</div>';
  }).join('');
}

export async function installMcpFromMarket(id) {
  const item = MCP_MARKETPLACE.find(m => m.id === id);
  if (!item) return;

  if (item.builtin) {
    toast(state.lang === 'en' ? 'Built-in capability, auto-loaded on chat start' : '内置能力，开始对话时自动加载');
    return;
  }

  // Check if npx/node is available
  if (item.command === 'npx') {
    const config = {
      type: 'stdio',
      command: item.command,
      args: item.args || [],
    };

    // If server needs env vars (like GITHUB_TOKEN), prompt user
    if (item.envKeys && item.envKeys.length) {
      const env = {};
      for (const key of item.envKeys) {
        // Only allow alphanumeric key names
        if (!/^[A-Z_][A-Z0-9_]*$/.test(key)) continue;
        const val = prompt(key + ':');
        if (!val) { toast(t('mcp.install_cancelled')); return; }
        // Sanitize: strip control characters and shell metacharacters
        const sanitized = val.replace(/[`$\\;|&<>(){}[\]!#~\x00-\x1f]/g, '');
        env[key] = sanitized;
      }
      config.env = env;
    }

    await electronAPI.saveMcpServer({ name: item.id, config, scope: 'user' });
    toast('已安装 ' + (state.lang === 'en' ? item.nameEn : item.name) + '，重新开始对话以加载');

    // Refresh lists
    const data = await electronAPI.loadMcpConfig().catch(() => ({ userServers: [], projectServers: [] }));
    state.mcpServers = [...(data.userServers || []), ...(data.projectServers || [])];
    renderMcpMarket();
    renderDrawerMcp();
  }
}

export async function renderDrawerMcp(){
  const data=await electronAPI.loadMcpConfig().catch(()=>({userServers:[],projectServers:[]}));
  const servers=[...(data.userServers||[]),...(data.projectServers||[])];
  // Add builtin servers that aren't in settings.json
  const builtinServers = MCP_MARKETPLACE.filter(m => m.builtin);
  for (const b of builtinServers) {
    if (!servers.some(s => s.name === b.id || s.name.includes(b.id))) {
      servers.unshift({ name: b.id, type: 'stdio', scope: 'builtin', command: 'node', builtin: true });
    }
  }
  const el=document.getElementById('sd-mcp-list');
  if(!el)return;
  el.innerHTML=servers.map(s=>{
    const safeId=s.name.replace(/[^a-zA-Z0-9]/g,'_');
    return'<div class="sd-row" style="gap:8px"><span class="mcp-status-dot unknown" id="mcp-dot-'+safeId+'"></span><div style="flex:1"><div class="sd-row-label" style="font-family:\'JetBrains Mono\',monospace;font-size:12px">'+esc(s.name)+'</div><div class="sd-row-desc">'+esc(s.type||'stdio')+' · '+esc(s.scope||'user')+'</div><div class="mcp-status-detail" id="mcp-detail-'+safeId+'" style="font-size:10px;color:var(--t4)"></div></div><button class="btn btn-s btn-sm" onclick="editMcp(\''+esc(s.name)+'\')" style="font-size:10px">✏️</button><button class="btn btn-s btn-sm" onclick="checkMcpStatus(\''+esc(s.name)+'\',\''+esc(s.type||'stdio')+'\',\''+esc(s.command||'')+'\',\''+esc(s.url||'')+'\')" style="font-size:10px">'+t('mcp.check_status')+'</button><button class="btn btn-s btn-sm" onclick="delMcp(\''+esc(s.name)+'\',\''+esc(s.scope||'user')+'\');renderDrawerMcp()">'+t('general.delete')+'</button></div>';
  }).join('')||'<div style="color:var(--t4);font-size:12px">'+t('mcp.empty')+'</div>';
}

export function loadDrawerProxy(){ loadProxyList(); }

// ═══ SCHEDULED TASKS (CRON) ═══
export async function loadCronTasks() {
  const el = document.getElementById('sd-cron-list');
  if (!el) return;
  const tasks = await electronAPI.listCronTasks().catch(() => []);
  if (!tasks.length) {
    el.innerHTML = '<div style="color:var(--t4);font-size:12px;padding:8px 0">' +
      (state.lang === 'en'
        ? 'No scheduled tasks. Ask the Agent, e.g. "remind me every day at 9am"'
        : '暂无定时任务。在聊天中告诉 Agent，如「每天早上9点提醒我」') +
      '</div>';
    return;
  }
  el.innerHTML = tasks.map(t => {
    const date = t.createdAt ? new Date(t.createdAt).toLocaleDateString() : '';
    return '<div class="sd-row" style="gap:8px">' +
      '<div style="flex:1">' +
        '<div class="sd-row-label" style="font-size:12px">' + esc(t.prompt?.substring(0, 60) || t.id) + '</div>' +
        '<div class="sd-row-desc">' + esc(t.cron || '') + (t.recurring ? ' · recurring' : ' · one-time') + (date ? ' · ' + date : '') + '</div>' +
      '</div>' +
    '</div>';
  }).join('');
}

export async function loadSettings(){
  const s=await electronAPI.loadCliSettings()||{};
  if(s.permissions?.defaultMode)document.getElementById('s-perm').value=s.permissions.defaultMode;
  if(s.alwaysThinkingEnabled!==undefined)document.getElementById('s-thinking').value=String(s.alwaysThinkingEnabled);
  if(s.effortLevel)document.getElementById('s-effort').value=s.effortLevel;
}

export async function saveCliSetting(key,val){
  const s=await electronAPI.loadCliSettings()||{};
  const parts=key.split('.');
  let obj=s;
  for(let i=0;i<parts.length-1;i++){if(!obj[parts[i]])obj[parts[i]]={};obj=obj[parts[i]]}
  obj[parts[parts.length-1]]=val;
  await electronAPI.saveCliSettings(s);
  toast(t('toast.saved'))
}

// ═══ PROXY (Saved Proxy List) ═══
// Proxies are stored in a separate proxy-list.json to avoid race conditions
// with user-config.json writes. Each proxy is {id, type, url, label, isActive}.

let _proxyList = []; // [{id, type, url, label, isActive}]

export async function loadProxyList() {
  _proxyList = await electronAPI.loadProxyList().catch(() => []) || [];
  renderProxyList();
  // Apply active proxy on load
  const active = _proxyList.find(p => p.isActive);
  if (active) {
    await electronAPI.applyProxy({ mode: active.type, url: active.url }).catch(e => console.warn('[proxy] Failed to apply:', e.message));
  }
}

function renderProxyList() {
  const el = document.getElementById('sd-proxy-list');
  if (!el) return;

  if (!_proxyList.length) {
    el.innerHTML = '<div style="color:var(--t4);font-size:12px;padding:8px 0">' + t('proxy.no_proxies') + '</div>';
    return;
  }

  el.innerHTML = _proxyList.map(p => {
    const active = p.isActive;
    return '<div class="proxy-item' + (active ? ' active' : '') + '">' +
      '<div class="proxy-item-info" onclick="selectProxy(\'' + esc(p.id) + '\')">' +
        '<span class="proxy-item-dot' + (active ? ' on' : '') + '"></span>' +
        '<span class="proxy-item-type">' + esc(p.type.toUpperCase()) + '</span>' +
        '<span class="proxy-item-url">' + esc(p.label || p.url) + '</span>' +
      '</div>' +
      '<button class="proxy-item-del" onclick="deleteSavedProxy(\'' + esc(p.id) + '\')" title="删除">✕</button>' +
    '</div>';
  }).join('');
}

export async function addSavedProxy() {
  const type = document.getElementById('sd-proxy-add-type').value;
  const rawUrl = document.getElementById('sd-proxy-add-url').value.trim();
  if (!rawUrl) { toast(t('proxy.enter_address')); return; }

  // Build full URL
  const fullUrl = rawUrl.match(/^(https?|socks5):\/\//) ? rawUrl : type + '://' + rawUrl;

  // Create label from URL (hide password)
  let label = rawUrl;
  try {
    const u = new URL(fullUrl);
    label = u.hostname + ':' + u.port;
    if (u.username) label = u.username + '@' + label;
  } catch {}

  const proxy = {
    id: 'px_' + Date.now().toString(36),
    type,
    url: fullUrl,
    label,
    isActive: false,
  };

  _proxyList.push(proxy);
  await electronAPI.saveProxyList(_proxyList);
  document.getElementById('sd-proxy-add-url').value = '';

  // Auto-activate the new proxy
  await selectProxy(proxy.id);
}

export async function selectProxy(id) {
  for (const p of _proxyList) {
    p.isActive = (p.id === id);
  }
  await electronAPI.saveProxyList(_proxyList);
  renderProxyList();

  // Apply the selected proxy
  const active = _proxyList.find(p => p.isActive);
  if (active) {
    await electronAPI.applyProxy({ mode: active.type, url: active.url });
    toast(t('proxy.applied') + ' — ' + active.label);
  }
}

export async function setDirectProxy() {
  for (const p of _proxyList) { p.isActive = false; }
  await electronAPI.saveProxyList(_proxyList);
  renderProxyList();
  await electronAPI.applyProxy({ mode: 'none', url: '' });
  toast(t('proxy.applied') + ' — Direct');
}

export async function setSystemProxy() {
  for (const p of _proxyList) { p.isActive = false; }
  await electronAPI.saveProxyList(_proxyList);
  renderProxyList();
  await electronAPI.applyProxy({ mode: 'system', url: '' });
  toast(t('proxy.applied') + ' — System');
}

export async function deleteSavedProxy(id) {
  const wasActive = _proxyList.find(p => p.id === id)?.isActive;
  _proxyList = _proxyList.filter(p => p.id !== id);
  await electronAPI.saveProxyList(_proxyList);
  renderProxyList();
  if (wasActive) {
    await electronAPI.applyProxy({ mode: 'none', url: '' });
  }
}

export async function checkCurrentIpDrawer() { return checkCurrentIp('sd-proxy-status'); }

export async function checkCurrentIp(elId) {
  const el = document.getElementById(elId || 'proxy-status');
  if (!el) return;
  el.className = 'result-area loading show';
  el.textContent = t('proxy.detect_ip');
  const r = await electronAPI.checkProxyIp();
  el.className = 'result-area show';
  if (r.ok) {
    el.innerHTML = '<span style="color:var(--green)">✓ ' + t('proxy.current_ip') + ': <strong>' + esc(r.ip) + '</strong></span>';
  } else {
    el.innerHTML = '<span style="color:var(--red)">✗ ' + t('proxy.detect_fail') + ': ' + esc(r.error) + '</span>';
  }
}

// Legacy compat stubs
export function onProxyModeChange() {}
export function saveProxy() {}
export function testProxy() {}
export function testProxyDrawer() {}
export async function loadProxySettings() { await loadProxyList(); }

// ═══ KEYBINDINGS UI ═══
const _kbLabels = {
  quickOpen: 'keybindings.quickOpen',
  save: 'keybindings.save',
  closeTab: 'keybindings.closeTab',
  toggleTerminal: 'keybindings.toggleTerminal',
  newChat: 'keybindings.newChat',
  toggleSettings: 'keybindings.toggleSettings',
};

// ═══ SMTP EMAIL SETTINGS ═══
export async function loadSmtpSettings() {
  try {
    const cfg = await electronAPI.loadSmtpConfig();
    if (cfg) {
      try { document.getElementById('smtp-host').value = cfg.host || ''; } catch {}
      try { document.getElementById('smtp-port').value = cfg.port || '465'; } catch {}
      try { document.getElementById('smtp-user').value = cfg.user || ''; } catch {}
      try { document.getElementById('smtp-pass').value = cfg.pass || ''; } catch {}
      try { document.getElementById('smtp-from').value = cfg.from || ''; } catch {}
    }
  } catch {}
}

export async function saveSmtpSettings() {
  const cfg = {
    host: document.getElementById('smtp-host').value.trim(),
    port: parseInt(document.getElementById('smtp-port').value) || 465,
    user: document.getElementById('smtp-user').value.trim(),
    pass: document.getElementById('smtp-pass').value,
    from: document.getElementById('smtp-from').value.trim(),
    secure: (parseInt(document.getElementById('smtp-port').value) || 465) === 465,
  };
  const r = await electronAPI.saveSmtpConfig(cfg);
  if (r.ok) toast('✓ ' + t('email.saved'));
  else toast(t('email.save_fail'));
}

export async function testSmtpConnection() {
  const el = document.getElementById('smtp-status');
  el.className = 'result-area show';
  el.textContent = t('email.testing');
  const cfg = {
    host: document.getElementById('smtp-host').value.trim(),
    port: parseInt(document.getElementById('smtp-port').value) || 465,
    user: document.getElementById('smtp-user').value.trim(),
    pass: document.getElementById('smtp-pass').value,
    secure: (parseInt(document.getElementById('smtp-port').value) || 465) === 465,
  };
  const r = await electronAPI.sendEmail({
    smtp: cfg,
    to: cfg.user,
    subject: 'LaiaiAgent SMTP Test',
    body: 'This is a test email from LaiaiAgent. If you received this, SMTP is configured correctly!',
  });
  if (r.ok) {
    el.textContent = '✅ ' + t('email.test_ok');
  } else {
    el.textContent = '❌ ' + r.error;
  }
}

export async function loadKeybindingsUI() {
  const el = document.getElementById('sd-keybindings');
  if (!el) return;
  const kb = await electronAPI.loadKeybindings().catch(() => null);
  if (!kb) return;
  // Update global keybindings
  if (window._keybindings) Object.assign(window._keybindings, kb);

  let html = '';
  for (const [action, i18nKey] of Object.entries(_kbLabels)) {
    const current = kb[action] || '';
    html += '<div class="sd-row" style="margin-bottom:4px">' +
      '<div><div class="sd-row-label">' + t(i18nKey) + '</div></div>' +
      '<button class="btn btn-s btn-sm kb-bind-btn" data-action="' + esc(action) + '" onclick="rebindKey(\'' + esc(action) + '\')" style="font-family:\'JetBrains Mono\',monospace;font-size:11px;min-width:100px;text-align:center">' + esc(current) + '</button>' +
      '</div>';
  }
  html += '<div style="margin-top:8px"><button class="btn btn-s btn-sm" onclick="(async()=>{await electronAPI.saveKeybindings({quickOpen:\'Ctrl+P\',save:\'Ctrl+S\',closeTab:\'Ctrl+W\',toggleTerminal:\'Ctrl+\`\',newChat:\'Ctrl+N\',toggleSettings:\'Ctrl+,\'});loadKeybindingsUI()})()">' + t('keybindings.reset') + '</button></div>';
  el.innerHTML = html;
}

export function rebindKey(action) {
  const btn = document.querySelector('.kb-bind-btn[data-action="' + action + '"]');
  if (!btn) return;
  btn.textContent = t('keybindings.press_key');
  btn.classList.add('active');

  const handler = (e) => {
    e.preventDefault();
    e.stopPropagation();
    if (['Control', 'Shift', 'Alt', 'Meta'].includes(e.key)) return;

    const parts = [];
    if (e.ctrlKey || e.metaKey) parts.push('Ctrl');
    if (e.shiftKey) parts.push('Shift');
    if (e.altKey) parts.push('Alt');
    parts.push(e.key.length === 1 ? e.key.toUpperCase() : e.key);
    const combo = parts.join('+');

    btn.textContent = combo;
    btn.classList.remove('active');
    document.removeEventListener('keydown', handler, true);

    // Save
    electronAPI.loadKeybindings().then(kb => {
      kb[action] = combo;
      electronAPI.saveKeybindings(kb);
      if (window._keybindings) window._keybindings[action] = combo;
      toast(t('toast.saved'));
    });
  };

  document.addEventListener('keydown', handler, true);
}

// Re-render dynamic UI when language changes
onLangChange(() => {
  // Refresh all dynamic content when language changes
  if (document.getElementById('settings-drawer')?.classList.contains('open')) {
    try { loadKeybindingsUI(); } catch {}
    try { renderProxyList(); } catch {}
    try { renderDrawerMcp(); } catch {}
    try { renderMcpMarket(); } catch {}
    try { if (window.loadPlugins) window.loadPlugins(); } catch {}
    try { if (window.loadWorkflows) window.loadWorkflows(); } catch {}
    try { loadAutomationStatus(); } catch {}
  }
});

// ═══ ONBOARDING ═══
export function obDomainInput(){const d=document.getElementById('ob-domain').value.trim();document.getElementById('ob-url').value=d?domainToUrl(d):''}

export async function obTest(){
  let url=document.getElementById('ob-url').value.trim();
  const key=document.getElementById('ob-key').value.trim();
  if(!url){const d=document.getElementById('ob-domain').value.trim();if(d){url=domainToUrl(d);document.getElementById('ob-url').value=url}}
  if(!url)return;
  showSt('ob-status','load',t('prov.testing'));
  const urls=[url, url+'/v1', url.replace(/\/v1$/,'')];
  let result=null;
  for(const tryUrl of urls){const r=await electronAPI.testProvider({baseUrl:tryUrl,apiKey:key});if(r.ok&&r.models.length>0){result=r;document.getElementById('ob-url').value=tryUrl;break}}
  if(result&&result.ok){showSt('ob-status','ok',t('prov.ok')+' — '+result.models.length+' models');state.obModels=result.models;document.getElementById('ob-next').disabled=false}
  else{showSt('ob-status','fail',t('prov.fail'));document.getElementById('ob-next').disabled=true}
}

export function obNext(){document.getElementById('ob-p1').style.display='none';document.getElementById('ob-p2').style.display='';document.getElementById('ob-s2').className='ob-step done';document.getElementById('ob-s3').className='ob-step cur';document.getElementById('ob-model').innerHTML=state.obModels.map(m=>`<option value="${m.id}">${m.id}</option>`).join('')}
export function obBack(){document.getElementById('ob-p1').style.display='';document.getElementById('ob-p2').style.display='none';document.getElementById('ob-s2').className='ob-step cur';document.getElementById('ob-s3').className='ob-step'}

export async function obSkip(){
  const c=await electronAPI.loadConfig()||{};
  c.onboardingDone=true;
  await electronAPI.saveConfig(c);
  document.getElementById('onboarding').classList.add('hidden');
  toast(t('ob.skipped'));
}

export async function obFinish(){
  try {
    const url=document.getElementById('ob-url').value.trim(),key=document.getElementById('ob-key').value.trim(),model=document.getElementById('ob-model').value;
    if(!url||!key){toast(t('prov.fill_required'));return}
    let name='My Provider';try{name=new URL(url).hostname.replace(/^api\./,'').replace(/\..+$/,'');name=name.charAt(0).toUpperCase()+name.slice(1)}catch{}
    state.providers.push({id:gid(),name,baseUrl:url,apiKey:key,models:state.obModels||[],defaultModel:model||'',isDefault:true});
    await persistProvs();renderProvs();collectModels();
    const c=await electronAPI.loadConfig()||{};c.onboardingDone=true;await electronAPI.saveConfig(c);
    document.getElementById('onboarding').classList.add('hidden');
    setTimeout(() => showWelcomeGuide(), 500);
  } catch(e) {
    toast('Setup error: ' + e.message, 'error');
    console.error('[obFinish]', e);
  }
}

export function showWelcomeGuide() {
  // Show a brief, non-intrusive welcome notification
  const guide = document.createElement('div');
  guide.className = 'welcome-guide';
  guide.innerHTML =
    '<div class="welcome-guide-inner">' +
    '<div class="welcome-guide-header">' + t('welcome.ready_title') + '</div>' +
    '<div class="welcome-guide-body">' + t('welcome.ready_body') + '</div>' +
    '<div class="welcome-guide-tips">' +
    '<div class="welcome-tip">' + t('welcome.tip_chat') + '</div>' +
    '<div class="welcome-tip">' + t('welcome.tip_plus') + '</div>' +
    '<div class="welcome-tip">' + t('welcome.tip_settings') + '</div>' +
    '</div>' +
    '<button class="btn btn-p btn-sm" onclick="this.closest(\'.welcome-guide\').remove()">' + t('welcome.got_it') + '</button>' +
    '</div>';
  document.body.appendChild(guide);
  // Auto dismiss after 15 seconds
  setTimeout(() => { if (guide.parentElement) guide.remove(); }, 15000);
}

// ═══ WORKFLOW EDITOR ═══
let _workflows = [];
let _editingWorkflow = null;
let _workflowStepCount = 0;

export async function loadWorkflows() {
  try {
    const cfg = await electronAPI.loadConfig() || {};
    _workflows = cfg.workflows || [];
  } catch { _workflows = []; }
  renderWorkflowList();
}

function renderWorkflowList() {
  const el = document.getElementById('sd-workflow-list');
  if (!el) return;
  if (!_workflows.length) {
    el.innerHTML = '<div style="font-size:12px;color:var(--t3);padding:8px 0">' + t('workflow.empty') + '</div>';
    return;
  }
  el.innerHTML = _workflows.map((wf, i) => {
    const triggerIcon = { manual: '▶', cron: '⏱', webhook: '↗', file_change: '◇', startup: '⚡' }[wf.trigger] || '▶️';
    const stepsCount = (wf.steps || []).length;
    return '<div class="workflow-item">' +
      '<div class="workflow-item-info">' +
      '<span class="workflow-item-name">' + triggerIcon + ' ' + esc(wf.name || 'Untitled') + '</span>' +
      '<span class="workflow-item-meta">' + stepsCount + ' ' + t('workflow.steps_count') + (wf.trigger === 'cron' ? ' · ' + esc(wf.cronExpr || '') : '') + '</span>' +
      '</div>' +
      '<div class="workflow-item-actions">' +
      '<button class="btn btn-xs" onclick="runWorkflowById(' + i + ')" title="Run">▶</button>' +
      '<button class="btn btn-xs" onclick="editWorkflow(' + i + ')" title="Edit">✏️</button>' +
      '<button class="btn btn-xs" onclick="deleteWorkflow(' + i + ')" title="Delete">🗑️</button>' +
      '</div></div>';
  }).join('');
}

export function showAddWorkflow() {
  _editingWorkflow = null;
  _workflowStepCount = 0;
  const editor = document.getElementById('workflow-editor');
  if (!editor) return;
  editor.classList.remove('hidden');
  document.getElementById('wf-name').value = '';
  document.getElementById('wf-trigger').value = 'manual';
  document.getElementById('wf-trigger-opts').classList.add('hidden');
  document.getElementById('wf-steps').innerHTML = '';
  document.getElementById('wf-cron').value = '';
  addWorkflowStep();
  renderWorkflowCanvas();
}

export function editWorkflow(idx) {
  const wf = _workflows[idx];
  if (!wf) return;
  _editingWorkflow = idx;
  _workflowStepCount = 0;
  const editor = document.getElementById('workflow-editor');
  editor.classList.remove('hidden');
  document.getElementById('wf-name').value = wf.name || '';
  document.getElementById('wf-trigger').value = wf.trigger || 'manual';
  onWorkflowTriggerChange();
  if (wf.cronExpr) document.getElementById('wf-cron').value = wf.cronExpr;
  document.getElementById('wf-steps').innerHTML = '';
  for (const step of (wf.steps || [])) {
    addWorkflowStep(step);
  }
  renderWorkflowCanvas();
}

export function closeWorkflowEditor() {
  document.getElementById('workflow-editor')?.classList.add('hidden');
}

export function onWorkflowTriggerChange() {
  const val = document.getElementById('wf-trigger').value;
  const opts = document.getElementById('wf-trigger-opts');
  const cronRow = document.getElementById('wf-cron-row');
  const webhookRow = document.getElementById('wf-webhook-row');

  if (val === 'cron' || val === 'webhook') {
    opts.classList.remove('hidden');
    if (cronRow) cronRow.style.display = val === 'cron' ? '' : 'none';
    if (webhookRow) {
      webhookRow.style.display = val === 'webhook' ? '' : 'none';
      if (val === 'webhook') updateWebhookUrl();
    }
  } else {
    opts.classList.add('hidden');
  }
}

export function addWorkflowStep(step) {
  const idx = _workflowStepCount++;
  const container = document.getElementById('wf-steps');
  const div = document.createElement('div');
  div.className = 'workflow-step';
  div.dataset.idx = idx;
  div.innerHTML =
    '<div class="workflow-step-header">' +
    '<span class="workflow-step-num">' + (idx + 1) + '</span>' +
    '<select class="sd-select wf-step-type" title="Step type" onchange="onWorkflowStepTypeChange(' + idx + ')">' +
    '<option value="chat"' + (step?.type === 'chat' ? ' selected' : '') + '>' + t('workflow.step_chat') + '</option>' +
    '<option value="shell"' + (step?.type === 'shell' ? ' selected' : '') + '>' + t('workflow.step_shell') + '</option>' +
    '<option value="condition"' + (step?.type === 'condition' ? ' selected' : '') + '>' + t('workflow.step_condition') + '</option>' +
    '<option value="delay"' + (step?.type === 'delay' ? ' selected' : '') + '>' + t('workflow.step_delay') + '</option>' +
    '<option value="stop"' + (step?.type === 'stop' ? ' selected' : '') + '>' + t('workflow.step_stop') + '</option>' +
    '</select>' +
    '<button class="btn btn-xs" onclick="removeWorkflowStep(' + idx + ')">✕</button>' +
    '</div>' +
    '<textarea class="sd-input wf-step-content" rows="2" placeholder="' + t('workflow.step_placeholder') + '">' + esc(step?.content || '') + '</textarea>';
  container.appendChild(div);
  renderWorkflowCanvas();
}

export function removeWorkflowStep(idx) {
  const step = document.querySelector('.workflow-step[data-idx="' + idx + '"]');
  if (step) step.remove();
  renderWorkflowCanvas();
}

export function onWorkflowStepTypeChange(idx) {
  renderWorkflowCanvas();
}

function renderWorkflowCanvas() {
  const canvas = document.getElementById('wf-canvas');
  if (!canvas) return;
  const steps = document.querySelectorAll('.workflow-step');
  const trigger = document.getElementById('wf-trigger')?.value || 'manual';
  const triggerIcon = { manual: '▶', cron: '⏰', webhook: '🌐', file_change: '📁', startup: '🚀' }[trigger] || '▶';

  let html = '<div class="wf-flow">';
  const triggerI18nMap = { manual: 'workflow.manual', cron: 'workflow.scheduled', webhook: 'workflow.webhook', file_change: 'workflow.on_file_change', startup: 'workflow.on_startup' };
  html += '<div class="wf-node wf-node-trigger">' + triggerIcon + ' ' + t(triggerI18nMap[trigger] || 'workflow.manual') + '</div>';

  steps.forEach((s, i) => {
    const type = s.querySelector('.wf-step-type')?.value || 'chat';
    const icon = { chat: '◇', shell: '▸', condition: '?', delay: '…', stop: '■' }[type] || '◇';
    html += '<div class="wf-arrow">→</div>';
    html += '<div class="wf-node wf-node-' + type + '">' + icon + ' ' + t('workflow.step_' + type) + '</div>';
  });

  html += '<div class="wf-arrow">→</div>';
  html += '<div class="wf-node wf-node-end">✅ ' + t('workflow.done') + '</div>';
  html += '</div>';
  canvas.innerHTML = html;
}

export async function saveWorkflow() {
  const name = document.getElementById('wf-name').value.trim();
  if (!name) { toast(t('workflow.name_required')); return; }

  const trigger = document.getElementById('wf-trigger').value;
  // Clean cron expression — strip non-cron characters (Chinese annotations, etc.)
  const rawCron = document.getElementById('wf-cron')?.value?.trim() || '';
  const cronExpr = rawCron.replace(/[^\d\s\*\/,\-]/g, '').trim();
  const stepEls = document.querySelectorAll('.workflow-step');
  const steps = [];
  stepEls.forEach(el => {
    const type = el.querySelector('.wf-step-type')?.value || 'chat';
    const content = el.querySelector('.wf-step-content')?.value?.trim() || '';
    if (content) steps.push({ type, content });
  });

  if (!steps.length) { toast(t('workflow.need_steps')); return; }

  const wf = { id: gid(), name, trigger, cronExpr, steps, created: Date.now() };

  if (_editingWorkflow !== null) {
    wf.id = _workflows[_editingWorkflow].id;
    _workflows[_editingWorkflow] = wf;
  } else {
    _workflows.push(wf);
  }

  // Persist
  try {
    const cfg = await electronAPI.loadConfig() || {};
    cfg.workflows = _workflows;
    await electronAPI.saveConfig(cfg);
  } catch {}

  closeWorkflowEditor();
  renderWorkflowList();
  // Restart automation engine so cron/webhook picks up changes
  try { await electronAPI.restartAutomation(); } catch {}
  toast('✓ ' + t('workflow.saved'));
}

export async function deleteWorkflow(idx) {
  _workflows.splice(idx, 1);
  try {
    const cfg = await electronAPI.loadConfig() || {};
    cfg.workflows = _workflows;
    await electronAPI.saveConfig(cfg);
  } catch {}
  renderWorkflowList();
  toast(t('workflow.deleted'));
}

export async function runWorkflow() {
  // Run from editor
  const stepEls = document.querySelectorAll('.workflow-step');
  const steps = [];
  stepEls.forEach(el => {
    const type = el.querySelector('.wf-step-type')?.value || 'chat';
    const content = el.querySelector('.wf-step-content')?.value?.trim() || '';
    if (content) steps.push({ type, content });
  });
  await executeWorkflowSteps(steps);
}

export async function runWorkflowById(idx) {
  const wf = _workflows[idx];
  if (!wf || !wf.steps?.length) return;
  toast('▶ ' + t('workflow.running') + ': ' + wf.name);
  await executeWorkflowSteps(wf.steps);
}

async function executeWorkflowSteps(steps) {
  let skipNext = false;
  for (let i = 0; i < steps.length; i++) {
    const step = steps[i];

    // If previous condition failed and set skipNext, skip this step
    if (skipNext) { skipNext = false; continue; }

    try {
      if (step.type === 'chat') {
        const input = document.getElementById('tw-input');
        if (input) { input.value = step.content; }
        if (window.sendChat) await window.sendChat();
      } else if (step.type === 'shell') {
        const r = await electronAPI.runShell({ cmd: step.content });
        if (!r.ok) toast(t('workflow.shell_fail') + ': ' + (r.error || ''));
      } else if (step.type === 'delay') {
        const ms = parseInt(step.content) || 1000;
        await new Promise(r => setTimeout(r, ms));
      } else if (step.type === 'condition') {
        // Condition: evaluate shell command
        // If succeeds (exit 0): continue to next step
        // If fails (exit != 0): skip the next step (branch skip)
        const r = await electronAPI.runShell({ cmd: step.content });
        if (!r.ok) {
          toast(t('workflow.condition_false'));
          skipNext = true; // Skip the next step (the "then" branch)
        } else {
          toast(t('workflow.condition_true'));
        }
      } else if (step.type === 'stop') {
        // Stop: halt workflow execution
        toast(t('workflow.stopped'));
        break;
      }
    } catch (e) {
      toast('⚠️ Workflow step error: ' + e.message);
      break;
    }
  }
  toast('✅ ' + t('workflow.complete'));
}

// ═══ AUTOMATION LISTENER ═══
// Receives workflow execution commands from the main process (cron/webhook triggers)
if (typeof electronAPI !== 'undefined' && electronAPI.onAutomationRun) {
  electronAPI.onAutomationRun(async (data) => {
    toast('🤖 Auto: ' + data.name, 'info');
    if (data.steps && data.steps.length) {
      await executeWorkflowSteps(data.steps);
    }
  });
}

async function loadAutomationStatus() {
  const badge = document.getElementById('sd-automation-status');
  const info = document.getElementById('sd-automation-info');
  if (!badge) return;
  try {
    const wh = await electronAPI.getWebhookInfo();
    const workflows = _workflows || [];
    const cronCount = workflows.filter(w => w.trigger === 'cron').length;
    const webhookCount = workflows.filter(w => w.trigger === 'webhook').length;

    badge.textContent = '● Running';
    badge.className = 'automation-badge running';

    let html = '<div style="display:flex;gap:16px;font-size:11px;color:var(--t3);margin-top:6px">';
    html += '<span>Cron: ' + cronCount + ' active</span>';
    html += '<span>Webhook: ' + (wh.port ? 'port ' + wh.port : 'off') + '</span>';
    if (wh.port && webhookCount > 0) {
      html += '<span style="font-family:\'JetBrains Mono\',monospace;font-size:10px;color:var(--t4)">localhost:' + wh.port + '/webhook</span>';
    }
    html += '</div>';
    if (info) info.innerHTML = html;
  } catch {
    badge.textContent = '○ Stopped';
    badge.className = 'automation-badge stopped';
  }
}

// Update webhook URL when saving workflow
export async function updateWebhookUrl() {
  try {
    const info = await electronAPI.getWebhookInfo();
    const urlInput = document.getElementById('wf-webhook-url');
    if (urlInput && info.port) {
      const wfName = document.getElementById('wf-name')?.value || 'workflow';
      urlInput.value = 'http://localhost:' + info.port + '/webhook/' + wfName.replace(/\s+/g, '-').toLowerCase();
    }
  } catch {}
}
