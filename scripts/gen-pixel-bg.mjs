#!/usr/bin/env node
/**
 * ZCode Miku theme - pixel-art background generator v2
 * Self-made pixel Miku room scene, 256x160 grid -> x4 upscale -> soft blur -> PNG.
 *   assets/pixel-bg.png          blurred, used as app background
 *   assets/pixel-bg-preview.png  sharp preview for inspection
 * Pure Node (zlib PNG encoder), ASCII only.
 */
import fs from 'node:fs';
import path from 'node:path';
import zlib from 'node:zlib';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const W = 256, H = 160, SCALE = 4, BLUR_R = 6, BLUR_PASSES = 2;

const PAL = {
  '0': [10, 20, 28], '1': [13, 27, 38], '2': [18, 37, 50],
  'F': [8, 16, 24], 'f': [13, 25, 34],
  'N': [28, 44, 80], 'n': [20, 32, 62],
  'M': [255, 224, 138], 'm': [217, 185, 92],
  'W': [30, 58, 74], 'w': [42, 80, 100],
  'R': [255, 126, 182], 'r': [224, 85, 154],
  'Y': [127, 212, 232], 'y': [234, 247, 245],
  'C': [57, 197, 187],
  'D': [22, 50, 62], 'd': [30, 68, 84],
  'c': [57, 197, 187],
  'P': [255, 126, 182], 'p': [255, 240, 220],
  'L': [255, 211, 126], 'l': [185, 138, 46],
  's': [27, 48, 64],
  'H': [57, 197, 187], 'h': [34, 167, 158],
  'S': [255, 228, 214], 'E': [15, 58, 64],
  'T': [43, 179, 169], 'K': [22, 36, 46], 'B': [11, 19, 27],
  'b': [255, 181, 201], 'G': [237, 246, 245], 'g': [201, 222, 220],
  'V': [96, 84, 168], 'v': [70, 62, 130],   // poster purple
};
const col = (ch) => (typeof ch === 'string' ? PAL[ch] : ch);

const px = Buffer.alloc(W * H * 3);
function set(x, y, c) {
  x = Math.round(x); y = Math.round(y);
  if (x < 0 || y < 0 || x >= W || y >= H) return;
  const i = (y * W + x) * 3;
  const cc = col(c);
  px[i] = cc[0]; px[i + 1] = cc[1]; px[i + 2] = cc[2];
}
function rect(x, y, w, h, c) { for (let j = y; j < y + h; j++) for (let i = x; i < x + w; i++) set(i, j, c); }
function ellipse(cx, cy, rx, ry, c) {
  for (let y = Math.floor(cy - ry); y <= Math.ceil(cy + ry); y++)
    for (let x = Math.floor(cx - rx); x <= Math.ceil(cx + rx); x++) {
      const dx = (x - cx) / rx, dy = (y - cy) / ry;
      if (dx * dx + dy * dy <= 1) set(x, y, c);
    }
}
function stamp(art, x, y) {
  art.forEach((row, j) => { for (let i = 0; i < row.length; i++) if (row[i] !== '.') set(x + i, y + j, row[i]); });
}

/* ================= scene ================= */
for (let y = 0; y < H; y++) {
  const t = y / H;
  rect(0, y, W, 1, t < 0.42 ? '0' : t < 0.85 ? '1' : '2');
}
rect(0, 136, W, 24, 'F');
rect(0, 136, W, 1, 'f');

/* window with starry night */
rect(15, 13, 44, 56, 'W');
rect(17, 15, 40, 52, 'N');
rect(17, 43, 40, 24, 'n');
for (const [sx, sy] of [[22, 20], [33, 27], [45, 19], [50, 33], [26, 35], [40, 47], [22, 52], [48, 57], [37, 60]]) {
  set(sx, sy, 'y'); set(sx + 1, sy, 'y');
}
ellipse(43, 23, 4, 4, 'M'); ellipse(42, 22, 3, 3, 'M'); set(46, 20, 'N'); set(45, 21, 'N');  // crescent
rect(36, 15, 2, 52, 'W'); rect(17, 39, 40, 2, 'W');
rect(13, 11, 48, 2, 'w'); rect(13, 67, 48, 2, 'w');
rect(13, 11, 2, 58, 'w'); rect(59, 11, 2, 58, 'w');

/* pink poster with heart */
rect(210, 38, 30, 28, 'v'); rect(212, 40, 26, 24, 'V');
stamp(['.R.R.', 'RRRRR', 'RRRRR', '.RRR.', '..R..'], 220, 46);
rect(210, 38, 30, 1, 'w');

/* shelf with leek + radio */
rect(150, 34, 58, 3, 's');
rect(152, 37, 3, 6, 's'); rect(203, 37, 3, 6, 's');
stamp(['..GG..', '.GGGG.', '.GGGg.', '..GG..', '..gg..', '..GG..', '..GG..'], 158, 27);
stamp(['sssssss', 'sKKKKKs', 'sssssss'], 172, 27);
set(174, 28, 'C'); set(176, 28, 'R');

/* wall doodles */
stamp(['.R.R.', 'RRRRR', 'RRRRR', '.RRR.', '..R..'], 78, 24);
stamp(['.r.r.', 'rrrrr', 'rrrrr', '.rrr.', '..r..'], 124, 48);
stamp(['..Y..', '.YYY.', 'YYYYY', '.YYY.', '..Y..'], 66, 80);
stamp(['..y..', '.yYy.', 'yyYyy', '.yYy.', '..y..'], 140, 16);
stamp(['..Y..', '.YYY.', 'YYYYY', '.YYY.', '..Y..'], 178, 78);
stamp(['..C..', '.C.C.', '..C..', '..C..', '..C..'], 96, 100);
stamp(['..C..', '.CCC.', '..C..', '..C..', '.CC..'], 52, 106);

/* string lights across the top */
for (let x = 2; x < W - 2; x++) {
  const y = 6 + Math.round(2 * Math.sin(x / 14));
  set(x, y, 'w');
}
for (let x = 10; x < W - 6; x += 22) {
  const y = 6 + Math.round(2 * Math.sin(x / 14)) + 2;
  const c = (x / 22) % 3 < 1 ? 'L' : (x / 22) % 3 < 2 ? 'R' : 'Y';
  set(x, y, c); set(x, y + 1, c); set(x - 1, y, c); set(x + 1, y, c);
  set(x, y + 2, PAL[typeof c === 'string' ? c : c] );
}

/* hanging lamp */
rect(226, 12, 2, 8, 'w');
rect(220, 20, 14, 2, 'l');
for (let j = 0; j < 5; j++) rect(221 + j, 22 + j, 12 - 2 * j, 1, 'l');
set(226, 27, 'L'); set(227, 27, 'L');
for (const [gx, gy] of [[222, 29], [230, 30], [226, 32], [219, 32], [233, 33]]) set(gx, gy, 'L');

/* desk + computer + milkshake (all sitting ON the desk top y=96) */
rect(118, 96, 134, 4, 'd'); rect(118, 100, 134, 3, 'D');
rect(122, 103, 4, 33, 'D'); rect(244, 103, 4, 33, 'D');
rect(168, 72, 42, 24, '0'); rect(170, 74, 38, 20, PAL['0']);
rect(172, 76, 34, 16, PAL[10 > 9 ? 'K' : 'K']);
rect(172, 76, 34, 16, 'K');
for (let j = 0; j < 5; j++) rect(175, 79 + j * 3, 12 + ((j * 7) % 18), 1, 'c');
set(176, 78, 'c'); set(177, 78, 'y');
rect(184, 96, 10, 2, 'w');
stamp(['.pp.', '.pp.', 'PPPP', 'PPPP', 'PPPP', 'PPPP', '.PP.', '.PP.', 'W..W'], 148, 87);
rect(149, 82, 1, 5, 'w');
stamp(['..GG..', '.GGGG.', '..GG..'], 212, 90);

/* floor rug */
rect(60, 142, 120, 12, '1');
rect(60, 142, 120, 1, 'C'); rect(60, 153, 120, 1, 'C');
for (let x = 66; x < 176; x += 12) rect(x, 143, 6, 10, '2');
rect(96, 145, 48, 6, 'R'); rect(97, 146, 46, 4, 'r');
stamp(['.R.R.', 'RRRRR', 'RRRRR', '.RRR.'], 112, 145);

/* ================= chibi Miku (programmatic) ================= */
const MS = 36 * 58, sprite = Buffer.alloc(MS * 3), spSet = (x, y, c) => {
  if (x < 0 || y < 0 || x >= 36 || y >= 58) return;
  const cc = col(c), i = (y * 36 + x) * 3;
  sprite[i] = cc[0]; sprite[i + 1] = cc[1]; sprite[i + 2] = cc[2];
};
const spRect = (x, y, w, h, c) => { for (let j = y; j < y + h; j++) for (let i = x; i < x + w; i++) spSet(i, j, c); };
const spEllipse = (cx, cy, rx, ry, c) => {
  for (let y = Math.floor(cy - ry); y <= Math.ceil(cy + ry); y++)
    for (let x = Math.floor(cx - rx); x <= Math.ceil(cx + rx); x++) {
      const dx = (x - cx) / rx, dy = (y - cy) / ry;
      if (dx * dx + dy * dy <= 1) spSet(x, y, c);
    }
};
/* twin tails first (behind body) */
for (let r = 6; r < 56; r++) {
  const t = (r - 6) / 50;
  const wL = r < 12 ? 3 : r < 40 ? 4 : Math.max(2, 4 - Math.floor((r - 40) / 6));
  const cxL = 7 - Math.round(2.2 * Math.sin(t * Math.PI * 1.1));
  const cxR = 28 + Math.round(2.2 * Math.sin(t * Math.PI * 1.1));
  for (let i = 0; i < wL; i++) { spSet(cxL + i, r, 'H'); spSet(cxL + wL - 1 + (36 - 0) * 0 + (i + 1) * 0, r, 'H'); }
  for (let i = 0; i < wL; i++) { spSet(cxL + i, r, i === wL - 1 ? 'h' : 'H'); spSet(cxR - i, r, i === wL - 1 ? 'h' : 'H'); }
}
/* head */
spEllipse(18, 9, 9, 8, 'H');
spEllipse(18, 11, 6.5, 5, 'S');
/* bangs: zigzag over forehead */
for (let x = 11; x <= 25; x++) {
  const depth = 7 + ((x % 3 === 0) ? 2 : (x % 3 === 1 ? 1 : 0));
  for (let y = 5; y <= depth; y++) spSet(x, y, x % 4 === 2 ? 'h' : 'H');
}
/* headset */
spRect(10, 1, 16, 1, '0');
spRect(8, 7, 3, 5, 'P'); spRect(25, 7, 3, 5, 'P');
spRect(9, 8, 1, 3, 'r'); spRect(26, 8, 1, 3, 'r');
/* eyes + blush + mouth */
spRect(14, 10, 2, 2, 'E'); spRect(20, 10, 2, 2, 'E');
spSet(14, 10, 'y'); spSet(20, 10, 'y');
spSet(12, 12, 'b'); spSet(23, 12, 'b');
spRect(17, 13, 2, 1, 'h');
/* neck + shirt + tie + arms */
spRect(17, 15, 2, 2, 'S');
spRect(12, 17, 12, 9, 'G');
spRect(17, 17, 2, 4, 'T'); spRect(16, 17, 4, 1, 'T');
spRect(12, 18, 1, 7, 'g'); spRect(23, 18, 1, 7, 'g');
spRect(10, 18, 2, 6, 'g'); spRect(24, 18, 2, 6, 'g');
spRect(10, 24, 2, 2, 'S'); spRect(24, 24, 2, 2, 'S');
/* skirt (pleated, teal hem) */
for (let j = 0; j < 7; j++) {
  const w = 14 + j, x0 = 18 - Math.floor(w / 2);
  spRect(x0, 26 + j, w, 1, 'K');
}
for (let x = 11; x <= 25; x += 2) spSet(x, 27, '0');
spRect(11, 32, 14, 1, 'h');
/* legs + boots */
spRect(15, 33, 2, 8, 'S'); spRect(19, 33, 2, 8, 'S');
spRect(14, 41, 4, 4, 'B'); spRect(18, 41, 4, 4, 'B');
spRect(14, 45, 4, 1, 'C'); spRect(18, 45, 4, 1, 'C');
/* stamp sprite: feet on floor line y=136 */
(function stampMiku() {
  const sx = 76, sy = 136 - 58;
  for (let y = 0; y < 58; y++) for (let x = 0; x < 36; x++) {
    const i = (y * 36 + x) * 3;
    if (sprite[i] || sprite[i + 1] || sprite[i + 2]) set(sx + x, sy + y, [sprite[i], sprite[i + 1], sprite[i + 2]]);
  }
})();

/* sparkles */
for (const [sx, sy] of [[64, 122], [110, 20], [132, 86], [206, 112], [40, 94], [168, 60]]) {
  set(sx, sy, 'y'); set(sx - 1, sy, 'Y'); set(sx + 1, sy, 'Y');
  set(sx, sy - 1, 'Y'); set(sx, sy + 1, 'Y');
}

/* ================= upscale + blur + encode ================= */
const UW = W * SCALE, UH = H * SCALE;
const up = Buffer.alloc(UW * UH * 3);
for (let y = 0; y < UH; y++) {
  const sy = Math.floor(y / SCALE);
  for (let x = 0; x < UW; x++) {
    const si = (sy * W + Math.floor(x / SCALE)) * 3, di = (y * UW + x) * 3;
    up[di] = px[si]; up[di + 1] = px[si + 1]; up[di + 2] = px[si + 2];
  }
}
function boxBlur(src, w, h, r, passes) {
  const cur = Buffer.from(src), buf = Buffer.alloc(src.length);
  for (let p = 0; p < passes; p++) {
    for (let y = 0; y < h; y++) for (let c = 0; c < 3; c++) {
      let acc = 0;
      for (let x = -r; x <= r; x++) acc += cur[(y * w + Math.min(w - 1, Math.max(0, x))) * 3 + c];
      const norm = 2 * r + 1;
      for (let x = 0; x < w; x++) {
        buf[(y * w + x) * 3 + c] = acc / norm;
        const xo = Math.max(0, x - r), xi = Math.min(w - 1, x + r + 1);
        acc += cur[(y * w + xi) * 3 + c] - cur[(y * w + xo) * 3 + c];
      }
    }
    for (let x = 0; x < w; x++) for (let c = 0; c < 3; c++) {
      let acc = 0;
      for (let y = -r; y <= r; y++) acc += buf[(Math.min(h - 1, Math.max(0, y)) * w + x) * 3 + c];
      const norm = 2 * r + 1;
      for (let y = 0; y < h; y++) {
        cur[(y * w + x) * 3 + c] = acc / norm;
        const yo = Math.max(0, y - r), yi = Math.min(h - 1, y + r + 1);
        acc += buf[(yi * w + x) * 3 + c] - buf[(yo * w + x) * 3 + c];
      }
    }
  }
  return cur;
}
const blurred = boxBlur(up, UW, UH, BLUR_R, BLUR_PASSES);

function crc32(buf) {
  let table = crc32.table;
  if (!table) {
    table = crc32.table = new Int32Array(256);
    for (let n = 0; n < 256; n++) { let c = n; for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1; table[n] = c; }
  }
  let c = -1;
  for (let i = 0; i < buf.length; i++) c = table[(c ^ buf[i]) & 0xff] ^ (c >>> 8);
  return (c ^ -1) >>> 0;
}
function chunk(type, data) {
  const len = Buffer.alloc(4); len.writeUInt32BE(data.length);
  const body = Buffer.concat([Buffer.from(type), data]);
  const crc = Buffer.alloc(4); crc.writeUInt32BE(crc32(body));
  return Buffer.concat([len, body, crc]);
}
function encodePNG(rgb, w, h) {
  const raw = Buffer.alloc((w * 3 + 1) * h);
  for (let y = 0; y < h; y++) {
    raw[y * (w * 3 + 1)] = 0;
    rgb.copy(raw, y * (w * 3 + 1) + 1, y * w * 3, (y + 1) * w * 3);
  }
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(w, 0); ihdr.writeUInt32BE(h, 4);
  ihdr[8] = 8; ihdr[9] = 2;
  return Buffer.concat([
    Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]),
    chunk('IHDR', ihdr),
    chunk('IDAT', zlib.deflateSync(raw, { level: 9 })),
    chunk('IEND', Buffer.alloc(0)),
  ]);
}
const assets = path.join(__dirname, '..', 'assets');
fs.writeFileSync(path.join(assets, 'pixel-bg.png'), encodePNG(blurred, UW, UH));
fs.writeFileSync(path.join(assets, 'pixel-bg-preview.png'), encodePNG(up, UW, UH));
console.log('written pixel-bg.png + pixel-bg-preview.png (' + UW + 'x' + UH + ')');
