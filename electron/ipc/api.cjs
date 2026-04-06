// ─── LaiaiAgent IPC: Unified API Layer ────────────────────────────────────
// Provides net.request-based HTTP helpers for all API calls (chat, image, TTS).
// Using Electron's net module ensures proxy settings are respected consistently.

/**
 * Low-level HTTP request via Electron net.request (Chromium network stack).
 * Supports both streaming (opts.onData/onEnd) and buffered modes.
 */
// Validate that a URL is a legitimate API endpoint (HTTPS or localhost)
function _validateApiUrl(urlStr) {
  try {
    const u = new URL(urlStr);
    if (u.protocol === 'https:') return true;
    if (u.protocol === 'http:' && (u.hostname === 'localhost' || u.hostname === '127.0.0.1' || u.hostname.endsWith('.local'))) return true;
    return false;
  } catch { return false; }
}

// Max response size: 50MB to prevent memory exhaustion
const MAX_RESPONSE_SIZE = 50 * 1024 * 1024;

function _singleApiRequest(electron, provider, endpoint, body, opts = {}) {
  if (!provider || !provider.baseUrl) {
    if (opts.onEnd) opts.onEnd();
    return Promise.resolve({ ok: false, error: 'No provider configured' });
  }
  if (!provider.apiKey || !provider.apiKey.trim()) {
    if (opts.onEnd) opts.onEnd();
    return Promise.resolve({ ok: false, error: 'API key is required' });
  }
  const base = (provider.baseUrl || '').replace(/\/+$/, '');
  const url = base + endpoint;
  if (!_validateApiUrl(url)) {
    if (opts.onEnd) opts.onEnd();
    return Promise.resolve({ ok: false, error: 'Invalid API URL: must be HTTPS or localhost' });
  }
  const bodyStr = typeof body === 'string' ? body : JSON.stringify(body);
  const { net } = electron;

  return new Promise((resolve) => {
    try {
      const req = net.request({ url, method: opts.method || 'POST' });
      req.setHeader('Authorization', `Bearer ${provider.apiKey}`);
      req.setHeader('Content-Type', 'application/json');

      const timeout = opts.timeout || 120000;
      const timer = setTimeout(() => {
        req.abort();
        if (opts.onEnd) opts.onEnd();
        resolve({ ok: false, error: `Timeout (${timeout / 1000}s)` });
      }, timeout);

      req.on('response', (response) => {
        // Detect 429 rate limit before processing data
        if (response.statusCode === 429) {
          let errData = '';
          response.on('data', (chunk) => { errData += chunk.toString(); });
          response.on('end', () => {
            clearTimeout(timer);
            const retryAfter = response.headers['retry-after'];
            resolve({ ok: false, status: 429, error: 'Rate limited (429)', retryAfter: retryAfter ? parseInt(retryAfter, 10) : null, data: errData });
          });
          return;
        }

        if (opts.onData) {
          // ── Streaming mode ──
          response.on('data', (chunk) => {
            opts.onData(chunk.toString());
          });
          response.on('end', () => {
            clearTimeout(timer);
            if (opts.onEnd) opts.onEnd();
            resolve({ ok: true });
          });
        } else {
          // ── Non-streaming (buffered) mode ──
          let data = '';
          let dataSize = 0;
          response.on('data', (chunk) => {
            dataSize += chunk.length;
            if (dataSize > MAX_RESPONSE_SIZE) { req.abort(); resolve({ ok: false, error: 'Response too large' }); return; }
            data += chunk.toString();
          });
          response.on('end', () => {
            clearTimeout(timer);
            resolve({ ok: true, status: response.statusCode, data });
          });
        }
      });

      req.on('error', (error) => {
        clearTimeout(timer);
        if (opts.onEnd) opts.onEnd();
        resolve({ ok: false, error: error.message || 'Network error' });
      });

      if (opts.method !== 'GET') {
        req.write(bodyStr);
      }
      req.end();
    } catch (e) {
      if (opts.onEnd) opts.onEnd();
      resolve({ ok: false, error: e.message || 'Request failed' });
    }
  });
}

/**
 * HTTP request with 429 retry logic (exponential backoff, up to 3 retries).
 * For streaming requests, retry applies before the first chunk.
 */
async function apiRequest(electron, provider, endpoint, body, opts = {}) {
  const maxRetries = 3;
  const baseDelays = [1000, 2000, 4000];

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    const result = await _singleApiRequest(electron, provider, endpoint, body, opts);

    if (result.status !== 429 || attempt >= maxRetries) {
      return result;
    }

    // 429 rate limit — wait and retry
    const retryDelay = result.retryAfter
      ? result.retryAfter * 1000
      : baseDelays[attempt] || 4000;
    await new Promise(r => setTimeout(r, retryDelay));
  }
}

/**
 * Chat API — non-streaming, returns full response.
 */
async function chatAPI(electron, provider, messages) {
  if (!provider || !provider.baseUrl) return { ok: false, error: 'No provider configured' };
  const model = provider.defaultModel || 'gpt-4o';
  const r = await apiRequest(electron, provider, '/v1/chat/completions', {
    model, messages, stream: false, max_tokens: 4096,
  });
  if (!r.ok) return r;
  try {
    const json = JSON.parse(r.data);
    if (r.status && r.status >= 400) {
      return { ok: false, error: (json.error && json.error.message) || `HTTP ${r.status}` };
    }
    if (json.choices && json.choices[0]) {
      return { ok: true, content: (json.choices[0].message || {}).content || '', model: json.model || model };
    } else if (json.error) {
      return { ok: false, error: json.error.message || JSON.stringify(json.error) };
    }
    return { ok: false, error: 'Unexpected response' };
  } catch (e) {
    return { ok: false, error: 'Invalid JSON: ' + (r.data || '').substring(0, 200) };
  }
}

/**
 * Chat API — streaming, fires onChunk(delta, fullContent) and onDone(result).
 */
function chatAPIStream(electron, provider, messages, onChunk, onDone) {
  if (!provider || !provider.baseUrl) { onDone({ ok: false, error: 'No provider' }); return; }
  const model = provider.defaultModel || 'gpt-4o';
  let fullContent = '';
  let buffer = '';

  apiRequest(electron, provider, '/v1/chat/completions',
    JSON.stringify({ model, messages, stream: true, max_tokens: 4096 }),
    {
      onData: (chunk) => {
        buffer += chunk;
        const lines = buffer.split('\n');
        buffer = lines.pop() || '';
        for (const line of lines) {
          if (!line.startsWith('data: ')) continue;
          const data = line.slice(6).trim();
          if (data === '[DONE]') continue;
          try {
            const json = JSON.parse(data);
            const delta = json.choices?.[0]?.delta?.content || '';
            if (delta) {
              fullContent += delta;
              onChunk(delta, fullContent);
            }
          } catch {}
        }
      },
      onEnd: () => {
        if (fullContent) {
          onDone({ ok: true, content: fullContent, model });
        } else {
          try {
            const json = JSON.parse(buffer);
            const errMsg = json.error?.message || json.message || JSON.stringify(json);
            onDone({ ok: false, error: errMsg });
          } catch {
            onDone({ ok: false, error: buffer || 'Empty response from API' });
          }
        }
      }
    }
  );
}

/**
 * Image Generation API.
 */
async function imageGenAPI(electron, provider, prompt, opts = {}) {
  if (!provider || !provider.baseUrl) return { ok: false, error: 'No provider configured' };
  const r = await apiRequest(electron, provider, '/v1/images/generations', {
    model: opts.model || 'dall-e-3',
    prompt,
    n: opts.n || 1,
    size: opts.size || '1024x1024',
    response_format: 'url',
  });
  if (!r.ok) return r;
  try {
    const json = JSON.parse(r.data);
    if (r.status && r.status >= 400) {
      return { ok: false, error: (json.error && json.error.message) || `HTTP ${r.status}` };
    }
    if (json.data && json.data.length) {
      return { ok: true, images: json.data.map(d => ({ url: d.url, b64: d.b64_json })) };
    } else if (json.error) {
      return { ok: false, error: json.error.message || JSON.stringify(json.error) };
    }
    return { ok: false, error: 'No images returned' };
  } catch (e) {
    return { ok: false, error: 'Invalid response: ' + (r.data || '').substring(0, 200) };
  }
}

/**
 * TTS API — now uses apiRequest (net.request) for proxy consistency.
 */
async function ttsAPI(electron, provider, text, opts = {}) {
  if (!provider || !provider.baseUrl) return { ok: false, error: 'No provider configured' };

  // Use Node.js native https to avoid Electron session proxy issues
  const https = require('https');
  const http = require('http');
  const base = (provider.baseUrl || '').replace(/\/+$/, '');
  const url = new URL(base + '/v1/audio/speech');
  const mod = url.protocol === 'https:' ? https : http;
  const body = JSON.stringify({
    model: opts.model || 'tts-1',
    input: text,
    voice: opts.voice || 'alloy',
    response_format: opts.format || 'mp3',
  });

  return new Promise((resolve) => {
    const req = mod.request(url, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${provider.apiKey || ''}`,
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(body),
      },
      timeout: 30000,
    }, (res) => {
      const chunks = [];
      res.on('data', c => chunks.push(c));
      res.on('end', () => {
        const buf = Buffer.concat(chunks);
        if (res.statusCode >= 400) {
          resolve({ ok: false, error: `HTTP ${res.statusCode}: ${buf.toString('utf-8').substring(0, 200)}` });
        } else {
          resolve({ ok: true, audio: buf.toString('base64'), format: opts.format || 'mp3' });
        }
      });
    });
    req.on('error', (e) => resolve({ ok: false, error: e.message }));
    req.on('timeout', () => { req.destroy(); resolve({ ok: false, error: 'TTS request timeout' }); });
    req.write(body);
    req.end();
  });
}

module.exports = { apiRequest, chatAPI, chatAPIStream, imageGenAPI, ttsAPI };
