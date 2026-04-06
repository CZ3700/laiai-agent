// ═══ PROVIDER MANAGEMENT ═══
import { state } from './state.js';
import { t, applyI18n } from './i18n.js';
import { toast, esc, gid, pColor, showSt } from './utils.js';
import { updateChatModelSelect } from './chat.js';

export const PRESETS={
  laiai:{name:'LAIAI',url:'https://api.laiai.ai',c:'#7C3AED'},
  anthropic:{name:'Claude API',url:'https://api.anthropic.com',c:'#D97706'},
  openai:{name:'OpenAI',url:'https://api.openai.com',c:'#10B981'},
  deepseek:{name:'DeepSeek',url:'https://api.deepseek.com',c:'#3B82F6'},
  ollama:{name:'Ollama (Local)',url:'http://localhost:11434',c:'#8B5CF6'},
  newapi:{name:'NewAPI Gateway',url:'',c:'#EC4899'},
  custom:{name:'',url:'',c:'#6B7280'},
};

export function renderProvs(){
  const el=document.getElementById('prov-list');
  document.getElementById('prov-badge').textContent=state.providers.length;
  if(!state.providers.length){el.innerHTML='<div class="empty"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M12 2L2 7l10 5 10-5-10-5z"/><path d="M2 17l10 5 10-5"/><path d="M2 12l10 5 10-5"/></svg><h3 data-i18n="prov.empty">No providers</h3><p>Add a provider to get started.</p></div>';applyI18n();updateDropdowns();return}
  el.innerHTML=state.providers.map(p=>{
    const c=pColor(p),ini=(p.name||'?')[0].toUpperCase(),def=p.isDefault;
    return`<div class="prov-item${def?' default':''}" onclick="editProv('${p.id}')">
      <div class="prov-icon" style="background:${c}18;color:${c}">${ini}</div>
      <div class="prov-info"><div class="prov-name">${esc(p.name)}${def?' <span style="color:var(--accent-l);font-size:10px">★</span>':''}</div><div class="prov-url">${esc(p.baseUrl||'--')}</div></div>
      <div class="prov-meta">${p.models?.length?'<span class="dot" style="width:6px;height:6px;border-radius:50%;background:var(--green)"></span>'+p.models.length+' models':'<span class="dot" style="width:6px;height:6px;border-radius:50%;background:var(--t4)"></span>'}</div>
      <div class="prov-acts" onclick="event.stopPropagation()">
        <button class="btn btn-g btn-sm" onclick="setDef('${p.id}')" title="Set default">★</button>
        <button class="btn btn-g btn-sm" onclick="delProv('${p.id}')" style="color:var(--red)">✕</button>
      </div></div>`}).join('');
  updateDropdowns();
}

export function updateDropdowns(){
  const h='<option value="">--</option>'+state.providers.map(p=>`<option value="${p.id}"${p.isDefault?' selected':''}>${esc(p.name)}</option>`).join('');
  document.getElementById('tp').innerHTML=h;
  document.getElementById('s-defprov').innerHTML=h;
  const def=state.providers.find(p=>p.isDefault);
  document.getElementById('sb-provider').textContent=def?def.name:'--';
  document.getElementById('sb-model').textContent=def?.defaultModel||'--';
}

export function domainToUrl(domain){
  domain=domain.trim().replace(/^https?:\/\//,'').replace(/\/+$/,'');
  if(!domain)return '';
  // Check if domain matches a known preset
  for(const[,p]of Object.entries(PRESETS)){
    if(p.url && domain && p.url.includes(domain)){return p.url}
  }
  // Auto-prepend api. if domain doesn't start with api.
  if(!domain.startsWith('api.')&&!domain.includes('/')&&!domain.includes('localhost')){
    return 'https://api.'+domain;
  }
  return 'https://'+domain;
}

export function onDomainInput(){
  const domain=document.getElementById('mp-domain').value.trim();
  const urlRow=document.getElementById('mp-url-row');
  const urlInput=document.getElementById('mp-url');
  if(domain){const url=domainToUrl(domain);urlInput.value=url;urlRow.style.display=''}
  else{urlRow.style.display='none'}
}

export function showAddProv(){
  state.editId=null;
  document.getElementById('mp-title').textContent=t('prov.add');
  document.getElementById('mp-domain').value='';
  document.getElementById('mp-url').value='';
  document.getElementById('mp-key').value='';
  document.getElementById('mp-label').value='';
  document.getElementById('mp-url-row').style.display='none';
  document.getElementById('mp-status').style.display='none';
  document.getElementById('mp-models-section').style.display='none';
  document.getElementById('mp-save-btn').disabled=true;
  document.getElementById('m-prov').classList.add('show');
}

export function editProv(id){
  const p=state.providers.find(x=>x.id===id);if(!p)return;
  state.editId=id;
  document.getElementById('mp-title').textContent=t('prov.edit_title');
  try{document.getElementById('mp-domain').value=new URL(p.baseUrl).hostname}catch{document.getElementById('mp-domain').value=p.baseUrl||''}
  document.getElementById('mp-url').value=p.baseUrl||'';
  document.getElementById('mp-url-row').style.display='';
  document.getElementById('mp-key').value=p.apiKey||'';
  document.getElementById('mp-label').value=p.name||'';
  document.getElementById('mp-status').style.display='none';
  document.getElementById('mp-models-section').style.display='none';
  document.getElementById('mp-save-btn').disabled=false;
  document.getElementById('m-prov').classList.add('show');
}

export function closeProv(){
  document.getElementById('m-prov').classList.remove('show');
  try{renderDrawerProviders();renderDrawerModels();updateChatModelSelect()}catch(e){}
}

export async function testProvSimple(){
  let url=document.getElementById('mp-url').value.trim();
  const key=document.getElementById('mp-key').value.trim();
  if(!url){const domain=document.getElementById('mp-domain').value.trim();if(!domain)return;url=domainToUrl(domain);document.getElementById('mp-url').value=url;document.getElementById('mp-url-row').style.display=''}
  showSt('mp-status','load',t('prov.testing'));
  document.getElementById('mp-test').disabled=true;
  const urls=[url, url+'/v1', url.replace(/\/v1$/,'')];
  let result=null;
  for(const tryUrl of urls){const r=await electronAPI.testProvider({baseUrl:tryUrl,apiKey:key});if(r.ok&&r.models.length>0){result=r;document.getElementById('mp-url').value=tryUrl;break}}
  document.getElementById('mp-test').disabled=false;
  if(result&&result.ok){
    showSt('mp-status','ok',t('prov.ok')+' — '+result.models.length+' '+t('prov.models_found'));
    document.getElementById('mp-save-btn').disabled=false;
    document.getElementById('mp-save-btn')._models=result.models;
    const ml=document.getElementById('mp-model-list');
    ml.innerHTML=result.models.slice(0,30).map(m=>
      '<span style="font-size:10px;padding:3px 8px;background:var(--bg-3);border:1px solid var(--border-1);border-radius:6px;font-family:\'JetBrains Mono\',monospace;color:var(--t2)">'+esc(m.id)+'</span>'
    ).join('')+(result.models.length>30?'<span style="font-size:10px;color:var(--t3)">+' +(result.models.length-30)+' more</span>':'');
    document.getElementById('mp-models-section').style.display='';
  }else{
    const errMsg=result?result.error:'All URL patterns failed';
    showSt('mp-status','fail',t('prov.fail')+': '+(errMsg||''));
    document.getElementById('mp-save-btn').disabled=true;
    document.getElementById('mp-models-section').style.display='none';
  }
}

export async function saveProv(){
  const domain=document.getElementById('mp-domain').value.trim();
  const url=document.getElementById('mp-url').value.trim();
  const key=document.getElementById('mp-key').value.trim();
  const label=document.getElementById('mp-label').value.trim();
  if(!url)return;
  let name=label;
  if(!name){try{name=new URL(url).hostname.replace(/^api\./,'').replace(/\..+$/,'')}catch{name=domain}
  name=name.charAt(0).toUpperCase()+name.slice(1)}
  const models=document.getElementById('mp-save-btn')._models||[];
  if(state.editId){const p=state.providers.find(x=>x.id===state.editId);if(p){p.name=name;p.baseUrl=url;p.apiKey=key;if(models.length)p.models=models}}
  else{state.providers.push({id:gid(),name,baseUrl:url,apiKey:key,models,isDefault:!state.providers.length})}
  await persistProvs();closeProv();renderProvs();collectModels();updateChatModelSelect();
  try{renderDrawerProviders();renderDrawerModels()}catch(e){}
  toast(t('toast.saved'));
}

export async function delProv(id){state.providers=state.providers.filter(p=>p.id!==id);if(state.providers.length&&!state.providers.some(p=>p.isDefault))state.providers[0].isDefault=true;await persistProvs();renderProvs();collectModels();toast(t('toast.deleted'))}
export async function setDef(id){state.providers.forEach(p=>p.isDefault=p.id===id);await persistProvs();renderProvs()}
export function setDefProv(id){if(id)setDef(id)}

export async function persistProvs(){
  await electronAPI.saveProviders({providers:state.providers});
  const def=state.providers.find(p=>p.isDefault);
  if(def){const c=await electronAPI.loadConfig()||{};c.apiBaseUrl=def.baseUrl;c.apiKey=def.apiKey;c.defaultModel=def.defaultModel||'';await electronAPI.saveConfig(c)}
}

export function collectModels(){state.allModels=[];state.providers.forEach(p=>(p.models||[]).forEach(m=>state.allModels.push({id:m.id,prov:p.name,pid:p.id,ob:m.owned_by||''})));renderModels()}

export function classifyModel(id){
  id=id.toLowerCase();
  const cats=[];
  if(id.includes('vision')||id.includes('4o')||id.includes('gemini')||id.includes('mimo'))cats.push(t('model.multimodal'));
  if(id.includes('r1')||id.includes('think')||id.includes('reason')||id.includes('o1')||id.includes('o3'))cats.push(t('model.reasoning'));
  if(id.includes('embed'))cats.push(t('model.embedding'));
  if(id.includes('image')||id.includes('dall')||id.includes('flux')||id.includes('stable'))cats.push(t('model.image_gen'));
  if(id.includes('video')||id.includes('sora')||id.includes('kling'))cats.push(t('model.video_gen'));
  if(id.includes('audio')||id.includes('tts')||id.includes('whisper')||id.includes('voice'))cats.push(t('model.audio'));
  if(id.includes('code')||id.includes('coder')||id.includes('starcoder')||id.includes('deepseek-v'))cats.push(t('model.code'));
  if(id.includes('mini')||id.includes('haiku')||id.includes('flash')||id.includes('lite')||id.includes('nano'))cats.push(t('model.lightweight'));
  if(id.includes('opus')||id.includes('gpt-4')||id.includes('pro')||id.includes('max')||id.includes('ultra'))cats.push(t('model.flagship'));
  if(!cats.length)cats.push(t('model.general'));
  return cats;
}

export function renderModels(){
  const grid=document.getElementById('model-list'),empty=document.getElementById('model-empty');
  const q=(document.getElementById('model-search').value||'').toLowerCase();
  let f=state.allModels.filter(m=>!q||m.id.toLowerCase().includes(q)||m.prov.toLowerCase().includes(q));
  if(!f.length){grid.innerHTML='';empty.style.display='';return}
  empty.style.display='none';
  const catCounts={'all':f.length};
  for(const m of f){for(const c of classifyModel(m.id)){catCounts[c]=(catCounts[c]||0)+1}}
  if(state.modelFilter!=='all'){f=f.filter(m=>classifyModel(m.id).includes(state.modelFilter))}
  const defProv=state.providers.find(p=>p.isDefault)||state.providers[0];
  const defModel=defProv?.defaultModel||'';
  const catEmoji={'all':'📋'};
  catEmoji[t('model.flagship')]='🏆';catEmoji[t('model.general')]='⚡';catEmoji[t('model.lightweight')]='🪶';catEmoji[t('model.reasoning')]='🧠';catEmoji[t('model.code')]='💻';catEmoji[t('model.multimodal')]='👁';catEmoji[t('model.image_gen')]='🎨';catEmoji[t('model.video_gen')]='🎬';catEmoji[t('model.audio')]='🎵';catEmoji[t('model.embedding')]='📐';
  const orderedCats=['all',t('model.flagship'),t('model.general'),t('model.lightweight'),t('model.reasoning'),t('model.code'),t('model.multimodal'),t('model.image_gen'),t('model.video_gen'),t('model.audio'),t('model.embedding')];
  let tabs='<div style="display:flex;gap:4px;flex-wrap:wrap;margin-bottom:14px">';
  for(const cat of orderedCats){
    if(!catCounts[cat])continue;
    const active=state.modelFilter===cat;
    const label=cat==='all'?t('model.all')+' ('+catCounts[cat]+')':(catEmoji[cat]||'')+' '+cat;
    tabs+='<button class="btn btn-sm '+(active?'btn-p':'btn-s')+'" onclick="modelFilter=\''+cat+'\';renderModels()" style="font-size:11px">'+label+'</button>';
  }
  tabs+='</div>';
  let cards='<div class="model-grid">';
  for(const m of f){
    const name=m.id.includes('/')?m.id.split('/').pop():m.id;
    const vendor=m.id.includes('/')?m.id.split('/')[0]:'';
    const isActive=m.id===defModel;
    const cats=classifyModel(m.id);
    const catBadge=cats[0]&&cats[0]!==t('model.general')?'<span class="tag tag-f" style="font-size:7px">'+cats[0]+'</span>':'';
    cards+='<div class="mc'+(isActive?' sel':'')+'" onclick="pickModel(\''+esc(m.id)+'\',\''+m.pid+'\')" title="'+esc(m.id)+'">'+
      '<div class="mc-id">'+(isActive?'<span style="color:var(--green)">✓</span> ':'')+esc(name)+'</div>'+
      '<div class="mc-prov">'+(vendor?esc(vendor)+' · ':'')+esc(m.prov)+'</div>'+
      (catBadge?'<div class="mc-tags">'+catBadge+'</div>':'')+
      '</div>';
  }
  cards+='</div>';
  grid.innerHTML=tabs+cards;
}

export async function pickModel(mid,pid){const p=state.providers.find(x=>x.id===pid);if(p){p.defaultModel=mid;await persistProvs();updateDropdowns()}toast(mid)}
export async function refreshModels(){for(const p of state.providers){const r=await electronAPI.testProvider({baseUrl:p.baseUrl,apiKey:p.apiKey});if(r.ok)p.models=r.models}await persistProvs();collectModels();toast(t('btn.refresh')+' ✓')}

// ═══ DRAWER PROVIDERS ═══
export function renderDrawerProviders(){
  const el=document.getElementById('sd-prov-list');
  if(!el)return;
  el.innerHTML=state.providers.map(p=>{
    const def=p.isDefault;
    const mc=(p.models||[]).length;
    return'<div class="sd-row'+(def?' style="border-color:var(--accent)"':'')+'"><div><div class="sd-row-label">'+esc(p.name)+(def?' <span style="color:var(--accent-l);font-size:10px">'+t('prov.star_default')+'</span>':'')+'</div><div class="sd-row-desc" style="font-family:\'JetBrains Mono\',monospace">'+esc(p.baseUrl||'')+'</div><div class="sd-row-desc" style="color:var(--green);font-size:10px">'+(mc?mc+' '+t('prov.models_available'):t('prov.not_tested'))+'</div></div><div style="display:flex;gap:4px"><button class="btn btn-s btn-sm" onclick="editProv(\''+p.id+'\')">'+t('prov.edit')+'</button>'+(def?'':'<button class="btn btn-s btn-sm" onclick="setDef(\''+p.id+'\');renderDrawerProviders()">'+t('prov.default')+'</button>')+'<button class="btn btn-d btn-sm" onclick="if(confirm(\''+t('prov.confirm_delete')+'\')){delProv(\''+p.id+'\');renderDrawerProviders()}">'+t('general.delete')+'</button></div></div>';
  }).join('')||'<div style="color:var(--t4);font-size:12px;padding:12px">'+t('prov.no_providers')+'</div>';
}

export async function refreshAllModelsDrawer(){
  const el=document.getElementById('sd-model-list');
  if(el)el.innerHTML='<div style="padding:16px;color:var(--t3);font-size:12px;text-align:center">'+t('model.refreshing')+'</div>';
  for(const p of state.providers){
    const r=await electronAPI.testProvider({baseUrl:p.baseUrl,apiKey:p.apiKey}).catch(()=>({ok:false}));
    if(r.ok&&r.models)p.models=r.models;
  }
  await persistProvs();
  collectModels();
  renderDrawerModels();
  renderDrawerProviders();
  updateChatModelSelect();
  toast(t('model.refreshed'));
}

export function renderDrawerModels(){
  const el=document.getElementById('sd-model-list');
  if(!el)return;
  const q=(document.getElementById('sd-model-search')?.value||'').toLowerCase();
  let f=state.allModels.filter(m=>!q||m.id.toLowerCase().includes(q)||m.prov.toLowerCase().includes(q));
  if(!f.length){el.innerHTML='<div style="padding:16px;color:var(--t4);font-size:12px;text-align:center">'+(state.allModels.length?t('model.no_match'):t('model.add_first'))+'</div>';return}
  const groups={};
  for(const m of f){const v=m.id.includes('/')?m.id.split('/')[0]:(m.ob||m.prov||'Other');if(!groups[v])groups[v]=[];groups[v].push(m)}
  const defProv=state.providers.find(p=>p.isDefault)||state.providers[0];
  const defModel=defProv?.defaultModel||'';
  let html='';
  for(const[vendor,models] of Object.entries(groups).sort((a,b)=>a[0].localeCompare(b[0]))){
    html+='<div class="sd-section-title" style="margin-top:12px">'+esc(vendor)+' <span style="font-weight:400;color:var(--t4)">('+models.length+')</span></div>';
    for(const m of models){
      const name=m.id.includes('/')?m.id.split('/').pop():m.id;
      const isActive=m.id===defModel;
      html+='<div class="sd-row'+(isActive?' style="border-color:var(--accent)"':'')+'" onclick="pickModel(\''+esc(m.id)+'\',\''+m.pid+'\');renderDrawerModels()" style="cursor:pointer"><div><div class="sd-row-label" style="font-family:\'JetBrains Mono\',monospace;font-size:12px">'+(isActive?'<span style="color:var(--green)">✓</span> ':'')+esc(name)+'</div><div class="sd-row-desc">'+esc(m.prov)+'</div></div></div>';
    }
  }
  el.innerHTML=html;
}
