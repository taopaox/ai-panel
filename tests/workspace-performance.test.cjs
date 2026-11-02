const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const { test } = require('node:test');
const ts = require('typescript');
const vue = require('vue');

const root = path.resolve(__dirname, '..');
const compiled = new Map();
async function flush() { for (let i = 0; i < 50; i++) await Promise.resolve(); }
function deferred() {
  let resolve;
  const promise = new Promise(done => { resolve = done; });
  return { promise, resolve };
}

// Run the real composable and layout helpers with a controllable native bridge.
function workspace(t) {
  const mounts = [], unmounts = [], frames = new Map(), listeners = new Map();
  const timers = new Map(), views = new Map(), calls = [];
  let nextId = 1;
  const scope = vue.effectScope();
  const hooks = { ...vue, onMounted: fn => mounts.push(fn), onUnmounted: fn => unmounts.push(fn) };
  const document = { hidden: false, addEventListener: (name, fn) => listeners.set(name, fn), removeEventListener: name => listeners.delete(name) };
  const window = {
    setTimeout: (fn, ms) => { const id = nextId++; timers.set(id, { fn, ms, repeat: false }); return id; },
    setInterval: (fn, ms) => { const id = nextId++; timers.set(id, { fn, ms, repeat: true }); return id; },
    clearTimeout: id => timers.delete(id), clearInterval: id => timers.delete(id),
    requestAnimationFrame: fn => { const id = nextId++; frames.set(id, fn); return id; },
    cancelAnimationFrame: id => frames.delete(id),
  };
  const bridge = {
    holdHistory: null, holdSize: null,
    size: { width: 1280, height: 840 },
    async invoke(command, args) {
      calls.push({ command, ...args });
      if (command === 'create_content_webview') views.set(args.label, makeView(args.label));
      if (command === 'close_content_webview') views.delete(args.label);
      if (command === 'find_content_text') return { total: 2, index: 1 };
      if (command === 'content_webview_history') {
        if (bridge.holdHistory) await bridge.holdHistory.promise;
        return { canGoBack: false, canGoForward: false, focused: false, url: 'https://chatgpt.com', title: 'ChatGPT' };
      }
    },
  };
  function makeView(label) {
    return Object.fromEntries(['setPosition', 'setSize', 'show', 'hide', 'setFocus'].map(method => [method, async value => {
      calls.push({ label, method, value });
      if (method === 'setSize' && label !== 'main' && bridge.holdSize) await bridge.holdSize.promise;
    }]));
  }
  const currentWindow = {
    scaleFactor: async () => 1, innerSize: async () => bridge.size, isFocused: async () => true,
    onResized: async fn => { listeners.set('resize', fn); return () => listeners.delete('resize'); },
    onFocusChanged: async fn => { listeners.set('focus', fn); return () => listeners.delete('focus'); },
  };
  const shell = makeView('main');
  const store = { get: async () => undefined, set: async () => {} };
  const mocks = {
    vue: hooks,
    '@tauri-apps/api/core': { invoke: (...args) => bridge.invoke(...args) },
    '@tauri-apps/api/dpi': { LogicalPosition: class { constructor(x, y) { Object.assign(this, { x, y }); } }, LogicalSize: class { constructor(width, height) { Object.assign(this, { width, height }); } } },
    '@tauri-apps/api/webview': { getCurrentWebview: () => shell, Webview: { getByLabel: async label => views.get(label) } },
    '@tauri-apps/api/window': { getCurrentWindow: () => currentWindow },
    '@tauri-apps/api/event': { listen: async (name, fn) => { listeners.set(name, fn); return () => listeners.delete(name); } },
    '@tauri-apps/plugin-store': { load: async () => store },
  };
  const modules = new Map();
  function load(file) {
    if (modules.has(file)) return modules.get(file).exports;
    if (!compiled.has(file)) compiled.set(file, ts.transpileModule(fs.readFileSync(file, 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 } }).outputText);
    const module = { exports: {} };
    modules.set(file, module);
    const localRequire = name => {
      if (mocks[name]) return mocks[name];
      if (name.startsWith('.')) return load(path.resolve(path.dirname(file), `${name}.ts`));
      throw new Error(`Unexpected import: ${name}`);
    };
    vm.runInNewContext(`(function(require,module,exports){${compiled.get(file)}\n})`, { window, document, setTimeout: window.setTimeout, console, URL, crypto: globalThis.crypto })(localRequire, module, module.exports);
    return module.exports;
  }
  const api = scope.run(() => load(path.join(root, 'src/composables/useWorkspace.ts')).useWorkspace());
  t.after(() => { unmounts.forEach(fn => fn()); scope.stop(); });
  return {
    api, calls, bridge, timers, views, document, listeners,
    mount: async () => { for (const fn of mounts) await fn(); await flush(); calls.length = 0; },
    frame: async () => { const pending = [...frames.values()]; frames.clear(); pending.forEach(fn => fn()); await flush(); },
    fire: async (ms) => {
      for (const [id, timer] of [...timers]) if (timer.ms === ms && timers.has(id)) { if (!timer.repeat) timers.delete(id); timer.fn(); }
      await flush();
    },
  };
}

test('rapid find input issues only the final search', async t => {
  const w = workspace(t);
  await w.mount();
  await w.api.openFind();
  w.calls.length = 0;
  for (const value of ['a', 'ab', 'abc', 'abcd']) w.api.updateFindQuery(value);
  assert.equal([...w.timers.values()].filter(timer => timer.ms === 150).length, 1);
  await w.fire(150);
  assert.deepEqual(w.calls.filter(call => call.command === 'find_content_text').map(call => call.query), ['abcd']);
  w.api.updateFindQuery('cancelled');
  await w.api.closeFind();
  w.calls.length = 0;
  await w.fire(150);
  assert.equal(w.calls.filter(call => call.command === 'find_content_text').length, 0);
});

test('unchanged page polls preserve tab and pane references; pending queries are shared', async t => {
  const w = workspace(t);
  await w.mount();
  const panes = w.api.paneViews.value;
  const tabs = panes[0].tabs;
  await w.fire(2000);
  assert.equal(w.api.paneViews.value, panes);
  assert.equal(w.api.paneViews.value[0].tabs, tabs);
  w.calls.length = 0;
  w.bridge.holdHistory = deferred();
  await w.fire(2000);
  await w.fire(2000);
  assert.equal(w.calls.filter(call => call.command === 'content_webview_history').length, 1);
  w.bridge.holdHistory.resolve();
  await flush();
});

test('polling pauses in overlays, on native window blur and while hidden, then resumes', async t => {
  const w = workspace(t);
  await w.mount();
  await w.api.setOverlay('manage');
  w.calls.length = 0;
  await w.fire(2000);
  assert.equal(w.calls.length, 0);
  await w.api.setOverlay('none');
  assert.ok(w.calls.some(call => call.command === 'content_webview_history'));
  w.listeners.get('focus')({ payload: false });
  await flush();
  w.calls.length = 0;
  await w.fire(2000);
  assert.equal(w.calls.length, 0);
  w.listeners.get('focus')({ payload: true });
  await flush();
  assert.ok(w.calls.some(call => call.command === 'content_webview_history'));
  w.document.hidden = true;
  w.listeners.get('visibilitychange')();
  await flush();
  w.calls.length = 0;
  await w.fire(2000);
  assert.equal(w.calls.length, 0);
});

test('unchanged layouts skip IPC, hidden pages are untouched, and close/reopen clears caches', async t => {
  const w = workspace(t);
  await w.mount();
  await w.api.selectService('gemini');
  await w.api.selectService('chatgpt');
  w.calls.length = 0;
  w.listeners.get('resize')();
  await w.frame();
  assert.equal(w.calls.filter(call => call.method).length, 0);
  w.bridge.size = { width: 1400, height: 840 };
  w.listeners.get('resize')();
  await w.frame();
  assert.equal(w.calls.filter(call => call.label === 'wv-gemini').length, 0);
  assert.deepEqual(w.calls.filter(call => call.label === 'wv-chatgpt').map(call => call.method), ['setSize']);
  await w.api.closeServicePages('gemini');
  w.calls.length = 0;
  await w.api.selectService('gemini');
  assert.ok(w.calls.some(call => call.label === 'wv-gemini' && call.method === 'setSize'));
});

test('slow native layouts coalesce resize bursts and apply the latest bounds', async t => {
  const w = workspace(t);
  await w.mount();
  w.bridge.holdSize = deferred();
  w.bridge.size = { width: 1300, height: 840 };
  w.listeners.get('resize')();
  await w.frame();
  for (const width of [1320, 1350, 1400]) {
    w.bridge.size = { width, height: 840 };
    w.listeners.get('resize')();
    await w.frame();
  }
  assert.equal(w.calls.filter(call => call.label === 'wv-chatgpt' && call.method === 'setSize').length, 1);
  w.bridge.holdSize.resolve();
  await flush();
  const sizes = w.calls.filter(call => call.label === 'wv-chatgpt' && call.method === 'setSize');
  assert.equal(sizes.length, 2);
  assert.equal(sizes[1].value.width, 1400 - 192);
});

test('overlays wait for in-flight layout and hide completion', async t => {
  const w = workspace(t);
  await w.mount();
  w.bridge.holdSize = deferred();
  w.bridge.size = { width: 1300, height: 840 };
  w.listeners.get('resize')();
  await w.frame();
  const overlay = w.api.setOverlay('manage');
  await flush();
  assert.equal(w.api.overlay.value, 'none');
  w.bridge.holdSize.resolve();
  await overlay;
  assert.equal(w.api.overlay.value, 'manage');
  assert.equal(w.calls.filter(call => call.label === 'wv-chatgpt' && call.method === 'hide').length, 1);
  assert.equal(w.calls.filter(call => call.label === 'wv-chatgpt' && call.method === 'show').length, 0);
});
