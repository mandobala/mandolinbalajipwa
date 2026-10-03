/* sitemap.xml, rebuilt on every deploy. Each song page carries the date its
   notation file was last committed, so search engines revisit corrected songs. */
import type { APIRoute } from 'astro';
import { getSongs, songPageUrl } from '../lib/songs';

export const prerender = true;

const PAGES = [
	'/',
	'/notes/',
	'/swara-player/',
	'/video-lessons/',
	'/practice-studio/',
	'/tuner/',
	'/testimonials/',
	'/about/',
	'/contact/',
	'/privacy-policy/',
];

const esc = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

export const GET: APIRoute = ({ site }) => {
	const base = site ?? new URL('https://mandolinbalaji.com');
	const songs = getSongs();
	const newest = songs.reduce<Date | undefined>(
		(d, s) => (s.updated && (!d || s.updated > d) ? s.updated : d), undefined);

	const entries = [
		...PAGES.map((path) => ({ loc: new URL(path, base).href, lastmod: path === '/notes/' ? newest : undefined })),
		...songs.map((s) => ({ loc: new URL(songPageUrl(s), base).href, lastmod: s.updated })),
	];

	const xml =
		'<?xml version="1.0" encoding="UTF-8"?>\n' +
		'<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n' +
		entries.map((e) =>
			`  <url><loc>${esc(e.loc)}</loc>${e.lastmod ? `<lastmod>${e.lastmod.toISOString()}</lastmod>` : ''}</url>`
		).join('\n') +
		'\n</urlset>\n';

	return new Response(xml, { headers: { 'Content-Type': 'application/xml; charset=utf-8' } });
};
