export const prerender = false;

import type { APIRoute } from 'astro';

const GIST_URL = 'https://gist.githubusercontent.com/mandolinbalaji/2cccf69f0afcc5eb83099ab2f449edc9/raw/index.json';

export const GET: APIRoute = async () => {
  try {
    const res = await fetch(`${GIST_URL}?t=${Date.now()}`);
    if (!res.ok) throw new Error(`Gist responded with ${res.status}`);
    const data = await res.json();
    return new Response(JSON.stringify(data), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });
  } catch (err) {
    return new Response(JSON.stringify({ error: String(err) }), {
      status: 502,
      headers: { 'Content-Type': 'application/json' },
    });
  }
};
