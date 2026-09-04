import { color, pnpm, transforms } from '@sveltejs/sv-utils';
import { defineAddon } from '../core/config.ts';

export default defineAddon({
	id: 'enhanced-img',
	shortDescription: 'image optimization',
	homepage: 'https://svelte.dev/docs/kit/images',
	options: {},
	run: ({ sv, file, packageManager, cwd }) => {
		sv.devDependency('@sveltejs/enhanced-img', '^0.11.0');

		if (packageManager === 'pnpm') {
			sv.file(file.findUp('pnpm-workspace.yaml'), pnpm.allowBuilds(cwd, 'sharp'));
		}

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
		`Replace ${color.command('`<image ...>`')} with ${color.command('`<enhanced:img ...>`')} for optimized images`,
		`Docs: ${color.website('https://svelte.dev/docs/kit/images')}`
	]
});
