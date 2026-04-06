// ─── LaiaiAgent: Automation Engine (Cron + Webhook) ──────────────────────────
// Runs in the main process. Provides real cron scheduling and webhook HTTP server.
const http = require('http');
const path = require('path');
const fs = require('fs');

let _cronTimers = [];     // Active cron intervals
let _webhookServer = null;
let _webhookPort = 0;
let _webhookToken = '';   // Auth token for webhook security
let _ctx = null;

function register(ctx) {
  _ctx = ctx;
  const { ipcMain, app, getMainWindow } = ctx;

  // ── Start automation engine after window is ready ──
  setTimeout(() => {
    startCronScheduler();
    startWebhookServer();
  }, 3000);

  // Generate secure webhook token
  const crypto = require('crypto');
  _webhookToken = crypto.randomBytes(24).toString('hex');

  // ── Get webhook info ──
  ipcMain.handle('get-webhook-info', () => {
    return {
      running: !!_webhookServer,
      port: _webhookPort,
      token: _webhookToken,
      url: _webhookPort ? `http://localhost:${_webhookPort}/webhook?token=${_webhookToken}` : null,
    };
  });

  // ── Restart automation (called when workflows change) ──
  ipcMain.handle('restart-automation', () => {
    startCronScheduler();
    return { ok: true };
  });
}

// ═══ CRON SCHEDULER ═══
// Parses simple cron expressions and runs workflow steps at the right time.
// Supports: minute hour day-of-month month day-of-week
// Runs a check every 60 seconds.

function loadWorkflows() {
  try {
    const app = _ctx.app;
    const configPath = path.join(app.getPath('userData'), 'user-config.json');
    if (fs.existsSync(configPath)) {
      const cfg = JSON.parse(fs.readFileSync(configPath, 'utf-8'));
      return cfg.workflows || [];
    }
  } catch {}
  return [];
}

function startCronScheduler() {
  // Clear existing timers
  _cronTimers.forEach(t => clearInterval(t));
  _cronTimers = [];

  // Main check loop — runs every 60 seconds
  const timer = setInterval(() => {
    const now = new Date();
    const workflows = loadWorkflows();
    const cronWorkflows = workflows.filter(wf => wf.trigger === 'cron' && wf.cronExpr);

    for (const wf of cronWorkflows) {
      if (matchesCron(wf.cronExpr, now)) {
        _log('Cron triggered: ' + wf.name + ' (' + wf.cronExpr + ')');
        executeWorkflowInRenderer(wf);
      }
    }
  }, 60000); // Check every minute

  _cronTimers.push(timer);

  // Also run startup-triggered workflows
  const workflows = loadWorkflows();
  const startupWorkflows = workflows.filter(wf => wf.trigger === 'startup');
  for (const wf of startupWorkflows) {
    setTimeout(() => {
      _log('Startup triggered: ' + wf.name);
      executeWorkflowInRenderer(wf);
    }, 5000);
  }
}

function matchesCron(expr, date) {
  // Parse cron: "min hour dom month dow"
  // Supports: numbers, *, */n, comma-separated
  // Strip any non-cron characters (e.g. Chinese annotations)
  const cleaned = expr.replace(/[^\d\s\*\/,\-]/g, '').trim();
  const parts = cleaned.split(/\s+/).filter(p => p);
  if (parts.length < 5) return false;

  const fields = [
    { value: date.getMinutes(), spec: parts[0] },
    { value: date.getHours(), spec: parts[1] },
    { value: date.getDate(), spec: parts[2] },
    { value: date.getMonth() + 1, spec: parts[3] },
    { value: date.getDay(), spec: parts[4] },
  ];

  return fields.every(({ value, spec }) => matchesCronField(spec, value));
}

function matchesCronField(spec, value) {
  if (spec === '*') return true;

  // */n — every n
  if (spec.startsWith('*/')) {
    const n = parseInt(spec.substring(2), 10);
    if (isNaN(n) || n <= 0) return false;
    return value % n === 0;
  }

  // Comma-separated values
  const parts = spec.split(',');
  return parts.some(p => {
    // Range: 1-5
    if (p.includes('-')) {
      const [a, b] = p.split('-').map(Number);
      return value >= a && value <= b;
    }
    return parseInt(p) === value;
  });
}

// ═══ WEBHOOK SERVER ═══
// Simple HTTP server that triggers webhook-type workflows when POST /webhook/<workflow-id>

function startWebhookServer() {
  if (_webhookServer) return;

  const workflows = loadWorkflows();
  const hasWebhook = workflows.some(wf => wf.trigger === 'webhook');

  // Always start — even if no webhook workflows yet, user might add one later
  _webhookServer = http.createServer((req, res) => {
    // CORS — restrict to localhost only
    res.setHeader('Access-Control-Allow-Origin', 'http://localhost');
    res.setHeader('Access-Control-Allow-Methods', 'POST, GET, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

    if (req.method === 'OPTIONS') { res.writeHead(200); res.end(); return; }

    // Token authentication — check query param or Authorization header
    const url = new URL(req.url, 'http://localhost');
    const tokenParam = url.searchParams.get('token');
    const authHeader = (req.headers.authorization || '').replace('Bearer ', '');
    const isAuthed = tokenParam === _webhookToken || authHeader === _webhookToken;

    // Status page doesn't require auth (only shows IDs, no execution)
    if (req.method === 'GET' && url.pathname === '/webhook') {
      const wfs = loadWorkflows().filter(wf => wf.trigger === 'webhook');
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({
        status: 'running',
        app: 'LaiaiAgent',
        webhooks: wfs.map(wf => ({
          id: wf.id,
          name: wf.name,
          url: `http://localhost:${_webhookPort}/webhook/${wf.id}`,
        })),
      }));
      return;
    }

    // All POST requests require authentication
    if (req.method === 'POST' && !isAuthed) {
      res.writeHead(401, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: 'Unauthorized. Include ?token=<token> or Authorization: Bearer <token>' }));
      return;
    }

    // POST /webhook/:id — trigger specific workflow
    if (req.method === 'POST' && url.pathname.startsWith('/webhook/')) {
      const wfId = url.pathname.replace('/webhook/', '').split('?')[0];
      const wfs = loadWorkflows();
      const wf = wfs.find(w => w.id === wfId && w.trigger === 'webhook');

      if (!wf) {
        res.writeHead(404, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: 'Workflow not found' }));
        return;
      }

      // Collect request body
      let body = '';
      req.on('data', chunk => { body += chunk; if (body.length > 1048576) req.destroy(); });
      req.on('end', () => {
        _log('Webhook triggered: ' + wf.name + ' by POST');
        executeWorkflowInRenderer(wf, body);
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ ok: true, workflow: wf.name, triggered: true }));
      });
      return;
    }

    // POST /webhook — trigger all webhook workflows
    if (req.method === 'POST' && url.pathname === '/webhook') {
      const wfs = loadWorkflows().filter(w => w.trigger === 'webhook');
      let body = '';
      req.on('data', chunk => { body += chunk; });
      req.on('end', () => {
        wfs.forEach(wf => {
          _log('Webhook triggered: ' + wf.name);
          executeWorkflowInRenderer(wf, body);
        });
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ ok: true, triggered: wfs.length }));
      });
      return;
    }

    res.writeHead(404);
    res.end('Not found');
  });

  // Listen on a random available port
  _webhookServer.listen(0, '127.0.0.1', () => {
    _webhookPort = _webhookServer.address().port;
    _log('Webhook server running on port ' + _webhookPort);
  });

  _webhookServer.on('error', (e) => {
    _log('Webhook server error: ' + e.message);
    _webhookServer = null;
    _webhookPort = 0;
  });
}

// ═══ EXECUTE WORKFLOW IN RENDERER ═══
// Sends the workflow steps to the renderer process for execution

function executeWorkflowInRenderer(wf, webhookPayload) {
  const win = _ctx.getMainWindow();
  if (!win || win.isDestroyed()) {
    _log('Cannot execute workflow — no window');
    return;
  }
  // Send to renderer
  win.webContents.send('automation-run-workflow', {
    id: wf.id,
    name: wf.name,
    steps: wf.steps,
    payload: webhookPayload || null,
  });
}

function _log(msg) {
  const os = require('os');
  const logFile = path.join(os.tmpdir(), 'laiai-automation.log');
  try { fs.appendFileSync(logFile, new Date().toISOString() + ' ' + msg + '\n'); } catch {}
}

module.exports = { register };
