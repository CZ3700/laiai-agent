#!/usr/bin/env node
/**
 * LaiaiAgent Dev Mode — 热更新开发模式
 *
 * 用法: node dev.cjs
 *
 * 将 electron/ 目录下的文件同步到已打包的应用中，然后启动。
 * 修改文件后重新运行此脚本即可看到变化，无需重新打包。
 */
const { spawn } = require('child_process');
const path = require('path');
const fs = require('fs');

const root = __dirname;
const buildApp = path.join(root, 'build-output', 'win-unpacked', 'resources', 'app');
const exe = path.join(root, 'build-output', 'win-unpacked', 'LaiaiAgent.exe');

if (!fs.existsSync(exe)) {
  console.error('❌ LaiaiAgent.exe not found. Run first:');
  console.error('   npx electron-builder --win dir --config.directories.output=build-output --config.electronVersion=33.2.1 --config.asar=false');
  process.exit(1);
}

// ─── Sync files ───
function copyDir(src, dst) {
  if (!fs.existsSync(src)) return;
  if (!fs.existsSync(dst)) fs.mkdirSync(dst, { recursive: true });
  for (const f of fs.readdirSync(src)) {
    const s = path.join(src, f), d = path.join(dst, f);
    if (fs.statSync(s).isDirectory()) copyDir(s, d);
    else fs.copyFileSync(s, d);
  }
}

console.log('📦 Syncing files...');

// Copy main electron files
const electronDir = path.join(root, 'electron');
for (const f of ['main.cjs', 'preload.cjs', 'index.html', 'icon.png', 'icon.ico']) {
  const src = path.join(electronDir, f);
  const dst = path.join(buildApp, 'electron', f);
  if (fs.existsSync(src)) {
    const dstDir = path.dirname(dst);
    if (!fs.existsSync(dstDir)) fs.mkdirSync(dstDir, { recursive: true });
    fs.copyFileSync(src, dst);
    console.log('  ✓', f);
  }
}

// Copy IPC modules (P7 split)
copyDir(path.join(electronDir, 'ipc'), path.join(buildApp, 'electron', 'ipc'));
console.log('  ✓ ipc/');

// Copy renderer directory (Phase 1 split)
copyDir(path.join(electronDir, 'renderer'), path.join(buildApp, 'electron', 'renderer'));
console.log('  ✓ renderer/');

// Copy vendor & assets (legacy fallback)
copyDir(path.join(electronDir, 'vendor'), path.join(buildApp, 'electron', 'vendor'));
copyDir(path.join(electronDir, 'assets'), path.join(buildApp, 'electron', 'assets'));
console.log('  ✓ vendor/ & assets/');

// Copy config
const configSrc = path.join(root, 'config');
if (fs.existsSync(configSrc)) {
  copyDir(configSrc, path.join(buildApp, 'config'));
  console.log('  ✓ config/');
}

console.log('✅ Sync complete!\n');
console.log('🚀 Launching LaiaiAgent...\n');

// ─── Launch ───
const child = spawn(exe, [], {
  cwd: root,
  stdio: 'inherit',
  detached: true,
  env: {
    ...process.env,
    LAIAI_PROJECT_ROOT: root,
  },
});

child.unref();

// Don't wait for the GUI process
setTimeout(() => {
  console.log('✅ LaiaiAgent is running. Close this terminal if needed.');
  process.exit(0);
}, 2000);
