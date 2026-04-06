// ═══ CENTRALIZED REACTIVE STATE ═══

const listeners = {};

const handler = {
  set(target, key, value) {
    const old = target[key];
    target[key] = value;
    if (listeners[key]) {
      for (const cb of listeners[key]) {
        try { cb(value, old); } catch (e) { console.error('[state]', key, e); }
      }
    }
    return true;
  }
};

const raw = {
  lang: 'zh',
  theme: 'dark',
  providers: [],
  allModels: [],
  sessions: [],
  term: null,
  fitAddon: null,
  termRunning: false,
  editId: null,
  obModels: [],
  allTools: [],
  termMode: 'chat',
  chatSessions: [],
  activeChatId: null,
  monacoEditor: null,
  editorTabs: [],
  activeTabId: null,
  monacoReady: false,
  fileTreeCache: {},
  gitStatus: {},
  ideWorkDir: null,
  ideTermInstance: null,
  mcpServers: [],
  pendingSkill: { page: '', prompt: '', name: '' },
  buddyState: { pet: 0, xp: 0, hp: 100, level: 1, mood: 'buddy.happy' },
  allProjectFiles: [],
  qoSelected: 0,
  ideTermInit: false,
  modelFilter: 'all',
  toolFilter: 'all',
  isStreaming: false,
  autoRoute: false,
};

export const state = new Proxy(raw, handler);

export function subscribe(key, callback) {
  if (!listeners[key]) listeners[key] = [];
  listeners[key].push(callback);
  return () => {
    listeners[key] = listeners[key].filter(cb => cb !== callback);
  };
}
