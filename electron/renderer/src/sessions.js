// ═══ LEGACY SESSION MANAGEMENT (CLI SESSIONS) ═══
import { state } from './state.js';
import { t } from './i18n.js';
import { toast, esc } from './utils.js';
import { newChat, renderChatUI, renderChatSidebar, go } from './chat.js';
import { setTermMode } from './terminal.js';

export async function loadSessions(){
  state.sessions=await electronAPI.listSessions({limit:100})||[];
  const badge=document.getElementById('sess-badge');
  badge.textContent=state.sessions.length;badge.style.display=state.sessions.length?'':'none';
  renderSessions()
}

export function renderSessions(){
  const el=document.getElementById('sess-list');
  const q=(document.getElementById('sess-search')?.value||'').toLowerCase();
  const f=state.sessions.filter(s=>!q||s.summary.toLowerCase().includes(q)||(s.projectDir||'').toLowerCase().includes(q));
  if(!f.length){el.innerHTML='<div class="empty"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M21 15a2 2 0 01-2 2H7l-4 4V5a2 2 0 012-2h14a2 2 0 012 2z"/></svg><h3>'+t('sess.empty')+'</h3></div>';return}
  el.innerHTML=f.map((s,i)=>{
    const d=new Date(s.lastModified),time=d.toLocaleDateString()+' '+d.toLocaleTimeString([],{hour:'2-digit',minute:'2-digit'});
    const size=s.fileSize>1048576?(s.fileSize/1048576).toFixed(1)+'MB':(s.fileSize/1024).toFixed(0)+'KB';
    const preview=s.preview?'<div style="font-size:11px;color:var(--t3);margin-top:3px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;max-width:600px">'+esc(s.preview)+'</div>':'';
    return`<div class="sess-item anim-in">
      <div class="sess-icon" onclick="previewSession(${i})" style="cursor:pointer" title="${t('sess.preview')}"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 15a2 2 0 01-2 2H7l-4 4V5a2 2 0 012-2h14a2 2 0 012 2z"/></svg></div>
      <div class="sess-body" onclick="previewSession(${i})" style="cursor:pointer">
        <div class="sess-title">${esc(s.summary)}</div>
        ${preview}
        <div class="sess-meta"><span>${time}</span>${s.projectDir?'<span>'+esc(s.projectDir)+'</span>':''}</div>
      </div>
      <div class="sess-size">${size}</div>
      <button class="btn btn-g btn-sm" onclick="deleteSessionUI(${i})" style="color:var(--red)" title="${t('general.delete')}">✕</button>
    </div>`
  }).join('')
}

export function filterSessions(){renderSessions()}

export async function previewSession(idx){
  const s=state.sessions[idx];if(!s||!s.filePath)return;
  const r=await electronAPI.previewSession({filePath:s.filePath});
  if(!r.ok||!r.messages.length){toast(t('chat.cannot_preview'));return}
  let previewEl=document.getElementById('sess-preview');
  if(!previewEl){
    previewEl=document.createElement('div');previewEl.id='sess-preview';previewEl.className='card';previewEl.style.marginTop='16px';
    document.getElementById('sess-list').parentElement.appendChild(previewEl);
  }
  previewEl.innerHTML='<div class="card-h"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 15a2 2 0 01-2 2H7l-4 4V5a2 2 0 012-2h14a2 2 0 012 2z"/></svg><span>'+t('chat.preview_title')+': '+esc(s.summary.substring(0,50))+'</span></div>'+
    r.messages.map(m=>'<div style="margin-bottom:8px;padding:8px 12px;background:var(--bg-'+(m.role==='user'?'4':'3')+');border-radius:8px;font-size:12px"><strong style="color:var(--'+(m.role==='user'?'accent-l':'green')+')">'+(m.role==='user'?'You':'AI')+':</strong> '+esc(m.content)+'</div>').join('')+
    '<div style="display:flex;gap:8px;margin-top:12px"><button class="btn btn-p btn-sm" onclick="resumeToChat('+idx+')">'+t('chat.continue')+'</button><button class="btn btn-s btn-sm" onclick="this.parentElement.parentElement.remove()">'+t('chat.close_preview')+'</button></div>';
  previewEl.scrollIntoView({behavior:'smooth',block:'start'});
}

export async function deleteSessionUI(idx){
  const s=state.sessions[idx];if(!s)return;
  if(!confirm(t('sess.confirm_delete')+'\n\n'+s.summary.substring(0,80)))return;
  const r=await electronAPI.deleteSession({filePath:s.filePath});
  if(r.ok){state.sessions.splice(idx,1);renderSessions();toast(t('sess.deleted'))}
  else toast(t('sess.delete_fail')+': '+(r.error||''))
}

export async function resumeToChat(idx){
  const s=state.sessions[idx];if(!s)return;
  const r=await electronAPI.previewSession({filePath:s.filePath});
  if(!r.ok){toast(t('chat.cannot_load'));return}
  const id='c_'+Date.now().toString(36);
  const msgs=r.messages.map(m=>({role:m.role==='user'?'user':'assistant',content:m.content}));
  state.chatSessions.unshift({id,title:s.summary.substring(0,30),messages:msgs,created:Date.now()});
  state.activeChatId=id;
  renderChatUI();
  renderChatSidebar();
  go('terminal');setTermMode('chat');
  toast(t('chat.loaded_msgs') + ' ' + r.messages.length);
}

export function resumeSession(id){
  go('terminal');
  if(state.term&&state.termRunning){state.term.paste('/resume '+id+'\r')}
  else{toast(t('term.start_first'))}
}
