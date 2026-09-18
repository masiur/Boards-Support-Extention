const TICKET_RE = /support\.wpmanageninja\.com\/?#\/tickets\/(\d+)/g;
const TICKET_URL = (id) => `https://support.wpmanageninja.com/#/tickets/${id}/view`;
const MIN_WIDTH = 320;

const CSS = `
  :host { all: initial; }
  * { box-sizing: border-box; }
  .panel { position: fixed; top: 0; right: 0; bottom: 0; z-index: 2147483647; display: flex; flex-direction: column;
    background: #fff; color: #1f2430; border-left: 1px solid #d5d8e0; box-shadow: -6px 0 24px rgba(0,0,0,.14);
    font: 13px/1.5 system-ui, sans-serif; }
  .resize { position: absolute; left: -3px; top: 0; bottom: 0; width: 7px; cursor: ew-resize; }
  .resize:hover, .resize.active { background: rgba(75,63,181,.35); }
  .head { display: flex; align-items: center; gap: 6px; padding: 10px 12px; background: #4b3fb5; color: #fff; }
  .head b { flex: 1; }
  .head button { background: rgba(255,255,255,.15); border: 0; border-radius: 4px; color: #fff; cursor: pointer;
    font-size: 14px; width: 26px; height: 26px; }
  .head button:hover { background: rgba(255,255,255,.3); }
  .body { flex: 1; overflow: auto; padding: 10px 12px; background: #f3f4f8; }
  .foot { padding: 6px 12px; border-top: 1px solid #e0e3eb; background: #fff; color: #999; font-size: 11px;
    text-align: center; letter-spacing: .2px; }
  .foot b { color: #4b3fb5; font-weight: 600; }
  .tab { position: fixed; right: 0; top: 40%; z-index: 2147483647; background: #4b3fb5; color: #fff; border: 0;
    border-radius: 8px 0 0 8px; padding: 10px 8px; cursor: pointer; font: 600 12px system-ui, sans-serif;
    writing-mode: vertical-rl; box-shadow: -2px 2px 10px rgba(0,0,0,.2); }
  .ticket { background: #fff; border: 1px solid #e0e3eb; border-radius: 8px; margin-bottom: 10px; }
  .ticket > summary { display: flex; align-items: center; gap: 8px; padding: 9px 10px; cursor: pointer; list-style: none; }
  .ticket > summary::-webkit-details-marker { display: none; }
  .ticket > summary::before { content: '▸'; color: #888; }
  .ticket[open] > summary::before { content: '▾'; }
  .ticket > summary .id { font-weight: 700; color: #4b3fb5; white-space: nowrap; }
  .ticket > summary .ttl { flex: 1; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
  .ticket[open] > summary .ttl { white-space: normal; font-weight: 600; }
  .inner { padding: 0 10px 10px; border-top: 1px solid #eef0f5; }
  .meta { display: flex; flex-wrap: wrap; gap: 4px; margin: 8px 0; }
  .tag { background: #eef0f6; border-radius: 4px; padding: 1px 6px; font-size: 11px; white-space: nowrap; }
  .tag.s-new, .tag.s-active { background: #dff5e7; color: #14663a; }
  .tag.s-closed { background: #e6e6ea; color: #555; }
  .tag.s-error { background: #fde3e1; color: #b3261e; }
  .info { display: grid; grid-template-columns: auto 1fr; gap: 4px 12px; margin: 8px 0 0; font-size: 12px; }
  .info dt { color: #888; }
  .info dd { margin: 0; color: #1f2430; font-weight: 500; }
  .info .sub { display: block; color: #777; font-weight: 400; font-size: 11px; text-decoration: none; }
  .info a.sub:hover { text-decoration: underline; }
  .open-link { display: inline-block; margin-top: 6px; color: #4b3fb5; font-size: 12px; }
  .thread { margin-top: 8px; }
  .thread > summary { cursor: pointer; color: #4b3fb5; font-size: 12px; }
  .msg { margin: 6px 0; padding: 6px 8px; background: #f6f7fa; border-radius: 6px; white-space: pre-wrap;
    word-break: break-word; }
  .msg.agent { background: #eef0ff; }
  .msg.note { background: #fff7d6; }
  .msg .who { font-weight: 600; font-size: 11px; color: #444; display: block; margin-bottom: 2px; }
  .error { color: #b3261e; padding: 8px 0; }
  .error a { color: inherit; }
`;

const host = document.createElement('div');
const root = host.attachShadow({ mode: 'open' });
const cache = new Map(); // ticket id -> Promise<{ok, data|error}>
const networkIds = new Map(); // task id -> Map<endpoint, ticket ids> (from inject.js)
const ui = { width: 440, collapsed: false };
let currentKey = '';

function el(tag, props, ...children) {
  const node = Object.assign(document.createElement(tag), props);
  node.append(...children.filter((c) => c != null && c !== false));
  return node;
}

// Ticket bodies are untrusted HTML: only ever rendered as text.
function htmlToText(html) {
  const doc = new DOMParser().parseFromString(String(html || '').replace(/<(br|\/p|\/div|\/li)\b[^>]*>/gi, '$&\n'), 'text/html');
  return doc.body.textContent.replace(/\n{3,}/g, '\n\n').trim();
}

function personName(p) {
  if (!p) return null;
  return p.full_name || [p.first_name, p.last_name].filter(Boolean).join(' ') || p.email || null;
}

function fmtDate(s) {
  const d = new Date(s);
  return s && !isNaN(d) ? d.toLocaleString([], { dateStyle: 'medium', timeStyle: 'short' }) : '—';
}

function timeAgo(s) {
  const secs = (new Date(s) - Date.now()) / 1000;
  if (!s || isNaN(secs)) return '—';
  const rtf = new Intl.RelativeTimeFormat([], { numeric: 'auto' });
  for (const [unit, size] of [['year', 31536000], ['month', 2592000], ['day', 86400], ['hour', 3600], ['minute', 60]]) {
    if (Math.abs(secs) >= size) return rtf.format(Math.round(secs / size), unit);
  }
  return 'just now';
}

function fetchTicket(id, force) {
  if (force || !cache.has(id)) {
    cache.set(id, chrome.runtime.sendMessage({ type: 'getTicket', id })
      .catch((e) => ({ ok: false, error: e.message })));
  }
  return cache.get(id);
}

function renderTicket(id, result, open) {
  const idLabel = el('span', { className: 'id', textContent: '#' + id });
  const link = el('a', { className: 'open-link', href: TICKET_URL(id), target: '_blank', textContent: 'Open in Support ↗' });

  if (!result || !result.ok) {
    const opts = el('a', { href: '#', textContent: 'Options' });
    opts.addEventListener('click', (e) => { e.preventDefault(); chrome.runtime.sendMessage({ type: 'openOptions' }); });
    return el('details', { className: 'ticket', open },
      el('summary', {}, idLabel, el('span', { className: 'ttl', textContent: 'Could not load' }), el('span', { className: 'tag s-error', textContent: 'error' })),
      el('div', { className: 'inner' },
        el('div', { className: 'error' }, (result && result.error) || 'Failed to load', ' — ', opts), link));
  }

  const t = result.data.ticket || result.data;
  const responses = result.data.responses || [];
  const customer = t.customer || {};
  const status = el('span', { className: 'tag s-' + (t.status || ''), textContent: t.status || '?' });

  const thread = el('details', { className: 'thread', open: true },
    el('summary', { textContent: `Conversation (${responses.length} replies)` }),
    el('div', { className: 'msg' }, el('span', { className: 'who', textContent: `${personName(customer) || 'Customer'} · ${fmtDate(t.created_at)}` }), htmlToText(t.content)),
    ...responses.map((r) => {
      const isNote = r.conversation_type === 'note';
      const isAgent = r.person && r.person.person_type === 'agent';
      return el('div', { className: 'msg' + (isNote ? ' note' : isAgent ? ' agent' : '') },
        el('span', { className: 'who', textContent: `${personName(r.person) || '—'}${isNote ? ' (note)' : ''} · ${fmtDate(r.created_at)}` }),
        htmlToText(r.content));
    }));

  return el('details', { className: 'ticket', open },
    el('summary', {}, idLabel, el('span', { className: 'ttl', textContent: t.title || '' }), status),
    el('div', { className: 'inner' },
      el('div', { className: 'meta' },
        t.priority && el('span', { className: 'tag', textContent: 'priority: ' + t.priority }),
        t.product && el('span', { className: 'tag', textContent: t.product.title }),
        ...(t.tags || []).map((tag) => el('span', { className: 'tag', textContent: tag.title }))),
      el('dl', { className: 'info' },
        el('dt', { textContent: 'Customer' }),
        el('dd', {}, personName(customer) || '—',
          customer.email && el('a', { className: 'sub', href: 'mailto:' + customer.email, textContent: customer.email })),
        el('dt', { textContent: 'Agent' }),
        el('dd', { textContent: personName(t.agent) || 'Unassigned' }),
        el('dt', { textContent: 'Created' }),
        el('dd', { title: fmtDate(t.created_at) }, timeAgo(t.created_at), el('span', { className: 'sub', textContent: fmtDate(t.created_at) })),
        el('dt', { textContent: 'Updated' }),
        el('dd', { title: fmtDate(t.updated_at) }, timeAgo(t.updated_at), el('span', { className: 'sub', textContent: fmtDate(t.updated_at) }))),
      link,
      thread));
}

function saveUi() {
  chrome.storage.local.set({ ui });
}

function enableResize(handle, panel) {
  handle.addEventListener('pointerdown', (e) => {
    e.preventDefault();
    handle.setPointerCapture(e.pointerId);
    handle.classList.add('active');
    const move = (ev) => {
      ui.width = Math.round(Math.min(Math.max(window.innerWidth - ev.clientX, MIN_WIDTH), window.innerWidth * 0.95));
      panel.style.width = ui.width + 'px';
    };
    handle.addEventListener('pointermove', move);
    handle.addEventListener('pointerup', () => {
      handle.removeEventListener('pointermove', move);
      handle.classList.remove('active');
      saveUi();
    }, { once: true });
  });
}

async function render(ids, force) {
  const key = ids.join(',');
  const style = el('style', { textContent: CSS });
  const toggle = (collapsed) => { ui.collapsed = collapsed; saveUi(); render(ids, false); };

  if (ui.collapsed) {
    const tab = el('button', { className: 'tab', title: 'Show support tickets', textContent: `Tickets (${ids.length})` });
    tab.addEventListener('click', () => toggle(false));
    root.replaceChildren(style, tab);
    return;
  }

  const body = el('div', { className: 'body', textContent: 'Loading…' });
  const refresh = el('button', { title: 'Refresh', textContent: '↻' });
  const collapse = el('button', { title: 'Collapse', textContent: '»' });
  const handle = el('div', { className: 'resize' });
  const panel = el('div', { className: 'panel' }, handle,
    el('div', { className: 'head' }, el('b', { textContent: `Support tickets (${ids.length})` }), refresh, collapse),
    body,
    el('div', { className: 'foot' }, 'Boards ↔ Support · by ', el('b', { textContent: 'Masiur' })));
  panel.style.width = Math.min(ui.width, window.innerWidth * 0.95) + 'px';

  refresh.addEventListener('click', () => render(ids, true));
  collapse.addEventListener('click', () => toggle(true));
  enableResize(handle, panel);
  root.replaceChildren(style, panel);

  const results = await Promise.all(ids.map((id) => fetchTicket(id, force)));
  if (key !== currentKey || !panel.isConnected) return; // task changed or re-rendered while loading
  // Single ticket: expanded. Multiple: compact list, first one expanded.
  body.replaceChildren(...ids.map((id, i) => renderTicket(id, results[i], i === 0)));
}

function findTicketIds() {
  const ids = new Set();
  const collect = (text) => { for (const m of text.matchAll(TICKET_RE)) ids.add(m[1]); };

  // Match per text node: body.textContent glues adjacent nodes together, which
  // appends stray digits to an id (177567 + "6" -> 1775676).
  const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
  for (let n = walker.nextNode(); n; n = walker.nextNode()) {
    if (n.nodeValue.length > 30) collect(n.nodeValue);
  }
  for (const a of document.links) collect(a.href);

  const task = /\/tasks\/(\d+)/.exec(location.hash);
  const fromNetwork = task && networkIds.get(task[1]);
  if (fromNetwork) fromNetwork.forEach((list) => list.forEach((id) => ids.add(id)));

  return [...ids].sort((a, b) => a - b).slice(0, 15);
}

function scan() {
  if (!document.body) return;
  const ids = findTicketIds();
  const key = ids.join(',');
  if (key === currentKey) return;
  currentKey = key;

  if (!ids.length) {
    host.remove();
    return;
  }
  if (!host.isConnected) document.documentElement.append(host);
  render(ids, false);
}

let timer;
function scheduleScan() {
  clearTimeout(timer);
  timer = setTimeout(scan, 400);
}

window.addEventListener('message', (e) => {
  const d = e.data;
  if (e.source !== window || !d || d.source !== 'bse-tickets' || !Array.isArray(d.ids)) return;
  if (!networkIds.has(d.taskId)) networkIds.set(d.taskId, new Map());
  networkIds.get(d.taskId).set(d.endpoint, d.ids.filter((id) => /^\d+$/.test(id)));
  scheduleScan();
});
window.addEventListener('hashchange', scheduleScan);

async function start() {
  Object.assign(ui, (await chrome.storage.local.get({ ui })).ui);
  new MutationObserver(scheduleScan).observe(document.body, { childList: true, subtree: true, characterData: true });
  scan();
}

if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start);
else start();
