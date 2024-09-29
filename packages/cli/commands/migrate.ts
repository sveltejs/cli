import { execSync } from 'node:child_process';
import { Command } from 'commander';

export const migrate = new Command('migrate')
	.description('A CLI for migrating Svelte(Kit) codebases')
	.argument('<migration>', 'migration to run')
	.configureHelp({
		formatHelp() {
			// we'll pass the responsibility of presenting the help menu over to `svelte-migrate`
			execSync('npx --yes svelte-migrate@latest --help', { stdio: 'inherit' });
			return '';
		}
	})
	.action((migration) => {
		execSync(`npx --yes svelte-migrate@latest ${migration}`, { stdio: 'inherit' });
	});
