import fs from 'node:fs';
import path from 'node:path';

const root = path.resolve(import.meta.dirname, '..');

/** @type string[] */
const removed = [];

/** @param {string} target */
function remove(target) {
	if (!fs.existsSync(target)) return;
	fs.rmSync(target, { recursive: true, force: true });
	removed.push(path.relative(root, target));
}

// top-level artifacts (see .gitignore)
for (const entry of fs.readdirSync(root)) {
	if (entry === 'node_modules' || entry.startsWith('vite.config.js.timestamp-')) {
		remove(path.join(root, entry));
	}
}

// per-package artifacts (see pnpm-workspace.yaml `packages`)
const packages_dir = path.join(root, 'packages');
for (const pkg of fs.readdirSync(packages_dir)) {
	const dir = path.join(packages_dir, pkg);
	if (!fs.statSync(dir).isDirectory()) continue;

	for (const entry of ['dist', 'node_modules', '.test-output', 'dts-api-surface']) {
		remove(path.join(dir, entry));
	}
}

console.log(removed.length ? `removed:\n  ${removed.join('\n  ')}` : 'nothing to clean');
