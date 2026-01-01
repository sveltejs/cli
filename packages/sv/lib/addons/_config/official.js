import devtoolsJson from '../devtools-json/index.js';
import drizzle from '../drizzle/index.js';
import eslint from '../eslint/index.js';
import lucia from '../lucia/index.js';
import mdsvex from '../mdsvex/index.js';
import paraglide from '../paraglide/index.js';
import mcp from '../mcp/index.js';
import playwright from '../playwright/index.js';
import prettier from '../prettier/index.js';
import storybook from '../storybook/index.js';
import sveltekitAdapter from '../sveltekit-adapter/index.js';
import tailwindcss from '../tailwindcss/index.js';
import vitest from '../vitest-addon/index.js';

/**
 * @typedef OfficialAddons
 * @property {import('../../core.js').Addon<any>} prettier
 * @property {import('../../core.js').Addon<any>} eslint
 * @property {import('../../core.js').Addon<any>} vitest
 * @property {import('../../core.js').Addon<any>} playwright
 * @property {import('../../core.js').Addon<any>} tailwindcss
 * @property {import('../../core.js').Addon<any>} sveltekitAdapter
 * @property {import('../../core.js').Addon<any>} devtoolsJson
 * @property {import('../../core.js').Addon<any>} drizzle
 * @property {import('../../core.js').Addon<any>} lucia
 * @property {import('../../core.js').Addon<any>} mdsvex
 * @property {import('../../core.js').Addon<any>} paraglide
 * @property {import('../../core.js').Addon<any>} storybook
 * @property {import('../../core.js').Addon<any>} mcp
 */

// The order of addons here determines the order they are displayed inside the CLI
// We generally try to order them by perceived popularity
/** @type {OfficialAddons} */
export const officialAddons = {
	prettier,
	eslint,
	vitest,
	playwright,
	tailwindcss,
	sveltekitAdapter,
	devtoolsJson,
	drizzle,
	lucia,
	mdsvex,
	paraglide,
	storybook,
	mcp
};

/**
 *
 * @param {string} id
 * @returns {import('../../core.ts').ResolvedAddon}
 */
export function getAddonDetails(id) {
	const details = Object.values(officialAddons).find((a) => a.id === id);
	if (!details) {
		throw new Error(`Invalid add-on: ${id}`);
	}

	return /** @type {import('../../core.ts').ResolvedAddon} */ (details);
}
