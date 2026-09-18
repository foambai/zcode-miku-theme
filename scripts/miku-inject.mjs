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
import { execSync } from 'node:child_process';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const CSS_PATH = path.join(__dirname, '..', 'theme', 'miku-theme.css');
const IMG_PATH = path.join(__dirname, '..', 'assets', 'miku-v4x.png');
const BG_PATH = path.join(__dirname, '..', 'assets', 'pixel-bg.jpg');
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

/* watchdog (supervisor only): if ZCode is running WITHOUT the debug port
 * (e.g. relaunched bare by the app's own updater), remount it. */
const ZCODE_EXE = ['D:\\Program Files\\ZCode\\ZCode.exe',
  process.env.LOCALAPPDATA + '\\Programs\\ZCode\\ZCode.exe',
  process.env.ProgramFiles + '\\ZCode\\ZCode.exe',
  'C:\\Program Files\\ZCode\\ZCode.exe',
].find(p => { try { return fs.existsSync(p); } catch { return false; } }) || 'ZCode.exe';
const WATCHDOG = FOREVER && (args.includes('--watchdog') || process.env.MIKU_WATCHDOG === '1');
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

function zcodeRunning() {
  try {
    return /ZCode\.exe/i.test(execSync('tasklist /FI "IMAGENAME eq ZCode.exe" /NH', { stdio: 'pipe' }).toString());
  } catch { return false; }
}
async function cdpUp(timeoutMs = 1500) {
  try { await fetch(`${BASE}/json/version`, { signal: AbortSignal.timeout(timeoutMs) }); return true; }
  catch { return false; }
}
async function waitCdp(timeoutMs) {
  const t0 = Date.now();
  while (Date.now() - t0 < timeoutMs) { if (await cdpUp(1000)) return true; }
  return false;
}
async function watchdogLoop() {
  console.log('[miku] watchdog armed: bare ZCode launches will be remounted');
  let graceUntil = Date.now() + 20000;   // let the app settle after injector start
  for (;;) {
    await sleep(5000);
    try {
      if (!zcodeRunning()) { graceUntil = Date.now() + 20000; continue; }
      if (Date.now() < graceUntil) continue;
      if (await cdpUp()) continue;
      console.log('[miku] watchdog: ZCode running without port, remounting...');
      try { execSync('taskkill /F /IM ZCode.exe /T', { stdio: 'ignore' }); } catch { /* ignore */ }
      await sleep(2500);
      const { spawn: sp } = await import('node:child_process');
      sp(ZCODE_EXE, ['--remote-debugging-port=' + PORT, '--remote-allow-origins=*'], { detached: true, stdio: 'ignore' }).unref();
      const ok = await waitCdp(45000);
      console.log('[miku] watchdog: remount ' + (ok ? 'ok' : 'FAILED'));
      if (!ok) {
        try { sp(ZCODE_EXE, [], { detached: true, stdio: 'ignore' }).unref(); } catch { /* ignore */ }
      }
      graceUntil = Date.now() + 25000;
    } catch (e) {
      console.error('[miku] watchdog error:', e.message);
    }
  }
}

/* background library: every image in backgrounds/ becomes switchable in the panel */
const BG_DIR = path.join(__dirname, '..', 'backgrounds');
fs.mkdirSync(BG_DIR, { recursive: true });
const BG_MIME = { '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.png': 'image/png', '.webp': 'image/webp' };
const bgList = fs.readdirSync(BG_DIR)
  .map(name => ({ name, ext: path.extname(name).toLowerCase() }))
  .filter(e => BG_MIME[e.ext])
  .map(e => {
    const p = path.join(BG_DIR, e.name);
    const size = fs.statSync(p).size;
    return { name: e.name, ext: e.ext, p, size };
  })
  .filter(e => e.size > 0 && e.size <= 8 * 1024 * 1024)
  .sort((a, b) => a.name.localeCompare(b.name, 'zh'))
  .map(e => ({ name: e.name, src: 'data:' + BG_MIME[e.ext] + ';base64,' + fs.readFileSync(e.p).toString('base64') }));
if (!bgList.length && fs.existsSync(BG_PATH)) bgList.push({ name: '默认背景', src: 'data:image/jpeg;base64,' + fs.readFileSync(BG_PATH).toString('base64') });
const PANEL_SRC = fs.readFileSync(path.join(__dirname, 'panel.js'), 'utf8');

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

/* background layer + control panel + decoration layer (idempotent) */
const LAYER_JS = `
(function(){
  if (!document.getElementById('zcode-miku-bg')) {
    const bg = document.createElement('div');
    bg.id = 'zcode-miku-bg';
    bg.innerHTML = '<img alt="" draggable="false">';
    (document.body || document.documentElement).appendChild(bg);
  }
  window.__MIKU_BGS = ${JSON.stringify(bgList)};
  ${PANEL_SRC}
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
  if (!document.__mikuStateWatch) {
    document.__mikuStateWatch = true;
    let lastMode = null;
    setInterval(function(){
      try {
        const welcome = !!Array.prototype.find.call(
          document.querySelectorAll('button'),
          function(b){ return b.offsetParent && b.innerText.indexOf('\u9009\u62E9\u9879\u76EE') >= 0; }
        );
        document.documentElement.classList.toggle('miku-welcome', welcome);
        const m = welcome ? 'welcome' : 'task';
        if (m !== lastMode) {
          lastMode = m;
          if (window.__mikuApply) window.__mikuApply();
          if (window.__mikuRefreshUI) window.__mikuRefreshUI();
        }
      } catch (e) {}
    }, 800);
  }
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
    // 1) CDP stylesheet (not subject to page CSP); reuse the same sheet on re-inject
    let sheetOk = false;
    try {
      await ws.send('Page.enable');
      await ws.send('DOM.enable');
      await ws.send('CSS.enable');
      const st = await ws.send('Runtime.evaluate', { expression: 'window.__mikuSheetId||""', returnByValue: true });
      const prevId = st.result?.value;
      if (prevId) {
        await ws.send('CSS.setStyleSheetText', { styleSheetId: prevId, text: cssText });
        sheetOk = true;
      } else {
        const ft = await ws.send('Page.getFrameTree');
        const frameId = ft.frameTree.frame.id;
        const { styleSheetId } = await ws.send('CSS.createStyleSheet', { frameId });
        await ws.send('CSS.setStyleSheetText', { styleSheetId, text: cssText });
        await ws.send('Runtime.evaluate', { expression: 'window.__mikuSheetId = ' + JSON.stringify(styleSheetId), returnByValue: true });
        sheetOk = true;
      }
    } catch (e) {
      console.error('[miku] CSS stylesheet injection failed, fallback to <style>: ', e.message);
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
    if (WATCHDOG) watchdogLoop();   // async loop, runs alongside the cycle
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
