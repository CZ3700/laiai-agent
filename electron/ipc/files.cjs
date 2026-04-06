// ─── LaiaiAgent IPC: File Operations Handlers ────────────────────────────
const path = require('path');
const fs = require('fs');

function register(ctx) {
  const { ipcMain, electron, app, getMainWindow, PROJECT_ROOT,
          getLaiaiConfigDir, loadJSON, saveJSON } = ctx;

  // ── Run Shell ──
  ipcMain.handle('run-shell', async (_e, opts) => {
    if (!opts || typeof opts !== 'object') return { ok: false, error: 'Invalid request' };
    const { cmd, cwd } = opts;
    if (!cmd || typeof cmd !== 'string') return { ok: false, error: 'Command is required' };
    if (cmd.length > 10000) return { ok: false, error: 'Command too long' };
    const { spawnSync } = require('child_process');
    try {
      const workDir = cwd || PROJECT_ROOT;
      const resolvedCwd = path.resolve(workDir);
      const resolvedRoot = path.resolve(PROJECT_ROOT);
      if (!resolvedCwd.startsWith(resolvedRoot) && resolvedCwd !== resolvedRoot) {
        return { ok: false, error: 'Working directory must be within project root' };
      }
      const result = spawnSync(cmd, {
        cwd: resolvedCwd,
        encoding: 'utf-8',
        timeout: 30000,
        maxBuffer: 1024 * 1024,
        shell: true,
        windowsHide: true,
      });
      if (result.error) return { ok: false, error: result.error.message };
      if (result.status !== 0) return { ok: false, error: result.stderr || `Exit code: ${result.status}`, output: result.stdout || '' };
      return { ok: true, output: (result.stdout || '').trim() };
    } catch (e) {
      return { ok: false, error: e.message };
    }
  });

  // ── Open Folder Dialog ──
  ipcMain.handle('open-folder-dialog', async () => {
    const { dialog } = electron;
    const win = getMainWindow();
    const result = await dialog.showOpenDialog(win, {
      properties: ['openDirectory'],
      title: '\u9009\u62e9\u5de5\u4f5c\u6587\u4ef6\u5939',
    });
    if (result.canceled || !result.filePaths.length) return null;
    return result.filePaths[0];
  });

  // ── List Directory ──
  ipcMain.handle('list-directory', async (_e, { dir }) => {
    const targetDir = dir || PROJECT_ROOT;
    try {
      const entries = fs.readdirSync(targetDir, { withFileTypes: true });
      const result = [];
      for (const entry of entries) {
        if (entry.name.startsWith('.') && entry.name !== '.laiai') continue;
        if (['node_modules', 'dist', '.git', '__pycache__', '.next', 'build-output', 'release'].includes(entry.name)) continue;
        const fullPath = path.join(targetDir, entry.name);
        const isDir = entry.isDirectory();
        let size = 0;
        if (!isDir) { try { size = fs.statSync(fullPath).size; } catch {} }
        const ext = isDir ? '' : path.extname(entry.name).toLowerCase();
        result.push({ name: entry.name, path: fullPath, isDir, size, ext });
      }
      result.sort((a, b) => {
        if (a.isDir !== b.isDir) return a.isDir ? -1 : 1;
        return a.name.localeCompare(b.name);
      });
      return result;
    } catch (e) {
      return [];
    }
  });

  // ── List Project Files ──
  ipcMain.handle('list-project-files', async (_e, opts) => {
    const dir = (opts && opts.dir) || PROJECT_ROOT;
    // Validate dir is within project root
    const resolvedDir = path.resolve(dir);
    const resolvedRoot = path.resolve(PROJECT_ROOT);
    if (!resolvedDir.startsWith(resolvedRoot) && resolvedDir !== resolvedRoot) {
      return [];
    }
    const { execSync } = require('child_process');
    try {
      const output = execSync('git ls-files --cached --others --exclude-standard 2>/dev/null || find . -type f -maxdepth 3 | head -200', {
        cwd: resolvedDir, encoding: 'utf-8', timeout: 10000
      });
      return output.trim().split('\n').filter(f => f.trim()).slice(0, 200);
    } catch {
      return [];
    }
  });

  // ── Read File ──
  ipcMain.handle('read-file', async (_e, opts) => {
    if (!opts || typeof opts !== 'object') return { ok: false, error: 'Invalid request' };
    const { filePath } = opts;
    if (!filePath || typeof filePath !== 'string') return { ok: false, error: 'File path is required' };
    try {
      const fullPath = path.isAbsolute(filePath) ? filePath : path.join(PROJECT_ROOT, filePath);
      // Use realpathSync to resolve symlinks — prevents symlink-based path traversal
      let resolved;
      try { resolved = fs.realpathSync(path.resolve(fullPath)); }
      catch { resolved = path.resolve(fullPath); }
      // Security: allow absolute paths (from Agent tool results) and project/userData paths
      if (!path.isAbsolute(filePath)) {
        const projectResolved = fs.realpathSync ? fs.realpathSync(path.resolve(PROJECT_ROOT)) : path.resolve(PROJECT_ROOT);
        const userDataResolved = path.resolve(app.getPath('userData'));
        if (!resolved.startsWith(projectResolved) && !resolved.startsWith(userDataResolved)) {
          return { ok: false, error: 'Cannot read outside allowed directories' };
        }
      }
      const stat = fs.statSync(resolved);
      const truncated = stat.size > 1048576;
      const content = fs.readFileSync(resolved, 'utf-8');
      return { ok: true, content: content.substring(0, 1048576), truncated, totalSize: stat.size };
    } catch (e) {
      return { ok: false, error: e.message };
    }
  });

  // ── Write File ──
  ipcMain.handle('write-file', async (_e, opts) => {
    if (!opts || typeof opts !== 'object') return { ok: false, error: 'Invalid request' };
    const { filePath, content } = opts;
    if (!filePath || typeof filePath !== 'string') return { ok: false, error: 'File path is required' };
    if (typeof content !== 'string') return { ok: false, error: 'Content must be a string' };
    if (content.length > 100 * 1024 * 1024) return { ok: false, error: 'File content too large (max 100MB)' };
    try {
      const fullPath = path.isAbsolute(filePath) ? filePath : path.join(PROJECT_ROOT, filePath);
      const resolved = path.resolve(fullPath);
      const projectResolved = path.resolve(PROJECT_ROOT);
      if (!resolved.startsWith(projectResolved)) {
        return { ok: false, error: 'Cannot write outside project directory' };
      }
      fs.writeFileSync(fullPath, content, 'utf-8');
      return { ok: true };
    } catch (e) {
      return { ok: false, error: e.message };
    }
  });

  // ── LAIAI.md ──
  ipcMain.handle('load-laiai-md', async () => {
    const candidates = ['LAIAI.md', 'CLAUDE.md'];
    for (const f of candidates) {
      const p = path.join(PROJECT_ROOT, f);
      if (fs.existsSync(p)) {
        return { ok: true, file: f, content: fs.readFileSync(p, 'utf-8') };
      }
    }
    return { ok: false, file: null };
  });

  ipcMain.handle('save-laiai-md', async (_e, { content }) => {
    const p = path.join(PROJECT_ROOT, 'LAIAI.md');
    fs.writeFileSync(p, content, 'utf-8');
    return { ok: true };
  });

  // ── Hooks ──
  ipcMain.handle('load-hooks', async () => {
    const configDir = getLaiaiConfigDir();
    const settings = loadJSON(path.join(configDir, 'settings.json'), {});
    return settings.hooks || {};
  });

  ipcMain.handle('save-hooks', async (_e, hooks) => {
    const configDir = getLaiaiConfigDir();
    const settingsPath = path.join(configDir, 'settings.json');
    const settings = loadJSON(settingsPath, {});
    settings.hooks = hooks;
    saveJSON(settingsPath, settings);
    return { ok: true };
  });

  // ── Keybindings ──
  ipcMain.handle('load-keybindings', async () => {
    const p = path.join(app.getPath('userData'), 'keybindings.json');
    const defaults = {
      quickOpen: 'Ctrl+P',
      save: 'Ctrl+S',
      closeTab: 'Ctrl+W',
      toggleTerminal: 'Ctrl+`',
      newChat: 'Ctrl+N',
      toggleSettings: 'Ctrl+,',
    };
    try {
      if (fs.existsSync(p)) {
        const data = JSON.parse(fs.readFileSync(p, 'utf-8'));
        return { ...defaults, ...data };
      }
    } catch {}
    return defaults;
  });

  ipcMain.handle('save-keybindings', async (_e, bindings) => {
    const p = path.join(app.getPath('userData'), 'keybindings.json');
    try {
      fs.writeFileSync(p, JSON.stringify(bindings, null, 2), 'utf-8');
      return { ok: true };
    } catch (e) {
      return { ok: false, error: e.message };
    }
  });

  // ── Chat Sessions (persist to disk) ──
  ipcMain.handle('load-chat-sessions', () => {
    const p = path.join(app.getPath('userData'), 'chat-sessions.json');
    return loadJSON(p, []);
  });

  ipcMain.handle('save-chat-sessions', (_e, sessions) => {
    const p = path.join(app.getPath('userData'), 'chat-sessions.json');
    saveJSON(p, sessions);
    return { ok: true };
  });

  // ── Scheduled Tasks (Cron) ──
  ipcMain.handle('list-cron-tasks', () => {
    const cronPaths = [
      path.join(PROJECT_ROOT, '.claude', 'scheduled_tasks.json'),
      path.join(getLaiaiConfigDir(), '.claude', 'scheduled_tasks.json'),
    ];
    for (const p of cronPaths) {
      try {
        if (fs.existsSync(p)) {
          const data = JSON.parse(fs.readFileSync(p, 'utf-8'));
          return Array.isArray(data) ? data : [];
        }
      } catch {}
    }
    return [];
  });

  // ── Image Gallery ──
  ipcMain.handle('list-gallery-images', () => {
    const os = require('os');
    const imgDir = path.join(os.tmpdir(), 'laiai-images');
    try {
      if (!fs.existsSync(imgDir)) return [];
      const files = fs.readdirSync(imgDir)
        .filter(f => f.match(/\.(png|jpg|jpeg|gif|webp)$/i))
        .map(f => {
          const filePath = path.join(imgDir, f);
          const stat = fs.statSync(filePath);
          return {
            name: f,
            path: filePath,
            url: 'file:///' + filePath.replace(/\\/g, '/'),
            size: stat.size,
            created: stat.mtimeMs,
          };
        })
        .sort((a, b) => b.created - a.created); // newest first
      return files;
    } catch { return []; }
  });

  ipcMain.handle('delete-gallery-image', (_e, { filePath }) => {
    try {
      const os = require('os');
      const imgDir = path.join(os.tmpdir(), 'laiai-images');
      const resolved = path.resolve(filePath);
      if (!resolved.startsWith(imgDir)) return { ok: false, error: 'Invalid path' };
      fs.unlinkSync(resolved);
      return { ok: true };
    } catch (e) { return { ok: false, error: e.message }; }
  });

  // ── NPM Registry Search ──
  ipcMain.handle('npm-search', async (_e, { query, size }) => {
    const https = require('https');
    const searchSize = Math.min(size || 20, 50);
    // Search for MCP servers and tools
    const searchQuery = encodeURIComponent(query || 'mcp server');
    const url = `https://registry.npmjs.org/-/v1/search?text=${searchQuery}&size=${searchSize}`;

    return new Promise((resolve) => {
      const req = https.get(url, { timeout: 10000 }, (res) => {
        const chunks = [];
        res.on('data', c => chunks.push(c));
        res.on('end', () => {
          try {
            const data = JSON.parse(Buffer.concat(chunks).toString('utf-8'));
            const results = (data.objects || []).map(obj => ({
              name: obj.package?.name || '',
              description: obj.package?.description || '',
              version: obj.package?.version || '',
              downloads: obj.downloads?.monthly || 0,
              homepage: obj.package?.links?.homepage || '',
              npm: obj.package?.links?.npm || '',
              keywords: obj.package?.keywords || [],
              license: obj.package?.license || '',
            }));
            resolve({ ok: true, results, total: data.total || 0 });
          } catch (e) {
            resolve({ ok: false, error: 'Parse error', results: [] });
          }
        });
      });
      req.on('error', (e) => resolve({ ok: false, error: e.message, results: [] }));
      req.on('timeout', () => { req.destroy(); resolve({ ok: false, error: 'Timeout', results: [] }); });
    });
  });

  // ── Generate PPT ──
  ipcMain.handle('generate-ppt', async (_e, { slides, title, theme }) => {
    const { dialog } = require('electron');
    try {
      const PptxGenJS = require('pptxgenjs');
      const pptx = new PptxGenJS();
      pptx.author = 'LaiaiAgent';
      pptx.company = '莱艾科技 LAIAI';
      pptx.title = title || 'Presentation';
      pptx.subject = 'Generated by LaiaiAgent';

      // Theme colors
      const themes = {
        blue: { bg: '1A1A2E', accent: '6C5CE7', text: 'FFFFFF', subtitle: 'B0B0E0' },
        green: { bg: '0D1B2A', accent: '00B894', text: 'FFFFFF', subtitle: '90D5C4' },
        purple: { bg: '1E1040', accent: 'A855F7', text: 'FFFFFF', subtitle: 'C4A5F7' },
        light: { bg: 'FFFFFF', accent: '3B82F6', text: '1F2937', subtitle: '6B7280' },
        dark: { bg: '111111', accent: 'F59E0B', text: 'FFFFFF', subtitle: 'AAAAAA' },
      };
      const t = themes[theme] || themes.blue;

      // Title slide
      const titleSlide = pptx.addSlide();
      titleSlide.background = { color: t.bg };
      titleSlide.addText(title || 'Presentation', {
        x: 0.8, y: 1.5, w: 8.4, h: 1.5,
        fontSize: 36, bold: true, color: t.text,
        fontFace: 'Microsoft YaHei',
        align: 'center',
      });
      titleSlide.addText('Generated by LaiaiAgent', {
        x: 0.8, y: 3.2, w: 8.4, h: 0.6,
        fontSize: 14, color: t.subtitle, italic: true,
        fontFace: 'Microsoft YaHei',
        align: 'center',
      });
      // Accent bar
      titleSlide.addShape(pptx.shapes.RECTANGLE, {
        x: 3.5, y: 3.0, w: 3.0, h: 0.05,
        fill: { color: t.accent },
      });

      // Content slides
      for (let i = 0; i < (slides || []).length; i++) {
        const s = slides[i];
        const slide = pptx.addSlide();
        slide.background = { color: t.bg };

        // Slide number
        slide.addText(String(i + 1), {
          x: 9.0, y: 6.8, w: 0.8, h: 0.4,
          fontSize: 10, color: t.subtitle, align: 'right',
        });

        // Accent top bar
        slide.addShape(pptx.shapes.RECTANGLE, {
          x: 0, y: 0, w: 10, h: 0.06,
          fill: { color: t.accent },
        });

        // Title
        slide.addText(s.title || '', {
          x: 0.8, y: 0.4, w: 8.4, h: 0.8,
          fontSize: 24, bold: true, color: t.text,
          fontFace: 'Microsoft YaHei',
        });

        // Body content
        if (s.bullets && s.bullets.length) {
          const bulletText = s.bullets.map(b => ({
            text: b, options: { bullet: { code: '25CF', color: t.accent }, fontSize: 16, color: t.text, paraSpaceAfter: 8 }
          }));
          slide.addText(bulletText, {
            x: 0.8, y: 1.5, w: 8.4, h: 4.5,
            fontFace: 'Microsoft YaHei',
            valign: 'top',
          });
        } else if (s.content) {
          slide.addText(s.content, {
            x: 0.8, y: 1.5, w: 8.4, h: 4.5,
            fontSize: 16, color: t.text,
            fontFace: 'Microsoft YaHei',
            valign: 'top',
          });
        }

        // Speaker notes
        if (s.notes) {
          slide.addNotes(s.notes);
        }
      }

      // End slide
      const endSlide = pptx.addSlide();
      endSlide.background = { color: t.bg };
      endSlide.addText('Thank You', {
        x: 0.8, y: 2.0, w: 8.4, h: 1.2,
        fontSize: 36, bold: true, color: t.text,
        fontFace: 'Microsoft YaHei',
        align: 'center',
      });
      endSlide.addText('Powered by LaiaiAgent · laiai.ai', {
        x: 0.8, y: 3.5, w: 8.4, h: 0.6,
        fontSize: 12, color: t.subtitle, italic: true,
        fontFace: 'Microsoft YaHei',
        align: 'center',
      });

      // Save
      const safeName = (title || 'presentation').replace(/[^a-zA-Z0-9_\-\u4e00-\u9fff]/g, '_');
      const result = await dialog.showSaveDialog({
        title: 'Save Presentation',
        defaultPath: safeName + '.pptx',
        filters: [{ name: 'PowerPoint', extensions: ['pptx'] }],
      });
      if (result.canceled || !result.filePath) return { ok: false, error: 'Cancelled' };

      await pptx.writeFile({ fileName: result.filePath });
      return { ok: true, filePath: result.filePath };
    } catch (e) {
      return { ok: false, error: e.message };
    }
  });

  // ── Generate Document (DOCX from structured content) ──
  ipcMain.handle('generate-doc', async (_e, { sections, title, format }) => {
    const { dialog } = require('electron');
    try {
      const docx = require('docx');
      const { Document, Packer, Paragraph, TextRun, HeadingLevel, AlignmentType,
              Header, Footer, PageNumber, BorderStyle } = docx;

      const children = [];

      // Title
      children.push(new Paragraph({
        heading: HeadingLevel.TITLE,
        alignment: AlignmentType.CENTER,
        spacing: { after: 300 },
        children: [new TextRun({ text: title || 'Document', bold: true, size: 48, font: 'Microsoft YaHei' })],
      }));

      // Date
      children.push(new Paragraph({
        alignment: AlignmentType.CENTER,
        spacing: { after: 400 },
        children: [new TextRun({ text: new Date().toLocaleDateString(), size: 20, color: '888888' })],
      }));

      // Sections
      for (const sec of (sections || [])) {
        // Section heading
        children.push(new Paragraph({
          heading: HeadingLevel.HEADING_1,
          spacing: { before: 400, after: 200 },
          children: [new TextRun({ text: sec.heading || '', bold: true, size: 28, font: 'Microsoft YaHei' })],
        }));

        // Paragraphs
        for (const para of (sec.paragraphs || [])) {
          children.push(new Paragraph({
            spacing: { after: 120 },
            children: [new TextRun({ text: para, size: 22, font: 'Microsoft YaHei' })],
          }));
        }

        // Bullet items
        for (const item of (sec.bullets || [])) {
          children.push(new Paragraph({
            bullet: { level: 0 },
            spacing: { after: 80 },
            children: [new TextRun({ text: item, size: 22, font: 'Microsoft YaHei' })],
          }));
        }
      }

      // Footer
      children.push(new Paragraph({
        alignment: AlignmentType.CENTER,
        spacing: { before: 600 },
        children: [new TextRun({ text: '— Generated by LaiaiAgent —', size: 16, color: 'AAAAAA', italics: true })],
      }));

      const doc = new Document({
        creator: 'LaiaiAgent',
        title: title || 'Document',
        sections: [{
          properties: {
            page: { margin: { top: 1440, right: 1440, bottom: 1440, left: 1440 } },
          },
          headers: {
            default: new Header({
              children: [new Paragraph({
                alignment: AlignmentType.RIGHT,
                children: [new TextRun({ text: 'LaiaiAgent', size: 16, color: 'BBBBBB', italics: true })],
              })],
            }),
          },
          footers: {
            default: new Footer({
              children: [new Paragraph({
                alignment: AlignmentType.CENTER,
                children: [new TextRun({ children: [PageNumber.CURRENT], size: 16, color: 'BBBBBB' })],
              })],
            }),
          },
          children,
        }],
      });

      const safeName = (title || 'document').replace(/[^a-zA-Z0-9_\-\u4e00-\u9fff]/g, '_');
      const result = await dialog.showSaveDialog({
        title: 'Save Document',
        defaultPath: safeName + '.docx',
        filters: [{ name: 'Word Document', extensions: ['docx'] }],
      });
      if (result.canceled || !result.filePath) return { ok: false, error: 'Cancelled' };

      const buffer = await Packer.toBuffer(doc);
      fs.writeFileSync(result.filePath, buffer);
      return { ok: true, filePath: result.filePath };
    } catch (e) {
      return { ok: false, error: e.message };
    }
  });
}

module.exports = { register };
