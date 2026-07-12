#!/usr/bin/env node
/* SepticSteward static builder.
 * content/*.md (drip format: title line + metadata table + body) -> dist/<slug>/index.html
 * static/* -> dist/*  ·  pages/*.html (inner content) -> dist/<name>/index.html
 * Also emits /guides/ index + sitemap.xml.
 */
"use strict";
const fs = require("fs");
const path = require("path");
const { marked } = require("marked");

const SITE = "https://septicsteward.com";
const BRAND = "SepticSteward";
const ROOT = __dirname;
const DIST = path.join(ROOT, "dist");
const base = JSON.parse(fs.readFileSync(path.join(ROOT, "scripts", "base.json"), "utf8"));

const stripNul = (s) => s.replace(/\x00/g, "");
const read = (p) => stripNul(fs.readFileSync(p, "utf8"));
const esc = (s) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

fs.rmSync(DIST, { recursive: true, force: true });
fs.mkdirSync(DIST, { recursive: true });

/* ---- copy static/ ---- */
(function copyDir(src, dst) {
  fs.mkdirSync(dst, { recursive: true });
  for (const e of fs.readdirSync(src, { withFileTypes: true })) {
    const s = path.join(src, e.name), d = path.join(dst, e.name);
    e.isDirectory() ? copyDir(s, d) : fs.copyFileSync(s, d);
  }
})(path.join(ROOT, "static"), DIST);

/* ---- shared page shell ---- */
function shell({ title, description, canonical, inner, schema }) {
  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="robots" content="noindex, nofollow">
<title>${esc(title)}</title>
<meta name="description" content="${esc(description)}">
<link rel="canonical" href="${canonical}">
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin="anonymous">
<link href="https://fonts.googleapis.com/css2?family=Source+Sans+3:ital,wght@0,400..800;1,400&family=Young+Serif&display=swap" rel="stylesheet">
<style>
${base.style}
.art{max-width:760px;margin:0 auto;padding:clamp(28px,5vw,52px) clamp(20px,4vw,36px);font-size:17.5px;line-height:1.65}
.art h1{font-family:'Young Serif',serif;font-size:clamp(28px,4.5vw,40px);line-height:1.15;color:#2F4A2E;margin:0 0 10px}
.art h2{font-family:'Young Serif',serif;font-size:clamp(21px,3vw,27px);color:#2F4A2E;margin:38px 0 12px}
.art h3{font-size:19px;color:#2F4A2E;margin:28px 0 8px}
.art table{border-collapse:collapse;width:100%;margin:18px 0;font-size:15.5px;display:block;overflow-x:auto}
.art th,.art td{border:1px solid #E3D9C2;padding:9px 12px;text-align:left;vertical-align:top}
.art th{background:#F5EFDF;color:#2F4A2E}
.art tr:nth-child(even) td{background:#FFFDF6}
.art img{max-width:100%;height:auto;border-radius:10px}
.art blockquote{margin:18px 0;padding:12px 18px;border-left:4px solid #C96F3B;background:#F5EFDF;border-radius:0 10px 10px 0}
.art code{background:#F5EFDF;padding:1px 5px;border-radius:4px;font-size:0.92em}
.byline{color:#6E5F4B;font-size:14.5px;margin:0 0 26px;padding-bottom:18px;border-bottom:1px solid #E3D9C2}
</style>
${schema ? `<script type="application/ld+json">${schema}</script>` : ""}
</head>
<body>
${base.header}
<main id="top">
${inner}
</main>
${base.footer}
</body>
</html>`;
}

/* ---- parse drip article format ---- */
function parseArticle(md) {
  const lines = md.split("\n");
  const title = lines[0].trim();
  let meta = {}, bodyStart = 1, inTable = false, tableEnd = 1;
  for (let i = 1; i < Math.min(lines.length, 30); i++) {
    const l = lines[i].trim();
    if (/^\|/.test(l)) {
      inTable = true;
      const cells = l.split("|").map((c) => c.trim().replace(/^\*\*|\*\*$/g, ""));
      if (cells.length >= 3 && cells[1] && cells[2] && !/^-+$/.test(cells[1].replace(/\s/g, "-"))) {
        const key = cells[1].replace(/\*\*/g, "").toLowerCase();
        const val = cells[2].replace(/\*\*/g, "");
        if (/primary keyword|secondary|slug|byline|updated/.test(key)) meta[key.split(" ")[0]] = val;
      }
      tableEnd = i + 1;
    } else if (inTable && l !== "") { bodyStart = i; break; }
    else if (inTable && l === "") { tableEnd = i; }
  }
  const body = lines.slice(Math.max(bodyStart, tableEnd)).join("\n").trim();
  return { title, meta, body };
}


/* ---- extract FAQ pairs from an "## FAQ" section for FAQPage schema ---- */
function faqPairs(mdBody) {
  const m = mdBody.match(/^##\s+FAQ\s*$([\s\S]*?)(?=^##\s|\Z)/m);
  if (!m) return [];
  const sec = m[1];
  const parts = sec.split(/^###\s+/m).slice(1);
  const clean = (t) => t.replace(/\[(.+?)\]\((.+?)\)/g, "$1").replace(/[#*`>]/g, "").replace(/^\s*-\s+/gm, "").replace(/\s+/g, " ").trim();
  const out = [];
  for (const p of parts) {
    const nl = p.indexOf("\n");
    const q = (nl === -1 ? p : p.slice(0, nl)).trim();
    const a = clean(nl === -1 ? "" : p.slice(nl + 1));
    if (q && a) out.push({ q, a });
  }
  return out;
}

/* ---- render articles ---- */
const contentDir = path.join(ROOT, "content");
const articles = [];
if (fs.existsSync(contentDir)) {
  for (const f of fs.readdirSync(contentDir)) {
    if (!f.endsWith(".md")) continue;
    const md = read(path.join(contentDir, f));
    const { title, meta, body } = parseArticle(md);
    const slug = (meta.slug || f.replace(/\.md$/, "")).trim();
    // internal-link convention "SepticSteward/some-slug" -> /some-slug/
    let fixed = body
      .replace(new RegExp(BRAND + "\\/calculator", "g"), `${SITE}/#calculator`)
      .replace(new RegExp(BRAND + "\\/guide(?![a-z0-9-])", "g"), `${SITE}/guides/`)
      .replace(new RegExp(BRAND + "\\/([a-z0-9-]+)", "g"), (m, sl) => `${SITE}/${sl}/`);
    let html = marked.parse(fixed);
    // media images live in content/media/
    html = html.replace(/src="media\//g, 'src="/media/');
    const updated = meta.updated || new Date().toISOString().slice(0, 10);
    const byline = meta.byline || `The ${BRAND} Team (Trilot)`;
    const desc = fixed.replace(/[#|*`\[\]]/g, " ").replace(/\s+/g, " ").trim().slice(0, 155);
    const graph = [{
      "@type": "Article",
      headline: title, dateModified: updated, datePublished: updated,
      author: { "@type": "Organization", name: byline.replace(/\s*\(.*\)$/, "") },
      publisher: { "@type": "Organization", name: BRAND },
      mainEntityOfPage: `${SITE}/${slug}/`
    }];
    const faqs = faqPairs(fixed);
    if (faqs.length) graph.push({
      "@type": "FAQPage",
      mainEntity: faqs.map(f => ({ "@type": "Question", name: f.q, acceptedAnswer: { "@type": "Answer", text: f.a } }))
    });
    const schema = JSON.stringify({ "@context": "https://schema.org", "@graph": graph });
    const inner = `<article class="art">
<h1>${esc(title)}</h1>
<p class="byline">By ${esc(byline)} · Updated ${esc(updated)}</p>
${html}
</article>`;
    const out = path.join(DIST, slug);
    fs.mkdirSync(out, { recursive: true });
    fs.writeFileSync(path.join(out, "index.html"), shell({
      title: `${title} | ${BRAND}`, description: desc,
      canonical: `${SITE}/${slug}/`, inner, schema
    }));
    articles.push({ slug, title, updated });
  }
  // copy media/
  const mediaDir = path.join(contentDir, "media");
  if (fs.existsSync(mediaDir)) {
    fs.mkdirSync(path.join(DIST, "media"), { recursive: true });
    for (const f of fs.readdirSync(mediaDir)) fs.copyFileSync(path.join(mediaDir, f), path.join(DIST, "media", f));
  }
}

/* ---- guides index ---- */
articles.sort((a, b) => (a.updated < b.updated ? 1 : -1));
const guideItems = articles.map((a) =>
  `<li style="margin:0 0 14px"><a href="/${a.slug}/" style="font-weight:600;font-size:18px">${esc(a.title)}</a><br><span style="color:#6E5F4B;font-size:14px">Updated ${a.updated}</span></li>`
).join("\n");
fs.mkdirSync(path.join(DIST, "guides"), { recursive: true });
fs.writeFileSync(path.join(DIST, "guides", "index.html"), shell({
  title: `Septic Guides & How-Tos | ${BRAND}`,
  description: "Every SepticSteward guide: pumping schedules, costs, troubleshooting, and what never to flush — written and checked by the Trilot team.",
  canonical: `${SITE}/guides/`,
  inner: `<div class="art"><h1>Guides &amp; How-Tos</h1>
<p class="byline">Practical, checked answers for septic homeowners. ${articles.length} guide${articles.length === 1 ? "" : "s"} and counting.</p>
<ul style="list-style:none;padding:0">${guideItems || "<li>First guides land this week — check back shortly.</li>"}</ul></div>`
}));

/* ---- standalone pages (pages/*.html contain inner HTML + <!--meta ...--> header) ---- */
const pagesDir = path.join(ROOT, "pages");
if (fs.existsSync(pagesDir)) {
  for (const f of fs.readdirSync(pagesDir)) {
    if (!f.endsWith(".html")) continue;
    const raw = read(path.join(pagesDir, f));
    const m = raw.match(/^<!--meta\s+title="([^"]*)"\s+description="([^"]*)"\s*-->/);
    const name = f.replace(/\.html$/, "");
    const inner = raw.replace(/^<!--meta[^>]*-->/, "");
    const out = path.join(DIST, name);
    fs.mkdirSync(out, { recursive: true });
    fs.writeFileSync(path.join(out, "index.html"), shell({
      title: m ? m[1] : `${name} | ${BRAND}`,
      description: m ? m[2] : "",
      canonical: `${SITE}/${name}/`,
      inner: `<div class="art">${inner}</div>`
    }));
  }
}

/* ---- sitemap + robots ---- */
const urls = [`${SITE}/`, `${SITE}/guides/`]
  .concat(articles.map((a) => `${SITE}/${a.slug}/`))
  .concat(fs.existsSync(pagesDir) ? fs.readdirSync(pagesDir).filter((f) => f.endsWith(".html")).map((f) => `${SITE}/${f.replace(/\.html$/, "")}/`) : []);
fs.writeFileSync(path.join(DIST, "sitemap.xml"),
  `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n` +
  urls.map((u) => `  <url><loc>${u}</loc></url>`).join("\n") + `\n</urlset>\n`);
fs.writeFileSync(path.join(DIST, "robots.txt"), `User-agent: *\nAllow: /\n`);

console.log(`[build] ${articles.length} articles, ${urls.length} urls -> dist/`);
