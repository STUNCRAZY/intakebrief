/**
 * make-preview.mjs — render IntakeBrief pages from a running production
 * server and save SELF-CONTAINED HTML files (CSS + JS inlined) under preview/.
 * Usage:
 *   DEMO_MODE=true npm start -- -p 3110 &
 *   node scripts/make-preview.mjs
 * The output files open straight from disk (double-click) — no server needed
 * for the visual preview. Interactive form calls (/api/*) require the live server.
 *
 * NOTE: preview/index.html is NOT generated here — it is a custom hand-built
 * landing page (see design/alagood-cartwright-burke-intake-mockup.html style);
 * this script deliberately skips it so regeneration never clobbers it.
 */
import { copyFile, mkdir, readdir, writeFile } from 'node:fs/promises';

const BASE = process.env.PREVIEW_BASE ?? 'http://localhost:3110';
const OUT = new URL('../preview/', import.meta.url);
const RESEARCH = new URL('../research/firms/', import.meta.url);
const PUBLIC = new URL('../public/', import.meta.url);

/** "What happens next" video assets served from public/ — rewritten to
 *  relative paths in the self-contained preview files and copied alongside
 *  them when present (skipped silently when absent). */
const VIDEO_ASSETS = ['how-it-works.mp4', 'how-it-works-poster.jpg', 'how-it-works-captions.vtt'];

const slugs = (await readdir(RESEARCH)).filter((f) => f.endsWith('.json')).map((f) => f.replace(/\.json$/, '')).sort();

const PAGES = { 'status': '/status' };
for (const slug of slugs) {
  PAGES[`firm-${slug}`] = `/firms/${slug}`;
  PAGES[`capture-${slug}`] = `/capture/${slug}`;
}

const get = async (url, retries = 3) => {
  let lastErr;
  for (let attempt = 1; attempt <= retries; attempt++) {
    try {
      const res = await fetch(url);
      if (res.ok) return await res.text();
      lastErr = new Error(`${url} → HTTP ${res.status}`);
    } catch (err) {
      lastErr = err;
    }
    await new Promise((r) => setTimeout(r, 1000 * attempt));
  }
  throw lastErr;
};

const waitForServer = async () => {
  for (let i = 0; i < 30; i++) {
    try {
      const res = await fetch(`${BASE}/api/health`);
      if (res.ok) return;
    } catch { /* not up yet */ }
    await new Promise((r) => setTimeout(r, 1000));
  }
  throw new Error('server did not become healthy');
};

async function inlineAssets(html) {
  // Inline stylesheets: <link ... rel="stylesheet" ... href="/_next/..." />
  const linkRe = /<link\b[^>]*rel="stylesheet"[^>]*>/g;
  const tags = html.match(linkRe) ?? [];
  for (const tag of tags) {
    const href = tag.match(/href="([^"]+)"/)?.[1];
    if (!href) continue;
    const css = await get(BASE + href);
    // Replacement MUST be a function: the minified bundles contain $&, $', $0
    // sequences that String.replace would otherwise interpret in the
    // replacement string, corrupting the output HTML.
    html = html.replace(tag, () => `<style data-inlined="${href}">\n${css}\n</style>`);
  }
  // Inline scripts: <script ... src="/_next/..." ...></script>
  const scriptRe = /<script\b[^>]*src="([^"]+)"[^>]*>\s*<\/script>/g;
  const scripts = [...html.matchAll(scriptRe)];
  for (const [tag, src] of scripts) {
    const js = await get(BASE + src);
    const safe = js.replace(/<\/script/gi, '<\\/script');
    html = html.replace(tag, () => `<script data-inlined="${src}">\n${safe}\n</script>`);
  }
  return html;
}

/** Point the video/poster/captions URLs at sibling files next to the preview HTML. */
function relativizeVideoAssets(html) {
  for (const asset of VIDEO_ASSETS) {
    html = html.split(`="/${asset}"`).join(`="${asset}"`);
  }
  return html;
}

function assertBalanced(name, html) {
  // Naive tag counts false-positive on '<script' string literals inside
  // inlined bundles. Instead, pair script blocks sequentially (inlined JS is
  // pre-escaped so no body contains a real '</script>'), then verify that
  // outside of script/style blocks there is no leftover minified code —
  // the actual failure mode we are guarding against (browser shows JS as text).
  const stripped = html
    .replace(/<script\b[^>]*>[\s\S]*?<\/script>/g, '')
    .replace(/<style\b[^>]*>[\s\S]*?<\/style>/g, '');
  const leaks = [
    ...stripped.matchAll(/.{200,}/g),
  ].filter((m) => /\(function\(|=>|__webpack|next\/dist/.test(m[0]));
  const openScripts = (stripped.match(/<script[\s>]/g) ?? []).length;
  const problems = [];
  if (openScripts > 0) problems.push(`${openScripts} unpaired <script> tags`);
  if (leaks.length > 0) problems.push(`${leaks.length} block(s) of minified JS visible as page text`);
  if (problems.length) throw new Error(`${name}: malformed HTML — ${problems.join('; ')}`);
}

await mkdir(OUT, { recursive: true });
await waitForServer();
for (const [name, path] of Object.entries(PAGES)) {
  const html = relativizeVideoAssets(await inlineAssets(await get(BASE + path)));
  assertBalanced(name, html);
  const file = new URL(`${name}.html`, OUT);
  await writeFile(file, html);
  console.log(`preview/${name}.html  ${(html.length / 1024).toFixed(0)} KB  ← ${path}`);
}
// Copy the video assets beside the preview files when they exist (absent = skip silently).
for (const asset of VIDEO_ASSETS) {
  try {
    await copyFile(new URL(asset, PUBLIC), new URL(asset, OUT));
    console.log(`preview/${asset}  copied from public/`);
  } catch {
    /* asset not present yet — the poster/video slot degrades gracefully */
  }
}
console.log('done');
