;!function(){try{var e="undefined"!=typeof window?window:"undefined"!=typeof global?global:"undefined"!=typeof globalThis?globalThis:"undefined"!=typeof self?self:{},n=(new e.Error).stack;n&&(e._sentryDebugIds=e._sentryDebugIds||{},e._sentryDebugIds[n]="55391f0c-6146-49ec-9670-9f2c08c9e68c",e._sentryDebugIdIdentifier="sentry-dbid-55391f0c-6146-49ec-9670-9f2c08c9e68c")}catch(e){}}();;!function(){try{var e="undefined"!=typeof window?window:"undefined"!=typeof global?global:"undefined"!=typeof globalThis?globalThis:"undefined"!=typeof self?self:{},n=(new e.Error).stack;n&&(e._sentryDebugIds=e._sentryDebugIds||{},e._sentryDebugIds[n]="04fb73ae-e147-4968-8448-7a0e1c658320",e._sentryDebugIdIdentifier="sentry-dbid-04fb73ae-e147-4968-8448-7a0e1c658320")}catch(e){}}();import { $ as $$BaseLayout } from '../chunks/BaseLayout_Dj4AKIQa.mjs';
import { c as createComponent, b as createAstro, r as renderTemplate, a as renderComponent, d as renderScript, m as maybeRenderHead, e as addAttribute } from '../chunks/astro/server_C0CZ7z44.mjs';
import 'kleur/colors';
import { $ as $$ContactCTA } from '../chunks/ContactCTA_C-k4Dh2K.mjs';
import { $ as $$Hero } from '../chunks/Hero_BPGDoIu8.mjs';
import { $ as $$Grid } from '../chunks/Grid_DAmQ6nzj.mjs';
/* empty css                                         */
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
export { renderers } from '../renderers.mjs';

const urlPattern = /(?=(\s*))\1(?:<a [^>]*?>)??(?=(\s*))\2(?:https?:\/\/)??(?:w{3}\.)??(?:youtube\.com|youtu\.be)\/(?:watch\?v=|embed\/|shorts\/)??([A-Za-z0-9-_]{11})(?:[^\s<>]*)(?=(\s*))\4(?:<\/a>)??(?=(\s*))\5/;
function matcher(url) {
  const match = url.match(urlPattern);
  return match?.[3];
}

const $$Astro$1 = createAstro();
const $$YouTube = createComponent(($$result, $$props, $$slots) => {
  const Astro2 = $$result.createAstro($$Astro$1, $$props, $$slots);
  Astro2.self = $$YouTube;
  const {
    id,
    poster,
    posterQuality = "default",
    title,
    ...attrs
  } = Astro2.props;
  const idRegExp = /^[A-Za-z0-9-_]+$/;
  function extractID(idOrUrl) {
    if (idRegExp.test(idOrUrl)) return idOrUrl;
    return matcher(idOrUrl);
  }
  const videoid = extractID(id);
  const posterFile = {
    max: "maxresdefault",
    high: "sddefault",
    default: "hqdefault",
    low: "default"
  }[posterQuality] || "hqdefault";
  const posterURL = poster || `https://i.ytimg.com/vi/${videoid}/${posterFile}.jpg`;
  const href = `https://youtube.com/watch?v=${videoid}`;
  return renderTemplate`${renderComponent($$result, "lite-youtube", "lite-youtube", { "videoid": videoid, "title": title, "data-title": title, ...attrs, "style": `background-image: url('${posterURL}');` }, { "default": () => renderTemplate` ${maybeRenderHead()}<a${addAttribute(href, "href")} class="lty-playbtn"> <span class="lyt-visually-hidden">${attrs.playlabel || "Play"}</span> </a> ` })} ${renderScript($$result, "/Users/shiv/Projects/personal/mandolinbalaji/node_modules/@astro-community/astro-embed-youtube/YouTube.astro?astro&type=script&index=0&lang.ts")} `;
}, "/Users/shiv/Projects/personal/mandolinbalaji/node_modules/@astro-community/astro-embed-youtube/YouTube.astro", undefined);

const __filename = fileURLToPath(import.meta.url);
path.dirname(__filename);

const VIDEOS_FILE = path.join(process.cwd(), 'src/data/youtube-videos.json');

function getYouTubeVideos() {
  try {
    if (!fs.existsSync(VIDEOS_FILE)) {
      return [];
    }

    const data = JSON.parse(fs.readFileSync(VIDEOS_FILE, 'utf-8'));
    // Convert the stored date strings back to Date objects
    return data.videos.map(video => ({
      ...video,
      publishDate: new Date(video.publishDate)
    }));
  } catch (error) {
    console.error('Error reading videos file:', error);
    return [];
  }
}

const $$Astro = createAstro();
const prerender = false;
const $$VideoLessons = createComponent(($$result, $$props, $$slots) => {
  const Astro2 = $$result.createAstro($$Astro, $$props, $$slots);
  Astro2.self = $$VideoLessons;
  const allVideos = getYouTubeVideos();
  const searchQuery = Astro2.url.searchParams.get("search")?.toLowerCase() || "";
  const currentPage = parseInt(Astro2.url.searchParams.get("page") || "1");
  const itemsPerPage = 12;
  const filteredVideos = searchQuery ? allVideos.filter(
    (video) => video.title.toLowerCase().includes(searchQuery) || video.description.toLowerCase().includes(searchQuery)
  ) : allVideos;
  console.log("DEBUG: " + Astro2.url.searchParams.get("search"));
  const totalPages = Math.ceil(filteredVideos.length / itemsPerPage);
  const startIndex = (currentPage - 1) * itemsPerPage;
  const endIndex = startIndex + itemsPerPage;
  const paginatedVideos = filteredVideos.slice(startIndex, endIndex);
  const generatePaginationRange = (current, total) => {
    const maxPagesToShow = 5;
    if (total <= maxPagesToShow) {
      return Array.from({ length: total }, (_, i) => i + 1);
    }
    let start = Math.max(1, current - 2);
    let end = Math.min(total, start + maxPagesToShow - 1);
    if (end - start < maxPagesToShow - 1) {
      start = Math.max(1, end - maxPagesToShow + 1);
    }
    return Array.from({ length: end - start + 1 }, (_, i) => start + i);
  };
  const paginationRange = generatePaginationRange(currentPage, totalPages);
  return renderTemplate`${renderComponent($$result, "BaseLayout", $$BaseLayout, { "title": "YouTube Channel Videos | Mandolin Balaji", "description": "Watch my latest YouTube videos featuring mandolin performances", "data-astro-cid-qvx6rknf": true }, { "default": ($$result2) => renderTemplate` ${maybeRenderHead()}<div class="stack gap-20" data-astro-cid-qvx6rknf> <main class="wrapper stack gap-8" data-astro-cid-qvx6rknf> ${renderComponent($$result2, "Hero", $$Hero, { "title": "YouTube Channel Videos", "tagline": "Watch my latest mandolin performances and tutorials.", "align": "center", "data-astro-cid-qvx6rknf": true })} <!-- Search and Pagination Controls --> <div class="controls" data-astro-cid-qvx6rknf> <div class="search-form" data-astro-cid-qvx6rknf> <div class="search-wrapper" data-astro-cid-qvx6rknf> <input type="text" id="searchInput"${addAttribute(searchQuery, "value")} placeholder="Search videos..." class="search-input" aria-label="Search videos" data-astro-cid-qvx6rknf> <button id="searchButton" class="search-button" aria-label="Search" data-astro-cid-qvx6rknf> <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" data-astro-cid-qvx6rknf> <circle cx="11" cy="11" r="8" data-astro-cid-qvx6rknf></circle> <line x1="21" y1="21" x2="16.65" y2="16.65" data-astro-cid-qvx6rknf></line> </svg>
Search
</button> <button id="clearButton" class="search-button" aria-label="Clear" data-astro-cid-qvx6rknf> <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" fill="#FFF" viewBox="0 0 256 256" data-astro-cid-qvx6rknf><path d="M205.66,194.34a8,8,0,0,1-11.32,11.32L128,139.31,61.66,205.66a8,8,0,0,1-11.32-11.32L116.69,128,50.34,61.66A8,8,0,0,1,61.66,50.34L128,116.69l66.34-66.35a8,8,0,0,1,11.32,11.32L139.31,128Z" data-astro-cid-qvx6rknf></path></svg>
Clear
</button> </div> </div> ${filteredVideos.length === 0 ? renderTemplate`<p class="no-results" data-astro-cid-qvx6rknf>No videos found matching your search.</p>` : searchQuery && renderTemplate`<p class="results-count" data-astro-cid-qvx6rknf>Found ${filteredVideos.length} video${filteredVideos.length !== 1 ? "s" : ""}</p>`} <!-- Pagination --> ${totalPages > 1 && renderTemplate`<div class="pagination" data-astro-cid-qvx6rknf> <div class="pagination-controls" data-astro-cid-qvx6rknf> ${currentPage > 1 && renderTemplate`<a${addAttribute(`?page=${currentPage - 1}${searchQuery ? `&search=${searchQuery}` : ""}`, "href")} class="page-link" data-astro-cid-qvx6rknf> <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" data-astro-cid-qvx6rknf> <path d="M15 18l-6-6 6-6" data-astro-cid-qvx6rknf></path> </svg>
Prev
</a>`} <div class="page-numbers" data-astro-cid-qvx6rknf> ${paginationRange.map((pageNum) => renderTemplate`<a${addAttribute(`?page=${pageNum}${searchQuery ? `&search=${searchQuery}` : ""}`, "href")}${addAttribute(`page-number ${pageNum === currentPage ? "active" : ""}`, "class")}${addAttribute(pageNum === currentPage ? "page" : undefined, "aria-current")} data-astro-cid-qvx6rknf> ${pageNum} </a>`)} </div> ${currentPage < totalPages && renderTemplate`<a${addAttribute(`?page=${currentPage + 1}${searchQuery ? `&search=${searchQuery}` : ""}`, "href")} class="page-link" data-astro-cid-qvx6rknf>
Next
<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" data-astro-cid-qvx6rknf> <path d="M9 18l6-6-6-6" data-astro-cid-qvx6rknf></path> </svg> </a>`} </div> </div>`} </div> ${renderComponent($$result2, "Grid", $$Grid, { "data-astro-cid-qvx6rknf": true }, { "default": ($$result3) => renderTemplate`${paginatedVideos.map((video) => renderTemplate`<li class="video-card" data-astro-cid-qvx6rknf> <div class="video-wrapper" data-astro-cid-qvx6rknf> ${renderComponent($$result3, "YouTube", $$YouTube, { "id": video.id, "poster": video.thumbnail, "playlabel": video.title, "data-astro-cid-qvx6rknf": true })} </div> <div class="content" data-astro-cid-qvx6rknf> <h3 class="video-title" data-astro-cid-qvx6rknf>${video.title}</h3> <p class="video-date" data-astro-cid-qvx6rknf> ${video.publishDate.toLocaleDateString("en-US", {
    year: "numeric",
    month: "long",
    day: "numeric"
  })} </p> </div> </li>`)}` })} </main> ${renderComponent($$result2, "ContactCTA", $$ContactCTA, { "data-astro-cid-qvx6rknf": true })} </div> ` })} ${renderScript($$result, "/Users/shiv/Projects/personal/mandolinbalaji/src/pages/video-lessons.astro?astro&type=script&index=0&lang.ts")} `;
}, "/Users/shiv/Projects/personal/mandolinbalaji/src/pages/video-lessons.astro", undefined);

const $$file = "/Users/shiv/Projects/personal/mandolinbalaji/src/pages/video-lessons.astro";
const $$url = "/video-lessons";

const _page = /*#__PURE__*/Object.freeze(/*#__PURE__*/Object.defineProperty({
	__proto__: null,
	default: $$VideoLessons,
	file: $$file,
	prerender,
	url: $$url
}, Symbol.toStringTag, { value: 'Module' }));

const page = () => _page;

export { page };
