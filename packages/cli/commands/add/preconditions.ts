import { exec } from 'node:child_process';
import { promisify } from 'node:util';
import type { AddonSetupResult, AddonWithoutExplicitArgs, Precondition } from '@sveltejs/cli-core';
import { UnsupportedError } from '../../utils/errors.ts';

export function getCleanPreconditions(cwd: string, gitCheck: boolean) {
	const preconditions: Precondition[] = [];

	if (gitCheck) {
		preconditions.push({
			name: 'clean working directory',
			run: async () => {
				try {
					// If a user has pending git changes the output of the following command will list
					// all files that have been added/modified/deleted and thus the output will not be empty.
					// In case the output of the command below is an empty text, we can safely assume
					// there are no pending changes. If the below command is run outside of a git repository,
					// git will exit with a failing exit code, which will trigger the catch statement.
					// also see https://remarkablemark.org/blog/2017/10/12/check-git-dirty/#git-status
					const asyncExec = promisify(exec);
					const { stdout } = await asyncExec('git status --short', {
						cwd
					});

					if (stdout) {
						return { success: false, message: 'Found modified files' };
					}

					return { success: true, message: undefined };
				} catch {
					return { success: true, message: 'Not a git repository' };
				}
			}
		});
	}

	return preconditions;
}

export function getAddonsPreconditions(
	addons: AddonWithoutExplicitArgs[],
	addonSetupResult: Record<string, AddonSetupResult>
) {
	const preconditions: Precondition[] = [];

	preconditions.push({
		name: 'unsupported add-ons',
		run: () => {
			const reasons = addons.flatMap((a) =>
				addonSetupResult[a.id].unsupported.map((reason) => ({ id: a.id, reason }))
			);

			if (reasons.length === 0) {
				return { success: true, message: undefined };
			}

			throw new UnsupportedError(reasons);
		}
	});

	return preconditions;
}
