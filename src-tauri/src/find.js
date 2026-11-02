// Executed by the shell through eval_with_callback. Text nodes are never wrapped
// or replaced: framework-managed documents retain their DOM and event handlers.
({ query, direction }) => {
  const previous = window.__aipanelFind;
  if (previous?.observer?.takeRecords().length) previous.dirty = true;
  previous?.observer?.disconnect();
  if (window.CSS?.highlights) {
    CSS.highlights.delete('aipanel-matches');
    CSS.highlights.delete('aipanel-current');
  }
  if (!query || !document.body) {
    delete window.__aipanelFind;
    document.getElementById('aipanel-find-style')?.remove();
    return { total: 0, index: 0 };
  }
  const reuse = previous?.query === query && Array.isArray(previous.ranges) && !previous.dirty && previous.body === document.body &&
    previous.width === innerWidth && previous.height === innerHeight;
  const ranges = reuse ? previous.ranges : [];
  if (!reuse) {
    const styles = new WeakMap();
    const visible = new WeakMap();
    const styleOf = element => {
      if (!styles.has(element)) styles.set(element, getComputedStyle(element));
      return styles.get(element);
    };
    const nodes = [];
    const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT, {
      acceptNode(node) {
        const parent = node.parentElement;
        if (!parent || parent.closest('script,style,noscript,textarea,input,select,[contenteditable], [hidden], [aria-hidden="true"]')) return NodeFilter.FILTER_REJECT;
        if (!visible.has(parent)) {
          const style = styleOf(parent);
          visible.set(parent, style.visibility !== 'hidden' && style.display !== 'none' && !!parent.getClientRects().length);
        }
        return visible.get(parent) ? NodeFilter.FILTER_ACCEPT : NodeFilter.FILTER_REJECT;
      }
    });
    while (walker.nextNode()) nodes.push(walker.currentNode);
    const needle = query.toLowerCase();
    // Work within contiguous inline text runs; never join unrelated block content.
    const blocks = [];
    for (const node of nodes) {
      let block = node.parentElement;
      while (block.parentElement && styleOf(block).display === 'inline') block = block.parentElement;
      const last = blocks[blocks.length - 1];
      if (last?.element === block) last.nodes.push(node);
      else blocks.push({ element: block, nodes: [node] });
    }
    for (const block of blocks) {
      const text = block.nodes.map(node => node.data).join('');
      const lower = text.toLowerCase();
      let start = 0;
      let cursor = 0, offset = 0;
      while ((start = lower.indexOf(needle, start)) !== -1) {
        const end = start + query.length;
        // Matches are ordered: continue from the last node instead of rescanning
        // every inline node for every occurrence in a long conversation.
        while (cursor < block.nodes.length && start >= offset + block.nodes[cursor].length) offset += block.nodes[cursor++].length;
        const startNode = block.nodes[cursor], startOffset = start - offset;
        while (cursor < block.nodes.length && end > offset + block.nodes[cursor].length) offset += block.nodes[cursor++].length;
        const endNode = block.nodes[cursor], endOffset = end - offset;
        if (startNode && endNode) {
          const range = document.createRange();
          range.setStart(startNode, startOffset);
          range.setEnd(endNode, endOffset);
          ranges.push(range);
        }
        start = end;
      }
    }
  }
  const total = ranges.length;
  const current = previous?.query === query ? previous.index : -1;
  const index = total ? (current < 0 ? (direction < 0 ? total - 1 : 0) : (current + direction + total) % total) : -1;
  const state = { query, index, ranges, body: document.body, width: innerWidth, height: innerHeight, dirty: false };
  if (CSS.highlights && typeof Highlight !== 'undefined') {
    let style = document.getElementById('aipanel-find-style');
    if (!style) {
      style = document.createElement('style');
      style.id = 'aipanel-find-style';
      style.textContent = '::highlight(aipanel-matches){background-color:Mark;color:MarkText}::highlight(aipanel-current){background-color:Highlight;color:HighlightText}';
      document.head.append(style);
    }
    const matches = new Highlight();
    for (const range of ranges) matches.add(range);
    CSS.highlights.set('aipanel-matches', matches);
    if (index >= 0) CSS.highlights.set('aipanel-current', new Highlight(ranges[index]));
  } else if (index >= 0) {
    // Older WebKit: highlight only the current result with the native selection.
    const selection = getSelection();
    selection.removeAllRanges();
    selection.addRange(ranges[index]);
  }
  if (index >= 0) ranges[index].startContainer.parentElement?.scrollIntoView({ block: 'center', inline: 'nearest' });
  // Observe only while find is open. Streaming text, DOM and style changes
  // invalidate the cache before the next search, without rescanning on mutation.
  state.observer = new MutationObserver(() => { state.dirty = true; });
  state.observer.observe(document.documentElement, { subtree: true, childList: true, characterData: true, attributes: true });
  window.__aipanelFind = state;
  return { total, index: index + 1 };
}
