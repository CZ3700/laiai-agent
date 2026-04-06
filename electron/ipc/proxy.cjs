// ─── LaiaiAgent IPC: Proxy Handlers + Utility Functions ──────────────────
const net = require('net');

/**
 * Build a full proxy URL from user config.
 * Used by both spawnTerminal and applyElectronProxy for consistency.
 */
function buildProxyUrl(userCfg) {
  const raw = userCfg.proxyUrl || '';
  if (!raw) return '';
  if (raw.match(/^(https?|socks5):\/\//)) return raw;
  return (userCfg.proxyMode === 'socks5' ? 'socks5://' : 'http://') + raw;
}

/**
 * Detect local proxy (V2Ray/Clash/SSR) by scanning common ports.
 * Returns a proxy URL string or null.
 */
function detectLocalProxy() {
  const candidates = [
    { port: 10809, proto: 'http' },
    { port: 10808, proto: 'socks5' },
    { port: 7890, proto: 'http' },
    { port: 7891, proto: 'socks5' },
    { port: 1080, proto: 'socks5' },
    { port: 1087, proto: 'http' },
    { port: 8080, proto: 'http' },
  ];
  return new Promise((resolve) => {
    let found = false;
    let pending = candidates.length;
    for (const c of candidates) {
      const sock = net.connect(c.port, '127.0.0.1', () => {
        sock.destroy();
        if (!found) {
          found = true;
          resolve(c.proto + '://127.0.0.1:' + c.port);
        }
      });
      sock.setTimeout(500);
      sock.on('timeout', () => { sock.destroy(); if (--pending === 0 && !found) resolve(null); });
      sock.on('error', () => { if (--pending === 0 && !found) resolve(null); });
    }
  });
}

/**
 * Apply proxy to Electron's default session.
 */
async function applyElectronProxy(electron, loadUserConfig) {
  const cfg = loadUserConfig();
  const { session } = electron;

  if (cfg.proxyMode === 'system') {
    const localProxy = await detectLocalProxy();
    if (localProxy) {
      await session.defaultSession.setProxy({ proxyRules: localProxy });
    } else {
      await session.defaultSession.setProxy({ mode: 'system' });
    }
  } else if (cfg.proxyMode && cfg.proxyMode !== 'none' && cfg.proxyUrl) {
    const proxyUrl = buildProxyUrl(cfg);
    await session.defaultSession.setProxy({ proxyRules: proxyUrl });
  } else {
    await session.defaultSession.setProxy({ mode: 'direct' });
  }
}

function register(ctx) {
  const { ipcMain, electron, loadUserConfig } = ctx;
  const path = require('path');
  const fs = require('fs');
  const { app } = require('electron');
  const proxyListPath = path.join(app.getPath('userData'), 'proxy-list.json');

  // ── Test Proxy ──
  ipcMain.handle('test-proxy', async (_e, { mode, url }) => {
    const http = require('http');
    try {
      const raw = url || '';
      let proxyHost, proxyPort, proxyAuth;
      const parsed = raw.match(/^(?:socks5|https?):\/\/(?:([^@]+)@)?([^:]+):(\d+)/)
        || raw.match(/^(?:([^@]+)@)?([^:]+):(\d+)/);
      if (!parsed) return { ok: false, error: '\u4ee3\u7406\u5730\u5740\u683c\u5f0f\u9519\u8bef\u3002\u683c\u5f0f: host:port \u6216 user:pass@host:port' };
      proxyAuth = parsed[1] || '';
      proxyHost = parsed[2];
      proxyPort = parseInt(parsed[3]);

      if (mode === 'socks5') {
        return new Promise((resolve) => {
          const sock = net.connect(proxyPort, proxyHost, () => {
            sock.destroy();
            resolve({ ok: true, detail: '\u4ee3\u7406\u7aef\u53e3\u53ef\u8fbe \u00b7 ' + proxyHost + ':' + proxyPort });
          });
          sock.setTimeout(10000);
          sock.on('timeout', () => { sock.destroy(); resolve({ ok: false, error: '\u8fde\u63a5\u8d85\u65f6' }); });
          sock.on('error', (e) => resolve({ ok: false, error: e.message }));
        });
      } else {
        return new Promise((resolve) => {
          const headers = {};
          if (proxyAuth) headers['Proxy-Authorization'] = 'Basic ' + Buffer.from(proxyAuth).toString('base64');
          const req = http.request({
            host: proxyHost, port: proxyPort,
            method: 'CONNECT', path: 'httpbin.org:443',
            headers, timeout: 10000,
          });
          req.on('connect', (res, socket) => {
            socket.destroy();
            resolve({ ok: true, detail: 'HTTP CONNECT \u6210\u529f \u00b7 \u4ee3\u7406\u54cd\u5e94 ' + res.statusCode });
          });
          req.on('error', (e) => resolve({ ok: false, error: e.message }));
          req.on('timeout', () => { req.destroy(); resolve({ ok: false, error: '\u8fde\u63a5\u8d85\u65f6' }); });
          req.end();
        });
      }
    } catch (e) {
      return { ok: false, error: e.message };
    }
  });

  // ── Check current IP ──
  // Uses curl with the active proxy from proxy-list.json for reliable SOCKS5 auth support
  ipcMain.handle('check-proxy-ip', async () => {
    const { execSync } = require('child_process');

    // Read active proxy from proxy-list.json
    let activeProxy = null;
    try {
      const list = JSON.parse(fs.readFileSync(proxyListPath, 'utf-8'));
      activeProxy = list.find(p => p.isActive);
    } catch {}

    try {
      if (activeProxy) {
        // Test via curl with the full proxy URL (supports SOCKS5 auth)
        const result = execSync(
          'curl -s --max-time 10 --proxy ' + activeProxy.url + ' https://httpbin.org/ip',
          { encoding: 'utf-8', timeout: 15000 }
        );
        const json = JSON.parse(result);
        return { ok: true, ip: json.origin || result.trim(), proxy: activeProxy.label };
      } else {
        // No proxy — direct connection
        const result = execSync(
          'curl -s --max-time 10 https://httpbin.org/ip',
          { encoding: 'utf-8', timeout: 15000 }
        );
        const json = JSON.parse(result);
        return { ok: true, ip: json.origin || result.trim(), proxy: 'Direct' };
      }
    } catch (e) {
      return { ok: false, error: e.stderr || e.message || 'Connection failed' };
    }
  });

  // ── Apply proxy and notify (legacy — kept for compat but no longer reads user-config) ──
  ipcMain.handle('apply-proxy-now', async () => {
    // No-op: proxy is now managed via proxy-list.json and apply-proxy handler
    return { ok: true };
  });

  // ── Proxy List (separate file, no race conditions) ──

  ipcMain.handle('load-proxy-list', () => {
    try { return JSON.parse(fs.readFileSync(proxyListPath, 'utf-8')); }
    catch { return []; }
  });

  ipcMain.handle('save-proxy-list', (_e, list) => {
    const dir = path.dirname(proxyListPath);
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(proxyListPath, JSON.stringify(list, null, 2));
    return { ok: true };
  });

  // ── Proxy auth handler (single registration, uses global._proxyAuth) ──
  app.on('login', (event, webContents, details, authInfo, callback) => {
    if (authInfo.isProxy && global._proxyAuth) {
      event.preventDefault();
      callback(global._proxyAuth.username, global._proxyAuth.password);
    }
  });

  // ── Apply proxy directly (from proxy list selection) ──
  ipcMain.handle('apply-proxy', async (_e, { mode, url }) => {
    const { session } = electron;
    global._proxyAuth = null;

    if (mode === 'socks5' || mode === 'http') {
      let fullUrl = url.match(/^(https?|socks5):\/\//) ? url : mode + '://' + url;

      // For SOCKS5 with auth, Chromium proxyRules doesn't support user:pass@
      // Strategy: strip auth, set proxy, handle auth via login event
      // For HTTP proxy, auth works via 407 + login event
      try {
        const parsed = new URL(fullUrl);
        if (parsed.username) {
          global._proxyAuth = {
            username: decodeURIComponent(parsed.username),
            password: decodeURIComponent(parsed.password || ''),
          };
          // Build clean proxy rule: just protocol://host:port
          const cleanUrl = parsed.protocol + '//' + parsed.hostname + ':' + parsed.port;
          await session.defaultSession.setProxy({ proxyRules: cleanUrl });
          return { ok: true };
        }
      } catch {}
      await session.defaultSession.setProxy({ proxyRules: fullUrl });
    } else if (mode === 'system') {
      const localProxy = await detectLocalProxy();
      if (localProxy) {
        await session.defaultSession.setProxy({ proxyRules: localProxy });
      } else {
        await session.defaultSession.setProxy({ mode: 'system' });
      }
    } else {
      await session.defaultSession.setProxy({ mode: 'direct' });
    }
    return { ok: true };
  });
}

module.exports = { register, applyElectronProxy, detectLocalProxy, buildProxyUrl };
