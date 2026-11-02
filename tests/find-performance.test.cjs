const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const { test } = require('node:test');

function page() {
  const styles = new Map(), observers = [];
  const block = { parentElement: null, display: 'block' };
  let scans = 0, reads = 0;
  const nodes = ['hel', 'lo hello', ' world'].map(data => ({
    data, get length() { return this.data.length; },
    parentElement: { parentElement: block, display: 'inline', closest: () => null, getClientRects: () => [1], scrollIntoView() {} },
  }));
  const document = {
    body: block, documentElement: block,
    createTreeWalker(body, filter, { acceptNode }) {
      scans++;
      let index = -1;
      return { currentNode: null, nextNode() {
        while (++index < nodes.length) if (acceptNode(nodes[index]) === 1) { this.currentNode = nodes[index]; return true; }
        return false;
      } };
    },
    createRange: () => ({ setStart(node, offset) { this.startContainer = node; this.startOffset = offset; }, setEnd(node, offset) { this.endContainer = node; this.endOffset = offset; } }),
    getElementById: id => styles.get(id),
    createElement: () => ({ remove() { styles.delete(this.id); } }),
    head: { append: style => styles.set(style.id, style) },
  };
  const context = vm.createContext({
    window: {}, document, innerWidth: 1280, innerHeight: 840,
    CSS: { highlights: new Map() }, Highlight: class extends Set { constructor(...ranges) { super(ranges); } },
    NodeFilter: { SHOW_TEXT: 4, FILTER_ACCEPT: 1, FILTER_REJECT: 2 },
    getComputedStyle: element => { reads++; return { display: element.display, visibility: 'visible' }; },
    MutationObserver: class {
      constructor(callback) { this.callback = callback; this.records = []; this.active = false; observers.push(this); }
      observe() { this.active = true; }
      disconnect() { this.active = false; this.records = []; }
      takeRecords() { const records = this.records; this.records = []; return records; }
    },
  });
  context.window.CSS = context.CSS;
  const find = vm.runInContext(`(${fs.readFileSync(path.join(__dirname, '../src-tauri/src/find.js'), 'utf8')})`, context);
  return { find, context, nodes, observers, scans: () => scans, reads: () => reads };
}

test('find keeps inline matches and cycles cached ranges without another DOM scan', () => {
  const p = page();
  assert.equal(p.find({ query: 'hello', direction: 0 }).total, 2);
  const ranges = p.context.window.__aipanelFind.ranges;
  assert.equal(ranges[0].startContainer, p.nodes[0]);
  assert.equal(ranges[0].startOffset, 0);
  assert.equal(ranges[0].endContainer, p.nodes[1]);
  assert.equal(ranges[0].endOffset, 2);
  assert.equal(ranges[1].startOffset, 3);
  assert.equal(ranges[1].endOffset, 8);
  const reads = p.reads();
  assert.equal(p.find({ query: 'hello', direction: 1 }).index, 2);
  assert.equal(p.find({ query: 'hello', direction: 1 }).index, 1);
  assert.equal(p.find({ query: 'hello', direction: -1 }).index, 2);
  assert.equal(p.scans(), 1);
  assert.equal(p.reads(), reads);
  assert.equal(p.context.window.__aipanelFind.ranges, ranges);
  assert.equal(p.observers.filter(observer => observer.active).length, 1);
});

test('pending mutations, streaming text and viewport changes invalidate cached results', () => {
  const p = page();
  p.find({ query: 'hello', direction: 0 });
  p.nodes[1].data = 'lo world';
  // MutationObserver delivery can lag behind the next synchronous query.
  p.observers.at(-1).records.push({ type: 'characterData' });
  assert.equal(p.find({ query: 'hello', direction: 1 }).total, 1);
  assert.equal(p.scans(), 2);
  p.nodes[2].data = ' hello';
  p.observers.at(-1).callback();
  assert.equal(p.find({ query: 'hello', direction: 1 }).total, 2);
  assert.equal(p.scans(), 3);
  p.context.innerWidth = 900;
  p.find({ query: 'hello', direction: 1 });
  assert.equal(p.scans(), 4);
  p.find({ query: '', direction: 0 });
  assert.equal(p.context.window.__aipanelFind, undefined);
  assert.equal(p.observers.filter(observer => observer.active).length, 0);
  assert.equal(p.context.CSS.highlights.size, 0);
  assert.equal(p.context.document.getElementById('aipanel-find-style'), undefined);
});
