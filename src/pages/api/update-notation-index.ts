export const prerender = false;

import type { APIRoute } from 'astro';
import { readFile, writeFile } from 'fs/promises';
import { resolve } from 'path';

const INDEX_PATH = resolve('public/notesfromtext/index.json');

export const POST: APIRoute = async ({ request }) => {
  try {
    const entry = await request.json();

    if (!entry.file || !entry.song || !entry.raga) {
      return new Response(JSON.stringify({ error: 'Missing required fields: file, song, raga' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    const raw = await readFile(INDEX_PATH, 'utf-8');
    const index: Record<string, unknown>[] = JSON.parse(raw);

    const existingIdx = index.findIndex((e) => e.file === entry.file);
    if (existingIdx >= 0) {
      // Preserve midiFile if it already exists
      const existing = index[existingIdx];
      index[existingIdx] = { ...entry };
      if (existing.midiFile && !entry.midiFile) {
        (index[existingIdx] as Record<string, unknown>).midiFile = existing.midiFile;
      }
    } else {
      index.push(entry);
    }

    await writeFile(INDEX_PATH, JSON.stringify(index, null, 2), 'utf-8');

    return new Response(JSON.stringify({ ok: true, action: existingIdx >= 0 ? 'updated' : 'created' }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });
  } catch (err) {
    console.error('[update-notation-index]', err);
    return new Response(JSON.stringify({ error: String(err) }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }
};
