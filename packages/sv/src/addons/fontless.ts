import { transforms, color } from '@sveltejs/sv-utils';
import fs from 'node:fs';
import { join } from 'node:path';
import { defineAddon } from '../core/config.ts';

export default defineAddon({
	id: 'fontless',
	shortDescription: 'font management',
	homepage: 'https://github.com/unjs/fontaine/tree/main/packages/fontless',
	options: {},
	run: ({ sv, file }) => {
		sv.devDependency('fontless', '^0.2.1');
		sv.file(
			file.viteConfig,
			transforms.script(({ ast, js }) => {
				const vitePluginName = 'fontless';
				js.imports.addNamed(ast, { imports: [vitePluginName], from: 'fontless' });
				js.vite.addPlugin(ast, {
					code: `${vitePluginName}()`
				});
			})
		);
	},
	nextSteps: ({ file, directory }) => {
		const steps = [
			`Your font-family should be ${color.success('automatically detected')} by fontless!`
		];

		const hasFontSourceImported =
			fs.existsSync(file.stylesheet) &&
			fs.readFileSync(file.stylesheet, 'utf-8').includes('@fontsource');
		if (hasFontSourceImported) {
			steps.push(
				`${color.warning(
					`${color.path(file.stylesheet)} has some @fontsource usage and may no longer be necessary.`
				)}`
			);
		} else {
			const hasFontSourceInstalled = fs.readFileSync(file.package, 'utf-8').includes('@fontsource');
			if (hasFontSourceInstalled) {
				steps.push(
					`${color.warning(
						`@fontsource is installed as a dependency and may no longer be necessary.`
					)}`
				);
			}
		}

		const googleFontsDomain = 'fonts.googleapis.com';
		const entryFiles = [join(directory.src, 'app.html'), join(directory.src, 'App.svelte')];
		let fileUsingGoogleFont: string | null = null;
		for (const file of entryFiles) {
			if (fs.existsSync(file) && fs.readFileSync(file, 'utf-8').includes(googleFontsDomain)) {
				fileUsingGoogleFont = file;
			}
		}

		if (fileUsingGoogleFont) {
			steps.push(
				`${color.warning(
					`${color.path(fileUsingGoogleFont)} contains some ${color.website(googleFontsDomain)} references and may no longer be necessary`
				)}`
			);
		}

		steps.push(
			`Visit ${color.website('https://github.com/unjs/fontaine/tree/main/packages/fontless')} for more configuration options.`
		);
		return steps;
	}
});
