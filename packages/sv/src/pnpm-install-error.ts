/** Readable error for a failed test `pnpm install`, surfacing pnpm's output. */
export function pnpmInstallErrorMessage(
	cwd: string,
	stdout: string | Buffer = '',
	stderr: string | Buffer = ''
): string {
	const output = `${stdout}${stderr}`;
	const tooRecent = output.includes('ERR_PNPM_NO_MATURE_MATCHING_VERSION');
	const hint = tooRecent ? ' (a dependency was published too recently, minimumReleaseAge)' : '';
	return `pnpm install failed in ${cwd}${hint}\n\n${output}`;
}
