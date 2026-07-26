/**
 * Shared schema builders. Pure functions, no Astro imports, unit-testable.
 * Single source of truth for structured data across the fleet - change here,
 * not in fifteen copies of Article.astro.
 */
export function orgId(site) {
  return new URL('/#organization', site.SITE).href;
}

export function organization(site) {
  const node = {
    '@type': 'Organization',
    '@id': orgId(site),
    name: site.BRAND,
    url: site.SITE,
    logo: new URL('/og/default.png', site.SITE).href
  };
  const bio = site.author && site.author.bio;
  if (bio) node.description = bio;
  return node;
}

export function website(site) {
  return {
    '@type': 'WebSite',
    '@id': new URL('/#website', site.SITE).href,
    url: site.SITE,
    name: site.BRAND,
    publisher: { '@id': orgId(site) }
  };
}

/**
 * crumbs: [{ name, path }] - the LAST entry must omit `path`, per schema.org.
 * Names must match the breadcrumb rendered for humans, exactly.
 */
export function breadcrumb(site, crumbs) {
  return {
    '@type': 'BreadcrumbList',
    itemListElement: crumbs.map((c, i) => {
      const li = { '@type': 'ListItem', position: i + 1, name: c.name };
      if (c.path) li.item = new URL(c.path, site.SITE).href;
      return li;
    })
  };
}

export function absoluteImage(site, path) {
  return new URL(path || '/og/default.png', site.SITE).href;
}

/** Stopworded token set used for related-article scoring. */
const STOP = new Set(('a an and are as at be by for from how in is it of on or that the to what when where which who why with your you does do can will'
  + ' this these those about into over under after before than then they their there').split(' '));

export function tokens(s) {
  return new Set(
    String(s || '').toLowerCase().replace(/[^a-z0-9\s]/g, ' ').split(/\s+/)
      .filter((t) => t.length >= 3 && !STOP.has(t))
  );
}

export function overlap(a, b) {
  let n = 0;
  for (const t of a) if (b.has(t)) n++;
  return n;
}
