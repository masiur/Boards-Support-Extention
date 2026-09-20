// FluentBoards side: show the Fluent Support tickets linked from the open task.
const TICKET_URL = (id) => `https://support.wpmanageninja.com/#/tickets/${id}/view`;
const networkIds = new Map(); // task id -> Map<endpoint, ticket ids> (from inject.js)

function personName(p) {
  if (!p) return null;
  return p.full_name || [p.first_name, p.last_name].filter(Boolean).join(' ') || p.email || null;
}

// Who spoke last, and how much each side has said. Notes and system entries don't count as replies.
function analyzeTicket(data) {
  const t = data.ticket || data;
  const customer = t.customer || {};
  const side = (r) => (r.person && r.person.person_type === 'customer') || (r.person_id && r.person_id == t.customer_id) ? 'customer' : 'agent';

  const thread = (data.responses || [])
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

function renderTicket(id, data) {
  const a = analyzeTicket(data);
  const { t, customer, last } = a;
  const lastIsCustomer = last.kind === 'customer';

  const signal = el('div', { className: 'signal ' + (a.closed ? 'closed' : last.kind) },
    el('div', { className: 'k', textContent: 'Last reply' }),
    el('div', { className: 'v', textContent: `${lastIsCustomer ? 'Customer' : 'Support agent'} · ${timeAgo(last.at)}` }),
    el('div', { className: 's', textContent: a.closed ? `${last.name} · ticket is closed`
      : lastIsCustomer ? `${last.name} is waiting for an agent reply` : `${last.name} replied · waiting on customer` }));

  const messages = a.thread.map((m) => renderMessage({
    ...m,
    role: m.kind === 'note' ? 'Internal note' : m.kind === 'agent' ? 'Agent' : m.original ? 'Customer · original message' : 'Customer',
    latest: m === last && a.thread.length > 1
  }));
  const latestBtn = el('button', { className: 'link-btn', textContent: 'Jump to latest ↓' });
  latestBtn.addEventListener('click', () => messages[a.thread.indexOf(last)].scrollIntoView({ behavior: 'smooth', block: 'center' }));

  const summary = el('div', { className: 'summary' },
    el('div', { className: 'idline' },
      el('a', { href: TICKET_URL(id), target: '_blank', textContent: '#' + id }),
      el('span', { className: 'pill ' + (t.status || ''), textContent: t.status || 'unknown' })),
    el('h2', { className: 'title', textContent: t.title || '(no title)' }),
    el('div', { className: 'chips' },
      t.priority && el('span', { className: 'chip', textContent: 'Priority: ' + t.priority }),
      t.product && el('span', { className: 'chip', textContent: t.product.title }),
      (t.tags || []).map((tag) => el('span', { className: 'chip', textContent: tag.title }))),
    signal,
    el('div', { className: 'stats' },
      stat('Last replied', timeAgo(last.at), fmtDate(last.at)),
      stat('Opened', timeAgo(t.created_at), fmtDate(t.created_at)),
      stat('Customer replies', String(a.customerReplies), 'after the original message'),
      stat('Agent replies', String(a.agentReplies), 'notes not counted')),
    el('div', { className: 'people' },
      person(personName(customer), 'Customer', '', customer.email),
      person(personName(t.agent) || 'Unassigned', 'Assigned agent', 'agent')),
    el('a', { className: 'open-link', href: TICKET_URL(id), target: '_blank', textContent: 'Open in Support ↗' }));

  const thread = el('div', { className: 'thread' },
    el('div', { className: 'thread-head' },
      el('h2', { textContent: `Conversation · ${a.thread.length} messages` }),
      a.thread.length > 2 && latestBtn),
    messages);

  return [summary, thread];
}

const ticketDrawer = startDrawer({
  title: 'Support tickets',
  noun: 'Tickets',
  logo: 'S',
  pattern: /support\.wpmanageninja\.com\/?#\/tickets\/(\d+)/g,
  idOf: (m) => m[1],
  label: (id) => '#' + id,
  request: (id) => ({ type: 'getTicket', id }),
  render: renderTicket,
  // Whose move it is: amber = customer waiting, green = waiting on customer.
  dot: (data) => { const a = analyzeTicket(data); return a.closed ? '' : a.last.kind; },
  attention: (data) => { const a = analyzeTicket(data); return !a.closed && a.last.kind === 'customer'; },
  // Ticket links inside the open task's API responses (attachments etc.), reported by inject.js.
  extraIds: () => {
    const task = /\/tasks\/(\d+)/.exec(location.hash);
    const found = task && networkIds.get(task[1]);
    return found ? [...found.values()].flat() : [];
  }
});

window.addEventListener('message', (e) => {
  const d = e.data;
  if (e.source !== window || !d || d.source !== 'bse-tickets' || !Array.isArray(d.ids)) return;
  if (!networkIds.has(d.taskId)) networkIds.set(d.taskId, new Map());
  networkIds.get(d.taskId).set(d.endpoint, d.ids.filter((id) => /^\d+$/.test(id)));
  ticketDrawer.rescan();
});
