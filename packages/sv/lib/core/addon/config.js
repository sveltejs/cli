/** @import { OptionDefinition, Addon, OptionBuilder } from './types.d.ts' */

/**
 * The entry point for your addon, It will hold every thing! (options, setup, run, nextSteps, ...)
 * @template {OptionDefinition} Args
 * @param {Addon<Args>} config
 * @returns {Addon<Args>}
 */
export function defineAddon(config) {
	return config;
}

/**
 * Options for an addon.
 *
 * Will be prompted to the user if there are not answered by args when calling the cli.
 *
 * ```ts
 * const options = defineAddonOptions()
 *   .add('demo', {
 *     question: `demo? ${color.optional('(a cool one!)')}`
 *     type: string | boolean | number | select | multiselect,
 *     default: true,
 *   })
 *   .build();
 * ```
 *
 * To define by args, you can do
 * ```sh
 * npx sv add <addon>=<option1>:<value1>+<option2>:<value2>
 * ```
 * @returns {OptionBuilder<{}>}
 */
export function defineAddonOptions() {
	return createOptionBuilder({});
}

/**
 * @template {OptionDefinition} T
 * @param {T} options
 * @returns {OptionBuilder<T>}
 */
function createOptionBuilder(options) {
	return {
		add(key, question) {
			const newOptions = { ...options, [key]: question };
			return createOptionBuilder(newOptions);
		},
		build() {
			return options;
		}
	};
}
