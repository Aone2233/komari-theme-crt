/**
 * Package the CRT theme as the ZIP the Nekomari admin panel imports.
 *
 * The archive layout is fixed by the server (`extractAndValidateTheme` in
 * `web/api/admin/theme.go`): `komari-theme.json` at the root, and the files the
 * document references under `dist/`. Packing the contents of `dist/` at the root
 * instead installs cleanly and then renders a blank page, so the walk below keeps
 * the `dist/` prefix and the checker asserts the same shape.
 *
 * Usage: node tools/package.mjs
 */
import { readdir, readFile, writeFile, stat } from "node:fs/promises";
import path from "node:path";
import { deflateRawSync } from "node:zlib";
import { validate } from "./check.mjs";

const CRC_TABLE = (() => {
  const table = new Uint32Array(256);
  for (let i = 0; i < 256; i++) {
    let value = i;
    for (let bit = 0; bit < 8; bit++) value = value & 1 ? 0xedb88320 ^ (value >>> 1) : value >>> 1;
    table[i] = value >>> 0;
  }
  return table;
})();

function crc32(buffer) {
  let crc = 0xffffffff;
  for (const byte of buffer) crc = CRC_TABLE[(crc ^ byte) & 0xff] ^ (crc >>> 8);
  return (crc ^ 0xffffffff) >>> 0;
}

function dosTimestamp(date) {
  const time = (date.getHours() << 11) | (date.getMinutes() << 5) | Math.floor(date.getSeconds() / 2);
  const day = ((date.getFullYear() - 1980) << 9) | ((date.getMonth() + 1) << 5) | date.getDate();
  return { time, day };
}

/** Minimal ZIP writer: deflate entries, UTF-8 names, no ZIP64. */
function buildZip(entries, date = new Date()) {
  const { time, day } = dosTimestamp(date);
  const locals = [];
  const central = [];
  let offset = 0;
  for (const entry of entries) {
    const name = Buffer.from(entry.name, "utf8");
    const data = entry.data;
    const compressed = deflateRawSync(data, { level: 9 });
    const crc = crc32(data);

    const local = Buffer.alloc(30);
    local.writeUInt32LE(0x04034b50, 0);
    local.writeUInt16LE(20, 4);
    local.writeUInt16LE(0x0800, 6); // UTF-8 names
    local.writeUInt16LE(8, 8); // deflate
    local.writeUInt16LE(time, 10);
    local.writeUInt16LE(day, 12);
    local.writeUInt32LE(crc, 14);
    local.writeUInt32LE(compressed.length, 18);
    local.writeUInt32LE(data.length, 22);
    local.writeUInt16LE(name.length, 26);
    local.writeUInt16LE(0, 28);
    locals.push(local, name, compressed);

    const directory = Buffer.alloc(46);
    directory.writeUInt32LE(0x02014b50, 0);
    directory.writeUInt16LE(20, 4);
    directory.writeUInt16LE(20, 6);
    directory.writeUInt16LE(0x0800, 8);
    directory.writeUInt16LE(8, 10);
    directory.writeUInt16LE(time, 12);
    directory.writeUInt16LE(day, 14);
    directory.writeUInt32LE(crc, 16);
    directory.writeUInt32LE(compressed.length, 20);
    directory.writeUInt32LE(data.length, 24);
    directory.writeUInt16LE(name.length, 28);
    directory.writeUInt16LE(0, 30);
    directory.writeUInt16LE(0, 32);
    directory.writeUInt16LE(0, 34);
    directory.writeUInt16LE(0, 36);
    directory.writeUInt32LE(0, 38);
    directory.writeUInt32LE(offset, 42);
    central.push(directory, name);

    offset += local.length + name.length + compressed.length;
  }
  const centralSize = central.reduce((sum, buffer) => sum + buffer.length, 0);
  const end = Buffer.alloc(22);
  end.writeUInt32LE(0x06054b50, 0);
  end.writeUInt16LE(0, 4);
  end.writeUInt16LE(0, 6);
  end.writeUInt16LE(entries.length, 8);
  end.writeUInt16LE(entries.length, 10);
  end.writeUInt32LE(centralSize, 12);
  end.writeUInt32LE(offset, 16);
  end.writeUInt16LE(0, 20);
  return Buffer.concat([...locals, ...central, end]);
}

async function listFiles(dir, prefix = "") {
  const out = [];
  const entries = await readdir(dir, { withFileTypes: true });
  entries.sort((a, b) => a.name.localeCompare(b.name));
  for (const entry of entries) {
    if (entry.name === ".DS_Store" || entry.name === ".gitkeep") continue;
    const relative = prefix ? `${prefix}/${entry.name}` : entry.name;
    if (entry.isDirectory()) out.push(...(await listFiles(path.join(dir, entry.name), relative)));
    else if (entry.isFile()) out.push(relative);
  }
  return out;
}

const themeRoot = path.resolve(import.meta.dirname ?? path.dirname(new URL(import.meta.url).pathname), "..");
const { manifest, problems } = await validate(themeRoot);
if (problems.length > 0) {
  for (const problem of problems) console.error(`crt-theme: ${problem}`);
  process.exit(1);
}

const entries = [];
entries.push({ name: "komari-theme.json", data: await readFile(path.join(themeRoot, "komari-theme.json")) });
if (manifest.preview) {
  entries.push({ name: manifest.preview, data: await readFile(path.join(themeRoot, manifest.preview)) });
}
for (const relative of await listFiles(path.join(themeRoot, "dist"))) {
  entries.push({ name: `dist/${relative}`, data: await readFile(path.join(themeRoot, "dist", relative)) });
}

const zipName = `${manifest.short}-v${manifest.version}.zip`;
const zipPath = path.join(themeRoot, zipName);
const archive = buildZip(entries);
await writeFile(zipPath, archive);
const size = (await stat(zipPath)).size;
console.log(
  `crt-theme: wrote ${zipName} (${entries.length} files, ${(size / 1024).toFixed(1)} KiB) — import it from 后台 → 主题 → 导入`,
);
