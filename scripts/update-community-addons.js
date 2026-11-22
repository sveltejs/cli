import fs from 'node:fs';
import path from 'node:path';
import { styleText } from 'node:util';

// these names reach a command line, so a leading `-` (read as a flag) is not allowed
const REGEX_NPM_NAME = /^(?:@[a-z0-9~][a-z0-9-._~]*\/)?[a-z0-9~][a-z0-9-._~]*$/;
// some packages publish their README's HTML as the description
const REGEX_HTML_TAG = /<[^<>]*>/g;

const SEARCH_URL = 'https://registry.npmjs.org/-/v1/search?text=keywords:sv-add&size=250';
const svDir = path.resolve('packages', 'sv');

/** @type {{ npm_names: string[] }} */
const blocklist = JSON.parse(fs.readFileSync(path.join(svDir, 'blocklist.json'), 'utf8'));

/** @type {{ objects: Array<{ package: { name: string, description?: string }, downloads?: { weekly?: number } }> }} */
const search = await (await fetch(SEARCH_URL)).json();

const candidates = search.objects.filter(
	({ package: p }) => REGEX_NPM_NAME.test(p.name) && !blocklist.npm_names.includes(p.name)
);

const addons = (
	await Promise.all(
		candidates.map(async ({ package: p, downloads }) => {
			const res = await fetch(`https://registry.npmjs.org/${p.name}/latest`);
			if (!res.ok) return;
			/** @type {{ peerDependencies?: Record<string, string>, deprecated?: string }} */
			const latest = await res.json();
			const sv = latest.peerDependencies?.sv;
			if (!sv || latest.deprecated) return;
			return {
				name: p.name,
				description: (p.description ?? '').replaceAll(REGEX_HTML_TAG, '').trim(),
				sv,
				downloads: downloads?.weekly ?? 0
			};
		})
	)
)
	.filter((a) => a !== undefined)
	.sort((a, b) => b.downloads - a.downloads);

fs.writeFileSync(
	path.join(svDir, 'community-addons.json'),
	JSON.stringify(addons, null, '\t') + '\n'
);

console.log(
	`${styleText(['cyanBright', 'bold'], 'community add-ons')}: kept ${styleText('green', String(addons.length))}, dropped ${styleText('red', String(search.objects.length - addons.length))}`
);
