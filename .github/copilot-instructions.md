# Copilot Instructions for Mandolin Balaji PWA

## Project Overview

Astro 5.x Progressive Web App for Mandolin Balaji's portfolio featuring carnatic music notations, testimonials, and video lessons. Deployed to Firebase Hosting with automated CI/CD.

## Architecture

**Framework**: Astro 5.x with Node adapter (`@astrojs/node` standalone mode)
**Content**: Astro Content Collections using glob loaders for markdown files
**PWA**: `@vite-pwa/astro` with Workbox service worker
**Deployment**: Firebase Hosting (`europe-west1` region)

### Critical Build Configuration

The Node adapter outputs to `dist/client` (NOT standard `dist`):
```javascript
// astro.config.mjs
adapter: node({ mode: 'standalone' })
```
```json
// firebase.json
"public": "dist/client"  // Required for Firebase deployment
```

## Development Commands

```bash
npm run dev              # localhost:4321
npm run build            # Production build → ./dist/
npm run preview          # Test production build locally
npm run fetch-videos     # Fetch YouTube channel videos to JSON
npm run deploy           # Build + Firebase deploy
```

## Content Collections

Defined in `src/content.config.ts` with Zod schemas:

**notes** (`src/content/notes/*.md`):
```markdown
---
title: Song Name
publishDate: 2025-01-15
description: |
  Raagam: Mohanam
  Taalam: Aadi
  Composer: Tyaagaraaja
  Arohanam: S R~2~ G~3~ P D~2~ S
tags: [mohanam, bhavanuta]
youtubeUrl: https://youtube.com/embed/...
---
```

**testimonials** (`src/content/testimonials/*.md`): Same schema without `youtubeUrl` or `tags`

### Musical Notation Conventions

- Subscript syntax: `R~2~` renders as R₂ (raaga notes)
- Description field supports multi-line structured text (Raagam, Taalam, Composer, Arohanam, Avarohanam)
- Content body uses standard markdown headings: `##### pallavi`, `##### anupallavi`, `##### caraNam 1`

## Component Patterns

### Layout Structure

`BaseLayout.astro` is the universal wrapper providing:
- SEO tags via `astro-seo` package
- PWA manifest injection via `virtual:pwa-info`
- Theme toggle (dark mode)
- Cookie consent integration
- `pwa-install` web component for install prompts

All pages follow: `<BaseLayout title="..." description="..."><slot /></BaseLayout>`

### Dynamic Routes

Use `[...slug].astro` pattern for content entries:
```astro
export async function getStaticPaths() {
  const notes = await getCollection('notes');
  return notes.map((entry) => ({
    params: { slug: entry.id },
    props: { entry },
  }));
}
```

### Client-Side Interactivity

Astro pages use inline `<script>` tags with `define:vars` for hydration:
```astro
<script define:vars={{ serializedData }}>
  const data = JSON.parse(serializedData);
  // Client-side logic
</script>
```

Example: `src/pages/notes.astro` implements search, tag filtering, and pagination entirely client-side.

## Theme System (Dark Mode)

Implemented in `src/components/MainHead.astro` as blocking inline script:
- Reads `localStorage.getItem('theme')` or system preference
- Applies `theme-dark` class to `<html>` before render (prevents flash)
- MutationObserver persists user changes

**Critical**: Script is `is:inline` and runs synchronously in `<head>`.

## YouTube Integration

`src/utils/youtube.mjs` fetches from channel `UCOMb0jCFPsDVs3A8YNPXG8Q`:
- **Incremental**: Compares with existing `src/content/data/youtube-videos.json` to avoid duplicates
- **Pagination**: 50 results per page with `nextPageToken` handling
- **API Key**: Hardcoded (not in env vars)

Run `npm run fetch-videos` to update JSON before builds.

## Styling Conventions

- **Global**: `src/styles/global.css` (CSS custom properties for theming)
- **Page-specific**: Co-located CSS files (`tuner.css`, `video-lessons.css`, `notes.css`)
- **Fonts**: Google Fonts preloaded with `<link rel="preload">` + `<noscript>` fallback

## PWA Configuration

In `astro.config.mjs`:
```javascript
AstroPWA({
  registerType: 'autoUpdate',  // Auto-update SW on deploy
  workbox: {
    additionalManifestEntries: [{ url: '/404.html', revision: null }],
    navigateFallback: '/404.html',
    maximumFileSizeToCacheInBytes: 5000000  // 5MB limit
  }
})
```

Service worker updates automatically on new deployments. No manual intervention required.

## Firebase Deployment

### CI/CD Pipeline

1. **Pull Request**: Preview channel (`.github/workflows/firebase-hosting-pull-request.yml`)
2. **Merge to main**: Production deploy (`.github/workflows/firebase-hosting-merge.yml`)

Workflow validates lockfile sync with strict `npm ci` check.

### Manual Deployment

```bash
npm run deploy  # Builds then deploys
```

### Troubleshooting

If `npm ci` fails in Actions:
```bash
npm install --package-lock-only
git add package-lock.json
git commit -m "Sync package-lock.json"
```

## TypeScript Configuration

`tsconfig.json` extends `astro/tsconfigs/strict` with additional types:
- `vite-plugin-pwa/*` for PWA types
- `dom-chromium-installation-events` for install event handling
- `web-app-manifest` for manifest types

Includes `public/js/aubio.js` for tuner feature audio processing.

## Cookie Consent

Uses `vanilla-cookieconsent` library:
- Config: `src/components/CookieConsentConfig.ts` (TypeScript)
- Component: `src/components/CookieConsent.astro` (applies elegant-black theme)
- Categories: necessary (read-only), functionality, analytics (GA4 placeholder)

## Special Features

**Tuner**: Interactive pitch tuner using Aubio.js library
**Rehearsal Studio**: Audio manipulation with Tone.js and SoundTouch
**Lite YouTube Embeds**: Custom `LiteYoutube.astro` component for performance

## File Organization

```
src/
  components/     # Reusable Astro components
  content/        # Content collections (notes, testimonials, data/youtube-videos.json)
  layouts/        # BaseLayout, MarkdownLayout
  pages/          # Routes (index, about, notes, notes/[...slug])
  styles/         # Global + page-specific CSS
  utils/          # youtube.mjs API integration
public/
  js/             # Third-party libraries (aubio, soundtouch, pwa-install)
  assets/         # Static images, backgrounds
  notation/       # .not files (notation format)
  lyrics/         # .lrc files (synchronized lyrics)
```
