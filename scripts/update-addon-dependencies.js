import fs from 'node:fs';
import path from 'node:path';
import { styleText } from 'node:util';

async function updateAddonDependencies() {
	const addonsBasePath = path.resolve('packages', 'addons');
	const addonFolders = fs
		.readdirSync(addonsBasePath, { withFileTypes: true })
		.filter((item) => item.isDirectory())
		.map((item) => item.name)
		.filter((x) => x !== 'node_modules' && !x.startsWith('_'));

	for (const addonFolder of addonFolders) {
		const filePath = `${addonsBasePath}/${addonFolder}/index.ts`;
		if (!fs.existsSync(filePath)) continue;

		console.log(`Checking deps for ${styleText(['cyanBright', 'bold'], addonFolder)} add-on`);

		let content = fs.readFileSync(filePath, { encoding: 'utf8' });

		// regex to extract package name and version from `sv.dependency` and `sv.devDependency`
		const svDepRegex = /sv\.(?:dependency|devDependency)\('([^']+)',\s*'([^']+)'\)/g;
		// regex to extract from object literal properties `{ package: '...', version: '...' }` (ex: tailwind add-on)
		const objectLiteralRegex = /package:\s*'([^']+)',\s*version:\s*'([^']+)'/g;

		const svDepMatches = Array.from(content.matchAll(svDepRegex));
		const objectLiteralMatches = Array.from(content.matchAll(objectLiteralRegex));

		content = await replaceDeps(content, svDepMatches);
		content = await replaceDeps(content, objectLiteralMatches);

		fs.writeFileSync(filePath, content);
	}
}

/**
 * Replaces the matched versions with their latest.
 * @param {string} content
 * @param {RegExpExecArray[]} matches
 * @returns {Promise<string>}
 */
async function replaceDeps(content, matches) {
	for (const match of matches) {
		const [fullMatch, name, version] = match;
		const newVersion = `^${await getLatestVersion(name)}`;
		const updatedMatch = fullMatch.replace(version, newVersion);
		if (fullMatch !== updatedMatch) {
			content = content.replace(fullMatch, updatedMatch);
			console.log(
				`  - ${styleText('blue', name + ':').padEnd(40)} ${styleText('red', version.padEnd(7))} -> ${styleText('green', newVersion)}`
			);
		}
	}
	return content;
}

/**
 * Gets the latest version of given package from the npm registry
 * @param {string} name
 * @returns {Promise<string>}
 */
async function getLatestVersion(name) {
	const response = await fetch(`https://registry.npmjs.org/${name}/latest`);
	const json = await response.json();
	return json.version;
}

await updateAddonDependencies();
