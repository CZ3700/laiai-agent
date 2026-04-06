#!/usr/bin/env node
/**
 * LaiaiAgent Dev Mode — Vite + Electron 热更新开发
 *
 * 用法: node electron-dev.cjs
 *
 * 1. 启动 Vite dev server (renderer 目录)
 * 2. 等待 Vite 就绪
 * 3. 将应用文件复制到 Electron 的 resources/app/
 * 4. 以 VITE_DEV_SERVER_URL 环境变量启动 Electron
 *
 * Vite 提供 CSS/JS 热更新，修改 main.cjs/preload.cjs 需重启。
 */
const { spawn } = require('child_process');
const path = require('path');
const fs = require('fs');
const http = require('http');

const root = __dirname;
const electronDist = path.join(root, 'node_modules', 'electron', 'dist');
const bin = path.join(electronDist, process.platform === 'win32' ? 'electron.exe' : 'electron');

const VITE_PORT = 5173;
const VITE_URL = `http://localhost:${VITE_PORT}`;

if (!fs.existsSync(bin)) {
  console.error('Electron binary not found at:', bin);
  console.error('Run: npm install electron');
  process.exit(1);
}

// ─── Copy app files into resources/app/ ───
const appDir = path.join(electronDist, 'resources', 'app');

function copyDir(srcDir, dstDir) {
  if (!fs.existsSync(srcDir)) return;
  if (!fs.existsSync(dstDir)) fs.mkdirSync(dstDir, { recursive: true });
  for (const f of fs.readdirSync(srcDir)) {
    const s = path.join(srcDir, f), d = path.join(dstDir, f);
    if (fs.statSync(s).isDirectory()) copyDir(s, d);
    else fs.copyFileSync(s, d);
  }
}

function setupApp() {
  if (!fs.existsSync(appDir)) fs.mkdirSync(appDir, { recursive: true });

  // Write package.json pointing to main.cjs
  fs.writeFileSync(path.join(appDir, 'package.json'), JSON.stringify({
    name: 'laiai-agent',
    main: 'main.cjs',
  }));

  // Copy core electron files
  for (const f of ['main.cjs', 'preload.cjs', 'icon.png', 'icon.ico']) {
    const src = path.join(root, 'electron', f);
    if (fs.existsSync(src)) fs.copyFileSync(src, path.join(appDir, f));
  }

  // Copy IPC modules directory
  copyDir(path.join(root, 'electron', 'ipc'), path.join(appDir, 'ipc'));

  // Copy renderer directory (for fallback; Vite dev server is primary)
  copyDir(path.join(root, 'electron', 'renderer'), path.join(appDir, 'renderer'));

  // Copy old index.html as last-resort fallback
  const oldHtml = path.join(root, 'electron', 'index.html');
  if (fs.existsSync(oldHtml)) fs.copyFileSync(oldHtml, path.join(appDir, 'index.html'));

  // Copy vendor & assets (legacy paths that may still be referenced)
  copyDir(path.join(root, 'electron', 'vendor'), path.join(appDir, 'vendor'));
  copyDir(path.join(root, 'electron', 'assets'), path.join(appDir, 'assets'));

  console.log('[dev] App files copied to', appDir);
}

// ─── Wait for Vite to be ready ───
function waitForVite(maxRetries = 30) {
  return new Promise((resolve, reject) => {
    let attempts = 0;
    function check() {
      attempts++;
      const req = http.get(VITE_URL, (res) => {
        res.resume(); // drain
        resolve();
      });
      req.on('error', () => {
        if (attempts >= maxRetries) {
          reject(new Error(`Vite not ready after ${maxRetries} attempts`));
        } else {
          setTimeout(check, 500);
        }
      });
      req.setTimeout(2000, () => { req.destroy(); });
    }
    check();
  });
}

// ─── Main ───
async function main() {
  console.log('[dev] 🔧 Setting up app files...');
  setupApp();

  // Start Vite dev server
  console.log('[dev] 🚀 Starting Vite dev server...');
  // On Windows, spawn .cmd via cmd.exe to avoid shell+args deprecation warning
  const viteCwd = path.join(root, 'electron', 'renderer');
  const viteArgs = ['--port', String(VITE_PORT), '--strictPort'];
  let viteProcess;
  if (process.platform === 'win32') {
    const vitecmd = path.join(root, 'node_modules', '.bin', 'vite.cmd');
    viteProcess = spawn('cmd.exe', ['/c', vitecmd, ...viteArgs], {
      cwd: viteCwd,
      stdio: ['ignore', 'pipe', 'pipe'],
    });
  } else {
    viteProcess = spawn(path.join(root, 'node_modules', '.bin', 'vite'), viteArgs, {
      cwd: viteCwd,
      stdio: ['ignore', 'pipe', 'pipe'],
    });
  }

  viteProcess.stdout.on('data', (d) => process.stdout.write('[vite] ' + d));
  viteProcess.stderr.on('data', (d) => process.stderr.write('[vite] ' + d));
  viteProcess.on('error', (err) => {
    console.error('[dev] Failed to start Vite:', err.message);
    process.exit(1);
  });

  // Wait for Vite to be ready
  try {
    await waitForVite();
    console.log('[dev] ✅ Vite ready at', VITE_URL);
  } catch (e) {
    console.error('[dev]', e.message);
    viteProcess.kill();
    process.exit(1);
  }

  // Launch Electron with Vite URL
  console.log('[dev] 🖥️  Launching Electron...');
  const electronProcess = spawn(bin, [], {
    cwd: root,
    stdio: ['inherit', 'inherit', 'inherit'],
    env: {
      ...process.env,
      LAIAI_PROJECT_ROOT: root,
      LAIAI_NODE_MODULES: path.join(root, 'node_modules'),
      VITE_DEV_SERVER_URL: VITE_URL,
      ELECTRON_DISABLE_SECURITY_WARNINGS: '1',
    },
  });

  electronProcess.on('error', (err) => {
    console.error('[dev] Failed to start Electron:', err.message);
    viteProcess.kill();
    process.exit(1);
  });

  electronProcess.on('exit', (code) => {
    console.log('[dev] Electron exited with code:', code);
    viteProcess.kill();
    process.exit(code || 0);
  });

  // Cleanup on signals
  function cleanup() {
    viteProcess.kill();
    electronProcess.kill();
    process.exit(0);
  }
  process.on('SIGINT', cleanup);
  process.on('SIGTERM', cleanup);
}

main();
