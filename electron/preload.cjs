const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('electronAPI', {
  // ── Chat API ──
  chatSend:         (opts) => ipcRenderer.invoke('chat-send', opts),
  chatStreamStart:  (opts) => ipcRenderer.invoke('chat-stream-start', opts),
  onChatStreamChunk:(cb)   => ipcRenderer.on('chat-stream-chunk', (_e, d) => cb(d)),
  onChatStreamDone: (cb)   => ipcRenderer.on('chat-stream-done', (_e, r) => cb(r)),
  onChatStreamError:(cb)   => ipcRenderer.on('chat-stream-error', (_e, e) => cb(e)),
  offChatStream:    ()     => { ipcRenderer.removeAllListeners('chat-stream-chunk'); ipcRenderer.removeAllListeners('chat-stream-done'); ipcRenderer.removeAllListeners('chat-stream-error'); },

  // ── Image Generation ──
  imageGenerate:    (opts) => ipcRenderer.invoke('image-generate', opts),

  // ── TTS ──
  ttsGenerate:      (opts) => ipcRenderer.invoke('tts-generate', opts),

  // ── STT (Speech to Text) ──
  sttTranscribe:    (opts) => ipcRenderer.invoke('stt-transcribe', opts),

  // ── Email (SMTP) ──
  sendEmail:        (opts) => ipcRenderer.invoke('send-email', opts),
  loadSmtpConfig:   ()     => ipcRenderer.invoke('load-smtp-config'),
  saveSmtpConfig:   (cfg)  => ipcRenderer.invoke('save-smtp-config', cfg),

  // ── Config ──
  saveConfig:       (cfg)  => ipcRenderer.invoke('save-config', cfg),
  loadConfig:       ()     => ipcRenderer.invoke('load-config'),
  loadModels:       ()     => ipcRenderer.invoke('load-models'),
  getAppInfo:       ()     => ipcRenderer.invoke('get-app-info'),
  openFile:         (p)    => ipcRenderer.invoke('open-file', p),

  // ── Provider Management ──
  loadProviders:    ()     => ipcRenderer.invoke('load-providers'),
  saveProviders:    (data) => ipcRenderer.invoke('save-providers', data),
  testProvider:     (opts) => ipcRenderer.invoke('test-provider', opts),

  // ── Embedded Terminal ──
  terminalSpawn:    (opts) => ipcRenderer.invoke('terminal-spawn', opts),
  terminalInput:    (data) => ipcRenderer.send('terminal-input', data),
  terminalResize:   (size) => ipcRenderer.send('terminal-resize', size),
  terminalKill:     ()     => ipcRenderer.invoke('terminal-kill'),
  onTerminalData:   (cb)   => ipcRenderer.on('terminal-data', (_e, data) => cb(data)),
  onTerminalExit:   (cb)   => ipcRenderer.on('terminal-exit', (_e, code) => cb(code)),
  offTerminalData:  ()     => ipcRenderer.removeAllListeners('terminal-data'),
  offTerminalExit:  ()     => ipcRenderer.removeAllListeners('terminal-exit'),

  // ── Sessions ──
  listSessions:     (opts) => ipcRenderer.invoke('list-sessions', opts),
  deleteSession:    (opts) => ipcRenderer.invoke('delete-session', opts),
  previewSession:   (opts) => ipcRenderer.invoke('preview-session', opts),

  // ── Tools ──
  listTools:        ()     => ipcRenderer.invoke('list-tools'),

  // ── CLI Settings ──
  loadCliSettings:  ()     => ipcRenderer.invoke('load-cli-settings'),
  saveCliSettings:  (s)    => ipcRenderer.invoke('save-cli-settings', s),

  // ── MCP Servers ──
  loadMcpConfig:    ()     => ipcRenderer.invoke('load-mcp-config'),
  saveMcpServer:    (opts) => ipcRenderer.invoke('save-mcp-server', opts),
  deleteMcpServer:  (opts) => ipcRenderer.invoke('delete-mcp-server', opts),
  mcpServerStatus:  (opts) => ipcRenderer.invoke('mcp-server-status', opts),

  // ── Usage Stats ──
  loadUsageStats:   ()     => ipcRenderer.invoke('load-usage-stats'),

  // ── Proxy ──
  testProxy:        (opts) => ipcRenderer.invoke('test-proxy', opts),
  checkProxyIp:     ()     => ipcRenderer.invoke('check-proxy-ip'),
  applyProxyNow:    ()     => ipcRenderer.invoke('apply-proxy-now'),
  loadProxyList:    ()     => ipcRenderer.invoke('load-proxy-list'),
  saveProxyList:    (list) => ipcRenderer.invoke('save-proxy-list', list),
  applyProxy:       (opts) => ipcRenderer.invoke('apply-proxy', opts),

  // ── Direct Operations ──
  openFolderDialog: ()     => ipcRenderer.invoke('open-folder-dialog'),
  listDirectory:    (opts) => ipcRenderer.invoke('list-directory', opts),
  runShell:         (opts) => ipcRenderer.invoke('run-shell', opts),
  listProjectFiles: (opts) => ipcRenderer.invoke('list-project-files', opts),
  readFile:         (opts) => ipcRenderer.invoke('read-file', opts),
  writeFile:        (opts) => ipcRenderer.invoke('write-file', opts),
  loadLaiaiMd:      ()     => ipcRenderer.invoke('load-laiai-md'),
  saveLaiaiMd:      (opts) => ipcRenderer.invoke('save-laiai-md', opts),
  loadHooks:        ()     => ipcRenderer.invoke('load-hooks'),
  saveHooks:        (h)    => ipcRenderer.invoke('save-hooks', h),

  // ── Chat Sessions (persist to disk) ──
  loadChatSessions: () => ipcRenderer.invoke('load-chat-sessions'),
  saveChatSessions: (s) => ipcRenderer.invoke('save-chat-sessions', s),

  // ── Scheduled Tasks ──
  listCronTasks:    ()     => ipcRenderer.invoke('list-cron-tasks'),

  // ── Image Gallery ──
  listGalleryImages: () => ipcRenderer.invoke('list-gallery-images'),
  deleteGalleryImage: (opts) => ipcRenderer.invoke('delete-gallery-image', opts),

  // ── Session Export ──
  exportSession:    (opts) => ipcRenderer.invoke('export-session', opts),

  // ── NPM Registry Search ──
  npmSearch:         (opts) => ipcRenderer.invoke('npm-search', opts),

  // ── Automation ──
  getWebhookInfo:    ()     => ipcRenderer.invoke('get-webhook-info'),
  restartAutomation: ()     => ipcRenderer.invoke('restart-automation'),
  onAutomationRun:   (cb)   => ipcRenderer.on('automation-run-workflow', (_e, data) => cb(data)),

  // ── Document & PPT Generation ──
  generatePpt:      (opts) => ipcRenderer.invoke('generate-ppt', opts),
  generateDoc:      (opts) => ipcRenderer.invoke('generate-doc', opts),

  // ── Keybindings ──
  loadKeybindings:  ()     => ipcRenderer.invoke('load-keybindings'),
  saveKeybindings:  (b)    => ipcRenderer.invoke('save-keybindings', b),

  // ── Agent Bridge ──
  agentStart:       (opts) => ipcRenderer.invoke('agent-start', opts),
  agentSend:        (opts) => ipcRenderer.invoke('agent-send', opts),
  agentStop:        ()     => ipcRenderer.invoke('agent-stop'),
  agentStatus:      ()     => ipcRenderer.invoke('agent-status'),
  agentPermission:  (opts) => ipcRenderer.invoke('agent-permission-response', opts),
  onAgentMessage:   (cb)   => ipcRenderer.on('agent-message', (_e, msg) => cb(msg)),
  onAgentStatus:    (cb)   => ipcRenderer.on('agent-status', (_e, st) => cb(st)),
  offAgent:         ()     => { ipcRenderer.removeAllListeners('agent-message'); ipcRenderer.removeAllListeners('agent-status'); },

  // ── Auto Update ──
  checkForUpdates:  ()     => ipcRenderer.invoke('check-for-updates'),
  downloadUpdate:   ()     => ipcRenderer.invoke('download-update'),
  installUpdate:    ()     => ipcRenderer.invoke('install-update'),
  onUpdateAvailable:(cb)   => ipcRenderer.on('update-available', (_e, d) => cb(d)),
  onUpdateProgress: (cb)   => ipcRenderer.on('update-progress', (_e, d) => cb(d)),
  onUpdateDownloaded:(cb)  => ipcRenderer.on('update-downloaded', (_e, d) => cb(d)),

  // ── Window Controls (frameless) ──
  winMinimize:      ()     => ipcRenderer.send('win-minimize'),
  winMaximize:      ()     => ipcRenderer.send('win-maximize'),
  winClose:         ()     => ipcRenderer.send('win-close'),

  // ── Legacy ──
  fetchRemoteModels: (opts) => ipcRenderer.invoke('fetch-remote-models', opts),
  launchTerminal:    (opts) => ipcRenderer.invoke('launch-terminal', opts),
});
