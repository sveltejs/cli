import { parseScript, parseSvelte, type AstTypes } from '../../../../tooling/index.ts';
import { scope } from '../../../../tooling/js/index.ts';

export function run(_ast: AstTypes.Program): void {
	const program = parseScript(`
		target;
		function parameter(target: string) { target; }
		{ target; let target; }
		try { work(); } catch (target) { target; }
		for (const target of targets) target;
		target;
		function target() { return target; }
		const expression = function target() { return target; };
		{ function target() { return target; } target; }
	`).ast;
	const shadowed = scope.findShadowedIdentifiers([program], ['target']);
	// the top-level 'function target' binds in the enclosing scope, so neither its id nor its
	// recursive reference is shadowed. The function expression's id and the block-nested
	// declaration shadow as usual (+5)
	if (shadowed.size !== 13) {
		throw new Error(`Unexpected JavaScript shadow count: ${shadowed.size}`);
	}

	const svelte = parseSvelte(`
		{target}
		{#each target as target}{target}{:else}{target}{/each}
		{#snippet demo(target)}{target}{/snippet}
		{#await target then target}{target}{:catch target}{target}{/await}
	`);
	const svelteShadowed = scope.findShadowedIdentifiers([svelte.fragment], ['target']);
	if (svelteShadowed.size !== 8) {
		throw new Error(`Unexpected Svelte shadow count: ${svelteShadowed.size}`);
	}
}
