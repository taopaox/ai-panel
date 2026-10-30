// Executed by the shell through eval_with_callback. Text nodes are never wrapped
// or replaced: framework-managed documents retain their DOM and event handlers.
({ query, direction }) => {
  const previous = window.__aipanelFind;
  if (window.CSS?.highlights) {
    CSS.highlights.delete('aipanel-matches');
    CSS.highlights.delete('aipanel-current');
  }
  if (!query || !document.body) {
    delete window.__aipanelFind;
    document.getElementById('aipanel-find-style')?.remove();
    return { total: 0, index: 0 };
  }
  const nodes = [];
  const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT, {
    acceptNode(node) {
      const parent = node.parentElement;
      if (!parent || parent.closest('script,style,noscript,textarea,input,select,[contenteditable], [hidden], [aria-hidden="true"]')) return NodeFilter.FILTER_REJECT;
      const style = getComputedStyle(parent);
      return style.visibility === 'hidden' || style.display === 'none' || !parent.getClientRects().length
        ? NodeFilter.FILTER_REJECT : NodeFilter.FILTER_ACCEPT;
    }
  });
  while (walker.nextNode()) nodes.push(walker.currentNode);
  const ranges = [];
  const needle = query.toLowerCase();
  // Work within contiguous inline text runs; never join unrelated block content.
  const blocks = [];
  for (const node of nodes) {
    let block = node.parentElement;
    while (block.parentElement && getComputedStyle(block).display === 'inline') block = block.parentElement;
    const last = blocks[blocks.length - 1];
    if (last?.element === block) last.nodes.push(node);
    else blocks.push({ element: block, nodes: [node] });
  }
  for (const block of blocks) {
    const text = block.nodes.map(node => node.data).join('');
    const lower = text.toLowerCase();
    let start = 0;
    while ((start = lower.indexOf(needle, start)) !== -1) {
      const end = start + query.length;
      let offset = 0, startNode, startOffset, endNode, endOffset;
      for (const node of block.nodes) {
        const next = offset + node.length;
        if (!startNode && start < next) { startNode = node; startOffset = start - offset; }
        if (end <= next) { endNode = node; endOffset = end - offset; break; }
        offset = next;
      }
      if (startNode && endNode) {
        const range = document.createRange();
        range.setStart(startNode, startOffset);
        range.setEnd(endNode, endOffset);
        ranges.push(range);
      }
      start = end;
    }
  }
  const total = ranges.length;
  const current = previous?.query === query ? previous.index : -1;
  const index = total ? (current < 0 ? (direction < 0 ? total - 1 : 0) : (current + direction + total) % total) : -1;
  window.__aipanelFind = { query, index };
  if (CSS.highlights && typeof Highlight !== 'undefined') {
    let style = document.getElementById('aipanel-find-style');
    if (!style) {
      style = document.createElement('style');
      style.id = 'aipanel-find-style';
      style.textContent = '::highlight(aipanel-matches){background-color:Mark;color:MarkText}::highlight(aipanel-current){background-color:Highlight;color:HighlightText}';
      document.head.append(style);
    }
    CSS.highlights.set('aipanel-matches', new Highlight(...ranges));
    if (index >= 0) CSS.highlights.set('aipanel-current', new Highlight(ranges[index]));
  } else if (index >= 0) {
    // Older WebKit: highlight only the current result with the native selection.
    const selection = getSelection();
    selection.removeAllRanges();
    selection.addRange(ranges[index]);
  }
  if (index >= 0) ranges[index].startContainer.parentElement?.scrollIntoView({ block: 'center', inline: 'nearest' });
  return { total, index: index + 1 };
}
