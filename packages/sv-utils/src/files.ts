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

/**
 * Checks the file.
 * @param filePath - Resolves paths relative to the workspace.
 */
export function fileExists(cwd: string, filePath: string): boolean {
	const fullFilePath = path.resolve(cwd, filePath);
	return fs.existsSync(fullFilePath);
}

/**
 * Reads the file.
 * @param filePath - Resolves paths relative to the workspace.
 * @returns The raw UTF-8 text, or `''` if the file is not found.
 */
export function loadFile(cwd: string, filePath: string): string {
	const fullFilePath = path.resolve(cwd, filePath);

	if (!fileExists(cwd, filePath)) {
		return '';
	}

	const text = fs.readFileSync(fullFilePath, 'utf8');

	return text;
}

/**
 * Writes the file. Will make parent directories as needed.
 * @param filePath - Resolves paths relative to the workspace.
 */
export function saveFile(cwd: string, filePath: string, content: string): void {
	const fullFilePath = path.resolve(cwd, filePath);
	const fullDirectoryPath = path.dirname(fullFilePath);

	if (content && !content.endsWith('\n')) content += '\n';

	if (!fs.existsSync(fullDirectoryPath)) {
		fs.mkdirSync(fullDirectoryPath, { recursive: true });
	}

	fs.writeFileSync(fullFilePath, content, 'utf8');
}

/**
 * Loads the workspace `package.json`.
 * @returns
 * - `source`: The raw UTF-8 text.
 * - `data`: The parsed JSON object.
 */
export function loadPackageJson(cwd: string): {
	source: string;
	data: Package;
} {
	const source = loadFile(cwd, 'package.json');

	if (!source) {
		const pkgPath = path.join(cwd, 'package.json');
		throw new Error(`Invalid workspace: missing '${pkgPath}'`);
	}

	const { data } = parseJson(source);
	return { source, data: data as Package };
}
