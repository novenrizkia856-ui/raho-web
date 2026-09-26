/**
 * Copy and content audit. Run with `npm run audit`.
 *
 *   1. No hyphen, en dash or em dash in the landing page's visible copy.
 *   2. No visible landing sentence over 15 words.
 *   3. No en or em dash, or " - " used as punctuation, in strings the scripts render.
 *   4. Nothing left over from the reference site, no placeholder text, no hype words.
 *   5. No contract address anywhere except src/config.
 */
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join, relative } from "node:path";
import { fileURLToPath } from "node:url";

const root = fileURLToPath(new URL("..", import.meta.url));
const failures = [];
const fail = (msg) => failures.push(msg);

const strip = (html) =>
  html
    .replace(/<!--[\s\S]*?-->/g, "")
    .replace(/<head[\s\S]*?<\/head>/i, "")
    .replace(/<script[\s\S]*?<\/script>/gi, "")
    .replace(/<(pre|code|svg)[\s\S]*?<\/\1>/gi, "");

for (const page of ["index.html", "app.html"]) {
  const html = readFileSync(join(root, page), "utf8");
  const text = strip(html).replace(/<br\s*\/?>/gi, " ").replace(/<[^>]+>/g, " ").replace(/&[a-z#0-9]+;/g, " ").replace(/\s+/g, " ").trim();
  if (page === "index.html") {
    for (const [ch, name] of [["-", "hyphen"], ["–", "en dash"], ["—", "em dash"]]) {
      const i = text.indexOf(ch);
      if (i !== -1) fail(`${page}: ${name} in visible copy near "${text.slice(Math.max(0, i - 40), i + 40)}"`);
    }
    const nodes = [...strip(html).replace(/<\/?(br|b|span|a|i|em|strong|code)\b[^>]*>/gi, " ").matchAll(/>([^<>]+)</g)]
      .map((m) => m[1].replace(/\s+/g, " ").trim())
      .filter(Boolean);
    for (const node of nodes) {
      for (const sentence of node.split(/(?<=[.!?])\s+/)) {
        const words = sentence.split(/\s+/).filter((w) => /[A-Za-z]/.test(w));
        if (words.length > 15) fail(`${page}: sentence over 15 words: "${sentence}"`);
      }
    }
  } else if (/[–—]/.test(text)) {
    fail(`${page}: en or em dash in visible copy`);
  }
  const attrs = [...html.matchAll(/(?:placeholder|aria-label|title|content|alt)="([^"]*)"/g)].map((m) => m[1]);
  for (const a of attrs) if (/[–—]| - /.test(a)) fail(`${page}: dash in attribute text "${a}"`);
}

const files = [];
const walk = (dir) => {
  for (const name of readdirSync(dir)) {
    if (["node_modules", ".git", "dist", ".vercel", "fonts", ".claude"].includes(name)) continue;
    const path = join(dir, name);
    if (statSync(path).isDirectory()) walk(path);
    else if (/\.(html|ts|js|mjs|css|json|md)$/.test(name) && name !== "package-lock.json") files.push(path);
  }
};
walk(root);

const LEFTOVERS = [
  /architecture\.dev/i, /definition sprint/i, /strategic engineering/i, /fixed price/i, /intro call/i, /\barc-/,
  /lorem ipsum/i, /\bTODO\b/, /\bFIXME\b/, /tokenomics/i, /presale/i, /airdrop/i,
  /revolutionary/i, /game changing/i, /\bto the moon\b/i, /\b100x\b/i, /financial freedom/i, /next big thing/i,
];
const ADDRESS = /0x[0-9a-fA-F]{40}\b/;
const SENTENCE_DASH = /[–—]|(["'`])[^"'`\n]*[A-Za-z] - [A-Za-z][^"'`\n]*\1/;

for (const file of files) {
  const rel = relative(root, file).replace(/\\/g, "/");
  if (rel === "tools/check-copy.mjs") continue;
  const source = readFileSync(file, "utf8");
  for (const pattern of LEFTOVERS) if (pattern.test(source)) fail(`${rel}: matches ${pattern}`);
  if (!rel.startsWith("src/config/") && ADDRESS.test(source)) fail(`${rel}: contract address outside src/config`);
  if (/^src\/(landing|app|shared)\//.test(rel) || /^src\/lib\/raho\/(engine|demo-data)\.ts$/.test(rel)) {
    for (const line of source.split("\n")) {
      if (/^\s*(\/\/|\*|\/\*)/.test(line)) continue;
      if (SENTENCE_DASH.test(line.replace(/\$\{[^}]*\}/g, "x"))) fail(`${rel}: sentence dash in rendered string: ${line.trim().slice(0, 100)}`);
    }
  }
}

if (failures.length) {
  console.error(`Copy audit failed:\n- ${failures.join("\n- ")}`);
  process.exit(1);
}
console.log(`Copy audit passed (${files.length} files)`);
