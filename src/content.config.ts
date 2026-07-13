import { defineCollection, z } from 'astro:content';
import { glob } from 'astro/loaders';

// Markdown-native articles. The drip publisher commits files here:
//   src/content/articles/<slug>.md
// Front-matter contract (matches panel ingest):
const articles = defineCollection({
  loader: glob({ pattern: '**/*.md', base: './src/content/articles' }),
  schema: z.object({
    title: z.string(),
    description: z.string().default(''),
    keyword: z.string().optional(),
    publishDate: z.coerce.date(),
    updatedDate: z.coerce.date().optional(),
    author: z.string().optional(),
    draft: z.boolean().default(false)
  })
});

export const collections = { articles };
