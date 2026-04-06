// ═══ STATE ═══
let lang='zh',theme='dark',providers=[],allModels=[],sessions=[];
let term=null,fitAddon=null,termRunning=false,editId=null,obModels=[];
let allTools=[];

const PRESETS={
  anthropic:{name:'Claude API',url:'https://api.anthropic.com',c:'#D97706'},
  openai:{name:'OpenAI',url:'https://api.openai.com',c:'#10B981'},
  deepseek:{name:'DeepSeek',url:'https://api.deepseek.com',c:'#3B82F6'},
  ollama:{name:'Ollama (Local)',url:'http://localhost:11434',c:'#8B5CF6'},
  newapi:{name:'NewAPI Gateway',url:'',c:'#EC4899'},
  custom:{name:'',url:'',c:'#6B7280'},
};

// ═══ I18N ═══
const I={zh:{
  'nav.ide':'IDE','nav.terminal':'终端','nav.sessions':'会话','nav.providers':'提供商','nav.models':'模型','nav.tools':'工具','nav.mcp':'MCP','nav.agents':'代理','nav.skills':'技能','nav.plugins':'插件','nav.memory':'记忆','nav.usage':'统计','nav.teams':'协作','nav.buddy':'伙伴','nav.settings':'设置','nav.about':'关于',
  'term.idle':'未运行','term.running':'运行中','term.exited':'已停止','term.start':'启动','term.stop':'停止',
  'term.wtitle':'欢迎回来！','term.wdesc':'LaiaiAgent 智能编程助手，随时为你服务。','term.quick_start':'快速启动','term.starting':'正在启动 LaiaiAgent...','term.fail':'启动失败',
  'term.feature':'支持全模型聚合，最高1M上下文 · 5x更大空间，同等性价比',
  'tw.prov_d':'配置 API 连接','tw.model_d':'浏览 AI 模型','tw.sess_d':'恢复历史对话','tw.set_d':'自定义体验',
  'tw.analyze':'分析项目','tw.analyze_d':'理解代码结构与架构','tw.code':'编写代码','tw.code_d':'智能代码生成与编辑',
  'tw.fix':'修复问题','tw.fix_d':'诊断并修复 Bug','tw.terminal':'执行命令','tw.terminal_d':'运行终端命令与脚本',
  'tw.placeholder':'描述你想做的事情... /image 生图 · /tts 语音','tw.hint':'Enter 发送 · /image 生图 · /tts 语音 · + 新建对话',
  'sess.title':'会话历史','sess.desc':'浏览和恢复之前的对话记录。','sess.empty':'暂无会话记录',
  'prov.title':'API 提供商','prov.desc':'管理你的 AI API 连接，支持随时切换。','prov.add':'添加提供商','prov.name':'名称','prov.url':'API 地址','prov.key':'API 密钥','prov.test':'测试连接','prov.custom':'自定义','prov.testing':'连接中...','prov.ok':'连接成功','prov.fail':'连接失败','prov.edit_title':'编辑提供商','prov.models_found':'个模型','prov.available_models':'可用模型','prov.domain':'站点域名','prov.domain_hint':'输入域名后自动补齐','prov.test_connect':'测试连接',
  'model.title':'模型管理','model.desc':'浏览已连接提供商的 AI 模型。','model.empty':'暂无模型','model.empty_d':'连接提供商后即可发现可用模型。',
  'tools.title':'工具与能力','tools.desc':'AI 助手可用的所有工具一览。',
  'set.title':'设置','set.desc':'自定义你的 LaiaiAgent。','set.appearance':'外观','set.theme':'主题','set.theme_d':'深色或浅色模式','set.lang':'语言','set.lang_d':'界面语言',
  'set.terminal':'终端','set.font':'字号','set.defprov':'默认提供商','set.defprov_d':'启动时自动选择',
  'set.permissions':'权限','set.perm_mode':'权限模式','set.perm_mode_d':'default / plan / acceptEdits / bypass',
  'set.advanced':'高级','set.thinking':'始终启用思考','set.effort':'工作量级别',
  'set.output':'输出风格','set.sandbox':'沙箱模式','set.privacy':'隐私与数据','set.retention':'数据保留天数','set.keybindings':'快捷键','set.keybindings_d':'常用键盘快捷键',
  'agents.title':'Agents 代理','agents.desc':'AI 驱动的项目管理与代码操作。',
  'skills.title':'Skills 技能','skills.desc':'一键执行 AI 技能，结果直接在页面展示。','skills.input':'代码/上下文输入','skills.input_d':'粘贴代码、错误日志或描述项目上下文：','skills.choose':'选择技能','skills.result':'执行结果',
  'plugins.title':'Plugins 插件','plugins.desc':'扩展 LaiaiAgent 的能力。',
  'memory.title':'Memory 记忆','memory.desc':'AI 的持久化记忆系统。',
  'buddy.title':'Buddy 宠物伙伴','buddy.desc':'你的 AI 编程伙伴。',
  'teams.title':'协作与自动化','teams.desc':'团队协作、自动化钩子与高级工具。',
  'usage.title':'使用统计','usage.desc':'会话数据与活动概览。',
  'about.title':'关于','about.desc':'智能编程助手，理解代码库、编辑文件、执行命令、处理完整工作流。','about.web':'官网','about.support':'技术支持',
  'ob.welcome':'欢迎使用 LaiaiAgent','ob.sub':'你的智能编程助手，几秒完成配置。','ob.choose':'选择提供商','ob.model':'选择模型','ob.start':'开始使用',
  'btn.save':'保存','btn.cancel':'取消','btn.next':'下一步','btn.back':'返回','btn.refresh':'刷新',
  'nav.mcp':'MCP','nav.usage':'统计',
  'mcp.title':'MCP 服务器','mcp.desc':'管理模型上下文协议服务器，扩展 AI 能力。','mcp.add':'添加服务器','mcp.empty':'暂无 MCP 服务器','mcp.empty_d':'添加 MCP 服务器以扩展 AI 助手的工具、资源和能力。',
  'mcp.sname':'服务器名称','mcp.stype':'类型','mcp.command':'命令','mcp.args':'参数（逗号分隔）','mcp.scope':'作用域',
  'usage.title':'使用统计','usage.desc':'会话历史和活动概览。','usage.activity':'近期活动',
  'toast.saved':'已保存','toast.deleted':'已删除','toast.no_prov':'请先添加提供商',
},en:{
  'nav.ide':'IDE','nav.terminal':'Terminal','nav.sessions':'Sessions','nav.providers':'Providers','nav.models':'Models','nav.tools':'Tools','nav.mcp':'MCP','nav.agents':'Agents','nav.skills':'Skills','nav.plugins':'Plugins','nav.memory':'Memory','nav.usage':'Usage','nav.teams':'Teams','nav.buddy':'Buddy','nav.settings':'Settings','nav.about':'About',
  'term.idle':'Idle','term.running':'Running','term.exited':'Exited','term.start':'Start','term.stop':'Stop',
  'term.wtitle':'Welcome back!','term.wdesc':'LaiaiAgent intelligent programming assistant, at your service.','term.quick_start':'Quick Start','term.starting':'Starting LaiaiAgent...','term.fail':'Start failed',
  'term.feature':'Full model aggregation, up to 1M context · 5x more space, same value',
  'tw.prov_d':'Configure API connections','tw.model_d':'Browse AI models','tw.sess_d':'Resume conversations','tw.set_d':'Customize experience',
  'tw.analyze':'Analyze Project','tw.analyze_d':'Understand code structure','tw.code':'Write Code','tw.code_d':'AI-powered code generation',
  'tw.fix':'Fix Issues','tw.fix_d':'Diagnose and fix bugs','tw.terminal':'Run Commands','tw.terminal_d':'Execute terminal commands',
  'tw.placeholder':'Ask anything... /image to draw · /tts for voice','tw.hint':'Enter to send · /image draw · /tts voice · + New chat',
  'sess.title':'Session History','sess.desc':'Browse and resume previous conversations.','sess.empty':'No sessions found',
  'prov.title':'API Providers','prov.desc':'Manage AI API connections.','prov.add':'Add Provider','prov.name':'Name','prov.url':'API Base URL','prov.key':'API Key','prov.test':'Test','prov.custom':'Custom','prov.testing':'Connecting...','prov.ok':'Connected','prov.fail':'Failed','prov.edit_title':'Edit Provider','prov.models_found':'models','prov.available_models':'Available Models','prov.domain':'Domain','prov.domain_hint':'Auto-complete from domain','prov.test_connect':'Test Connection',
  'model.title':'Models','model.desc':'Browse AI models from connected providers.','model.empty':'No models','model.empty_d':'Connect a provider to discover models.',
  'tools.title':'Tools & Capabilities','tools.desc':'All tools available to the AI assistant.',
  'set.title':'Settings','set.desc':'Configure your experience.','set.appearance':'Appearance','set.theme':'Theme','set.theme_d':'Dark or light','set.lang':'Language','set.lang_d':'Interface language',
  'set.terminal':'Terminal','set.font':'Font Size','set.defprov':'Default Provider','set.defprov_d':'Auto-selected on launch',
  'set.permissions':'Permissions','set.perm_mode':'Permission Mode','set.perm_mode_d':'default / plan / acceptEdits / bypass',
  'set.advanced':'Advanced','set.thinking':'Always Enable Thinking','set.effort':'Effort Level',
  'set.output':'Output Style','set.sandbox':'Sandbox Mode','set.privacy':'Privacy & Data','set.retention':'Data Retention','set.keybindings':'Keyboard Shortcuts','set.keybindings_d':'Common keyboard shortcuts',
  'agents.title':'Agents','agents.desc':'AI-driven project management and code operations.',
  'skills.title':'Skills','skills.desc':'One-click AI skills with inline results.','skills.input':'Code / Context Input','skills.input_d':'Paste code, error logs, or describe your project context:','skills.choose':'Choose Skill','skills.result':'Result',
  'plugins.title':'Plugins','plugins.desc':'Extend LaiaiAgent capabilities.',
  'memory.title':'Memory','memory.desc':'AI persistent memory system.',
  'buddy.title':'Buddy','buddy.desc':'Your AI coding companion.',
  'teams.title':'Collaboration','teams.desc':'Team mode, automation hooks, and advanced tools.',
  'usage.title':'Usage Statistics','usage.desc':'Session data and activity overview.',
  'about.title':'About','about.desc':'An intelligent programming assistant that understands your codebase.','about.web':'Website','about.support':'Documentation',
  'ob.welcome':'Welcome to LaiaiAgent','ob.sub':'Your intelligent programming assistant.','ob.choose':'Choose provider','ob.model':'Choose model','ob.start':'Get Started',
  'btn.save':'Save','btn.cancel':'Cancel','btn.next':'Next','btn.back':'Back','btn.refresh':'Refresh',
  'nav.mcp':'MCP','nav.usage':'Usage',
  'mcp.title':'MCP Servers','mcp.desc':'Manage Model Context Protocol servers for extended capabilities.','mcp.add':'Add Server','mcp.empty':'No MCP servers','mcp.empty_d':'Add MCP servers to extend the AI with custom tools and resources.',
  'mcp.sname':'Server Name','mcp.stype':'Type','mcp.command':'Command','mcp.args':'Arguments (comma-separated)','mcp.scope':'Scope',
  'usage.title':'Usage Statistics','usage.desc':'Session history and activity overview.','usage.activity':'Recent Activity',
  'toast.saved':'Saved','toast.deleted':'Deleted','toast.no_prov':'Add a provider first',
}};
function t(k){return I[lang]?.[k]||I.en[k]||k}
function applyI18n(){document.querySelectorAll('[data-i18n]').forEach(e=>{e.textContent=t(e.dataset.i18n)})}

// ═══ THEME & LANG ═══
function setTheme(v){theme=v;document.documentElement.dataset.theme=v;document.getElementById('s-theme').value=v;savePrefs()}
function setLang(v){lang=v;document.documentElement.dataset.lang=v;document.getElementById('s-lang').value=v;applyI18n();savePrefs()}
async function savePrefs(){const c=await electronAPI.loadConfig()||{};c.theme=theme;c.lang=lang;await electronAPI.saveConfig(c)}

// ═══ TOAST ═══
function toast(m,d=2200){const e=document.getElementById('toast');e.querySelector('span').textContent=m;e.classList.add('show');clearTimeout(e._t);e._t=setTimeout(()=>e.classList.remove('show'),d)}

// ═══ NAV ═══
// ═══ MODE SWITCHING ═══
function switchMode(mode){
  document.querySelectorAll('.mr-btn').forEach(b=>b.classList.remove('active'));
  const btn=document.getElementById('mr-'+mode);
  if(btn)btn.classList.add('active');
  document.querySelectorAll('.mode').forEach(m=>m.classList.remove('active'));
  // Session sidebar: show in chat mode, hide in IDE mode
  const ss=document.getElementById('session-sidebar');
  if(ss)ss.style.display=mode==='chat'?'':'none';
  if(mode==='chat'){
    document.getElementById('page-terminal').classList.add('active');
    applyTermMode();
  }else if(mode==='ide'){
    document.getElementById('page-ide').classList.add('active');
    if(monacoEditor)setTimeout(()=>monacoEditor.layout(),100);
  }
  document.querySelectorAll('.page').forEach(pg=>{
    if(!pg.classList.contains('mode'))pg.style.display='none';
  });
}

// ═══ SESSION SIDEBAR ═══
function updateStatusBar(state){
  const dot=document.getElementById('sb-dot');
  const status=document.getElementById('sb-status');
  if(!dot||!status)return;
  if(state==='connected'){dot.style.background='var(--green)';status.textContent='Connected'}
  else if(state==='error'){dot.style.background='var(--red)';status.textContent='Error'}
  else if(state==='streaming'){dot.style.background='var(--yellow)';status.textContent='Streaming...'}
  else{dot.style.background='var(--t4)';status.textContent='Ready'}
  // Always update provider and model
  const prov=providers.find(p=>p.isDefault)||providers[0];
  try{document.getElementById('sb-provider').textContent=prov?prov.name:'--'}catch(e){}
  try{document.getElementById('sb-model').textContent=prov?.defaultModel||'--'}catch(e){}
}

function renderSessionList(){
  const el=document.getElementById('ss-list');
  if(!el)return;
  const q=(document.getElementById('ss-search')?.value||'').toLowerCase();
  const filtered=chatSessions.filter(s=>!q||s.title.toLowerCase().includes(q));

  // Group by date
  const now=new Date();
  const today=new Date(now.getFullYear(),now.getMonth(),now.getDate()).getTime();
  const yesterday=today-86400000;
  const week=today-7*86400000;
  const groups={today:[],yesterday:[],week:[],older:[]};
  for(const s of filtered){
    const t=s.created||0;
    if(t>=today)groups.today.push(s);
    else if(t>=yesterday)groups.yesterday.push(s);
    else if(t>=week)groups.week.push(s);
    else groups.older.push(s);
  }

  let html='';
  const labels={today:'今天',yesterday:'昨天',week:'近7天',older:'更早'};
  for(const[key,items] of Object.entries(groups)){
    if(!items.length)continue;
    html+='<div class="ss-date-label">'+labels[key]+'</div>';
    for(const s of items){
      const active=s.id===activeChatId;
      html+='<div class="ss-item'+(active?' active':'')+'" onclick="switchChat(\''+s.id+'\');renderSessionList()">'+
        '<div class="ss-item-text"><div class="ss-item-title">'+esc(s.title||'新对话')+'</div></div>'+
        (chatSessions.length>1?'<button class="ss-item-del" onclick="event.stopPropagation();deleteChat(\''+s.id+'\');renderSessionList()" title="删除">✕</button>':'')+
        '</div>';
    }
  }
  if(!html)html='<div style="padding:20px;text-align:center;color:var(--t4);font-size:12px">暂无会话</div>';
  el.innerHTML=html;
}

function openSettings(){
  document.getElementById('settings-overlay').classList.add('open');
  document.getElementById('settings-drawer').classList.add('open');
  // Sync current values
  try{
    document.getElementById('sd-theme').value=theme;
    document.getElementById('sd-lang').value=lang;
  }catch(e){}
  // Ensure models are collected from providers before rendering
  collectModels();
  renderDrawerProviders();
  // Render models in drawer
  renderDrawerModels();
  // Load memory
  loadDrawerMemory();
  // Load MCP
  renderDrawerMcp();
  // Load proxy
  loadDrawerProxy();
}
function closeSettings(){
  document.getElementById('settings-overlay').classList.remove('open');
  document.getElementById('settings-drawer').classList.remove('open');
}
function sdTab(id,el){
  document.querySelectorAll('.sd-tab').forEach(t=>t.classList.remove('active'));
  document.querySelectorAll('.sd-panel').forEach(p=>p.classList.remove('active'));
  el.classList.add('active');
  document.getElementById('sd-'+id).classList.add('active');
}
function renderDrawerProviders(){
  const el=document.getElementById('sd-prov-list');
  if(!el)return;
  el.innerHTML=providers.map(p=>{
    const def=p.isDefault;
    const mc=(p.models||[]).length;
    return'<div class="sd-row'+(def?' style="border-color:var(--accent)"':'')+'"><div><div class="sd-row-label">'+esc(p.name)+(def?' <span style="color:var(--accent-l);font-size:10px">★ 默认</span>':'')+'</div><div class="sd-row-desc" style="font-family:\'JetBrains Mono\',monospace">'+esc(p.baseUrl||'')+'</div><div class="sd-row-desc" style="color:var(--green);font-size:10px">'+(mc?mc+' 个模型可用':'未测试')+'</div></div><div style="display:flex;gap:4px"><button class="btn btn-s btn-sm" onclick="editProv(\''+p.id+'\')">编辑</button>'+(def?'':'<button class="btn btn-s btn-sm" onclick="setDef(\''+p.id+'\');renderDrawerProviders()">默认</button>')+'<button class="btn btn-d btn-sm" onclick="if(confirm(\'确定删除？\')){delProv(\''+p.id+'\');renderDrawerProviders()}">删除</button></div></div>';
  }).join('')||'<div style="color:var(--t4);font-size:12px;padding:12px">暂无提供商</div>';
}
async function refreshAllModelsDrawer(){
  const el=document.getElementById('sd-model-list');
  if(el)el.innerHTML='<div style="padding:16px;color:var(--t3);font-size:12px;text-align:center">正在从 API 刷新模型...</div>';
  for(const p of providers){
    const r=await electronAPI.testProvider({baseUrl:p.baseUrl,apiKey:p.apiKey}).catch(()=>({ok:false}));
    if(r.ok&&r.models)p.models=r.models;
  }
  await persistProvs();
  collectModels();
  renderDrawerModels();
  renderDrawerProviders();
  updateChatModelSelect();
  toast('模型已刷新');
}
function renderDrawerModels(){
  const el=document.getElementById('sd-model-list');
  if(!el)return;
  const q=(document.getElementById('sd-model-search')?.value||'').toLowerCase();
  let f=allModels.filter(m=>!q||m.id.toLowerCase().includes(q)||m.prov.toLowerCase().includes(q));
  if(!f.length){el.innerHTML='<div style="padding:16px;color:var(--t4);font-size:12px;text-align:center">'+(allModels.length?'无匹配模型':'请先添加并测试 Provider')+'</div>';return}
  // Group by vendor
  const groups={};
  for(const m of f){const v=m.id.includes('/')?m.id.split('/')[0]:(m.ob||m.prov||'Other');if(!groups[v])groups[v]=[];groups[v].push(m)}
  const defProv=providers.find(p=>p.isDefault)||providers[0];
  const defModel=defProv?.defaultModel||'';
  let html='';
  for(const[vendor,models] of Object.entries(groups).sort((a,b)=>a[0].localeCompare(b[0]))){
    html+='<div class="sd-section-title" style="margin-top:12px">'+esc(vendor)+' <span style="font-weight:400;color:var(--t4)">('+models.length+')</span></div>';
    for(const m of models){
      const name=m.id.includes('/')?m.id.split('/').pop():m.id;
      const isActive=m.id===defModel;
      html+='<div class="sd-row'+(isActive?' style="border-color:var(--accent)"':'')+'" onclick="pickModel(\''+esc(m.id)+'\',\''+m.pid+'\');renderDrawerModels()" style="cursor:pointer"><div><div class="sd-row-label" style="font-family:\'JetBrains Mono\',monospace;font-size:12px">'+(isActive?'<span style="color:var(--green)">✓</span> ':'')+esc(name)+'</div><div class="sd-row-desc">'+esc(m.prov)+'</div></div></div>';
    }
  }
  el.innerHTML=html;
}
async function loadDrawerMemory(){
  const r=await electronAPI.loadLaiaiMd().catch(()=>({ok:false}));
  const ed=document.getElementById('sd-memory-editor');
  if(ed&&r.ok)ed.value=r.content;
}
async function renderDrawerMcp(){
  const data=await electronAPI.loadMcpConfig().catch(()=>({userServers:[],projectServers:[]}));
  const servers=[...(data.userServers||[]),...(data.projectServers||[])];
  const el=document.getElementById('sd-mcp-list');
  if(!el)return;
  el.innerHTML=servers.map(s=>'<div class="sd-row"><div><div class="sd-row-label" style="font-family:\'JetBrains Mono\',monospace;font-size:12px">'+esc(s.name)+'</div><div class="sd-row-desc">'+esc(s.type||'stdio')+' · '+esc(s.scope||'user')+'</div></div><button class="btn btn-s btn-sm" onclick="delMcp(\''+esc(s.name)+'\',\''+esc(s.scope||'user')+'\');renderDrawerMcp()">删除</button></div>').join('')||'<div style="color:var(--t4);font-size:12px">暂无 MCP 服务器</div>';
}
function loadDrawerProxy(){
  electronAPI.loadConfig().catch(()=>({})).then(cfg=>{
    if(cfg.proxyMode){document.getElementById('sd-proxy-mode').value=cfg.proxyMode;document.getElementById('sd-proxy-fields').style.display=(cfg.proxyMode==='http'||cfg.proxyMode==='socks5')?'':'none'}
    if(cfg.proxyUrl)document.getElementById('sd-proxy-url').value=cfg.proxyUrl;
  });
}

function go(p){
  // Route legacy page names to new UI locations
  const settingsMap={
    'providers':'providers','models':'models','settings':'general',
    'mcp':'advanced','usage':'advanced','memory':'advanced','about':'about',
    'tools':'advanced','plugins':'advanced','teams':'advanced',
  };
  if(p==='terminal'||p==='chat'){switchMode('chat');return}
  if(p==='ide'){switchMode('ide');return}
  if(settingsMap[p]){
    openSettings();
    const tabIdx={general:0,providers:1,models:2,advanced:3,about:4}[settingsMap[p]]||0;
    const tabs=document.querySelectorAll('.sd-tab');
    if(tabs[tabIdx])sdTab(settingsMap[p],tabs[tabIdx]);
    return;
  }
  // Fallback: just switch to chat mode
  switchMode('chat');
}
function toggleSidebar(){document.getElementById('sidebar').classList.toggle('expanded')}

// ═══ PROVIDERS ═══
const gid=()=>'p_'+Date.now().toString(36)+Math.random().toString(36).slice(2,5);
function esc(s){const d=document.createElement('div');d.textContent=s||'';return d.innerHTML}
function pColor(p){for(const[,v]of Object.entries(PRESETS)){if(v.url&&p.baseUrl&&p.baseUrl.includes(v.url.replace(/https?:\/\//,'')))return v.c}return p.color||'#6B7280'}

function renderProvs(){
  const el=document.getElementById('prov-list');
  document.getElementById('prov-badge').textContent=providers.length;
  if(!providers.length){el.innerHTML='<div class="empty"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M12 2L2 7l10 5 10-5-10-5z"/><path d="M2 17l10 5 10-5"/><path d="M2 12l10 5 10-5"/></svg><h3 data-i18n="prov.empty">No providers</h3><p>Add a provider to get started.</p></div>';applyI18n();updateDropdowns();return}
  el.innerHTML=providers.map(p=>{
    const c=pColor(p),ini=(p.name||'?')[0].toUpperCase(),def=p.isDefault;
    return`<div class="prov-item${def?' default':''}" onclick="editProv('${p.id}')">
      <div class="prov-icon" style="background:${c}18;color:${c}">${ini}</div>
      <div class="prov-info"><div class="prov-name">${esc(p.name)}${def?' <span style="color:var(--accent-l);font-size:10px">★</span>':''}</div><div class="prov-url">${esc(p.baseUrl||'--')}</div></div>
      <div class="prov-meta">${p.models?.length?'<span class="dot" style="width:6px;height:6px;border-radius:50%;background:var(--green)"></span>'+p.models.length+' models':'<span class="dot" style="width:6px;height:6px;border-radius:50%;background:var(--t4)"></span>'}</div>
      <div class="prov-acts" onclick="event.stopPropagation()">
        <button class="btn btn-g btn-sm" onclick="setDef('${p.id}')" title="Set default">★</button>
        <button class="btn btn-g btn-sm" onclick="delProv('${p.id}')" style="color:var(--red)">✕</button>
      </div></div>`}).join('');
  updateDropdowns();
}

function updateDropdowns(){
  const h='<option value="">--</option>'+providers.map(p=>`<option value="${p.id}"${p.isDefault?' selected':''}>${esc(p.name)}</option>`).join('');
  document.getElementById('tp').innerHTML=h;
  document.getElementById('s-defprov').innerHTML=h;
  // Status bar
  const def=providers.find(p=>p.isDefault);
  document.getElementById('sb-provider').textContent=def?def.name:'--';
  document.getElementById('sb-model').textContent=def?.defaultModel||'--';
}

// ═══ PROVIDER: Domain auto-complete ═══
function domainToUrl(domain){
  domain=domain.trim().replace(/^https?:\/\//,'').replace(/\/+$/,'');
  if(!domain)return '';
  // Common patterns: auto-append /v1 for known providers
  if(domain.includes('/')){
    // User typed a path, use as-is
    return 'https://'+domain;
  }
  return 'https://'+domain;
}

function onDomainInput(){
  const domain=document.getElementById('mp-domain').value.trim();
  const urlRow=document.getElementById('mp-url-row');
  const urlInput=document.getElementById('mp-url');
  if(domain){
    const url=domainToUrl(domain);
    urlInput.value=url;
    urlRow.style.display='';
  }else{
    urlRow.style.display='none';
  }
}

function showAddProv(){
  editId=null;
  document.getElementById('mp-title').textContent=t('prov.add');
  document.getElementById('mp-domain').value='';
  document.getElementById('mp-url').value='';
  document.getElementById('mp-key').value='';
  document.getElementById('mp-label').value='';
  document.getElementById('mp-url-row').style.display='none';
  document.getElementById('mp-status').style.display='none';
  document.getElementById('mp-models-section').style.display='none';
  document.getElementById('mp-save-btn').disabled=true;
  document.getElementById('m-prov').classList.add('show');
}
function editProv(id){
  const p=providers.find(x=>x.id===id);if(!p)return;
  editId=id;
  document.getElementById('mp-title').textContent=t('prov.edit_title');
  // Extract domain from URL
  try{document.getElementById('mp-domain').value=new URL(p.baseUrl).hostname}catch{document.getElementById('mp-domain').value=p.baseUrl||''}
  document.getElementById('mp-url').value=p.baseUrl||'';
  document.getElementById('mp-url-row').style.display='';
  document.getElementById('mp-key').value=p.apiKey||'';
  document.getElementById('mp-label').value=p.name||'';
  document.getElementById('mp-status').style.display='none';
  document.getElementById('mp-models-section').style.display='none';
  document.getElementById('mp-save-btn').disabled=false;
  document.getElementById('m-prov').classList.add('show');
}
function closeProv(){
  document.getElementById('m-prov').classList.remove('show');
  // Refresh drawer if open
  try{renderDrawerProviders();renderDrawerModels();updateChatModelSelect()}catch(e){}
}

async function testProvSimple(){
  let url=document.getElementById('mp-url').value.trim();
  const key=document.getElementById('mp-key').value.trim();
  if(!url){
    const domain=document.getElementById('mp-domain').value.trim();
    if(!domain)return;
    url=domainToUrl(domain);
    document.getElementById('mp-url').value=url;
    document.getElementById('mp-url-row').style.display='';
  }
  showSt('mp-status','load',t('prov.testing'));
  document.getElementById('mp-test').disabled=true;
  // Try multiple URL patterns
  const urls=[url, url+'/v1', url.replace(/\/v1$/,'')];
  let result=null;
  for(const tryUrl of urls){
    const r=await electronAPI.testProvider({baseUrl:tryUrl,apiKey:key});
    if(r.ok&&r.models.length>0){result=r;document.getElementById('mp-url').value=tryUrl;break}
  }
  document.getElementById('mp-test').disabled=false;
  if(result&&result.ok){
    showSt('mp-status','ok',t('prov.ok')+' — '+result.models.length+' '+t('prov.models_found'));
    document.getElementById('mp-save-btn').disabled=false;
    document.getElementById('mp-save-btn')._models=result.models;
    // Show model chips
    const ml=document.getElementById('mp-model-list');
    ml.innerHTML=result.models.slice(0,30).map(m=>
      '<span style="font-size:10px;padding:3px 8px;background:var(--bg-3);border:1px solid var(--border-1);border-radius:6px;font-family:\'JetBrains Mono\',monospace;color:var(--t2)">'+esc(m.id)+'</span>'
    ).join('')+(result.models.length>30?'<span style="font-size:10px;color:var(--t3)">+' +(result.models.length-30)+' more</span>':'');
    document.getElementById('mp-models-section').style.display='';
  }else{
    const errMsg=result?result.error:'All URL patterns failed';
    showSt('mp-status','fail',t('prov.fail')+': '+(errMsg||''));
    document.getElementById('mp-save-btn').disabled=true;
    document.getElementById('mp-models-section').style.display='none';
  }
}
function showSt(elId,type,msg){const el=document.getElementById(elId);el.style.display='block';const c={ok:'var(--green)',fail:'var(--red)',load:'var(--yellow)'};const b={ok:'var(--green-bg)',fail:'var(--red-bg)',load:'var(--yellow-bg)'};el.style.background=b[type];el.style.color=c[type];el.innerHTML='<span style="display:inline-block;width:6px;height:6px;border-radius:50%;background:'+c[type]+';margin-right:6px"></span>'+esc(msg)}

async function saveProv(){
  const domain=document.getElementById('mp-domain').value.trim();
  const url=document.getElementById('mp-url').value.trim();
  const key=document.getElementById('mp-key').value.trim();
  const label=document.getElementById('mp-label').value.trim();
  if(!url)return;
  // Use label if provided, otherwise auto-generate from domain
  let name=label;
  if(!name){try{name=new URL(url).hostname.replace(/^api\./,'').replace(/\..+$/,'')}catch{name=domain}
  name=name.charAt(0).toUpperCase()+name.slice(1)}
  const models=document.getElementById('mp-save-btn')._models||[];
  if(editId){const p=providers.find(x=>x.id===editId);if(p){p.name=name;p.baseUrl=url;p.apiKey=key;if(models.length)p.models=models}}
  else{providers.push({id:gid(),name,baseUrl:url,apiKey:key,models,isDefault:!providers.length})}
  await persistProvs();closeProv();renderProvs();collectModels();updateChatModelSelect();
  try{renderDrawerProviders();renderDrawerModels()}catch(e){}
  toast(t('toast.saved'));
}
async function delProv(id){providers=providers.filter(p=>p.id!==id);if(providers.length&&!providers.some(p=>p.isDefault))providers[0].isDefault=true;await persistProvs();renderProvs();collectModels();toast(t('toast.deleted'))}
async function setDef(id){providers.forEach(p=>p.isDefault=p.id===id);await persistProvs();renderProvs()}
function setDefProv(id){if(id)setDef(id)}
async function persistProvs(){
  await electronAPI.saveProviders({providers});
  const def=providers.find(p=>p.isDefault);
  if(def){const c=await electronAPI.loadConfig()||{};c.apiBaseUrl=def.baseUrl;c.apiKey=def.apiKey;c.defaultModel=def.defaultModel||'';await electronAPI.saveConfig(c)}
}

// ═══ MODELS ═══
function collectModels(){allModels=[];providers.forEach(p=>(p.models||[]).forEach(m=>allModels.push({id:m.id,prov:p.name,pid:p.id,ob:m.owned_by||''})));renderModels()}
let modelFilter='all';
function classifyModel(id){
  id=id.toLowerCase();
  const cats=[];
  // By capability
  if(id.includes('vision')||id.includes('4o')||id.includes('gemini')||id.includes('mimo'))cats.push('多模态');
  if(id.includes('r1')||id.includes('think')||id.includes('reason')||id.includes('o1')||id.includes('o3'))cats.push('推理');
  if(id.includes('embed'))cats.push('Embedding');
  if(id.includes('image')||id.includes('dall')||id.includes('flux')||id.includes('stable'))cats.push('图像生成');
  if(id.includes('video')||id.includes('sora')||id.includes('kling'))cats.push('视频生成');
  if(id.includes('audio')||id.includes('tts')||id.includes('whisper')||id.includes('voice'))cats.push('音频/语音');
  if(id.includes('code')||id.includes('coder')||id.includes('starcoder')||id.includes('deepseek-v'))cats.push('代码');
  if(id.includes('mini')||id.includes('haiku')||id.includes('flash')||id.includes('lite')||id.includes('nano'))cats.push('轻量');
  if(id.includes('opus')||id.includes('gpt-4')||id.includes('pro')||id.includes('max')||id.includes('ultra'))cats.push('旗舰');
  if(!cats.length)cats.push('通用');
  return cats;
}
function renderModels(){
  const grid=document.getElementById('model-list'),empty=document.getElementById('model-empty');
  const q=(document.getElementById('model-search').value||'').toLowerCase();
  let f=allModels.filter(m=>!q||m.id.toLowerCase().includes(q)||m.prov.toLowerCase().includes(q));
  if(!f.length){grid.innerHTML='';empty.style.display='';return}
  empty.style.display='none';
  // Build category counts
  const catCounts={'all':f.length};
  for(const m of f){for(const c of classifyModel(m.id)){catCounts[c]=(catCounts[c]||0)+1}}
  // Filter by category
  if(modelFilter!=='all'){
    f=f.filter(m=>classifyModel(m.id).includes(modelFilter));
  }
  // Render filter tabs
  const defProv=providers.find(p=>p.isDefault)||providers[0];
  const defModel=defProv?.defaultModel||'';
  const catEmoji={'all':'📋','旗舰':'🏆','通用':'⚡','轻量':'🪶','推理':'🧠','代码':'💻','多模态':'👁','图像生成':'🎨','视频生成':'🎬','音频/语音':'🎵','Embedding':'📐'};
  const orderedCats=['all','旗舰','通用','轻量','推理','代码','多模态','图像生成','视频生成','音频/语音','Embedding'];
  let tabs='<div style="display:flex;gap:4px;flex-wrap:wrap;margin-bottom:14px">';
  for(const cat of orderedCats){
    if(!catCounts[cat])continue;
    const active=modelFilter===cat;
    const label=cat==='all'?'全部 ('+catCounts[cat]+')':(catEmoji[cat]||'')+' '+cat;
    tabs+='<button class="btn btn-sm '+(active?'btn-p':'btn-s')+'" onclick="modelFilter=\''+cat+'\';renderModels()" style="font-size:11px">'+label+'</button>';
  }
  tabs+='</div>';
  // Render model grid (compact)
  let cards='<div class="model-grid">';
  for(const m of f){
    const name=m.id.includes('/')?m.id.split('/').pop():m.id;
    const vendor=m.id.includes('/')?m.id.split('/')[0]:'';
    const isActive=m.id===defModel;
    const cats=classifyModel(m.id);
    const catBadge=cats[0]&&cats[0]!=='通用'?'<span class="tag tag-f" style="font-size:7px">'+cats[0]+'</span>':'';
    cards+='<div class="mc'+(isActive?' sel':'')+'" onclick="pickModel(\''+esc(m.id)+'\',\''+m.pid+'\')" title="'+esc(m.id)+'">'+
      '<div class="mc-id">'+(isActive?'<span style="color:var(--green)">✓</span> ':'')+esc(name)+'</div>'+
      '<div class="mc-prov">'+(vendor?esc(vendor)+' · ':'')+esc(m.prov)+'</div>'+
      (catBadge?'<div class="mc-tags">'+catBadge+'</div>':'')+
      '</div>';
  }
  cards+='</div>';
  grid.innerHTML=tabs+cards;
}
async function pickModel(mid,pid){const p=providers.find(x=>x.id===pid);if(p){p.defaultModel=mid;await persistProvs();updateDropdowns()}toast(mid)}
async function refreshModels(){for(const p of providers){const r=await electronAPI.testProvider({baseUrl:p.baseUrl,apiKey:p.apiKey});if(r.ok)p.models=r.models}await persistProvs();collectModels();toast(t('btn.refresh')+' ✓')}

// ═══ SESSIONS ═══
async function loadSessions(){
  sessions=await electronAPI.listSessions({limit:100})||[];
  const badge=document.getElementById('sess-badge');
  badge.textContent=sessions.length;badge.style.display=sessions.length?'':'none';
  renderSessions()
}
function renderSessions(){
  const el=document.getElementById('sess-list');
  const q=(document.getElementById('sess-search')?.value||'').toLowerCase();
  const f=sessions.filter(s=>!q||s.summary.toLowerCase().includes(q)||(s.projectDir||'').toLowerCase().includes(q));
  if(!f.length){el.innerHTML='<div class="empty"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M21 15a2 2 0 01-2 2H7l-4 4V5a2 2 0 012-2h14a2 2 0 012 2z"/></svg><h3>'+t('sess.empty')+'</h3></div>';return}
  el.innerHTML=f.map((s,i)=>{
    const d=new Date(s.lastModified),time=d.toLocaleDateString()+' '+d.toLocaleTimeString([],{hour:'2-digit',minute:'2-digit'});
    const size=s.fileSize>1048576?(s.fileSize/1048576).toFixed(1)+'MB':(s.fileSize/1024).toFixed(0)+'KB';
    const preview=s.preview?'<div style="font-size:11px;color:var(--t3);margin-top:3px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;max-width:600px">'+esc(s.preview)+'</div>':'';
    return`<div class="sess-item anim-in">
      <div class="sess-icon" onclick="previewSession(${i})" style="cursor:pointer" title="预览"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 15a2 2 0 01-2 2H7l-4 4V5a2 2 0 012-2h14a2 2 0 012 2z"/></svg></div>
      <div class="sess-body" onclick="previewSession(${i})" style="cursor:pointer">
        <div class="sess-title">${esc(s.summary)}</div>
        ${preview}
        <div class="sess-meta"><span>${time}</span>${s.projectDir?'<span>'+esc(s.projectDir)+'</span>':''}</div>
      </div>
      <div class="sess-size">${size}</div>
      <button class="btn btn-g btn-sm" onclick="deleteSessionUI(${i})" style="color:var(--red)" title="删除">✕</button>
    </div>`
  }).join('')
}
function filterSessions(){renderSessions()}

async function previewSession(idx){
  const s=sessions[idx];if(!s||!s.filePath)return;
  const r=await electronAPI.previewSession({filePath:s.filePath});
  if(!r.ok||!r.messages.length){toast('无法预览');return}
  // Show in a modal-like result area below the session list
  let previewEl=document.getElementById('sess-preview');
  if(!previewEl){
    previewEl=document.createElement('div');previewEl.id='sess-preview';previewEl.className='card';previewEl.style.marginTop='16px';
    document.getElementById('sess-list').parentElement.appendChild(previewEl);
  }
  previewEl.innerHTML='<div class="card-h"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 15a2 2 0 01-2 2H7l-4 4V5a2 2 0 012-2h14a2 2 0 012 2z"/></svg><span>会话预览: '+esc(s.summary.substring(0,50))+'</span></div>'+
    r.messages.map(m=>'<div style="margin-bottom:8px;padding:8px 12px;background:var(--bg-'+(m.role==='user'?'4':'3')+');border-radius:8px;font-size:12px"><strong style="color:var(--'+(m.role==='user'?'accent-l':'green')+')">'+(m.role==='user'?'You':'AI')+':</strong> '+esc(m.content)+'</div>').join('')+
    '<div style="display:flex;gap:8px;margin-top:12px"><button class="btn btn-p btn-sm" onclick="resumeToChat('+idx+')">继续此对话</button><button class="btn btn-s btn-sm" onclick="this.parentElement.parentElement.remove()">关闭预览</button></div>';
  previewEl.scrollIntoView({behavior:'smooth',block:'start'});
}

async function deleteSessionUI(idx){
  const s=sessions[idx];if(!s)return;
  if(!confirm('确定删除此会话？\n\n'+s.summary.substring(0,80)))return;
  const r=await electronAPI.deleteSession({filePath:s.filePath});
  if(r.ok){sessions.splice(idx,1);renderSessions();toast('已删除')}
  else toast('删除失败: '+(r.error||''))
}

async function resumeToChat(idx){
  const s=sessions[idx];if(!s)return;
  const r=await electronAPI.previewSession({filePath:s.filePath});
  if(!r.ok){toast('无法加载会话');return}
  // Create a new chat session with historical messages
  const id='c_'+Date.now().toString(36);
  const msgs=r.messages.map(m=>({role:m.role==='user'?'user':'assistant',content:m.content}));
  chatSessions.unshift({id,title:s.summary.substring(0,30),messages:msgs,created:Date.now()});
  activeChatId=id;
  renderChatUI();
  renderChatSidebar();
  go('terminal');setTermMode('chat');
  toast('已加载 '+r.messages.length+' 条历史消息');
}

function resumeSession(id){
  go('terminal');
  if(term&&termRunning){term.paste('/resume '+id+'\r')}
  else{toast('请先启动终端')}
}

// ═══ TOOLS ═══
let toolFilter='all';
async function loadTools(){allTools=await electronAPI.listTools()||[];renderToolFilters();renderTools()}
function renderToolFilters(){
  const cats=[...new Set(allTools.map(t=>t.category))];
  const el=document.getElementById('tool-filters');
  el.innerHTML='<button class="btn btn-sm '+(toolFilter==='all'?'btn-p':'btn-s')+'" onclick="toolFilter=\'all\';renderToolFilters();renderTools()">All ('+allTools.length+')</button>'+
    cats.map(c=>'<button class="btn btn-sm '+(toolFilter===c?'btn-p':'btn-s')+'" onclick="toolFilter=\''+c+'\';renderToolFilters();renderTools()">'+c[0].toUpperCase()+c.slice(1)+'</button>').join('')
}
function renderTools(){
  const q=(document.getElementById('tool-search')?.value||'').toLowerCase();
  const f=allTools.filter(t=>(toolFilter==='all'||t.category===toolFilter)&&(!q||t.name.toLowerCase().includes(q)||t.desc.toLowerCase().includes(q)));
  document.getElementById('tool-list').innerHTML=f.map(t=>`<div class="tc"><div class="tc-name">${esc(t.name)}</div><div class="tc-desc">${esc(t.desc)}</div><div class="tc-cat">${esc(t.category)}</div></div>`).join('')
}

// ═══ SETTINGS ═══
async function loadSettings(){
  const s=await electronAPI.loadCliSettings()||{};
  if(s.permissions?.defaultMode)document.getElementById('s-perm').value=s.permissions.defaultMode;
  if(s.alwaysThinkingEnabled!==undefined)document.getElementById('s-thinking').value=String(s.alwaysThinkingEnabled);
  if(s.effortLevel)document.getElementById('s-effort').value=s.effortLevel;
}
async function saveCliSetting(key,val){
  const s=await electronAPI.loadCliSettings()||{};
  const parts=key.split('.');
  let obj=s;
  for(let i=0;i<parts.length-1;i++){if(!obj[parts[i]])obj[parts[i]]={};obj=obj[parts[i]]}
  obj[parts[parts.length-1]]=val;
  await electronAPI.saveCliSettings(s);
  toast(t('toast.saved'))
}

// ═══ TERMINAL ═══
function initXterm(){
  if(term)return;
  const c=document.getElementById('term-container');
  term=new Terminal({
    fontSize:parseInt(document.getElementById('s-font').value)||14,
    fontFamily:"'JetBrains Mono','Cascadia Code','Consolas',monospace",
    theme:{background:'#07080D',foreground:'#E2E4EA',cursor:'#7C3AED',cursorAccent:'#07080D',selectionBackground:'rgba(124,58,237,0.3)',
      black:'#1A1D28',red:'#F87171',green:'#34D399',yellow:'#FBBF24',blue:'#60A5FA',magenta:'#C084FC',cyan:'#22D3EE',white:'#E2E4EA',
      brightBlack:'#4A4E5C',brightRed:'#FCA5A5',brightGreen:'#6EE7B7',brightYellow:'#FDE68A',brightBlue:'#93C5FD',brightMagenta:'#D8B4FE',brightCyan:'#67E8F9',brightWhite:'#F9FAFB'},
    cursorBlink:true,cursorStyle:'bar',scrollback:10000,allowProposedApi:true,
  });
  fitAddon=new FitAddon.FitAddon();term.loadAddon(fitAddon);term.open(c);fitTerm();
  term.onData(d=>electronAPI.terminalInput(d));
  window.addEventListener('resize',()=>fitTerm());
}
function fitTerm(){if(!fitAddon||!term)return;try{fitAddon.fit();electronAPI.terminalResize({cols:term.cols,rows:term.rows})}catch{}}
function setTermFont(s){if(term){term.options.fontSize=parseInt(s);fitTerm()}}

// ═══ CHAT / TERMINAL MODE ═══
let termMode='chat';
// Multi-session chat
let chatSessions=[]; // [{id,title,messages:[{role,content}],created}]
let activeChatId=null;
function getChatHistory(){
  const s=chatSessions.find(c=>c.id===activeChatId);
  return s?s.messages:[];
}
function newChat(){
  const id='c_'+Date.now().toString(36);
  chatSessions.unshift({id,title:'新对话',messages:[],created:Date.now()});
  activeChatId=id;
  renderChatUI();
  renderChatSidebar();
}
function switchChat(id){
  activeChatId=id;
  renderChatUI();
  renderChatSidebar();
}
function deleteChat(id){
  chatSessions=chatSessions.filter(c=>c.id!==id);
  if(activeChatId===id){
    activeChatId=chatSessions.length?chatSessions[0].id:null;
    if(!activeChatId)newChat();
  }
  renderChatUI();
  renderChatSidebar();
}
function renderChatSidebar(){
  const el=document.getElementById('chat-session-list');
  if(!el)return;
  el.innerHTML=chatSessions.map(s=>{
    const active=s.id===activeChatId;
    const title=s.title.length>20?s.title.substring(0,20)+'...':s.title;
    return`<div class="chat-sess-item${active?' active':''}" onclick="switchChat('${s.id}')">
      <span class="chat-sess-title">${esc(title)}</span>
      ${chatSessions.length>1?'<button class="chat-sess-del" onclick="event.stopPropagation();deleteChat(\''+s.id+'\')" title="删除">✕</button>':''}
    </div>`;
  }).join('');
}
function renderChatUI(){
  const container=document.getElementById('chat-messages');
  container.innerHTML='';
  const s=chatSessions.find(c=>c.id===activeChatId);
  const hero=document.getElementById('chat-hero');
  const grid=document.getElementById('chat-quick-grid');
  if(!s||!s.messages.length){
    if(hero)hero.style.display='';
    if(grid)grid.style.display='';
  }else{
    if(hero)hero.style.display='none';
    if(grid)grid.style.display='none';
    for(const m of s.messages){
      addChatMsg(m.role==='user'?'user':'ai',m.content);
    }
  }
  scrollChat();
}

function setTermMode(mode){
  termMode=mode;
  document.getElementById('tab-chat').classList.toggle('active',mode==='chat');
  document.getElementById('tab-term').classList.toggle('active',mode==='terminal');
  applyTermMode();
  if(mode==='chat')scrollChat();
}

// Send a command to terminal (auto-start if needed, switch to terminal view)
function sendTermCmd(cmd){
  if(!termRunning){
    startTerm().then(()=>{
      if(termRunning)setTimeout(()=>{if(term){term.paste(cmd+'\r');setTermMode('terminal');go('terminal')}},1500);
    });
  }else{
    if(term)term.paste(cmd+'\r');
    setTermMode('terminal');go('terminal');
  }
}

// ═══ CHAT TOOLBAR ═══
function chatAttach(){
  const inp=document.createElement('input');
  inp.type='file';
  inp.accept='.txt,.md,.js,.ts,.py,.json,.csv,.html,.css,.jsx,.tsx,.java,.go,.rs,.c,.cpp,.h,.xml,.yaml,.yml,.toml,.sh,.bat,.log,.sql,.env,.png,.jpg,.jpeg,.gif,.webp,.bmp,.svg';
  inp.onchange=async(e)=>{
    const file=e.target.files[0];if(!file)return;
    // Image files → paste as vision input
    if(file.type.startsWith('image/')){
      const reader=new FileReader();
      reader.onload=()=>{
        window._pendingImage=reader.result;
        let preview=document.getElementById('paste-image-preview');
        if(!preview){
          preview=document.createElement('div');preview.id='paste-image-preview';
          preview.style.cssText='padding:8px;max-width:760px;margin:0 auto';
          const inputArea=document.querySelector('.tw-input-area');
          inputArea.insertBefore(preview,inputArea.querySelector('.tw-input-wrap'));
        }
        preview.innerHTML='<div style="display:flex;align-items:center;gap:8px;padding:8px;background:var(--bg-3);border-radius:8px;border:1px solid var(--border-1)"><img src="'+reader.result+'" style="max-height:80px;max-width:120px;border-radius:6px" alt="Image"><span style="font-size:11px;color:var(--t2);flex:1">'+esc(file.name)+'</span><button onclick="removePastedImage()" style="background:none;border:none;color:var(--t4);cursor:pointer">✕</button></div>';
        document.getElementById('tw-input').focus();
      };
      reader.readAsDataURL(file);
      return;
    }
    // Text files
    const reader=new FileReader();
    reader.onload=()=>{
      const content=reader.result;
      const preview=content.length>2000?content.substring(0,2000)+'\n...(截断)':content;
      document.getElementById('tw-input').value='以下是文件 `'+file.name+'` 的内容：\n\n```\n'+preview+'\n```';
      autoResize(document.getElementById('tw-input'));
      document.getElementById('tw-input').focus();
    };
    reader.readAsText(file);
  };
  inp.click();
}

function toggleTerminal(){
  go('terminal');
  setTermMode('terminal');
  if(!termRunning)startTerm();
}

function toggleActionMenu(){
  const m=document.getElementById('action-menu');
  if(m.classList.contains('show')){m.classList.remove('show');return}
  m.classList.add('show');
  setTimeout(()=>{
    const close=(e)=>{if(!e.target.closest('#action-menu')&&!e.target.closest('.action-plus')){m.classList.remove('show');document.removeEventListener('click',close)}};
    document.addEventListener('click',close);
  },10);
}
function closeActionMenu(){document.getElementById('action-menu')?.classList.remove('show')}
function insertCmd(cmd){
  const input=document.getElementById('tw-input');
  input.value=cmd;input.focus();
  autoResize(input);
}
function toggleMoreMenu(){
  const m=document.getElementById('ct-more-menu');
  m.classList.toggle('show');
  // Close on outside click
  if(m.classList.contains('show')){
    setTimeout(()=>{
      const close=()=>{m.classList.remove('show');document.removeEventListener('click',close)};
      document.addEventListener('click',close);
    },10);
  }
}

function runSkillInChat(prompt){
  document.getElementById('ct-more-menu').classList.remove('show');
  document.getElementById('tw-input').value=prompt;
  sendChat();
}

function switchChatModel(modelId){
  const prov=providers.find(p=>p.isDefault)||providers[0];
  if(prov){prov.defaultModel=modelId;persistProvs()}
  document.getElementById('ct-model-name').textContent=modelId.length>25?modelId.substring(0,25)+'...':modelId;
  document.getElementById('ct-model-menu').classList.remove('show');
  try{document.getElementById('sb-model').textContent=modelId}catch(e){}
  // Start fresh conversation to avoid model confusion/hallucination
  newChat();
  renderSessionList();
  updateStatusBar('ready');
  toast('已切换模型: '+modelId.split('/').pop());
}

function toggleModelMenu(){
  const m=document.getElementById('ct-model-menu');
  if(m.classList.contains('show')){m.classList.remove('show');return}
  updateChatModelSelect();
  m.classList.add('show');
  setTimeout(()=>{
    const close=(e)=>{if(!e.target.closest('#ct-model-menu')&&!e.target.closest('#ct-model-btn')){m.classList.remove('show');document.removeEventListener('click',close)}};
    document.addEventListener('click',close);
  },10);
}

function updateChatModelSelect(){
  const menu=document.getElementById('ct-model-menu');
  const btn=document.getElementById('ct-model-name');
  if(!menu)return;
  const prov=providers.find(p=>p.isDefault)||providers[0];
  if(!prov||!prov.models||!prov.models.length){
    menu.innerHTML='<div style="padding:12px;color:var(--t3);font-size:12px">未配置模型，请先添加 Provider</div>';
    btn.textContent='未配置';
    return;
  }
  // Set current model name
  btn.textContent=(prov.defaultModel||prov.models[0].id);
  if(btn.textContent.length>25)btn.textContent=btn.textContent.substring(0,25)+'...';
  // Group models by vendor (part before /)
  const groups={};
  for(const m of prov.models){
    const parts=m.id.split('/');
    const vendor=parts.length>1?parts[0]:'Other';
    if(!groups[vendor])groups[vendor]=[];
    groups[vendor].push(m);
  }
  // Render grouped
  let html='';
  for(const[vendor,models] of Object.entries(groups)){
    html+='<div style="padding:6px 12px 2px;font-size:10px;font-weight:700;color:var(--t3);text-transform:uppercase;letter-spacing:.5px">'+esc(vendor)+'</div>';
    for(const m of models){
      const name=m.id.split('/').pop();
      const active=m.id===prov.defaultModel;
      html+='<div class="ct-menu-item'+(active?' style="color:var(--accent-l);font-weight:600"':'')+'" onclick="switchChatModel(\''+esc(m.id)+'\')">'+
        (active?'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="width:14px;height:14px;flex-shrink:0"><polyline points="20 6 9 17 4 12"/></svg>':
        '<span style="width:14px;flex-shrink:0"></span>')+
        '<span style="font-family:\'JetBrains Mono\',monospace;font-size:11px">'+esc(name)+'</span></div>';
    }
  }
  menu.innerHTML=html;
}

function sendQuick(msg){
  document.getElementById('tw-input').value=msg;
  sendChat();
}

// ═══ IMAGE PASTE HANDLER ═══
function initImagePaste(){
  const input=document.getElementById('tw-input');
  if(!input)return;
  input.addEventListener('paste',(e)=>{
    const items=e.clipboardData?.items;
    if(!items)return;
    for(const item of items){
      if(item.type.startsWith('image/')){
        e.preventDefault();
        const blob=item.getAsFile();
        const reader=new FileReader();
        reader.onload=()=>{
          const base64=reader.result;
          // Store image for sending with next message
          window._pendingImage=base64;
          // Show preview
          let preview=document.getElementById('paste-image-preview');
          if(!preview){
            preview=document.createElement('div');
            preview.id='paste-image-preview';
            preview.style.cssText='padding:8px;max-width:760px;margin:0 auto';
            input.closest('.tw-input-area').insertBefore(preview,input.closest('.tw-input-wrap'));
          }
          preview.innerHTML='<div style="display:flex;align-items:center;gap:8px;padding:8px;background:var(--bg-3);border-radius:8px;border:1px solid var(--border-1)"><img src="'+base64+'" style="max-height:80px;max-width:120px;border-radius:6px" alt="Pasted image"><span style="font-size:11px;color:var(--t2);flex:1">已粘贴图片，发送消息时将一同发送</span><button onclick="removePastedImage()" style="background:none;border:none;color:var(--t4);cursor:pointer;font-size:14px">✕</button></div>';
          input.focus();
        };
        reader.readAsDataURL(blob);
        return;
      }
    }
  });
}
function removePastedImage(){
  window._pendingImage=null;
  const preview=document.getElementById('paste-image-preview');
  if(preview)preview.remove();
}

function chatKeyDown(e){
  if(e.key==='Enter'&&!e.shiftKey){e.preventDefault();sendChat()}
}

function autoResize(el){
  el.style.height='auto';
  el.style.height=Math.min(el.scrollHeight,120)+'px';
}

function addChatMsg(role,text){
  const hero=document.getElementById('chat-hero');
  const grid=document.getElementById('chat-quick-grid');
  if(hero)hero.style.display='none';
  if(grid)grid.style.display='none';

  const container=document.getElementById('chat-messages');
  const div=document.createElement('div');
  div.className='chat-msg '+role;

  const avatar=document.createElement('div');
  avatar.className='chat-avatar';
  if(role==='user'){
    avatar.textContent='U';
  }else{
    avatar.innerHTML='<img src="assets/logo.png" alt="AI" onerror="this.parentElement.textContent=\'L\'">';
  }

  const bubble=document.createElement('div');
  bubble.className='chat-bubble';
  // If text contains raw <img> tags (from image paste), render them directly
  if(text.includes('<img src="data:image')){
    // Split into text and images, render text through formatChatText, images directly
    const parts=text.split(/(<img [^>]+>)/g);
    bubble.innerHTML=parts.map(p=>p.startsWith('<img ')?p:formatChatText(p)).join('');
  }else{
    bubble.innerHTML=formatChatText(text);
  }

  div.appendChild(avatar);
  div.appendChild(bubble);
  container.appendChild(div);
  scrollChat();
  return bubble;
}

function addTypingIndicator(){
  removeTypingIndicator();
  const container=document.getElementById('chat-messages');
  const div=document.createElement('div');
  div.className='chat-msg ai';
  div.id='typing-indicator';
  div.innerHTML='<div class="chat-avatar"><img src="assets/logo.png" alt="AI" onerror="this.parentElement.textContent=\'L\'"></div><div class="chat-bubble"><div class="chat-typing"><span></span><span></span><span></span></div></div>';
  container.appendChild(div);
  scrollChat();
}

function removeTypingIndicator(){
  const el=document.getElementById('typing-indicator');
  if(el)el.remove();
}

function formatChatText(text){
  // Simple markdown
  let h=esc(text);
  h=h.replace(/```(\w*)\n([\s\S]*?)```/g,(m,lang,code)=>'<pre><code>'+code+'</code></pre>');
  h=h.replace(/`([^`]+)`/g,'<code>$1</code>');
  h=h.replace(/\*\*(.+?)\*\*/g,'<strong>$1</strong>');
  h=h.replace(/\n/g,'<br>');
  return h;
}

function scrollChat(){
  const el=document.getElementById('chat-scroll');
  if(el)setTimeout(()=>el.scrollTop=el.scrollHeight,50);
}

async function sendChat(){
  const input=document.getElementById('tw-input');
  const msg=input.value.trim();
  if(!msg)return;
  input.value='';input.style.height='auto';
  updateStatusBar('ready'); // Reset error state

  if(!activeChatId)newChat();
  const session=chatSessions.find(c=>c.id===activeChatId);
  if(!session)return;
  if(!session.messages.length){session.title=msg.substring(0,30);renderChatSidebar()}

  // Handle pasted image (vision message)
  const pendingImg=window._pendingImage;
  if(pendingImg){
    addChatMsg('user',msg+'\n<img src="'+pendingImg+'" style="max-width:200px;border-radius:8px;margin-top:8px">');
    session.messages.push({role:'user',content:[
      {type:'text',text:msg||'请分析这张图片'},
      {type:'image_url',image_url:{url:pendingImg}}
    ]});
    removePastedImage();
  }else{
    addChatMsg('user',msg);
    session.messages.push({role:'user',content:msg});
  }

  const prov=providers.find(p=>p.isDefault)||providers[0];
  if(!prov){toast('请先配置 API 提供商');openSettings();return}
  const provData={baseUrl:prov.baseUrl,apiKey:prov.apiKey,defaultModel:prov.defaultModel||''};

  document.getElementById('tw-send-btn').disabled=true;

  // ── Command routing ──
  if(msg.startsWith('/image ')||msg.startsWith('/img ')){
    // Image generation
    const prompt=msg.replace(/^\/(image|img)\s+/,'');
    addTypingIndicator();
    const r=await electronAPI.imageGenerate({provider:provData,prompt});
    removeTypingIndicator();
    if(r.ok&&r.images&&r.images.length){
      const imgHtml=r.images.map(i=>'<img src="'+esc(i.url||('data:image/png;base64,'+i.b64))+'" style="max-width:100%;border-radius:8px;margin-top:8px" alt="Generated image">').join('');
      addChatMsg('ai','🎨 已生成图片：\n'+imgHtml);
      session.messages.push({role:'assistant',content:'[Generated image: '+prompt+']'});
    }else{
      addChatMsg('ai','⚠️ 生图失败: '+(r.error||'Unknown'));
    }
  } else if(msg.startsWith('/tts ')||msg.startsWith('/speak ')){
    // Text to speech
    const text=msg.replace(/^\/(tts|speak)\s+/,'');
    addTypingIndicator();
    const r=await electronAPI.ttsGenerate({provider:provData,text});
    removeTypingIndicator();
    if(r.ok){
      addChatMsg('ai','🎵 语音已生成：\n<audio controls src="data:audio/'+r.format+';base64,'+r.audio+'" style="margin-top:8px;width:100%"></audio>');
      session.messages.push({role:'assistant',content:'[Generated audio: '+text.substring(0,50)+']'});
    }else{
      addChatMsg('ai','⚠️ 语音合成失败: '+(r.error||'Unknown'));
    }
  } else {
    // ── Streaming chat ──
    const aiBubble=addChatMsg('ai','');
    aiBubble.innerHTML='<div class="chat-typing"><span></span><span></span><span></span></div>';
    aiBubble.id='stream-bubble';
    let fullContent='';

    electronAPI.offChatStream();
    electronAPI.onChatStreamChunk((delta)=>{
      fullContent+=delta;
      const el=document.getElementById('stream-bubble');
      if(el)el.innerHTML=formatChatText(fullContent);
      scrollChat();
    });
    electronAPI.onChatStreamDone((result)=>{
      const el=document.getElementById('stream-bubble');
      if(el){el.removeAttribute('id');el.innerHTML=formatChatText(result.ok?result.content:('⚠️ '+(result.error||'')));}
      session.messages.push({role:'assistant',content:result.ok?result.content:result.error});
      electronAPI.saveChatSessions(chatSessions.map(s=>({id:s.id,title:s.title,messages:s.messages.slice(-50),created:s.created})));
      document.getElementById('tw-send-btn').disabled=false;
      // Update status bar
      updateStatusBar(result.ok?'connected':'error');
    });

    updateStatusBar('streaming');
    await electronAPI.chatStreamStart({provider:provData,messages:session.messages.slice(-20)});
    return;
  }

  document.getElementById('tw-send-btn').disabled=false;
  electronAPI.saveChatSessions(chatSessions.map(s=>({id:s.id,title:s.title,messages:s.messages.slice(-50),created:s.created})));
}

// Terminal data listener (only for terminal mode, not chat)
function onTermDataForChat(data){
  // No-op: Chat is now independent of terminal
}

async function startTerm(){
  if(termRunning)return;
  const pid=document.getElementById('tp').value;
  const prov=providers.find(p=>p.id===pid)||providers.find(p=>p.isDefault);
  if(!prov&&!providers.length){toast(t('toast.no_prov'));openSettings();sdTab('providers',document.querySelector('.sd-tab:nth-child(2)'));return}
  document.getElementById('bt-start').disabled=true;
  // Init xterm (it renders into #term-container, which CSS controls visibility)
  initXterm();term.clear();
  const r=await electronAPI.terminalSpawn({provider:prov?{baseUrl:prov.baseUrl,apiKey:prov.apiKey,defaultModel:prov.defaultModel||''}:null});
  document.getElementById('bt-start').disabled=false;
  if(r?.ok){
    termRunning=true;termSt('run');
    applyTermMode();
  }else{
    toast(t('term.fail'));
  }
}

function applyTermMode(){
  const area=document.getElementById('term-area');
  area.classList.toggle('mode-terminal',termMode==='terminal');
  area.classList.toggle('mode-chat',termMode==='chat');
  if(termMode==='terminal'&&term)setTimeout(()=>fitTerm(),50);
}
function stopTerm(){electronAPI.terminalKill();termRunning=false;termSt('exit')}

function termSt(s){
  const d=document.getElementById('td'),tx=document.getElementById('ts');
  const start=document.getElementById('bt-start'),stop=document.getElementById('bt-stop');
  const sb=document.getElementById('sb-dot'),sbs=document.getElementById('sb-status');
  if(s==='run'){d.style.background='var(--green)';tx.textContent=t('term.running');start.style.display='none';stop.style.display='';sb.style.background='var(--green)';sbs.textContent='Running'}
  else if(s==='exit'){d.style.background='var(--red)';tx.textContent=t('term.exited');start.style.display='';stop.style.display='none';sb.style.background='var(--red)';sbs.textContent='Exited'}
  else{d.style.background='var(--t4)';tx.textContent=t('term.idle');start.style.display='';stop.style.display='none';sb.style.background='var(--t4)';sbs.textContent='Ready'}
}
// Single terminal data dispatcher — avoids duplicate listeners
let ideTermInstance=null;
electronAPI.onTerminalData(d=>{
  if(term)term.write(d);
  if(ideTermInstance)ideTermInstance.write(d);
  onTermDataForChat(d);
});
electronAPI.onTerminalExit(c=>{termRunning=false;termSt('exit');if(term)term.writeln('\r\n\x1b[90m[Process exited: '+c+']\x1b[0m')});

// ═══ KEY VISIBILITY ═══
function toggleVis(id){const el=document.getElementById(id);el.type=el.type==='password'?'text':'password'}

// ═══ ONBOARDING ═══
function obDomainInput(){const d=document.getElementById('ob-domain').value.trim();document.getElementById('ob-url').value=d?domainToUrl(d):''}
async function obTest(){
  let url=document.getElementById('ob-url').value.trim();
  const key=document.getElementById('ob-key').value.trim();
  if(!url){const d=document.getElementById('ob-domain').value.trim();if(d){url=domainToUrl(d);document.getElementById('ob-url').value=url}}
  if(!url)return;
  showSt('ob-status','load',t('prov.testing'));
  const urls=[url, url+'/v1', url.replace(/\/v1$/,'')];
  let result=null;
  for(const tryUrl of urls){const r=await electronAPI.testProvider({baseUrl:tryUrl,apiKey:key});if(r.ok&&r.models.length>0){result=r;document.getElementById('ob-url').value=tryUrl;break}}
  if(result&&result.ok){showSt('ob-status','ok',t('prov.ok')+' — '+result.models.length+' models');obModels=result.models;document.getElementById('ob-next').disabled=false}
  else{showSt('ob-status','fail',t('prov.fail'));document.getElementById('ob-next').disabled=true}
}
function obNext(){document.getElementById('ob-p1').style.display='none';document.getElementById('ob-p2').style.display='';document.getElementById('ob-s2').className='ob-step done';document.getElementById('ob-s3').className='ob-step cur';document.getElementById('ob-model').innerHTML=obModels.map(m=>`<option value="${m.id}">${m.id}</option>`).join('')}
function obBack(){document.getElementById('ob-p1').style.display='';document.getElementById('ob-p2').style.display='none';document.getElementById('ob-s2').className='ob-step cur';document.getElementById('ob-s3').className='ob-step'}
async function obFinish(){
  const url=document.getElementById('ob-url').value.trim(),key=document.getElementById('ob-key').value.trim(),model=document.getElementById('ob-model').value;
  let name='My Provider';try{name=new URL(url).hostname.replace(/^api\./,'').replace(/\..+$/,'');name=name.charAt(0).toUpperCase()+name.slice(1)}catch{}
  providers.push({id:gid(),name,baseUrl:url,apiKey:key,models:obModels,defaultModel:model,isDefault:true});
  await persistProvs();renderProvs();collectModels();
  const c=await electronAPI.loadConfig()||{};c.onboardingDone=true;await electronAPI.saveConfig(c);
  document.getElementById('onboarding').classList.add('hidden');toast('✓ '+t('toast.saved'))
}

// ═══ MCP SERVERS ═══
let mcpServers=[];
async function loadMcp(){
  const data=await electronAPI.loadMcpConfig();
  mcpServers=[...(data.userServers||[]),...(data.projectServers||[])];
  renderMcp();
}
function renderMcp(){
  const el=document.getElementById('mcp-list'),empty=document.getElementById('mcp-empty');
  if(!mcpServers.length){el.innerHTML='';empty.style.display='';return}
  empty.style.display='none';
  el.innerHTML=mcpServers.map(s=>{
    const typeLabel={stdio:'Local Process',sse:'SSE',http:'HTTP',ws:'WebSocket'}[s.type||'stdio']||s.type||'stdio';
    return`<div class="mcp-item anim-in">
      <div class="mcp-icon">${(s.name||'?')[0].toUpperCase()}</div>
      <div class="mcp-info"><div class="mcp-name">${esc(s.name)}</div><div class="mcp-type">${esc(typeLabel)} ${s.command?'· '+esc(s.command):''} ${s.url?'· '+esc(s.url):''}</div></div>
      <span class="mcp-scope mcp-scope-${s.scope}">${s.scope}</span>
      <button class="btn btn-g btn-sm" onclick="delMcp('${esc(s.name)}','${s.scope}')" style="color:var(--red)">✕</button>
    </div>`}).join('');
}
function showAddMcp(){document.getElementById('m-mcp').classList.add('show');['mm-name','mm-cmd','mm-args','mm-url'].forEach(id=>document.getElementById(id).value='');mcpTypeChanged()}
function closeMcp(){document.getElementById('m-mcp').classList.remove('show')}
function mcpTypeChanged(){
  const t=document.getElementById('mm-type').value;
  document.getElementById('mm-stdio-fields').style.display=t==='stdio'?'':'none';
  document.getElementById('mm-url-field').style.display=t!=='stdio'?'':'none';
}
async function saveMcp(){
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
  await electronAPI.saveMcpServer({name,config,scope});
  closeMcp();loadMcp();toast(t('toast.saved'));
}
async function delMcp(name,scope){
  await electronAPI.deleteMcpServer({name,scope});
  loadMcp();toast(t('toast.deleted'));
}

// ═══ USAGE STATS ═══
async function loadUsage(){
  const stats=await electronAPI.loadUsageStats();
  // Render summary cards
  const sizeStr=stats.totalSize>1048576?(stats.totalSize/1048576).toFixed(1)+' MB':(stats.totalSize/1024).toFixed(0)+' KB';
  document.getElementById('usage-cards').innerHTML=`
    <div class="usage-card"><div class="usage-val" style="color:var(--accent-l)">${stats.totalSessions}</div><div class="usage-label">${lang==='zh'?'总会话数':'Total Sessions'}</div></div>
    <div class="usage-card"><div class="usage-val" style="color:var(--green)">${sizeStr}</div><div class="usage-label">${lang==='zh'?'数据总量':'Total Data'}</div></div>
    <div class="usage-card"><div class="usage-val" style="color:var(--blue)">${Object.keys(stats.recentDays).length}</div><div class="usage-label">${lang==='zh'?'活跃天数':'Active Days'}</div></div>
    <div class="usage-card"><div class="usage-val" style="color:var(--yellow)">${providers.length}</div><div class="usage-label">${lang==='zh'?'提供商':'Providers'}</div></div>`;
  // Render activity chart (last 14 days)
  const days=[];const now=new Date();
  for(let i=13;i>=0;i--){const d=new Date(now);d.setDate(d.getDate()-i);days.push(d.toISOString().slice(0,10))}
  const maxVal=Math.max(1,...days.map(d=>stats.recentDays[d]||0));
  document.getElementById('usage-chart').innerHTML=days.map(d=>{
    const v=stats.recentDays[d]||0;const pct=Math.round(v/maxVal*100);
    const label=d.slice(5);// MM-DD
    return`<div class="chart-bar-row"><span class="chart-label">${label}</span><div class="chart-bar"><div class="chart-fill" style="width:${pct}%;background:linear-gradient(90deg,var(--accent),var(--accent-l))"></div>${v?'<span class="chart-count">'+v+'</span>':''}</div></div>`
  }).join('');
}

// ═══ SPLASH ═══
const splashStart=Date.now();
function hideSplash(){
  const sp=document.getElementById('splash');
  if(!sp)return;
  // Ensure splash shows for at least 1.5s for brand impression
  const elapsed=Date.now()-splashStart;
  const remaining=Math.max(0,1500-elapsed);
  setTimeout(()=>{
    sp.classList.add('hide');
    setTimeout(()=>{try{sp.remove()}catch{}},500);
  },remaining);
}
// Failsafe: always remove splash after 6 seconds
setTimeout(()=>{const sp=document.getElementById('splash');if(sp){sp.classList.add('hide');setTimeout(()=>{try{sp.remove()}catch{}},500)}},6000);

// ═══ INLINE OPERATIONS (execute + display on same page) ═══

// Run AI skill and show result inline on the current page
// ═══ CONFIRM DIALOG ═══
let pendingSkill={page:'',prompt:'',name:''};
function confirmSkill(name, desc, promptBase){
  const userInput=(document.getElementById('skill-input')||{}).value||'';
  const fullPrompt=userInput.trim()
    ? promptBase+':\n\n```\n'+userInput.trim()+'\n```'
    : promptBase+'（分析当前项目）';
  pendingSkill={page:'skills',prompt:fullPrompt,name};
  document.getElementById('mc-skill-name').textContent='⚡ '+name;
  document.getElementById('mc-desc').textContent=desc;
  document.getElementById('m-confirm').classList.add('show');
}
function confirmAction(page, name, desc, prompt){
  pendingSkill={page,prompt,name};
  document.getElementById('mc-skill-name').textContent='🤖 '+name;
  document.getElementById('mc-desc').textContent=desc;
  document.getElementById('m-confirm').classList.add('show');
}
function closeConfirm(){document.getElementById('m-confirm').classList.remove('show')}
function execConfirmedSkill(){
  closeConfirm();
  runSkillInline(pendingSkill.page, pendingSkill.prompt);
}

async function runSkillInline(page, prompt){
  const el=document.getElementById(page+'-result');
  if(!el)return;
  el.className='result-area loading show';
  el.textContent='AI 正在处理...';

  // Disable all buttons in this card to prevent double-click
  const btns=el.closest('.card')?.previousElementSibling?.querySelectorAll('.btn')||
             el.closest('.card')?.querySelectorAll('.btn')||[];
  btns.forEach(b=>b.disabled=true);

  // Find provider
  const pid=document.getElementById('tp').value;
  const prov=providers.find(p=>p.id===pid)||providers.find(p=>p.isDefault);
  if(!prov){el.className='result-area show';el.textContent='请先配置 API 提供商';btns.forEach(b=>b.disabled=false);return}

  const result=await electronAPI.chatSend({
    provider:{baseUrl:prov.baseUrl,apiKey:prov.apiKey,defaultModel:prov.defaultModel||''},
    messages:[{role:'user',content:prompt}]
  });

  btns.forEach(b=>b.disabled=false);
  el.className='result-area show';
  if(result.ok){
    el.innerHTML='<div class="r-ai">'+formatChatText(result.content)+'</div>';
  }else{
    el.textContent='错误: '+(result.error||'Unknown error');
  }
}

// Git operations — result shown inline
async function runGit(cmd){
  const el=document.getElementById('agent-git-info');
  el.className='result-area loading show';
  el.textContent='执行 git '+cmd+'...';
  const r=await electronAPI.runShell({cmd:'git '+cmd});
  el.className='result-area show';
  el.textContent=r.ok?(r.output||'(无输出)'):(r.error||'Error');
}

async function loadAgentInfo(){
  runGit('status --short');
}

// LAIAI.md editor
async function loadLaiaiMd(){
  const r=await electronAPI.loadLaiaiMd();
  const editor=document.getElementById('memory-editor');
  const label=document.getElementById('memory-file');
  if(r.ok){
    editor.value=r.content;
    label.textContent=r.file;
  }else{
    editor.value='';
    label.textContent='(未找到)';
  }
}
async function saveLaiaiMd(){
  // Use drawer editor if drawer is open, otherwise main editor
  const drawer=document.getElementById('settings-drawer');
  const ed=(drawer&&drawer.classList.contains('open'))?document.getElementById('sd-memory-editor'):document.getElementById('memory-editor');
  await electronAPI.saveLaiaiMd({content:ed?.value||''});
  toast('已保存');
}
async function createLaiaiMd(){
  const content='# LAIAI.md\n\n## 项目说明\n\n描述你的项目...\n\n## 编码规范\n\n- \n\n## 注意事项\n\n- \n';
  document.getElementById('memory-editor').value=content;
  await electronAPI.saveLaiaiMd({content});
  document.getElementById('memory-file').textContent='LAIAI.md';
  toast('已创建');
}

// AI generate LAIAI.md inline
async function genLaiaiMd(){
  // Use drawer element if drawer is open, otherwise main page
  const drawer=document.getElementById('settings-drawer');
  const el=(drawer&&drawer.classList.contains('open'))?document.getElementById('sd-memory-gen-result'):document.getElementById('memory-gen-result');
  if(el){el.className='result-area loading show';el.textContent='AI 正在分析项目...';}
  const pid=document.getElementById('tp').value;
  const prov=providers.find(p=>p.id===pid)||providers.find(p=>p.isDefault);
  if(!prov){if(el){el.className='result-area show';el.textContent='请先配置 API';}return}
  const result=await electronAPI.chatSend({
    provider:{baseUrl:prov.baseUrl,apiKey:prov.apiKey,defaultModel:prov.defaultModel||''},
    messages:[{role:'user',content:'请根据当前项目生成一份LAIAI.md配置文件内容，包含项目说明、技术栈、编码规范。直接输出markdown内容，不需要其他解释。'}]
  });
  if(result.ok){
    document.getElementById('memory-editor').value=result.content;
    if(el){el.className='result-area show';el.innerHTML='<div class="r-ai">已生成配置，请检查后点击「保存」。</div>';}
  }else{
    if(el){el.className='result-area show';el.textContent='错误: '+result.error;}
  }
}

// Plugins
async function loadPlugins(){
  const el=document.getElementById('plugins-list');
  // Use dir on Windows, ls on Unix
  const r=await electronAPI.runShell({cmd:'dir /b .laiai\\plugins 2>nul || echo 暂无已安装的插件'});
  const text=(r.ok?r.output:'暂无已安装的插件').replace(/[^\x20-\x7E\u4e00-\u9fff\u3000-\u303f\n]/g,'').trim();
  el.textContent=text||'暂无已安装的插件';
}

// Teams inline operations
async function runTeamsAction(action){
  if(action==='hooks'){
    const el=document.getElementById('teams-hooks-result');
    if(!el)return;
    el.className='result-area loading show';el.textContent='加载中...';
    const r=await electronAPI.loadHooks();
    el.className='result-area show';
    el.textContent=Object.keys(r).length?JSON.stringify(r,null,2):'暂无配置的 Hooks。\n\n在 Settings 中可以配置自动化钩子。';
  }
}

// ═══ KEYBINDINGS (inline, no terminal) ═══
function showKeybindings(){
  const el=document.getElementById('keybindings-list');
  if(el.classList.contains('show')){el.classList.remove('show');return}
  el.className='result-area show';
  el.innerHTML=[
    '<strong>全局</strong>',
    'Ctrl+C          中断当前操作',
    'Ctrl+D          退出',
    'Ctrl+L          重绘屏幕',
    'Ctrl+T          切换任务列表',
    '',
    '<strong>对话</strong>',
    'Enter            发送消息',
    'Shift+Enter      换行',
    'Up / Down        历史导航',
    'Ctrl+Z           撤销',
    'Escape           取消',
    '',
    '<strong>导航</strong>',
    'Shift+Tab        切换模式',
    '?                帮助菜单',
    'Ctrl+R           搜索历史',
  ].join('\n');
}

// ═══ BUDDY SYSTEM ═══
const BUDDY_PETS=['🐱','🐶','🐰','🦊','🐼','🐨','🦁','🐸','🦉','🐲'];
let buddyState={pet:0,xp:0,hp:100,level:1,mood:'开心 😊'};
function buddyPet(){
  const s=document.getElementById('buddy-sprite');
  s.style.transform='scale(1.3)';setTimeout(()=>s.style.transform='',300);
  const h=document.getElementById('buddy-hearts');
  h.textContent='❤️'.repeat(3);setTimeout(()=>h.textContent='',1500);
  buddyState.xp+=5;buddyState.mood='超开心 🥰';updateBuddy();
}
function buddyFeed(){
  buddyState.hp=Math.min(100,buddyState.hp+20);buddyState.xp+=3;buddyState.mood='饱饱的 😋';
  const s=document.getElementById('buddy-sprite');
  s.style.transform='rotate(10deg)';setTimeout(()=>s.style.transform='',300);
  updateBuddy();toast('喂食成功！');
}
function buddyPlay(){
  buddyState.xp+=10;buddyState.mood='兴奋 🤩';
  const s=document.getElementById('buddy-sprite');
  s.style.transform='translateY(-20px)';setTimeout(()=>s.style.transform='',400);
  updateBuddy();toast('玩耍中...');
}
function buddyChange(){
  buddyState.pet=(buddyState.pet+1)%BUDDY_PETS.length;
  document.getElementById('buddy-sprite').textContent=BUDDY_PETS[buddyState.pet];
  updateBuddy();
}
function updateBuddy(){
  buddyState.level=Math.floor(buddyState.xp/30)+1;
  document.getElementById('buddy-level').textContent='Lv.'+buddyState.level;
  document.getElementById('buddy-hp').textContent='❤️ '+buddyState.hp;
  document.getElementById('buddy-xp').textContent='⭐ '+buddyState.xp;
  document.getElementById('buddy-mood').textContent='心情：'+buddyState.mood;
}

// ═══ PROXY SETTINGS ═══
function onProxyModeChange(mode){
  // Support both old and new IDs
  const fields=document.getElementById('sd-proxy-fields')||document.getElementById('proxy-fields');
  if(fields)fields.style.display=(mode==='http'||mode==='socks5')?'':'none';
  saveProxy();
}
async function saveProxy(){
  const mode=(document.getElementById('sd-proxy-mode')||document.getElementById('s-proxy-mode')||{}).value||'none';
  const url=(document.getElementById('sd-proxy-url')||document.getElementById('s-proxy-url')||{}).value||'';
  const cfg=await electronAPI.loadConfig().catch(()=>({}))||{};
  cfg.proxyMode=mode;
  cfg.proxyUrl=url;
  await electronAPI.saveConfig(cfg);
  // Apply to Electron session immediately
  await electronAPI.applyProxyNow();
  // Restart terminal if running
  if(termRunning){
    electronAPI.terminalKill();termRunning=false;
    setTimeout(()=>startTerm(),500);
  }
  toast('代理已应用');
  // Auto-check IP after save
  checkCurrentIp();
}
async function checkCurrentIpDrawer(){return checkCurrentIp('sd-proxy-status')}
async function testProxyDrawer(){
  const el=document.getElementById('sd-proxy-test');
  if(!el)return;
  const mode=(document.getElementById('sd-proxy-mode')||{}).value||'none';
  const url=(document.getElementById('sd-proxy-url')||{}).value||'';
  el.className='result-area loading show';el.textContent='测试中...';
  const r=await electronAPI.testProxy({mode,url});
  el.className='result-area show';
  if(r.ok){el.innerHTML='<span style="color:var(--green)">✓ '+esc(r.detail)+'</span>'}
  else{el.innerHTML='<span style="color:var(--red)">✗ '+esc(r.error)+'</span>'}
}
async function checkCurrentIp(elId){
  const el=document.getElementById(elId||'proxy-status');
  if(!el)return;
  el.className='result-area loading show';el.textContent='检测出口 IP...';
  const r=await electronAPI.checkProxyIp();
  el.className='result-area show';
  if(r.ok){
    el.innerHTML='<span style="color:var(--green)">✓ 当前出口 IP: <strong>'+esc(r.ip)+'</strong></span><br><span style="color:var(--t3);font-size:10px">代理解析: '+esc(r.proxy)+'</span>';
  }else{
    el.innerHTML='<span style="color:var(--red)">✗ 检测失败: '+esc(r.error)+'</span><br><span style="color:var(--t3);font-size:10px">代理解析: '+esc(r.proxy||'N/A')+'</span>';
  }
}
async function testProxy(){
  const el=document.getElementById('proxy-status');
  el.className='result-area loading show';el.textContent='测试代理连接中...';
  const mode=document.getElementById('s-proxy-mode').value;
  const url=document.getElementById('s-proxy-url').value.trim();
  const r=await electronAPI.testProxy({mode,url});
  el.className='result-area show';
  if(r.ok){
    el.textContent='✓ 代理连接成功！('+r.detail+')';el.style.color='var(--green)';
  }else{
    el.textContent='✗ 连接失败: '+r.error;el.style.color='var(--red)';
  }
}
async function loadProxySettings(){
  const cfg=await electronAPI.loadConfig().catch(()=>({}))||{};
  if(cfg.proxyMode){
    document.getElementById('s-proxy-mode').value=cfg.proxyMode;
    onProxyModeChange(cfg.proxyMode);
  }
  if(cfg.proxyUrl)document.getElementById('s-proxy-url').value=cfg.proxyUrl;
}

// ═══ IDE: MONACO EDITOR ═══
let monacoEditor=null;
let editorTabs=[]; // {id,filePath,fileName,model,viewState,isDirty,isPreview}
let activeTabId=null;
let monacoReady=false;

function initMonaco(){
  const script=document.createElement('script');
  script.src='vendor/monaco/vs/loader.js';
  script.onload=()=>{
    require.config({paths:{vs:'vendor/monaco/vs'}});
    require(['vs/editor/editor.main'],()=>{
      monacoReady=true;
      // Create editor instance
      const container=document.getElementById('monaco-container');
      monacoEditor=monaco.editor.create(container,{
        value:'',
        language:'plaintext',
        theme:'vs-dark',
        fontSize:14,
        fontFamily:"'JetBrains Mono','Cascadia Code','Consolas',monospace",
        minimap:{enabled:true},
        scrollBeyondLastLine:false,
        automaticLayout:true,
        wordWrap:'on',
        lineNumbers:'on',
        renderWhitespace:'selection',
        bracketPairColorization:{enabled:true},
        padding:{top:8},
      });
      // Ctrl+S to save
      monacoEditor.addCommand(monaco.KeyMod.CtrlCmd|monaco.KeyCode.KeyS,()=>saveActiveTab());
      // Right-click context menu: Send to Chat
      monacoEditor.addAction({
        id:'send-to-chat',label:'发送到 AI Chat',
        keybindings:[monaco.KeyMod.CtrlCmd|monaco.KeyMod.Shift|monaco.KeyCode.KeyL],
        contextMenuGroupId:'ai',contextMenuOrder:1,
        run:(ed)=>{
          const sel=ed.getModel().getValueInRange(ed.getSelection());
          if(!sel){toast('请先选中代码');return}
          const tab=editorTabs.find(t=>t.id===activeTabId);
          const fileName=tab?tab.fileName:'';
          const input=document.getElementById('ide-chat-input');
          input.value='请分析以下代码'+(fileName?' (来自 '+fileName+')':'')+':\n\n```\n'+sel+'\n```';
          autoResize(input);input.focus();
        }
      });
      monacoEditor.addAction({
        id:'explain-code',label:'AI 解释此代码',
        contextMenuGroupId:'ai',contextMenuOrder:2,
        run:(ed)=>{
          const sel=ed.getModel().getValueInRange(ed.getSelection());
          if(!sel){toast('请先选中代码');return}
          document.getElementById('ide-chat-input').value='请解释这段代码的功能和逻辑：\n\n```\n'+sel+'\n```';
          sendIdeChat();
        }
      });
      monacoEditor.addAction({
        id:'fix-code',label:'AI 修复/优化此代码',
        contextMenuGroupId:'ai',contextMenuOrder:3,
        run:(ed)=>{
          const sel=ed.getModel().getValueInRange(ed.getSelection());
          if(!sel){toast('请先选中代码');return}
          document.getElementById('ide-chat-input').value='请修复或优化以下代码：\n\n```\n'+sel+'\n```';
          sendIdeChat();
        }
      });
      console.log('[IDE] Monaco ready');
    });
  };
  document.head.appendChild(script);
}

// ═══ IDE: FILE TREE ═══
let fileTreeCache={};
let gitStatus={};
let ideWorkDir=null;
async function openFolder(){
  const dir=await electronAPI.openFolderDialog();
  if(!dir)return;
  ideWorkDir=dir;
  toast('已打开: '+dir.split(/[/\\]/).pop());
  refreshFileTree();
}
async function refreshFileTree(){
  gitStatus=await loadGitStatus();
  const entries=await electronAPI.listDirectory({dir:ideWorkDir||undefined});
  renderFileTreeLevel(document.getElementById('ft-list'),entries,0,'');
}
function filterFileTree(){
  const q=(document.getElementById('ft-search')?.value||'').toLowerCase();
  if(!q){refreshFileTree();return}
  // Show flat filtered list from allProjectFiles
  const filtered=allProjectFiles.filter(f=>f.toLowerCase().includes(q)).slice(0,50);
  const container=document.getElementById('ft-list');
  container.innerHTML=filtered.map(f=>{
    const name=f.split(/[/\\]/).pop();
    const gs=gitStatus[f];
    const gitTag=gs?'<span class="ft-git-'+(gs==='m'?'m':gs==='a'?'a':'d')+'">'+(gs==='m'?'M':gs==='a'?'A':'D')+'</span>':'';
    return'<div class="ft-item" onclick="openFileInEditor(\''+esc(f)+'\',\''+esc(name)+'\')">'+
      '<span class="ft-icon">'+getFileIcon('.'+name.split('.').pop())+'</span>'+
      '<span class="ft-name">'+esc(name)+'</span>'+
      '<span style="font-size:9px;color:var(--t4);margin-left:4px;overflow:hidden;text-overflow:ellipsis">'+esc(f.substring(0,f.length-name.length))+'</span>'+
      gitTag+'</div>';
  }).join('')||'<div style="padding:12px;color:var(--t4);font-size:11px">无匹配</div>';
}
function renderFileTreeLevel(container,entries,depth,parentPath){
  container.innerHTML='';
  const folderSvg='<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M22 19a2 2 0 01-2 2H4a2 2 0 01-2-2V5a2 2 0 012-2h5l2 3h9a2 2 0 012 2z"/></svg>';
  const folderOpenSvg='<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M22 19a2 2 0 01-2 2H4a2 2 0 01-2-2V5a2 2 0 012-2h5l2 3h9a2 2 0 012 2z"/><line x1="9" y1="14" x2="15" y2="14"/></svg>';
  for(const e of entries){
    const relPath=parentPath?parentPath+'/'+e.name:e.name;
    const gs=gitStatus[relPath];
    const gitTag=gs?'<span class="ft-git-'+(gs==='m'?'m':gs==='a'?'a':'d')+'">'+(gs==='m'?'M':gs==='a'?'A':'D')+'</span>':'';
    const div=document.createElement('div');
    div.className='ft-item'+(e.isDir?' dir':'');
    div.innerHTML='<span class="ft-indent" style="width:'+depth*16+'px"></span>'+
      '<span class="ft-icon">'+(e.isDir?folderSvg:getFileIcon(e.ext))+'</span>'+
      '<span class="ft-name">'+esc(e.name)+'</span>'+gitTag;
    if(e.isDir){
      const subList=document.createElement('div');
      subList.style.display='none';
      let loaded=false;
      div.onclick=async()=>{
        if(!loaded){
          const sub=await electronAPI.listDirectory({dir:e.path});
          renderFileTreeLevel(subList,sub,depth+1,relPath);
          loaded=true;
        }
        subList.style.display=subList.style.display==='none'?'':'none';
        div.querySelector('.ft-icon').innerHTML=subList.style.display==='none'?folderSvg:folderOpenSvg;
      };
      container.appendChild(div);
      container.appendChild(subList);
    }else{
      div.onclick=()=>{
        openFileInEditor(e.path,e.name);
        document.querySelectorAll('.ft-item').forEach(el=>el.classList.remove('active'));
        div.classList.add('active');
      };
      container.appendChild(div);
    }
  }
}
function getFileIcon(ext){
  const colors={'.js':'#F7DF1E','.ts':'#3178C6','.jsx':'#61DAFB','.tsx':'#3178C6','.py':'#3776AB','.json':'#559E3F','.md':'#555','.html':'#E34F26','.css':'#1572B6','.vue':'#4FC08D','.go':'#00ADD8','.rs':'#CE412B','.java':'#ED8B00','.c':'#A8B9CC','.cpp':'#00599C','.h':'#A8B9CC','.sh':'#4EAA25','.yml':'#CB171E','.yaml':'#CB171E','.toml':'#9C4121','.sql':'#336791','.env':'#ECD53F','.svg':'#FFB13B','.png':'#8ED1FC','.gif':'#8ED1FC','.txt':'#888'};
  const labels={'.js':'JS','.ts':'TS','.jsx':'JX','.tsx':'TX','.py':'PY','.json':'{ }','.md':'M↓','.html':'</>','.css':'#','.vue':'V','.go':'Go','.rs':'Rs','.java':'Jv','.sh':'$'};
  const c=colors[ext]||'var(--t4)';
  const l=labels[ext]||ext?.replace('.','').substring(0,2).toUpperCase()||'·';
  return'<span style="font-size:8px;font-weight:800;color:'+c+';letter-spacing:-.5px">'+l+'</span>';
}

// ═══ IDE: EDITOR TABS ═══
async function openFileInEditor(filePath,fileName){
  if(!monacoReady){toast('编辑器加载中...');return}
  // Check if already open
  const existing=editorTabs.find(t=>t.filePath===filePath);
  if(existing){activateTab(existing.id);return}
  // Read file
  const r=await electronAPI.readFile({filePath});
  if(!r.ok){toast('无法打开: '+(r.error||''));return}
  // Detect language
  const ext=filePath.split('.').pop().toLowerCase();
  const langMap={js:'javascript',ts:'typescript',jsx:'javascript',tsx:'typescript',py:'python',json:'json',md:'markdown',html:'html',css:'css',vue:'html',go:'go',rs:'rust',java:'java',c:'c',cpp:'cpp',h:'c',sh:'shell',yml:'yaml',yaml:'yaml',toml:'ini',sql:'sql',xml:'xml'};
  const lang=langMap[ext]||'plaintext';
  const uri=monaco.Uri.file(filePath);
  // Check if model already exists
  let model=monaco.editor.getModel(uri);
  if(!model)model=monaco.editor.createModel(r.content,lang,uri);
  const id='tab_'+Date.now();
  editorTabs.push({id,filePath,fileName:fileName||filePath.split(/[/\\]/).pop(),model,viewState:null,isDirty:false});
  activateTab(id);
  // Track dirty state
  model.onDidChangeContent(()=>{
    const tab=editorTabs.find(t=>t.id===id);
    if(tab&&!tab.isDirty){tab.isDirty=true;renderEditorTabs()}
  });
}
function activateTab(id){
  if(activeTabId&&monacoEditor){
    const cur=editorTabs.find(t=>t.id===activeTabId);
    if(cur)cur.viewState=monacoEditor.saveViewState();
  }
  activeTabId=id;
  const tab=editorTabs.find(t=>t.id===id);
  if(tab&&monacoEditor){
    monacoEditor.setModel(tab.model);
    if(tab.viewState)monacoEditor.restoreViewState(tab.viewState);
    monacoEditor.focus();
  }
  // Toggle editor visibility
  const mc=document.getElementById('monaco-container');
  if(mc)mc.classList.toggle('has-tabs',editorTabs.length>0);
  renderEditorTabs();
  // Highlight in file tree
  document.querySelectorAll('.ft-item').forEach(el=>el.classList.remove('active'));
}
function closeTab(id){
  const idx=editorTabs.findIndex(t=>t.id===id);
  if(idx===-1)return;
  const tab=editorTabs[idx];
  if(tab.isDirty&&!confirm('文件未保存，确定关闭？'))return;
  if(tab.model)tab.model.dispose();
  editorTabs.splice(idx,1);
  if(activeTabId===id){
    activeTabId=editorTabs.length?editorTabs[Math.max(0,idx-1)].id:null;
    if(activeTabId)activateTab(activeTabId);
    else{monacoEditor?.setModel(null)}
  }
  const mc=document.getElementById('monaco-container');
  if(mc)mc.classList.toggle('has-tabs',editorTabs.length>0);
  renderEditorTabs();
}
async function saveActiveTab(){
  const tab=editorTabs.find(t=>t.id===activeTabId);
  if(!tab)return;
  const content=tab.model.getValue();
  const r=await electronAPI.writeFile({filePath:tab.filePath,content});
  if(r.ok){tab.isDirty=false;renderEditorTabs();toast('已保存')}
  else toast('保存失败: '+(r.error||''));
}
function renderEditorTabs(){
  const el=document.getElementById('editor-tabs');
  el.innerHTML=editorTabs.map(t=>
    '<div class="ed-tab'+(t.id===activeTabId?' active':'')+(t.isDirty?' dirty':'')+'" onclick="activateTab(\''+t.id+'\')">'+
    '<span class="ed-tab-name">'+esc(t.fileName)+'</span>'+
    '<button class="ed-tab-close" onclick="event.stopPropagation();closeTab(\''+t.id+'\')" title="关闭">✕</button></div>'
  ).join('');
}

// ═══ IDE: CHAT IN SIDEBAR ═══
function renderIdeChatSessions(){
  const el=document.getElementById('ide-chat-sessions');
  if(!el)return;
  el.innerHTML=chatSessions.map(s=>{
    const active=s.id===activeChatId;
    return'<div class="chat-sess-item'+(active?' active':'')+'" onclick="switchChat(\''+s.id+'\');renderIdeChatMessages()"><span class="chat-sess-title">'+esc(s.title.substring(0,15))+'</span></div>';
  }).join('');
}
function renderIdeChatMessages(){
  const container=document.getElementById('ide-chat-messages');
  if(!container)return;
  const s=chatSessions.find(c=>c.id===activeChatId);
  container.innerHTML='';
  if(!s||!s.messages.length){
    container.innerHTML='<div style="text-align:center;color:var(--t3);padding:20px;font-size:12px">开始新对话...</div>';
    return;
  }
  for(const m of s.messages){
    const div=document.createElement('div');
    div.style.cssText='margin-bottom:10px;padding:8px 10px;border-radius:10px;font-size:12px;line-height:1.6;'+(m.role==='user'?'background:var(--accent);color:#fff;margin-left:40px;border-bottom-right-radius:3px':'background:var(--bg-2);border:1px solid var(--border-1);margin-right:20px;border-bottom-left-radius:3px');
    if(m.role==='assistant'){
      div.innerHTML=formatIdeChatText(m.content);
    }else{
      div.innerHTML=formatChatText(m.content);
    }
    container.appendChild(div);
  }
  const scroll=document.getElementById('ide-chat-scroll');
  if(scroll)scroll.scrollTop=scroll.scrollHeight;
}
// Format AI chat with code action buttons
function formatIdeChatText(text){
  let h=esc(text);
  // Code blocks with action buttons
  let codeIdx=0;
  h=h.replace(/```(\w*)\n([\s\S]*?)```/g,(m,lang,code)=>{
    const id='codeblock_'+(codeIdx++);
    const decoded=code.replace(/&amp;/g,'&').replace(/&lt;/g,'<').replace(/&gt;/g,'>').replace(/&#39;/g,"'").replace(/&quot;/g,'"');
    // Store code for actions
    window['_cb_'+id]=decoded.trim();
    return'<pre><code>'+code+'</code></pre>'+
      '<div style="display:flex;gap:4px;margin-top:-6px;margin-bottom:8px">'+
      '<button class="code-action" onclick="copyCodeBlock(\''+id+'\')">📋 复制</button>'+
      '<button class="code-action" onclick="applyCodeToEditor(\''+id+'\')">✨ 应用到编辑器</button>'+
      '<button class="code-action" onclick="createFileFromCode(\''+id+'\',\''+esc(lang)+'\')">📄 新建文件</button>'+
      '</div>';
  });
  h=h.replace(/`([^`]+)`/g,'<code>$1</code>');
  h=h.replace(/\*\*(.+?)\*\*/g,'<strong>$1</strong>');
  h=h.replace(/\n/g,'<br>');
  return h;
}
function copyCodeBlock(id){
  const code=window['_cb_'+id];
  if(!code)return;
  navigator.clipboard.writeText(code).then(()=>toast('已复制'));
}
function applyCodeToEditor(id){
  const code=window['_cb_'+id];
  if(!code||!monacoEditor||!activeTabId)return;
  // Insert at cursor position
  const sel=monacoEditor.getSelection();
  monacoEditor.executeEdits('ai-apply',[{range:sel,text:code}]);
  toast('已应用到编辑器');
}
async function createFileFromCode(id,lang){
  const code=window['_cb_'+id];if(!code)return;
  const extMap={javascript:'.js',typescript:'.ts',python:'.py',html:'.html',css:'.css',json:'.json',go:'.go',rust:'.rs',java:'.java',sh:'.sh',sql:'.sql',markdown:'.md'};
  const ext=extMap[lang]||'.txt';
  const name=prompt('文件名：','new-file'+ext);
  if(!name)return;
  const r=await electronAPI.writeFile({filePath:name,content:code});
  if(r.ok){toast('已创建 '+name);openFileInEditor(name,name);refreshFileTree()}
  else toast('创建失败');
}
async function sendIdeChat(){
  const input=document.getElementById('ide-chat-input');
  const msg=input.value.trim();if(!msg)return;
  input.value='';input.style.height='auto';
  if(!activeChatId)newChat();
  const session=chatSessions.find(c=>c.id===activeChatId);
  if(!session)return;
  if(!session.messages.length){session.title=msg.substring(0,20);renderIdeChatSessions()}
  session.messages.push({role:'user',content:msg});
  renderIdeChatMessages();

  const prov=providers.find(p=>p.isDefault)||providers[0];
  if(!prov){toast('请先配置 Provider');return}
  const provData={baseUrl:prov.baseUrl,apiKey:prov.apiKey,defaultModel:prov.defaultModel||''};

  // Add streaming placeholder
  session.messages.push({role:'assistant',content:''});
  renderIdeChatMessages();

  electronAPI.offChatStream();
  let fullContent='';
  electronAPI.onChatStreamChunk((delta)=>{
    fullContent+=delta;
    const lastMsg=session.messages[session.messages.length-1];
    if(lastMsg&&lastMsg.role==='assistant')lastMsg.content=fullContent;
    renderIdeChatMessages();
  });
  electronAPI.onChatStreamDone((result)=>{
    const lastMsg=session.messages[session.messages.length-1];
    if(lastMsg&&lastMsg.role==='assistant'){
      lastMsg.content=result.ok?result.content:('⚠️ '+(result.error||''));
    }
    renderIdeChatMessages();
    electronAPI.saveChatSessions(chatSessions.map(s=>({id:s.id,title:s.title,messages:s.messages.slice(-50),created:s.created})));
  });

  await electronAPI.chatStreamStart({provider:provData,messages:session.messages.slice(0,-1).slice(-20)});
}

// ═══ IDE: QUICK OPEN (Ctrl+P) ═══
let allProjectFiles=[];
async function loadAllFiles(){
  allProjectFiles=await electronAPI.listProjectFiles({})||[];
}
function toggleQuickOpen(){
  const overlay=document.getElementById('qo-overlay');
  if(overlay.classList.contains('show')){closeQuickOpen();return}
  if(!allProjectFiles.length)loadAllFiles().then(()=>filterQuickOpen());
  overlay.classList.add('show');
  document.getElementById('qo-input').value='';
  document.getElementById('qo-input').focus();
  filterQuickOpen();
}
function closeQuickOpen(){document.getElementById('qo-overlay').classList.remove('show')}
let qoSelected=0;
function filterQuickOpen(){
  const q=(document.getElementById('qo-input').value||'').toLowerCase();
  const filtered=allProjectFiles.filter(f=>!q||f.toLowerCase().includes(q)).slice(0,20);
  qoSelected=0;
  document.getElementById('qo-list').innerHTML=filtered.map((f,i)=>{
    const name=f.split(/[/\\]/).pop();
    const dir=f.substring(0,f.length-name.length);
    return'<div class="qo-item'+(i===0?' selected':'')+'" onclick="qoOpen(\''+esc(f)+'\')" onmouseenter="qoSelected='+i+';renderQoSelection()"><span>'+esc(name)+'</span><span class="qo-path">'+esc(dir)+'</span></div>';
  }).join('')||'<div style="padding:12px 18px;color:var(--t4);font-size:12px">无匹配文件</div>';
}
function renderQoSelection(){
  document.querySelectorAll('.qo-item').forEach((el,i)=>el.classList.toggle('selected',i===qoSelected));
}
function qoKeyDown(e){
  const items=document.querySelectorAll('.qo-item');
  if(e.key==='ArrowDown'){e.preventDefault();qoSelected=Math.min(qoSelected+1,items.length-1);renderQoSelection()}
  else if(e.key==='ArrowUp'){e.preventDefault();qoSelected=Math.max(qoSelected-1,0);renderQoSelection()}
  else if(e.key==='Enter'){e.preventDefault();const sel=items[qoSelected];if(sel)sel.click()}
  else if(e.key==='Escape'){closeQuickOpen()}
}
function qoOpen(filePath){
  closeQuickOpen();
  const name=filePath.split(/[/\\]/).pop();
  openFileInEditor(filePath,name);
}

// ═══ IDE: BOTTOM TERMINAL ═══
let ideTermInit=false;
function toggleIdeChat(){
  const panel=document.getElementById('ide-chat');
  const btn=document.getElementById('ide-chat-toggle');
  const rh=document.getElementById('rh-chat');
  if(!panel)return;
  panel.classList.toggle('open');
  const isOpen=panel.classList.contains('open');
  if(btn)btn.classList.toggle('active',isOpen);
  if(rh)rh.style.display=isOpen?'':'none';
  if(monacoEditor)setTimeout(()=>monacoEditor.layout(),100);
  if(isOpen){renderIdeChatSessions();renderIdeChatMessages()}
}

function toggleIdeTerminal(){
  const panel=document.getElementById('ide-bottom-term');
  if(panel.classList.contains('show')){
    panel.classList.remove('show');
    if(monacoEditor)monacoEditor.layout();
    return;
  }
  panel.classList.add('show');
  if(!ideTermInit){
    // Create a second xterm instance for IDE terminal
    const container=document.getElementById('ide-term-container');
    const ideTerm=new Terminal({
      fontSize:13,fontFamily:"'JetBrains Mono',monospace",
      theme:{background:'#07080D',foreground:'#E2E4EA',cursor:'#7C3AED'},
      cursorBlink:true,scrollback:5000,
    });
    const ideFit=new FitAddon.FitAddon();
    ideTerm.loadAddon(ideFit);
    ideTerm.open(container);
    setTimeout(()=>ideFit.fit(),100);
    // Connect to terminal process
    ideTerm.onData(d=>electronAPI.terminalInput(d));
    ideTermInstance=ideTerm; // Register with central dispatcher
    window.addEventListener('resize',()=>{if(panel.classList.contains('show'))ideFit.fit()});
    ideTermInit=true;
    // Drag-to-resize terminal height (VS Code style)
    const termBar=panel.querySelector('.ide-bottom-term-bar');
    if(termBar){
      let startY,startH;
      termBar.addEventListener('mousedown',(e)=>{
        if(e.target.closest('button'))return; // Don't drag on close button
        startY=e.clientY;
        startH=container.offsetHeight;
        const onMove=(e2)=>{
          const newH=Math.max(120,Math.min(window.innerHeight*0.7,startH-(e2.clientY-startY)));
          container.style.height=newH+'px';
          ideFit.fit();
          if(monacoEditor)monacoEditor.layout();
        };
        const onUp=()=>{document.removeEventListener('mousemove',onMove);document.removeEventListener('mouseup',onUp)};
        document.addEventListener('mousemove',onMove);
        document.addEventListener('mouseup',onUp);
      });
    }
    // Auto-start terminal if not running
    if(!termRunning)startTerm();
  }
  setTimeout(()=>{if(monacoEditor)monacoEditor.layout()},50);
}

// ═══ IDE: GLOBAL SHORTCUTS ═══
document.addEventListener('keydown',(e)=>{
  // Ctrl+P: Quick open
  if((e.ctrlKey||e.metaKey)&&e.key==='p'){
    e.preventDefault();
    if(document.getElementById('page-ide').classList.contains('active')||
       document.querySelector('.page.active')?.id==='page-ide'){
      toggleQuickOpen();
    }
  }
  // Ctrl+S: Save
  if((e.ctrlKey||e.metaKey)&&e.key==='s'){
    e.preventDefault();
    saveActiveTab();
  }
  // Ctrl+W: Close tab
  if((e.ctrlKey||e.metaKey)&&e.key==='w'){
    e.preventDefault();
    if(activeTabId)closeTab(activeTabId);
  }
  // Ctrl+`: Toggle terminal
  if((e.ctrlKey||e.metaKey)&&e.key==='`'){
    e.preventDefault();
    toggleIdeTerminal();
  }
});

// ═══ IDE: GIT STATUS IN FILE TREE ═══
async function loadGitStatus(){
  const r=await electronAPI.runShell({cmd:'git status --porcelain'});
  if(!r.ok)return{};
  const status={};
  for(const line of r.output.split('\n')){
    if(!line.trim())continue;
    const code=line.substring(0,2).trim();
    const file=line.substring(3).trim();
    status[file]=code.includes('M')?'m':code.includes('A')||code.includes('?')?'a':code.includes('D')?'d':'';
  }
  return status;
}

// ═══ IDE: RESIZE HANDLES ═══
function initResizeHandles(){
  const setupResize=(handleId,leftId,prop,min,max)=>{
    const handle=document.getElementById(handleId);
    if(!handle)return;
    let startX,startW;
    handle.onmousedown=(e)=>{
      const left=document.getElementById(leftId)||handle.previousElementSibling;
      startX=e.clientX;startW=left.offsetWidth;
      handle.classList.add('dragging');
      const onMove=(e2)=>{
        const w=Math.max(min,Math.min(max,startW+(prop==='left'?e2.clientX-startX:startX-e2.clientX)));
        left.style.width=w+'px';
      };
      const onUp=()=>{handle.classList.remove('dragging');document.removeEventListener('mousemove',onMove);document.removeEventListener('mouseup',onUp)};
      document.addEventListener('mousemove',onMove);
      document.addEventListener('mouseup',onUp);
    };
  };
  setupResize('rh-tree','ide-filetree','left',120,400);
  setupResize('rh-chat','ide-chat','right',200,600);
}

// ═══ INIT ═══
async function init(){
  try {
    const cfg=await electronAPI.loadConfig().catch(()=>({})) || {};
    if(cfg.theme)setTheme(cfg.theme);if(cfg.lang)setLang(cfg.lang);

    const pd=await electronAPI.loadProviders().catch(()=>null);
    providers=(pd?.providers)||[];
    if(!providers.length&&cfg.apiBaseUrl&&cfg.apiKey){
      providers.push({id:gid(),name:'Default API',baseUrl:cfg.apiBaseUrl,apiKey:cfg.apiKey,models:cfg.cachedModels||[],defaultModel:cfg.defaultModel||'',isDefault:true});
      await persistProvs().catch(()=>{});
    }

    try{renderProvs();collectModels();applyI18n()}catch(e){console.error(e)}
    try{loadTools();loadSettings();loadProxySettings()}catch(e){}

    const info=await electronAPI.getAppInfo().catch(()=>({version:'0.0.1',platform:'unknown',hasPty:false}));
    try{
      document.getElementById('ver').textContent='v'+info.version;
      document.getElementById('about-ver').textContent='v'+info.version+' · '+info.platform;
      document.getElementById('sb-platform').textContent=info.platform;
      document.getElementById('sb-pty').textContent=info.hasPty?'PTY':'Spawn';
    }catch(e){}

    if(!cfg.onboardingDone&&!providers.length){
      try{document.getElementById('onboarding').classList.remove('hidden')}catch(e){}
    }

    // IDE setup
    try{initMonaco()}catch(e){console.error('[Monaco]',e)}
    try{refreshFileTree()}catch(e){}
    try{initResizeHandles()}catch(e){}
    try{loadAllFiles()}catch(e){}
    try{updateChatModelSelect()}catch(e){}

    // Chat sessions
    try{
      const saved=await electronAPI.loadChatSessions().catch(()=>[]);
      if(saved&&saved.length){chatSessions=saved;activeChatId=chatSessions[0].id}
    }catch(e){}
    if(!chatSessions.length)newChat();
    try{renderSessionList();renderIdeChatSessions();renderIdeChatMessages();renderChatUI()}catch(e){}
    // Default to Chat mode
    switchMode('chat');
    initImagePaste();

  } catch(e) {
    console.error('[init] Fatal:', e);
  }
  // ALWAYS hide splash
  hideSplash();
}
init();
