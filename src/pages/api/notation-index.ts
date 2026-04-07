export const prerender = false;
import type { APIRoute } from 'astro';

const GIST_INDEX_URL = 'https://gist.githubusercontent.com/mandolinbalaji/2cccf69f0afcc5eb83099ab2f449edc9/raw/index.json';
// Private IP ranges cover local network access (192.168.x.x, 10.x.x.x, 172.16-31.x.x)
const ALLOWED_HOSTS = ['mandolinbalaji.com', 'localhost', '127.0.0.1'];
const PRIVATE_IP_RE = /^(localhost|127\.|192\.168\.|10\.|172\.(1[6-9]|2\d|3[01])\.)/;

export const GET: APIRoute = async ({ request, url }) => {
  const referer = request.headers.get('referer') ?? '';
  const origin = request.headers.get('origin') ?? '';
  const host = request.headers.get('host') ?? '';
  const secFetchSite = request.headers.get('sec-fetch-site') ?? '';

  // Allow same-origin browser fetches, or requests from allowed hosts
  const isAllowed =
    secFetchSite === 'same-origin' ||
    ALLOWED_HOSTS.some(h => referer.includes(h) || origin.includes(h) || host.includes(h)) ||
    PRIVATE_IP_RE.test(host);

  if (!isAllowed) {
    return new Response('Forbidden', { status: 403 });
  }

  const res = await fetch(`${GIST_INDEX_URL}?t=${Date.now()}`);
  if (!res.ok) return new Response('Failed to fetch index', { status: 502 });

  let index: Record<string, unknown>[] = await res.json();

  const showAll = url.searchParams.get('all') === 'true';
  if (!showAll) {
    index = index.filter(e => !e.private);
  }

  return new Response(JSON.stringify(index), {
    headers: { 'Content-Type': 'application/json' },
  });
};