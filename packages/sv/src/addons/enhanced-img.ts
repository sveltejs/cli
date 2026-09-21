import { color, pnpm, transforms } from '@sveltejs/sv-utils';
import { defineAddon } from '../core/config.ts';

const REGEX_IMPORTED_IMG = /import (\w+) from '([^']+\.(?:png|jpe?g|webp|avif|gif))';/g;
const REGEX_REGEX_CHARS = /[.*+?^${}()|[\]\\]/g;

function escapeRegex(value: string) {
	return value.replace(REGEX_REGEX_CHARS, '\\$&');
}

export default defineAddon({
	id: 'enhanced-img',
	shortDescription: 'image optimization',
	homepage: 'https://svelte.dev/docs/kit/images',
	options: {},
	run: ({ sv, file, packageManager, cwd }) => {
		sv.devDependency('@sveltejs/enhanced-img', '^1.0.0-next.5');

		if (packageManager === 'pnpm') {
			sv.file(file.findUp('pnpm-workspace.yaml'), pnpm.allowBuilds({ cwd, packages: ['sharp'] }));
		}

		// only static imports: `static/` assets, remote URLs and runtime sources
		// cannot be resolved at build time
		sv.files(
			{ include: 'src/**/*.svelte', where: (content) => content.includes('<img') },
			transforms.text(({ content }) => {
				let next = content;
				for (const [statement, binding, src] of content.matchAll(REGEX_IMPORTED_IMG)) {
					const tag = new RegExp(`<img([^>]*?)src=\\{${binding}\\}`, 'g');
					if (!tag.test(next)) continue;

					const importLine = new RegExp(`[ \\t]*${escapeRegex(statement)}\\r?\\n?`);
					// the binding can also feed props, meta tags, styles... the lookbehind
					// skips lookalikes in paths and attribute values, e.g. `alt="logo"`
					const reference = new RegExp(`(?<![\\w"'./-])${binding}\\b`);
					const unused = !reference.test(content.replace(importLine, '').replaceAll(tag, ''));

					// an inlined `src` needs no `?enhanced` query, the preprocessor resolves it
					next = next.replaceAll(tag, `<enhanced:img$1src="${src}"`);
					if (unused) next = next.replace(importLine, '');
				}
				return next === content ? false : next;
			})
		);

		sv.file(
			file.viteConfig,
			transforms.script(({ ast, js }) => {
				js.imports.addNamed(ast, {
					imports: ['enhancedImages'],
					from: '@sveltejs/enhanced-img'
				});
				js.vite.addPlugin(ast, { code: 'enhancedImages()', mode: 'prepend' });
			})
		);
	},
	nextSteps: () => [
		`Imported images now use ${color.command('`<enhanced:img>`')}`,
		`Docs: ${color.website('https://svelte.dev/docs/kit/images')}`
	]
});
