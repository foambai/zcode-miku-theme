#!/usr/bin/env node
/** Captures the live app window to a PNG. Usage: node shot.mjs [outfile] */
import fs from 'node:fs';
const PORT = 39517;
const out = process.argv[2] || 'verification.png';
const BASE = `http://127.0.0.1:${PORT}`;

const targets = await (await fetch(`${BASE}/json/list`)).json();
const pages = targets.filter(t => t.type === 'page' && /index\.html/i.test(t.url) && !/^https?:/i.test(t.url));
if (!pages.length) { console.log('no app page'); process.exit(1); }

await new Promise((resolve) => {
  const ws = new WebSocket(pages[0].webSocketDebuggerUrl);
  ws.addEventListener('open', () => {
    ws.send(JSON.stringify({ id: 1, method: 'Page.enable' }));
    setTimeout(() => ws.send(JSON.stringify({ id: 2, method: 'Page.captureScreenshot', params: { format: 'png' } })), 500);
  });
  ws.addEventListener('message', (ev) => {
    const m = JSON.parse(ev.data);
    if (m.id === 2 && m.result?.data) {
      fs.writeFileSync(out, Buffer.from(m.result.data, 'base64'));
      console.log('saved ' + out);
      ws.close(); resolve();
    }
  });
  setTimeout(() => { console.log('timeout'); resolve(); }, 8000);
});
