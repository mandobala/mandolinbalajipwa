;!function(){try{var e="undefined"!=typeof window?window:"undefined"!=typeof global?global:"undefined"!=typeof globalThis?globalThis:"undefined"!=typeof self?self:{},n=(new e.Error).stack;n&&(e._sentryDebugIds=e._sentryDebugIds||{},e._sentryDebugIds[n]="4df3191b-5345-47b0-9803-c6a422b08415",e._sentryDebugIdIdentifier="sentry-dbid-4df3191b-5345-47b0-9803-c6a422b08415")}catch(e){}}();;!function(){try{var e="undefined"!=typeof window?window:"undefined"!=typeof global?global:"undefined"!=typeof globalThis?globalThis:"undefined"!=typeof self?self:{},n=(new e.Error).stack;n&&(e._sentryDebugIds=e._sentryDebugIds||{},e._sentryDebugIds[n]="a5685125-0425-46ad-b6f0-c3354b152f52",e._sentryDebugIdIdentifier="sentry-dbid-a5685125-0425-46ad-b6f0-c3354b152f52")}catch(e){}}();import { c as createComponent, b as createAstro, r as renderTemplate, m as maybeRenderHead, e as addAttribute, i as renderSlot } from './astro/server_C0CZ7z44.mjs';
import 'kleur/colors';
import 'clsx';
/* empty css                         */

const $$Astro = createAstro();
const $$Grid = createComponent(($$result, $$props, $$slots) => {
  const Astro2 = $$result.createAstro($$Astro, $$props, $$slots);
  Astro2.self = $$Grid;
  const { variant } = Astro2.props;
  return renderTemplate`${maybeRenderHead()}<ul id="{id}"${addAttribute(["grid", { offset: variant === "offset", small: variant === "small" }], "class:list")} data-astro-cid-vc5tsdmu> ${renderSlot($$result, $$slots["default"])} </ul> `;
}, "/Users/shiv/Projects/personal/mandolinbalaji/src/components/Grid.astro", undefined);

export { $$Grid as $ };
