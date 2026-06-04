import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ADDONS_DIR = fileURLToPath(new URL('../../', import.meta.url));
const TEMPLATES_DIR = fileURLToPath(new URL('../../../create/templates/', import.meta.url));
const SHARED_DIR = fileURLToPath(new URL('../../../create/shared/', import.meta.url));

// same extraction the `update-deps` script uses, see scripts/update-dependencies.js
const DEP_PATTERNS = [
	// sv.dependency('pkg', '^1.2.3') / sv.devDependency('pkg', '^1.2.3')
	/sv\.(?:dependency|devDependency)\('([^']+)',\s*'([^']+)'\)/g,
	// object literals: { package: 'pkg', version: '^1.2.3' } (ex: tailwind add-on)
	/package:\s*'([^']+)',\s*version:\s*'([^']+)'/g,
	// constants tagged for update-deps: /* update-deps: pkg */ '^1.2.3' (ex: common.ts)
	/\/\*\s*update-deps:\s*(\S+)\s*\*\/\s*'([^']+)'/g
];

function addSpec(specs: Map<string, string>, name: string, version: string): void {
	// keep only real registry ranges; skip `workspace:*`, `latest`, placeholders, computed versions
	if (!/^[\^~]?\d/.test(version)) return;
	specs.set(name, version);
}

function collectFromSources(specs: Map<string, string>): void {
	for (const file of fs.readdirSync(ADDONS_DIR)) {
		if (!file.endsWith('.ts')) continue;
		const content = fs.readFileSync(path.join(ADDONS_DIR, file), 'utf8');
		for (const pattern of DEP_PATTERNS) {
			for (const [, name, version] of content.matchAll(pattern)) addSpec(specs, name, version);
		}
	}
}

function collectFromPackageJsons(dir: string, fileName: string, specs: Map<string, string>): void {
	if (!fs.existsSync(dir)) return;
	for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
		if (!entry.isDirectory()) continue;
		const filePath = path.join(dir, entry.name, fileName);
		if (!fs.existsSync(filePath)) continue;
		const pkg = JSON.parse(fs.readFileSync(filePath, 'utf8'));
		for (const deps of [pkg.dependencies, pkg.devDependencies]) {
			for (const [name, version] of Object.entries(deps ?? {})) {
				if (typeof version === 'string') addSpec(specs, name, version);
			}
		}
	}
}

/**
 * Collects every `pkg@range` declared across the add-ons and project templates, read straight
 * from source (same way `update-deps` does) so it never goes stale. Used to warm the pnpm store
 * before the addon test files install their generated projects in parallel.
 */
export function collectPrewarmSpecs(): string[] {
	const specs = new Map<string, string>();
	collectFromSources(specs);
	collectFromPackageJsons(TEMPLATES_DIR, 'package.template.json', specs);
	collectFromPackageJsons(SHARED_DIR, 'package.json', specs);
	return [...specs].map(([name, version]) => `${name}@${version}`).sort();
}
