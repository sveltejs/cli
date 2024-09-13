import fs from 'node:fs';
import path from 'node:path';
import prettier from 'prettier';

/**
 * Bundles all of the JSON formatted community adder metadata located in `/community` into a single `community.ts` file.
 */
export async function bundleCommunityAdders() {
	const communityDir = path.resolve('community');
	const dirs = fs
		.readdirSync(communityDir, { withFileTypes: true })
		.filter((file) => file.name.endsWith('.json'));

	const communityAdders = [];
	for (const file of dirs) {
		const filepath = path.join(file.parentPath, file.name);
		const json = fs.readFileSync(filepath, 'utf8');
		communityAdders.push(JSON.parse(json));
	}

	const bundledPath = path.resolve('packages', 'cli', 'community.ts');

	const prettierConfig = await prettier.resolveConfig(bundledPath);
	const data = await prettier.format(
		`export default ${JSON.stringify(communityAdders, null, '\t')};`,
		{ ...prettierConfig, parser: 'typescript' }
	);

	fs.writeFileSync(bundledPath, data, 'utf8');
}

bundleCommunityAdders();
