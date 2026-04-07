import fs from 'node:fs';
import path from 'node:path';
import { appendContent, findHeader, findSection, joinContent, type Line } from './tooling/md.ts';
import { parseJson } from './tooling/parsers.ts';

export type Package = {
	name: string;
	version: string;
	dependencies?: Record<string, string>;
	devDependencies?: Record<string, string>;
	bugs?: string;
	repository?: { type: string; url: string };
	keywords?: string[];
	workspaces?: string[];
};

export function getPackageJson(cwd: string): {
	source: string;
	data: Package;
	generateCode: () => string;
} {
	const packageText = readFile(cwd, commonFilePaths.packageJson);
	if (!packageText) {
		const pkgPath = path.join(cwd, commonFilePaths.packageJson);
		throw new Error(`Invalid workspace: missing '${pkgPath}'`);
	}

	const { data, generateCode } = parseJson(packageText);
	return { source: packageText, data: data as Package, generateCode };
}

export function readFile(cwd: string, filePath: string): string {
	const fullFilePath = path.resolve(cwd, filePath);

	if (!fileExists(cwd, filePath)) {
		return '';
	}

	const text = fs.readFileSync(fullFilePath, 'utf8');

	return text;
}

export function fileExists(cwd: string, filePath: string): boolean {
	const fullFilePath = path.resolve(cwd, filePath);
	return fs.existsSync(fullFilePath);
}

export function writeFile(cwd: string, filePath: string, content: string): void {
	const fullFilePath = path.resolve(cwd, filePath);
	const fullDirectoryPath = path.dirname(fullFilePath);

	if (content && !content.endsWith('\n')) content += '\n';

	if (!fs.existsSync(fullDirectoryPath)) {
		fs.mkdirSync(fullDirectoryPath, { recursive: true });
	}

	fs.writeFileSync(fullFilePath, content, 'utf8');
}

export function installPackages(
	dependencies: Array<{ pkg: string; version: string; dev: boolean }>,
	cwd: string
): string {
	const { data, generateCode } = getPackageJson(cwd);

	for (const dependency of dependencies) {
		if (dependency.dev) {
			data.devDependencies ??= {};
			data.devDependencies[dependency.pkg] = dependency.version;
		} else {
			data.dependencies ??= {};
			data.dependencies[dependency.pkg] = dependency.version;
		}
	}

	if (data.dependencies) data.dependencies = alphabetizeProperties(data.dependencies);
	if (data.devDependencies) data.devDependencies = alphabetizeProperties(data.devDependencies);

	writeFile(cwd, commonFilePaths.packageJson, generateCode());
	return commonFilePaths.packageJson;
}

function alphabetizeProperties(obj: Record<string, string>) {
	const orderedObj: Record<string, string> = {};
	const sortedEntries = Object.entries(obj).sort(([a], [b]) => a.localeCompare(b));
	for (const [key, value] of sortedEntries) {
		orderedObj[key] = value;
	}
	return orderedObj;
}

export const commonFilePaths = {
	packageJson: 'package.json',
	svelteConfig: 'svelte.config.js',
	svelteConfigTS: 'svelte.config.ts',
	jsconfig: 'jsconfig.json',
	tsconfig: 'tsconfig.json',
	viteConfig: 'vite.config.js',
	viteConfigTS: 'vite.config.ts'
} as const;

export function addNextSteps(content: string, lines: Line[]): string {
	const linesToAdd = lines.filter(Boolean).join('\n');

	const svSection = findSection(content, '# sv');
	if (!svSection) return content;

	const header = '## Next Steps';
	const nextStepsHeader = findHeader(svSection.innerContent, header);
	if (!nextStepsHeader) return content;

	return appendContent(content, linesToAdd, header);
}

export function removeEmptyNextSteps(content: string): string {
	const svSection = findSection(content, '# sv');
	if (!svSection) return content;

	const header = '## Next Steps';
	const nextStepsSection = findSection(svSection.innerContent, header);
	if (!nextStepsSection) return content;

	if (nextStepsSection.innerContent.trim() === '') {
		return joinContent(
			svSection.before,
			svSection.header,
			nextStepsSection.before,
			// a workaround for a very naive implementation that doesn't account for comments which also starts with `#`
			nextStepsSection.after + svSection.after
		);
	}

	return content;
}
