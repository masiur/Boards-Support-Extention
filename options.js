const $ = (id) => document.getElementById(id);
const radios = document.querySelectorAll('input[name=mode]');

function syncCreds() {
  $('creds').disabled = document.querySelector('input[name=mode]:checked').value !== 'app_password';
}

chrome.storage.local.get({ mode: 'cookie', username: '', appPassword: '' }).then((s) => {
  document.querySelector(`input[name=mode][value=${s.mode}]`).checked = true;
  $('username').value = s.username;
  $('appPassword').value = s.appPassword;
  syncCreds();
});

radios.forEach((r) => r.addEventListener('change', syncCreds));

$('save').addEventListener('click', async () => {
  await chrome.storage.local.set({
    mode: document.querySelector('input[name=mode]:checked').value,
    username: $('username').value.trim(),
    appPassword: $('appPassword').value.trim()
  });
  $('status').textContent = 'Saved';
  setTimeout(() => ($('status').textContent = ''), 1500);
});
