#!/usr/bin/env node
/**
 * ZCode Miku theme - CDP injector
 * Injects the Miku theme CSS + decoration layer into ZCode's renderer via the
 * Chromium debug port (127.0.0.1 loopback only). Matches the app's own pages
 * (index.html) only - never touches pages opened in the embedded browser.
 *
 * Usage:
 *   node miku-inject.mjs --port 39517                # resident mode (exits when app closes)
 *   node miku-inject.mjs --port 39517 --forever      # supervisor mode (waits for app, never exits)
 *   node miku-inject.mjs --port 39517 --screenshot X.png   # inject, screenshot, exit
 *   node miku-inject.mjs --port 39517 --once         # inject once, exit
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const CSS_PATH = path.join(__dirname, '..', 'theme', 'miku-theme.css');
const IMG_PATH = path.join(__dirname, '..', 'assets', 'miku-v4x.png');
const LOCK_PATH = path.join(__dirname, 'injector.lock');

const args = process.argv.slice(2);
function argOf(name) {
  const i = args.indexOf(name);
  return i >= 0 ? args[i + 1] : null;
}
const PORT = Number(argOf('--port') || process.env.MIKU_PORT || 0);
const SCREENSHOT = argOf('--screenshot');
const ONCE = args.includes('--once');
const FOREVER = args.includes('--forever');
if (!PORT) { console.error('[miku] missing --port'); process.exit(2); }

const cssText = fs.readFileSync(CSS_PATH, 'utf8');
const imgDataUri = 'data:image/png;base64,' + fs.readFileSync(IMG_PATH).toString('base64');

const BASE = `http://127.0.0.1:${PORT}`;
let seq = 1;

/* single-instance lock for resident/supervisor modes */
const resident = !SCREENSHOT && !ONCE;
if (resident) {
  let locked = true;
  try {
    const pid = parseInt(fs.readFileSync(LOCK_PATH, 'utf8').trim(), 10);
    if (pid && pid !== process.pid) {
      try { process.kill(pid, 0); locked = false; } catch { /* previous owner dead */ }
    }
  } catch { /* no lock file */ }
  if (!locked) {
    console.log('[miku] another injector is already running, exiting');
    process.exit(0);
  }
  fs.writeFileSync(LOCK_PATH, String(process.pid));
  process.on('exit', () => {
    try {
      const pid = parseInt(fs.readFileSync(LOCK_PATH, 'utf8').trim(), 10);
      if (pid === process.pid) fs.unlinkSync(LOCK_PATH);
    } catch { /* ignore */ }
  });
}

function isAppPage(t) {
  return t && t.type === 'page' && typeof t.url === 'string'
    && /index\.html/i.test(t.url)
    && !/^https?:/i.test(t.url);
}

async function listTargets() {
  const res = await fetch(`${BASE}/json/list`);
  return res.json();
}

function connect(wsUrl) {
  return new Promise((resolve, reject) => {
    const ws = new WebSocket(wsUrl);
    const pending = new Map();
    ws.addEventListener('open', () => resolve({
      send(method, params = {}) {
        return new Promise((res2, rej2) => {
          const id = seq++;
          pending.set(id, { res2, rej2 });
          ws.send(JSON.stringify({ id, method, params }));
        });
      },
      close() { try { ws.close(); } catch { /* ignore */ } },
    }));
    ws.addEventListener('message', (ev) => {
      let msg; try { msg = JSON.parse(ev.data); } catch { return; }
      if (msg.id && pending.has(msg.id)) {
        const { res2, rej2 } = pending.get(msg.id);
        pending.delete(msg.id);
        msg.error ? rej2(new Error(msg.error.message)) : res2(msg.result);
      }
    });
    ws.addEventListener('error', (e) => reject(new Error('ws error: ' + (e?.message || e))));
  });
}

/* decoration layer DOM (idempotent) + hover-fade hit testing */
const LAYER_JS = `
(function(){
  const img = ${JSON.stringify(imgDataUri)};
  let layer = document.getElementById('zcode-miku-layer');
  if (!layer) {
    layer = document.createElement('div');
    layer.id = 'zcode-miku-layer';
    const notes = ['\u266A','\u266B','\u266C','\u266A','\u2669','\u266B'];
    layer.innerHTML = '<div class="miku-aura"></div>'
      + '<img class="miku-img" alt="" draggable="false">'
      + notes.map(n => '<span class="miku-note">' + n + '</span>').join('');
    (document.body || document.documentElement).appendChild(layer);
  }
  const im = layer.querySelector('.miku-img');
  if (im && !im.src.startsWith('data:')) im.src = img;
  document.documentElement.setAttribute('data-miku-mounted', '1');
  if (!document.__mikuHoverBound) {
    document.__mikuHoverBound = true;
    document.addEventListener('mousemove', function(e){
      const layer = document.getElementById('zcode-miku-layer');
      if (!layer) return;
      const im = layer.querySelector('.miku-img');
      if (!im) return;
      const r = im.getBoundingClientRect();
      let over = e.clientX >= r.left && e.clientX <= r.right && e.clientY >= r.top && e.clientY <= r.bottom;
      if (over && im.naturalWidth && !layer.__cv) {
        const cv = document.createElement('canvas');
        cv.width = im.naturalWidth; cv.height = im.naturalHeight;
        try { cv.getContext('2d').drawImage(im, 0, 0); layer.__cv = cv; } catch (err) { layer.__cv = null; }
      }
      if (over && layer.__cv) {
        const x = Math.floor((e.clientX - r.left) / r.width * layer.__cv.width);
        const y = Math.floor((e.clientY - r.top) / r.height * layer.__cv.height);
        try {
          const a = layer.__cv.getContext('2d').getImageData(x, y, 1, 1).data[3];
          if (a < 8) over = false;
        } catch (err) { /* keep rect-based result */ }
      }
      layer.classList.toggle('miku-hover', over);
    }, { passive: true });
  }
})()`;

async function injectInto(target) {
  const ws = await connect(target.webSocketDebuggerUrl);
  try {
    // 1) CDP stylesheet (not subject to page CSP)
    let sheetOk = false;
    try {
      await ws.send('Page.enable');
      await ws.send('DOM.enable');
      await ws.send('CSS.enable');
      const ft = await ws.send('Page.getFrameTree');
      const frameId = ft.frameTree.frame.id;
      const { styleSheetId } = await ws.send('CSS.createStyleSheet', { frameId });
      await ws.send('CSS.setStyleSheetText', { styleSheetId, text: cssText });
      sheetOk = true;
    } catch (e) {
      console.error('[miku] CSS.createStyleSheet failed, fallback to <style>: ', e.message);
    }
    // 2) fallback <style> + decoration layer
    const r = await ws.send('Runtime.evaluate', {
      expression: `(function(){
        ${sheetOk ? '' : `(function(){
          let s = document.getElementById('zcode-miku-theme-style');
          if (!s) { s = document.createElement('style'); s.id = 'zcode-miku-theme-style'; (document.head||document.documentElement).appendChild(s); }
          s.textContent = ${JSON.stringify(cssText)};
        })();`}
        ${LAYER_JS}
      })()`,
      returnByValue: true,
    });
    if (r.exceptionDetails) throw new Error(r.exceptionDetails.text || 'evaluate failed');
    return true;
  } finally {
    ws.close();
  }
}

async function isMounted(target) {
  const ws = await connect(target.webSocketDebuggerUrl);
  try {
    const r = await ws.send('Runtime.evaluate', {
      expression: 'document.documentElement.getAttribute("data-miku-mounted")||""',
      returnByValue: true,
    });
    return r.result?.value === '1';
  } catch { return false; }
  finally { ws.close(); }
}

async function capture(target, outPath) {
  const ws = await connect(target.webSocketDebuggerUrl);
  try {
    await ws.send('Page.enable');
    await new Promise(r => setTimeout(r, 2500));
    const { data } = await ws.send('Page.captureScreenshot', { format: 'png' });
    fs.writeFileSync(outPath, Buffer.from(data, 'base64'));
    console.log('[miku] screenshot saved: ' + outPath);
  } finally { ws.close(); }
}

const injected = new Set();
let appWasUp = false;

async function cycle() {
  let targets;
  try { targets = await listTargets(); }
  catch {
    if (appWasUp) {
      console.log('[miku] app closed.');
      appWasUp = false;
      injected.clear();
    }
    if (FOREVER) return;            // supervisor: keep waiting for the app
    console.log('[miku] injector exiting.');
    process.exit(0);
  }
  if (!appWasUp) { appWasUp = true; console.log('[miku] app detected on port ' + PORT); }

  const pages = targets.filter(isAppPage);
  for (const t of pages) {
    const key = t.id;
    if (injected.has(key)) {
      if (!(await isMounted(t).catch(() => false))) {
        console.log('[miku] re-inject (document reloaded): ' + (t.title || t.id));
        await injectInto(t).catch(e => console.error('[miku] re-inject fail:', e.message));
      }
      continue;
    }
    console.log('[miku] inject -> ' + (t.title || t.url.slice(0, 60)));
    try { await injectInto(t); injected.add(key); }
    catch (e) { console.error('[miku] inject fail:', e.message); }
  }
  for (const key of [...injected]) {
    if (!pages.some(t => t.id === key)) injected.delete(key);
  }
}

(async () => {
  if (FOREVER) {
    console.log('[miku] supervisor mode: watching port ' + PORT);
    for (;;) {
      try { await fetch(`${BASE}/json/version`); break; } catch { await new Promise(r => setTimeout(r, 2000)); }
    }
    await cycle();
    setInterval(() => cycle().catch(e => console.error('[miku] cycle:', e.message)), 3000);
    return;
  }

  const t0 = Date.now();
  let up = false;
  while (Date.now() - t0 < 45000) {
    try { await (await fetch(`${BASE}/json/version`)).json(); up = true; break; }
    catch { await new Promise(r => setTimeout(r, 1000)); }
  }
  if (!up) { console.error('[miku] CDP port never opened'); process.exit(1); }
  await cycle();
  if (SCREENSHOT) {
    const targets = (await listTargets()).filter(isAppPage);
    if (targets[0]) await capture(targets[0], SCREENSHOT);
    process.exit(0);
  }
  if (ONCE) process.exit(0);
  setInterval(() => cycle().catch(e => console.error('[miku] cycle:', e.message)), 10000);
  console.log('[miku] resident watch started (10s interval)');
})();
