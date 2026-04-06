// ─── LaiaiAgent IPC: Provider / Config / Model Handlers ──────────────────
const path = require('path');
const os = require('os');
const fs = require('fs');
const { apiRequest } = require('./api.cjs');

function register(ctx) {
  const { ipcMain, electron, app, loadProviders, saveProviders,
          loadUserConfig, saveUserConfig, getUserConfigPath,
          getModelsConfigPath, loadJSON } = ctx;

  ipcMain.handle('load-providers', () => loadProviders());
  ipcMain.handle('save-providers', (_e, data) => { saveProviders(data); return { ok: true }; });

  // ── Test Provider — uses net.request for proxy consistency, checks status codes ──
  ipcMain.handle('test-provider', async (_e, { baseUrl, apiKey }) => {
    if (!baseUrl) return { ok: false, error: 'No URL provided' };
    const provider = { baseUrl, apiKey };
    const r = await apiRequest(electron, provider, '/v1/models', null, {
      method: 'GET',
      timeout: 10000,
    });
    if (!r.ok) return r;
    if (r.status && r.status >= 400) {
      try {
        const json = JSON.parse(r.data);
        return { ok: false, error: (json.error && json.error.message) || `HTTP ${r.status}` };
      } catch {
        return { ok: false, error: `HTTP ${r.status}: ${(r.data || '').substring(0, 200)}` };
      }
    }
    try {
      const json = JSON.parse(r.data);
      const models = (json.data || json.models || []).map(m => ({
        id: typeof m === 'string' ? m : m.id,
        owned_by: m.owned_by || '',
      }));
      return { ok: true, models };
    } catch (e) {
      return { ok: false, error: 'Invalid response: ' + (r.data || '').substring(0, 200) };
    }
  });

  ipcMain.handle('save-config', (_e, cfg) => {
    // Merge incoming config with existing to prevent field loss from race conditions
    const existing = loadUserConfig();
    const merged = Object.assign({}, existing, cfg);
    saveUserConfig(merged);
    return { ok: true };
  });
  ipcMain.handle('load-config', () => loadUserConfig());

  ipcMain.handle('load-models', () => {
    try { return JSON.parse(fs.readFileSync(getModelsConfigPath(), 'utf-8')); }
    catch { return { models: [] }; }
  });

  ipcMain.handle('get-app-info', () => ({
    version: '0.0.1',
    platform: os.platform(),
    configPath: getUserConfigPath(),
    hasPty: !!ctx.pty,
  }));

  ipcMain.handle('open-file', async (_e, filePath) => {
    try {
      return { ok: true, data: await electron.shell.openPath(path.resolve(filePath)) };
    } catch (err) {
      return { ok: false, error: err.message };
    }
  });

  // ── Legacy: fetch-remote-models (uses net.request now) ──
  ipcMain.handle('fetch-remote-models', async (_e, { apiBaseUrl, apiKey }) => {
    if (!apiBaseUrl) return { ok: false, error: 'No URL provided' };
    const provider = { baseUrl: apiBaseUrl, apiKey };
    const r = await apiRequest(electron, provider, '/v1/models', null, {
      method: 'GET',
      timeout: 10000,
    });
    if (!r.ok) return r;
    if (r.status && r.status >= 400) {
      try {
        const json = JSON.parse(r.data);
        return { ok: false, error: (json.error && json.error.message) || `HTTP ${r.status}` };
      } catch {
        return { ok: false, error: `HTTP ${r.status}` };
      }
    }
    try {
      const json = JSON.parse(r.data);
      const models = (json.data || json.models || []).map(m => ({
        id: typeof m === 'string' ? m : m.id,
        owned_by: m.owned_by || '',
      }));
      return { ok: true, models };
    } catch (e) {
      return { ok: false, error: 'Invalid response: ' + (r.data || '').substring(0, 200) };
    }
  });
}

module.exports = { register };
