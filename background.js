// Firefox exposes the promise-based API as `browser`; Chrome as `chrome`.
const ext = globalThis.browser || globalThis.chrome;
const SITES = {
  support: { base: 'https://support.wpmanageninja.com', api: '/wp-json/fluent-support/v2' },
  // This site serves the WP REST API under /api instead of /wp-json.
  boards: { base: 'https://lounge.authlab.io', api: '/api/fluent-boards/v2' }
};
const host = (site) => new URL(SITES[site].base).host;
const nonces = {};

async function getNonce(site, force) {
  if (nonces[site] && !force) return nonces[site];
  // WP core endpoint: returns a wp_rest nonce for the logged-in cookie user, "0" otherwise.
  const res = await fetch(SITES[site].base + '/wp-admin/admin-ajax.php?action=rest-nonce', { credentials: 'include' });
  const text = (await res.text()).trim();
  if (!res.ok || !/^[a-f0-9]{10}$/.test(text)) {
    throw new Error(`Not logged in to ${host(site)} in this browser.`);
  }
  return (nonces[site] = text);
}

// Firefox treats host_permissions as optional: without a grant, every fetch fails with a bare NetworkError.
async function assertSiteAccess(site) {
  const ok = await ext.permissions.contains({ origins: [SITES[site].base + '/*'] });
  if (!ok) throw new Error(`No access to ${host(site)} yet. Grant it in the extension options.`);
}

async function apiGet(site, path, auth, retry = true) {
  if (retry) await assertSiteAccess(site);
  let init;
  if (auth.mode === 'app_password') {
    if (!auth.username || !auth.appPassword) {
      throw new Error(`Application password for ${host(site)} not configured. Open extension options.`);
    }
    // Cookies must be omitted: a cookie session without nonce makes WP drop auth to guest.
    init = {
      credentials: 'omit',
      headers: { Authorization: 'Basic ' + btoa(auth.username + ':' + auth.appPassword) }
    };
  } else {
    init = { credentials: 'include', headers: { 'X-WP-Nonce': await getNonce(site, !retry) } };
  }

  const res = await fetch(SITES[site].base + SITES[site].api + path, init);
  if (res.status === 403 && auth.mode !== 'app_password' && retry) {
    return apiGet(site, path, auth, false); // nonce likely expired
  }
  const body = await res.json().catch(() => null);
  if (!res.ok) {
    throw new Error((body && body.message) || 'Request failed (' + res.status + ')');
  }
  return body;
}

async function getAuth(site) {
  const s = await ext.storage.local.get({ auth: null, mode: 'cookie', username: '', appPassword: '' });
  if (s.auth && s.auth[site]) return s.auth[site];
  // Settings saved before per-site auth existed apply to the support site.
  return site === 'support' ? { mode: s.mode, username: s.username, appPassword: s.appPassword } : { mode: 'cookie' };
}

async function getTask(boardId, taskId) {
  const auth = await getAuth('boards');
  const base = `/projects/${boardId}/tasks/${taskId}`;
  const [found, comments] = await Promise.all([
    apiGet('boards', base, auth),
    apiGet('boards', base + '/comments', auth).catch(() => null) // task details still useful without comments
  ]);
  if (!found || !found.task) throw new Error('Task not found');
  return { task: found.task, comments: comments && comments.comments, total: comments && comments.total };
}

const HANDLERS = {
  getTicket: (msg) => /^\d+$/.test(msg.id) && getAuth('support').then((auth) => apiGet('support', '/tickets/' + msg.id, auth)),
  getTask: (msg) => /^\d+$/.test(msg.boardId) && /^\d+$/.test(msg.taskId) && getTask(msg.boardId, msg.taskId)
};

ext.runtime.onMessage.addListener((msg, sender, sendResponse) => {
  if (msg.type === 'openOptions') {
    ext.runtime.openOptionsPage();
    return;
  }
  const work = Object.hasOwn(HANDLERS, msg.type) && HANDLERS[msg.type](msg);
  if (!work) return;

  work.then((data) => sendResponse({ ok: true, data }))
    .catch((e) => sendResponse({ ok: false, error: e.message }));
  return true;
});
