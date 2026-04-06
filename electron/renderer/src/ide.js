// ═══ IDE MODE (Monaco + File Tree + Tabs + Quick Open) ═══
import { state } from './state.js';
import { t } from './i18n.js';
import { toast, esc, formatChatText, formatIdeChatText, autoResize, scrollChat } from './utils.js';
import { newChat, switchChat, updateStatusBar } from './chat.js';
import { startTerm } from './terminal.js';

// ═══ MONACO ═══
export function initMonaco(){
  const script=document.createElement('script');
  script.src='vendor/monaco/vs/loader.js';
  script.onload=()=>{
    require.config({paths:{vs:'vendor/monaco/vs'}});
    require(['vs/editor/editor.main'],()=>{
      state.monacoReady=true;
      const container=document.getElementById('monaco-container');
      state.monacoEditor=monaco.editor.create(container,{
        value:'',
        language:'plaintext',
        theme:'vs-dark',
        fontSize:14,
        fontFamily:"'JetBrains Mono','Cascadia Code','Consolas',monospace",
        minimap:{enabled:true},
        scrollBeyondLastLine:false,
        automaticLayout:true,
        wordWrap:'on',
        lineNumbers:'on',
        renderWhitespace:'selection',
        bracketPairColorization:{enabled:true},
        padding:{top:8},
        find:{seedSearchStringFromSelection:'always',autoFindInSelection:'multiline'},
      });
      state.monacoEditor.addCommand(monaco.KeyMod.CtrlCmd|monaco.KeyCode.KeyS,()=>saveActiveTab());
      state.monacoEditor.addAction({
        id:'send-to-chat',label:t('ide.send_to_chat'),
        keybindings:[monaco.KeyMod.CtrlCmd|monaco.KeyMod.Shift|monaco.KeyCode.KeyL],
        contextMenuGroupId:'ai',contextMenuOrder:1,
        run:(ed)=>{
          const sel=ed.getModel().getValueInRange(ed.getSelection());
          if(!sel){toast(t('ide.select_first'));return}
          const tab=state.editorTabs.find(t=>t.id===state.activeTabId);
          const fileName=tab?tab.fileName:'';
          const input=document.getElementById('ide-chat-input');
          input.value=t('ide.analyze_code')+(fileName?' ('+fileName+')':'')+':\n\n```\n'+sel+'\n```';
          autoResize(input);input.focus();
        }
      });
      state.monacoEditor.addAction({
        id:'explain-code',label:t('ide.explain'),
        contextMenuGroupId:'ai',contextMenuOrder:2,
        run:(ed)=>{
          const sel=ed.getModel().getValueInRange(ed.getSelection());
          if(!sel){toast(t('ide.select_first'));return}
          document.getElementById('ide-chat-input').value=t('ide.explain_code')+'：\n\n```\n'+sel+'\n```';
          sendIdeChat();
        }
      });
      state.monacoEditor.addAction({
        id:'fix-code',label:t('ide.fix'),
        contextMenuGroupId:'ai',contextMenuOrder:3,
        run:(ed)=>{
          const sel=ed.getModel().getValueInRange(ed.getSelection());
          if(!sel){toast(t('ide.select_first'));return}
          document.getElementById('ide-chat-input').value=t('ide.fix_code')+'：\n\n```\n'+sel+'\n```';
          sendIdeChat();
        }
      });
      console.log('[IDE] Monaco ready');
    });
  };
  document.head.appendChild(script);
}

// ═══ FILE TREE ═══
export async function openFolder(){
  const dir=await electronAPI.openFolderDialog();
  if(!dir)return;
  state.ideWorkDir=dir;
  toast(t('ide.opened') + ': '+dir.split(/[/\\]/).pop());
  refreshFileTree();
}

export async function refreshFileTree(){
  state.gitStatus=await loadGitStatus();
  const entries=await electronAPI.listDirectory({dir:state.ideWorkDir||undefined});
  renderFileTreeLevel(document.getElementById('ft-list'),entries,0,'');
}

export function filterFileTree(){
  const q=(document.getElementById('ft-search')?.value||'').toLowerCase();
  if(!q){refreshFileTree();return}
  const filtered=state.allProjectFiles.filter(f=>f.toLowerCase().includes(q)).slice(0,50);
  const container=document.getElementById('ft-list');
  container.innerHTML=filtered.map(f=>{
    const name=f.split(/[/\\]/).pop();
    const gs=state.gitStatus[f];
    const gitTag=gs?'<span class="ft-git-'+(gs==='m'?'m':gs==='a'?'a':'d')+'">'+(gs==='m'?'M':gs==='a'?'A':'D')+'</span>':'';
    return'<div class="ft-item" onclick="openFileInEditor(\''+esc(f)+'\',\''+esc(name)+'\')">'+
      '<span class="ft-icon">'+getFileIcon('.'+name.split('.').pop())+'</span>'+
      '<span class="ft-name">'+esc(name)+'</span>'+
      '<span style="font-size:9px;color:var(--t4);margin-left:4px;overflow:hidden;text-overflow:ellipsis">'+esc(f.substring(0,f.length-name.length))+'</span>'+
      gitTag+'</div>';
  }).join('')||'<div style="padding:12px;color:var(--t4);font-size:11px">'+t('ide.no_match_filter')+'</div>';
}

export function renderFileTreeLevel(container,entries,depth,parentPath){
  container.innerHTML='';
  const folderSvg='<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M22 19a2 2 0 01-2 2H4a2 2 0 01-2-2V5a2 2 0 012-2h5l2 3h9a2 2 0 012 2z"/></svg>';
  const folderOpenSvg='<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M22 19a2 2 0 01-2 2H4a2 2 0 01-2-2V5a2 2 0 012-2h5l2 3h9a2 2 0 012 2z"/><line x1="9" y1="14" x2="15" y2="14"/></svg>';
  for(const e of entries){
    const relPath=parentPath?parentPath+'/'+e.name:e.name;
    const gs=state.gitStatus[relPath];
    const gitTag=gs?'<span class="ft-git-'+(gs==='m'?'m':gs==='a'?'a':'d')+'">'+(gs==='m'?'M':gs==='a'?'A':'D')+'</span>':'';
    const div=document.createElement('div');
    div.className='ft-item'+(e.isDir?' dir':'');
    div.innerHTML='<span class="ft-indent" style="width:'+depth*16+'px"></span>'+
      '<span class="ft-icon">'+(e.isDir?folderSvg:getFileIcon(e.ext))+'</span>'+
      '<span class="ft-name">'+esc(e.name)+'</span>'+gitTag;
    // Right-click context menu for all items
    div.addEventListener('contextmenu', (ev) => {
      ev.preventDefault();
      ev.stopPropagation();
      showFileContextMenu(ev.clientX, ev.clientY, e, relPath);
    });

    if(e.isDir){
      const subList=document.createElement('div');
      subList.style.display='none';
      let loaded=false;
      div.onclick=async()=>{
        if(!loaded){
          const sub=await electronAPI.listDirectory({dir:e.path});
          renderFileTreeLevel(subList,sub,depth+1,relPath);
          loaded=true;
        }
        subList.style.display=subList.style.display==='none'?'':'none';
        div.querySelector('.ft-icon').innerHTML=subList.style.display==='none'?folderSvg:folderOpenSvg;
      };
      container.appendChild(div);
      container.appendChild(subList);
    }else{
      div.onclick=()=>{
        openFileInEditor(e.path,e.name);
        document.querySelectorAll('.ft-item').forEach(el=>el.classList.remove('active'));
        div.classList.add('active');
      };
      container.appendChild(div);
    }
  }
}

export function getFileIcon(ext){
  const colors={'.js':'#F7DF1E','.ts':'#3178C6','.jsx':'#61DAFB','.tsx':'#3178C6','.py':'#3776AB','.json':'#559E3F','.md':'#555','.html':'#E34F26','.css':'#1572B6','.vue':'#4FC08D','.go':'#00ADD8','.rs':'#CE412B','.java':'#ED8B00','.c':'#A8B9CC','.cpp':'#00599C','.h':'#A8B9CC','.sh':'#4EAA25','.yml':'#CB171E','.yaml':'#CB171E','.toml':'#9C4121','.sql':'#336791','.env':'#ECD53F','.svg':'#FFB13B','.png':'#8ED1FC','.gif':'#8ED1FC','.txt':'#888'};
  const labels={'.js':'JS','.ts':'TS','.jsx':'JX','.tsx':'TX','.py':'PY','.json':'{ }','.md':'M↓','.html':'</>','.css':'#','.vue':'V','.go':'Go','.rs':'Rs','.java':'Jv','.sh':'$'};
  const c=colors[ext]||'var(--t4)';
  const l=labels[ext]||ext?.replace('.','').substring(0,2).toUpperCase()||'·';
  return'<span style="font-size:8px;font-weight:800;color:'+c+';letter-spacing:-.5px">'+l+'</span>';
}

// ═══ EDITOR TABS ═══
export async function openFileInEditor(filePath,fileName){
  if(!state.monacoReady){toast(t('ide.editor_loading'));return}
  const existing=state.editorTabs.find(t=>t.filePath===filePath);
  if(existing){activateTab(existing.id);return}
  const r=await electronAPI.readFile({filePath});
  if(!r.ok){toast(t('ide.cannot_open')+': '+(r.error||''));return}
  const ext=filePath.split('.').pop().toLowerCase();
  const langMap={js:'javascript',cjs:'javascript',mjs:'javascript',ts:'typescript',jsx:'javascript',tsx:'typescript',py:'python',json:'json',jsonc:'json',md:'markdown',html:'html',htm:'html',css:'css',scss:'scss',less:'less',vue:'html',svelte:'html',go:'go',rs:'rust',java:'java',c:'c',cpp:'cpp',h:'c',hpp:'cpp',sh:'shell',bash:'shell',zsh:'shell',yml:'yaml',yaml:'yaml',toml:'ini',sql:'sql',xml:'xml',svg:'xml',rb:'ruby',php:'php',swift:'swift',kt:'kotlin',dart:'dart',r:'r',lua:'lua',ps1:'powershell',bat:'bat',dockerfile:'dockerfile',tf:'hcl',proto:'protobuf',graphql:'graphql'};
  const lang=langMap[ext]||'plaintext';
  const uri=monaco.Uri.file(filePath);
  let model=monaco.editor.getModel(uri);
  if(!model)model=monaco.editor.createModel(r.content,lang,uri);
  const id='tab_'+Date.now();
  state.editorTabs.push({id,filePath,fileName:fileName||filePath.split(/[/\\]/).pop(),model,viewState:null,isDirty:false});
  activateTab(id);
  model.onDidChangeContent(()=>{
    const tab=state.editorTabs.find(t=>t.id===id);
    if(tab&&!tab.isDirty){tab.isDirty=true;renderEditorTabs()}
  });
}

export function activateTab(id){
  if(state.activeTabId&&state.monacoEditor){
    const cur=state.editorTabs.find(t=>t.id===state.activeTabId);
    if(cur)cur.viewState=state.monacoEditor.saveViewState();
  }
  state.activeTabId=id;
  const tab=state.editorTabs.find(t=>t.id===id);
  if(tab&&state.monacoEditor){
    state.monacoEditor.setModel(tab.model);
    if(tab.viewState)state.monacoEditor.restoreViewState(tab.viewState);
    state.monacoEditor.focus();
  }
  const mc=document.getElementById('monaco-container');
  if(mc)mc.classList.toggle('has-tabs',state.editorTabs.length>0);
  renderEditorTabs();
  document.querySelectorAll('.ft-item').forEach(el=>el.classList.remove('active'));
}

export function closeTab(id){
  const idx=state.editorTabs.findIndex(t=>t.id===id);
  if(idx===-1)return;
  const tab=state.editorTabs[idx];
  if(tab.isDirty&&!confirm(t('ide.unsaved_close')))return;
  if(tab.model)tab.model.dispose();
  state.editorTabs.splice(idx,1);
  if(state.activeTabId===id){
    state.activeTabId=state.editorTabs.length?state.editorTabs[Math.max(0,idx-1)].id:null;
    if(state.activeTabId)activateTab(state.activeTabId);
    else{state.monacoEditor?.setModel(null)}
  }
  const mc=document.getElementById('monaco-container');
  if(mc)mc.classList.toggle('has-tabs',state.editorTabs.length>0);
  renderEditorTabs();
}

export async function saveActiveTab(){
  const tab=state.editorTabs.find(t=>t.id===state.activeTabId);
  if(!tab)return;
  const content=tab.model.getValue();
  const r=await electronAPI.writeFile({filePath:tab.filePath,content});
  if(r.ok){tab.isDirty=false;renderEditorTabs();toast(t('ide.saved'))}
  else toast(t('ide.save_fail')+': '+(r.error||''));
}

export function renderEditorTabs(){
  const el=document.getElementById('editor-tabs');
  el.innerHTML=state.editorTabs.map(t=>
    '<div class="ed-tab'+(t.id===state.activeTabId?' active':'')+(t.isDirty?' dirty':'')+'" onclick="activateTab(\''+t.id+'\')">'+
    '<span class="ed-tab-name">'+esc(t.fileName)+'</span>'+
    '<button class="ed-tab-close" onclick="event.stopPropagation();closeTab(\''+t.id+'\')" title="关闭">✕</button></div>'
  ).join('');
}

// ═══ IDE CHAT ═══
export function renderIdeChatSessions(){
  const el=document.getElementById('ide-chat-sessions');
  if(!el)return;
  el.innerHTML=state.chatSessions.map(s=>{
    const active=s.id===state.activeChatId;
    return'<div class="chat-sess-item'+(active?' active':'')+'" onclick="switchChat(\''+s.id+'\');renderIdeChatMessages()"><span class="chat-sess-title">'+esc(s.title.substring(0,15))+'</span></div>';
  }).join('');
}

export function renderIdeChatMessages(){
  const container=document.getElementById('ide-chat-messages');
  if(!container)return;
  const s=state.chatSessions.find(c=>c.id===state.activeChatId);
  container.innerHTML='';
  if(!s||!s.messages.length){
    container.innerHTML='<div style="text-align:center;color:var(--t3);padding:20px;font-size:12px">'+t('chat.start_new')+'</div>';
    return;
  }
  for(const m of s.messages){
    const div=document.createElement('div');
    div.style.cssText='margin-bottom:10px;padding:8px 10px;border-radius:10px;font-size:12px;line-height:1.6;'+(m.role==='user'?'background:var(--accent);color:#fff;margin-left:40px;border-bottom-right-radius:3px':'background:var(--bg-2);border:1px solid var(--border-1);margin-right:20px;border-bottom-left-radius:3px');
    if(m.role==='assistant'){div.innerHTML=formatIdeChatText(m.content)}
    else{div.innerHTML=formatChatText(m.content)}
    container.appendChild(div);
  }
  const scroll=document.getElementById('ide-chat-scroll');
  if(scroll)scroll.scrollTop=scroll.scrollHeight;
}

export function copyCodeBlock(id){
  const code=window['_cb_'+id];
  if(!code)return;
  navigator.clipboard.writeText(code).then(()=>toast(t('ide.copied')));
}

export function applyCodeToEditor(id){
  const code=window['_cb_'+id];
  if(!code||!state.monacoEditor||!state.activeTabId)return;
  const sel=state.monacoEditor.getSelection();
  state.monacoEditor.executeEdits('ai-apply',[{range:sel,text:code}]);
  toast(t('ide.applied'));
}

export async function createFileFromCode(id,lang){
  const code=window['_cb_'+id];if(!code)return;
  const extMap={javascript:'.js',typescript:'.ts',python:'.py',html:'.html',css:'.css',json:'.json',go:'.go',rust:'.rs',java:'.java',sh:'.sh',sql:'.sql',markdown:'.md'};
  const ext=extMap[lang]||'.txt';
  const name=prompt(t('ide.file_name')+'：','new-file'+ext);
  if(!name)return;
  const r=await electronAPI.writeFile({filePath:name,content:code});
  if(r.ok){toast(t('ide.created')+' '+name);openFileInEditor(name,name);refreshFileTree()}
  else toast(t('ide.create_fail'));
}

export async function sendIdeChat(){
  const input=document.getElementById('ide-chat-input');
  const msg=input.value.trim();if(!msg)return;
  input.value='';input.style.height='auto';
  if(!state.activeChatId)newChat();
  const session=state.chatSessions.find(c=>c.id===state.activeChatId);
  if(!session)return;
  if(!session.messages.length){session.title=msg.substring(0,20);renderIdeChatSessions()}
  session.messages.push({role:'user',content:msg});
  renderIdeChatMessages();

  const prov=state.providers.find(p=>p.isDefault)||state.providers[0];
  if(!prov){toast(t('chat.config_api'));return}
  const provData={baseUrl:prov.baseUrl,apiKey:prov.apiKey,defaultModel:prov.defaultModel||''};

  session.messages.push({role:'assistant',content:''});
  renderIdeChatMessages();

  electronAPI.offChatStream();
  let fullContent='';
  electronAPI.onChatStreamChunk((delta)=>{
    fullContent+=delta;
    const lastMsg=session.messages[session.messages.length-1];
    if(lastMsg&&lastMsg.role==='assistant')lastMsg.content=fullContent;
    renderIdeChatMessages();
  });
  electronAPI.onChatStreamDone((result)=>{
    const lastMsg=session.messages[session.messages.length-1];
    if(lastMsg&&lastMsg.role==='assistant'){
      lastMsg.content=result.ok?result.content:('⚠️ '+(result.error||''));
    }
    renderIdeChatMessages();
    electronAPI.saveChatSessions(state.chatSessions.map(s=>({id:s.id,title:s.title,messages:s.messages.slice(-50),created:s.created})));
  });
  electronAPI.onChatStreamError((error)=>{
    const lastMsg=session.messages[session.messages.length-1];
    if(lastMsg&&lastMsg.role==='assistant'){
      lastMsg.content='⚠️ '+(error||'Stream error');
    }
    renderIdeChatMessages();
  });

  await electronAPI.chatStreamStart({provider:provData,messages:session.messages.slice(0,-1).slice(-20)});
}

// ═══ QUICK OPEN (Ctrl+P) ═══
export async function loadAllFiles(){
  state.allProjectFiles=await electronAPI.listProjectFiles({})||[];
}

export function toggleQuickOpen(){
  const overlay=document.getElementById('qo-overlay');
  if(overlay.classList.contains('show')){closeQuickOpen();return}
  if(!state.allProjectFiles.length)loadAllFiles().then(()=>filterQuickOpen());
  overlay.classList.add('show');
  document.getElementById('qo-input').value='';
  document.getElementById('qo-input').focus();
  filterQuickOpen();
}

export function closeQuickOpen(){document.getElementById('qo-overlay').classList.remove('show')}

export function filterQuickOpen(){
  const q=(document.getElementById('qo-input').value||'').toLowerCase();
  const filtered=state.allProjectFiles.filter(f=>!q||f.toLowerCase().includes(q)).slice(0,20);
  state.qoSelected=0;
  document.getElementById('qo-list').innerHTML=filtered.map((f,i)=>{
    const name=f.split(/[/\\]/).pop();
    const dir=f.substring(0,f.length-name.length);
    return'<div class="qo-item'+(i===0?' selected':'')+'" onclick="qoOpen(\''+esc(f)+'\')" onmouseenter="qoSelected='+i+';renderQoSelection()"><span>'+esc(name)+'</span><span class="qo-path">'+esc(dir)+'</span></div>';
  }).join('')||'<div style="padding:12px 18px;color:var(--t4);font-size:12px">'+t('ide.no_match')+'</div>';
}

export function renderQoSelection(){
  document.querySelectorAll('.qo-item').forEach((el,i)=>el.classList.toggle('selected',i===state.qoSelected));
}

export function qoKeyDown(e){
  const items=document.querySelectorAll('.qo-item');
  if(e.key==='ArrowDown'){e.preventDefault();state.qoSelected=Math.min(state.qoSelected+1,items.length-1);renderQoSelection()}
  else if(e.key==='ArrowUp'){e.preventDefault();state.qoSelected=Math.max(state.qoSelected-1,0);renderQoSelection()}
  else if(e.key==='Enter'){e.preventDefault();const sel=items[state.qoSelected];if(sel)sel.click()}
  else if(e.key==='Escape'){closeQuickOpen()}
}

export function qoOpen(filePath){
  closeQuickOpen();
  const name=filePath.split(/[/\\]/).pop();
  openFileInEditor(filePath,name);
}

// ═══ IDE TERMINAL ═══
export function toggleIdeChat(){
  const panel=document.getElementById('ide-chat');
  const btn=document.getElementById('ide-chat-toggle');
  const rh=document.getElementById('rh-chat');
  if(!panel)return;
  panel.classList.toggle('open');
  const isOpen=panel.classList.contains('open');
  if(btn)btn.classList.toggle('active',isOpen);
  if(rh)rh.style.display=isOpen?'':'none';
  if(state.monacoEditor)setTimeout(()=>state.monacoEditor.layout(),100);
  if(isOpen){renderIdeChatSessions();renderIdeChatMessages()}
}

export function toggleIdeTerminal(){
  const panel=document.getElementById('ide-bottom-term');
  if(panel.classList.contains('show')){
    panel.classList.remove('show');
    if(state.monacoEditor)state.monacoEditor.layout();
    return;
  }
  panel.classList.add('show');
  if(!state.ideTermInit){
    const container=document.getElementById('ide-term-container');
    const ideTerm=new Terminal({
      fontSize:13,fontFamily:"'JetBrains Mono',monospace",
      theme:{background:'#07080D',foreground:'#E2E4EA',cursor:'#7C3AED'},
      cursorBlink:true,scrollback:5000,
    });
    const ideFit=new FitAddon.FitAddon();
    ideTerm.loadAddon(ideFit);
    ideTerm.open(container);
    setTimeout(()=>{ideFit.fit()},150); // Don't send resize on init — it causes PTY to re-render welcome
    ideTerm.onData(d=>electronAPI.terminalInput(d));
    state.ideTermInstance=ideTerm;
    window.addEventListener('resize',()=>{if(panel.classList.contains('show'))ideFit.fit()});
    state.ideTermInit=true;
    const termBar=panel.querySelector('.ide-bottom-term-bar');
    if(termBar){
      let startY,startH;
      termBar.addEventListener('mousedown',(e)=>{
        if(e.target.closest('button'))return;
        startY=e.clientY;
        startH=container.offsetHeight;
        const onMove=(e2)=>{
          const newH=Math.max(120,Math.min(window.innerHeight*0.7,startH-(e2.clientY-startY)));
          container.style.height=newH+'px';
          ideFit.fit();
          if(state.monacoEditor)state.monacoEditor.layout();
        };
        const onUp=()=>{document.removeEventListener('mousemove',onMove);document.removeEventListener('mouseup',onUp)};
        document.addEventListener('mousemove',onMove);
        document.addEventListener('mouseup',onUp);
      });
    }
    if(!state.termRunning)startTerm();
  }
  setTimeout(()=>{if(state.monacoEditor)state.monacoEditor.layout()},50);
}

// ═══ RESIZE HANDLES ═══
export function initResizeHandles(){
  const setupResize=(handleId,leftId,prop,min,max)=>{
    const handle=document.getElementById(handleId);
    if(!handle)return;
    let startX,startW;
    handle.onmousedown=(e)=>{
      const left=document.getElementById(leftId)||handle.previousElementSibling;
      startX=e.clientX;startW=left.offsetWidth;
      handle.classList.add('dragging');
      const onMove=(e2)=>{
        const w=Math.max(min,Math.min(max,startW+(prop==='left'?e2.clientX-startX:startX-e2.clientX)));
        left.style.width=w+'px';
      };
      const onUp=()=>{handle.classList.remove('dragging');document.removeEventListener('mousemove',onMove);document.removeEventListener('mouseup',onUp)};
      document.addEventListener('mousemove',onMove);
      document.addEventListener('mouseup',onUp);
    };
  };
  setupResize('rh-tree','ide-filetree','left',120,400);
  setupResize('rh-chat','ide-chat','right',200,600);
}

// ═══ GIT STATUS ═══
export async function loadGitStatus(){
  const r=await electronAPI.runShell({cmd:'git status --porcelain'});
  if(!r.ok)return{};
  const status={};
  for(const line of r.output.split('\n')){
    if(!line.trim())continue;
    const code=line.substring(0,2).trim();
    const file=line.substring(3).trim();
    status[file]=code.includes('M')?'m':code.includes('A')||code.includes('?')?'a':code.includes('D')?'d':'';
  }
  return status;
}

// ═══ FILE CONTEXT MENU ═══
function showFileContextMenu(x, y, entry, relPath) {
  // Remove any existing menu
  document.getElementById('ft-ctx-menu')?.remove();

  const menu = document.createElement('div');
  menu.id = 'ft-ctx-menu';
  menu.className = 'ft-context-menu';
  menu.style.left = x + 'px';
  menu.style.top = y + 'px';

  const items = [];

  if (entry.isDir) {
    items.push({ label: t('ide.new_file'), action: () => createNewFile(entry.path) });
    items.push({ label: t('ide.new_folder'), action: () => createNewFolder(entry.path) });
    items.push({ divider: true });
  } else {
    items.push({ label: t('ide.open'), action: () => openFileInEditor(entry.path, entry.name) });
    items.push({ divider: true });
  }
  items.push({ label: t('ide.rename'), action: () => renameFileItem(entry.path, entry.name) });
  items.push({ label: t('ide.delete'), action: () => deleteFileItem(entry.path, entry.name), danger: true });

  if (!entry.isDir) {
    items.push({ divider: true });
    items.push({ label: t('ide.copy_path'), action: () => { navigator.clipboard.writeText(entry.path); toast(t('ide.path_copied')); } });
  }

  menu.innerHTML = items.map(item => {
    if (item.divider) return '<div class="ft-ctx-divider"></div>';
    return '<div class="ft-ctx-item' + (item.danger ? ' danger' : '') + '">' + esc(item.label) + '</div>';
  }).join('');

  // Attach click handlers
  const actionItems = items.filter(i => !i.divider);
  menu.querySelectorAll('.ft-ctx-item').forEach((el, i) => {
    el.onclick = () => { menu.remove(); actionItems[i].action(); };
  });

  document.body.appendChild(menu);

  // Close on click outside
  const closeMenu = (ev) => {
    if (!menu.contains(ev.target)) { menu.remove(); document.removeEventListener('click', closeMenu); }
  };
  setTimeout(() => document.addEventListener('click', closeMenu), 10);

  // Ensure menu stays within viewport
  const rect = menu.getBoundingClientRect();
  if (rect.right > window.innerWidth) menu.style.left = (window.innerWidth - rect.width - 8) + 'px';
  if (rect.bottom > window.innerHeight) menu.style.top = (window.innerHeight - rect.height - 8) + 'px';
}

// ═══ FILE OPERATIONS ═══
async function createNewFile(dirPath) {
  const name = prompt(t('ide.new_file_name'));
  if (!name || !name.trim()) return;
  const filePath = dirPath + '/' + name.trim();
  const r = await electronAPI.writeFile({ filePath, content: '' });
  if (r.ok) { toast(t('ide.file_created')); refreshFileTree(); openFileInEditor(filePath, name.trim()); }
  else toast(t('ide.operation_failed') + ': ' + r.error, 'error');
}

async function createNewFolder(dirPath) {
  const name = prompt(t('ide.new_folder_name'));
  if (!name || !name.trim()) return;
  const r = await electronAPI.runShell({ cmd: 'mkdir "' + dirPath + '/' + name.trim() + '"' });
  if (r.ok) { toast(t('ide.folder_created')); refreshFileTree(); }
  else toast(t('ide.operation_failed') + ': ' + r.error, 'error');
}

async function renameFileItem(filePath, oldName) {
  const newName = prompt(t('ide.rename_to'), oldName);
  if (!newName || !newName.trim() || newName === oldName) return;
  const dir = filePath.substring(0, filePath.length - oldName.length);
  const newPath = dir + newName.trim();
  const r = await electronAPI.runShell({ cmd: 'mv "' + filePath + '" "' + newPath + '"' });
  if (r.ok) {
    toast(t('ide.renamed'));
    refreshFileTree();
    // Update tab if the renamed file was open
    const tab = state.editorTabs.find(t => t.filePath === filePath);
    if (tab) { tab.filePath = newPath; tab.name = newName.trim(); renderEditorTabs(); }
  } else {
    toast(t('ide.operation_failed') + ': ' + r.error, 'error');
  }
}

async function deleteFileItem(filePath, name) {
  if (!confirm(t('ide.confirm_delete') + ': ' + name)) return;
  const r = await electronAPI.runShell({ cmd: 'rm -rf "' + filePath + '"' });
  if (r.ok) {
    toast(t('ide.deleted'));
    refreshFileTree();
    // Close tab if the deleted file was open
    const tab = state.editorTabs.find(t => t.filePath === filePath);
    if (tab) closeTab(tab.id);
  } else {
    toast(t('ide.operation_failed') + ': ' + r.error, 'error');
  }
}

// ═══ COMMAND PALETTE ═══
export function showCommandPalette() {
  // Use Quick Open overlay — set input to '>' prefix for command mode
  const overlay = document.getElementById('qo-overlay');
  if (!overlay) { toast('Command palette not available'); return; }
  overlay.classList.add('show');
  const input = document.getElementById('qo-input');
  const list = document.getElementById('qo-list');
  if (!input || !list) return;

  const commands = [
    { name: t('cmd.find'), key: 'Ctrl+F', action: () => { if (state.monacoEditor) { state.monacoEditor.focus(); state.monacoEditor.trigger('keyboard', 'actions.find'); } } },
    { name: t('cmd.replace'), key: 'Ctrl+H', action: () => { if (state.monacoEditor) { state.monacoEditor.focus(); state.monacoEditor.trigger('keyboard', 'editor.action.startFindReplaceAction'); } } },
    { name: t('cmd.goto_line'), key: 'Ctrl+G', action: () => { if (state.monacoEditor) { state.monacoEditor.focus(); state.monacoEditor.trigger('keyboard', 'editor.action.gotoLine'); } } },
    { name: t('cmd.quick_open'), key: 'Ctrl+P', action: () => toggleQuickOpen() },
    { name: t('cmd.save'), key: 'Ctrl+S', action: () => saveActiveTab() },
    { name: t('cmd.new_chat'), key: 'Ctrl+N', action: () => newChat() },
    { name: t('cmd.toggle_terminal'), key: 'Ctrl+`', action: () => toggleIdeTerminal() },
    { name: t('cmd.settings'), key: 'Ctrl+,', action: () => { if (window.openSettings) window.openSettings(); } },
    { name: t('cmd.toggle_chat'), action: () => toggleIdeChat() },
    { name: t('cmd.refresh_tree'), action: () => refreshFileTree() },
  ];

  input.value = '> ';
  input.focus();
  input.setSelectionRange(2, 2);
  state.qoSelected = 0;

  const renderCmds = () => {
    const q = (input.value.startsWith('>') ? input.value.substring(1) : input.value).trim().toLowerCase();
    const filtered = q ? commands.filter(c => c.name.toLowerCase().includes(q)) : commands;
    list.innerHTML = filtered.map((c, i) =>
      '<div class="qo-item' + (i === state.qoSelected ? ' selected' : '') + '">' +
      '<span>' + esc(c.name) + '</span>' +
      (c.key ? '<span class="qo-shortcut">' + esc(c.key) + '</span>' : '') +
      '</div>'
    ).join('') || '<div class="qo-item" style="color:var(--t4)">' + t('cmd.no_match') + '</div>';
    list.querySelectorAll('.qo-item').forEach((el, i) => {
      if (filtered[i]) el.onclick = () => { closeQuickOpen(); filtered[i].action(); };
    });
  };

  input.oninput = renderCmds;
  input.onkeydown = (ev) => {
    const items = list.querySelectorAll('.qo-item');
    if (ev.key === 'ArrowDown') { ev.preventDefault(); state.qoSelected = Math.min(state.qoSelected + 1, items.length - 1); renderCmds(); }
    else if (ev.key === 'ArrowUp') { ev.preventDefault(); state.qoSelected = Math.max(state.qoSelected - 1, 0); renderCmds(); }
    else if (ev.key === 'Enter') { ev.preventDefault(); items[state.qoSelected]?.click(); }
    else if (ev.key === 'Escape') { closeQuickOpen(); }
  };
  renderCmds();
  return;

  // Full command palette (below is unreachable for now — will enable after basic test passes)
  try {
    const commands = [
      { name: t('cmd.find'), key: 'Ctrl+F', action: () => { if (state.monacoEditor) { state.monacoEditor.focus(); state.monacoEditor.trigger('keyboard', 'actions.find'); } } },
      { name: t('cmd.replace'), key: 'Ctrl+H', action: () => { if (state.monacoEditor) { state.monacoEditor.focus(); state.monacoEditor.trigger('keyboard', 'editor.action.startFindReplaceAction'); } } },
      { name: t('cmd.goto_line'), key: 'Ctrl+G', action: () => { if (state.monacoEditor) { state.monacoEditor.focus(); state.monacoEditor.trigger('keyboard', 'editor.action.gotoLine'); } } },
      { name: t('cmd.format'), key: 'Shift+Alt+F', action: () => { if (state.monacoEditor) { state.monacoEditor.focus(); state.monacoEditor.trigger('keyboard', 'editor.action.formatDocument'); } } },
      { name: t('cmd.quick_open'), key: 'Ctrl+P', action: () => toggleQuickOpen() },
      { name: t('cmd.save'), key: 'Ctrl+S', action: () => saveActiveTab() },
      { name: t('cmd.new_chat'), key: 'Ctrl+N', action: () => newChat() },
      { name: t('cmd.toggle_terminal'), key: 'Ctrl+`', action: () => toggleIdeTerminal() },
      { name: t('cmd.settings'), key: 'Ctrl+,', action: () => { if (window.openSettings) window.openSettings(); } },
      { name: t('cmd.toggle_chat'), action: () => toggleIdeChat() },
      { name: t('cmd.refresh_tree'), action: () => refreshFileTree() },
    ];

    // Reuse Quick Open overlay
    const overlay = document.getElementById('quick-open');
    const input = document.getElementById('qo-input');
    const list = document.getElementById('qo-list');
    if (!overlay || !input || !list) return;

    overlay.classList.add('show');
    input.value = '> ';
    input.focus();
    input.setSelectionRange(2, 2);
    state.qoSelected = 0;

    const render = () => {
      const q = (input.value.startsWith('>') ? input.value.substring(1) : input.value).trim().toLowerCase();
      const filtered = q ? commands.filter(c => c.name.toLowerCase().includes(q)) : commands;
      list.innerHTML = filtered.map((c, i) =>
        '<div class="qo-item' + (i === state.qoSelected ? ' selected' : '') + '">' +
        '<span>' + esc(c.name) + '</span>' +
        (c.key ? '<span class="qo-shortcut">' + esc(c.key) + '</span>' : '') +
        '</div>'
      ).join('') || '<div class="qo-item" style="color:var(--t4)">' + t('cmd.no_match') + '</div>';

      // Attach click handlers
      list.querySelectorAll('.qo-item').forEach((el, i) => {
        if (filtered[i]) {
          el.onclick = () => { closeQuickOpen(); filtered[i].action(); };
        }
      });
    };

    input.oninput = render;
    input.onkeydown = (ev) => {
      const items = list.querySelectorAll('.qo-item');
      if (ev.key === 'ArrowDown') { ev.preventDefault(); state.qoSelected = Math.min(state.qoSelected + 1, items.length - 1); render(); }
      else if (ev.key === 'ArrowUp') { ev.preventDefault(); state.qoSelected = Math.max(state.qoSelected - 1, 0); render(); }
      else if (ev.key === 'Enter') { ev.preventDefault(); items[state.qoSelected]?.click(); }
      else if (ev.key === 'Escape') { closeQuickOpen(); }
    };
    render();
  } catch (e) {
    console.error('[CommandPalette]', e);
  }
}
