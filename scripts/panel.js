/* ZCode Miku theme - background control panel (runs inside the app page).
 * Embedded by miku-inject.mjs; expects window.__MIKU_BGS = [{name, src}].
 * Also supports user-picked images via native file dialog (stored in localStorage). */
(function () {
  if (document.getElementById('miku-ctl')) return;
  const BGS = (window.__MIKU_BGS || []).map(b => ({ key: b.name, name: b.name.replace(/\.[a-z0-9]+$/i, ''), src: b.src }));
  const KEY = 'mikuSettings_v1';
  const DEF = { image: null, enabled: true, customs: [], task: { blur: 2, bright: 115 }, welcome: { blur: 0, bright: 120 } };
  function load() { try { return JSON.parse(localStorage.getItem(KEY)) || null; } catch (e) { return null; } }
  function trySave() {
    try { localStorage.setItem(KEY, JSON.stringify(S)); return true; }
    catch (e) { alert('Miku \u80CC\u666F\uFF1A\u56FE\u7247\u592A\u5927\uFF0C\u65E0\u6CD5\u4FDD\u5B58\u5230\u672C\u5730\u8BBE\u7F6E\uFF08\u4EC5\u672C\u6B21\u751F\u6548\uFF09\u3002\u5EFA\u8BAE\u7528\u5C0F\u4E8E 4MB \u7684\u56FE\u7247\u3002'); return false; }
  }
  let S = Object.assign({}, DEF, load() || {});
  S.customs = Array.isArray(S.customs) ? S.customs : [];
  S.task = Object.assign({ blur: 2, bright: 115 }, S.task || {});
  S.welcome = Object.assign({ blur: 0, bright: 120 }, S.welcome || {});
  const all = () => [...S.customs, ...BGS];
  const mode = () => document.documentElement.classList.contains('miku-welcome') ? 'welcome' : 'task';
  const img = () => document.querySelector('#zcode-miku-bg img');
  function cur() { return S[mode()]; }
  function applyFilter() {
    const im = img(); if (!im) return;
    const m = cur();
    im.style.filter = 'blur(' + m.blur + 'px) brightness(' + (m.bright / 100) + ') saturate(1.15)';
  }
  function applyImage() {
    const im = img(); if (!im) return;
    const list = all();
    const e = list.find(b => b.key === S.image) || list[0];
    if (!e) return;
    if (im.src !== e.src) im.src = e.src;
    S.image = e.key;
  }
  window.__mikuApply = function () { applyImage(); applyFilter(); };

  /* ---------- DOM ---------- */
  const root = document.createElement('div');
  root.id = 'miku-ctl';
  root.innerHTML =
    '<button id="miku-ctl-gear" title="Miku \u80CC\u666F\u8BBE\u7F6E">\u266A</button>' +
    '<div id="miku-ctl-panel">' +
      '<div class="miku-ctl-head"><span>\u80CC\u666F\u8BBE\u7F6E</span><span id="miku-ctl-mode"></span></div>' +
      '<label class="miku-ctl-switch"><input id="miku-ctl-enabled" type="checkbox">\u663E\u793A\u80CC\u666F\u56FE</label>' +
      '<button id="miku-ctl-pick">\uFF0B \u4ECE\u7535\u8111\u9009\u62E9\u56FE\u7247\u2026</button>' +
      '<div id="miku-ctl-imgs"></div>' +
      '<div class="miku-ctl-row"><span>\u865A\u5316</span><input id="miku-ctl-blur" type="range" min="0" max="12" step="0.5"><span id="miku-ctl-blurv"></span></div>' +
      '<div class="miku-ctl-row"><span>\u4EAE\u5EA6</span><input id="miku-ctl-bright" type="range" min="40" max="160" step="5"><span id="miku-ctl-brightv"></span></div>' +
      '<div class="miku-ctl-foot"><button id="miku-ctl-reset">\u6062\u590D\u9ED8\u8BA4</button></div>' +
    '</div>' +
    '<input id="miku-ctl-file" type="file" accept="image/*" style="display:none">';
  (document.body || document.documentElement).appendChild(root);

  const enEl = root.querySelector('#miku-ctl-enabled');
  enEl.checked = S.enabled !== false;
  document.documentElement.classList.toggle('miku-bg-off', S.enabled === false);
  enEl.addEventListener('change', () => {
    S.enabled = enEl.checked;
    document.documentElement.classList.toggle('miku-bg-off', !S.enabled);
    trySave();
  });

  const panel = root.querySelector('#miku-ctl-panel');
  root.querySelector('#miku-ctl-gear').addEventListener('click', () => {
    panel.classList.toggle('open');
    if (panel.classList.contains('open')) refreshUI();
  });

  /* native file picker */
  const fileInput = root.querySelector('#miku-ctl-file');
  root.querySelector('#miku-ctl-pick').addEventListener('click', () => fileInput.click());
  fileInput.addEventListener('change', () => {
    const f = fileInput.files && fileInput.files[0];
    fileInput.value = '';
    if (!f) return;
    if (f.size > 6 * 1024 * 1024) { alert('Miku \u80CC\u666F\uFF1A\u56FE\u7247\u8D85\u8FC7 6MB\uFF0C\u8BF7\u5148\u538B\u7F29\u518D\u9009\u3002'); return; }
    const r = new FileReader();
    r.onload = () => {
      S.customs.unshift({ key: 'c_' + Date.now(), name: f.name.replace(/\.[a-z0-9]+$/i, ''), src: r.result });
      while (S.customs.length > 6) S.customs.pop();
      S.image = S.customs[0].key;
      if (trySave()) { applyImage(); buildList(); }
      else { applyImage(); buildList(); } // session-only if quota exceeded
    };
    r.readAsDataURL(f);
  });

  const imgList = root.querySelector('#miku-ctl-imgs');
  function buildList() {
    imgList.innerHTML = '';
    all().forEach(b => {
      const row = document.createElement('div');
      row.className = 'miku-ctl-img' + (b.key === S.image ? ' active' : '');
      const thumb = document.createElement('div');
      thumb.className = 'thumb';
      thumb.style.backgroundImage = 'url("' + b.src + '")';
      const label = document.createElement('span');
      label.textContent = b.name;
      row.append(thumb, label);
      if (b.key.startsWith('c_')) {
        const del = document.createElement('span');
        del.className = 'del';
        del.textContent = '\u00D7';
        del.title = '\u79FB\u9664';
        del.addEventListener('click', (e) => {
          e.stopPropagation();
          S.customs = S.customs.filter(c => c.key !== b.key);
          if (S.image === b.key) { S.image = (all()[0] || {}).key || null; applyImage(); }
          trySave(); buildList();
        });
        row.appendChild(del);
      }
      row.addEventListener('click', () => { S.image = b.key; trySave(); applyImage(); buildList(); });
      imgList.appendChild(row);
    });
  }
  function refreshUI() {
    buildList();
    const m = cur();
    root.querySelector('#miku-ctl-blur').value = m.blur;
    root.querySelector('#miku-ctl-bright').value = m.bright;
    root.querySelector('#miku-ctl-blurv').textContent = m.blur + 'px';
    root.querySelector('#miku-ctl-brightv').textContent = m.bright + '%';
    root.querySelector('#miku-ctl-mode').textContent = mode() === 'welcome' ? '\u9996\u9875' : '\u4EFB\u52A1\u9875';
  }
  window.__mikuRefreshUI = refreshUI;
  root.querySelector('#miku-ctl-blur').addEventListener('input', e => {
    cur().blur = parseFloat(e.target.value); trySave(); applyFilter();
    root.querySelector('#miku-ctl-blurv').textContent = cur().blur + 'px';
  });
  root.querySelector('#miku-ctl-bright').addEventListener('input', e => {
    cur().bright = parseInt(e.target.value, 10); trySave(); applyFilter();
    root.querySelector('#miku-ctl-brightv').textContent = cur().bright + '%';
  });
  root.querySelector('#miku-ctl-reset').addEventListener('click', () => {
    S[mode()] = Object.assign({}, DEF[mode()]); trySave(); applyFilter(); refreshUI();
  });

  let tries = 0;
  (function init() {
    if (!img() && tries++ < 40) { setTimeout(init, 200); return; }
    applyImage();
    applyFilter();
    refreshUI();
  })();
})();
