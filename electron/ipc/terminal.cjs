// ─── LaiaiAgent IPC: Terminal / PTY Handlers ─────────────────────────────
const path = require('path');
const os = require('os');
const fs = require('fs');
const { buildProxyUrl } = require('./proxy.cjs');

function register(ctx) {
  const { ipcMain, app, getMainWindow, findProjectRoot, getCliPath,
          getModelsConfigPath, loadUserConfig, pty,
          ptyProcess: ptyRef, _log } = ctx;

  function killPty() {
    const proc = ptyRef.get();
    if (proc) {
      try { proc.kill(); } catch {}
      ptyRef.set(null);
    }
  }

  function spawnTerminal(provider, opts) {
    killPty();
    const projectRoot = findProjectRoot();
    const cliPath = fs.existsSync(path.join(projectRoot, 'dist', 'cli.js'))
      ? path.join(projectRoot, 'dist', 'cli.js')
      : getCliPath();
    const nodePath = path.join(projectRoot, 'node_modules');
    const modelsPath = getModelsConfigPath();
    const isWin = os.platform() === 'win32';
    const shell = isWin ? 'cmd.exe' : (process.env.SHELL || '/bin/bash');

    // Build environment
    const laiaiConfigDir = path.join(app.getPath('userData'), 'laiai-data');
    if (!fs.existsSync(laiaiConfigDir)) fs.mkdirSync(laiaiConfigDir, { recursive: true });

    // Pre-create config inside LaiaiAgent's own directory to skip onboarding/trust
    const laiaiGlobalCfg = path.join(laiaiConfigDir, '.claude.json');
    try {
      let cfg = {};
      try { cfg = JSON.parse(fs.readFileSync(laiaiGlobalCfg, 'utf-8')); } catch {}
      if (!cfg.hasCompletedOnboarding || !cfg.hasTrustDialogAccepted) {
        cfg.hasCompletedOnboarding = true;
        cfg.hasTrustDialogAccepted = true;
        fs.writeFileSync(laiaiGlobalCfg, JSON.stringify(cfg, null, 2));
      }
    } catch {}
    // Also set HOME-level config so CLI doesn't prompt
    try {
      const homeConfig = path.join(os.homedir(), '.claude.json');
      let hcfg = {};
      try { hcfg = JSON.parse(fs.readFileSync(homeConfig, 'utf-8')); } catch {}
      if (!hcfg.hasCompletedOnboarding || !hcfg.hasTrustDialogAccepted) {
        hcfg.hasCompletedOnboarding = true;
        hcfg.hasTrustDialogAccepted = true;
        fs.writeFileSync(homeConfig, JSON.stringify(hcfg, null, 2));
      }
    } catch {}

    // Apply proxy settings — read from proxy-list.json (new system)
    const proxyEnv = {};
    const proxyListFile = require('path').join(app.getPath('userData'), 'proxy-list.json');
    let proxyApplied = false;
    try {
      const proxyList = JSON.parse(require('fs').readFileSync(proxyListFile, 'utf-8'));
      const activeProxy = proxyList.find(p => p.isActive);
      if (activeProxy && activeProxy.url) {
        proxyEnv.HTTP_PROXY = activeProxy.url;
        proxyEnv.HTTPS_PROXY = activeProxy.url;
        proxyEnv.http_proxy = activeProxy.url;
        proxyEnv.https_proxy = activeProxy.url;
        proxyApplied = true;
      }
    } catch {}
    // Legacy fallback from user-config.json
    if (!proxyApplied) {
      const userCfg = loadUserConfig();
      if (userCfg.proxyMode && userCfg.proxyMode !== 'none' && userCfg.proxyUrl) {
        const proxyUrl = buildProxyUrl(userCfg);
        proxyEnv.HTTP_PROXY = proxyUrl;
        proxyEnv.HTTPS_PROXY = proxyUrl;
        proxyEnv.http_proxy = proxyUrl;
        proxyEnv.https_proxy = proxyUrl;
      }
    }

    const env = Object.assign({}, process.env, proxyEnv, {
      NODE_PATH: nodePath,
      LAIAI_MODELS_CONFIG: modelsPath,
      CLAUDE_CONFIG_DIR: laiaiConfigDir,
      DISABLE_INSTALLATION_CHECKS: '1',
      DISABLE_AUTOUPDATER: '1',
    });
    if (provider) {
      if (provider.baseUrl) env.CUSTOM_API_BASE_URL = provider.baseUrl;
      if (provider.apiKey) env.CUSTOM_API_KEY = provider.apiKey;
      if (provider.defaultModel) env.ANTHROPIC_MODEL = provider.defaultModel;
    }

    const cols = opts?.cols || 120;
    const rows = opts?.rows || 30;

    // Find system node binary
    let nodeBin = 'node';
    if (!app.isPackaged) {
      nodeBin = process.execPath;
    } else {
      const { execSync } = require('child_process');
      try {
        nodeBin = execSync('where node', { encoding: 'utf-8' }).split('\n')[0].trim();
      } catch {
        nodeBin = 'node';
      }
    }

    if (pty) {
      const proc = pty.spawn(nodeBin, [cliPath], {
        name: 'xterm-256color',
        cols, rows,
        cwd: projectRoot,
        env,
      });
      ptyRef.set(proc);
      proc.onData((data) => {
        const w = getMainWindow();
        if (w && !w.isDestroyed()) w.webContents.send('terminal-data', data);
      });
      proc.onExit(({ exitCode }) => {
        const w = getMainWindow();
        if (w && !w.isDestroyed()) w.webContents.send('terminal-exit', exitCode);
        ptyRef.set(null);
      });
      return { ok: true, mode: 'pty' };
    } else {
      const { spawn } = require('child_process');
      const proc = spawn(nodeBin, [cliPath], {
        cwd: projectRoot,
        env,
        stdio: ['pipe', 'pipe', 'pipe'],
      });
      ptyRef.set(proc);
      proc.stdout.on('data', (data) => {
        const w = getMainWindow();
        if (w && !w.isDestroyed()) w.webContents.send('terminal-data', data.toString());
      });
      proc.stderr.on('data', (data) => {
        const w = getMainWindow();
        if (w && !w.isDestroyed()) w.webContents.send('terminal-data', data.toString());
      });
      proc.on('exit', (code) => {
        const w = getMainWindow();
        if (w && !w.isDestroyed()) w.webContents.send('terminal-exit', code);
        ptyRef.set(null);
      });
      return { ok: true, mode: 'spawn' };
    }
  }

  // ── IPC registrations ──
  ipcMain.handle('terminal-spawn', (_e, opts) => {
    return spawnTerminal(opts?.provider || null, opts);
  });

  ipcMain.on('terminal-input', (_e, data) => {
    const proc = ptyRef.get();
    if (proc) {
      if (pty && proc.write) {
        proc.write(data);
      } else if (proc.stdin) {
        proc.stdin.write(data);
      }
    }
  });

  ipcMain.on('terminal-resize', (_e, { cols, rows }) => {
    const proc = ptyRef.get();
    if (proc && pty && proc.resize) {
      try { proc.resize(cols, rows); } catch {}
    }
  });

  ipcMain.handle('terminal-kill', () => { killPty(); return { ok: true }; });

  // ── Legacy: launch external terminal ──
  ipcMain.handle('launch-terminal', (_e, _opts) => {
    const cfg = loadUserConfig();
    const provider = {
      baseUrl: cfg.apiBaseUrl || '',
      apiKey: cfg.apiKey || '',
      defaultModel: cfg.defaultModel || '',
    };
    return spawnTerminal(provider);
  });
}

module.exports = { register };
