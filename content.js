const TICKET_RE = /support\.wpmanageninja\.com\/?#\/tickets\/(\d+)/g;
const TICKET_URL = (id) => `https://support.wpmanageninja.com/#/tickets/${id}/view`;
const MIN_WIDTH = 360;
const WIDE_AT = 760; // drawer width where summary and conversation sit side by side
const LONG_MESSAGE = 900; // chars before a message is clamped behind "Show more"

const CSS = `
  :host { all: initial; }
  * { box-sizing: border-box; }
  .drawer { position: fixed; top: 12px; right: 12px; bottom: 12px; z-index: 2147483647; display: flex;
    flex-direction: column; background: #fff; color: #0f172a; border: 1px solid #e2e8f0; border-radius: 14px;
    box-shadow: 0 20px 50px rgba(15,23,42,.22), 0 2px 8px rgba(15,23,42,.08); overflow: hidden;
    font: 14px/1.6 -apple-system, BlinkMacSystemFont, 'Segoe UI', Inter, Roboto, sans-serif;
  }
  .drawer.enter { animation: slide .22s ease-out; }
  @keyframes slide { from { transform: translateX(24px); opacity: 0; } }
  .resize { position: absolute; left: 0; top: 0; bottom: 0; width: 8px; cursor: ew-resize; z-index: 2; }
  .resize::after { content: ''; position: absolute; left: 3px; top: 50%; width: 3px; height: 44px; margin-top: -22px;
    border-radius: 3px; background: #cbd5e1; opacity: 0; transition: opacity .15s; }
  .resize:hover::after, .resize.active::after { opacity: 1; background: #6366f1; }

  .head { display: flex; align-items: center; gap: 8px; padding: 12px 14px 12px 18px; border-bottom: 1px solid #eef2f7; }
  .head .logo { width: 26px; height: 26px; border-radius: 8px; background: #4f46e5; color: #fff; display: grid;
    place-items: center; font-weight: 700; font-size: 13px; }
  .head h1 { flex: 1; margin: 0; font-size: 14px; font-weight: 650; }
  .head h1 span { color: #94a3b8; font-weight: 500; margin-left: 4px; }
  .icon-btn { width: 30px; height: 30px; border: 0; border-radius: 8px; background: transparent; color: #64748b;
    cursor: pointer; display: grid; place-items: center; }
  .icon-btn:hover { background: #f1f5f9; color: #0f172a; }
  .icon-btn svg { width: 16px; height: 16px; }

  .tabs { display: flex; gap: 6px; padding: 10px 18px; overflow-x: auto; border-bottom: 1px solid #eef2f7; background: #f8fafc; }
  .tabs button { display: flex; align-items: center; gap: 6px; border: 1px solid #e2e8f0; background: #fff; color: #334155;
    border-radius: 999px; padding: 4px 12px; font: inherit; font-size: 13px; font-weight: 600; cursor: pointer; white-space: nowrap; }
  .tabs button:hover { border-color: #c7d2fe; }
  .tabs button.on { background: #4f46e5; border-color: #4f46e5; color: #fff; }
  .dot { width: 8px; height: 8px; border-radius: 50%; background: #94a3b8; flex: none; }
  .dot.customer { background: #f59e0b; } .dot.agent { background: #10b981; } .dot.error { background: #ef4444; }

  .content { flex: 1; overflow: auto; padding: 18px; }
  .wide .content { display: grid; grid-template-columns: 340px 1fr; gap: 24px; align-items: start; }
  .wide .summary { position: sticky; top: 0; }

  .idline { display: flex; align-items: center; gap: 8px; font-size: 13px; }
  .idline a { color: #4f46e5; font-weight: 700; text-decoration: none; }
  .idline a:hover { text-decoration: underline; }
  .pill { border-radius: 999px; padding: 1px 10px; font-size: 12px; font-weight: 600; background: #e2e8f0; color: #475569;
    text-transform: capitalize; }
  .pill.new, .pill.active { background: #dcfce7; color: #166534; }
  .title { margin: 6px 0 10px; font-size: 17px; line-height: 1.4; font-weight: 680; letter-spacing: -.01em; }
  .chips { display: flex; flex-wrap: wrap; gap: 6px; margin-bottom: 14px; }
  .chip { background: #f1f5f9; color: #475569; border-radius: 6px; padding: 1px 8px; font-size: 12px; }

  .signal { border-radius: 12px; padding: 12px 14px; margin-bottom: 12px; border: 1px solid; }
  .signal .k { font-size: 11px; font-weight: 700; letter-spacing: .06em; text-transform: uppercase; opacity: .8; }
  .signal .v { font-size: 16px; font-weight: 680; margin-top: 2px; }
  .signal .s { font-size: 13px; margin-top: 2px; opacity: .85; }
  .signal.customer { background: #fffbeb; border-color: #fde68a; color: #78350f; }
  .signal.agent { background: #ecfdf5; border-color: #a7f3d0; color: #064e3b; }
  .signal.closed { background: #f8fafc; border-color: #e2e8f0; color: #475569; }

  .stats { display: grid; grid-template-columns: 1fr 1fr; gap: 8px; margin-bottom: 14px; }
  .stat { border: 1px solid #e2e8f0; border-radius: 10px; padding: 9px 12px; }
  .stat .k { font-size: 11px; font-weight: 600; letter-spacing: .05em; text-transform: uppercase; color: #94a3b8; }
  .stat .v { font-size: 15px; font-weight: 650; margin-top: 1px; }
  .stat .s { font-size: 12px; color: #64748b; }

  .people { border-top: 1px solid #eef2f7; padding-top: 12px; display: grid; gap: 10px; }
  .person { display: flex; align-items: center; gap: 10px; }
  .avatar { width: 32px; height: 32px; border-radius: 50%; display: grid; place-items: center; font-size: 12px;
    font-weight: 700; flex: none; background: #fef3c7; color: #92400e; }
  .avatar.agent { background: #e0e7ff; color: #3730a3; }
  .avatar.note { background: #fef9c3; color: #854d0e; }
  .person .n { font-weight: 600; line-height: 1.3; }
  .person .r { font-size: 12px; color: #64748b; line-height: 1.3; }
  .person a { color: inherit; text-decoration: none; } .person a:hover { text-decoration: underline; }
  .open { display: inline-flex; margin-top: 14px; color: #4f46e5; font-size: 13px; font-weight: 600; text-decoration: none; }
  .open:hover { text-decoration: underline; }

  .thread-head { display: flex; align-items: center; margin: 22px 0 10px; }
  .wide .thread-head { margin-top: 0; }
  .thread-head h2 { flex: 1; margin: 0; font-size: 12px; font-weight: 700; letter-spacing: .06em; text-transform: uppercase; color: #64748b; }
  .link-btn { border: 0; background: none; color: #4f46e5; font: inherit; font-size: 13px; font-weight: 600; cursor: pointer; padding: 0; }
  .link-btn:hover { text-decoration: underline; }

  .msg { display: flex; gap: 10px; margin-bottom: 14px; }
  .bubble { flex: 1; min-width: 0; border: 1px solid #e2e8f0; border-radius: 4px 12px 12px 12px; padding: 10px 14px; background: #fff; }
  .msg.agent .bubble { background: #f5f7ff; border-color: #e0e7ff; }
  .msg.note .bubble { background: #fefce8; border-color: #fef08a; }
  .msg.latest .bubble { box-shadow: 0 0 0 2px #c7d2fe; }
  .by { display: flex; flex-wrap: wrap; align-items: baseline; gap: 6px; margin-bottom: 4px; }
  .by b { font-size: 13.5px; }
  .role { font-size: 11px; font-weight: 700; letter-spacing: .04em; text-transform: uppercase; color: #b45309; }
  .msg.agent .role { color: #4338ca; } .msg.note .role { color: #a16207; }
  .when { font-size: 12px; color: #94a3b8; margin-left: auto; }
  .text { font-size: 14.5px; line-height: 1.65; color: #1e293b; white-space: pre-wrap; overflow-wrap: anywhere; }
  .text.clamp { display: -webkit-box; -webkit-box-orient: vertical; -webkit-line-clamp: 10; overflow: hidden; }

  .state { padding: 40px 10px; text-align: center; color: #64748b; }
  .state.error { color: #b91c1c; }
  .state a { color: inherit; font-weight: 600; }

  .foot { padding: 7px 12px; border-top: 1px solid #eef2f7; color: #94a3b8; font-size: 11px; text-align: center; }
  .foot b { color: #4f46e5; font-weight: 600; }

  .launcher { position: fixed; right: 0; top: 38%; z-index: 2147483647; display: flex; align-items: center; gap: 8px;
    background: #4f46e5; color: #fff; border: 0; border-radius: 12px 0 0 12px; padding: 12px 9px; cursor: pointer;
    font: 600 12px -apple-system, BlinkMacSystemFont, sans-serif; writing-mode: vertical-rl;
    box-shadow: -4px 4px 16px rgba(15,23,42,.25); }
  .launcher:hover { padding-right: 13px; }
  .launcher .dot { box-shadow: 0 0 0 2px rgba(255,255,255,.6); }
`;

const ICONS = {
  refresh: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 12a9 9 0 1 1-2.64-6.36"/><path d="M21 3v6h-6"/></svg>',
  expand: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M15 3h6v6M9 21H3v-6M21 3l-7 7M3 21l7-7"/></svg>',
  shrink: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M4 14h6v6M20 10h-6V4M14 10l7-7M3 21l7-7"/></svg>',
  minimize: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M13 17l5-5-5-5M6 17l5-5-5-5"/></svg>'
};

const host = document.createElement('div');
const root = host.attachShadow({ mode: 'open' });
const cache = new Map(); // ticket id -> Promise<{ok, data|error}>
const networkIds = new Map(); // task id -> Map<endpoint, ticket ids> (from inject.js)
const ui = { width: 480, collapsed: false, expanded: false };
const state = { ids: [], results: new Map(), selected: null };
let currentKey = '';

function el(tag, props, ...children) {
  const node = Object.assign(document.createElement(tag), props);
  node.append(...children.filter((c) => c != null && c !== false));
  return node;
}

function iconButton(icon, title, onClick) {
  const btn = el('button', { className: 'icon-btn', title });
  btn.innerHTML = ICONS[icon]; // static markup from ICONS only
  btn.addEventListener('click', onClick);
  return btn;
}

// Ticket bodies are untrusted HTML: only ever rendered as text.
function htmlToText(html) {
  const marked = String(html || '')
    .replace(/<li\b[^>]*>/gi, '$&• ')
    .replace(/<(br|\/div|\/li|\/tr)\b[^>]*>/gi, '$&\n')
    .replace(/<\/(p|h[1-6]|ul|ol|blockquote|pre)\b[^>]*>/gi, '$&\n\n');
  const doc = new DOMParser().parseFromString(marked, 'text/html');
  return doc.body.textContent.replace(/[ \t]+\n/g, '\n').replace(/\n{3,}/g, '\n\n').trim();
}

function personName(p) {
  if (!p) return null;
  return p.full_name || [p.first_name, p.last_name].filter(Boolean).join(' ') || p.email || null;
}

function initials(name) {
  return (name || '?').replace(/[^\p{L}\p{N}\s]/gu, '').trim().split(/\s+/).slice(0, 2).map((w) => w[0]).join('').toUpperCase();
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

// Who spoke last, and how much each side has said. Notes and system entries don't count as replies.
function analyze(result) {
  const t = result.data.ticket || result.data;
  const customer = t.customer || {};
  const side = (r) => (r.person && r.person.person_type === 'customer') || (r.person_id && r.person_id == t.customer_id) ? 'customer' : 'agent';

  const thread = (result.data.responses || [])
    .map((r) => ({ kind: r.conversation_type === 'response' ? side(r) : 'note', name: personName(r.person) || '—', at: r.created_at, html: r.content }))
    .sort((a, b) => new Date(a.at) - new Date(b.at));
  thread.unshift({ kind: 'customer', name: personName(customer) || 'Customer', at: t.created_at, html: t.content, original: true });

  const replies = thread.filter((m) => m.kind !== 'note');
  return {
    t, customer, thread,
    last: replies[replies.length - 1],
    customerReplies: replies.filter((m) => m.kind === 'customer' && !m.original).length,
    agentReplies: replies.filter((m) => m.kind === 'agent').length,
    closed: t.status === 'closed'
  };
}

// Tab/launcher indicator: whose move it is.
function dotClass(id) {
  const result = state.results.get(id);
  if (!result) return '';
  if (!result.ok) return 'error';
  const a = analyze(result);
  return a.closed ? '' : a.last.kind;
}

function fetchTicket(id, force) {
  if (force || !cache.has(id)) {
    cache.set(id, chrome.runtime.sendMessage({ type: 'getTicket', id })
      .catch((e) => ({ ok: false, error: e.message })));
  }
  return cache.get(id);
}

function renderMessage(m, isLatest) {
  const text = htmlToText(m.html);
  const body = el('div', { className: 'text' + (text.length > LONG_MESSAGE ? ' clamp' : ''), textContent: text });
  const more = text.length > LONG_MESSAGE && el('button', { className: 'link-btn', textContent: 'Show more' });
  if (more) {
    more.addEventListener('click', () => {
      more.textContent = body.classList.toggle('clamp') ? 'Show more' : 'Show less';
    });
  }
  const role = m.kind === 'note' ? 'Internal note' : m.kind === 'agent' ? 'Agent' : m.original ? 'Customer · original message' : 'Customer';

  return el('div', { className: `msg ${m.kind}${isLatest ? ' latest' : ''}` },
    el('div', { className: 'avatar ' + m.kind, textContent: initials(m.name) }),
    el('div', { className: 'bubble' },
      el('div', { className: 'by' },
        el('b', { textContent: m.name }),
        el('span', { className: 'role', textContent: role }),
        el('span', { className: 'when', title: fmtDate(m.at), textContent: `${timeAgo(m.at)} · ${fmtDate(m.at)}` })),
      body, more));
}

function renderTicket(id) {
  const result = state.results.get(id);
  if (!result) return [el('div', { className: 'state', textContent: `Loading ticket #${id}…` })];

  if (!result.ok) {
    const opts = el('a', { href: '#', textContent: 'Check extension options' });
    opts.addEventListener('click', (e) => { e.preventDefault(); chrome.runtime.sendMessage({ type: 'openOptions' }); });
    return [el('div', { className: 'state error' },
      el('div', { textContent: `Could not load ticket #${id}` }),
      el('div', { textContent: result.error || 'Request failed' }), opts)];
  }

  const a = analyze(result);
  const { t, customer, last } = a;
  const lastIsCustomer = last.kind === 'customer';

  const signal = el('div', { className: 'signal ' + (a.closed ? 'closed' : last.kind) },
    el('div', { className: 'k', textContent: 'Last reply' }),
    el('div', { className: 'v', textContent: `${lastIsCustomer ? 'Customer' : 'Support agent'} · ${timeAgo(last.at)}` }),
    el('div', { className: 's', textContent: a.closed ? `${last.name} · ticket is closed`
      : lastIsCustomer ? `${last.name} is waiting for an agent reply` : `${last.name} replied · waiting on customer` }));

  const stat = (k, v, s) => el('div', { className: 'stat' },
    el('div', { className: 'k', textContent: k }), el('div', { className: 'v', textContent: v }), el('div', { className: 's', textContent: s }));

  const latestBtn = el('button', { className: 'link-btn', textContent: 'Jump to latest ↓' });
  const messages = a.thread.map((m) => renderMessage(m, m === last && a.thread.length > 1));
  latestBtn.addEventListener('click', () => messages[a.thread.indexOf(last)].scrollIntoView({ behavior: 'smooth', block: 'center' }));

  const summary = el('div', { className: 'summary' },
    el('div', { className: 'idline' },
      el('a', { href: TICKET_URL(id), target: '_blank', textContent: '#' + id }),
      el('span', { className: 'pill ' + (t.status || ''), textContent: t.status || 'unknown' })),
    el('h2', { className: 'title', textContent: t.title || '(no title)' }),
    el('div', { className: 'chips' },
      t.priority && el('span', { className: 'chip', textContent: 'Priority: ' + t.priority }),
      t.product && el('span', { className: 'chip', textContent: t.product.title }),
      ...(t.tags || []).map((tag) => el('span', { className: 'chip', textContent: tag.title }))),
    signal,
    el('div', { className: 'stats' },
      stat('Last replied', timeAgo(last.at), fmtDate(last.at)),
      stat('Opened', timeAgo(t.created_at), fmtDate(t.created_at)),
      stat('Customer replies', String(a.customerReplies), 'after the original message'),
      stat('Agent replies', String(a.agentReplies), 'notes not counted')),
    el('div', { className: 'people' },
      el('div', { className: 'person' },
        el('div', { className: 'avatar', textContent: initials(personName(customer)) }),
        el('div', {}, el('div', { className: 'n', textContent: personName(customer) || '—' }),
          el('div', { className: 'r' }, 'Customer', customer.email && ' · ', customer.email && el('a', { href: 'mailto:' + customer.email, textContent: customer.email })))),
      el('div', { className: 'person' },
        el('div', { className: 'avatar agent', textContent: initials(personName(t.agent)) }),
        el('div', {}, el('div', { className: 'n', textContent: personName(t.agent) || 'Unassigned' }),
          el('div', { className: 'r', textContent: 'Assigned agent' })))),
    el('a', { className: 'open', href: TICKET_URL(id), target: '_blank', textContent: 'Open in Support ↗' }));

  const thread = el('div', { className: 'thread' },
    el('div', { className: 'thread-head' },
      el('h2', { textContent: `Conversation · ${a.thread.length} messages` }),
      a.thread.length > 2 && latestBtn),
    ...messages);

  return [summary, thread];
}

function saveUi() {
  chrome.storage.local.set({ ui });
}

function applySize(drawer) {
  const max = window.innerWidth - 24;
  const width = Math.min(ui.expanded ? 1040 : ui.width, max);
  drawer.style.width = width + 'px';
  drawer.classList.toggle('wide', width >= WIDE_AT);
}

function enableResize(handle, drawer) {
  handle.addEventListener('pointerdown', (e) => {
    e.preventDefault();
    handle.setPointerCapture(e.pointerId);
    handle.classList.add('active');
    const move = (ev) => {
      ui.expanded = false;
      ui.width = Math.round(Math.max(window.innerWidth - 12 - ev.clientX, MIN_WIDTH));
      applySize(drawer);
    };
    handle.addEventListener('pointermove', move);
    handle.addEventListener('pointerup', () => {
      handle.removeEventListener('pointermove', move);
      handle.classList.remove('active');
      saveUi();
      render();
    }, { once: true });
  });
}

function render() {
  const { ids } = state;
  const style = el('style', { textContent: CSS });
  const setUi = (patch) => { Object.assign(ui, patch); saveUi(); render(); };

  if (ui.collapsed) {
    const attention = ids.some((id) => dotClass(id) === 'customer');
    const launcher = el('button', { className: 'launcher', title: attention ? 'A customer is waiting for a reply' : 'Show support tickets' },
      attention && el('span', { className: 'dot customer' }),
      `Tickets · ${ids.length}`);
    launcher.addEventListener('click', () => setUi({ collapsed: false }));
    root.replaceChildren(style, launcher);
    return;
  }

  const handle = el('div', { className: 'resize', title: 'Drag to resize' });
  const tabs = ids.length > 1 && el('div', { className: 'tabs' }, ...ids.map((id) => {
    const tab = el('button', { className: id === state.selected ? 'on' : '' }, el('span', { className: 'dot ' + dotClass(id) }), '#' + id);
    tab.addEventListener('click', () => { state.selected = id; render(); });
    return tab;
  }));

  const drawer = el('div', { className: root.querySelector('.drawer') ? 'drawer' : 'drawer enter' }, handle,
    el('div', { className: 'head' },
      el('div', { className: 'logo', textContent: 'S' }),
      el('h1', {}, 'Support tickets', el('span', { textContent: String(ids.length) })),
      iconButton('refresh', 'Refresh', () => load(true)),
      iconButton(ui.expanded ? 'shrink' : 'expand', ui.expanded ? 'Shrink' : 'Expand', () => setUi({ expanded: !ui.expanded })),
      iconButton('minimize', 'Minimize', () => setUi({ collapsed: true }))),
    tabs,
    el('div', { className: 'content' }, ...renderTicket(state.selected)),
    el('div', { className: 'foot' }, 'Boards ↔ Support · by ', el('b', { textContent: 'Masiur' })));

  applySize(drawer);
  enableResize(handle, drawer);
  root.replaceChildren(style, drawer);
}

async function load(force) {
  const ids = state.ids;
  const key = currentKey;
  if (force) ids.forEach((id) => state.results.delete(id));
  render();
  const results = await Promise.all(ids.map((id) => fetchTicket(id, force)));
  if (key !== currentKey) return; // task changed while loading
  ids.forEach((id, i) => state.results.set(id, results[i]));
  render();
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
  state.ids = ids;

  if (!ids.length) {
    host.remove();
    return;
  }
  if (!ids.includes(state.selected)) state.selected = ids[0];
  if (!host.isConnected) document.documentElement.append(host);
  load(false);
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
