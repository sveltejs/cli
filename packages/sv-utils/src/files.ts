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

export const commonFilePaths = {
	packageJson: 'package.json',
	svelteConfig: 'svelte.config.js',
	svelteConfigTS: 'svelte.config.ts',
	jsconfig: 'jsconfig.json',
	tsconfig: 'tsconfig.json',
	viteConfig: 'vite.config.js',
	viteConfigTS: 'vite.config.ts'
} as const;
