import { buildTemplates } from '@sveltejs/create/build';
import MagicString from 'magic-string';
import fs from 'node:fs';
import path from 'node:path';
import process from 'node:process';
import { defineConfig } from 'tsdown';

export default defineConfig({
	cwd: 'packages/cli',
	entry: ['lib/index.ts', 'lib/testing.ts', 'bin.ts'],
	sourcemap: !process.env.CI,
	dts: { oxc: true },
	plugins: [
		{
			name: 'evaluate-community-addon-ids',
			transform: {
				filter: {
					id: /_config[/\\]community\.ts$/
				},
				handler(code, id) {
					const ms = new MagicString(code, { filename: id });
					const start = code.indexOf('export const communityAddonIds');
					const end = code.indexOf(';', start);
					const ids = fs.readdirSync('community-addons').map((p) => path.parse(p).name);
					const generated = `export const communityAddonIds = ${JSON.stringify(ids)}`;
					ms.overwrite(start, end, generated);
					return {
						code: ms.toString(),
						map: ms.generateMap()
					};
				}
			}
		}
	],
	inputOptions: {
		experimental: {
			resolveNewUrlToAsset: false
		}
	},
	hooks: {
		async 'build:done'() {
			await buildCliTemplates();
		}
	}
});

export async function buildCliTemplates() {
	console.log('building templates');
	const start = performance.now();
	await buildTemplates(path.resolve('dist'));
	const end = performance.now();
	console.log(`finished building templates: ${Math.round(end - start)}ms`);
}
