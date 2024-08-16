#!/usr/bin/env node

import { remoteControl, executeAdders, prompts } from '@svelte-cli/core/internal';
import { adderCategories, categories, adderIds } from '@svelte-cli/config';
import { getAdderDetails } from '@svelte-cli/adders';

/**
 * @param {string} cwd
 */
export async function executeSvelteAdd(cwd) {
	remoteControl.enable();

	/** @type {import('@svelte-cli/core/internal').AdderDetails<Record<string, import('@svelte-cli/core/internal').Question>>[]} */
	const adderDetails = [];

	for (const adderName of adderIds) {
		const adder = await getAdderDetails(adderName);
		adderDetails.push({ config: adder.config, checks: adder.checks });
	}

	/** @type {import('@svelte-cli/core/internal').ExecutingAdderInfo} */
	const executingAdderInfo = {
		name: 'todo-package-name-svelte-cli',
		version: 'todo-version'
	};

	await executeAdders(adderDetails, executingAdderInfo, undefined, selectAddersToApply, cwd);

	remoteControl.disable();
}

/**
 * @typedef AdderOption
 * @property {string} value
 * @property {string} label
 * @property {string} hint
 */

/**
 * @param {import('@svelte-cli/core/internal').AddersToApplySelectorParams} param0
 * @returns {Promise<string[]>}
 */
async function selectAddersToApply({ projectType, addersMetadata }) {
	/** @type {Record<string, AdderOption[]>} */
	const promptOptions = {};

	for (const [categoryId, adderIds] of Object.entries(adderCategories)) {
		const typedCategoryId = /** @type {import('@svelte-cli/config').CategoryKeys} */ (categoryId);
		const categoryDetails = categories[typedCategoryId];
		/** @type {AdderOption[]} */
		const options = [];
		const adders = addersMetadata.filter((x) => adderIds.includes(x.id));

		for (const adder of adders) {
			// if we detected a kit project, and the adder is not available for kit, ignore it.
			if (projectType === 'kit' && !adder.environments.kit) continue;
			// if we detected a svelte project, and the adder is not available for svelte, ignore it.
			if (projectType === 'svelte' && !adder.environments.svelte) continue;

			options.push({
				label: adder.name,
				value: adder.id,
				hint: adder.website?.documentation || ''
			});
		}

		if (options.length > 0) {
			promptOptions[categoryDetails.name] = options;
		}
	}
	const selectedAdders = await prompts.groupedMultiSelectPrompt(
		'What would you like to add to your project?',
		promptOptions
	);

	return selectedAdders;
}
