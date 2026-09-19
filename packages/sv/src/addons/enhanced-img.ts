import { color, pnpm, transforms } from '@sveltejs/sv-utils';
import { defineAddon } from '../core/config.ts';

const REGEX_IMPORTED_IMG = /import (\w+) from '([^']+\.(?:png|jpe?g|webp|avif|gif))';/g;

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

		// only an `<img>` bound to a static image import can be resolved at build time;
		// `static/` assets, remote URLs and runtime sources must stay plain `<img>`
		sv.files(
			{ include: 'src/**/*.svelte', where: (content) => content.includes('<img') },
			transforms.text(({ content }) => {
				let next = content;
				for (const [statement, binding, src] of content.matchAll(REGEX_IMPORTED_IMG)) {
					const tag = new RegExp(`<img([^>]*?)src=\\{${binding}\\}`, 'g');
					if (!tag.test(next)) continue;
					// a string `src` is resolved like an import, so the import itself becomes dead
					next = next
						.replaceAll(tag, `<enhanced:img$1src="${src}"`)
						.replace(`\n\t${statement}`, '');
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
		`Imported images now use ${color.command('`<enhanced:img>`')}, others are untouched`,
		`Docs: ${color.website('https://svelte.dev/docs/kit/images')}`
	]
});
