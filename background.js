const SUPPORT = 'https://support.wpmanageninja.com';
const API = SUPPORT + '/wp-json/fluent-support/v2';

let cachedNonce = null;

async function getNonce(force) {
  if (cachedNonce && !force) return cachedNonce;
  // WP core endpoint: returns a wp_rest nonce for the logged-in cookie user, "0" otherwise.
  const res = await fetch(SUPPORT + '/wp-admin/admin-ajax.php?action=rest-nonce', { credentials: 'include' });
  const text = (await res.text()).trim();
  if (!res.ok || !/^[a-f0-9]{10}$/.test(text)) {
    throw new Error('Not logged in to support.wpmanageninja.com in this browser.');
  }
  return (cachedNonce = text);
}

async function apiGet(path, settings, retry = true) {
  let init;
  if (settings.mode === 'app_password') {
    if (!settings.username || !settings.appPassword) {
      throw new Error('Application password not configured. Open extension options.');
    }
    // Cookies must be omitted: a cookie session without nonce makes WP drop auth to guest.
    init = {
      credentials: 'omit',
      headers: { Authorization: 'Basic ' + btoa(settings.username + ':' + settings.appPassword) }
    };
  } else {
    init = { credentials: 'include', headers: { 'X-WP-Nonce': await getNonce(!retry) } };
  }

  const res = await fetch(API + path, init);
  if (res.status === 403 && settings.mode !== 'app_password' && retry) {
    return apiGet(path, settings, false); // nonce likely expired
  }
  const body = await res.json().catch(() => null);
  if (!res.ok) {
    throw new Error((body && body.message) || 'Request failed (' + res.status + ')');
  }
  return body;
}

chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
  if (msg.type === 'openOptions') {
    chrome.runtime.openOptionsPage();
    return;
  }
  if (msg.type !== 'getTicket' || !/^\d+$/.test(msg.id)) return;

  chrome.storage.local.get({ mode: 'cookie', username: '', appPassword: '' })
    .then((settings) => apiGet('/tickets/' + msg.id, settings))
    .then((data) => sendResponse({ ok: true, data }))
    .catch((e) => sendResponse({ ok: false, error: e.message }));
  return true;
});
