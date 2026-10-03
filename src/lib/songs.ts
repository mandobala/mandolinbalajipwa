/* The song library, read from the notation files in src/content/songs.
   Those files stay the only place a song lives: the Notes library, each song's
   own page, the sitemap and the Swara Player are all built from them, so a
   corrected file updates every one of them on the next build. */
import { execSync } from 'node:child_process';

const files = import.meta.glob('../content/songs/*.txt', { query: '?raw', import: 'default', eager: true }) as Record<string, string>;

export interface SongSection {
	name: string;
	text: string;
}

export interface SongEntry {
	/** File name without .txt — what the Swara Player's ?song= link uses. */
	file: string;
	/** Address of the song's own page: /notes/<slug>/ */
	slug: string;
	title: string;
	raga: string;
	tala: string;
	composer: string;
	arohana: string;
	avarohana: string;
	notatedBy: string;
	tags: string[];
	sections: SongSection[];
	/** Last commit that touched the file, or undefined outside a git checkout. */
	updated?: Date;
}

export const fold = (v: string) =>
	(v || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();

/* A header line is [KEY: value]; [SECTION: …] starts a part of the song. */
const RE_FIELD = /^\[([A-Z][A-Z ]*?):\s*(.*?)\s*\]\s*$/;
const RE_MARKER = /^\[[A-Za-z]+\]\s*$/;
const RE_COMMENT = /^\s*(#|\/\/)\s?/;

const tidyTitle = (t: string) => t.replace(/[-_]+/g, ' ').replace(/\s+/g, ' ').trim();

const urlSlug = (file: string) =>
	fold(file).replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');

function lastCommit(file: string): Date | undefined {
	try {
		const out = execSync(`git log -1 --format=%cI -- "src/content/songs/${file}.txt"`, {
			stdio: ['ignore', 'pipe', 'ignore'],
		}).toString().trim();
		return out ? new Date(out) : undefined;
	} catch {
		return undefined;
	}
}

function read(file: string, raw: string): SongEntry {
	const meta: Record<string, string> = {};
	const sections: SongSection[] = [];
	let current: { name: string; lines: string[] } = { name: '', lines: [] };

	for (const rawLine of raw.replace(/^﻿/, '').split(/\r?\n/)) {
		const line = rawLine.replace(/\s+$/, '');
		const f = line.trim().match(RE_FIELD);
		if (f) {
			const key = f[1].trim().toUpperCase();
			if (key === 'SECTION') {
				if (current.lines.some((l) => l.trim())) sections.push({ name: current.name, text: current.lines.join('\n') });
				current = { name: f[2], lines: [] };
			} else if (!(key in meta)) {
				meta[key] = f[2];
			}
			continue;
		}
		if (RE_MARKER.test(line.trim())) continue;
		current.lines.push(line.replace(RE_COMMENT, ''));
	}
	if (current.lines.some((l) => l.trim())) sections.push({ name: current.name, text: current.lines.join('\n') });

	// Trim blank lines at either end of each section, keep the inner spacing.
	sections.forEach((s) => { s.text = s.text.replace(/^\s*\n/, '').replace(/\n\s*$/, ''); });

	return {
		file,
		slug: urlSlug(file),
		title: tidyTitle(meta.TITLE || meta.SONG || file),
		raga: meta.RAGA || '',
		tala: meta.TALA || '',
		composer: meta.COMPOSER || '',
		arohana: meta.AROHANA || '',
		avarohana: meta.AVAROHANA || '',
		notatedBy: meta.NOTATEDBY || '',
		tags: (meta.TAGS || '').split(',').map((t) => t.trim()).filter(Boolean),
		sections,
		updated: lastCommit(file),
	};
}

let cache: SongEntry[] | null = null;

export function getSongs(): SongEntry[] {
	if (cache) return cache;
	const seen = new Map<string, string>();
	cache = Object.entries(files)
		.map(([path, raw]) => read((path.split('/').pop() || '').replace(/\.txt$/, ''), raw))
		.map((song) => {
			// Two files that fold to the same address get a numbered second one.
			let slug = song.slug || 'song';
			for (let n = 2; seen.has(slug); n++) slug = `${song.slug}-${n}`;
			seen.set(slug, song.file);
			return { ...song, slug };
		})
		.sort((a, b) => a.title.localeCompare(b.title));
	return cache;
}

export const songPageUrl = (song: SongEntry) => `/notes/${song.slug}/`;
export const playerUrl = (song: SongEntry) => `/swara-player/?song=${encodeURIComponent(song.file)}`;

/** The tala's name for prose: "Adi (8)" → "Adi"; a "Custom" tala has no name. */
export function talaName(song: SongEntry) {
	const t = song.tala.replace(/\s*\(.*?\)\s*/g, '').trim();
	return /^custom$/i.test(t) ? '' : t;
}

/** "Nagumomu – Abheri – Adi", leaving out a raga the title already names. */
export function songHeadline(song: SongEntry) {
	const raga = song.raga && !fold(song.title).includes(fold(song.raga)) ? song.raga : '';
	return [song.title, raga, talaName(song)].filter(Boolean).join(' – ');
}

/** One sentence for search results, built from whatever the file gives. */
export function songDescription(song: SongEntry) {
	const tala = talaName(song);
	const bits = [
		song.raga && `${song.raga} raga`,
		tala && `${tala} tala`,
		song.composer && `composed by ${song.composer}`,
	].filter(Boolean).join(', ');
	return `Swara notation of ${song.title}${bits ? ` (${bits})` : ''}, with sahitya. ` +
		`Practise it in the Swara Player with adjustable tempo, sruti and looping.`;
}
