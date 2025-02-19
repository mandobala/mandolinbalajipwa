;!function(){try{var e="undefined"!=typeof window?window:"undefined"!=typeof global?global:"undefined"!=typeof globalThis?globalThis:"undefined"!=typeof self?self:{},n=(new e.Error).stack;n&&(e._sentryDebugIds=e._sentryDebugIds||{},e._sentryDebugIds[n]="cecb20df-7044-4a71-98e8-99aed72736ff",e._sentryDebugIdIdentifier="sentry-dbid-cecb20df-7044-4a71-98e8-99aed72736ff")}catch(e){}}();;!function(){try{var e="undefined"!=typeof window?window:"undefined"!=typeof global?global:"undefined"!=typeof globalThis?globalThis:"undefined"!=typeof self?self:{},n=(new e.Error).stack;n&&(e._sentryDebugIds=e._sentryDebugIds||{},e._sentryDebugIds[n]="ded26967-20b5-4843-bb6f-8c96e718a1cf",e._sentryDebugIdIdentifier="sentry-dbid-ded26967-20b5-4843-bb6f-8c96e718a1cf")}catch(e){}}();import { renderers } from './renderers.mjs';
import { c as createExports, s as serverEntrypointModule } from './chunks/_@astrojs-ssr-adapter_CWCQ2NIY.mjs';
import { manifest } from './manifest_DLPCGraI.mjs';

const serverIslandMap = new Map();;

const _page0 = () => import('./pages/_image.astro.mjs');
const _page1 = () => import('./pages/404.astro.mjs');
const _page2 = () => import('./pages/about.astro.mjs');
const _page3 = () => import('./pages/contact.astro.mjs');
const _page4 = () => import('./pages/testimonials.astro.mjs');
const _page5 = () => import('./pages/testimonials/_---slug_.astro.mjs');
const _page6 = () => import('./pages/video-lessons.astro.mjs');
const _page7 = () => import('./pages/index.astro.mjs');
const pageMap = new Map([
    ["node_modules/astro/dist/assets/endpoint/generic.js", _page0],
    ["src/pages/404.astro", _page1],
    ["src/pages/about.astro", _page2],
    ["src/pages/contact.astro", _page3],
    ["src/pages/testimonials.astro", _page4],
    ["src/pages/testimonials/[...slug].astro", _page5],
    ["src/pages/video-lessons.astro", _page6],
    ["src/pages/index.astro", _page7]
]);

const _manifest = Object.assign(manifest, {
    pageMap,
    serverIslandMap,
    renderers,
    middleware: () => import('./_noop-middleware.mjs')
});
const _args = {
    "mode": "standalone",
    "client": "file:///Users/shiv/Projects/personal/mandolinbalaji/dist/client/",
    "server": "file:///Users/shiv/Projects/personal/mandolinbalaji/dist/server/",
    "host": false,
    "port": 4321,
    "assets": "_astro"
};
const _exports = createExports(_manifest, _args);
const handler = _exports['handler'];
const startServer = _exports['startServer'];
const options = _exports['options'];
const _start = 'start';
if (_start in serverEntrypointModule) {
	serverEntrypointModule[_start](_manifest, _args);
}

export { handler, options, pageMap, startServer };
