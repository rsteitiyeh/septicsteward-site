import { getCollection } from 'astro:content';
import site from '../../site.config.json';

// llms.txt per the spec at https://llmstxt.org/ : H1 (only required section),
// then a blockquote summary, then prose without headings, then H2 sections
// containing ONLY markdown link lists. Generated from the content collection so
// it cannot drift from the published articles.
export const prerender = true;

export async function GET() {
  const articles = (await getCollection('articles', ({ data }) => !data.draft))
    .sort((a, b) => +(b.data.updatedDate ?? b.data.publishDate) - +(a.data.updatedDate ?? a.data.publishDate));
  const base = site.SITE.replace(/\/$/, '');
  const clean = (s) => String(s ?? '').replace(/\s+/g, ' ').trim();

  const lines = [];
  lines.push(`# ${site.BRAND}`);
  lines.push('');
  lines.push(`> ${clean(site.author?.bio) || clean(site.comingSoon?.promise)}`);
  lines.push('');
  lines.push(`Published by ${site.BRAND}. Every guide is written and reviewed by the ${site.BRAND} editorial team and cites primary sources on the page. Articles carry a last-updated date. All guides are free to read with no signup.`);
  lines.push('');
  lines.push('## Guides');
  lines.push('');
  for (const a of articles) {
    lines.push(`- [${clean(a.data.title)}](${base}/${a.id}/)${a.data.description ? ': ' + clean(a.data.description) : ''}`);
  }
  lines.push('');
  lines.push('## About');
  lines.push('');
  lines.push(`- [About ${site.BRAND}](${base}/about/): Who publishes this site and how to contact us.`);
  lines.push(`- [Editorial policy](${base}/editorial/): Sourcing, review, corrections and why articles are attributed to the organisation.`);
  lines.push(`- [Disclosure](${base}/disclosure/): How this site is funded.`);
  lines.push('');
  lines.push('## Optional');
  lines.push('');
  lines.push(`- [Privacy policy](${base}/privacy/)`);
  lines.push(`- [Terms](${base}/terms/)`);
  lines.push('');

  return new Response(lines.join('\n'), {
    headers: { 'Content-Type': 'text/plain; charset=utf-8' },
  });
}
