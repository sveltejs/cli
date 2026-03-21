import * as p from '@clack/prompts';
import { type AgentName, resolveCommand } from '@sveltejs/sv-utils';
import { exec } from 'tinyexec';

// Re-export from sv-utils for backwards compatibility
export {
	commonFilePaths,
	fileExists,
	getPackageJson,
	installPackages,
	readFile,
	writeFile,
	type Package
} from '@sveltejs/sv-utils';

export async function formatFiles(options: {
	packageManager: AgentName;
	cwd: string;
	filesToFormat: string[];
}): Promise<void> {
	if (options.filesToFormat.length === 0) return;
	const { start, stop } = p.spinner();
	start('Formatting modified files');

	const args = ['prettier', '--write', '--ignore-unknown', ...options.filesToFormat];
	const cmd = resolveCommand(options.packageManager, 'execute-local', args)!;

	try {
		const result = await exec(cmd.command, cmd.args, {
			nodeOptions: { cwd: options.cwd, stdio: 'pipe' },
			throwOnError: true
		});
		if (result.exitCode !== 0) {
			stop('Failed to format files');
			p.log.error(result.stderr);
			return;
		}
	} catch (e) {
		stop('Failed to format files');
		// @ts-expect-error
		p.log.error(e?.output?.stderr || 'unknown error');
		return;
	}
	stop('Successfully formatted modified files');
}
