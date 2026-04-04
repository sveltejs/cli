import fs from 'node:fs';
import path from 'node:path';
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

export const commonFilePaths = {
	packageJson: 'package.json',
	svelteConfig: 'svelte.config.js',
	svelteConfigTS: 'svelte.config.ts',
	jsconfig: 'jsconfig.json',
	tsconfig: 'tsconfig.json',
	viteConfig: 'vite.config.js',
	viteConfigTS: 'vite.config.ts'
} as const;

export function fileExists(cwd: string, filePath: string): boolean {
	const fullFilePath = path.resolve(cwd, filePath);
	return fs.existsSync(fullFilePath);
}

/** Synchronous load of a workspace-relative file as UTF-8 text; missing files yield `''`. */
export function loadFile(cwd: string, filePath: string): string {
	const fullFilePath = path.resolve(cwd, filePath);

	if (!fileExists(cwd, filePath)) {
		return '';
	}

	const text = fs.readFileSync(fullFilePath, 'utf8');

	return text;
}

/** Synchronous write of a workspace-relative file (creates parent dirs). */
export function saveFile(cwd: string, filePath: string, content: string): void {
	const fullFilePath = path.resolve(cwd, filePath);
	const fullDirectoryPath = path.dirname(fullFilePath);

	if (content && !content.endsWith('\n')) content += '\n';

	if (!fs.existsSync(fullDirectoryPath)) {
		fs.mkdirSync(fullDirectoryPath, { recursive: true });
	}

	fs.writeFileSync(fullFilePath, content, 'utf8');
}

export function loadPackageJson(cwd: string): {
	source: string;
	data: Package;
	generateCode: () => string;
} {
	const packageText = loadFile(cwd, commonFilePaths.packageJson);
	if (!packageText) {
		const pkgPath = path.join(cwd, commonFilePaths.packageJson);
		throw new Error(`Invalid workspace: missing '${pkgPath}'`);
	}

	const { data, generateCode } = parseJson(packageText);
	return { source: packageText, data: data as Package, generateCode };
}

/** @deprecated Use {@link loadFile} instead. */
export const readFile: typeof loadFile = loadFile;

/** @deprecated Use {@link saveFile} instead. */
export const writeFile: typeof saveFile = saveFile;

/** @deprecated Use {@link loadPackageJson} instead. */
export const getPackageJson: typeof loadPackageJson = loadPackageJson;
