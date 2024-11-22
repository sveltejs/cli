import { execSync } from 'node:child_process';
import * as p from '@sveltejs/clack-prompts';

function hasGitInstalled() {
	try {
		execSync('git --version', { stdio: 'ignore' });
		return true;
	} catch {
		return false;
	}
}

function isGitRepo(cwd: string) {
	try {
		return (
			execSync('git rev-parse --is-inside-work-tree', { cwd, stdio: 'pipe' }).toString().trim() ===
			'true'
		);
	} catch {
		return false;
	}
}

export async function initGitRepo(cwd: string) {
	execSync('git init', { cwd, stdio: 'ignore' });
	execSync('git add -A', { cwd, stdio: 'ignore' });
}

export async function gitInitPrompt(cwd: string): Promise<boolean> {
	const hasGit = hasGitInstalled();
	if (!hasGit) return false;
	const alreadyGitRepo = isGitRepo(cwd);
	if (alreadyGitRepo) return false;

	const shouldInit = await p.confirm({
		message: 'Do you want to initialize a git repository?',
		active: 'yes',
		inactive: 'no',
		initialValue: true
	});

	if (p.isCancel(shouldInit)) {
		p.cancel('Operation cancelled.');
		process.exit(1);
	}

	return shouldInit;
}
