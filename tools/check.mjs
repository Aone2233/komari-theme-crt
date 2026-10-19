/**
 * Validate the CRT theme package before it is zipped or installed.
 *
 * The checks here mirror what the Nekomari server enforces at install time
 * (`validateThemeManifest` in `web/api/admin/theme.go`) plus the handful of
 * packaging rules that only fail at runtime, where they are invisible:
 *
 *   - `komari-theme.json` must be at the archive root, not inside `dist/`.
 *   - every asset the document references has to exist in `dist/`.
 *   - the theme must not still call the Monitor backend it was written for
 *     (`/api/ws`, `/api/themes/<short>/config`, `/nodes/<id>/metrics`) — those
 *     requests fall through to the SPA fallback and return index.html, so the
 *     page renders "connecting" forever with no error anywhere.
 *
 * Run: node tools/check.mjs
 */
import { readFile, access } from "node:fs/promises";
import path from "node:path";

const CONFIG_TYPES = new Set([
  "string",
  "number",
  "select",
  "switch",
  "title",
  "textbox",
  "richtext",
  "nodes",
  "pingtasks",
]);

const FORBIDDEN_ENDPOINTS = [
  ["/api/ws", "the CRT upstream live-stream endpoint (Nekomari uses /api/rpc2 + /api/clients)"],
  ["/api/themes/", "the Monitor backend's per-theme config endpoint (Nekomari delivers theme_settings via /api/public)"],
  ["series=metrics", "the Monitor backend's metrics query (Nekomari uses /api/records/load)"],
];

async function exists(file) {
  try {
    await access(file);
    return true;
  } catch {
    return false;
  }
}

function isLocalizedText(value) {
  if (typeof value === "string") return value.trim() !== "";
  if (value && typeof value === "object") {
    return Object.values(value).some((item) => typeof item === "string" && item.trim() !== "");
  }
  return false;
}

export async function validate(themeRoot) {
  const problems = [];
  const manifestPath = path.join(themeRoot, "komari-theme.json");
  let manifest;
  try {
    manifest = JSON.parse(await readFile(manifestPath, "utf8"));
  } catch (error) {
    return { manifest: null, problems: [`komari-theme.json: ${error.message}`] };
  }

  if (!isLocalizedText(manifest.name)) problems.push("name is required");
  if (!/^[A-Za-z0-9_-]+$/.test(manifest.short || "")) {
    problems.push("short must be letters, digits, hyphen or underscore (the server rejects anything else)");
  }
  if (manifest.short === "default") problems.push('short "default" is reserved for the built-in theme');
  if (!/^\d+(\.\d+)*$/.test(manifest.version || "")) problems.push("version must be a dotted number, e.g. 1.0.0");

  const configuration = manifest.configuration;
  if (!configuration) {
    problems.push("configuration is missing: the theme would install but expose no settings");
  } else {
    if ((configuration.type || "managed").toLowerCase() !== "managed") {
      problems.push(`configuration.type must be "managed", got "${configuration.type}"`);
    }
    if (!Array.isArray(configuration.data)) {
      problems.push("configuration.data must be an array of managed settings items");
    } else {
      const keys = new Set();
      for (const [index, item] of configuration.data.entries()) {
        const where = `configuration.data[${index}]`;
        if (!item || typeof item !== "object") {
          problems.push(`${where} is not an object`);
          continue;
        }
        if (!CONFIG_TYPES.has(item.type)) problems.push(`${where}: unsupported type "${item.type}"`);
        if (item.type === "title") continue;
        if (!item.key) problems.push(`${where}: a non-title item needs a key`);
        else if (keys.has(item.key)) problems.push(`${where}: duplicate key "${item.key}"`);
        else keys.add(item.key);
        if (!isLocalizedText(item.name)) problems.push(`${where}: name is required`);
        if (item.type === "select") {
          const options = String(item.options || "").split(",").map((value) => value.trim()).filter(Boolean);
          if (options.length < 2) problems.push(`${where}: select needs at least two comma-separated options`);
          if (item.default != null && !options.includes(String(item.default))) {
            problems.push(`${where}: default "${item.default}" is not one of ${options.join(", ")}`);
          }
        }
        if (item.type === "switch" && item.default != null && typeof item.default !== "boolean") {
          problems.push(`${where}: a switch default must be true or false`);
        }
      }
    }
  }

  const dist = path.join(themeRoot, "dist");
  const documentPath = path.join(dist, "index.html");
  if (!(await exists(documentPath))) {
    problems.push("dist/index.html is missing: the theme cannot render");
  } else {
    const document = await readFile(documentPath, "utf8");
    for (const match of document.matchAll(/(?:src|href)="([^"]+)"/g)) {
      const value = match[1];
      if (/^(https?:)?\/\//.test(value) || value.startsWith("data:") || value.startsWith("#")) continue;
      const relative = value.replace(/^\//, "").split(/[?#]/)[0];
      if (!relative || relative.endsWith("/")) continue;
      if (!(await exists(path.join(dist, relative)))) {
        problems.push(`dist/index.html references /${relative}, which is not in dist/`);
      }
    }
  }

  if (manifest.preview) {
    const preview = path.join(themeRoot, manifest.preview);
    if (!(await exists(preview))) {
      problems.push(`preview "${manifest.preview}" is declared in the manifest but not in the package`);
    }
  } else {
    problems.push("preview is missing: the theme card in the admin panel would show no image");
  }

  const appPath = path.join(dist, "app.js");
  if (await exists(appPath)) {
    const script = await readFile(appPath, "utf8");
    for (const [needle, why] of FORBIDDEN_ENDPOINTS) {
      if (script.includes(needle)) problems.push(`dist/app.js still calls ${needle}: ${why}`);
    }
  } else {
    problems.push("dist/app.js is missing");
  }

  return { manifest, problems };
}

if (process.argv[1] && import.meta.url === new URL(`file:///${process.argv[1].replaceAll("\\", "/")}`).href) {
  const root = path.resolve(import.meta.dirname ?? path.dirname(new URL(import.meta.url).pathname), "..");
  const { problems } = await validate(root);
  if (problems.length > 0) {
    for (const problem of problems) console.error(`crt-theme: ${problem}`);
    process.exit(1);
  }
  console.log("crt-theme: manifest and package layout look valid");
}
