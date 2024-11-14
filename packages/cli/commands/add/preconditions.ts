import { exec } from 'tinyexec';
import type { AddonSetupResult, AddonWithoutExplicitArgs, Precondition } from '@sveltejs/cli-core';
import { UnsupportedError } from '../../utils/errors.ts';

type PreconditionCheck = { name: string; preconditions: Precondition[] };
export function getGlobalPreconditions(
	cwd: string,
	addons: AddonWithoutExplicitArgs[],
	addonSetupResult: Record<string, AddonSetupResult>
): PreconditionCheck {
	return {
		name: 'global checks',
		preconditions: [
			{
				name: 'clean working directory',
				run: async () => {
					try {
						// If a user has pending git changes the output of the following command will list
						// all files that have been added/modified/deleted and thus the output will not be empty.
						// In case the output of the command below is an empty text, we can safely assume
						// there are no pending changes. If the below command is run outside of a git repository,
						// git will exit with a failing exit code, which will trigger the catch statement.
						// also see https://remarkablemark.org/blog/2017/10/12/check-git-dirty/#git-status
						const { stdout } = await exec('git', ['status', '--short'], {
							nodeOptions: { cwd },
							throwOnError: true
						});

						if (stdout) {
							return { success: false, message: 'Found modified files' };
						}

						return { success: true, message: undefined };
					} catch {
						return { success: true, message: 'Not a git repository' };
					}
				}
			},
			{
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
			}
		]
	};
}
