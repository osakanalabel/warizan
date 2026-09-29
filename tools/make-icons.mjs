// アイコンの PNG をつくる使い捨てスクリプト。Node 標準の zlib だけを使う（外部ライブラリなし）。
//   node tools/make-icons.mjs

import { deflateSync } from 'node:zlib';
import { writeFileSync, mkdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const OUT_DIR = join(dirname(fileURLToPath(import.meta.url)), '..', 'icons');

const BG = [47, 125, 50];      // --accent
const FG = [255, 255, 255];
const SAMPLES = 3;             // 1ピクセルを 3×3 で見て なめらかにする

// ---- PNG 書き出し ----

const CRC_TABLE = (() => {
  const table = new Int32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    table[n] = c;
  }
  return table;
})();

function crc32(buf) {
  let c = 0xffffffff;
  for (const byte of buf) c = CRC_TABLE[(c ^ byte) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}

function chunk(type, data) {
  const head = Buffer.alloc(8);
  head.writeUInt32BE(data.length, 0);
  head.write(type, 4, 'ascii');
  const tail = Buffer.alloc(4);
  tail.writeUInt32BE(crc32(Buffer.concat([head.subarray(4), data])), 0);
  return Buffer.concat([head, data, tail]);
}

function png(size, pixels) {
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(size, 0);
  ihdr.writeUInt32BE(size, 4);
  ihdr[8] = 8;  // ビット深さ
  ihdr[9] = 2;  // カラータイプ: truecolor
  const raw = Buffer.alloc((size * 3 + 1) * size);
  let at = 0;
  for (let y = 0; y < size; y++) {
    raw[at++] = 0; // フィルタなし
    for (let x = 0; x < size; x++) {
      const i = (y * size + x) * 3;
      raw[at++] = pixels[i];
      raw[at++] = pixels[i + 1];
      raw[at++] = pixels[i + 2];
    }
  }
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk('IHDR', ihdr),
    chunk('IDAT', deflateSync(raw, { level: 9 })),
    chunk('IEND', Buffer.alloc(0)),
  ]);
}

// ---- ÷ をえがく ----

/** その点が わりざんの記号の中かどうか。座標は 0〜1 にそろえてある。 */
function inGlyph(u, v) {
  const barHalfH = 0.032;
  const barHalfW = 0.20;
  if (Math.abs(v - 0.5) <= barHalfH && Math.abs(u - 0.5) <= barHalfW) return true;
  // 線の両はしを丸くする
  for (const cx of [0.5 - barHalfW, 0.5 + barHalfW]) {
    if ((u - cx) ** 2 + (v - 0.5) ** 2 <= barHalfH ** 2) return true;
  }
  // 上と下の点
  const r = 0.062;
  for (const cy of [0.5 - 0.175, 0.5 + 0.175]) {
    if ((u - 0.5) ** 2 + (v - cy) ** 2 <= r * r) return true;
  }
  return false;
}

function render(size) {
  const pixels = Buffer.alloc(size * size * 3);
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      let hits = 0;
      for (let sy = 0; sy < SAMPLES; sy++) {
        for (let sx = 0; sx < SAMPLES; sx++) {
          const u = (x + (sx + 0.5) / SAMPLES) / size;
          const v = (y + (sy + 0.5) / SAMPLES) / size;
          if (inGlyph(u, v)) hits += 1;
        }
      }
      const t = hits / (SAMPLES * SAMPLES);
      const i = (y * size + x) * 3;
      for (let c = 0; c < 3; c++) {
        pixels[i + c] = Math.round(BG[c] * (1 - t) + FG[c] * t);
      }
    }
  }
  return pixels;
}

mkdirSync(OUT_DIR, { recursive: true });
for (const [name, size] of [['icon-192.png', 192], ['icon-512.png', 512], ['apple-touch-icon.png', 180]]) {
  const file = join(OUT_DIR, name);
  writeFileSync(file, png(size, render(size)));
  console.log(`${name} (${size}×${size})`);
}
