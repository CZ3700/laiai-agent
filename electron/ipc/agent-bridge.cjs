// ─── LaiaiAgent IPC: Agent Bridge ─────────────────────────────────────────
// Bridges the CLI Agent engine (dist/cli.js) to the Electron renderer via IPC.
//
// Architecture:
//   Renderer (Chat UI)
//       ↕ IPC (agent-send, agent-message, agent-status)
//   Main Process (this file)
//       ↕ stdio NDJSON
//   CLI Agent subprocess (dist/cli.js -p --output-format stream-json ...)
//
// The Agent subprocess runs in stream-json mode:
//   stdin:  NDJSON lines (user messages)
//   stdout: NDJSON lines (assistant messages, tool calls, results, etc.)
//   stderr: debug/error output (forwarded to main process log)

const { spawn } = require('child_process');
const path = require('path');
const os = require('os');
const fs = require('fs');
const readline = require('readline');

let agentProcess = null;
let agentSessionId = null;

function register(ctx) {
  const { ipcMain, app, getMainWindow, findProjectRoot, getCliPath,
          loadUserConfig, getLaiaiConfigDir, _log } = ctx;

  // ═══ Spawn Agent subprocess ═══
  function spawnAgent(opts = {}) {
    killAgent();

    const projectRoot = findProjectRoot();
    const cliPath = getCliPath();
    if (!fs.existsSync(cliPath)) {
      _log('[agent-bridge] cli.js not found at: ' + cliPath);
      return { ok: false, error: 'Agent CLI not found: ' + cliPath };
    }

    // Find Node.js binary — use bundled runtime in packaged mode
    let nodeBin;
    if (app.isPackaged) {
      // Use bundled Node.js runtime (no system dependency)
      const bundledNode = path.join(process.resourcesPath, 'dist', 'node-runtime' + (process.platform === 'win32' ? '.exe' : ''));
      if (fs.existsSync(bundledNode)) {
        nodeBin = bundledNode;
      } else {
        // Fallback to system node
        nodeBin = 'node';
      }
    } else {
      nodeBin = process.execPath;
    }

    // Build environment
    const userCfg = loadUserConfig();
    const laiaiConfigDir = getLaiaiConfigDir();
    if (!fs.existsSync(laiaiConfigDir)) fs.mkdirSync(laiaiConfigDir, { recursive: true });

    const env = Object.assign({}, process.env, {
      CLAUDE_CONFIG_DIR: laiaiConfigDir,
      DISABLE_INSTALLATION_CHECKS: '1',
      DISABLE_AUTOUPDATER: '1',
      CLAUDE_CODE_ENTRYPOINT: 'claude-desktop',
    });

    // cli-final.cjs is fully self-contained — no external deps needed

    // Set API credentials from provider
    if (opts.provider) {
      if (opts.provider.baseUrl) env.CUSTOM_API_BASE_URL = opts.provider.baseUrl;
      if (opts.provider.apiKey) env.CUSTOM_API_KEY = opts.provider.apiKey;
      if (opts.provider.defaultModel) env.ANTHROPIC_MODEL = opts.provider.defaultModel;
    }

    // Proxy — read from proxy-list.json (new system)
    const proxyListPath = require('path').join(app.getPath('userData'), 'proxy-list.json');
    try {
      const proxyList = JSON.parse(require('fs').readFileSync(proxyListPath, 'utf-8'));
      const activeProxy = proxyList.find(p => p.isActive);
      if (activeProxy && activeProxy.url) {
        env.HTTP_PROXY = activeProxy.url;
        env.HTTPS_PROXY = activeProxy.url;
        env.http_proxy = activeProxy.url;
        env.https_proxy = activeProxy.url;
        // Log proxy without credentials
        try {
          const pu = new URL(activeProxy.url);
          _log('[agent-bridge] Proxy env set: ' + pu.protocol + '//' + pu.host);
        } catch { _log('[agent-bridge] Proxy env set'); }
      }
    } catch {}
    // Legacy fallback
    if (!env.HTTP_PROXY && userCfg.proxyMode && userCfg.proxyMode !== 'none' && userCfg.proxyUrl) {
      const raw = userCfg.proxyUrl;
      const proxyUrl = raw.match(/^(https?|socks5):\/\//) ? raw
        : (userCfg.proxyMode === 'socks5' ? 'socks5://' : 'http://') + raw;
      env.HTTP_PROXY = proxyUrl;
      env.HTTPS_PROXY = proxyUrl;
      env.http_proxy = proxyUrl;
      env.https_proxy = proxyUrl;
    }

    // Build MCP config file for --mcp-config flag
    let mcpConfigPath = null;
    try {
      const mcpServerPath = require('path').join(__dirname, '..', 'mcp-servers', 'image-gen.cjs');
      if (require('fs').existsSync(mcpServerPath)) {
        const mcpConfig = {
          mcpServers: {
            'laiai-image-gen': {
              command: 'node',
              args: [mcpServerPath],
              env: {
                IMAGE_API_BASE_URL: opts.provider?.baseUrl || env.CUSTOM_API_BASE_URL || '',
                IMAGE_API_KEY: opts.provider?.apiKey || env.CUSTOM_API_KEY || '',
                IMAGE_MODEL: 'google/gemini-2.5-flash-image',
                // No proxy for MCP image server — direct connection is 6x faster
                NODE_PATH: require('path').join(__dirname, '..', '..', 'node_modules'),
              },
            },
          },
        };
        mcpConfigPath = require('path').join(laiaiConfigDir, 'mcp-config.json');
        require('fs').writeFileSync(mcpConfigPath, JSON.stringify(mcpConfig));
        _log('[agent-bridge] MCP config written to: ' + mcpConfigPath);
      }
    } catch (e) {
      _log('[agent-bridge] MCP config error: ' + e.message);
    }

    // CLI arguments
    const args = [
      cliPath,
      '-p',                           // Non-interactive (print) mode
      '--output-format', 'stream-json', // NDJSON output
      '--input-format', 'stream-json',  // NDJSON input
      '--verbose',                      // Required for stream-json
      '--dangerously-skip-permissions', // GUI handles permissions
      '--replay-user-messages',         // Echo user messages back for acknowledgment
    ];

    // Add MCP config if available
    if (mcpConfigPath) {
      args.push('--mcp-config', mcpConfigPath);
    }


    // Optional: resume session
    if (opts.sessionId) {
      args.push('--resume', opts.sessionId);
    }

    // Optional: continue latest session
    if (opts.continueSession) {
      args.push('--continue');
    }

    // Working directory — must be a real path, not inside asar
    let cwd = opts.cwd || projectRoot;
    // If CWD is inside an asar archive, use user's home directory instead
    if (cwd.includes('.asar')) {
      cwd = require('os').homedir();
    }

    _log('[agent-bridge] Spawning: ' + nodeBin + ' ' + args.join(' '));
    _log('[agent-bridge] CWD: ' + cwd);
    _log('[agent-bridge] ELECTRON_RUN_AS_NODE: ' + (env.ELECTRON_RUN_AS_NODE || 'no'));

    agentProcess = spawn(nodeBin, args, {
      cwd,
      env,
      stdio: ['pipe', 'pipe', 'pipe'],
      windowsHide: true,
    });

    agentSessionId = opts.sessionId || 'agent_' + Date.now().toString(36);

    // ── stdout: NDJSON messages from Agent ──
    const rl = readline.createInterface({ input: agentProcess.stdout });
    rl.on('line', (line) => {
      if (!line.trim()) return;
      // Limit line size to prevent memory exhaustion (10MB max per message)
      if (line.length > 10 * 1024 * 1024) { _log('[agent-bridge] Dropped oversized line: ' + line.length + ' bytes'); return; }
      try {
        const msg = JSON.parse(line);
        const win = getMainWindow();
        if (win && !win.isDestroyed()) {
          _log('[agent-msg] type=' + msg.type + (msg.subtype ? ' sub=' + msg.subtype : '') + ' keys=' + Object.keys(msg).join(','));
          if (msg.type === 'assistant' && msg.message?.content) {
            const blocks = msg.message.content;
            _log('[agent-msg]   content blocks: ' + blocks.map(b => b.type + (b.name ? ':' + b.name : '')).join(', '));
          }
          if (msg.type === 'user' && Array.isArray(msg.message?.content)) {
            const blocks = msg.message.content;
            _log('[agent-msg]   user content: ' + blocks.map(b => b.type + (b.tool_use_id ? ':' + b.tool_use_id : '')).join(', '));
          }
          win.webContents.send('agent-message', msg);
        }
      } catch (e) {
        _log('[agent-bridge] Non-JSON stdout: ' + line.substring(0, 200));
      }
    });

    // ── stderr: debug/error output ──
    const stderrRL = readline.createInterface({ input: agentProcess.stderr });
    stderrRL.on('line', (line) => {
      _log('[agent-bridge:stderr] ' + line.substring(0, 500));
    });

    // ── Process exit ──
    agentProcess.on('exit', (code, signal) => {
      _log('[agent-bridge] Agent exited: code=' + code + ' signal=' + signal);
      const win = getMainWindow();
      if (win && !win.isDestroyed()) {
        win.webContents.send('agent-status', {
          type: 'exited',
          code,
          signal,
          sessionId: agentSessionId,
        });
      }
      agentProcess = null;
    });

    agentProcess.on('error', (err) => {
      _log('[agent-bridge] Agent spawn error: ' + err.message);
      const win = getMainWindow();
      if (win && !win.isDestroyed()) {
        win.webContents.send('agent-status', {
          type: 'error',
          error: err.message,
        });
      }
      agentProcess = null;
    });

    return { ok: true, sessionId: agentSessionId };
  }

  // ═══ Send message to Agent ═══
  function sendToAgent(content) {
    if (!agentProcess || !agentProcess.stdin.writable) {
      return { ok: false, error: 'Agent not running' };
    }

    // Format: NDJSON user message
    const msg = {
      type: 'user',
      session_id: agentSessionId || '',
      message: { role: 'user', content },
      parent_tool_use_id: null,
    };

    try {
      agentProcess.stdin.write(JSON.stringify(msg) + '\n');
      return { ok: true };
    } catch (e) {
      return { ok: false, error: e.message };
    }
  }

  // ═══ Kill Agent ═══
  function killAgent() {
    if (agentProcess) {
      const proc = agentProcess;
      agentProcess = null; // Clear reference first to prevent re-entry
      try {
        // Close stdin first (graceful shutdown)
        proc.stdin.end();
        // Give it 3 seconds to exit, then force kill
        const timer = setTimeout(() => {
          try { if (!proc.killed) proc.kill('SIGKILL'); } catch {}
        }, 3000);
        proc.on('exit', () => clearTimeout(timer));
      } catch {}
    }
  }

  // ═══ IPC Handlers ═══

  // Start a new Agent session
  ipcMain.handle('agent-start', (_e, opts) => {
    return spawnAgent(opts || {});
  });

  // Send a user message to the running Agent
  ipcMain.handle('agent-send', (_e, { content }) => {
    return sendToAgent(content);
  });

  // Stop the Agent
  ipcMain.handle('agent-stop', () => {
    killAgent();
    return { ok: true };
  });

  // Check Agent status
  ipcMain.handle('agent-status', () => {
    return {
      running: !!agentProcess,
      sessionId: agentSessionId,
    };
  });

  // Respond to a permission request from Agent
  ipcMain.handle('agent-permission-response', (_e, { requestId, response }) => {
    if (!agentProcess || !agentProcess.stdin.writable) {
      return { ok: false, error: 'Agent not running' };
    }
    const msg = {
      type: 'control_response',
      response: {
        request_id: requestId,
        ...response,
      },
    };
    try {
      agentProcess.stdin.write(JSON.stringify(msg) + '\n');
      return { ok: true };
    } catch (e) {
      return { ok: false, error: e.message };
    }
  });
}

module.exports = { register };
