import dedent from 'dedent';
import type { AstTypes, SvelteAst } from './tooling/index.ts';
import { type TransformFn, transforms } from './tooling/transforms.ts';

type KitRoutes = string & {};
type AddonName = string & {};

export type DemoPage = {
	/** Where the add-on's own demo route belongs. */
	addonPath: `${KitRoutes}/demo/${AddonName}`;
	/** Upserts the add-on link into the floating `DemoLinks` component. */
	links: [path: `${KitRoutes}/demo/DemoLinks.svelte`, transform: TransformFn];
	/** Upserts `<DemoLinks />` into the root layout. */
	layout: [path: `${KitRoutes}/+layout.svelte`, transform: TransformFn];
};

const COMPONENT = 'DemoLinks';
const LIST = 'demos';

function walk(nodes: SvelteAst.SvelteNode[], visit: (node: SvelteAst.SvelteNode) => boolean) {
	for (const node of nodes) {
		if (visit(node)) return true;
		if ('fragment' in node && node.fragment && 'nodes' in node.fragment) {
			if (walk(node.fragment.nodes, visit)) return true;
		}
	}
	return false;
}

const scriptTag = (language: 'ts' | 'js') => `<script${language === 'ts' ? ' lang="ts"' : ''}>`;

const linksTemplate = (language: 'ts' | 'js') => dedent`
	<!--
		@component
		Added by \`sv add\`. Lists the add-on demos in \`/demo/<add-on>\`.

		To remove: delete this file and \`<${COMPONENT} />\` from +layout.svelte
	-->

	${scriptTag(language)}
		import { resolve } from '$app/paths';

		const ${LIST} = [];
	</script>

	<div class="sv-demo-links">
		<p>sv addon demos</p>
		<ul>
			{#each ${LIST} as demo (demo.href)}
				<li><a href={demo.href}>{demo.name}</a></li>
			{/each}
		</ul>
	</div>

	<style>
		.sv-demo-links {
			position: fixed;
			right: 1.25rem;
			bottom: 1.25rem;
			z-index: 9999;
			min-width: 11rem;
			max-width: 16rem;
			padding: 1rem 1.125rem 0.875rem;
			background: linear-gradient(to bottom, #fff9b0, #fff176);
			color: #3d3500;
			font: 14px/1.5 system-ui, sans-serif;
			text-align: left;
			box-shadow:
				0 1px 2px rgb(0 0 0 / 0.15),
				0 10px 24px -6px rgb(0 0 0 / 0.35);
			transform: rotate(-1.5deg);
		}
		p {
			margin: 0;
			font-weight: 700;
			letter-spacing: 0.02em;
		}
		ul {
			margin: 0.5rem 0 0;
			padding: 0;
			list-style: none;
		}
		li {
			padding: 0.125rem 0;
		}
		a {
			color: #1a4fd6;
			text-decoration: underline;
			text-underline-offset: 2px;
		}
		a:visited {
			color: #6b6420;
		}
		a:hover {
			color: #0b2f8a;
		}
	</style>
`;

const layoutTemplate = (language: 'ts' | 'js') => dedent`
	${scriptTag(language)}
		let { children } = $props();
	</script>

	{@render children()}
`;

/**
 * Wires an add-on demo into a SvelteKit project: a floating `DemoLinks` post-it,
 * rendered from the root layout, listing every add-on demo route.
 *
 * ```ts
 * const demo = defineDemoPage('my-addon', language, directory.kitRoutes);
 * sv.file(...demo.links);
 * sv.file(...demo.layout);
 * sv.file(`${demo.addonPath}/+page.svelte`, ...);
 * ```
 *
 * Both transforms are idempotent, so re-running an add-on won't duplicate entries.
 */
export function defineDemoPage(name: string, language: 'ts' | 'js', kitRoutes: string): DemoPage {
	const href = `/demo/${name}`;

	const links: TransformFn = (content) =>
		transforms.svelteScript({ language }, ({ ast, js }) => {
			const program = ast.instance.content;
			const declaration = js.variables.declaration(program, {
				kind: 'const',
				name: LIST,
				value: js.array.create()
			});
			const list = (declaration.declarations[0] as AstTypes.VariableDeclarator).init;
			if (list?.type !== 'ArrayExpression') return false;

			const entry = js.common.parseExpression(`({ name: '${name}', href: resolve('${href}') })`);
			if (list.elements.some((e) => e && js.common.areNodesEqual(e, entry))) return false;

			js.imports.addNamed(program, { imports: ['resolve'], from: '$app/paths' });
			if (!program.body.includes(declaration)) program.body.push(declaration);
			list.elements.push(entry);
		})(content || linksTemplate(language));

	const layout: TransformFn = (content) =>
		transforms.svelteScript({ language }, ({ ast, js, svelte }) => {
			const exists = walk(
				ast.fragment.nodes,
				(node) => node.type === 'Component' && node.name === COMPONENT
			);
			if (exists) return false;

			js.imports.addDefault(ast.instance.content, {
				as: COMPONENT,
				from: `./demo/${COMPONENT}.svelte`
			});
			svelte.addFragment(ast, `<${COMPONENT} />`);
		})(content || layoutTemplate(language));

	return {
		addonPath: `${kitRoutes}/demo/${name}`,
		links: [`${kitRoutes}/demo/${COMPONENT}.svelte`, links],
		layout: [`${kitRoutes}/+layout.svelte`, layout]
	};
}
