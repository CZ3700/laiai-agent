// ═══ TERMINAL MANAGEMENT ═══
import { state } from './state.js';
import { t } from './i18n.js';
import { toast } from './utils.js';
import { openSettings, sdTab } from './settings.js';

export function initXterm(){
  if(state.term)return;
  const c=document.getElementById('term-container');
  state.term=new Terminal({
    fontSize:parseInt(document.getElementById('s-font').value)||14,
    fontFamily:"'JetBrains Mono','Cascadia Code','Consolas',monospace",
    theme:{background:'#07080D',foreground:'#E2E4EA',cursor:'#7C3AED',cursorAccent:'#07080D',selectionBackground:'rgba(124,58,237,0.3)',
      black:'#1A1D28',red:'#F87171',green:'#34D399',yellow:'#FBBF24',blue:'#60A5FA',magenta:'#C084FC',cyan:'#22D3EE',white:'#E2E4EA',
      brightBlack:'#4A4E5C',brightRed:'#FCA5A5',brightGreen:'#6EE7B7',brightYellow:'#FDE68A',brightBlue:'#93C5FD',brightMagenta:'#D8B4FE',brightCyan:'#67E8F9',brightWhite:'#F9FAFB'},
    cursorBlink:true,cursorStyle:'bar',scrollback:10000,allowProposedApi:true,
  });
  state.fitAddon=new FitAddon.FitAddon();state.term.loadAddon(state.fitAddon);state.term.open(c);fitTerm();
  state.term.onData(d=>electronAPI.terminalInput(d));
  window.addEventListener('resize',()=>fitTerm());
}

let _lastTermCols=0,_lastTermRows=0;
export function fitTerm(){if(!state.fitAddon||!state.term)return;try{state.fitAddon.fit();const c=state.term.cols,r=state.term.rows;if(c!==_lastTermCols||r!==_lastTermRows){_lastTermCols=c;_lastTermRows=r;electronAPI.terminalResize({cols:c,rows:r})}}catch{}}
export function setTermFont(s){if(state.term){state.term.options.fontSize=parseInt(s);fitTerm()}}

export function setTermMode(mode){
  state.termMode=mode;
  document.getElementById('tab-chat').classList.toggle('active',mode==='chat');
  document.getElementById('tab-term').classList.toggle('active',mode==='terminal');
  applyTermMode();
  if(mode==='chat'){
    const el=document.getElementById('chat-scroll');
    if(el)setTimeout(()=>el.scrollTop=el.scrollHeight,50);
  }
}

export function sendTermCmd(cmd){
  if(!state.termRunning){
    startTerm().then(()=>{
      if(state.termRunning)setTimeout(()=>{if(state.term){state.term.paste(cmd+'\r');setTermMode('terminal');window.go('terminal')}},1500);
    });
  }else{
    if(state.term)state.term.paste(cmd+'\r');
    setTermMode('terminal');window.go('terminal');
  }
}

export async function startTerm(){
  if(state.termRunning)return;
  const pid=document.getElementById('tp').value;
  const prov=state.providers.find(p=>p.id===pid)||state.providers.find(p=>p.isDefault);
  if(!prov&&!state.providers.length){toast(t('toast.no_prov'));openSettings();sdTab('providers',document.querySelector('.sd-tab:nth-child(2)'));return}
  document.getElementById('bt-start').disabled=true;
  initXterm();
  state.term.clear();
  // Wait for terminal container to finish layout, then fit to get correct dimensions
  await new Promise(r=>setTimeout(r,200));
  fitTerm();
  // Spawn PTY with the exact terminal dimensions to avoid resize re-render
  const cols=state.term.cols||120;
  const rows=state.term.rows||30;
  const r=await electronAPI.terminalSpawn({
    provider:prov?{baseUrl:prov.baseUrl,apiKey:prov.apiKey,defaultModel:prov.defaultModel||''}:null,
    cols, rows
  });
  document.getElementById('bt-start').disabled=false;
  if(r?.ok){
    state.termRunning=true;termSt('run');
    applyTermMode();
  }else{
    toast(t('term.fail'));
  }
}

export function applyTermMode(){
  const area=document.getElementById('term-area');
  area.classList.toggle('mode-terminal',state.termMode==='terminal');
  area.classList.toggle('mode-chat',state.termMode==='chat');
  if(state.termMode==='terminal'&&state.term)setTimeout(()=>fitTerm(),50);
}

export function stopTerm(){electronAPI.terminalKill();state.termRunning=false;termSt('exit')}

export function termSt(s){
  const d=document.getElementById('td'),tx=document.getElementById('ts');
  const start=document.getElementById('bt-start'),stop=document.getElementById('bt-stop');
  const sb=document.getElementById('sb-dot'),sbs=document.getElementById('sb-status');
  if(s==='run'){d.style.background='var(--green)';tx.textContent=t('term.running');start.style.display='none';stop.style.display='';sb.style.background='var(--green)';sbs.textContent='Running'}
  else if(s==='exit'){d.style.background='var(--red)';tx.textContent=t('term.exited');start.style.display='';stop.style.display='none';sb.style.background='var(--red)';sbs.textContent='Exited'}
  else{d.style.background='var(--t4)';tx.textContent=t('term.idle');start.style.display='';stop.style.display='none';sb.style.background='var(--t4)';sbs.textContent='Ready'}
}

export function setupTerminalDataListener(){
  electronAPI.onTerminalData(d=>{
    // Write to the active/visible terminal only to avoid duplicate output
    const ideTermVisible = document.getElementById('ide-bottom-term')?.classList.contains('show');
    if(ideTermVisible && state.ideTermInstance){
      state.ideTermInstance.write(d);
    } else if(state.term){
      state.term.write(d);
    }
  });
  electronAPI.onTerminalExit(c=>{state.termRunning=false;termSt('exit');if(state.term)state.term.writeln('\r\n\x1b[90m[Process exited: '+c+']\x1b[0m')});
}
