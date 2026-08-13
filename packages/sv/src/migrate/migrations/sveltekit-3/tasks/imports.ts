import { js, transforms, type AstTypes, type SvelteAst } from '@sveltejs/sv-utils';
import { defineMigrationTask } from '../../../index.ts';

const KIT_MODULE = '@sveltejs/kit';

const MOVED_EXPORTS = new Map<string, string>([
	['ActionResult', '$app/forms'],
	['AfterNavigate', '$app/navigation'],
	['BeforeNavigate', '$app/navigation'],
	['CaughtError', '@sveltejs/kit/hooks'],
	['ClientCaughtError', '@sveltejs/kit/hooks'],
	['ClientInit', '@sveltejs/kit/hooks'],
	['DefinedEnvVars', '@sveltejs/kit/env'],
	['DefinedParams', '@sveltejs/kit/params'],
	['EnvVarConfig', '@sveltejs/kit/env'],
	['GotoOptions', '$app/navigation'],
	['Handle', '@sveltejs/kit/hooks'],
	['HandleClientError', '@sveltejs/kit/hooks'],
	['HandleFetch', '@sveltejs/kit/hooks'],
	['HandleServerError', '@sveltejs/kit/hooks'],
	['InvalidField', '$app/server'],
	['LiveQueryRequestedResult', '$app/server'],
	['LiveRequestedEntry', '$app/server'],
	['MatcherParam', '@sveltejs/kit/params'],
	['Navigation', '$app/navigation'],
	['NavigationBase', '$app/navigation'],
	['NavigationEnter', '$app/navigation'],
	['NavigationExternal', '$app/navigation'],
	['NavigationFormSubmit', '$app/navigation'],
	['NavigationGoto', '$app/navigation'],
	['NavigationLeave', '$app/navigation'],
	['NavigationLink', '$app/navigation'],
	['NavigationPopState', '$app/navigation'],
	['NavigationTarget', '$app/navigation'],
	['NavigationType', '$app/navigation'],
	['OnNavigate', '$app/navigation'],
	['Page', '$app/state'],
	['ParamDefinition', '@sveltejs/kit/params'],
	['ParamMatcher', '@sveltejs/kit/params'],
	['ParamValue', '@sveltejs/kit/params'],
	['QueryRequestedResult', '$app/server'],
	['ReadonlyURL', '$app/state'],
	['ReadonlyURLSearchParams', '$app/state'],
	['RemoteCommand', '$app/server'],
	['RemoteForm', '$app/server'],
	['RemoteFormEnhanceCallback', '$app/server'],
	['RemoteFormEnhanceInstance', '$app/server'],
	['RemoteFormField', '$app/server'],
	['RemoteFormFields', '$app/server'],
	['RemoteFormFieldType', '$app/server'],
	['RemoteFormFieldValue', '$app/server'],
	['RemoteFormInput', '$app/server'],
	['RemoteFormIssue', '$app/server'],
	['RemoteLiveQuery', '$app/server'],
	['RemoteLiveQueryFunction', '$app/server'],
	['RemotePrerenderFunction', '$app/server'],
	['RemoteQuery', '$app/server'],
	['RemoteQueryFunction', '$app/server'],
	['RemoteQueryOverride', '$app/server'],
	['RemoteQueryUpdate', '$app/server'],
	['RemoteResource', '$app/server'],
	['RequestedEntry', '$app/server'],
	['LiveRequestedEntry', '$app/server'],
	['RequestedResult', '$app/server'],
	['QueryRequestedResult', '$app/server'],
	['LiveQueryRequestedResult', '$app/server'],
	['Reroute', '@sveltejs/kit/hooks'],
	['ResolveOptions', '@sveltejs/kit/hooks'],
	['ServerInit', '@sveltejs/kit/hooks'],
	['SubmitFunction', '$app/forms'],
	['Transport', '@sveltejs/kit/hooks'],
	['Transporter', '@sveltejs/kit/hooks'],
	['defineParams', '@sveltejs/kit/params']
]);

export default defineMigrationTask({
	id: 'imports',
	description: 'Move SvelteKit APIs to their new modules',
	run: ({ sv }) => {
		sv.files(
			{
				include: '**/*.{js,ts,mjs,mts,cjs,cts,svelte}',
				where: (content) => content.includes(KIT_MODULE)
			},
			(content, file) => {
				if (file.endsWith('.svelte')) {
					return transforms.svelte(({ ast }) => {
						let changed = false;
						if (ast.module && migrateProgram(ast.module.content)) changed = true;
						if (ast.instance && migrateProgram(ast.instance.content)) changed = true;
						if (migrateComments(ast.comments)) changed = true;
						if (!changed) return false;
					})(content);
				}

				return transforms.script(({ ast, comments }) => {
					const programChanged = migrateProgram(ast);
					const commentsChanged = migrateComments(comments.list());
					if (!programChanged && !commentsChanged) return false;
				})(content);
			}
		);
	}
});

function migrateProgram(ast: AstTypes.Program): boolean {
	let changed = migrateNamedImports(ast);
	const body: AstTypes.Program['body'] = [];

	for (const statement of ast.body) {
		if (statement.type === 'ExportNamedDeclaration' && statement.source?.value === KIT_MODULE) {
			const replacements = splitExportSpecifiers(statement);
			if (replacements) {
				body.push(...replacements);
				changed = true;
				continue;
			}
		}

		body.push(statement);
	}

	ast.body = body;
	return migrateImportTypes(ast) || changed;
}

function migrateNamedImports(ast: AstTypes.Program): boolean {
	const bindings = js.imports
		.bindings(ast, { from: KIT_MODULE })
		.filter((binding) => binding.kind === 'named');
	if (!bindings.some((binding) => MOVED_EXPORTS.has(binding.imported))) return false;

	const bySource = new Map<string, typeof bindings>();
	for (const binding of bindings) {
		const source = MOVED_EXPORTS.get(binding.imported) ?? KIT_MODULE;
		const group = bySource.get(source) ?? [];
		group.push(binding);
		bySource.set(source, group);
	}

	for (const imported of new Set(bindings.map((binding) => binding.imported))) {
		js.imports.remove(ast, { from: KIT_MODULE, name: imported });
	}

	// addNamed prepends new declarations, so process source groups in reverse to retain source order
	for (const [source, group] of [...bySource].reverse()) {
		for (const binding of group) {
			js.imports.addNamed(ast, {
				from: source,
				imports: { [binding.imported]: binding.local },
				isType: binding.isType
			});
		}
	}

	return true;
}

function splitExportSpecifiers(
	declaration: AstTypes.ExportNamedDeclaration
): AstTypes.ExportNamedDeclaration[] | undefined {
	const moved = new Map<string, AstTypes.ExportSpecifier[]>();
	const remaining: AstTypes.ExportSpecifier[] = [];

	for (const specifier of declaration.specifiers) {
		const name =
			specifier.local.type === 'Identifier' ? specifier.local.name : String(specifier.local.value);
		const destination = MOVED_EXPORTS.get(name);
		if (!destination) {
			remaining.push(specifier);
			continue;
		}

		const specifiers = moved.get(destination) ?? [];
		specifiers.push(specifier);
		moved.set(destination, specifiers);
	}

	if (moved.size === 0) return;

	const declarations: AstTypes.ExportNamedDeclaration[] = [];
	if (remaining.length > 0) declarations.push({ ...declaration, specifiers: remaining });
	for (const [source, specifiers] of moved) {
		declarations.push({
			...declaration,
			specifiers,
			source: { type: 'Literal', value: source }
		});
	}
	return declarations;
}

function migrateImportTypes(node: unknown): boolean {
	if (!node || typeof node !== 'object') return false;
	if (Array.isArray(node)) {
		let changed = false;
		for (const child of node) if (migrateImportTypes(child)) changed = true;
		return changed;
	}

	const record = node as Record<string, unknown>;
	let changed = false;
	if (record.type === 'TSImportType') {
		const argument = record.argument as { value?: unknown; raw?: string } | undefined;
		const qualifier = record.qualifier as { type?: unknown; name?: unknown } | undefined;
		if (
			argument?.value === KIT_MODULE &&
			qualifier?.type === 'Identifier' &&
			typeof qualifier.name === 'string'
		) {
			const destination = MOVED_EXPORTS.get(qualifier.name);
			if (destination) {
				argument.value = destination;
				argument.raw = undefined;
				changed = true;
			}
		}
	}

	for (const child of Object.values(record)) {
		if (migrateImportTypes(child)) changed = true;
	}
	return changed;
}

function migrateComments(comments: readonly SvelteAst.JSComment[]): boolean {
	let changed = false;
	for (const comment of comments) {
		let value = comment.value.replace(
			/import(\s*\(\s*)(['"])@sveltejs\/kit\2(\s*\)\s*\.\s*)([A-Za-z_$][\w$]*)/g,
			(match, open: string, quote: string, close: string, name: string) => {
				const destination = MOVED_EXPORTS.get(name);
				if (!destination) return match;
				changed = true;
				return `import${open}${quote}${destination}${quote}${close}${name}`;
			}
		);
		value = value.replace(
			/@import\s*\{([^}]+)\}\s*from\s*(['"])@sveltejs\/kit\2(;?)/g,
			(match, list: string, quote: string, semicolon: string) => {
				const groups = new Map<string, string[]>();
				for (const specifier of list.split(',')) {
					const imported = /^(?:type\s+)?([A-Za-z_$][\w$]*)/.exec(specifier.trim())?.[1];
					const source = imported && MOVED_EXPORTS.get(imported);
					const group = groups.get(source ?? KIT_MODULE) ?? [];
					group.push(specifier.trim());
					groups.set(source ?? KIT_MODULE, group);
				}

				if (groups.size === 1 && groups.has(KIT_MODULE)) return match;
				changed = true;
				return [...groups]
					.map(
						([source, specifiers]) =>
							`@import { ${specifiers.join(', ')} } from ${quote}${source}${quote}${semicolon}`
					)
					.join('\n * ');
			}
		);
		comment.value = value;
	}
	return changed;
}
