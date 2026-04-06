// ─── LaiaiAgent Electron Main Process ───────────────────────────────────────
const path = require('path');
const os = require('os');
const fs = require('fs');

// Catch ALL uncaught errors and write to log
const _earlyLog = path.join(os.tmpdir(), 'laiai-crash.log');
process.on('uncaughtException', (err) => {
  try { fs.appendFileSync(_earlyLog, new Date().toISOString() + ' UNCAUGHT: ' + err.stack + '\n'); } catch {}
});
process.on('unhandledRejection', (reason) => {
  try { fs.appendFileSync(_earlyLog, new Date().toISOString() + ' UNHANDLED: ' + String(reason) + '\n'); } catch {}
});

const PROJECT_ROOT = process.env.LAIAI_PROJECT_ROOT || path.join(__dirname, '..');
const nmPath = process.env.LAIAI_NODE_MODULES || path.join(PROJECT_ROOT, 'node_modules');

// Debug log
const _logFile = path.join(os.tmpdir(), 'laiai-electron-debug.log');
function _log(msg) {
  const line = new Date().toISOString() + ' ' + msg + '\n';
  try { fs.appendFileSync(_logFile, line); } catch {}
}
_log('=== LaiaiAgent starting ===');

// Add project node_modules for package resolution
if (module.paths && !module.paths.includes(nmPath)) module.paths.push(nmPath);

let electron;
try {
  electron = require('electron');
  _log('require("electron") type: ' + typeof electron + ', hasApp: ' + !!(electron && electron.app));
} catch (e) {
  _log('require("electron") FAILED: ' + e.message);
  process.exit(1);
}

const { app, BrowserWindow, ipcMain, Tray, Menu, nativeImage } = electron;

let mainWindow = null;
let tray = null;
let ptyProcess = null;

// LaiaiAgent uses its own isolated config dir to avoid conflicts with other tools
function getLaiaiConfigDir() {
  return path.join(app.getPath('userData'), 'laiai-data');
}

// ─── Try load node-pty (graceful fallback) ────────────────────────────────
let pty = null;
try { pty = require('node-pty'); } catch { pty = null; }

// ─── User config ──────────────────────────────────────────────────────────
function getUserConfigPath() {
  return path.join(app.getPath('userData'), 'user-config.json');
}
function getProvidersPath() {
  return path.join(app.getPath('userData'), 'providers.json');
}
function loadJSON(filePath, fallback) {
  try { return JSON.parse(fs.readFileSync(filePath, 'utf-8')); }
  catch { return fallback; }
}
function saveJSON(filePath, data) {
  const dir = path.dirname(filePath);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(filePath, JSON.stringify(data, null, 2));
}
function loadUserConfig() { return loadJSON(getUserConfigPath(), {}); }
function saveUserConfig(cfg) { saveJSON(getUserConfigPath(), cfg); }
function loadProvidersFromDisk() {
  return loadJSON(getProvidersPath(), { providers: [] });
}
function saveProvidersToDisk(data) { saveJSON(getProvidersPath(), data); }

// ─── Resolve paths ────────────────────────────────────────────────────────
function getCliPath() {
  if (app.isPackaged) return path.join(process.resourcesPath, 'dist', 'cli-final.cjs');
  return path.join(PROJECT_ROOT, 'dist', 'cli.js');
}
function getModelsConfigPath() {
  if (app.isPackaged) return path.join(process.resourcesPath, 'config', 'models.json');
  return path.join(PROJECT_ROOT, 'config', 'models.json');
}
function findProjectRoot() {
  const candidates = app.isPackaged ? [
    path.join(process.resourcesPath, '..', '..', '..'),
    path.join(process.resourcesPath, '..', '..'),
    PROJECT_ROOT,
  ] : [PROJECT_ROOT];
  for (const c of candidates) {
    if (fs.existsSync(path.join(c, 'dist', 'cli.js')) &&
        fs.existsSync(path.join(c, 'node_modules'))) return c;
  }
  return PROJECT_ROOT;
}

// ─── Window ───────────────────────────────────────────────────────────────
function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1100, height: 720,
    minWidth: 800, minHeight: 500,
    title: 'LaiaiAgent',
    backgroundColor: '#0B0D14',
    frame: false,
    titleBarStyle: 'hidden',
    webPreferences: {
      preload: path.join(__dirname, 'preload.cjs'),
      nodeIntegration: false,
      contextIsolation: true,
    },
  });
  // Dev: load from Vite dev server; Prod: load built file
  const viteDevUrl = process.env.VITE_DEV_SERVER_URL;
  if (viteDevUrl) {
    mainWindow.loadURL(viteDevUrl);
  } else if (fs.existsSync(path.join(__dirname, 'renderer', 'dist', 'index.html'))) {
    mainWindow.loadFile(path.join(__dirname, 'renderer', 'dist', 'index.html'));
  } else if (fs.existsSync(path.join(__dirname, 'renderer', 'index.html'))) {
    mainWindow.loadFile(path.join(__dirname, 'renderer', 'index.html'));
  } else {
    // Fallback to old monolith (backward compat)
    mainWindow.loadFile(path.join(__dirname, 'index.html'));
  }
  mainWindow.setMenuBarVisibility(false);

  // Enable right-click context menu (copy/paste/cut/select all)
  mainWindow.webContents.on('context-menu', (_e, params) => {
    const { selectionText, isEditable } = params;
    const menuItems = [];
    if (isEditable) {
      menuItems.push(
        { label: 'Cut', role: 'cut', enabled: !!selectionText },
        { label: 'Copy', role: 'copy', enabled: !!selectionText },
        { label: 'Paste', role: 'paste' },
        { type: 'separator' },
        { label: 'Select All', role: 'selectAll' },
      );
    } else if (selectionText) {
      menuItems.push(
        { label: 'Copy', role: 'copy' },
      );
    }
    if (menuItems.length) {
      Menu.buildFromTemplate(menuItems).popup({ window: mainWindow });
    }
  });

  mainWindow.on('closed', () => {
    if (ptyProcess) { try { ptyProcess.kill(); } catch {} ptyProcess = null; }
    mainWindow = null;
  });
}

// ─── System Tray ──────────────────────────────────────────────────────────
function createTray() {
  const iconPath = path.join(__dirname, 'icon.png');
  if (!fs.existsSync(iconPath)) return;
  const icon = nativeImage.createFromPath(iconPath).resize({ width: 16, height: 16 });
  tray = new Tray(icon);
  tray.setToolTip('LaiaiAgent');
  tray.setContextMenu(Menu.buildFromTemplate([
    { label: 'Show LaiaiAgent', click: () => { if (mainWindow) { mainWindow.show(); mainWindow.focus(); } } },
    { type: 'separator' },
    { label: 'Quit', click: () => app.quit() },
  ]));
  tray.on('click', () => { if (mainWindow) { mainWindow.show(); mainWindow.focus(); } });
}

// ─── IPC Registration (modular) ──────────────────────────────────────────
function registerIPC() {
  const ctx = {
    ipcMain,
    electron,
    app,
    getMainWindow: () => mainWindow,
    PROJECT_ROOT,
    getLaiaiConfigDir,
    loadJSON,
    saveJSON,
    loadUserConfig,
    saveUserConfig,
    loadProviders: loadProvidersFromDisk,
    saveProviders: saveProvidersToDisk,
    getUserConfigPath,
    getProvidersPath,
    getCliPath,
    getModelsConfigPath,
    findProjectRoot,
    pty,
    ptyProcess: {
      get: () => ptyProcess,
      set: (v) => { ptyProcess = v; },
    },
    _log,
  };

  const modules = ['chat','terminal','providers','sessions','files','proxy','mcp','window','agent-bridge','automation'];
  for (const m of modules) {
    try {
      _log('Loading IPC module: ' + m);
      require('./ipc/' + m + '.cjs').register(ctx);
      _log('  OK: ' + m);
    } catch (e) {
      _log('  FAIL: ' + m + ' — ' + e.message + '\n' + e.stack);
    }
  }
}

// ─── Lifecycle ────────────────────────────────────────────────────────────
let proxyListPath = '';
function getProxyListPath() {
  if (!proxyListPath) proxyListPath = path.join(app.getPath('userData'), 'proxy-list.json');
  return proxyListPath;
}

async function applyProxyFromList() {
  const { session } = electron;
  let list = [];
  try { list = JSON.parse(fs.readFileSync(getProxyListPath(), 'utf-8')); } catch {}

  // Migrate legacy proxy from user-config.json if proxy-list is empty
  if (!list.length) {
    const cfg = loadUserConfig();
    if (cfg.proxyMode && cfg.proxyMode !== 'none' && cfg.proxyUrl) {
      _log('Migrating legacy proxy: ' + cfg.proxyMode + ' ' + cfg.proxyUrl.substring(0, 30));
      const fullUrl = cfg.proxyUrl.match(/^(https?|socks5):\/\//) ? cfg.proxyUrl : cfg.proxyMode + '://' + cfg.proxyUrl;
      let label = cfg.proxyUrl;
      try { const u = new URL(fullUrl); label = u.hostname + ':' + u.port; if (u.username) label = u.username + '@' + label; } catch {}
      list = [{
        id: 'px_migrated',
        type: cfg.proxyMode,
        url: fullUrl,
        label,
        isActive: true,
      }];
      const dir = path.dirname(getProxyListPath());
      if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
      fs.writeFileSync(getProxyListPath(), JSON.stringify(list, null, 2));
      // Clear legacy fields
      delete cfg.proxyMode;
      delete cfg.proxyUrl;
      saveUserConfig(cfg);
      _log('Migration complete');
    }
  }

  // Apply active proxy
  const active = list.find(p => p.isActive);
  if (active) {
    _log('Applying proxy: ' + active.type + ' ' + active.url.substring(0, 30));
    let proxyUrl = active.url.match(/^(https?|socks5):\/\//) ? active.url : active.type + '://' + active.url;
    // Strip auth credentials from URL (Chromium proxyRules can't contain user:pass)
    // The proxy.cjs module's app.on('login') handler will use global._proxyAuth for authentication
    try {
      const parsed = new URL(proxyUrl);
      if (parsed.username) {
        global._proxyAuth = {
          username: decodeURIComponent(parsed.username),
          password: decodeURIComponent(parsed.password || ''),
        };
        parsed.username = '';
        parsed.password = '';
        proxyUrl = parsed.toString().replace(/\/$/, '');
        _log('Proxy auth configured for user: ' + global._proxyAuth.username.substring(0, 3) + '***');
      }
    } catch {}
    await session.defaultSession.setProxy({ proxyRules: proxyUrl });
  } else {
    await session.defaultSession.setProxy({ mode: 'direct' });
  }
}

app.whenReady().then(async () => {
  try {
    _log('app.whenReady — applying proxy');
    // Apply proxy from proxy-list.json (new system), fallback to user-config.json (legacy)
    await applyProxyFromList();
    _log('proxy applied — registering IPC');
    registerIPC();
    _log('IPC registered — creating window');
    createWindow();
    _log('window created — creating tray');
    createTray();
    setupAutoUpdater();
    _log('startup complete');
  } catch (e) {
    _log('STARTUP ERROR: ' + e.message + '\n' + e.stack);
  }
});

app.on('activate', () => {
  if (BrowserWindow.getAllWindows().length === 0) createWindow();
});

app.on('window-all-closed', () => {
  if (ptyProcess) { try { ptyProcess.kill(); } catch {} ptyProcess = null; }
  app.quit();
});

// ─── Auto Update ─────────────────────────────────────────────────────────────
function setupAutoUpdater() {
  try {
    const { autoUpdater } = require('electron-updater');
    const { dialog } = electron;

    autoUpdater.autoDownload = false;
    autoUpdater.autoInstallOnAppQuit = true;

    autoUpdater.on('update-available', (info) => {
      _log('[updater] Update available: v' + info.version);
      const win = mainWindow;
      if (!win || win.isDestroyed()) return;
      win.webContents.send('update-available', {
        version: info.version,
        releaseNotes: info.releaseNotes || '',
      });
    });

    autoUpdater.on('update-not-available', () => {
      _log('[updater] No update available');
    });

    autoUpdater.on('download-progress', (progress) => {
      const win = mainWindow;
      if (win && !win.isDestroyed()) {
        win.webContents.send('update-progress', {
          percent: Math.round(progress.percent),
          transferred: progress.transferred,
          total: progress.total,
        });
      }
    });

    autoUpdater.on('update-downloaded', (info) => {
      _log('[updater] Update downloaded: v' + info.version);
      const win = mainWindow;
      if (win && !win.isDestroyed()) {
        win.webContents.send('update-downloaded', { version: info.version });
      }
    });

    autoUpdater.on('error', (err) => {
      _log('[updater] Error: ' + err.message);
    });

    // IPC handlers for renderer
    ipcMain.handle('check-for-updates', () => {
      autoUpdater.checkForUpdates().catch(() => {});
      return { ok: true };
    });

    ipcMain.handle('download-update', () => {
      autoUpdater.downloadUpdate().catch(() => {});
      return { ok: true };
    });

    ipcMain.handle('install-update', () => {
      autoUpdater.quitAndInstall(false, true);
      return { ok: true };
    });

    // Auto-check disabled — users check manually from Settings → About
    // To enable: uncomment the lines below after setting up a public release source
    // setTimeout(() => autoUpdater.checkForUpdates().catch(() => {}), 30000);
    // setInterval(() => autoUpdater.checkForUpdates().catch(() => {}), 4 * 60 * 60 * 1000);

    _log('[updater] Auto-updater initialized');
  } catch (e) {
    _log('[updater] Failed to initialize: ' + e.message);
  }
}
