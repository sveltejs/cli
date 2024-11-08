import fs from 'node:fs';
import path from 'node:path';
import { spawn, type ChildProcessWithoutNullStreams } from 'node:child_process';
import degit from 'degit';
import terminate from 'terminate';
import { create } from '@sveltejs/create';

export type ProjectVariant = 'kit-js' | 'kit-ts' | 'vite-js' | 'vite-ts';

const TEMPLATES_DIR = '.templates';

export type CreateProject = (options: {
	testId: string;
	variant: ProjectVariant;
	/** @default true */
	clean?: boolean;
}) => string;

type SetupOptions = {
	cwd: string;
	variants: readonly ProjectVariant[];
	/** @default false */
	clean?: boolean;
};
export async function setup({
	cwd,
	clean = false,
	variants
}: SetupOptions): Promise<{ templatesDir: string }> {
	const workingDir = path.resolve(cwd);
	if (clean && fs.existsSync(workingDir)) {
		fs.rmSync(workingDir, { force: true, recursive: true });
	}

	// fetch the project types
	const templatesDir = path.resolve(workingDir, TEMPLATES_DIR);
	fs.mkdirSync(templatesDir, { recursive: true });
	for (const variant of variants) {
		const templatePath = path.resolve(templatesDir, variant);
		if (fs.existsSync(templatePath)) continue;

		if (variant === 'kit-js') {
			create(templatePath, { name: variant, template: 'minimal', types: 'checkjs' });
		} else if (variant === 'kit-ts') {
			create(templatePath, { name: variant, template: 'minimal', types: 'typescript' });
		} else if (variant === 'vite-js' || variant === 'vite-ts') {
			const name = `template-svelte${variant === 'vite-ts' ? '-ts' : ''}`;
			// TODO: should probably point this to a specific commit hash (ex: `#1234abcd`)
			const template = degit(`vitejs/vite/packages/create-vite/${name}`, { force: true });
			await template.clone(templatePath);
		} else throw new Error(`Unknown project variant: ${variant}`);
	}

	return { templatesDir };
}

type CreateOptions = { cwd: string; testName: string; templatesDir: string };
export function createProject({ cwd, testName, templatesDir }: CreateOptions): CreateProject {
	// create the reference dir
	const testDir = path.resolve(cwd, testName);
	fs.mkdirSync(testDir, { recursive: true });
	return ({ testId, variant, clean = true }) => {
		const targetDir = path.resolve(testDir, testId);
		if (clean && fs.existsSync(targetDir)) {
			fs.rmSync(targetDir, { force: true, recursive: true });
		}
		const templatePath = path.resolve(templatesDir, variant);
		fs.cpSync(templatePath, targetDir, { recursive: true, force: true });
		return targetDir;
	};
}

type PreviewOptions = { cwd: string; command?: string };
export async function startPreview({ cwd, command = 'npm run preview' }: PreviewOptions): Promise<{
	url: string;
	server: ChildProcessWithoutNullStreams;
	close: () => void;
}> {
	const [cmd, ...args] = command.split(' ');
	const process = spawn(cmd, args, { stdio: 'pipe', shell: true, cwd, timeout: 120_000 });
	const close = () => {
		if (!process.pid) return;
		terminate(process.pid);
	};

	return await new Promise((resolve) => {
		process.stdout.on('data', (data: Buffer) => {
			const value = data.toString();

			// extract dev server url from console output
			const regexUnicode = /[^\x20-\xaf]+/g;
			const withoutUnicode = value.replace(regexUnicode, '');

			const regexUnicodeDigits = /\[[0-9]{1,2}m/g;
			const withoutColors = withoutUnicode.replace(regexUnicodeDigits, '');

			const regexUrl = /http:\/\/[^:\s]+:[0-9]+\//g;
			const urls = withoutColors.match(regexUrl);

			if (urls && urls.length > 0) {
				const url = urls[0];
				resolve({ url, server: process, close });
			}
		});
	});
}
