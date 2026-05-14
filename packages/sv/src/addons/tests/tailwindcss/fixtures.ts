import { transforms } from '@sveltejs/sv-utils';
import fs from 'node:fs';
import path from 'node:path';

const markup = `
<div class="bg-slate-600 border-gray-50 border-4 mt-1" data-testid="base">
	<p class="text-lg text-right line-through" data-testid="typography"></p>
</div>
`;

const addMarkup = transforms.svelte(({ ast, svelte }) => {
	const alreadyAdded = ast.fragment.nodes.some(
		(node) =>
			node.type === 'RegularElement' &&
			node.attributes.some(
				(attr) =>
					attr.type === 'Attribute' &&
					attr.name === 'data-testid' &&
					Array.isArray(attr.value) &&
					attr.value.some((v) => v.type === 'Text' && v.data === 'base')
			)
	);
	if (alreadyAdded) return false;

	svelte.addFragment(ast, markup);
});

export function addFixture(cwd: string, variant: string) {
	const page = variant.startsWith('kit')
		? path.resolve(cwd, 'src', 'routes', '+page.svelte')
		: path.resolve(cwd, 'src', 'App.svelte');

	const content = fs.readFileSync(page, 'utf8');
	fs.writeFileSync(page, addMarkup(content), 'utf8');
}
