// ═══ MAIN ENTRY POINT ═══
// Imports all modules and attaches functions to window for HTML onclick compatibility

import { state } from './state.js';
import { t, applyI18n, setTheme, setLang, savePrefs } from './i18n.js';
import { toast, esc, gid, pColor, showSt, formatChatText, formatIdeChatText, autoResize, scrollChat } from './utils.js';
import {
  PRESETS, renderProvs, updateDropdowns, domainToUrl, onDomainInput,
  showAddProv, editProv, closeProv, testProvSimple, saveProv, delProv,
  setDef, setDefProv, persistProvs, collectModels, classifyModel,
  renderModels, pickModel, refreshModels,
  renderDrawerProviders, refreshAllModelsDrawer, renderDrawerModels
} from './providers.js';
import {
  getChatHistory, newChat, switchChat, deleteChat,
  renderChatSidebar, renderChatUI, renderSessionList,
  chatAttach, toggleTerminal, toggleActionMenu, closeActionMenu,
  insertCmd, toggleMoreMenu, runSkillInChat, switchChatModel,
  toggleModelMenu, updateChatModelSelect,
  sendQuick, quickAction, initImagePaste, removePastedImage, chatKeyDown,
  addChatMsg, addTypingIndicator, removeTypingIndicator, sendChat,
  updateStatusBar, go, switchMode, toggleVis,
  editMessage, cancelEditMessage, submitEditMessage,
  regenerateResponse, stopStreaming, initDragDrop, answerAgentQuestion,
  exportCurrentChat, downloadGenImage, downloadTtsAudio, toggleAutoRoute,
  toggleChatSearch, closeChatSearch, searchChatMessages, chatSearchNav,
  toggleGallery, downloadGalleryImage, deleteGalleryImage,
  toggleVoiceInput
} from './chat.js';
import {
  initXterm, fitTerm, setTermFont, setTermMode, sendTermCmd,
  startTerm, applyTermMode, stopTerm, termSt, setupTerminalDataListener
} from './terminal.js';
import {
  openSettings, closeSettings, sdTab, loadDrawerMemory,
  renderDrawerMcp, renderMcpMarket, installMcpFromMarket, loadDrawerProxy, loadSettings, saveCliSetting, loadCronTasks,
  onProxyModeChange, saveProxy, checkCurrentIpDrawer, testProxyDrawer,
  checkCurrentIp, testProxy, loadProxySettings,
  loadProxyList, addSavedProxy, selectProxy, setDirectProxy, setSystemProxy, deleteSavedProxy,
  obDomainInput, obTest, obNext, obBack, obFinish, obSkip,
  loadKeybindingsUI, rebindKey, loadSmtpSettings, saveSmtpSettings, testSmtpConnection, showWelcomeGuide,
  showAddWorkflow, editWorkflow, closeWorkflowEditor, onWorkflowTriggerChange,
  addWorkflowStep, removeWorkflowStep, onWorkflowStepTypeChange,
  saveWorkflow, deleteWorkflow, runWorkflow, runWorkflowById, loadWorkflows
} from './settings.js';
import {
  loadSessions, renderSessions, filterSessions,
  previewSession, deleteSessionUI, resumeToChat, resumeSession
} from './sessions.js';
import {
  initMonaco, openFolder, refreshFileTree, filterFileTree,
  renderFileTreeLevel, getFileIcon,
  openFileInEditor, activateTab, closeTab, saveActiveTab, renderEditorTabs,
  renderIdeChatSessions, renderIdeChatMessages, copyCodeBlock,
  applyCodeToEditor, createFileFromCode, sendIdeChat,
  loadAllFiles, toggleQuickOpen, closeQuickOpen, filterQuickOpen,
  renderQoSelection, qoKeyDown, qoOpen,
  toggleIdeChat, toggleIdeTerminal,
  initResizeHandles, loadGitStatus, showCommandPalette
} from './ide.js';
import {
  confirmSkill, confirmAction, closeConfirm, execConfirmedSkill,
  runSkillInline, runGit, loadAgentInfo,
  loadLaiaiMd, saveLaiaiMd, createLaiaiMd, genLaiaiMd,
  loadPlugins, filterPlugins, installPlugin, showAddPlugin, editPlugin, closePluginEditor,
  onPluginTypeChange, savePlugin, deletePlugin, togglePlugin, getPluginCommands,
  runTeamsAction, loadHooks, showAddHook, closeHookEditor, saveHook, deleteHook, installHookTemplate,
  showKeybindings,
  buddyPet, buddyFeed, buddyPlay, buddyChange, updateBuddy, BUDDY_PETS,
  loadUsage, hideSplash, loadTools, renderToolFilters, renderTools,
  loadMcp, renderMcp, showAddMcp, editMcp, closeMcp, mcpTypeChanged, saveMcp, delMcp,
  checkMcpStatus, quickInstallMcp, quickInstallMcpFromDrawer, filterMcpMarket, quickInstallNpm
} from './features.js';

// ═══ ATTACH ALL FUNCTIONS TO WINDOW ═══
// (Required for HTML onclick="funcName()" compatibility)

// i18n
window.t = t;
window.applyI18n = applyI18n;
window.setTheme = setTheme;
window.setLang = setLang;

// utils
window.toast = toast;
window.esc = esc;
window.showSt = showSt;
window.autoResize = autoResize;

// providers
window.renderProvs = renderProvs;
window.updateDropdowns = updateDropdowns;
window.domainToUrl = domainToUrl;
window.onDomainInput = onDomainInput;
window.showAddProv = showAddProv;
window.editProv = editProv;
window.closeProv = closeProv;
window.testProvSimple = testProvSimple;
window.saveProv = saveProv;
window.delProv = delProv;
window.setDef = setDef;
window.setDefProv = setDefProv;
window.collectModels = collectModels;
window.classifyModel = classifyModel;
window.renderModels = renderModels;
window.pickModel = pickModel;
window.refreshModels = refreshModels;
window.renderDrawerProviders = renderDrawerProviders;
window.refreshAllModelsDrawer = refreshAllModelsDrawer;
window.renderDrawerModels = renderDrawerModels;

// chat
window.getChatHistory = getChatHistory;
window.newChat = newChat;
window.switchChat = switchChat;
window.deleteChat = deleteChat;
window.renderChatSidebar = renderChatSidebar;
window.renderChatUI = renderChatUI;
window.renderSessionList = renderSessionList;
window.chatAttach = chatAttach;
window.toggleTerminal = toggleTerminal;
window.toggleActionMenu = toggleActionMenu;
window.closeActionMenu = closeActionMenu;
window.insertCmd = insertCmd;
window.toggleMoreMenu = toggleMoreMenu;
window.runSkillInChat = runSkillInChat;
window.switchChatModel = switchChatModel;
window.toggleModelMenu = toggleModelMenu;
window.updateChatModelSelect = updateChatModelSelect;
window.sendQuick = sendQuick;
window.quickAction = quickAction;
window.initImagePaste = initImagePaste;
window.removePastedImage = removePastedImage;
window.chatKeyDown = chatKeyDown;
window.addChatMsg = addChatMsg;
window.sendChat = sendChat;
window.toggleAutoRoute = toggleAutoRoute;
window.answerAgentQuestion = answerAgentQuestion;
window.downloadGenImage = downloadGenImage;
window.downloadTtsAudio = downloadTtsAudio;
window.toggleGallery = toggleGallery;
window.downloadGalleryImage = downloadGalleryImage;
window.deleteGalleryImage = deleteGalleryImage;
window.updateStatusBar = updateStatusBar;
window.go = go;
window.switchMode = switchMode;
window.toggleVis = toggleVis;
window.editMessage = editMessage;
window.cancelEditMessage = cancelEditMessage;
window.submitEditMessage = submitEditMessage;
window.regenerateResponse = regenerateResponse;
window.stopStreaming = stopStreaming;
window.exportCurrentChat = exportCurrentChat;
window.toggleChatSearch = toggleChatSearch;
window.closeChatSearch = closeChatSearch;
window.searchChatMessages = searchChatMessages;
window.chatSearchNav = chatSearchNav;
window.toggleVoiceInput = toggleVoiceInput;

// terminal
window.initXterm = initXterm;
window.fitTerm = fitTerm;
window.setTermFont = setTermFont;
window.setTermMode = setTermMode;
window.sendTermCmd = sendTermCmd;
window.startTerm = startTerm;
window.applyTermMode = applyTermMode;
window.stopTerm = stopTerm;
window.termSt = termSt;

// settings
window.openSettings = openSettings;
window.closeSettings = closeSettings;
window.sdTab = sdTab;
window.loadSettings = loadSettings;
window.saveCliSetting = saveCliSetting;
window.onProxyModeChange = onProxyModeChange;
window.saveProxy = saveProxy;
window.checkCurrentIpDrawer = checkCurrentIpDrawer;
window.testProxyDrawer = testProxyDrawer;
window.checkCurrentIp = checkCurrentIp;
window.testProxy = testProxy;
window.loadProxySettings = loadProxySettings;
window.loadProxyList = loadProxyList;
window.addSavedProxy = addSavedProxy;
window.selectProxy = selectProxy;
window.setDirectProxy = setDirectProxy;
window.setSystemProxy = setSystemProxy;
window.deleteSavedProxy = deleteSavedProxy;
window.loadDrawerMemory = loadDrawerMemory;
window.renderDrawerMcp = renderDrawerMcp;
window.loadDrawerProxy = loadDrawerProxy;
window.renderMcpMarket = renderMcpMarket;
window.loadCronTasks = loadCronTasks;
window.installMcpFromMarket = installMcpFromMarket;
window.loadKeybindingsUI = loadKeybindingsUI;
window.rebindKey = rebindKey;
window.saveSmtpSettings = saveSmtpSettings;
window.testSmtpConnection = testSmtpConnection;
window.showWelcomeGuide = showWelcomeGuide;
window.obDomainInput = obDomainInput;
window.obTest = obTest;
window.obNext = obNext;
window.obBack = obBack;
window.obFinish = obFinish;
window.obSkip = obSkip;
window.showAddWorkflow = showAddWorkflow;
window.editWorkflow = editWorkflow;
window.closeWorkflowEditor = closeWorkflowEditor;
window.onWorkflowTriggerChange = onWorkflowTriggerChange;
window.addWorkflowStep = addWorkflowStep;
window.removeWorkflowStep = removeWorkflowStep;
window.onWorkflowStepTypeChange = onWorkflowStepTypeChange;
window.saveWorkflow = saveWorkflow;
window.deleteWorkflow = deleteWorkflow;
window.runWorkflow = runWorkflow;
window.runWorkflowById = runWorkflowById;

// sessions
window.loadSessions = loadSessions;
window.renderSessions = renderSessions;
window.filterSessions = filterSessions;
window.previewSession = previewSession;
window.deleteSessionUI = deleteSessionUI;
window.resumeToChat = resumeToChat;
window.resumeSession = resumeSession;

// ide
window.initMonaco = initMonaco;
window.openFolder = openFolder;
window.refreshFileTree = refreshFileTree;
window.filterFileTree = filterFileTree;
window.openFileInEditor = openFileInEditor;
window.activateTab = activateTab;
window.closeTab = closeTab;
window.saveActiveTab = saveActiveTab;
window.renderEditorTabs = renderEditorTabs;
window.renderIdeChatSessions = renderIdeChatSessions;
window.renderIdeChatMessages = renderIdeChatMessages;
window.copyCodeBlock = copyCodeBlock;
window.applyCodeToEditor = applyCodeToEditor;
window.createFileFromCode = createFileFromCode;
window.sendIdeChat = sendIdeChat;
window.loadAllFiles = loadAllFiles;
window.toggleQuickOpen = toggleQuickOpen;
window.closeQuickOpen = closeQuickOpen;
window.filterQuickOpen = filterQuickOpen;
window.renderQoSelection = renderQoSelection;
window.qoKeyDown = qoKeyDown;
window.qoOpen = qoOpen;
window.toggleIdeChat = toggleIdeChat;
window.toggleIdeTerminal = toggleIdeTerminal;
window.showCommandPalette = showCommandPalette;

// features
window.confirmSkill = confirmSkill;
window.confirmAction = confirmAction;
window.closeConfirm = closeConfirm;
window.execConfirmedSkill = execConfirmedSkill;
window.runSkillInline = runSkillInline;
window.runGit = runGit;
window.loadAgentInfo = loadAgentInfo;
window.loadLaiaiMd = loadLaiaiMd;
window.saveLaiaiMd = saveLaiaiMd;
window.createLaiaiMd = createLaiaiMd;
window.genLaiaiMd = genLaiaiMd;
window.loadPlugins = loadPlugins;
window.filterPlugins = filterPlugins;
window.installPlugin = installPlugin;
window.showAddPlugin = showAddPlugin;
window.editPlugin = editPlugin;
window.closePluginEditor = closePluginEditor;
window.onPluginTypeChange = onPluginTypeChange;
window.savePlugin = savePlugin;
window.deletePlugin = deletePlugin;
window.togglePlugin = togglePlugin;
window.getPluginCommands = getPluginCommands;
window.runTeamsAction = runTeamsAction;
window.loadHooks = loadHooks;
window.showAddHook = showAddHook;
window.closeHookEditor = closeHookEditor;
window.saveHook = saveHook;
window.deleteHook = deleteHook;
window.installHookTemplate = installHookTemplate;
window.showKeybindings = showKeybindings;
window.buddyPet = buddyPet;
window.buddyFeed = buddyFeed;
window.buddyPlay = buddyPlay;
window.buddyChange = buddyChange;
window.updateBuddy = updateBuddy;
window.loadUsage = loadUsage;
window.hideSplash = hideSplash;
window.loadTools = loadTools;
window.renderToolFilters = renderToolFilters;
window.renderTools = renderTools;
window.loadMcp = loadMcp;
window.renderMcp = renderMcp;
window.showAddMcp = showAddMcp;
window.editMcp = editMcp;
window.closeMcp = closeMcp;
window.mcpTypeChanged = mcpTypeChanged;
window.saveMcp = saveMcp;
window.delMcp = delMcp;
window.checkMcpStatus = checkMcpStatus;
window.quickInstallMcp = quickInstallMcp;
window.quickInstallMcpFromDrawer = quickInstallMcpFromDrawer;
window.filterMcpMarket = filterMcpMarket;
window.quickInstallNpm = quickInstallNpm;

// Expose modelFilter and toolFilter as window properties that sync with state
Object.defineProperty(window, 'modelFilter', {
  get() { return state.modelFilter; },
  set(v) { state.modelFilter = v; }
});
Object.defineProperty(window, 'toolFilter', {
  get() { return state.toolFilter; },
  set(v) { state.toolFilter = v; }
});
Object.defineProperty(window, 'qoSelected', {
  get() { return state.qoSelected; },
  set(v) { state.qoSelected = v; }
});

// ═══ TERMINAL DATA LISTENER ═══
setupTerminalDataListener();

// ═══ GLOBAL KEYBOARD SHORTCUTS (dynamic keybindings) ═══
let _keybindings = {
  quickOpen: 'Ctrl+P',
  save: 'Ctrl+S',
  closeTab: 'Ctrl+W',
  toggleTerminal: 'Ctrl+`',
  newChat: 'Ctrl+N',
  toggleSettings: 'Ctrl+,',
};

// Load keybindings on startup
electronAPI.loadKeybindings().then(kb => { if (kb) _keybindings = kb; }).catch(() => {});

function _matchesBinding(e, binding) {
  if (!binding) return false;
  const parts = binding.toLowerCase().split('+');
  const key = parts[parts.length - 1];
  const needCtrl = parts.includes('ctrl');
  const needShift = parts.includes('shift');
  const needAlt = parts.includes('alt');
  const needMeta = parts.includes('meta');
  const hasCtrl = e.ctrlKey || e.metaKey;
  if (needCtrl !== hasCtrl) return false;
  if (needShift !== e.shiftKey) return false;
  if (needAlt !== e.altKey) return false;
  if (needMeta && !e.metaKey) return false;
  return e.key.toLowerCase() === key;
}

// Expose _keybindings for settings UI
Object.defineProperty(window, '_keybindings', {
  get() { return _keybindings; },
  set(v) { _keybindings = v; },
});

document.addEventListener('keydown',(e)=>{
  if(_matchesBinding(e, _keybindings.quickOpen)){
    e.preventDefault();
    if(document.getElementById('page-ide').classList.contains('active')||
       document.querySelector('.page.active')?.id==='page-ide'){
      toggleQuickOpen();
    }
  }
  if(_matchesBinding(e, _keybindings.save)){
    e.preventDefault();
    saveActiveTab();
  }
  if(_matchesBinding(e, _keybindings.closeTab)){
    e.preventDefault();
    if(state.activeTabId)closeTab(state.activeTabId);
  }
  if(_matchesBinding(e, _keybindings.toggleTerminal)){
    e.preventDefault();
    toggleIdeTerminal();
  }
  if(_matchesBinding(e, _keybindings.newChat)){
    e.preventDefault();
    newChat();
  }
  if(_matchesBinding(e, _keybindings.toggleSettings)){
    e.preventDefault();
    openSettings();
  }
  // Command Palette: Ctrl+Shift+P
  if((e.ctrlKey||e.metaKey) && e.shiftKey && (e.key==='p'||e.key==='P'||e.code==='KeyP')){
    e.preventDefault();
    e.stopPropagation();
    showCommandPalette();
    return;
  }
  // Find: Ctrl+F — in IDE mode triggers Monaco find, in Chat mode triggers chat search
  if(e.ctrlKey && !e.shiftKey && !e.altKey && e.key.toLowerCase()==='f'){
    if(state.monacoEditor && document.getElementById('page-ide')?.classList.contains('active')){
      e.preventDefault();
      state.monacoEditor.focus();
      state.monacoEditor.trigger('keyboard', 'actions.find');
    } else if(document.getElementById('page-terminal')?.classList.contains('active')){
      e.preventDefault();
      toggleChatSearch();
    }
  }
});

// ═══ INIT ═══
async function init(){
  try {
    const cfg=await electronAPI.loadConfig().catch(()=>({})) || {};
    // Apply theme/lang without saving back (avoid race condition overwriting proxy settings)
    if(cfg.theme){state.theme=cfg.theme;document.documentElement.dataset.theme=cfg.theme;try{document.getElementById('s-theme').value=cfg.theme;document.getElementById('sd-theme').value=cfg.theme}catch(e){}}
    if(cfg.lang){state.lang=cfg.lang;document.documentElement.dataset.lang=cfg.lang;try{document.getElementById('s-lang').value=cfg.lang;document.getElementById('sd-lang').value=cfg.lang}catch(e){};applyI18n()}

    const pd=await electronAPI.loadProviders().catch(()=>null);
    state.providers=(pd?.providers)||[];
    if(!state.providers.length&&cfg.apiBaseUrl&&cfg.apiKey){
      state.providers.push({id:gid(),name:'Default API',baseUrl:cfg.apiBaseUrl,apiKey:cfg.apiKey,models:cfg.cachedModels||[],defaultModel:cfg.defaultModel||'',isDefault:true});
      await persistProvs().catch(e => console.warn('[init] Failed to persist providers:', e.message));
    }

    try{renderProvs();collectModels();applyI18n()}catch(e){console.error(e)}
    try{loadTools();loadSettings();loadProxySettings();loadWorkflows();loadSmtpSettings()}catch(e){}

    const info=await electronAPI.getAppInfo().catch(()=>({version:'0.0.1',platform:'unknown',hasPty:false}));
    try{
      document.getElementById('ver').textContent='v'+info.version;
      document.getElementById('about-ver').textContent='v'+info.version+' · '+info.platform;
      document.getElementById('sb-platform').textContent=info.platform;
      document.getElementById('sb-pty').textContent=info.hasPty?'PTY':'Spawn';
    }catch(e){}

    if(!cfg.onboardingDone&&!state.providers.length){
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
      if(saved&&saved.length){state.chatSessions=saved;state.activeChatId=state.chatSessions[0].id}
    }catch(e){}
    if(!state.chatSessions.length)newChat();
    try{renderSessionList();renderIdeChatSessions();renderIdeChatMessages();renderChatUI()}catch(e){}
    // Default to Chat mode
    switchMode('chat');
    initImagePaste();
    initDragDrop();

    // Check if Git is installed (required for Agent tools)
    try {
      const gitCheck = await electronAPI.runShell({ cmd: 'git --version' });
      if (!gitCheck.ok) {
        showGitRequiredNotice();
      }
    } catch { showGitRequiredNotice(); }

    // Show welcome guide if user has providers but hasn't seen guide yet
    if (state.providers.length && !cfg.guideSeen) {
      setTimeout(async () => {
        try {
          if (window.showWelcomeGuide) window.showWelcomeGuide();
          const c = await electronAPI.loadConfig() || {};
          c.guideSeen = true;
          await electronAPI.saveConfig(c);
        } catch {}
      }, 1500);
    }

  } catch(e) {
    console.error('[init] Fatal:', e);
    // Show error to user instead of blank screen
    try {
      const body = document.body;
      const errDiv = document.createElement('div');
      errDiv.style.cssText = 'position:fixed;bottom:20px;left:50%;transform:translateX(-50%);background:#EF4444;color:#fff;padding:12px 24px;border-radius:8px;font-size:13px;z-index:99999;max-width:600px;box-shadow:0 4px 20px rgba(0,0,0,0.3)';
      errDiv.textContent = 'Initialization error: ' + (e.message || 'Unknown error');
      body.appendChild(errDiv);
      setTimeout(() => errDiv.remove(), 10000);
    } catch {}
  }
  // ALWAYS hide splash
  hideSplash();
}

init();

// ═══ GIT REQUIRED NOTICE ═══
function showGitRequiredNotice() {
  // Detect platform for correct download link
  const platform = navigator.platform?.toLowerCase() || '';
  let downloadUrl = 'https://git-scm.com/downloads';
  if (platform.includes('win')) downloadUrl = 'https://git-scm.com/downloads/win';
  else if (platform.includes('mac')) downloadUrl = 'https://git-scm.com/downloads/mac';
  else if (platform.includes('linux')) downloadUrl = 'https://git-scm.com/downloads/linux';

  // Platform-specific install hint
  let installHint = '';
  if (platform.includes('mac')) installHint = '\n\n' + t('git.mac_hint');
  else if (platform.includes('linux')) installHint = '\n\n' + t('git.linux_hint');

  const notice = document.createElement('div');
  notice.className = 'git-notice';
  notice.innerHTML =
    '<div class="git-notice-inner">' +
    '<div class="git-notice-header">' + t('git.required_title') + '</div>' +
    '<div class="git-notice-body">' + t('git.required_body') + installHint + '</div>' +
    '<div class="git-notice-actions">' +
    '<button class="btn btn-p btn-sm" onclick="window.open(\'' + downloadUrl + '\');this.closest(\'.git-notice\').remove()">' + t('git.download') + '</button>' +
    '<button class="btn btn-s btn-sm" onclick="this.closest(\'.git-notice\').remove()">' + t('git.later') + '</button>' +
    '</div></div>';
  document.body.appendChild(notice);
}

// ═══ AUTO UPDATE UI ═══
window.checkForUpdateManual = async function() {
  const btn = document.getElementById('btn-check-update');
  const status = document.getElementById('update-status');
  if (btn) { btn.disabled = true; btn.textContent = t('update.checking'); }
  try {
    await electronAPI.checkForUpdates();
    // Wait a bit for the update-available or update-not-available event
    setTimeout(() => {
      if (btn && btn.disabled) {
        btn.disabled = false;
        btn.textContent = t('update.check');
        if (status) status.textContent = t('update.up_to_date');
        setTimeout(() => { if (status) status.textContent = ''; }, 5000);
      }
    }, 8000);
  } catch {
    if (btn) { btn.disabled = false; btn.textContent = t('update.check'); }
    if (status) status.textContent = t('update.check_failed');
  }
};

if (electronAPI.onUpdateAvailable) {
  electronAPI.onUpdateAvailable((data) => {
    // Update about page status
    const btn = document.getElementById('btn-check-update');
    const status = document.getElementById('update-status');
    if (btn) { btn.disabled = false; btn.textContent = t('update.download'); btn.onclick = () => { electronAPI.downloadUpdate(); btn.textContent = t('update.downloading'); btn.disabled = true; }; }
    if (status) status.textContent = t('update.available').replace('{v}', data.version);

    // Also show bottom bar notification
    if (!document.querySelector('.update-bar')) {
      const bar = document.createElement('div');
      bar.className = 'update-bar';
      bar.innerHTML =
        '<span>' + t('update.available').replace('{v}', data.version) + '</span>' +
        '<button class="btn btn-p btn-sm" onclick="electronAPI.downloadUpdate();this.textContent=\'' + t('update.downloading') + '\';this.disabled=true">' + t('update.download') + '</button>' +
        '<button class="btn btn-xs" onclick="this.closest(\'.update-bar\').remove()">✕</button>';
      document.body.appendChild(bar);
    }
  });

  electronAPI.onUpdateProgress((data) => {
    const bar = document.querySelector('.update-bar span');
    if (bar) bar.textContent = t('update.downloading') + ' ' + data.percent + '%';
  });

  electronAPI.onUpdateDownloaded((data) => {
    const existing = document.querySelector('.update-bar');
    if (existing) existing.remove();
    const bar = document.createElement('div');
    bar.className = 'update-bar';
    bar.innerHTML =
      '<span>' + t('update.ready').replace('{v}', data.version) + '</span>' +
      '<button class="btn btn-p btn-sm" onclick="electronAPI.installUpdate()">' + t('update.install') + '</button>' +
      '<button class="btn btn-xs" onclick="this.closest(\'.update-bar\').remove()">✕</button>';
    document.body.appendChild(bar);
  });
}
