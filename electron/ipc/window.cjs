// ─── LaiaiAgent IPC: Window Control Handlers ─────────────────────────────

function register(ctx) {
  const { ipcMain, getMainWindow } = ctx;

  const safeWin = () => {
    const w = getMainWindow();
    return w && !w.isDestroyed() ? w : null;
  };

  ipcMain.on('win-minimize', () => { const w = safeWin(); if (w) w.minimize(); });
  ipcMain.on('win-maximize', () => { const w = safeWin(); if (w) { w.isMaximized() ? w.unmaximize() : w.maximize(); } });
  ipcMain.on('win-close', () => { const w = safeWin(); if (w) w.close(); });
}

module.exports = { register };
