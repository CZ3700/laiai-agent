#!/usr/bin/env node
/**
 * LaiaiAgent Built-in MCP Server: Image Generation
 *
 * Implements MCP protocol (JSON-RPC over stdio) without external dependencies.
 * Provides generate_image tool to the Agent.
 *
 * Environment variables:
 *   IMAGE_API_BASE_URL — Provider base URL
 *   IMAGE_API_KEY      — API key
 *   IMAGE_MODEL        — Default model (default: dall-e-3)
 *   HTTP_PROXY/HTTPS_PROXY — Proxy settings
 */
'use strict';

const fs = require('fs');
const https = require('https');
const http = require('http');

const BASE_URL = process.env.IMAGE_API_BASE_URL || '';
const API_KEY = process.env.IMAGE_API_KEY || '';
const DEFAULT_MODEL = process.env.IMAGE_MODEL || 'dall-e-3';

// ─── JSON-RPC stdio transport ───
let inputBuffer = '';

process.stdin.setEncoding('utf-8');
process.stdin.on('data', (chunk) => {
  inputBuffer += chunk;
  processBuffer();
});

function processBuffer() {
  while (inputBuffer.length > 0) {
    // Try Content-Length framing first (standard MCP/LSP)
    const headerEnd = inputBuffer.indexOf('\r\n\r\n');
    if (headerEnd !== -1) {
      const header = inputBuffer.substring(0, headerEnd);
      const match = header.match(/Content-Length:\s*(\d+)/i);
      if (match) {
        const contentLength = parseInt(match[1]);
        const bodyStart = headerEnd + 4;
        if (inputBuffer.length < bodyStart + contentLength) break;
        const body = inputBuffer.substring(bodyStart, bodyStart + contentLength);
        inputBuffer = inputBuffer.substring(bodyStart + contentLength);
        try { handleMessage(JSON.parse(body)); } catch {}
        continue;
      }
    }

    // Fallback: try to parse as raw JSON (Agent may send without framing)
    // Look for complete JSON objects by tracking brace depth
    let depth = 0, inStr = false, escape = false, start = -1;
    for (let i = 0; i < inputBuffer.length; i++) {
      const c = inputBuffer[i];
      if (escape) { escape = false; continue; }
      if (c === '\\') { escape = true; continue; }
      if (c === '"' && !escape) { inStr = !inStr; continue; }
      if (inStr) continue;
      if (c === '{') { if (depth === 0) start = i; depth++; }
      if (c === '}') { depth--; if (depth === 0 && start !== -1) {
        const json = inputBuffer.substring(start, i + 1);
        inputBuffer = inputBuffer.substring(i + 1);
        try { handleMessage(JSON.parse(json)); } catch {}
        start = -1;
        break; // restart outer loop
      }}
    }
    if (depth > 0) break; // incomplete JSON, wait for more data
    if (start === -1 && depth === 0) {
      // No JSON found, skip any leading whitespace/newlines
      const trimmed = inputBuffer.replace(/^[\s\n\r]+/, '');
      if (trimmed.length === inputBuffer.length) break; // nothing to skip
      inputBuffer = trimmed;
      if (!inputBuffer.length) break;
      continue;
    }
    break;
  }
}

function sendResponse(msg) {
  const body = JSON.stringify(msg);
  // Send as raw JSON line (Agent's MCP client expects this format)
  process.stdout.write(body + '\n');
}

// ─── MCP protocol handlers ───
async function handleMessage(msg) {
  if (msg.method === 'initialize') {
    sendResponse({
      jsonrpc: '2.0',
      id: msg.id,
      result: {
        protocolVersion: msg.params?.protocolVersion || '2025-11-25',
        capabilities: { tools: {} },
        serverInfo: { name: 'laiai-image-gen', version: '1.0.0' },
      },
    });
  } else if (msg.method === 'notifications/initialized') {
    // Client confirmed init — no response needed
  } else if (msg.method === 'tools/list') {
    sendResponse({
      jsonrpc: '2.0',
      id: msg.id,
      result: {
        tools: [
          {
            name: 'generate_image',
            description: 'Generate an image from a text prompt using AI. Returns the image as a markdown image link. Use this whenever the user asks to draw, paint, create, generate, sketch, or make any kind of image, picture, illustration, artwork, or visual content.',
            inputSchema: {
              type: 'object',
              properties: {
                prompt: {
                  type: 'string',
                  description: 'Detailed description of the image to generate. Be specific about style, subject, colors, composition, mood.'
                },
                size: {
                  type: 'string',
                  enum: ['1024x1024', '1792x1024', '1024x1792'],
                  description: 'Image dimensions. 1024x1024 (square), 1792x1024 (landscape), 1024x1792 (portrait). Default: 1024x1024'
                },
              },
              required: ['prompt'],
            },
          },
        ],
      },
    });
  } else if (msg.method === 'tools/call') {
    const args = msg.params?.arguments || {};
    const result = await callGenerateImage(args);
    sendResponse({
      jsonrpc: '2.0',
      id: msg.id,
      result: result,
    });
  } else if (msg.id) {
    // Unknown method with id — respond with error
    sendResponse({
      jsonrpc: '2.0',
      id: msg.id,
      error: { code: -32601, message: 'Method not found: ' + msg.method },
    });
  }
}

// ─── Image generation ───
async function callGenerateImage(args) {
  if (!BASE_URL || !API_KEY) {
    return {
      content: [{ type: 'text', text: 'Error: Image generation not configured. Set up an API provider in Settings.' }],
      isError: true,
    };
  }

  const prompt = args.prompt || '';
  const model = DEFAULT_MODEL;

  try {
    // Use chat completions API with an image-capable model
    // This works with OpenRouter (google/gemini-2.5-flash-image, openai/gpt-5-image, etc.)
    const apiUrl = BASE_URL.replace(/\/+$/, '') + '/v1/chat/completions';
    const body = JSON.stringify({
      model,
      messages: [{ role: 'user', content: 'Generate an image: ' + prompt }],
      max_tokens: 1024,
    });

    const data = await httpPost(apiUrl, body);
    const json = JSON.parse(data);

    if (json.error) {
      return {
        content: [{ type: 'text', text: 'API Error: ' + (json.error.message || JSON.stringify(json.error)) }],
        isError: true,
      };
    }

    const msg = json.choices?.[0]?.message;
    if (!msg) {
      return { content: [{ type: 'text', text: 'No response from image model.' }], isError: true };
    }

    // Extract base64 image data from response and save to local file
    let imageData = null;

    // Check message.images[] (OpenRouter/Gemini format)
    if (msg.images && msg.images.length > 0) {
      const url = msg.images[0].image_url?.url || msg.images[0].url || '';
      if (url.startsWith('data:image/')) {
        imageData = url;
      }
    }

    // Check content for inline base64
    if (!imageData && msg.content && msg.content.includes('data:image/')) {
      const match = msg.content.match(/(data:image\/\w+;base64,[A-Za-z0-9+/=]+)/);
      if (match) imageData = match[1];
    }

    if (imageData) {
      // Save base64 image to local file
      const path = require('path');
      const imgDir = path.join(require('os').tmpdir(), 'laiai-images');
      if (!fs.existsSync(imgDir)) fs.mkdirSync(imgDir, { recursive: true });
      const fileName = 'img-' + Date.now() + '.png';
      const filePath = path.join(imgDir, fileName);

      // Extract raw base64 data
      const base64Match = imageData.match(/base64,(.+)/);
      if (base64Match) {
        fs.writeFileSync(filePath, Buffer.from(base64Match[1], 'base64'));
        const fileUrl = 'file:///' + filePath.replace(/\\/g, '/');
        let text = '![Generated Image](' + fileUrl + ')';
        if (msg.content) {
          // Add text description (without the base64 data)
          const cleanContent = msg.content.replace(/data:image\/\w+;base64,[A-Za-z0-9+/=]+/g, '').trim();
          if (cleanContent) text += '\n\n' + cleanContent;
        }
        return { content: [{ type: 'text', text }] };
      }
    }

    // Fallback: return the text response
    return { content: [{ type: 'text', text: msg.content || 'No image generated.' }] };
  } catch (e) {
    return {
      content: [{ type: 'text', text: 'Image generation error: ' + (e.message || String(e)) }],
      isError: true,
    };
  }
}

// ─── HTTP helper with SOCKS5/HTTP proxy support ───
function httpPost(url, body) {
  return new Promise((resolve, reject) => {
    const parsed = new URL(url);
    const proxyUrl = process.env.HTTPS_PROXY || process.env.HTTP_PROXY ||
                     process.env.https_proxy || process.env.http_proxy;

    const headers = {
      'Authorization': 'Bearer ' + API_KEY,
      'Content-Type': 'application/json',
      'Content-Length': Buffer.byteLength(body),
    };

    let agent = null;

    // Try to use proxy agent if proxy is configured
    if (proxyUrl) {
      try {
        // Find node_modules — could be in parent directories
        const path = require('path');
        const possiblePaths = [
          path.join(__dirname, '..', '..', 'node_modules'),  // app/node_modules
          path.join(__dirname, '..', 'node_modules'),        // electron/node_modules
          path.resolve('node_modules'),                      // cwd/node_modules
        ];
        for (const nmPath of possiblePaths) {
          try {
            const { SocksProxyAgent } = require(path.join(nmPath, 'socks-proxy-agent'));
            agent = new SocksProxyAgent(proxyUrl);
            break;
          } catch {}
          try {
            const { HttpsProxyAgent } = require(path.join(nmPath, 'https-proxy-agent'));
            agent = new HttpsProxyAgent(proxyUrl);
            break;
          } catch {}
        }
        if (!agent) {
          // Last resort: try global require
          try { const { SocksProxyAgent } = require('socks-proxy-agent'); agent = new SocksProxyAgent(proxyUrl); } catch {}
        }
        if (!agent) {
          try { const { HttpsProxyAgent } = require('https-proxy-agent'); agent = new HttpsProxyAgent(proxyUrl); } catch {}
        }
      } catch {}
    }

    const options = {
      hostname: parsed.hostname,
      port: parsed.port || (parsed.protocol === 'https:' ? 443 : 80),
      path: parsed.pathname + (parsed.search || ''),
      method: 'POST',
      headers,
      timeout: 90000,
    };
    if (agent) options.agent = agent;

    const mod = parsed.protocol === 'https:' ? https : http;
    const req = mod.request(options, (res) => {
      let data = '';
      res.on('data', (chunk) => { data += chunk; });
      res.on('end', () => resolve(data));
    });

    req.on('error', reject);
    req.on('timeout', () => { req.destroy(); reject(new Error('Request timeout (90s)')); });
    req.write(body);
    req.end();
  });
}

// Keep process alive
process.stdin.resume();
