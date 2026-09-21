import {
	js,
	parse,
	svelteConfig,
	transforms,
	Walker,
	type AstTypes,
	type Comments
} from '@sveltejs/sv-utils';
import { defineMigrationTask } from '../../../index.ts';
import { addMigrationTask } from '../../../migration-task.ts';

// matches `svelte.config`, optionally with a (m/c)js/ts extension, at the end of an import source
const SVELTE_CONFIG_IMPORT = /(^|\/)svelte\.config(\.[mc]?[jt]s)?$/;

export default defineMigrationTask({
	id: 'svelte-config',
	description: 'Migrate svelte.config.* to vite.config.*',
	run: ({ sv, cwd }) => {
		const configSource = svelteConfig.find(cwd);

		if (!configSource) return; // no config found
		if (configSource.kind === 'vite') return; // already migrated vite config

		const originalConfigObject = svelteConfig.read(cwd);
		if (!originalConfigObject) return;

		// delete the original config file, so that the we will use the vite config afterwards
		sv.removeFile(configSource.path);

		svelteConfig.edit({ sv, cwd }, ({ ast, override, comments }) => {
			// The vite config is about to gain and reorder nodes. Bind its positional comments to
			// their original nodes first so the printer cannot attach them to a new property.
			const existingAttachments = collectComments(ast, comments);
			comments.remove(() => true);

			// the original `const config = {...}` declaration and its `export default` are replaced
			// by the generated vite config, so identify them to drop them while keeping everything else
			const configDeclaration = originalConfigObject.ast.body.find(
				(node) =>
					node.type === 'VariableDeclaration' &&
					node.declarations.some((d) => d.init === originalConfigObject.config)
			);

			// preserve the original imports and any other top-level statements (e.g. variable or
			// function declarations the config references), otherwise the generated config would
			// reference identifiers that were silently left behind
			const originalImports: AstTypes.ImportDeclaration[] = [];
			const originalStatements: AstTypes.Program['body'] = [];
			for (const node of originalConfigObject.ast.body) {
				if (node.type === 'ImportDeclaration') {
					originalImports.push(node);
				} else if (node.type !== 'ExportDefaultDeclaration' && node !== configDeclaration) {
					originalStatements.push(node);
				}
			}

			// imports go to the very top; the remaining statements go after all imports but before
			// the generated `export default`
			ast.body.unshift(...originalImports);
			const exportIndex = ast.body.findIndex((node) => node.type === 'ExportDefaultDeclaration');
			ast.body.splice(exportIndex, 0, ...originalStatements);

			// comments live in the original file's positional comment table, not on the nodes. Attach
			// each to the node it leads/trails so they can be carried over when those nodes move.
			const attachments = collectComments(originalConfigObject.ast, originalConfigObject.comments);
			// `override` rebuilds the config's top-level property nodes, so their comments can't ride
			// along by identity - remember them by key name and re-attach after the rebuild
			const propComments = new Map<string, CommentRecord>();

			// kit-level options are flattened into the root of the vite config, so merge the properties
			// and then move the properties into the new config object, skipping the unflattened `kit` wrapper
			const newConfigProperties = [
				...originalConfigObject.config.properties,
				...originalConfigObject.kit.properties
			];
			const keyedConfig: Record<string, AstTypes.Node> = {};
			let trustsAllOrigins = false;

			for (const prop of newConfigProperties) {
				if (prop.type !== 'Property') continue;
				if (prop.key.type !== 'Identifier') continue;
				if (prop.key.name === 'kit') continue;

				const propAttachment = attachments.get(prop);
				keyedConfig[prop.key.name] = prop.value;
				if (propAttachment) propComments.set(prop.key.name, propAttachment);
			}

			for (const [key, value] of Object.entries(keyedConfig)) {
				// Rendering error boundaries are always enabled in SvelteKit 3, and the old opt-in
				// is rejected by its config validation. Drop it instead of moving it to vite.config.
				// Tracing is also no longer experimental.
				if (key === 'experimental' && value.type === 'ObjectExpression') {
					removeProperty(value, 'handleRenderingErrors');
					removeProperty(value, 'instrumentation');

					const index = value.properties.findIndex(
						(prop) =>
							prop.type === 'Property' &&
							prop.key.type === 'Identifier' &&
							prop.key.name === 'tracing'
					);
					if (index !== -1) {
						keyedConfig.tracing = (value.properties[index] as AstTypes.Property).value;
						value.properties.splice(index, 1);
					}
				}

				// prerender.origin is removed in favor of paths.origin
				if (key === 'prerender' && value.type === 'ObjectExpression') {
					const originProp = value.properties.find(
						(prop): prop is AstTypes.Property & { key: AstTypes.Identifier } =>
							prop.type === 'Property' &&
							prop.key.type === 'Identifier' &&
							prop.key.name === 'origin'
					);
					if (originProp) {
						// prerender may come before paths and may be merged so we need to ensure the current object first
						keyedConfig.paths ??= {
							type: 'ObjectExpression',
							properties: []
						};
						(keyedConfig.paths as AstTypes.ObjectExpression).properties.push({
							type: 'Property',
							key: { type: 'Identifier', name: 'origin' },
							value: originProp.value,
							kind: 'init',
							method: false,
							shorthand: false,
							computed: false
						});
						removeProperty(value, 'origin');
						if (value.properties.length === 0) {
							// drop the empty prerender object entirely
							delete keyedConfig.prerender;
						}
					}
				}

				// `csrf: { checkOrigin: false }` is deprecated; the equivalent is now
				// `csrf: { trustedOrigins: ['*'] }`. Rewrite the property in place so any sibling
				// `csrf` options are preserved and `trustedOrigins` stays nested under `csrf`.
				if (key === 'csrf' && value.type === 'ObjectExpression') {
					const checkOrigin = findDisabledCheckOrigin(value);
					if (checkOrigin) {
						checkOrigin.key.name = 'trustedOrigins';
						checkOrigin.value = {
							type: 'ArrayExpression',
							elements: [{ type: 'Literal', value: '*' }]
						};
						trustsAllOrigins = true;
					}
				}
			}

			// preloadStrategy is removed
			delete keyedConfig.preloadStrategy;

			override(keyedConfig);

			// trusting all origins is generally not recommended, so flag the generated property for review.
			// `override` builds the node, so we locate it afterwards to attach the leading comment
			if (trustsAllOrigins) {
				Walker.walk(ast as AstTypes.Node, null, {
					Property(node, { next }) {
						if (node.key.type === 'Identifier' && node.key.name === 'trustedOrigins') {
							addMigrationTask(
								"trusting all origins with '*' is generally not recommended, see https://svelte.dev/docs/kit/configuration#csrf",
								{ comments, node }
							);
						}
						next();
					}
				});
			}

			const apply = (node: AstTypes.Node, record: CommentRecord | undefined) => {
				for (const comment of record?.leading ?? []) comments.add(node, comment);
				for (const comment of record?.trailing ?? []) {
					comments.add(node, comment, { position: 'trailing' });
				}
			};

			// nodes reused by reference (preserved statements, property values, descendants) are matched
			// by identity wherever they ended up; capture the `sveltekit()` arg in the same pass
			let rootConfig: AstTypes.ObjectExpression | undefined;
			forEachNode(ast, (node) => {
				apply(node, existingAttachments.get(node));
				apply(node, attachments.get(node));
				if (
					node.type === 'CallExpression' &&
					node.callee.type === 'Identifier' &&
					node.callee.name === 'sveltekit' &&
					node.arguments[0]?.type === 'ObjectExpression'
				) {
					rootConfig = node.arguments[0];
				}
			});

			// `override` rebuilds the config's top-level properties, so match those back by key name
			// (csrf having become trustedOrigins). only the root is remapped, so nested same-named
			// properties (e.g. `experimental`) aren't confused - those rode along by identity above.
			for (const prop of rootConfig?.properties ?? []) {
				if (prop.type === 'Property' && prop.key.type === 'Identifier') {
					apply(prop, propComments.get(prop.key.name));
				}
			}
		});

		// other files may import from the now-deleted svelte.config (e.g. eslint.config.js passing
		// `svelteConfig` to the parser). Load the migrated config in eslint, and flag other imports
		// for manual handling.
		let addedConfigLoader = false;
		sv.files(
			{
				include: '**/*.{js,ts,mjs,mts,cjs,cts}',
				where: (content) => content.includes('svelte.config')
			},
			(content, filePath) => {
				if (/(^|\/)eslint\.config\.[mc]?[jt]s$/.test(filePath)) {
					const { ast } = parse.script(content);
					const configImport = js.imports
						.findAll(ast, { from: SVELTE_CONFIG_IMPORT })
						.find((item) => item.kind === 'static');
					if (configImport?.node.loc) {
						const start = offsetAt(content, configImport.node.loc.start);
						const end = offsetAt(content, configImport.node.loc.end);
						const replacement =
							"import { loadConfig } from '@sveltejs/load-config';\n\n" +
							"const svelteConfig = (await loadConfig('./', { traverse: false }))?.config;";
						addedConfigLoader = true;
						return content.slice(0, start) + replacement + content.slice(end);
					}
				}

				return transforms.script(({ ast, comments, js }) => {
					const found = js.imports.findAll(ast, { from: SVELTE_CONFIG_IMPORT });
					if (found.length === 0) return false;

					for (const imp of found) {
						addMigrationTask(
							"svelte.config was removed; switch to `import { loadConfig } from '@sveltejs/load-config'` to read your config",
							{ comments, node: imp.node }
						);
					}
				})(content);
			}
		);

		if (addedConfigLoader) sv.devDependency('@sveltejs/load-config', '^0.2.2');
	}
});

type Pos = { line: number; column: number };
const posKey = (p: Pos) => p.line * 1_000_000 + p.column;

function offsetAt(content: string, pos: Pos): number {
	let offset = 0;
	for (let line = 1; line < pos.line; line++) offset = content.indexOf('\n', offset) + 1;
	return offset + pos.column;
}

type SourceComment = { type: 'Line' | 'Block'; value: string };
type CommentRecord = { leading: SourceComment[]; trailing: SourceComment[] };

/** Visits every AST node (objects with a `type`) reachable from `root`, including `root` itself. */
function forEachNode(root: unknown, visit: (node: AstTypes.Node) => void): void {
	if (!root || typeof root !== 'object') return;
	if (Array.isArray(root)) {
		for (const item of root) forEachNode(item, visit);
		return;
	}
	const node = root as Record<string, unknown>;
	if (typeof node.type === 'string') visit(node as unknown as AstTypes.Node);
	for (const key in node) {
		if (key === 'loc' || key === 'range' || key === 'parent') continue;
		forEachNode(node[key], visit);
	}
}

/** Removes a statically named property from an object literal. */
function removeProperty(value: AstTypes.ObjectExpression, name: string): void {
	const index = value.properties.findIndex(
		(prop) => prop.type === 'Property' && prop.key.type === 'Identifier' && prop.key.name === name
	);
	if (index !== -1) value.properties.splice(index, 1);
}

/**
 * Maps each source comment to the node it documents, returned keyed by node identity. A comment is
 * the trailing comment of the node it sits behind on the same line, otherwise the leading comment of
 * the next node that starts after it. Nodes are sorted start-ascending then end-descending so an
 * outer node (e.g. a `Property`) wins over a node it encloses that starts at the same spot (its key).
 */
function collectComments(
	ast: AstTypes.Program,
	source: Comments
): Map<AstTypes.Node, CommentRecord> {
	const nodes: Array<{ node: AstTypes.Node; start: number; end: number }> = [];
	forEachNode(ast, (node) => {
		if (node.loc) nodes.push({ node, start: posKey(node.loc.start), end: posKey(node.loc.end) });
	});
	nodes.sort((a, b) => a.start - b.start || b.end - a.end);

	// top-level statements are newline-separated, so a trailing line comment is safe there. Inside an
	// object/array the next token is a `,` or `}` on the same line, which a `// line` comment would
	// swallow - so those get rewritten to a `/* block */` that can't run past its node.
	const topLevel = new Set<AstTypes.Node>(ast.body);

	const map = new Map<AstTypes.Node, CommentRecord>();
	const recordFor = (node: AstTypes.Node) => {
		let record = map.get(node);
		if (!record) map.set(node, (record = { leading: [], trailing: [] }));
		return record;
	};

	for (const comment of source.list()) {
		const start = posKey(comment.loc.start);
		const end = posKey(comment.loc.end);

		let prev: (typeof nodes)[number] | undefined;
		let next: (typeof nodes)[number] | undefined;
		for (const item of nodes) {
			if (item.end <= start && (!prev || item.end > prev.end)) prev = item;
			if (item.start >= end) {
				next = item;
				break;
			}
		}

		if (prev && comment.loc.start.line === prev.node.loc!.end.line) {
			const safeInline = comment.type === 'Block' || topLevel.has(prev.node);
			const value = safeInline ? comment.value : ` ${comment.value.trim()} `;
			recordFor(prev.node).trailing.push({ type: safeInline ? comment.type : 'Block', value });
		} else if (next) {
			recordFor(next.node).leading.push({ type: comment.type, value: comment.value });
		}
	}
	return map;
}

/** Returns the `checkOrigin: false` property of a `csrf` object, if present. */
function findDisabledCheckOrigin(
	value: AstTypes.ObjectExpression
): (AstTypes.Property & { key: AstTypes.Identifier }) | undefined {
	return value.properties.find(
		(p): p is AstTypes.Property & { key: AstTypes.Identifier } =>
			p.type === 'Property' &&
			p.key.type === 'Identifier' &&
			p.key.name === 'checkOrigin' &&
			p.value.type === 'Literal' &&
			p.value.value === false
	);
}
