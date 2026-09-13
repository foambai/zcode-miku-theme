#!/usr/bin/env node
/** Clears the mounted flag + decoration layer on live app pages so the
 *  supervisor re-injects with the latest theme files. Usage: node redeploy.mjs */
import fs from 'node:fs';
const PORT = 39517;
const BASE = `http://127.0.0.1:${PORT}`;
let seq = 1;

const targets = await (await fetch(`${BASE}/json/list`)).json();
const pages = targets.filter(t => t.type === 'page' && /index\.html/i.test(t.url) && !/^https?:/i.test(t.url));
if (!pages.length) { console.log('no app page'); process.exit(1); }

for (const t of pages) {
  await new Promise((resolve) => {
    const ws = new WebSocket(t.webSocketDebuggerUrl);
    ws.addEventListener('open', () => {
      ws.send(JSON.stringify({ id: seq, method: 'Runtime.evaluate', params: {
        expression: `document.getElementById('zcode-miku-layer')?.remove(); document.getElementById('zcode-miku-bg')?.remove(); document.getElementById('miku-ctl')?.remove(); document.documentElement.removeAttribute('data-miku-mounted'); 'cleared'`,
        returnByValue: true,
      } }));
    });
    ws.addEventListener('message', (ev) => {
      const m = JSON.parse(ev.data);
      if (m.id === seq) { console.log((t.title || 'page') + ' ->', m.result?.result?.value ?? JSON.stringify(m.result)); ws.close(); resolve(); }
    });
    setTimeout(() => { console.log('timeout'); resolve(); }, 5000);
  });
}
console.log('supervisor will re-inject within ~3s');
