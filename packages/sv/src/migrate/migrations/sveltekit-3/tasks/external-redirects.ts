import { js, transforms, Walker, type AstTypes } from '@sveltejs/sv-utils';
import { defineMigrationTask } from '../../../index.ts';

const KIT_MODULE = '@sveltejs/kit';
const REDIRECT = 'redirect';
const BASES = ['https://sveltekit-a.invalid', 'https://sveltekit-b.invalid'];
/** Stands in for the dynamic remainder of a partially static destination (e.g. `https://${domain}`). */
const PLACEHOLDER = 'x';

export default defineMigrationTask({
	id: 'external-redirects',
	description: 'Opt external redirects into the new redirect behavior',
	run: ({ sv }) => {
		sv.files(
			{
				include: '**/*.{js,ts,svelte}',
				where: (content) => content.includes(KIT_MODULE) && content.includes(REDIRECT)
			},
			(content, file) => {
				if (file.endsWith('.svelte')) {
					return transforms.svelte(({ ast }) => {
						let changed = false;
						if (ast.module && migrateExternalRedirects(ast.module.content)) changed = true;
						if (ast.instance && migrateExternalRedirects(ast.instance.content)) changed = true;
						if (!changed) return false;
					})(content);
				}

				return transforms.script(({ ast }) => {
					if (!migrateExternalRedirects(ast)) return false;
				})(content);
			}
		);
	}
});

function migrateExternalRedirects(ast: AstTypes.Program): boolean {
	const { locals, namespaces } = collectRedirectImports(ast);
	if (locals.size === 0 && namespaces.size === 0) return false;

	let changed = false;
	Walker.walk(ast as AstTypes.Node, null, {
		CallExpression(node, { next }) {
			const destination = node.arguments[1];
			if (
				isRedirectCall(node, locals, namespaces) &&
				node.arguments.length === 2 &&
				destination?.type !== 'SpreadElement'
			) {
				const external = externalValue(destination);
				if (external !== undefined) {
					node.arguments.push(js.object.create({ external: js.common.createLiteral(external) }));
					changed = true;
				}
			}
			next();
		}
	});

	return changed;
}

function collectRedirectImports(ast: AstTypes.Program): {
	locals: Set<string>;
	namespaces: Set<string>;
} {
	const bindings = js.imports.bindings(ast, { from: KIT_MODULE });
	const locals = new Set(
		bindings
			.filter(
				(binding) => binding.kind === 'named' && binding.imported === REDIRECT && !binding.isType
			)
			.map((binding) => binding.local)
	);
	const namespaces = new Set(
		bindings
			.filter((binding) => binding.kind === 'namespace' && !binding.isType)
			.map((binding) => binding.local)
	);

	return { locals, namespaces };
}

function isRedirectCall(
	node: AstTypes.CallExpression,
	locals: ReadonlySet<string>,
	namespaces: ReadonlySet<string>
): boolean {
	const callee = node.callee;
	if (callee.type === 'Identifier') {
		return locals.has(callee.name);
	}

	if (callee.type === 'MemberExpression' && callee.object.type === 'Identifier') {
		if (!namespaces.has(callee.object.name)) return false;
		if (callee.computed) {
			return callee.property.type === 'Literal' && callee.property.value === REDIRECT;
		}
		return callee.property.type === 'Identifier' && callee.property.name === REDIRECT;
	}

	return false;
}

function externalValue(destination: AstTypes.Expression): true | 'javascript:' | undefined {
	const prefix = staticPrefix(destination);
	if (prefix === undefined) return undefined;

	let result = classify(prefix.value);
	if (result === undefined && !prefix.complete) {
		// e.g. `https://${domain}` - the bare prefix is not a valid URL,
		// so complete it with a stand-in for the dynamic remainder
		result = classify(prefix.value + PLACEHOLDER);
	}

	return result === false ? undefined : result;
}

/**
 * Classifies a destination string: `true` for external, `'javascript:'` for javascript URLs,
 * `false` for same-origin, and `undefined` when it cannot be parsed as a URL.
 */
function classify(value: string): true | 'javascript:' | false | undefined {
	try {
		const urls = BASES.map((base) => new URL(value, base));
		if (urls.some((url) => url.protocol === 'javascript:')) return 'javascript:';
		return urls.some((url, index) => url.origin !== BASES[index]) || false;
	} catch {
		return undefined;
	}
}

function staticPrefix(
	expression: AstTypes.Expression
): { value: string; complete: boolean } | undefined {
	if (expression.type === 'Literal') {
		return typeof expression.value === 'string'
			? { value: expression.value, complete: true }
			: undefined;
	}
	if (expression.type === 'TemplateLiteral') {
		const value = expression.quasis[0]?.value.cooked ?? expression.quasis[0]?.value.raw;
		if (value === undefined) return undefined;
		return { value, complete: expression.expressions.length === 0 };
	}
	if (expression.type === 'BinaryExpression' && expression.operator === '+') {
		if (expression.left.type === 'PrivateIdentifier') return undefined;
		const left = staticPrefix(expression.left);
		return left && { value: left.value, complete: false };
	}
}
