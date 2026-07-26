/**
 * Extracts FAQ Q/A pairs from an article's raw markdown body.
 *
 * TWO conventions are recognised:
 *  1. legacy pilot shape - a `## FAQ`-ish H2 followed by `### <question>` blocks
 *  2. the shape the fleet actually writes - top-level `## <question>?` headings
 *     each followed by an answer-first paragraph
 *
 * (2) is why this file exists: every article carries 5-7 question H2s with
 * self-contained answers, and none of them use shape (1), so FAQPage schema
 * was never emitted anywhere. Nothing is rewritten - the Q&A is already
 * visible on the page, this only makes it machine-readable.
 *
 * Returns [{ q, a }] with `a` as plain text (markdown markers stripped).
 */

const MIN_ANSWER = 80;
const MAX_ANSWER = 1200;
const MAX_PAIRS = 10;

function clean(line) {
  return line
    .replace(/!\[[^\]]*\]\([^)]*\)/g, '')        // images
    .replace(/\[([^\]]*)\]\([^)]*\)/g, '$1')     // links -> label
    .replace(/[*_`>#]/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

/** convention 1: a FAQ section with H3 questions */
function extractFaqSection(lines) {
  const faqs = [];
  let inFaq = false, q = null, a = [];
  const push = () => {
    if (q && a.length) faqs.push({ q, a: a.join(' ').replace(/\s+/g, ' ').trim() });
    q = null; a = [];
  };
  for (const line of lines) {
    const h2 = line.match(/^##\s+(.*)/);
    const h3 = line.match(/^###\s+(.*)/);
    if (h2 && !h3) { push(); inFaq = /faq|frequently asked/i.test(h2[1]); continue; }
    if (!inFaq) continue;
    if (h3) { push(); q = h3[1].trim().replace(/\?*$/, '?'); continue; }
    if (q && line.trim()) a.push(clean(line));
  }
  push();
  return faqs;
}

/** convention 2: question-formatted H2s with answer-first paragraphs */
function harvestQuestionHeadings(lines) {
  const out = [];
  let fence = false;
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    if (/^\s*(```|~~~)/.test(line)) { fence = !fence; continue; }
    if (fence) continue;
    const m = line.match(/^##\s+(.+?)\s*$/);
    if (!m) continue;
    const q = m[1].trim();
    if (!q.endsWith('?')) continue;                 // literal questions only
    if (/faq|frequently asked/i.test(q)) continue;  // handled by convention 1
    // first non-empty, non-heading, non-list, non-table paragraph beneath it
    const buf = [];
    for (let j = i + 1; j < lines.length; j++) {
      const l = lines[j];
      if (/^#{1,6}\s/.test(l)) break;
      if (/^\s*(```|~~~)/.test(l)) break;
      if (!l.trim()) { if (buf.length) break; continue; }
      if (/^\s*([-*+]\s|\d+\.\s|\|)/.test(l)) { if (buf.length) break; continue; }
      buf.push(clean(l));
    }
    const a = buf.join(' ').replace(/\s+/g, ' ').trim();
    if (a.length >= MIN_ANSWER && a.length <= MAX_ANSWER) out.push({ q, a });
  }
  return out;
}

export function extractFaq(body) {
  if (!body) return [];
  const lines = String(body).split('\n');
  const merged = [...extractFaqSection(lines), ...harvestQuestionHeadings(lines)];
  const seen = new Set();
  const deduped = [];
  for (const f of merged) {
    const key = f.q.toLowerCase().replace(/[^a-z0-9]/g, '');
    if (!key || seen.has(key)) continue;
    seen.add(key);
    deduped.push(f);
    if (deduped.length >= MAX_PAIRS) break;
  }
  // A single Q&A is not an FAQ. Two or more is honest markup of real content.
  return deduped.length >= 2 ? deduped : [];
}
