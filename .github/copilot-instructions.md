# Copilot Instructions for Mandolin Balaji PWA

## Project Overview

This is an Astro-based Progressive Web App (PWA) for Mandolin Balaji's portfolio, featuring carnatic music notes, testimonials, and video lessons. It's deployed to Firebase Hosting with automated CI/CD via GitHub Actions.

## Architecture & Key Technologies

- **Framework**: Astro 5.x with SSR adapter (`@astrojs/node` in standalone mode)
- **Content Management**: Astro Content Collections with glob loaders for markdown files
- **PWA**: `@vite-pwa/astro` with Workbox for offline support and service worker management
- **Deployment**: Firebase Hosting with server region `europe-west1`
- **Build Output**: `dist/client` for static assets (configured in `firebase.json`)

### Critical PWA Setup

The PWA configuration in `astro.config.mjs` is production-ready:
- Service worker auto-updates on new deployments
- 404.html fallback for offline navigation
- Maximum cache file size: 5MB
- Custom 512x512 maskable icons for Android

### Content Collections Schema

Two collections defined in `src/content.config.ts`:
- **notes**: Musical notation files with `title`, `description`, `publishDate`, optional `youtubeUrl`, and `tags[]`
- **testimonials**: User testimonials with `title`, `description`, `publishDate`

Both use glob loaders pointing to respective markdown directories.

## Development Workflow

### Essential Commands

```bash
npm run dev              # Dev server at localhost:4321
npm run build            # Production build to ./dist/
npm run preview          # Preview production build locally
npm run fetch-videos     # Fetch YouTube videos via API (stores in src/content/data/youtube-videos.json)
npm run deploy           # Build + Firebase deploy (manual)
```

### YouTube Integration

The `src/utils/youtube.mjs` module fetches videos from channel `UCOMb0jCFPsDVs3A8YNPXG8Q`:
- Uses incremental updates (only fetches new videos)
- Stores in `src/content/data/youtube-videos.json` with metadata
- API key is hardcoded (consider environment variable for production)
- Implements pagination with 50 results per page

### Theme System

Dark mode is implemented via inline script in `src/components/MainHead.astro`:
- Reads from localStorage or system preference
- Applies `theme-dark` class to `<html>` element before page render (prevents flash)
- Uses MutationObserver to persist theme changes

## Code Conventions

### Component Structure

- **Layouts**: `BaseLayout.astro` wraps all pages with Nav, Footer, SEO, PWA components
- **Pages**: Use `.astro` files in `src/pages/` for routing
- **Dynamic Routes**: `[...slug].astro` pattern for content collection entries (see `notes/[...slug].astro`)

### Styling Approach

- Global styles in `src/styles/global.css`
- Page-specific CSS files (e.g., `tuner.css`, `video-lessons.css`)
- Google Fonts preloaded with fallback for no-JS users

### PWA Components

The `pwa-install` web component in `BaseLayout.astro` handles install prompts:
- Uses localStorage for persistence
- Platform-specific UI for iOS/Android/Desktop
- Event listeners track installation success/failure

## Firebase Deployment

### Configuration

- Public directory: `dist/client` (not standard `dist` due to Node adapter)
- Rewrites all routes to `/index.html` for SPA-like behavior
- Frameworks backend enabled in `europe-west1`

### CI/CD Pipeline

GitHub Actions auto-deploy on:
- PR creation → preview channel (`.github/workflows/firebase-hosting-pull-request.yml`)
- Merge to main → production (`.github/workflows/firebase-hosting-merge.yml`)

## Common Tasks

### Adding Musical Notes

1. Create markdown file in `src/content/notes/` with frontmatter:
```markdown
---
title: Song Name
publishDate: 2025-01-15
description: |
  Raagam: [name]
  Taalam: [name]
  Composer: [name]
tags:
  - tag1
  - tag2
youtubeUrl: https://youtube.com/watch?v=...
---
```
2. Content automatically appears on `/notes` page via `getCollection('notes')`

### Updating YouTube Videos

Run `npm run fetch-videos` to pull latest videos. The script:
- Compares with existing videos to avoid duplicates
- Sorts by publish date (newest first)
- Updates `src/content/data/youtube-videos.json`

### Cookie Consent

Uses `vanilla-cookieconsent` with custom config in `src/components/CookieConsentConfig.ts`. The elegant-black theme class is applied in `CookieConsent.astro`.

## Important Files

- `astro.config.mjs`: PWA manifest, Workbox config, integrations
- `src/content.config.ts`: Content collection schemas
- `src/layouts/BaseLayout.astro`: Core layout with PWA, SEO, and analytics setup
- `src/utils/youtube.mjs`: YouTube API integration
- `firebase.json`: Hosting config (note non-standard public path)

## TypeScript Configuration

Extends Astro's strict tsconfig with additional types for PWA, DOM installation events, and web app manifests. Includes `public/js/aubio.js` for the tuner feature.
