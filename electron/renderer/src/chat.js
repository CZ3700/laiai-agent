// ═══ CHAT SESSION + MESSAGING ═══
import { state } from './state.js';
import { t } from './i18n.js';
import { toast, esc, formatChatText, autoResize, scrollChat, highlightCode, friendlyError } from './utils.js';
import { openSettings, sdTab } from './settings.js';
import { startTerm, setTermMode, applyTermMode } from './terminal.js';
import { persistProvs } from './providers.js';

// ═══ AGENT MODE ═══
// When enabled, chat messages are routed through the CLI Agent engine
// which has 29+ tools (Bash, Read, Edit, Write, WebSearch, etc.)
// instead of direct /v1/chat/completions API calls.

let _agentStarted = false;
let _agentFullContent = '';  // Accumulates text from agent stream
let _agentSessionId = null;  // Which chat session initiated the current Agent request
let _pendingGenerate = null; // {type:'ppt'|'doc', topic:string} — auto-generate after Agent responds

async function ensureAgentStarted() {
  if (_agentStarted) return true;
  // Reload providers from state in case they were added after init
  if (!state.providers.length) {
    try {
      const pd = await electronAPI.loadProviders();
      if (pd && pd.providers) state.providers = pd.providers;
    } catch {}
  }
  const prov = state.providers.find(p => p.isDefault) || state.providers[0];
  if (!prov) {
    toast(t('err.no_provider'), 'error');
    return false;
  }
  if (!prov.baseUrl || !prov.apiKey) {
    toast(t('err.no_api_key'), 'error');
    return false;
  }
  const r = await electronAPI.agentStart({
    provider: { baseUrl: prov.baseUrl, apiKey: prov.apiKey, defaultModel: prov.defaultModel || '' },
  });
  if (r.ok) {
    _agentStarted = true;
    setupAgentListeners();
    return true;
  }
  toast(t('err.connection_refused') + (r.error ? ': ' + friendlyError(r.error) : ''), 'error');
  return false;
}

function setupAgentListeners() {
  electronAPI.offAgent();
  electronAPI.onAgentMessage((msg) => {
    handleAgentMessage(msg);
  });
  electronAPI.onAgentStatus((st) => {
    if (st.type === 'exited') {
      _agentStarted = false;
      state.isStreaming = false;
      _showSendButton();
      updateStatusBar('ready');
    }
  });
}

function handleAgentMessage(msg) {
  // Use the session that initiated the request, not the currently active one
  const sessionId = _agentSessionId || state.activeChatId;
  const session = state.chatSessions.find(c => c.id === sessionId);
  if (!session) return;
  // Only do DOM operations if this session is currently displayed
  const isVisible = sessionId === state.activeChatId;

  switch (msg.type) {
    case 'assistant': {
      // Assistant message with text and/or tool_use blocks
      const content = msg.message?.content || msg.content || [];
      const blocks = Array.isArray(content) ? content : [{ type: 'text', text: String(content) }];

      for (const block of blocks) {
        if (block.type === 'text' && block.text) {
          // Accumulate text, strip system-reminder tags
          const cleanText = block.text.replace(/<system-reminder>[\s\S]*?<\/system-reminder>/g, '').trim();
          if (!cleanText) continue;
          _agentFullContent += cleanText;
          if (isVisible) {
            const el = document.getElementById('stream-bubble');
            if (el) { el.innerHTML = formatChatText(_agentFullContent); scrollChat(); }
          }
        } else if (block.type === 'tool_use') {
          if (isVisible) finalizeStreamBubble(session);
          if (isVisible) addToolCallCard(block.name, block.input, block.id);
          // Save tool_use to session for restoration on re-render
          session.messages.push({ role: 'tool_use', name: block.name, input: block.input, toolId: block.id });
        }
      }
      break;
    }

    case 'tool_result': {
      // Show tool result
      addToolResultCard(msg.tool_use_id, msg.content);
      // Start new stream bubble for next assistant text
      startNewStreamBubble();
      break;
    }

    case 'result': {
      if (msg.result && !_agentFullContent.trim()) {
        _agentFullContent = msg.result;
      }
      if (isVisible) finalizeStreamBubble(session);
      state.isStreaming = false;
      if (isVisible) _showSendButton();

      const isError = msg.is_error || msg.subtype === 'error_during_execution' || msg.subtype === 'error_max_turns';
      updateStatusBar(isError ? 'error' : 'connected');
      debouncedSaveSessions();
      _agentSessionId = null; // Clear session binding

      // Auto-generate PPT/Doc if pending
      if (_pendingGenerate && !isError) {
        const gen = _pendingGenerate;
        _pendingGenerate = null;
        // Find the last assistant message content
        const lastMsg = session.messages.filter(m => m.role === 'assistant').pop();
        const text = lastMsg?.content || _agentFullContent || msg.result || '';
        if (text) {
          setTimeout(async () => {
            try {
              if (gen.type === 'ppt') {
                const jsonMatch = text.match(/\[[\s\S]*\]/);
                if (jsonMatch) {
                  const slides = JSON.parse(jsonMatch[0]);
                  toast(t('chat.ppt_generating'), 'info');
                  const result = await electronAPI.generatePpt({ slides, title: gen.topic, theme: 'blue' });
                  if (result.ok) { addChatMsg('ai', '✅ ' + t('chat.ppt_done') + '\n📁 ' + result.filePath, session.messages.length); }
                  else if (result.error !== 'Cancelled') { addChatMsg('ai', '⚠️ ' + t('chat.ppt_fail') + ': ' + friendlyError(result.error), session.messages.length); }
                }
              } else if (gen.type === 'email') {
                const jsonMatch = text.match(/\{[\s\S]*\}/);
                if (jsonMatch) {
                  const emailData = JSON.parse(jsonMatch[0]);
                  // Load SMTP config
                  const smtp = await electronAPI.loadSmtpConfig();
                  if (!smtp || !smtp.host) {
                    addChatMsg('ai', '⚠️ ' + t('email.not_configured'), session.messages.length);
                  } else {
                    toast(t('email.sending'), 'info');
                    const result = await electronAPI.sendEmail({
                      smtp, from: smtp.from || smtp.user,
                      to: emailData.to, subject: emailData.subject, body: emailData.body,
                    });
                    if (result.ok) {
                      addChatMsg('ai', '✅ ' + t('email.sent') + '\n📧 To: ' + emailData.to + '\n📋 ' + emailData.subject, session.messages.length);
                    } else {
                      addChatMsg('ai', '⚠️ ' + t('email.send_fail') + ': ' + friendlyError(result.error), session.messages.length);
                    }
                  }
                }
              } else {
                const jsonMatch = text.match(/\{[\s\S]*\}/);
                if (jsonMatch) {
                  const docData = JSON.parse(jsonMatch[0]);
                  toast(t('chat.doc_generating'), 'info');
                  const result = await electronAPI.generateDoc({ sections: docData.sections || [], title: docData.title || gen.topic });
                  if (result.ok) { addChatMsg('ai', '✅ ' + t('chat.doc_done') + '\n📁 ' + result.filePath, session.messages.length); }
                  else if (result.error !== 'Cancelled') { addChatMsg('ai', '⚠️ ' + t('chat.doc_fail') + ': ' + friendlyError(result.error), session.messages.length); }
                }
              }
            } catch (e) { addChatMsg('ai', '⚠️ ' + friendlyError(e.message), session.messages.length); }
          }, 500);
        }
      }

      if (isError && !msg.result) {
        if (isVisible) addErrorCard('Agent Error', msg.error || 'Agent stopped', session);
      }

      // If user switched away during generation, re-render the target session when they come back
      if (!isVisible) {
        // Session data is saved, it will render correctly when user switches back
      }

      // Show usage info in status bar if available
      if (msg.total_cost_usd > 0) {
        try {
          document.getElementById('sb-model').textContent =
            (state.providers.find(p=>p.isDefault)?.defaultModel || '--') +
            ' ($' + msg.total_cost_usd.toFixed(4) + ')';
        } catch {}
      }
      break;
    }

    case 'user': {
      // User messages may contain tool_result blocks (from Agent tool execution)
      const userContent = msg.message?.content || [];
      if (Array.isArray(userContent)) {
        for (const block of userContent) {
          if (block.type === 'tool_result') {
            if (isVisible) addToolResultCard(block.tool_use_id, block.content, block.is_error, msg.tool_use_result);
            const resultText = typeof block.content === 'string' ? block.content :
              (Array.isArray(block.content) ? block.content.filter(c=>c.type==='text').map(c=>c.text).join('\n') : '');
            session.messages.push({ role: 'tool_result', toolId: block.tool_use_id, content: resultText, isError: block.is_error, structured: msg.tool_use_result });
            if (isVisible) startNewStreamBubble();
          }
        }
      }
      // Otherwise it's a replay echo — ignore
      break;
    }

    case 'system': {
      if (msg.subtype === 'init') {
        // Agent initialized — update status bar with actual model
        try {
          document.getElementById('sb-model').textContent = msg.model || '--';
          document.getElementById('sb-status').textContent = 'Agent Ready';
          document.getElementById('sb-dot').style.background = 'var(--green)';
        } catch {}
      }
      break;
    }

    default:
      break;
  }
}

function finalizeStreamBubble(session) {
  const el = document.getElementById('stream-bubble');
  if (el && _agentFullContent.trim()) {
    el.removeAttribute('id');
    // Check if content looks like an error — make it friendly
    const content = _agentFullContent;
    const isErrorContent = /Failed to authenticate|API Error|ERR_|ECONNREFUSED|401|403|500/.test(content);
    if (isErrorContent) {
      el.innerHTML = formatChatText(friendlyError(content));
      el.closest('.chat-msg')?.classList.add('error-msg');
    } else {
      el.innerHTML = formatChatText(content);
    }
    session.messages.push({ role: 'assistant', content });
    _agentFullContent = '';
  } else if (el && !_agentFullContent.trim()) {
    el.remove();
    _agentFullContent = '';
  }
}

function startNewStreamBubble() {
  _agentFullContent = '';
  const bubble = addChatMsg('ai', '');
  bubble.id = 'stream-bubble';
}

export function answerAgentQuestion(toolUseId, answer) {
  // Send the answer as a new user message — Agent will pick it up as context
  const input = document.getElementById('tw-input');
  if (input) {
    input.value = answer;
    sendChat();
  }
  // Update the card to show the answer was given
  const card = document.getElementById('tool-' + toolUseId);
  if (card) {
    const status = card.querySelector('.tool-card-status');
    if (status) { status.textContent = '✓'; status.className = 'tool-card-status done'; }
    // Disable buttons
    card.querySelectorAll('.tool-ask-btn').forEach(b => { b.disabled = true; b.style.opacity = '0.5'; });
  }
}

// ═══ IMAGE GALLERY ═══
export async function toggleGallery() {
  let overlay = document.getElementById('gallery-overlay');
  if (overlay) {
    overlay.remove();
    return;
  }

  const images = await electronAPI.listGalleryImages().catch(() => []);

  overlay = document.createElement('div');
  overlay.id = 'gallery-overlay';
  overlay.className = 'gallery-overlay';
  overlay.onclick = (e) => { if (e.target === overlay) overlay.remove(); };

  let html = '<div class="gallery-panel">' +
    '<div class="gallery-header">' +
      '<h3>🖼️ 图片画廊</h3>' +
      '<span class="gallery-count">' + images.length + ' 张图片</span>' +
      '<button class="sd-close" onclick="document.getElementById(\'gallery-overlay\').remove()">✕</button>' +
    '</div>';

  if (!images.length) {
    html += '<div class="gallery-empty">暂无生成的图片<br>在聊天中输入「画一张...」开始创作</div>';
  } else {
    html += '<div class="gallery-grid">';
    for (const img of images) {
      const date = new Date(img.created);
      const timeStr = date.toLocaleDateString() + ' ' + date.toLocaleTimeString([], {hour:'2-digit',minute:'2-digit'});
      const sizeStr = (img.size / 1024).toFixed(0) + ' KB';
      html += '<div class="gallery-item">' +
        '<div class="gallery-img-wrap">' +
          '<img src="' + esc(img.url) + '" loading="lazy" onclick="window.open(\'' + esc(img.url) + '\',\'_blank\')">' +
          '<span class="gen-image-badge">AI 生成</span>' +
        '</div>' +
        '<div class="gallery-item-info">' +
          '<span class="gallery-item-time">' + esc(timeStr) + '</span>' +
          '<span class="gallery-item-size">' + esc(sizeStr) + '</span>' +
        '</div>' +
        '<div class="gallery-item-actions">' +
          '<button class="gen-action-btn" onclick="downloadGalleryImage(\'' + esc(img.url) + '\')">⬇️</button>' +
          '<button class="gen-action-btn" onclick="deleteGalleryImage(\'' + esc(img.path).replace(/\\/g,'\\\\') + '\')">🗑️</button>' +
        '</div>' +
      '</div>';
    }
    html += '</div>';
  }
  html += '</div>';
  overlay.innerHTML = html;
  document.body.appendChild(overlay);
}

export function downloadGalleryImage(url) {
  const a = document.createElement('a');
  a.href = url;
  a.download = 'laiai-image-' + Date.now() + '.png';
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
}

export async function deleteGalleryImage(filePath) {
  if (!confirm('删除这张图片？')) return;
  await electronAPI.deleteGalleryImage({ filePath });
  toast(t('toast.deleted'));
  toggleGallery(); // Close and reopen to refresh
  setTimeout(() => toggleGallery(), 100);
}

export function downloadTtsAudio(audioId, format) {
  const audio = document.getElementById(audioId);
  if (!audio) return;
  const a = document.createElement('a');
  a.href = audio.src;
  a.download = 'laiai-audio-' + Date.now() + '.' + (format || 'mp3');
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  toast('Audio downloaded');
}

export function downloadGenImage(imgId) {
  const img = document.getElementById(imgId);
  if (!img) return;
  const src = img.src;
  // Create a download link
  const a = document.createElement('a');
  a.href = src;
  a.download = 'laiai-image-' + Date.now() + '.png';
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  toast('Image downloaded');
}

function makeFileLink(icon, filePath) {
  const fileName = filePath.split(/[/\\]/).pop();
  // Use data attributes to avoid backslash escaping issues in onclick
  return '<span class="tool-param-file tool-file-link" data-filepath="' + esc(filePath) + '" data-filename="' + esc(fileName) + '" onclick="openFileInEditor(this.dataset.filepath,this.dataset.filename);switchMode(\'ide\')" title="Open in IDE">' + icon + ' ' + esc(filePath) + '</span>';
}

function addToolCallCard(toolName, toolInput, toolUseId) {
  const container = document.getElementById('chat-messages');
  const card = document.createElement('div');
  card.className = 'tool-call-card';
  card.id = 'tool-' + toolUseId;

  const iconMap = {
    bash: '▸_', read: '📄', edit: '✏️', write: '📝',
    glob: '🔍', grep: '🔎', web_search: '🌐', web_fetch: '🌍',
    agent: '🤖', todo_write: '☑️', mcp_tool_use: '🔧',
    notebook_edit: '📓', skill: '⚡',
  };
  const icon = iconMap[toolName.toLowerCase()] || '⚙️';

  // Smart parameter preview based on tool type
  const name = toolName.toLowerCase();
  let paramPreview = '';
  if (name === 'bash' && toolInput?.command) {
    paramPreview = '<code class="tool-param-cmd">' + esc(toolInput.command) + '</code>';
  } else if (name === 'read' && toolInput?.file_path) {
    paramPreview = makeFileLink('📄', toolInput.file_path);
  } else if (name === 'edit' && toolInput?.file_path) {
    paramPreview = makeFileLink('✏️', toolInput.file_path);
    if (toolInput.old_string && toolInput.new_string) {
      paramPreview += '<div class="tool-diff-preview">' +
        '<div class="tool-diff-old"><span class="tool-diff-label">−</span><code>' + esc(toolInput.old_string.substring(0, 300)) + '</code></div>' +
        '<div class="tool-diff-new"><span class="tool-diff-label">+</span><code>' + esc(toolInput.new_string.substring(0, 300)) + '</code></div>' +
        '</div>';
    }
  } else if (name === 'write' && toolInput?.file_path) {
    paramPreview = makeFileLink('📝', toolInput.file_path);
  } else if ((name === 'glob' || name === 'grep') && (toolInput?.pattern || toolInput?.path)) {
    paramPreview = '<code class="tool-param-cmd">' + esc(toolInput.pattern || '') + '</code>' +
      (toolInput.path ? ' <span class="tool-param-dim">in ' + esc(toolInput.path) + '</span>' : '');
  } else if (name === 'web_search' && toolInput?.query) {
    paramPreview = '🔎 <em>' + esc(toolInput.query) + '</em>';
  } else if (name === 'web_fetch' && toolInput?.url) {
    paramPreview = '🌍 ' + esc(toolInput.url.substring(0, 80));
  } else if (name === 'askuserquestion' && toolInput?.questions) {
    // Render as interactive question card
    const q = toolInput.questions[0] || {};
    paramPreview = '<div class="tool-ask-question">' +
      (q.header ? '<div class="tool-ask-header">' + esc(q.header) + '</div>' : '') +
      '<div class="tool-ask-text">' + esc(q.question || '') + '</div>';
    if (q.options && q.options.length) {
      paramPreview += '<div class="tool-ask-options">';
      for (const opt of q.options) {
        const label = typeof opt === 'string' ? opt : opt.label || opt.value || '';
        const value = typeof opt === 'string' ? opt : opt.value || opt.label || '';
        paramPreview += '<button class="btn btn-s btn-sm tool-ask-btn" onclick="answerAgentQuestion(\'' + esc(toolUseId) + '\',\'' + esc(value).replace(/'/g, "\\'") + '\')">' + esc(label) + '</button>';
      }
      paramPreview += '</div>';
    } else {
      // Free text input
      paramPreview += '<div class="tool-ask-options">' +
        '<input class="sd-select" id="ask-input-' + esc(toolUseId) + '" placeholder="Type your answer..." style="flex:1;min-width:200px">' +
        '<button class="btn btn-p btn-sm" onclick="answerAgentQuestion(\'' + esc(toolUseId) + '\',document.getElementById(\'ask-input-' + esc(toolUseId) + '\').value)">Send</button>' +
        '</div>';
    }
    paramPreview += '</div>';
  } else if (toolInput) {
    const preview = typeof toolInput === 'string' ? toolInput : JSON.stringify(toolInput, null, 2);
    paramPreview = '<code class="tool-param-cmd">' + esc(preview.substring(0, 150)) + '</code>';
  }

  // Full params in collapsible details
  const fullParams = typeof toolInput === 'string'
    ? toolInput
    : JSON.stringify(toolInput, null, 2);

  const isImageTool = name.includes('image') || name.includes('generate_image');
  card.innerHTML =
    '<div class="tool-card-header">' +
      '<span class="tool-card-icon">' + icon + '</span>' +
      '<span class="tool-card-name">' + esc(toolName) + '</span>' +
      '<span class="tool-card-status running">⟳</span>' +
    '</div>' +
    (paramPreview ? '<div class="tool-card-preview">' + paramPreview + '</div>' : '') +
    (isImageTool ? '<div class="tool-gen-hint">🎨 正在生成图片，请稍候...</div>' : '') +
    '<details class="tool-card-details"><summary>Full Parameters</summary>' +
      '<pre class="tool-card-input"><code>' + esc(fullParams.substring(0, 1000)) + '</code></pre>' +
    '</details>';

  container.appendChild(card);
  scrollChat();
}

function addToolResultCard(toolUseId, content, isErrorFlag, structuredResult) {
  const card = document.getElementById('tool-' + toolUseId);
  if (!card) return;

  // Extract result text and filter out system-reminder tags
  let resultText = typeof content === 'string'
    ? content
    : (Array.isArray(content)
      ? content.filter(c => c.type === 'text').map(c => c.text).join('\n')
      : JSON.stringify(content));
  // Strip <system-reminder>...</system-reminder> blocks injected by the Agent engine
  if (resultText) {
    resultText = resultText.replace(/<system-reminder>[\s\S]*?<\/system-reminder>/g, '').trim();
  }

  // Determine error state
  const isError = isErrorFlag ||
    (typeof content === 'string' && (content.startsWith('Error:') || content.includes('ENOENT')));

  // Update status icon
  const status = card.querySelector('.tool-card-status');
  if (status) {
    status.textContent = isError ? '✗' : '✓';
    status.className = 'tool-card-status ' + (isError ? 'error' : 'done');
  }

  if (!resultText && !structuredResult) return;

  const toolName = (card.querySelector('.tool-card-name')?.textContent || '').toLowerCase();
  const resultEl = document.createElement('div');
  resultEl.className = 'tool-card-result-wrap';

  // Copy button helper — stores text in a data attribute on the card
  const copyId = 'tcopy-' + toolUseId;
  const copyBtn = '<button class="tool-copy-btn" onclick="navigator.clipboard.writeText(document.getElementById(\'' + copyId + '\').textContent).then(()=>toast(\'Copied\'))" title="Copy">📋</button>';

  // ── Error ──
  if (isError) {
    resultEl.innerHTML = '<div class="tool-result-error">' + esc((resultText || '').substring(0, 500)) + '</div>';
  }
  // ── Bash: use stdout/stderr from structured result ──
  else if (toolName === 'bash' && structuredResult?.stdout !== undefined) {
    const output = structuredResult.stdout || '';
    let html = '<div class="tool-result-bar">' + copyBtn + '</div>';
    if (output) {
      html += '<div class="tool-result-terminal" id="' + copyId + '">' + esc(output.substring(0, 5000)) + '</div>';
    }
    if (structuredResult.stderr) {
      html += '<div class="tool-result-stderr">' + esc(structuredResult.stderr.substring(0, 2000)) + '</div>';
    }
    if (!output && !structuredResult.stderr) {
      html = '<div class="tool-result-terminal" style="color:var(--t4)">(no output)</div>';
    }
    resultEl.innerHTML = html;
  }
  // ── Read: use file metadata from structured result ──
  else if (toolName === 'read' && structuredResult?.file) {
    const f = structuredResult.file;
    const fileLabel = f.filePath ? f.filePath.split(/[/\\]/).pop() : '';
    const ext = fileLabel.includes('.') ? fileLabel.split('.').pop() : '';
    const lineInfo = f.startLine ? 'L' + f.startLine + (f.numLines > 1 ? '-' + (f.startLine + f.numLines - 1) : '') : '';
    const totalInfo = f.totalLines ? ' of ' + f.totalLines + ' lines' : '';
    const codeHtml = highlightCode((resultText || '').substring(0, 5000), ext);
    resultEl.innerHTML =
      '<div class="tool-result-file-header">' +
        '<span class="tool-result-file-name tool-file-link" data-filepath="' + esc(f.filePath || '') + '" data-filename="' + esc(fileLabel) + '" onclick="openFileInEditor(this.dataset.filepath,this.dataset.filename);switchMode(\'ide\')" title="Open in IDE">📄 ' + esc(fileLabel) + '</span>' +
        '<span class="tool-result-file-meta">' + copyBtn + ' ' + esc(lineInfo + totalInfo) + '</span>' +
      '</div>' +
      '<pre class="tool-result-code" id="' + copyId + '"><code>' + codeHtml + '</code></pre>';
  }
  // ── Edit: show what was changed ──
  else if (toolName === 'edit') {
    const isSuccess = resultText.includes('has been updated') || resultText.includes('successfully');
    // Try to extract file path from the tool call card's preview
    const filePath = card.querySelector('.tool-param-file')?.textContent?.replace(/^[✏️📝📄]\s*/, '') || '';
    let editHtml = '<div class="tool-result-edit ' + (isSuccess ? 'success' : '') + '">';
    if (isSuccess && filePath) {
      editHtml += '✓ ' + esc(filePath.split(/[/\\]/).pop()) + ' updated successfully';
    } else {
      editHtml += esc((resultText || '').substring(0, 500));
    }
    editHtml += '</div>';
    resultEl.innerHTML = editHtml;
  }
  // ── Write: show success ──
  else if (toolName === 'write') {
    const filePath = card.querySelector('.tool-param-file')?.textContent?.replace(/^[✏️📝📄]\s*/, '') || '';
    resultEl.innerHTML = '<div class="tool-result-edit success">✓ ' +
      esc(filePath ? filePath.split(/[/\\]/).pop() + ' created' : (resultText || '').substring(0, 300)) + '</div>';
  }
  // ── Glob/Grep: render as clickable file list ──
  else if (toolName === 'glob' || toolName === 'grep') {
    const lines = (resultText || '').split('\n').filter(l => l.trim());
    const renderItem = (l) => {
      const fileName = l.split(/[/\\]/).pop();
      return '<div class="tool-result-fileitem tool-file-link" data-filepath="' + esc(l) + '" data-filename="' + esc(fileName) + '" onclick="openFileInEditor(this.dataset.filepath,this.dataset.filename);switchMode(\'ide\')" title="Open in IDE">📄 ' + esc(l) + '</div>';
    };
    if (lines.length <= 30) {
      resultEl.innerHTML = '<div class="tool-result-filelist">' +
        lines.map(renderItem).join('') + '</div>';
    } else {
      resultEl.innerHTML = '<details class="tool-card-result"><summary>' + lines.length + ' files</summary>' +
        '<div class="tool-result-filelist">' +
        lines.slice(0, 50).map(renderItem).join('') +
        (lines.length > 50 ? '<div class="tool-result-fileitem" style="color:var(--t4)">... and ' + (lines.length - 50) + ' more</div>' : '') +
        '</div></details>';
    }
  }
  // ── WebSearch: render results ──
  else if (toolName === 'web_search' || toolName === 'websearch') {
    resultEl.innerHTML = '<div class="tool-result-text">' + esc((resultText || '').substring(0, 3000)) + '</div>';
  }
  // ── Image result (detect Markdown image or file:// image URL) ──
  else if (resultText && resultText.match(/!\[.*?\]\((?:file:\/\/\/|https?:\/\/|data:image\/).+?\)/)) {
    const imgMatch = resultText.match(/!\[([^\]]*)\]\(([^)]+)\)/);
    if (imgMatch) {
      const alt = imgMatch[1] || 'Generated Image';
      const imgUrl = imgMatch[2];
      const remainingText = resultText.replace(/!\[[^\]]*\]\([^)]+\)/, '').trim();
      const imgId = 'gen-img-' + Date.now();
      resultEl.innerHTML =
        '<div class="gen-image-card">' +
          '<div class="gen-image-container">' +
            '<span class="gen-image-badge">AI 生成</span>' +
            '<img id="' + imgId + '" src="' + esc(imgUrl) + '" alt="' + esc(alt) + '" class="gen-image" loading="lazy">' +
            '<button class="gen-image-download" onclick="downloadGenImage(\'' + imgId + '\')" title="下载">⬇</button>' +
          '</div>' +
          '<div class="gen-image-actions">' +
            '<button class="gen-action-btn" onclick="navigator.clipboard.writeText(\'' + esc(imgUrl).replace(/'/g, "\\'") + '\').then(()=>toast(\'Copied\'))" title="复制链接">📋 复制</button>' +
            '<button class="gen-action-btn" onclick="downloadGenImage(\'' + imgId + '\')" title="下载图片">⬇️ 下载</button>' +
            '<button class="gen-action-btn" onclick="window.open(\'' + esc(imgUrl).replace(/'/g, "\\'") + '\',\'_blank\')" title="全屏查看">🔍 查看</button>' +
            '<button class="gen-action-btn" onclick="document.getElementById(\'tw-input\').value=\'重新生成这张图片，风格更加\';document.getElementById(\'tw-input\').focus()" title="重新生成">🔄 重新生成</button>' +
          '</div>' +
          (remainingText ? '<div class="gen-image-desc">' + esc(remainingText) + '</div>' : '') +
        '</div>';
    }
  }
  // ── Default ──
  else {
    const isShort = (resultText || '').length < 500;
    if (isShort) {
      resultEl.innerHTML = '<pre class="tool-result-text"><code>' + esc(resultText || '') + '</code></pre>';
    } else {
      resultEl.innerHTML = '<details class="tool-card-result">' +
        '<summary>Result (' + (resultText || '').length + ' chars)</summary>' +
        '<pre><code>' + esc((resultText || '').substring(0, 5000)) + '</code></pre></details>';
    }
  }

  card.appendChild(resultEl);
  scrollChat();
}

export async function sendAgentChat(msg, session, isFirstMessage) {
  _agentSessionId = session.id;

  // Smart model routing: auto-select model if enabled
  if (state.autoRoute) {
    const routedModel = autoSelectModel(msg);
    if (routedModel) {
      const prov = state.providers.find(p => p.isDefault) || state.providers[0];
      if (prov && prov.defaultModel !== routedModel) {
        prov.defaultModel = routedModel;
        // Restart Agent with new model
        if (_agentStarted) {
          electronAPI.agentStop();
          _agentStarted = false;
        }
        try { document.getElementById('sb-model').textContent = routedModel; } catch {}
      }
    }
  }

  const started = await ensureAgentStarted();
  if (!started) {
    toast(t('chat.config_api'));
    openSettings();
    _showSendButton();
    return;
  }

  // Set up stream bubble for AI response
  const aiBubble = addChatMsg('ai', '');
  aiBubble.innerHTML = '<div class="chat-typing"><span></span><span></span><span></span></div>';
  aiBubble.id = 'stream-bubble';
  _agentFullContent = '';
  state.isStreaming = true;
  _showStopButton();
  updateStatusBar('streaming');

  // Send message to Agent
  const r = await electronAPI.agentSend({ content: msg });
  if (!r.ok) {
    state.isStreaming = false;
    _showSendButton();
    removeTypingIndicator();
    const el = document.getElementById('stream-bubble');
    if (el) el.remove();
    addErrorCard('Agent Error', r.error || 'Failed to send', session);
    updateStatusBar('error');
  }
  // Agent responses arrive asynchronously via onAgentMessage
}

// ═══ Debounced session save ═══
let _saveTimer = null;
function debouncedSaveSessions() {
  if (_saveTimer) clearTimeout(_saveTimer);
  _saveTimer = setTimeout(() => {
    _saveTimer = null;
    electronAPI.saveChatSessions(state.chatSessions.map(s => ({ id: s.id, title: s.title, messages: s.messages.slice(-50), created: s.created })));
  }, 2000);
}
function flushSaveSessions() {
  if (_saveTimer) {
    clearTimeout(_saveTimer);
    _saveTimer = null;
  }
  electronAPI.saveChatSessions(state.chatSessions.map(s => ({ id: s.id, title: s.title, messages: s.messages.slice(-50), created: s.created })));
}
// Save immediately when the window is about to close
window.addEventListener('beforeunload', () => { flushSaveSessions(); });

// ═══ Streaming render throttle ═══
let _streamRenderTimer = null;
let _streamPendingContent = '';
let _streamRenderScheduled = false;

function scheduleStreamRender() {
  if (_streamRenderScheduled) return;
  _streamRenderScheduled = true;
  _streamRenderTimer = setTimeout(() => {
    _streamRenderScheduled = false;
    const el = document.getElementById('stream-bubble');
    if (el) el.innerHTML = formatChatText(_streamPendingContent);
    scrollChat();
  }, 100);
}

export function getChatHistory(){
  const s=state.chatSessions.find(c=>c.id===state.activeChatId);
  return s?s.messages:[];
}

export function newChat(){
  // Stop current Agent for fresh session
  if (_agentStarted) {
    electronAPI.agentStop();
    _agentStarted = false;
    state.isStreaming = false;
  }
  const id='c_'+Date.now().toString(36);
  state.chatSessions.unshift({id,title:t('chat.new'),messages:[],created:Date.now()});
  state.activeChatId=id;
  renderChatUI();
  renderChatSidebar();
}

export function switchChat(id){
  // Stop current Agent when switching chats to avoid context mixing
  if (_agentStarted) {
    electronAPI.agentStop();
    _agentStarted = false;
    state.isStreaming = false;
  }
  state.activeChatId=id;
  renderChatUI();
  renderChatSidebar();
}

export function deleteChat(id){
  state.chatSessions=state.chatSessions.filter(c=>c.id!==id);
  if(state.activeChatId===id){
    state.activeChatId=state.chatSessions.length?state.chatSessions[0].id:null;
    if(!state.activeChatId)newChat();
  }
  renderChatUI();
  renderChatSidebar();
}

export function renderChatSidebar(){
  const el=document.getElementById('chat-session-list');
  if(!el)return;
  el.innerHTML=state.chatSessions.map(s=>{
    const active=s.id===state.activeChatId;
    const title=s.title.length>20?s.title.substring(0,20)+'...':s.title;
    return`<div class="chat-sess-item${active?' active':''}" onclick="switchChat('${s.id}')">
      <span class="chat-sess-title">${esc(title)}</span>
      ${state.chatSessions.length>1?'<button class="chat-sess-del" onclick="event.stopPropagation();deleteChat(\''+s.id+'\')" title="'+t('chat.delete')+'">✕</button>':''}
    </div>`;
  }).join('');
}

export function renderChatUI(){
  const container=document.getElementById('chat-messages');
  container.innerHTML='';
  const s=state.chatSessions.find(c=>c.id===state.activeChatId);
  const hero=document.getElementById('chat-hero');
  const grid=document.getElementById('chat-quick-grid');
  if(!s||!s.messages.length){
    if(hero)hero.style.display='';
    if(grid)grid.style.display='';
  }else{
    if(hero)hero.style.display='none';
    if(grid)grid.style.display='none';
    for(let i=0;i<s.messages.length;i++){
      const m=s.messages[i];
      if (m.role === 'tool_use') {
        // Restore tool call card
        addToolCallCard(m.name, m.input, m.toolId);
      } else if (m.role === 'tool_result') {
        // Restore tool result
        addToolResultCard(m.toolId, m.content, m.isError, m.structured);
      } else {
        addChatMsg(m.role==='user'?'user':'ai',m.content,i);
      }
    }
  }
  scrollChat();
}

export function renderSessionList(){
  const el=document.getElementById('ss-list');
  if(!el)return;
  const q=(document.getElementById('ss-search')?.value||'').toLowerCase();
  // Search both titles AND message content
  const filtered=state.chatSessions.filter(s=>{
    if(!q) return true;
    if(s.title.toLowerCase().includes(q)) return true;
    // Search through message content
    if(s.messages && s.messages.some(m=>{
      const content = typeof m.content === 'string' ? m.content : (Array.isArray(m.content) ? m.content.map(c=>c.text||'').join(' ') : '');
      return content.toLowerCase().includes(q);
    })) return true;
    return false;
  });
  const now=new Date();
  const today=new Date(now.getFullYear(),now.getMonth(),now.getDate()).getTime();
  const yesterday=today-86400000;
  const week=today-7*86400000;
  const groups={today:[],yesterday:[],week:[],older:[]};
  for(const s of filtered){
    const t=s.created||0;
    if(t>=today)groups.today.push(s);
    else if(t>=yesterday)groups.yesterday.push(s);
    else if(t>=week)groups.week.push(s);
    else groups.older.push(s);
  }
  let html='';
  const labels={today:t('date.today'),yesterday:t('date.yesterday'),week:t('date.week'),older:t('date.older')};
  for(const[key,items] of Object.entries(groups)){
    if(!items.length)continue;
    html+='<div class="ss-date-label">'+labels[key]+'</div>';
    for(const s of items){
      const active=s.id===state.activeChatId;
      // Count matched messages if searching
      let matchInfo='';
      if(q && s.messages){
        const matchCount=s.messages.filter(m=>{
          const content = typeof m.content === 'string' ? m.content : (Array.isArray(m.content) ? m.content.map(c=>c.text||'').join(' ') : '');
          return content.toLowerCase().includes(q);
        }).length;
        if(matchCount>0) matchInfo='<div class="ss-item-match">'+matchCount+' '+t('chat.matched_messages')+'</div>';
      }
      html+='<div class="ss-item'+(active?' active':'')+'" onclick="switchChat(\''+s.id+'\');renderSessionList()">'+
        '<div class="ss-item-text"><div class="ss-item-title">'+esc(s.title||t('chat.new'))+'</div>'+matchInfo+'</div>'+
        (state.chatSessions.length>1?'<button class="ss-item-del" onclick="event.stopPropagation();deleteChat(\''+s.id+'\');renderSessionList()" title="'+t('chat.delete')+'">✕</button>':'')+
        '</div>';
    }
  }
  if(!html)html='<div style="padding:20px;text-align:center;color:var(--t4);font-size:12px">'+t('chat.no_sessions')+'</div>';
  el.innerHTML=html;
}

export function chatAttach(){
  const inp=document.createElement('input');
  inp.type='file';
  inp.accept='.txt,.md,.js,.ts,.py,.json,.csv,.html,.css,.jsx,.tsx,.java,.go,.rs,.c,.cpp,.h,.xml,.yaml,.yml,.toml,.sh,.bat,.log,.sql,.env,.png,.jpg,.jpeg,.gif,.webp,.bmp,.svg';
  inp.onchange=async(e)=>{
    const file=e.target.files[0];if(!file)return;
    if(file.type.startsWith('image/')){
      const reader=new FileReader();
      reader.onload=()=>{
        window._pendingImage=reader.result;
        let preview=document.getElementById('paste-image-preview');
        if(!preview){
          preview=document.createElement('div');preview.id='paste-image-preview';
          preview.style.cssText='padding:8px;max-width:760px;margin:0 auto';
          const inputArea=document.querySelector('.tw-input-area');
          inputArea.insertBefore(preview,inputArea.querySelector('.tw-input-wrap'));
        }
        preview.innerHTML='<div style="display:flex;align-items:center;gap:8px;padding:8px;background:var(--bg-3);border-radius:8px;border:1px solid var(--border-1)"><img src="'+reader.result+'" style="max-height:80px;max-width:120px;border-radius:6px" alt="Image"><span style="font-size:11px;color:var(--t2);flex:1">'+esc(file.name)+'</span><button onclick="removePastedImage()" style="background:none;border:none;color:var(--t4);cursor:pointer">✕</button></div>';
        document.getElementById('tw-input').focus();
      };
      reader.readAsDataURL(file);
      return;
    }
    const reader=new FileReader();
    reader.onload=()=>{
      const content=reader.result;
      const preview=content.length>2000?content.substring(0,2000)+'\n...' + t('chat.truncated'):content;
      document.getElementById('tw-input').value=t('chat.file_content') + ' `'+file.name+'`：\n\n```\n'+preview+'\n```';
      autoResize(document.getElementById('tw-input'));
      document.getElementById('tw-input').focus();
    };
    reader.readAsText(file);
  };
  inp.click();
}

export function toggleTerminal(){
  go('terminal');
  setTermMode('terminal');
  if(!state.termRunning)startTerm();
}

export function toggleActionMenu(){
  const m=document.getElementById('action-menu');
  if(m.classList.contains('show')){m.classList.remove('show');return}
  m.classList.add('show');
  setTimeout(()=>{
    const close=(e)=>{if(!e.target.closest('#action-menu')&&!e.target.closest('.action-plus')){m.classList.remove('show');document.removeEventListener('click',close)}};
    document.addEventListener('click',close);
  },10);
}

export function closeActionMenu(){document.getElementById('action-menu')?.classList.remove('show')}

export function insertCmd(cmd){
  const input=document.getElementById('tw-input');
  input.value=cmd;input.focus();
  autoResize(input);
}

export function toggleMoreMenu(){
  const m=document.getElementById('ct-more-menu');
  m.classList.toggle('show');
  if(m.classList.contains('show')){
    setTimeout(()=>{
      const close=()=>{m.classList.remove('show');document.removeEventListener('click',close)};
      document.addEventListener('click',close);
    },10);
  }
}

export function runSkillInChat(prompt){
  document.getElementById('ct-more-menu').classList.remove('show');
  document.getElementById('tw-input').value=prompt;
  sendChat();
}

export async function switchChatModel(modelId){
  const prov=state.providers.find(p=>p.isDefault)||state.providers[0];
  if(prov){prov.defaultModel=modelId;await persistProvs()}
  document.getElementById('ct-model-name').textContent=modelId.length>25?modelId.substring(0,25)+'...':modelId;
  document.getElementById('ct-model-menu').classList.remove('show');
  try{document.getElementById('sb-model').textContent=modelId}catch(e){}
  newChat();
  renderSessionList();
  updateStatusBar('ready');
  toast(t('model.switched') + ': '+modelId.split('/').pop());
}

export function toggleModelMenu(){
  const m=document.getElementById('ct-model-menu');
  if(m.classList.contains('show')){m.classList.remove('show');return}
  updateChatModelSelect();
  m.classList.add('show');
  setTimeout(()=>{
    const close=(e)=>{if(!e.target.closest('#ct-model-menu')&&!e.target.closest('#ct-model-btn')){m.classList.remove('show');document.removeEventListener('click',close)}};
    document.addEventListener('click',close);
  },10);
}

export function updateChatModelSelect(){
  const menu=document.getElementById('ct-model-menu');
  const btn=document.getElementById('ct-model-name');
  if(!menu)return;
  const prov=state.providers.find(p=>p.isDefault)||state.providers[0];
  if(!prov||!prov.models||!prov.models.length){
    menu.innerHTML='<div style="padding:12px;color:var(--t3);font-size:12px">'+t('model.not_configured')+'</div>';
    btn.textContent=t('model.not_set');
    return;
  }
  btn.textContent=(prov.defaultModel||prov.models[0].id);
  if(btn.textContent.length>25)btn.textContent=btn.textContent.substring(0,25)+'...';
  const groups={};
  for(const m of prov.models){
    const parts=m.id.split('/');
    const vendor=parts.length>1?parts[0]:'Other';
    if(!groups[vendor])groups[vendor]=[];
    groups[vendor].push(m);
  }
  // Auto route option at the top
  let html = '<div class="ct-menu-item' + (state.autoRoute ? ' style="color:var(--accent-l);font-weight:600"' : '') + '" onclick="toggleAutoRoute()">' +
    (state.autoRoute ? '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="width:14px;height:14px;flex-shrink:0"><polyline points="20 6 9 17 4 12"/></svg>' : '<span style="width:14px;flex-shrink:0"></span>') +
    '<span style="font-size:11px">🤖 Auto (智能路由)</span></div>';
  html += '<div style="height:1px;background:var(--border-1);margin:4px 0"></div>';

  for(const[vendor,models] of Object.entries(groups)){
    html+='<div style="padding:6px 12px 2px;font-size:10px;font-weight:700;color:var(--t3);text-transform:uppercase;letter-spacing:.5px">'+esc(vendor)+'</div>';
    for(const m of models){
      const name=m.id.split('/').pop();
      const active=!state.autoRoute && m.id===prov.defaultModel;
      html+='<div class="ct-menu-item'+(active?' style="color:var(--accent-l);font-weight:600"':'')+'" onclick="switchChatModel(\''+esc(m.id)+'\')">'+
        (active?'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="width:14px;height:14px;flex-shrink:0"><polyline points="20 6 9 17 4 12"/></svg>':
        '<span style="width:14px;flex-shrink:0"></span>')+
        '<span style="font-family:\'JetBrains Mono\',monospace;font-size:11px">'+esc(name)+'</span></div>';
    }
  }
  menu.innerHTML=html;
}

export function toggleAutoRoute() {
  state.autoRoute = !state.autoRoute;
  const btn = document.getElementById('ct-model-name');
  if (state.autoRoute) {
    btn.textContent = '🤖 Auto';
  } else {
    const prov = state.providers.find(p => p.isDefault) || state.providers[0];
    btn.textContent = prov?.defaultModel || '--';
  }
  document.getElementById('ct-model-menu').classList.remove('show');
  toast(state.autoRoute ? '智能路由已开启' : '智能路由已关闭');
}

// Smart model routing: pick model based on message content
function autoSelectModel(msg) {
  const text = msg.toLowerCase();
  const prov = state.providers.find(p => p.isDefault) || state.providers[0];
  if (!prov || !prov.models || !prov.models.length) return null;
  const models = prov.models.map(m => m.id);

  // Helper: find a model matching any of the keywords
  const find = (...keywords) => models.find(m => {
    const id = m.toLowerCase();
    return keywords.some(k => id.includes(k));
  });

  // Coding/debugging tasks → strong reasoning model
  if (text.match(/代码|编程|debug|bug|函数|代码审查|refactor|implement|coding|code|compile|error|编译|修复/)) {
    return find('sonnet', 'opus', 'gpt-4', 'claude-3.5', 'deepseek-coder') || find('pro', 'large');
  }

  // Complex analysis/reasoning
  if (text.match(/分析|解释|为什么|推理|reason|analyze|explain|compare|评估|论文/)) {
    return find('sonnet', 'opus', 'pro', 'gpt-4');
  }

  // Simple chat/greeting/translation → fast cheap model
  if (text.match(/你好|hi|hello|翻译|translate|天气|简单|聊天|闲聊|joke|笑话/)) {
    return find('haiku', 'flash', 'mini', 'lite', 'nano', 'fast') || find('sonnet');
  }

  // Creative writing
  if (text.match(/写一篇|文章|大纲|故事|小说|诗|创作|write.*article|essay|story/)) {
    return find('sonnet', 'opus', 'pro', 'gpt-4');
  }

  // Default: use the current default model
  return null;
}

export function sendQuick(msg){
  document.getElementById('tw-input').value=msg;
  sendChat();
}

// Quick action: show input prompt for specific features (no command memorization needed)
export function quickAction(type) {
  const prompts = {
    ppt: { title: t('quick.ppt'), placeholder: t('quick.ppt_ph'), prefix: '/ppt ' },
    doc: { title: t('quick.doc'), placeholder: t('quick.doc_ph'), prefix: '/doc ' },
    email: { title: t('quick.email'), placeholder: t('quick.email_ph'), prefix: '/email ' },
    translate: { title: t('quick.translate'), placeholder: t('quick.translate_ph'), prefix: '/translate ' },
    video: { title: t('quick.video'), placeholder: t('quick.video_ph'), prefix: '/video ' },
  };
  const cfg = prompts[type];
  if (!cfg) return;

  const input = document.getElementById('tw-input');
  input.value = cfg.prefix;
  input.focus();
  input.setSelectionRange(cfg.prefix.length, cfg.prefix.length);
  // Show a hint toast
  toast(cfg.title + ': ' + cfg.placeholder);
  autoResize(input);
}

export function initImagePaste(){
  const input=document.getElementById('tw-input');
  if(!input)return;
  input.addEventListener('paste',(e)=>{
    const items=e.clipboardData?.items;
    if(!items)return;
    for(const item of items){
      if(item.type.startsWith('image/')){
        e.preventDefault();
        const blob=item.getAsFile();
        const reader=new FileReader();
        reader.onload=()=>{
          const base64=reader.result;
          window._pendingImage=base64;
          let preview=document.getElementById('paste-image-preview');
          if(!preview){
            preview=document.createElement('div');
            preview.id='paste-image-preview';
            preview.style.cssText='padding:8px;max-width:760px;margin:0 auto';
            input.closest('.tw-input-area').insertBefore(preview,input.closest('.tw-input-wrap'));
          }
          preview.innerHTML='<div style="display:flex;align-items:center;gap:8px;padding:8px;background:var(--bg-3);border-radius:8px;border:1px solid var(--border-1)"><img src="'+base64+'" style="max-height:80px;max-width:120px;border-radius:6px" alt="Pasted image"><span style="font-size:11px;color:var(--t2);flex:1">'+t('chat.image_pasted')+'</span><button onclick="removePastedImage()" style="background:none;border:none;color:var(--t4);cursor:pointer;font-size:14px">✕</button></div>';
          input.focus();
        };
        reader.readAsDataURL(blob);
        return;
      }
    }
  });
}

export function removePastedImage(){
  window._pendingImage=null;
  const preview=document.getElementById('paste-image-preview');
  if(preview)preview.remove();
}

// ═══ VOICE INPUT (STT via MediaRecorder + Whisper API) ═══
let _mediaRecorder = null;
let _isListening = false;
let _audioChunks = [];

export function toggleVoiceInput() {
  if (_isListening) {
    stopVoiceInput();
    return;
  }
  startVoiceInput();
}

async function startVoiceInput() {
  const btn = document.getElementById('tw-mic-btn');
  try {
    const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    _audioChunks = [];
    _mediaRecorder = new MediaRecorder(stream, { mimeType: 'audio/webm' });

    _mediaRecorder.ondataavailable = (e) => {
      if (e.data.size > 0) _audioChunks.push(e.data);
    };

    _mediaRecorder.onstop = async () => {
      // Stop all tracks
      stream.getTracks().forEach(t => t.stop());

      if (!_audioChunks.length) return;
      const audioBlob = new Blob(_audioChunks, { type: 'audio/webm' });

      // Convert to base64 and send to Whisper API via our backend
      const reader = new FileReader();
      reader.onload = async () => {
        const base64 = reader.result.split(',')[1];
        toast(t('chat.stt_processing'), 'info');
        try {
          const result = await electronAPI.sttTranscribe({ audio: base64, format: 'webm' });
          if (result.ok && result.text) {
            const input = document.getElementById('tw-input');
            input.value = (input.value ? input.value + ' ' : '') + result.text;
            autoResize(input);
            input.focus();
            toast(t('chat.stt_done'));
          } else {
            toast(t('chat.stt_error') + ': ' + friendlyError(result.error || 'No text'), 'error');
          }
        } catch (e) {
          toast(t('chat.stt_error') + ': ' + friendlyError(e.message), 'error');
        }
      };
      reader.readAsDataURL(audioBlob);
    };

    _mediaRecorder.start();
    _isListening = true;
    if (btn) btn.classList.add('recording');
    toast(t('chat.stt_listening'));
  } catch (e) {
    if (e.name === 'NotAllowedError') {
      toast(t('chat.stt_denied'), 'error');
    } else {
      toast(t('chat.stt_error') + ': ' + friendlyError(e.message), 'error');
    }
  }
}

function stopVoiceInput() {
  _isListening = false;
  const btn = document.getElementById('tw-mic-btn');
  if (btn) btn.classList.remove('recording');
  if (_mediaRecorder && _mediaRecorder.state !== 'inactive') {
    _mediaRecorder.stop();
  }
  _mediaRecorder = null;
}

export function chatKeyDown(e){
  if(e.key==='Enter'&&!e.shiftKey){e.preventDefault();sendChat()}
}

export function addChatMsg(role,text,msgIndex){
  const hero=document.getElementById('chat-hero');
  const grid=document.getElementById('chat-quick-grid');
  if(hero)hero.style.display='none';
  if(grid)grid.style.display='none';
  const container=document.getElementById('chat-messages');
  const div=document.createElement('div');
  div.className='chat-msg '+role;
  if(typeof msgIndex==='number') div.dataset.msgIndex=msgIndex;
  const avatar=document.createElement('div');
  avatar.className='chat-avatar';
  if(role==='user'){avatar.textContent='U'}
  else{avatar.innerHTML='<img src="assets/logo.png" alt="AI" onerror="this.parentElement.textContent=\'L\'">'}
  const bubble=document.createElement('div');
  bubble.className='chat-bubble';
  // Get plain text content for display
  const displayText = typeof text === 'string' ? text : (Array.isArray(text) ? text.map(c=>c.text||'').join('') : String(text));
  if(displayText.includes('<img src="data:image')){
    const parts=displayText.split(/(<img [^>]+>)/g);
    bubble.innerHTML=parts.map(p=>p.startsWith('<img ')?p:formatChatText(p)).join('');
  }else{
    bubble.innerHTML=formatChatText(displayText);
  }

  // Add hover action buttons
  if(typeof msgIndex==='number'){
    const actions=document.createElement('div');
    actions.className='msg-actions';
    if(role==='user'){
      actions.innerHTML='<button class="msg-action-btn" onclick="editMessage('+msgIndex+')" title="'+t('chat.edit')+'">&#9998;</button>';
    }else{
      actions.innerHTML='<button class="msg-action-btn" onclick="regenerateResponse('+msgIndex+')" title="'+t('chat.regenerate')+'">&#8635;</button>';
    }
    div.appendChild(actions);
  }

  div.appendChild(avatar);
  div.appendChild(bubble);
  container.appendChild(div);
  scrollChat();
  return bubble;
}

export function addTypingIndicator(){
  removeTypingIndicator();
  const container=document.getElementById('chat-messages');
  const div=document.createElement('div');
  div.className='chat-msg ai';
  div.id='typing-indicator';
  div.innerHTML='<div class="chat-avatar"><img src="assets/logo.png" alt="AI" onerror="this.parentElement.textContent=\'L\'"></div><div class="chat-bubble"><div class="chat-typing"><span></span><span></span><span></span></div></div>';
  container.appendChild(div);
  scrollChat();
}

export function removeTypingIndicator(){
  const el=document.getElementById('typing-indicator');
  if(el)el.remove();
}

export function updateStatusBar(st){
  const dot=document.getElementById('sb-dot');
  const status=document.getElementById('sb-status');
  if(!dot||!status)return;
  if(st==='connected'){dot.style.background='var(--green)';status.textContent='Connected'}
  else if(st==='error'){dot.style.background='var(--red)';status.textContent='Error'}
  else if(st==='streaming'){dot.style.background='var(--yellow)';status.textContent='Streaming...'}
  else{dot.style.background='var(--t4)';status.textContent='Ready'}
  const prov=state.providers.find(p=>p.isDefault)||state.providers[0];
  try{document.getElementById('sb-provider').textContent=prov?prov.name:'--'}catch(e){}
  try{document.getElementById('sb-model').textContent=prov?.defaultModel||'--'}catch(e){}
}

// ═══ STOP STREAMING ═══
export function stopStreaming(){
  if(!state.isStreaming) return;
  // Stop both Agent and Direct API streams
  electronAPI.offChatStream();
  electronAPI.agentStop();
  _agentStarted = false;
  state.isStreaming=false;
  // Keep partial response
  const el=document.getElementById('stream-bubble');
  if(el){
    el.removeAttribute('id');
    if(_streamRenderTimer){clearTimeout(_streamRenderTimer);_streamRenderTimer=null;_streamRenderScheduled=false;}
    const content = _streamPendingContent || _agentFullContent;
    if(content) el.innerHTML=formatChatText(content);
  }
  // Save partial response to session
  const session=state.chatSessions.find(c=>c.id===state.activeChatId);
  const content = _streamPendingContent || _agentFullContent;
  if(session && content){
    session.messages.push({role:'assistant',content});
    debouncedSaveSessions();
  }
  _streamPendingContent='';
  _agentFullContent='';
  _showSendButton();
  updateStatusBar('connected');
}

function _showStopButton(){
  const sendBtn=document.getElementById('tw-send-btn');
  if(!sendBtn) return;
  sendBtn.style.display='none';
  let stopBtn=document.getElementById('tw-stop-btn');
  if(!stopBtn){
    stopBtn=document.createElement('button');
    stopBtn.id='tw-stop-btn';
    stopBtn.className='stop-btn';
    stopBtn.onclick=stopStreaming;
    sendBtn.parentElement.appendChild(stopBtn);
  }
  stopBtn.textContent=t('chat.stop');
  stopBtn.style.display='';
}

function _showSendButton(){
  const sendBtn=document.getElementById('tw-send-btn');
  const stopBtn=document.getElementById('tw-stop-btn');
  if(sendBtn){sendBtn.style.display='';sendBtn.disabled=false;}
  if(stopBtn)stopBtn.style.display='none';
}

// ═══ EDIT USER MESSAGE ═══
export function editMessage(msgIndex){
  const session=state.chatSessions.find(c=>c.id===state.activeChatId);
  if(!session) return;
  const msg=session.messages[msgIndex];
  if(!msg || msg.role!=='user') return;

  // Find the DOM element
  const msgEl=document.querySelector('.chat-msg[data-msg-index="'+msgIndex+'"]');
  if(!msgEl) return;
  const bubble=msgEl.querySelector('.chat-bubble');
  if(!bubble) return;

  // Get text content
  const originalText = typeof msg.content === 'string' ? msg.content : (Array.isArray(msg.content) ? msg.content.filter(c=>c.type==='text').map(c=>c.text).join('') : String(msg.content));

  // Replace bubble content with edit textarea
  const origHTML=bubble.innerHTML;
  bubble.innerHTML='<textarea class="edit-msg-textarea" id="edit-msg-input">'+esc(originalText)+'</textarea>'+
    '<div class="edit-msg-actions">'+
    '<button class="btn btn-s btn-sm" onclick="cancelEditMessage('+msgIndex+')">'+t('chat.cancel')+'</button>'+
    '<button class="btn btn-p btn-sm" onclick="submitEditMessage('+msgIndex+')">'+t('chat.submit')+'</button>'+
    '</div>';
  // Store original HTML for cancel
  bubble.dataset.origHtml=origHTML;
  const textarea=document.getElementById('edit-msg-input');
  if(textarea){textarea.focus();textarea.setSelectionRange(textarea.value.length,textarea.value.length);}
}

export function cancelEditMessage(msgIndex){
  const msgEl=document.querySelector('.chat-msg[data-msg-index="'+msgIndex+'"]');
  if(!msgEl) return;
  const bubble=msgEl.querySelector('.chat-bubble');
  if(!bubble) return;
  if(bubble.dataset.origHtml){
    bubble.innerHTML=bubble.dataset.origHtml;
    delete bubble.dataset.origHtml;
  }
}

export function submitEditMessage(msgIndex){
  const textarea=document.getElementById('edit-msg-input');
  if(!textarea) return;
  const newText=textarea.value.trim();
  if(!newText) return;

  const session=state.chatSessions.find(c=>c.id===state.activeChatId);
  if(!session) return;

  // Truncate messages after this index
  session.messages=session.messages.slice(0,msgIndex);
  // Re-send with the edited message
  document.getElementById('tw-input').value=newText;
  renderChatUI();
  sendChat();
}

// ═══ REGENERATE AI RESPONSE ═══
export function regenerateResponse(msgIndex){
  const session=state.chatSessions.find(c=>c.id===state.activeChatId);
  if(!session) return;
  const msg=session.messages[msgIndex];
  if(!msg || msg.role!=='assistant') return;

  // Remove this AI message and everything after
  session.messages=session.messages.slice(0,msgIndex);
  // Re-render and re-send the conversation
  renderChatUI();

  // Trigger a new AI response by re-sending the last user message
  const prov=state.providers.find(p=>p.isDefault)||state.providers[0];
  if(!prov){toast(t('chat.config_api'));openSettings();return}
  const provData={baseUrl:prov.baseUrl,apiKey:prov.apiKey,defaultModel:prov.defaultModel||''};

  const aiBubble=addChatMsg('ai','');
  aiBubble.innerHTML='<div class="chat-typing"><span></span><span></span><span></span></div>';
  aiBubble.id='stream-bubble';
  _streamPendingContent='';
  state.isStreaming=true;
  _showStopButton();

  electronAPI.offChatStream();
  electronAPI.onChatStreamChunk((delta)=>{
    _streamPendingContent+=delta;
    scheduleStreamRender();
  });
  electronAPI.onChatStreamDone((result)=>{
    state.isStreaming=false;
    if(_streamRenderTimer){clearTimeout(_streamRenderTimer);_streamRenderTimer=null;_streamRenderScheduled=false;}
    const el=document.getElementById('stream-bubble');
    if(el){el.removeAttribute('id');el.innerHTML=formatChatText(result.ok?result.content:('⚠️ '+(result.error||'')));}
    session.messages.push({role:'assistant',content:result.ok?result.content:result.error});
    debouncedSaveSessions();
    _showSendButton();
    updateStatusBar(result.ok?'connected':'error');
    _streamPendingContent='';
  });
  electronAPI.onChatStreamError((error)=>{
    state.isStreaming=false;
    if(_streamRenderTimer){clearTimeout(_streamRenderTimer);_streamRenderTimer=null;_streamRenderScheduled=false;}
    const el=document.getElementById('stream-bubble');
    if(el){el.removeAttribute('id');el.innerHTML=formatChatText('⚠️ '+(error||'Stream error'));}
    session.messages.push({role:'assistant',content:'Error: '+(error||'Stream error')});
    _showSendButton();
    updateStatusBar('error');
    _streamPendingContent='';
  });

  updateStatusBar('streaming');
  electronAPI.chatStreamStart({provider:provData,messages:session.messages.slice(-20)});
}

// ═══ GENERATE SESSION TITLE ═══
async function generateSessionTitle(session){
  if(!session || !session.messages || session.messages.length<2) return;
  const prov=state.providers.find(p=>p.isDefault)||state.providers[0];
  if(!prov) return;
  const provData={baseUrl:prov.baseUrl,apiKey:prov.apiKey,defaultModel:prov.defaultModel||''};

  const firstUser=session.messages.find(m=>m.role==='user');
  const firstAI=session.messages.find(m=>m.role==='assistant');
  if(!firstUser || !firstAI) return;

  const userText = typeof firstUser.content === 'string' ? firstUser.content : (Array.isArray(firstUser.content) ? firstUser.content.filter(c=>c.type==='text').map(c=>c.text).join(' ') : '');
  const aiText = typeof firstAI.content === 'string' ? firstAI.content : '';

  // Truncate to avoid long prompts
  const snippet = (userText.substring(0,200) + '\n' + aiText.substring(0,200)).trim();
  if(!snippet) return;

  try{
    const titleMessages=[{role:'user',content:'Summarize this conversation in 3-5 words as a short title. Reply with ONLY the title, nothing else:\n\n'+snippet}];
    // Use a one-shot non-streaming call via chatStreamStart, but we collect the result
    let titleContent='';
    electronAPI.offChatStream();

    const titlePromise = new Promise((resolve)=>{
      electronAPI.onChatStreamChunk((delta)=>{titleContent+=delta;});
      electronAPI.onChatStreamDone((result)=>{resolve(result.ok?result.content:null);});
      electronAPI.onChatStreamError(()=>{resolve(null);});
    });

    await electronAPI.chatStreamStart({provider:provData,messages:titleMessages});
    const title=await titlePromise;
    electronAPI.offChatStream();

    if(title){
      // Clean up: remove quotes, trim
      session.title=title.replace(/^["']|["']$/g,'').trim().substring(0,40);
      renderChatSidebar();
      renderSessionList();
      debouncedSaveSessions();
    }
  }catch(e){
    console.error('[generateSessionTitle]',e);
  }
}

// ═══ DRAG & DROP ═══
export function initDragDrop(){
  const chatScroll=document.getElementById('chat-scroll');
  const dropZone=document.getElementById('chat-drop-zone');
  if(!chatScroll || !dropZone) return;

  let dragCounter=0;

  chatScroll.addEventListener('dragover',(e)=>{
    e.preventDefault();
    e.dataTransfer.dropEffect='copy';
  });

  chatScroll.addEventListener('dragenter',(e)=>{
    e.preventDefault();
    dragCounter++;
    dropZone.classList.add('active');
    dropZone.textContent=t('chat.drop_files');
  });

  chatScroll.addEventListener('dragleave',(e)=>{
    e.preventDefault();
    dragCounter--;
    if(dragCounter<=0){
      dragCounter=0;
      dropZone.classList.remove('active');
    }
  });

  chatScroll.addEventListener('drop',(e)=>{
    e.preventDefault();
    dragCounter=0;
    dropZone.classList.remove('active');

    const files=e.dataTransfer.files;
    if(!files||!files.length) return;

    const file=files[0];
    if(file.type.startsWith('image/')){
      // Handle as pending image (same as paste)
      const reader=new FileReader();
      reader.onload=()=>{
        window._pendingImage=reader.result;
        let preview=document.getElementById('paste-image-preview');
        if(!preview){
          preview=document.createElement('div');
          preview.id='paste-image-preview';
          preview.style.cssText='padding:8px;max-width:760px;margin:0 auto';
          const inputArea=document.querySelector('.tw-input-area');
          if(inputArea) inputArea.insertBefore(preview,inputArea.querySelector('.tw-input-wrap'));
        }
        preview.innerHTML='<div style="display:flex;align-items:center;gap:8px;padding:8px;background:var(--bg-3);border-radius:8px;border:1px solid var(--border-1)"><img src="'+reader.result+'" style="max-height:80px;max-width:120px;border-radius:6px" alt="Image"><span style="font-size:11px;color:var(--t2);flex:1">'+esc(file.name)+'</span><button onclick="removePastedImage()" style="background:none;border:none;color:var(--t4);cursor:pointer">✕</button></div>';
        document.getElementById('tw-input').focus();
      };
      reader.readAsDataURL(file);
    }else{
      // Text file - insert content into input
      const reader=new FileReader();
      reader.onload=()=>{
        const content=reader.result;
        const preview=content.length>2000?content.substring(0,2000)+'\n...'+t('chat.truncated'):content;
        const input=document.getElementById('tw-input');
        input.value=t('chat.file_content')+' `'+file.name+'`:\n\n```\n'+preview+'\n```';
        autoResize(input);
        input.focus();
      };
      reader.readAsText(file);
    }
  });
}

// ═══ EXPORT CURRENT CHAT ═══
export async function exportCurrentChat(format) {
  const session = state.chatSessions.find(c => c.id === state.activeChatId);
  if (!session) { toast(t('chat.export_fail')); return; }
  // Show loading for DOCX/PDF which take longer
  if (format === 'docx' || format === 'pdf') toast(t('chat.exporting'), 'info');
  try {
    const result = await electronAPI.exportSession({
      sessionData: { title: session.title, messages: session.messages, created: session.created },
      format,
    });
    if (result.ok) {
      toast(t('chat.exported'));
    } else if (result.error !== 'Cancelled') {
      toast(t('chat.export_fail') + ': ' + friendlyError(result.error), 'error');
    }
  } catch (e) {
    toast(t('chat.export_fail'));
  }
}

// ═══ ERROR CARD HELPER ═══
function addErrorCard(errorType, errorMessage, session) {
  const container = document.getElementById('chat-messages');
  const div = document.createElement('div');
  div.className = 'chat-msg ai';
  const avatar = document.createElement('div');
  avatar.className = 'chat-avatar';
  avatar.innerHTML = '<img src="assets/logo.png" alt="AI" onerror="this.parentElement.textContent=\'L\'">';
  const card = document.createElement('div');
  card.className = 'chat-error-card';
  card.innerHTML =
    '<div class="error-card-header"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="width:16px;height:16px;flex-shrink:0"><circle cx="12" cy="12" r="10"/><line x1="15" y1="9" x2="9" y2="15"/><line x1="9" y1="9" x2="15" y2="15"/></svg><span>' + t('chat.error_prefix') + '</span></div>' +
    '<div class="error-card-type">' + esc(errorType) + '</div>' +
    '<div class="error-card-msg">' + esc(friendlyError(errorMessage)) + '</div>' +
    '<div class="error-card-actions">' +
    '<button class="btn btn-s btn-sm" onclick="regenerateResponse(' + (session.messages.length) + ')">' + t('chat.error_action_retry') + '</button>' +
    '<button class="btn btn-g btn-sm" onclick="openSettings()">' + t('chat.error_action_settings') + '</button>' +
    '</div>';
  div.appendChild(avatar);
  div.appendChild(card);
  container.appendChild(div);
  scrollChat();
}

// ═══ SEND CHAT ═══
export async function sendChat(){
  const input=document.getElementById('tw-input');
  const msg=input.value.trim();
  if(!msg)return;
  input.value='';input.style.height='auto';
  updateStatusBar('ready');

  if(!state.activeChatId)newChat();
  const session=state.chatSessions.find(c=>c.id===state.activeChatId);
  if(!session)return;
  const isFirstMessage=!session.messages.length;
  if(isFirstMessage){session.title=msg.substring(0,30);renderChatSidebar()}

  const pendingImg=window._pendingImage;
  if(pendingImg){
    addChatMsg('user',msg+'\n<img src="'+pendingImg+'" style="max-width:200px;border-radius:8px;margin-top:8px">',session.messages.length);
    session.messages.push({role:'user',content:[
      {type:'text',text:msg||t('chat.analyze_image')},
      {type:'image_url',image_url:{url:pendingImg}}
    ]});
    removePastedImage();
  }else{
    addChatMsg('user',msg,session.messages.length);
    session.messages.push({role:'user',content:msg});
  }

  const prov=state.providers.find(p=>p.isDefault)||state.providers[0];
  if(!prov){toast(t('chat.config_api'));openSettings();return}
  const provData={baseUrl:prov.baseUrl,apiKey:prov.apiKey,defaultModel:prov.defaultModel||''};

  document.getElementById('tw-send-btn').disabled=true;

  // Check for custom plugin commands (e.g. /translate, /summarize)
  if (msg.startsWith('/')) {
    const pluginCmds = window.getPluginCommands ? window.getPluginCommands() : [];
    const parts = msg.split(/\s+/);
    const trigger = parts[0].toLowerCase();
    const matchedPlugin = pluginCmds.find(p => p.trigger && p.trigger.toLowerCase() === trigger);
    if (matchedPlugin && matchedPlugin.prompt && matchedPlugin.prompt !== 'INTEGRATION_CONFIG') {
      const userInput = msg.substring(trigger.length).trim();
      const expandedPrompt = matchedPlugin.prompt.replace(/\{input\}/g, userInput || '(no input provided)');
      await sendAgentChat(expandedPrompt, session, isFirstMessage);
      return;
    }
  }

  if(msg.startsWith('/video ')||msg.startsWith('/vid ')){
    const topic = msg.replace(/^\/(video|vid)\s+/, '');
    // Route through Agent — it will use the Kling MCP or other video generation tools
    const videoPrompt = 'Generate a video based on this description: "' + topic + '". Use the available video generation MCP tool (mcp-kling or similar) if installed. If no video generation tool is available, explain what tools are needed and how to install them.';
    await sendAgentChat(videoPrompt, session, isFirstMessage);
    return;
  } else if(msg.startsWith('/email ')||msg.startsWith('/mail ')){
    const emailInput = msg.replace(/^\/(email|mail)\s+/, '');
    // Ask AI to compose the email, then send via SMTP
    const emailPrompt = 'Compose a professional email based on this request. Return ONLY valid JSON: {"to":"recipient@email.com","subject":"Subject line","body":"Full email body text"}. Extract the recipient from the request if mentioned. Use the same language as the input. Request:\n\n' + emailInput;
    // Route through Agent
    _pendingGenerate = { type: 'email', topic: emailInput };
    await sendAgentChat(emailPrompt, session, isFirstMessage);
    return;
  } else if(msg.startsWith('/ppt ')||msg.startsWith('/slides ')||msg.startsWith('/doc ')||msg.startsWith('/document ')){
    // Route through normal Agent chat with a specialized prompt
    const isPpt = msg.startsWith('/ppt ') || msg.startsWith('/slides ');
    const topic = msg.replace(/^\/(ppt|slides|doc|document)\s+/, '');
    let agentMsg;
    if (isPpt) {
      agentMsg = 'Please generate a professional PPT presentation about "' + topic + '". Return ONLY a valid JSON array of 6-10 slides. Each slide format: {"title":"slide title","bullets":["point 1","point 2"],"notes":"speaker notes"}. Use the same language as the topic. Output ONLY the JSON array.';
    } else {
      agentMsg = 'Please generate a professional document about "' + topic + '". Return ONLY valid JSON: {"title":"doc title","sections":[{"heading":"section","paragraphs":["text"],"bullets":["item"]}]}. Use the same language as the topic. Output ONLY the JSON.';
    }
    // Set flag so handleAgentMessage auto-generates the file after response
    _pendingGenerate = { type: isPpt ? 'ppt' : 'doc', topic };
    // Let it go through normal Agent flow
    await sendAgentChat(agentMsg, session, isFirstMessage);
    return;
  } else if(msg.startsWith('/image ')||msg.startsWith('/img ')){
    const prompt=msg.replace(/^\/(image|img)\s+/,'');
    addTypingIndicator();
    const r=await electronAPI.imageGenerate({provider:provData,prompt});
    removeTypingIndicator();
    if(r.ok&&r.images&&r.images.length){
      const imgHtml=r.images.map(i=>'<img src="'+esc(i.url||('data:image/png;base64,'+i.b64))+'" style="max-width:100%;border-radius:8px;margin-top:8px" alt="Generated image">').join('');
      addChatMsg('ai','🎨 ' + t('chat.img_generated') + '：\n'+imgHtml,session.messages.length);
      session.messages.push({role:'assistant',content:'[Generated image: '+prompt+']'});
    }else{
      addChatMsg('ai','⚠️ ' + t('chat.img_failed') + ': '+friendlyError(r.error||'Unknown'),session.messages.length);
    }
  } else if(msg.startsWith('/tts ')||msg.startsWith('/speak ')){
    const text=msg.replace(/^\/(tts|speak)\s+/,'');
    addTypingIndicator();
    const r=await electronAPI.ttsGenerate({provider:provData,text});
    removeTypingIndicator();
    if(r.ok){
      const audioId = 'tts-' + Date.now();
      addChatMsg('ai','🎵 ' + t('chat.tts_generated') + '\n<div class="tts-card"><div class="tts-visual">🎵</div><audio id="' + audioId + '" controls src="data:audio/'+r.format+';base64,'+r.audio+'" style="width:100%;height:40px"></audio><div class="tts-actions"><button class="gen-action-btn" onclick="document.getElementById(\'' + audioId + '\').play()">▶️ 播放</button><button class="gen-action-btn" onclick="downloadTtsAudio(\'' + audioId + '\',\'' + r.format + '\')">⬇️ 下载</button></div></div>',session.messages.length);
      session.messages.push({role:'assistant',content:'[Generated audio: '+text.substring(0,50)+']'});
    }else{
      addChatMsg('ai','⚠️ ' + t('chat.tts_failed') + ': '+friendlyError(r.error||'Unknown'),session.messages.length);
    }
  } else {
    // ── Route through Agent engine (29+ tools) ──
    await sendAgentChat(msg, session, isFirstMessage);
    return;
  }

  document.getElementById('tw-send-btn').disabled=false;
  debouncedSaveSessions();
}

// go() is here because chat uses it, and it references switchMode
export function go(p){
  const settingsMap={
    'providers':'providers','models':'models','settings':'general',
    'mcp':'advanced','usage':'advanced','memory':'advanced','about':'about',
    'tools':'advanced','plugins':'advanced','teams':'advanced',
  };
  if(p==='terminal'||p==='chat'){switchMode('chat');return}
  if(p==='ide'){switchMode('ide');return}
  if(settingsMap[p]){
    openSettings();
    const tabIdx={general:0,providers:1,models:2,advanced:3,about:4}[settingsMap[p]]||0;
    const tabs=document.querySelectorAll('.sd-tab');
    if(tabs[tabIdx])sdTab(settingsMap[p],tabs[tabIdx]);
    return;
  }
  switchMode('chat');
}

export function switchMode(mode){
  document.querySelectorAll('.mr-btn').forEach(b=>b.classList.remove('active'));
  const btn=document.getElementById('mr-'+mode);
  if(btn)btn.classList.add('active');
  document.querySelectorAll('.mode').forEach(m=>m.classList.remove('active'));
  const ss=document.getElementById('session-sidebar');
  if(ss)ss.style.display=mode==='chat'?'':'none';
  if(mode==='chat'){
    document.getElementById('page-terminal').classList.add('active');
    applyTermMode();
  }else if(mode==='ide'){
    document.getElementById('page-ide').classList.add('active');
    if(state.monacoEditor)setTimeout(()=>state.monacoEditor.layout(),100);
  }
  document.querySelectorAll('.page').forEach(pg=>{
    if(!pg.classList.contains('mode'))pg.style.display='none';
  });
}

export function toggleVis(id){const el=document.getElementById(id);el.type=el.type==='password'?'text':'password'}

// ═══ CHAT SEARCH ═══
let _chatSearchMatches = [];
let _chatSearchIdx = -1;

export function toggleChatSearch() {
  const bar = document.getElementById('chat-search-bar');
  if (!bar) return;
  if (bar.classList.contains('hidden')) {
    bar.classList.remove('hidden');
    document.getElementById('chat-search-input')?.focus();
  } else {
    closeChatSearch();
  }
}

export function closeChatSearch() {
  const bar = document.getElementById('chat-search-bar');
  if (bar) bar.classList.add('hidden');
  document.getElementById('chat-search-input').value = '';
  // Clear highlights
  document.querySelectorAll('.chat-bubble.search-match').forEach(el => el.classList.remove('search-match'));
  document.querySelectorAll('.chat-bubble.search-current').forEach(el => el.classList.remove('search-current'));
  _chatSearchMatches = [];
  _chatSearchIdx = -1;
  document.getElementById('chat-search-count').textContent = '';
}

export function searchChatMessages(query) {
  // Clear previous highlights
  document.querySelectorAll('.chat-bubble.search-match').forEach(el => el.classList.remove('search-match'));
  document.querySelectorAll('.chat-bubble.search-current').forEach(el => el.classList.remove('search-current'));
  _chatSearchMatches = [];
  _chatSearchIdx = -1;

  if (!query || query.length < 2) {
    document.getElementById('chat-search-count').textContent = '';
    return;
  }

  const q = query.toLowerCase();
  const bubbles = document.querySelectorAll('.chat-bubble');
  bubbles.forEach(bubble => {
    if (bubble.textContent.toLowerCase().includes(q)) {
      bubble.classList.add('search-match');
      _chatSearchMatches.push(bubble);
    }
  });

  const countEl = document.getElementById('chat-search-count');
  if (_chatSearchMatches.length) {
    _chatSearchIdx = 0;
    _chatSearchMatches[0].classList.add('search-current');
    _chatSearchMatches[0].scrollIntoView({ behavior: 'smooth', block: 'center' });
    countEl.textContent = '1/' + _chatSearchMatches.length;
  } else {
    countEl.textContent = t('chat.search_no_results');
  }
}

export function chatSearchNav(direction) {
  if (!_chatSearchMatches.length) return;
  _chatSearchMatches[_chatSearchIdx]?.classList.remove('search-current');
  _chatSearchIdx = (_chatSearchIdx + direction + _chatSearchMatches.length) % _chatSearchMatches.length;
  _chatSearchMatches[_chatSearchIdx].classList.add('search-current');
  _chatSearchMatches[_chatSearchIdx].scrollIntoView({ behavior: 'smooth', block: 'center' });
  document.getElementById('chat-search-count').textContent = (_chatSearchIdx + 1) + '/' + _chatSearchMatches.length;
}
