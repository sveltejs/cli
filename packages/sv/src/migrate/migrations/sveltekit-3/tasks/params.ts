import { js, parse, type AstTypes } from '@sveltejs/sv-utils';
import fs from 'node:fs';
import path from 'node:path';
import { defineMigrationTask } from '../../../index.ts';
import { createMigrationTaskComment } from '../../../migration-task.ts';

// matcher files must have a `\w+` base name, mirroring SvelteKit's matcher naming rules
const MATCHER_FILE = /^\w+\.[jt]s$/;
// `*.template.*` files are an artifact of the migration test harness (see tests.spec.ts): they are
// copied to their non-template names before every test run so this destructive task is repeatable.
// They are invisible to this task - neither matchers nor files that block the directory cleanup.
const TEST_HARNESS_FILE = /\.template\.[jt]s$/;

type ImportBinding = {
	source: string;
	kind: 'default' | 'namespace' | 'named';
	/** the exported name in the source module (`default` / `*` for default and namespace imports) */
	imported: string;
	/** the module-level identifier the import is bound to */
	local: string;
	typeOnly: boolean;
};

type ModuleContext = {
	/** every identifier occupied at module scope (imports, hoisted declarations, generated names) */
	usedNames: Set<string>;
	/** deduplicated import bindings keyed by `${kind}:${imported}:${source}` */
	imports: Map<string, ImportBinding>;
	sideEffectImports: Set<string>;
};

type MigratedMatcher = {
	/** the property entry inside `defineParams({ ... })` */
	entry: string;
	/** statements hoisted to module scope (`undefined` when the matcher fell back to an IIFE) */
	hoisted?: string;
};

export default defineMigrationTask({
	id: 'params',
	description: 'Consolidate parameter matchers into src/params.js or src/params.ts',
	run: ({ sv, cwd, directory, language }) => {
		const paramsDirectory = path.posix.join(directory.src, 'params');
		const absoluteParamsDirectory = path.join(cwd, paramsDirectory);
		if (!fs.existsSync(absoluteParamsDirectory)) return;

		const entries = fs.readdirSync(absoluteParamsDirectory, { withFileTypes: true });
		const isMatcher = (entry: fs.Dirent) => entry.isFile() && MATCHER_FILE.test(entry.name);
		// anything that is not a matcher (tests, helpers, subdirectories, ...) may depend on the
		// matcher files, so their presence turns the directory cleanup into a manual task
		const foreignEntries = entries.filter(
			(entry) => !isMatcher(entry) && !TEST_HARNESS_FILE.test(entry.name)
		);
		const matcherFiles = entries
			.filter(isMatcher)
			.map((entry) => path.posix.join(paramsDirectory, entry.name))
			.sort();
		if (matcherFiles.length === 0) return;

		const target = `${paramsDirectory}.${language}`;
		if (fs.existsSync(path.join(cwd, target))) {
			throw new Error(`Cannot migrate parameter matchers because '${target}' already exists`);
		}

		const context: ModuleContext = {
			usedNames: new Set(['defineParams', 'params']),
			imports: new Map(),
			sideEffectImports: new Set()
		};
		// seed the `defineParams` import so other imports from its module merge into it
		context.imports.set('named:defineParams:@sveltejs/kit/params', {
			source: '@sveltejs/kit/params',
			kind: 'named',
			imported: 'defineParams',
			local: 'defineParams',
			typeOnly: false
		});

		const matchers = matcherFiles.map((file) => migrateMatcher(cwd, file, target, context));

		const parts: string[] = [];
		if (foreignEntries.length > 0) {
			const names = foreignEntries
				.map((entry) => entry.name)
				.sort()
				.join(', ');
			parts.push(
				createMigrationTaskComment(
					`'${paramsDirectory}' contains entries that are not parameter matchers (${names}) and was left in place - migrate them and delete the directory manually`
				)
			);
		}
		parts.push(...generateImportCode(context), '');
		for (const matcher of matchers) {
			if (matcher.hoisted) parts.push(matcher.hoisted, '');
		}
		parts.push(
			'export const params = defineParams({',
			matchers.map((matcher) => matcher.entry).join(',\n'),
			'});',
			''
		);
		const content = parts.join('\n');

		sv.file(target, () => content);

		// non-matcher files may depend on the matchers (e.g. tests), leave the directory to the user
		if (foreignEntries.length > 0) return;

		for (const file of matcherFiles) sv.removeFile(file);
		if (fs.readdirSync(absoluteParamsDirectory).length === 0) fs.rmdirSync(absoluteParamsDirectory);
	}
});

function migrateMatcher(
	cwd: string,
	file: string,
	target: string,
	context: ModuleContext
): MigratedMatcher {
	const name = path.posix.basename(file).slice(0, -'.js'.length);
	const content = stripParamMatcherComments(fs.readFileSync(path.join(cwd, file), 'utf8'));
	const parsed = parse.script(content);
	const importDeclarations: Array<{ declaration: AstTypes.ImportDeclaration; source: string }> = [];
	const body: AstTypes.Program['body'] = [];
	const paramMatcherTypes = new Set(['ParamMatcher']);
	let declaresMatch = false;
	let exportsMatch = false;

	for (const statement of parsed.ast.body) {
		if (statement.type === 'ImportDeclaration') {
			if (
				statement.source.value === '@sveltejs/kit' ||
				statement.source.value === '@sveltejs/kit/params'
			) {
				for (const specifier of statement.specifiers) {
					if (
						specifier.type === 'ImportSpecifier' &&
						specifier.imported.type === 'Identifier' &&
						specifier.imported.name === 'ParamMatcher'
					) {
						paramMatcherTypes.add(specifier.local.name);
					}
				}
				statement.specifiers = statement.specifiers.filter(
					(specifier) =>
						specifier.type !== 'ImportSpecifier' ||
						specifier.imported.type !== 'Identifier' ||
						specifier.imported.name !== 'ParamMatcher'
				);
				if (statement.specifiers.length === 0) continue;
			}

			let source = String(statement.source.value);
			if (source.startsWith('.')) source = relocateImport(source, file, target);

			if (statement.specifiers.length === 0) {
				context.sideEffectImports.add(source);
			} else {
				importDeclarations.push({ declaration: statement, source });
			}
			continue;
		}

		if (statement.type === 'ExportDefaultDeclaration') {
			throw new Error(`Cannot migrate '${file}' because it contains a default export`);
		}

		if (statement.type === 'ExportAllDeclaration') {
			throw new Error(`Cannot migrate '${file}' because it re-exports another module`);
		}

		if (statement.type === 'ExportNamedDeclaration') {
			if (statement.declaration) {
				stripParamMatcherType(statement.declaration, paramMatcherTypes);
				if (declares(statement.declaration, 'match')) {
					declaresMatch = true;
					exportsMatch = true;
				}
				body.push(statement.declaration);
			} else {
				exportsMatch ||= statement.specifiers.some(
					(specifier) =>
						specifier.exported.type === 'Identifier' && specifier.exported.name === 'match'
				);
			}
			continue;
		}

		stripParamMatcherType(statement, paramMatcherTypes);
		declaresMatch ||= declares(statement, 'match');
		body.push(statement);
	}

	if (!declaresMatch || !exportsMatch) {
		throw new Error(
			`Cannot migrate '${file}' because it does not export a local 'match' declaration`
		);
	}

	// register the imports at module scope, renaming locals that collide with previous matchers
	const renames = new Map<string, string>();
	for (const { declaration, source } of importDeclarations) {
		const typeOnly = declaration.importKind === 'type';
		for (const specifier of declaration.specifiers) {
			const local = specifier.local.name;
			const finalLocal = registerImport(context, {
				source,
				kind:
					specifier.type === 'ImportDefaultSpecifier'
						? 'default'
						: specifier.type === 'ImportNamespaceSpecifier'
							? 'namespace'
							: 'named',
				imported:
					specifier.type === 'ImportDefaultSpecifier'
						? 'default'
						: specifier.type === 'ImportNamespaceSpecifier'
							? '*'
							: specifier.imported.type === 'Identifier'
								? specifier.imported.name
								: String((specifier.imported as AstTypes.Literal).value),
				local,
				typeOnly
			});
			if (finalLocal !== local) renames.set(local, finalLocal);
		}
	}

	const nestedBindings = js.scope.nestedBindingNames(body);
	for (const local of renames.keys()) {
		if (nestedBindings.has(local)) {
			throw new Error(
				`Cannot migrate '${file}' because the imported name '${local}' conflicts with another matcher and cannot be renamed safely`
			);
		}
	}

	// plan hoisting the matcher body to module scope: `match` becomes `match<Name>` and any other
	// top-level binding colliding with a previous matcher gets a deduplicated name
	const identifier = name.replace(/\W/g, '_');
	const preferredMatchName = `match${identifier.charAt(0).toUpperCase()}${identifier.slice(1)}`;
	parsed.ast.body = body;
	const topLevelBindings = js.scope.topLevelBindings([parsed.ast]);
	const tentativeNames = new Set(context.usedNames);
	const bodyRenames = new Map<string, string>();
	for (const binding of topLevelBindings) {
		const preferred = binding === 'match' ? preferredMatchName : binding;
		const finalName = js.identifiers.uniqueName(preferred, tentativeNames);
		if (finalName !== binding) bodyRenames.set(binding, finalName);
	}

	// renaming a binding is only safe when no nested scope declares the same name - fall back to
	// an IIFE (which keeps the original names scoped) when that is not the case
	const hoistable = [...bodyRenames.keys()].every((binding) => !nestedBindings.has(binding));
	if (hoistable) {
		for (const binding of topLevelBindings) {
			context.usedNames.add(bodyRenames.get(binding) ?? binding);
		}
		for (const [from, to] of bodyRenames) renames.set(from, to);
	}

	js.identifiers.renameReferences([parsed.ast], renames);
	const bodyCode = parsed.generateCode().trim();

	if (hoistable) {
		const matchName = bodyRenames.get('match')!;
		return {
			entry: `\t${propertyName(name)}: (param) => (${matchName}(param) ? param : undefined)`,
			hoisted: bodyCode
		};
	}

	return {
		entry: `\t${propertyName(name)}: (() => {\n${indent(bodyCode, 2)}\n\n\t\treturn (param) => (match(param) ? param : undefined);\n\t})()`
	};
}

/** Registers an import binding, deduplicating it and returning the module-level local name. */
function registerImport(context: ModuleContext, binding: ImportBinding): string {
	const key = `${binding.kind}:${binding.imported}:${binding.source}`;
	const existing = context.imports.get(key);
	if (existing) {
		// a type-only import can piggyback on a value import, but not the other way around
		existing.typeOnly &&= binding.typeOnly;
		return existing.local;
	}

	const local = js.identifiers.uniqueName(binding.local, context.usedNames);
	context.imports.set(key, { ...binding, local });
	return local;
}

function generateImportCode(context: ModuleContext): string[] {
	const bySource = new Map<string, ImportBinding[]>();
	for (const binding of context.imports.values()) {
		const group = bySource.get(binding.source) ?? [];
		group.push(binding);
		bySource.set(binding.source, group);
	}

	const lines: string[] = [];
	for (const [source, bindings] of bySource) {
		const from = `from ${quoteString(source)};`;
		const defaultBinding = bindings.find((binding) => binding.kind === 'default');
		const namespaceBinding = bindings.find((binding) => binding.kind === 'namespace');
		const namedBindings = bindings.filter((binding) => binding.kind === 'named');

		let defaultEmitted = false;
		if (namespaceBinding) {
			const prefix =
				defaultBinding && namedBindings.length === 0 ? `${defaultBinding.local}, ` : '';
			defaultEmitted = prefix !== '';
			lines.push(`import ${prefix}* as ${namespaceBinding.local} ${from}`);
		}

		if (namedBindings.length > 0 || (defaultBinding && !defaultEmitted)) {
			const typeOnly =
				namedBindings.length > 0 &&
				namedBindings.every((binding) => binding.typeOnly) &&
				(!defaultBinding || defaultEmitted);
			const specifiers = namedBindings
				.map((binding) => {
					const imported = /^[$A-Z_a-z][$\w]*$/.test(binding.imported)
						? binding.imported
						: quoteString(binding.imported);
					const specifier =
						imported === binding.local ? binding.local : `${imported} as ${binding.local}`;
					return !typeOnly && binding.typeOnly ? `type ${specifier}` : specifier;
				})
				.join(', ');

			const clauses: string[] = [];
			if (defaultBinding && !defaultEmitted) clauses.push(defaultBinding.local);
			if (namedBindings.length > 0) clauses.push(`{ ${specifiers} }`);
			lines.push(`import ${typeOnly ? 'type ' : ''}${clauses.join(', ')} ${from}`);
		}
	}

	for (const source of context.sideEffectImports) {
		lines.push(`import ${quoteString(source)};`);
	}

	return lines;
}

function stripParamMatcherType(
	node: AstTypes.Program['body'][number],
	paramMatcherTypes: Set<string>
): void {
	if (node.type !== 'VariableDeclaration') return;

	const declaration = node.declarations.find(
		(declaration) => declaration.id.type === 'Identifier' && declaration.id.name === 'match'
	);
	if (!declaration || declaration.id.type !== 'Identifier') return;

	const annotation = declaration.id.typeAnnotation?.typeAnnotation;
	if (
		annotation?.type === 'TSTypeReference' &&
		annotation.typeName.type === 'Identifier' &&
		paramMatcherTypes.has(annotation.typeName.name)
	) {
		delete declaration.id.typeAnnotation;
	}

	if (
		(declaration.init?.type === 'TSSatisfiesExpression' ||
			declaration.init?.type === 'TSAsExpression') &&
		declaration.init.typeAnnotation.type === 'TSTypeReference' &&
		declaration.init.typeAnnotation.typeName.type === 'Identifier' &&
		paramMatcherTypes.has(declaration.init.typeAnnotation.typeName.name)
	) {
		declaration.init = declaration.init.expression;
	}
}

function stripParamMatcherComments(content: string): string {
	return content.replace(/\/\*\*[\s\S]*?\*\//g, (comment) => {
		if (!comment.includes('ParamMatcher')) return comment;

		const lines = comment.split('\n').filter((line) => !line.includes('ParamMatcher'));
		return lines.length > 2 ? lines.join('\n') : '';
	});
}

function declares(node: AstTypes.Program['body'][number], name: string): boolean {
	if (
		(node.type === 'FunctionDeclaration' || node.type === 'ClassDeclaration') &&
		node.id?.name === name
	) {
		return true;
	}

	return (
		node.type === 'VariableDeclaration' &&
		node.declarations.some(
			(declaration) =>
				declaration.id.type === 'Identifier' &&
				js.scope.collectPatternNames(declaration.id).includes(name)
		)
	);
}

function relocateImport(source: string, from: string, to: string): string {
	const resolved = path.posix.normalize(path.posix.join(path.posix.dirname(from), source));
	let relative = path.posix.relative(path.posix.dirname(to), resolved);
	if (!relative.startsWith('.')) relative = `./${relative}`;
	return relative;
}

function propertyName(name: string): string {
	return /^[$A-Z_a-z][$\w]*$/.test(name) ? name : quoteString(name);
}

function quoteString(value: string): string {
	return `'${value.replaceAll('\\', '\\\\').replaceAll("'", "\\'")}'`;
}

function indent(content: string, level: number): string {
	const prefix = '\t'.repeat(level);
	return content
		.split('\n')
		.map((line) => (line ? `${prefix}${line}` : line))
		.join('\n');
}
