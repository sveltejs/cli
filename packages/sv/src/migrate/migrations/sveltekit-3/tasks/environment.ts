import { transforms } from '@sveltejs/sv-utils';
import { defineMigrationTask } from '../../../index.ts';
import { renameEnvNamespace } from './environment/env-namespace.ts';
import {
	addEnvDeclarationFile,
	migrateExplicitEnvVars,
	type EnvVar
} from './environment/explicit-env-vars.ts';

export default defineMigrationTask({
	id: 'environment',
	description: 'Migrate to explicit environment variables ($app/env)',
	run: ({ sv, language }) => {
		const envVars = new Map<string, EnvVar>();

		sv.files(
			{
				include: '**/*.{ts,js,svelte}',
				where: (content) => content.includes('$env/') || content.includes('$app/environment')
			},
			(content, path) => {
				if (path.endsWith('.svelte')) {
					return transforms.svelteScript({ language }, ({ ast }) => {
						const renamed = renameEnvNamespace(ast.instance.content);
						const migrated = migrateExplicitEnvVars(
							ast.instance.content,
							envVars,
							ast.fragment
						);
						if (!renamed && !migrated) return false;
					})(content);
				}

				return transforms.script(({ ast, comments }) => {
					const renamed = renameEnvNamespace(ast);
					const migrated = migrateExplicitEnvVars(ast, envVars, undefined, comments);
					if (!renamed && !migrated) return false;
				})(content);
			}
		);

		if (envVars.size > 0) {
			sv.file(
				'src/env.ts',
				transforms.script(({ ast }) => addEnvDeclarationFile(ast, envVars))
			);
		}
	}
});
