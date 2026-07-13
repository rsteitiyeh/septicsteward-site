import { defineConfig } from 'astro/config';
import sitemap from '@astrojs/sitemap';
import site from './site.config.json' with { type: 'json' };
import { brandLinks } from './src/remark/brand-links.mjs';

export default defineConfig({
  site: site.SITE,
  trailingSlash: 'always',
  build: { format: 'directory' },
  // Sitemap ONLY when un-stealthed; while stealth we withhold it on purpose.
  integrations: site.stealth ? [] : [sitemap()],
  markdown: {
    remarkPlugins: [[brandLinks, { site: site.SITE }]]
  }
});
