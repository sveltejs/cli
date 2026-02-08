import fs from 'node:fs';
import path from 'node:path';

const markup = `
<div class="bg-slate-600 border-gray-50 border-4 mt-1" data-testid="base">
	<p class="text-lg text-right line-through" data-testid="typography"></p>
</div>
`;

export function addFixture(cwd: string, variant: string) {
	let page;
	if (variant.startsWith('kit')) {
		page = path.resolve(cwd, 'src', 'routes', '+page.svelte');
	} else {
		page = path.resolve(cwd, 'src', 'App.svelte');
	}
	const content = fs.readFileSync(page, 'utf8') + markup;
	fs.writeFileSync(page, content, 'utf8');
}
