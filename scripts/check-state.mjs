#!/usr/bin/env node
/** Prints the live theme state of the running app. Usage: node check-state.mjs */
const PORT = 39517;
const targets = await (await fetch(`http://127.0.0.1:${PORT}/json/list`)).json();
const pages = targets.filter(t => t.type === 'page' && /index\.html/i.test(t.url) && !/^https?:/i.test(t.url));
if (!pages.length) { console.log('no app page (app not running with mount port?)'); process.exit(1); }
const ws = new WebSocket(pages[0].webSocketDebuggerUrl);
ws.addEventListener('open', () => {
  ws.send(JSON.stringify({ id: 1, method: 'Runtime.evaluate', params: {
    expression: `JSON.stringify({
      state: document.documentElement.classList.contains('miku-welcome') ? 'welcome-sharp' : 'task',
      mounted: document.documentElement.getAttribute('data-miku-mounted'),
      filter: getComputedStyle(document.querySelector('#zcode-miku-bg img')).filter,
      bg: (() => { const i = document.querySelector('#zcode-miku-bg img'); return i ? i.naturalWidth + 'x' + i.naturalHeight : 'missing'; })()
    })`,
    returnByValue: true,
  } }));
});
ws.addEventListener('message', (ev) => {
  const m = JSON.parse(ev.data);
  if (m.id === 1) { console.log(m.result?.result?.value || JSON.stringify(m.result)); process.exit(0); }
});
setTimeout(() => { console.log('timeout'); process.exit(1); }, 6000);
