/** @import { Addon, ResolvedAddon } from '../../core.js' */
import devtoolsJson from '../devtools-json/index.js';
import drizzle from '../drizzle/index.js';
import eslint from '../eslint/index.js';
import lucia from '../lucia/index.js';
import mcp from '../mcp/index.js';
import mdsvex from '../mdsvex/index.js';
import paraglide from '../paraglide/index.js';
import playwright from '../playwright/index.js';
import prettier from '../prettier/index.js';
import storybook from '../storybook/index.js';
import sveltekitAdapter from '../sveltekit-adapter/index.js';
import tailwindcss from '../tailwindcss/index.js';
import vitest from '../vitest-addon/index.js';

// The order of addons here determines the order they are displayed inside the CLI
// We generally try to order them by perceived popularity
/** @type {Record<string, ResolvedAddon>} */
export const officialAddons = /** @type {Record<string, ResolvedAddon>} */ (
	/** @type {unknown} */ ({
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
	})
);

/**
 * @param {string} id
 * @returns {ResolvedAddon}
 */
export function getAddonDetails(id) {
	const details = Object.values(officialAddons).find((a) => a.id === id);
	if (!details) {
		throw new Error(`Invalid add-on: ${id}`);
	}

	return details;
}
