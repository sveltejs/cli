import dedent from 'dedent';
import type { SvelteAst } from './tooling/index.ts';
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
	${scriptTag(language)}
		import { resolve } from '$app/paths';
	</script>

	<!-- Added by \`sv add\`. To remove: delete this file and \`<${COMPONENT} />\` from +layout.svelte -->
	<details class="sv-demo-links" open>
		<summary>sv demos</summary>
		<ul></ul>
	</details>

	<style>
		.sv-demo-links {
			position: fixed;
			right: 1rem;
			bottom: 1rem;
			z-index: 9999;
			max-width: 14rem;
			padding: 0.75rem 1rem;
			background: #fff59d;
			color: #3b3200;
			font: 14px/1.4 system-ui, sans-serif;
			border-radius: 2px;
			box-shadow: 0 6px 16px rgb(0 0 0 / 0.25);
			transform: rotate(-2deg);
		}
		summary {
			cursor: pointer;
			font-weight: 700;
		}
		ul {
			margin: 0.5rem 0 0;
			padding-left: 1.25rem;
		}
		a {
			color: inherit;
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
		transforms.svelteScript({ language }, ({ ast, content, js, svelte }) => {
			let ul: SvelteAst.RegularElement | undefined;
			const exists = walk(ast.fragment.nodes, (node) => {
				if (node.type !== 'RegularElement') return false;
				if (node.name === 'ul') ul ??= node;
				if (node.name !== 'a') return false;
				const attr = node.attributes.find((a) => a.type === 'Attribute' && a.name === 'href');
				// source slice so `/demo/x`, `{resolve('/demo/x')}`, ... all match
				return !!attr && content.slice(attr.start, attr.end).includes(`'${href}'`);
			});
			if (exists || !ul) return false;

			js.imports.addNamed(ast.instance.content, { imports: ['resolve'], from: '$app/paths' });
			svelte.addFragment(ul, `<li><a href={resolve('${href}')}>${name}</a></li>`);
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
