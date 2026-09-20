const SITES = [
  { key: 'support', title: 'support.wpmanageninja.com', why: 'Fluent Support — read when you view a board task' },
  { key: 'boards', title: 'lounge.authlab.io', why: 'FluentBoards — read when you view a support ticket' }
];
const sections = {};

function build(site, auth) {
  const node = document.getElementById('site').content.cloneNode(true).firstElementChild;
  node.querySelector('h3').textContent = site.title;
  node.querySelector('.why').textContent = site.why;
  const radios = node.querySelectorAll('input[type=radio]');
  const creds = node.querySelector('fieldset');
  const sync = () => { creds.disabled = !radios[1].checked; };

  radios.forEach((r) => {
    r.name = 'mode-' + site.key;
    r.checked = r.value === (auth.mode || 'cookie');
    r.addEventListener('change', sync);
  });
  node.querySelector('.username').value = auth.username || '';
  node.querySelector('.appPassword').value = auth.appPassword || '';
  sync();

  sections[site.key] = node;
  document.getElementById('sites').append(node);
}

chrome.storage.local.get({ auth: null, mode: 'cookie', username: '', appPassword: '' }).then((s) => {
  // Settings saved before per-site auth existed apply to the support site.
  const auth = s.auth || { support: { mode: s.mode, username: s.username, appPassword: s.appPassword } };
  SITES.forEach((site) => build(site, auth[site.key] || {}));
});

document.getElementById('save').addEventListener('click', async () => {
  const auth = {};
  for (const [key, node] of Object.entries(sections)) {
    auth[key] = {
      mode: node.querySelector('input[type=radio]:checked').value,
      username: node.querySelector('.username').value.trim(),
      appPassword: node.querySelector('.appPassword').value.trim()
    };
  }
  await chrome.storage.local.set({ auth });
  await chrome.storage.local.remove(['mode', 'username', 'appPassword']);
  const status = document.getElementById('status');
  status.textContent = 'Saved';
  setTimeout(() => (status.textContent = ''), 1500);
});
