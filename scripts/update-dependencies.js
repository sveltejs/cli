import fs from 'node:fs';
import path from 'node:path';
import { styleText } from 'node:util';

async function updateAddonDependencies() {
	const addonsBasePath = path.resolve('packages', 'sv', 'src', 'addons');
	const addonsFiles = fs
		.readdirSync(addonsBasePath, { withFileTypes: true })
		.filter((item) => item.isFile())
		.map((item) => item.name)
		.filter((x) => x !== 'node_modules' && !x.startsWith('_'));

	for (const addonFile of addonsFiles) {
		const filePath = `${addonsBasePath}/${addonFile}`;
		if (!fs.existsSync(filePath)) continue;

		console.log(`Checking deps for ${styleText(['cyanBright', 'bold'], addonFile)} add-on`);

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
 * @param {string} basePath
 * @param {string} fileName
 * @param {string} type
 */
async function updatePackageFiles(basePath, fileName, type) {
	const fullBasePath = path.resolve(basePath);
	const folders = fs
		.readdirSync(fullBasePath, { withFileTypes: true })
		.filter((item) => item.isDirectory())
		.map((item) => item.name);

	for (const folder of folders) {
		const filePath = path.join(fullBasePath, folder, fileName);
		if (!fs.existsSync(filePath)) continue;

		console.log(`Checking deps for ${styleText(['cyanBright', 'bold'], folder)} ${type}`);

		const content = fs.readFileSync(filePath, { encoding: 'utf8' });
		/** @type {{ dependencies?: Record<string, string>, devDependencies?: Record<string, string> }} */
		const packageJson = JSON.parse(content);

		let hasUpdates = false;

		// Check dependencies
		if (packageJson.dependencies) {
			for (const [packageName, currentVersion] of Object.entries(packageJson.dependencies)) {
				// Skip if version doesn't start with ^ (not a caret range)
				if (!currentVersion.startsWith('^')) continue;

				const latestVersion = await getLatestVersion(packageName);
				const newVersion = `^${latestVersion}`;

				if (currentVersion !== newVersion) {
					packageJson.dependencies[packageName] = newVersion;
					hasUpdates = true;
					console.log(
						`  - ${styleText('blue', packageName + ':').padEnd(40)} ${styleText('red', currentVersion.padEnd(7))} -> ${styleText('green', newVersion)} (dependency)`
					);
				}
			}
		}

		// Check devDependencies
		if (packageJson.devDependencies) {
			for (const [packageName, currentVersion] of Object.entries(packageJson.devDependencies)) {
				// Skip if version doesn't start with ^ (not a caret range)
				if (!currentVersion.startsWith('^')) continue;

				const latestVersion = await getLatestVersion(packageName);
				const newVersion = `^${latestVersion}`;

				if (currentVersion !== newVersion) {
					packageJson.devDependencies[packageName] = newVersion;
					hasUpdates = true;
					console.log(
						`  - ${styleText('blue', packageName + ':').padEnd(40)} ${styleText('red', currentVersion.padEnd(7))} -> ${styleText('green', newVersion)} (devDependency)`
					);
				}
			}
		}

		if (!packageJson.dependencies && !packageJson.devDependencies) {
			console.log(`  - No dependencies or devDependencies found in ${folder}`);
			continue;
		}

		if (hasUpdates) {
			// Write back the updated package.json with proper formatting
			const updatedContent = JSON.stringify(packageJson, null, '\t') + '\n';
			fs.writeFileSync(filePath, updatedContent);
		}
	}
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

// Update template package.template.json files
await updatePackageFiles('packages/sv/src/create/templates', 'package.template.json', 'template');

// Update shared package.json files
await updatePackageFiles('packages/sv/src/create/shared', 'package.json', 'shared');

// Fetch the latest AGENTS.md from the ai-tools repo
const agents_response = await fetch(
	'https://raw.githubusercontent.com/sveltejs/ai-tools/refs/heads/main/tools/instructions/AGENTS.md'
);
fs.writeFileSync(
	path.resolve('packages', 'sv', 'src', 'create', 'shared', '+mcp', 'AGENTS.md'),
	await agents_response.text()
);

// Fetch the latest skills from the ai-tools repo
const skillsBase =
	'https://raw.githubusercontent.com/sveltejs/ai-tools/refs/heads/main/tools/skills';
const sharedSkillsBase = path.resolve('packages', 'sv', 'src', 'create', 'shared', '+skills');

/** @param {string} skillPath */
async function fetchSkillFile(skillPath) {
	const response = await fetch(`${skillsBase}/${skillPath}`);
	const dest = path.resolve(sharedSkillsBase, skillPath);
	fs.mkdirSync(path.dirname(dest), { recursive: true });
	fs.writeFileSync(dest, await response.text());
}

// Fetch skill files using the GitHub API to discover all files
const skillsApiBase = 'https://api.github.com/repos/sveltejs/ai-tools/contents/tools/skills';

/** @param {string} apiUrl */
async function fetchSkillDir(apiUrl) {
	const response = await fetch(apiUrl);
	const entries = await response.json();
	for (const entry of entries) {
		if (entry.type === 'file') {
			const skillPath = entry.path.replace('tools/skills/', '');
			console.log(`  - fetching skill: ${styleText('blue', skillPath)}`);
			await fetchSkillFile(skillPath);
		} else if (entry.type === 'dir') {
			await fetchSkillDir(entry.url);
		}
	}
}

console.log(`Fetching ${styleText(['cyanBright', 'bold'], 'skills')} from ai-tools repo`);
await fetchSkillDir(skillsApiBase);

// Fetch the latest agents from the ai-tools repo
const agentsBase =
	'https://raw.githubusercontent.com/sveltejs/ai-tools/refs/heads/main/tools/agents';
const sharedAgentsBase = path.resolve('packages', 'sv', 'src', 'create', 'shared', '+agents');
const agentsApiBase = 'https://api.github.com/repos/sveltejs/ai-tools/contents/tools/agents';

console.log(`Fetching ${styleText(['cyanBright', 'bold'], 'agents')} from ai-tools repo`);
const agentsResponse = await fetch(agentsApiBase);
const agentEntries = await agentsResponse.json();
for (const entry of agentEntries) {
	if (entry.type === 'file') {
		const agentName = entry.name;
		console.log(`  - fetching agent: ${styleText('blue', agentName)}`);
		const response = await fetch(`${agentsBase}/${agentName}`);
		fs.mkdirSync(sharedAgentsBase, { recursive: true });
		fs.writeFileSync(path.resolve(sharedAgentsBase, agentName), await response.text());
	}
}
