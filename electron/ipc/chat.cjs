// ─── LaiaiAgent IPC: Chat Handlers ────────────────────────────────────────
const { chatAPI, chatAPIStream, imageGenAPI, ttsAPI } = require('./api.cjs');

function register(ctx) {
  const { ipcMain, electron, getMainWindow, app } = ctx;

  // Helper: get all providers for failover
  function getAllProviders() {
    try {
      const path = require('path');
      const fs = require('fs');
      const p = path.join(app.getPath('userData'), 'providers.json');
      const data = JSON.parse(fs.readFileSync(p, 'utf-8'));
      return data.providers || [];
    } catch { return []; }
  }

  // ── Direct Chat (non-streaming, with failover) ──
  ipcMain.handle('chat-send', async (_e, { provider, messages }) => {
    if (!provider || !provider.baseUrl) return { ok: false, error: 'No provider configured' };

    // Try primary provider first
    const result = await chatAPI(electron, provider, messages);
    if (result.ok) return result;

    // On failure, try other providers (failover)
    const allProviders = getAllProviders();
    for (const alt of allProviders) {
      if (alt.baseUrl === provider.baseUrl) continue; // Skip the one that failed
      if (!alt.baseUrl || !alt.apiKey) continue;
      const altProvider = { baseUrl: alt.baseUrl, apiKey: alt.apiKey, defaultModel: alt.defaultModel || provider.defaultModel };
      const altResult = await chatAPI(electron, altProvider, messages);
      if (altResult.ok) {
        altResult.failover = true;
        altResult.failoverFrom = provider.baseUrl;
        return altResult;
      }
    }
    return result; // Return original error if all fail
  });

  // ── Streaming Chat ──
  ipcMain.handle('chat-stream-start', async (_e, { provider, messages }) => {
    const win = getMainWindow();
    if (!provider || !provider.baseUrl) {
      if (win) win.webContents.send('chat-stream-error', 'No provider configured');
      return { ok: false, error: 'No provider configured' };
    }
    chatAPIStream(electron, provider, messages,
      (delta, _full) => {
        const w = getMainWindow();
        if (w && !w.isDestroyed()) w.webContents.send('chat-stream-chunk', delta);
      },
      (result) => {
        const w = getMainWindow();
        if (w && !w.isDestroyed()) w.webContents.send('chat-stream-done', result);
      }
    );
    return { ok: true };
  });

  // ── Image Generation ──
  ipcMain.handle('image-generate', async (_e, { provider, prompt, model, size }) => {
    return imageGenAPI(electron, provider, prompt, { model, size });
  });

  // ── TTS ──
  ipcMain.handle('tts-generate', async (_e, { provider, text, voice, model }) => {
    return ttsAPI(electron, provider, text, { voice, model });
  });

  // ── STT (Speech to Text via Whisper API) ──
  // Uses Node.js native https (not Electron net) to avoid SOCKS proxy issues
  ipcMain.handle('stt-transcribe', async (_e, { audio, format }) => {
    const path = require('path');
    const fs = require('fs');
    const https = require('https');
    const http = require('http');
    const app = electron.app;

    let provData;
    try {
      const configPath = path.join(app.getPath('userData'), 'providers.json');
      const data = JSON.parse(fs.readFileSync(configPath, 'utf-8'));
      const prov = (data.providers || []).find(p => p.isDefault) || (data.providers || [])[0];
      if (prov) provData = prov;
    } catch {}

    if (!provData || !provData.baseUrl) return { ok: false, error: 'No provider configured' };

    try {
      const audioBuffer = Buffer.from(audio, 'base64');
      const base = provData.baseUrl.replace(/\/+$/, '');
      const url = new URL(base + '/v1/audio/transcriptions');
      const mod = url.protocol === 'https:' ? https : http;

      const boundary = '----LaiaiSTT' + Date.now();
      const headerPart = '--' + boundary + '\r\nContent-Disposition: form-data; name="file"; filename="audio.' + (format || 'webm') + '"\r\nContent-Type: audio/' + (format || 'webm') + '\r\n\r\n';
      const modelPart = '\r\n--' + boundary + '\r\nContent-Disposition: form-data; name="model"\r\n\r\nwhisper-1\r\n--' + boundary + '--\r\n';
      const body = Buffer.concat([Buffer.from(headerPart), audioBuffer, Buffer.from(modelPart)]);

      return new Promise((resolve) => {
        const req = mod.request(url, {
          method: 'POST',
          headers: {
            'Authorization': 'Bearer ' + (provData.apiKey || ''),
            'Content-Type': 'multipart/form-data; boundary=' + boundary,
            'Content-Length': body.length,
          },
          timeout: 30000,
        }, (res) => {
          const chunks = [];
          res.on('data', c => chunks.push(c));
          res.on('end', () => {
            const text = Buffer.concat(chunks).toString('utf-8');
            try {
              const result = JSON.parse(text);
              if (result.text) resolve({ ok: true, text: result.text });
              else resolve({ ok: false, error: result.error?.message || 'No text returned' });
            } catch {
              resolve({ ok: false, error: 'Parse error: ' + text.substring(0, 200) });
            }
          });
        });
        req.on('error', (e) => resolve({ ok: false, error: e.message }));
        req.on('timeout', () => { req.destroy(); resolve({ ok: false, error: 'Timeout' }); });
        req.write(body);
        req.end();
      });
    } catch (e) {
      return { ok: false, error: e.message };
    }
  });

  // ── Email (SMTP) ──
  ipcMain.handle('send-email', async (_e, { smtp, from, to, subject, body, html }) => {
    try {
      const nodemailer = require('nodemailer');
      const transporter = nodemailer.createTransport({
        host: smtp.host,
        port: smtp.port || 465,
        secure: smtp.secure !== false,
        auth: { user: smtp.user, pass: smtp.pass },
      });
      const info = await transporter.sendMail({
        from: from || smtp.user,
        to,
        subject,
        text: body,
        html: html || undefined,
      });
      return { ok: true, messageId: info.messageId };
    } catch (e) {
      return { ok: false, error: e.message };
    }
  });

  // ── Load/Save SMTP config ──
  ipcMain.handle('load-smtp-config', async () => {
    const path = require('path');
    const fs = require('fs');
    const app = electron.app;
    const p = path.join(app.getPath('userData'), 'smtp-config.json');
    try {
      if (fs.existsSync(p)) return JSON.parse(fs.readFileSync(p, 'utf-8'));
    } catch {}
    return null;
  });

  ipcMain.handle('save-smtp-config', async (_e, config) => {
    const path = require('path');
    const fs = require('fs');
    const app = electron.app;
    const p = path.join(app.getPath('userData'), 'smtp-config.json');
    try {
      fs.writeFileSync(p, JSON.stringify(config, null, 2), 'utf-8');
      return { ok: true };
    } catch (e) {
      return { ok: false, error: e.message };
    }
  });
}

module.exports = { register };
