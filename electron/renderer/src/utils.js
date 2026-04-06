// ═══ SHARED UTILITIES ═══
import { t } from './i18n.js';

export function toast(m,type,d=2200){
  const e=document.getElementById('toast');
  e.querySelector('span').textContent=m;
  e.className='toast show';
  if(type)e.classList.add('toast-'+type);
  clearTimeout(e._t);
  e._t=setTimeout(()=>{e.classList.remove('show');e.className='toast'},typeof type==='number'?type:d);
}

export function esc(s){const d=document.createElement('div');d.textContent=s||'';return d.innerHTML}

// Translate raw technical errors into user-friendly messages
export function friendlyError(err) {
  const msg = String(err || '');
  const map = [
    // Network / proxy errors
    [/ERR_SOCKS_CONNECTION_FAILED/i, t('err.proxy_failed')],
    [/ERR_CONNECTION_REFUSED/i, t('err.connection_refused')],
    [/ERR_CONNECTION_TIMED_OUT|ETIMEDOUT/i, t('err.timeout')],
    [/ERR_NAME_NOT_RESOLVED|ENOTFOUND/i, t('err.dns_failed')],
    [/ERR_INTERNET_DISCONNECTED/i, t('err.no_internet')],
    [/ERR_SSL|ERR_CERT/i, t('err.ssl_error')],
    [/ECONNRESET/i, t('err.connection_reset')],
    // Specific API errors (more specific patterns first)
    [/not available in your region/i, t('err.region_blocked')],
    [/model.*not.*found|does not exist/i, t('err.model_not_found')],
    [/insufficient.?quota|billing/i, t('err.quota_exceeded')],
    [/content.?policy|safety/i, t('err.content_blocked')],
    [/context.?length|too.?long/i, t('err.context_too_long')],
    [/429|rate.?limit/i, t('err.rate_limited')],
    [/401|unauthorized|Failed to authenticate/i, t('err.auth_failed')],
    [/403|forbidden/i, t('err.forbidden')],
    [/404|not.?found/i, t('err.not_found')],
    [/500|502|503|internal.?server/i, t('err.server_error')],
    [/Invalid API URL/i, t('err.invalid_url')],
    [/API key is required/i, t('err.no_api_key')],
    [/No provider configured/i, t('err.no_provider')],
    [/Timeout/i, t('err.timeout')],
    [/JSON/i, t('err.parse_error')],
  ];
  for (const [pattern, friendly] of map) {
    if (pattern.test(msg)) return friendly;
  }
  // If no match, return cleaned-up version (remove technical prefixes)
  return msg.replace(/^(Error:\s*|net::\s*)/i, '').substring(0, 100);
}

export function gid(){return 'p_'+Date.now().toString(36)+Math.random().toString(36).slice(2,5)}

export function pColor(p){
  const PRESETS={
    anthropic:{name:'Claude API',url:'https://api.anthropic.com',c:'#D97706'},
    openai:{name:'OpenAI',url:'https://api.openai.com',c:'#10B981'},
    deepseek:{name:'DeepSeek',url:'https://api.deepseek.com',c:'#3B82F6'},
    ollama:{name:'Ollama (Local)',url:'http://localhost:11434',c:'#8B5CF6'},
    newapi:{name:'NewAPI Gateway',url:'',c:'#EC4899'},
    custom:{name:'',url:'',c:'#6B7280'},
  };
  for(const[,v]of Object.entries(PRESETS)){if(v.url&&p.baseUrl&&p.baseUrl.includes(v.url.replace(/https?:\/\//,'')))return v.c}return p.color||'#6B7280'
}

export function showSt(elId,type,msg){
  const el=document.getElementById(elId);el.style.display='block';
  const c={ok:'var(--green)',fail:'var(--red)',load:'var(--yellow)'};
  const b={ok:'var(--green-bg)',fail:'var(--red-bg)',load:'var(--yellow-bg)'};
  el.style.background=b[type];el.style.color=c[type];
  el.innerHTML='<span style="display:inline-block;width:6px;height:6px;border-radius:50%;background:'+c[type]+';margin-right:6px"></span>'+esc(msg)
}

export function formatChatText(text){
  let h=esc(text);

  // Code blocks with language label + copy button + syntax highlighting
  h=h.replace(/```(\w*)\n([\s\S]*?)```/g,(m,lang,code)=>{
    const label=lang||'code';
    const highlighted=highlightCode(code,lang,true);
    return '<div class="code-block-wrap"><div class="code-block-header"><span>'+esc(label)+'</span><button class="code-copy-btn" onclick="navigator.clipboard.writeText(this.closest(\'.code-block-wrap\').querySelector(\'code\').textContent).then(()=>toast(\'Copied\'))">Copy</button></div><pre><code>'+highlighted+'</code></pre></div>';
  });

  // Inline code (must come after code blocks)
  h=h.replace(/`([^`]+)`/g,'<code>$1</code>');

  // Tables (basic: header | row, separator ---)
  h=h.replace(/((?:^|\n)\|.+\|[ \t]*\n\|[\s\-:|]+\|[ \t]*\n(?:\|.+\|[ \t]*\n?)+)/g,(block)=>{
    const rows=block.trim().split('\n').filter(r=>r.trim());
    if(rows.length<2)return block;
    const parseRow=(r)=>r.replace(/^\|/,'').replace(/\|$/,'').split('|').map(c=>c.trim());
    const headers=parseRow(rows[0]);
    // skip separator row (rows[1])
    let table='<table><thead><tr>'+headers.map(h=>'<th>'+h+'</th>').join('')+'</tr></thead><tbody>';
    for(let i=2;i<rows.length;i++){
      const cells=parseRow(rows[i]);
      table+='<tr>'+cells.map(c=>'<td>'+c+'</td>').join('')+'</tr>';
    }
    table+='</tbody></table>';
    return table;
  });

  // Headings (h1-h3)
  h=h.replace(/(^|\n)### (.+)/g,'$1<h3>$2</h3>');
  h=h.replace(/(^|\n)## (.+)/g,'$1<h2>$2</h2>');
  h=h.replace(/(^|\n)# (.+)/g,'$1<h1>$2</h1>');

  // Horizontal rules
  h=h.replace(/(^|\n)---+(\n|$)/g,'$1<hr>$2');

  // Blockquotes
  h=h.replace(/(^|\n)&gt; (.+)/g,'$1<blockquote>$2</blockquote>');

  // Bold, italic, strikethrough
  h=h.replace(/\*\*(.+?)\*\*/g,'<strong>$1</strong>');
  h=h.replace(/\*(.+?)\*/g,'<em>$1</em>');
  h=h.replace(/~~(.+?)~~/g,'<del>$1</del>');

  // Images (Markdown: ![alt](url)) — render as polished image card
  h=h.replace(/!\[([^\]]*)\]\(([^)]+)\)/g,(m,alt,url)=>{
    const id='chat-img-'+Date.now()+Math.random().toString(36).slice(2,5);
    return '<div class="gen-image-card"><div class="gen-image-container"><span class="gen-image-badge">AI 生成</span><img id="'+id+'" src="'+url+'" alt="'+alt+'" class="gen-image" loading="lazy"><button class="gen-image-download" onclick="downloadGenImage(\''+id+'\')" title="下载">⬇</button></div><div class="gen-image-actions"><button class="gen-action-btn" onclick="downloadGenImage(\''+id+'\')">⬇️ 下载</button><button class="gen-action-btn" onclick="window.open(\''+url+'\',\'_blank\')">🔍 查看</button></div></div>';
  });

  // Bare image URLs on their own line
  h=h.replace(/(^|<br>|<\/p><p>)(https?:\/\/[^\s<]+\.(?:png|jpg|jpeg|gif|webp|svg|bmp)(?:\?[^\s<]*)?)(<br>|<\/p>|$)/gi,(m,pre,url,post)=>{
    return pre+'<div class="gen-image-card"><div class="gen-image-container"><img src="'+url+'" class="gen-image" loading="lazy"></div></div>'+post;
  });

  // Links (must come after images to avoid matching ![...](url))
  h=h.replace(/\[([^\]]+)\]\(([^)]+)\)/g,'<a href="$2" target="_blank" rel="noopener">$1</a>');

  // Unordered lists
  h=h.replace(/((?:^|\n)[*\-] .+(?:\n[*\-] .+)*)/g,(block)=>{
    const items=block.trim().split('\n').map(l=>l.replace(/^[*\-] /,''));
    return '<ul>'+items.map(i=>'<li>'+i+'</li>').join('')+'</ul>';
  });

  // Ordered lists
  h=h.replace(/((?:^|\n)\d+\. .+(?:\n\d+\. .+)*)/g,(block)=>{
    const items=block.trim().split('\n').map(l=>l.replace(/^\d+\. /,''));
    return '<ol>'+items.map(i=>'<li>'+i+'</li>').join('')+'</ol>';
  });

  // Paragraphs (double newlines)
  h=h.replace(/\n\n+/g,'</p><p>');
  // Remaining single newlines to <br>
  h=h.replace(/\n/g,'<br>');
  // Wrap in paragraph
  h='<p>'+h+'</p>';
  // Clean up empty paragraphs
  h=h.replace(/<p>\s*<\/p>/g,'');
  // Don't wrap block elements in <p>
  h=h.replace(/<p>(<(?:h[1-3]|ul|ol|blockquote|hr|div|table|pre))/g,'$1');
  h=h.replace(/(<\/(?:h[1-3]|ul|ol|blockquote|hr|div|table|pre)>)<\/p>/g,'$1');

  return h;
}

export function formatIdeChatText(text){
  let h=esc(text);
  let codeIdx=0;
  h=h.replace(/```(\w*)\n([\s\S]*?)```/g,(m,lang,code)=>{
    const id='codeblock_'+(codeIdx++);
    const decoded=code.replace(/&amp;/g,'&').replace(/&lt;/g,'<').replace(/&gt;/g,'>').replace(/&#39;/g,"'").replace(/&quot;/g,'"');
    window['_cb_'+id]=decoded.trim();
    return'<pre><code>'+code+'</code></pre>'+
      '<div style="display:flex;gap:4px;margin-top:-6px;margin-bottom:8px">'+
      '<button class="code-action" onclick="copyCodeBlock(\''+id+'\')">📋 '+t('ide.copy')+'</button>'+
      '<button class="code-action" onclick="applyCodeToEditor(\''+id+'\')">✨ '+t('ide.apply')+'</button>'+
      '<button class="code-action" onclick="createFileFromCode(\''+id+'\',\''+esc(lang)+'\')">📄 '+t('ide.new_file')+'</button>'+
      '</div>';
  });
  h=h.replace(/`([^`]+)`/g,'<code>$1</code>');
  h=h.replace(/\*\*(.+?)\*\*/g,'<strong>$1</strong>');
  h=h.replace(/\n/g,'<br>');
  return h;
}

export function autoResize(el){
  el.style.height='auto';
  el.style.height=Math.min(el.scrollHeight,120)+'px';
}

export function scrollChat(){
  const el=document.getElementById('chat-scroll');
  if(el)setTimeout(()=>el.scrollTop=el.scrollHeight,50);
}

/**
 * Lightweight syntax highlighter for code snippets in chat.
 * Supports: JS/TS, Python, JSON, CSS, HTML, Shell, Go, Rust, Java, C/C++, YAML, SQL, Markdown.
 * Returns HTML string with <span class="hl-*"> tokens.
 */
export function highlightCode(code, lang, alreadyEscaped) {
  const h = alreadyEscaped ? code : esc(code);
  const l = (lang || '').toLowerCase();

  // Language-specific keyword sets
  const kwSets = {
    js: 'const|let|var|function|return|if|else|for|while|do|switch|case|break|continue|class|extends|import|export|from|async|await|try|catch|throw|new|typeof|instanceof|this|super|default|yield|of|in|delete|void|null|undefined|true|false',
    py: 'def|class|return|if|elif|else|for|while|import|from|as|try|except|raise|with|pass|break|continue|yield|lambda|and|or|not|in|is|None|True|False|self|async|await|print',
    go: 'func|return|if|else|for|range|switch|case|break|continue|package|import|type|struct|interface|map|chan|go|defer|select|var|const|nil|true|false|make|len|append|error',
    rs: 'fn|let|mut|return|if|else|for|while|loop|match|struct|enum|impl|trait|use|pub|mod|self|super|crate|where|async|await|move|ref|true|false|Some|None|Ok|Err',
    java: 'class|interface|extends|implements|return|if|else|for|while|do|switch|case|break|continue|try|catch|throw|new|this|super|import|package|public|private|protected|static|final|void|int|long|double|float|boolean|String|null|true|false',
    c: 'int|long|float|double|char|void|return|if|else|for|while|do|switch|case|break|continue|struct|typedef|enum|include|define|NULL|true|false|const|static|extern|unsigned|signed|sizeof',
    sql: 'SELECT|FROM|WHERE|INSERT|UPDATE|DELETE|CREATE|DROP|ALTER|TABLE|INTO|VALUES|SET|JOIN|LEFT|RIGHT|INNER|OUTER|ON|AND|OR|NOT|NULL|ORDER|BY|GROUP|HAVING|LIMIT|OFFSET|AS|DISTINCT|COUNT|SUM|AVG|MIN|MAX|UNION|INDEX|PRIMARY|KEY|FOREIGN|REFERENCES|EXISTS|IN|BETWEEN|LIKE|IS',
    css: 'color|background|border|margin|padding|display|position|width|height|font|text|flex|grid|align|justify|overflow|opacity|transition|transform|animation|z-index|top|left|right|bottom',
    yaml: 'true|false|null|yes|no',
    sh: 'if|then|else|elif|fi|for|while|do|done|case|esac|function|return|exit|echo|export|source|cd|ls|grep|awk|sed|cat|rm|mkdir|chmod|chown|sudo|apt|npm|node|git|curl|wget',
  };

  // Map file extensions/lang names to keyword set
  const langMap = {
    javascript: 'js', typescript: 'js', js: 'js', ts: 'js', jsx: 'js', tsx: 'js', mjs: 'js', cjs: 'js',
    python: 'py', py: 'py',
    go: 'go', golang: 'go',
    rust: 'rs', rs: 'rs',
    java: 'java', kotlin: 'java',
    c: 'c', cpp: 'c', 'c++': 'c', h: 'c',
    sql: 'sql',
    css: 'css', scss: 'css', less: 'css',
    yaml: 'yaml', yml: 'yaml',
    shell: 'sh', bash: 'sh', sh: 'sh', zsh: 'sh', fish: 'sh',
  };

  const kwKey = langMap[l] || (l ? l : 'js');
  const keywords = kwSets[kwKey] || kwSets.js;

  // Apply highlighting in safe order (avoid double-replacing)
  let result = h;

  // Step 1: Mark regions that shouldn't be keyword-highlighted
  // Replace strings, comments, numbers with placeholder tokens
  const tokens = [];
  function tokenize(rx, cls) {
    result = result.replace(rx, (m) => {
      const id = tokens.length;
      tokens.push('<span class="hl-' + cls + '">' + m + '</span>');
      return '\x00T' + id + '\x00';
    });
  }

  // Comments (// and # and --)
  tokenize(/\/\/[^\n]*/g, 'comment');
  tokenize(/#[^\n]*/g, 'comment');
  // Multi-line comments
  tokenize(/\/\*[\s\S]*?\*\//g, 'comment');
  // Strings (double and single quoted)
  tokenize(/&quot;(?:[^&]|&(?!quot;))*?&quot;/g, 'string');
  tokenize(/&#39;(?:[^&]|&(?!#39;))*?&#39;/g, 'string');
  // Template literals
  tokenize(/`[^`]*`/g, 'string');
  // Numbers
  tokenize(/\b\d+\.?\d*(?:e[+-]?\d+)?\b/gi, 'number');

  // Step 2: Keywords (only on un-tokenized text)
  if (keywords) {
    const kwRx = new RegExp('\\b(' + keywords + ')\\b', 'g');
    result = result.replace(kwRx, '<span class="hl-keyword">$1</span>');
  }

  // Step 3: Restore tokens
  result = result.replace(/\x00T(\d+)\x00/g, (_, id) => tokens[parseInt(id)]);

  return result;
}
