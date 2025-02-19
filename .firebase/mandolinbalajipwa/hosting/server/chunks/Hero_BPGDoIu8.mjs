;!function(){try{var e="undefined"!=typeof window?window:"undefined"!=typeof global?global:"undefined"!=typeof globalThis?globalThis:"undefined"!=typeof self?self:{},n=(new e.Error).stack;n&&(e._sentryDebugIds=e._sentryDebugIds||{},e._sentryDebugIds[n]="fb20cc6b-a2bc-4358-bb62-c27084a4d9a8",e._sentryDebugIdIdentifier="sentry-dbid-fb20cc6b-a2bc-4358-bb62-c27084a4d9a8")}catch(e){}}();;!function(){try{var e="undefined"!=typeof window?window:"undefined"!=typeof global?global:"undefined"!=typeof globalThis?globalThis:"undefined"!=typeof self?self:{},n=(new e.Error).stack;n&&(e._sentryDebugIds=e._sentryDebugIds||{},e._sentryDebugIds[n]="a2144bc4-3af1-4f14-8fa8-3b4ac275a349",e._sentryDebugIdIdentifier="sentry-dbid-a2144bc4-3af1-4f14-8fa8-3b4ac275a349")}catch(e){}}();import { c as createComponent, b as createAstro, r as renderTemplate, m as maybeRenderHead, e as addAttribute, i as renderSlot } from './astro/server_C0CZ7z44.mjs';
import 'kleur/colors';
import 'clsx';
/* empty css                         */

const $$Astro = createAstro();
const $$Hero = createComponent(($$result, $$props, $$slots) => {
  const Astro2 = $$result.createAstro($$Astro, $$props, $$slots);
  Astro2.self = $$Hero;
  const { align = "center", tagline, title } = Astro2.props;
  return renderTemplate`${maybeRenderHead()}<div${addAttribute(["hero stack gap-4", align], "class:list")} data-astro-cid-bbe6dxrz> <div class="stack gap-2" data-astro-cid-bbe6dxrz> <h1 class="title" data-astro-cid-bbe6dxrz>${title}</h1> ${tagline && renderTemplate`<p class="tagline" data-astro-cid-bbe6dxrz>${tagline}</p>`} </div> ${renderSlot($$result, $$slots["default"])} </div> `;
}, "/Users/shiv/Projects/personal/mandolinbalaji/src/components/Hero.astro", undefined);

export { $$Hero as $ };
