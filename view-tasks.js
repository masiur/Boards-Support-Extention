// Fluent Support side: show the FluentBoards tasks linked from the open ticket (usually in notes).
const taskUrls = new Map(); // "board/task" -> link as written on the page (keeps the slug)
const DESCRIPTION_PREVIEW = 320; // chars of task description shown before "Show more"

function userName(u) {
  if (!u) return null;
  return u.display_name || u.name || u.user_login || u.email || u.user_email || null;
}

function taskUrl(id) {
  const [board, task] = id.split('/');
  return taskUrls.get(id) || `https://lounge.authlab.io/projects#/boards/${board}/tasks/${task}`;
}

function labelChip(label) {
  const chip = el('span', { className: 'label', textContent: label.title || label.slug || 'label' });
  // Colours come from the API: only apply strict hex values.
  const hex = /^#[0-9a-f]{3,8}$/i;
  if (hex.test(label.bg_color || '')) chip.style.background = label.bg_color;
  if (hex.test(label.color || '')) chip.style.color = label.color;
  return chip;
}

function renderTask(id, data) {
  const t = data.task;
  const closed = t.status === 'closed';
  const stage = (t.stage && t.stage.title) || 'Unknown stage';
  const assignees = t.assignees || [];
  const comments = (data.comments && data.comments.data) || [];
  const total = data.total != null ? data.total : t.comments_count || comments.length;
  const description = htmlToText(t.description);

  const signal = el('div', { className: 'signal ' + (closed ? 'agent' : 'open') },
    el('div', { className: 'k', textContent: 'Stage' }),
    el('div', { className: 'v', textContent: stage }),
    el('div', { className: 's', textContent: `${closed ? 'Task is closed' : 'Task is open'}${t.archived_at ? ' · archived' : ''} · updated ${timeAgo(t.updated_at)}` }));

  const summary = el('div', { className: 'summary' },
    el('div', { className: 'idline' },
      el('a', { href: taskUrl(id), target: '_blank', textContent: '#' + t.id }),
      el('span', { className: 'pill ' + (closed ? '' : 'active'), textContent: closed ? 'Closed' : 'Open' }),
      t.archived_at && el('span', { className: 'pill', textContent: 'Archived' })),
    el('h2', { className: 'title', textContent: t.title || '(no title)' }),
    el('div', { className: 'chips' },
      t.board && el('span', { className: 'chip', textContent: 'Board: ' + t.board.title }),
      t.priority && el('span', { className: 'chip', textContent: 'Priority: ' + t.priority }),
      t.due_at && el('span', { className: 'chip', title: fmtDate(t.due_at), textContent: 'Due ' + timeAgo(t.due_at) }),
      (t.labels || []).map(labelChip)),
    signal,
    el('div', { className: 'people' },
      assignees.length ? assignees.map((u) => person(userName(u), 'Assigned', 'agent'))
        : person('Unassigned', 'No assignee', 'agent')),
    description && el('div', { className: 'desc' },
      el('div', { className: 'k', textContent: 'Description' }),
      foldableText(description, DESCRIPTION_PREVIEW)),
    el('div', { className: 'stats' },
      stat('Updated', timeAgo(t.updated_at), fmtDate(t.updated_at)),
      stat('Created', timeAgo(t.created_at), fmtDate(t.created_at)),
      stat('Comments', String(total), 'including replies'),
      stat('Priority', t.priority || '—', t.due_at ? 'due ' + fmtDate(t.due_at) : 'no due date')),
    el('a', { className: 'open-link', href: taskUrl(id), target: '_blank', textContent: 'Open task in FluentBoards ↗' }));

  const comment = (c, reply) => renderMessage({
    kind: 'agent', name: userName(c.user) || '—', role: reply ? 'Reply' : 'Comment', at: c.created_at, html: c.description, reply
  });
  const shown = comments.reduce((n, c) => n + 1 + (c.replies || []).length, 0);

  const thread = el('div', { className: 'thread' },
    el('div', { className: 'thread-head' }, el('h2', { textContent: `Comments · ${total}` })),
    !data.comments && el('p', { className: 'hint', textContent: 'Comments could not be loaded.' }),
    data.comments && !comments.length && el('p', { className: 'hint', textContent: 'No comments yet.' }),
    total > shown && el('p', { className: 'hint', textContent: `Showing the latest ${shown} of ${total} — open the task for the rest.` }),
    comments.map((c) => [comment(c, false), (c.replies || []).map((r) => comment(r, true))]));

  return [summary, thread];
}

startDrawer({
  title: 'Board tasks',
  noun: 'Tasks',
  logo: 'B',
  pattern: /lounge\.authlab\.io\/projects\/?#\/boards\/(\d+)\/tasks\/(\d+)[^\s"'<>)\]]*/g,
  // Also remembers the link as written, so "open" goes to the same URL (with its slug).
  idOf: (m) => {
    const id = `${m[1]}/${m[2]}`;
    if (!taskUrls.has(id)) taskUrls.set(id, 'https://' + m[0]);
    return id;
  },
  label: (id) => '#' + id.split('/')[1],
  request: (id) => ({ type: 'getTask', boardId: id.split('/')[0], taskId: id.split('/')[1] }),
  render: renderTask,
  dot: (data) => (data.task.status === 'closed' ? 'agent' : 'open')
});
