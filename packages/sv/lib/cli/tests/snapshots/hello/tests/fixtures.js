import fs from 'node:fs';
import path from 'node:path';

const getContent = (leadingPath) => `<script>
import demo from '${leadingPath}/lib/hello/content.txt?raw';
</script>

<span data-testid="demo">{demo}</span>
`;

export function addFixture(cwd, variant) {
	if (variant.startsWith('kit')) {
		const target = path.resolve(cwd, 'src', 'routes', '+page.svelte');
		fs.writeFileSync(target, getContent('..'), 'utf8');
	} else {
		const target = path.resolve(cwd, 'src', 'App.svelte');
		fs.writeFileSync(target, getContent('.'), 'utf8');
	}
}
