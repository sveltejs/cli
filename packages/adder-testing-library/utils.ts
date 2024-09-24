import degit from 'degit';
import { spawn, type ChildProcessWithoutNullStreams } from 'node:child_process';
import path from 'node:path';
import terminate from 'terminate';
import { create } from 'sv';

export const ProjectTypes = {
	Svelte_JS: 'svelte-js',
	Svelte_TS: 'svelte-ts',
	Kit_JS: 'kit-js',
	Kit_JS_Comments: 'kit-js-comments',
	Kit_TS: 'kit-ts'
};
export const ProjectTypesList = Object.values(ProjectTypes);

export async function forceKill(devServer: ChildProcessWithoutNullStreams): Promise<void> {
	return new Promise((resolve) => {
		if (!devServer.pid) return;

		// just killing the process was not enough, because the process itself
		// spawns child process, that also need to be killed!
		terminate(devServer.pid, () => {
			resolve();
		});
	});
}

export async function downloadProjectTemplates(outputPath: string) {
	for (const templateType of ProjectTypesList) {
		const templateOutputPath = path.join(outputPath, templateType);

		if (templateType.includes('kit')) {
			create(templateOutputPath, {
				name: templateType,
				template: 'skeleton',
				types:
					templateType == ProjectTypes.Kit_TS
						? 'typescript'
						: templateType == ProjectTypes.Kit_JS_Comments
							? 'checkjs'
							: 'none'
			});
		} else {
			const templateName =
				templateType == ProjectTypes.Svelte_TS ? 'template-svelte-ts' : 'template-svelte-ts';

			const emitter = degit(`vitejs/vite/packages/create-vite/${templateName}`, {
				cache: false,
				force: true,
				verbose: false
			});

			await emitter.clone(templateOutputPath);
		}
	}
}

export async function startDevServer(
	output: string,
	command: string
): Promise<{ url: string; devServer: ChildProcessWithoutNullStreams }> {
	try {
		const program = spawn('pnpm', ['run', command], { stdio: 'pipe', shell: true, cwd: output });

		return await new Promise((resolve) => {
			program.stdout?.on('data', (data: Buffer) => {
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
					resolve({ url, devServer: program });
				}
			});
		});
	} catch (error) {
		const typedError = error as Error;
		throw new Error('Failed to start dev server' + typedError.message);
	}
}

export async function stopDevServer(devServer: ChildProcessWithoutNullStreams) {
	if (!devServer.pid) return;

	await forceKill(devServer);
}
