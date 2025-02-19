;!function(){try{var e="undefined"!=typeof window?window:"undefined"!=typeof global?global:"undefined"!=typeof globalThis?globalThis:"undefined"!=typeof self?self:{},n=(new e.Error).stack;n&&(e._sentryDebugIds=e._sentryDebugIds||{},e._sentryDebugIds[n]="126918cd-a270-4d06-af7f-a8241f4c849d",e._sentryDebugIdIdentifier="sentry-dbid-126918cd-a270-4d06-af7f-a8241f4c849d")}catch(e){}}();;!function(){try{var e="undefined"!=typeof window?window:"undefined"!=typeof global?global:"undefined"!=typeof globalThis?globalThis:"undefined"!=typeof self?self:{},n=(new e.Error).stack;n&&(e._sentryDebugIds=e._sentryDebugIds||{},e._sentryDebugIds[n]="d7f053b6-b722-4f9b-b927-579c606d6d00",e._sentryDebugIdIdentifier="sentry-dbid-d7f053b6-b722-4f9b-b927-579c606d6d00")}catch(e){}}();import { c as createComponent, b as createAstro, r as renderTemplate, m as maybeRenderHead, e as addAttribute, i as renderSlot, a as renderComponent } from './astro/server_C0CZ7z44.mjs';
import 'kleur/colors';
import 'clsx';
/* empty css                         */
import { a as $$Icon } from './BaseLayout_Dj4AKIQa.mjs';

const $$Astro = createAstro();
const $$CallToAction = createComponent(($$result, $$props, $$slots) => {
  const Astro2 = $$result.createAstro($$Astro, $$props, $$slots);
  Astro2.self = $$CallToAction;
  const { href } = Astro2.props;
  return renderTemplate`${maybeRenderHead()}<a${addAttribute(href, "href")} data-astro-cid-balv45lp>${renderSlot($$result, $$slots["default"])}</a> `;
}, "/Users/shiv/Projects/personal/mandolinbalaji/src/components/CallToAction.astro", undefined);

const $$ContactCTA = createComponent(($$result, $$props, $$slots) => {
  return renderTemplate`${maybeRenderHead()}<aside data-astro-cid-rcdzuq3a> <h2 data-astro-cid-rcdzuq3a>Interested in learning the Mandolin?</h2> ${renderComponent($$result, "CallToAction", $$CallToAction, { "href": "/contact/", "data-astro-cid-rcdzuq3a": true }, { "default": ($$result2) => renderTemplate`
Send Me a Message
${renderComponent($$result2, "Icon", $$Icon, { "icon": "paper-plane-tilt", "size": "1.2em", "data-astro-cid-rcdzuq3a": true })} ` })} </aside> `;
}, "/Users/shiv/Projects/personal/mandolinbalaji/src/components/ContactCTA.astro", undefined);

export { $$ContactCTA as $, $$CallToAction as a };
