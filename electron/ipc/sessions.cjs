// ─── LaiaiAgent IPC: Session Management Handlers ─────────────────────────
const path = require('path');
const fs = require('fs');

function register(ctx) {
  const { ipcMain, app, getLaiaiConfigDir, loadJSON, saveJSON } = ctx;

  // ── List Sessions ──
  ipcMain.handle('list-sessions', async (_e, opts) => {
    try {
      const laiaiDir = path.join(app.getPath('userData'), 'laiai-data');
      const scanDirs = [
        path.join(laiaiDir, 'projects'),
      ].filter(d => fs.existsSync(d));
      if (!scanDirs.length) return [];

      const sessions = [];
      const seenIds = new Set();

      for (const projectsDir of scanDirs) {
        const dirs = fs.readdirSync(projectsDir).filter(d => {
          try { return fs.statSync(path.join(projectsDir, d)).isDirectory(); } catch { return false; }
        });

        for (const dir of dirs) {
          const dirPath = path.join(projectsDir, dir);
          let files;
          try { files = fs.readdirSync(dirPath).filter(f => f.endsWith('.jsonl')); } catch { continue; }

          for (const file of files) {
            const filePath = path.join(dirPath, file);
            try {
              const stat = fs.statSync(filePath);
              if (stat.size < 10) continue;

              const fd = fs.openSync(filePath, 'r');
              const readSize = Math.min(16384, stat.size);
              const buf = Buffer.alloc(readSize);
              fs.readSync(fd, buf, 0, readSize, 0);
              fs.closeSync(fd);
              const head = buf.toString('utf-8');

              let firstPrompt = '', customTitle = '', sessionId = file.replace('.jsonl', '');
              let firstAssistant = '';
              const lines = head.split('\n').filter(Boolean);
              for (const line of lines) {
                try {
                  const obj = JSON.parse(line);
                  const extractContent = (o) => {
                    const msg = o.message || o;
                    const c = msg.content;
                    if (!c) return '';
                    if (typeof c === 'string') return c.replace(/\r/g, ' ').trim();
                    if (Array.isArray(c)) return c.filter(x => x.type === 'text').map(x => x.text).join(' ').trim();
                    return '';
                  };
                  const role = obj.type || obj.role;
                  const msgRole = obj.message ? obj.message.role : obj.role;
                  if ((role === 'user' || msgRole === 'user') && !firstPrompt) {
                    firstPrompt = extractContent(obj).substring(0, 300);
                  }
                  if ((role === 'assistant' || msgRole === 'assistant') && !firstAssistant) {
                    firstAssistant = extractContent(obj).substring(0, 200);
                  }
                  if (obj.type === 'customTitle') customTitle = obj.title || '';
                  if (obj.type === 'aiTitle') customTitle = customTitle || obj.title || '';
                  if (obj.sessionId) sessionId = obj.sessionId;
                } catch {}
              }

              const title = customTitle || firstPrompt || '\u672a\u547d\u540d\u4f1a\u8bdd';
              sessions.push({
                sessionId,
                summary: title,
                preview: firstAssistant ? firstAssistant.substring(0, 150) : '',
                lastModified: stat.mtimeMs,
                fileSize: stat.size,
                projectDir: dir.replace(/-/g, path.sep),
                filePath,
              });
              seenIds.add(sessionId);
            } catch {}
          }
        }
      }

      sessions.sort((a, b) => b.lastModified - a.lastModified);
      const limit = (opts && opts.limit) || 50;
      return sessions.slice(0, limit);
    } catch (e) {
      return [];
    }
  });

  // ── Delete Session ──
  ipcMain.handle('delete-session', async (_e, { filePath }) => {
    try {
      if (!filePath) return { ok: false, error: 'No path provided' };
      const resolved = path.resolve(filePath);
      const laiaiDir = path.resolve(app.getPath('userData'), 'laiai-data');
      if (!resolved.startsWith(laiaiDir) || !resolved.endsWith('.jsonl')) {
        return { ok: false, error: 'Can only delete session files in app data directory' };
      }
      if (fs.existsSync(resolved)) {
        fs.unlinkSync(resolved);
        return { ok: true };
      }
      return { ok: false, error: 'File not found' };
    } catch (e) {
      return { ok: false, error: e.message };
    }
  });

  // ── Preview Session ──
  ipcMain.handle('preview-session', async (_e, { filePath }) => {
    try {
      if (!filePath || !fs.existsSync(filePath)) return { ok: false, error: 'File not found' };
      const resolved = path.resolve(filePath);
      const laiaiDir = path.resolve(app.getPath('userData'), 'laiai-data');
      if (!resolved.startsWith(laiaiDir)) return { ok: false, error: 'Access denied' };
      const fd = fs.openSync(filePath, 'r');
      const stat = fs.statSync(filePath);
      const readSize = Math.min(32768, stat.size);
      const buf = Buffer.alloc(readSize);
      fs.readSync(fd, buf, 0, readSize, 0);
      fs.closeSync(fd);
      const lines = buf.toString('utf-8').split('\n').filter(Boolean);
      const messages = [];
      for (const line of lines) {
        try {
          const obj = JSON.parse(line);
          const msg = obj.message || obj;
          const role = msg.role || obj.type;
          if (role === 'user' || role === 'assistant') {
            const c = msg.content;
            let content = '';
            if (typeof c === 'string') content = c.replace(/\r/g, ' ').trim();
            else if (Array.isArray(c)) content = c.filter(x => x.type === 'text').map(x => x.text).join(' ').trim();
            if (content) messages.push({ role, content: content.substring(0, 500) });
          }
        } catch {}
        if (messages.length >= 10) break;
      }
      return { ok: true, messages };
    } catch (e) {
      return { ok: false, error: e.message };
    }
  });

  // ── Tools inventory ──
  ipcMain.handle('list-tools', () => {
    return [
      { name: 'Bash', desc: 'Execute shell commands', category: 'core', icon: 'terminal' },
      { name: 'Read', desc: 'Read files from filesystem', category: 'core', icon: 'file' },
      { name: 'Edit', desc: 'Modify file contents with search-and-replace', category: 'core', icon: 'edit' },
      { name: 'Write', desc: 'Write new files to filesystem', category: 'core', icon: 'file-plus' },
      { name: 'Glob', desc: 'Fast file pattern matching', category: 'core', icon: 'search' },
      { name: 'Grep', desc: 'Search code with regex patterns', category: 'core', icon: 'search' },
      { name: 'Agent', desc: 'Spawn background agents for autonomous tasks', category: 'agent', icon: 'users' },
      { name: 'TodoWrite', desc: 'Create and manage structured task lists', category: 'task', icon: 'check-square' },
      { name: 'TaskCreate', desc: 'Create background tasks', category: 'task', icon: 'plus-square' },
      { name: 'TaskStop', desc: 'Stop running background tasks', category: 'task', icon: 'square' },
      { name: 'WebFetch', desc: 'Fetch content from URLs', category: 'web', icon: 'globe' },
      { name: 'WebSearch', desc: 'Search the web for information', category: 'web', icon: 'globe' },
      { name: 'NotebookEdit', desc: 'Edit Jupyter notebooks', category: 'code', icon: 'book' },
      { name: 'LSP', desc: 'Language Server Protocol integration', category: 'code', icon: 'code' },
      { name: 'Skill', desc: 'Execute user-defined custom skills', category: 'advanced', icon: 'zap' },
      { name: 'EnterPlanMode', desc: 'Enter plan mode for structured task plans', category: 'plan', icon: 'map' },
      { name: 'ExitPlanMode', desc: 'Exit plan mode after approval', category: 'plan', icon: 'map' },
      { name: 'EnterWorktree', desc: 'Create isolated git worktree', category: 'git', icon: 'git-branch' },
      { name: 'ExitWorktree', desc: 'Exit and optionally remove worktree', category: 'git', icon: 'git-branch' },
      { name: 'CronCreate', desc: 'Schedule prompts on cron schedule', category: 'automation', icon: 'clock' },
      { name: 'CronDelete', desc: 'Delete scheduled cron jobs', category: 'automation', icon: 'clock' },
      { name: 'CronList', desc: 'List all scheduled cron jobs', category: 'automation', icon: 'clock' },
      { name: 'RemoteTrigger', desc: 'Trigger remote agent execution', category: 'automation', icon: 'cloud' },
      { name: 'AskUserQuestion', desc: 'Ask user questions with options', category: 'interaction', icon: 'help-circle' },
      { name: 'MCPTool', desc: 'Execute MCP server tools', category: 'mcp', icon: 'server' },
      { name: 'Config', desc: 'Get or set configuration settings', category: 'system', icon: 'settings' },
      { name: 'PowerShell', desc: 'Execute PowerShell commands', category: 'core', icon: 'terminal' },
      { name: 'REPL', desc: 'Interactive code execution environment', category: 'code', icon: 'play' },
    ];
  });

  // ── CLI Settings ──
  ipcMain.handle('load-cli-settings', () => {
    const configDir = getLaiaiConfigDir();
    const settingsPath = path.join(configDir, 'settings.json');
    return loadJSON(settingsPath, {});
  });

  ipcMain.handle('save-cli-settings', (_e, settings) => {
    const configDir = getLaiaiConfigDir();
    const settingsPath = path.join(configDir, 'settings.json');
    saveJSON(settingsPath, settings);
    return { ok: true };
  });

  // ── Usage Stats ──
  ipcMain.handle('load-usage-stats', () => {
    const configDir = getLaiaiConfigDir();
    const projectsDir = path.join(configDir, 'projects');
    const stats = { totalSessions: 0, totalSize: 0, recentDays: {} };
    try {
      if (!fs.existsSync(projectsDir)) return stats;
      const dirs = fs.readdirSync(projectsDir).filter(d => {
        try { return fs.statSync(path.join(projectsDir, d)).isDirectory(); } catch { return false; }
      });
      for (const dir of dirs) {
        const dirPath = path.join(projectsDir, dir);
        try {
          const files = fs.readdirSync(dirPath).filter(f => f.endsWith('.jsonl'));
          for (const file of files) {
            try {
              const stat = fs.statSync(path.join(dirPath, file));
              stats.totalSessions++;
              stats.totalSize += stat.size;
              const day = new Date(stat.mtimeMs).toISOString().slice(0, 10);
              stats.recentDays[day] = (stats.recentDays[day] || 0) + 1;
            } catch {}
          }
        } catch {}
      }
    } catch {}
    return stats;
  });

  // ── Export Session ──
  ipcMain.handle('export-session', async (_e, { sessionData, format }) => {
    const { dialog } = require('electron');
    try {
      if (!sessionData) return { ok: false, error: 'No session data provided' };

      // Determine extension and filters
      const extMap = { json: 'json', md: 'md', docx: 'docx', pdf: 'pdf' };
      const filterMap = {
        json: [{ name: 'JSON', extensions: ['json'] }],
        md: [{ name: 'Markdown', extensions: ['md'] }],
        docx: [{ name: 'Word Document', extensions: ['docx'] }],
        pdf: [{ name: 'PDF Document', extensions: ['pdf'] }],
      };
      const ext = extMap[format] || 'md';
      const safeName = (sessionData.title || 'session').replace(/[^a-zA-Z0-9_\-\u4e00-\u9fff]/g, '_');
      const defaultName = safeName + '.' + ext;

      const result = await dialog.showSaveDialog({
        title: 'Export Session',
        defaultPath: defaultName,
        filters: filterMap[format] || filterMap.md,
      });
      if (result.canceled || !result.filePath) return { ok: false, error: 'Cancelled' };

      const msgs = sessionData.messages || [];
      const title = sessionData.title || 'Chat Session';

      // Helper: extract text from message content
      const extractText = (m) => {
        if (typeof m.content === 'string') return m.content;
        if (Array.isArray(m.content)) return m.content.filter(c => c.type === 'text').map(c => c.text).join('\n');
        return String(m.content || '');
      };

      if (format === 'json') {
        fs.writeFileSync(result.filePath, JSON.stringify(sessionData, null, 2), 'utf-8');
      } else if (format === 'docx') {
        await exportDocx(result.filePath, title, msgs, extractText, sessionData);
      } else if (format === 'pdf') {
        await exportPdf(result.filePath, title, msgs, extractText, sessionData);
      } else {
        // Markdown
        let content = '# ' + title + '\n\n';
        for (const m of msgs) {
          const role = m.role === 'user' ? 'User' : 'Assistant';
          content += '## ' + role + '\n\n' + extractText(m) + '\n\n---\n\n';
        }
        fs.writeFileSync(result.filePath, content, 'utf-8');
      }

      return { ok: true, filePath: result.filePath };
    } catch (e) {
      return { ok: false, error: e.message };
    }
  });

  // ── DOCX Export ──
  async function exportDocx(filePath, title, msgs, extractText, sessionData) {
    const docx = require('docx');
    const { Document, Packer, Paragraph, TextRun, HeadingLevel, BorderStyle, AlignmentType,
            Header, Footer, PageNumber, NumberFormat, Tab, TabStopType, TabStopPosition } = docx;

    const children = [];

    // Title
    children.push(new Paragraph({
      heading: HeadingLevel.TITLE,
      alignment: AlignmentType.CENTER,
      spacing: { after: 200 },
      children: [new TextRun({ text: title, bold: true, size: 48, font: 'Microsoft YaHei' })],
    }));

    // Metadata line
    const dateStr = new Date(sessionData.created || Date.now()).toLocaleString();
    children.push(new Paragraph({
      alignment: AlignmentType.CENTER,
      spacing: { after: 400 },
      children: [new TextRun({ text: 'Exported from LaiaiAgent · ' + dateStr, size: 18, color: '888888', font: 'Microsoft YaHei' })],
    }));

    // Messages
    for (const m of msgs) {
      const isUser = m.role === 'user';
      const roleName = isUser ? '👤 User' : '🤖 Assistant';
      const text = extractText(m);
      if (!text.trim()) continue;

      // Role header
      children.push(new Paragraph({
        heading: HeadingLevel.HEADING_2,
        spacing: { before: 300, after: 100 },
        children: [new TextRun({
          text: roleName,
          bold: true,
          size: 24,
          color: isUser ? '6C5CE7' : '00B894',
          font: 'Microsoft YaHei',
        })],
      }));

      // Message content - split by paragraphs, handle code blocks
      const lines = text.split('\n');
      let inCodeBlock = false;
      let codeBuffer = [];

      for (const line of lines) {
        if (line.startsWith('```')) {
          if (inCodeBlock) {
            // End code block - render as monospace
            children.push(new Paragraph({
              spacing: { before: 100, after: 100 },
              border: {
                top: { style: BorderStyle.SINGLE, size: 1, color: 'DDDDDD' },
                bottom: { style: BorderStyle.SINGLE, size: 1, color: 'DDDDDD' },
                left: { style: BorderStyle.SINGLE, size: 1, color: 'DDDDDD' },
                right: { style: BorderStyle.SINGLE, size: 1, color: 'DDDDDD' },
              },
              shading: { fill: 'F5F5F5' },
              children: [new TextRun({ text: codeBuffer.join('\n'), font: 'Consolas', size: 18 })],
            }));
            codeBuffer = [];
            inCodeBlock = false;
          } else {
            inCodeBlock = true;
          }
          continue;
        }

        if (inCodeBlock) {
          codeBuffer.push(line);
          continue;
        }

        // Regular text
        if (line.trim()) {
          children.push(new Paragraph({
            spacing: { after: 80 },
            children: [new TextRun({ text: line, size: 22, font: 'Microsoft YaHei' })],
          }));
        }
      }

      // Flush remaining code
      if (codeBuffer.length) {
        children.push(new Paragraph({
          spacing: { before: 100, after: 100 },
          shading: { fill: 'F5F5F5' },
          children: [new TextRun({ text: codeBuffer.join('\n'), font: 'Consolas', size: 18 })],
        }));
      }

      // Separator
      children.push(new Paragraph({
        spacing: { before: 100, after: 100 },
        border: { bottom: { style: BorderStyle.SINGLE, size: 1, color: 'E0E0E0' } },
        children: [],
      }));
    }

    // Footer with branding
    children.push(new Paragraph({
      alignment: AlignmentType.CENTER,
      spacing: { before: 600 },
      children: [new TextRun({ text: '— Generated by LaiaiAgent —', size: 16, color: 'AAAAAA', italics: true, font: 'Microsoft YaHei' })],
    }));

    const doc = new Document({
      creator: 'LaiaiAgent',
      title: title,
      description: 'Chat session exported from LaiaiAgent',
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

    const buffer = await Packer.toBuffer(doc);
    fs.writeFileSync(filePath, buffer);
  }

  // ── PDF Export (via HTML → print-to-PDF using BrowserWindow) ──
  async function exportPdf(filePath, title, msgs, extractText, sessionData) {
    const { BrowserWindow } = require('electron');
    const dateStr = new Date(sessionData.created || Date.now()).toLocaleString();

    // Build HTML
    let html = `<!DOCTYPE html><html><head><meta charset="utf-8">
<style>
  * { margin:0; padding:0; box-sizing:border-box; }
  body { font-family:'Microsoft YaHei','Segoe UI',sans-serif; padding:40px 50px; color:#222; line-height:1.6; }
  h1 { text-align:center; font-size:24px; margin-bottom:4px; color:#2d3436; }
  .meta { text-align:center; font-size:11px; color:#888; margin-bottom:30px; }
  .msg { margin-bottom:20px; page-break-inside:avoid; }
  .role { font-size:14px; font-weight:700; margin-bottom:6px; padding:4px 10px; border-radius:4px; display:inline-block; }
  .role-user { background:#6C5CE7; color:#fff; }
  .role-ai { background:#00B894; color:#fff; }
  .content { font-size:13px; padding:10px 0; white-space:pre-wrap; word-wrap:break-word; }
  pre { background:#f5f5f5; border:1px solid #e0e0e0; border-radius:6px; padding:10px; font-size:12px; font-family:Consolas,'Courier New',monospace; overflow-x:auto; margin:8px 0; }
  code { font-family:Consolas,'Courier New',monospace; background:#f0f0f0; padding:1px 4px; border-radius:3px; font-size:12px; }
  hr { border:none; border-top:1px solid #eee; margin:15px 0; }
  .footer { text-align:center; font-size:10px; color:#aaa; margin-top:40px; font-style:italic; }
</style></head><body>
<h1>${escHtml(title)}</h1>
<div class="meta">Exported from LaiaiAgent · ${escHtml(dateStr)}</div>`;

    for (const m of msgs) {
      const isUser = m.role === 'user';
      const text = extractText(m);
      if (!text.trim()) continue;
      const roleClass = isUser ? 'role-user' : 'role-ai';
      const roleLabel = isUser ? '👤 User' : '🤖 Assistant';
      // Process markdown code blocks to HTML <pre>
      const processed = text
        .replace(/```(\w*)\n([\s\S]*?)```/g, (_, lang, code) => '<pre>' + escHtml(code.trim()) + '</pre>')
        .replace(/`([^`]+)`/g, '<code>$1</code>')
        .replace(/\n/g, '<br>');
      html += `<div class="msg"><div class="role ${roleClass}">${roleLabel}</div><div class="content">${processed}</div></div><hr>`;
    }

    html += '<div class="footer">— Generated by LaiaiAgent —</div></body></html>';

    // Use hidden BrowserWindow to render PDF
    const win = new BrowserWindow({
      show: false,
      width: 800,
      height: 600,
      webPreferences: { nodeIntegration: false, contextIsolation: true },
    });

    await win.loadURL('data:text/html;charset=utf-8,' + encodeURIComponent(html));
    // Wait for rendering
    await new Promise(r => setTimeout(r, 500));
    const pdfData = await win.webContents.printToPDF({
      printBackground: true,
      pageSize: 'A4',
      margins: { top: 0.5, bottom: 0.5, left: 0.5, right: 0.5 },
    });
    fs.writeFileSync(filePath, pdfData);
    win.destroy();
  }

  function escHtml(str) {
    return String(str || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  }
}

module.exports = { register };
