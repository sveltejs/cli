import { buildTemplates } from './packages/sv/lib/create/scripts/build-templates.js';
import MagicString from 'magic-string';
import fs from 'node:fs';
import path from 'node:path';
import process from 'node:process';
import { defineConfig } from 'tsdown';

export default defineConfig({
	cwd: 'packages/sv',
	entry: ['lib/index.ts', 'lib/testing.ts', 'bin.ts'],
	sourcemap: !process.env.CI,
	dts: {
		oxc: true
	},
	plugins: [
		{
			name: 'evaluate-community-addon-ids',
			transform: {
				filter: { id: /_config[/\\]community\.ts$/ },
				handler(code, id) {
					const ms = new MagicString(code, { filename: id });
					const start = code.indexOf('export const communityAddonIds');
					const end = code.indexOf(';', start);
					const ids = fs.readdirSync('community-addons').map((p) => path.parse(p).name);
					const generated = `export const communityAddonIds = ${JSON.stringify(ids)}`;
					ms.overwrite(start, end, generated);
					return { code: ms.toString(), map: ms.generateMap() };
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
		async 'build:before'() {
			await buildCliTemplates();
		}
	}
});

export async function buildCliTemplates() {
	const start = performance.now();
	await buildTemplates(path.resolve('packages/sv/dist'));
	await buildTemplates(path.resolve('packages/sv/lib/create/dist'));
	const green = '\x1b[32m';
	const reset = '\x1b[0m';
	console.log(`${green}✔${reset} Templates built in ${Math.round(performance.now() - start)}ms`);
}
