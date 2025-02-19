import { glob } from 'astro/loaders';
import { defineCollection, z } from 'astro:content';

export const collections = {
	testimonials: defineCollection({
		// Load Markdown files in the src/content/testimonials directory.
		loader: glob({ base: './src/content/testimonials', pattern: '**/*.md', }),
		schema: z.object({
			title: z.string(),
			description: z.string(),
			publishDate: z.coerce.date(),
		}),
	}),
	notes: defineCollection({
		schema: z.object({
		  title: z.string(),
		  description: z.string(),
		  publishDate: z.coerce.date(),
		  tags: z.array(z.string()),
		  // img: z.string().optional(),
		  // img_alt: z.string().optional(),
		}),
	}),
};
