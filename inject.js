// Runs in the page's MAIN world: reports support ticket ids found in FluentBoards
// single-task API responses (description, attachments, comments) to content.js.
(() => {
  // Slashes are escaped (\/) inside JSON bodies.
  const TICKET_RE = /support\.wpmanageninja\.com(?:\\?\/)?#\\?\/tickets\\?\/(\d+)/g;

  function report(url, text) {
    const task = /\/tasks\/(\d+)/.exec(url);
    if (!task || typeof text !== 'string') return;
    const ids = [...new Set([...text.matchAll(TICKET_RE)].map((m) => m[1]))];
    window.postMessage({ source: 'bse-tickets', taskId: task[1], endpoint: url.split('?')[0], ids }, location.origin);
  }

  const open = XMLHttpRequest.prototype.open;
  XMLHttpRequest.prototype.open = function (method, url) {
    this.addEventListener('load', () => {
      try {
        const text = this.responseType === 'json' ? JSON.stringify(this.response)
          : (this.responseType === '' || this.responseType === 'text') ? this.responseText : null;
        report(String(url), text);
      } catch (e) {}
    });
    return open.apply(this, arguments);
  };

  const origFetch = window.fetch;
  window.fetch = async function (...args) {
    const res = await origFetch.apply(this, args);
    try {
      if (/\/tasks\/\d+/.test(res.url)) {
        res.clone().text().then((t) => report(res.url, t)).catch(() => {});
      }
    } catch (e) {}
    return res;
  };
})();
