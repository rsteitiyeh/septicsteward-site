/**
 * Extracts FAQ Q/A pairs from an article's raw markdown body.
 * Convention (pilot): a `## FAQ`-ish H2, followed by `### <question>` blocks.
 * Returns [{ q, a }] with `a` as plain text (markdown markers stripped).
 */
export function extractFaq(body) {
  if (!body) return [];
  const lines = body.split('\n');
  const faqs = [];
  let inFaq = false;
  let q = null;
  let a = [];
  const push = () => {
    if (q && a.length) faqs.push({ q, a: a.join(' ').replace(/\s+/g, ' ').trim() });
    q = null; a = [];
  };
  for (const line of lines) {
    const h2 = line.match(/^##\s+(.*)/);
    const h3 = line.match(/^###\s+(.*)/);
    if (h2 && !h3) {
      push();
      inFaq = /faq|frequently asked/i.test(h2[1]);
      continue;
    }
    if (!inFaq) continue;
    if (h3) { push(); q = h3[1].trim().replace(/\?*$/, '?'); continue; }
    if (q && line.trim()) a.push(line.replace(/[*_`>#\[\]]/g, '').trim());
  }
  push();
  return faqs;
}
