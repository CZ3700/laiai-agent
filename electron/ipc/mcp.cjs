// ─── LaiaiAgent IPC: MCP Server Handlers ─────────────────────────────────
const path = require('path');

function register(ctx) {
  const { ipcMain, PROJECT_ROOT, getLaiaiConfigDir, loadJSON, saveJSON } = ctx;

  ipcMain.handle('load-mcp-config', () => {
    const configDir = getLaiaiConfigDir();
    const userMcp = loadJSON(path.join(configDir, 'settings.json'), {});
    const mcpServers = (userMcp && userMcp.mcpServers) || {};
    const projectMcpPath = path.join(PROJECT_ROOT, '.laiai', 'mcp.json');
    const projectMcp = loadJSON(projectMcpPath, {});
    const projectServers = (projectMcp && projectMcp.mcpServers) || {};
    return {
      userServers: Object.entries(mcpServers).map(([name, cfg]) => ({ name, ...cfg, scope: 'user' })),
      projectServers: Object.entries(projectServers).map(([name, cfg]) => ({ name, ...cfg, scope: 'project' })),
    };
  });

  ipcMain.handle('save-mcp-server', (_e, { name, config, scope }) => {
    const configDir = getLaiaiConfigDir();
    if (scope === 'project') {
      const mcpPath = path.join(PROJECT_ROOT, '.laiai', 'mcp.json');
      const data = loadJSON(mcpPath, {});
      if (!data.mcpServers) data.mcpServers = {};
      data.mcpServers[name] = config;
      saveJSON(mcpPath, data);
    } else {
      const settingsPath = path.join(configDir, 'settings.json');
      const data = loadJSON(settingsPath, {});
      if (!data.mcpServers) data.mcpServers = {};
      data.mcpServers[name] = config;
      saveJSON(settingsPath, data);
    }
    return { ok: true };
  });

  // ── MCP Server Status Check ──
  ipcMain.handle('mcp-server-status', async (_e, { name, type, command, url }) => {
    try {
      if (type === 'stdio') {
        // Check if the command binary exists
        const { execSync } = require('child_process');
        const cmd = (command || '').split(/\s+/)[0]; // First word is the binary
        if (!cmd) return { ok: false, status: 'error', detail: 'No command specified' };
        try {
          const whichCmd = process.platform === 'win32' ? 'where' : 'which';
          execSync(whichCmd + ' ' + cmd, { encoding: 'utf-8', timeout: 5000, windowsHide: true });
          return { ok: true, status: 'running', detail: 'Command "' + cmd + '" found on PATH' };
        } catch {
          return { ok: false, status: 'stopped', detail: 'Command "' + cmd + '" not found on PATH' };
        }
      } else if (type === 'http' || type === 'sse') {
        // Try an HTTP GET request to check reachability
        if (!url) return { ok: false, status: 'error', detail: 'No URL specified' };
        const { net } = require('electron');
        return new Promise((resolve) => {
          try {
            const req = net.request({ url, method: 'GET' });
            const timer = setTimeout(() => {
              req.abort();
              resolve({ ok: false, status: 'stopped', detail: 'Connection timed out' });
            }, 8000);
            req.on('response', (response) => {
              clearTimeout(timer);
              let body = '';
              response.on('data', (chunk) => { body += chunk.toString(); });
              response.on('end', () => {
                if (response.statusCode < 500) {
                  resolve({ ok: true, status: 'running', detail: 'HTTP ' + response.statusCode });
                } else {
                  resolve({ ok: false, status: 'error', detail: 'HTTP ' + response.statusCode });
                }
              });
            });
            req.on('error', (err) => {
              clearTimeout(timer);
              resolve({ ok: false, status: 'stopped', detail: err.message || 'Connection failed' });
            });
            req.end();
          } catch (e) {
            resolve({ ok: false, status: 'error', detail: e.message });
          }
        });
      }
      return { ok: false, status: 'error', detail: 'Unknown server type: ' + type };
    } catch (e) {
      return { ok: false, status: 'error', detail: e.message };
    }
  });

  ipcMain.handle('delete-mcp-server', (_e, { name, scope }) => {
    const configDir = getLaiaiConfigDir();
    if (scope === 'project') {
      const mcpPath = path.join(PROJECT_ROOT, '.laiai', 'mcp.json');
      const data = loadJSON(mcpPath, {});
      if (data.mcpServers) { delete data.mcpServers[name]; saveJSON(mcpPath, data); }
    } else {
      const settingsPath = path.join(configDir, 'settings.json');
      const data = loadJSON(settingsPath, {});
      if (data.mcpServers) { delete data.mcpServers[name]; saveJSON(settingsPath, data); }
    }
    return { ok: true };
  });
}

module.exports = { register };
